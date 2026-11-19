import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { AppButton } from './AppButton';

const CONSENT_STORAGE_KEY = 'tenderlink_privacy_consent_v1';
const VISITOR_ID_KEY = 'tenderlink_visitor_id';

export interface StoredConsent {
  visitorId: string;
  essentialCookies: boolean;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  notificationConsent: boolean;
  policyVersion: string;
  updatedAt: string;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'server-visitor';
  let id = window.localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = `tlv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export function readStoredConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

export function writeStoredConsent(consent: StoredConsent) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
}

interface ConsentBannerProps {
  accessToken?: string | null;
  onOpenPrivacyCenter: () => void;
}

export function ConsentBanner({
  accessToken,
  onOpenPrivacyCenter,
}: ConsentBannerProps) {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = readStoredConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const persistChoice = async (acceptOptional: boolean) => {
    setSaving(true);
    const visitorId = getOrCreateVisitorId();
    const payload = {
      visitorId,
      analyticsConsent: acceptOptional,
      marketingConsent: acceptOptional,
      notificationConsent: acceptOptional,
      policyVersion: '2026-04-v1',
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      await fetch('/api/v1/privacy/consent', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      // Keep local preference even if offline
    } finally {
      writeStoredConsent({
        ...payload,
        essentialCookies: true,
        updatedAt: new Date().toISOString(),
      });
      setSaving(false);
      setVisible(false);
    }
  };

  return (
    <aside
      aria-label={lang === 'am' ? 'የግላዊነት እና ኩኪ ምርጫ' : 'Privacy and cookie consent'}
      className="fixed bottom-16 md:bottom-4 inset-x-3 sm:inset-x-6 z-40 max-w-4xl mx-auto rounded-xl border border-[#CBD5E1] bg-white shadow-sm px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Shield
            className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1 text-xs sm:text-sm text-[#334155]">
            <p className="font-semibold text-[#0F172A]">
              {lang === 'am'
                ? 'የግላዊነት እና የኩኪ ፈቃድ ምርጫዎች'
                : 'Privacy & Cookie Preferences'}
            </p>
            <p className="leading-relaxed">
              {lang === 'am'
                ? 'TenderLink Ethiopia አስፈላጊ የመግቢያ እና ቋንቋ ምርጫ ኩኪዎችን ይጠቀማል። የትንታኔ፣ የማስታወቂያ እና የማንቂያ ፈቃዶች በፈቃድዎ ብቻ ይነቃሉ።'
                : 'TenderLink Ethiopia uses strictly necessary storage for language and session security. Optional analytics, marketing, and alert consents are disabled until you opt in.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onOpenPrivacyCenter();
            }}
            className="min-h-[38px] px-3 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
          >
            {lang === 'am' ? 'ምርጫዎችን አስተካክል' : 'Manage'}
          </button>
          <AppButton
            size="sm"
            variant="secondary"
            disabled={saving}
            onClick={() => persistChoice(false)}
          >
            {lang === 'am' ? 'አስፈላጊ ብቻ' : 'Essential Only'}
          </AppButton>
          <AppButton
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={() => persistChoice(true)}
          >
            {lang === 'am' ? 'ሁሉንም ፍቀድ' : 'Accept All'}
          </AppButton>
        </div>
      </div>
    </aside>
  );
}
