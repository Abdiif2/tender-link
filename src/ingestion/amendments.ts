import crypto from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  bookmarks,
  notificationEvents,
  tenderAmendments,
  tenders,
  tenderVersions,
  users,
} from '../db/schema.ts';

export interface CreateAmendmentInput {
  tenderId: string;
  reasonEn: string;
  reasonAm?: string | null;
  newClosingAt?: Date | null;
  newDescriptionEn?: string | null;
  newSummaryEn?: string | null;
  newEligibilityEn?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  sourceLabel?: string;
}

export interface CreateAmendmentResult {
  amendmentId: string;
  amendmentNumber: number;
  versionNumber: number;
  previousClosingAt: Date;
  newClosingAt: Date;
  notifiedUsersCount: number;
}

/**
 * Creates a versioned amendment without ever silently overwriting the original
 * closing date or requirements. Snapshots the prior tender state into
 * `tender_versions`, inserts an immutable `tender_amendments` diff, updates the
 * tender status to `amended`, queues `notification_events` for all bookmarked
 * users, and records an `audit_logs` entry.
 */
export async function createVersionedAmendment(
  input: CreateAmendmentInput
): Promise<CreateAmendmentResult> {
  try {
    const [existing] = await db
      .select()
      .from(tenders)
      .where(and(eq(tenders.id, input.tenderId), isNull(tenders.deletedAt)))
      .limit(1);

    if (!existing) {
      const err = new Error('Tender not found for amendment.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const previousClosingAt = existing.closingAt;
    const nextClosingAt = input.newClosingAt ?? existing.closingAt;

    // 1. Ensure current state is captured in tender_versions before applying changes
    const existingVersions = await db
      .select({ versionNumber: tenderVersions.versionNumber })
      .from(tenderVersions)
      .where(eq(tenderVersions.tenderId, existing.id))
      .orderBy(desc(tenderVersions.versionNumber))
      .limit(1);

    const lastVersion = existingVersions[0]?.versionNumber ?? 0;

    if (lastVersion === 0) {
      await db.insert(tenderVersions).values({
        tenderId: existing.id,
        versionNumber: 1,
        snapshotJson: {
          titleEn: existing.titleEn,
          summaryEn: existing.summaryEn,
          descriptionEn: existing.descriptionEn,
          eligibilityEn: existing.eligibilityEn,
          closingAt: existing.closingAt.toISOString(),
          status: existing.status,
        },
        changeSummary: 'Initial version snapshot preserved prior to first amendment.',
        changedById: input.actorUserId ?? null,
      });
    }

    const nextVersionNumber = Math.max(existing.currentVersion, lastVersion, 1) + 1;

    // 2. Determine next amendment number
    const [latestAmendment] = await db
      .select({ amendmentNumber: tenderAmendments.amendmentNumber })
      .from(tenderAmendments)
      .where(eq(tenderAmendments.tenderId, existing.id))
      .orderBy(desc(tenderAmendments.amendmentNumber))
      .limit(1);

    const amendmentNumber = (latestAmendment?.amendmentNumber ?? 0) + 1;

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (nextClosingAt.getTime() !== previousClosingAt.getTime()) {
      changes.closingAt = {
        before: previousClosingAt.toISOString(),
        after: nextClosingAt.toISOString(),
      };
    }
    if (input.newSummaryEn && input.newSummaryEn !== existing.summaryEn) {
      changes.summaryEn = { before: existing.summaryEn, after: input.newSummaryEn };
    }
    if (input.newDescriptionEn && input.newDescriptionEn !== existing.descriptionEn) {
      changes.descriptionEn = {
        before: existing.descriptionEn,
        after: input.newDescriptionEn,
      };
    }
    if (input.newEligibilityEn && input.newEligibilityEn !== existing.eligibilityEn) {
      changes.eligibilityEn = {
        before: existing.eligibilityEn,
        after: input.newEligibilityEn,
      };
    }

    const updatedSummary = input.newSummaryEn || existing.summaryEn;
    const updatedDescription = input.newDescriptionEn || existing.descriptionEn;
    const updatedEligibility = input.newEligibilityEn ?? existing.eligibilityEn;

    // 3. Insert new snapshot version
    await db.insert(tenderVersions).values({
      tenderId: existing.id,
      versionNumber: nextVersionNumber,
      snapshotJson: {
        titleEn: existing.titleEn,
        summaryEn: updatedSummary,
        descriptionEn: updatedDescription,
        eligibilityEn: updatedEligibility,
        closingAt: nextClosingAt.toISOString(),
        status: 'amended',
        amendmentNumber,
      },
      changeSummary: input.reasonEn,
      changedById: input.actorUserId ?? null,
    });

    // 4. Insert versioned amendment record
    const [amendment] = await db
      .insert(tenderAmendments)
      .values({
        tenderId: existing.id,
        amendmentNumber,
        reasonEn: input.reasonEn,
        reasonAm:
          input.reasonAm ||
          `ማሻሻያ #${amendmentNumber}፡ የጨረታ መዝጊያ ቀን ወይም መስፈርት ተሻሽሏል።`,
        previousClosingAt,
        newClosingAt: nextClosingAt,
        changesJson: changes,
        createdById: input.actorUserId ?? null,
        approvedById: input.actorUserId ?? null,
        publishedAt: new Date(),
      })
      .returning({ id: tenderAmendments.id });

    // 5. Update tender record to amended state & bumped version
    await db
      .update(tenders)
      .set({
        closingAt: nextClosingAt,
        summaryEn: updatedSummary,
        descriptionEn: updatedDescription,
        eligibilityEn: updatedEligibility,
        status: 'amended',
        currentVersion: nextVersionNumber,
        updatedAt: new Date(),
      })
      .where(eq(tenders.id, existing.id));

    // 6. Notify all users who bookmarked this tender
    const bookmarkedUsers = await db
      .select({
        userId: bookmarks.userId,
        preferredLanguage: users.preferredLanguage,
      })
      .from(bookmarks)
      .innerJoin(users, eq(bookmarks.userId, users.id))
      .where(eq(bookmarks.tenderId, existing.id));

    let notifiedUsersCount = 0;
    for (const watcher of bookmarkedUsers) {
      const dedupeKey = `amendment:${existing.id}:v${amendmentNumber}:u:${watcher.userId}`;
      const isAm = watcher.preferredLanguage === 'am';
      const subject = isAm
        ? `የጨረታ ማሻሻያ #${amendmentNumber}፡ ${existing.titleAm || existing.titleEn}`
        : `Tender Amendment #${amendmentNumber}: ${existing.titleEn}`;
      const body = isAm
        ? `የመዘገቡት ጨረታ ተሻሽሏል። አዲሱ የመዝጊያ ቀን፡ ${nextClosingAt.toISOString().slice(0, 10)}። ምክንያት፡ ${input.reasonAm || input.reasonEn}`
        : `A tender you bookmarked has been amended. New closing date: ${nextClosingAt.toISOString().slice(0, 10)}. Reason: ${input.reasonEn}`;

      await db
        .insert(notificationEvents)
        .values({
          userId: watcher.userId,
          channel: 'in_app',
          eventType: 'tender_amended',
          dedupeKey: `${dedupeKey}:${crypto.randomBytes(3).toString('hex')}`,
          language: watcher.preferredLanguage,
          subject: subject.slice(0, 235),
          body,
          payloadJson: {
            tenderId: existing.id,
            amendmentNumber,
            previousClosingAt: previousClosingAt.toISOString(),
            newClosingAt: nextClosingAt.toISOString(),
          },
          status: 'queued',
        })
        .onConflictDoNothing();
      notifiedUsersCount += 1;
    }

    // 7. Immutable audit log
    await db.insert(auditLogs).values({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? 'system_ingestion',
      action: 'tender.amended',
      entityType: 'tender',
      entityId: existing.id,
      beforeJson: {
        currentVersion: existing.currentVersion,
        closingAt: previousClosingAt.toISOString(),
        status: existing.status,
      },
      afterJson: {
        currentVersion: nextVersionNumber,
        amendmentNumber,
        closingAt: nextClosingAt.toISOString(),
        status: 'amended',
        reasonEn: input.reasonEn,
        source: input.sourceLabel || 'admin',
        notifiedUsersCount,
      },
    });

    return {
      amendmentId: amendment.id,
      amendmentNumber,
      versionNumber: nextVersionNumber,
      previousClosingAt,
      newClosingAt: nextClosingAt,
      notifiedUsersCount,
    };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) {
      throw error;
    }
    console.error('Failed to create versioned tender amendment:', error);
    throw new Error('Failed to create versioned amendment.', { cause: error });
  }
}
