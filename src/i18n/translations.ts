export type SupportedLanguage = 'en' | 'am';

export interface TranslationDictionary {
  meta: {
    pageTitle: string;
    appName: string;
    appNameShort: string;
  };
  nav: {
    tenders: string;
    plans: string;
    publish: string;
    admin: string;
    uiKit: string;
    signIn: string;
    skipToContent: string;
  };
  disclaimer: {
    independentNotice: string;
    sampleDataBanner: string;
    sampleTag: string;
    footerCopyright: string;
    privacyLink: string;
    termsLink: string;
  };
  sources: {
    all: string;
    official_source: string;
    publisher_submitted: string;
    partner_feed: string;
    user_reported: string;
  };
  statuses: {
    draft: string;
    pending_review: string;
    published: string;
    amended: string;
    expired: string;
    cancelled: string;
    archived: string;
  };
  methods: {
    open_national: string;
    open_international: string;
    restricted: string;
    request_for_proposal: string;
    request_for_quotation: string;
    expression_of_interest: string;
    direct_procurement: string;
    other: string;
  };
  home: {
    heading: string;
    subtitle: string;
    sourceFilterLabel: string;
    showingRange: string;
    publishedOn: string;
    closesOn: string;
    docFee: string;
    freeDoc: string;
    bidSecurity: string;
    featuredLabel: string;
    documentsAttached: string;
    previousPage: string;
    nextPage: string;
    pageOf: string;
    emptyTitle: string;
    emptyBody: string;
    resetFilter: string;
    taxonomyTitle: string;
    regionsLabel: string;
    categoriesLabel: string;
    plansLabel: string;
    sampleTendersLabel: string;
  };
  plans: {
    heading: string;
    subtitle: string;
    perMonth: string;
    freeLabel: string;
    mostPopular: string;
    bookmarksLimit: string;
    unlimited: string;
    savedSearchesLimit: string;
    instantAlerts: string;
    pushAlerts: string;
    csvExport: string;
    archiveAccess: string;
    fullArchive: string;
    daysSuffix: string;
    included: string;
    notIncluded: string;
    selectPlanCta: string;
    publisherHeading: string;
    publisherSubtitle: string;
    paymentNote: string;
    durationDays: string;
  };
  publish: {
    heading: string;
    subtitle: string;
    milestoneNote: string;
    backToTenders: string;
    rulesTitle: string;
    rule1: string;
    rule2: string;
    rule3: string;
  };
  uiKit: {
    heading: string;
    subtitle: string;
    stateDemoTitle: string;
    stateDemoDesc: string;
    formValidationTitle: string;
    formValidationDesc: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    sectorLabel: string;
    sectorPlaceholder: string;
    validateBtn: string;
    validationSuccess: string;
    errorNameRequired: string;
    errorPhoneFormat: string;
    errorSectorRequired: string;
    simulateOfflineBtn: string;
    restoreOnlineBtn: string;
    componentsTitle: string;
  };
  states: {
    loadingLabel: string;
    errorTitle: string;
    errorFallback: string;
    retry: string;
    offlineTitle: string;
    offlineBody: string;
    boundaryTitle: string;
    boundaryBody: string;
    reloadApp: string;
    authMilestoneNotice: string;
    close: string;
  };
  adminIngestion: {
    heading: string;
    subtitle: string;
    legalGateNotice: string;
    tabSources: string;
    tabImport: string;
    tabManual: string;
    tabModeration: string;
    tabQuality: string;
    tabAudit: string;
    runTestConnector: string;
    running: string;
    downloadTemplate: string;
    uploadFileCta: string;
    submitManualCta: string;
    approveBtn: string;
    rejectBtn: string;
    markDuplicateBtn: string;
    amendBtn: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    meta: {
      pageTitle: 'TenderLink Ethiopia — Ethiopian Tender Discovery & Publishing Platform',
      appName: 'TenderLink Ethiopia',
      appNameShort: 'TenderLink',
    },
    nav: {
      tenders: 'Tenders',
      plans: 'Plans',
      publish: 'Publish',
      admin: 'Admin',
      uiKit: 'UI Kit',
      signIn: 'Sign In',
      skipToContent: 'Skip to main content',
    },
    disclaimer: {
      independentNotice:
        'Independent tender discovery platform — TenderLink Ethiopia is not an official Ethiopian government procurement portal.',
      sampleDataBanner:
        'Testing Mode: Showing clearly labelled sample tenders seeded for Milestone 1 verification. No real tender notices or organisations are used.',
      sampleTag: 'Sample Data',
      footerCopyright: 'TenderLink Ethiopia. Independent procurement information service.',
      privacyLink: 'Privacy Policy',
      termsLink: 'Terms of Use',
    },
    sources: {
      all: 'All Sources',
      official_source: 'Official Source',
      publisher_submitted: 'Publisher Submitted',
      partner_feed: 'Partner Feed',
      user_reported: 'User Reported',
    },
    statuses: {
      draft: 'Draft',
      pending_review: 'Pending Review',
      published: 'Open',
      amended: 'Amended',
      expired: 'Closed',
      cancelled: 'Cancelled',
      archived: 'Archived',
    },
    methods: {
      open_national: 'Open National Bid',
      open_international: 'Open International Bid',
      restricted: 'Restricted Tender',
      request_for_proposal: 'Request for Proposal (RFP)',
      request_for_quotation: 'Request for Quotation (RFQ)',
      expression_of_interest: 'Expression of Interest (EOI)',
      direct_procurement: 'Direct Procurement',
      other: 'Other',
    },
    home: {
      heading: 'Ethiopian Tender Directory',
      subtitle:
        'Transparent procurement discovery across Ethiopia with separated source provenance, EAT deadlines, and bilingual Amharic/English support.',
      sourceFilterLabel: 'Filter by source channel',
      showingRange: 'Showing',
      publishedOn: 'Published',
      closesOn: 'Closes',
      docFee: 'Doc fee',
      freeDoc: 'Free document',
      bidSecurity: 'Bid security',
      featuredLabel: 'Featured',
      documentsAttached: 'Document attached',
      previousPage: 'Previous',
      nextPage: 'Next',
      pageOf: 'Page',
      emptyTitle: 'No tenders found in this source channel',
      emptyBody: 'Try switching back to All Sources or resetting your filter selection.',
      resetFilter: 'Show All Sources',
      taxonomyTitle: 'Foundation Data Ready',
      regionsLabel: 'Ethiopian Regions',
      categoriesLabel: 'Sectors',
      plansLabel: 'ETB Plans',
      sampleTendersLabel: 'Labelled Sample Tenders',
    },
    plans: {
      heading: 'Transparent Pricing in Ethiopian Birr (ETB)',
      subtitle:
        'Start discovering tenders for free, or upgrade for instant alerts, expanded saved searches, and full archive access via Chapa and Telebirr.',
      perMonth: '/ month',
      freeLabel: 'Free forever',
      mostPopular: 'Recommended for Bid Teams',
      bookmarksLimit: 'Bookmarks',
      unlimited: 'Unlimited',
      savedSearchesLimit: 'Saved searches',
      instantAlerts: 'Instant email alerts',
      pushAlerts: 'Push notifications',
      csvExport: 'CSV bookmark export',
      archiveAccess: 'Expired tender archive',
      fullArchive: 'Full archive',
      daysSuffix: 'days',
      included: 'Included',
      notIncluded: 'Not included',
      selectPlanCta: 'Coming in Milestone 5 (Chapa)',
      publisherHeading: 'Publisher Listing Packages',
      publisherSubtitle:
        'Standard tender listings are free after moderation review. Boost urgent bids with optional paid Featured Placement.',
      paymentNote:
        'Checkout in ETB via Chapa (Telebirr, CBE Birr, local banks & cards) with server-side webhook verification activates in Milestone 5.',
      durationDays: 'days visibility',
    },
    publish: {
      heading: 'Publish a Tender Notice',
      subtitle:
        'Public bodies, private companies, NGOs, universities, and hospitals can publish standard tenders for free after verification and moderation.',
      milestoneNote:
        'Publisher registration, tender submission, document upload, and moderation workflows will be delivered in Milestones 6 & 7.',
      backToTenders: 'Back to Tender Directory',
      rulesTitle: 'Publishing Integrity Standards',
      rule1: 'Every submitted tender enters Pending Review and requires moderator approval before public visibility.',
      rule2: 'Source provenance is always separated across Official Source, Publisher Submitted, Partner Feed, and User Reported.',
      rule3: 'Every creation, edit, approval, rejection, and removal is permanently logged in the audit trail.',
    },
    uiKit: {
      heading: 'Design System & Global States',
      subtitle:
        'Mobile-first, WCAG AA accessible reusable components designed for low-bandwidth Ethiopian mobile networks.',
      stateDemoTitle: 'Interactive Global State Verification',
      stateDemoDesc:
        'Toggle each state below to verify how TenderLink Ethiopia handles loading skeletons, empty results, errors, offline connectivity, and success feedback.',
      formValidationTitle: 'Bilingual Client-Side Validation Demo',
      formValidationDesc:
        'Submit empty or invalid fields to test friendly validation messages in both English and Amharic.',
      fullNameLabel: 'Full Name',
      fullNamePlaceholder: 'e.g., Abebe Kebede',
      phoneLabel: 'Ethiopian Phone Number',
      phonePlaceholder: '+251911234567',
      sectorLabel: 'Primary Procurement Sector',
      sectorPlaceholder: 'Select a sector',
      validateBtn: 'Validate Form',
      validationSuccess: 'All inputs passed validation cleanly.',
      errorNameRequired: 'Please enter your full name (at least 3 characters).',
      errorPhoneFormat: 'Enter a valid Ethiopian phone number starting with +2519 or +2517.',
      errorSectorRequired: 'Please choose a primary procurement sector.',
      simulateOfflineBtn: 'Simulate Offline Mode',
      restoreOnlineBtn: 'Restore Online Mode',
      componentsTitle: 'Core Button, Status & Currency Primitives',
    },
    states: {
      loadingLabel: 'Loading procurement data...',
      errorTitle: 'Unable to load data',
      errorFallback: 'A temporary connection issue occurred. Please check your internet and try again.',
      retry: 'Try Again',
      offlineTitle: 'You are currently offline',
      offlineBody: 'Internet connection is unavailable. Saved page content stays readable, and actions will resume when you reconnect.',
      boundaryTitle: 'Something went wrong',
      boundaryBody: 'An unexpected interface error occurred. Reloading will restore your session safely.',
      reloadApp: 'Reload Application',
      authMilestoneNotice:
        'Full registration, OTP verification, login, role-based access control, and profile management will be built in Milestone 2.',
      close: 'Close',
    },
    adminIngestion: {
      heading: 'Ingestion, Normalisation & Data-Quality Console',
      subtitle:
        'Manage approved connectors, upload CSV/Excel batches, enter notices manually, review duplicates & quality flags, and track versioned amendments.',
      legalGateNotice:
        'Compliance Lock Active: Zero live websites are scraped. Only Manual CSV/Excel Import, Manual Admin Entry, and one local Sandbox Test Connector are enabled pending legal & robots.txt review.',
      tabSources: 'Sources',
      tabImport: 'CSV / Excel',
      tabManual: 'Manual Entry',
      tabModeration: 'Moderation & Duplicates',
      tabQuality: 'Quality & Runs',
      tabAudit: 'Audit Trail',
      runTestConnector: 'Run Test Connector',
      running: 'Running...',
      downloadTemplate: 'Download Sample CSV',
      uploadFileCta: 'Run Bulk Import',
      submitManualCta: 'Submit to Moderation Queue',
      approveBtn: 'Approve & Publish',
      rejectBtn: 'Reject',
      markDuplicateBtn: 'Mark Duplicate',
      amendBtn: 'Amend Tender',
    },
  },
  am: {
    meta: {
      pageTitle: 'ቴንደርሊንክ ኢትዮጵያ — የኢትዮጵያ ጨረታ መፈለጊያ እና ማሳተሚያ መድረክ',
      appName: 'ቴንደርሊንክ ኢትዮጵያ',
      appNameShort: 'ቴንደርሊንክ',
    },
    nav: {
      tenders: 'ጨረታዎች',
      plans: 'ፓኬጆች',
      publish: 'ጨረታ አውጣ',
      admin: 'አስተዳደር',
      uiKit: 'ዲዛይን ሲስተም',
      signIn: 'ግባ',
      skipToContent: 'ወደ ዋናው ይዘት ዝለል',
    },
    disclaimer: {
      independentNotice:
        'ነፃ የጨረታ መረጃ መድረክ — ቴንደርሊንክ ኢትዮጵያ የመንግስት ኦፊሴላዊ የግዥ ፖርታል አይደለም።',
      sampleDataBanner:
        'የሙከራ ሁኔታ፡ ለምዕራፍ 1 ፍተሻ የተዘጋጁ በግልፅ የተለዩ የናሙና ጨረታዎች ናቸው። እውነተኛ ጨረታ ወይም ድርጅት አልተጠቀመም።',
      sampleTag: 'የናሙና መረጃ',
      footerCopyright: 'ቴንደርሊንክ ኢትዮጵያ። ነፃ የጨረታ መረጃ አገልግሎት።',
      privacyLink: 'የግላዊነት ፖሊሲ',
      termsLink: 'የአጠቃቀም ደንብ',
    },
    sources: {
      all: 'ሁሉም ምንጮች',
      official_source: 'ኦፊሴላዊ ምንጭ',
      publisher_submitted: 'በአውጪ የቀረበ',
      partner_feed: 'የአጋር ምንጭ',
      user_reported: 'በተጠቃሚ የተጠቆመ',
    },
    statuses: {
      draft: 'ረቂቅ',
      pending_review: 'በግምገማ ላይ',
      published: 'ክፍት',
      amended: 'የተሻሻለ',
      expired: 'የተዘጋ',
      cancelled: 'የተሰረዘ',
      archived: 'በማህደር የተቀመጠ',
    },
    methods: {
      open_national: 'ግልፅ ብሔራዊ ጨረታ',
      open_international: 'ግልፅ ዓለም አቀፍ ጨረታ',
      restricted: 'ውስን ጨረታ',
      request_for_proposal: 'የፕሮፖዛል ጥያቄ (RFP)',
      request_for_quotation: 'የዋጋ ማቅረቢያ ጥያቄ (RFQ)',
      expression_of_interest: 'የፍላጎት መግለጫ (EOI)',
      direct_procurement: 'ቀጥታ ግዥ',
      other: 'ሌላ',
    },
    home: {
      heading: 'የኢትዮጵያ ጨረታዎች ማውጫ',
      subtitle:
        'ግልፅ የምንጭ መለያ፣ የኢትዮጵያ ሰዓት አቆጣጠር የመዝጊያ ቀናት እና የአማርኛ/እንግሊዝኛ ድጋፍ ያለው የጨረታ መፈለጊያ።',
      sourceFilterLabel: 'በምንጭ አይነት አጣራ',
      showingRange: 'እየታየ ያለው',
      publishedOn: 'የወጣበት',
      closesOn: 'መዝጊያ',
      docFee: 'የሰነድ ዋጋ',
      freeDoc: 'ነፃ ሰነድ',
      bidSecurity: 'የጨረታ ማስከበሪያ',
      featuredLabel: 'ተመራጭ',
      documentsAttached: 'ሰነድ ተያይዟል',
      previousPage: 'ቀዳሚ',
      nextPage: 'ቀጣይ',
      pageOf: 'ገፅ',
      emptyTitle: 'በዚህ የምንጭ አይነት ምንም ጨረታ አልተገኘም',
      emptyBody: 'ሁሉንም ምንጮች ለማየት ማጣሪያውን ያፅዱ።',
      resetFilter: 'ሁሉንም ምንጮች አሳይ',
      taxonomyTitle: 'የመሰረት ዳታ ዝግጁ ነው',
      regionsLabel: 'የኢትዮጵያ ክልሎች',
      categoriesLabel: 'ዘርፎች',
      plansLabel: 'የብር ፓኬጆች',
      sampleTendersLabel: 'የተለዩ የናሙና ጨረታዎች',
    },
    plans: {
      heading: 'ግልፅ ዋጋ በኢትዮጵያ ብር (ETB)',
      subtitle:
        'በነፃ ጨረታዎችን መፈለግ ይጀምሩ፤ ወይም ለፈጣን ማሳወቂያዎች እና ለተጨማሪ የተቀመጡ ፍለጋዎች በቻፓ እና ቴሌብር ያሻሽሉ።',
      perMonth: '/ በወር',
      freeLabel: 'ሁሌም ነፃ',
      mostPopular: 'ለጨረታ ቡድኖች የሚመከር',
      bookmarksLimit: 'የተቀመጡ ጨረታዎች',
      unlimited: 'ያልተገደበ',
      savedSearchesLimit: 'የተቀመጡ ፍለጋዎች',
      instantAlerts: 'ፈጣን የኢሜል ማሳወቂያ',
      pushAlerts: 'የሞባይል ፑሽ ማሳወቂያ',
      csvExport: 'በCSV ማውረድ',
      archiveAccess: 'የተዘጉ ጨረታዎች ማህደር',
      fullArchive: 'ሙሉ ማህደር',
      daysSuffix: 'ቀናት',
      included: 'ተካትቷል',
      notIncluded: 'አልተካተተም',
      selectPlanCta: 'በምዕራፍ 5 ይከፈታል (ቻፓ)',
      publisherHeading: 'የጨረታ አውጪ ፓኬጆች',
      publisherSubtitle:
        'መደበኛ የጨረታ ማስታወቂያዎች ከማረጋገጫ በኋላ በነፃ ይታተማሉ። አስቸኳይ ጨረታዎችን በተመራጭ ቦታ ያጉሉ።',
      paymentNote:
        'በቻፓ (ቴሌብር፣ ሲቢኢ ብር እና የሀገር ውስጥ ባንኮች) የሚከፈል ክፍያ እና የሰርቨር ማረጋገጫ በምዕራፍ 5 ይካተታል።',
      durationDays: 'ቀናት ታይነት',
    },
    publish: {
      heading: 'የጨረታ ማስታወቂያ ያውጡ',
      subtitle:
        'የመንግስት ተቋማት፣ የግል ድርጅቶች፣ መንግስታዊ ያልሆኑ ድርጅቶች፣ ዩኒቨርሲቲዎች እና ሆስፒታሎች መደበኛ ጨረታዎችን በነፃ ማውጣት ይችላሉ።',
      milestoneNote:
        'የአውጪ ምዝገባ፣ የጨረታ ማቅረቢያ ቅፅ፣ የሰነድ መጫኛ እና የማረጋገጫ ሂደት በምዕራፍ 6 እና 7 ይገነባሉ።',
      backToTenders: 'ወደ ጨረታዎች ማውጫ ተመለስ',
      rulesTitle: 'የህትመት ታማኝነት መመሪያዎች',
      rule1: 'ማንኛውም የቀረበ ጨረታ ለህዝብ ከመታየቱ በፊት በአረጋጋጭ ይገመገማል።',
      rule2: 'የምንጭ መለያ ሁሌም በኦፊሴላዊ ምንጭ፣ በአውጪ የቀረበ፣ የአጋር ምንጭ እና በተጠቃሚ የተጠቆመ ተብሎ ይለያል።',
      rule3: 'ማንኛውም ማውጣት፣ ማስተካከል፣ ማፅደቅ እና መሰረዝ በኦዲት መዝገብ ላይ በቋሚነት ይመዘገባል።',
    },
    uiKit: {
      heading: 'የዲዛይን ሲስተም እና አጠቃላይ ሁኔታዎች',
      subtitle:
        'ለዝቅተኛ የኢንተርኔት ፍጥነት እና ለሞባይል የተመቻቹ የWCAG AA ተደራሽነት ያላቸው ክፍሎች።',
      stateDemoTitle: 'የስርዓት ሁኔታዎች መፈተሻ',
      stateDemoDesc:
        'ከታች ያሉትን ቁልፎች በመጫን የመጫኛ (Loading)፣ ባዶ (Empty)፣ ስህተት (Error)፣ ኦፍላይን (Offline) እና ስኬት ሁኔታዎችን ይፈትሹ።',
      formValidationTitle: 'የአማርኛ እና እንግሊዝኛ ቅፅ ማረጋገጫ ሙከራ',
      formValidationDesc:
        'ባዶ ወይም የተሳሳተ መረጃ በማስገባት ግልፅ የስህተት መልዕክቶችን ይፈትሹ።',
      fullNameLabel: 'ሙሉ ስም',
      fullNamePlaceholder: 'ለምሳሌ፡ አበበ ከበደ',
      phoneLabel: 'የኢትዮጵያ ስልክ ቁጥር',
      phonePlaceholder: '+251911234567',
      sectorLabel: 'ዋና የግዥ ዘርፍ',
      sectorPlaceholder: 'ዘርፍ ይምረጡ',
      validateBtn: 'ቅፁን አረጋግጥ',
      validationSuccess: 'ሁሉም መረጃዎች በትክክል ተረጋግጠዋል።',
      errorNameRequired: 'እባክዎ ሙሉ ስምዎን ያስገቡ (ቢያንስ 3 ፊደላት)።',
      errorPhoneFormat: 'በ +2519 ወይም +2517 የሚጀምር ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።',
      errorSectorRequired: 'እባክዎ ዋና የግዥ ዘርፍ ይምረጡ።',
      simulateOfflineBtn: 'ኦፍላይን ሁኔታን ሞክር',
      restoreOnlineBtn: 'ወደ ኦንላይን ተመለስ',
      componentsTitle: 'መሰረታዊ ቁልፎች፣ ሁኔታዎች እና የብር አቀራረብ',
    },
    states: {
      loadingLabel: 'የጨረታ መረጃ በመጫን ላይ...',
      errorTitle: 'መረጃውን መጫን አልተቻለም',
      errorFallback: 'ጊዜያዊ የግንኙነት ችግር ተፈጥሯል። ኢንተርኔትዎን አረጋግጠው እንደገና ይሞክሩ።',
      retry: 'እንደገና ሞክር',
      offlineTitle: 'ኢንተርኔትዎ ተቋርጧል (ኦፍላይን)',
      offlineBody: 'የኢንተርኔት ግንኙነት የለም። የተጫኑ መረጃዎችን ማንበብ ይችላሉ፤ ግንኙነት ሲመለስ ተግባራት ይቀጥላሉ።',
      boundaryTitle: 'ያልተጠበቀ ችግር ተፈጥሯል',
      boundaryBody: 'የገፅ ስህተት አጋጥሟል። ገፁን እንደገና መጫን ስራዎን በደህና ይመልሳል።',
      reloadApp: 'ገፁን እንደገና ጫን',
      authMilestoneNotice:
        'ሙሉ የኢሜል/ስልክ ምዝገባ፣ OTP ማረጋገጫ፣ መግቢያ፣ ሚና ላይ የተመሰረተ ቁጥጥር እና ፕሮፋይል በምዕራፍ 2 ይገነባሉ።',
      close: 'ዝጋ',
    },
    adminIngestion: {
      heading: 'የጨረታ መረጃ ማሰባሰቢያ እና የጥራት ቁጥጥር ፓነል',
      subtitle:
        'የተፈቀዱ ምንጮችን ያስተዳድሩ፣ CSV/Excel ፋይሎችን ይጫኑ፣ ጨረታ በእጅ ያስገቡ፣ ድግግሞሾችን ይገምግሙ እና ማሻሻያዎችን ይከታተሉ።',
      legalGateNotice:
        'የህግ ጥበቃ ገቢር ነው፡ ምንም የውጭ ድረ-ገፅ አይጎበኝም። በእጅ CSV/Excel መጫኛ እና አንድ የሙከራ ኮኔክተር ብቻ ናቸው የተከፈቱት።',
      tabSources: 'ምንጮች',
      tabImport: 'CSV / Excel',
      tabManual: 'በእጅ ማስገቢያ',
      tabModeration: 'ግምገማ እና ድግግሞሽ',
      tabQuality: 'ጥራት እና ታሪክ',
      tabAudit: 'የኦዲት መዝገብ',
      runTestConnector: 'የሙከራ ኮኔክተር አስኪድ',
      running: 'በመስራት ላይ...',
      downloadTemplate: 'የናሙና CSV አውርድ',
      uploadFileCta: 'ፋይሉን አስገባ',
      submitManualCta: 'ወደ ግምገማ ላክ',
      approveBtn: 'አፅድቅ እና አትም',
      rejectBtn: 'ውድቅ አድርግ',
      markDuplicateBtn: 'ድግግሞሽ ነው',
      amendBtn: 'ማሻሻያ ፍጠር',
    },
  },
};

export function formatEtb(amount: number, lang: SupportedLanguage): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
  return lang === 'am' ? `${formatted} ብር` : `ETB ${formatted}`;
}

export function formatEatDate(isoDate: string | null | undefined, lang: SupportedLanguage): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'am' ? 'am-ET' : 'en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
