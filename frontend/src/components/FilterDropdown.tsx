import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Filter, ChevronDown, ChevronRight, Mic, Tags } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
interface FilterOption {
  id: string;
  label: string;
  count: number;
}

interface FilterDropdownProps {
  industries: FilterOption[];
  locations: FilterOption[];
  priorities: FilterOption[];
  selectedIndustries: string[];
  selectedLocations: string[];
  selectedPriorities: string[];
  showSpeakers?: boolean;
  showCompetitors?: boolean;
  onApply: (
    industries: string[],
    locations: string[],
    priorities: string[],
    showSpeakers: boolean,
    showCompetitors: boolean,
  ) => void;
  className?: string;
}

type FilterSectionKey = "industry" | "location" | "priority";

function optionButtonClass(selected: boolean) {
  return cn(
    "flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg px-2 py-2 text-[11px] transition-all sm:text-sm",
    selected
      ? "border border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100"
      : "border border-slate-200 bg-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700",
  );
}

function FilterOptionList({
  options,
  selectedIds,
  onToggle,
}: {
  options: FilterOption[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id, !selected)}
            className={optionButtonClass(selected)}
          >
            <span className="min-w-0 flex-1 truncate text-left font-medium">{option.label}</span>
            <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  active,
  onClick,
  icon: Icon,
  label,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Mic;
  label: string;
  variant?: "default" | "competitor";
}) {
  const isCompetitor = variant === "competitor";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
        active
          ? isCompetitor
            ? "text-slate-900 dark:text-slate-100"
            : "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
      )}
      style={active && isCompetitor ? { backgroundColor: "rgba(235, 75, 85, 0.1)" } : undefined}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active
              ? isCompetitor
                ? ""
                : "text-blue-600"
              : "text-slate-500 dark:text-slate-400",
          )}
          style={active && isCompetitor ? { color: "#eb4b55" } : undefined}
        />
        <span className="truncate font-medium">{label}</span>
      </div>
      {active && (
        <div
          className={cn("h-2 w-2 shrink-0 rounded-full", isCompetitor ? "" : "bg-blue-600")}
          style={isCompetitor ? { backgroundColor: "#eb4b55" } : undefined}
        />
      )}
    </button>
  );
}

function FilterActions({
  onApply,
  onClear,
  compact = false,
}: {
  onApply: () => void;
  onClear: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700", compact && "pt-2")}>
      <Button
        variant="default"
        size="sm"
        className={cn(
          "w-full rounded-lg bg-blue-600 font-bold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
          compact ? "h-9" : "h-10",
        )}
        onClick={onApply}
      >
        Apply
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full rounded-lg font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white",
          compact ? "h-8" : "h-10",
        )}
        onClick={onClear}
      >
        Clear
      </Button>
    </div>
  );
}
function MobileAccordionSection({
  title,
  expanded,
  onToggle,
  children,
  compact = false,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between px-0.5 text-left text-sm font-semibold text-slate-800 dark:text-slate-100",
          compact ? "py-2" : "py-3",
        )}
      >
        <span>{title}</span>
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-90")} />
      </button>
      {expanded ? <div className={cn("px-0.5", compact ? "pb-2" : "pb-3")}>{children}</div> : null}
    </div>
  );
}
export function FilterDropdown({
  industries,
  locations,
  priorities,
  selectedIndustries,
  selectedLocations,
  selectedPriorities,
  showSpeakers = false,
  showCompetitors = false,
  onApply,
  className,
}: FilterDropdownProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<FilterSectionKey | null>(null);
  const [localSelectedIndustries, setLocalSelectedIndustries] =
    useState<string[]>(selectedIndustries);
  const [localSelectedLocations, setLocalSelectedLocations] =
    useState<string[]>(selectedLocations);
  const [localSelectedPriorities, setLocalSelectedPriorities] =
    useState<string[]>(selectedPriorities);
  const [localShowSpeakers, setLocalShowSpeakers] = useState(showSpeakers);
  const [localShowCompetitors, setLocalShowCompetitors] = useState(showCompetitors);

  useEffect(() => {
    setLocalSelectedIndustries(selectedIndustries);
  }, [selectedIndustries]);

  useEffect(() => {
    setLocalSelectedLocations(selectedLocations);
  }, [selectedLocations]);

  useEffect(() => {
    setLocalSelectedPriorities(selectedPriorities);
  }, [selectedPriorities]);

  useEffect(() => {
    setLocalShowSpeakers(showSpeakers);
  }, [showSpeakers]);

  useEffect(() => {
    setLocalShowCompetitors(showCompetitors);
  }, [showCompetitors]);

  useEffect(() => {
    if (open) {
      setLocalSelectedIndustries(selectedIndustries);
      setLocalSelectedLocations(selectedLocations);
      setLocalSelectedPriorities(selectedPriorities);
      setLocalShowSpeakers(showSpeakers);
      setLocalShowCompetitors(showCompetitors);
    }
  }, [open, selectedIndustries, selectedLocations, selectedPriorities, showSpeakers, showCompetitors]);

  const handleIndustryChange = (industryId: string, checked: boolean) => {
    setLocalSelectedIndustries((prev) =>
      checked ? [...prev, industryId] : prev.filter((id) => id !== industryId),
    );
  };

  const handleLocationChange = (locationId: string, checked: boolean) => {
    setLocalSelectedLocations((prev) =>
      checked ? [...prev, locationId] : prev.filter((id) => id !== locationId),
    );
  };

  const handlePriorityChange = (priorityId: string, checked: boolean) => {
    setLocalSelectedPriorities((prev) =>
      checked ? [...prev, priorityId] : prev.filter((id) => id !== priorityId),
    );
  };

  const handleApply = () => {
    onApply(
      localSelectedIndustries,
      localSelectedLocations,
      localSelectedPriorities,
      localShowSpeakers,
      localShowCompetitors,
    );
    setOpen(false);
  };

  const handleClear = () => {
    setLocalSelectedIndustries([]);
    setLocalSelectedLocations([]);
    setLocalSelectedPriorities([]);
    setLocalShowSpeakers(false);
    setLocalShowCompetitors(false);
    onApply([], [], [], false, false);
    setOpen(false);
  };

  const triggerButton = (
    <Button
      variant="outline"
      className={cn(
        "inline-flex shrink-0 justify-center gap-1 border-slate-200 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Filter className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-400" />
        <span className="hidden truncate text-slate-700 dark:text-slate-300 sm:inline">Filter</span>
      </div>
      <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-600 opacity-50 dark:text-slate-400 sm:block" />
    </Button>
  );

  const toggleSection = (section: FilterSectionKey) => {
    setExpandedSection((current) => (current === section ? null : section));
  };

  const mobileFilterPanel = (
    <div className="flex w-full flex-col">
      <div className="shrink-0 border-b border-slate-200 px-1 pb-2 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Filters</p>
      </div>

      <div className="max-h-[min(45vh,16rem)] overflow-y-auto overscroll-contain px-1 pt-1">
        <MobileAccordionSection
          title="Industry"
          expanded={expandedSection === "industry"}
          onToggle={() => toggleSection("industry")}
          compact
        >
          <FilterOptionList
            options={industries}
            selectedIds={localSelectedIndustries}
            onToggle={handleIndustryChange}
          />
        </MobileAccordionSection>

        <MobileAccordionSection
          title="Location"
          expanded={expandedSection === "location"}
          onToggle={() => toggleSection("location")}
          compact
        >
          <FilterOptionList
            options={locations}
            selectedIds={localSelectedLocations}
            onToggle={handleLocationChange}
          />
        </MobileAccordionSection>

        <MobileAccordionSection
          title="Priority"
          expanded={expandedSection === "priority"}
          onToggle={() => toggleSection("priority")}
          compact
        >
          <FilterOptionList
            options={priorities}
            selectedIds={localSelectedPriorities}
            onToggle={handlePriorityChange}
          />
        </MobileAccordionSection>

        <div className="space-y-0.5 py-1">
          <ToggleRow
            active={localShowSpeakers}
            onClick={() => setLocalShowSpeakers(!localShowSpeakers)}
            icon={Mic}
            label="Speakers"
          />
          <ToggleRow
            active={localShowCompetitors}
            onClick={() => setLocalShowCompetitors(!localShowCompetitors)}
            icon={Tags}
            label="Competitors"
            variant="competitor"
          />
        </div>
      </div>

      <div className="shrink-0 px-1 pt-1">
        <FilterActions onApply={handleApply} onClear={handleClear} compact />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
        )}
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            collisionPadding={12}
            className="z-50 w-[min(17.5rem,calc(100vw-1rem))] overflow-hidden rounded-xl border-slate-200 bg-white p-2.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
            sideOffset={6}
          >
            {mobileFilterPanel}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          collisionPadding={12}
          className="z-50 w-[min(240px,calc(100vw-1.5rem))] rounded-xl border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
          sideOffset={8}
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:bg-slate-700">
              Industry
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                className="max-h-[60vh] w-[min(240px,calc(100vw-2rem))] space-y-2 overflow-y-auto rounded-xl border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
                sideOffset={8}
                alignOffset={-8}
                collisionPadding={12}
              >
                <FilterOptionList
                  options={industries}
                  selectedIds={localSelectedIndustries}
                  onToggle={handleIndustryChange}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:bg-slate-700">
              Location
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                className="max-h-[60vh] w-[min(240px,calc(100vw-2rem))] space-y-2 overflow-y-auto rounded-xl border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
                sideOffset={8}
                alignOffset={-8}
                collisionPadding={12}
              >
                <FilterOptionList
                  options={locations}
                  selectedIds={localSelectedLocations}
                  onToggle={handleLocationChange}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:bg-slate-700">
              Priority
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                className="max-h-[60vh] w-[min(220px,calc(100vw-2rem))] space-y-2 overflow-y-auto rounded-xl border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
                sideOffset={8}
                alignOffset={-8}
                collisionPadding={12}
              >
                <FilterOptionList
                  options={priorities}
                  selectedIds={localSelectedPriorities}
                  onToggle={handlePriorityChange}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <ToggleRow
            active={localShowSpeakers}
            onClick={() => setLocalShowSpeakers(!localShowSpeakers)}
            icon={Mic}
            label="Speakers"
          />

          <ToggleRow
            active={localShowCompetitors}
            onClick={() => setLocalShowCompetitors(!localShowCompetitors)}
            icon={Tags}
            label="Competitors"
            variant="competitor"
          />

          <div className="mt-2">
            <FilterActions onApply={handleApply} onClear={handleClear} />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
