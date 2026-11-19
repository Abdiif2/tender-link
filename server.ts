import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  getPlatformHealth,
  getPreviewTenders,
  getTaxonomyMetadata,
} from './src/db/queries.ts';
import {
  getUserProfileById,
  loginWithPassword,
  recordAuditEvent,
  refreshSessionToken,
  registerUserWithOtp,
  revokeSession,
  setupUserTotpMfa,
  updateUserLanguage,
  verifyOtpAndCreateSession,
  verifyUserTotpMfa,
} from './src/db/auth.ts';
import {
  AuthRequest,
  hasAnyRole,
  optionalAuth,
  requireAdminMfa,
  requireAuth,
  requireRole,
} from './src/middleware/auth.ts';
import {
  assertSafeExternalUrl,
  createRateLimiter,
  securityHeadersMiddleware,
  verifyOriginCsrf,
} from './src/security/guard.ts';
import {
  createDataSubjectRequest,
  deleteAndAnonymiseAccount,
  exportUserData,
  getConsentPreferences,
  getPrivacyGovernanceOverview,
  logSecurityIncident,
  resolveDataSubjectRequest,
  runDataRetentionSweep,
  saveConsentPreferences,
} from './src/privacy/service.ts';
import {
  getPlatformIntegrityOverview,
  resolveAbuseReport,
  submitAbuseReport,
  submitPublisherVerification,
  reviewPublisherVerification,
} from './src/integrity/service.ts';
import {
  createManualAdminTender,
  getAdminIngestionOverview,
  resolveModerationCase,
  runBulkSpreadsheetImport,
  runRegisteredConnectorByKey,
} from './src/ingestion/pipeline.ts';
import { generateSampleCsvTemplate } from './src/ingestion/connectors.ts';
import { createVersionedAmendment } from './src/ingestion/amendments.ts';
import { parseDateInEat } from './src/ingestion/normalizer.ts';
import {
  getBillingCatalog,
  getBillingHistory,
  getPaymentStatusByTxRef,
  initiateChapaCheckout,
  verifyCheckoutPaymentOnServer,
} from './src/billing/service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function apiRateLimiter(maxRequests = 120, windowMs = 60_000, keyPrefix = 'api') {
  return createRateLimiter({ maxRequests, windowMs, keyPrefix });
}

/**
 * RBAC guard for admin routes:
 * - In production (or when ENFORCE_ADMIN_AUTH_IN_DEV=true): requires authenticated
 *   moderator/super_admin + verified TOTP MFA.
 * - In non-production preview: if a Bearer token is supplied, strictly verifies role
 *   (so non-admin authenticated users always receive 403 FORBIDDEN); allows founder
 *   sandbox inspection only when unauthenticated in local preview.
 */
function requireAdminAccess(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const strictMode =
      process.env.NODE_ENV === 'production' ||
      process.env.ENFORCE_ADMIN_AUTH_IN_DEV === 'true';

    if (strictMode || req.headers.authorization) {
      return requireRole(...allowedRoles)(req, res, () => {
        if (strictMode) {
          return requireAdminMfa(req, res, next);
        }
        return next();
      });
    }

    return next();
  };
}

const previewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  sourceType: z
    .enum(['official_source', 'publisher_submitted', 'partner_feed', 'user_reported'])
    .optional(),
});

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(/^\+251[79]\d{8}$/, 'Enter an Ethiopian phone number starting with +2519 or +2517')
      .optional()
      .or(z.literal('')),
    password: z.string().min(8).max(128),
    preferredLanguage: z.enum(['en', 'am']).default('en'),
    marketingConsent: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: 'Provide either an email address or an Ethiopian phone number.',
    path: ['email'],
  });

const otpVerifySchema = z.object({
  destination: z.string().trim().min(5).max(255),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(5).max(255),
  password: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const profilePatchSchema = z.object({
  preferredLanguage: z.enum(['en', 'am']),
});

const analyticsEventSchema = z.object({
  eventName: z.enum([
    'app_open',
    'search',
    'tender_view',
    'alert_click',
    'subscription_start',
    'payment_completion',
  ]),
  platform: z.enum(['android', 'web']).default('android'),
  language: z.enum(['en', 'am']).default('en'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const bulkImportSchema = z.object({
  fileName: z.string().trim().min(3).max(200),
  contentBase64: z.string().min(4).max(5_000_000),
});

const manualTenderSchema = z.object({
  referenceNumber: z.string().trim().max(110).optional(),
  title: z.string().trim().min(8, 'Title must be at least 8 characters.').max(290),
  titleAm: z.string().trim().max(290).optional(),
  summary: z.string().trim().max(320).optional(),
  description: z.string().trim().min(10, 'Description must be at least 10 characters.'),
  eligibility: z.string().trim().optional(),
  publisherName: z.string().trim().min(3, 'Publisher name is required.').max(190),
  category: z.string().trim().optional(),
  region: z.string().trim().optional(),
  city: z.string().trim().optional(),
  publicationDate: z.string().trim().optional(),
  closingDate: z.string().trim().min(4, 'Closing date is required.'),
  procurementMethod: z.string().trim().optional(),
  currency: z.string().trim().default('ETB'),
  documentFee: z.union([z.string(), z.number()]).optional(),
  bidSecurity: z.union([z.string(), z.number()]).optional(),
  sourceType: z
    .enum(['official_source', 'publisher_submitted', 'partner_feed', 'user_reported'])
    .default('publisher_submitted'),
  sourceName: z.string().trim().min(2, 'Source attribution is required.').max(190),
  sourceUrl: z.string().trim().max(950).optional(),
  contactEmail: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  documentUrl: z.string().trim().optional(),
  isSampleData: z.boolean().default(false),
});

const moderationDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'mark_duplicate']),
  reason: z.string().trim().max(600).optional(),
});

const amendTenderSchema = z.object({
  reasonEn: z.string().trim().min(8, 'Provide a clear reason for this amendment.').max(500),
  reasonAm: z.string().trim().max(500).optional(),
  newClosingDate: z.string().trim().optional(),
  newSummaryEn: z.string().trim().max(320).optional(),
  newDescriptionEn: z.string().trim().optional(),
});

function handleRouteError(res: Response, error: unknown, fallback: string) {
  const err = error as Error & { statusCode?: number; code?: string };
  const status = err?.statusCode || 500;
  const code = err?.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  res.status(status).json({
    error: {
      code,
      message: err?.message || fallback,
    },
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Security headers (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, CORP)
  app.use(securityHeadersMiddleware);

  app.use(express.json({ limit: '5mb' }));
  app.use('/api', verifyOriginCsrf);
  app.use('/api', apiRateLimiter(120, 60_000, 'api_global'));

  // ============================================================================
  // PUBLIC DISCOVERY & HEALTH ROUTES
  // ============================================================================

  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    try {
      const health = await getPlatformHealth();
      res.json(health);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Service temporarily unavailable.';
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message,
        },
      });
    }
  });

  app.get('/api/v1/meta/taxonomy', async (_req: Request, res: Response) => {
    try {
      const taxonomy = await getTaxonomyMetadata();
      res.json(taxonomy);
    } catch (error: unknown) {
      handleRouteError(res, error, 'Failed to load taxonomy metadata.');
    }
  });

  app.get('/api/v1/tenders/preview', async (req: Request, res: Response) => {
    const parsed = previewQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            issue: i.message,
          })),
        },
      });
    }

    try {
      const result = await getPreviewTenders(parsed.data);
      res.json(result);
    } catch (error: unknown) {
      handleRouteError(res, error, 'Failed to load tenders.');
    }
  });

  // ============================================================================
  // AUTHENTICATION & PROFILE ROUTES (SHARED BY WEB & NATIVE ANDROID APP)
  // ============================================================================

  app.post('/api/v1/auth/register', apiRateLimiter(20, 60_000), async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid registration fields.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            issue: i.message,
          })),
        },
      });
    }

    try {
      const result = await registerUserWithOtp({
        fullName: parsed.data.fullName,
        email: parsed.data.email || undefined,
        phone: parsed.data.phone || undefined,
        password: parsed.data.password,
        preferredLanguage: parsed.data.preferredLanguage,
        marketingConsent: parsed.data.marketingConsent,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.status(201).json(result);
    } catch (error) {
      handleRouteError(res, error, 'Registration failed.');
    }
  });

  app.post('/api/v1/auth/otp/verify', apiRateLimiter(25, 60_000), async (req, res) => {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid OTP input.',
        },
      });
    }

    try {
      const result = await verifyOtpAndCreateSession({
        destination: parsed.data.destination,
        code: parsed.data.code,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.json(result);
    } catch (error) {
      handleRouteError(res, error, 'OTP verification failed.');
    }
  });

  app.post('/api/v1/auth/login', apiRateLimiter(25, 60_000), async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid login fields.',
        },
      });
    }

    try {
      const result = await loginWithPassword({
        identifier: parsed.data.identifier,
        password: parsed.data.password,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.json(result);
    } catch (error) {
      handleRouteError(res, error, 'Sign-in failed.');
    }
  });

  app.post('/api/v1/auth/refresh', async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required.' },
      });
    }

    try {
      const result = await refreshSessionToken({
        refreshToken: parsed.data.refreshToken,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      res.json(result);
    } catch (error) {
      handleRouteError(res, error, 'Session refresh failed.');
    }
  });

  app.post('/api/v1/auth/logout', async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) {
      await revokeSession(parsed.data.refreshToken).catch(() => {});
    }
    res.json({ loggedOut: true });
  });

  app.post(
    '/api/v1/auth/mfa/setup',
    requireAuth,
    apiRateLimiter(10, 60_000, 'mfa_setup'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.sessionUser?.sub;
        if (!userId) {
          return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Session authentication required.' },
          });
        }
        const setup = await setupUserTotpMfa(userId);
        res.json(setup);
      } catch (error) {
        handleRouteError(res, error, 'Could not initialize MFA setup.');
      }
    }
  );

  app.post(
    '/api/v1/auth/mfa/verify',
    requireAuth,
    apiRateLimiter(15, 60_000, 'mfa_verify'),
    async (req: AuthRequest, res: Response) => {
      const mfaSchema = z.object({
        code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code.'),
      });
      const parsed = mfaSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid MFA code.',
          },
        });
      }
      try {
        const userId = req.sessionUser?.sub;
        if (!userId) {
          return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Session authentication required.' },
          });
        }
        const result = await verifyUserTotpMfa({
          userId,
          code: parsed.data.code,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'MFA verification failed.');
      }
    }
  );

  app.get('/api/v1/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.sessionUser?.sub;
      if (!userId) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Profile not synced yet.' },
        });
      }
      const profile = await getUserProfileById(userId);
      if (!profile) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'User not found.' },
        });
      }
      res.json({ user: profile });
    } catch (error) {
      handleRouteError(res, error, 'Failed to load profile.');
    }
  });

  app.patch('/api/v1/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    const parsed = profilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid profile update.' },
      });
    }
    try {
      const userId = req.sessionUser?.sub;
      if (!userId) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Session user required.' },
        });
      }
      const updated = await updateUserLanguage(userId, parsed.data.preferredLanguage);
      res.json({ user: updated });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update profile.');
    }
  });

  app.post('/api/v1/analytics/events', apiRateLimiter(60, 60_000), async (req, res) => {
    const parsed = analyticsEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid analytics event.' },
      });
    }
    await recordAuditEvent({
      action: `analytics.${parsed.data.eventName}`,
      entityType: parsed.data.platform,
      entityId: parsed.data.language,
      afterJson: parsed.data.metadata ?? {},
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.status(202).json({ accepted: true });
  });

  // ============================================================================
  // ADMIN INGESTION, NORMALISATION, DATA QUALITY & MODERATION ROUTES
  // ============================================================================

  app.get(
    '/api/v1/admin/ingestion/overview',
    requireAdminAccess('moderator', 'super_admin'),
    async (_req: Request, res: Response) => {
      try {
        const overview = await getAdminIngestionOverview();
        res.json(overview);
      } catch (error) {
        handleRouteError(res, error, 'Failed to load ingestion dashboard.');
      }
    }
  );

  app.get('/api/v1/admin/ingestion/template.csv', (_req: Request, res: Response) => {
    const csv = generateSampleCsvTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="tenderlink_ethiopia_import_template.csv"'
    );
    res.send(csv);
  });

  app.post(
    '/api/v1/admin/ingestion/sources/:sourceKey/run',
    requireAdminAccess('moderator', 'super_admin'),
    apiRateLimiter(20, 60_000, 'admin_connector'),
    async (req: AuthRequest, res: Response) => {
      try {
        const sourceKey = String(req.params.sourceKey || '').trim();
        const report = await runRegisteredConnectorByKey(sourceKey, {
          userId: req.sessionUser?.sub,
          role: req.sessionUser?.roles?.[0] || 'admin_console',
        });
        res.status(201).json(report);
      } catch (error) {
        handleRouteError(res, error, 'Failed to run ingestion connector.');
      }
    }
  );

  app.post(
    '/api/v1/admin/ingestion/import',
    requireAdminAccess('moderator', 'super_admin'),
    apiRateLimiter(20, 60_000, 'admin_import'),
    async (req: AuthRequest, res: Response) => {
      const parsed = bulkImportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid spreadsheet upload payload.',
          },
        });
      }

      try {
        const buffer = Buffer.from(parsed.data.contentBase64, 'base64');
        const report = await runBulkSpreadsheetImport({
          fileName: parsed.data.fileName,
          buffer,
          actorRole: 'admin_console',
        });
        res.status(201).json(report);
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        if (!err.statusCode) err.statusCode = 400;
        handleRouteError(res, err, 'Failed to import CSV/Excel file.');
      }
    }
  );

  app.post(
    '/api/v1/admin/ingestion/manual',
    requireAdminAccess('moderator', 'super_admin', 'publisher', 'publisher_admin'),
    apiRateLimiter(30, 60_000, 'admin_manual'),
    async (req: AuthRequest, res: Response) => {
      const parsed = manualTenderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid manual tender input.',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
          },
        });
      }

      try {
        const d = parsed.data;
        if (d.sourceUrl) assertSafeExternalUrl(d.sourceUrl);
        if (d.documentUrl) assertSafeExternalUrl(d.documentUrl);

        const report = await createManualAdminTender(
          {
            externalId: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
            referenceNumber: d.referenceNumber || undefined,
            title: d.title,
            titleAm: d.titleAm || undefined,
            summary: d.summary || undefined,
            description: d.description,
            eligibility: d.eligibility || undefined,
            publisherName: d.publisherName,
            category: d.category || undefined,
            region: d.region || undefined,
            city: d.city || undefined,
            publicationDate: d.publicationDate || undefined,
            closingDate: d.closingDate,
            procurementMethod: d.procurementMethod || undefined,
            currency: d.currency,
            documentFee: d.documentFee,
            bidSecurity: d.bidSecurity,
            sourceType: d.sourceType,
            sourceName: d.sourceName,
            sourceUrl: d.sourceUrl || undefined,
            contactEmail: d.contactEmail || undefined,
            contactPhone: d.contactPhone || undefined,
            documents: d.documentUrl
              ? [{ title: 'Attached_Tender_Notice.pdf', url: d.documentUrl }]
              : [],
            isSampleData: d.isSampleData,
          },
          {
            userId: req.sessionUser?.sub,
            role: req.sessionUser?.roles?.[0] || 'admin_console',
          }
        );
        res.status(201).json(report);
      } catch (error) {
        handleRouteError(res, error, 'Failed to submit manual tender.');
      }
    }
  );

  app.post(
    '/api/v1/admin/moderation/:caseId/decision',
    requireAdminAccess('moderator', 'super_admin'),
    async (req: AuthRequest, res: Response) => {
      const parsed = moderationDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid moderation decision.',
          },
        });
      }

      try {
        const result = await resolveModerationCase({
          caseId: String(req.params.caseId || ''),
          decision: parsed.data.decision,
          reason: parsed.data.reason,
          actorUserId: req.sessionUser?.sub,
          actorRole: req.sessionUser?.roles?.[0] || 'moderator',
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'Failed to apply moderation decision.');
      }
    }
  );

  app.post(
    '/api/v1/admin/tenders/:tenderId/amend',
    requireAdminAccess('moderator', 'super_admin'),
    async (req: AuthRequest, res: Response) => {
      const parsed = amendTenderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid amendment request.',
          },
        });
      }

      try {
        let newClosingAt: Date | null = null;
        if (parsed.data.newClosingDate) {
          const dateRes = parseDateInEat(parsed.data.newClosingDate);
          if (dateRes.invalid || !dateRes.date) {
            return res.status(400).json({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid new closing date format. Use YYYY-MM-DD.',
              },
            });
          }
          newClosingAt = dateRes.date;
        }

        const result = await createVersionedAmendment({
          tenderId: String(req.params.tenderId || ''),
          reasonEn: parsed.data.reasonEn,
          reasonAm: parsed.data.reasonAm,
          newClosingAt,
          newSummaryEn: parsed.data.newSummaryEn,
          newDescriptionEn: parsed.data.newDescriptionEn,
          actorUserId: req.sessionUser?.sub,
          actorRole: req.sessionUser?.roles?.[0] || 'moderator',
          sourceLabel: 'admin_manual_amendment',
        });
        res.status(201).json(result);
      } catch (error) {
        handleRouteError(res, error, 'Failed to create versioned amendment.');
      }
    }
  );

  // ============================================================================
  // CHAPA ETB SUBSCRIPTION & PUBLISHER BILLING ROUTES (DATA MODEL & CHECKOUT)
  // Note: Webhooks (/api/v1/webhooks/chapa) & Refunds intentionally held for
  // Phase 2 review per founder instruction.
  // ============================================================================

  const checkoutInitSchema = z.object({
    priceCode: z.string().trim().min(3).max(80),
    paymentChannel: z
      .enum(['telebirr', 'cbe_birr', 'ebirr', 'mpesa', 'bank_transfer', 'card'])
      .default('telebirr'),
    customerName: z.string().trim().min(2, 'Enter your full name or organisation name.').max(160),
    customerEmail: z.string().trim().email('Enter a valid email address for your ETB receipt.'),
    customerPhone: z
      .string()
      .trim()
      .regex(/^\+?251[79]\d{8}$|^0[79]\d{8}$/, 'Enter a valid Ethiopian phone number (e.g. +251911234567).')
      .optional()
      .or(z.literal('')),
    billingTin: z.string().trim().max(64).optional().or(z.literal('')),
    idempotencyKey: z.string().trim().max(120).optional(),
  });

  const checkoutVerifySchema = z.object({
    testModeOutcome: z
      .enum(['succeeded', 'pending', 'processing', 'failed', 'cancelled'])
      .optional(),
    testModeFailureReason: z.string().trim().max(300).optional(),
  });

  app.get('/api/v1/billing/catalog', async (_req: Request, res: Response) => {
    try {
      const catalog = await getBillingCatalog();
      res.json(catalog);
    } catch (error) {
      handleRouteError(res, error, 'Failed to load ETB billing catalog.');
    }
  });

  app.post(
    '/api/v1/billing/checkout',
    apiRateLimiter(25, 60_000),
    async (req: Request, res: Response) => {
      const parsed = checkoutInitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid checkout fields.',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              issue: i.message,
            })),
          },
        });
      }

      try {
        const result = await initiateChapaCheckout({
          priceCode: parsed.data.priceCode,
          paymentChannel: parsed.data.paymentChannel,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          customerPhone: parsed.data.customerPhone || undefined,
          billingTin: parsed.data.billingTin || undefined,
          idempotencyKey: parsed.data.idempotencyKey,
        });
        res.status(201).json(result);
      } catch (error) {
        handleRouteError(res, error, 'Could not initialize Chapa hosted checkout.');
      }
    }
  );

  app.get('/api/v1/billing/checkout/:txRef', async (req: Request, res: Response) => {
    try {
      const txRef = String(req.params.txRef || '').trim();
      const status = await getPaymentStatusByTxRef(txRef);
      res.json(status);
    } catch (error) {
      handleRouteError(res, error, 'Failed to load checkout status.');
    }
  });

  app.post(
    '/api/v1/billing/checkout/:txRef/verify',
    apiRateLimiter(30, 60_000),
    async (req: Request, res: Response) => {
      const parsed = checkoutVerifySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid verification parameters.',
          },
        });
      }
      try {
        const txRef = String(req.params.txRef || '').trim();
        const result = await verifyCheckoutPaymentOnServer({
          txRef,
          testModeOutcome: parsed.data.testModeOutcome,
          testModeFailureReason: parsed.data.testModeFailureReason,
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'Server-side payment verification failed.');
      }
    }
  );

  app.get('/api/v1/billing/history', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const isFinanceOrAdmin = hasAnyRole(req, ['finance_admin', 'super_admin']);
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;
      const history = await getBillingHistory({
        email: isFinanceOrAdmin ? email : undefined,
        userId: !isFinanceOrAdmin && req.sessionUser?.sub ? req.sessionUser.sub : undefined,
        redactPii: !isFinanceOrAdmin && !req.sessionUser?.sub,
      });
      res.json(history);
    } catch (error) {
      handleRouteError(res, error, 'Failed to load billing & invoice history.');
    }
  });

  // ============================================================================
  // PRIVACY, CONSENT, DATA SUBJECT RIGHTS, BREACH RESPONSE & RETENTION ROUTES
  // ============================================================================

  const consentSchema = z.object({
    visitorId: z.string().trim().min(6).max(120),
    analyticsConsent: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
    notificationConsent: z.boolean().default(false),
    policyVersion: z.string().trim().max(32).optional(),
  });

  const dsrSubmitSchema = z.object({
    requesterEmail: z.string().trim().email('Enter a valid email address for DSR updates.'),
    requestType: z.enum([
      'access',
      'rectification',
      'erasure',
      'portability',
      'objection',
      'withdraw_consent',
    ]),
    details: z.string().trim().min(10, 'Describe your privacy request in at least 10 characters.').max(1500),
  });

  const dsrResolveSchema = z.object({
    status: z.enum(['in_review', 'completed', 'rejected']),
    resolutionNotes: z.string().trim().min(5).max(1000),
  });

  const incidentSchema = z.object({
    title: z.string().trim().min(6).max(220),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    affectedRecordsEstimate: z.coerce.number().int().min(0).default(0),
    personalDataAffected: z.boolean().default(false),
    summary: z.string().trim().min(10).max(2000),
    containmentActions: z.string().trim().max(2000).optional(),
  });

  const deleteAccountSchema = z.object({
    confirmPhrase: z.literal('DELETE MY ACCOUNT'),
    reason: z.string().trim().max(240).optional(),
  });

  app.get('/api/v1/privacy/consent', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const visitorId =
        typeof req.query.visitorId === 'string' ? req.query.visitorId.trim() : undefined;
      const consent = await getConsentPreferences({
        visitorId,
        userId: req.sessionUser?.sub,
      });
      res.json({ consent });
    } catch (error) {
      handleRouteError(res, error, 'Failed to load privacy consent preferences.');
    }
  });

  app.post(
    '/api/v1/privacy/consent',
    optionalAuth,
    apiRateLimiter(40, 60_000, 'privacy_consent'),
    async (req: AuthRequest, res: Response) => {
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid consent payload.',
          },
        });
      }

      try {
        const saved = await saveConsentPreferences({
          visitorId: parsed.data.visitorId,
          userId: req.sessionUser?.sub ?? null,
          analyticsConsent: parsed.data.analyticsConsent,
          marketingConsent: parsed.data.marketingConsent,
          notificationConsent: parsed.data.notificationConsent,
          policyVersion: parsed.data.policyVersion,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.json({ consent: saved });
      } catch (error) {
        handleRouteError(res, error, 'Failed to save privacy consent preferences.');
      }
    }
  );

  app.post(
    '/api/v1/privacy/dsr',
    optionalAuth,
    apiRateLimiter(15, 60_000, 'privacy_dsr'),
    async (req: AuthRequest, res: Response) => {
      const parsed = dsrSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid privacy request.',
          },
        });
      }

      try {
        const created = await createDataSubjectRequest({
          userId: req.sessionUser?.sub ?? null,
          requesterEmail: parsed.data.requesterEmail,
          requestType: parsed.data.requestType,
          details: parsed.data.details,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.status(201).json({ request: created });
      } catch (error) {
        handleRouteError(res, error, 'Failed to submit data-subject request.');
      }
    }
  );

  app.get(
    '/api/v1/privacy/export',
    requireAuth,
    apiRateLimiter(10, 60_000, 'privacy_export'),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.sessionUser?.sub;
        if (!userId) {
          return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Session authentication required.' },
          });
        }
        const exported = await exportUserData(userId, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="tenderlink-ethiopia-personal-data-export.json"'
        );
        res.json(exported);
      } catch (error) {
        handleRouteError(res, error, 'Failed to export personal data.');
      }
    }
  );

  app.post(
    '/api/v1/privacy/delete-account',
    requireAuth,
    apiRateLimiter(5, 60_000, 'privacy_delete'),
    async (req: AuthRequest, res: Response) => {
      const parsed = deleteAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Type exact confirmation phrase "DELETE MY ACCOUNT" to proceed.',
          },
        });
      }

      try {
        const userId = req.sessionUser?.sub;
        if (!userId) {
          return res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Session authentication required.' },
          });
        }
        const result = await deleteAndAnonymiseAccount({
          userId,
          reason: parsed.data.reason,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'Failed to delete and anonymise account.');
      }
    }
  );

  app.get(
    '/api/v1/admin/privacy/overview',
    requireAdminAccess('moderator', 'super_admin'),
    async (_req: Request, res: Response) => {
      try {
        const overview = await getPrivacyGovernanceOverview();
        res.json(overview);
      } catch (error) {
        handleRouteError(res, error, 'Failed to load privacy governance overview.');
      }
    }
  );

  app.post(
    '/api/v1/admin/privacy/dsr/:requestId/resolve',
    requireAdminAccess('moderator', 'super_admin'),
    async (req: AuthRequest, res: Response) => {
      const parsed = dsrResolveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid DSR resolution payload.',
          },
        });
      }
      try {
        const updated = await resolveDataSubjectRequest({
          requestId: String(req.params.requestId || ''),
          status: parsed.data.status,
          resolutionNotes: parsed.data.resolutionNotes,
          actorUserId: req.sessionUser?.sub,
          actorRole: req.sessionUser?.roles?.[0] || 'privacy_admin',
        });
        res.json({ request: updated });
      } catch (error) {
        handleRouteError(res, error, 'Failed to resolve data-subject request.');
      }
    }
  );

  app.post(
    '/api/v1/admin/privacy/incidents',
    requireAdminAccess('moderator', 'super_admin'),
    apiRateLimiter(15, 60_000, 'admin_incidents'),
    async (req: AuthRequest, res: Response) => {
      const parsed = incidentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid security incident details.',
          },
        });
      }
      try {
        const incident = await logSecurityIncident({
          title: parsed.data.title,
          severity: parsed.data.severity,
          affectedRecordsEstimate: parsed.data.affectedRecordsEstimate,
          personalDataAffected: parsed.data.personalDataAffected,
          summary: parsed.data.summary,
          containmentActions: parsed.data.containmentActions,
          reportedById: req.sessionUser?.sub ?? null,
        });
        res.status(201).json({ incident });
      } catch (error) {
        handleRouteError(res, error, 'Failed to log security incident.');
      }
    }
  );

  app.post(
    '/api/v1/admin/privacy/retention-sweep',
    requireAdminAccess('super_admin', 'moderator'),
    apiRateLimiter(10, 60_000, 'retention_sweep'),
    async (req: AuthRequest, res: Response) => {
      try {
        const summary = await runDataRetentionSweep({
          userId: req.sessionUser?.sub,
          role: req.sessionUser?.roles?.[0] || 'privacy_admin',
        });
        res.json(summary);
      } catch (error) {
        handleRouteError(res, error, 'Failed to execute retention sweep.');
      }
    }
  );

  // ============================================================================
  // PLATFORM INTEGRITY: ABUSE REPORTING, TAKEDOWNS & PUBLISHER VERIFICATION
  // ============================================================================

  const abuseReportSchema = z.object({
    reason: z.enum([
      'fake_or_scam',
      'expired_or_wrong_deadline',
      'duplicate_listing',
      'wrong_organisation',
      'broken_or_malicious_link',
      'policy_violation',
      'other',
    ]),
    details: z.string().trim().min(10, 'Provide at least 10 characters explaining the issue.').max(1000),
    reporterEmail: z.string().trim().email().optional().or(z.literal('')),
  });

  const abuseResolveSchema = z.object({
    action: z.enum(['takedown', 'dismiss']),
    resolution: z.string().trim().min(5, 'Provide a clear moderation resolution note.').max(800),
  });

  const publisherVerifySubmitSchema = z.object({
    organisationNameEn: z.string().trim().min(3).max(200),
    organisationType: z.enum([
      'government_body',
      'public_enterprise',
      'private_company',
      'ngo',
      'international_org',
      'donor_agency',
      'university',
      'hospital',
      'other',
    ]),
    tinNumber: z.string().trim().max(64).optional().or(z.literal('')),
    licenseNumber: z.string().trim().min(3, 'Provide business license or legal registration reference.').max(120),
    officialEmail: z.string().trim().email('Provide an official organisation email.'),
  });

  const publisherVerifyReviewSchema = z.object({
    decision: z.enum(['verified', 'rejected']),
    reviewNotes: z.string().trim().min(5).max(800),
  });

  app.post(
    '/api/v1/tenders/:tenderId/report',
    optionalAuth,
    apiRateLimiter(20, 60_000, 'abuse_report'),
    async (req: AuthRequest, res: Response) => {
      const parsed = abuseReportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid abuse report details.',
          },
        });
      }
      try {
        const report = await submitAbuseReport({
          tenderId: String(req.params.tenderId || ''),
          reporterId: req.sessionUser?.sub ?? null,
          reporterEmail: parsed.data.reporterEmail || null,
          reason: parsed.data.reason,
          details: parsed.data.details,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });
        res.status(201).json({ report });
      } catch (error) {
        handleRouteError(res, error, 'Failed to submit abuse report.');
      }
    }
  );

  app.post(
    '/api/v1/publishers/verifications',
    optionalAuth,
    apiRateLimiter(15, 60_000, 'pub_verify'),
    async (req: AuthRequest, res: Response) => {
      const parsed = publisherVerifySubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid publisher verification details.',
          },
        });
      }
      try {
        const verification = await submitPublisherVerification({
          organisationNameEn: parsed.data.organisationNameEn,
          organisationType: parsed.data.organisationType,
          tinNumber: parsed.data.tinNumber || undefined,
          licenseNumber: parsed.data.licenseNumber,
          officialEmail: parsed.data.officialEmail,
          submittedById: req.sessionUser?.sub ?? null,
        });
        res.status(201).json({ verification });
      } catch (error) {
        handleRouteError(res, error, 'Failed to submit publisher verification.');
      }
    }
  );

  app.get(
    '/api/v1/admin/integrity/overview',
    requireAdminAccess('moderator', 'super_admin'),
    async (_req: Request, res: Response) => {
      try {
        const overview = await getPlatformIntegrityOverview();
        res.json(overview);
      } catch (error) {
        handleRouteError(res, error, 'Failed to load platform integrity overview.');
      }
    }
  );

  app.post(
    '/api/v1/admin/integrity/abuse-reports/:reportId/resolve',
    requireAdminAccess('moderator', 'super_admin'),
    async (req: AuthRequest, res: Response) => {
      const parsed = abuseResolveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid takedown/resolution input.',
          },
        });
      }
      try {
        const result = await resolveAbuseReport({
          reportId: String(req.params.reportId || ''),
          action: parsed.data.action,
          resolution: parsed.data.resolution,
          actorUserId: req.sessionUser?.sub,
          actorRole: req.sessionUser?.roles?.[0] || 'moderator',
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'Failed to resolve abuse report.');
      }
    }
  );

  app.post(
    '/api/v1/admin/integrity/verifications/:verificationId/review',
    requireAdminAccess('moderator', 'super_admin'),
    async (req: AuthRequest, res: Response) => {
      const parsed = publisherVerifyReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid verification review.',
          },
        });
      }
      try {
        const result = await reviewPublisherVerification({
          verificationId: String(req.params.verificationId || ''),
          decision: parsed.data.decision,
          reviewNotes: parsed.data.reviewNotes,
          actorUserId: req.sessionUser?.sub,
          actorRole: req.sessionUser?.roles?.[0] || 'moderator',
        });
        res.json(result);
      } catch (error) {
        handleRouteError(res, error, 'Failed to review publisher verification.');
      }
    }
  );

  // 404 for unknown API paths
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found.',
      },
    });
  });

  // ============================================================================
  // VITE / STATIC CLIENT SERVING
  // ============================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TenderLink Ethiopia server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TenderLink Ethiopia server:', err);
  process.exit(1);
});
