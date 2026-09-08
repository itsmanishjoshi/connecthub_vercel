import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Download,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Flag,
  Loader2,
  MessageSquare,
  RefreshCw,
  StickyNote,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchAnalyticsDashboard, type AiUsageAnalytics, type AnalyticsDashboardData } from '@/services/eventExportService';
import { downloadAnalyticsExcel, downloadAnalyticsPdf } from '@/lib/downloadAnalyticsReport';
import { displayAiFeature, humanizeRoute, humanizeTask, logDetail } from '@/lib/aiAnalyticsLabels';
import { useAuth } from '@/context/SimpleAuthContext';

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'text-blue-600 dark:text-blue-400',
}: {
  label: string;
  value: number | string;
  icon: typeof BarChart3;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm max-lg:overflow-visible lg:overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground max-lg:leading-snug max-lg:[overflow-wrap:anywhere] lg:truncate"
          title={label}
        >
          {label}
        </p>
        <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BarChart({
  rows,
  keys,
  colors,
}: {
  rows: Array<Record<string, string | number>>;
  keys: Array<{ key: string; label: string; color: string }>;
  colors?: string[];
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => keys.map((item) => Number(row[item.key] || 0)))
  );

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No activity in this period yet.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={String(row.day)}>
          <div className="mb-1 flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{new Date(String(row.day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span className="truncate">{keys.map((item) => `${row[item.key] || 0} ${item.label.toLowerCase()}`).join(' · ')}</span>
          </div>
          <div className="flex h-8 overflow-hidden rounded-lg bg-muted/40 px-0.5">
            {keys.map((item, index) => {
              const value = Number(row[item.key] || 0);
              const width = max ? (value / max) * 100 : 0;
              if (!value) return null;
              return (
                <div
                  key={item.key}
                  className="h-full transition-all"
                  style={{
                    width: `${width}%`,
                    backgroundColor: colors?.[index] || item.color,
                    minWidth: value ? '4px' : 0,
                  }}
                  title={`${item.label}: ${value}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

function formatUsd(value?: number) {
  const amount = value ?? 0;
  if (amount > 0 && amount < 0.01) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(amount);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatUsageMeta(row: { calls?: number; tokens?: number; cost_usd?: number }) {
  const parts = [`${formatNumber(row.calls)} calls`, `~${formatNumber(row.tokens)} tokens`];
  if (row.cost_usd != null) parts.push(formatUsd(row.cost_usd));
  return parts.join(' · ');
}

type EventEngagementRow = {
  id: string;
  name: string;
  attendee_count?: number;
  notes_count: number;
  flags_count?: number;
  conversations_count: number;
  users_with_notes?: number;
  users_with_conversations?: number;
};

function EventEngagementPanel({
  title,
  rows,
  isOrg,
}: {
  title: string;
  rows: EventEngagementRow[];
  isOrg: boolean;
}) {
  const emptyMessage = 'No event activity recorded yet. Add notes or flags on an event, then refresh.';

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 lg:p-5">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <div className="mt-3 hidden lg:block">
        <div className="responsive-table-scroll">
          <table className="text-sm lg:min-w-full lg:w-full">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 pr-4">Event</th>
                {isOrg ? <th className="pb-2 pr-4">Attendees</th> : null}
                <th className="pb-2 pr-4">Notes</th>
                <th className="pb-2 pr-4">Flags</th>
                <th className="pb-2 pr-4">Conversations</th>
                {isOrg ? <th className="pb-2">Users active</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
                  {isOrg ? <td className="py-2 pr-4">{row.attendee_count ?? '—'}</td> : null}
                  <td className="py-2 pr-4">{row.notes_count}</td>
                  <td className="py-2 pr-4">{row.flags_count ?? 0}</td>
                  <td className="py-2 pr-4">{row.conversations_count}</td>
                  {isOrg ? (
                    <td className="py-2">{row.users_with_notes ?? 0} noting · {row.users_with_conversations ?? 0} recording</td>
                  ) : null}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isOrg ? 6 : 4} className="py-4 text-sm text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-3 space-y-2 lg:hidden">
        {rows.length ? rows.map((row) => (
          <article key={row.id} className="rounded-lg border border-border bg-muted/20 p-3">
            <h4 className="font-medium text-foreground">{row.name}</h4>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              {isOrg ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Attendees</dt>
                  <dd className="font-medium text-foreground">{row.attendee_count ?? '—'}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="font-medium text-foreground">{row.notes_count}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Flags</dt>
                <dd className="font-medium text-foreground">{row.flags_count ?? 0}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Conversations</dt>
                <dd className="font-medium text-foreground">{row.conversations_count}</dd>
              </div>
              {isOrg ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Users active</dt>
                  <dd className="font-medium text-foreground">
                    {row.users_with_notes ?? 0} noting · {row.users_with_conversations ?? 0} recording
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        )) : (
          <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

function UsageBreakdownList({
  title,
  subtitle,
  rows,
  labelKey,
  formatLabel,
}: {
  title: string;
  subtitle: string;
  rows: Array<Record<string, unknown>>;
  labelKey: string;
  formatLabel?: (value: string) => string;
}) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {rows.map((row) => {
          const raw = String(row[labelKey] ?? '');
          const label = formatLabel ? formatLabel(raw) : raw;
          return (
            <div key={raw} className="flex flex-col gap-1 rounded-lg bg-muted/30 px-3 py-2 text-sm lg:flex-row lg:items-center lg:justify-between lg:gap-3">
              <span className="min-w-0 font-medium text-foreground max-lg:[overflow-wrap:anywhere] lg:truncate" title={label}>
                {label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatUsageMeta({
                  calls: row.calls as number | undefined,
                  tokens: row.tokens as number | undefined,
                  cost_usd: row.cost_usd as number | undefined,
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AiAnalyticsSection({
  aiUsage,
  scope,
}: {
  aiUsage: AiUsageAnalytics;
  scope: 'personal' | 'org';
}) {
  const summary = aiUsage.summary ?? {};
  const pricing = aiUsage.pricing;
  const hasUsage = (summary.calls ?? 0) > 0;

  const aiChartKeys = useMemo(
    () => [
      { key: 'calls', label: 'Calls', color: '#6366f1' },
      { key: 'errors', label: 'Errors', color: '#ef4444' },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/60">
              <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {scope === 'org' ? 'AI & API usage (platform)' : 'My AI & API usage'}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Every AI call is logged with who used it, why, provider, estimated tokens, and estimated spend — last 30 days.
                {pricing?.standard ? (
                  <> Rates: {formatUsd(pricing.standard.input_per_1m_usd)} / 1M in · {formatUsd(pricing.standard.output_per_1m_usd)} / 1M out.</>
                ) : null}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Est. spend (30d)" value={formatUsd(summary.cost_usd)} icon={DollarSign} accent="text-emerald-600" />
            <StatCard label="API calls" value={formatNumber(summary.calls)} icon={Zap} accent="text-indigo-600" />
            <StatCard label="Total tokens" value={formatNumber(summary.total_tokens)} icon={MessageSquare} accent="text-violet-600" />
            <StatCard label="Last 24h" value={formatNumber(summary.calls_24h)} icon={Activity} accent="text-emerald-600" />
            <StatCard label="Tokens in" value={formatNumber(summary.tokens_in)} icon={MessageSquare} accent="text-sky-600" />
            <StatCard label="Tokens out" value={formatNumber(summary.tokens_out)} icon={MessageSquare} accent="text-blue-600" />
            <StatCard label="Errors" value={formatNumber(summary.errors)} icon={BarChart3} accent="text-red-500" />
          </div>

          {!hasUsage ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No AI activity recorded yet. Analyze a conversation, use Jelly chat, import people with AI, or run AI chat — then refresh.
            </p>
          ) : null}

          {aiUsage.byProvider?.length ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By provider</p>
              {aiUsage.byProvider.map((row) => (
                <div key={row.provider} className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/30 px-3 py-2 text-sm lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                  <span className="min-w-0 font-medium capitalize text-foreground max-lg:[overflow-wrap:anywhere] lg:truncate" title={row.provider}>
                    {row.provider}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatUsageMeta(row)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
            <h3 className="font-semibold text-foreground">AI activity — last 14 days</h3>
            <p className="mt-1 text-xs text-muted-foreground">Daily API call volume</p>
            <div className="mt-4">
              <BarChart rows={aiUsage.dailyActivity ?? []} keys={aiChartKeys} />
            </div>
          </div>

          {aiUsage.byFeature?.length ? (
            <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
              <h3 className="font-semibold text-foreground">Why — by feature</h3>
              <p className="mt-1 text-xs text-muted-foreground">What ConnectHub features drove AI usage</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {aiUsage.byFeature.map((row) => (
                  <div key={row.feature} className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/30 px-3 py-2 text-sm lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                    <span className="min-w-0 font-medium text-foreground max-lg:[overflow-wrap:anywhere] lg:truncate" title={row.feature}>
                      {row.feature}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatUsageMeta(row)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <UsageBreakdownList
            title="Where — by API route"
            subtitle="All tracked endpoints (new routes appear automatically)"
            rows={aiUsage.byRoute ?? []}
            labelKey="route"
            formatLabel={humanizeRoute}
          />

          <UsageBreakdownList
            title="How — by task type"
            subtitle="chat, analyze, extract, search, vision, and future task types"
            rows={aiUsage.byTask ?? []}
            labelKey="task"
            formatLabel={humanizeTask}
          />
        </div>
      </div>

      {scope === 'org' && aiUsage.byUser?.length ? (
        <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
          <h3 className="font-semibold text-foreground">Who — by user</h3>
          <p className="mt-1 text-xs text-muted-foreground">Which team members consumed AI capacity</p>
          <div className="mt-3 hidden lg:block">
            <div className="responsive-table-scroll">
              <table className="text-sm lg:min-w-full lg:w-full">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Calls</th>
                    <th className="pb-2 pr-4">Tokens</th>
                    <th className="pb-2 pr-4">Est. spend</th>
                    <th className="pb-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {aiUsage.byUser.map((row) => (
                    <tr key={row.user_id || row.username || row.name} className="border-t border-border">
                      <td className="py-2 pr-4 font-medium text-foreground">{row.name}</td>
                      <td className="py-2 pr-4">{formatNumber(row.calls)}</td>
                      <td className="py-2 pr-4">{formatNumber(row.tokens)}</td>
                      <td className="py-2 pr-4">{formatUsd(row.cost_usd)}</td>
                      <td className="py-2">{formatNumber(row.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 space-y-2 lg:hidden">
            {aiUsage.byUser.map((row) => (
              <article key={row.user_id || row.username || row.name} className="rounded-lg border border-border bg-muted/20 p-3">
                <h4 className="font-medium text-foreground">{row.name}</h4>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Calls</dt>
                    <dd className="font-medium text-foreground">{formatNumber(row.calls)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Tokens</dt>
                    <dd className="font-medium text-foreground">{formatNumber(row.tokens)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Est. spend</dt>
                    <dd className="font-medium text-foreground">{formatUsd(row.cost_usd)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Errors</dt>
                    <dd className="font-medium text-foreground">{formatNumber(row.errors)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {aiUsage.recentLogs?.length ? (
        <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
          <h3 className="font-semibold text-foreground">Usage audit log</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent AI calls — who, feature, tokens, and estimated spend
          </p>
          <div className="mt-3 max-h-[28rem] overflow-y-auto">
            <div className="responsive-table-scroll">
            <table className="text-sm lg:min-w-full lg:w-full">
              <thead>
                <tr className="text-left text-muted-foreground">
                  {scope === 'org' ? <th className="pb-2 pr-3">Who</th> : null}
                  <th className="pb-2 pr-3">When</th>
                  <th className="pb-2 pr-3">Feature</th>
                  <th className="hidden pb-2 pr-3 sm:table-cell">Provider</th>
                  <th className="pb-2 pr-3">Tokens</th>
                  <th className="hidden pb-2 pr-3 md:table-cell">Est. spend</th>
                  <th className="hidden pb-2 pr-3 md:table-cell">Latency</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {aiUsage.recentLogs.map((row, index) => {
                  const tokens = (row.tokens_in ?? 0) + (row.tokens_out ?? 0);
                  const detail = logDetail(row.meta);
                  return (
                    <tr key={`${row.created_at}-${index}`} className="border-t border-border">
                      {scope === 'org' ? (
                        <td className="py-2 pr-3 font-medium text-foreground">{row.user_name || 'Unknown'}</td>
                      ) : null}
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="font-medium text-foreground">{displayAiFeature(row.feature, row.route)}</div>
                        {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
                        {row.route ? (
                          <div className="text-[11px] text-muted-foreground/80">{humanizeRoute(row.route)}</div>
                        ) : null}
                      </td>
                      <td className="hidden py-2 pr-3 capitalize text-muted-foreground sm:table-cell">{row.provider || '—'}</td>
                      <td className="py-2 pr-3 text-muted-foreground">~{formatNumber(tokens)}</td>
                      <td className="hidden py-2 pr-3 text-muted-foreground md:table-cell">{formatUsd(row.cost_usd)}</td>
                      <td className="hidden py-2 pr-3 text-muted-foreground md:table-cell">{row.duration_ms ? `${formatNumber(row.duration_ms)} ms` : '—'}</td>
                      <td className="py-2">
                        <span className={row.status && row.status >= 400 ? 'text-red-500' : 'text-emerald-600'}>
                          {row.status ?? 200}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UserActivityCard({ user }: { user: NonNullable<Extract<AnalyticsDashboardData, { scope: 'org' }>['users']>[number] }) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || '?';

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${user.isAdmin ? 'bg-indigo-600' : 'bg-slate-500'}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{user.name}</h3>
            {user.isAdmin ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                Admin
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.email || user.username}</p>
          {user.company ? <p className="text-xs text-muted-foreground">{user.company}{user.designation ? ` · ${user.designation}` : ''}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Notes', value: user.notes, icon: StickyNote },
          { label: 'Flags', value: user.flags, icon: Flag },
          { label: 'Conversations', value: user.conversations, icon: MessageSquare },
          { label: 'Exports', value: user.exports, icon: Download },
        ].map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg bg-muted/40 px-2.5 py-2 max-lg:overflow-visible lg:overflow-hidden">
            <p
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground max-lg:[overflow-wrap:anywhere] lg:truncate"
              title={item.label}
            >
              {item.label}
            </p>
            <p className="text-lg font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {user.lastActivityAt
          ? `Last activity ${new Date(user.lastActivityAt).toLocaleString()}`
          : 'No activity recorded yet'}
      </p>
    </article>
  );
}

export function AnalyticsDashboard() {
  const { mode } = useAuth();
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAnalyticsDashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleExcelDownload = () => {
    if (!data) return;
    try {
      setExporting('excel');
      downloadAnalyticsExcel(data);
      toast.success('Analytics exported to Excel');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Excel export failed');
    } finally {
      setExporting(null);
    }
  };

  const handlePdfDownload = async () => {
    if (!data || !exportRef.current) return;
    try {
      setExporting('pdf');
      await downloadAnalyticsPdf(exportRef.current, data);
      toast.success('Analytics exported to PDF');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(null);
    }
  };

  const isOrg = data?.scope === 'org';
  const eventRows = (isOrg ? data?.eventEngagement : data?.eventBreakdown) ?? [];
  const chartKeys = useMemo(
    () => [
      { key: 'notes', label: 'Notes', color: '#3b82f6' },
      { key: 'flags', label: 'Flags', color: '#f59e0b' },
      { key: 'conversations', label: 'Conversations', color: '#10b981' },
    ],
    []
  );

  if (mode === 'guest') {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">Sign in to view your analytics</p>
        <p className="mt-1 text-sm text-muted-foreground">Track your notes, flags, conversations, and exports at every event.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">Analytics unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const totals = data.totals;

  return (
    <div ref={exportRef} className="min-w-0 space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {isOrg ? 'ConnectHub adoption dashboard' : 'My activity'}
          </h2>
          {!isOrg ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Your personal ConnectHub usage: notes, flags, recorded conversations, and exports across events.
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto" data-export-ignore="true">
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={handleExcelDownload}>
            {exporting === 'excel' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            )}
            Excel
          </Button>
          <Button variant="outline" size="sm" disabled={!!exporting} onClick={() => void handlePdfDownload()}>
            {exporting === 'pdf' ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        {isOrg ? (
          <>
            <StatCard label="Users" value={totals.users} icon={Users} />
            <StatCard label="Active (30d)" value={totals.activeUsers30d} icon={Activity} accent="text-emerald-600" />
            <StatCard label="Events" value={totals.events} icon={BarChart3} accent="text-violet-600" />
          </>
        ) : null}
        <StatCard label="Notes" value={totals.notes} icon={StickyNote} />
        <StatCard label="Flags" value={totals.flags} icon={Flag} accent="text-amber-600" />
        <StatCard label="Conversations" value={totals.conversations} icon={MessageSquare} accent="text-emerald-600" />
        <StatCard label="Exports" value={totals.exports ?? 0} icon={Download} accent="text-sky-600" />
        {isOrg ? (
          <StatCard label="Total actions" value={totals.actions ?? 0} icon={Zap} accent="text-orange-600" />
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 lg:p-5">
          <h3 className="font-semibold text-foreground">Last 14 days</h3>
          <p className="mt-1 text-xs text-muted-foreground">Daily activity volume</p>
          <div className="mt-4">
            <BarChart rows={data.dailyActivity} keys={chartKeys} />
          </div>
        </div>

        <EventEngagementPanel
          title={isOrg ? 'Event engagement' : 'My events'}
          rows={eventRows}
          isOrg={isOrg}
        />
      </div>

      {data.aiUsage ? (
        <AiAnalyticsSection aiUsage={data.aiUsage} scope={data.scope} />
      ) : null}

      {isOrg && data.users?.length ? (
        <div>
          <h3 className="font-semibold text-foreground">Team activity cards</h3>
          <p className="mt-1 text-sm text-muted-foreground">What each user has contributed — notes, flags, conversations, and exports.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.users.map((user) => (
              <UserActivityCard key={user.id} user={user} />
            ))}
          </div>
        </div>
      ) : null}

      {!isOrg && data.recentActivity?.length ? (
        <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
          <h3 className="font-semibold text-foreground">Recent activity</h3>
          <ul className="mt-3 space-y-2">
            {data.recentActivity.map((item, index) => (
              <li key={`${item.kind}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium capitalize text-foreground">{item.kind.replace('_', ' ')}</span>
                <span className="text-muted-foreground">{item.context}</span>
                {item.detail ? <span className="w-full truncate text-xs text-muted-foreground">{item.detail}</span> : null}
                <span className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isOrg && data.system?.recentEvents?.length ? (
        <div className="rounded-xl border border-border bg-card p-4 min-w-0 lg:p-5">
          <h3 className="font-semibold text-foreground">Latest platform events</h3>
          <ul className="mt-3 space-y-2">
            {data.system.recentEvents.map((item, index) => (
              <li key={`${item.kind}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{item.name || item.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{item.kind?.replace('_', ' ')} · {item.label}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
