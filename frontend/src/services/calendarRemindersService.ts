import { getAuthUserId, loadUserRows, replaceUserRows } from '@/lib/userPersistence';

export interface CalendarReminder {
  id: string;
  eventId: string;
  triggerAt: number;
  leadMinutes: number;
  createdAt: number;
}

const STORAGE_KEY = 'gcc_calendar_reminders';

function readLocal(): CalendarReminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(reminders: CalendarReminder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function rowToReminder(row: Record<string, unknown>): CalendarReminder {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    triggerAt: new Date(String(row.trigger_at)).getTime(),
    leadMinutes: Number(row.lead_minutes) || 0,
    createdAt: new Date(String(row.created_at)).getTime(),
  };
}

function reminderToRow(reminder: CalendarReminder): Record<string, unknown> {
  return {
    id: reminder.id,
    event_id: reminder.eventId,
    lead_minutes: reminder.leadMinutes,
    trigger_at: new Date(reminder.triggerAt).toISOString(),
    created_at: new Date(reminder.createdAt).toISOString(),
  };
}

export function loadReminders(): CalendarReminder[] {
  return readLocal();
}

export async function hydrateRemindersFromDb(): Promise<CalendarReminder[]> {
  if (!getAuthUserId()) return readLocal();

  const rows = await loadUserRows<Record<string, unknown>>('calendar_reminders', {
    column: 'trigger_at',
    ascending: true,
  });
  if (!rows.length) return readLocal();

  const reminders = rows.map(rowToReminder);
  writeLocal(reminders);
  return reminders;
}

export async function saveReminders(reminders: CalendarReminder[]): Promise<void> {
  writeLocal(reminders);
  if (!getAuthUserId()) return;
  await replaceUserRows('calendar_reminders', reminders.map(reminderToRow));
}
