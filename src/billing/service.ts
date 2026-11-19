import crypto from 'crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  billingConfig,
  invoices,
  notificationEvents,
  paymentEvents,
  payments,
  planPrices,
  subscriptionPlans,
  subscriptions,
  userEntitlements,
  users,
} from '../db/schema.ts';
import { ensureSeedData } from '../db/seed.ts';
import {
  calculateEthiopianVat,
  generateUniqueTxRef,
  getFriendlyPaymentStatusMessage,
  initializeChapaHostedCheckout,
  isChapaTestMode,
  type PaymentChannel,
  verifyChapaTransactionOnServer,
} from './chapa.ts';
import { maskEmail, maskTin } from '../security/guard.ts';

export const SUPPORTED_PAYMENT_CHANNELS: Array<{
  code: PaymentChannel;
  labelEn: string;
  labelAm: string;
  status: 'primary' | 'planned';
  descriptionEn: string;
  descriptionAm: string;
}> = [
  {
    code: 'telebirr',
    labelEn: 'Telebirr (via Chapa Hosted Checkout)',
    labelAm: 'ቴሌብር (በቻፓ ደህንነቱ የተጠበቀ ክፍያ)',
    status: 'primary',
    descriptionEn: 'Primary instant mobile wallet payment in ETB via Chapa.',
    descriptionAm: 'ዋናው ፈጣን የሞባይል ዋሌት ክፍያ በኢትዮጵያ ብር በቻፓ።',
  },
  {
    code: 'cbe_birr',
    labelEn: 'CBE Birr',
    labelAm: 'ሲቢኢ ብር',
    status: 'planned',
    descriptionEn: 'Available through Chapa hosted checkout where enabled.',
    descriptionAm: 'በቻፓ ሲከፈት የሚገኝ የባንክ ዋሌት።',
  },
  {
    code: 'ebirr',
    labelEn: 'eBirr',
    labelAm: 'ኢ-ብር',
    status: 'planned',
    descriptionEn: 'Supported for future Ethiopian regional wallet expansion.',
    descriptionAm: 'ለወደፊት የክልል ሞባይል ክፍያ ማስፋፊያ።',
  },
  {
    code: 'mpesa',
    labelEn: 'M-Pesa Ethiopia',
    labelAm: 'ኤም-ፔሳ ኢትዮጵያ',
    status: 'planned',
    descriptionEn: 'Supported for Safaricom M-Pesa expansion via Chapa.',
    descriptionAm: 'በቻፓ በኩል ለኤም-ፔሳ ክፍያ ማስፋፊያ።',
  },
  {
    code: 'bank_transfer',
    labelEn: 'Ethiopian Bank Transfer',
    labelAm: 'የባንክ ዝውውር',
    status: 'planned',
    descriptionEn: 'Commercial banks via Chapa hosted checkout.',
    descriptionAm: 'በቻፓ በኩል የኢትዮጵያ ባንኮች ዝውውር።',
  },
  {
    code: 'card',
    labelEn: 'Cards (Hosted by Chapa)',
    labelAm: 'ካርድ (በቻፓ ገፅ ብቻ)',
    status: 'planned',
    descriptionEn: 'Handled exclusively on Chapa hosted checkout — zero card data touches our servers.',
    descriptionAm: 'በቻፓ ገፅ ብቻ የሚስተናገድ፤ ምንም የካርድ መረጃ ሰርቨራችን ላይ አይቀመጥም።',
  },
];

async function getOrCreateBillingConfig() {
  await ensureSeedData();
  const [cfg] = await db
    .select()
    .from(billingConfig)
    .where(eq(billingConfig.configKey, 'default'))
    .limit(1);

  if (cfg) return cfg;

  const [created] = await db
    .insert(billingConfig)
    .values({
      configKey: 'default',
      currency: 'ETB',
      vatEnabled: true,
      vatRateBps: 1500,
      invoicePrefix: 'TL-ET',
      nextInvoiceSequence: 1,
      testModeEnabled: true,
    })
    .returning();
  return created;
}

async function allocateSequentialInvoiceNumber(): Promise<string> {
  const [updated] = await db
    .update(billingConfig)
    .set({
      nextInvoiceSequence: sql`${billingConfig.nextInvoiceSequence} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(billingConfig.configKey, 'default'))
    .returning({
      prefix: billingConfig.invoicePrefix,
      seq: billingConfig.nextInvoiceSequence,
    });

  const prefix = updated?.prefix || 'TL-ET';
  const seqNumber = Math.max(1, (updated?.seq ?? 2) - 1);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(seqNumber).padStart(6, '0')}`;
}

/**
 * Resolves a real user row for checkout (or creates a billing-scoped seeker
 * profile for email/phone if checking out before Milestone 2 Web Login UI).
 */
async function resolveBillingUser(params: {
  userId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
}) {
  if (params.userId) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    if (existing) return existing;
  }

  const normalizedEmail = params.email.trim().toLowerCase();
  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (byEmail) return byEmail;

  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      phone: params.phone?.trim() || null,
      fullName: params.fullName.trim(),
      preferredLanguage: 'en',
    })
    .returning();

  return created;
}

export async function getBillingCatalog() {
  try {
    await ensureSeedData();
    const [cfg, plans, prices] = await Promise.all([
      getOrCreateBillingConfig(),
      db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(asc(subscriptionPlans.sortOrder)),
      db
        .select()
        .from(planPrices)
        .where(eq(planPrices.isActive, true))
        .orderBy(asc(planPrices.amountEtb)),
    ]);

    const pricesByPlan = new Map<string, typeof prices>();
    for (const pr of prices) {
      const list = pricesByPlan.get(pr.planId) ?? [];
      list.push(pr);
      pricesByPlan.set(pr.planId, list);
    }

    return {
      currency: 'ETB' as const,
      testMode: isChapaTestMode(),
      vat: {
        enabled: cfg.vatEnabled,
        rateBps: cfg.vatRateBps,
        ratePercent: Number((cfg.vatRateBps / 100).toFixed(2)),
        supplierLegalName: cfg.supplierLegalName,
        supplierTin: cfg.supplierTin,
        invoicePrefix: cfg.invoicePrefix,
      },
      paymentChannels: SUPPORTED_PAYMENT_CHANNELS,
      plans: plans.map((plan) => ({
        ...plan,
        features: (plan.featuresJson as Array<{ en: string; am: string }>) || [],
        prices: (pricesByPlan.get(plan.id) ?? []).map((pr) => ({
          id: pr.id,
          priceCode: pr.priceCode,
          interval: pr.interval,
          amountEtb: pr.amountEtb,
          currency: pr.currency,
          trialDays: pr.trialDays,
          vatBreakdown: calculateEthiopianVat(
            pr.amountEtb,
            cfg.vatRateBps,
            cfg.vatEnabled
          ),
        })),
      })),
    };
  } catch (error) {
    console.error('Failed to load billing catalog:', error);
    throw new Error('Could not load ETB billing plans.', { cause: error });
  }
}

export interface InitiateCheckoutInput {
  userId?: string | null;
  priceCode: string;
  paymentChannel: PaymentChannel;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  billingTin?: string;
  idempotencyKey?: string;
}

export async function initiateChapaCheckout(input: InitiateCheckoutInput) {
  try {
    await ensureSeedData();
    const cfg = await getOrCreateBillingConfig();

    // Idempotency protection on checkout creation
    if (input.idempotencyKey) {
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existingPayment) {
        const [existingInvoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.paymentId, existingPayment.id))
          .limit(1);
        return {
          paymentId: existingPayment.id,
          txRef: existingPayment.txRef,
          status: existingPayment.status,
          checkoutUrl: existingPayment.checkoutUrl,
          testMode: existingPayment.testMode,
          invoiceNumber: existingInvoice?.invoiceNumber ?? null,
          subtotalEtb: existingPayment.subtotalEtb,
          vatRateBps: existingPayment.vatRateBps,
          vatEtb: existingPayment.vatEtb,
          totalEtb: existingPayment.amountEtb,
          currency: 'ETB' as const,
          paymentChannel: existingPayment.paymentChannel,
          idempotentReplay: true,
        };
      }
    }

    // Load authoritative price & plan from DB (NEVER trust client price!)
    const [priceRow] = await db
      .select()
      .from(planPrices)
      .where(and(eq(planPrices.priceCode, input.priceCode), eq(planPrices.isActive, true)))
      .limit(1);

    if (!priceRow) {
      const err = new Error(`Selected plan price "${input.priceCode}" is unavailable.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'PRICE_NOT_FOUND';
      throw err;
    }

    const [planRow] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, priceRow.planId))
      .limit(1);

    if (!planRow) {
      const err = new Error('Associated subscription plan not found.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'PLAN_NOT_FOUND';
      throw err;
    }

    const user = await resolveBillingUser({
      userId: input.userId,
      fullName: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    });

    // Free plan activates directly without Chapa payment
    if (priceRow.amountEtb === 0 || planRow.code === 'free') {
      const freeSub = await upsertUserEntitlementsFromPlan({
        userId: user.id,
        plan: planRow,
        subscriptionId: null,
        effectiveUntil: null,
        addListingCredits: 0,
      });
      return {
        freeActivated: true,
        planCode: planRow.code,
        entitlements: freeSub,
      };
    }

    const vat = calculateEthiopianVat(
      priceRow.amountEtb,
      cfg.vatRateBps,
      cfg.vatEnabled
    );
    const txRef = generateUniqueTxRef(cfg.invoicePrefix);
    const isPerListing = priceRow.interval === 'per_listing';
    const purpose = isPerListing ? 'publisher_listing' : 'subscription';

    // 1. Create incomplete subscription row for recurring plans (NEVER active before verified payment!)
    let subscriptionId: string | null = null;
    if (!isPerListing) {
      const [sub] = await db
        .insert(subscriptions)
        .values({
          userId: user.id,
          planId: planRow.id,
          priceId: priceRow.id,
          interval: priceRow.interval,
          status: 'incomplete',
        })
        .returning({ id: subscriptions.id });
      subscriptionId = sub.id;
    }

    // 2. Call Chapa Hosted Checkout initializer on the server
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const nameParts = input.customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'Ethiopia';

    const chapaInit = await initializeChapaHostedCheckout({
      txRef,
      amountEtb: vat.totalEtb,
      currency: 'ETB',
      email: user.email || input.customerEmail.trim().toLowerCase(),
      firstName,
      lastName,
      phoneNumber: input.customerPhone?.trim() || undefined,
      returnUrl: `${appUrl}/?billing_return_tx=${encodeURIComponent(txRef)}`,
      callbackUrl: `${appUrl}/api/v1/webhooks/chapa`,
      title: `TenderLink ${planRow.nameEn}`,
      description: `${planRow.nameEn} (${priceRow.interval}) · ETB ${vat.totalEtb} incl. VAT`,
      paymentChannel: input.paymentChannel,
    });

    // 3. Persist pending payment row
    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        subscriptionId,
        planId: planRow.id,
        priceId: priceRow.id,
        purpose,
        provider: 'chapa',
        paymentChannel: input.paymentChannel,
        txRef,
        providerRef: chapaInit.providerRef,
        idempotencyKey: input.idempotencyKey || null,
        paymentMethod: input.paymentChannel,
        subtotalEtb: vat.subtotalEtb,
        vatRateBps: vat.vatRateBps,
        vatEtb: vat.vatEtb,
        amountEtb: vat.totalEtb,
        currency: 'ETB',
        status: 'pending',
        testMode: chapaInit.testMode,
        checkoutUrl: chapaInit.checkoutUrl,
        customerName: input.customerName.trim(),
        customerEmail: user.email || input.customerEmail.trim().toLowerCase(),
        customerPhone: input.customerPhone?.trim() || null,
        billingTin: input.billingTin?.trim() || null,
        rawWebhookMetaJson: chapaInit.sanitizedMeta,
      })
      .returning();

    // 4. Generate sequential ETB invoice number & create issued invoice
    const invoiceNumber = await allocateSequentialInvoiceNumber();
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        userId: user.id,
        subscriptionId,
        paymentId: payment.id,
        status: 'issued',
        subtotalEtb: vat.subtotalEtb,
        vatRateBps: vat.vatRateBps,
        vatEtb: vat.vatEtb,
        totalEtb: vat.totalEtb,
        currency: 'ETB',
        lineItemsJson: [
          {
            description: `TenderLink Ethiopia — ${planRow.nameEn} (${priceRow.interval.replace('_', ' ')})`,
            quantity: 1,
            unitPriceEtb: vat.subtotalEtb,
            totalEtb: vat.subtotalEtb,
          },
        ],
        billingName: input.customerName.trim(),
        billingEmail: user.email || input.customerEmail.trim().toLowerCase(),
        billingPhone: input.customerPhone?.trim() || null,
        billingTin: input.billingTin?.trim() || null,
      })
      .returning();

    // 5. Log sanitized payment event & immutable audit log (zero card data)
    await Promise.all([
      db.insert(paymentEvents).values({
        paymentId: payment.id,
        txRef,
        eventType: 'checkout.initialized',
        source: 'checkout_init',
        statusBefore: null,
        statusAfter: 'pending',
        sanitizedPayloadJson: {
          planCode: planRow.code,
          priceCode: priceRow.priceCode,
          interval: priceRow.interval,
          channel: input.paymentChannel,
          subtotalEtb: vat.subtotalEtb,
          vatEtb: vat.vatEtb,
          totalEtb: vat.totalEtb,
          currency: 'ETB',
          invoiceNumber,
          mode: chapaInit.modeLabel,
        },
      }),
      db.insert(auditLogs).values({
        actorUserId: user.id,
        actorRole: 'customer',
        action: 'billing.checkout_initialized',
        entityType: 'payment',
        entityId: payment.id,
        afterJson: {
          txRef,
          invoiceNumber,
          planCode: planRow.code,
          amountEtb: vat.totalEtb,
          currency: 'ETB',
          channel: input.paymentChannel,
          testMode: chapaInit.testMode,
        },
      }),
    ]);

    return {
      freeActivated: false,
      paymentId: payment.id,
      txRef,
      status: payment.status,
      checkoutUrl: chapaInit.checkoutUrl,
      testMode: chapaInit.testMode,
      modeLabel: chapaInit.modeLabel,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      planCode: planRow.code,
      planNameEn: planRow.nameEn,
      planNameAm: planRow.nameAm,
      interval: priceRow.interval,
      trialDays: priceRow.trialDays,
      subtotalEtb: vat.subtotalEtb,
      vatRateBps: vat.vatRateBps,
      vatEtb: vat.vatEtb,
      totalEtb: vat.totalEtb,
      currency: 'ETB' as const,
      paymentChannel: input.paymentChannel,
      idempotentReplay: false,
    };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error;
    console.error('Chapa checkout initialization failed:', error);
    throw new Error('Failed to start Chapa hosted checkout.', { cause: error });
  }
}

async function upsertUserEntitlementsFromPlan(params: {
  userId: string;
  plan: typeof subscriptionPlans.$inferSelect;
  subscriptionId: string | null;
  effectiveUntil: Date | null;
  addListingCredits: number;
}) {
  const [existing] = await db
    .select()
    .from(userEntitlements)
    .where(eq(userEntitlements.userId, params.userId))
    .limit(1);

  const nextCredits = (existing?.listingCreditsRemaining ?? 0) + params.addListingCredits;

  const values = {
    userId: params.userId,
    planCode: params.plan.code,
    subscriptionId: params.subscriptionId,
    maxBookmarks: params.plan.maxBookmarks,
    maxSavedSearches: params.plan.maxSavedSearches,
    unlimitedSearch: params.plan.code !== 'free',
    dailyEmailAlerts: params.plan.code !== 'free',
    instantAlerts: params.plan.instantAlerts,
    pushAlerts: params.plan.pushAlerts,
    smsTelegramAlerts: params.plan.smsTelegramAlerts,
    advancedFilters: params.plan.advancedFilters,
    fullDocumentAccess: params.plan.fullDocumentAccess,
    buyerTracking: params.plan.buyerTracking,
    prioritySupport: params.plan.prioritySupport,
    unlimitedListings: params.plan.unlimitedListings,
    featuredPlacement: params.plan.featuredPlacement,
    targetedAlerts: params.plan.targetedAlerts,
    advancedAnalytics: params.plan.advancedAnalytics,
    accountManagerSupport: params.plan.accountManagerSupport,
    listingCreditsRemaining: nextCredits,
    effectiveFrom: new Date(),
    effectiveUntil: params.effectiveUntil,
    updatedAt: new Date(),
  };

  const [saved] = await db
    .insert(userEntitlements)
    .values(values)
    .onConflictDoUpdate({
      target: userEntitlements.userId,
      set: values,
    })
    .returning();

  return saved;
}

/**
 * Verifies a payment strictly on the server (NEVER trusts client-side success!).
 * Activates subscription / entitlements and queues email receipt ONLY when
 * verified status === 'succeeded' with matching ETB amount and txRef.
 */
export async function verifyCheckoutPaymentOnServer(params: {
  txRef: string;
  testModeOutcome?: 'succeeded' | 'pending' | 'processing' | 'failed' | 'cancelled';
  testModeFailureReason?: string;
}) {
  try {
    await ensureSeedData();

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.txRef, params.txRef))
      .limit(1);

    if (!payment) {
      const err = new Error(`Transaction reference "${params.txRef}" not found.`) as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'PAYMENT_NOT_FOUND';
      throw err;
    }

    // Idempotent guard: already finalized as succeeded
    if (payment.status === 'succeeded') {
      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.paymentId, payment.id))
        .limit(1);
      const [ent] = await db
        .select()
        .from(userEntitlements)
        .where(eq(userEntitlements.userId, payment.userId))
        .limit(1);
      const msg = getFriendlyPaymentStatusMessage('succeeded');
      return {
        txRef: payment.txRef,
        status: payment.status,
        alreadyVerified: true,
        amountEtb: payment.amountEtb,
        currency: payment.currency,
        invoiceNumber: inv?.invoiceNumber ?? null,
        receiptEmailSentAt: inv?.receiptEmailSentAt?.toISOString() ?? null,
        entitlements: ent ?? null,
        feedback: msg,
      };
    }

    // Never allow client-supplied testModeOutcome on non-test payments
    const effectiveTestOutcome = payment.testMode ? params.testModeOutcome : undefined;

    const verified = await verifyChapaTransactionOnServer({
      txRef: payment.txRef,
      expectedAmountEtb: payment.amountEtb,
      expectedCurrency: 'ETB',
      paymentChannel: payment.paymentChannel,
      testModeOutcome: effectiveTestOutcome,
      testModeFailureReason: params.testModeFailureReason,
    });

    const now = new Date();
    const statusBefore = payment.status;

    await db
      .update(payments)
      .set({
        status: verified.status,
        providerRef: verified.providerRef || payment.providerRef,
        paymentMethod: verified.paymentMethod,
        failureReason: verified.failureReason,
        webhookVerifiedAt: verified.status === 'succeeded' ? now : payment.webhookVerifiedAt,
        rawWebhookMetaJson: verified.sanitizedMeta,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));

    await db.insert(paymentEvents).values({
      paymentId: payment.id,
      txRef: payment.txRef,
      eventType: `payment.verified_${verified.status}`,
      source: 'server_verify',
      statusBefore,
      statusAfter: verified.status,
      sanitizedPayloadJson: verified.sanitizedMeta,
    });

    let activatedEntitlements: typeof userEntitlements.$inferSelect | null = null;
    let invoiceNumber: string | null = null;
    let receiptEmailSentAt: string | null = null;

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, payment.id))
      .limit(1);
    invoiceNumber = invoice?.invoiceNumber ?? null;

    // ONLY activate subscription/entitlements & mark invoice paid when server verifies 'succeeded'
    if (verified.status === 'succeeded') {
      const [planRow] = payment.planId
        ? await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, payment.planId))
            .limit(1)
        : [];
      const [priceRow] = payment.priceId
        ? await db
            .select()
            .from(planPrices)
            .where(eq(planPrices.id, payment.priceId))
            .limit(1)
        : [];

      const periodDays =
        priceRow?.interval === 'annual' ? 365 : 30;
      const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
      const trialEndsAt =
        priceRow && priceRow.trialDays > 0
          ? new Date(now.getTime() + priceRow.trialDays * 24 * 60 * 60 * 1000)
          : null;

      if (payment.subscriptionId) {
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt,
            failedPaymentCount: 0,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, payment.subscriptionId));
      }

      if (planRow) {
        activatedEntitlements = await upsertUserEntitlementsFromPlan({
          userId: payment.userId,
          plan: planRow,
          subscriptionId: payment.subscriptionId,
          effectiveUntil: priceRow?.interval === 'per_listing' ? null : periodEnd,
          addListingCredits: planRow.code === 'publisher_basic' ? 1 : 0,
        });
      }

      if (invoice) {
        await db
          .update(invoices)
          .set({
            status: 'paid',
            paidAt: now,
            receiptEmailSentAt: now,
          })
          .where(eq(invoices.id, invoice.id));
        receiptEmailSentAt = now.toISOString();

        // Queue idempotent payment receipt email in notification_events
        await db
          .insert(notificationEvents)
          .values({
            userId: payment.userId,
            channel: 'email',
            eventType: 'payment_receipt',
            dedupeKey: `receipt:${payment.txRef}`,
            language: 'en',
            subject: `TenderLink Ethiopia Payment Receipt — ${invoice.invoiceNumber} (ETB ${payment.amountEtb})`,
            body: `Thank you for your payment via Chapa (${payment.paymentChannel}). Invoice ${invoice.invoiceNumber}: Subtotal ETB ${payment.subtotalEtb}, VAT (${(payment.vatRateBps / 100).toFixed(0)}%) ETB ${payment.vatEtb}, Total Paid ETB ${payment.amountEtb}. Reference: ${payment.txRef}.`,
            payloadJson: {
              invoiceNumber: invoice.invoiceNumber,
              txRef: payment.txRef,
              subtotalEtb: payment.subtotalEtb,
              vatEtb: payment.vatEtb,
              totalEtb: payment.amountEtb,
              currency: 'ETB',
              recipientEmail: invoice.billingEmail,
            },
            status: 'queued',
          })
          .onConflictDoNothing();
      }
    } else if (verified.status === 'failed' || verified.status === 'cancelled') {
      if (payment.subscriptionId) {
        await db
          .update(subscriptions)
          .set({
            failedPaymentCount: sql`${subscriptions.failedPaymentCount} + 1`,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, payment.subscriptionId));
      }
      if (invoice && verified.status === 'cancelled') {
        await db
          .update(invoices)
          .set({ status: 'void', voidedAt: now })
          .where(eq(invoices.id, invoice.id));
      }
    }

    await db.insert(auditLogs).values({
      actorUserId: payment.userId,
      actorRole: 'system_billing',
      action: `billing.payment_${verified.status}`,
      entityType: 'payment',
      entityId: payment.id,
      beforeJson: { status: statusBefore },
      afterJson: {
        status: verified.status,
        txRef: payment.txRef,
        amountEtb: payment.amountEtb,
        currency: 'ETB',
        invoiceNumber,
        failureReason: verified.failureReason,
      },
    });

    const feedback = getFriendlyPaymentStatusMessage(
      verified.status,
      verified.failureReason
    );

    return {
      txRef: payment.txRef,
      status: verified.status,
      alreadyVerified: false,
      amountEtb: payment.amountEtb,
      subtotalEtb: payment.subtotalEtb,
      vatEtb: payment.vatEtb,
      currency: payment.currency,
      paymentChannel: payment.paymentChannel,
      invoiceNumber,
      receiptEmailSentAt,
      failureReason: verified.failureReason,
      entitlements: activatedEntitlements,
      feedback,
    };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error;
    console.error('Server-side payment verification failed:', error);
    throw new Error('Failed to verify payment status.', { cause: error });
  }
}

export async function getBillingHistory(params?: {
  email?: string | null;
  userId?: string | null;
  redactPii?: boolean;
}) {
  try {
    await ensureSeedData();
    const shouldRedact = Boolean(params?.redactPii);

    let targetUserId: string | null = params?.userId ?? null;
    if (!targetUserId && params?.email?.trim()) {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, params.email.trim().toLowerCase()))
        .limit(1);
      targetUserId = u?.id ?? null;
    }

    const paymentRows = targetUserId
      ? await db
          .select()
          .from(payments)
          .where(eq(payments.userId, targetUserId))
          .orderBy(desc(payments.createdAt))
          .limit(25)
      : await db
          .select()
          .from(payments)
          .orderBy(desc(payments.createdAt))
          .limit(25);

    const invoiceRows = targetUserId
      ? await db
          .select()
          .from(invoices)
          .where(eq(invoices.userId, targetUserId))
          .orderBy(desc(invoices.issuedAt))
          .limit(25)
      : await db
          .select()
          .from(invoices)
          .orderBy(desc(invoices.issuedAt))
          .limit(25);

    const entitlementRows = targetUserId
      ? await db
          .select()
          .from(userEntitlements)
          .where(eq(userEntitlements.userId, targetUserId))
          .limit(1)
      : await db
          .select()
          .from(userEntitlements)
          .orderBy(desc(userEntitlements.updatedAt))
          .limit(5);

    const recentEvents = await db
      .select()
      .from(paymentEvents)
      .orderBy(desc(paymentEvents.createdAt))
      .limit(20);

    return {
      piiRedacted: shouldRedact,
      payments: paymentRows.map((p) => ({
        id: p.id,
        txRef: p.txRef,
        provider: p.provider,
        paymentChannel: p.paymentChannel,
        purpose: p.purpose,
        subtotalEtb: p.subtotalEtb,
        vatRateBps: p.vatRateBps,
        vatEtb: p.vatEtb,
        amountEtb: p.amountEtb,
        currency: p.currency,
        status: p.status,
        testMode: p.testMode,
        customerName: shouldRedact ? 'Verified Customer' : p.customerName,
        customerEmail: shouldRedact ? maskEmail(p.customerEmail) : p.customerEmail,
        failureReason: p.failureReason,
        checkoutUrl: p.checkoutUrl,
        createdAt: p.createdAt.toISOString(),
        verifiedAt: p.webhookVerifiedAt?.toISOString() ?? null,
      })),
      invoices: invoiceRows.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        subtotalEtb: inv.subtotalEtb,
        vatRateBps: inv.vatRateBps,
        vatEtb: inv.vatEtb,
        totalEtb: inv.totalEtb,
        currency: inv.currency,
        billingName: shouldRedact ? 'Verified Customer' : inv.billingName,
        billingEmail: shouldRedact ? maskEmail(inv.billingEmail) : inv.billingEmail,
        billingTin: shouldRedact ? maskTin(inv.billingTin) : inv.billingTin,
        lineItems: inv.lineItemsJson,
        issuedAt: inv.issuedAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        receiptEmailSentAt: inv.receiptEmailSentAt?.toISOString() ?? null,
      })),
      entitlements: entitlementRows.map((e) => ({
        ...e,
        effectiveFrom: e.effectiveFrom.toISOString(),
        effectiveUntil: e.effectiveUntil?.toISOString() ?? null,
        updatedAt: e.updatedAt.toISOString(),
      })),
      recentEvents: recentEvents.map((ev) => ({
        id: ev.id,
        txRef: ev.txRef,
        eventType: ev.eventType,
        source: ev.source,
        statusBefore: ev.statusBefore,
        statusAfter: ev.statusAfter,
        createdAt: ev.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Failed to load billing history:', error);
    throw new Error('Could not load billing history and invoices.', { cause: error });
  }
}

export async function getPaymentStatusByTxRef(txRef: string) {
  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.txRef, txRef))
      .limit(1);

    if (!payment) {
      const err = new Error('Transaction not found.') as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 404;
      err.code = 'PAYMENT_NOT_FOUND';
      throw err;
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, payment.id))
      .limit(1);

    const feedback = getFriendlyPaymentStatusMessage(
      payment.status === 'partially_refunded' ? 'refunded' : payment.status,
      payment.failureReason
    );

    return {
      txRef: payment.txRef,
      status: payment.status,
      testMode: payment.testMode,
      paymentChannel: payment.paymentChannel,
      subtotalEtb: payment.subtotalEtb,
      vatRateBps: payment.vatRateBps,
      vatEtb: payment.vatEtb,
      amountEtb: payment.amountEtb,
      currency: payment.currency,
      customerName: payment.customerName,
      customerEmail: payment.customerEmail,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      invoiceStatus: invoice?.status ?? null,
      receiptEmailSentAt: invoice?.receiptEmailSentAt?.toISOString() ?? null,
      failureReason: payment.failureReason,
      feedback,
    };
  } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error;
    console.error('Failed to read payment status:', error);
    throw new Error('Failed to load transaction status.', { cause: error });
  }
}
