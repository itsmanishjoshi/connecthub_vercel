import { Attendee, StatusColor, STATUS_OPTIONS } from '@/types/attendee';
import { Building2, MapPin, Briefcase, MessageSquare, Eye, MoreVertical, Tags, Mic, Star, Clock, CheckCircle2, Handshake, Zap, Check, User, Edit, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as attendeeDataService from '@/services/attendeeDataService';
import { getSector } from '@/utils/sectors';
import { getAvatarUrl, isPhotoUrlBlocked } from '@/utils/avatarHelper';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { useEffect, useState, memo, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AttendeeCardProps {
  attendee: Attendee;
  onViewDetails: () => void;
  onAddNote: () => void;
  onStatusChange?: (attendeeId: string, statuses: StatusColor[]) => void;
  onEdit?: () => void;
  canEdit?: boolean;
  /** Only administrators may mark speaker / competitor roles. */
  canMarkRoles?: boolean;
  statuses?: StatusColor[];
  storageVersion?: number; // Add this to trigger note refresh
}

const STATUS_ICONS: Record<StatusColor, typeof Star> = {
  high_priority: Star,
  meeting_required: Clock,
  follow_up_needed: CheckCircle2,
  strong_connect: Handshake,
  deal_potential: Zap,
  watchlist: Eye,
  grey: User,
};

const STATUS_MARK_CLASS: Record<StatusColor, string> = {
  high_priority: 'text-amber-500/80',
  meeting_required: 'text-sky-500/75',
  follow_up_needed: 'text-emerald-500/75',
  strong_connect: 'text-violet-500/75',
  deal_potential: 'text-orange-500/75',
  watchlist: 'text-slate-400',
  grey: 'text-slate-400',
};

const STATUS_ORDER: StatusColor[] = [
  'high_priority',
  'meeting_required',
  'follow_up_needed',
  'strong_connect',
  'deal_potential',
  'watchlist'
];

const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-teal-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

function CardDetailRow({
  icon: Icon,
  children,
  tone = 'default',
}: {
  icon: typeof Building2;
  children: ReactNode;
  tone?: 'default' | 'muted';
}) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  return (
    <div className="flex min-h-4 items-center gap-1 sm:min-h-5 sm:gap-1.5">
      <Icon
        className={`h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 ${
          tone === 'muted'
            ? 'text-slate-500 dark:text-slate-400'
            : 'text-slate-500 transition-colors group-hover:text-indigo-500 dark:text-slate-400'
        }`}
      />
      <span
        title={text}
        className={`min-w-0 flex-1 truncate text-[10px] leading-4 sm:text-xs sm:leading-5 ${
          tone === 'muted' ? 'text-slate-500 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-100'
        }`}
      >
        {children}
      </span>
    </div>
  );
}

const AttendeeCardComponent = ({
  attendee,
  onViewDetails,
  onAddNote: _onAddNote,
  onStatusChange,
  onEdit,
  canEdit = false,
  canMarkRoles = false,
  statuses,
  storageVersion,
}: AttendeeCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [currentStatuses, setCurrentStatuses] = useState<StatusColor[]>(statuses ?? []);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(attendee.speaker);
  const [isCompetitor, setIsCompetitor] = useState(attendee.competitor);
  const sector = attendee.sector ?? getSector(attendee.id);
  
  // Get avatar URL with proxy for blocked URLs (returns null if no photo)
  const avatarSource = getAvatarUrl(attendee.name, attendee.photo, attendee.id);
  const avatarUrl = useAuthenticatedImage(avatarSource);

  useEffect(() => {
    setPhotoLoadError(false);
  }, [attendee.photo]);

  useEffect(() => {
    setIsSpeaker(attendee.speaker);
    setIsCompetitor(attendee.competitor);
  }, [attendee.speaker, attendee.competitor]);

  useEffect(() => {
    if (statuses) {
      setCurrentStatuses(statuses.filter((status) => status in STATUS_OPTIONS));
      return;
    }
    let cancelled = false;
    attendeeDataService.getStatuses(attendee.id).then((loaded) => {
      if (!cancelled) setCurrentStatuses(loaded.filter((status) => status in STATUS_OPTIONS));
    });
    return () => {
      cancelled = true;
    };
  }, [attendee.id, statuses, storageVersion]);

  useEffect(() => {
    const onLocalSave = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === 'status') {
        attendeeDataService.getStatuses(attendee.id).then((loaded) => {
          setCurrentStatuses(loaded.filter((status) => status in STATUS_OPTIONS));
        });
      }
    };
    window.addEventListener('connecthub:local-save', onLocalSave);
    return () => window.removeEventListener('connecthub:local-save', onLocalSave);
  }, [attendee.id]);

  const toggleStatus = async (status: StatusColor) => {
    const nextStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    
    await attendeeDataService.saveStatuses(attendee.id, nextStatuses);
    setCurrentStatuses(nextStatuses);
    if (onStatusChange) onStatusChange(attendee.id, nextStatuses);
  };

  return (
    <Card
      className="relative flex h-full w-full cursor-pointer flex-col rounded-lg bg-card p-2.5 shadow-md transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-lg touch-manipulation sm:rounded-2xl sm:p-3.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onViewDetails}
      style={{
        boxShadow: isHovered
          ? '0 10px 25px -5px rgba(59, 130, 246, 0.15), 0 4px 15px -3px rgba(0, 0, 0, 0.1)'
          : '0 4px 15px -3px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Three-dot dropdown menu */}
      <div className="absolute top-1 right-1 z-10 sm:top-2 sm:right-2">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 touch-manipulation p-0 sm:h-8 sm:w-8 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[200px] sm:w-[220px] bg-popover border-border p-1.5 rounded-xl shadow-2xl"
          >
            {STATUS_ORDER.map((status) => {
              const Icon = STATUS_ICONS[status];
              const isSelected = currentStatuses.includes(status);
              return (
                <DropdownMenuItem
                  key={status}
                  className={`group flex items-center justify-between px-3 py-2.5 my-0.5 rounded-lg cursor-pointer transition-colors outline-none focus:bg-muted ${
                    isSelected
                      ? 'bg-primary/15 text-foreground'
                      : 'text-foreground hover:bg-muted'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus(status);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isSelected ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="text-xs font-semibold">{STATUS_OPTIONS[status].label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />}
                </DropdownMenuItem>
              );
            })}
            
            <DropdownMenuSeparator className="my-1.5" />
            
            {canMarkRoles && (
              <>
            {/* Mark as Speaker */}
            <DropdownMenuItem
              className={`group flex items-center justify-between px-3 py-2.5 my-0.5 rounded-lg cursor-pointer transition-colors outline-none focus:bg-muted ${
                isSpeaker
                  ? 'bg-blue-500/15 text-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              onClick={async (e) => {
                e.stopPropagation();
                const newValue = !isSpeaker;
                setIsSpeaker(newValue);
                try {
                  await attendeeDataService.toggleSpeaker(attendee.id, newValue);
                  if (onStatusChange) onStatusChange(attendee.id, currentStatuses);
                } catch (error) {
                  console.error('Failed to toggle speaker:', error);
                  setIsSpeaker(!newValue); // Revert on error
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Mic
                  className={`w-4 h-4 transition-colors ${
                    isSpeaker ? 'text-blue-600' : 'text-muted-foreground'
                  }`}
                />
                <span className="text-xs font-semibold">Mark as Speaker</span>
              </div>
              {isSpeaker && <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={3} />}
            </DropdownMenuItem>
            
            {/* Mark as Competitor */}
            <DropdownMenuItem
              className={`group flex items-center justify-between px-3 py-2.5 my-0.5 rounded-lg cursor-pointer transition-colors outline-none focus:bg-muted ${
                isCompetitor
                  ? 'text-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              style={isCompetitor ? { backgroundColor: 'rgba(235, 75, 85, 0.15)' } : {}}
              onClick={async (e) => {
                e.stopPropagation();
                const newValue = !isCompetitor;
                setIsCompetitor(newValue);
                try {
                  await attendeeDataService.toggleCompetitor(attendee.id, newValue);
                  if (onStatusChange) onStatusChange(attendee.id, currentStatuses);
                } catch (error) {
                  console.error('Failed to toggle competitor:', error);
                  setIsCompetitor(!newValue); // Revert on error
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Trophy
                  className={`w-4 h-4 transition-colors ${
                    isCompetitor ? '' : 'text-muted-foreground'
                  }`}
                  style={isCompetitor ? { color: '#eb4b55' } : {}}
                  strokeWidth={2}
                />
                <span className="text-xs font-semibold">Mark as Competitor</span>
              </div>
              {isCompetitor && <Check className="w-3.5 h-3.5" style={{ color: '#eb4b55' }} strokeWidth={3} />}
            </DropdownMenuItem>
              </>
            )}
            
            {/* Edit Option - Only show if canEdit is true */}
            {canEdit && onEdit && (
              <>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground hover:bg-muted outline-none focus:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Edit className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Edit Attendee</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Profile Section */}
      <div className="mb-1.5 flex w-full items-start gap-2 sm:mb-2 sm:items-center sm:gap-3">
        <div className="relative shrink-0">
          <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-border transition-all duration-300 sm:h-11 sm:w-11 md:h-12 md:w-12 lg:h-14 lg:w-14">
            {avatarUrl && !photoLoadError ? (
              <img
                src={avatarUrl}
                alt={`${attendee.name} profile picture`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  setPhotoLoadError(true);
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-700 dark:bg-slate-600 group-hover:bg-blue-500 dark:group-hover:bg-blue-600 flex items-center justify-center transition-colors duration-300">
                <User className="text-slate-300 dark:text-slate-400 group-hover:text-white w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 transition-colors duration-300" />
              </div>
            )}
          </div>
          
          {/* Badge for Speaker, Competitor, or Both */}
          {isSpeaker && isCompetitor ? (
            // Both Speaker and Competitor - Purple badge with lightning bolt
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full text-white flex items-center justify-center border-2 border-background shadow-md"
              style={{ backgroundColor: '#9333ea' }}
              title="Speaker & Competitor"
            >
              <Zap className="w-2.5 h-2.5 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 fill-white" />
            </div>
          ) : isSpeaker ? (
            // Speaker only - Blue Mic badge
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full text-white flex items-center justify-center border-2 border-background shadow-md"
              style={{ backgroundColor: '#2563eb' }}
              title="Speaker"
            >
              <Mic className="w-2.5 h-2.5 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" />
            </div>
          ) : isCompetitor ? (
            // Competitor only - Red Trophy badge (#eb4b55)
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full text-white flex items-center justify-center border-2 border-background shadow-md"
              style={{ backgroundColor: '#eb4b55' }}
              title="Competitor"
            >
              <Trophy className="w-2.5 h-2.5 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pr-6 sm:pr-7">
          <h3
            title={attendee.name}
            className="truncate text-[11px] font-bold leading-4 text-slate-900 dark:text-slate-100 sm:text-base sm:leading-6"
          >
            {attendee.name}
          </h3>
          <div className="mt-0.5 flex h-3.5 items-center gap-1" aria-label="Priority and marked statuses">
            {attendee.priority ? (
              <span className="inline-flex shrink-0 rounded border border-amber-300/70 bg-amber-50 px-1 py-0 text-[8px] font-bold uppercase leading-3 tracking-wide text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200 sm:text-[9px] sm:leading-3.5">
                {attendee.priority}
              </span>
            ) : null}
            {STATUS_ORDER.some((status) => currentStatuses.includes(status)) ? (
              STATUS_ORDER.filter((status) => currentStatuses.includes(status)).map((status) => {
                const Icon = STATUS_ICONS[status];
                return (
                  <span key={status} title={STATUS_OPTIONS[status].label} className={STATUS_MARK_CLASS[status]}>
                    <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                  </span>
                );
              })
            ) : !attendee.priority ? (
              <span className="h-3 w-3" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-0.5">
        <CardDetailRow icon={Building2}>{attendee.company || '—'}</CardDetailRow>
        <CardDetailRow icon={Briefcase} tone="muted">
          {attendee.designation || '—'}
        </CardDetailRow>
        <CardDetailRow icon={MapPin} tone="muted">
          {attendee.location || '—'}
        </CardDetailRow>
      </div>
    </Card>
  );
};


// Memoize component to prevent unnecessary re-renders
export const AttendeeCard = memo(AttendeeCardComponent);
