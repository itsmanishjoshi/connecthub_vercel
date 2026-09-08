import { Download, MessageSquare, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickActionsProps {
  onShowConnections?: () => void;
  onExport: () => void;
}

export const QuickActions = ({
  onExport,
}: QuickActionsProps) => {
  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-40 gap-2 flex flex-col items-end">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            className="rounded-full w-14 h-14 sm:w-16 sm:h-16 shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90 text-white border-0 flex-shrink-0"
            onClick={onExport}
            aria-label="Export connections"
          >
            <Download className="w-6 h-6 sm:w-7 sm:h-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Export</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

