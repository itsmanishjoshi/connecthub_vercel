import { BarChart3, Briefcase, Building2, Calendar, FolderOpen, Home, Sparkles, Users, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfficeWindowVisual, WINDOW_THEME, windowAccentStrip } from '@/components/OfficeWindowVisual';

export type OfficeWindowId = 'accion' | 'events' | 'galaxy' | 'repository' | 'assets' | 'teams' | 'clients' | 'rooms' | 'analytics';

export const MY_ACCION_URL = 'https://accion-gcc.vercel.app/';
export const GALAXY_URL = 'https://accionint-a2gvfph2d9anbpcw.canadacentral-01.azurewebsites.net/login';

export const OFFICE_WINDOWS: Array<{
  id: OfficeWindowId;
  title: string;
  live: boolean;
  blurb: string;
  hint: string;
  icon: typeof Calendar;
}> = [
  { id: 'accion', title: 'My Accion', live: true, blurb: '', hint: '', icon: Home },
  { id: 'events', title: 'Events', live: true, blurb: '', hint: '', icon: Calendar },
  { id: 'galaxy', title: 'Galaxy', live: true, blurb: '', hint: '', icon: Sparkles },
  { id: 'repository', title: 'Success Stories', live: true, blurb: '', hint: '', icon: Building2 },
  { id: 'assets', title: 'Repository', live: true, blurb: '', hint: '', icon: FolderOpen },
  { id: 'teams', title: 'Teams', live: false, blurb: '', hint: '', icon: Users },
  { id: 'clients', title: 'Clients', live: false, blurb: '', hint: '', icon: Briefcase },
  { id: 'rooms', title: 'Meeting rooms', live: false, blurb: '', hint: '', icon: Video },
  { id: 'analytics', title: 'Analytics', live: true, blurb: '', hint: '', icon: BarChart3 },
];

export function pathForWindow(id: OfficeWindowId) {
  if (id === 'accion') return '/my-accion';
  if (id === 'events') return '/events';
  if (id === 'galaxy') return '/galaxy';
  if (id === 'repository') return '/repository';
  if (id === 'assets') return '/assets';
  if (id === 'analytics') return '/analytics';
  return '/';
}

export function windowFromPath(pathname: string): OfficeWindowId | null {
  if (pathname.startsWith('/my-accion')) return 'accion';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/galaxy')) return 'galaxy';
  if (pathname.startsWith('/repository')) return 'repository';
  if (pathname.startsWith('/assets')) return 'assets';
  if (pathname.startsWith('/analytics')) return 'analytics';
  return null;
}

interface OfficeWindowsProps {
  active: OfficeWindowId | null;
  onSelect: (id: OfficeWindowId) => void;
  variant?: 'desktop' | 'strip';
}

export function OfficeWindows({ active, onSelect, variant = 'strip' }: OfficeWindowsProps) {
  if (variant === 'desktop') {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {OFFICE_WINDOWS.map((item) => {
          const Icon = item.icon;
          const theme = WINDOW_THEME[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-disabled={!item.live}
              className={cn(
                'group relative flex touch-manipulation flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm outline-none transition-[border-color,box-shadow] duration-200 sm:min-h-[11.5rem] sm:rounded-xl',
                item.live
                  ? cn('cursor-pointer hover:shadow-md', theme.borderHover)
                  : 'cursor-default opacity-75',
              )}
            >
              <span
                className={cn('absolute left-0 top-0 h-full w-0.5 sm:w-1', windowAccentStrip(item.id), !item.live && 'opacity-40')}
                aria-hidden
              />

              <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-2.5 py-2 pl-3 sm:gap-3 sm:px-4 sm:py-3 sm:pl-5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md sm:h-10 sm:w-10 sm:rounded-lg',
                    theme.icon,
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" strokeWidth={1.75} />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-xs font-semibold leading-tight max-sm:line-clamp-2 sm:text-[15px] sm:leading-snug sm:line-clamp-none',
                    item.live ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.title}
                </span>
                {!item.live ? (
                  <span className="shrink-0 rounded border border-border bg-muted/50 px-1.5 py-px text-[8px] font-medium uppercase tracking-wide text-muted-foreground sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                    Soon
                  </span>
                ) : null}
              </div>

              <div className={cn('relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-5 sm:py-5', theme.panel)}>
                <OfficeWindowVisual id={item.id} dimmed={!item.live} compact />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="window-tab-scroll mb-3 flex gap-2 pb-1 sm:mb-4">
      {OFFICE_WINDOWS.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-disabled={!item.live}
            className={cn(
              'min-w-[8.5rem] shrink-0 touch-manipulation rounded-lg border px-3 py-2.5 text-left sm:min-w-[9rem]',
              selected && item.live
                ? 'border-primary/30 bg-muted text-foreground dark:border-white/20 dark:bg-white/10 dark:text-stone-100'
                : item.live
                  ? 'border-border/80 bg-card text-stone-600 dark:text-stone-300'
                  : 'border-border bg-card opacity-60',
              !item.live && 'text-muted-foreground',
            )}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  selected && item.live ? 'text-foreground dark:text-stone-100' : item.live ? 'text-stone-600 dark:text-stone-300' : 'text-muted-foreground',
                )}
              />
              <span
                className={cn(
                  'text-sm font-semibold leading-snug responsive-text-wrap',
                  selected && item.live ? 'text-foreground dark:text-stone-100' : item.live ? 'text-stone-600 dark:text-stone-300' : 'text-muted-foreground',
                )}
              >
                {item.title}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function officeWindowTitle(id: OfficeWindowId) {
  return OFFICE_WINDOWS.find((item) => item.id === id)?.title || 'ConnectHub';
}
