import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

// ============================================================================
// 1. SSRF & EXTERNAL URL PROTECTION
// ============================================================================

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

function isPrivateOrLoopbackIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 169 && b === 254) return true; // Cloud metadata / link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16.0.0/12
  if (a === 192 && b === 168) return true; // RFC1918 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT 100.64.0.0/10
  if (a >= 224) return true; // Multicast / reserved
  return false;
}

function isPrivateOrLoopbackIpv6(hostname: string): boolean {
  const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (clean === '::1' || clean === '::') return true;
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true; // Unique local fc00::/7
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
    return true; // Link-local fe80::/10
  }
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (isPrivateOrLoopbackIpv4(mapped)) return true;
  }
  return false;
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  normalizedUrl?: string;
}

/**
 * Validates that an external URL is safe from SSRF and XSS schemes:
 * - Only http:// or https://
 * - Blocks localhost, loopback, RFC1918 private networks, link-local, and cloud metadata IPs
 * - Blocks embedded credentials (user:pass@host)
 */
export function checkSafeExternalUrl(rawUrl: string): UrlSafetyResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { safe: false, reason: 'URL is empty.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Malformed URL format.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      safe: false,
      reason: `Disallowed URL protocol "${parsed.protocol}". Only http/https are permitted.`,
    };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URLs with embedded credentials are not allowed.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    return { safe: false, reason: `Internal or loopback host "${host}" is blocked.` };
  }

  if (isPrivateOrLoopbackIpv4(host) || isPrivateOrLoopbackIpv6(host)) {
    return { safe: false, reason: `Private or link-local IP "${host}" is blocked (SSRF protection).` };
  }

  return { safe: true, normalizedUrl: parsed.toString() };
}

export function assertSafeExternalUrl(rawUrl: string): string {
  const result = checkSafeExternalUrl(rawUrl);
  if (!result.safe || !result.normalizedUrl) {
    const err = new Error(result.reason || 'Unsafe external URL rejected.') as Error & {
      statusCode?: number;
      code?: string;
    };
    err.statusCode = 400;
    err.code = 'UNSAFE_URL';
    throw err;
  }
  return result.normalizedUrl;
}

// ============================================================================
// 2. FILE UPLOAD MAGIC-BYTE VALIDATION & CSV FORMULA-INJECTION PROTECTION
// ============================================================================

export const MAX_SPREADSHEET_BYTES = 3 * 1024 * 1024; // 3 MB strict cap

export function validateUploadedSpreadsheet(
  buffer: Buffer,
  fileName: string
): { extension: '.csv' | '.xlsx' | '.xls'; sha256: string } {
  const safeName = fileName.trim().replace(/[\r\n\0]/g, '');
  if (!safeName || safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
    throw new Error('Invalid file name. Path traversal characters are not allowed.');
  }

  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  if (buffer.length > MAX_SPREADSHEET_BYTES) {
    throw new Error(
      `File exceeds maximum allowed size of ${Math.round(MAX_SPREADSHEET_BYTES / (1024 * 1024))} MB.`
    );
  }

  const lower = safeName.toLowerCase();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  if (lower.endsWith('.xlsx')) {
    // ZIP container magic bytes: 50 4B 03 04 (or empty archive 50 4B 05 06)
    const isZip =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05);
    if (!isZip) {
      throw new Error('Invalid .xlsx file signature. File content does not match OpenXML ZIP format.');
    }
    return { extension: '.xlsx', sha256 };
  }

  if (lower.endsWith('.xls')) {
    // OLE2 Compound Document magic bytes: D0 CF 11 E0
    const isOle2 =
      buffer.length >= 4 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0;
    if (!isOle2) {
      throw new Error('Invalid .xls file signature. File content does not match legacy Excel format.');
    }
    return { extension: '.xls', sha256 };
  }

  if (lower.endsWith('.csv')) {
    // Reject binary executables disguised as CSV (NUL bytes or MZ/ELF/PDF headers)
    if (buffer.includes(0x00)) {
      throw new Error('Invalid .csv file: binary NUL bytes detected.');
    }
    const head = buffer.subarray(0, 4).toString('latin1');
    if (head.startsWith('%PDF') || head.startsWith('MZ') || head.startsWith('\x7fELF')) {
      throw new Error('Invalid .csv file: executable or PDF header detected.');
    }
    return { extension: '.csv', sha256 };
  }

  throw new Error('Unsupported file type. Upload a .csv, .xlsx, or .xls file.');
}

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) on import/export
 * while preserving legitimate Ethiopian phone numbers like +251911234567 and pure numbers.
 */
export function sanitizeSpreadsheetCell(raw: string): string {
  const cleaned = raw.replace(/\0/g, '').trim();
  if (!cleaned) return '';

  // Allow valid Ethiopian / international E.164 phone numbers starting with '+'
  if (/^\+\d{7,15}$/.test(cleaned)) {
    return cleaned;
  }

  // Neutralize leading spreadsheet formula triggers
  if (/^[=+\-@\t\r]/.test(cleaned)) {
    return cleaned.replace(/^[=+\-@\t\r]+/, '').trim();
  }

  return cleaned;
}

export function escapeCsvCellSafe(raw: string): string {
  const str = String(raw ?? '').replace(/\0/g, '');
  // Prefix formula triggers with a single quote when exporting CSV unless pure E.164 phone
  const formulaSafe =
    /^[=+\-@\t\r]/.test(str) && !/^\+\d{7,15}$/.test(str) ? `'${str}` : str;
  return /[",\n\r]/.test(formulaSafe)
    ? `"${formulaSafe.replace(/"/g, '""')}"`
    : formulaSafe;
}

// ============================================================================
// 3. HTTP SECURITY HEADERS & CSRF ORIGIN PROTECTION
// ============================================================================

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // CSP tailored for React/Vite + Google Fonts + AI Studio preview iframe compatibility
  const isProd = process.env.NODE_ENV === 'production';
  const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.chapa.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.chapa.co",
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  if (isProd || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Browser CSRF defense-in-depth on state-changing API requests.
 * If a browser sends an `Origin` header, verifies it matches the server Host,
 * APP_URL, or explicitly configured ALLOWED_ORIGINS.
 */
export function verifyOriginCsrf(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Chapa server-to-server webhooks authenticate via HMAC signature, not browser Origin
  if (req.path.startsWith('/v1/webhooks/')) {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin) {
    // Non-browser API clients (Android Retrofit, curl, server jobs) do not send Origin
    return next();
  }

  const allowedHosts = new Set<string>();
  const reqHost = req.get('host');
  if (reqHost) allowedHosts.add(reqHost.toLowerCase());

  if (process.env.APP_URL) {
    try {
      allowedHosts.add(new URL(process.env.APP_URL).host.toLowerCase());
    } catch {
      // ignore invalid APP_URL
    }
  }

  if (process.env.ALLOWED_ORIGINS) {
    for (const item of process.env.ALLOWED_ORIGINS.split(',')) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      try {
        allowedHosts.add(new URL(trimmed).host.toLowerCase());
      } catch {
        allowedHosts.add(trimmed.toLowerCase());
      }
    }
  }

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const isLocalLoopback =
      originHost.startsWith('localhost:') || originHost.startsWith('127.0.0.1:');
    if (allowedHosts.has(originHost) || (process.env.NODE_ENV !== 'production' && isLocalLoopback)) {
      return next();
    }
  } catch {
    // fall through to 403
  }

  return res.status(403).json({
    error: {
      code: 'CSRF_ORIGIN_MISMATCH',
      message: 'Cross-origin state-changing request rejected.',
    },
  });
}

// ============================================================================
// 4. BOUNDED SLIDING-WINDOW RATE LIMITER
// ============================================================================

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
  keySelector?: (req: Request) => string;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Prevent unbounded memory growth under distributed traffic
    if (buckets.size > 5000) {
      for (const [k, v] of buckets.entries()) {
        if (now > v.resetAt) buckets.delete(k);
      }
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const extraKey = options.keySelector ? options.keySelector(req) : '';
    const key = `${options.keyPrefix}:${ip}:${extraKey}`;
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - 1)));
      return next();
    }

    if (bucket.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment before trying again.',
        },
      });
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - bucket.count)));
    next();
  };
}

// ============================================================================
// 5. RFC 6238 TOTP MFA FOR ADMIN ACCOUNTS (ZERO-DEPENDENCY NODE CRYPTO)
// ============================================================================

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpCode(
  secret: string,
  timestampMs: number = Date.now(),
  stepSeconds = 30
): string {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const key = decodeBase32(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timestampMs: number = Date.now(),
  windowSteps = 1
): boolean {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) return false;

  const providedBuf = Buffer.from(normalized, 'utf8');
  for (let delta = -windowSteps; delta <= windowSteps; delta += 1) {
    const expected = generateTotpCode(secret, timestampMs + delta * 30_000);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      providedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return true;
    }
  }
  return false;
}

export function buildTotpOtpAuthUri(accountLabel: string, secret: string): string {
  const issuer = encodeURIComponent('TenderLink Ethiopia');
  const label = encodeURIComponent(`TenderLink Ethiopia:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// ============================================================================
// 6. FAKE-LISTING, IMPERSONATION & MISLEADING-CLAIM DETECTOR
// ============================================================================

export type IntegrityFindingCode =
  | 'SUSPECTED_SCAM_OR_ADVANCE_FEE'
  | 'MISLEADING_GOVERNMENT_CLAIM'
  | 'UNVERIFIED_MINISTRY_FREE_EMAIL'
  | 'UNSAFE_SOURCE_URL';

export interface IntegrityFinding {
  code: IntegrityFindingCode;
  severity: 'error' | 'warning';
  message: string;
}

const ADVANCE_FEE_SCAM_PATTERNS: RegExp[] = [
  /\b(send\s+fee\s+to\s+personal\s+(telebirr|cbe|account)|pay\s+personal\s+telebirr|wire\s+processing\s+fee\s+to\s+agent)\b/i,
  /\b(guaranteed\s+(award|contract|win)|100%\s+guaranteed\s+bid|no\s+competition\s+secret\s+tender)\b/i,
  /\b(send\s+bribe|kickback|commission\s+before\s+award)\b/i,
];

const OFFICIAL_IMPERSONATION_PATTERNS: RegExp[] = [
  /\b(official\s+ethiopian\s+government\s+portal|authorized\s+by\s+ppa\s+ethiopia|exclusive\s+government\s+tender\s+portal)\b/i,
];

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'ymail.com',
  'proton.me',
]);

export function detectFakeOrMisleadingListing(input: {
  title: string;
  summary?: string;
  description?: string;
  publisherName?: string;
  sourceType?: string;
  contactEmail?: string;
  sourceUrl?: string;
}): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const combined = `${input.title} ${input.summary ?? ''} ${input.description ?? ''}`;

  if (ADVANCE_FEE_SCAM_PATTERNS.some((p) => p.test(combined))) {
    findings.push({
      code: 'SUSPECTED_SCAM_OR_ADVANCE_FEE',
      severity: 'error',
      message:
        'Listing text contains high-risk advance-fee, personal payment, or guaranteed-award scam phrasing.',
    });
  }

  if (OFFICIAL_IMPERSONATION_PATTERNS.some((p) => p.test(combined))) {
    findings.push({
      code: 'MISLEADING_GOVERNMENT_CLAIM',
      severity: 'error',
      message:
        'Listing claims official Ethiopian government portal affiliation, which violates TenderLink independence policy.',
    });
  }

  // Flag ministry/federal agency claims paired with free personal webmail
  const pubLower = (input.publisherName ?? '').toLowerCase();
  const claimsMinistry =
    /\b(ministry\s+of|federal\s+democratic|ethiopian\s+public\s+procurement|national\s+bank\s+of\s+ethiopia)\b/i.test(
      pubLower
    );
  if (claimsMinistry && input.contactEmail && input.contactEmail.includes('@')) {
    const domain = input.contactEmail.split('@')[1]?.toLowerCase().trim();
    if (domain && FREE_EMAIL_DOMAINS.has(domain)) {
      findings.push({
        code: 'UNVERIFIED_MINISTRY_FREE_EMAIL',
        severity: 'warning',
        message:
          'Publisher claims a federal/ministry identity while using a free personal webmail address; verify official source.',
      });
    }
  }

  // SSRF / unsafe URL check on sourceUrl
  if (input.sourceUrl && input.sourceUrl.trim()) {
    const safety = checkSafeExternalUrl(input.sourceUrl);
    if (!safety.safe) {
      findings.push({
        code: 'UNSAFE_SOURCE_URL',
        severity: 'error',
        message: safety.reason || 'Source URL failed safety validation.',
      });
    }
  }

  return findings;
}

// ============================================================================
// 7. PII MASKING HELPERS
// ============================================================================

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskTin(tin: string | null | undefined): string | null {
  if (!tin) return null;
  if (tin.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, tin.length - 4))}${tin.slice(-4)}`;
}
