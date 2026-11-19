import crypto from 'crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  ingestionJobs,
  ingestionSources,
  moderationCases,
  regions,
  sourceRecords,
  tenderAmendments,
  tenderCategories,
  tenderDocuments,
  tenders,
} from '../db/schema.ts';
import { ensureSeedData } from '../db/seed.ts';
import { createVersionedAmendment } from './amendments.ts';
import { getRegisteredConnector, parseCsvOrExcelBuffer } from './connectors.ts';
import { detectDuplicateTender } from './deduplicator.ts';
import { normalizeIngestionItem } from './normalizer.ts';
import { evaluateDataQuality } from './quality.ts';
import type {
  IngestionRowReport,
  IngestionRunReport,
  QualityFlag,
  RawIngestionItem,
  TaxonomyLookup,
  TenderSourceType,
} from './types.ts';

async function loadTaxonomyLookup(): Promise<TaxonomyLookup> {
  await ensureSeedData();
  const [cats, regs] = await Promise.all([
    db
      .select({
        id: tenderCategories.id,
        slug: tenderCategories.slug,
        nameEn: tenderCategories.nameEn,
        nameAm: tenderCategories.nameAm,
      })
      .from(tenderCategories),
    db
      .select({
        id: regions.id,
        code: regions.code,
        nameEn: regions.nameEn,
        nameAm: regions.nameAm,
      })
      .from(regions),
  ]);
  return { categories: cats, regions: regs };
}

export async function runIngestionBatch(params: {
  sourceKey: string;
  sourceName: string;
  defaultSourceType: TenderSourceType;
  items: RawIngestionItem[];
  isSampleBatch?: boolean;
  actorUserId?: string | null;
  actorRole?: string | null;
  parseErrors?: string[];
}): Promise<IngestionRunReport> {
  const startedAt = new Date();
  await ensureSeedData();

  try {
    const taxonomy = await loadTaxonomyLookup();
    const fallbackCategory = taxonomy.categories[0];
    const fallbackRegion =
      taxonomy.regions.find((r) => r.code === 'ET-ALL') || taxonomy.regions[0];

    const [sourceRow] = await db
      .select()
      .from(ingestionSources)
      .where(eq(ingestionSources.sourceKey, params.sourceKey))
      .limit(1);

    const [job] = await db
      .insert(ingestionJobs)
      .values({
        sourceId: sourceRow?.id ?? null,
        sourceType: params.defaultSourceType,
        sourceKey: params.sourceKey,
        status: 'running',
        recordsFound: params.items.length,
        startedAt,
        errorLogJson: params.parseErrors ?? [],
      })
      .returning();

    let recordsSaved = 0;
    let recordsModeration = 0;
    let recordsDuped = 0;
    let recordsAmended = 0;
    let recordsFailed = 0;

    const rowReports: IngestionRowReport[] = [];
    const errors: string[] = [...(params.parseErrors ?? [])];

    for (const rawItem of params.items) {
      try {
        const draft = normalizeIngestionItem(
          rawItem,
          {
            sourceType: params.defaultSourceType,
            sourceName: params.sourceName,
            defaultTimezone: 'Africa/Addis_Ababa',
            isSampleData: params.isSampleBatch,
          },
          taxonomy
        );

        const duplicate = await detectDuplicateTender(draft);
        const quality = evaluateDataQuality(draft, duplicate);

        // CASE A: Exact duplicate — record provenance, skip inserting duplicate tender
        if (duplicate.classification === 'exact_duplicate') {
          recordsDuped += 1;
          await db
            .insert(sourceRecords)
            .values({
              ingestionJobId: job.id,
              tenderId: duplicate.matchedTenderId,
              sourceType: draft.sourceType,
              externalId: `${draft.externalId}#dup-${Date.now().toString(36)}`,
              sourceUrl: draft.sourceUrl,
              canonicalUrl: draft.canonicalUrl,
              rawPayloadHash: draft.contentHash,
              rawPayloadJson: rawItem as unknown as Record<string, unknown>,
              normalizedPayloadJson: draft as unknown as Record<string, unknown>,
              qualityScore: quality.score,
              qualityFlagsJson: quality.flags,
              duplicateMatchType: duplicate.matchType,
              duplicateOfTenderId: duplicate.matchedTenderId,
              routingOutcome: 'duplicate_skipped',
            })
            .onConflictDoNothing();

          rowReports.push({
            externalId: draft.externalId,
            title: draft.titleEn || '(Untitled)',
            outcome: 'duplicate_skipped',
            tenderId: duplicate.matchedTenderId,
            moderationCaseId: null,
            amendmentNumber: null,
            qualityScore: quality.score,
            qualityFlags: quality.flags,
            duplicateMatchType: duplicate.matchType,
            duplicateOfTenderId: duplicate.matchedTenderId,
            message: duplicate.reason,
          });
          continue;
        }

        // CASE B: Existing tender changed -> Versioned Amendment (never silent overwrite!)
        if (
          duplicate.classification === 'amendment_candidate' &&
          duplicate.matchedTenderId
        ) {
          const amendmentRes = await createVersionedAmendment({
            tenderId: duplicate.matchedTenderId,
            reasonEn:
              draft.amendmentReasonEn ||
              `Ingested update from ${params.sourceName} (${draft.externalId}).`,
            reasonAm: draft.amendmentReasonAm,
            newClosingAt: draft.closingAt,
            newSummaryEn: draft.summaryEn,
            newDescriptionEn: draft.descriptionEn,
            newEligibilityEn: draft.eligibilityEn,
            actorUserId: params.actorUserId ?? null,
            actorRole: params.actorRole ?? 'system_ingestion',
            sourceLabel: params.sourceKey,
          });

          recordsAmended += 1;

          await db
            .insert(sourceRecords)
            .values({
              ingestionJobId: job.id,
              tenderId: duplicate.matchedTenderId,
              sourceType: draft.sourceType,
              externalId: `${draft.externalId}#amd-v${amendmentRes.amendmentNumber}`,
              sourceUrl: draft.sourceUrl,
              canonicalUrl: draft.canonicalUrl,
              rawPayloadHash: draft.contentHash,
              rawPayloadJson: rawItem as unknown as Record<string, unknown>,
              normalizedPayloadJson: draft as unknown as Record<string, unknown>,
              qualityScore: quality.score,
              qualityFlagsJson: quality.flags,
              duplicateMatchType: duplicate.matchType,
              duplicateOfTenderId: duplicate.matchedTenderId,
              routingOutcome: 'amended_version_created',
            })
            .onConflictDoNothing();

          rowReports.push({
            externalId: draft.externalId,
            title: draft.titleEn || duplicate.matchedTenderTitle || '(Untitled)',
            outcome: 'amended_version_created',
            tenderId: duplicate.matchedTenderId,
            moderationCaseId: null,
            amendmentNumber: amendmentRes.amendmentNumber,
            qualityScore: quality.score,
            qualityFlags: quality.flags,
            duplicateMatchType: duplicate.matchType,
            duplicateOfTenderId: duplicate.matchedTenderId,
            message: `Created Amendment #${amendmentRes.amendmentNumber} (v${amendmentRes.versionNumber}); notified ${amendmentRes.notifiedUsersCount} bookmarked user(s).`,
          });
          continue;
        }

        // CASE C: New tender OR Uncertain Near-Duplicate -> Insert as `pending_review` + open `moderation_cases`
        const safeClosingAt =
          draft.closingAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const safeTitle = draft.titleEn || '[MISSING TITLE — REQUIRES MODERATION]';
        const safePublisher =
          draft.publisherNameDisplay || '[MISSING PUBLISHER — REQUIRES MODERATION]';
        const safeCategoryId = draft.categoryId ?? fallbackCategory?.id;
        const safeRegionId = draft.regionId ?? fallbackRegion?.id;

        if (!safeCategoryId || !safeRegionId) {
          throw new Error('Taxonomy reference categories/regions are not initialized.');
        }

        const [createdTender] = await db
          .insert(tenders)
          .values({
            referenceNumber: draft.referenceNumber,
            titleEn: safeTitle,
            titleAm: draft.titleAm,
            summaryEn: draft.summaryEn || safeTitle,
            summaryAm: draft.summaryAm,
            descriptionEn: draft.descriptionEn || safeTitle,
            descriptionAm: draft.descriptionAm,
            eligibilityEn: draft.eligibilityEn,
            eligibilityAm: draft.eligibilityAm,
            contactInfo: draft.contactInfo,
            sourceType: draft.sourceType,
            sourceName: draft.sourceName || params.sourceName,
            sourceUrl: draft.canonicalUrl || draft.sourceUrl,
            publisherNameDisplay: safePublisher,
            categoryId: safeCategoryId,
            regionId: safeRegionId,
            procurementMethod: draft.procurementMethod,
            language: draft.language,
            hasDocuments: draft.documents.length > 0,
            documentFeeEtb: draft.documentFeeEtb,
            bidSecurityEtb: draft.bidSecurityEtb,
            publishedAt: draft.publishedAt ?? new Date(),
            closingAt: safeClosingAt,
            openingAt: draft.openingAt,
            status: 'pending_review',
            isSampleData: draft.isSampleData,
            dedupeFingerprint: draft.dedupeFingerprint,
            submittedById: params.actorUserId ?? null,
          })
          .returning({ id: tenders.id });

        // Persist valid/referenced document metadata
        for (const doc of draft.documents) {
          await db.insert(tenderDocuments).values({
            tenderId: createdTender.id,
            title: doc.title,
            objectKey: doc.url,
            mimeType: doc.mimeType,
            fileSizeBytes: 0,
            sha256Hash: crypto.createHash('sha256').update(doc.url || doc.title).digest('hex'),
          });
        }

        const isUncertainDuplicate =
          duplicate.classification === 'uncertain_duplicate';
        const priority =
          quality.hasBlockingErrors || isUncertainDuplicate ? 1 : quality.score < 85 ? 2 : 5;

        const reasonSummary = [
          isUncertainDuplicate ? duplicate.reason : null,
          quality.flags.length > 0
            ? `Quality ${quality.score}/100 · Flags: ${quality.flags.map((f) => f.code).join(', ')}`
            : `Quality ${quality.score}/100 · Ready for standard moderation approval`,
        ]
          .filter(Boolean)
          .join(' | ');

        const [modCase] = await db
          .insert(moderationCases)
          .values({
            tenderId: createdTender.id,
            status: 'open',
            priority,
            decisionReason: reasonSummary,
            duplicateOfId: isUncertainDuplicate ? duplicate.matchedTenderId : null,
          })
          .returning({ id: moderationCases.id });

        const routingOutcome = isUncertainDuplicate
          ? 'duplicate_review_queued'
          : 'queued_for_moderation';

        await db
          .insert(sourceRecords)
          .values({
            ingestionJobId: job.id,
            tenderId: createdTender.id,
            sourceType: draft.sourceType,
            externalId: draft.externalId,
            sourceUrl: draft.sourceUrl,
            canonicalUrl: draft.canonicalUrl,
            rawPayloadHash: draft.contentHash,
            rawPayloadJson: rawItem as unknown as Record<string, unknown>,
            normalizedPayloadJson: draft as unknown as Record<string, unknown>,
            qualityScore: quality.score,
            qualityFlagsJson: quality.flags,
            duplicateMatchType: duplicate.matchType,
            duplicateOfTenderId: duplicate.matchedTenderId,
            routingOutcome,
          })
          .onConflictDoUpdate({
            target: [sourceRecords.sourceType, sourceRecords.externalId],
            set: {
              ingestionJobId: job.id,
              tenderId: createdTender.id,
              rawPayloadHash: draft.contentHash,
              rawPayloadJson: rawItem as unknown as Record<string, unknown>,
              normalizedPayloadJson: draft as unknown as Record<string, unknown>,
              qualityScore: quality.score,
              qualityFlagsJson: quality.flags,
              duplicateMatchType: duplicate.matchType,
              duplicateOfTenderId: duplicate.matchedTenderId,
              routingOutcome,
              fetchedAt: new Date(),
            },
          });

        recordsSaved += 1;
        recordsModeration += 1;

        rowReports.push({
          externalId: draft.externalId,
          title: safeTitle,
          outcome: routingOutcome,
          tenderId: createdTender.id,
          moderationCaseId: modCase.id,
          amendmentNumber: null,
          qualityScore: quality.score,
          qualityFlags: quality.flags,
          duplicateMatchType: duplicate.matchType,
          duplicateOfTenderId: duplicate.matchedTenderId,
          message: reasonSummary,
        });
      } catch (rowErr) {
        recordsFailed += 1;
        const msg =
          rowErr instanceof Error ? rowErr.message : 'Unexpected row processing error.';
        errors.push(`Item ${rawItem.externalId}: ${msg}`);
        rowReports.push({
          externalId: rawItem.externalId,
          title: rawItem.title || '(Failed item)',
          outcome: 'failed',
          tenderId: null,
          moderationCaseId: null,
          amendmentNumber: null,
          qualityScore: 0,
          qualityFlags: [],
          duplicateMatchType: 'none',
          duplicateOfTenderId: null,
          message: msg,
        });
      }
    }

    const completedAt = new Date();
    const jobStatus =
      recordsFailed > 0 && recordsSaved + recordsAmended + recordsDuped === 0
        ? 'failed'
        : recordsFailed > 0
          ? 'partial_failure'
          : 'succeeded';

    await db
      .update(ingestionJobs)
      .set({
        status: jobStatus,
        recordsFound: params.items.length,
        recordsSaved,
        recordsModeration,
        recordsDuped,
        recordsAmended,
        recordsFailed,
        errorSummary: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
        errorLogJson: errors,
        completedAt,
      })
      .where(eq(ingestionJobs.id, job.id));

    if (sourceRow) {
      await db
        .update(ingestionSources)
        .set({
          lastRunAt: completedAt,
          lastSuccessAt: jobStatus === 'failed' ? sourceRow.lastSuccessAt : completedAt,
          lastError: errors.length > 0 ? errors[0] : null,
          updatedAt: completedAt,
        })
        .where(eq(ingestionSources.id, sourceRow.id));
    }

    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? 'admin',
      action: 'ingestion.job_completed',
      entityType: 'ingestion_job',
      entityId: job.id,
      afterJson: {
        sourceKey: params.sourceKey,
        status: jobStatus,
        recordsFound: params.items.length,
        recordsSaved,
        recordsModeration,
        recordsDuped,
        recordsAmended,
        recordsFailed,
      },
    });

    return {
      jobId: job.id,
      sourceKey: params.sourceKey,
      sourceName: params.sourceName,
      status: jobStatus,
      recordsFound: params.items.length,
      recordsSaved,
      recordsModeration,
      recordsDuped,
      recordsAmended,
      recordsFailed,
      rows: rowReports,
      errors,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  } catch (error) {
    console.error('Ingestion batch failed:', error);
    throw new Error('Failed to execute ingestion pipeline.', { cause: error });
  }
}

export async function runRegisteredConnectorByKey(
  sourceKey: string,
  actor?: { userId?: string | null; role?: string | null }
): Promise<IngestionRunReport> {
  await ensureSeedData();
  const [source] = await db
    .select()
    .from(ingestionSources)
    .where(eq(ingestionSources.sourceKey, sourceKey))
    .limit(1);

  if (!source) {
    const err = new Error(`Ingestion source "${sourceKey}" not found.`) as Error & {
      statusCode?: number;
      code?: string;
    };
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Enforce legal / robots.txt approval gate
  if (
    !source.isEnabled ||
    (source.legalReviewStatus !== 'approved' && source.legalReviewStatus !== 'not_required')
  ) {
    const err = new Error(
      `Connector "${source.name}" is blocked by legal/robots.txt governance (status: ${source.legalReviewStatus}). Founder approval is required before enabling external sources.`
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 403;
    err.code = 'LEGAL_APPROVAL_REQUIRED';
    throw err;
  }

  const connector = getRegisteredConnector(sourceKey);
  if (!connector) {
    const err = new Error(
      `No executable connector implementation registered for "${sourceKey}".`
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 400;
    err.code = 'CONNECTOR_NOT_REGISTERED';
    throw err;
  }

  const items = await connector.fetchItems();
  return runIngestionBatch({
    sourceKey: source.sourceKey,
    sourceName: source.name,
    defaultSourceType: source.tenderSourceType,
    items,
    isSampleBatch: sourceKey === 'test_partner_json_feed',
    actorUserId: actor?.userId ?? null,
    actorRole: actor?.role ?? 'admin',
  });
}

export async function runBulkSpreadsheetImport(params: {
  fileName: string;
  buffer: Buffer;
  actorUserId?: string | null;
  actorRole?: string | null;
}): Promise<IngestionRunReport> {
  const { items, parseErrors } = parseCsvOrExcelBuffer(params.buffer, params.fileName);
  return runIngestionBatch({
    sourceKey: 'manual_csv_excel_import',
    sourceName: `Manual CSV/Excel Import (${params.fileName})`,
    defaultSourceType: 'publisher_submitted',
    items,
    parseErrors,
    actorUserId: params.actorUserId ?? null,
    actorRole: params.actorRole ?? 'admin',
  });
}

export async function createManualAdminTender(
  item: RawIngestionItem,
  actor?: { userId?: string | null; role?: string | null }
): Promise<IngestionRunReport> {
  return runIngestionBatch({
    sourceKey: 'manual_admin_entry',
    sourceName: item.sourceName || 'Manual Admin Tender Entry',
    defaultSourceType: item.sourceType || 'publisher_submitted',
    items: [item],
    isSampleBatch: Boolean(item.isSampleData),
    actorUserId: actor?.userId ?? null,
    actorRole: actor?.role ?? 'admin',
  });
}

export async function resolveModerationCase(params: {
  caseId: string;
  decision: 'approve' | 'reject' | 'mark_duplicate';
  reason?: string;
  actorUserId?: string | null;
  actorRole?: string | null;
}) {
  try {
    const [modCase] = await db
      .select()
      .from(moderationCases)
      .where(eq(moderationCases.id, params.caseId))
      .limit(1);

    if (!modCase) {
      const err = new Error('Moderation case not found.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if ((params.decision === 'reject' || params.decision === 'mark_duplicate') && !params.reason?.trim()) {
      const err = new Error('A decision reason is required when rejecting or marking as duplicate.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 400;
      err.code = 'REASON_REQUIRED';
      throw err;
    }

    const now = new Date();
    const nextCaseStatus: 'approved' | 'rejected' | 'removed' =
      params.decision === 'approve'
        ? 'approved'
        : params.decision === 'mark_duplicate'
          ? 'removed'
          : 'rejected';

    const finalReason =
      params.decision === 'mark_duplicate'
        ? `[DUPLICATE] ${params.reason?.trim()}`
        : params.reason?.trim() || 'Approved by moderator after quality verification.';

    await db
      .update(moderationCases)
      .set({
        status: nextCaseStatus,
        decisionReason: finalReason,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(moderationCases.id, modCase.id));

    const nextTenderStatus =
      params.decision === 'approve' ? 'published' : 'archived';

    await db
      .update(tenders)
      .set({
        status: nextTenderStatus,
        publishedAt: params.decision === 'approve' ? now : undefined,
        lastModeratedById: params.actorUserId ?? null,
        updatedAt: now,
      })
      .where(eq(tenders.id, modCase.tenderId));

    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? 'moderator',
      action: `moderation.${params.decision}`,
      entityType: 'moderation_case',
      entityId: modCase.id,
      beforeJson: { status: modCase.status, tenderId: modCase.tenderId },
      afterJson: {
        status: nextCaseStatus,
        tenderStatus: nextTenderStatus,
        reason: params.reason?.trim() || 'Approved by moderator.',
      },
    });

    return {
      caseId: modCase.id,
      tenderId: modCase.tenderId,
      caseStatus: nextCaseStatus,
      tenderStatus: nextTenderStatus,
      resolvedAt: now.toISOString(),
    };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error;
    console.error('Failed to resolve moderation case:', error);
    throw new Error('Failed to record moderation decision.', { cause: error });
  }
}

export async function getAdminIngestionOverview() {
  try {
    await ensureSeedData();

    const [sources, jobs, openCases, recentRecords, recentAmendments, recentAudits] =
      await Promise.all([
        db.select().from(ingestionSources).orderBy(ingestionSources.sourceKey),
        db
          .select()
          .from(ingestionJobs)
          .orderBy(desc(ingestionJobs.createdAt))
          .limit(20),
        db
          .select({
            caseId: moderationCases.id,
            status: moderationCases.status,
            priority: moderationCases.priority,
            decisionReason: moderationCases.decisionReason,
            duplicateOfId: moderationCases.duplicateOfId,
            createdAt: moderationCases.createdAt,
            tenderId: tenders.id,
            referenceNumber: tenders.referenceNumber,
            titleEn: tenders.titleEn,
            titleAm: tenders.titleAm,
            publisherNameDisplay: tenders.publisherNameDisplay,
            sourceType: tenders.sourceType,
            sourceName: tenders.sourceName,
            sourceUrl: tenders.sourceUrl,
            closingAt: tenders.closingAt,
            tenderStatus: tenders.status,
            isSampleData: tenders.isSampleData,
          })
          .from(moderationCases)
          .innerJoin(tenders, eq(moderationCases.tenderId, tenders.id))
          .where(and(eq(moderationCases.status, 'open'), isNull(tenders.deletedAt)))
          .orderBy(moderationCases.priority, desc(moderationCases.createdAt))
          .limit(40),
        db
          .select({
            id: sourceRecords.id,
            tenderId: sourceRecords.tenderId,
            externalId: sourceRecords.externalId,
            sourceType: sourceRecords.sourceType,
            qualityScore: sourceRecords.qualityScore,
            qualityFlagsJson: sourceRecords.qualityFlagsJson,
            duplicateMatchType: sourceRecords.duplicateMatchType,
            duplicateOfTenderId: sourceRecords.duplicateOfTenderId,
            routingOutcome: sourceRecords.routingOutcome,
            fetchedAt: sourceRecords.fetchedAt,
          })
          .from(sourceRecords)
          .orderBy(desc(sourceRecords.fetchedAt))
          .limit(50),
        db
          .select({
            id: tenderAmendments.id,
            tenderId: tenderAmendments.tenderId,
            amendmentNumber: tenderAmendments.amendmentNumber,
            reasonEn: tenderAmendments.reasonEn,
            previousClosingAt: tenderAmendments.previousClosingAt,
            newClosingAt: tenderAmendments.newClosingAt,
            publishedAt: tenderAmendments.publishedAt,
            tenderTitle: tenders.titleEn,
            referenceNumber: tenders.referenceNumber,
          })
          .from(tenderAmendments)
          .innerJoin(tenders, eq(tenderAmendments.tenderId, tenders.id))
          .orderBy(desc(tenderAmendments.createdAt))
          .limit(15),
        db
          .select()
          .from(auditLogs)
          .orderBy(desc(auditLogs.createdAt))
          .limit(30),
      ]);

    // Enrich moderation queue with matched duplicate titles & quality scores
    const recordByTenderId = new Map(
      recentRecords
        .filter((r) => Boolean(r.tenderId))
        .map((r) => [r.tenderId as string, r])
    );

    const duplicateTargetIds = Array.from(
      new Set(
        openCases
          .map((c) => c.duplicateOfId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const duplicateTargets =
      duplicateTargetIds.length > 0
        ? await db
            .select({
              id: tenders.id,
              titleEn: tenders.titleEn,
              referenceNumber: tenders.referenceNumber,
              publisherNameDisplay: tenders.publisherNameDisplay,
              closingAt: tenders.closingAt,
            })
            .from(tenders)
            .where(sql`${tenders.id} = ANY(${duplicateTargetIds}::uuid[])`)
        : [];
    const dupTargetMap = new Map(duplicateTargets.map((t) => [t.id, t]));

    const moderationQueue = openCases.map((c) => {
      const sr = recordByTenderId.get(c.tenderId);
      const dupTarget = c.duplicateOfId ? dupTargetMap.get(c.duplicateOfId) : null;
      return {
        ...c,
        closingAt: c.closingAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
        qualityScore: sr?.qualityScore ?? 100,
        qualityFlags: (sr?.qualityFlagsJson as QualityFlag[]) ?? [],
        duplicateMatchType: sr?.duplicateMatchType ?? 'none',
        duplicateTarget: dupTarget
          ? {
              ...dupTarget,
              closingAt: dupTarget.closingAt.toISOString(),
            }
          : null,
      };
    });

    // Aggregate Data Quality Dashboard metrics
    const flagCounts: Record<string, number> = {};
    let totalScore = 0;
    let lowQualityCount = 0;
    let duplicateFlaggedCount = 0;

    for (const rec of recentRecords) {
      totalScore += rec.qualityScore;
      if (rec.qualityScore < 80) lowQualityCount += 1;
      if (
        rec.routingOutcome === 'duplicate_skipped' ||
        rec.routingOutcome === 'duplicate_review_queued'
      ) {
        duplicateFlaggedCount += 1;
      }
      const flags = Array.isArray(rec.qualityFlagsJson)
        ? (rec.qualityFlagsJson as QualityFlag[])
        : [];
      for (const fl of flags) {
        flagCounts[fl.code] = (flagCounts[fl.code] || 0) + 1;
      }
    }

    const avgQualityScore =
      recentRecords.length > 0 ? Math.round(totalScore / recentRecords.length) : 100;

    return {
      sources: sources.map((s) => ({
        ...s,
        lastRunAt: s.lastRunAt?.toISOString() ?? null,
        lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      jobs: jobs.map((j) => ({
        ...j,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
      })),
      moderationQueue,
      amendments: recentAmendments.map((a) => ({
        ...a,
        previousClosingAt: a.previousClosingAt?.toISOString() ?? null,
        newClosingAt: a.newClosingAt?.toISOString() ?? null,
        publishedAt: a.publishedAt?.toISOString() ?? null,
      })),
      qualitySummary: {
        totalRecordsAnalysed: recentRecords.length,
        averageQualityScore: avgQualityScore,
        lowQualityCount,
        duplicateFlaggedCount,
        openModerationCount: moderationQueue.length,
        amendmentsCount: recentAmendments.length,
        flagBreakdown: Object.entries(flagCounts)
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count),
      },
      auditTrail: recentAudits.map((a) => ({
        id: a.id,
        actorRole: a.actorRole,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        afterJson: a.afterJson,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to load admin ingestion overview:', error);
    throw new Error('Failed to load ingestion dashboard data.', { cause: error });
  }
}
