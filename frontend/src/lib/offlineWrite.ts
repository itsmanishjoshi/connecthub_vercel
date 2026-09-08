/** Helpers for offline-first writes (notes, statuses) scoped to the signed-in user. */

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function notifyLocalSave(kind: 'note' | 'status' | 'stage'): void {
  window.dispatchEvent(new CustomEvent('connecthub:local-save', { detail: { kind } }));
}
