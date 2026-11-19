import * as XLSX from 'xlsx';
import type { RawIngestionItem, SourceConnectorDefinition } from './types.ts';
import {
  escapeCsvCellSafe,
  sanitizeSpreadsheetCell,
  validateUploadedSpreadsheet,
} from '../security/guard.ts';

/**
 * Generates future/past dates relative to today in EAT (+03:00) so the
 * sandbox test connector always exercises fresh deadline, amendment, and
 * past-closing-date quality scenarios without touching any external site.
 */
function isoDateDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * ONE sandboxed test connector (local fixtures only — ZERO external scraping).
 * Exercises 5 distinct pipeline paths in a single run:
 *  1. Clean bilingual new tender -> normalized, high quality score, queued for moderation.
 *  2. Versioned amendment matching seeded SAMPLE-2026-002 -> extends closing date via tender_amendments.
 *  3. Exact duplicate matching seeded SAMPLE-2026-001 -> skipped & counted in recordsDuped.
 *  4. Uncertain near-duplicate matching seeded SAMPLE-2026-004 -> routed to manual duplicate review queue.
 *  5. Low-quality record (past closing date, broken PDF link, missing category, unparseable date) -> flagged in quality dashboard & held for moderation.
 */
export const testPartnerJsonConnector: SourceConnectorDefinition = {
  sourceKey: 'test_partner_json_feed',
  name: '[SANDBOX] Test Partner JSON Connector (Local Fixtures Only)',
  connectorType: 'json_api',
  tenderSourceType: 'partner_feed',
  sourceUrl: 'sandbox://tenderlink.et.invalid/partner-feed/v1/tenders.json',
  frequencyMinutes: 60,
  authMethod: 'none',
  rateLimitPerMinute: 10,
  parserConfig: {
    mode: 'local_sandbox_fixture',
    externalNetworkDisabled: true,
    defaultTimezone: 'Africa/Addis_Ababa',
  },
  async fetchItems(): Promise<RawIngestionItem[]> {
    return [
      {
        externalId: 'SANDBOX-JSON-2026-101',
        referenceNumber: 'SBX-ET-2026-101',
        title: '[SAMPLE] Cold-Chain Solar Vaccine Refrigerators for Regional Clinics',
        titleAm: '[ናሙና] ለክልል ክሊኒኮች በፀሐይ ኃይል የሚሰሩ የክትባት ማቀዝቀዣዎች አቅርቦት',
        rawHtml:
          '<p>Supply, delivery, and commissioning of <strong>24 WHO-prequalified solar direct-drive vaccine refrigerators</strong> across Sidama and Oromia woreda clinics.</p><ul><li>Includes 3-year spare parts kit</li><li>Technician training in Hawassa</li></ul>',
        eligibility: 'Renewed Ethiopian medical equipment import license, TIN, VAT registration.',
        publisherName: 'Sample Abbay Rural Health Consortium',
        category: 'Health & Medical Supplies',
        region: 'Sidama',
        city: 'Hawassa',
        publicationDate: isoDateDaysFromNow(-1),
        closingDate: isoDateDaysFromNow(18),
        timezone: 'Africa/Addis_Ababa',
        currency: 'ETB',
        estimatedValue: '4,850,000 ETB',
        documentFee: 400,
        bidSecurity: 100000,
        procurementMethod: 'Open National Competitive Bidding (NCB)',
        language: 'en',
        contactEmail: 'procurement@sample-abbay-health.et.invalid',
        contactPhone: '0911223344',
        sourceType: 'partner_feed',
        sourceName: '[SANDBOX] Test Partner JSON Feed',
        sourceUrl: 'https://sandbox.tenderlink.et.invalid/notices/sbx-2026-101?utm_source=feed',
        documents: [
          {
            title: 'SBX-101_Technical_Specifications.pdf',
            url: 'https://sandbox.tenderlink.et.invalid/docs/sbx-101-specs.pdf',
            mimeType: 'application/pdf',
          },
        ],
        isSampleData: true,
      },
      {
        externalId: 'SANDBOX-JSON-2026-102-AMD',
        referenceNumber: 'SAMPLE-2026-002',
        title: '[SAMPLE] Enterprise Network Firewall and Fiber Backbone Upgrade',
        titleAm: '[ናሙና] የድርጅት ኔትወርክ ፋየርዎል እና ፋይበር መስመር ማሻሻያ',
        summary:
          'Addendum #1: Bid submission deadline extended by 7 calendar days and pre-bid site visit clarified.',
        description:
          'Sample tender for supply, configuration, and 24-month maintenance of redundant campus network infrastructure. Addendum #1 extends closing deadline by 7 days to accommodate regional bidders.',
        publisherName: 'Sample Entoto Polytech Institute',
        category: 'IT & Telecommunications',
        region: 'Addis Ababa',
        city: 'Addis Ababa',
        publicationDate: isoDateDaysFromNow(-3),
        closingDate: isoDateDaysFromNow(16),
        timezone: 'Africa/Addis_Ababa',
        currency: 'ETB',
        documentFee: 300,
        bidSecurity: 75000,
        procurementMethod: 'open_national',
        sourceType: 'partner_feed',
        sourceName: '[SANDBOX] Test Partner JSON Feed',
        sourceUrl: 'https://sandbox.tenderlink.et.invalid/notices/sample-2026-002-addendum',
        amendmentReasonEn:
          'Addendum #1: Closing date extended by 7 days following vendor clarification requests.',
        amendmentReasonAm:
          'ማሻሻያ #1፡ ከተጫራቾች በቀረበ የማብራሪያ ጥያቄ መሰረት የጨረታ መዝጊያ ቀን በ7 ቀናት ተራዝሟል።',
        isSampleData: true,
      },
      {
        externalId: 'SANDBOX-JSON-2026-103-DUP',
        referenceNumber: 'SAMPLE-2026-001',
        title: '[SAMPLE] Supply and Installation of Solar-Powered Borehole Water Pumps',
        summary:
          'Sample procurement notice for 12 community solar borehole pumping systems across rural woredas.',
        publisherName: 'Sample Highland Water Utility',
        category: 'Water & Sanitation',
        region: 'Oromia',
        closingDate: isoDateDaysFromNow(14),
        sourceType: 'partner_feed',
        sourceName: '[SANDBOX] Test Partner JSON Feed',
        sourceUrl: 'https://sandbox.tenderlink.et.invalid/notices/sample-2026-001',
        isSampleData: true,
      },
      {
        externalId: 'SANDBOX-JSON-2026-104-NEAR',
        referenceNumber: 'SBX-NEAR-2026-104',
        title: '[SAMPLE] Construction of Two-Storey Vocational Training Workshop Building Block',
        summary:
          'Near-duplicate test record with slightly reworded title for manual duplicate verification.',
        publisherName: 'Sample Tana Technical College (Regional Branch)',
        category: 'Construction & Civil Works',
        region: 'Bahir Dar',
        city: 'Bahir Dar',
        closingDate: isoDateDaysFromNow(21),
        currency: 'ETB',
        documentFee: 1000,
        bidSecurity: 200000,
        procurementMethod: 'open_national',
        sourceType: 'partner_feed',
        sourceName: '[SANDBOX] Test Partner JSON Feed',
        sourceUrl: 'https://sandbox.tenderlink.et.invalid/notices/sbx-2026-104-near',
        isSampleData: true,
      },
      {
        externalId: 'SANDBOX-JSON-2026-105-QUAL',
        referenceNumber: 'SBX-QUAL-2026-105',
        title: '[SAMPLE] Miscellaneous Uncategorised Supplies Notice (Quality Test)',
        summary: 'Sample record intentionally missing category, with past closing date and broken PDF link.',
        publisherName: 'Sample Awassa Community Cooperative',
        category: '',
        region: 'ET-SD',
        publicationDate: 'not-a-valid-date',
        closingDate: isoDateDaysFromNow(-4),
        sourceType: 'partner_feed',
        sourceName: '[SANDBOX] Test Partner JSON Feed',
        sourceUrl: '',
        documents: [
          {
            title: 'Broken_Spec_File.pdf',
            url: 'https://sandbox.tenderlink.et.invalid/broken-link/404.pdf',
            mimeType: 'application/pdf',
          },
        ],
        isSampleData: true,
      },
    ];
  },
};

const CONNECTOR_REGISTRY: Record<string, SourceConnectorDefinition> = {
  test_partner_json_feed: testPartnerJsonConnector,
};

export function getRegisteredConnector(sourceKey: string): SourceConnectorDefinition | null {
  return CONNECTOR_REGISTRY[sourceKey] ?? null;
}

export function listRegisteredConnectorKeys(): string[] {
  return Object.keys(CONNECTOR_REGISTRY);
}

/**
 * Normalizes column headers from CSV/Excel sheets so operators can upload
 * flexible spreadsheets (e.g. "Closing Date", "closing_date", "Deadline").
 */
function pickCell(row: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (aliases.includes(norm)) {
      const val = row[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const sanitized = sanitizeSpreadsheetCell(String(val));
        if (sanitized) return sanitized;
      }
    }
  }
  return undefined;
}

export function parseCsvOrExcelBuffer(
  buffer: Buffer,
  fileName: string
): { items: RawIngestionItem[]; parseErrors: string[] } {
  validateUploadedSpreadsheet(buffer, fileName);

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellFormula: false,
    cellHTML: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { items: [], parseErrors: ['Uploaded workbook contains no sheets.'] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    blankrows: false,
  });

  if (rows.length > 250) {
    throw new Error('Maximum 250 rows per upload batch. Split larger files into smaller batches.');
  }

  const items: RawIngestionItem[] = [];
  const parseErrors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-indexed header + row
    const title = pickCell(row, ['title', 'titleen', 'tendertitle', 'subject', 'name']);
    const publisherName = pickCell(row, ['publisher', 'publishername', 'organisation', 'organization', 'entity', 'buyer']);
    const referenceNumber = pickCell(row, ['reference', 'referencenumber', 'ref', 'tenderno', 'bidno']);
    const externalId =
      pickCell(row, ['externalid', 'sourceid', 'id']) ||
      referenceNumber ||
      `IMPORT-${Date.now()}-${rowNumber}`;

    if (!title && !publisherName) {
      parseErrors.push(`Row ${rowNumber}: Skipped empty row (missing both title and publisher).`);
      return;
    }

    const docUrl = pickCell(row, ['documenturl', 'docurl', 'attachmenturl', 'pdfurl']);
    const docTitle = pickCell(row, ['documenttitle', 'doctitle', 'attachmenttitle']);
    const rawSourceType = pickCell(row, ['sourcetype', 'provenance'])?.toLowerCase();
    const validSourceTypes = [
      'official_source',
      'publisher_submitted',
      'partner_feed',
      'user_reported',
    ] as const;
    const sourceType = validSourceTypes.find((t) => t === rawSourceType);

    items.push({
      externalId,
      referenceNumber,
      title,
      titleAm: pickCell(row, ['titleam', 'amharictitle']),
      summary: pickCell(row, ['summary', 'summaryen', 'shortdescription']),
      summaryAm: pickCell(row, ['summaryam']),
      description: pickCell(row, ['description', 'descriptionen', 'details', 'scope']),
      descriptionAm: pickCell(row, ['descriptionam']),
      eligibility: pickCell(row, ['eligibility', 'eligibilityen', 'requirements']),
      publisherName,
      category: pickCell(row, ['category', 'sector', 'categoryslug']),
      region: pickCell(row, ['region', 'regioncode', 'state']),
      city: pickCell(row, ['city', 'town', 'location']),
      publicationDate: pickCell(row, ['publicationdate', 'publishedat', 'publisheddate', 'issuedate']),
      closingDate: pickCell(row, ['closingdate', 'closingat', 'deadline', 'bidclosingdate']),
      openingDate: pickCell(row, ['openingdate', 'openingat', 'bidopeningdate']),
      timezone: pickCell(row, ['timezone', 'tz']) || 'Africa/Addis_Ababa',
      currency: pickCell(row, ['currency']) || 'ETB',
      estimatedValue: pickCell(row, ['estimatedvalue', 'budget', 'valueetb']),
      documentFee: pickCell(row, ['documentfee', 'documentfeeetb', 'bidfee']),
      bidSecurity: pickCell(row, ['bidsecurity', 'bidsecurityetb', 'bidbond']),
      procurementMethod: pickCell(row, ['procurementmethod', 'method', 'bidtype']),
      language: pickCell(row, ['language', 'lang']),
      contactInfo: pickCell(row, ['contactinfo', 'contact']),
      contactEmail: pickCell(row, ['contactemail', 'email']),
      contactPhone: pickCell(row, ['contactphone', 'phone', 'telephone']),
      sourceType,
      sourceName: pickCell(row, ['sourcename', 'source']) || `CSV/Excel Import (${fileName})`,
      sourceUrl: pickCell(row, ['sourceurl', 'url', 'link']),
      documents: docUrl ? [{ title: docTitle || 'Bidding_Document.pdf', url: docUrl }] : [],
      amendmentReasonEn: pickCell(row, ['amendmentreason', 'amendmentreasonen']),
      isSampleData:
        pickCell(row, ['issample', 'issampledata'])?.toLowerCase() === 'true' ||
        Boolean(title?.startsWith('[SAMPLE]')),
      rawRowNumber: rowNumber,
    });
  });

  return { items, parseErrors };
}

export function generateSampleCsvTemplate(): string {
  const closeSoon = isoDateDaysFromNow(20);
  const closeLater = isoDateDaysFromNow(28);
  const pubToday = isoDateDaysFromNow(0);

  const headers = [
    'reference_number',
    'title_en',
    'title_am',
    'publisher_name',
    'category',
    'region',
    'city',
    'publication_date',
    'closing_date',
    'procurement_method',
    'currency',
    'document_fee_etb',
    'bid_security_etb',
    'source_type',
    'source_name',
    'source_url',
    'contact_email',
    'contact_phone',
    'summary_en',
    'document_url',
    'is_sample',
  ];

  const sampleRows = [
    [
      'CSV-SAMPLE-2026-01',
      '[SAMPLE] Supply of 40kVA Backup Diesel Generators for Regional Branches',
      '[ናሙና] ለክልል ቅርንጫፎች የ40kVA ጄኔሬተር አቅርቦት',
      'Sample Blue Nile Microfinance Institution',
      'energy-solar',
      'Amhara',
      'Bahir Dar',
      pubToday,
      closeSoon,
      'open_national',
      'ETB',
      '500',
      '75000',
      'publisher_submitted',
      'Admin Bulk CSV Upload',
      'https://sandbox.tenderlink.et.invalid/csv-sample-01',
      'bids@sample-bluenile.et.invalid',
      '+251911000111',
      'Sample supply and installation of 4 backup generators with automatic transfer switches.',
      'https://sandbox.tenderlink.et.invalid/docs/csv-sample-01.pdf',
      'true',
    ],
    [
      'CSV-SAMPLE-2026-02',
      '[SAMPLE] Feasibility Study for Rural Cold Storage Warehouse',
      '[ናሙና] የገጠር ቀዝቃዛ መጋዘን አዋጭነት ጥናት የምክር አገልግሎት',
      'Sample Oromia Agribusiness Cooperative',
      'consultancy-advisory',
      'Oromia',
      'Adama',
      pubToday,
      closeLater,
      'request_for_proposal',
      'ETB',
      '0',
      '30000',
      'partner_feed',
      'Admin Bulk CSV Upload',
      'https://sandbox.tenderlink.et.invalid/csv-sample-02',
      'tenders@sample-oromia-coop.et.invalid',
      '+251922000222',
      'Sample RFP for experienced agricultural logistics consultancy firms.',
      'https://sandbox.tenderlink.et.invalid/docs/csv-sample-02.pdf',
      'true',
    ],
  ];

  return [
    headers.join(','),
    ...sampleRows.map((r) => r.map(escapeCsvCellSafe).join(',')),
  ].join('\n');
}
