import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RIBBON_CONTROL_BTN } from '@/components/AppRibbon';
import {
  ensureSearchIndex,
  resultTypeLabel,
  searchApplication,
  type GlobalSearchResult,
} from '@/services/globalSearchService';

interface GlobalSearchProps {
  className?: string;
  /** Collapse to icon on phones to save ribbon space */
  compactOnMobile?: boolean;
}

export function GlobalSearch({ className, compactOnMobile = false }: GlobalSearchProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [indexLoading, setIndexLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length > 0;

  const updateDropdownPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth * 0.92);
    setDropdownRect({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - width),
      width,
    });
  }, []);

  const warmingRef = useRef(false);

  const warmIndex = useCallback(async () => {
    if (warmingRef.current) return;
    warmingRef.current = true;
    setIndexLoading(true);
    try {
      await ensureSearchIndex();
    } finally {
      setIndexLoading(false);
      warmingRef.current = false;
    }
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await ensureSearchIndex();
      const hits = await searchApplication(trimmed, 14);
      setResults(hits);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void warmIndex();
  }, [warmIndex]);

  useEffect(() => {
    if (!showDropdown) return;
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query, showDropdown, runSearch]);

  useLayoutEffect(() => {
    if (!showDropdown) {
      setDropdownRect(null);
      return;
    }
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [showDropdown, updateDropdownPosition, query]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const portal = document.getElementById('global-search-portal');
      if (portal?.contains(target)) return;
      setOpen(false);
      if (!query.trim()) setMobileExpanded(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [query]);

  const showCompactTrigger = compactOnMobile && !mobileExpanded && !query;

  const clear = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const pickResult = (result: GlobalSearchResult) => {
    setOpen(false);
    setMobileExpanded(false);
    setQuery('');
    setResults([]);
    navigate(result.href);
  };

  const dropdown = showDropdown && dropdownRect
    ? createPortal(
        <div
          id="global-search-results"
          role="listbox"
          style={{
            position: 'fixed',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 200,
          }}
          className="max-h-[min(60vh,22rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl"
        >
          {trimmedQuery.length < 2 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Keep typing for suggestions…</p>
          ) : loading || indexLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No matches for &ldquo;{trimmedQuery}&rdquo;. Try a similar spelling.
            </p>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                role="option"
                onClick={() => pickResult(result)}
                className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-muted/80"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {resultTypeLabel(result.type)}
                </span>
                <span className="truncate text-sm font-medium text-foreground">{result.title}</span>
                {result.subtitle ? (
                  <span className="truncate text-xs text-muted-foreground">{result.subtitle}</span>
                ) : null}
              </button>
            ))
          )}
        </div>,
        document.getElementById('global-search-portal') ?? document.body,
      )
    : null;

  return (
    <>
      <div id="global-search-portal" />
      <div ref={rootRef} className={cn('relative shrink-0', className)}>
        {showCompactTrigger ? (
          <button
            type="button"
            aria-label="Open search"
            onClick={() => {
              setMobileExpanded(true);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className={cn(RIBBON_CONTROL_BTN, 'sm:hidden')}
          >
            <Search className="h-4 w-4" />
          </button>
        ) : null}
        <div
          className={cn(
            'relative flex h-9 w-[7.75rem] shrink-0 items-center rounded-lg border border-border/60 bg-card/40 shadow-sm transition-[box-shadow,border-color] sm:h-9 sm:w-[9.5rem]',
            showCompactTrigger ? 'hidden sm:flex' : 'flex',
            open && 'border-primary/35 bg-card/60 shadow-md',
          )}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search…"
            aria-label="Search ConnectHub"
            aria-expanded={showDropdown}
            aria-controls="global-search-results"
            autoComplete="off"
            spellCheck={false}
            onFocus={() => {
              setOpen(true);
              setMobileExpanded(true);
              void warmIndex();
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                if (query) {
                  clear();
                } else {
                  setOpen(false);
                  inputRef.current?.blur();
                }
              }
              if (event.key === 'Enter' && results[0]) {
                event.preventDefault();
                pickResult(results[0]);
              }
            }}
            className={cn(
              'h-full w-full rounded-lg bg-transparent py-0 pl-8 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm',
              query ? 'pr-8' : 'pr-3',
            )}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clear}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      {dropdown}
    </>
  );
}
