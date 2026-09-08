import type { ConversationInsight } from '@/services/conversationService';
import { flushPendingSync } from '@/services/syncQueue';

export interface ExportEventSummary {
  id: string;
  name: string;
  slug?: string;
  date?: string;
  place?: string;
  notes_count: number;
  conversations_count: number;
  flags_count: number;
}

export interface FullExportEventSummary {
  id: string;
  name: string;
  slug?: string;
  date?: string;
  place?: string;
  attendee_count: number;
}

export type ExportKind = 'my-data' | 'full';

export interface UserEventExportPayload {
  exportedAt: string;
  user: { id: string; name: string };
  event: { id: string; name: string; slug?: string; date?: string; place?: string };
  people: Array<{
    id: string;
    name: string;
    company?: string;
    designation?: string;
    location?: string;
    notes: Array<{ id: string; text: string; createdAt?: string }>;
    statuses: Array<{ color: string; label: string }>;
    stages: string[];
  }>;
  conversations: Array<{
    id: string;
    title?: string;
    companyName?: string;
    attendeeId?: string;
    startedAt?: string;
    durationSeconds?: number;
    status?: string;
    segments: Array<{ speaker_label?: string; text: string }>;
    insights: ConversationInsight[];
  }>;
  followUps: Array<Record<string, unknown>>;
  fileName: string;
  markdown: string;
}

export interface AnalyticsOverview {
  totals: {
    users: number;
    events: number;
    activeUsers30d: number;
    notes: number;
    flags?: number;
    conversations: number;
    exports?: number;
    actions?: number;
  };
  eventEngagement: Array<{
    id: string;
    name: string;
    date?: string;
    attendee_count?: number;
    users_with_notes: number;
    notes_count: number;
    flags_count?: number;
    users_with_conversations: number;
    conversations_count: number;
  }>;
  recentActivity: Array<{ day: string; notes: number; conversations: number; flags?: number }>;
  generatedAt: string;
}

export interface AiUsageAnalytics {
  summary: {
    calls?: number;
    calls_24h?: number;
    errors?: number;
    tokens_in?: number;
    tokens_out?: number;
    total_tokens?: number;
    avg_duration_ms?: number;
    cost_usd?: number;
  };
  pricing?: {
    provider?: string;
    currency?: string;
    standard?: { label?: string; input_per_1m_usd?: number; output_per_1m_usd?: number };
    lite?: { label?: string; input_per_1m_usd?: number; output_per_1m_usd?: number };
    note?: string;
  };
  dailyActivity: Array<{ day: string; calls: number; tokens?: number; tokens_in?: number; tokens_out?: number; errors?: number; cost_usd?: number }>;
  byProvider: Array<{ provider: string; calls: number; tokens: number; tokens_in?: number; tokens_out?: number; cost_usd?: number }>;
  byRoute: Array<{ route: string; calls: number; tokens: number; tokens_in?: number; tokens_out?: number; errors?: number; cost_usd?: number }>;
  byFeature: Array<{ feature: string; calls: number; tokens: number; tokens_in?: number; tokens_out?: number; cost_usd?: number }>;
  byTask: Array<{ task: string; calls: number; tokens: number; tokens_in?: number; tokens_out?: number; errors?: number; cost_usd?: number }>;
  byUser?: Array<{ user_id?: string; name: string; username?: string; calls: number; tokens: number; tokens_in?: number; tokens_out?: number; errors?: number; cost_usd?: number }>;
  recentLogs: Array<{
    created_at: string;
    route: string;
    feature?: string;
    task?: string;
    provider?: string;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd?: number;
    status?: number;
    duration_ms?: number;
    user_name?: string;
    meta?: Record<string, unknown>;
  }>;
}

export interface AnalyticsDashboardData {
  scope: 'personal' | 'org';
  user?: { id: string; name: string };
  totals: {
    users?: number;
    events?: number;
    activeUsers30d?: number;
    notes: number;
    flags: number;
    conversations: number;
    stages?: number;
    exports?: number;
    actions?: number;
  };
  eventBreakdown?: Array<{
    id: string;
    name: string;
    date?: string;
    place?: string;
    notes_count: number;
    flags_count: number;
    conversations_count: number;
  }>;
  eventEngagement?: AnalyticsOverview['eventEngagement'];
  dailyActivity: Array<{ day: string; notes: number; conversations: number; flags?: number; exports?: number }>;
  recentActivity?: Array<{ kind: string; created_at: string; context: string; detail: string }>;
  users?: Array<Record<string, unknown>>;
  aiUsage?: AiUsageAnalytics;
  system?: {
    recentEvents?: Array<{ kind?: string; label?: string; name?: string; username?: string; created_at: string }>;
  };
  generatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  high_priority: 'High priority',
  meeting_required: 'Meeting required',
  follow_up_needed: 'Follow-up needed',
  strong_connect: 'Strong connect',
  deal_potential: 'Deal potential',
  watchlist: 'Watchlist',
  grey: 'Neutral',
};

function safeFileName(value: string) {
  return String(value || 'export')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'export';
}

function exportFileBase(userName: string, eventName: string) {
  return safeFileName(`${userName} - ${eventName}`);
}

function userDisplayName() {
  const profile = localStorage.getItem('connecthub_session_snapshot');
  if (profile) {
    try {
      const parsed = JSON.parse(profile);
      const name = [parsed?.profile?.first_name, parsed?.profile?.last_name].filter(Boolean).join(' ').trim();
      if (name) return name;
    } catch {
      // ignore
    }
  }
  return localStorage.getItem('current_username') || 'User';
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listMyExportEvents(): Promise<ExportEventSummary[]> {
  const response = await fetch(`${apiBase()}/api/me/export/events`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not load export events');
  return json.events || [];
}

export async function listMyExportEventsResolved(): Promise<ExportEventSummary[]> {
  await flushPendingSync();
  return listMyExportEvents();
}

export async function fetchMyEventExport(eventId: string): Promise<UserEventExportPayload> {
  const response = await fetch(`${apiBase()}/api/me/export/event/${encodeURIComponent(eventId)}`, {
    headers: authHeaders(),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not build export');
  return json.export;
}

export async function fetchMyEventExportResolved(eventId: string): Promise<UserEventExportPayload> {
  await flushPendingSync();
  return fetchMyEventExport(eventId);
}

export async function listFullExportEvents(): Promise<FullExportEventSummary[]> {
  const response = await fetch(`${apiBase()}/api/me/export/full/events`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not load events');
  return json.events || [];
}

export async function listFullExportEventsResolved(): Promise<FullExportEventSummary[]> {
  await flushPendingSync();
  return listFullExportEvents();
}

export async function fetchFullEventExport(eventId: string): Promise<UserEventExportPayload> {
  const response = await fetch(`${apiBase()}/api/me/export/full/event/${encodeURIComponent(eventId)}`, {
    headers: authHeaders(),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not build full export');
  return json.export;
}

export async function fetchFullEventExportResolved(eventId: string): Promise<UserEventExportPayload> {
  await flushPendingSync();
  return fetchFullEventExport(eventId);
}

export async function fetchEventExportByKind(eventId: string, kind: ExportKind): Promise<UserEventExportPayload> {
  return kind === 'full' ? fetchFullEventExportResolved(eventId) : fetchMyEventExportResolved(eventId);
}

export async function downloadEventExport(eventId: string, kind: ExportKind, format: 'md' | 'json') {
  const payload = await fetchEventExportByKind(eventId, kind);
  if (format === 'json') downloadJsonExport(payload.fileName, payload);
  else downloadTextFile(payload.fileName, payload.markdown);
  return payload;
}

export async function downloadAllEventExports(kind: ExportKind, format: 'md' | 'json') {
  const events = kind === 'full'
    ? await listFullExportEventsResolved()
    : await listMyExportEventsResolved();
  if (!events.length) throw new Error(kind === 'full' ? 'No events available to export' : 'No personal activity to export yet');

  const bundles = await Promise.all(events.map((event) => fetchEventExportByKind(event.id, kind)));
  const userName = bundles[0]?.user.name || userDisplayName();
  const fileName = exportFileBase(userName, kind === 'full' ? 'All events (full)' : 'All events');

  if (format === 'json') {
    downloadJsonExport(fileName, {
      exportKind: kind,
      exportedAt: new Date().toISOString(),
      user: bundles[0]?.user,
      events: bundles,
    });
  } else {
    downloadTextFile(fileName, bundles.map((item) => item.markdown).join('\n\n---\n\n'));
  }
}

export function downloadTextFile(fileName: string, content: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJsonExport(fileName: string, payload: unknown) {
  downloadTextFile(`${fileName}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await fetch(`${apiBase()}/api/analytics/overview`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not load analytics');
  return json.analytics;
}

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  await flushPendingSync();
  const response = await fetch(`${apiBase()}/api/analytics/dashboard`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not load analytics');
  return json.analytics;
}

export function previewLines(payload: UserEventExportPayload, limit = 12): string[] {
  const lines: string[] = [];
  for (const person of payload.people.slice(0, 8)) {
    const flags = person.statuses.map((status) => status.label).join(', ');
    const latestNote = person.notes[person.notes.length - 1]?.text;
    lines.push(
      `${person.name}${person.company ? ` (${person.company})` : ''}${flags ? ` — ${flags}` : ''}${latestNote ? `: ${latestNote}` : ''}`
    );
  }
  for (const conversation of payload.conversations.slice(0, 4)) {
    lines.push(`Conversation: ${conversation.title || 'Untitled'}${conversation.companyName ? ` (${conversation.companyName})` : ''}`);
  }
  return lines.slice(0, limit);
}
