import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { TaxonomyResponse } from '../types/foundation';
import { AppButton } from '../components/ui/AppButton';
import { AppInput, AppSelect } from '../components/ui/AppFormFields';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonRow } from '../components/ui/Skeletons';
import { StateBanner } from '../components/ui/StateBanner';
import {
  EtbPriceDisplay,
  TenderStatusLabel,
} from '../components/ui/DomainComponents';

type DemoState = 'loading' | 'empty' | 'error' | 'offline' | 'success';

interface UiKitShowcaseViewProps {
  taxonomy: TaxonomyResponse | null;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
}

export function UiKitShowcaseView({
  taxonomy,
  simulatedOffline,
  onToggleSimulatedOffline,
}: UiKitShowcaseViewProps) {
  const { lang, t } = useLanguage();
  const [demoState, setDemoState] = useState<DemoState>('loading');

  // Bilingual client-side validation demo state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sector, setSector] = useState('');
  const [errors, setErrors] = useState<{
    fullName?: string;
    phone?: string;
    sector?: string;
  }>({});
  const [validated, setValidated] = useState(false);

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (fullName.trim().length < 3) {
      nextErrors.fullName = t.uiKit.errorNameRequired;
    }
    if (!/^\+251[79]\d{8}$/.test(phone.trim())) {
      nextErrors.phone = t.uiKit.errorPhoneFormat;
    }
    if (!sector) {
      nextErrors.sector = t.uiKit.errorSectorRequired;
    }

    setErrors(nextErrors);
    setValidated(Object.keys(nextErrors).length === 0);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
          {t.uiKit.heading}
        </h1>
        <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
          {t.uiKit.subtitle}
        </p>
      </section>

      {/* 1. Interactive Global States Tester */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-semibold text-[#0B1F3A]">
              {t.uiKit.stateDemoTitle}
            </h2>
            <p className="text-sm text-[#475569]">{t.uiKit.stateDemoDesc}</p>
          </div>
          <AppButton
            size="sm"
            variant="secondary"
            onClick={onToggleSimulatedOffline}
          >
            {simulatedOffline
              ? t.uiKit.restoreOnlineBtn
              : t.uiKit.simulateOfflineBtn}
          </AppButton>
        </div>

        <SegmentedControl<DemoState>
          label="Global UI State Preview"
          value={demoState}
          onChange={setDemoState}
          options={[
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
            { value: 'error', label: 'Error' },
            { value: 'offline', label: 'Offline' },
            { value: 'success', label: 'Success' },
          ]}
        />

        <div className="pt-2">
          {demoState === 'loading' && (
            <div className="rounded-xl border border-[#E2E8F0] px-4">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}
          {demoState === 'empty' && (
            <StateBanner
              variant="empty"
              title={t.home.emptyTitle}
              description={t.home.emptyBody}
              actionLabel={t.home.resetFilter}
              onAction={() => setDemoState('success')}
            />
          )}
          {demoState === 'error' && (
            <StateBanner
              variant="error"
              title={t.states.errorTitle}
              description={t.states.errorFallback}
              actionLabel={t.states.retry}
              onAction={() => setDemoState('loading')}
            />
          )}
          {demoState === 'offline' && (
            <StateBanner
              variant="offline"
              title={t.states.offlineTitle}
              description={t.states.offlineBody}
              actionLabel={t.states.retry}
              onAction={() => setDemoState('success')}
            />
          )}
          {demoState === 'success' && (
            <StateBanner
              variant="success"
              title={t.uiKit.validationSuccess}
              description={t.home.subtitle}
            />
          )}
        </div>
      </section>

      {/* 2. Bilingual Form Validation Demo */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-5">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-semibold text-[#0B1F3A]">
            {t.uiKit.formValidationTitle}
          </h2>
          <p className="text-sm text-[#475569]">{t.uiKit.formValidationDesc}</p>
        </div>

        <form onSubmit={handleValidate} noValidate className="space-y-4 max-w-xl">
          <AppInput
            id="demo-fullname"
            label={t.uiKit.fullNameLabel}
            placeholder={t.uiKit.fullNamePlaceholder}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setValidated(false);
            }}
            error={errors.fullName}
            required
          />
          <AppInput
            id="demo-phone"
            label={t.uiKit.phoneLabel}
            placeholder={t.uiKit.phonePlaceholder}
            inputMode="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setValidated(false);
            }}
            error={errors.phone}
            required
          />
          <AppSelect
            id="demo-sector"
            label={t.uiKit.sectorLabel}
            placeholder={t.uiKit.sectorPlaceholder}
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setValidated(false);
            }}
            error={errors.sector}
            required
            options={(taxonomy?.categories ?? []).map((c) => ({
              value: c.id,
              label: lang === 'am' ? c.nameAm : c.nameEn,
            }))}
          />

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <AppButton type="submit" variant="primary">
              {t.uiKit.validateBtn}
            </AppButton>
          </div>

          {validated && (
            <StateBanner
              compact
              variant="success"
              title={t.uiKit.validationSuccess}
              description={`${fullName.trim()} · ${phone.trim()}`}
            />
          )}
        </form>
      </section>

      {/* 3. Primitives Showcase */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-5">
        <h2 className="text-base sm:text-lg font-semibold text-[#0B1F3A]">
          {t.uiKit.componentsTitle}
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <AppButton variant="primary">Primary Action</AppButton>
          <AppButton variant="secondary">Secondary</AppButton>
          <AppButton variant="ghost">Ghost</AppButton>
          <AppButton variant="destructive">Destructive</AppButton>
          <AppButton variant="primary" loading>
            Loading
          </AppButton>
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center gap-6">
          <TenderStatusLabel status="published" />
          <TenderStatusLabel status="amended" />
          <TenderStatusLabel status="pending_review" />
          <TenderStatusLabel status="expired" />
          <TenderStatusLabel status="cancelled" />
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-baseline gap-6">
          <EtbPriceDisplay amount={0} />
          <EtbPriceDisplay amount={499} suffix={t.plans.perMonth} />
          <EtbPriceDisplay amount={1499} suffix={t.plans.perMonth} />
        </div>
      </section>
    </div>
  );
}
