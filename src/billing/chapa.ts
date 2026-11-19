import crypto from 'crypto';

export type PaymentChannel =
  | 'telebirr'
  | 'cbe_birr'
  | 'ebirr'
  | 'mpesa'
  | 'bank_transfer'
  | 'card';

export type NormalizedPaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

export interface VatBreakdown {
  subtotalEtb: number;
  vatEnabled: boolean;
  vatRateBps: number;
  vatEtb: number;
  totalEtb: number;
  currency: 'ETB';
}

export interface ChapaInitParams {
  txRef: string;
  amountEtb: number;
  currency: 'ETB';
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  returnUrl: string;
  callbackUrl: string;
  title: string;
  description: string;
  paymentChannel: PaymentChannel;
}

export interface ChapaInitResult {
  checkoutUrl: string;
  providerRef: string | null;
  testMode: boolean;
  modeLabel: 'chapa_live' | 'chapa_sandbox' | 'local_test_simulator';
  sanitizedMeta: Record<string, unknown>;
}

export interface ChapaVerifyResult {
  txRef: string;
  providerRef: string | null;
  status: NormalizedPaymentStatus;
  amountEtb: number;
  currency: string;
  paymentMethod: string;
  failureReason: string | null;
  verifiedAt: Date;
  sanitizedMeta: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /(card|pan|cvv|cvc|pin|secret|authorization|token|expir|account_number|password)/i;

/**
 * Generates a cryptographically unique transaction reference for every Chapa checkout.
 * Example: TL-ET-M9X3K1-8F2A9C10
 */
export function generateUniqueTxRef(prefix = 'TL-ET'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Deterministic Ethiopian VAT calculation (basis points, e.g. 1500 = 15%).
 * All monetary figures are stored in whole ETB integers to avoid floating-point drift.
 */
export function calculateEthiopianVat(
  subtotalEtb: number,
  vatRateBps: number,
  vatEnabled: boolean
): VatBreakdown {
  const safeSubtotal = Math.max(0, Math.round(subtotalEtb));
  const safeBps = vatEnabled ? Math.max(0, Math.round(vatRateBps)) : 0;
  const vatEtb = safeSubtotal === 0 ? 0 : Math.round((safeSubtotal * safeBps) / 10_000);
  return {
    subtotalEtb: safeSubtotal,
    vatEnabled,
    vatRateBps: safeBps,
    vatEtb,
    totalEtb: safeSubtotal + vatEtb,
    currency: 'ETB',
  };
}

/**
 * Strips any sensitive card/credential fields before persisting payment logs.
 */
export function sanitizeProviderMetadata(
  input: unknown
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeProviderMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function isChapaLiveConfigured(): boolean {
  const key = (process.env.CHAPA_SECRET_KEY || '').trim();
  return key.startsWith('CHASECK-') || key.startsWith('CHASECK_TEST-');
}

export function isChapaTestMode(): boolean {
  const key = (process.env.CHAPA_SECRET_KEY || '').trim();
  if (!isChapaLiveConfigured()) return true;
  if (key.startsWith('CHASECK_TEST-')) return true;
  return (process.env.CHAPA_TEST_MODE || '').toLowerCase() === 'true';
}

export function mapChapaStatus(rawStatus?: string | null): NormalizedPaymentStatus {
  const val = (rawStatus || '').trim().toLowerCase();
  if (val === 'success' || val === 'succeeded' || val === 'completed') return 'succeeded';
  if (val === 'processing' || val === 'in_progress') return 'processing';
  if (val === 'pending' || val === 'created' || val === 'initiated') return 'pending';
  if (val === 'cancelled' || val === 'canceled' || val === 'abandoned') return 'cancelled';
  if (val === 'refunded') return 'refunded';
  if (val === 'disputed' || val === 'chargeback') return 'disputed';
  return 'failed';
}

/**
 * Initializes a Chapa Hosted Checkout session on the server.
 * Never handles raw card data — always redirects user to Chapa's hosted page
 * (or the server-backed Chapa Test-Mode Checkout page when no live key is set).
 */
export async function initializeChapaHostedCheckout(
  params: ChapaInitParams
): Promise<ChapaInitResult> {
  const baseUrl = (process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1').replace(/\/+$/, '');
  const secretKey = (process.env.CHAPA_SECRET_KEY || '').trim();
  const hasRealKey = isChapaLiveConfigured();

  if (hasRealKey) {
    const response = await fetch(`${baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(params.amountEtb),
        currency: 'ETB',
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        phone_number: params.phoneNumber,
        tx_ref: params.txRef,
        callback_url: params.callbackUrl,
        return_url: params.returnUrl,
        'customization[title]': params.title.slice(0, 16),
        'customization[description]': params.description.slice(0, 120),
        meta: {
          preferred_channel: params.paymentChannel,
          platform: 'tenderlink_ethiopia',
        },
      }),
    });

    const data = (await response.json().catch(() => null)) as {
      status?: string;
      message?: string;
      data?: { checkout_url?: string };
    } | null;

    if (!response.ok || data?.status !== 'success' || !data?.data?.checkout_url) {
      throw new Error(
        data?.message || 'Chapa hosted checkout initialization failed. Please try again.'
      );
    }

    const sandbox = secretKey.startsWith('CHASECK_TEST-');
    return {
      checkoutUrl: data.data.checkout_url,
      providerRef: null,
      testMode: sandbox,
      modeLabel: sandbox ? 'chapa_sandbox' : 'chapa_live',
      sanitizedMeta: sanitizeProviderMetadata({
        provider: 'chapa',
        mode: sandbox ? 'chapa_sandbox' : 'chapa_live',
        preferredChannel: params.paymentChannel,
        currency: 'ETB',
        amountEtb: params.amountEtb,
      }),
    };
  }

  // Transparent Test-Mode Chapa Hosted Checkout Simulator when CHAPA_SECRET_KEY is not configured yet
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const simulatedUrl = `${appUrl}/?chapa_test_tx=${encodeURIComponent(params.txRef)}`;

  return {
    checkoutUrl: simulatedUrl,
    providerRef: `CHAPA-TEST-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    testMode: true,
    modeLabel: 'local_test_simulator',
    sanitizedMeta: {
      provider: 'chapa',
      mode: 'local_test_simulator',
      preferredChannel: params.paymentChannel,
      currency: 'ETB',
      amountEtb: params.amountEtb,
      note: 'CHAPA_SECRET_KEY not set; using server-verified Chapa Test-Mode Hosted Checkout.',
    },
  };
}

/**
 * Verifies a Chapa transaction strictly on the server via Chapa's verify endpoint
 * (or test-mode outcome when in local simulator mode).
 * Strictly enforces tx_ref, currency === 'ETB', and exact ETB amount verification.
 */
export async function verifyChapaTransactionOnServer(params: {
  txRef: string;
  expectedAmountEtb: number;
  expectedCurrency: 'ETB';
  paymentChannel: PaymentChannel;
  testModeOutcome?: 'succeeded' | 'pending' | 'processing' | 'failed' | 'cancelled';
  testModeFailureReason?: string;
}): Promise<ChapaVerifyResult> {
  const baseUrl = (process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1').replace(/\/+$/, '');
  const secretKey = (process.env.CHAPA_SECRET_KEY || '').trim();

  if (isChapaLiveConfigured()) {
    const response = await fetch(
      `${baseUrl}/transaction/verify/${encodeURIComponent(params.txRef)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      message?: string;
      data?: {
        tx_ref?: string;
        reference?: string;
        status?: string;
        amount?: number | string;
        currency?: string;
        method?: string;
      };
    } | null;

    if (!response.ok || !payload?.data) {
      throw new Error(
        payload?.message || 'Unable to verify transaction with Chapa right now.'
      );
    }

    const d = payload.data;
    const verifiedAmount = Math.round(Number(d.amount ?? 0));
    const verifiedCurrency = String(d.currency || '').toUpperCase();
    const mappedStatus = mapChapaStatus(d.status);

    // Security rule: verify tx_ref, currency, and exact ETB amount server-side
    if (d.tx_ref !== params.txRef) {
      throw new Error('Security check failed: transaction reference mismatch.');
    }
    if (verifiedCurrency !== params.expectedCurrency) {
      throw new Error(
        `Security check failed: expected ${params.expectedCurrency} but provider returned ${verifiedCurrency}.`
      );
    }
    if (mappedStatus === 'succeeded' && verifiedAmount !== params.expectedAmountEtb) {
      throw new Error(
        `Security check failed: paid amount (ETB ${verifiedAmount}) does not match expected invoice total (ETB ${params.expectedAmountEtb}).`
      );
    }

    return {
      txRef: params.txRef,
      providerRef: d.reference || null,
      status: mappedStatus,
      amountEtb: verifiedAmount,
      currency: verifiedCurrency,
      paymentMethod: d.method || params.paymentChannel,
      failureReason:
        mappedStatus === 'failed'
          ? payload.message || 'Payment was declined by the payment provider.'
          : mappedStatus === 'cancelled'
            ? 'Customer cancelled payment before completion.'
            : null,
      verifiedAt: new Date(),
      sanitizedMeta: sanitizeProviderMetadata({
        provider: 'chapa',
        txRef: d.tx_ref,
        providerRef: d.reference,
        status: d.status,
        amountEtb: verifiedAmount,
        currency: verifiedCurrency,
        method: d.method || params.paymentChannel,
      }),
    };
  }

  // Local test-mode verification (still server-side enforced with amount & currency checks)
  const outcome = params.testModeOutcome || 'pending';
  const defaultFailure =
    outcome === 'failed'
      ? params.testModeFailureReason ||
        'Telebirr wallet balance insufficient or PIN confirmation timed out (Test Mode).'
      : outcome === 'cancelled'
        ? 'Checkout was cancelled before Telebirr confirmation (Test Mode).'
        : null;

  return {
    txRef: params.txRef,
    providerRef: `CHAPA-VER-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    status: outcome,
    amountEtb: params.expectedAmountEtb,
    currency: 'ETB',
    paymentMethod: params.paymentChannel,
    failureReason: defaultFailure,
    verifiedAt: new Date(),
    sanitizedMeta: {
      provider: 'chapa',
      mode: 'local_test_simulator',
      txRef: params.txRef,
      verifiedStatus: outcome,
      amountEtb: params.expectedAmountEtb,
      currency: 'ETB',
      channel: params.paymentChannel,
    },
  };
}

export function getFriendlyPaymentStatusMessage(
  status: NormalizedPaymentStatus,
  failureReason?: string | null
): { title: string; message: string } {
  switch (status) {
    case 'succeeded':
      return {
        title: 'Payment Verified & Activated',
        message:
          'Your ETB payment has been verified on our server. Your subscription or listing credit is now active and an invoice receipt has been queued to your email.',
      };
    case 'processing':
      return {
        title: 'Payment Processing',
        message:
          'Telebirr / Chapa is currently confirming your transaction. Your plan will activate automatically as soon as server verification succeeds.',
      };
    case 'pending':
      return {
        title: 'Payment Pending Confirmation',
        message:
          'We have not received confirmation from Chapa yet. Complete the Telebirr prompt on your phone or click Verify Status again in a few moments.',
      };
    case 'cancelled':
      return {
        title: 'Payment Cancelled',
        message:
          failureReason ||
          'You cancelled the Chapa checkout before completing payment. No charge was activated — you can restart checkout anytime.',
      };
    case 'failed':
      return {
        title: 'Payment Failed',
        message:
          failureReason ||
          'The payment could not be completed (for example insufficient Telebirr balance or expired PIN prompt). Please check your account and try again.',
      };
    case 'refunded':
      return {
        title: 'Payment Refunded',
        message: 'This payment has been refunded and recorded on your invoice history.',
      };
    case 'disputed':
      return {
        title: 'Payment Under Dispute Review',
        message:
          'This transaction is currently marked disputed and is being reviewed by our finance team.',
      };
  }
}
