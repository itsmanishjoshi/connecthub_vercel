import { useEffect, useState } from 'react';
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { getFailedSyncCount, initializeSyncQueue, retryFailedSync, type SyncState } from '@/services/syncQueue';

const labels: Record<SyncState, string> = {
  offline: 'Offline — notes save on this device',
  pending: 'Notes waiting to sync',
  syncing: 'Syncing your notes',
  synced: 'Synced',
  error: 'Sync needs attention',
};

export function SyncIndicator() {
  const [state, setState] = useState<SyncState>(
    navigator.onLine ? 'synced' : 'offline'
  );

  useEffect(() => {
    const onState = (event: Event) => {
      setState((event as CustomEvent<SyncState>).detail);
    };
    const onConflict = () => setState('error');
    window.addEventListener('connecthub:sync-state', onState);
    window.addEventListener('connecthub:sync-conflict', onConflict);
    const cleanup = initializeSyncQueue();
    return () => {
      cleanup();
      window.removeEventListener('connecthub:sync-state', onState);
      window.removeEventListener('connecthub:sync-conflict', onConflict);
    };
  }, []);

  const Icon =
    state === 'offline' ? CloudOff :
    state === 'syncing' || state === 'pending' ? RefreshCw :
    state === 'error' ? TriangleAlert : Check;

  return (
    <div
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-40 flex max-w-[calc(100vw-5.5rem)] items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
      role="status"
      aria-live="polite"
      title={labels[state]}
    >
      <Icon className={`h-3.5 w-3.5 ${state === 'syncing' ? 'animate-spin' : ''}`} />
      <span>{labels[state]}</span>
      {state === 'error' && (
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => retryFailedSync()}
        >
          Retry{getFailedSyncCount() ? ` (${getFailedSyncCount()})` : ''}
        </button>
      )}
    </div>
  );
}
