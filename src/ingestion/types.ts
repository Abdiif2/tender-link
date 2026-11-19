export type ConnectorType =
  | 'official_portal'
  | 'rss_atom'
  | 'json_api'
  | 'publisher_form'
  | 'email_announcement'
  | 'manual_admin'
  | 'csv_excel_import';

export type TenderSourceType =
  | 'official_source'
  | 'publisher_submitted'
  | 'partner_feed'
  | 'user_reported';

export type LegalReviewStatus =
  | 'not_required'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type ProcurementMethod =
  | 'open_national'
  | 'open_international'
  | 'restricted'
  | 'request_for_proposal'
  | 'request_for_quotation'
  | 'expression_of_interest'
  | 'direct_procurement';

export type QualitySeverity = 'error' | 'warning';

export type QualityFlagCode =
  | 'MISSING_TITLE'
  | 'MISSING_PUBLISHER'
  | 'MISSING_CLOSING_DATE'
  | 'MISSING_CATEGORY'
  | 'MISSING_SOURCE_URL'
  | 'CLOSING_DATE_IN_PAST'
  | 'INVALID_DATE_FORMAT'
  | 'SUSPICIOUS_DEADLINE_CHANGE'
  | 'DUPLICATE_CONTENT'
  | 'BROKEN_DOCUMENT_LINK'
  | 'SPAM_OR_MISLEADING'
  | 'MISSING_SOURCE_ATTRIBUTION'
  | 'SUSPECTED_SCAM_OR_ADVANCE_FEE'
  | 'MISLEADING_GOVERNMENT_CLAIM'
  | 'UNVERIFIED_MINISTRY_FREE_EMAIL'
  | 'UNSAFE_SOURCE_URL';

export interface QualityFlag {
  code: QualityFlagCode;
  severity: QualitySeverity;
  field: string;
  message: string;
}

export interface QualityReport {
  score: number; // 0-100
  flags: QualityFlag[];
  hasBlockingErrors: boolean;
  requiresModeration: boolean;
}

export interface RawDocumentAttachment {
  title?: string;
  url?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

export interface RawIngestionItem {
  externalId: string;
  referenceNumber?: string;
  title?: string;
  titleAm?: string;
  summary?: string;
  summaryAm?: string;
  description?: string;
  descriptionAm?: string;
  rawHtml?: string;
  pdfText?: string;
  eligibility?: string;
  eligibilityAm?: string;
  publisherName?: string;
  category?: string;
  region?: string;
  city?: string;
  publicationDate?: string;
  closingDate?: string;
  openingDate?: string;
  timezone?: string;
  currency?: string;
  estimatedValue?: string | number;
  documentFee?: string | number;
  bidSecurity?: string | number;
  procurementMethod?: string;
  language?: string;
  contactInfo?: string;
  contactEmail?: string;
  contactPhone?: string;
  sourceType?: TenderSourceType;
  sourceName?: string;
  sourceUrl?: string;
  documents?: RawDocumentAttachment[];
  isSampleData?: boolean;
  amendmentReasonEn?: string;
  amendmentReasonAm?: string;
  rawRowNumber?: number;
}

export interface TaxonomyLookup {
  categories: Array<{ id: string; slug: string; nameEn: string; nameAm: string }>;
  regions: Array<{ id: string; code: string; nameEn: string; nameAm: string }>;
}

export interface NormalizedDocument {
  title: string;
  url: string;
  mimeType: string;
  isValidUrl: boolean;
}

export interface NormalizedTenderDraft {
  externalId: string;
  referenceNumber: string | null;
  titleEn: string;
  titleAm: string | null;
  summaryEn: string;
  summaryAm: string | null;
  descriptionEn: string;
  descriptionAm: string | null;
  eligibilityEn: string | null;
  eligibilityAm: string | null;
  publisherNameDisplay: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryMatched: boolean;
  regionId: string | null;
  regionCode: string | null;
  city: string | null;
  publishedAt: Date | null;
  closingAt: Date | null;
  openingAt: Date | null;
  invalidDateFields: string[];
  timezone: string;
  currency: string;
  estimatedValueEtb: number | null;
  documentFeeEtb: number | null;
  bidSecurityEtb: number | null;
  procurementMethod: ProcurementMethod;
  language: 'en' | 'am';
  contactInfo: string | null;
  sourceType: TenderSourceType;
  sourceName: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  documents: NormalizedDocument[];
  contentHash: string;
  dedupeFingerprint: string;
  isSampleData: boolean;
  amendmentReasonEn: string | null;
  amendmentReasonAm: string | null;
}

export type DuplicateMatchType =
  | 'exact_source_id'
  | 'canonical_url'
  | 'content_hash'
  | 'publisher_and_closing_date'
  | 'title_similarity'
  | 'none';

export interface DuplicateCheckResult {
  classification: 'unique' | 'exact_duplicate' | 'amendment_candidate' | 'uncertain_duplicate';
  matchType: DuplicateMatchType;
  matchedTenderId: string | null;
  matchedTenderTitle: string | null;
  similarityScore: number; // 0..1
  existingClosingAt: Date | null;
  existingContentHash: string | null;
  reason: string;
}

export interface SourceConnectorDefinition {
  sourceKey: string;
  name: string;
  connectorType: ConnectorType;
  tenderSourceType: TenderSourceType;
  sourceUrl: string | null;
  frequencyMinutes: number;
  authMethod: string;
  rateLimitPerMinute: number;
  parserConfig: Record<string, unknown>;
  fetchItems: () => Promise<RawIngestionItem[]>;
}

export type IngestionRoutingOutcome =
  | 'queued_for_moderation'
  | 'duplicate_skipped'
  | 'duplicate_review_queued'
  | 'amended_version_created'
  | 'failed';

export interface IngestionRowReport {
  externalId: string;
  title: string;
  outcome: IngestionRoutingOutcome;
  tenderId: string | null;
  moderationCaseId: string | null;
  amendmentNumber: number | null;
  qualityScore: number;
  qualityFlags: QualityFlag[];
  duplicateMatchType: DuplicateMatchType;
  duplicateOfTenderId: string | null;
  message: string;
}

export interface IngestionRunReport {
  jobId: string;
  sourceKey: string;
  sourceName: string;
  status: 'succeeded' | 'partial_failure' | 'failed';
  recordsFound: number;
  recordsSaved: number;
  recordsModeration: number;
  recordsDuped: number;
  recordsAmended: number;
  recordsFailed: number;
  rows: IngestionRowReport[];
  errors: string[];
  startedAt: string;
  completedAt: string;
}
