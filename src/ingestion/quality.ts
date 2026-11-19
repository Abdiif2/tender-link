import type {
  DuplicateCheckResult,
  NormalizedTenderDraft,
  QualityFlag,
  QualityReport,
} from './types.ts';
import { detectFakeOrMisleadingListing } from '../security/guard.ts';

const SPAM_PATTERNS: RegExp[] = [
  /\b(guaranteed win|100% winner|pay via personal telebirr|crypto giveaway|whatsapp only for secret bid)\b/i,
  /\b(click here to claim|wire money now|urgent secret tender|free money)\b/i,
  /(.)\1{9,}/, // excessive repeated character spam
];

const SUSPICIOUS_SHORTEN_DAYS = 14;
const SUSPICIOUS_EXTEND_DAYS = 180;

export function evaluateDataQuality(
  draft: NormalizedTenderDraft,
  duplicate: DuplicateCheckResult,
  now: Date = new Date()
): QualityReport {
  const flags: QualityFlag[] = [];
  let score = 100;

  // 1. Missing title
  if (!draft.titleEn || draft.titleEn.length < 8) {
    flags.push({
      code: 'MISSING_TITLE',
      severity: 'error',
      field: 'title',
      message: 'Tender title is missing or too short (minimum 8 characters).',
    });
    score -= 30;
  }

  // 2. Missing publisher
  if (!draft.publisherNameDisplay || draft.publisherNameDisplay.length < 3) {
    flags.push({
      code: 'MISSING_PUBLISHER',
      severity: 'error',
      field: 'publisherName',
      message: 'Publishing organisation name is missing.',
    });
    score -= 25;
  }

  // 3. Invalid date format
  if (draft.invalidDateFields.length > 0) {
    flags.push({
      code: 'INVALID_DATE_FORMAT',
      severity: 'error',
      field: draft.invalidDateFields.join(', '),
      message: `Unparseable date format in: ${draft.invalidDateFields.join(', ')}. Expected ISO YYYY-MM-DD or DD/MM/YYYY.`,
    });
    score -= 20;
  }

  // 4. Missing closing date
  if (!draft.closingAt) {
    flags.push({
      code: 'MISSING_CLOSING_DATE',
      severity: 'error',
      field: 'closingDate',
      message: 'Closing date is required before a tender can be published.',
    });
    score -= 25;
  } else if (draft.closingAt.getTime() < now.getTime()) {
    // 5. Closing date in the past
    flags.push({
      code: 'CLOSING_DATE_IN_PAST',
      severity: 'warning',
      field: 'closingDate',
      message: `Closing date (${draft.closingAt.toISOString().slice(0, 10)}) is already in the past.`,
    });
    score -= 18;
  }

  // 6. Missing category
  if (!draft.categoryMatched || !draft.categoryId) {
    flags.push({
      code: 'MISSING_CATEGORY',
      severity: 'warning',
      field: 'category',
      message: 'Category could not be matched to a standard TenderLink sector.',
    });
    score -= 12;
  }

  // 7. Missing source attribution & source URL
  if (!draft.sourceName || !draft.sourceType) {
    flags.push({
      code: 'MISSING_SOURCE_ATTRIBUTION',
      severity: 'error',
      field: 'sourceName',
      message: 'Every tender record must include clear source attribution.',
    });
    score -= 20;
  }

  if (
    (draft.sourceType === 'official_source' || draft.sourceType === 'partner_feed') &&
    !draft.canonicalUrl
  ) {
    flags.push({
      code: 'MISSING_SOURCE_URL',
      severity: 'warning',
      field: 'sourceUrl',
      message: 'External official/partner tender is missing a valid canonical source URL.',
    });
    score -= 10;
  }

  // 8. Broken document links
  const brokenDocs = draft.documents.filter((doc) => !doc.isValidUrl);
  if (brokenDocs.length > 0) {
    flags.push({
      code: 'BROKEN_DOCUMENT_LINK',
      severity: 'warning',
      field: 'documents',
      message: `${brokenDocs.length} attached document link(s) appear malformed or broken.`,
    });
    score -= 12;
  }

  // 9. Duplicate content flag
  if (
    duplicate.classification === 'exact_duplicate' ||
    duplicate.classification === 'uncertain_duplicate'
  ) {
    flags.push({
      code: 'DUPLICATE_CONTENT',
      severity: duplicate.classification === 'exact_duplicate' ? 'error' : 'warning',
      field: 'duplicate',
      message: duplicate.reason,
    });
    score -= duplicate.classification === 'exact_duplicate' ? 30 : 15;
  }

  // 10. Suspicious deadline change on amendments
  if (
    duplicate.classification === 'amendment_candidate' &&
    duplicate.existingClosingAt &&
    draft.closingAt
  ) {
    const diffDays =
      (draft.closingAt.getTime() - duplicate.existingClosingAt.getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays < -SUSPICIOUS_SHORTEN_DAYS || diffDays > SUSPICIOUS_EXTEND_DAYS) {
      flags.push({
        code: 'SUSPICIOUS_DEADLINE_CHANGE',
        severity: 'warning',
        field: 'closingDate',
        message: `Closing date shifted by ${Math.round(diffDays)} days compared to existing version; requires moderator verification.`,
      });
      score -= 18;
    }
  }

  // 11. Potential spam, fake listing, government impersonation, or SSRF URL checks
  const combinedText = `${draft.titleEn} ${draft.summaryEn} ${draft.descriptionEn}`;
  if (SPAM_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    flags.push({
      code: 'SPAM_OR_MISLEADING',
      severity: 'error',
      field: 'description',
      message: 'Content matched anti-spam or misleading solicitation rules and is held for manual review.',
    });
    score -= 40;
  }

  const integrityFindings = detectFakeOrMisleadingListing({
    title: draft.titleEn,
    summary: draft.summaryEn,
    description: draft.descriptionEn,
    publisherName: draft.publisherNameDisplay,
    sourceType: draft.sourceType,
    contactEmail: draft.contactInfo?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0],
    sourceUrl: draft.sourceUrl ?? undefined,
  });

  for (const finding of integrityFindings) {
    flags.push({
      code: finding.code,
      severity: finding.severity,
      field: 'integrity',
      message: finding.message,
    });
    score -= finding.severity === 'error' ? 35 : 15;
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const hasBlockingErrors = flags.some((f) => f.severity === 'error');

  // Strict platform policy: ingested tenders always route through moderation before public visibility
  const requiresModeration = true;

  return {
    score: clampedScore,
    flags,
    hasBlockingErrors,
    requiresModeration,
  };
}
