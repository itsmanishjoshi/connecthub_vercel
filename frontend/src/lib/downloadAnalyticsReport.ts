import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { AnalyticsDashboardData } from '@/services/eventExportService';
import { displayAiFeature, humanizeRoute, humanizeTask, logDetail } from '@/lib/aiAnalyticsLabels';

function safeFileName(value: string) {
  return String(value || 'analytics')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'analytics';
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ note: 'No data' }]);
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

export function downloadAnalyticsExcel(data: AnalyticsDashboardData) {
  const workbook = XLSX.utils.book_new();
  const isOrg = data.scope === 'org';
  const totals = data.totals;
  const generated = new Date(data.generatedAt).toLocaleString();

  appendSheet(workbook, 'Overview', [
    { metric: 'Report scope', value: isOrg ? 'Platform (org)' : 'Personal' },
    { metric: 'Generated at', value: generated },
    ...(isOrg
      ? [
          { metric: 'Users', value: totals.users ?? 0 },
          { metric: 'Active users (30d)', value: totals.activeUsers30d ?? 0 },
          { metric: 'Events', value: totals.events ?? 0 },
          { metric: 'Total actions', value: totals.actions ?? 0 },
        ]
      : [{ metric: 'User', value: data.user?.name ?? 'You' }]),
    { metric: 'Notes', value: totals.notes },
    { metric: 'Flags', value: totals.flags },
    { metric: 'Conversations', value: totals.conversations },
    { metric: 'Exports', value: totals.exports ?? 0 },
  ]);

  appendSheet(
    workbook,
    'Daily Activity',
    data.dailyActivity.map((row) => ({
      day: row.day,
      notes: row.notes,
      conversations: row.conversations,
      flags: row.flags ?? 0,
      exports: row.exports ?? 0,
    })),
  );

  const eventRows = (isOrg ? data.eventEngagement : data.eventBreakdown) ?? [];
  appendSheet(
    workbook,
    isOrg ? 'Event Engagement' : 'My Events',
    eventRows.map((row) =>
      isOrg
        ? {
            event: row.name,
            date: row.date ?? '',
            attendees: row.attendee_count ?? '',
            notes: row.notes_count,
            flags: row.flags_count ?? 0,
            conversations: row.conversations_count,
            users_noting: row.users_with_notes ?? 0,
            users_recording: row.users_with_conversations ?? 0,
          }
        : {
            event: row.name,
            date: row.date ?? '',
            place: row.place ?? '',
            notes: row.notes_count,
            flags: row.flags_count ?? 0,
            conversations: row.conversations_count,
          },
    ),
  );

  if (data.aiUsage) {
    const ai = data.aiUsage;
    appendSheet(workbook, 'AI Summary', [
      { metric: 'API calls', value: ai.summary?.calls ?? 0 },
      { metric: 'Calls (24h)', value: ai.summary?.calls_24h ?? 0 },
      { metric: 'Errors', value: ai.summary?.errors ?? 0 },
      { metric: 'Tokens in', value: ai.summary?.tokens_in ?? 0 },
      { metric: 'Tokens out', value: ai.summary?.tokens_out ?? 0 },
      { metric: 'Total tokens', value: ai.summary?.total_tokens ?? 0 },
      { metric: 'Est. spend (USD)', value: ai.summary?.cost_usd ?? 0 },
      { metric: 'Avg latency (ms)', value: ai.summary?.avg_duration_ms ?? 0 },
    ]);

    appendSheet(
      workbook,
      'AI Daily',
      (ai.dailyActivity ?? []).map((row) => ({
        day: row.day,
        calls: row.calls,
        tokens: row.tokens ?? 0,
        cost_usd: row.cost_usd ?? 0,
        errors: row.errors ?? 0,
      })),
    );

    appendSheet(
      workbook,
      'AI By Feature',
      (ai.byFeature ?? []).map((row) => ({
        feature: row.feature,
        calls: row.calls,
        tokens: row.tokens,
        cost_usd: row.cost_usd ?? 0,
      })),
    );

    appendSheet(
      workbook,
      'AI By Provider',
      (ai.byProvider ?? []).map((row) => ({
        provider: row.provider,
        calls: row.calls,
        tokens: row.tokens,
        cost_usd: row.cost_usd ?? 0,
      })),
    );

    appendSheet(
      workbook,
      'AI By Route',
      (ai.byRoute ?? []).map((row) => ({
        route: row.route,
        label: humanizeRoute(row.route),
        calls: row.calls,
        tokens: row.tokens,
        cost_usd: row.cost_usd ?? 0,
        errors: row.errors ?? 0,
      })),
    );

    appendSheet(
      workbook,
      'AI By Task',
      (ai.byTask ?? []).map((row) => ({
        task: row.task,
        label: humanizeTask(row.task),
        calls: row.calls,
        tokens: row.tokens,
        cost_usd: row.cost_usd ?? 0,
        errors: row.errors ?? 0,
      })),
    );

    if (isOrg && ai.byUser?.length) {
      appendSheet(
        workbook,
        'AI By User',
        ai.byUser.map((row) => ({
          user: row.name,
          username: row.username ?? '',
          calls: row.calls,
          tokens: row.tokens,
          cost_usd: row.cost_usd ?? 0,
          errors: row.errors ?? 0,
        })),
      );
    }

    appendSheet(
      workbook,
      'AI Audit Log',
      (ai.recentLogs ?? []).map((row) => ({
        when: row.created_at ? new Date(row.created_at).toLocaleString() : '',
        who: row.user_name ?? (isOrg ? 'Unknown' : data.user?.name ?? 'You'),
        feature: displayAiFeature(row.feature, row.route),
        provider: row.provider ?? '',
        task: row.task ?? '',
        tokens_in: row.tokens_in ?? 0,
        tokens_out: row.tokens_out ?? 0,
        total_tokens: (row.tokens_in ?? 0) + (row.tokens_out ?? 0),
        cost_usd: row.cost_usd ?? 0,
        latency_ms: row.duration_ms ?? '',
        status: row.status ?? 200,
        detail: logDetail(row.meta),
        route: row.route,
      })),
    );
  }

  if (isOrg && data.users?.length) {
    appendSheet(
      workbook,
      'Team Activity',
      data.users.map((user) => ({
        name: user.name,
        username: user.username,
        email: user.email ?? '',
        company: user.company ?? '',
        designation: user.designation ?? '',
        admin: user.isAdmin ? 'Yes' : 'No',
        notes: user.notes,
        flags: user.flags,
        conversations: user.conversations,
        exports: user.exports,
        actions: user.actions,
        last_activity: user.lastActivityAt ? new Date(String(user.lastActivityAt)).toLocaleString() : '',
      })),
    );
  }

  if (!isOrg && data.recentActivity?.length) {
    appendSheet(
      workbook,
      'Recent Activity',
      data.recentActivity.map((row) => ({
        kind: row.kind,
        context: row.context,
        detail: row.detail,
        when: new Date(row.created_at).toLocaleString(),
      })),
    );
  }

  if (isOrg && data.system?.recentEvents?.length) {
    appendSheet(
      workbook,
      'Platform Events',
      data.system.recentEvents.map((row) => ({
        user: row.name || row.username,
        kind: row.kind,
        label: row.label,
        when: new Date(row.created_at).toLocaleString(),
      })),
    );
  }

  const prefix = safeFileName(isOrg ? 'connecthub-analytics-platform' : `connecthub-analytics-${data.user?.name ?? 'personal'}`);
  const stamp = new Date(data.generatedAt).toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${prefix}-${stamp}.xlsx`);
}

export async function downloadAnalyticsPdf(element: HTMLElement, data: AnalyticsDashboardData) {
  await waitForImages(element);

  const bg = window.getComputedStyle(element).backgroundColor;
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    skipFonts: true,
    backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#0f172a',
    filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore === 'true'),
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const pdf = new jsPDF({
    orientation: img.width >= img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height],
    hotfixes: ['px_scaling'],
  });

  pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);

  const isOrg = data.scope === 'org';
  const prefix = safeFileName(isOrg ? 'connecthub-analytics-platform' : `connecthub-analytics-${data.user?.name ?? 'personal'}`);
  const stamp = new Date(data.generatedAt).toISOString().split('T')[0];
  pdf.save(`${prefix}-${stamp}.pdf`);
}
