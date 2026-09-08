import { ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'company-asc'
  | 'location-asc'
  | 'designation-asc'
  | 'notes-recent'
  | 'priority'
  | 'stage';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'company-asc', label: 'Company (A-Z)' },
  { value: 'location-asc', label: 'Location (A-Z)' },
  { value: 'designation-asc', label: 'Designation (A-Z)' },
  { value: 'priority', label: 'Priority Status' },
  { value: 'stage', label: 'Stage' },
  { value: 'notes-recent', label: 'Recently Added Notes' },
];

export const SortDropdown = ({ value, onChange }: SortDropdownProps) => {
  return (
    <div className="relative w-full">
      <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="w-full h-9 pl-9 pr-3 text-sm bg-background border-border rounded-full text-muted-foreground [&>svg]:hidden focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Sort"
        >
-          <span>Sort...</span>
+          <span className="sm:inline hidden">Sort...</span>
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
