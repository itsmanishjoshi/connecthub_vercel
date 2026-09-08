import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffMs, compactQueue, markFailedAttempt, MAX_ATTEMPTS } from '../src/lib/syncLogic.mjs';
import { isStaleWrite, stripConflictMeta } from '../src/lib/conflicts.mjs';

test('note updates compact into a pending create', () => {
  const queue = compactQueue([], {
    id: '1',
    type: 'note:create',
    payload: { id: 'note-1', attendeeId: 'a1', text: 'draft' },
  });
  const next = compactQueue(queue, {
    id: '2',
    type: 'note:update',
    payload: { noteId: 'note-1', text: 'final' },
  });
  assert.equal(next.length, 1);
  assert.equal(next[0].type, 'note:create');
  assert.equal(next[0].payload.text, 'final');
});

test('create then delete cancels the note out of the queue', () => {
  const created = compactQueue([], {
    id: '1',
    type: 'note:create',
    payload: { id: 'note-1', attendeeId: 'a1', text: 'draft' },
  });
  const next = compactQueue(created, {
    id: '2',
    type: 'note:delete',
    payload: { noteId: 'note-1' },
  });
  assert.equal(next.length, 0);
});

test('status and preference snapshots keep only the latest value', () => {
  let queue = compactQueue([], {
    id: '1',
    type: 'statuses:set',
    payload: { attendeeId: 'a1', colors: ['high_priority'] },
  });
  queue = compactQueue(queue, {
    id: '2',
    type: 'statuses:set',
    payload: { attendeeId: 'a1', colors: ['notes'] },
  });
  queue = compactQueue(queue, {
    id: '3',
    type: 'preferences:set',
    payload: { data: { theme: 'light' }, updatedAt: '1' },
  });
  queue = compactQueue(queue, {
    id: '4',
    type: 'preferences:set',
    payload: { data: { theme: 'dark' }, updatedAt: '2' },
  });
  assert.equal(queue.length, 2);
  assert.deepEqual(queue[0].payload.colors, ['notes']);
  assert.equal(queue[1].payload.data.theme, 'dark');
});

test('failed operations back off and eventually exhaust', () => {
  let operation = { id: '1', attempts: 0, nextAttemptAt: 0 };
  for (let index = 0; index < MAX_ATTEMPTS - 1; index += 1) {
    operation = markFailedAttempt(operation, 1_000);
    assert.equal(operation.exhausted, false);
    assert.equal(operation.nextAttemptAt > 1_000, true);
  }
  operation = markFailedAttempt(operation, 1_000);
  assert.equal(operation.exhausted, true);
  assert.equal(backoffMs(1) < backoffMs(4), true);
});

test('stale writes are detected only when the server copy is newer', () => {
  assert.equal(isStaleWrite('2026-09-01T12:00:00.000Z', '2026-09-01T11:00:00.000Z'), true);
  assert.equal(isStaleWrite('2026-09-01T11:00:00.000Z', '2026-09-01T12:00:00.000Z'), false);
  assert.equal(isStaleWrite('2026-09-01T12:00:00.000Z', null), false);
  assert.deepEqual(stripConflictMeta({ text: 'ok', expected_updated_at: 'old' }), { text: 'ok' });
});
