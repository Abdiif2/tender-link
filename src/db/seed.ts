import crypto from 'crypto';
import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  billingConfig,
  ingestionSources,
  listingPackages,
  planPrices,
  regions,
  roles,
  subscriptionPlans,
  tenderCategories,
  tenderDocuments,
  tenders,
} from './schema.ts';

const ROLE_SEEDS = [
  { code: 'guest' as const, nameEn: 'Guest', nameAm: 'እንግዳ', description: 'Unauthenticated visitor browsing public tenders.' },
  { code: 'seeker' as const, nameEn: 'Tender Seeker', nameAm: 'ጨረታ ፈላጊ', description: 'Registered SME, contractor, consultant, or supplier.' },
  { code: 'publisher' as const, nameEn: 'Publisher', nameAm: 'አውጪ', description: 'Organisation member who drafts and submits tenders.' },
  { code: 'publisher_admin' as const, nameEn: 'Publisher Admin', nameAm: 'የአውጪ አስተዳዳሪ', description: 'Organisation administrator managing team and listings.' },
  { code: 'moderator' as const, nameEn: 'Moderator', nameAm: 'አረጋጋጭ', description: 'Platform content moderator reviewing submissions and abuse reports.' },
  { code: 'finance_admin' as const, nameEn: 'Finance Admin', nameAm: 'የፋይናንስ አስተዳዳሪ', description: 'Manages Chapa payments, ETB invoices, and refunds.' },
  { code: 'super_admin' as const, nameEn: 'Super Admin', nameAm: 'ዋና አስተዳዳሪ', description: 'Full platform governance, role assignment, and audit access.' },
];

const REGION_SEEDS = [
  { code: 'ET-AA', nameEn: 'Addis Ababa', nameAm: 'አዲስ አበባ', sortOrder: 1 },
  { code: 'ET-OR', nameEn: 'Oromia', nameAm: 'ኦሮሚያ', sortOrder: 2 },
  { code: 'ET-AM', nameEn: 'Amhara', nameAm: 'አማራ', sortOrder: 3 },
  { code: 'ET-TG', nameEn: 'Tigray', nameAm: 'ትግራይ', sortOrder: 4 },
  { code: 'ET-SD', nameEn: 'Sidama', nameAm: 'ሲዳማ', sortOrder: 5 },
  { code: 'ET-SO', nameEn: 'Somali', nameAm: 'ሶማሌ', sortOrder: 6 },
  { code: 'ET-DD', nameEn: 'Dire Dawa', nameAm: 'ድሬዳዋ', sortOrder: 7 },
  { code: 'ET-SE', nameEn: 'South Ethiopia', nameAm: 'ደቡብ ኢትዮጵያ', sortOrder: 8 },
  { code: 'ET-CE', nameEn: 'Central Ethiopia', nameAm: 'ማዕከላዊ ኢትዮጵያ', sortOrder: 9 },
  { code: 'ET-AF', nameEn: 'Afar', nameAm: 'አፋር', sortOrder: 10 },
  { code: 'ET-BG', nameEn: 'Benishangul-Gumuz', nameAm: 'ቤኒሻንጉል ጉሙዝ', sortOrder: 11 },
  { code: 'ET-ALL', nameEn: 'Nationwide (Ethiopia)', nameAm: 'በመላው ኢትዮጵያ', sortOrder: 12 },
];

const CATEGORY_SEEDS = [
  { slug: 'construction-civil-works', nameEn: 'Construction & Civil Works', nameAm: 'ግንባታ እና ሲቪል ስራዎች', sortOrder: 1 },
  { slug: 'it-telecommunications', nameEn: 'IT & Telecommunications', nameAm: 'አይቲ እና ቴሌኮሙኒኬሽን', sortOrder: 2 },
  { slug: 'health-medical-supplies', nameEn: 'Health & Medical Supplies', nameAm: 'ጤና እና የህክምና ቁሳቁሶች', sortOrder: 3 },
  { slug: 'water-sanitation', nameEn: 'Water & Sanitation', nameAm: 'ውሃ እና ንፅህና', sortOrder: 4 },
  { slug: 'agriculture-agribusiness', nameEn: 'Agriculture & Agribusiness', nameAm: 'ግብርና እና አግሪቢዝነስ', sortOrder: 5 },
  { slug: 'consultancy-advisory', nameEn: 'Consultancy & Advisory', nameAm: 'የምክር እና የጥናት አገልግሎት', sortOrder: 6 },
  { slug: 'energy-solar', nameEn: 'Energy & Solar Power', nameAm: 'ኢነርጂ እና የፀሐይ ኃይል', sortOrder: 7 },
  { slug: 'transport-logistics', nameEn: 'Transport & Logistics', nameAm: 'ትራንስፖርት እና ሎጂስቲክስ', sortOrder: 8 },
  { slug: 'office-equipment-furniture', nameEn: 'Office Equipment & Furniture', nameAm: 'የቢሮ እቃዎች እና ፈርኒቸር', sortOrder: 9 },
  { slug: 'education-training', nameEn: 'Education & Training', nameAm: 'ትምህርት እና ስልጠና', sortOrder: 10 },
  { slug: 'security-facility', nameEn: 'Security & Facility Services', nameAm: 'ጥበቃ እና የህንፃ አስተዳደር', sortOrder: 11 },
  { slug: 'banking-financial', nameEn: 'Banking & Financial Services', nameAm: 'ባንክ እና ፋይናንስ አገልግሎት', sortOrder: 12 },
  { slug: 'printing-publishing', nameEn: 'Printing & Publishing', nameAm: 'ህትመት እና ስርጭት', sortOrder: 13 },
  { slug: 'manufacturing-industrial', nameEn: 'Manufacturing & Industrial', nameAm: 'ማኑፋክቸሪንግ እና ኢንዱስትሪ', sortOrder: 14 },
];

const PLAN_SEEDS = [
  {
    code: 'free' as const,
    audience: 'seeker' as const,
    sortOrder: 1,
    nameEn: 'Free',
    nameAm: 'ነፃ',
    taglineEn: 'Basic public tender discovery across Ethiopia',
    taglineAm: 'በኢትዮጵያ ውስጥ መሰረታዊ የህዝብ ጨረታዎችን ለመፈለግ',
    priceEtbMonthly: 0,
    priceEtbAnnual: 0,
    maxBookmarks: 5,
    maxSavedSearches: 1,
    instantAlerts: false,
    pushAlerts: false,
    smsTelegramAlerts: false,
    advancedFilters: false,
    fullDocumentAccess: false,
    buyerTracking: false,
    prioritySupport: false,
    unlimitedListings: false,
    featuredPlacement: false,
    targetedAlerts: false,
    advancedAnalytics: false,
    accountManagerSupport: false,
    listingDurationDays: 0,
    csvExportEnabled: false,
    archiveDays: 30,
    featuresJson: [
      { en: 'Basic tender search', am: 'መሰረታዊ የጨረታ ፍለጋ' },
      { en: 'Limited alerts (weekly digest)', am: 'ውስን ማሳወቂያዎች (ሳምንታዊ)' },
      { en: 'Public tenders only', am: 'የህዝብ ጨረታዎች ብቻ' },
      { en: 'Up to 5 bookmarks', am: 'እስከ 5 የተቀመጡ ጨረታዎች' },
    ],
  },
  {
    code: 'starter' as const,
    audience: 'seeker' as const,
    sortOrder: 2,
    nameEn: 'Starter',
    nameAm: 'ስታርተር',
    taglineEn: 'For growing SMEs, suppliers, and consultants',
    taglineAm: 'ለአነስተኛ እና መካከለኛ ንግዶች፣ አቅራቢዎች እና አማካሪዎች',
    priceEtbMonthly: 499,
    priceEtbAnnual: 4990,
    maxBookmarks: 50,
    maxSavedSearches: 3,
    instantAlerts: false,
    pushAlerts: true,
    smsTelegramAlerts: false,
    advancedFilters: false,
    fullDocumentAccess: false,
    buyerTracking: false,
    prioritySupport: false,
    unlimitedListings: false,
    featuredPlacement: false,
    targetedAlerts: false,
    advancedAnalytics: false,
    accountManagerSupport: false,
    listingDurationDays: 0,
    csvExportEnabled: false,
    archiveDays: 180,
    featuresJson: [
      { en: 'Unlimited tender search', am: 'ያልተገደበ የጨረታ ፍለጋ' },
      { en: 'Daily email alerts', am: 'ዕለታዊ የኢሜል ማሳወቂያዎች' },
      { en: 'Mobile push notifications', am: 'የሞባይል ፑሽ ማሳወቂያዎች' },
      { en: '3 saved searches', am: '3 የተቀመጡ ፍለጋዎች' },
      { en: 'Automated deadline reminders', am: 'የመዝጊያ ቀን ማስታወሻዎች' },
    ],
  },
  {
    code: 'professional' as const,
    audience: 'seeker' as const,
    sortOrder: 3,
    nameEn: 'Professional',
    nameAm: 'ፕሮፌሽናል',
    taglineEn: 'For active contractors, NGOs, and bid teams',
    taglineAm: 'ለንቁ ኮንትራክተሮች፣ መንግስታዊ ያልሆኑ ድርጅቶች እና የጨረታ ቡድኖች',
    priceEtbMonthly: 1499,
    priceEtbAnnual: 14990,
    maxBookmarks: -1,
    maxSavedSearches: -1,
    instantAlerts: true,
    pushAlerts: true,
    smsTelegramAlerts: true,
    advancedFilters: true,
    fullDocumentAccess: true,
    buyerTracking: true,
    prioritySupport: true,
    unlimitedListings: false,
    featuredPlacement: false,
    targetedAlerts: false,
    advancedAnalytics: false,
    accountManagerSupport: false,
    listingDurationDays: 0,
    csvExportEnabled: true,
    archiveDays: -1,
    featuresJson: [
      { en: 'Unlimited instant alerts', am: 'ያልተገደበ ፈጣን ማሳወቂያዎች' },
      { en: 'SMS & Telegram alerts where enabled', am: 'የSMS እና ቴሌግራም ማሳወቂያዎች' },
      { en: 'Advanced procurement filters', am: 'የላቀ የጨረታ ማጣሪያዎች' },
      { en: 'Full document access where permitted', am: 'ሙሉ የሰነድ መዳረሻ (ሲፈቀድ)' },
      { en: 'Buyer & organisation tracking', am: 'የጨረታ አውጪ ተቋማት ክትትል' },
      { en: 'Priority support', am: 'ቅድሚያ የሚሰጠው ድጋፍ' },
    ],
  },
  {
    code: 'publisher_basic' as const,
    audience: 'publisher' as const,
    sortOrder: 4,
    nameEn: 'Publisher Basic',
    nameAm: 'አውጪ ቤዚክ',
    taglineEn: 'Per-listing verified tender publication for organisations',
    taglineAm: 'ለድርጅቶች በእያንዳንዱ ጨረታ የሚከፈል የተረጋገጠ ህትመት',
    priceEtbMonthly: 1500,
    priceEtbAnnual: null,
    maxBookmarks: 20,
    maxSavedSearches: 2,
    instantAlerts: false,
    pushAlerts: false,
    smsTelegramAlerts: false,
    advancedFilters: false,
    fullDocumentAccess: true,
    buyerTracking: false,
    prioritySupport: false,
    unlimitedListings: false,
    featuredPlacement: false,
    targetedAlerts: false,
    advancedAnalytics: false,
    accountManagerSupport: false,
    listingDurationDays: 30,
    csvExportEnabled: false,
    archiveDays: 180,
    featuresJson: [
      { en: 'Per-listing payment (ETB 1,500 / tender)', am: 'በአንድ ጨረታ ክፍያ (1,500 ብር)' },
      { en: 'Verified organisation listing badge', am: 'የተረጋገጠ አውጪ መለያ' },
      { en: 'Category & region distribution', am: 'በዘርፍ እና ክልል ስርጭት' },
      { en: '30-day public visibility', am: 'የ30 ቀናት ታይነት' },
      { en: 'Basic views & document analytics', am: 'መሰረታዊ የእይታ ትንታኔ' },
    ],
  },
  {
    code: 'publisher_pro' as const,
    audience: 'publisher' as const,
    sortOrder: 5,
    nameEn: 'Publisher Pro',
    nameAm: 'አውጪ ፕሮ',
    taglineEn: 'Unlimited publishing, featured placement & targeted supplier reach',
    taglineAm: 'ያልተገደበ ህትመት፣ ተመራጭ ቦታ እና ኢላማ የተደረገ የአቅራቢ ተደራሽነት',
    priceEtbMonthly: 4500,
    priceEtbAnnual: 45000,
    maxBookmarks: -1,
    maxSavedSearches: -1,
    instantAlerts: true,
    pushAlerts: true,
    smsTelegramAlerts: true,
    advancedFilters: true,
    fullDocumentAccess: true,
    buyerTracking: true,
    prioritySupport: true,
    unlimitedListings: true,
    featuredPlacement: true,
    targetedAlerts: true,
    advancedAnalytics: true,
    accountManagerSupport: true,
    listingDurationDays: 30,
    csvExportEnabled: true,
    archiveDays: -1,
    featuresJson: [
      { en: 'Unlimited tender listings per month', am: 'ያልተገደበ ወርሃዊ የጨረታ ህትመት' },
      { en: 'Featured placement on home & category feeds', am: 'በዋና እና ዘርፍ ገፅ ተመራጭ ቦታ' },
      { en: 'Targeted alerts to matching suppliers', am: 'ለተዛማጅ አቅራቢዎች ኢላማ የተደረገ ማሳወቂያ' },
      { en: 'Advanced bidder engagement analytics', am: 'የላቀ የተጫራች ተሳትፎ ትንታኔ' },
      { en: 'Dedicated account manager support', am: 'ልዩ የደንበኛ አስተዳዳሪ ድጋፍ' },
    ],
  },
];

const LISTING_PACKAGE_SEEDS = [
  {
    code: 'standard_free' as const,
    nameEn: 'Standard Tender Listing',
    nameAm: 'መደበኛ የጨረታ ማስታወቂያ',
    descriptionEn: 'Free standard publication after moderation review.',
    descriptionAm: 'ከማረጋገጫ በኋላ በነፃ የሚታተም መደበኛ ማስታወቂያ።',
    priceEtb: 0,
    durationDays: 30,
    isFeatured: false,
  },
  {
    code: 'featured_7d' as const,
    nameEn: 'Featured Placement (7 Days)',
    nameAm: 'ተመራጭ ማስታወቂያ (7 ቀናት)',
    descriptionEn: 'Priority placement at the top of category and home feeds for 7 days.',
    descriptionAm: 'ለ7 ቀናት በዋና ገፅ እና በዘርፍ ዝርዝር አናት ላይ ቅድሚያ ይታያል።',
    priceEtb: 1500,
    durationDays: 7,
    isFeatured: true,
  },
  {
    code: 'featured_14d' as const,
    nameEn: 'Featured Placement (14 Days)',
    nameAm: 'ተመራጭ ማስታወቂያ (14 ቀናት)',
    descriptionEn: 'Extended priority placement across search results for 14 days.',
    descriptionAm: 'ለ14 ቀናት በፍለጋ ውጤቶች አናት ላይ ቅድሚያ ይታያል።',
    priceEtb: 2500,
    durationDays: 14,
    isFeatured: true,
  },
  {
    code: 'featured_30d' as const,
    nameEn: 'Featured Placement (30 Days)',
    nameAm: 'ተመራጭ ማስታወቂያ (30 ቀናት)',
    descriptionEn: 'Maximum visibility across national feeds and alert digests for 30 days.',
    descriptionAm: 'ለ30 ቀናት በሀገር አቀፍ ዝርዝሮች እና ማሳወቂያዎች ከፍተኛ እይታ።',
    priceEtb: 4500,
    durationDays: 30,
    isFeatured: true,
  },
];

interface SampleTenderSpec {
  ref: string;
  titleEn: string;
  titleAm: string;
  summaryEn: string;
  summaryAm: string;
  publisherName: string;
  sourceType: 'official_source' | 'publisher_submitted' | 'partner_feed' | 'user_reported';
  sourceName: string;
  categorySlug: string;
  regionCode: string;
  method: 'open_national' | 'open_international' | 'restricted' | 'request_for_proposal' | 'request_for_quotation' | 'expression_of_interest';
  docFeeEtb: number;
  bidSecurityEtb: number;
  daysUntilClose: number;
  status: 'published' | 'amended' | 'expired';
  isFeatured?: boolean;
  hasDocuments?: boolean;
}

// Clearly labelled SAMPLE DATA ONLY — fictional Ethiopian sample organisations & sample notices for MVP testing.
const SAMPLE_TENDER_SPECS: SampleTenderSpec[] = [
  {
    ref: 'SAMPLE-2026-001',
    titleEn: '[SAMPLE] Supply and Installation of Solar-Powered Borehole Water Pumps',
    titleAm: '[ናሙና] በፀሐይ ኃይል የሚሰሩ የውሃ ፓምፖች አቅርቦት እና ተከላ',
    summaryEn: 'Sample procurement notice for 12 community solar borehole pumping systems across rural woredas.',
    summaryAm: 'በገጠር ወረዳዎች ለ12 የማህበረሰብ የፀሐይ ኃይል ውሃ ፓምፖች አቅርቦት የተዘጋጀ የናሙና ጨረታ።',
    publisherName: 'Sample Highland Water Utility',
    sourceType: 'official_source',
    sourceName: 'Sample Regional Gazette Bulletin',
    categorySlug: 'water-sanitation',
    regionCode: 'ET-OR',
    method: 'open_national',
    docFeeEtb: 500,
    bidSecurityEtb: 50000,
    daysUntilClose: 14,
    status: 'published',
    isFeatured: true,
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-002',
    titleEn: '[SAMPLE] Enterprise Network Firewall and Fiber Backbone Upgrade',
    titleAm: '[ናሙና] የድርጅት ኔትወርክ ፋየርዎል እና ፋይበር መስመር ማሻሻያ',
    summaryEn: 'Sample tender for supply, configuration, and 24-month maintenance of redundant campus network infrastructure.',
    summaryAm: 'የካምፓስ ኔትወርክ መሰረተ ልማት አቅርቦት፣ ውቅር እና የ24 ወራት ጥገና የናሙና ጨረታ።',
    publisherName: 'Sample Entoto Polytech Institute',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'it-telecommunications',
    regionCode: 'ET-AA',
    method: 'open_national',
    docFeeEtb: 300,
    bidSecurityEtb: 75000,
    daysUntilClose: 9,
    status: 'published',
    isFeatured: true,
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-003',
    titleEn: '[SAMPLE] Essential Maternal & Pediatric Clinic Consumables Framework',
    titleAm: '[ናሙና] የእናቶች እና ህፃናት ክሊኒክ የህክምና ቁሳቁሶች አቅርቦት',
    summaryEn: 'Sample 12-month framework contract for sterile diagnostic kits and clinic consumables.',
    summaryAm: 'ለ12 ወራት የሚቆይ የህክምና መመርመሪያ እና ክሊኒክ ቁሳቁሶች የናሙና ጨረታ።',
    publisherName: 'Sample Rift Valley Community Health NGO',
    sourceType: 'partner_feed',
    sourceName: 'Sample NGO Procurement Feed',
    categorySlug: 'health-medical-supplies',
    regionCode: 'ET-SD',
    method: 'request_for_quotation',
    docFeeEtb: 0,
    bidSecurityEtb: 25000,
    daysUntilClose: 5,
    status: 'amended',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-004',
    titleEn: '[SAMPLE] Construction of Two-Storey Vocational Training Workshop Block',
    titleAm: '[ናሙና] ባለ ሁለት ፎቅ የሙያ ስልጠና ወርክሾፕ ህንፃ ግንባታ',
    summaryEn: 'Sample GC/BC Grade 5 and above building construction tender including electrical and sanitary works.',
    summaryAm: 'ደረጃ 5 እና ከዚያ በላይ ለሆኑ ኮንትራክተሮች የወርክሾፕ ህንፃ ግንባታ የናሙና ጨረታ።',
    publisherName: 'Sample Tana Technical College',
    sourceType: 'official_source',
    sourceName: 'Sample Public Procurement Bulletin',
    categorySlug: 'construction-civil-works',
    regionCode: 'ET-AM',
    method: 'open_national',
    docFeeEtb: 1000,
    bidSecurityEtb: 200000,
    daysUntilClose: 21,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-005',
    titleEn: '[SAMPLE] Coffee Hulling Machinery & Moisture Meter Supply',
    titleAm: '[ናሙና] የቡና መፈልፈያ ማሽኖች እና የእርጥበት መለኪያ አቅርቦት',
    summaryEn: 'Sample tender for cooperative primary processing equipment delivered to Sidama collection centers.',
    summaryAm: 'ለሲዳማ ህብረት ስራ ማህበራት የቡና ማቀነባበሪያ ማሽኖች አቅርቦት የናሙና ጨረታ።',
    publisherName: 'Sample Yirga Growers Union',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'agriculture-agribusiness',
    regionCode: 'ET-SD',
    method: 'open_national',
    docFeeEtb: 200,
    bidSecurityEtb: 40000,
    daysUntilClose: 12,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-006',
    titleEn: '[SAMPLE] Independent Financial Audit Services for FY 2026',
    titleAm: '[ናሙና] የ2026 በጀት ዓመት ነፃ የፋይናንስ ኦዲት አገልግሎት',
    summaryEn: 'Sample RFP inviting licensed Ethiopian audit firms to conduct IPSAS-compliant annual financial audit.',
    summaryAm: 'ፍቃድ ላላቸው የኦዲት ድርጅቶች የተዘጋጀ የዓመታዊ ፋይናንስ ኦዲት የናሙና ጨረታ።',
    publisherName: 'Sample Horn Relief Foundation',
    sourceType: 'partner_feed',
    sourceName: 'Sample Humanitarian Partner Feed',
    categorySlug: 'consultancy-advisory',
    regionCode: 'ET-AA',
    method: 'request_for_proposal',
    docFeeEtb: 0,
    bidSecurityEtb: 0,
    daysUntilClose: 10,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-007',
    titleEn: '[SAMPLE] Hybrid Solar Microgrid Battery Storage System (150 kWh)',
    titleAm: '[ናሙና] 150 ኪሎዋት ሰዓት የፀሐይ ኃይል ማይክሮግሪድ ባትሪ ሲስተም',
    summaryEn: 'Sample international competitive bid for off-grid clinic electrification lithium battery storage.',
    summaryAm: 'ለገጠር ጤና ጣቢያዎች የፀሐይ ኃይል ማከማቻ ባትሪ አቅርቦት የናሙና ዓለም አቀፍ ጨረታ።',
    publisherName: 'Sample Afar Clean Energy Initiative',
    sourceType: 'partner_feed',
    sourceName: 'Sample Energy Development Feed',
    categorySlug: 'energy-solar',
    regionCode: 'ET-AF',
    method: 'open_international',
    docFeeEtb: 1500,
    bidSecurityEtb: 150000,
    daysUntilClose: 28,
    status: 'published',
    isFeatured: true,
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-008',
    titleEn: '[SAMPLE] Heavy-Duty Freight Transport Services (Djibouti Corridor to Dire Dawa)',
    titleAm: '[ናሙና] የከባድ ጭነት ትራንስፖርት አገልግሎት (ድሬዳዋ ኮሪደር)',
    summaryEn: 'Sample logistics framework for dry cargo and agricultural input haulage over 6 months.',
    summaryAm: 'ለ6 ወራት የሚቆይ የደረቅ ጭነት እና የግብርና ግብዓት ማጓጓዣ የናሙና ጨረታ።',
    publisherName: 'Sample Eastern Agro Logistics PLC',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'transport-logistics',
    regionCode: 'ET-DD',
    method: 'open_national',
    docFeeEtb: 300,
    bidSecurityEtb: 60000,
    daysUntilClose: 7,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-009',
    titleEn: '[SAMPLE] Ergonomic Office Desks, Filing Cabinets, and Conference Seating',
    titleAm: '[ናሙና] የቢሮ ጠረጴዛዎች፣ ፋይል ካቢኔቶች እና የስብሰባ ወንበሮች',
    summaryEn: 'Sample lot-based supply of locally manufactured wooden and steel office furniture.',
    summaryAm: 'በሀገር ውስጥ የተመረቱ የቢሮ ፈርኒቸሮች አቅርቦት የናሙና ጨረታ።',
    publisherName: 'Sample Bole Microfinance S.C.',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'office-equipment-furniture',
    regionCode: 'ET-AA',
    method: 'open_national',
    docFeeEtb: 250,
    bidSecurityEtb: 20000,
    daysUntilClose: 6,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-010',
    titleEn: '[SAMPLE] Bilingual Adult Literacy Workbook Printing (40,000 Copies)',
    titleAm: '[ናሙና] የ40,000 ቅጂ የጎልማሶች ትምህርት መጽሐፍት ህትመት',
    summaryEn: 'Sample printing tender for Amharic and Afaan Oromo community learning workbooks.',
    summaryAm: 'በአማርኛ እና ኦሮምኛ የትምህርት መጽሐፍት ህትመት የናሙና ጨረታ።',
    publisherName: 'Sample Ethio Education Trust',
    sourceType: 'partner_feed',
    sourceName: 'Sample Education Partner Feed',
    categorySlug: 'printing-publishing',
    regionCode: 'ET-OR',
    method: 'open_national',
    docFeeEtb: 0,
    bidSecurityEtb: 30000,
    daysUntilClose: 11,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-011',
    titleEn: '[SAMPLE] 24/7 Campus Security Guard & Access Control Services',
    titleAm: '[ናሙና] የ24 ሰዓት የካምፓስ ጥበቃ እና የመግቢያ ቁጥጥር አገልግሎት',
    summaryEn: 'Sample annual security services contract for industrial warehouse and administrative offices.',
    summaryAm: 'ለኢንዱስትሪ መጋዘን እና ቢሮዎች የዓመታዊ ጥበቃ አገልግሎት የናሙና ጨረታ።',
    publisherName: 'Sample Dukem Logistics Park PLC',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'security-facility',
    regionCode: 'ET-OR',
    method: 'open_national',
    docFeeEtb: 200,
    bidSecurityEtb: 15000,
    daysUntilClose: 3,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-012',
    titleEn: '[SAMPLE] Core Micro-Insurance Mobile Payment Integration Consultancy',
    titleAm: '[ናሙና] የሞባይል ክፍያ ውህደት የቴክኒክ ምክር አገልግሎት',
    summaryEn: 'Sample EOI for systems architecture and local payment gateway integration specialists.',
    summaryAm: 'የሀገር ውስጥ ሞባይል ክፍያ ሲስተም ውህደት አማካሪዎችን ለመጋበዝ የናሙና ጨረታ።',
    publisherName: 'Sample Abay Cooperative Savings',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'banking-financial',
    regionCode: 'ET-AA',
    method: 'expression_of_interest',
    docFeeEtb: 0,
    bidSecurityEtb: 0,
    daysUntilClose: 16,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-013',
    titleEn: '[SAMPLE] Rural Feeder Road Gravel Rehabilitation (18 km)',
    titleAm: '[ናሙና] የ18 ኪሎ ሜትር የገጠር ጠጠር መንገድ ጥገና ስራ',
    summaryEn: 'Sample civil works notice for culverts, drainage ditches, and compacted gravel surfacing.',
    summaryAm: 'የውሃ መውረጃ ቦዮች እና ጠጠር መንገድ ጥገና የናሙና ሲቪል ስራዎች ጨረታ።',
    publisherName: 'Sample Southern Road Maintenance Unit',
    sourceType: 'official_source',
    sourceName: 'Sample Regional Procurement Gazette',
    categorySlug: 'construction-civil-works',
    regionCode: 'ET-SE',
    method: 'open_national',
    docFeeEtb: 800,
    bidSecurityEtb: 180000,
    daysUntilClose: 19,
    status: 'amended',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-014',
    titleEn: '[SAMPLE] Cold-Chain Vaccine Refrigerators & Temperature Loggers',
    titleAm: '[ናሙና] የክትባት ማቀዝቀዣ ፍሪጆች እና የሙቀት መመዝገቢያ መሳሪያዎች',
    summaryEn: 'Sample procurement of WHO-prequalified solar direct-drive medical refrigerators.',
    summaryAm: 'በፀሐይ ኃይል የሚሰሩ የህክምና ክትባት ማቀዝቀዣዎች የናሙና ጨረታ።',
    publisherName: 'Sample Somali Health Access Program',
    sourceType: 'partner_feed',
    sourceName: 'Sample Health Logistics Feed',
    categorySlug: 'health-medical-supplies',
    regionCode: 'ET-SO',
    method: 'open_international',
    docFeeEtb: 0,
    bidSecurityEtb: 100000,
    daysUntilClose: 22,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-015',
    titleEn: '[SAMPLE] Secondary School Science Laboratory Kits & Microscopes',
    titleAm: '[ናሙና] የሁለተኛ ደረጃ ትምህርት ቤት ሳይንስ ላቦራቶሪ ቁሳቁሶች',
    summaryEn: 'Sample supply of physics, chemistry, and biology laboratory apparatus for 8 regional schools.',
    summaryAm: 'ለ8 ትምህርት ቤቶች የፊዚክስ፣ ኬሚስትሪ እና ባዮሎጂ ላቦራቶሪ ቁሳቁሶች የናሙና ጨረታ።',
    publisherName: 'Sample Mekelle Learning Foundation',
    sourceType: 'user_reported',
    sourceName: 'Community Tip (Verified Sample)',
    categorySlug: 'education-training',
    regionCode: 'ET-TG',
    method: 'open_national',
    docFeeEtb: 300,
    bidSecurityEtb: 35000,
    daysUntilClose: 15,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-016',
    titleEn: '[SAMPLE] Food-Grade Packaging Film & Automated Sealing Line',
    titleAm: '[ናሙና] የምግብ ማሸጊያ ፊልም እና አውቶማቲክ ማሸጊያ ማሽን',
    summaryEn: 'Sample industrial machinery procurement for fortified flour mill packaging expansion.',
    summaryAm: 'ለዱቄት ፋብሪካ የማሸጊያ ማሽን እና ቁሳቁስ አቅርቦት የናሙና ጨረታ።',
    publisherName: 'Sample Adama Agro-Processing PLC',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'manufacturing-industrial',
    regionCode: 'ET-OR',
    method: 'open_national',
    docFeeEtb: 400,
    bidSecurityEtb: 80000,
    daysUntilClose: 18,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-017',
    titleEn: '[SAMPLE] Municipal Solid Waste Compactor Truck Rental (12 Months)',
    titleAm: '[ናሙና] የደረቅ ቆሻሻ ማጓጓዣ ተሽከርካሪ ኪራይ (12 ወራት)',
    summaryEn: 'Sample vehicle rental service including driver, maintenance, and GPS fleet logs.',
    summaryAm: 'ሹፌር እና ጥገናን ያካተተ የቆሻሻ ማጓጓዣ ተሽከርካሪ ኪራይ የናሙና ጨረታ።',
    publisherName: 'Sample Hawassa Clean City Office',
    sourceType: 'official_source',
    sourceName: 'Sample Municipal Notice Board',
    categorySlug: 'transport-logistics',
    regionCode: 'ET-SD',
    method: 'open_national',
    docFeeEtb: 500,
    bidSecurityEtb: 90000,
    daysUntilClose: 8,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-018',
    titleEn: '[SAMPLE] Water Quality Testing Reagents & Portable Spectrophotometers',
    titleAm: '[ናሙና] የውሃ ጥራት መመርመሪያ ኬሚካሎች እና ተንቀሳቃሽ መሳሪያዎች',
    summaryEn: 'Sample laboratory supply tender for regional drinking water safety monitoring.',
    summaryAm: 'ለክልላዊ የመጠጥ ውሃ ጥራት ቁጥጥር ላቦራቶሪ ቁሳቁሶች የናሙና ጨረታ።',
    publisherName: 'Sample Blue Nile Water Lab',
    sourceType: 'official_source',
    sourceName: 'Sample Regional Gazette Bulletin',
    categorySlug: 'water-sanitation',
    regionCode: 'ET-AM',
    method: 'open_national',
    docFeeEtb: 300,
    bidSecurityEtb: 30000,
    daysUntilClose: 13,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-019',
    titleEn: '[SAMPLE] Cloud Backup, Endpoint Security & Staff Cybersecurity Training',
    titleAm: '[ናሙና] የክላውድ ባክአፕ፣ ሳይበር ደህንነት እና የሰራተኞች ስልጠና',
    summaryEn: 'Sample RFP for managed endpoint protection licenses and bilingual security awareness workshops.',
    summaryAm: 'የኮምፒውተር ደህንነት ሶፍትዌር እና የሰራተኞች ስልጠና የናሙና ጨረታ።',
    publisherName: 'Sample Horizon Ethiopian Bank (Sample)',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'it-telecommunications',
    regionCode: 'ET-AA',
    method: 'request_for_proposal',
    docFeeEtb: 500,
    bidSecurityEtb: 50000,
    daysUntilClose: 17,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-020',
    titleEn: '[SAMPLE] Certified Drought-Tolerant Teff & Sorghum Seed Supply',
    titleAm: '[ናሙና] ድርቅን የሚቋቋም ምርጥ የጤፍ እና ማሽላ ዘር አቅርቦት',
    summaryEn: 'Sample seasonal agricultural input tender for certified cooperative seed distribution.',
    summaryAm: 'ለገበሬዎች ህብረት ስራ ማህበራት ምርጥ ዘር አቅርቦት የናሙና ጨረታ።',
    publisherName: 'Sample Central Highlands Resilience NGO',
    sourceType: 'partner_feed',
    sourceName: 'Sample Agriculture Partner Feed',
    categorySlug: 'agriculture-agribusiness',
    regionCode: 'ET-CE',
    method: 'open_national',
    docFeeEtb: 0,
    bidSecurityEtb: 45000,
    daysUntilClose: 4,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-021',
    titleEn: '[SAMPLE] Environmental & Social Impact Assessment (ESIA) for Irrigation Canal',
    titleAm: '[ናሙና] የመስኖ ቦይ የአካባቢ እና ማህበራዊ ተፅዕኖ ግምገማ ጥናት',
    summaryEn: 'Sample consultancy notice for certified environmental impact assessment firms.',
    summaryAm: 'ፍቃድ ላላቸው የአካባቢ ተፅዕኖ ግምገማ አማካሪዎች የተዘጋጀ የናሙና ጨረታ።',
    publisherName: 'Sample Benishangul Basin Project',
    sourceType: 'official_source',
    sourceName: 'Sample Federal Procurement Notice',
    categorySlug: 'consultancy-advisory',
    regionCode: 'ET-BG',
    method: 'request_for_proposal',
    docFeeEtb: 400,
    bidSecurityEtb: 25000,
    daysUntilClose: 20,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-022',
    titleEn: '[SAMPLE] Solar Street Lighting Poles & LED Luminaires (220 Units)',
    titleAm: '[ናሙና] 220 የፀሐይ ኃይል የመንገድ መብራት ምሰሶዎች እና ኤልኢዲ አምፖሎች',
    summaryEn: 'Sample supply and installation of integrated solar street lights along town market roads.',
    summaryAm: 'ለከተማ ገበያ መንገዶች የፀሐይ ኃይል መብራቶች አቅርቦት እና ተከላ የናሙና ጨረታ።',
    publisherName: 'Sample Dire Dawa Urban Renewal Unit',
    sourceType: 'official_source',
    sourceName: 'Sample Municipal Notice Board',
    categorySlug: 'energy-solar',
    regionCode: 'ET-DD',
    method: 'open_national',
    docFeeEtb: 600,
    bidSecurityEtb: 120000,
    daysUntilClose: 25,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-023',
    titleEn: '[SAMPLE] Multifunction Network Printers & Toner Cartridges (Annual Supply)',
    titleAm: '[ናሙና] የኔትወርክ ፕሪንተሮች እና ቶነር ቀለሞች ዓመታዊ አቅርቦት',
    summaryEn: 'Sample office equipment tender for nationwide branch network replenishment.',
    summaryAm: 'ለቅርንጫፍ ቢሮዎች የፕሪንተር እና ቶነር አቅርቦት የናሙና ጨረታ።',
    publisherName: 'Sample Ethio-Unity Insurance (Sample)',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'office-equipment-furniture',
    regionCode: 'ET-ALL',
    method: 'request_for_quotation',
    docFeeEtb: 0,
    bidSecurityEtb: 15000,
    daysUntilClose: 2,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-024',
    titleEn: '[SAMPLE] Technical Skills Bootcamp Delivery: Electrical & Plumbing Trades',
    titleAm: '[ናሙና] የኤሌክትሪክ እና ቧንቧ ስራ የሙያ ስልጠና አቅርቦት',
    summaryEn: 'Sample training provider RFP to train 300 youth apprentices across two regional hubs.',
    summaryAm: '300 ወጣቶችን በኤሌክትሪክ እና ቧንቧ ስራ ለማሰልጠን የተዘጋጀ የናሙና ጨረታ።',
    publisherName: 'Sample Youth Livelihoods Alliance',
    sourceType: 'partner_feed',
    sourceName: 'Sample Donor Opportunity Feed',
    categorySlug: 'education-training',
    regionCode: 'ET-ALL',
    method: 'request_for_proposal',
    docFeeEtb: 0,
    bidSecurityEtb: 0,
    daysUntilClose: 14,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-025',
    titleEn: '[SAMPLE] Hospital Cleaning, Linen Sterilization & Waste Handling Services',
    titleAm: '[ናሙና] የሆስፒታል ጽዳት እና የህክምና ቆሻሻ አያያዝ አገልግሎት',
    summaryEn: 'Sample facility management service tender for 180-bed referral hospital campus.',
    summaryAm: 'ለ180 አልጋ ሪፈራል ሆስፒታል የጽዳት እና አገልግሎት አስተዳደር የናሙና ጨረታ።',
    publisherName: 'Sample Gondar Referral Care Center (Sample)',
    sourceType: 'user_reported',
    sourceName: 'Community Tip (Verified Sample)',
    categorySlug: 'security-facility',
    regionCode: 'ET-AM',
    method: 'open_national',
    docFeeEtb: 350,
    bidSecurityEtb: 30000,
    daysUntilClose: 9,
    status: 'published',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-026',
    titleEn: '[SAMPLE] Commercial Printing of Bilingual Agricultural Extension Manuals',
    titleAm: '[ናሙና] የግብርና ኤክስቴንሽን መመሪያ መጽሐፍት ህትመት',
    summaryEn: 'Sample full-color offset printing of 15,000 laminated field guides.',
    summaryAm: '15,000 ባለቀለም የግብርና መስክ መመሪያዎች ህትመት የናሙና ጨረታ።',
    publisherName: 'Sample Tigray Farmers Innovation Hub',
    sourceType: 'partner_feed',
    sourceName: 'Sample Development Partner Feed',
    categorySlug: 'printing-publishing',
    regionCode: 'ET-TG',
    method: 'request_for_quotation',
    docFeeEtb: 0,
    bidSecurityEtb: 10000,
    daysUntilClose: 11,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-027',
    titleEn: '[SAMPLE] Steel Warehouse Fabrication & Prefabricated Roofing Sheets',
    titleAm: '[ናሙና] የብረት መጋዘን ግንባታ እና የጣሪያ ቆርቆሮ አቅርቦት',
    summaryEn: 'Sample industrial steel structure supply and erection for 1,200 sqm grain store.',
    summaryAm: '1,200 ካሬ ሜትር የእህል መጋዘን ብረት መዋቅር አቅርቦት እና ተከላ የናሙና ጨረታ።',
    publisherName: 'Sample Bale Grain Cooperative Union',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'manufacturing-industrial',
    regionCode: 'ET-OR',
    method: 'open_national',
    docFeeEtb: 750,
    bidSecurityEtb: 150000,
    daysUntilClose: 24,
    status: 'published',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-028',
    titleEn: '[SAMPLE] ATM Cash-In-Transit & Armored Vehicle Logistics Contract',
    titleAm: '[ናሙና] የኤቲኤም ገንዘብ ማጓጓዣ እና ደህንነት አገልግሎት',
    summaryEn: 'Sample restricted tender for licensed Ethiopian financial logistics operators.',
    summaryAm: 'ፍቃድ ላላቸው የገንዘብ ማጓጓዣ ድርጅቶች የተዘጋጀ የናሙና ጨረታ።',
    publisherName: 'Sample Addis Merchant Bank (Sample)',
    sourceType: 'publisher_submitted',
    sourceName: 'TenderLink Direct Publisher Portal',
    categorySlug: 'banking-financial',
    regionCode: 'ET-AA',
    method: 'restricted',
    docFeeEtb: 500,
    bidSecurityEtb: 100000,
    daysUntilClose: 10,
    status: 'amended',
    hasDocuments: true,
  },
  {
    ref: 'SAMPLE-2026-029',
    titleEn: '[SAMPLE] Emergency Borehole Rig Maintenance & Spare Parts (Closed Sample)',
    titleAm: '[ናሙና] የውሃ ቁፋሮ ማሽን ጥገና እና መለዋወጫ (የተዘጋ ናሙና)',
    summaryEn: 'Sample closed tender retained in archive to demonstrate expired status filtering.',
    summaryAm: 'የተዘጉ ጨረታዎችን ማጣሪያ ለመፈተሽ የተቀመጠ የናሙና መረጃ።',
    publisherName: 'Sample Jigjiga Water Response Unit',
    sourceType: 'official_source',
    sourceName: 'Sample Regional Gazette Bulletin',
    categorySlug: 'water-sanitation',
    regionCode: 'ET-SO',
    method: 'open_national',
    docFeeEtb: 300,
    bidSecurityEtb: 40000,
    daysUntilClose: -5,
    status: 'expired',
    hasDocuments: false,
  },
  {
    ref: 'SAMPLE-2026-030',
    titleEn: '[SAMPLE] Community Health Post Roof Renovation & Rainwater Harvesting (Closed Sample)',
    titleAm: '[ናሙና] የጤና ኬላ ጣሪያ እድሳት እና የዝናብ ውሃ ማጠራቀሚያ (የተዘጋ ናሙና)',
    summaryEn: 'Sample archived civil works notice showing expired status and clear closing timestamp.',
    summaryAm: 'የተዘጋ የሲቪል ስራ ጨረታን ሁኔታ ለማሳየት የተዘጋጀ የናሙና መረጃ።',
    publisherName: 'Sample Wolaita Rural Development NGO',
    sourceType: 'user_reported',
    sourceName: 'Community Tip (Verified Sample)',
    categorySlug: 'construction-civil-works',
    regionCode: 'ET-SE',
    method: 'open_national',
    docFeeEtb: 0,
    bidSecurityEtb: 15000,
    daysUntilClose: -2,
    status: 'expired',
    hasDocuments: true,
  },
];

let seedPromise: Promise<void> | null = null;

async function runIdempotentSeed() {
  // 1. Seed Roles
  await db.insert(roles).values(ROLE_SEEDS).onConflictDoNothing({ target: roles.code });

  // 2. Seed Regions
  await db.insert(regions).values(REGION_SEEDS).onConflictDoNothing({ target: regions.code });

  // 3. Seed Categories
  await db
    .insert(tenderCategories)
    .values(CATEGORY_SEEDS)
    .onConflictDoNothing({ target: tenderCategories.slug });

  // 4. Seed Billing Config (Ethiopian 15% VAT + sequential invoice numbering)
  await db
    .insert(billingConfig)
    .values({
      configKey: 'default',
      currency: 'ETB',
      vatEnabled: true,
      vatRateBps: 1500, // 15% Ethiopian VAT
      invoicePrefix: 'TL-ET',
      nextInvoiceSequence: 1,
      supplierLegalName: 'TenderLink Ethiopia Information Services PLC',
      supplierTin: '0000000000-TEST',
      trialDaysDefault: 7,
      testModeEnabled: true,
    })
    .onConflictDoNothing({ target: billingConfig.configKey });

  // 4b. Seed & sync all 5 Configurable Subscription & Publisher Plans (ETB)
  for (const plan of PLAN_SEEDS) {
    await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: subscriptionPlans.code,
        set: {
          audience: plan.audience,
          sortOrder: plan.sortOrder,
          nameEn: plan.nameEn,
          nameAm: plan.nameAm,
          taglineEn: plan.taglineEn,
          taglineAm: plan.taglineAm,
          priceEtbMonthly: plan.priceEtbMonthly,
          priceEtbAnnual: plan.priceEtbAnnual,
          maxBookmarks: plan.maxBookmarks,
          maxSavedSearches: plan.maxSavedSearches,
          instantAlerts: plan.instantAlerts,
          pushAlerts: plan.pushAlerts,
          smsTelegramAlerts: plan.smsTelegramAlerts,
          advancedFilters: plan.advancedFilters,
          fullDocumentAccess: plan.fullDocumentAccess,
          buyerTracking: plan.buyerTracking,
          prioritySupport: plan.prioritySupport,
          unlimitedListings: plan.unlimitedListings,
          featuredPlacement: plan.featuredPlacement,
          targetedAlerts: plan.targetedAlerts,
          advancedAnalytics: plan.advancedAnalytics,
          accountManagerSupport: plan.accountManagerSupport,
          listingDurationDays: plan.listingDurationDays,
          csvExportEnabled: plan.csvExportEnabled,
          archiveDays: plan.archiveDays,
          featuresJson: plan.featuresJson,
          isActive: true,
        },
      });
  }

  // 4c. Seed Configurable Plan Prices (Monthly, Annual, Per-Listing, Free)
  const seededPlans = await db.select().from(subscriptionPlans);
  const planIdByCode = new Map(seededPlans.map((p) => [p.code, p.id]));

  const priceSpecs: Array<{
    planCode: 'free' | 'starter' | 'professional' | 'publisher_basic' | 'publisher_pro';
    priceCode: string;
    interval: 'free' | 'monthly' | 'annual' | 'per_listing';
    amountEtb: number;
    trialDays: number;
  }> = [
    { planCode: 'free', priceCode: 'free_etb', interval: 'free', amountEtb: 0, trialDays: 0 },
    { planCode: 'starter', priceCode: 'starter_monthly_etb', interval: 'monthly', amountEtb: 499, trialDays: 7 },
    { planCode: 'starter', priceCode: 'starter_annual_etb', interval: 'annual', amountEtb: 4990, trialDays: 14 },
    { planCode: 'professional', priceCode: 'professional_monthly_etb', interval: 'monthly', amountEtb: 1499, trialDays: 7 },
    { planCode: 'professional', priceCode: 'professional_annual_etb', interval: 'annual', amountEtb: 14990, trialDays: 14 },
    { planCode: 'publisher_basic', priceCode: 'publisher_basic_per_listing_etb', interval: 'per_listing', amountEtb: 1500, trialDays: 0 },
    { planCode: 'publisher_pro', priceCode: 'publisher_pro_monthly_etb', interval: 'monthly', amountEtb: 4500, trialDays: 0 },
    { planCode: 'publisher_pro', priceCode: 'publisher_pro_annual_etb', interval: 'annual', amountEtb: 45000, trialDays: 0 },
  ];

  for (const spec of priceSpecs) {
    const planId = planIdByCode.get(spec.planCode);
    if (!planId) continue;
    await db
      .insert(planPrices)
      .values({
        planId,
        priceCode: spec.priceCode,
        interval: spec.interval,
        amountEtb: spec.amountEtb,
        currency: 'ETB',
        trialDays: spec.trialDays,
        isActive: true,
      })
      .onConflictDoNothing({ target: planPrices.priceCode });
  }

  // 5. Seed Publisher Listing Packages (ETB)
  await db
    .insert(listingPackages)
    .values(LISTING_PACKAGE_SEEDS)
    .onConflictDoNothing({ target: listingPackages.code });

  // 5b. Seed Baseline Ingestion Sources (NO external scraping — manual CSV/Excel + 1 sandboxed test connector)
  await db
    .insert(ingestionSources)
    .values([
      {
        sourceKey: 'manual_csv_excel_import',
        name: 'Manual CSV / Excel Bulk Import',
        connectorType: 'csv_excel_import',
        tenderSourceType: 'publisher_submitted',
        sourceUrl: null,
        frequencyMinutes: 0,
        authMethod: 'admin_session',
        rateLimitPerMinute: 60,
        parserConfigJson: {
          acceptedExtensions: ['.csv', '.xlsx', '.xls'],
          maxRowsPerBatch: 250,
          defaultTimezone: 'Africa/Addis_Ababa',
        },
        legalReviewStatus: 'not_required',
        robotsTxtNotes: 'Internal admin upload — no external crawling.',
        termsOfServiceNotes: 'Operator confirms right to publish uploaded notices.',
        isEnabled: true,
      },
      {
        sourceKey: 'manual_admin_entry',
        name: 'Manual Admin Tender Entry',
        connectorType: 'manual_admin',
        tenderSourceType: 'publisher_submitted',
        sourceUrl: null,
        frequencyMinutes: 0,
        authMethod: 'admin_session',
        rateLimitPerMinute: 60,
        parserConfigJson: {
          defaultTimezone: 'Africa/Addis_Ababa',
        },
        legalReviewStatus: 'not_required',
        robotsTxtNotes: 'Direct moderator/admin form submission.',
        termsOfServiceNotes: 'Requires source attribution on every manual record.',
        isEnabled: true,
      },
      {
        sourceKey: 'test_partner_json_feed',
        name: '[SANDBOX] Test Partner JSON Connector (Local Fixtures Only)',
        connectorType: 'json_api',
        tenderSourceType: 'partner_feed',
        sourceUrl: 'sandbox://tenderlink.et.invalid/partner-feed/v1/tenders.json',
        frequencyMinutes: 60,
        authMethod: 'none',
        rateLimitPerMinute: 10,
        parserConfigJson: {
          mode: 'local_sandbox_fixture',
          externalNetworkDisabled: true,
          defaultTimezone: 'Africa/Addis_Ababa',
          scenarios: [
            'clean_new_tender',
            'deadline_amendment',
            'exact_duplicate',
            'uncertain_near_duplicate',
            'quality_flagged_record',
          ],
        },
        legalReviewStatus: 'approved',
        robotsTxtNotes: 'Local in-memory test fixtures only — zero external HTTP requests.',
        termsOfServiceNotes: 'Approved sandbox dataset for testing normalisation, dedupe, quality, and amendments.',
        isEnabled: true,
      },
      {
        sourceKey: 'official_portal_pending_approval',
        name: 'Official Portal Connector (Disabled — Awaiting Legal & robots.txt Approval)',
        connectorType: 'official_portal',
        tenderSourceType: 'official_source',
        sourceUrl: 'https://example-official-portal.gov.et.invalid/tenders',
        frequencyMinutes: 360,
        authMethod: 'none',
        rateLimitPerMinute: 6,
        parserConfigJson: {
          externalNetworkDisabled: true,
          requiresFounderApproval: true,
        },
        legalReviewStatus: 'pending_review',
        robotsTxtNotes: 'PENDING: Must check robots.txt, crawl-delay, and public reuse policy before enabling.',
        termsOfServiceNotes: 'PENDING: Requires explicit founder approval before any live portal is connected.',
        isEnabled: false,
      },
    ])
    .onConflictDoNothing({ target: ingestionSources.sourceKey });

  // 6. Seed 30 clearly-labelled SAMPLE tenders only if none exist yet
  const [{ value: existingSampleCount }] = await db
    .select({ value: count() })
    .from(tenders)
    .where(eq(tenders.isSampleData, true));

  if (Number(existingSampleCount) >= SAMPLE_TENDER_SPECS.length) {
    return;
  }

  const allRegions = await db.select().from(regions);
  const allCategories = await db.select().from(tenderCategories);

  const regionByCode = new Map(allRegions.map((r) => [r.code, r.id]));
  const categoryBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));

  const now = Date.now();

  for (const spec of SAMPLE_TENDER_SPECS) {
    const regionId = regionByCode.get(spec.regionCode);
    const categoryId = categoryBySlug.get(spec.categorySlug);
    if (!regionId || !categoryId) continue;

    const fingerprint = crypto
      .createHash('sha256')
      .update(`${spec.publisherName.toLowerCase()}|${spec.ref.toLowerCase()}`)
      .digest('hex');

    const existing = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(eq(tenders.dedupeFingerprint, fingerprint))
      .limit(1);

    if (existing.length > 0) continue;

    const publishedAt = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const closingAt = new Date(now + spec.daysUntilClose * 24 * 60 * 60 * 1000);
    const featuredUntil = spec.isFeatured
      ? new Date(now + 14 * 24 * 60 * 60 * 1000)
      : null;

    const [inserted] = await db
      .insert(tenders)
      .values({
        referenceNumber: spec.ref,
        titleEn: spec.titleEn,
        titleAm: spec.titleAm,
        summaryEn: spec.summaryEn,
        summaryAm: spec.summaryAm,
        descriptionEn: `${spec.summaryEn} IMPORTANT: This is clearly labelled sample test data created for TenderLink Ethiopia platform evaluation. It does not represent a real active tender.`,
        descriptionAm: `${spec.summaryAm} ማሳሰቢያ፡ ይህ ለቴንደርሊንክ ኢትዮጵያ መድረክ ሙከራ የተዘጋጀ የናሙና መረጃ ነው፤ እውነተኛ ጨረታ አይደለም።`,
        eligibilityEn: 'Sample eligibility: Valid renewed Ethiopian business license, TIN certificate, and VAT registration where applicable.',
        eligibilityAm: 'የናሙና መስፈርት፡ የታደሰ የንግድ ፈቃድ፣ የግብር ከፋይ መለያ ቁጥር (TIN) እና አግባብነት ያለው የቫት ምዝገባ።',
        contactInfo: `Sample Procurement Desk · ${spec.publisherName} · sample-notice@tenderlink.et.invalid`,
        sourceType: spec.sourceType,
        sourceName: spec.sourceName,
        sourceUrl: null,
        publisherNameDisplay: spec.publisherName,
        categoryId,
        regionId,
        procurementMethod: spec.method,
        language: 'en',
        hasDocuments: Boolean(spec.hasDocuments),
        documentFeeEtb: spec.docFeeEtb,
        bidSecurityEtb: spec.bidSecurityEtb,
        submissionInstructions: 'Sample testing record only — do not submit bids to this test listing.',
        publishedAt,
        closingAt,
        status: spec.status,
        isFeatured: Boolean(spec.isFeatured),
        featuredUntil,
        isSampleData: true,
        dedupeFingerprint: fingerprint,
      })
      .returning({ id: tenders.id });

    if (inserted && spec.hasDocuments) {
      await db.insert(tenderDocuments).values({
        tenderId: inserted.id,
        title: `${spec.ref}_Sample_Bidding_Document.pdf`,
        objectKey: `samples/${spec.ref.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: 245_760,
        sha256Hash: crypto.createHash('sha256').update(spec.ref).digest('hex'),
      });
    }
  }
}

export function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runIdempotentSeed().catch((error) => {
      seedPromise = null;
      console.error('Database seed failed:', error);
      throw new Error('Failed to initialize reference data.', { cause: error });
    });
  }
  return seedPromise;
}
