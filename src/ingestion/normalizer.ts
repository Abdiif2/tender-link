import crypto from 'crypto';
import type {
  NormalizedDocument,
  NormalizedTenderDraft,
  ProcurementMethod,
  RawDocumentAttachment,
  RawIngestionItem,
  TaxonomyLookup,
  TenderSourceType,
} from './types.ts';

const ETHIOPIC_REGEX = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/g;

// Approximate conversion factors used only when normalizing foreign-currency figures to ETB estimates
// for sorting/filtering; original currency is always preserved in metadata.
const CURRENCY_TO_ETB_FALLBACK: Record<string, number> = {
  ETB: 1,
  BIRR: 1,
  USD: 125,
  EUR: 135,
  GBP: 158,
};

const CITY_TO_REGION_CODE: Record<string, string> = {
  'addis ababa': 'ET-AA',
  addis: 'ET-AA',
  'finfinne': 'ET-AA',
  'አዲስ አበባ': 'ET-AA',
  adama: 'ET-OR',
  nazret: 'ET-OR',
  bishoftu: 'ET-OR',
  jimma: 'ET-OR',
  shashamane: 'ET-OR',
  nekemte: 'ET-OR',
  oromia: 'ET-OR',
  'ኦሮሚያ': 'ET-OR',
  'bahir dar': 'ET-AM',
  gondar: 'ET-AM',
  dessie: 'ET-AM',
  'debre berhan': 'ET-AM',
  kombolcha: 'ET-AM',
  amhara: 'ET-AM',
  'አማራ': 'ET-AM',
  mekelle: 'ET-TG',
  adigrat: 'ET-TG',
  shire: 'ET-TG',
  axum: 'ET-TG',
  tigray: 'ET-TG',
  'ትግራይ': 'ET-TG',
  hawassa: 'ET-SD',
  yirgalem: 'ET-SD',
  sidama: 'ET-SD',
  'ሲዳማ': 'ET-SD',
  jigjiga: 'ET-SO',
  gode: 'ET-SO',
  somali: 'ET-SO',
  'ሶማሌ': 'ET-SO',
  'dire dawa': 'ET-DD',
  'ድሬዳዋ': 'ET-DD',
  'arba minch': 'ET-SE',
  'wolaita sodo': 'ET-SE',
  dilla: 'ET-SE',
  'south ethiopia': 'ET-SE',
  hosanna: 'ET-CE',
  wolkite: 'ET-CE',
  'central ethiopia': 'ET-CE',
  semera: 'ET-AF',
  awash: 'ET-AF',
  afar: 'ET-AF',
  assosa: 'ET-BG',
  'benishangul-gumuz': 'ET-BG',
  benishangul: 'ET-BG',
  nationwide: 'ET-ALL',
  national: 'ET-ALL',
  ethiopia: 'ET-ALL',
  'በመላው ኢትዮጵያ': 'ET-ALL',
};

const CATEGORY_KEYWORDS: Array<{ slug: string; keywords: string[] }> = [
  {
    slug: 'construction-civil-works',
    keywords: ['construction', 'civil', 'building', 'road', 'bridge', 'renovation', 'contractor', 'gravel', 'asphalt', 'ግንባታ'],
  },
  {
    slug: 'it-telecommunications',
    keywords: ['software', 'network', 'firewall', 'fiber', 'server', 'computer', 'laptop', 'ict', 'it ', 'telecom', 'erp', 'cloud', 'አይቲ'],
  },
  {
    slug: 'health-medical-supplies',
    keywords: ['medical', 'hospital', 'clinic', 'pharmaceutical', 'diagnostic', 'laboratory', 'vaccine', 'consumables', 'health', 'ጤና'],
  },
  {
    slug: 'water-sanitation',
    keywords: ['water', 'borehole', 'pump', 'sanitation', 'wash', 'pipe', 'reservoir', 'drainage', 'ውሃ'],
  },
  {
    slug: 'agriculture-agribusiness',
    keywords: ['agriculture', 'coffee', 'seed', 'fertilizer', 'tractor', 'livestock', 'irrigation', 'grain', 'wheat', 'ግብርና'],
  },
  {
    slug: 'consultancy-advisory',
    keywords: ['consultancy', 'consultant', 'advisory', 'audit', 'baseline', 'feasibility', 'evaluation', 'study', 'design', 'የምክር'],
  },
  {
    slug: 'energy-solar',
    keywords: ['solar', 'generator', 'transformer', 'inverter', 'energy', 'power', 'microgrid', 'battery', 'ኢነርጂ'],
  },
  {
    slug: 'transport-logistics',
    keywords: ['vehicle', 'truck', 'fleet', 'transport', 'logistics', 'freight', 'fuel', 'spare parts', 'rental', 'ትራንስፖርት'],
  },
  {
    slug: 'office-equipment-furniture',
    keywords: ['furniture', 'stationery', 'desk', 'chair', 'printer', 'photocopier', 'toner', 'office', 'ፈርኒቸር'],
  },
  {
    slug: 'education-training',
    keywords: ['education', 'training', 'school', 'textbook', 'curriculum', 'university', 'vocational', 'ትምህርት'],
  },
  {
    slug: 'security-facility',
    keywords: ['security', 'guard', 'cleaning', 'janitorial', 'facility', 'catering', 'maintenance', 'ጥበቃ'],
  },
  {
    slug: 'banking-financial',
    keywords: ['insurance', 'banking', 'financial', 'microfinance', 'payment', 'actuarial', 'ባንክ'],
  },
  {
    slug: 'printing-publishing',
    keywords: ['printing', 'publishing', 'brochure', 'banner', 'branding', 'signage', 'ህትመት'],
  },
  {
    slug: 'manufacturing-industrial',
    keywords: ['manufacturing', 'industrial', 'machinery', 'factory', 'steel', 'cement', 'textile', 'ማኑፋክቸሪንግ'],
  },
];

export function extractPlainText(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanWhitespace(input?: string | null, maxLength?: number): string {
  const cleaned = extractPlainText(input).replace(/\s+/g, ' ').trim();
  if (maxLength && cleaned.length > maxLength) {
    return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }
  return cleaned;
}

export function detectLanguage(text: string, hint?: string): 'en' | 'am' {
  const normalizedHint = (hint || '').trim().toLowerCase();
  if (normalizedHint === 'am' || normalizedHint === 'amharic' || normalizedHint === 'አማርኛ') {
    return 'am';
  }
  if (normalizedHint === 'en' || normalizedHint === 'english') {
    return 'en';
  }
  const ethiopicMatches = text.match(ETHIOPIC_REGEX) || [];
  if (ethiopicMatches.length >= 6 && ethiopicMatches.length / Math.max(text.length, 1) > 0.12) {
    return 'am';
  }
  return 'en';
}

export function canonicalizeUrl(rawUrl?: string | null): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:', 'sandbox:'].includes(parsed.protocol)) {
      return null;
    }
    parsed.hash = '';
    const dropParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    for (const p of dropParams) {
      parsed.searchParams.delete(p);
    }
    parsed.searchParams.sort();
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function parseDateInEat(
  rawDate?: string | null,
  timezone = 'Africa/Addis_Ababa'
): { date: Date | null; invalid: boolean } {
  if (!rawDate || !String(rawDate).trim()) {
    return { date: null, invalid: false };
  }
  const value = String(rawDate).trim();

  // Excel serial date numbers (e.g. 46125)
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 30000 && serial < 80000) {
      const utcMs = Math.round((serial - 25569) * 86400 * 1000);
      return { date: new Date(utcMs), invalid: false };
    }
  }

  // ISO date-only YYYY-MM-DD -> default end-of-business 17:00 EAT (+03:00)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const offset = timezone === 'UTC' ? 'Z' : '+03:00';
    const parsed = new Date(`${value}T17:00:00${offset}`);
    if (!Number.isNaN(parsed.getTime())) {
      return { date: parsed, invalid: false };
    }
  }

  // YYYY-MM-DD HH:mm (assume EAT +03:00 when offset omitted)
  const ymdTime = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (ymdTime) {
    const offset = timezone === 'UTC' ? 'Z' : '+03:00';
    const parsed = new Date(`${ymdTime[1]}T${ymdTime[2]}:${ymdTime[3] || '00'}${offset}`);
    if (!Number.isNaN(parsed.getTime())) {
      return { date: parsed, invalid: false };
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY common in Ethiopian tender notices
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T17:00:00+03:00`;
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime())) {
        return { date: parsed, invalid: false };
      }
    }
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) {
    return { date: fallback, invalid: false };
  }

  return { date: null, invalid: true };
}

export function parseMoneyToEtb(
  rawValue?: string | number | null,
  currencyHint?: string | null
): { amountEtb: number | null; currency: string } {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    const cur = (currencyHint || 'ETB').trim().toUpperCase();
    return { amountEtb: null, currency: cur === 'BIRR' ? 'ETB' : cur };
  }

  const str = String(rawValue).trim();
  const detectedCurMatch = str.match(/\b(ETB|BIRR|USD|EUR|GBP)\b/i);
  const rawCur = (detectedCurMatch?.[1] || currencyHint || 'ETB').toUpperCase();
  const currency = rawCur === 'BIRR' ? 'ETB' : rawCur;

  const numericMatch = str.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!numericMatch) {
    return { amountEtb: null, currency };
  }

  const parsedNum = Number(numericMatch[0]);
  if (!Number.isFinite(parsedNum) || parsedNum < 0) {
    return { amountEtb: null, currency };
  }

  const rate = CURRENCY_TO_ETB_FALLBACK[currency] ?? 1;
  return {
    amountEtb: Math.round(parsedNum * rate),
    currency,
  };
}

export function normalizeProcurementMethod(raw?: string | null): ProcurementMethod {
  const val = (raw || '').trim().toLowerCase();
  if (!val) return 'open_national';
  if (val.includes('icb') || val.includes('international')) return 'open_international';
  if (val.includes('rfp') || val.includes('proposal')) return 'request_for_proposal';
  if (val.includes('rfq') || val.includes('quotation')) return 'request_for_quotation';
  if (val.includes('eoi') || val.includes('expression') || val.includes('interest')) {
    return 'expression_of_interest';
  }
  if (val.includes('restrict') || val.includes('limited') || val.includes('shortlist')) {
    return 'restricted';
  }
  if (val.includes('direct') || val.includes('single')) return 'direct_procurement';
  return 'open_national';
}

export function normalizeContactDetails(
  contactInfo?: string | null,
  email?: string | null,
  phone?: string | null
): string | null {
  const parts: string[] = [];
  if (contactInfo) {
    parts.push(cleanWhitespace(contactInfo, 240));
  }
  const normalizedPhone = phone
    ? phone
        .trim()
        .replace(/^0([79]\d{8})$/, '+251$1')
        .replace(/^251([79]\d{8})$/, '+251$1')
    : null;
  if (normalizedPhone && !parts.some((p) => p.includes(normalizedPhone))) {
    parts.push(normalizedPhone);
  }
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  if (normalizedEmail && !parts.some((p) => p.toLowerCase().includes(normalizedEmail))) {
    parts.push(normalizedEmail);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function normalizeDocuments(docs?: RawDocumentAttachment[]): NormalizedDocument[] {
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((d) => Boolean(d?.url || d?.title))
    .map((d, idx) => {
      const url = (d.url || '').trim();
      const canonical = canonicalizeUrl(url);
      const isValidUrl =
        Boolean(canonical) &&
        !url.toLowerCase().includes('broken-link') &&
        !url.toLowerCase().includes('404') &&
        !url.toLowerCase().startsWith('javascript:');
      return {
        title: cleanWhitespace(d.title || `Attachment ${idx + 1}`, 220),
        url,
        mimeType: d.mimeType || (url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        isValidUrl,
      };
    });
}

function matchCategory(
  rawCategory: string | undefined,
  textForInference: string,
  taxonomy: TaxonomyLookup
): { id: string | null; slug: string | null; matched: boolean } {
  const raw = (rawCategory || '').trim().toLowerCase();
  if (raw) {
    const exact = taxonomy.categories.find(
      (c) =>
        c.slug.toLowerCase() === raw ||
        c.nameEn.toLowerCase() === raw ||
        c.nameAm === rawCategory?.trim() ||
        c.nameEn.toLowerCase().includes(raw) ||
        raw.includes(c.slug.replace(/-/g, ' '))
    );
    if (exact) return { id: exact.id, slug: exact.slug, matched: true };
  }

  const haystack = `${raw} ${textForInference.toLowerCase()}`;
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      const cat = taxonomy.categories.find((c) => c.slug === rule.slug);
      if (cat) return { id: cat.id, slug: cat.slug, matched: Boolean(raw || rule.keywords.length) };
    }
  }

  // Do not silently force an unrecognised category as matched — let quality scorer flag MISSING_CATEGORY
  return { id: null, slug: null, matched: false };
}

function matchRegion(
  rawRegion: string | undefined,
  rawCity: string | undefined,
  textForInference: string,
  taxonomy: TaxonomyLookup
): { id: string | null; code: string | null; city: string | null } {
  const candidates = [rawRegion, rawCity]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  for (const cand of candidates) {
    const lower = cand.toLowerCase();
    const direct = taxonomy.regions.find(
      (r) =>
        r.code.toLowerCase() === lower ||
        r.nameEn.toLowerCase() === lower ||
        r.nameAm === cand
    );
    if (direct) {
      return { id: direct.id, code: direct.code, city: rawCity ? cleanWhitespace(rawCity, 80) : null };
    }
    const mappedCode = CITY_TO_REGION_CODE[lower];
    if (mappedCode) {
      const found = taxonomy.regions.find((r) => r.code === mappedCode);
      if (found) {
        return { id: found.id, code: found.code, city: rawCity ? cleanWhitespace(rawCity, 80) : cand };
      }
    }
  }

  const lowerText = textForInference.toLowerCase();
  for (const [key, code] of Object.entries(CITY_TO_REGION_CODE)) {
    if (key.length >= 4 && lowerText.includes(key)) {
      const found = taxonomy.regions.find((r) => r.code === code);
      if (found) return { id: found.id, code: found.code, city: rawCity ? cleanWhitespace(rawCity, 80) : null };
    }
  }

  const nationwide = taxonomy.regions.find((r) => r.code === 'ET-ALL') || taxonomy.regions[0] || null;
  return {
    id: nationwide?.id ?? null,
    code: nationwide?.code ?? null,
    city: rawCity ? cleanWhitespace(rawCity, 80) : null,
  };
}

export function normalizeIngestionItem(
  item: RawIngestionItem,
  defaults: {
    sourceType: TenderSourceType;
    sourceName: string;
    defaultTimezone?: string;
    isSampleData?: boolean;
  },
  taxonomy: TaxonomyLookup
): NormalizedTenderDraft {
  const timezone = item.timezone?.trim() || defaults.defaultTimezone || 'Africa/Addis_Ababa';

  const extractedHtml = extractPlainText(item.rawHtml);
  const extractedPdf = extractPlainText(item.pdfText);
  const rawDescription = cleanWhitespace(
    item.description || extractedHtml || extractedPdf || item.summary || ''
  );

  const titleEn = cleanWhitespace(item.title, 290);
  const titleAm = item.titleAm ? cleanWhitespace(item.titleAm, 290) : null;
  const summaryEn = cleanWhitespace(
    item.summary || (rawDescription ? rawDescription.slice(0, 260) : titleEn),
    320
  );
  const summaryAm = item.summaryAm ? cleanWhitespace(item.summaryAm, 320) : null;
  const descriptionEn = rawDescription || summaryEn || titleEn;
  const descriptionAm = item.descriptionAm ? cleanWhitespace(item.descriptionAm) : null;
  const eligibilityEn = item.eligibility ? cleanWhitespace(item.eligibility) : null;
  const eligibilityAm = item.eligibilityAm ? cleanWhitespace(item.eligibilityAm) : null;
  const publisherNameDisplay = cleanWhitespace(item.publisherName, 190);

  const combinedText = `${titleEn} ${titleAm || ''} ${summaryEn} ${descriptionEn}`;
  const language = detectLanguage(combinedText, item.language);

  const invalidDateFields: string[] = [];
  const pubParsed = parseDateInEat(item.publicationDate, timezone);
  if (pubParsed.invalid) invalidDateFields.push('publicationDate');

  const closeParsed = parseDateInEat(item.closingDate, timezone);
  if (closeParsed.invalid) invalidDateFields.push('closingDate');

  const openParsed = parseDateInEat(item.openingDate, timezone);
  if (openParsed.invalid) invalidDateFields.push('openingDate');

  const estMoney = parseMoneyToEtb(item.estimatedValue, item.currency);
  const docFeeMoney = parseMoneyToEtb(item.documentFee, item.currency);
  const bidSecMoney = parseMoneyToEtb(item.bidSecurity, item.currency);

  const categoryMatch = matchCategory(item.category, combinedText, taxonomy);
  const regionMatch = matchRegion(item.region, item.city, combinedText, taxonomy);

  const sourceType = item.sourceType || defaults.sourceType;
  const sourceName = cleanWhitespace(item.sourceName || defaults.sourceName, 190);
  const sourceUrl = item.sourceUrl ? item.sourceUrl.trim() : null;
  const canonicalUrl = canonicalizeUrl(sourceUrl);

  const normalizedDocs = normalizeDocuments(item.documents);
  const contactInfo = normalizeContactDetails(
    item.contactInfo,
    item.contactEmail,
    item.contactPhone
  );

  // Stable content hash over normalized core fields (title, publisher, closing date, description)
  const contentHashInput = [
    titleEn.toLowerCase(),
    publisherNameDisplay.toLowerCase(),
    closeParsed.date ? closeParsed.date.toISOString().slice(0, 10) : '',
    descriptionEn.toLowerCase().slice(0, 500),
  ].join('|');
  const contentHash = crypto.createHash('sha256').update(contentHashInput).digest('hex');

  // Dedupe fingerprint matches seed format when referenceNumber exists
  const fingerprintInput = item.referenceNumber
    ? `${publisherNameDisplay.toLowerCase()}|${item.referenceNumber.trim().toLowerCase()}`
    : `${publisherNameDisplay.toLowerCase()}|${titleEn.toLowerCase()}|${closeParsed.date ? closeParsed.date.toISOString().slice(0, 10) : 'nodate'}`;
  const dedupeFingerprint = crypto.createHash('sha256').update(fingerprintInput).digest('hex');

  return {
    externalId: cleanWhitespace(item.externalId, 190),
    referenceNumber: item.referenceNumber ? cleanWhitespace(item.referenceNumber, 110) : null,
    titleEn,
    titleAm,
    summaryEn,
    summaryAm,
    descriptionEn,
    descriptionAm,
    eligibilityEn,
    eligibilityAm,
    publisherNameDisplay,
    categoryId: categoryMatch.id,
    categorySlug: categoryMatch.slug,
    categoryMatched: categoryMatch.matched,
    regionId: regionMatch.id,
    regionCode: regionMatch.code,
    city: regionMatch.city,
    publishedAt: pubParsed.date,
    closingAt: closeParsed.date,
    openingAt: openParsed.date,
    invalidDateFields,
    timezone,
    currency: estMoney.currency,
    estimatedValueEtb: estMoney.amountEtb,
    documentFeeEtb: docFeeMoney.amountEtb,
    bidSecurityEtb: bidSecMoney.amountEtb,
    procurementMethod: normalizeProcurementMethod(item.procurementMethod),
    language,
    contactInfo,
    sourceType,
    sourceName,
    sourceUrl,
    canonicalUrl,
    documents: normalizedDocs,
    contentHash,
    dedupeFingerprint,
    isSampleData: Boolean(item.isSampleData ?? defaults.isSampleData),
    amendmentReasonEn: item.amendmentReasonEn ? cleanWhitespace(item.amendmentReasonEn, 400) : null,
    amendmentReasonAm: item.amendmentReasonAm ? cleanWhitespace(item.amendmentReasonAm, 400) : null,
  };
}
