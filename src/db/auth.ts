import crypto from 'crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  otpCodes,
  roles,
  sessions,
  userRoles,
  users,
} from './schema.ts';
import { ensureSeedData } from './seed.ts';

import {
  buildTotpOtpAuthUri,
  generateTotpSecret,
  verifyTotpCode,
} from '../security/guard.ts';

function resolveSigningSecret(): string {
  const configured = process.env.SESSION_TOKEN_SECRET?.trim();
  if (configured && configured.length >= 32) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL SECURITY ERROR: SESSION_TOKEN_SECRET must be set (>= 32 chars) in production.'
    );
  }
  // Ephemeral random dev-only key (never falls back to DB passwords or hardcoded literals)
  if (!globalThis.__tenderlinkDevSigningKey) {
    globalThis.__tenderlinkDevSigningKey = crypto.randomBytes(32).toString('hex');
  }
  return globalThis.__tenderlinkDevSigningKey;
}

declare global {
  // eslint-disable-next-line no-var
  var __tenderlinkDevSigningKey: string | undefined;
}

const ACCESS_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours (shortened from 24h for tighter session exposure)
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_FAILED_LOGINS = 5;
const ACCOUNT_LOCKOUT_MS = 1000 * 60 * 15; // 15 minutes lockout after 5 failed attempts

// Dummy hash used to equalize login response timing when account does not exist
const DUMMY_PASSWORD_HASH =
  '0123456789abcdef0123456789abcdef:' + '0'.repeat(128);

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const aBuf = Buffer.from(aHex, 'utf8');
  const bBuf = Buffer.from(bHex, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export interface AccessTokenPayload {
  sub: string; // users.id UUID
  roles: string[];
  lang: string;
  mfaVerified?: boolean;
  exp: number;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'exp'>): string {
  const secret = resolveSigningSecret();
  const full: AccessTokenPayload = {
    ...payload,
    exp: Date.now() + ACCESS_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  return `tl_${body}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  if (!token.startsWith('tl_')) return null;
  const raw = token.slice(3);
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;

  const secret = resolveSigningSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as AccessTokenPayload;
    if (!parsed.sub || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function getUserRoleCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.code);
}

async function issueSessionTokens(
  userId: string,
  preferredLanguage: string,
  meta: { ipAddress?: string; userAgent?: string; mfaVerified?: boolean }
) {
  const roleCodes = await getUserRoleCodes(userId);
  const finalRoles = roleCodes.length > 0 ? roleCodes : ['seeker'];
  const accessToken = signAccessToken({
    sub: userId,
    roles: finalRoles,
    lang: preferredLanguage,
    mfaVerified: Boolean(meta.mfaVerified),
  });

  const refreshToken = `tlr_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await db.insert(sessions).values({
    userId,
    refreshTokenHash: sha256(refreshToken),
    userAgent: meta.userAgent?.slice(0, 290) ?? null,
    ipAddress: meta.ipAddress?.slice(0, 60) ?? null,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: Math.floor(ACCESS_TTL_MS / 1000),
    roles: finalRoles,
    mfaVerified: Boolean(meta.mfaVerified),
  };
}

export async function recordAuditEvent(params: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  afterJson?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      afterJson: params.afterJson ?? null,
      ipAddress: params.ipAddress?.slice(0, 60) ?? null,
      userAgent: params.userAgent?.slice(0, 290) ?? null,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export async function registerUserWithOtp(input: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  preferredLanguage: 'en' | 'am';
  marketingConsent: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await ensureSeedData();
    const normalizedEmail = input.email?.trim().toLowerCase() || null;
    const normalizedPhone = input.phone?.trim() || null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new Error('Either email or Ethiopian phone number is required.');
    }

    if (normalizedEmail) {
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
        .limit(1);
      if (existingEmail.length > 0) {
        const err = new Error('An account with this email already exists.');
        (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
        (err as Error & { statusCode?: number; code?: string }).code = 'CONFLICT';
        throw err;
      }
    }

    if (normalizedPhone) {
      const existingPhone = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.phone, normalizedPhone), isNull(users.deletedAt)))
        .limit(1);
      if (existingPhone.length > 0) {
        const err = new Error('An account with this phone number already exists.');
        (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
        (err as Error & { statusCode?: number; code?: string }).code = 'CONFLICT';
        throw err;
      }
    }

    const [created] = await db
      .insert(users)
      .values({
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: hashPassword(input.password),
        preferredLanguage: input.preferredLanguage,
        marketingConsent: input.marketingConsent,
        consentUpdatedAt: new Date(),
      })
      .returning();

    const [seekerRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'seeker'))
      .limit(1);

    if (seekerRole) {
      await db
        .insert(userRoles)
        .values({ userId: created.id, roleId: seekerRole.id })
        .onConflictDoNothing();
    }

    // Generate 6-digit OTP and store only SHA-256 hash
    const destination = normalizedPhone || normalizedEmail!;
    const purpose = normalizedPhone ? ('verify_phone' as const) : ('verify_email' as const);
    const otpPlain = String(crypto.randomInt(100000, 999999));

    await db.insert(otpCodes).values({
      userId: created.id,
      destination,
      purpose,
      codeHash: sha256(otpPlain),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    // Server-side OTP log strictly gated to non-production when external SMTP/SMS gateway is unset
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      console.log(`[TenderLink DEV OTP][${purpose}] destination=${destination} code=${otpPlain}`);
    }

    await recordAuditEvent({
      actorUserId: created.id,
      actorRole: 'seeker',
      action: 'user.registered',
      entityType: 'user',
      entityId: created.id,
      afterJson: { preferredLanguage: created.preferredLanguage, destination },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      userId: created.id,
      destination,
      purpose,
      otpRequired: true,
      expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) {
      throw error;
    }
    console.error('Registration failed:', error);
    throw new Error('Could not complete registration. Please try again.', {
      cause: error,
    });
  }
}

export async function verifyOtpAndCreateSession(input: {
  destination: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const dest = input.destination.trim().toLowerCase();
    const rawDest = input.destination.trim();

    const [otpRecord] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
          eq(otpCodes.destination, rawDest.startsWith('+') ? rawDest : dest)
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otpRecord) {
      const err = new Error('Verification code expired or not found. Please request a new code.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 400;
      (err as Error & { statusCode?: number; code?: string }).code = 'INVALID_OTP';
      throw err;
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      const err = new Error('Too many invalid attempts. Please request a new code.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 429;
      (err as Error & { statusCode?: number; code?: string }).code = 'OTP_LOCKED';
      throw err;
    }

    if (!timingSafeHexEqual(otpRecord.codeHash, sha256(input.code.trim()))) {
      await db
        .update(otpCodes)
        .set({ attempts: otpRecord.attempts + 1 })
        .where(eq(otpCodes.id, otpRecord.id));
      const err = new Error('Invalid verification code. Please check and try again.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { statusCode?: number; code?: string }).code = 'INVALID_OTP';
      throw err;
    }

    await db
      .update(otpCodes)
      .set({ consumedAt: new Date() })
      .where(eq(otpCodes.id, otpRecord.id));

    if (!otpRecord.userId) {
      return { verified: true };
    }

    const updateFields: Partial<typeof users.$inferInsert> = {
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };
    if (otpRecord.purpose === 'verify_phone') {
      updateFields.phoneVerifiedAt = new Date();
    } else if (otpRecord.purpose === 'verify_email') {
      updateFields.emailVerifiedAt = new Date();
    }

    const [user] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, otpRecord.userId))
      .returning();

    const tokenBundle = await issueSessionTokens(user.id, user.preferredLanguage, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await recordAuditEvent({
      actorUserId: user.id,
      actorRole: tokenBundle.roles[0] ?? 'seeker',
      action: 'auth.otp_verified',
      entityType: 'user',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      verified: true,
      ...tokenBundle,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        preferredLanguage: user.preferredLanguage,
        marketingConsent: user.marketingConsent,
        roles: tokenBundle.roles,
      },
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) {
      throw error;
    }
    console.error('OTP verification failed:', error);
    throw new Error('Could not verify code right now. Please try again.', {
      cause: error,
    });
  }
}

export async function loginWithPassword(input: {
  identifier: string; // email or +251 phone
  password: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await ensureSeedData();
    const raw = input.identifier.trim();
    const isEmail = raw.includes('@');

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.isActive, true),
          isEmail ? eq(users.email, raw.toLowerCase()) : eq(users.phone, raw)
        )
      )
      .limit(1);

    if (!user || !user.passwordHash) {
      // Equalize scrypt work factor to prevent timing-based user enumeration
      verifyPassword(input.password, DUMMY_PASSWORD_HASH);
      const err = new Error('Invalid email/phone or password.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { statusCode?: number; code?: string }).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
      const waitMin = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000)
      );
      const err = new Error(
        `Account temporarily locked due to repeated failed sign-in attempts. Try again in ${waitMin} minute(s).`
      );
      (err as Error & { statusCode?: number; code?: string }).statusCode = 423;
      (err as Error & { statusCode?: number; code?: string }).code = 'ACCOUNT_LOCKED';
      throw err;
    }

    if (!verifyPassword(input.password, user.passwordHash)) {
      const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_LOGINS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + ACCOUNT_LOCKOUT_MS) : null;

      await db
        .update(users)
        .set({
          failedLoginAttempts: shouldLock ? 0 : nextAttempts,
          lockedUntil,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));

      if (shouldLock) {
        await recordAuditEvent({
          actorUserId: user.id,
          actorRole: 'security_system',
          action: 'auth.account_locked',
          entityType: 'user',
          entityId: user.id,
          afterJson: { lockedUntil: lockedUntil?.toISOString(), reason: 'brute_force_threshold' },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
      }

      const err = new Error('Invalid email/phone or password.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { statusCode?: number; code?: string }).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    await db
      .update(users)
      .set({
        lastLoginAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    const tokenBundle = await issueSessionTokens(user.id, user.preferredLanguage, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      mfaVerified: false,
    });

    await recordAuditEvent({
      actorUserId: user.id,
      actorRole: tokenBundle.roles[0] ?? 'seeker',
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      afterJson: { mfaEnabled: user.mfaEnabled },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      ...tokenBundle,
      mfaRequired: user.mfaEnabled,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        preferredLanguage: user.preferredLanguage,
        marketingConsent: user.marketingConsent,
        notificationConsent: user.notificationConsent,
        mfaEnabled: user.mfaEnabled,
        roles: tokenBundle.roles,
      },
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) {
      throw error;
    }
    console.error('Login failed:', error);
    throw new Error('Could not sign in right now. Please try again.', {
      cause: error,
    });
  }
}

export async function refreshSessionToken(input: {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const hash = sha256(input.refreshToken);
    const [sessionRow] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, hash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!sessionRow) {
      const err = new Error('Session expired. Please sign in again.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { statusCode?: number; code?: string }).code = 'SESSION_EXPIRED';
      throw err;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, sessionRow.userId), isNull(users.deletedAt), eq(users.isActive, true)))
      .limit(1);

    if (!user) {
      const err = new Error('Account unavailable.');
      (err as Error & { statusCode?: number; code?: string }).statusCode = 401;
      (err as Error & { statusCode?: number; code?: string }).code = 'UNAUTHORIZED';
      throw err;
    }

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, sessionRow.id));

    return await issueSessionTokens(user.id, user.preferredLanguage, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) {
      throw error;
    }
    console.error('Token refresh failed:', error);
    throw new Error('Could not refresh session.', { cause: error });
  }
}

export async function revokeSession(refreshToken: string) {
  try {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, sha256(refreshToken)));
  } catch (error) {
    console.error('Logout revoke failed:', error);
    throw new Error('Could not revoke session.', { cause: error });
  }
}

export async function getUserProfileById(userId: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) return null;
    const roleCodes = await getUserRoleCodes(user.id);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage,
      marketingConsent: user.marketingConsent,
      notificationConsent: user.notificationConsent,
      mfaEnabled: user.mfaEnabled,
      roles: roleCodes.length > 0 ? roleCodes : ['seeker'],
    };
  } catch (error) {
    console.error('Profile fetch failed:', error);
    throw new Error('Could not load user profile.', { cause: error });
  }
}

export async function setupUserTotpMfa(userId: string) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      const err = new Error('User account not found.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const secret = generateTotpSecret();
    await db
      .update(users)
      .set({ mfaSecret: secret, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const accountLabel = user.email || user.phone || user.id;
    return {
      secret,
      otpauthUri: buildTotpOtpAuthUri(accountLabel, secret),
      mfaEnabled: user.mfaEnabled,
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('TOTP MFA setup failed:', error);
    throw new Error('Could not initialize authenticator MFA.', { cause: error });
  }
}

export async function verifyUserTotpMfa(input: {
  userId: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.mfaSecret) {
      const err = new Error('MFA has not been initialized for this account.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 400;
      err.code = 'MFA_NOT_INITIALIZED';
      throw err;
    }

    if (!verifyTotpCode(user.mfaSecret, input.code)) {
      const err = new Error('Invalid 6-digit authenticator code.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 401;
      err.code = 'INVALID_MFA_CODE';
      throw err;
    }

    if (!user.mfaEnabled) {
      await db
        .update(users)
        .set({ mfaEnabled: true, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const tokenBundle = await issueSessionTokens(user.id, user.preferredLanguage, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      mfaVerified: true,
    });

    await recordAuditEvent({
      actorUserId: user.id,
      actorRole: tokenBundle.roles[0] ?? 'seeker',
      action: 'auth.mfa_verified',
      entityType: 'user',
      entityId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      verified: true,
      mfaEnabled: true,
      ...tokenBundle,
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('TOTP MFA verification failed:', error);
    throw new Error('Could not verify MFA code.', { cause: error });
  }
}

export async function updateUserLanguage(userId: string, preferredLanguage: 'en' | 'am') {
  try {
    const [updated] = await db
      .update(users)
      .set({ preferredLanguage, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();

    if (!updated) return null;
    return {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      preferredLanguage: updated.preferredLanguage,
      marketingConsent: updated.marketingConsent,
      notificationConsent: updated.notificationConsent,
      mfaEnabled: updated.mfaEnabled,
    };
  } catch (error) {
    console.error('Language update failed:', error);
    throw new Error('Could not update preferred language.', { cause: error });
  }
}
