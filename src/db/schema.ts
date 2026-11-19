import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

export const roleCodeEnum = pgEnum('role_code', [
  'guest',
  'seeker',
  'publisher',
  'publisher_admin',
  'moderator',
  'finance_admin',
  'super_admin',
]);

export const languageCodeEnum = pgEnum('language_code', [
  'en',
  'am',
  'om',
  'ti',
  'so',
]);

export const otpPurposeEnum = pgEnum('otp_purpose', [
  'login',
  'verify_email',
  'verify_phone',
  'password_reset',
  'delete_account',
]);

export const organisationTypeEnum = pgEnum('organisation_type', [
  'government_body',
  'public_enterprise',
  'private_company',
  'ngo',
  'international_org',
  'donor_agency',
  'university',
  'hospital',
  'other',
]);

export const verificationStatusEnum = pgEnum('verification_status', [
  'unverified',
  'pending',
  'verified',
  'rejected',
  'suspended',
]);

export const tenderSourceTypeEnum = pgEnum('tender_source_type', [
  'official_source',
  'publisher_submitted',
  'partner_feed',
  'user_reported',
]);

export const tenderStatusEnum = pgEnum('tender_status', [
  'draft',
  'pending_review',
  'published',
  'amended',
  'expired',
  'cancelled',
  'archived',
]);

export const procurementMethodEnum = pgEnum('procurement_method', [
  'open_national',
  'open_international',
  'restricted',
  'request_for_proposal',
  'request_for_quotation',
  'expression_of_interest',
  'direct_procurement',
  'other',
]);

export const listingTierEnum = pgEnum('listing_tier', [
  'standard_free',
  'featured_7d',
  'featured_14d',
  'featured_30d',
]);

export const alertFrequencyEnum = pgEnum('alert_frequency', [
  'instant',
  'daily',
  'weekly',
  'off',
]);

export const notificationChannelEnum = pgEnum('notification_channel', [
  'email',
  'push',
  'in_app',
  'sms',
  'telegram',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'suppressed',
]);

export const planCodeEnum = pgEnum('plan_code', [
  'free',
  'starter',
  'professional',
  'publisher_basic',
  'publisher_pro',
]);

export const planAudienceEnum = pgEnum('plan_audience', [
  'seeker',
  'publisher',
]);

export const billingIntervalEnum = pgEnum('billing_interval', [
  'free',
  'monthly',
  'annual',
  'per_listing',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired',
]);

export const paymentProviderEnum = pgEnum('payment_provider', ['chapa']);

export const paymentChannelEnum = pgEnum('payment_channel', [
  'telebirr',
  'cbe_birr',
  'ebirr',
  'mpesa',
  'bank_transfer',
  'card',
]);

export const paymentPurposeEnum = pgEnum('payment_purpose', [
  'subscription',
  'featured_listing',
  'publisher_listing',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'disputed',
  'cancelled',
  'partially_refunded',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'issued',
  'paid',
  'void',
  'refunded',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'requested',
  'approved',
  'processing',
  'succeeded',
  'failed',
  'rejected',
]);

export const moderationStatusEnum = pgEnum('moderation_status', [
  'open',
  'in_review',
  'approved',
  'changes_requested',
  'rejected',
  'removed',
]);

export const abuseReasonEnum = pgEnum('abuse_reason', [
  'fake_or_scam',
  'expired_or_wrong_deadline',
  'duplicate_listing',
  'wrong_organisation',
  'broken_or_malicious_link',
  'policy_violation',
  'other',
]);

export const ingestionStatusEnum = pgEnum('ingestion_status', [
  'queued',
  'running',
  'succeeded',
  'partial_failure',
  'failed',
]);

export const connectorTypeEnum = pgEnum('connector_type', [
  'official_portal',
  'rss_atom',
  'json_api',
  'publisher_form',
  'email_announcement',
  'manual_admin',
  'csv_excel_import',
]);

export const legalReviewStatusEnum = pgEnum('legal_review_status', [
  'not_required',
  'pending_review',
  'approved',
  'rejected',
]);

export const dsrTypeEnum = pgEnum('dsr_type', [
  'access',
  'rectification',
  'erasure',
  'portability',
  'objection',
  'withdraw_consent',
]);

export const dsrStatusEnum = pgEnum('dsr_status', [
  'submitted',
  'in_review',
  'completed',
  'rejected',
]);

export const incidentSeverityEnum = pgEnum('incident_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const incidentStatusEnum = pgEnum('incident_status', [
  'detected',
  'investigating',
  'contained',
  'notified',
  'resolved',
]);

// ============================================================================
// 1. USERS, ROLES, ORGANISATIONS, SESSIONS, OTP CODES
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uid: varchar('uid', { length: 128 }).unique(), // Firebase Auth UID
    email: varchar('email', { length: 255 }).unique(),
    phone: varchar('phone', { length: 32 }).unique(),
    passwordHash: text('password_hash'),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    preferredLanguage: languageCodeEnum('preferred_language')
      .default('en')
      .notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    marketingConsent: boolean('marketing_consent').default(false).notNull(),
    notificationConsent: boolean('notification_consent').default(false).notNull(),
    consentUpdatedAt: timestamp('consent_updated_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaSecret: varchar('mfa_secret', { length: 128 }),
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id'),
    anonymisedAt: timestamp('anonymised_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_users_active_deleted').on(table.isActive, table.deletedAt),
    index('idx_users_preferred_lang').on(table.preferredLanguage),
  ]
);

export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: roleCodeEnum('code').notNull().unique(),
  nameEn: varchar('name_en', { length: 80 }).notNull(),
  nameAm: varchar('name_am', { length: 80 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    grantedById: uuid('granted_by_id'),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_user_roles_user_role').on(table.userId, table.roleId),
    index('idx_user_roles_role').on(table.roleId),
  ]
);

export const regions = pgTable('regions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  nameEn: varchar('name_en', { length: 120 }).notNull(),
  nameAm: varchar('name_am', { length: 120 }).notNull(),
  translationsJson: jsonb('translations_json'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const organisations = pgTable(
  'organisations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nameEn: varchar('name_en', { length: 200 }).notNull(),
    nameAm: varchar('name_am', { length: 200 }),
    translationsJson: jsonb('translations_json'),
    type: organisationTypeEnum('type').notNull(),
    tinNumber: varchar('tin_number', { length: 64 }),
    registrationRef: varchar('registration_ref', { length: 120 }),
    officialEmail: varchar('official_email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    websiteUrl: varchar('website_url', { length: 500 }),
    regionId: uuid('region_id').references(() => regions.id),
    city: varchar('city', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id'),
  },
  (table) => [
    index('idx_organisations_type_deleted').on(table.type, table.deletedAt),
    index('idx_organisations_tin').on(table.tinNumber),
  ]
);

export const organisationMembers = pgTable(
  'organisation_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: roleCodeEnum('member_role').default('publisher').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_org_member').on(table.organisationId, table.userId),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 })
      .notNull()
      .unique(),
    userAgent: varchar('user_agent', { length: 300 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_sessions_user_expires').on(table.userId, table.expiresAt)]
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    destination: varchar('destination', { length: 255 }).notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_otp_dest_purpose_expires').on(
      table.destination,
      table.purpose,
      table.expiresAt
    ),
  ]
);

// ============================================================================
// 2. CATEGORIES, PUBLISHERS, TENDERS, DOCUMENTS, VERSIONS, AMENDMENTS
// ============================================================================

export const tenderCategories = pgTable(
  'tender_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull().unique(),
    nameEn: varchar('name_en', { length: 120 }).notNull(),
    nameAm: varchar('name_am', { length: 120 }).notNull(),
    translationsJson: jsonb('translations_json'),
    parentId: uuid('parent_id'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [index('idx_categories_parent_active').on(table.parentId, table.isActive)]
);

export const publishers = pgTable(
  'publishers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organisationId: uuid('organisation_id')
      .notNull()
      .unique()
      .references(() => organisations.id, { onDelete: 'cascade' }),
    verificationStatus: verificationStatusEnum('verification_status')
      .default('pending')
      .notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedById: uuid('verified_by_id'),
    rejectionReason: text('rejection_reason'),
    strikeCount: integer('strike_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_publishers_status_deleted').on(
      table.verificationStatus,
      table.deletedAt
    ),
  ]
);

export const publisherVerifications = pgTable(
  'publisher_verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => publishers.id, { onDelete: 'cascade' }),
    submittedById: uuid('submitted_by_id').notNull(),
    documentObjectKey: varchar('document_object_key', { length: 500 }),
    licenseNumber: varchar('license_number', { length: 120 }),
    status: verificationStatusEnum('status').default('pending').notNull(),
    reviewedById: uuid('reviewed_by_id'),
    reviewNotes: text('review_notes'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_pub_verif_publisher_status').on(table.publisherId, table.status),
  ]
);

export const tenders = pgTable(
  'tenders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referenceNumber: varchar('reference_number', { length: 120 }),
    titleEn: varchar('title_en', { length: 300 }).notNull(),
    titleAm: varchar('title_am', { length: 300 }),
    summaryEn: text('summary_en').notNull(),
    summaryAm: text('summary_am'),
    descriptionEn: text('description_en').notNull(),
    descriptionAm: text('description_am'),
    eligibilityEn: text('eligibility_en'),
    eligibilityAm: text('eligibility_am'),
    contactInfo: text('contact_info'),
    translationsJson: jsonb('translations_json'),
    sourceType: tenderSourceTypeEnum('source_type').notNull(),
    sourceName: varchar('source_name', { length: 200 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    publisherId: uuid('publisher_id').references(() => publishers.id),
    publisherNameDisplay: varchar('publisher_name_display', { length: 200 }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => tenderCategories.id),
    regionId: uuid('region_id')
      .notNull()
      .references(() => regions.id),
    procurementMethod: procurementMethodEnum('procurement_method')
      .default('open_national')
      .notNull(),
    language: languageCodeEnum('language').default('en').notNull(),
    hasDocuments: boolean('has_documents').default(false).notNull(),
    documentFeeEtb: integer('document_fee_etb'),
    bidSecurityEtb: integer('bid_security_etb'),
    submissionInstructions: text('submission_instructions'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    closingAt: timestamp('closing_at', { withTimezone: true }).notNull(),
    openingAt: timestamp('opening_at', { withTimezone: true }),
    status: tenderStatusEnum('status').default('draft').notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    featuredUntil: timestamp('featured_until', { withTimezone: true }),
    isSampleData: boolean('is_sample_data').default(false).notNull(),
    dedupeFingerprint: varchar('dedupe_fingerprint', { length: 64 }).notNull(),
    currentVersion: integer('current_version').default(1).notNull(),
    viewsCount: integer('views_count').default(0).notNull(),
    submittedById: uuid('submitted_by_id').references(() => users.id),
    lastModeratedById: uuid('last_moderated_by_id'),
    indexedAt: timestamp('indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id'),
  },
  (table) => [
    index('idx_tenders_status_deleted_closing').on(
      table.status,
      table.deletedAt,
      table.closingAt
    ),
    index('idx_tenders_source_status_deleted').on(
      table.sourceType,
      table.status,
      table.deletedAt
    ),
    index('idx_tenders_cat_reg_status').on(
      table.categoryId,
      table.regionId,
      table.status
    ),
    index('idx_tenders_publisher_status').on(table.publisherId, table.status),
    index('idx_tenders_featured').on(table.isFeatured, table.featuredUntil),
    index('idx_tenders_dedupe').on(table.dedupeFingerprint),
  ]
);

export const tenderDocuments = pgTable(
  'tender_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 240 }).notNull(),
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    sha256Hash: varchar('sha256_hash', { length: 64 }).notNull(),
    uploadedById: uuid('uploaded_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_tender_docs_tender').on(table.tenderId, table.deletedAt)]
);

export const tenderVersions = pgTable(
  'tender_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    snapshotJson: jsonb('snapshot_json').notNull(),
    changeSummary: text('change_summary'),
    changedById: uuid('changed_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_tender_version').on(table.tenderId, table.versionNumber),
  ]
);

export const tenderAmendments = pgTable(
  'tender_amendments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    amendmentNumber: integer('amendment_number').notNull(),
    reasonEn: text('reason_en').notNull(),
    reasonAm: text('reason_am'),
    previousClosingAt: timestamp('previous_closing_at', { withTimezone: true }),
    newClosingAt: timestamp('new_closing_at', { withTimezone: true }),
    changesJson: jsonb('changes_json').notNull(),
    createdById: uuid('created_by_id'),
    approvedById: uuid('approved_by_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_tender_amendment').on(table.tenderId, table.amendmentNumber),
    index('idx_tender_amendments_pub').on(table.tenderId, table.publishedAt),
  ]
);

// ============================================================================
// 3. SUBSCRIPTIONS, PACKAGES, CHAPA PAYMENTS, INVOICES, REFUNDS
// ============================================================================

export const billingConfig = pgTable('billing_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  configKey: varchar('config_key', { length: 48 }).default('default').notNull().unique(),
  currency: varchar('currency', { length: 8 }).default('ETB').notNull(),
  vatEnabled: boolean('vat_enabled').default(true).notNull(),
  vatRateBps: integer('vat_rate_bps').default(1500).notNull(), // 1500 = 15.00% Ethiopian VAT
  invoicePrefix: varchar('invoice_prefix', { length: 24 }).default('TL-ET').notNull(),
  nextInvoiceSequence: integer('next_invoice_sequence').default(1).notNull(),
  supplierLegalName: varchar('supplier_legal_name', { length: 200 })
    .default('TenderLink Ethiopia Information Services PLC')
    .notNull(),
  supplierTin: varchar('supplier_tin', { length: 64 }).default('0000000000-TEST').notNull(),
  trialDaysDefault: integer('trial_days_default').default(7).notNull(),
  testModeEnabled: boolean('test_mode_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: planCodeEnum('code').notNull().unique(),
  audience: planAudienceEnum('audience').default('seeker').notNull(),
  sortOrder: integer('sort_order').default(1).notNull(),
  nameEn: varchar('name_en', { length: 80 }).notNull(),
  nameAm: varchar('name_am', { length: 80 }).notNull(),
  taglineEn: varchar('tagline_en', { length: 160 }).notNull(),
  taglineAm: varchar('tagline_am', { length: 160 }).notNull(),
  priceEtbMonthly: integer('price_etb_monthly').notNull(),
  priceEtbAnnual: integer('price_etb_annual'),
  maxBookmarks: integer('max_bookmarks').notNull(), // -1 = unlimited
  maxSavedSearches: integer('max_saved_searches').notNull(), // -1 = unlimited
  instantAlerts: boolean('instant_alerts').default(false).notNull(),
  pushAlerts: boolean('push_alerts').default(false).notNull(),
  smsTelegramAlerts: boolean('sms_telegram_alerts').default(false).notNull(),
  advancedFilters: boolean('advanced_filters').default(false).notNull(),
  fullDocumentAccess: boolean('full_document_access').default(false).notNull(),
  buyerTracking: boolean('buyer_tracking').default(false).notNull(),
  prioritySupport: boolean('priority_support').default(false).notNull(),
  unlimitedListings: boolean('unlimited_listings').default(false).notNull(),
  featuredPlacement: boolean('featured_placement').default(false).notNull(),
  targetedAlerts: boolean('targeted_alerts').default(false).notNull(),
  advancedAnalytics: boolean('advanced_analytics').default(false).notNull(),
  accountManagerSupport: boolean('account_manager_support').default(false).notNull(),
  listingDurationDays: integer('listing_duration_days').default(30).notNull(),
  csvExportEnabled: boolean('csv_export_enabled').default(false).notNull(),
  archiveDays: integer('archive_days').default(30).notNull(), // -1 = full archive
  featuresJson: jsonb('features_json').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const planPrices = pgTable(
  'plan_prices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
    priceCode: varchar('price_code', { length: 80 }).notNull().unique(),
    interval: billingIntervalEnum('interval').notNull(),
    amountEtb: integer('amount_etb').notNull(),
    currency: varchar('currency', { length: 8 }).default('ETB').notNull(),
    trialDays: integer('trial_days').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_plan_prices_plan_active').on(table.planId, table.isActive),
  ]
);

export const listingPackages = pgTable('listing_packages', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: listingTierEnum('code').notNull().unique(),
  nameEn: varchar('name_en', { length: 120 }).notNull(),
  nameAm: varchar('name_am', { length: 120 }).notNull(),
  descriptionEn: text('description_en'),
  descriptionAm: text('description_am'),
  priceEtb: integer('price_etb').notNull(),
  durationDays: integer('duration_days').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id),
    priceId: uuid('price_id').references(() => planPrices.id),
    interval: billingIntervalEnum('interval').default('monthly').notNull(),
    status: subscriptionStatusEnum('status').default('incomplete').notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    downgradeToPlanId: uuid('downgrade_to_plan_id').references(() => subscriptionPlans.id),
    renewalReminderSentAt: timestamp('renewal_reminder_sent_at', { withTimezone: true }),
    gracePeriodEndsAt: timestamp('grace_period_ends_at', { withTimezone: true }),
    failedPaymentCount: integer('failed_payment_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_subscriptions_user_status').on(table.userId, table.status),
    index('idx_subscriptions_status_end').on(table.status, table.currentPeriodEnd),
  ]
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    planId: uuid('plan_id').references(() => subscriptionPlans.id),
    priceId: uuid('price_id').references(() => planPrices.id),
    purpose: paymentPurposeEnum('purpose').notNull(),
    provider: paymentProviderEnum('provider').default('chapa').notNull(),
    paymentChannel: paymentChannelEnum('payment_channel').default('telebirr').notNull(),
    txRef: varchar('tx_ref', { length: 120 }).notNull().unique(),
    providerRef: varchar('provider_ref', { length: 120 }).unique(),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).unique(),
    paymentMethod: varchar('payment_method', { length: 64 }),
    subtotalEtb: integer('subtotal_etb').default(0).notNull(),
    vatRateBps: integer('vat_rate_bps').default(0).notNull(),
    vatEtb: integer('vat_etb').default(0).notNull(),
    amountEtb: integer('amount_etb').notNull(),
    currency: varchar('currency', { length: 8 }).default('ETB').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    testMode: boolean('test_mode').default(true).notNull(),
    checkoutUrl: varchar('checkout_url', { length: 1000 }),
    customerName: varchar('customer_name', { length: 160 }),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerPhone: varchar('customer_phone', { length: 32 }),
    billingTin: varchar('billing_tin', { length: 64 }),
    failureReason: text('failure_reason'),
    webhookVerifiedAt: timestamp('webhook_verified_at', { withTimezone: true }),
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    rawWebhookMetaJson: jsonb('raw_webhook_meta_json'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_payments_user_status_created').on(
      table.userId,
      table.status,
      table.createdAt
    ),
    index('idx_payments_status_created').on(table.status, table.createdAt),
  ]
);

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
    txRef: varchar('tx_ref', { length: 120 }).notNull(),
    providerEventId: varchar('provider_event_id', { length: 160 }).unique(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    source: varchar('source', { length: 32 }).notNull(), // checkout_init | server_verify | webhook | reconciliation | admin
    statusBefore: varchar('status_before', { length: 32 }),
    statusAfter: varchar('status_after', { length: 32 }),
    sanitizedPayloadJson: jsonb('sanitized_payload_json').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_payment_events_tx_created').on(table.txRef, table.createdAt),
  ]
);

export const userEntitlements = pgTable(
  'user_entitlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    planCode: planCodeEnum('plan_code').default('free').notNull(),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    maxBookmarks: integer('max_bookmarks').default(5).notNull(),
    maxSavedSearches: integer('max_saved_searches').default(1).notNull(),
    unlimitedSearch: boolean('unlimited_search').default(false).notNull(),
    dailyEmailAlerts: boolean('daily_email_alerts').default(false).notNull(),
    instantAlerts: boolean('instant_alerts').default(false).notNull(),
    pushAlerts: boolean('push_alerts').default(false).notNull(),
    smsTelegramAlerts: boolean('sms_telegram_alerts').default(false).notNull(),
    advancedFilters: boolean('advanced_filters').default(false).notNull(),
    fullDocumentAccess: boolean('full_document_access').default(false).notNull(),
    buyerTracking: boolean('buyer_tracking').default(false).notNull(),
    prioritySupport: boolean('priority_support').default(false).notNull(),
    unlimitedListings: boolean('unlimited_listings').default(false).notNull(),
    featuredPlacement: boolean('featured_placement').default(false).notNull(),
    targetedAlerts: boolean('targeted_alerts').default(false).notNull(),
    advancedAnalytics: boolean('advanced_analytics').default(false).notNull(),
    accountManagerSupport: boolean('account_manager_support').default(false).notNull(),
    listingCreditsRemaining: integer('listing_credits_remaining').default(0).notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_entitlements_plan').on(table.planCode, table.effectiveUntil)]
);

export const publisherListings = pgTable(
  'publisher_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publisherId: uuid('publisher_id')
      .notNull()
      .references(() => publishers.id),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id),
    packageId: uuid('package_id')
      .notNull()
      .references(() => listingPackages.id),
    paymentId: uuid('payment_id')
      .unique()
      .references(() => payments.id),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_pub_listings_tender_active').on(table.tenderId, table.isActive)]
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: varchar('invoice_number', { length: 48 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    paymentId: uuid('payment_id')
      .notNull()
      .unique()
      .references(() => payments.id),
    status: invoiceStatusEnum('status').default('issued').notNull(),
    subtotalEtb: integer('subtotal_etb').notNull(),
    vatRateBps: integer('vat_rate_bps').default(1500).notNull(),
    vatEtb: integer('vat_etb').default(0).notNull(),
    totalEtb: integer('total_etb').notNull(),
    currency: varchar('currency', { length: 8 }).default('ETB').notNull(),
    lineItemsJson: jsonb('line_items_json').default([]).notNull(),
    billingName: varchar('billing_name', { length: 160 }),
    billingEmail: varchar('billing_email', { length: 255 }),
    billingPhone: varchar('billing_phone', { length: 32 }),
    billingTin: varchar('billing_tin', { length: 64 }),
    receiptEmailSentAt: timestamp('receipt_email_sent_at', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_invoices_user_issued').on(table.userId, table.issuedAt),
    index('idx_invoices_status_issued').on(table.status, table.issuedAt),
  ]
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    amountEtb: integer('amount_etb').notNull(),
    reason: text('reason').notNull(),
    status: refundStatusEnum('status').default('requested').notNull(),
    requestedById: uuid('requested_by_id').notNull(),
    approvedById: uuid('approved_by_id'),
    providerRefundId: varchar('provider_refund_id', { length: 120 }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_refunds_payment_status').on(table.paymentId, table.status)]
);

// ============================================================================
// 4. BOOKMARKS, SAVED SEARCHES, ALERTS & NOTIFICATIONS
// ============================================================================

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    notes: varchar('notes', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_bookmarks_user_tender').on(table.userId, table.tenderId),
    index('idx_bookmarks_user_created').on(table.userId, table.createdAt),
  ]
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    queryText: varchar('query_text', { length: 200 }),
    categoryId: uuid('category_id'),
    regionId: uuid('region_id'),
    sourceType: tenderSourceTypeEnum('source_type'),
    alertFrequency: alertFrequencyEnum('alert_frequency')
      .default('daily')
      .notNull(),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_saved_searches_user_del').on(table.userId, table.deletedAt),
    index('idx_saved_searches_freq_del').on(table.alertFrequency, table.deletedAt),
  ]
);

export const alertPreferences = pgTable('alert_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').default(true).notNull(),
  pushEnabled: boolean('push_enabled').default(false).notNull(),
  smsEnabled: boolean('sms_enabled').default(false).notNull(),
  telegramEnabled: boolean('telegram_enabled').default(false).notNull(),
  deadlineRemindersEnabled: boolean('deadline_reminders_enabled')
    .default(true)
    .notNull(),
  reminderDaysJson: jsonb('reminder_days_json').default([7, 1]).notNull(),
  fcmTokensJson: jsonb('fcm_tokens_json').default([]).notNull(),
  quietHoursStartEat: integer('quiet_hours_start_eat'),
  quietHoursEndEat: integer('quiet_hours_end_eat'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: notificationChannelEnum('channel').notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    dedupeKey: varchar('dedupe_key', { length: 160 }).notNull().unique(),
    language: languageCodeEnum('language').default('en').notNull(),
    subject: varchar('subject', { length: 240 }).notNull(),
    body: text('body').notNull(),
    payloadJson: jsonb('payload_json'),
    status: notificationStatusEnum('status').default('queued').notNull(),
    retryCount: integer('retry_count').default(0).notNull(),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_notif_user_read_created').on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
    index('idx_notif_status_created').on(table.status, table.createdAt),
  ]
);

// ============================================================================
// 5. AUDIT LOGS, MODERATION, ABUSE REPORTS, INGESTION & SOURCES
// ============================================================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    actorRole: varchar('actor_role', { length: 48 }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 128 }).notNull(),
    beforeJson: jsonb('before_json'),
    afterJson: jsonb('after_json'),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_audit_entity').on(table.entityType, table.entityId, table.createdAt),
    index('idx_audit_actor').on(table.actorUserId, table.createdAt),
    index('idx_audit_action').on(table.action, table.createdAt),
  ]
);

export const moderationCases = pgTable(
  'moderation_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    status: moderationStatusEnum('status').default('open').notNull(),
    priority: integer('priority').default(5).notNull(),
    assignedToId: uuid('assigned_to_id'),
    decisionReason: text('decision_reason'),
    duplicateOfId: uuid('duplicate_of_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_mod_cases_status_prio').on(
      table.status,
      table.priority,
      table.createdAt
    ),
  ]
);

export const abuseReports = pgTable(
  'abuse_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenderId: uuid('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),
    reporterId: uuid('reporter_id').references(() => users.id),
    reporterEmail: varchar('reporter_email', { length: 255 }),
    reason: abuseReasonEnum('reason').notNull(),
    details: text('details').notNull(),
    status: moderationStatusEnum('status').default('open').notNull(),
    reviewedById: uuid('reviewed_by_id'),
    resolution: text('resolution'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_abuse_status_created').on(table.status, table.createdAt),
    index('idx_abuse_tender').on(table.tenderId),
  ]
);

export const ingestionSources = pgTable(
  'ingestion_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceKey: varchar('source_key', { length: 120 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    connectorType: connectorTypeEnum('connector_type').notNull(),
    tenderSourceType: tenderSourceTypeEnum('tender_source_type').notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    frequencyMinutes: integer('frequency_minutes').default(0).notNull(), // 0 = on-demand
    authMethod: varchar('auth_method', { length: 64 }).default('none').notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute').default(30).notNull(),
    parserConfigJson: jsonb('parser_config_json').default({}).notNull(),
    legalReviewStatus: legalReviewStatusEnum('legal_review_status')
      .default('pending_review')
      .notNull(),
    robotsTxtNotes: text('robots_txt_notes'),
    termsOfServiceNotes: text('terms_of_service_notes'),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_ingestion_sources_enabled').on(
      table.isEnabled,
      table.legalReviewStatus
    ),
  ]
);

export const ingestionJobs = pgTable(
  'ingestion_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id').references(() => ingestionSources.id),
    sourceType: tenderSourceTypeEnum('source_type').notNull(),
    sourceKey: varchar('source_key', { length: 120 }).notNull(),
    status: ingestionStatusEnum('status').default('queued').notNull(),
    recordsFound: integer('records_found').default(0).notNull(),
    recordsSaved: integer('records_saved').default(0).notNull(),
    recordsDuped: integer('records_duped').default(0).notNull(),
    recordsModeration: integer('records_moderation').default(0).notNull(),
    recordsAmended: integer('records_amended').default(0).notNull(),
    recordsFailed: integer('records_failed').default(0).notNull(),
    errorSummary: text('error_summary'),
    errorLogJson: jsonb('error_log_json').default([]).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('idx_ingestion_source_created').on(table.sourceKey, table.createdAt)]
);

export const sourceRecords = pgTable(
  'source_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ingestionJobId: uuid('ingestion_job_id').references(() => ingestionJobs.id),
    tenderId: uuid('tender_id').references(() => tenders.id),
    sourceType: tenderSourceTypeEnum('source_type').notNull(),
    externalId: varchar('external_id', { length: 200 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    canonicalUrl: varchar('canonical_url', { length: 1000 }),
    rawPayloadHash: varchar('raw_payload_hash', { length: 64 }).notNull(),
    rawPayloadJson: jsonb('raw_payload_json').notNull(),
    normalizedPayloadJson: jsonb('normalized_payload_json'),
    qualityScore: integer('quality_score').default(0).notNull(),
    qualityFlagsJson: jsonb('quality_flags_json').default([]).notNull(),
    duplicateMatchType: varchar('duplicate_match_type', { length: 64 }),
    duplicateOfTenderId: uuid('duplicate_of_tender_id').references(() => tenders.id),
    routingOutcome: varchar('routing_outcome', { length: 48 }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_source_record_ext').on(table.sourceType, table.externalId),
    index('idx_source_record_hash').on(table.rawPayloadHash),
    index('idx_source_record_canonical_url').on(table.canonicalUrl),
    index('idx_source_record_outcome').on(table.routingOutcome, table.fetchedAt),
  ]
);

// ============================================================================
// 6. PRIVACY, CONSENT MANAGEMENT, DATA SUBJECT REQUESTS & BREACH RESPONSE
// ============================================================================

export const userConsents = pgTable(
  'user_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    visitorId: varchar('visitor_id', { length: 120 }).notNull(),
    essentialCookies: boolean('essential_cookies').default(true).notNull(),
    analyticsConsent: boolean('analytics_consent').default(false).notNull(),
    marketingConsent: boolean('marketing_consent').default(false).notNull(),
    notificationConsent: boolean('notification_consent').default(false).notNull(),
    policyVersion: varchar('policy_version', { length: 32 }).default('2026-04-v1').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('uq_user_consents_visitor').on(table.visitorId),
    index('idx_user_consents_user').on(table.userId),
  ]
);

export const dataSubjectRequests = pgTable(
  'data_subject_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    requesterEmail: varchar('requester_email', { length: 255 }).notNull(),
    requestType: dsrTypeEnum('request_type').notNull(),
    status: dsrStatusEnum('status').default('submitted').notNull(),
    details: text('details').notNull(),
    resolutionNotes: text('resolution_notes'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    resolvedById: uuid('resolved_by_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_dsr_status_created').on(table.status, table.createdAt),
    index('idx_dsr_email').on(table.requesterEmail),
  ]
);

export const securityIncidents = pgTable(
  'security_incidents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 220 }).notNull(),
    severity: incidentSeverityEnum('severity').default('medium').notNull(),
    status: incidentStatusEnum('status').default('detected').notNull(),
    affectedRecordsEstimate: integer('affected_records_estimate').default(0).notNull(),
    personalDataAffected: boolean('personal_data_affected').default(false).notNull(),
    summary: text('summary').notNull(),
    containmentActions: text('containment_actions'),
    authorityNotifiedAt: timestamp('authority_notified_at', { withTimezone: true }),
    usersNotifiedAt: timestamp('users_notified_at', { withTimezone: true }),
    reportedById: uuid('reported_by_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_incidents_status_severity').on(table.status, table.severity),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  category: one(tenderCategories, {
    fields: [tenders.categoryId],
    references: [tenderCategories.id],
  }),
  region: one(regions, {
    fields: [tenders.regionId],
    references: [regions.id],
  }),
  publisher: one(publishers, {
    fields: [tenders.publisherId],
    references: [publishers.id],
  }),
  documents: many(tenderDocuments),
  amendments: many(tenderAmendments),
}));
