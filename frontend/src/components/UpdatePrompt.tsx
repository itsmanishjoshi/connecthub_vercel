import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  if (import.meta.env.DEV) return null;
  return <InstalledUpdatePrompt />;
}

function InstalledUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-1/2 z-50 w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border bg-background p-3 shadow-lg"
    >
      <p className="mb-2 text-sm font-medium">A ConnectHub update is ready.</p>
      <p className="mb-3 text-xs tracking-[0.04em] text-muted-foreground">Remember what matters</p>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => updateServiceWorker(true)}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
