import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Flag, Search, Star, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { formatEatDate, formatEtb } from '../i18n/translations';
import {
  HealthResponse,
  PreviewTenderItem,
  TenderSourceType,
} from '../types/foundation';
import { AppButton } from '../components/ui/AppButton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SkeletonRow } from '../components/ui/Skeletons';
import { StateBanner } from '../components/ui/StateBanner';
import { TenderStatusLabel } from '../components/ui/DomainComponents';

type SourceFilterValue = 'all' | TenderSourceType;

interface HomeFoundationViewProps {
  health: HealthResponse | null;
  healthLoading: boolean;
}

export function HomeFoundationView({
  health,
  healthLoading,
}: HomeFoundationViewProps) {
  const { lang, t } = useLanguage();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PreviewTenderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Abuse report modal state
  const [reportingTender, setReportingTender] = useState<PreviewTenderItem | null>(null);
  const [reportReason, setReportReason] = useState<
    | 'fake_or_scam'
    | 'expired_or_wrong_deadline'
    | 'duplicate_listing'
    | 'wrong_organisation'
    | 'broken_or_malicious_link'
    | 'policy_violation'
    | 'other'
  >('fake_or_scam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const handleSubmitAbuseReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingTender) return;
    setReportBusy(true);
    setReportNotice(null);
    try {
      const res = await fetch(`/api/v1/tenders/${reportingTender.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails,
          reporterEmail: reportEmail.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Could not submit report.');
      }
      setReportDetails('');
      setReportNotice(
        lang === 'am'
          ? 'ሪፖርትዎ ለአስተዳዳሪ ግምገማ ተልኳል። እናመሰግናለን።'
          : 'Report submitted to the TenderLink integrity & takedown queue. Thank you.'
      );
    } catch (err) {
      setReportNotice(err instanceof Error ? err.message : 'Report failed.');
    } finally {
      setReportBusy(false);
    }
  };

  const loadTenders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (sourceFilter !== 'all') {
        params.set('sourceType', sourceFilter);
      }

      const res = await fetch(`/api/v1/tenders/preview?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || t.states.errorFallback);
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.pagination?.total ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.states.errorFallback);
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, t.states.errorFallback]);

  useEffect(() => {
    loadTenders();
  }, [loadTenders]);

  const handleSourceChange = (next: SourceFilterValue) => {
    setSourceFilter(next);
    setPage(1);
  };

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.titleEn,
        item.titleAm,
        item.summaryEn,
        item.summaryAm,
        item.publisherNameDisplay,
        item.referenceNumber,
        item.categoryNameEn,
        item.categoryNameAm,
        item.regionNameEn,
        item.regionNameAm,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, searchQuery]);

  return (
    <div className="space-y-7">
      {/* Header & KPI Cards */}
      <section className="space-y-5">
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
            {t.home.heading}
          </h1>
          <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
            {t.home.subtitle}
          </p>
        </div>

        {/* Fintech KPI Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: t.home.sampleTendersLabel,
              value: health?.counts.sampleTenders ?? '—',
            },
            {
              label: t.home.categoriesLabel,
              value: health?.counts.categories ?? '—',
            },
            {
              label: t.home.regionsLabel,
              value: health?.counts.regions ?? '—',
            },
            {
              label: t.home.plansLabel,
              value: health?.counts.subscriptionPlans ?? '—',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 sm:px-5 sm:py-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]"
            >
              <div className="text-xs font-medium text-[#64748B]">{stat.label}</div>
              <div className="mt-1.5 font-mono tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-[#0B1F3A]">
                {healthLoading ? '…' : stat.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Clear Sample Data Notice */}
      <StateBanner
        compact
        variant="warning"
        title={t.disclaimer.sampleTag}
        description={t.disclaimer.sampleDataBanner}
      />

      {/* Minimal Dashboard Controls & Tender Feed */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Search Input */}
          <div className="relative w-full lg:max-w-sm">
            <Search
              className="w-4 h-4 text-[#64748B] pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'am'
                  ? 'ጨረታ፣ አውጪ ድርጅት ወይም መለያ ቁጥር ይፈልጉ...'
                  : 'Search title, publisher, sector, or ref #...'
              }
              aria-label={lang === 'am' ? 'ጨረታዎችን ይፈልጉ' : 'Search tenders'}
              className="w-full min-h-[42px] rounded-xl border border-[#CBD5E1] bg-white ps-10 pe-9 text-sm text-[#0B1F3A] placeholder:text-[#94A3B8] shadow-[0_1px_2px_rgba(11,31,58,0.03)] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#64748B] hover:text-[#0B1F3A] hover:bg-[#EDF1F7] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <SegmentedControl<SourceFilterValue>
              label={t.home.sourceFilterLabel}
              value={sourceFilter}
              onChange={handleSourceChange}
              options={[
                { value: 'all', label: t.sources.all },
                { value: 'official_source', label: t.sources.official_source },
                { value: 'publisher_submitted', label: t.sources.publisher_submitted },
                { value: 'partner_feed', label: t.sources.partner_feed },
                { value: 'user_reported', label: t.sources.user_reported },
              ]}
            />
            <p
              aria-live="polite"
              className="text-xs font-mono tabular-nums text-[#64748B] shrink-0"
            >
              {t.home.showingRange} {visibleItems.length} / {total}
            </p>
          </div>
        </div>

        {/* Feed Container (Single-Elevation Rounded White Surface) */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(11,31,58,0.04)] overflow-hidden">
          {loading ? (
            <div className="px-4 sm:px-6" aria-label={t.states.loadingLabel}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : error ? (
            <div className="p-6">
              <StateBanner
                variant="error"
                title={t.states.errorTitle}
                description={error}
                actionLabel={t.states.retry}
                onAction={loadTenders}
              />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="p-6">
              <StateBanner
                variant="empty"
                title={t.home.emptyTitle}
                description={t.home.emptyBody}
                actionLabel={t.home.resetFilter}
                onAction={() => {
                  setSearchQuery('');
                  handleSourceChange('all');
                }}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {visibleItems.map((item) => {
                const title =
                  lang === 'am' && item.titleAm ? item.titleAm : item.titleEn;
                const summary =
                  lang === 'am' && item.summaryAm ? item.summaryAm : item.summaryEn;
                const categoryName =
                  lang === 'am' ? item.categoryNameAm : item.categoryNameEn;
                const regionName =
                  lang === 'am' ? item.regionNameAm : item.regionNameEn;

                return (
                  <li
                    key={item.id}
                    className="px-4 py-5 sm:px-6 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Primary Left Column */}
                      <div className="space-y-2 min-w-0 flex-1">
                        {/* Line 1: Clean Unboxed Provenance Metadata (Zero Pills) */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#475569]">
                          <span className="font-semibold text-[#1D4ED8]">
                            {t.sources[item.sourceType]}
                          </span>
                          <span aria-hidden="true" className="text-[#CBD5E1]">
                            ·
                          </span>
                          <span className="font-semibold text-[#0B1F3A]">
                            {item.publisherNameDisplay}
                          </span>
                          <span aria-hidden="true" className="text-[#CBD5E1]">
                            ·
                          </span>
                          <span>{regionName}</span>
                          {item.isFeatured && (
                            <>
                              <span aria-hidden="true" className="text-[#CBD5E1]">
                                ·
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold text-[#B45309]">
                                <Star className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{t.home.featuredLabel}</span>
                              </span>
                            </>
                          )}
                          {item.isSampleData && (
                            <>
                              <span aria-hidden="true" className="text-[#CBD5E1]">
                                ·
                              </span>
                              <span className="font-medium text-[#B45309]">
                                {t.disclaimer.sampleTag}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Line 2: Title & Summary */}
                        <div className="space-y-1">
                          <h2 className="text-base sm:text-[17px] font-semibold text-[#0B1F3A] leading-snug">
                            {title}
                          </h2>
                          <p className="text-sm text-[#475569] leading-relaxed max-w-[74ch]">
                            {summary}
                          </p>
                        </div>

                        {/* Line 3: Sector, Method, Ref #, Documents & Report */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#64748B] pt-0.5">
                          <span>{categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.methods[item.procurementMethod]}</span>
                          {item.referenceNumber && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span dir="ltr" className="font-mono tabular-nums text-[#334155]">
                                {item.referenceNumber}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>
                            {t.home.publishedOn}:{' '}
                            <span dir="ltr" className="font-mono tabular-nums text-[#0B1F3A]">
                              {formatEatDate(item.publishedAt, lang)}
                            </span>
                          </span>
                          {item.hasDocuments && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 text-[#2563EB] font-medium">
                                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{t.home.documentsAttached}</span>
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReportingTender(item);
                              setReportNotice(null);
                            }}
                            className="inline-flex items-center gap-1 text-[#64748B] hover:text-[#B91C1C] font-medium cursor-pointer transition-colors"
                          >
                            <Flag className="w-3 h-3" aria-hidden="true" />
                            <span>{lang === 'am' ? 'ችግር ሪፖርት አድርግ' : 'Report listing'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Right Scannable Status, Deadline & Fee Column */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 md:gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-[#EDF1F7] shrink-0 md:min-w-[180px]">
                        <TenderStatusLabel status={item.status} />
                        <div className="text-xs text-[#64748B] md:text-right">
                          <span>{t.home.closesOn}: </span>
                          <span
                            dir="ltr"
                            className="font-mono tabular-nums font-semibold text-[#0B1F3A]"
                          >
                            {formatEatDate(item.closingAt, lang)}
                          </span>
                        </div>
                        <div
                          dir="ltr"
                          className="text-xs font-mono tabular-nums font-medium text-[#334155]"
                        >
                          {item.documentFeeEtb && item.documentFeeEtb > 0
                            ? `${t.home.docFee}: ${formatEtb(item.documentFeeEtb, lang)}`
                            : t.home.freeDoc}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination Footer */}
          {!loading && !error && total > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/60 flex items-center justify-between gap-3">
              <AppButton
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                {t.home.previousPage}
              </AppButton>

              <span className="text-xs font-mono tabular-nums text-[#475569]">
                {t.home.pageOf} {page} / {totalPages}
              </span>

              <AppButton
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t.home.nextPage}
                <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </AppButton>
            </div>
          )}
        </div>
      </section>

      {/* Report Abuse / Fake Listing Modal */}
      {reportingTender && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-abuse-title"
          className="fixed inset-0 z-50 bg-[#0B1F3A]/50 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setReportingTender(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="report-abuse-title" className="text-base font-bold text-[#0B1F3A]">
                  {lang === 'am' ? 'የጨረታ ችግር ሪፖርት አድርግ' : 'Report Suspicious or Inaccurate Listing'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2">
                  {reportingTender.titleEn}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setReportingTender(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#0B1F3A] hover:bg-[#EDF1F7] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {reportNotice && (
              <StateBanner compact variant="success" title="Report Status" description={reportNotice} />
            )}

            <form onSubmit={handleSubmitAbuseReport} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#0B1F3A] mb-1">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
                  className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0B1F3A] bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="fake_or_scam">Suspected fake tender or advance-fee scam</option>
                  <option value="wrong_organisation">Wrong or impersonated organisation</option>
                  <option value="broken_or_malicious_link">Broken or malicious document/source link</option>
                  <option value="expired_or_wrong_deadline">Expired or incorrect closing date</option>
                  <option value="duplicate_listing">Duplicate tender listing</option>
                  <option value="policy_violation">Policy or copyright/IP violation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0B1F3A] mb-1">
                  Details (min 10 characters)
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explain what appears fake, inaccurate, or unsafe..."
                  className="w-full rounded-lg border border-[#CBD5E1] p-2.5 text-sm text-[#0B1F3A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0B1F3A] mb-1">
                  Your Email (optional)
                </label>
                <input
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="Optional email for follow-up"
                  className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0B1F3A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setReportingTender(null)}
                >
                  Close
                </AppButton>
                <AppButton type="submit" size="sm" variant="destructive" disabled={reportBusy}>
                  {reportBusy ? 'Submitting…' : 'Submit Report'}
                </AppButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
