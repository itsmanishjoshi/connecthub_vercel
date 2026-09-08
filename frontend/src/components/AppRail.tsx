import { OFFICE_WINDOWS, officeWindowTitle, type OfficeWindowId } from '@/components/OfficeWindows';
import { cn } from '@/lib/utils';

export function AppRail({
  active,
  onSelect,
  open,
  onClose,
}: {
  active: OfficeWindowId | null;
  onSelect: (id: OfficeWindowId) => void;
  open: boolean;
  onClose?: () => void;
}) {
  if (!open) return null;

  const handleSelect = (id: OfficeWindowId) => {
    onSelect(id);
    if (onClose && window.matchMedia('(max-width: 1023px)').matches) {
      onClose();
    }
  };

  return (
    <aside className="absolute inset-y-0 left-0 z-40 flex w-[12.75rem] max-w-[85vw] flex-col border-r border-border bg-card/95 shadow-xl backdrop-blur-sm lg:relative lg:z-auto lg:h-full lg:w-[13.5rem] lg:max-w-none lg:shrink-0 lg:shadow-none">
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 lg:px-2.5">
        {OFFICE_WINDOWS.map((item) => {
          const Icon = item.icon;
          const current = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={item.title}
              className={cn(
                'flex h-10 min-h-[44px] w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-sm transition-colors duration-150 touch-manipulation sm:h-9 sm:min-h-0 lg:gap-3 lg:px-3',
                current
                  ? 'bg-muted font-medium text-foreground dark:bg-white/10 dark:text-stone-100'
                  : item.live
                    ? 'text-stone-600 hover:bg-muted/80 hover:text-foreground dark:text-stone-300 dark:hover:bg-white/5 dark:hover:text-stone-100'
                    : 'text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-left">{officeWindowTitle(item.id)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
