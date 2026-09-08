import { supabase } from '@/lib/supabaseClient';
import { compactQueue, hasValidSession, markFailedAttempt } from '@/lib/syncLogic.mjs';
import { randomUUID } from '@/lib/utils';
import type { StageValue, StatusColor } from '@/types/attendee';

export type PendingOperation =
  | { id: string; type: 'note:create'; payload: { id: string; attendeeId: string; text: string }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'note:update'; payload: { noteId: string; text: string }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'note:delete'; payload: { noteId: string }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'statuses:set'; payload: { attendeeId: string; colors: StatusColor[] }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'stage:set'; payload: { attendeeId: string; stage: StageValue }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'notebook:set'; payload: { pageNumber: number; content: string; updatedAt: string }; attempts: number; nextAttemptAt: number }
  | { id: string; type: 'preferences:set'; payload: { data: Record<string, unknown>; updatedAt: string }; attempts: number; nextAttemptAt: number };
type NewOperation = PendingOperation extends infer Operation
  ? Operation extends PendingOperation
    ? Omit<Operation, 'id' | 'attempts' | 'nextAttemptAt'>
    : never
  : never;

export type SyncState = 'offline' | 'pending' | 'syncing' | 'synced' | 'error';

const queueKey = (userId = localStorage.getItem('current_user_id') || 'guest') =>
  `connecthub_sync_queue_${userId}`;
const deadLetterKey = (userId?: string) => `${queueKey(userId)}_failed`;

function emit(state: SyncState) {
  window.dispatchEvent(new CustomEvent('connecthub:sync-state', { detail: state }));
}

function readQueue(): PendingOperation[] {
  try {
    const queue = JSON.parse(localStorage.getItem(queueKey()) || '[]') as PendingOperation[];
    return queue.map((operation) => ({
      ...operation,
      attempts: operation.attempts || 0,
      nextAttemptAt: operation.nextAttemptAt || 0,
    }));
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOperation[]) {
  localStorage.setItem(queueKey(), JSON.stringify(queue));
  emit(queue.length ? 'pending' : 'synced');
}

export function enqueueSync(operation: NewOperation) {
  const op = {
    ...operation,
    id: randomUUID(),
    attempts: 0,
    nextAttemptAt: 0,
  } as PendingOperation;
  writeQueue(compactQueue(readQueue(), op) as PendingOperation[]);
}

async function execute(operation: PendingOperation, userId: string) {
  if (operation.type === 'note:create') {
    const { error } = await supabase.from('attendee_notes').upsert({
      id: operation.payload.id,
      user_id: userId,
      attendee_id: operation.payload.attendeeId,
      text: operation.payload.text,
    });
    if (error) throw error;
    return;
  }
  if (operation.type === 'note:update') {
    const { error } = await supabase
      .from('attendee_notes')
      .update({ text: operation.payload.text })
      .eq('id', operation.payload.noteId);
    if (error) throw error;
    return;
  }
  if (operation.type === 'note:delete') {
    const { error } = await supabase
      .from('attendee_notes')
      .delete()
      .eq('id', operation.payload.noteId);
    if (error) throw error;
    return;
  }
  if (operation.type === 'statuses:set') {
    const { error: deleteError } = await supabase
      .from('attendee_statuses')
      .delete()
      .eq('attendee_id', operation.payload.attendeeId);
    if (deleteError) throw deleteError;
    if (operation.payload.colors.length) {
      const { error } = await supabase.from('attendee_statuses').insert(
        operation.payload.colors.map((status_color) => ({
          user_id: userId,
          attendee_id: operation.payload.attendeeId,
          status_color,
        }))
      );
      if (error) throw error;
    }
    return;
  }
  if (operation.type === 'stage:set') {
    const { error } = await supabase.from('attendee_stages').upsert(
      {
        user_id: userId,
        attendee_id: operation.payload.attendeeId,
        stage: operation.payload.stage,
      },
      { onConflict: 'user_id,attendee_id' }
    );
    if (error) throw error;
    return;
  }
  if (operation.type === 'notebook:set') {
    const { error } = await supabase.from('user_notes').upsert({
      user_id: userId,
      page_number: operation.payload.pageNumber,
      content: operation.payload.content,
      updated_at: operation.payload.updatedAt,
    }, { onConflict: 'user_id,page_number' });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    ...operation.payload.data,
    updated_at: operation.payload.updatedAt,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

let activeFlush: Promise<void> | null = null;

export function flushPendingSync(): Promise<void> {
  if (activeFlush) return activeFlush;
  activeFlush = (async () => {
    if (!navigator.onLine) {
      emit('offline');
      return;
    }
    if (!hasValidSession()) return;
    const userId = localStorage.getItem('current_user_id');
    if (!userId) return;
    const queue = readQueue();
    if (!queue.length) {
      emit('synced');
      return;
    }
    emit('syncing');
    let hadError = false;
    for (const operation of queue) {
      if (operation.nextAttemptAt > Date.now()) continue;
      try {
        await execute(operation, userId);
        writeQueue(readQueue().filter((queued) => queued.id !== operation.id));
      } catch (error) {
        console.error('Pending sync failed:', error);
        hadError = true;
        const remaining = readQueue();
        const failed = remaining.find((queued) => queued.id === operation.id);
        if (!failed) continue;
        const retried = markFailedAttempt(failed);
        Object.assign(failed, retried);
        if (retried.exhausted) {
          const deadLetters = JSON.parse(localStorage.getItem(deadLetterKey()) || '[]');
          localStorage.setItem(deadLetterKey(), JSON.stringify([...deadLetters, failed]));
          writeQueue(remaining.filter((queued) => queued.id !== operation.id));
        } else {
          writeQueue(remaining);
        }
      }
    }
    if (hadError) emit('error');
    else if (readQueue().length) emit('pending');
  })().finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

export function initializeSyncQueue() {
  const sync = () => void flushPendingSync();
  const offline = () => emit('offline');
  const visible = () => {
    if (document.visibilityState === 'visible') sync();
  };
  const interval = window.setInterval(() => {
    if (navigator.onLine && readQueue().length) sync();
  }, 30_000);
  window.addEventListener('online', sync);
  window.addEventListener('offline', offline);
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', visible);
  emit(navigator.onLine ? (readQueue().length ? 'pending' : 'synced') : 'offline');
  void flushPendingSync();
  return () => {
    window.clearInterval(interval);
    window.removeEventListener('online', sync);
    window.removeEventListener('offline', offline);
    window.removeEventListener('focus', sync);
    document.removeEventListener('visibilitychange', visible);
  };
}

export function retryFailedSync(): void {
  const failed = JSON.parse(localStorage.getItem(deadLetterKey()) || '[]') as PendingOperation[];
  if (!failed.length) return;
  const reset = failed.map((operation) => ({ ...operation, attempts: 0, nextAttemptAt: 0 }));
  localStorage.removeItem(deadLetterKey());
  writeQueue([...readQueue(), ...reset]);
  void flushPendingSync();
}

export function getPendingSyncCount(): number {
  return readQueue().length;
}

export function getFailedSyncCount(): number {
  try {
    return (JSON.parse(localStorage.getItem(deadLetterKey()) || '[]') as PendingOperation[]).length;
  } catch {
    return 0;
  }
}
