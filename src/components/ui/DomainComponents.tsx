import React from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Globe,
  Info,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatEtb } from '../../i18n/translations';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selection"
      className="inline-flex items-center rounded-lg bg-[#E8EDF5] p-0.5 shrink-0"
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          lang === 'en'
            ? 'bg-white text-[#0B1F3A] shadow-[0_1px_2px_rgba(11,31,58,0.08)]'
            : 'text-[#475569] hover:text-[#0B1F3A]'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang('am')}
        aria-pressed={lang === 'am'}
        className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
          lang === 'am'
            ? 'bg-white text-[#0B1F3A] shadow-[0_1px_2px_rgba(11,31,58,0.08)]'
            : 'text-[#475569] hover:text-[#0B1F3A]'
        }`}
      >
        አማ
      </button>
    </div>
  );
}

export function IndependenceNotice() {
  const { t } = useLanguage();
  return (
    <div className="bg-white border-b border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#475569] flex items-center gap-2 min-w-0">
          <Info className="w-3.5 h-3.5 text-[#2563EB] shrink-0" aria-hidden="true" />
          <span>{t.disclaimer.independentNotice}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Globe className="w-3.5 h-3.5 text-[#64748B]" aria-hidden="true" />
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}

export function EtbPriceDisplay({
  amount,
  suffix,
  emphasize = false,
}: {
  amount: number;
  suffix?: string;
  emphasize?: boolean;
}) {
  const { lang } = useLanguage();
  return (
    <span
      dir="ltr"
      className={`font-mono tabular-nums inline-flex items-baseline gap-1 ${
        emphasize
          ? 'text-2xl sm:text-3xl font-bold text-[#0F172A]'
          : 'text-sm font-medium text-[#0F172A]'
      }`}
    >
      <span>{formatEtb(amount, lang)}</span>
      {suffix && (
        <span className="font-sans text-xs font-normal text-[#64748B]">
          {suffix}
        </span>
      )}
    </span>
  );
}

export function TenderStatusLabel({
  status,
}: {
  status: 'draft' | 'pending_review' | 'published' | 'amended' | 'expired' | 'cancelled' | 'archived';
}) {
  const { t } = useLanguage();
  const label = t.statuses[status];

  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'amended') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] whitespace-nowrap">
        <Edit3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'pending_review' || status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B91C1C] whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
