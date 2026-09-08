export const MAX_ATTEMPTS = 5;

export function backoffMs(attempts) {
  return Math.min(30_000, 1_000 * (2 ** Math.max(1, attempts)));
}

export function compactQueue(queue, incoming) {
  if (incoming.type === 'note:update') {
    const pendingCreate = queue.find(
      (existing) => existing.type === 'note:create' && existing.payload.id === incoming.payload.noteId,
    );
    if (pendingCreate?.type === 'note:create') {
      pendingCreate.payload.text = incoming.payload.text;
      return queue;
    }
  }

  if (incoming.type === 'note:delete') {
    const pendingCreate = queue.some(
      (existing) => existing.type === 'note:create' && existing.payload.id === incoming.payload.noteId,
    );
    if (pendingCreate) {
      return queue.filter((existing) => !(
        (existing.type === 'note:create' && existing.payload.id === incoming.payload.noteId)
        || (existing.type === 'note:update' && existing.payload.noteId === incoming.payload.noteId)
      ));
    }
  }

  const compacted = queue.filter((existing) => {
    if (incoming.type === 'statuses:set' && existing.type === incoming.type) {
      return existing.payload.attendeeId !== incoming.payload.attendeeId;
    }
    if (incoming.type === 'stage:set' && existing.type === incoming.type) {
      return existing.payload.attendeeId !== incoming.payload.attendeeId;
    }
    if (incoming.type === 'note:update' && existing.type === incoming.type) {
      return existing.payload.noteId !== incoming.payload.noteId;
    }
    if (incoming.type === 'note:delete' && existing.type === 'note:update') {
      return existing.payload.noteId !== incoming.payload.noteId;
    }
    if (incoming.type === 'notebook:set' && existing.type === incoming.type) {
      return existing.payload.pageNumber !== incoming.payload.pageNumber;
    }
    if (incoming.type === 'preferences:set' && existing.type === incoming.type) return false;
    return true;
  });

  return [...compacted, incoming];
}

export function markFailedAttempt(operation, now = Date.now()) {
  const attempts = (operation.attempts || 0) + 1;
  return {
    ...operation,
    attempts,
    nextAttemptAt: now + backoffMs(attempts),
    exhausted: attempts >= MAX_ATTEMPTS,
  };
}

export function currentAccountId() {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem('current_user_id');
}

export function hasValidSession() {
  if (typeof localStorage === 'undefined') return false;
  return Boolean(localStorage.getItem('current_user_id') && localStorage.getItem('connecthub_token'));
}
