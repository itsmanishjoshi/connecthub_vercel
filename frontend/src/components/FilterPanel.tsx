import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';
import { STAGE_OPTIONS, StageValue } from '@/types/attendee';

interface FilterPanelProps {
  selectedSectors: Set<string>;
  onSectorsChange: (sectors: Set<string>) => void;
  selectedLocations: Set<string>;
  onLocationsChange: (locations: Set<string>) => void;
  selectedStages?: Set<StageValue>;
  onStagesChange?: (stages: Set<StageValue>) => void;
  showStageFilter?: boolean;
  locations: string[];
  sectors: string[];
  onClearFilters: () => void;
  activeFilterCount: number;
}

const FilterChip = ({
  label,
  isSelected,
  onToggle,
}: {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
      isSelected
        ? 'bg-primary/10 text-primary border border-primary/40 shadow-sm'
        : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent'
    }`}
    title={label}
  >
    {label}
  </button>
);

export const FilterPanel = ({
  selectedSectors,
  onSectorsChange,
  selectedLocations,
  onLocationsChange,
  selectedStages = new Set<StageValue>(),
  onStagesChange,
  showStageFilter = true,
  locations,
  sectors,
  onClearFilters,
  activeFilterCount,
}: FilterPanelProps) => {
  const toggleSector = (sector: string) => {
    const next = new Set(selectedSectors);
    if (next.has(sector)) {
      next.delete(sector);
    } else {
      next.add(sector);
    }
    onSectorsChange(next);
  };

  const toggleLocation = (location: string) => {
    const next = new Set(selectedLocations);
    if (next.has(location)) {
      next.delete(location);
    } else {
      next.add(location);
    }
    onLocationsChange(next);
  };
  
  // Multi-select filters use sets for sectors, locations, and stages

  const toggleStage = (stage: StageValue) => {
    if (!onStagesChange) return;
    const next = new Set(selectedStages);
    if (next.has(stage)) {
      next.delete(stage);
    } else {
      next.add(stage);
    }
    onStagesChange(next);
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="filter-panel bg-card border border-border rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-sky-400 flex items-center justify-center shadow-md">
            <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
          <h3 className="font-display font-bold text-foreground text-sm sm:text-base">Filters</h3>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground text-xs sm:text-sm p-1 sm:p-2"
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Clear All</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* Sector Filter */}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Industry</h4>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {sectors.map((sector) => (
              <FilterChip
                key={sector}
                label={sector}
                isSelected={selectedSectors.has(sector)}
                onToggle={() => toggleSector(sector)}
              />
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Location</h4>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            {locations.map((location) => (
              <FilterChip
                key={location}
                label={location}
                isSelected={selectedLocations.has(location)}
                onToggle={() => toggleLocation(location)}
              />
            ))}
          </div>
        </div>

        {showStageFilter && onStagesChange && (
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Stage</h4>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {STAGE_OPTIONS.map((stageOption) => (
                <FilterChip
                  key={stageOption}
                  label={stageOption}
                  isSelected={selectedStages.has(stageOption)}
                  onToggle={() => toggleStage(stageOption)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
