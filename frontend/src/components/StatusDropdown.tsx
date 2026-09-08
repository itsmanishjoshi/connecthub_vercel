import { ChevronDown, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusColor } from '@/types/attendee';
import { useEffect, useMemo, useState } from 'react';

interface StatusOption {
  value: StatusColor;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

interface StatusDropdownProps {
  options: StatusOption[];
  value: StatusColor[];
  onChange: (statuses: StatusColor[]) => void;
  placeholder?: string;
  className?: string;
}

export function StatusDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select status...',
  className = '',
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StatusColor[]>(value);

  useEffect(() => {
    if (!open) {
      setDraft(value);
    }
  }, [open, value]);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label] as const));
    return value.map((v) => map.get(v) ?? v);
  }, [options, value]);

  const triggerText = useMemo(() => {
    if (selectedLabels.length === 0) return placeholder;
    if (selectedLabels.length === 1) return selectedLabels[0];
    return `${placeholder} (${selectedLabels.length})`;
  }, [placeholder, selectedLabels]);

  const toggleDraft = (status: StatusColor) => {
    setDraft((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`inline-flex shrink-0 justify-center gap-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none sm:justify-between ${className}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="hidden truncate sm:inline">{triggerText}</span>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            {value.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-muted rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(calc(100vw-2rem),228px)] py-1">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={(e) => {
              e.preventDefault();
              toggleDraft(option.value);
            }}
            className={`flex items-center justify-between gap-3 rounded-md my-1 ${
              draft.includes(option.value)
                ? 'bg-primary/10 text-primary focus:bg-primary/15 border border-primary/20'
                : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-2">
              <option.icon className="h-4 w-4" />
              <span>{option.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {option.count}
              </span>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center justify-end gap-2 p-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={(e) => {
              e.preventDefault();
              onChange([]);
              setDraft([]);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            className="h-8 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            onClick={(e) => {
              e.preventDefault();
              onChange(draft);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
