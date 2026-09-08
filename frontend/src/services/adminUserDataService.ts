import type { ExportEventSummary, UserEventExportPayload } from '@/services/eventExportService';
import { downloadJsonExport, downloadTextFile } from '@/services/eventExportService';

function safeFileName(value: string) {
  return String(value || 'export')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'export';
}

export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string | null;
  name: string;
  company?: string | null;
  status?: string;
}

export interface AdminUserDataResponse {
  user: AdminUserSummary;
  totals: {
    events: number;
    notes: number;
    flags: number;
    conversations: number;
  };
  events: ExportEventSummary[];
  exports: UserEventExportPayload[];
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function adminRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Request failed (${response.status})`);
  }
  return json as T;
}

export async function fetchAdminUserData(userId: string): Promise<AdminUserDataResponse> {
  return adminRequest<AdminUserDataResponse>(`/api/admin/users/${encodeURIComponent(userId)}/data`);
}

export async function listAdminUserExportEvents(userId: string): Promise<ExportEventSummary[]> {
  const json = await adminRequest<{ events: ExportEventSummary[] }>(
    `/api/admin/users/${encodeURIComponent(userId)}/export/events`,
  );
  return json.events || [];
}

export async function fetchAdminUserEventExport(
  userId: string,
  eventId: string,
): Promise<UserEventExportPayload> {
  const json = await adminRequest<{ export: UserEventExportPayload }>(
    `/api/admin/users/${encodeURIComponent(userId)}/export/event/${encodeURIComponent(eventId)}`,
  );
  return json.export;
}

export async function downloadAdminUserData(userId: string, format: 'md' | 'json' = 'md') {
  const data = await fetchAdminUserData(userId);
  if (!data.exports.length) {
    throw new Error('This user has no notes, conversations, or priority flags yet');
  }
  const fileName = safeFileName(`${data.user.name} - All events`);
  if (format === 'json') {
    downloadJsonExport(fileName, {
      exportKind: 'admin-user-data',
      exportedAt: new Date().toISOString(),
      user: data.user,
      events: data.exports,
    });
  } else {
    downloadTextFile(fileName, data.exports.map((item) => item.markdown).join('\n\n---\n\n'));
  }
}
