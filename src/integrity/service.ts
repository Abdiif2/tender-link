import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  abuseReports,
  organisations,
  publishers,
  publisherVerifications,
  tenders,
} from '../db/schema.ts';
import { recordAuditEvent } from '../db/auth.ts';
import { maskEmail } from '../security/guard.ts';

// ============================================================================
// 1. ABUSE REPORTING & TAKEDOWN WORKFLOW
// ============================================================================

export async function submitAbuseReport(input: {
  tenderId: string;
  reporterId?: string | null;
  reporterEmail?: string | null;
  reason:
    | 'fake_or_scam'
    | 'expired_or_wrong_deadline'
    | 'duplicate_listing'
    | 'wrong_organisation'
    | 'broken_or_malicious_link'
    | 'policy_violation'
    | 'other';
  details: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const [tender] = await db
      .select({ id: tenders.id, titleEn: tenders.titleEn, status: tenders.status })
      .from(tenders)
      .where(eq(tenders.id, input.tenderId))
      .limit(1);

    if (!tender) {
      const err = new Error('Tender listing not found.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const [created] = await db
      .insert(abuseReports)
      .values({
        tenderId: tender.id,
        reporterId: input.reporterId ?? null,
        reporterEmail: input.reporterEmail?.trim().toLowerCase() || null,
        reason: input.reason,
        details: input.details.trim(),
        status: 'open',
      })
      .returning();

    await recordAuditEvent({
      actorUserId: input.reporterId ?? null,
      actorRole: input.reporterId ? 'user' : 'guest',
      action: 'integrity.abuse_report_submitted',
      entityType: 'abuse_report',
      entityId: created.id,
      afterJson: {
        tenderId: tender.id,
        reason: created.reason,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      id: created.id,
      tenderId: created.tenderId,
      tenderTitle: tender.titleEn,
      reason: created.reason,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Failed to submit abuse report:', error);
    throw new Error('Could not submit abuse report.', { cause: error });
  }
}

export async function resolveAbuseReport(input: {
  reportId: string;
  action: 'takedown' | 'dismiss';
  resolution: string;
  actorUserId?: string | null;
  actorRole?: string;
}) {
  try {
    const now = new Date();
    const [report] = await db
      .select()
      .from(abuseReports)
      .where(eq(abuseReports.id, input.reportId))
      .limit(1);

    if (!report) {
      const err = new Error('Abuse report not found.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const [tender] = await db
      .select()
      .from(tenders)
      .where(eq(tenders.id, report.tenderId))
      .limit(1);

    let tenderActionTaken = 'none';
    if (input.action === 'takedown' && tender) {
      await db
        .update(tenders)
        .set({
          status: 'archived',
          lastModeratedById: input.actorUserId ?? null,
          updatedAt: now,
        })
        .where(eq(tenders.id, tender.id));
      tenderActionTaken = 'archived';

      if (tender.publisherId) {
        await db
          .update(publishers)
          .set({
            strikeCount: sql`${publishers.strikeCount} + 1`,
            updatedAt: now,
          })
          .where(eq(publishers.id, tender.publisherId));
      }
    }

    const nextStatus = input.action === 'takedown' ? ('removed' as const) : ('rejected' as const);

    const [updatedReport] = await db
      .update(abuseReports)
      .set({
        status: nextStatus,
        reviewedById: input.actorUserId ?? null,
        resolution: input.resolution.trim(),
        resolvedAt: now,
      })
      .where(eq(abuseReports.id, report.id))
      .returning();

    await recordAuditEvent({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole || 'moderator',
      action:
        input.action === 'takedown'
          ? 'integrity.tender_taken_down'
          : 'integrity.abuse_report_dismissed',
      entityType: 'abuse_report',
      entityId: report.id,
      afterJson: {
        tenderId: report.tenderId,
        tenderActionTaken,
        resolution: input.resolution.trim(),
      },
    });

    return {
      reportId: updatedReport.id,
      status: updatedReport.status,
      tenderId: report.tenderId,
      tenderActionTaken,
      resolvedAt: now.toISOString(),
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Failed to resolve abuse report:', error);
    throw new Error('Could not resolve abuse report.', { cause: error });
  }
}

// ============================================================================
// 2. PUBLISHER VERIFICATION WORKFLOW
// ============================================================================

export async function submitPublisherVerification(input: {
  organisationNameEn: string;
  organisationType:
    | 'government_body'
    | 'public_enterprise'
    | 'private_company'
    | 'ngo'
    | 'international_org'
    | 'donor_agency'
    | 'university'
    | 'hospital'
    | 'other';
  tinNumber?: string;
  licenseNumber: string;
  officialEmail: string;
  submittedById?: string | null;
}) {
  try {
    const [org] = await db
      .insert(organisations)
      .values({
        nameEn: input.organisationNameEn.trim(),
        type: input.organisationType,
        tinNumber: input.tinNumber?.trim() || null,
        registrationRef: input.licenseNumber.trim(),
        officialEmail: input.officialEmail.trim().toLowerCase(),
      })
      .returning();

    const [pub] = await db
      .insert(publishers)
      .values({
        organisationId: org.id,
        verificationStatus: 'pending',
      })
      .returning();

    const [verification] = await db
      .insert(publisherVerifications)
      .values({
        publisherId: pub.id,
        submittedById: input.submittedById || org.id,
        licenseNumber: input.licenseNumber.trim(),
        status: 'pending',
      })
      .returning();

    await recordAuditEvent({
      actorUserId: input.submittedById ?? null,
      actorRole: 'publisher',
      action: 'integrity.publisher_verification_submitted',
      entityType: 'publisher_verification',
      entityId: verification.id,
      afterJson: {
        organisationNameEn: org.nameEn,
        organisationType: org.type,
        licenseNumber: input.licenseNumber.trim(),
      },
    });

    return {
      verificationId: verification.id,
      publisherId: pub.id,
      organisationId: org.id,
      organisationNameEn: org.nameEn,
      status: verification.status,
      createdAt: verification.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to submit publisher verification:', error);
    throw new Error('Could not submit publisher verification request.', { cause: error });
  }
}

export async function reviewPublisherVerification(input: {
  verificationId: string;
  decision: 'verified' | 'rejected';
  reviewNotes: string;
  actorUserId?: string | null;
  actorRole?: string;
}) {
  try {
    const now = new Date();
    const [verification] = await db
      .select()
      .from(publisherVerifications)
      .where(eq(publisherVerifications.id, input.verificationId))
      .limit(1);

    if (!verification) {
      const err = new Error('Publisher verification record not found.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 404;
      throw err;
    }

    await Promise.all([
      db
        .update(publisherVerifications)
        .set({
          status: input.decision,
          reviewedById: input.actorUserId ?? null,
          reviewNotes: input.reviewNotes.trim(),
          reviewedAt: now,
        })
        .where(eq(publisherVerifications.id, verification.id)),
      db
        .update(publishers)
        .set({
          verificationStatus: input.decision,
          verifiedAt: input.decision === 'verified' ? now : null,
          verifiedById: input.actorUserId ?? null,
          rejectionReason: input.decision === 'rejected' ? input.reviewNotes.trim() : null,
          updatedAt: now,
        })
        .where(eq(publishers.id, verification.publisherId)),
    ]);

    await recordAuditEvent({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole || 'moderator',
      action: `integrity.publisher_${input.decision}`,
      entityType: 'publisher_verification',
      entityId: verification.id,
      afterJson: {
        publisherId: verification.publisherId,
        decision: input.decision,
        reviewNotes: input.reviewNotes.trim(),
      },
    });

    return {
      verificationId: verification.id,
      publisherId: verification.publisherId,
      status: input.decision,
      reviewedAt: now.toISOString(),
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Failed to review publisher verification:', error);
    throw new Error('Could not complete publisher verification review.', { cause: error });
  }
}

export async function getPlatformIntegrityOverview() {
  try {
    const [reports, verifications] = await Promise.all([
      db
        .select({
          id: abuseReports.id,
          tenderId: abuseReports.tenderId,
          tenderTitleEn: tenders.titleEn,
          tenderStatus: tenders.status,
          tenderSourceType: tenders.sourceType,
          reason: abuseReports.reason,
          details: abuseReports.details,
          status: abuseReports.status,
          resolution: abuseReports.resolution,
          reporterEmail: abuseReports.reporterEmail,
          createdAt: abuseReports.createdAt,
          resolvedAt: abuseReports.resolvedAt,
        })
        .from(abuseReports)
        .innerJoin(tenders, eq(abuseReports.tenderId, tenders.id))
        .orderBy(desc(abuseReports.createdAt))
        .limit(25),
      db
        .select({
          id: publisherVerifications.id,
          publisherId: publisherVerifications.publisherId,
          organisationNameEn: organisations.nameEn,
          organisationType: organisations.type,
          officialEmail: organisations.officialEmail,
          licenseNumber: publisherVerifications.licenseNumber,
          status: publisherVerifications.status,
          reviewNotes: publisherVerifications.reviewNotes,
          strikeCount: publishers.strikeCount,
          createdAt: publisherVerifications.createdAt,
          reviewedAt: publisherVerifications.reviewedAt,
        })
        .from(publisherVerifications)
        .innerJoin(publishers, eq(publisherVerifications.publisherId, publishers.id))
        .innerJoin(organisations, eq(publishers.organisationId, organisations.id))
        .orderBy(desc(publisherVerifications.createdAt))
        .limit(25),
    ]);

    return {
      abuseReports: reports.map((r) => ({
        id: r.id,
        tenderId: r.tenderId,
        tenderTitleEn: r.tenderTitleEn,
        tenderStatus: r.tenderStatus,
        tenderSourceType: r.tenderSourceType,
        reason: r.reason,
        details: r.details,
        status: r.status,
        resolution: r.resolution,
        reporterEmailMasked: maskEmail(r.reporterEmail),
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
      publisherVerifications: verifications.map((v) => ({
        id: v.id,
        publisherId: v.publisherId,
        organisationNameEn: v.organisationNameEn,
        organisationType: v.organisationType,
        officialEmailMasked: maskEmail(v.officialEmail),
        licenseNumber: v.licenseNumber,
        status: v.status,
        reviewNotes: v.reviewNotes,
        strikeCount: v.strikeCount,
        createdAt: v.createdAt.toISOString(),
        reviewedAt: v.reviewedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error('Failed to load integrity overview:', error);
    throw new Error('Could not load platform integrity overview.', { cause: error });
  }
}
