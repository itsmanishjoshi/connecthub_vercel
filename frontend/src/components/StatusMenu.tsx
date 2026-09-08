import { StatusColor, STATUS_OPTIONS } from '@/types/attendee';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface StatusMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatuses: StatusColor[];
  onStatusesChange: (statuses: StatusColor[]) => void;
  attendeeName: string;
}

const STATUS_COLORS: StatusColor[] = ['high_priority', 'meeting_required', 'follow_up_needed', 'strong_connect', 'deal_potential', 'watchlist'];

export const StatusMenu = ({
  open,
  onOpenChange,
  currentStatuses,
  onStatusesChange,
  attendeeName,
}: StatusMenuProps) => {
  const toggleStatus = (status: StatusColor) => {
    const nextStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    onStatusesChange(nextStatuses);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-popover border-border p-6 rounded-[2rem]">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-foreground">Change Status</DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">{attendeeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {STATUS_COLORS.map((status) => (
            <Button
              key={status}
              variant="ghost"
              className={`w-full justify-start h-auto py-4 px-5 rounded-2xl transition-all duration-200 border border-transparent ${
                currentStatuses.includes(status)
                  ? 'bg-primary/15 border-primary/25 text-foreground shadow-sm'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => toggleStatus(status)}
            >
              <div className="flex items-center gap-4 w-full">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                  status === 'high_priority' ? 'bg-red-500 shadow-red-500/20' :
                  status === 'meeting_required' ? 'bg-orange-500 shadow-orange-500/20' :
                  status === 'follow_up_needed' ? 'bg-yellow-500 shadow-yellow-500/20' :
                  status === 'strong_connect' ? 'bg-green-500 shadow-green-500/20' :
                  status === 'deal_potential' ? 'bg-blue-500 shadow-blue-500/20' :
                  'bg-purple-500 shadow-purple-500/20'
                }`} />
                <div className="flex-1 text-left">
                  <div className="font-bold text-[0.95rem] leading-tight mb-0.5">{STATUS_OPTIONS[status].label}</div>
                  <div className="text-[0.8rem] text-muted-foreground font-medium leading-relaxed">
                    {STATUS_OPTIONS[status].description}
                  </div>
                </div>
                {currentStatuses.includes(status) && (
                  <div className="flex-shrink-0 bg-primary/20 p-1 rounded-full">
                    <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                  </div>
                )}
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
