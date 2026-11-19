export type TenderSourceType =
  | 'official_source'
  | 'publisher_submitted'
  | 'partner_feed'
  | 'user_reported';

export type TenderStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'amended'
  | 'expired'
  | 'cancelled'
  | 'archived';

export interface PreviewTenderItem {
  id: string;
  referenceNumber: string | null;
  titleEn: string;
  titleAm: string | null;
  summaryEn: string;
  summaryAm: string | null;
  sourceType: TenderSourceType;
  sourceName: string;
  publisherNameDisplay: string;
  procurementMethod:
    | 'open_national'
    | 'open_international'
    | 'restricted'
    | 'request_for_proposal'
    | 'request_for_quotation'
    | 'expression_of_interest'
    | 'direct_procurement'
    | 'other';
  documentFeeEtb: number | null;
  bidSecurityEtb: number | null;
  hasDocuments: boolean;
  publishedAt: string | null;
  closingAt: string;
  status: TenderStatus;
  isFeatured: boolean;
  isSampleData: boolean;
  categoryNameEn: string;
  categoryNameAm: string;
  regionNameEn: string;
  regionNameAm: string;
}

export interface SubscriptionPlanItem {
  id: string;
  code: 'free' | 'starter' | 'professional';
  nameEn: string;
  nameAm: string;
  taglineEn: string;
  taglineAm: string;
  priceEtbMonthly: number;
  priceEtbAnnual: number | null;
  maxBookmarks: number;
  maxSavedSearches: number;
  instantAlerts: boolean;
  pushAlerts: boolean;
  csvExportEnabled: boolean;
  archiveDays: number;
}

export interface ListingPackageItem {
  id: string;
  code: 'standard_free' | 'featured_7d' | 'featured_14d' | 'featured_30d';
  nameEn: string;
  nameAm: string;
  descriptionEn: string | null;
  descriptionAm: string | null;
  priceEtb: number;
  durationDays: number;
  isFeatured: boolean;
}

export interface TaxonomyCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameAm: string;
}

export interface TaxonomyRegion {
  id: string;
  code: string;
  nameEn: string;
  nameAm: string;
}

export interface TaxonomyResponse {
  categories: TaxonomyCategory[];
  regions: TaxonomyRegion[];
  subscriptionPlans: SubscriptionPlanItem[];
  listingPackages: ListingPackageItem[];
}

export interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
  counts: {
    roles: number;
    regions: number;
    categories: number;
    subscriptionPlans: number;
    listingPackages: number;
    sampleTenders: number;
    liveTenders: number;
  };
}
