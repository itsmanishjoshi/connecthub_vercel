import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Ribbon-style: icon only until expanded or typing */
  iconOnly?: boolean;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  iconOnly = false,
}: SearchBarProps) => {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showField = !iconOnly || expanded || Boolean(value);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  if (iconOnly && !showField) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('h-9 w-9 shrink-0 rounded-full', className)}
        aria-label="Search"
        onClick={() => setExpanded(true)}
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'relative h-9 transition-[width] duration-200',
        iconOnly ? 'w-[9.5rem] sm:w-[11rem]' : 'w-full',
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={iconOnly ? '' : placeholder}
        aria-label={iconOnly ? 'Search events' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (iconOnly && !value.trim()) setExpanded(false);
        }}
        className="h-9 min-h-9 rounded-full border-border bg-background pl-8 pr-9 text-xs focus:border-primary focus:ring-primary sm:text-sm"
      />
      {value ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full p-0 hover:bg-muted active:bg-muted/80"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : iconOnly ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full p-0 hover:bg-muted active:bg-muted/80"
          aria-label="Close search"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};
