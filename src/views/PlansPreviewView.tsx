import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { formatEatDate, formatEtb } from '../i18n/translations';
import { TaxonomyResponse } from '../types/foundation';
import { AppButton } from '../components/ui/AppButton';
import { AppInput } from '../components/ui/AppFormFields';
import { EtbPriceDisplay } from '../components/ui/DomainComponents';
import { SkeletonCard } from '../components/ui/Skeletons';
import { StateBanner } from '../components/ui/StateBanner';

interface PlansPreviewViewProps {
  taxonomy: TaxonomyResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

type BillingIntervalSelection = 'monthly' | 'annual';
type PlansViewTab = 'plans' | 'invoices';
type PaymentChannel =
  | 'telebirr'
  | 'cbe_birr'
  | 'ebirr'
  | 'mpesa'
  | 'bank_transfer'
  | 'card';

interface VatBreakdown {
  subtotalEtb: number;
  vatEnabled: boolean;
  vatRateBps: number;
  vatEtb: number;
  totalEtb: number;
  currency: 'ETB';
}

interface CatalogPrice {
  id: string;
  priceCode: string;
  interval: 'free' | 'monthly' | 'annual' | 'per_listing';
  amountEtb: number;
  currency: string;
  trialDays: number;
  vatBreakdown: VatBreakdown;
}

interface CatalogPlan {
  id: string;
  code: 'free' | 'starter' | 'professional' | 'publisher_basic' | 'publisher_pro';
  audience: 'seeker' | 'publisher';
  sortOrder: number;
  nameEn: string;
  nameAm: string;
  taglineEn: string;
  taglineAm: string;
  features: Array<{ en: string; am: string }>;
  prices: CatalogPrice[];
}

interface PaymentChannelInfo {
  code: PaymentChannel;
  labelEn: string;
  labelAm: string;
  status: 'primary' | 'planned';
  descriptionEn: string;
  descriptionAm: string;
}

interface BillingCatalogResponse {
  currency: 'ETB';
  testMode: boolean;
  vat: {
    enabled: boolean;
    rateBps: number;
    ratePercent: number;
    supplierLegalName: string;
    supplierTin: string;
    invoicePrefix: string;
  };
  paymentChannels: PaymentChannelInfo[];
  plans: CatalogPlan[];
}

interface CheckoutSession {
  paymentId: string;
  txRef: string;
  status: string;
  checkoutUrl: string;
  testMode: boolean;
  modeLabel: 'chapa_live' | 'chapa_sandbox' | 'local_test_simulator';
  invoiceNumber: string;
  planCode: string;
  planNameEn: string;
  planNameAm: string;
  interval: string;
  trialDays: number;
  subtotalEtb: number;
  vatRateBps: number;
  vatEtb: number;
  totalEtb: number;
  currency: 'ETB';
  paymentChannel: PaymentChannel;
}

interface VerificationResponse {
  txRef: string;
  status: string;
  amountEtb: number;
  currency: string;
  invoiceNumber: string | null;
  receiptEmailSentAt: string | null;
  failureReason?: string | null;
  feedback: {
    title: string;
    message: string;
  };
}

interface BillingHistoryResponse {
  payments: Array<{
    id: string;
    txRef: string;
    provider: string;
    paymentChannel: string;
    purpose: string;
    subtotalEtb: number;
    vatRateBps: number;
    vatEtb: number;
    amountEtb: number;
    currency: string;
    status: string;
    testMode: boolean;
    customerName: string | null;
    customerEmail: string | null;
    failureReason: string | null;
    createdAt: string;
    verifiedAt: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    subtotalEtb: number;
    vatRateBps: number;
    vatEtb: number;
    totalEtb: number;
    currency: string;
    billingName: string | null;
    billingEmail: string | null;
    billingTin: string | null;
    issuedAt: string;
    paidAt: string | null;
    receiptEmailSentAt: string | null;
  }>;
  entitlements: Array<{
    id: string;
    planCode: string;
    maxBookmarks: number;
    maxSavedSearches: number;
    instantAlerts: boolean;
    smsTelegramAlerts: boolean;
    unlimitedListings: boolean;
    featuredPlacement: boolean;
    listingCreditsRemaining: number;
    effectiveUntil: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    txRef: string;
    eventType: string;
    source: string;
    statusBefore: string | null;
    statusAfter: string | null;
    createdAt: string;
  }>;
}

const STATUS_STYLE: Record<string, string> = {
  succeeded: 'text-[#15803D] font-semibold',
  paid: 'text-[#15803D] font-semibold',
  pending: 'text-[#B45309] font-semibold',
  processing: 'text-[#B45309] font-semibold',
  issued: 'text-[#475569] font-semibold',
  failed: 'text-[#B91C1C] font-semibold',
  cancelled: 'text-[#64748B] font-semibold',
  void: 'text-[#64748B] font-semibold',
  refunded: 'text-[#0F172A] font-semibold',
  disputed: 'text-[#B91C1C] font-semibold',
};

export function PlansPreviewView({
  taxonomy: _taxonomy,
  loading: parentLoading,
  error: parentError,
  onRetry,
}: PlansPreviewViewProps) {
  const { lang, t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<PlansViewTab>('plans');
  const [interval, setInterval] = useState<BillingIntervalSelection>('monthly');

  const [catalog, setCatalog] = useState<BillingCatalogResponse | null>(null);
  const [history, setHistory] = useState<BillingHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Checkout modal state
  const [selectedPlan, setSelectedPlan] = useState<CatalogPlan | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<CatalogPrice | null>(null);
  const [channel, setChannel] = useState<PaymentChannel>('telebirr');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+2519');
  const [billingTin, setBillingTin] = useState('');

  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<CheckoutSession | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResponse | null>(null);
  const [freeBanner, setFreeBanner] = useState<string | null>(null);

  const loadBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, histRes] = await Promise.all([
        fetch('/api/v1/billing/catalog'),
        fetch('/api/v1/billing/history'),
      ]);
      if (!catRes.ok) {
        const body = await catRes.json().catch(() => null);
        throw new Error(body?.error?.message || 'Failed to load ETB billing plans.');
      }
      setCatalog(await catRes.json());
      if (histRes.ok) {
        setHistory(await histRes.json());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.states.errorFallback);
    } finally {
      setLoading(false);
    }
  }, [t.states.errorFallback]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  function openCheckout(plan: CatalogPlan, price: CatalogPrice) {
    setSelectedPlan(plan);
    setSelectedPrice(price);
    setChannel('telebirr');
    setCheckoutError(null);
    setActiveSession(null);
    setVerificationResult(null);
    setFreeBanner(null);
  }

  function closeCheckout() {
    setSelectedPlan(null);
    setSelectedPrice(null);
    setActiveSession(null);
    setVerificationResult(null);
    setCheckoutError(null);
  }

  async function handleStartCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPrice) return;
    setSubmittingCheckout(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceCode: selectedPrice.priceCode,
          paymentChannel: channel,
          customerName,
          customerEmail,
          customerPhone: customerPhone === '+2519' ? '' : customerPhone,
          billingTin,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Checkout initialization failed.');
      }

      if (body.freeActivated) {
        setFreeBanner(
          lang === 'am'
            ? 'ነፃ ፓኬጅዎ በተሳካ ሁኔታ ተከፍቷል።'
            : 'Free tier entitlements activated immediately.'
        );
        closeCheckout();
        await loadBillingData();
        return;
      }

      setActiveSession(body);
      await loadBillingData();
    } catch (err: unknown) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to start Chapa hosted checkout.'
      );
    } finally {
      setSubmittingCheckout(false);
    }
  }

  async function handleServerVerify(
    txRef: string,
    testModeOutcome?: 'succeeded' | 'pending' | 'processing' | 'failed' | 'cancelled'
  ) {
    setVerifying(true);
    setCheckoutError(null);
    try {
      const res = await fetch(
        `/api/v1/billing/checkout/${encodeURIComponent(txRef)}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            testModeOutcome ? { testModeOutcome } : {}
          ),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Server verification failed.');
      }
      setVerificationResult(body);
      await loadBillingData();
    } catch (err: unknown) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Verification error occurred.'
      );
    } finally {
      setVerifying(false);
    }
  }

  if (loading || parentLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 rounded bg-[#E2E8F0] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || parentError || !catalog) {
    return (
      <StateBanner
        variant="error"
        title={t.states.errorTitle}
        description={error || parentError || t.states.errorFallback}
        actionLabel={t.states.retry}
        onAction={() => {
          onRetry();
          loadBillingData();
        }}
      />
    );
  }

  const seekerPlans = catalog.plans.filter((p) => p.audience === 'seeker');
  const publisherPlans = catalog.plans.filter((p) => p.audience === 'publisher');

  function pickPriceForPlan(plan: CatalogPlan): CatalogPrice | undefined {
    if (plan.code === 'free') {
      return plan.prices.find((p) => p.interval === 'free') || plan.prices[0];
    }
    if (plan.code === 'publisher_basic') {
      return plan.prices.find((p) => p.interval === 'per_listing') || plan.prices[0];
    }
    return (
      plan.prices.find((p) => p.interval === interval) ||
      plan.prices.find((p) => p.interval === 'monthly') ||
      plan.prices[0]
    );
  }

  return (
    <div className="space-y-8">
      {/* Header + Sub-tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <section className="space-y-1.5 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
            {t.plans.heading}
          </h1>
          <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
            {lang === 'am'
              ? 'በኢትዮጵያ ብር (ETB) በቻፓ እና ቴሌብር ደህንነቱ የተጠበቀ ክፍያ። ሁሉም የክፍያ ማረጋገጫዎች በሰርቨር ላይ ይፈፀማሉ።'
              : 'Pay in Ethiopian Birr (ETB) via Chapa Hosted Checkout with Telebirr as primary channel. All verification, VAT invoicing, and plan activation happen strictly on our server.'}
          </p>
        </section>

        <div className="inline-flex rounded-xl bg-[#E8EDF5] p-1 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('plans')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'plans'
                ? 'bg-white text-[#0B1F3A] font-semibold shadow-[0_1px_2px_rgba(11,31,58,0.08)]'
                : 'text-[#475569] hover:text-[#0B1F3A]'
            }`}
          >
            {lang === 'am' ? 'ፓኬጆች እና ክፍያ' : 'Plans & Checkout'}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'invoices'
                ? 'bg-white text-[#0B1F3A] font-semibold shadow-[0_1px_2px_rgba(11,31,58,0.08)]'
                : 'text-[#475569] hover:text-[#0B1F3A]'
            }`}
          >
            {lang === 'am' ? 'ደረሰኞች እና መብቶች' : 'Invoices & History'}
            {history && history.invoices.length > 0 && (
              <span className="ms-1.5 font-mono tabular-nums opacity-80">
                ({history.invoices.length})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Chapa Security & Mode Strip */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#334155]">
        <div className="flex items-start sm:items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong className="text-[#0B1F3A]">Chapa Hosted Checkout (ETB)</strong> · Primary: Telebirr · Expansion-ready:
            CBE Birr, eBirr, M-Pesa, Bank Transfer & Cards · Zero raw card data stored ·{' '}
            <span className="font-mono">
              {catalog.vat.enabled ? `${catalog.vat.ratePercent}% Ethiopian VAT` : 'VAT Exempt'}
            </span>
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold text-[#B45309] shrink-0">
          {catalog.testMode ? 'CHAPA TEST MODE ACTIVE' : 'CHAPA LIVE MODE'}
        </span>
      </div>

      {freeBanner && (
        <StateBanner
          variant="success"
          title={lang === 'am' ? 'ተሳክቷል' : 'Plan Updated'}
          description={freeBanner}
        />
      )}

      {/* TAB 1: PLANS & CHAPA HOSTED CHECKOUT */}
      {activeSubTab === 'plans' && (
        <div className="space-y-10">
          {/* Seeker Subscriptions Section */}
          <section className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#0B1F3A]">
                  {lang === 'am'
                    ? 'የጨረታ ፈላጊ ፓኬጆች (Seeker Plans)'
                    : 'Tender Seeker Subscriptions'}
                </h2>
                <p className="text-sm text-[#475569]">
                  {lang === 'am'
                    ? 'ወርሃዊ ወይም ዓመታዊ ክፍያ ይምረጡ (በዓመታዊ ክፍያ የ2 ወራት ቅናሽ)።'
                    : 'Choose monthly or annual billing (annual saves 2 months in ETB).'}
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-[#E8EDF5] p-1 self-start">
                <button
                  type="button"
                  onClick={() => setInterval('monthly')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    interval === 'monthly'
                      ? 'bg-[#0B1F3A] text-white'
                      : 'text-[#475569] hover:text-[#0B1F3A]'
                  }`}
                >
                  {lang === 'am' ? 'ወርሃዊ' : 'Monthly'}
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('annual')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    interval === 'annual'
                      ? 'bg-[#0B1F3A] text-white'
                      : 'text-[#475569] hover:text-[#0B1F3A]'
                  }`}
                >
                  {lang === 'am' ? 'ዓመታዊ (2 ወር ቅናሽ)' : 'Annual (Save 2 mo)'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {seekerPlans.map((plan) => {
                const price = pickPriceForPlan(plan);
                if (!price) return null;
                const isPro = plan.code === 'professional';
                const name = lang === 'am' ? plan.nameAm : plan.nameEn;
                const tagline = lang === 'am' ? plan.taglineAm : plan.taglineEn;
                const suffix =
                  price.interval === 'free'
                    ? t.plans.freeLabel
                    : price.interval === 'annual'
                      ? lang === 'am'
                        ? '/ ዓመት'
                        : '/ year'
                      : t.plans.perMonth;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl bg-white p-6 flex flex-col justify-between border shadow-[0_1px_2px_rgba(11,31,58,0.04)] ${
                      isPro
                        ? 'border-[#2563EB] ring-1 ring-[#2563EB]/15'
                        : 'border-[#E2E8F0]'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold text-[#0B1F3A]">{name}</h3>
                          {isPro && (
                            <span className="text-xs font-semibold text-[#2563EB]">
                              {t.plans.mostPopular}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] leading-relaxed">{tagline}</p>
                      </div>

                      <div className="pt-3 border-t border-[#E2E8F0] space-y-1">
                        <EtbPriceDisplay
                          emphasize
                          amount={price.amountEtb}
                          suffix={suffix}
                        />
                        {price.amountEtb > 0 && (
                          <p className="text-xs font-mono tabular-nums text-[#64748B]">
                            +{formatEtb(price.vatBreakdown.vatEtb, lang)} VAT ({catalog.vat.ratePercent}%) ·
                            Total {formatEtb(price.vatBreakdown.totalEtb, lang)}
                            {price.trialDays > 0 ? ` · ${price.trialDays}d trial` : ''}
                          </p>
                        )}
                      </div>

                      <ul className="space-y-2.5 text-sm pt-1">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[#334155]">
                            <Check
                              className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{lang === 'am' ? feat.am : feat.en}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6 mt-6 border-t border-[#E2E8F0]">
                      <AppButton
                        fullWidth
                        variant={isPro ? 'primary' : 'secondary'}
                        onClick={() => openCheckout(plan, price)}
                      >
                        {price.amountEtb === 0
                          ? lang === 'am'
                            ? 'ነፃ ፓኬጅ ጀምር'
                            : 'Activate Free Plan'
                          : lang === 'am'
                            ? 'በቻፓ / ቴሌብር ይክፈሉ'
                            : 'Pay via Chapa (Telebirr)'}
                      </AppButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Publisher Plans Section */}
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#0B1F3A]">
                {lang === 'am'
                  ? 'የጨረታ አውጪ ፓኬጆች (Publisher Plans)'
                  : 'Tender Publisher Plans & Per-Listing Payments'}
              </h2>
              <p className="text-sm text-[#475569]">
                {lang === 'am'
                  ? 'ለአንድ ጨረታ በነጠላ ይክፈሉ ወይም ላልተገደበ ህትመት እና ተመራጭ ቦታ ወደ አውጪ ፕሮ ያሻሽሉ።'
                  : 'Pay per verified listing (30-day visibility) or subscribe to Publisher Pro for unlimited listings, featured placement, and targeted supplier alerts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {publisherPlans.map((plan) => {
                const price = pickPriceForPlan(plan);
                if (!price) return null;
                const isPubPro = plan.code === 'publisher_pro';
                const name = lang === 'am' ? plan.nameAm : plan.nameEn;
                const tagline = lang === 'am' ? plan.taglineAm : plan.taglineEn;
                const suffix =
                  price.interval === 'per_listing'
                    ? lang === 'am'
                      ? '/ ጨረታ'
                      : '/ listing'
                    : price.interval === 'annual'
                      ? lang === 'am'
                        ? '/ ዓመት'
                        : '/ year'
                      : t.plans.perMonth;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl bg-white p-6 flex flex-col justify-between border shadow-[0_1px_2px_rgba(11,31,58,0.04)] ${
                      isPubPro
                        ? 'border-[#2563EB] ring-1 ring-[#2563EB]/15'
                        : 'border-[#E2E8F0]'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold text-[#0B1F3A]">{name}</h3>
                          <span className="text-xs font-mono text-[#64748B]">
                            {price.interval === 'per_listing'
                              ? 'Per-Listing'
                              : price.interval === 'annual'
                                ? 'Annual Subscription'
                                : 'Monthly Subscription'}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] leading-relaxed">{tagline}</p>
                      </div>

                      <div className="pt-3 border-t border-[#E2E8F0] space-y-1">
                        <EtbPriceDisplay
                          emphasize
                          amount={price.amountEtb}
                          suffix={suffix}
                        />
                        <p className="text-xs font-mono tabular-nums text-[#64748B]">
                          +{formatEtb(price.vatBreakdown.vatEtb, lang)} VAT ({catalog.vat.ratePercent}%) ·
                          Total {formatEtb(price.vatBreakdown.totalEtb, lang)}
                        </p>
                      </div>

                      <ul className="space-y-2.5 text-sm pt-1">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[#334155]">
                            <Check
                              className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{lang === 'am' ? feat.am : feat.en}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6 mt-6 border-t border-[#E2E8F0]">
                      <AppButton
                        fullWidth
                        variant={isPubPro ? 'primary' : 'secondary'}
                        onClick={() => openCheckout(plan, price)}
                      >
                        {price.interval === 'per_listing'
                          ? lang === 'am'
                            ? 'የአንድ ጨረታ ክፍያ ጀምር (ቻፓ)'
                            : 'Buy Verified Listing via Chapa'
                          : lang === 'am'
                            ? 'አውጪ ፕሮ ይመዝገቡ (ቻፓ)'
                            : 'Subscribe to Publisher Pro'}
                      </AppButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Supported Ethiopian Payment Channels Strip */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#2563EB]" />
              <span>
                {lang === 'am'
                  ? 'የክፍያ አማራጮች (በቻፓ ደህንነቱ የተጠበቀ ገፅ)'
                  : 'Ethiopian Payment Channels via Chapa Hosted Checkout'}
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalog.paymentChannels.map((ch) => (
                <div
                  key={ch.code}
                  className={`rounded-xl border p-3.5 text-xs space-y-1 ${
                    ch.status === 'primary'
                      ? 'border-[#2563EB] bg-[#EFF6FF]/60'
                      : 'border-[#E2E8F0] bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#0B1F3A]">
                      {lang === 'am' ? ch.labelAm : ch.labelEn}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        ch.status === 'primary' ? 'text-[#1D4ED8] font-bold' : 'text-[#64748B]'
                      }`}
                    >
                      {ch.status === 'primary' ? 'PRIMARY' : 'EXPANSION'}
                    </span>
                  </div>
                  <p className="text-[#475569]">
                    {lang === 'am' ? ch.descriptionAm : ch.descriptionEn}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: INVOICES, PAYMENT HISTORY & SERVER ENTITLEMENTS */}
      {activeSubTab === 'invoices' && history && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0B1F3A]">
              {lang === 'am'
                ? 'የደረሰኞች ታሪክ እና ንቁ መብቶች'
                : 'ETB Invoice History, Payments & Active Entitlements'}
            </h2>
            <AppButton size="sm" variant="secondary" onClick={loadBillingData}>
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </AppButton>
          </div>

          {/* Active Entitlements */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Server-Verified Entitlements</span>
            </h3>
            {history.entitlements.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No paid entitlements activated yet. Complete a Chapa test checkout to verify
                server-side activation.
              </p>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {history.entitlements.map((ent) => (
                  <div
                    key={ent.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[#0B1F3A] font-mono">
                        Plan: {ent.planCode}
                      </p>
                      <p className="text-[#475569]">
                        Bookmarks: {ent.maxBookmarks < 0 ? 'Unlimited' : ent.maxBookmarks} ·
                        Saved searches:{' '}
                        {ent.maxSavedSearches < 0 ? 'Unlimited' : ent.maxSavedSearches} ·
                        Instant alerts: {ent.instantAlerts ? 'Yes' : 'No'} · SMS/Telegram:{' '}
                        {ent.smsTelegramAlerts ? 'Yes' : 'No'} · Listing credits:{' '}
                        <strong className="font-mono">{ent.listingCreditsRemaining}</strong>
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-[#64748B]">
                      {ent.effectiveUntil
                        ? `Valid until ${formatEatDate(ent.effectiveUntil, lang)}`
                        : 'No expiry / Per-listing'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sequential ETB Invoices */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              <span>Sequential ETB VAT Invoices</span>
            </h3>
            {history.invoices.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No invoices issued yet. Start a Chapa checkout from the Plans tab to generate a
                sequential ETB invoice.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pe-3 font-medium">Invoice #</th>
                      <th className="py-2 pe-3 font-medium">Customer</th>
                      <th className="py-2 pe-3 font-medium">Subtotal</th>
                      <th className="py-2 pe-3 font-medium">VAT</th>
                      <th className="py-2 pe-3 font-medium">Total (ETB)</th>
                      <th className="py-2 pe-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Receipt Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {history.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="py-2.5 pe-3 font-mono font-semibold text-[#0F172A] whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 pe-3 text-[#334155]">
                          {inv.billingName || '—'} ·{' '}
                          <span className="text-[#64748B]">{inv.billingEmail}</span>
                          {inv.billingTin ? (
                            <span className="font-mono text-[#64748B]"> · TIN {inv.billingTin}</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums whitespace-nowrap">
                          {formatEtb(inv.subtotalEtb, lang)}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums whitespace-nowrap text-[#64748B]">
                          {formatEtb(inv.vatEtb, lang)}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums font-semibold whitespace-nowrap">
                          {formatEtb(inv.totalEtb, lang)}
                        </td>
                        <td
                          className={`py-2.5 pe-3 font-mono whitespace-nowrap ${
                            STATUS_STYLE[inv.status] || 'text-[#475569]'
                          }`}
                        >
                          {inv.status}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                          {inv.receiptEmailSentAt
                            ? `Queued ${formatEatDate(inv.receiptEmailSentAt, lang)}`
                            : 'Pending payment'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment Transactions */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h3 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <span>Chapa Payment Transactions</span>
            </h3>
            {history.payments.length === 0 ? (
              <p className="text-sm text-[#64748B]">No Chapa transactions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pe-3 font-medium">Transaction Ref</th>
                      <th className="py-2 pe-3 font-medium">Channel</th>
                      <th className="py-2 pe-3 font-medium">Amount</th>
                      <th className="py-2 pe-3 font-medium">Status</th>
                      <th className="py-2 pe-3 font-medium">Details</th>
                      <th className="py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {history.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pe-3 font-mono text-[#0F172A] whitespace-nowrap">
                          {p.txRef}
                        </td>
                        <td className="py-2.5 pe-3 font-mono text-[#475569] whitespace-nowrap">
                          {p.paymentChannel} {p.testMode ? '(test)' : ''}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums font-semibold whitespace-nowrap">
                          {formatEtb(p.amountEtb, lang)}
                        </td>
                        <td
                          className={`py-2.5 pe-3 font-mono whitespace-nowrap ${
                            STATUS_STYLE[p.status] || 'text-[#475569]'
                          }`}
                        >
                          {p.status}
                        </td>
                        <td className="py-2.5 pe-3 text-[#475569] max-w-xs">
                          {p.failureReason ||
                            (p.verifiedAt
                              ? `Verified ${formatEatDate(p.verifiedAt, lang)}`
                              : 'Awaiting server verification')}
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          {(p.status === 'pending' || p.status === 'processing') && (
                            <AppButton
                              size="sm"
                              variant="secondary"
                              disabled={verifying}
                              onClick={() =>
                                handleServerVerify(
                                  p.txRef,
                                  p.testMode ? 'succeeded' : undefined
                                )
                              }
                            >
                              Verify on Server
                            </AppButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHAPA HOSTED CHECKOUT MODAL */}
      {selectedPlan && selectedPrice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapa-checkout-title"
          className="fixed inset-0 z-50 bg-[#0B1F3A]/50 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto"
          onClick={closeCheckout}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F0] shadow-xl p-6 space-y-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="chapa-checkout-title"
                  className="text-lg font-bold text-[#0B1F3A]"
                >
                  {activeSession
                    ? 'Chapa Hosted Checkout'
                    : lang === 'am'
                      ? `${selectedPlan.nameAm} — የቻፓ ክፍያ`
                      : `${selectedPlan.nameEn} — Chapa Checkout`}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {catalog.vat.supplierLegalName} · Currency: ETB
                </p>
              </div>
              <button
                type="button"
                aria-label={t.states.close}
                onClick={closeCheckout}
                className="min-h-[40px] min-w-[40px] -mt-2 -me-2 inline-flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#0B1F3A] hover:bg-[#EDF1F7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Authoritative Server VAT Summary Box */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#475569]">
                <span>
                  {selectedPlan.nameEn} ({selectedPrice.interval.replace('_', ' ')})
                </span>
                <span className="font-mono tabular-nums font-medium text-[#0B1F3A]">
                  {formatEtb(selectedPrice.vatBreakdown.subtotalEtb, lang)}
                </span>
              </div>
              <div className="flex justify-between text-[#475569]">
                <span>Ethiopian VAT ({catalog.vat.ratePercent}%)</span>
                <span className="font-mono tabular-nums">
                  {formatEtb(selectedPrice.vatBreakdown.vatEtb, lang)}
                </span>
              </div>
              <div className="pt-2 mt-1 border-t border-[#E2E8F0] flex justify-between text-sm font-bold text-[#0B1F3A]">
                <span>Total Due (ETB)</span>
                <span className="font-mono tabular-nums text-[#1D4ED8]">
                  {formatEtb(selectedPrice.vatBreakdown.totalEtb, lang)}
                </span>
              </div>
            </div>

            {checkoutError && (
              <StateBanner
                variant="error"
                title="Checkout Notice"
                description={checkoutError}
              />
            )}

            {/* STEP 1: Customer Billing Details & Channel Selection */}
            {!activeSession && (
              <form onSubmit={handleStartCheckout} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#0B1F3A]">
                    Payment Method (Chapa Hosted Checkout)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {catalog.paymentChannels.slice(0, 4).map((ch) => (
                      <button
                        key={ch.code}
                        type="button"
                        onClick={() => setChannel(ch.code)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                          channel === ch.code
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] font-semibold'
                            : 'border-[#CBD5E1] bg-white text-[#475569] hover:border-[#94A3B8]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {ch.code === 'telebirr'
                              ? 'Telebirr (Primary)'
                              : ch.labelEn}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <AppInput
                  id="checkout-name"
                  label="Full Name or Organisation *"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g., Selam Construction PLC"
                />
                <AppInput
                  id="checkout-email"
                  label="Receipt Email Address *"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="finance@company.et"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AppInput
                    id="checkout-phone"
                    label="Telebirr / Ethiopian Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+251911234567"
                  />
                  <AppInput
                    id="checkout-tin"
                    label="Company TIN (Optional VAT Invoice)"
                    value={billingTin}
                    onChange={(e) => setBillingTin(e.target.value)}
                    placeholder="0012345678"
                  />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                  <Lock className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>
                    Payment is completed on Chapa Hosted Checkout. TenderLink Ethiopia never
                    collects or stores card numbers or Telebirr PINs.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <AppButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={closeCheckout}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    type="submit"
                    size="md"
                    variant="primary"
                    disabled={submittingCheckout}
                  >
                    {submittingCheckout
                      ? 'Initializing Chapa...'
                      : selectedPrice.amountEtb === 0
                        ? 'Activate Free Plan'
                        : 'Continue to Chapa Checkout'}
                  </AppButton>
                </div>
              </form>
            )}

            {/* STEP 2: Chapa Hosted Checkout Session & Server-Side Verification */}
            {activeSession && !verificationResult && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#CBD5E1] bg-white p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#0B1F3A]">
                      Unique Transaction Reference
                    </span>
                    <span className="font-mono font-bold text-[#1D4ED8]">
                      {activeSession.txRef}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#475569]">
                    <span>Sequential VAT Invoice</span>
                    <span className="font-mono">{activeSession.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#475569]">
                    <span>Current Server Status</span>
                    <span className="font-mono font-semibold text-[#B45309]">
                      {activeSession.status}
                    </span>
                  </div>
                </div>

                {activeSession.modeLabel === 'local_test_simulator' ? (
                  <div className="space-y-3 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4">
                    <p className="text-xs font-semibold text-[#92400E]">
                      Chapa Test-Mode Hosted Checkout Simulator
                    </p>
                    <p className="text-xs text-[#78350F] leading-relaxed">
                      Because <span className="font-mono">CHAPA_SECRET_KEY</span> is not set in
                      this environment, select a Telebirr / Chapa outcome below. Your choice is
                      still verified strictly on our server before any subscription or invoice is
                      marked paid.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <AppButton
                        size="sm"
                        variant="primary"
                        disabled={verifying}
                        onClick={() =>
                          handleServerVerify(activeSession.txRef, 'succeeded')
                        }
                      >
                        Simulate Telebirr Success
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="secondary"
                        disabled={verifying}
                        onClick={() =>
                          handleServerVerify(activeSession.txRef, 'pending')
                        }
                      >
                        Simulate Pending Prompt
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="destructive"
                        disabled={verifying}
                        onClick={() =>
                          handleServerVerify(activeSession.txRef, 'failed')
                        }
                      >
                        Simulate Failed Payment
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="ghost"
                        disabled={verifying}
                        onClick={() =>
                          handleServerVerify(activeSession.txRef, 'cancelled')
                        }
                      >
                        Simulate Cancelled
                      </AppButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <a
                      href={activeSession.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
                    >
                      <span>Open Chapa Hosted Checkout</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <AppButton
                      fullWidth
                      variant="secondary"
                      disabled={verifying}
                      onClick={() => handleServerVerify(activeSession.txRef)}
                    >
                      {verifying
                        ? 'Verifying with Chapa Server...'
                        : 'I Completed Payment — Verify on Server'}
                    </AppButton>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Authoritative Server Verification Result */}
            {verificationResult && (
              <div className="space-y-4">
                <div
                  className={`rounded-xl border p-4 space-y-2 ${
                    verificationResult.status === 'succeeded'
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : verificationResult.status === 'pending' ||
                          verificationResult.status === 'processing'
                        ? 'border-[#FCD34D] bg-[#FFFBEB]'
                        : 'border-[#FCA5A5] bg-[#FEF2F2]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm text-[#0F172A]">
                    {verificationResult.status === 'succeeded' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#15803D]" />
                    ) : verificationResult.status === 'pending' ||
                      verificationResult.status === 'processing' ? (
                      <Clock className="w-5 h-5 text-[#B45309]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#B91C1C]" />
                    )}
                    <span>{verificationResult.feedback.title}</span>
                  </div>
                  <p className="text-xs text-[#334155] leading-relaxed">
                    {verificationResult.feedback.message}
                  </p>
                  <div className="pt-2 text-xs font-mono text-[#475569] space-y-0.5">
                    <div>
                      Ref: {verificationResult.txRef} · Status: {verificationResult.status}
                    </div>
                    {verificationResult.invoiceNumber && (
                      <div>
                        Invoice: {verificationResult.invoiceNumber} · Amount:{' '}
                        {formatEtb(verificationResult.amountEtb, lang)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <AppButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      closeCheckout();
                      setActiveSubTab('invoices');
                    }}
                  >
                    View Invoices & Entitlements
                  </AppButton>
                  <AppButton size="sm" variant="primary" onClick={closeCheckout}>
                    Done
                  </AppButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
