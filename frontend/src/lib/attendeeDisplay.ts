import type { Attendee as ApiAttendee } from '@/lib/eventsApi';

const EMPTY_VALUES = new Set(['', '-', '—', 'n/a', 'na', 'none', 'null', 'tbd']);

export const ATTENDEE_PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4'] as const;
export type AttendeePriority = (typeof ATTENDEE_PRIORITY_OPTIONS)[number];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseAttendeeExtra(
  extra?: Record<string, string> | string | null,
): Record<string, string> {
  if (!extra) return {};
  if (typeof extra === 'string') {
    try {
      const parsed = JSON.parse(extra) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key, String(value ?? '').trim()])
            .filter(([, value]) => value.length > 0),
        );
      }
    } catch {
      return {};
    }
    return {};
  }
  return Object.fromEntries(
    Object.entries(extra)
      .map(([key, value]) => [key, String(value ?? '').trim()])
      .filter(([, value]) => value.length > 0),
  );
}

function pickExtraField(extra: Record<string, string>, aliases: string[]): string {
  const lookup = new Map<string, string>();
  for (const [key, value] of Object.entries(extra)) {
    lookup.set(normalizeKey(key), value);
  }
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (value && !EMPTY_VALUES.has(value.trim().toLowerCase())) {
      return value.trim();
    }
  }
  return '';
}

export function attendeeCity(attendee: Pick<ApiAttendee, 'city' | 'location' | 'extra_data'>): string {
  const extra = parseAttendeeExtra(attendee.extra_data);
  return (
    (attendee.city || attendee.location || '').trim() ||
    pickExtraField(extra, [
      'Contact city',
      'City',
      'Location',
      'Office city',
      'Office location',
      'Base location',
      'Region',
      'Geography',
    ])
  );
}

export function attendeeIndustry(attendee: Pick<ApiAttendee, 'industry' | 'extra_data'>): string {
  const extra = parseAttendeeExtra(attendee.extra_data);
  return (
    (attendee.industry || '').trim() ||
    pickExtraField(extra, ['Primary industry', 'Industry', 'Primary sub-industry', 'Sector'])
  );
}

export function normalizePriority(value: string): AttendeePriority | '' {
  const match = value.trim().toUpperCase().replace(/\s+/g, '').match(/^P([1-4])$/);
  return match ? (`P${match[1]}` as AttendeePriority) : '';
}

export function attendeePriority(
  attendee: Pick<ApiAttendee, 'extra_data'> & { priority?: string | null },
): AttendeePriority | '' {
  const extra = parseAttendeeExtra(attendee.extra_data);
  return normalizePriority(pickExtraField(extra, ['Priority', 'priority', 'Deal priority', 'Tier']));
}
