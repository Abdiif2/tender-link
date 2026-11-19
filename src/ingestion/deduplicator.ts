import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sourceRecords, tenders } from '../db/schema.ts';
import type { DuplicateCheckResult, NormalizedTenderDraft } from './types.ts';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[sample\]|\[ናሙና\]/g, ' ')
    .replace(/[^a-z0-9\u1200-\u137f\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Combined Dice coefficient over word tokens and character bigrams so both
 * English and Amharic near-duplicate tender titles are caught reliably.
 */
export function computeTitleSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection += 1;
  }
  const diceTokens = (2 * intersection) / (tokensA.size + tokensB.size);

  const normA = Array.from(tokensA).sort().join(' ');
  const normB = Array.from(tokensB).sort().join(' ');
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < normA.length - 1; i++) bigramsA.add(normA.slice(i, i + 2));
  for (let i = 0; i < normB.length - 1; i++) bigramsB.add(normB.slice(i, i + 2));

  let bigramOverlap = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) bigramOverlap += 1;
  }
  const diceBigrams =
    bigramsA.size + bigramsB.size > 0
      ? (2 * bigramOverlap) / (bigramsA.size + bigramsB.size)
      : 0;

  return Number(((diceTokens * 0.65) + (diceBigrams * 0.35)).toFixed(3));
}

export function isSameDayOrWithin24Hours(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= 24 * 60 * 60 * 1000;
}

export async function detectDuplicateTender(
  draft: NormalizedTenderDraft
): Promise<DuplicateCheckResult> {
  try {
    // 1. Exact Source ID match (sourceType + externalId)
    const [existingSource] = await db
      .select({
        tenderId: sourceRecords.tenderId,
        rawPayloadHash: sourceRecords.rawPayloadHash,
      })
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.sourceType, draft.sourceType),
          eq(sourceRecords.externalId, draft.externalId)
        )
      )
      .limit(1);

    if (existingSource?.tenderId) {
      const [existingTender] = await db
        .select({
          id: tenders.id,
          titleEn: tenders.titleEn,
          closingAt: tenders.closingAt,
          descriptionEn: tenders.descriptionEn,
        })
        .from(tenders)
        .where(and(eq(tenders.id, existingSource.tenderId), isNull(tenders.deletedAt)))
        .limit(1);

      if (existingTender) {
        const closingChanged =
          Boolean(draft.closingAt) &&
          !isSameDayOrWithin24Hours(draft.closingAt, existingTender.closingAt);
        const hashChanged = existingSource.rawPayloadHash !== draft.contentHash;

        if (closingChanged || hashChanged) {
          return {
            classification: 'amendment_candidate',
            matchType: 'exact_source_id',
            matchedTenderId: existingTender.id,
            matchedTenderTitle: existingTender.titleEn,
            similarityScore: 1,
            existingClosingAt: existingTender.closingAt,
            existingContentHash: existingSource.rawPayloadHash,
            reason: `Matched existing source ID (${draft.externalId}) with updated closing date or content — route as versioned amendment.`,
          };
        }

        return {
          classification: 'exact_duplicate',
          matchType: 'exact_source_id',
          matchedTenderId: existingTender.id,
          matchedTenderTitle: existingTender.titleEn,
          similarityScore: 1,
          existingClosingAt: existingTender.closingAt,
          existingContentHash: existingSource.rawPayloadHash,
          reason: `Exact duplicate of source ID ${draft.externalId} with identical content.`,
        };
      }
    }

    // 2. Reference number + Publisher match (amendment or exact duplicate for existing seeded tenders)
    if (draft.referenceNumber) {
      const [byRef] = await db
        .select({
          id: tenders.id,
          titleEn: tenders.titleEn,
          closingAt: tenders.closingAt,
          publisherNameDisplay: tenders.publisherNameDisplay,
          descriptionEn: tenders.descriptionEn,
        })
        .from(tenders)
        .where(
          and(
            eq(tenders.referenceNumber, draft.referenceNumber),
            isNull(tenders.deletedAt)
          )
        )
        .limit(1);

      if (byRef) {
        const samePublisher =
          byRef.publisherNameDisplay.toLowerCase() ===
          draft.publisherNameDisplay.toLowerCase();
        if (samePublisher) {
          const closingChanged =
            Boolean(draft.closingAt) &&
            !isSameDayOrWithin24Hours(draft.closingAt, byRef.closingAt);
          const descChanged =
            draft.descriptionEn.length > 20 &&
            draft.descriptionEn.toLowerCase() !== byRef.descriptionEn.toLowerCase();

          if (closingChanged || (descChanged && draft.amendmentReasonEn)) {
            return {
              classification: 'amendment_candidate',
              matchType: 'exact_source_id',
              matchedTenderId: byRef.id,
              matchedTenderTitle: byRef.titleEn,
              similarityScore: 1,
              existingClosingAt: byRef.closingAt,
              existingContentHash: null,
              reason: `Matched existing tender reference ${draft.referenceNumber} with deadline or requirement changes — create versioned amendment.`,
            };
          }

          return {
            classification: 'exact_duplicate',
            matchType: 'exact_source_id',
            matchedTenderId: byRef.id,
            matchedTenderTitle: byRef.titleEn,
            similarityScore: 1,
            existingClosingAt: byRef.closingAt,
            existingContentHash: null,
            reason: `Exact duplicate matching reference ${draft.referenceNumber} and publisher ${byRef.publisherNameDisplay}.`,
          };
        }
      }
    }

    // 3. Canonical URL match
    if (draft.canonicalUrl) {
      const [byUrl] = await db
        .select({
          tenderId: sourceRecords.tenderId,
          rawPayloadHash: sourceRecords.rawPayloadHash,
        })
        .from(sourceRecords)
        .where(eq(sourceRecords.canonicalUrl, draft.canonicalUrl))
        .limit(1);

      if (byUrl?.tenderId) {
        const [existingTender] = await db
          .select({ id: tenders.id, titleEn: tenders.titleEn, closingAt: tenders.closingAt })
          .from(tenders)
          .where(and(eq(tenders.id, byUrl.tenderId), isNull(tenders.deletedAt)))
          .limit(1);

        if (existingTender) {
          const closingChanged =
            Boolean(draft.closingAt) &&
            Math.abs(draft.closingAt!.getTime() - existingTender.closingAt.getTime()) >
              60 * 60 * 1000;
          return {
            classification: closingChanged ? 'amendment_candidate' : 'exact_duplicate',
            matchType: 'canonical_url',
            matchedTenderId: existingTender.id,
            matchedTenderTitle: existingTender.titleEn,
            similarityScore: 1,
            existingClosingAt: existingTender.closingAt,
            existingContentHash: byUrl.rawPayloadHash,
            reason: closingChanged
              ? `Matched canonical URL with updated deadline — create versioned amendment.`
              : `Exact duplicate matching canonical URL ${draft.canonicalUrl}.`,
          };
        }
      }
    }

    // 4. Content hash / dedupe fingerprint match
    const [byFingerprint] = await db
      .select({
        id: tenders.id,
        titleEn: tenders.titleEn,
        closingAt: tenders.closingAt,
      })
      .from(tenders)
      .where(
        and(
          eq(tenders.dedupeFingerprint, draft.dedupeFingerprint),
          isNull(tenders.deletedAt)
        )
      )
      .limit(1);

    if (byFingerprint) {
      return {
        classification: 'exact_duplicate',
        matchType: 'content_hash',
        matchedTenderId: byFingerprint.id,
        matchedTenderTitle: byFingerprint.titleEn,
        similarityScore: 1,
        existingClosingAt: byFingerprint.closingAt,
        existingContentHash: draft.contentHash,
        reason: `Exact duplicate detected via content fingerprint against "${byFingerprint.titleEn}".`,
      };
    }

    // 5. Publisher + Closing Date & Title Similarity across recent active tenders
    const recentTenders = await db
      .select({
        id: tenders.id,
        titleEn: tenders.titleEn,
        publisherNameDisplay: tenders.publisherNameDisplay,
        closingAt: tenders.closingAt,
      })
      .from(tenders)
      .where(isNull(tenders.deletedAt))
      .orderBy(desc(tenders.createdAt))
      .limit(200);

    let bestUncertain: DuplicateCheckResult | null = null;

    for (const candidate of recentTenders) {
      const titleSim = computeTitleSimilarity(draft.titleEn, candidate.titleEn);
      const samePublisher =
        candidate.publisherNameDisplay.toLowerCase() ===
        draft.publisherNameDisplay.toLowerCase();
      const closeDateMatch = isSameDayOrWithin24Hours(draft.closingAt, candidate.closingAt);

      if (samePublisher && closeDateMatch && titleSim >= 0.45) {
        return {
          classification: 'uncertain_duplicate',
          matchType: 'publisher_and_closing_date',
          matchedTenderId: candidate.id,
          matchedTenderTitle: candidate.titleEn,
          similarityScore: titleSim,
          existingClosingAt: candidate.closingAt,
          existingContentHash: null,
          reason: `Same publisher (${candidate.publisherNameDisplay}) and closing date within 24h (${Math.round(titleSim * 100)}% title match) — routed to manual duplicate review.`,
        };
      }

      if (titleSim >= 0.72) {
        if (!bestUncertain || titleSim > bestUncertain.similarityScore) {
          bestUncertain = {
            classification: 'uncertain_duplicate',
            matchType: 'title_similarity',
            matchedTenderId: candidate.id,
            matchedTenderTitle: candidate.titleEn,
            similarityScore: titleSim,
            existingClosingAt: candidate.closingAt,
            existingContentHash: null,
            reason: `High title similarity (${Math.round(titleSim * 100)}%) with "${candidate.titleEn}" — routed to manual duplicate review.`,
          };
        }
      }
    }

    if (bestUncertain) {
      return bestUncertain;
    }

    return {
      classification: 'unique',
      matchType: 'none',
      matchedTenderId: null,
      matchedTenderTitle: null,
      similarityScore: 0,
      existingClosingAt: null,
      existingContentHash: null,
      reason: 'No duplicate match found.',
    };
  } catch (error) {
    console.error('Duplicate detection query failed:', error);
    throw new Error('Failed to run duplicate detection.', { cause: error });
  }
}
