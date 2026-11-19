import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  CreditCard,
  FilePlus2,
  Layers,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { GlobalErrorBoundary } from './components/ui/GlobalErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { IndependenceNotice } from './components/ui/DomainComponents';
import { AppButton } from './components/ui/AppButton';
import { ConsentBanner } from './components/ui/ConsentBanner';
import {
  AuthSessionModal,
  type AuthSessionState,
} from './components/ui/AuthSessionModal';
import { HomeFoundationView } from './views/HomeFoundationView';
import { PlansPreviewView } from './views/PlansPreviewView';
import { PublishPreviewView } from './views/PublishPreviewView';
import { AdminIngestionView } from './views/AdminIngestionView';
import { UiKitShowcaseView } from './views/UiKitShowcaseView';
import { TrustPrivacyView, type TrustTab } from './views/TrustPrivacyView';
import { HealthResponse, TaxonomyResponse } from './types/foundation';

type ActiveTab = 'tenders' | 'plans' | 'publish' | 'admin' | 'ui-kit' | 'trust';

const SESSION_STORAGE_KEY = 'tenderlink_auth_session_v1';

function loadSavedSession(): AuthSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSessionState) : null;
  } catch {
    return null;
  }
}

function TenderLinkShell() {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tenders');
  const [trustInitialTab, setTrustInitialTab] = useState<TrustTab>('privacy');
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [session, setSession] = useState<AuthSessionState | null>(() => loadSavedSession());

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  const handleSessionChange = useCallback((next: AuthSessionState | null) => {
    setSession(next);
    if (typeof window !== 'undefined') {
      if (next) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  const openTrustSection = useCallback((section: TrustTab) => {
    setTrustInitialTab(section);
    setActiveTab('trust');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fetchFoundationData = useCallback(async () => {
    setHealthLoading(true);
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    try {
      const [healthRes, taxRes] = await Promise.all([
        fetch('/api/v1/health'),
        fetch('/api/v1/meta/taxonomy'),
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }
      if (!taxRes.ok) {
        const body = await taxRes.json().catch(() => null);
        throw new Error(body?.error?.message || t.states.errorFallback);
      }
      setTaxonomy(await taxRes.json());
    } catch (err: unknown) {
      setTaxonomyError(
        err instanceof Error ? err.message : t.states.errorFallback
      );
    } finally {
      setHealthLoading(false);
      setTaxonomyLoading(false);
    }
  }, [t.states.errorFallback]);

  useEffect(() => {
    fetchFoundationData();
  }, [fetchFoundationData]);

  const navItems: Array<{
    id: Exclude<ActiveTab, 'trust'>;
    label: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }> = [
    { id: 'tenders', label: t.nav.tenders, Icon: Briefcase },
    { id: 'plans', label: t.nav.plans, Icon: CreditCard },
    { id: 'publish', label: t.nav.publish, Icon: FilePlus2 },
    { id: 'admin', label: t.nav.admin, Icon: ShieldCheck },
    { id: 'ui-kit', label: t.nav.uiKit, Icon: Layers },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F5F9] text-[#0B1F3A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-lg focus:bg-[#2563EB] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t.nav.skipToContent}
      </a>

      {/* Strict 3-Zone Fintech Navy Top Bar (56px height, well within mobile sticky budget) */}
      <header className="sticky top-0 z-30 bg-[#0B1F3A] border-b border-[#163259]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('tenders')}
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.meta.appName}
          </button>

          {/* Zone 2: Clean Single-Line Nav Links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6"
          >
            {navItems.map((item) => {
              const isCurrent = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 text-sm whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isCurrent
                      ? 'border-[#3B82F6] text-white font-semibold'
                      : 'border-transparent text-[#CBD5E1] font-medium hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <AppButton
              size="sm"
              variant="primary"
              onClick={() => setAuthDialogOpen(true)}
            >
              {session ? (
                <>
                  <UserCheck className="w-4 h-4 text-white" aria-hidden="true" />
                  <span className="max-w-[110px] truncate">{session.user.fullName}</span>
                </>
              ) : (
                t.nav.signIn
              )}
            </AppButton>
          </div>
        </div>
      </header>

      {/* Global Offline Connectivity Banner */}
      <OfflineBanner
        simulatedOffline={simulatedOffline}
        onRestoreSimulated={() => setSimulatedOffline(false)}
      />

      {/* Non-Sticky Independent Platform Notice + EN/AM Switcher */}
      <IndependenceNotice />

      {/* Main Content */}
      <main
        id="main-content"
        className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12"
      >
        {activeTab === 'tenders' && (
          <HomeFoundationView health={health} healthLoading={healthLoading} />
        )}
        {activeTab === 'plans' && (
          <PlansPreviewView
            taxonomy={taxonomy}
            loading={taxonomyLoading}
            error={taxonomyError}
            onRetry={fetchFoundationData}
          />
        )}
        {activeTab === 'publish' && (
          <PublishPreviewView onBackToTenders={() => setActiveTab('tenders')} />
        )}
        {activeTab === 'admin' && <AdminIngestionView taxonomy={taxonomy} />}
        {activeTab === 'ui-kit' && (
          <UiKitShowcaseView
            taxonomy={taxonomy}
            simulatedOffline={simulatedOffline}
            onToggleSimulatedOffline={() => setSimulatedOffline((v) => !v)}
          />
        )}
        {activeTab === 'trust' && (
          <TrustPrivacyView
            initialTab={trustInitialTab}
            session={session}
            onOpenAuth={() => setAuthDialogOpen(true)}
            onSessionCleared={() => handleSessionChange(null)}
          />
        )}
      </main>

      {/* Quiet Editorial Footer with Privacy, Terms & Integrity Center Links */}
      <footer className="border-t border-[#E2E8F0] bg-white pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-3 text-xs text-[#64748B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p>{t.disclaimer.footerCopyright}</p>
            <nav aria-label="Legal and privacy links" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <button
                type="button"
                onClick={() => openTrustSection('privacy')}
                className="font-medium text-[#334155] hover:text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy'}
              </button>
              <button
                type="button"
                onClick={() => openTrustSection('terms')}
                className="font-medium text-[#334155] hover:text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'የአጠቃቀም ውሎች' : 'Terms of Use'}
              </button>
              <button
                type="button"
                onClick={() => openTrustSection('controls')}
                className="font-medium text-[#334155] hover:text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'የግል ውሂብ መብቶች' : 'Privacy Controls & DSR'}
              </button>
              <button
                type="button"
                onClick={() => openTrustSection('governance')}
                className="font-medium text-[#334155] hover:text-[#1D4ED8] hover:underline cursor-pointer"
              >
                {lang === 'am' ? 'ታማኝነት እና አስተዳደር' : 'Trust & Integrity'}
              </button>
            </nav>
          </div>
          <p className="max-w-3xl">{t.disclaimer.independentNotice}</p>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (56px, thumb-zone accessible on Android / mobile web) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E2E8F0]"
      >
        <div className="grid grid-cols-5 h-14">
          {navItems.map(({ id, label, Icon }) => {
            const isCurrent = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                  isCurrent ? 'text-[#2563EB] font-semibold' : 'text-[#64748B]'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden={true} />
                <span className="truncate max-w-[76px]">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Non-blocking Cookie & Privacy Consent Banner */}
      <ConsentBanner
        accessToken={session?.accessToken}
        onOpenPrivacyCenter={() => openTrustSection('controls')}
      />

      {/* Live Auth, OTP & TOTP MFA Session Modal */}
      <AuthSessionModal
        open={authDialogOpen}
        session={session}
        onClose={() => setAuthDialogOpen(false)}
        onSessionChange={handleSessionChange}
        onOpenPrivacyCenter={() => openTrustSection('controls')}
      />
    </div>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <LanguageProvider>
        <TenderLinkShell />
      </LanguageProvider>
    </GlobalErrorBoundary>
  );
}
