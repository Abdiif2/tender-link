import { and, desc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  alertPreferences,
  auditLogs,
  bookmarks,
  dataSubjectRequests,
  invoices,
  notificationEvents,
  otpCodes,
  payments,
  savedSearches,
  securityIncidents,
  sessions,
  subscriptions,
  userConsents,
  userEntitlements,
  users,
} from '../db/schema.ts';
import { recordAuditEvent } from '../db/auth.ts';

export const CURRENT_POLICY_VERSION = '2026-04-v1';

// ============================================================================
// 1. COOKIE, MARKETING & NOTIFICATION CONSENT MANAGEMENT
// ============================================================================

export async function saveConsentPreferences(input: {
  visitorId: string;
  userId?: string | null;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  notificationConsent: boolean;
  policyVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const now = new Date();
    const policyVersion = input.policyVersion || CURRENT_POLICY_VERSION;

    const [saved] = await db
      .insert(userConsents)
      .values({
        visitorId: input.visitorId,
        userId: input.userId ?? null,
        essentialCookies: true,
        analyticsConsent: input.analyticsConsent,
        marketingConsent: input.marketingConsent,
        notificationConsent: input.notificationConsent,
        policyVersion,
        ipAddress: input.ipAddress?.slice(0, 60) ?? null,
        userAgent: input.userAgent?.slice(0, 290) ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userConsents.visitorId,
        set: {
          userId: input.userId ?? undefined,
          essentialCookies: true,
          analyticsConsent: input.analyticsConsent,
          marketingConsent: input.marketingConsent,
          notificationConsent: input.notificationConsent,
          policyVersion,
          ipAddress: input.ipAddress?.slice(0, 60) ?? null,
          userAgent: input.userAgent?.slice(0, 290) ?? null,
          updatedAt: now,
        },
      })
      .returning();

    if (input.userId) {
      await db
        .update(users)
        .set({
          marketingConsent: input.marketingConsent,
          notificationConsent: input.notificationConsent,
          consentUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, input.userId));
    }

    await recordAuditEvent({
      actorUserId: input.userId ?? null,
      actorRole: input.userId ? 'user' : 'guest',
      action: 'privacy.consent_updated',
      entityType: 'user_consent',
      entityId: saved.id,
      afterJson: {
        analyticsConsent: saved.analyticsConsent,
        marketingConsent: saved.marketingConsent,
        notificationConsent: saved.notificationConsent,
        policyVersion: saved.policyVersion,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      id: saved.id,
      visitorId: saved.visitorId,
      essentialCookies: saved.essentialCookies,
      analyticsConsent: saved.analyticsConsent,
      marketingConsent: saved.marketingConsent,
      notificationConsent: saved.notificationConsent,
      policyVersion: saved.policyVersion,
      updatedAt: saved.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to save consent preferences:', error);
    throw new Error('Could not save privacy consent preferences.', { cause: error });
  }
}

export async function getConsentPreferences(params: {
  visitorId?: string;
  userId?: string;
}) {
  try {
    const conditions = [];
    if (params.userId) conditions.push(eq(userConsents.userId, params.userId));
    if (params.visitorId) conditions.push(eq(userConsents.visitorId, params.visitorId));
    if (conditions.length === 0) return null;

    const [row] = await db
      .select()
      .from(userConsents)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions))
      .orderBy(desc(userConsents.updatedAt))
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      visitorId: row.visitorId,
      essentialCookies: row.essentialCookies,
      analyticsConsent: row.analyticsConsent,
      marketingConsent: row.marketingConsent,
      notificationConsent: row.notificationConsent,
      policyVersion: row.policyVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to load consent preferences:', error);
    throw new Error('Could not load consent preferences.', { cause: error });
  }
}

// ============================================================================
// 2. DATA EXPORT WORKFLOW (PORTABILITY — EXCLUDES SECRETS/HASHES)
// ============================================================================

export async function exportUserData(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string }
) {
  try {
    const [user] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        preferredLanguage: users.preferredLanguage,
        marketingConsent: users.marketingConsent,
        notificationConsent: users.notificationConsent,
        consentUpdatedAt: users.consentUpdatedAt,
        mfaEnabled: users.mfaEnabled,
        emailVerifiedAt: users.emailVerifiedAt,
        phoneVerifiedAt: users.phoneVerifiedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      const err = new Error('User account not found.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    const [
      userConsentRows,
      userBookmarks,
      userSavedSearches,
      userAlertPref,
      userSubs,
      userEnts,
      userPayments,
      userInvoices,
      userDsrs,
    ] = await Promise.all([
      db.select().from(userConsents).where(eq(userConsents.userId, userId)),
      db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
      db.select().from(savedSearches).where(eq(savedSearches.userId, userId)),
      db.select().from(alertPreferences).where(eq(alertPreferences.userId, userId)).limit(1),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      db.select().from(userEntitlements).where(eq(userEntitlements.userId, userId)).limit(1),
      db
        .select({
          id: payments.id,
          txRef: payments.txRef,
          purpose: payments.purpose,
          paymentChannel: payments.paymentChannel,
          subtotalEtb: payments.subtotalEtb,
          vatEtb: payments.vatEtb,
          amountEtb: payments.amountEtb,
          currency: payments.currency,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.userId, userId)),
      db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          subtotalEtb: invoices.subtotalEtb,
          vatEtb: invoices.vatEtb,
          totalEtb: invoices.totalEtb,
          currency: invoices.currency,
          billingName: invoices.billingName,
          billingTin: invoices.billingTin,
          issuedAt: invoices.issuedAt,
          paidAt: invoices.paidAt,
        })
        .from(invoices)
        .where(eq(invoices.userId, userId)),
      db.select().from(dataSubjectRequests).where(eq(dataSubjectRequests.userId, userId)),
    ]);

    await recordAuditEvent({
      actorUserId: userId,
      actorRole: 'user',
      action: 'privacy.data_exported',
      entityType: 'user',
      entityId: userId,
      afterJson: {
        bookmarksCount: userBookmarks.length,
        savedSearchesCount: userSavedSearches.length,
        invoicesCount: userInvoices.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      exportFormat: 'TenderLink-Ethiopia-DSR-Export-v1',
      exportedAt: new Date().toISOString(),
      policyVersion: CURRENT_POLICY_VERSION,
      profile: user,
      consents: userConsentRows,
      alertPreferences: userAlertPref[0] ?? null,
      bookmarks: userBookmarks,
      savedSearches: userSavedSearches,
      subscriptions: userSubs,
      entitlements: userEnts[0] ?? null,
      payments: userPayments,
      invoices: userInvoices,
      dataSubjectRequests: userDsrs,
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Data export failed:', error);
    throw new Error('Could not export personal data.', { cause: error });
  }
}

// ============================================================================
// 3. ACCOUNT DELETION & ANONYMISATION WORKFLOW
// ============================================================================

/**
 * Performs immediate soft-deletion + PII anonymisation on the user account,
 * revokes all active refresh sessions, deletes personal bookmarks/saved searches,
 * and retains only legally-required anonymised accounting/invoice records.
 */
export async function deleteAndAnonymiseAccount(input: {
  userId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!existing) {
      const err = new Error('Account not found or already deleted.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 404;
      throw err;
    }

    const anonTag = existing.id.slice(0, 8);

    // 1. Revoke all active sessions & clear unconsumed OTP codes
    await Promise.all([
      db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.userId, existing.id), isNull(sessions.revokedAt))),
      db.delete(otpCodes).where(eq(otpCodes.userId, existing.id)),
      db.delete(bookmarks).where(eq(bookmarks.userId, existing.id)),
      db.delete(savedSearches).where(eq(savedSearches.userId, existing.id)),
      db.delete(alertPreferences).where(eq(alertPreferences.userId, existing.id)),
      db.delete(notificationEvents).where(eq(notificationEvents.userId, existing.id)),
    ]);

    // 2. Anonymise PII on users table while preserving referential integrity for statutory invoices
    await db
      .update(users)
      .set({
        fullName: `Deleted User (${anonTag})`,
        email: `deleted+${anonTag}@anonymised.tenderlink.invalid`,
        phone: null,
        passwordHash: null,
        mfaEnabled: false,
        mfaSecret: null,
        marketingConsent: false,
        notificationConsent: false,
        isActive: false,
        deletedAt: now,
        deletedById: existing.id,
        anonymisedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id));

    // 3. Scrub personal contact fields from payment records (retain statutory invoice totals)
    await db
      .update(payments)
      .set({
        customerName: `Deleted User (${anonTag})`,
        customerEmail: null,
        customerPhone: null,
        updatedAt: now,
      })
      .where(eq(payments.userId, existing.id));

    await recordAuditEvent({
      actorUserId: existing.id,
      actorRole: 'user',
      action: 'privacy.account_deleted_and_anonymised',
      entityType: 'user',
      entityId: existing.id,
      afterJson: {
        reason: input.reason?.slice(0, 240) || 'user_self_service_deletion',
        anonymisedAt: now.toISOString(),
        sessionsRevoked: true,
        statutoryInvoicesRetainedAnonymised: true,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      deleted: true,
      anonymisedAt: now.toISOString(),
      message:
        'Your account has been deactivated, all sessions revoked, and personal profile data anonymised. Statutory tax invoice totals are retained in anonymised form per retention policy.',
    };
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Account deletion failed:', error);
    throw new Error('Could not complete account deletion.', { cause: error });
  }
}

// ============================================================================
// 4. DATA SUBJECT REQUEST (DSR) WORKFLOW
// ============================================================================

export async function createDataSubjectRequest(input: {
  userId?: string | null;
  requesterEmail: string;
  requestType:
    | 'access'
    | 'rectification'
    | 'erasure'
    | 'portability'
    | 'objection'
    | 'withdraw_consent';
  details: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const now = new Date();
    // Standard 30-day response SLA target (pending Ethiopian legal counsel confirmation)
    const dueAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [created] = await db
      .insert(dataSubjectRequests)
      .values({
        userId: input.userId ?? null,
        requesterEmail: input.requesterEmail.trim().toLowerCase(),
        requestType: input.requestType,
        status: 'submitted',
        details: input.details.trim(),
        dueAt,
      })
      .returning();

    await recordAuditEvent({
      actorUserId: input.userId ?? null,
      actorRole: input.userId ? 'user' : 'data_subject',
      action: 'privacy.dsr_submitted',
      entityType: 'data_subject_request',
      entityId: created.id,
      afterJson: {
        requestType: created.requestType,
        dueAt: created.dueAt.toISOString(),
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      id: created.id,
      requestType: created.requestType,
      status: created.status,
      dueAt: created.dueAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to create DSR:', error);
    throw new Error('Could not submit data-subject request.', { cause: error });
  }
}

export async function resolveDataSubjectRequest(input: {
  requestId: string;
  status: 'in_review' | 'completed' | 'rejected';
  resolutionNotes: string;
  actorUserId?: string | null;
  actorRole?: string;
}) {
  try {
    const now = new Date();
    const [updated] = await db
      .update(dataSubjectRequests)
      .set({
        status: input.status,
        resolutionNotes: input.resolutionNotes.trim(),
        resolvedById: input.actorUserId ?? null,
        resolvedAt: input.status === 'completed' || input.status === 'rejected' ? now : null,
      })
      .where(eq(dataSubjectRequests.id, input.requestId))
      .returning();

    if (!updated) {
      const err = new Error('Data-subject request not found.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    await recordAuditEvent({
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole || 'privacy_officer',
      action: `privacy.dsr_${input.status}`,
      entityType: 'data_subject_request',
      entityId: updated.id,
      afterJson: { status: updated.status, resolutionNotes: updated.resolutionNotes },
    });

    return updated;
  } catch (error) {
    if ((error as Error & { statusCode?: number }).statusCode) throw error;
    console.error('Failed to resolve DSR:', error);
    throw new Error('Could not update data-subject request.', { cause: error });
  }
}

// ============================================================================
// 5. BREACH-RESPONSE & SECURITY INCIDENT WORKFLOW
// ============================================================================

export async function logSecurityIncident(input: {
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRecordsEstimate: number;
  personalDataAffected: boolean;
  summary: string;
  containmentActions?: string;
  reportedById?: string | null;
}) {
  try {
    const [created] = await db
      .insert(securityIncidents)
      .values({
        title: input.title.trim(),
        severity: input.severity,
        status: 'detected',
        affectedRecordsEstimate: Math.max(0, input.affectedRecordsEstimate),
        personalDataAffected: input.personalDataAffected,
        summary: input.summary.trim(),
        containmentActions: input.containmentActions?.trim() || null,
        reportedById: input.reportedById ?? null,
      })
      .returning();

    await recordAuditEvent({
      actorUserId: input.reportedById ?? null,
      actorRole: 'security_admin',
      action: 'security.incident_logged',
      entityType: 'security_incident',
      entityId: created.id,
      afterJson: {
        severity: created.severity,
        personalDataAffected: created.personalDataAffected,
        affectedRecordsEstimate: created.affectedRecordsEstimate,
      },
    });

    return {
      ...created,
      notificationDeadline72h: new Date(
        created.createdAt.getTime() + 72 * 60 * 60 * 1000
      ).toISOString(),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Failed to log security incident:', error);
    throw new Error('Could not log security incident.', { cause: error });
  }
}

// ============================================================================
// 6. DATA RETENTION & EXPIRED-RECORD ANONYMISATION SWEEP
// ============================================================================

export async function runDataRetentionSweep(actor?: {
  userId?: string | null;
  role?: string;
}) {
  try {
    const now = new Date();
    const otpCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // >24h expired OTPs
    const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // >30d expired sessions
    const deletedUserCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const deletedOtps = await db
      .delete(otpCodes)
      .where(or(lt(otpCodes.expiresAt, otpCutoff), isNotNull(otpCodes.consumedAt)))
      .returning({ id: otpCodes.id });

    const deletedSessions = await db
      .delete(sessions)
      .where(or(lt(sessions.expiresAt, sessionCutoff), lt(sessions.revokedAt, sessionCutoff)))
      .returning({ id: sessions.id });

    const unanonymisedDeleted = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNotNull(users.deletedAt),
          lt(users.deletedAt, deletedUserCutoff),
          isNull(users.anonymisedAt)
        )
      );

    let anonymisedCount = 0;
    for (const u of unanonymisedDeleted) {
      const tag = u.id.slice(0, 8);
      await db
        .update(users)
        .set({
          fullName: `Anonymised User (${tag})`,
          email: `anonymised+${tag}@anonymised.tenderlink.invalid`,
          phone: null,
          passwordHash: null,
          mfaSecret: null,
          anonymisedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, u.id));
      anonymisedCount += 1;
    }

    const summary = {
      executedAt: now.toISOString(),
      expiredOtpsPurged: deletedOtps.length,
      expiredSessionsPurged: deletedSessions.length,
      deletedAccountsAnonymised: anonymisedCount,
      retentionPolicySchedule: {
        otpCodes: 'Purged within 24 hours after expiry or consumption',
        revokedSessions: 'Purged 30 days after expiry/revocation',
        softDeletedAccounts: 'Anonymised immediately on self-delete or within 30 days',
        taxInvoices: 'Retained 10 years in accounting archive (confirm with Ethiopian tax advisor)',
        auditLogs: 'Retained 24 months (immutable security & moderation trail)',
      },
    };

    await recordAuditEvent({
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role || 'privacy_admin',
      action: 'privacy.retention_sweep_executed',
      entityType: 'system',
      entityId: 'retention_sweep',
      afterJson: summary,
    });

    return summary;
  } catch (error) {
    console.error('Data retention sweep failed:', error);
    throw new Error('Could not complete data retention sweep.', { cause: error });
  }
}

export async function getPrivacyGovernanceOverview() {
  try {
    const [dsrRows, incidentRows, consentCountRows, recentAuditRows] = await Promise.all([
      db
        .select()
        .from(dataSubjectRequests)
        .orderBy(desc(dataSubjectRequests.createdAt))
        .limit(20),
      db
        .select()
        .from(securityIncidents)
        .orderBy(desc(securityIncidents.createdAt))
        .limit(15),
      db
        .select({
          total: sql<number>`count(*)::int`,
          analyticsOptIn: sql<number>`count(*) filter (where ${userConsents.analyticsConsent} = true)::int`,
          marketingOptIn: sql<number>`count(*) filter (where ${userConsents.marketingConsent} = true)::int`,
          notificationOptIn: sql<number>`count(*) filter (where ${userConsents.notificationConsent} = true)::int`,
        })
        .from(userConsents),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          actorRole: auditLogs.actorRole,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(15),
    ]);

    return {
      policyVersion: CURRENT_POLICY_VERSION,
      consentStats: consentCountRows[0] ?? {
        total: 0,
        analyticsOptIn: 0,
        marketingOptIn: 0,
        notificationOptIn: 0,
      },
      dataSubjectRequests: dsrRows.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        status: r.status,
        requesterEmailMasked:
          r.requesterEmail.slice(0, 2) + '***@' + (r.requesterEmail.split('@')[1] || '***'),
        details: r.details,
        resolutionNotes: r.resolutionNotes,
        dueAt: r.dueAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      securityIncidents: incidentRows.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        affectedRecordsEstimate: i.affectedRecordsEstimate,
        personalDataAffected: i.personalDataAffected,
        summary: i.summary,
        containmentActions: i.containmentActions,
        notificationDeadline72h: new Date(
          i.createdAt.getTime() + 72 * 60 * 60 * 1000
        ).toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
      recentAuditEvents: recentAuditRows.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to load privacy governance overview:', error);
    throw new Error('Could not load privacy and security governance overview.', { cause: error });
  }
}
