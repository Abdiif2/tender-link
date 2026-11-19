import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { AppButton } from '../components/ui/AppButton';

export function PublishPreviewView({
  onBackToTenders,
}: {
  onBackToTenders: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
          {t.publish.heading}
        </h1>
        <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
          {t.publish.subtitle}
        </p>
      </section>

      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(11,31,58,0.04)] p-6 space-y-5">
        <p className="text-sm text-[#475569] leading-relaxed">
          {t.publish.milestoneNote}
        </p>

        <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
          <h2 className="text-sm font-semibold text-[#0B1F3A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" aria-hidden="true" />
            <span>{t.publish.rulesTitle}</span>
          </h2>
          <ul className="space-y-2 text-sm text-[#475569] list-disc ps-5">
            <li>{t.publish.rule1}</li>
            <li>{t.publish.rule2}</li>
            <li>{t.publish.rule3}</li>
          </ul>
        </div>

        <div className="pt-2">
          <AppButton variant="primary" onClick={onBackToTenders}>
            {t.publish.backToTenders}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
