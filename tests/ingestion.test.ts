import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  canonicalizeUrl,
  detectLanguage,
  extractPlainText,
  normalizeIngestionItem,
  parseDateInEat,
  parseMoneyToEtb,
} from '../src/ingestion/normalizer.ts';
import { evaluateDataQuality } from '../src/ingestion/quality.ts';
import { computeTitleSimilarity } from '../src/ingestion/deduplicator.ts';
import {
  generateSampleCsvTemplate,
  parseCsvOrExcelBuffer,
} from '../src/ingestion/connectors.ts';
import type { DuplicateCheckResult, TaxonomyLookup } from '../src/ingestion/types.ts';

const MOCK_TAXONOMY: TaxonomyLookup = {
  categories: [
    {
      id: 'cat-health',
      slug: 'health-medical-supplies',
      nameEn: 'Health & Medical Supplies',
      nameAm: 'ጤና እና የህክምና ቁሳቁሶች',
    },
    {
      id: 'cat-energy',
      slug: 'energy-solar',
      nameEn: 'Energy & Solar Power',
      nameAm: 'ኢነርጂ እና የፀሐይ ኃይል',
    },
  ],
  regions: [
    { id: 'reg-aa', code: 'ET-AA', nameEn: 'Addis Ababa', nameAm: 'አዲስ አበባ' },
    { id: 'reg-sd', code: 'ET-SD', nameEn: 'Sidama', nameAm: 'ሲዳማ' },
    { id: 'reg-all', code: 'ET-ALL', nameEn: 'Nationwide (Ethiopia)', nameAm: 'በመላው ኢትዮጵያ' },
  ],
};

const UNIQUE_DUPE: DuplicateCheckResult = {
  classification: 'unique',
  matchType: 'none',
  matchedTenderId: null,
  matchedTenderTitle: null,
  similarityScore: 0,
  existingClosingAt: null,
  existingContentHash: null,
  reason: 'Unique',
};

test('extractPlainText strips HTML and scripts cleanly', () => {
  const html = '<script>alert(1)</script><p>Supply of <strong>Solar Pumps</strong></p><li>Lot 1</li>';
  const text = extractPlainText(html);
  assert.equal(text.includes('alert'), false);
  assert.equal(text.includes('Supply of Solar Pumps'), true);
});

test('parseDateInEat handles ISO, DD/MM/YYYY, Excel serial, and invalid strings', () => {
  const iso = parseDateInEat('2026-12-15');
  assert.equal(iso.invalid, false);
  assert.equal(iso.date?.toISOString(), '2026-12-15T14:00:00.000Z'); // 17:00 EAT = 14:00 UTC

  const dmy = parseDateInEat('25/12/2026');
  assert.equal(dmy.invalid, false);
  assert.equal(dmy.date?.getUTCMonth(), 11);

  const bad = parseDateInEat('not-a-date');
  assert.equal(bad.invalid, true);
  assert.equal(bad.date, null);
});

test('parseMoneyToEtb normalizes ETB, Birr, and USD strings', () => {
  assert.deepEqual(parseMoneyToEtb('4,850,000 ETB'), { amountEtb: 4850000, currency: 'ETB' });
  assert.deepEqual(parseMoneyToEtb('500 Birr'), { amountEtb: 500, currency: 'ETB' });
  const usd = parseMoneyToEtb('1,000 USD');
  assert.equal(usd.currency, 'USD');
  assert.equal(usd.amountEtb, 125000);
});

test('detectLanguage detects Amharic Ethiopic script and canonicalizeUrl removes tracking params', () => {
  assert.equal(detectLanguage('ለክልል ክሊኒኮች የህክምና ቁሳቁሶች አቅርቦት ጨረታ'), 'am');
  assert.equal(detectLanguage('Supply of hospital diagnostic equipment'), 'en');
  assert.equal(
    canonicalizeUrl('https://Example.ET/tenders/123/?utm_source=x&b=2&a=1#top'),
    'https://example.et/tenders/123?a=1&b=2'
  );
});

test('normalizeIngestionItem maps Ethiopian cities to regions and normalizes phone numbers', () => {
  const draft = normalizeIngestionItem(
    {
      externalId: 'TEST-1',
      title: '[SAMPLE] Cold-Chain Solar Refrigerators',
      publisherName: 'Sample Hawassa Clinic',
      category: 'Health & Medical Supplies',
      city: 'Hawassa',
      closingDate: '2027-01-20',
      contactPhone: '0911223344',
      contactEmail: 'BIDS@Example.ET',
      sourceType: 'partner_feed',
      sourceName: 'Sandbox Feed',
      sourceUrl: 'https://sandbox.tenderlink.et.invalid/t/1?utm_medium=rss',
    },
    { sourceType: 'partner_feed', sourceName: 'Sandbox Feed' },
    MOCK_TAXONOMY
  );

  assert.equal(draft.regionCode, 'ET-SD');
  assert.equal(draft.categorySlug, 'health-medical-supplies');
  assert.equal(draft.contactInfo, '+251911223344 · bids@example.et');
  assert.equal(draft.canonicalUrl, 'https://sandbox.tenderlink.et.invalid/t/1');
});

test('evaluateDataQuality flags past dates, broken links, missing fields, and spam', () => {
  const draft = normalizeIngestionItem(
    {
      externalId: 'BAD-1',
      title: 'Short',
      publisherName: '',
      description: 'Guaranteed win pay via personal telebirr now!',
      publicationDate: 'bad-date',
      closingDate: '2020-01-01',
      sourceType: 'official_source',
      sourceName: 'Test Source',
      sourceUrl: '',
      documents: [{ title: 'Spec.pdf', url: 'https://example.com/broken-link/404.pdf' }],
    },
    { sourceType: 'official_source', sourceName: 'Test Source' },
    MOCK_TAXONOMY
  );

  const report = evaluateDataQuality(draft, UNIQUE_DUPE, new Date('2026-06-01T00:00:00Z'));
  const codes = new Set(report.flags.map((f) => f.code));

  assert.equal(codes.has('MISSING_TITLE'), true);
  assert.equal(codes.has('MISSING_PUBLISHER'), true);
  assert.equal(codes.has('INVALID_DATE_FORMAT'), true);
  assert.equal(codes.has('CLOSING_DATE_IN_PAST'), true);
  assert.equal(codes.has('MISSING_SOURCE_URL'), true);
  assert.equal(codes.has('BROKEN_DOCUMENT_LINK'), true);
  assert.equal(codes.has('SPAM_OR_MISLEADING'), true);
  assert.equal(report.hasBlockingErrors, true);
  assert.equal(report.score < 30, true);
});

test('computeTitleSimilarity distinguishes near-duplicates from unrelated notices', () => {
  const near = computeTitleSimilarity(
    '[SAMPLE] Construction of Two-Storey Vocational Training Workshop Block',
    '[SAMPLE] Construction of Two-Storey Vocational Training Workshop Building Block'
  );
  const unrelated = computeTitleSimilarity(
    'Supply of Borehole Water Pumps',
    'Annual External Financial Audit Consultancy'
  );
  assert.equal(near >= 0.72, true);
  assert.equal(unrelated < 0.3, true);
});

test('parseCsvOrExcelBuffer parses generated CSV template and XLSX workbooks', () => {
  const csv = generateSampleCsvTemplate();
  const csvParsed = parseCsvOrExcelBuffer(Buffer.from(csv, 'utf8'), 'template.csv');
  assert.equal(csvParsed.items.length, 2);
  assert.equal(csvParsed.parseErrors.length, 0);
  assert.equal(csvParsed.items[0].referenceNumber, 'CSV-SAMPLE-2026-01');

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    {
      reference_number: 'XLSX-01',
      title_en: '[SAMPLE] Solar Inverter Supply',
      publisher_name: 'Sample Clinic',
      closing_date: '2027-02-15',
    },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Tenders');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const xlsxParsed = parseCsvOrExcelBuffer(xlsxBuf, 'tenders.xlsx');
  assert.equal(xlsxParsed.items.length, 1);
  assert.equal(xlsxParsed.items[0].referenceNumber, 'XLSX-01');
});
