import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Download,
  FileCheck2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { AppButton } from '../components/ui/AppButton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StateBanner } from '../components/ui/StateBanner';
import {
  getOrCreateVisitorId,
  readStoredConsent,
  writeStoredConsent,
} from '../components/ui/ConsentBanner';
import type { AuthSessionState } from '../components/ui/AuthSessionModal';

export type TrustTab = 'privacy' | 'terms' | 'controls' | 'governance';

interface TrustPrivacyViewProps {
  initialTab?: TrustTab;
  session: AuthSessionState | null;
  onOpenAuth: () => void;
  onSessionCleared: () => void;
}

interface PrivacyGovernanceOverview {
  policyVersion: string;
  consentStats: {
    total: number;
    analyticsOptIn: number;
    marketingOptIn: number;
    notificationOptIn: number;
  };
  dataSubjectRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    requesterEmailMasked: string;
    details: string;
    resolutionNotes: string | null;
    dueAt: string;
    createdAt: string;
  }>;
  securityIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    affectedRecordsEstimate: number;
    personalDataAffected: boolean;
    summary: string;
    containmentActions: string | null;
    notificationDeadline72h: string;
    createdAt: string;
  }>;
  recentAuditEvents: Array<{
    id: string;
    action: string;
    actorRole: string | null;
    entityType: string;
    entityId: string;
    createdAt: string;
  }>;
}

interface IntegrityOverview {
  abuseReports: Array<{
    id: string;
    tenderId: string;
    tenderTitleEn: string;
    tenderStatus: string;
    reason: string;
    details: string;
    status: string;
    resolution: string | null;
    createdAt: string;
  }>;
  publisherVerifications: Array<{
    id: string;
    organisationNameEn: string;
    organisationType: string;
    officialEmailMasked: string | null;
    licenseNumber: string | null;
    status: string;
    reviewNotes: string | null;
    strikeCount: number;
    createdAt: string;
  }>;
}

export function TrustPrivacyView({
  initialTab = 'privacy',
  session,
  onOpenAuth,
  onSessionCleared,
}: TrustPrivacyViewProps) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<TrustTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Consent state
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [consentSavedMsg, setConsentSavedMsg] = useState<string | null>(null);

  // DSR state
  const [dsrEmail, setDsrEmail] = useState(session?.user.email || '');
  const [dsrType, setDsrType] = useState<
    'access' | 'rectification' | 'erasure' | 'portability' | 'objection' | 'withdraw_consent'
  >('access');
  const [dsrDetails, setDsrDetails] = useState('');
  const [dsrFeedback, setDsrFeedback] = useState<string | null>(null);

  // Account deletion state
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);

  // Governance state
  const [privacyGov, setPrivacyGov] = useState<PrivacyGovernanceOverview | null>(null);
  const [integrityGov, setIntegrityGov] = useState<IntegrityOverview | null>(null);
  const [govLoading, setGovLoading] = useState(false);
  const [govError, setGovError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Breach incident form
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [incAffected, setIncAffected] = useState('0');
  const [incPersonalData, setIncPersonalData] = useState(true);
  const [incSummary, setIncSummary] = useState('');

  // Publisher verification form
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'private_company' | 'ngo' | 'public_enterprise' | 'university'>('private_company');
  const [orgLicense, setOrgLicense] = useState('');
  const [orgEmail, setOrgEmail] = useState('');

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) {
      setAnalyticsConsent(stored.analyticsConsent);
      setMarketingConsent(stored.marketingConsent);
      setNotificationConsent(stored.notificationConsent);
    }
  }, []);

  const loadGovernance = useCallback(async () => {
    setGovLoading(true);
    setGovError(null);
    try {
      const headers: Record<string, string> = {};
      if (session?.accessToken) {
        headers.Authorization = `Bearer ${session.accessToken}`;
      }
      const [pRes, iRes] = await Promise.all([
        fetch('/api/v1/admin/privacy/overview', { headers }),
        fetch('/api/v1/admin/integrity/overview', { headers }),
      ]);
      if (!pRes.ok || !iRes.ok) {
        const body = await (pRes.ok ? iRes : pRes).json().catch(() => null);
        throw new Error(
          body?.error?.message ||
            'Sign in with moderator or super_admin role to inspect governance queues.'
        );
      }
      setPrivacyGov(await pRes.json());
      setIntegrityGov(await iRes.json());
    } catch (err) {
      setGovError(err instanceof Error ? err.message : 'Failed to load governance data.');
    } finally {
      setGovLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (tab === 'governance') {
      loadGovernance();
    }
  }, [tab, loadGovernance]);

  const handleSaveConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsentSavedMsg(null);
    const visitorId = getOrCreateVisitorId();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

    const res = await fetch('/api/v1/privacy/consent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        visitorId,
        analyticsConsent,
        marketingConsent,
        notificationConsent,
        policyVersion: '2026-04-v1',
      }),
    });
    if (res.ok) {
      writeStoredConsent({
        visitorId,
        essentialCookies: true,
        analyticsConsent,
        marketingConsent,
        notificationConsent,
        policyVersion: '2026-04-v1',
        updatedAt: new Date().toISOString(),
      });
      setConsentSavedMsg(
        lang === 'am'
          ? 'የግላዊነት ምርጫዎችዎ በዳታቤዝ ውስጥ ተቀምጠዋል።'
          : 'Your consent preferences have been recorded with an immutable audit timestamp.'
      );
    }
  };

  const handleSubmitDsr = async (e: React.FormEvent) => {
    e.preventDefault();
    setDsrFeedback(null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

    const res = await fetch('/api/v1/privacy/dsr', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requesterEmail: dsrEmail,
        requestType: dsrType,
        details: dsrDetails,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setDsrFeedback(body?.error?.message || 'Failed to submit request.');
      return;
    }
    setDsrDetails('');
    setDsrFeedback(
      `Request ${body.request.id.slice(0, 8)} submitted. Target review date: ${new Date(
        body.request.dueAt
      ).toLocaleDateString()}.`
    );
  };

  const handleExportData = async () => {
    if (!session) return;
    setAccountFeedback(null);
    const res = await fetch('/api/v1/privacy/export', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) {
      setAccountFeedback('Could not export personal data right now.');
      return;
    }
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenderlink-ethiopia-personal-data-export.json';
    a.click();
    URL.revokeObjectURL(url);
    setAccountFeedback('Personal data JSON export downloaded and logged in audit trail.');
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setAccountFeedback(null);
    const res = await fetch('/api/v1/privacy/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        confirmPhrase: deletePhrase,
        reason: deleteReason || undefined,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setAccountFeedback(body?.error?.message || 'Account deletion failed.');
      return;
    }
    setDeletePhrase('');
    setDeleteReason('');
    setAccountFeedback(body.message);
    onSessionCleared();
  };

  const handleRunRetentionSweep = async () => {
    setActionBanner(null);
    const headers: Record<string, string> = {};
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/v1/admin/privacy/retention-sweep', {
      method: 'POST',
      headers,
    });
    const body = await res.json();
    if (!res.ok) {
      setGovError(body?.error?.message || 'Retention sweep failed.');
      return;
    }
    setActionBanner(
      `Retention sweep completed: ${body.expiredOtpsPurged} expired OTP(s) purged, ${body.expiredSessionsPurged} expired session(s) purged, ${body.deletedAccountsAnonymised} soft-deleted account(s) anonymised.`
    );
    loadGovernance();
  };

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionBanner(null);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/v1/admin/privacy/incidents', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: incTitle,
        severity: incSeverity,
        affectedRecordsEstimate: Number(incAffected) || 0,
        personalDataAffected: incPersonalData,
        summary: incSummary,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setGovError(body?.error?.message || 'Could not log incident.');
      return;
    }
    setIncTitle('');
    setIncSummary('');
    setActionBanner(
      `Incident logged. 72-hour breach assessment window closes ${new Date(
        body.incident.notificationDeadline72h
      ).toLocaleString()}.`
    );
    loadGovernance();
  };

  const handleResolveAbuse = async (reportId: string, action: 'takedown' | 'dismiss') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch(`/api/v1/admin/integrity/abuse-reports/${reportId}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        resolution:
          action === 'takedown'
            ? 'Listing archived via platform integrity takedown review.'
            : 'Reviewed and dismissed after source verification.',
      }),
    });
    if (res.ok) {
      setActionBanner(
        action === 'takedown'
          ? 'Tender listing taken down (archived) and audit event recorded.'
          : 'Abuse report dismissed and recorded in audit log.'
      );
      loadGovernance();
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/v1/publishers/verifications', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        organisationNameEn: orgName,
        organisationType: orgType,
        licenseNumber: orgLicense,
        officialEmail: orgEmail,
      }),
    });
    if (res.ok) {
      setOrgName('');
      setOrgLicense('');
      setOrgEmail('');
      setActionBanner('Publisher verification application submitted for moderator review.');
      loadGovernance();
    }
  };

  const handleReviewVerification = async (id: string, decision: 'verified' | 'rejected') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch(`/api/v1/admin/integrity/verifications/${id}/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        decision,
        reviewNotes:
          decision === 'verified'
            ? 'Business license & official domain verified.'
            : 'Insufficient legal registration proof provided.',
      }),
    });
    if (res.ok) {
      setActionBanner(`Publisher verification marked as ${decision}.`);
      loadGovernance();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
          {lang === 'am'
            ? 'ግላዊነት፣ ደህንነት እና የመድረክ ታማኝነት'
            : 'Trust, Privacy & Compliance Center'}
        </h1>
        <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
          {lang === 'am'
            ? 'የግላዊነት ፖሊሲ፣ የአጠቃቀም ውሎች፣ የግል ውሂብ መብቶች እና የመድረክ ታማኝነት መቆጣጠሪያዎች።'
            : 'Bilingual privacy notices, terms of use, self-service data rights, and platform integrity governance for TenderLink Ethiopia.'}
        </p>
      </div>

      <StateBanner
        compact
        variant="warning"
        title={
          lang === 'am'
            ? 'የህግ ግምገማ ማሳሰቢያ'
            : 'Legal Review Notice (Pre-Launch Draft)'
        }
        description={
          lang === 'am'
            ? 'እነዚህ የግላዊነት እና የአጠቃቀም ሰነዶች ቴክኒካዊ ረቂቆች ናቸው። ለህዝብ ከመለቀቁ በፊት በኢትዮጵያ የህግ ባለሙያ (አዋጅ ቁጥር 1321/2024 እና የታክስ/የክፍያ ህጎች) መገምገም አለባቸው።'
            : 'These policy notices and compliance workflows are operational drafts prepared for review by a qualified Ethiopian legal and compliance professional before public launch (including Personal Data Protection Proclamation No. 1321/2024, cross-border hosting, and ERCA tax invoicing).'
        }
      />

      <SegmentedControl<TrustTab>
        label="Trust and privacy sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'privacy', label: lang === 'am' ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy' },
          { value: 'terms', label: lang === 'am' ? 'የአጠቃቀም ውሎች' : 'Terms of Use' },
          { value: 'controls', label: lang === 'am' ? 'የግል ውሂብ መብቶች' : 'My Privacy & Rights' },
          { value: 'governance', label: lang === 'am' ? 'ታማኝነት እና አስተዳደር' : 'Integrity & Governance' },
        ]}
      />

      {/* TAB 1: PRIVACY POLICY */}
      {tab === 'privacy' && (
        <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-6 text-sm text-[#334155] leading-relaxed">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
            <h2 className="text-xl font-bold text-[#0B1F3A]">
              {lang === 'am'
                ? 'የTenderLink Ethiopia የግላዊነት ፖሊሲ'
                : 'TenderLink Ethiopia Privacy Policy'}
            </h2>
            <span className="font-mono text-xs text-[#64748B]">Version: 2026-04-v1</span>
          </div>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              1. Data Minimisation — What We Collect
            </h3>
            <p>
              We collect only the minimum information required to operate tender discovery,
              alert notifications, verified publisher listings, and ETB billing:
            </p>
            <ul className="list-disc ps-5 space-y-1">
              <li>
                <strong>Account details:</strong> Full name, email address or Ethiopian phone number
                (+251), preferred language (EN/AM), and salted scrypt password hash.
              </li>
              <li>
                <strong>Publisher details:</strong> Organisation legal name, business license
                reference, official domain email, and optional TIN for ETB VAT invoices.
              </li>
              <li>
                <strong>Billing metadata:</strong> Transaction reference, plan code, ETB subtotal,
                VAT, and Chapa verification status. <strong>We never collect or store raw card or Telebirr PIN credentials.</strong>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              2. Cross-Border Hosting Disclosure
            </h3>
            <p>
              Application databases are currently hosted on managed Google Cloud SQL infrastructure
              in <strong>Europe West (London, europe-west2)</strong> with TLS encryption in transit
              and encryption at rest. Cross-border personal data transfers under Ethiopian Personal
              Data Protection Proclamation No. 1321/2024 are flagged for formal review and
              appropriate safeguards by Ethiopian legal counsel prior to public commercial launch.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              3. Data Retention Schedule
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-2 pe-4 font-semibold">Record Category</th>
                    <th className="py-2 pe-4 font-semibold">Retention Period</th>
                    <th className="py-2 font-semibold">End-of-Life Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  <tr>
                    <td className="py-2.5 pe-4 font-medium text-[#0F172A]">OTP Verification Codes</td>
                    <td className="py-2.5 pe-4 font-mono">10 min validity / 24h max</td>
                    <td className="py-2.5">Hard-deleted by retention sweep</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pe-4 font-medium text-[#0F172A]">Revoked / Expired Sessions</td>
                    <td className="py-2.5 pe-4 font-mono">30 days</td>
                    <td className="py-2.5">Hard-deleted by retention sweep</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pe-4 font-medium text-[#0F172A]">User Profile & Saved Alerts</td>
                    <td className="py-2.5 pe-4 font-mono">Active account lifecycle</td>
                    <td className="py-2.5">Immediate anonymisation on self-delete</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pe-4 font-medium text-[#0F172A]">ETB Tax Invoices & Payments</td>
                    <td className="py-2.5 pe-4 font-mono">10 years (confirm w/ tax counsel)</td>
                    <td className="py-2.5">Retained with anonymised personal fields</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pe-4 font-medium text-[#0F172A]">Security & Moderation Audit Logs</td>
                    <td className="py-2.5 pe-4 font-mono">24 months</td>
                    <td className="py-2.5">Immutable trail; archived/purged after 24m</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              4. Your Rights (Access, Correction, Portability, Erasure & Consent Withdrawal)
            </h3>
            <p>
              You may manage cookie, marketing, and notification consents, download a complete
              machine-readable copy of your personal data (JSON), submit a formal Data Subject
              Request, or delete and anonymise your account directly in the{' '}
              <button
                type="button"
                onClick={() => setTab('controls')}
                className="font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                My Privacy & Rights
              </button>{' '}
              tab.
            </p>
          </section>
        </article>
      )}

      {/* TAB 2: TERMS OF USE */}
      {tab === 'terms' && (
        <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-6 text-sm text-[#334155] leading-relaxed">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
            <h2 className="text-xl font-bold text-[#0B1F3A]">
              {lang === 'am'
                ? 'የTenderLink Ethiopia የአጠቃቀም ውሎች'
                : 'TenderLink Ethiopia Terms of Use'}
            </h2>
            <span className="font-mono text-xs text-[#64748B]">Version: 2026-04-v1</span>
          </div>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              1. Independent Platform Disclaimer
            </h3>
            <p>
              <strong>TenderLink Ethiopia is an independent private information service.</strong>{' '}
              We are NOT an official Ethiopian government procurement portal, are not affiliated
              with the Federal Public Procurement and Property Authority (PPA), and do not award
              contracts or collect bid security deposits on behalf of procuring entities.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              2. Source Attribution & Procurement Accuracy
            </h3>
            <p>
              Every listing displays its provenance label (<em>Official Source</em>,{' '}
              <em>Publisher Submitted</em>, <em>Partner Feed</em>, or <em>User Reported</em>) and
              original source link where available. Bidders must always verify final specifications,
              deadlines, and addenda directly with the named procuring organisation before
              submitting a bid or paying document fees.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              3. Publisher Integrity & Anti-Scam Policy
            </h3>
            <p>
              Publishers must submit accurate, lawful procurement opportunities and undergo
              organisation verification. Any listing requesting personal Telebirr/bank transfers,
              promising guaranteed contract awards, impersonating government ministries, or
              distributing malicious links is subject to immediate takedown, strike logging, and
              account suspension.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              4. Intellectual Property & Document Redistribution
            </h3>
            <p>
              Official bidding documents remain the intellectual property of their respective
              issuing organisations. TenderLink Ethiopia links to official public sources or hosts
              files explicitly uploaded by authorised publishers, and promptly honours takedown or
              attribution correction requests.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A]">
              5. ETB Subscriptions & Chapa Payments
            </h3>
            <p>
              All paid seeker plans and publisher packages are denominated in Ethiopian Birr (ETB)
              and processed exclusively through Chapa hosted checkout (Telebirr and supported
              Ethiopian payment channels). Paid access is activated only upon server-side
              verification of cleared settlement.
            </p>
          </section>
        </article>
      )}

      {/* TAB 3: MY PRIVACY CONTROLS, DSR, EXPORT & ACCOUNT DELETION */}
      {tab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consent Preferences Card */}
          <form
            onSubmit={handleSaveConsent}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                Cookie, Marketing & Notification Consents
              </h2>
            </div>

            {consentSavedMsg && (
              <StateBanner compact variant="success" title="Saved" description={consentSavedMsg} />
            )}

            <div className="space-y-3 text-sm">
              <label className="flex items-start justify-between gap-3 py-2 border-b border-[#F1F5F9]">
                <div>
                  <div className="font-medium text-[#0B1F3A]">Essential Security & Language</div>
                  <div className="text-xs text-[#64748B]">Always active for sessions & EN/AM preference.</div>
                </div>
                <input type="checkbox" checked disabled className="mt-1 accent-[#2563EB]" />
              </label>

              <label className="flex items-start justify-between gap-3 py-2 border-b border-[#F1F5F9] cursor-pointer">
                <div>
                  <div className="font-medium text-[#0B1F3A]">Privacy-Safe Product Analytics</div>
                  <div className="text-xs text-[#64748B]">Aggregated search & latency metrics (no third-party ad trackers).</div>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                  className="mt-1 accent-[#2563EB]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 py-2 border-b border-[#F1F5F9] cursor-pointer">
                <div>
                  <div className="font-medium text-[#0B1F3A]">Tender Alert Notifications</div>
                  <div className="text-xs text-[#64748B]">Email, push, or SMS alerts for saved searches & deadlines.</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationConsent}
                  onChange={(e) => setNotificationConsent(e.target.checked)}
                  className="mt-1 accent-[#2563EB]"
                />
              </label>

              <label className="flex items-start justify-between gap-3 py-2 cursor-pointer">
                <div>
                  <div className="font-medium text-[#0B1F3A]">Marketing & Promotional Updates</div>
                  <div className="text-xs text-[#64748B]">Optional announcements about new sectors or ETB plans.</div>
                </div>
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 accent-[#2563EB]"
                />
              </label>
            </div>

            <AppButton type="submit" variant="primary" size="sm">
              Save Consent Preferences
            </AppButton>
          </form>

          {/* Self-Service Data Export & Account Deletion */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                Self-Service Data Export & Account Deletion
              </h2>
            </div>

            {accountFeedback && (
              <StateBanner compact variant="success" title="Status" description={accountFeedback} />
            )}

            {!session ? (
              <div className="space-y-3 text-sm text-[#475569]">
                <p>
                  Sign in to download a complete JSON copy of your personal data or immediately
                  delete and anonymise your account.
                </p>
                <AppButton size="sm" variant="primary" onClick={onOpenAuth}>
                  Sign In to Manage My Account
                </AppButton>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Right to Data Portability
                  </div>
                  <p className="text-xs text-[#475569]">
                    Downloads your profile, consents, bookmarks, saved searches, subscriptions, and
                    invoices in structured JSON (password hashes and MFA secrets are never exported).
                  </p>
                  <AppButton size="sm" variant="secondary" onClick={handleExportData}>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Download My Personal Data (JSON)
                  </AppButton>
                </div>

                <form
                  onSubmit={handleDeleteAccount}
                  className="pt-4 border-t border-[#E2E8F0] space-y-3"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#B91C1C] flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Permanent Account Deletion & Anonymisation</span>
                  </div>
                  <p className="text-xs text-[#475569]">
                    Revokes all active sessions, deletes bookmarks/alerts, and anonymises your
                    personal profile. Statutory ETB invoice totals remain archived anonymously.
                  </p>
                  <input
                    type="text"
                    required
                    value={deletePhrase}
                    onChange={(e) => setDeletePhrase(e.target.value)}
                    placeholder='Type "DELETE MY ACCOUNT" to confirm'
                    className="w-full min-h-[40px] rounded-lg border border-[#FCA5A5] px-3 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Optional reason for leaving"
                    className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-xs"
                  />
                  <AppButton type="submit" size="sm" variant="destructive">
                    Delete & Anonymise My Account
                  </AppButton>
                </form>
              </div>
            )}
          </div>

          {/* Formal Data-Subject Request (DSR) Form */}
          <form
            onSubmit={handleSubmitDsr}
            className="lg:col-span-2 rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4"
          >
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#0B1F3A]">
                Submit a Data-Subject Request (Proclamation No. 1321/2024 Workflow)
              </h2>
            </div>

            {dsrFeedback && (
              <StateBanner compact variant="success" title="DSR Logged" description={dsrFeedback} />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={dsrEmail}
                  onChange={(e) => setDsrEmail(e.target.value)}
                  placeholder="your.email@company.et"
                  className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] mb-1">
                  Request Type
                </label>
                <select
                  value={dsrType}
                  onChange={(e) =>
                    setDsrType(e.target.value as typeof dsrType)
                  }
                  className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-sm bg-white"
                >
                  <option value="access">Access personal data held</option>
                  <option value="rectification">Rectify inaccurate personal data</option>
                  <option value="erasure">Erasure / deletion request</option>
                  <option value="portability">Data portability copy</option>
                  <option value="objection">Object to processing</option>
                  <option value="withdraw_consent">Withdraw consent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">
                Request Details
              </label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={dsrDetails}
                onChange={(e) => setDsrDetails(e.target.value)}
                placeholder="Describe your request so our privacy team can verify identity and respond within 30 days."
                className="w-full rounded-lg border border-[#CBD5E1] p-3 text-sm"
              />
            </div>

            <AppButton type="submit" size="sm" variant="primary">
              Submit Privacy Request
            </AppButton>
          </form>
        </div>
      )}

      {/* TAB 4: PLATFORM INTEGRITY, BREACH RESPONSE & RETENTION GOVERNANCE */}
      {tab === 'governance' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#0B1F3A]">
              Security, Privacy & Platform Integrity Operations
            </h2>
            <div className="flex flex-wrap gap-2">
              <AppButton size="sm" variant="secondary" onClick={loadGovernance} disabled={govLoading}>
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Refresh
              </AppButton>
              <AppButton size="sm" variant="primary" onClick={handleRunRetentionSweep}>
                Run Retention Sweep Now
              </AppButton>
            </div>
          </div>

          {govError && (
            <StateBanner compact variant="error" title="Access / Load Error" description={govError} />
          )}
          {actionBanner && (
            <StateBanner compact variant="success" title="Action Recorded" description={actionBanner} />
          )}

          {/* Consent & Governance Summary Strip */}
          {privacyGov && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Consent Records', value: privacyGov.consentStats.total },
                { label: 'Open DSRs', value: privacyGov.dataSubjectRequests.length },
                { label: 'Abuse Reports', value: integrityGov?.abuseReports.length ?? 0 },
                { label: 'Security Incidents', value: privacyGov.securityIncidents.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]"
                >
                  <div className="text-xs text-[#64748B] font-medium">{stat.label}</div>
                  <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#0B1F3A]">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Abuse Reports & Takedown Queue */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#B91C1C]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Abuse & Fake-Listing Takedown Queue
                </h3>
              </div>

              {!integrityGov || integrityGov.abuseReports.length === 0 ? (
                <p className="text-xs text-[#64748B]">
                  No abuse reports filed yet. Use "Report listing" on any tender in the Tenders feed to test takedowns.
                </p>
              ) : (
                <ul className="divide-y divide-[#E2E8F0]">
                  {integrityGov.abuseReports.map((r) => (
                    <li key={r.id} className="py-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F172A]">{r.tenderTitleEn}</span>
                        <span className="font-mono uppercase text-[#64748B]">{r.status}</span>
                      </div>
                      <div className="text-[#475569]">
                        Reason: <strong>{r.reason}</strong> · {r.details}
                      </div>
                      {r.status === 'open' && (
                        <div className="flex gap-2 pt-1">
                          <AppButton
                            size="sm"
                            variant="destructive"
                            onClick={() => handleResolveAbuse(r.id, 'takedown')}
                          >
                            Takedown & Archive Tender
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={() => handleResolveAbuse(r.id, 'dismiss')}
                          >
                            Dismiss
                          </AppButton>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Publisher Verification Queue */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Publisher Verification Workflow
                </h3>
              </div>

              <form onSubmit={handleSubmitVerification} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-3 border-b border-[#E2E8F0]">
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organisation Legal Name"
                  className="min-h-[38px] rounded-lg border border-[#CBD5E1] px-3 text-xs"
                />
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as typeof orgType)}
                  className="min-h-[38px] rounded-lg border border-[#CBD5E1] px-2.5 text-xs bg-white"
                >
                  <option value="private_company">Private Company</option>
                  <option value="ngo">NGO / Humanitarian</option>
                  <option value="public_enterprise">Public Enterprise</option>
                  <option value="university">University / Hospital</option>
                </select>
                <input
                  type="text"
                  required
                  value={orgLicense}
                  onChange={(e) => setOrgLicense(e.target.value)}
                  placeholder="Business License / Reg #"
                  className="min-h-[38px] rounded-lg border border-[#CBD5E1] px-3 text-xs font-mono"
                />
                <input
                  type="email"
                  required
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="Official Email (e.g. tenders@org.et)"
                  className="min-h-[38px] rounded-lg border border-[#CBD5E1] px-3 text-xs"
                />
                <div className="sm:col-span-2">
                  <AppButton type="submit" size="sm" variant="secondary">
                    Submit Publisher Verification
                  </AppButton>
                </div>
              </form>

              {integrityGov && integrityGov.publisherVerifications.length > 0 && (
                <ul className="divide-y divide-[#E2E8F0]">
                  {integrityGov.publisherVerifications.map((v) => (
                    <li key={v.id} className="py-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A]">{v.organisationNameEn}</span>
                        <span
                          className={`font-mono uppercase font-semibold ${
                            v.status === 'verified' ? 'text-[#15803D]' : 'text-[#1D4ED8]'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div className="text-[#64748B] font-mono">
                        License: {v.licenseNumber} · {v.officialEmailMasked} · Strikes: {v.strikeCount}
                      </div>
                      {v.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <AppButton
                            size="sm"
                            variant="primary"
                            onClick={() => handleReviewVerification(v.id, 'verified')}
                          >
                            Approve Verified
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={() => handleReviewVerification(v.id, 'rejected')}
                          >
                            Reject
                          </AppButton>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Breach-Response & 72-Hour Incident Register */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#92400E]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Breach-Response Incident Log (72h Clock)
                </h3>
              </div>

              <form onSubmit={handleLogIncident} className="space-y-2.5 pb-3 border-b border-[#E2E8F0]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={incTitle}
                    onChange={(e) => setIncTitle(e.target.value)}
                    placeholder="Incident title"
                    className="sm:col-span-2 min-h-[38px] rounded-lg border border-[#CBD5E1] px-3 text-xs"
                  />
                  <select
                    value={incSeverity}
                    onChange={(e) => setIncSeverity(e.target.value as typeof incSeverity)}
                    className="min-h-[38px] rounded-lg border border-[#CBD5E1] px-2.5 text-xs bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <textarea
                  required
                  minLength={10}
                  rows={2}
                  value={incSummary}
                  onChange={(e) => setIncSummary(e.target.value)}
                  placeholder="Summary of impact & immediate containment steps..."
                  className="w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs text-[#475569]">
                    <label className="flex items-center gap-1.5">
                      <span>Est. records:</span>
                      <input
                        type="number"
                        min={0}
                        value={incAffected}
                        onChange={(e) => setIncAffected(e.target.value)}
                        className="w-20 min-h-[32px] rounded border border-[#CBD5E1] px-2 font-mono"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={incPersonalData}
                        onChange={(e) => setIncPersonalData(e.target.checked)}
                        className="accent-[#2563EB]"
                      />
                      <span>Personal data</span>
                    </label>
                  </div>
                  <AppButton type="submit" size="sm" variant="secondary">
                    Log Incident
                  </AppButton>
                </div>
              </form>

              {privacyGov && privacyGov.securityIncidents.length > 0 && (
                <ul className="divide-y divide-[#E2E8F0]">
                  {privacyGov.securityIncidents.map((inc) => (
                    <li key={inc.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0B1F3A]">{inc.title}</span>
                        <span className="font-mono uppercase text-[#92400E]">{inc.severity}</span>
                      </div>
                      <p className="text-[#475569]">{inc.summary}</p>
                      <div className="font-mono text-[11px] text-[#64748B]">
                        72h Assessment Due: {new Date(inc.notificationDeadline72h).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Immutable Audit Trail Preview */}
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Recent Sensitive Action Audit Trail
                </h3>
              </div>

              {privacyGov && privacyGov.recentAuditEvents.length > 0 ? (
                <ul className="divide-y divide-[#F1F5F9]">
                  {privacyGov.recentAuditEvents.slice(0, 10).map((ev) => (
                    <li key={ev.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-mono font-medium text-[#0F172A]">{ev.action}</span>
                        <span className="text-[#64748B]"> · {ev.entityType}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#64748B] shrink-0">
                        {new Date(ev.createdAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#64748B]">No recent audit events loaded.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
