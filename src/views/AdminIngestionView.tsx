import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FilePlus2,
  GitBranch,
  History,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { formatEatDate } from '../i18n/translations';
import { AppButton } from '../components/ui/AppButton';
import { AppInput, AppSelect } from '../components/ui/AppFormFields';
import { StateBanner } from '../components/ui/StateBanner';
import { TaxonomyResponse } from '../types/foundation';

interface AdminIngestionViewProps {
  taxonomy: TaxonomyResponse | null;
}

type AdminSubTab =
  | 'sources'
  | 'import'
  | 'manual'
  | 'moderation'
  | 'quality'
  | 'audit';

interface IngestionSourceItem {
  id: string;
  sourceKey: string;
  name: string;
  connectorType: string;
  tenderSourceType: string;
  sourceUrl: string | null;
  frequencyMinutes: number;
  authMethod: string;
  rateLimitPerMinute: number;
  legalReviewStatus: 'not_required' | 'pending_review' | 'approved' | 'rejected';
  robotsTxtNotes: string | null;
  termsOfServiceNotes: string | null;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface IngestionJobItem {
  id: string;
  sourceKey: string;
  sourceType: string;
  status: string;
  recordsFound: number;
  recordsSaved: number;
  recordsModeration: number;
  recordsDuped: number;
  recordsAmended: number;
  recordsFailed: number;
  errorSummary: string | null;
  errorLogJson: string[];
  startedAt: string | null;
  completedAt: string | null;
}

interface QualityFlagItem {
  code: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

interface ModerationQueueItem {
  caseId: string;
  tenderId: string;
  referenceNumber: string | null;
  titleEn: string;
  titleAm: string | null;
  publisherNameDisplay: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  closingAt: string;
  createdAt: string;
  priority: number;
  decisionReason: string | null;
  duplicateOfId: string | null;
  qualityScore: number;
  qualityFlags: QualityFlagItem[];
  duplicateMatchType: string;
  isSampleData: boolean;
  duplicateTarget: {
    id: string;
    titleEn: string;
    referenceNumber: string | null;
    publisherNameDisplay: string;
    closingAt: string;
  } | null;
}

interface AmendmentItem {
  id: string;
  tenderId: string;
  amendmentNumber: number;
  reasonEn: string;
  previousClosingAt: string | null;
  newClosingAt: string | null;
  publishedAt: string | null;
  tenderTitle: string;
  referenceNumber: string | null;
}

interface AuditItem {
  id: string;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
}

interface AdminOverviewResponse {
  sources: IngestionSourceItem[];
  jobs: IngestionJobItem[];
  moderationQueue: ModerationQueueItem[];
  amendments: AmendmentItem[];
  qualitySummary: {
    totalRecordsAnalysed: number;
    averageQualityScore: number;
    lowQualityCount: number;
    duplicateFlaggedCount: number;
    openModerationCount: number;
    amendmentsCount: number;
    flagBreakdown: Array<{ code: string; count: number }>;
  };
  auditTrail: AuditItem[];
}

interface RunReportResponse {
  jobId: string;
  sourceKey: string;
  sourceName: string;
  status: string;
  recordsFound: number;
  recordsSaved: number;
  recordsModeration: number;
  recordsDuped: number;
  recordsAmended: number;
  recordsFailed: number;
  errors: string[];
  rows: Array<{
    externalId: string;
    title: string;
    outcome: string;
    qualityScore: number;
    qualityFlags: QualityFlagItem[];
    duplicateMatchType: string;
    amendmentNumber: number | null;
    message: string;
  }>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read file from browser.'));
    reader.readAsDataURL(file);
  });
}

export const AdminIngestionView: React.FC<AdminIngestionViewProps> = ({
  taxonomy,
}) => {
  const { lang, t } = useLanguage();
  const [subTab, setSubTab] = useState<AdminSubTab>('sources');
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [runningConnector, setRunningConnector] = useState<string | null>(null);
  const [lastRunReport, setLastRunReport] = useState<RunReportResponse | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    variant: 'success' | 'error' | 'warning';
    title: string;
    description: string;
  } | null>(null);

  // CSV / Excel upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // Manual Entry state
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({
    referenceNumber: '',
    title: '',
    titleAm: '',
    publisherName: '',
    category: 'construction-civil-works',
    region: 'ET-AA',
    city: 'Addis Ababa',
    closingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    procurementMethod: 'open_national',
    documentFee: '500',
    bidSecurity: '50000',
    sourceType: 'publisher_submitted',
    sourceName: 'Manual Admin Verification Desk',
    sourceUrl: '',
    contactEmail: '',
    contactPhone: '',
    documentUrl: '',
    description: '',
    isSampleData: true,
  });

  // Moderation & Amendment state
  const [decisionBusyId, setDecisionBusyId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [amendTargetId, setAmendTargetId] = useState<string | null>(null);
  const [amendReason, setAmendReason] = useState('');
  const [amendNewClose, setAmendNewClose] = useState(
    new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [amendBusy, setAmendBusy] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/ingestion/overview');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || 'Failed to load ingestion dashboard.');
      }
      setOverview(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ingestion dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  async function handleRunConnector(sourceKey: string) {
    setRunningConnector(sourceKey);
    setActionBanner(null);
    try {
      const res = await fetch(`/api/v1/admin/ingestion/sources/${sourceKey}/run`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Connector execution failed.');
      }
      setLastRunReport(body);
      setActionBanner({
        variant: 'success',
        title: `Connector run completed (${body.status})`,
        description: `Found ${body.recordsFound} items · Queued for moderation: ${body.recordsModeration} · Amended: ${body.recordsAmended} · Duplicates skipped: ${body.recordsDuped}.`,
      });
      await fetchOverview();
    } catch (err: unknown) {
      setActionBanner({
        variant: 'error',
        title: 'Connector blocked or failed',
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      setRunningConnector(null);
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setImporting(true);
    setActionBanner(null);
    try {
      const contentBase64 = await fileToBase64(selectedFile);
      const res = await fetch('/api/v1/admin/ingestion/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentBase64,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Spreadsheet import failed.');
      }
      setLastRunReport(body);
      setSelectedFile(null);
      setActionBanner({
        variant: 'success',
        title: `Imported ${body.recordsFound} row(s) from ${selectedFile.name}`,
        description: `Queued for moderation: ${body.recordsModeration} · Amended: ${body.recordsAmended} · Exact duplicates skipped: ${body.recordsDuped} · Failed: ${body.recordsFailed}.`,
      });
      await fetchOverview();
    } catch (err: unknown) {
      setActionBanner({
        variant: 'error',
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Could not import file.',
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualSubmitting(true);
    setActionBanner(null);
    try {
      const res = await fetch('/api/v1/admin/ingestion/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Manual tender entry failed.');
      }
      setLastRunReport(body);
      const row = body.rows?.[0];
      setActionBanner({
        variant: 'success',
        title: 'Manual tender processed through quality & dedupe pipeline',
        description: row
          ? `Outcome: ${row.outcome} · Quality score: ${row.qualityScore}/100 · ${row.message}`
          : 'Tender queued for moderation review.',
      });
      setManualForm((prev) => ({
        ...prev,
        referenceNumber: '',
        title: '',
        titleAm: '',
        description: '',
      }));
      await fetchOverview();
    } catch (err: unknown) {
      setActionBanner({
        variant: 'error',
        title: 'Validation or submission error',
        description: err instanceof Error ? err.message : 'Failed to save tender.',
      });
    } finally {
      setManualSubmitting(false);
    }
  }

  async function handleModerationDecision(
    caseId: string,
    decision: 'approve' | 'reject' | 'mark_duplicate'
  ) {
    const reason = (decisionNotes[caseId] || '').trim();
    if ((decision === 'reject' || decision === 'mark_duplicate') && !reason) {
      setActionBanner({
        variant: 'error',
        title: 'Decision reason required',
        description:
          'Enter a brief note before rejecting or marking a tender as a duplicate so the audit trail stays complete.',
      });
      return;
    }

    setDecisionBusyId(caseId);
    setActionBanner(null);
    try {
      const res = await fetch(`/api/v1/admin/moderation/${caseId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Moderation action failed.');
      }
      setActionBanner({
        variant: 'success',
        title: `Moderation decision saved (${body.caseStatus})`,
        description: `Tender status updated to "${body.tenderStatus}" and recorded in the immutable audit trail.`,
      });
      await fetchOverview();
    } catch (err: unknown) {
      setActionBanner({
        variant: 'error',
        title: 'Moderation update failed',
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      setDecisionBusyId(null);
    }
  }

  async function handleCreateAmendment(e: React.FormEvent) {
    e.preventDefault();
    if (!amendTargetId) return;
    setAmendBusy(true);
    setActionBanner(null);
    try {
      const res = await fetch(`/api/v1/admin/tenders/${amendTargetId}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonEn: amendReason,
          newClosingDate: amendNewClose,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message || 'Amendment failed.');
      }
      setActionBanner({
        variant: 'success',
        title: `Versioned Amendment #${body.amendmentNumber} published (v${body.versionNumber})`,
        description: `Original closing date preserved in tender_versions; ${body.notifiedUsersCount} bookmarked user(s) queued for notification.`,
      });
      setAmendTargetId(null);
      setAmendReason('');
      await fetchOverview();
    } catch (err: unknown) {
      setActionBanner({
        variant: 'error',
        title: 'Amendment failed',
        description: err instanceof Error ? err.message : 'Unexpected error.',
      });
    } finally {
      setAmendBusy(false);
    }
  }

  const subTabs: Array<{ id: AdminSubTab; label: string; count?: number }> = [
    { id: 'sources', label: t.adminIngestion.tabSources, count: overview?.sources.length },
    { id: 'import', label: t.adminIngestion.tabImport },
    { id: 'manual', label: t.adminIngestion.tabManual },
    {
      id: 'moderation',
      label: t.adminIngestion.tabModeration,
      count: overview?.qualitySummary.openModerationCount,
    },
    { id: 'quality', label: t.adminIngestion.tabQuality, count: overview?.jobs.length },
    { id: 'audit', label: t.adminIngestion.tabAudit, count: overview?.auditTrail.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F3A]">
            {t.adminIngestion.heading}
          </h1>
          <p className="text-sm text-[#475569] max-w-3xl">
            {t.adminIngestion.subtitle}
          </p>
        </div>
        <AppButton
          size="sm"
          variant="secondary"
          onClick={fetchOverview}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </AppButton>
      </div>

      {/* Compliance / Legal Gate Notice */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] flex items-start gap-3 text-xs sm:text-sm text-[#334155]">
        <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
        <p>{t.adminIngestion.legalGateNotice}</p>
      </div>

      {/* Top KPI Summary Strip */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]">
            <p className="text-xs font-medium text-[#64748B]">Avg Quality Score</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
              {overview.qualitySummary.averageQualityScore}
              <span className="text-xs font-normal text-[#64748B]"> / 100</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]">
            <p className="text-xs font-medium text-[#64748B]">Open Moderation</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#2563EB]">
              {overview.qualitySummary.openModerationCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]">
            <p className="text-xs font-medium text-[#64748B]">Duplicates Caught</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#B45309]">
              {overview.qualitySummary.duplicateFlaggedCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)]">
            <p className="text-xs font-medium text-[#64748B]">Low-Quality Flagged</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#B91C1C]">
              {overview.qualitySummary.lowQualityCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(11,31,58,0.04)] col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-[#64748B]">Versioned Amendments</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#0B1F3A]">
              {overview.qualitySummary.amendmentsCount}
            </p>
          </div>
        </div>
      )}

      {/* Action feedback banner */}
      {actionBanner && (
        <StateBanner
          variant={actionBanner.variant}
          title={actionBanner.title}
          description={actionBanner.description}
        />
      )}

      {error && (
        <StateBanner
          variant="error"
          title={t.states.errorTitle}
          description={error}
          actionLabel={t.states.retry}
          onAction={fetchOverview}
        />
      )}

      {/* Sub-navigation bar */}
      <div className="border-b border-[#E2E8F0] overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max">
          {subTabs.map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#2563EB] text-[#1D4ED8] font-semibold'
                    : 'border-transparent text-[#475569] hover:text-[#0B1F3A]'
                }`}
              >
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span className="ms-1.5 font-mono tabular-nums text-xs text-[#64748B]">
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SOURCES & TEST CONNECTOR */}
      {subTab === 'sources' && overview && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {overview.sources.map((src) => {
              const canRun =
                src.sourceKey === 'test_partner_json_feed' &&
                src.isEnabled &&
                src.legalReviewStatus === 'approved';
              const isBlocked =
                !src.isEnabled ||
                (src.legalReviewStatus !== 'approved' &&
                  src.legalReviewStatus !== 'not_required');

              return (
                <div
                  key={src.id}
                  className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[#0B1F3A]">
                          {src.name}
                        </h2>
                        <span
                          className={`text-xs font-semibold ${
                            isBlocked ? 'text-[#B45309]' : 'text-[#15803D]'
                          }`}
                        >
                          · {src.isEnabled ? 'Enabled' : 'Disabled'} · Legal:{' '}
                          {src.legalReviewStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] font-mono">
                        Key: {src.sourceKey} · Type: {src.connectorType} · Provenance:{' '}
                        {src.tenderSourceType} · Rate limit: {src.rateLimitPerMinute}/min ·
                        Frequency:{' '}
                        {src.frequencyMinutes === 0
                          ? 'On-demand'
                          : `Every ${src.frequencyMinutes}m`}{' '}
                        · Auth: {src.authMethod}
                      </p>
                      {src.sourceUrl && (
                        <p className="text-xs text-[#64748B] font-mono break-all">
                          URL: {src.sourceUrl}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {canRun && (
                        <AppButton
                          size="sm"
                          variant="primary"
                          disabled={runningConnector === src.sourceKey}
                          onClick={() => handleRunConnector(src.sourceKey)}
                        >
                          <Play className="w-4 h-4" />
                          <span>
                            {runningConnector === src.sourceKey
                              ? t.adminIngestion.running
                              : t.adminIngestion.runTestConnector}
                          </span>
                        </AppButton>
                      )}
                      {src.sourceKey === 'manual_csv_excel_import' && (
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setSubTab('import')}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Open Importer</span>
                        </AppButton>
                      )}
                      {src.sourceKey === 'manual_admin_entry' && (
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setSubTab('manual')}
                        >
                          <FilePlus2 className="w-4 h-4" />
                          <span>Open Form</span>
                        </AppButton>
                      )}
                      {isBlocked && (
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRunConnector(src.sourceKey)}
                        >
                          <ShieldAlert className="w-4 h-4 text-[#B45309]" />
                          <span>Verify Legal Block</span>
                        </AppButton>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#F1F5F9] text-xs text-[#475569]">
                    <div>
                      <span className="font-semibold text-[#0F172A]">robots.txt / Access: </span>
                      {src.robotsTxtNotes || '—'}
                    </div>
                    <div>
                      <span className="font-semibold text-[#0F172A]">ToS / Governance: </span>
                      {src.termsOfServiceNotes || '—'}
                    </div>
                  </div>

                  <div className="text-xs text-[#64748B] font-mono tabular-nums flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Last run: {src.lastRunAt ? formatEatDate(src.lastRunAt, lang) : 'Never'}
                    </span>
                    <span>
                      Last success:{' '}
                      {src.lastSuccessAt ? formatEatDate(src.lastSuccessAt, lang) : 'Never'}
                    </span>
                    {src.lastError && (
                      <span className="text-[#B91C1C]">Last error: {src.lastError}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Last Run Detailed Row-by-Row Breakdown */}
          {lastRunReport && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-[#0B1F3A]">
                  Latest Pipeline Execution Report · {lastRunReport.sourceName}
                </h3>
                <span className="text-xs font-mono tabular-nums text-[#475569]">
                  Job {lastRunReport.jobId.slice(0, 8)} · {lastRunReport.status}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pe-3 font-medium">External ID</th>
                      <th className="py-2 pe-3 font-medium">Title</th>
                      <th className="py-2 pe-3 font-medium">Outcome</th>
                      <th className="py-2 pe-3 font-medium">Quality</th>
                      <th className="py-2 font-medium">Details & Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {lastRunReport.rows.map((r) => (
                      <tr key={r.externalId}>
                        <td className="py-2.5 pe-3 font-mono text-[#334155] whitespace-nowrap">
                          {r.externalId}
                        </td>
                        <td className="py-2.5 pe-3 text-[#0F172A] font-medium max-w-xs">
                          {r.title}
                        </td>
                        <td className="py-2.5 pe-3 font-mono whitespace-nowrap">
                          <span
                            className={
                              r.outcome === 'amended_version_created'
                                ? 'text-[#B45309] font-semibold'
                                : r.outcome === 'duplicate_skipped'
                                  ? 'text-[#64748B]'
                                  : r.outcome === 'duplicate_review_queued'
                                    ? 'text-[#B91C1C] font-semibold'
                                    : 'text-[#15803D] font-semibold'
                            }
                          >
                            {r.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums whitespace-nowrap">
                          {r.qualityScore}/100
                        </td>
                        <td className="py-2.5 text-[#475569]">
                          {r.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BULK CSV / EXCEL IMPORT */}
      {subTab === 'import' && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#0B1F3A]">
                Bulk CSV / Excel Tender Import
              </h2>
              <p className="text-sm text-[#475569]">
                Upload <span className="font-mono">.csv</span>,{' '}
                <span className="font-mono">.xlsx</span>, or{' '}
                <span className="font-mono">.xls</span> spreadsheets (up to 250 rows per
                batch). Every row is normalised to EAT (+03:00), checked for duplicates,
                scored for quality, and routed to moderation.
              </p>
            </div>
            <a
              href="/api/v1/admin/ingestion/template.csv"
              download="tenderlink_ethiopia_import_template.csv"
              className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-lg border border-[#CBD5E1] bg-white text-sm font-medium text-[#0B1F3A] hover:bg-[#EDF1F7] shrink-0 transition-colors"
            >
              <Download className="w-4 h-4 text-[#2563EB]" />
              <span>{t.adminIngestion.downloadTemplate}</span>
            </a>
          </div>

          <form onSubmit={handleBulkImport} className="space-y-4">
            <label className="block rounded-2xl border border-dashed border-[#94A3B8] bg-[#F8FAFC] p-6 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#EFF6FF]/40 transition-colors">
              <Upload className="w-7 h-7 text-[#2563EB] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#0B1F3A]">
                {selectedFile
                  ? `Selected: ${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
                  : 'Choose a CSV or Excel (.xlsx / .xls) file to import'}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Recognised columns: reference_number, title_en, title_am, publisher_name,
                category, region, city, closing_date, procurement_method, document_fee_etb,
                bid_security_etb, source_type, source_name, source_url, document_url
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="sr-only"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <div className="flex items-center justify-end gap-3">
              {selectedFile && (
                <AppButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedFile(null)}
                >
                  Clear File
                </AppButton>
              )}
              <AppButton
                type="submit"
                size="md"
                variant="primary"
                disabled={!selectedFile || importing}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{importing ? 'Importing...' : t.adminIngestion.uploadFileCta}</span>
              </AppButton>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: MANUAL ADMIN TENDER CREATION */}
      {subTab === 'manual' && (
        <form
          onSubmit={handleManualSubmit}
          className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-[#0B1F3A]">
              Manual Admin Tender Creation
            </h2>
            <p className="text-sm text-[#475569]">
              Manually entered tenders pass through the same EAT date normalisation,
              5-layer duplicate detector, quality scoring, moderation approval, and audit
              logging as automated sources.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AppInput
              id="manual-title-en"
              label="Tender Title (English) *"
              required
              value={manualForm.title}
              onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
              placeholder="e.g., [SAMPLE] Supply of Hospital Solar Inverters"
            />
            <AppInput
              id="manual-title-am"
              label="Tender Title (Amharic)"
              value={manualForm.titleAm}
              onChange={(e) => setManualForm({ ...manualForm, titleAm: e.target.value })}
              placeholder="ለምሳሌ፡ [ናሙና] የሆስፒታል ሶላር ኢንቨርተር አቅርቦት"
            />
            <AppInput
              id="manual-publisher"
              label="Publishing Organisation *"
              required
              value={manualForm.publisherName}
              onChange={(e) =>
                setManualForm({ ...manualForm, publisherName: e.target.value })
              }
              placeholder="e.g., Sample Hawassa Referral Hospital"
            />
            <AppInput
              id="manual-ref"
              label="Reference Number"
              value={manualForm.referenceNumber}
              onChange={(e) =>
                setManualForm({ ...manualForm, referenceNumber: e.target.value })
              }
              placeholder="e.g., MAN-2026-001"
            />
            <AppSelect
              id="manual-category"
              label="Sector / Category"
              value={manualForm.category}
              onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
              options={(taxonomy?.categories || []).map((c) => ({
                value: c.slug,
                label: lang === 'am' ? c.nameAm : c.nameEn,
              }))}
            />
            <AppSelect
              id="manual-region"
              label="Ethiopian Region"
              value={manualForm.region}
              onChange={(e) => setManualForm({ ...manualForm, region: e.target.value })}
              options={(taxonomy?.regions || []).map((r) => ({
                value: r.code,
                label: lang === 'am' ? r.nameAm : r.nameEn,
              }))}
            />
            <AppInput
              id="manual-city"
              label="City / Woreda"
              value={manualForm.city}
              onChange={(e) => setManualForm({ ...manualForm, city: e.target.value })}
            />
            <AppInput
              id="manual-closing-date"
              label="Closing Date (EAT, YYYY-MM-DD) *"
              type="date"
              required
              value={manualForm.closingDate}
              onChange={(e) =>
                setManualForm({ ...manualForm, closingDate: e.target.value })
              }
            />
            <AppSelect
              id="manual-source-type"
              label="Source Provenance *"
              value={manualForm.sourceType}
              onChange={(e) =>
                setManualForm({ ...manualForm, sourceType: e.target.value })
              }
              options={[
                { value: 'official_source', label: 'Official Source' },
                { value: 'publisher_submitted', label: 'Publisher Submitted' },
                { value: 'partner_feed', label: 'Partner Feed' },
                { value: 'user_reported', label: 'User Reported' },
              ]}
            />
            <AppInput
              id="manual-source-name"
              label="Source Attribution Name *"
              required
              value={manualForm.sourceName}
              onChange={(e) =>
                setManualForm({ ...manualForm, sourceName: e.target.value })
              }
            />
            <AppInput
              id="manual-source-url"
              label="Source URL (Optional)"
              value={manualForm.sourceUrl}
              onChange={(e) =>
                setManualForm({ ...manualForm, sourceUrl: e.target.value })
              }
              placeholder="https://..."
            />
            <AppInput
              id="manual-doc-fee"
              label="Document Fee (ETB)"
              type="number"
              value={manualForm.documentFee}
              onChange={(e) =>
                setManualForm({ ...manualForm, documentFee: e.target.value })
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#0B1F3A]">
              Full Description & Scope *
            </label>
            <textarea
              required
              rows={4}
              value={manualForm.description}
              onChange={(e) =>
                setManualForm({ ...manualForm, description: e.target.value })
              }
              placeholder="Enter procurement scope, lot breakdown, eligibility requirements, and submission office details..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0B1F3A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-[#334155] cursor-pointer">
            <input
              type="checkbox"
              checked={manualForm.isSampleData}
              onChange={(e) =>
                setManualForm({ ...manualForm, isSampleData: e.target.checked })
              }
              className="rounded border-[#CBD5E1] accent-[#2563EB]"
            />
            <span>Mark as clearly-labelled test/sample record</span>
          </label>

          <div className="flex justify-end">
            <AppButton
              type="submit"
              size="md"
              variant="primary"
              disabled={manualSubmitting}
            >
              <FilePlus2 className="w-4 h-4" />
              <span>
                {manualSubmitting
                  ? 'Validating...'
                  : t.adminIngestion.submitManualCta}
              </span>
            </AppButton>
          </div>
        </form>
      )}

      {/* TAB 4: DUPLICATES & MODERATION QUEUE */}
      {subTab === 'moderation' && overview && (
        <div className="space-y-4">
          {overview.moderationQueue.length === 0 ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(11,31,58,0.04)] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto" />
              <h3 className="text-base font-semibold text-[#0B1F3A]">
                Moderation & Duplicate Queue is Clear
              </h3>
              <p className="text-sm text-[#475569]">
                Run the Sandbox Test Connector or upload a CSV/Excel file to inspect
                normalised records, duplicate warnings, and quality flags here.
              </p>
            </div>
          ) : (
            overview.moderationQueue.map((item) => (
              <div
                key={item.caseId}
                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] font-mono">
                      <span>Priority P{item.priority}</span>
                      <span>·</span>
                      <span>{item.sourceType}</span>
                      <span>·</span>
                      <span>{item.referenceNumber || 'No Ref'}</span>
                      <span>·</span>
                      <span>Closes {formatEatDate(item.closingAt, lang)}</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#0F172A]">
                      {item.titleEn}
                    </h3>
                    <p className="text-xs text-[#475569]">
                      {item.publisherNameDisplay} · Source: {item.sourceName}
                    </p>
                  </div>

                  <div className="shrink-0 text-right font-mono tabular-nums">
                    <span
                      className={`text-sm font-bold ${
                        item.qualityScore >= 85
                          ? 'text-[#15803D]'
                          : item.qualityScore >= 65
                            ? 'text-[#B45309]'
                            : 'text-[#B91C1C]'
                      }`}
                    >
                      Quality {item.qualityScore}/100
                    </span>
                  </div>
                </div>

                {/* Duplicate Comparison Box */}
                {item.duplicateTarget && (
                  <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-3 text-xs space-y-1">
                    <div className="font-semibold text-[#92400E] flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" />
                      <span>
                        Potential Duplicate Detected ({item.duplicateMatchType})
                      </span>
                    </div>
                    <p className="text-[#78350F]">
                      Existing record: <strong>{item.duplicateTarget.titleEn}</strong> (
                      {item.duplicateTarget.referenceNumber || 'No Ref'} ·{' '}
                      {item.duplicateTarget.publisherNameDisplay} · Closes{' '}
                      {formatEatDate(item.duplicateTarget.closingAt, lang)})
                    </p>
                  </div>
                )}

                {/* Quality Flags */}
                {item.qualityFlags.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {item.qualityFlags.map((fl, i) => (
                      <div
                        key={`${fl.code}-${i}`}
                        className={`text-xs flex items-start gap-2 ${
                          fl.severity === 'error' ? 'text-[#B91C1C]' : 'text-[#B45309]'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-mono">{fl.code}</strong> ({fl.field}):{' '}
                          {fl.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Moderator Note + Action Controls */}
                <div className="pt-3 border-t border-[#F1F5F9] flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    type="text"
                    placeholder="Moderator note / rejection or duplicate reason..."
                    value={decisionNotes[item.caseId] || ''}
                    onChange={(e) =>
                      setDecisionNotes((prev) => ({
                        ...prev,
                        [item.caseId]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs text-[#0B1F3A] focus:outline-none focus:border-[#2563EB]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <AppButton
                      size="sm"
                      variant="primary"
                      disabled={decisionBusyId === item.caseId}
                      onClick={() => handleModerationDecision(item.caseId, 'approve')}
                    >
                      {t.adminIngestion.approveBtn}
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="secondary"
                      disabled={decisionBusyId === item.caseId}
                      onClick={() =>
                        handleModerationDecision(item.caseId, 'mark_duplicate')
                      }
                    >
                      {t.adminIngestion.markDuplicateBtn}
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="destructive"
                      disabled={decisionBusyId === item.caseId}
                      onClick={() => handleModerationDecision(item.caseId, 'reject')}
                    >
                      {t.adminIngestion.rejectBtn}
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAmendTargetId(item.tenderId);
                        setAmendReason('');
                      }}
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>{t.adminIngestion.amendBtn}</span>
                    </AppButton>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Inline Versioned Amendment Form Modal */}
          {amendTargetId && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
              onClick={() => setAmendTargetId(null)}
            >
              <form
                onSubmit={handleCreateAmendment}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F0] shadow-xl p-6 space-y-4"
              >
                <h3 className="text-lg font-bold text-[#0B1F3A]">
                  Publish Versioned Tender Amendment
                </h3>
                <p className="text-xs text-[#475569]">
                  The original closing date and text are preserved in{' '}
                  <span className="font-mono">tender_versions</span>, an amendment notice
                  is created in <span className="font-mono">tender_amendments</span>, and
                  bookmarked users are queued for notification.
                </p>
                <AppInput
                  id="amend-new-close"
                  label="New Closing Date (EAT) *"
                  type="date"
                  required
                  value={amendNewClose}
                  onChange={(e) => setAmendNewClose(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-[#0F172A]">
                    Amendment Reason *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    placeholder="e.g., Addendum #1: Bid deadline extended by 10 days per official clarification."
                    className="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#0F172A]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <AppButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setAmendTargetId(null)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton type="submit" size="sm" variant="primary" disabled={amendBusy}>
                    {amendBusy ? 'Saving...' : 'Publish Amendment'}
                  </AppButton>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: QUALITY DASHBOARD, AMENDMENTS & RUN HISTORY */}
      {subTab === 'quality' && overview && (
        <div className="space-y-6">
          {/* Quality Flags Breakdown */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h2 className="text-base font-semibold text-[#0B1F3A] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#2563EB]" />
              <span>Data Quality Rule Triggers ({overview.qualitySummary.totalRecordsAnalysed} analysed records)</span>
            </h2>
            {overview.qualitySummary.flagBreakdown.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No quality flags triggered yet. Run the Test Connector or upload a CSV to
                populate live quality metrics.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {overview.qualitySummary.flagBreakdown.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 flex items-center justify-between"
                  >
                    <span className="text-xs font-mono text-[#334155]">{item.code}</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-[#B45309]">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Versioned Amendments Log */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h2 className="text-base font-semibold text-[#0B1F3A] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#2563EB]" />
              <span>Recent Versioned Amendments (Never Overwritten Silently)</span>
            </h2>
            {overview.amendments.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No versioned amendments created yet. Running the Sandbox Test Connector
                creates a live deadline amendment on SAMPLE-2026-002.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pe-3 font-medium">Tender</th>
                      <th className="py-2 pe-3 font-medium">Addendum</th>
                      <th className="py-2 pe-3 font-medium">Previous Close</th>
                      <th className="py-2 pe-3 font-medium">New Close</th>
                      <th className="py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {overview.amendments.map((am) => (
                      <tr key={am.id}>
                        <td className="py-2.5 pe-3 font-medium text-[#0F172A]">
                          {am.referenceNumber ? `${am.referenceNumber} · ` : ''}
                          {am.tenderTitle}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#B45309] font-semibold">
                          #{am.amendmentNumber}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#64748B] line-through">
                          {formatEatDate(am.previousClosingAt, lang)}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#15803D] font-semibold">
                          {formatEatDate(am.newClosingAt, lang)}
                        </td>
                        <td className="py-2.5 text-[#475569]">{am.reasonEn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ingestion Run History & Error Logs */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
            <h2 className="text-base font-semibold text-[#0B1F3A] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <span>Ingestion Job Run History & Error Logs</span>
            </h2>
            {overview.jobs.length === 0 ? (
              <p className="text-sm text-[#64748B]">
                No ingestion jobs executed yet. Trigger the Test Connector or upload a CSV
                file to inspect run metrics and error logs.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                      <th className="py-2 pe-3 font-medium">Source Key</th>
                      <th className="py-2 pe-3 font-medium">Status</th>
                      <th className="py-2 pe-3 font-medium">Found</th>
                      <th className="py-2 pe-3 font-medium">Moderation</th>
                      <th className="py-2 pe-3 font-medium">Amended</th>
                      <th className="py-2 pe-3 font-medium">Duped</th>
                      <th className="py-2 pe-3 font-medium">Failed</th>
                      <th className="py-2 font-medium">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {overview.jobs.map((job) => (
                      <tr key={job.id}>
                        <td className="py-2.5 pe-3 font-mono text-[#0F172A]">
                          {job.sourceKey}
                        </td>
                        <td className="py-2.5 pe-3 font-mono font-semibold text-[#15803D]">
                          {job.status}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums">
                          {job.recordsFound}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums">
                          {job.recordsModeration}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#B45309]">
                          {job.recordsAmended}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#64748B]">
                          {job.recordsDuped}
                        </td>
                        <td className="py-2.5 pe-3 font-mono tabular-nums text-[#B91C1C]">
                          {job.recordsFailed}
                        </td>
                        <td className="py-2.5 font-mono tabular-nums text-[#64748B]">
                          {formatEatDate(job.completedAt || job.startedAt, lang)}
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

      {/* TAB 6: IMMUTABLE AUDIT TRAIL */}
      {subTab === 'audit' && overview && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,58,0.04)] space-y-3">
          <h2 className="text-base font-semibold text-[#0B1F3A] flex items-center gap-2">
            <History className="w-4 h-4 text-[#2563EB]" />
            <span>Immutable Platform Audit Trail</span>
          </h2>
          {overview.auditTrail.length === 0 ? (
            <p className="text-sm text-[#64748B]">No audit records logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-2 pe-3 font-medium">Action</th>
                    <th className="py-2 pe-3 font-medium">Role</th>
                    <th className="py-2 pe-3 font-medium">Entity</th>
                    <th className="py-2 pe-3 font-medium">Summary</th>
                    <th className="py-2 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {overview.auditTrail.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 pe-3 font-mono font-semibold text-[#0F172A] whitespace-nowrap">
                        {entry.action}
                      </td>
                      <td className="py-2.5 pe-3 font-mono text-[#475569] whitespace-nowrap">
                        {entry.actorRole || 'system'}
                      </td>
                      <td className="py-2.5 pe-3 font-mono text-[#64748B] whitespace-nowrap">
                        {entry.entityType} · {entry.entityId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pe-3 text-[#475569] max-w-md truncate">
                        {entry.afterJson ? JSON.stringify(entry.afterJson) : '—'}
                      </td>
                      <td className="py-2.5 font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                        {formatEatDate(entry.createdAt, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
