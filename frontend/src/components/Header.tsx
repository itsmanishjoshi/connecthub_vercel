import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from '@/components/GlobalSearch';
import { FilterDropdown } from '@/components/FilterDropdown';
import { StatusDropdown } from '@/components/StatusDropdown';
import { StatusColor } from '@/types/attendee';
import { UserMenu } from '@/components/UserMenu';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow, AppRibbonTools } from '@/components/AppRibbon';

interface HeaderProps {
  title?: string;
  backTo?: string;
  statusOptions?: Array<{ value: StatusColor; label: string; icon: React.ComponentType<{ className?: string }>; count: number }>;
  activeStatuses?: StatusColor[];
  onStatusesChange?: (statuses: StatusColor[]) => void;
  industries?: Array<{ id: string; label: string; count: number }>;
  locations?: Array<{ id: string; label: string; count: number }>;
  priorities?: Array<{ id: string; label: string; count: number }>;
  selectedIndustries?: string[];
  selectedLocations?: string[];
  selectedPriorities?: string[];
  showSpeakers?: boolean;
  showCompetitors?: boolean;
  onFilterApply?: (
    industries: string[],
    locations: string[],
    priorities: string[],
    showSpeakers: boolean,
    showCompetitors: boolean,
  ) => void;
  onExport?: () => void;
}

export const Header = ({
  title = 'ConnectHub',
  backTo = '/events',
  statusOptions = [],
  activeStatuses = [],
  onStatusesChange,
  industries = [],
  locations = [],
  priorities = [],
  selectedIndustries = [],
  selectedLocations = [],
  selectedPriorities = [],
  showSpeakers = false,
  showCompetitors = false,
  onFilterApply,
  onExport,
}: HeaderProps) => {
  const navigate = useNavigate();
  const hasStatus = statusOptions.length > 0 && onStatusesChange;
  const hasFilter = Boolean(onFilterApply);

  return (
    <AppRibbonBar className="sticky top-0">
      <AppRibbonRow>
        <div className="min-w-0 flex-1 overflow-hidden">
          <AppRibbonBrand title={title} leading="back" onLeadingClick={() => navigate(backTo)} />
        </div>

        <AppRibbonTools className="shrink-0 gap-1 sm:gap-2">
          <GlobalSearch compactOnMobile />

          {hasStatus && (
            <StatusDropdown
              options={statusOptions}
              value={activeStatuses}
              onChange={onStatusesChange}
              placeholder="Status"
              className="h-9 w-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:min-w-[6.5rem] sm:px-3"
            />
          )}

          {hasFilter && (
            <FilterDropdown
              industries={industries}
              locations={locations}
              priorities={priorities}
              selectedIndustries={selectedIndustries}
              selectedLocations={selectedLocations}
              selectedPriorities={selectedPriorities}
              showSpeakers={showSpeakers}
              showCompetitors={showCompetitors}
              onApply={onFilterApply}
              className="h-9 w-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:min-w-[6rem] sm:px-3"
            />
          )}

          <UserMenu onExport={onExport} />
        </AppRibbonTools>
      </AppRibbonRow>
    </AppRibbonBar>
  );
};
