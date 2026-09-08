import type { ReactNode } from 'react';
import { ArrowLeft, ChevronRight, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AccionlabsLogo } from '@/components/AccionlabsLogo';
import { BrandTagline } from '@/components/BrandTagline';
import { cn } from '@/lib/utils';

const LEADING_SLOT = 'h-9 w-9 shrink-0 sm:h-9 sm:w-9';

/** Shared sizing for ribbon icon buttons and compact inputs */
export const RIBBON_CONTROL = 'h-9 w-9 shrink-0 sm:h-9 sm:w-9';
export const RIBBON_CONTROL_BTN = `${RIBBON_CONTROL} inline-flex items-center justify-center rounded-lg border border-border/60 bg-card/40 text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation`;

export type RibbonPathSegment = {
  label: string;
  onClick?: () => void;
};

export function AppRibbonBrand({
  title,
  pathSegments,
  showTagline = false,
  leading,
  onLeadingClick,
}: {
  title?: string;
  pathSegments?: RibbonPathSegment[] | string[];
  showTagline?: boolean;
  leading?: 'menu' | 'back';
  onLeadingClick?: () => void;
}) {
  const navigate = useNavigate();
  const goHome = () => navigate('/');
  const segments: RibbonPathSegment[] = pathSegments?.length
    ? pathSegments.map((segment) => (typeof segment === 'string' ? { label: segment } : segment))
    : title
      ? [{ label: title }]
      : [];

  const LeadingIcon = leading === 'menu' ? Menu : leading === 'back' ? ArrowLeft : null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-x-1.5 overflow-hidden sm:gap-x-3">
      <div className={LEADING_SLOT}>
        {LeadingIcon && onLeadingClick ? (
          <button
            type="button"
            onClick={(event) => {
              onLeadingClick();
              event.currentTarget.blur();
            }}
            className={`${RIBBON_CONTROL_BTN}`}
            aria-label={leading === 'menu' ? 'Open menu' : 'Back'}
          >
            <LeadingIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(event) => {
          goHome();
          event.currentTarget.blur();
        }}
        className={cn(
          'shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          segments.length > 0 && 'hidden min-[480px]:block',
        )}
        aria-label="ConnectHub home"
      >
        <AccionlabsLogo className="h-8 w-auto sm:h-9" />
      </button>
      <div className="min-w-0 flex-1">
        {segments.length ? (
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 max-w-full flex-nowrap items-center gap-x-0.5 pr-0.5 text-sm leading-tight sm:gap-1 sm:pr-1 sm:text-base md:text-lg">
              {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const clickable = Boolean(segment.onClick) && !isLast;
                return (
                  <li
                    key={`${segment.label}-${index}`}
                    className={cn(
                      'flex min-w-0 items-center gap-0.5 sm:gap-1',
                      isLast ? 'min-w-0 flex-1' : 'max-w-[40%] shrink-0 sm:max-w-none',
                    )}
                  >
                    {index > 0 && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" aria-hidden />
                    )}
                    {clickable ? (
                      <button
                        type="button"
                        onClick={segment.onClick}
                        title={segment.label}
                        className="truncate bg-transparent p-0 text-left font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground focus:outline-none focus-visible:text-foreground"
                      >
                        {segment.label}
                      </button>
                    ) : (
                      <span
                        title={segment.label}
                        className={cn(
                          'truncate px-0.5',
                          isLast ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-muted-foreground',
                        )}
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {segment.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        {showTagline && (
          <BrandTagline className="mt-0.5 hidden truncate text-[11px] sm:block sm:text-xs" />
        )}
      </div>
    </div>
  );
}

export function AppRibbonBar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`relative z-50 shrink-0 border-b border-border/80 bg-background/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80 ${className}`}
    >
      {children}
    </header>
  );
}

export function AppRibbonRow({
  children,
  className = '',
  stackOnMobile = false,
}: {
  children: ReactNode;
  className?: string;
  /** Stack brand and tools on two rows below the sm breakpoint */
  stackOnMobile?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 px-2.5 sm:px-6',
        stackOnMobile
          ? 'flex-col gap-2 py-2 sm:h-[4.25rem] sm:flex-row sm:items-center sm:gap-4 sm:py-0'
          : 'h-12 flex-nowrap items-center gap-1.5 sm:h-[4.25rem] sm:gap-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Right-side ribbon slot: search, filters, then user menu. */
export function AppRibbonTools({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1.5 overflow-visible sm:gap-2.5 ${className}`}
    >
      {children}
    </div>
  );
}
