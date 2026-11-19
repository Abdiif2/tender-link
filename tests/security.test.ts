import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSafeExternalUrl,
  checkSafeExternalUrl,
  detectFakeOrMisleadingListing,
  escapeCsvCellSafe,
  generateTotpCode,
  generateTotpSecret,
  maskEmail,
  maskTin,
  MAX_SPREADSHEET_BYTES,
  sanitizeSpreadsheetCell,
  validateUploadedSpreadsheet,
  verifyTotpCode,
} from '../src/security/guard.ts';

test('SSRF protection blocks loopback, RFC1918 private IPs, cloud metadata, and XSS schemes', () => {
  const blockedUrls = [
    'http://127.0.0.1:3000/admin',
    'http://localhost/api/v1/health',
    'http://169.254.169.254/computeMetadata/v1/',
    'http://10.0.0.5/internal',
    'http://172.16.4.12/db',
    'http://192.168.1.1/router',
    'http://[::1]:3000/',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://user:pass@example.com/secret',
    'http://metadata.google.internal/computeMetadata/v1/',
  ];

  for (const url of blockedUrls) {
    const res = checkSafeExternalUrl(url);
    assert.equal(res.safe, false, `Expected URL to be blocked: ${url}`);
    assert.throws(() => assertSafeExternalUrl(url));
  }

  const safeUrl = assertSafeExternalUrl('https://etenders.example.org/notices/2026-01');
  assert.equal(safeUrl, 'https://etenders.example.org/notices/2026-01');
});

test('Spreadsheet upload validation checks magic bytes, file size, and path traversal', () => {
  // Reject path traversal
  assert.throws(
    () => validateUploadedSpreadsheet(Buffer.from('title,publisher\nA,B'), '../evil.csv'),
    /Path traversal/i
  );

  // Reject disguised plain-text file claiming .xlsx
  assert.throws(
    () => validateUploadedSpreadsheet(Buffer.from('not a zip file'), 'fake.xlsx'),
    /Invalid .xlsx file signature/i
  );

  // Reject PDF disguised as .csv
  assert.throws(
    () => validateUploadedSpreadsheet(Buffer.from('%PDF-1.7\nmalicious'), 'report.csv'),
    /executable or PDF header/i
  );

  // Reject oversized buffer (> 3 MB)
  const oversized = Buffer.alloc(MAX_SPREADSHEET_BYTES + 1, 0x41);
  assert.throws(
    () => validateUploadedSpreadsheet(oversized, 'huge.csv'),
    /exceeds maximum allowed size/i
  );

  // Accept valid CSV
  const csvOk = validateUploadedSpreadsheet(
    Buffer.from('title,publisher\nSolar Pump,Abbay Water'),
    'tenders.csv'
  );
  assert.equal(csvOk.extension, '.csv');
  assert.equal(csvOk.sha256.length, 64);

  // Accept valid ZIP PK header for .xlsx
  const validZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const xlsxOk = validateUploadedSpreadsheet(validZip, 'tenders.xlsx');
  assert.equal(xlsxOk.extension, '.xlsx');
});

test('CSV formula-injection sanitization neutralizes formulas while keeping +251 phone numbers', () => {
  assert.equal(sanitizeSpreadsheetCell('=CMD|\' /C calc\'!A0'), 'CMD|\' /C calc\'!A0');
  assert.equal(sanitizeSpreadsheetCell('@SUM(1+1)*cmd'), 'SUM(1+1)*cmd');
  assert.equal(sanitizeSpreadsheetCell('+251911234567'), '+251911234567');

  assert.equal(escapeCsvCellSafe('=HYPERLINK("http://evil.test")'), '\'=HYPERLINK(""http://evil.test"")'.startsWith('"\'') ? escapeCsvCellSafe('=HYPERLINK("http://evil.test")') : '"\'=HYPERLINK(""http://evil.test"")"');
  assert.equal(escapeCsvCellSafe('+251911234567'), '+251911234567');
});

test('RFC 6238 TOTP MFA generates and verifies 6-digit codes within drift window', () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 32);

  const now = 1_760_000_000_000;
  const currentCode = generateTotpCode(secret, now);
  assert.match(currentCode, /^\d{6}$/);

  assert.equal(verifyTotpCode(secret, currentCode, now), true);
  // Previous 30s window still accepted within +/-1 step tolerance
  assert.equal(verifyTotpCode(secret, currentCode, now + 29_000), true);
  // Wrong code rejected
  assert.equal(verifyTotpCode(secret, '000000', now), currentCode === '000000');
  assert.equal(verifyTotpCode(secret, 'abc123', now), false);
});

test('Fake-listing & misleading-claim detector flags scams, government impersonation, and free-email ministry spoofing', () => {
  const scamFindings = detectFakeOrMisleadingListing({
    title: 'Urgent Official Ethiopian Government Portal Tender',
    description: 'Send fee to personal Telebirr for guaranteed award of contract.',
    publisherName: 'Ministry of Finance',
    contactEmail: 'ministry.bids2026@gmail.com',
    sourceUrl: 'http://127.0.0.1/internal',
  });

  const codes = scamFindings.map((f) => f.code);
  assert.ok(codes.includes('SUSPECTED_SCAM_OR_ADVANCE_FEE'));
  assert.ok(codes.includes('MISLEADING_GOVERNMENT_CLAIM'));
  assert.ok(codes.includes('UNVERIFIED_MINISTRY_FREE_EMAIL'));
  assert.ok(codes.includes('UNSAFE_SOURCE_URL'));

  const cleanFindings = detectFakeOrMisleadingListing({
    title: 'Supply of Medical Autoclaves for Regional Hospital',
    description: 'Open national competitive bidding with sealed technical and financial proposals.',
    publisherName: 'Sample Hawassa Referral Hospital',
    contactEmail: 'procurement@hawassahospital.edu.et',
    sourceUrl: 'https://notices.example.et/tenders/2026-44',
  });
  assert.equal(cleanFindings.length, 0);
});

test('PII masking redacts customer emails and Ethiopian TIN numbers safely', () => {
  assert.equal(maskEmail('supplier@abyssinia.et'), 'su***@abyssinia.et');
  assert.equal(maskTin('0045129876'), '******9876');
  assert.equal(maskEmail(null), null);
});
