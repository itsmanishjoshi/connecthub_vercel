import type { Event } from './eventsApi';

export type EventAccessRole = 'view' | 'edit';

export interface EventAccessMember {
  user_id: string;
  username: string;
  role: EventAccessRole;
  is_owner: boolean;
  granted_at: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface EventAccessCandidate {
  id: string;
  username: string;
  email?: string | null;
  status?: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

async function accessRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || `Request failed (${response.status})`);
  }
  return json;
}

export function canEditAttendeeCards(
  event?: Pick<Event, 'created_by' | 'can_edit' | 'access_role'> | null,
  userId?: string | null,
  isAdmin?: boolean,
) {
  return canEditEvent(event, userId, isAdmin);
}

/** Only administrators or the event organizer can grant view/edit access to others. */
export function canManageEventAccess(
  event?: Pick<Event, 'created_by'> | null,
  userId?: string | null,
  isAdmin?: boolean,
) {
  if (!event) return false;
  if (isAdmin) return true;
  return Boolean(userId && event.created_by === userId);
}

export function canEditEvent(
  event?: Pick<Event, 'created_by' | 'can_edit' | 'access_role'> | null,
  userId?: string | null,
  isAdmin?: boolean,
) {
  if (!event) return false;
  if (isAdmin) return true;
  if (event.can_edit || event.access_role === 'edit') return true;
  return Boolean(userId && event.created_by === userId);
}

export function canDeleteEvent(
  event?: Pick<Event, 'created_by'> | null,
  userId?: string | null,
  isAdmin?: boolean,
) {
  if (!event) return false;
  if (isAdmin) return true;
  return Boolean(userId && event.created_by === userId);
}

export async function fetchEventAccess(eventId: string): Promise<EventAccessMember[]> {
  const json = await accessRequest(`/api/events/${eventId}/access`);
  return json.data || [];
}

export async function fetchEventAccessCandidates(eventId: string): Promise<EventAccessCandidate[]> {
  const json = await accessRequest(`/api/events/${eventId}/access/candidates`);
  return json.data || [];
}

export async function inviteToEvent(eventId: string, username: string, role: EventAccessRole) {
  await accessRequest(`/api/events/${eventId}/access`, {
    method: 'POST',
    body: JSON.stringify({ username, role }),
  });
}

export async function inviteUserToEvent(eventId: string, userId: string, role: EventAccessRole) {
  await accessRequest(`/api/events/${eventId}/access`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  });
}

export async function updateEventAccess(eventId: string, userId: string, role: EventAccessRole) {
  await accessRequest(`/api/events/${eventId}/access/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeEventAccess(eventId: string, userId: string) {
  await accessRequest(`/api/events/${eventId}/access/${userId}`, { method: 'DELETE' });
}

export function memberDisplayName(member: EventAccessMember | EventAccessCandidate) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  return name || member.username;
}
