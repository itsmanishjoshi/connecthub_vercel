import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { shellBackgroundClass } from '@/lib/themeUtils';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { ChevronLeft, ChevronRight, Filter, Star, Clock, CheckCircle2, Handshake, Zap, Eye, StickyNote, Plus, Edit, Upload, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AttendeeCard } from '@/components/AttendeeCard';
import { AttendeeModal } from '@/components/AttendeeModal';
import { AttendeeManageModal } from '@/components/AttendeeManageModal';
import { PeopleIngestPanel } from '@/components/PeopleIngestPanel';
import { ViewAllNotesModal } from '@/components/ViewAllNotesModal';
import { ImprovedNoteModal } from '@/components/ImprovedNoteModal';
import { Attendee, StatusColor, StageValue, STAGE_OPTIONS } from '@/types/attendee';
import * as attendeeDataService from '@/services/attendeeDataService';
import { getSector } from '@/utils/sectors';
import { exportMarkedConnections } from '@/utils/export';
import { toast } from 'sonner';
import { fetchEventBySlugWithSource, fetchAttendeesByEventWithSource, readCachedAttendees, readCachedEventBySlug, verifyEventPin, type Event as SupabaseEvent, type Attendee as SupabaseAttendee } from '@/lib/eventsApi';
import { attendeeCity, attendeeIndustry, attendeePriority, parseAttendeeExtra } from '@/lib/attendeeDisplay';
import { canEditAttendeeCards, canManageEventAccess } from '@/lib/eventAccess';
import { splitIceBreakers, splitTalkingPoints } from '@/lib/profileNotes';
import { unlockUi } from '@/lib/unlockUi';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EventAccessPanel } from '@/components/EventAccessPanel';
import { PinVerificationDialog } from '@/components/PinVerificationDialog';
import { useAuth } from '@/context/SimpleAuthContext';
import { listConversations, listInsights, summarizeEventIntelligence } from '@/services/conversationService';

const EventPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shellBg = shellBackgroundClass();
  const [searchParams] = useSearchParams();
  const { slug: pathSlug } = useParams();
  const eventSlug = searchParams.get('event') || (pathSlug && pathSlug !== 'hub' ? pathSlug : null);
  const highlightId = searchParams.get('highlight');

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [event, setEvent] = useState<SupabaseEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const [selectedStatuses, setSelectedStatuses] = useState<StatusColor[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [showSpeakers, setShowSpeakers] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [noteModalAttendee, setNoteModalAttendee] = useState<Attendee | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');
  const [viewAllNotesAttendee, setViewAllNotesAttendee] = useState<Attendee | null>(null);
  const [quickFilterMode, setQuickFilterMode] = useState<'all' | 'connections' | 'notes'>('all');
  const [ingestOpen, setIngestOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageModalMode, setManageModalMode] = useState<'add' | 'edit'>('add');
  const [manageModalAttendee, setManageModalAttendee] = useState<SupabaseAttendee | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [lockedEvent, setLockedEvent] = useState<SupabaseEvent | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [accessNonce, setAccessNonce] = useState(0);

  const { profile, userId, isAdmin } = useAuth();

  const [storageVersion, setStorageVersion] = useState(0);
  const [statusCache, setStatusCache] = useState<Map<string, StatusColor[]>>(new Map());
  const [eventIntel, setEventIntel] = useState({ conversations: 0, followUps: 0, painPoints: 0, opportunities: 0 });

  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  const attendeesPerPage = 40;
  const mobileAttendeesPerPage = 20;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mapAttendee = (sa: SupabaseAttendee): Attendee => ({
    id: sa.id,
    name: sa.name || '',
    designation: sa.designation || '',
    company: sa.company || '',
    location: attendeeCity(sa),
    stage: 'Growth' as StageValue,
    sector: attendeeIndustry(sa) || 'Technology',
    priority: attendeePriority(sa) || undefined,
    photo: sa.profile_pic_url || '',
    linkedin: sa.linkedin_url || '',
    keyPoints: splitTalkingPoints(sa.key_insights),
    iceBreakers: splitIceBreakers(sa.ice_breakers),
    website: sa.website_url || '',
    extra: parseAttendeeExtra(sa.extra_data),
    speaker: sa.speaker || false,
    competitor: sa.competitor || false,
  });

  const getAttendeesPerPage = () => {
    if (showAll) return 999999;
    return viewportWidth < 640 ? mobileAttendeesPerPage : attendeesPerPage;
  };

  const currentAttendeesPerPage = getAttendeesPerPage();
  const prevAttendeesPerPageRef = useRef(currentAttendeesPerPage);

  useEffect(() => {
    unlockUi();
    if (event) {
      document.title = `${event.name} - ConnectHub`;
    }
  }, [event]);

  useEffect(() => {
    const loadData = async () => {
      if (!eventSlug) {
        setEvent(null);
        setAttendees([]);
        setError('No event was selected. Open an event from the Events window.');
        setLockedEvent(null);
        setLoading(false);
        return;
      }

      try {
        setError(null);

        const cachedEvent = await readCachedEventBySlug(eventSlug);
        if (cachedEvent?.data) {
          setEvent(cachedEvent.data);
          const cachedAttendees = await readCachedAttendees(cachedEvent.data.id);
          if (cachedAttendees?.data) {
            setAttendees(cachedAttendees.data.map((sa) => mapAttendee(sa)));
          }
          setLoading(false);
        } else {
          setLoading(true);
        }

        const eventResult = await fetchEventBySlugWithSource(eventSlug);
        const eventData = eventResult.data;
        if (eventResult.locked) {
          setLockedEvent(eventResult.locked);
          setEvent(null);
          setAttendees([]);
          setError(null);
          setLoading(false);
          return;
        }
        setLockedEvent(null);
        
        if (!eventData) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        setEvent(eventData);

        const attendeeResult = await fetchAttendeesByEventWithSource(eventData.id);
        const supabaseAttendees = attendeeResult.data;
        const cacheTimes = [eventResult.cachedAt, attendeeResult.cachedAt].filter(
          (value): value is number => typeof value === 'number',
        );
        setCachedAt(cacheTimes.length ? Math.min(...cacheTimes) : null);

        // Convert Supabase attendees to app Attendee format
        const parsedAttendees: Attendee[] = supabaseAttendees.map((sa) => mapAttendee(sa));

        setAttendees(parsedAttendees);
      } catch (err) {
        console.error(`Error loading event data:`, err);
        setError('Failed to load event data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventSlug, accessNonce]);

  useEffect(() => {
    const bumpStorage = () => setStorageVersion((value) => value + 1);
    window.addEventListener('connecthub:local-save', bumpStorage);
    return () => window.removeEventListener('connecthub:local-save', bumpStorage);
  }, []);

  // PostgreSQL is authoritative; localStorage is only an offline cache.
  useEffect(() => {
    let cancelled = false;
    const loadStatuses = async () => {
      if (!attendees.length) {
        if (!cancelled) setStatusCache(new Map());
        return;
      }
      const map = await attendeeDataService.getStatusesMap(attendees.map((attendee) => attendee.id));
      if (!cancelled) setStatusCache(map);
    };
    void loadStatuses();
    return () => {
      cancelled = true;
    };
  }, [attendees, storageVersion]);

  useEffect(() => {
    if (!event?.id) {
      setEventIntel({ conversations: 0, followUps: 0, painPoints: 0, opportunities: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await listConversations().catch(() => []);
      const mine = rows.filter((item) => item.event_id === event.id);
      const insightRows = (await Promise.all(mine.slice(0, 40).map((item) => listInsights(item.id).catch(() => [])))).flat();
      if (!cancelled) setEventIntel(summarizeEventIntelligence(mine, insightRows));
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.id, storageVersion]);

  const { sectors, locations } = useMemo(() => {
    const locationSet = new Set<string>();
    const sectorSet = new Set<string>();

    attendees.forEach((attendee) => {
      if (attendee.location) locationSet.add(attendee.location);
      if (attendee.sector) sectorSet.add(attendee.sector);
    });

    return {
      locations: Array.from(locationSet).sort(),
      sectors: Array.from(sectorSet).sort()
    };
  }, [attendees]);

  const statusOptions = useMemo(() => {
    const stats = attendees.reduce(
      (acc, attendee) => {
        const statuses = statusCache.get(attendee.id) || [];
        statuses.forEach(status => {
          acc[status] = (acc[status] || 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>
    );

    return [
      { value: 'high_priority' as StatusColor, label: 'High Priority', icon: Star, count: stats.high_priority || 0 },
      { value: 'meeting_required' as StatusColor, label: 'Meeting Required', icon: Clock, count: stats.meeting_required || 0 },
      { value: 'follow_up_needed' as StatusColor, label: 'Follow-up Needed', icon: CheckCircle2, count: stats.follow_up_needed || 0 },
      { value: 'strong_connect' as StatusColor, label: 'Strong Connect', icon: Handshake, count: stats.strong_connect || 0 },
      { value: 'deal_potential' as StatusColor, label: 'Deal Potential', icon: Zap, count: stats.deal_potential || 0 },
      { value: 'watchlist' as StatusColor, label: 'Watchlist', icon: Eye, count: stats.watchlist || 0 },
    ];
  }, [attendees, statusCache]);

  const filteredAttendees = useMemo(() => {
    let filtered = attendees;

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((attendee) => {
        const attendeeStatuses = statusCache.get(attendee.id) || [];
        return selectedStatuses.some(s => attendeeStatuses.includes(s));
      });
    }

    // Apply location filter
    if (selectedLocations.length > 0) {
      const wanted = new Set(selectedLocations.map((item) => item.trim().toLowerCase()));
      filtered = filtered.filter((attendee) =>
        attendee.location && wanted.has(attendee.location.trim().toLowerCase())
      );
    }
    
    // Apply sector filter
    if (selectedIndustries.length > 0) {
      const wanted = new Set(selectedIndustries.map((item) => item.trim().toLowerCase()));
      filtered = filtered.filter((attendee) =>
        attendee.sector && wanted.has(attendee.sector.trim().toLowerCase())
      );
    }

    // Apply priority filter (P1–P4 from Excel)
    if (selectedPriorities.length > 0) {
      const wanted = new Set(selectedPriorities.map((item) => item.trim().toUpperCase()));
      filtered = filtered.filter((attendee) => attendee.priority && wanted.has(attendee.priority.toUpperCase()));
    }

    // Apply speaker/competitor filter (OR logic - show if either is true)
    if (showSpeakers || showCompetitors) {
      filtered = filtered.filter((attendee) => {
        if (showSpeakers && showCompetitors) {
          // Both filters active: show if attendee is speaker OR competitor (or both)
          return attendee.speaker === true || attendee.competitor === true;
        } else if (showSpeakers) {
          // Only speaker filter active
          return attendee.speaker === true;
        } else {
          // Only competitor filter active
          return attendee.competitor === true;
        }
      });
    }

    if (quickFilterMode === 'connections') {
      filtered = filtered.filter((attendee) => {
        const statuses = statusCache.get(attendee.id) || [];
        return statuses.includes('strong_connect');
      });
    }

    // Sort by name ascending with proper locale comparison
    return filtered.sort((a, b) => {
      const nameA = a.name.trim().toLowerCase();
      const nameB = b.name.trim().toLowerCase();
      return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
    });
  }, [
    attendees,
    selectedStatuses,
    selectedIndustries,
    selectedLocations,
    selectedPriorities,
    showSpeakers,
    showCompetitors,
    quickFilterMode,
    statusCache,
  ]);

  const activeFilterCount = useMemo(() => {
    return (
      (selectedStatuses.length > 0 ? 1 : 0) +
      (selectedLocations.length > 0 ? 1 : 0) +
      (selectedIndustries.length > 0 ? 1 : 0) +
      (selectedPriorities.length > 0 ? 1 : 0) +
      (showSpeakers ? 1 : 0) +
      (showCompetitors ? 1 : 0)
    );
  }, [selectedStatuses, selectedLocations, selectedIndustries, selectedPriorities, showSpeakers, showCompetitors]);

  const totalPages = Math.ceil(filteredAttendees.length / currentAttendeesPerPage);
  const startIndex = (currentPage - 1) * currentAttendeesPerPage;
  const endIndex = startIndex + currentAttendeesPerPage;
  const currentAttendees = filteredAttendees.slice(startIndex, endIndex);

  // Smooth scroll to top when page changes
  useEffect(() => {
    if (currentPage > 1) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentPage]);

  // Helper function to reload event data
  const loadEventData = async () => {
    if (!event) return;
    
    try {
      const supabaseAttendees = await fetchAttendeesByEvent(event.id);
      const parsedAttendees: Attendee[] = supabaseAttendees.map((sa) => mapAttendee(sa));
      setAttendees(parsedAttendees);
    } catch (err) {
      console.error('Error reloading attendees:', err);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedStatuses,
    selectedLocations,
    selectedIndustries,
    quickFilterMode,
  ]);

  useEffect(() => {
    if (!highlightId || loading || attendees.length === 0) return;

    const target = attendees.find((attendee) => attendee.id === highlightId);
    if (!target) return;

    const sorted = [...attendees].sort((a, b) =>
      a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase(), 'en', { sensitivity: 'base' }),
    );
    const index = sorted.findIndex((attendee) => attendee.id === highlightId);
    if (index >= 0) {
      const perPage = getAttendeesPerPage();
      setCurrentPage(Math.floor(index / perPage) + 1);
    }

    const timer = window.setTimeout(() => {
      unlockUi();
      setSelectedAttendee(target);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      const search = next.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [highlightId, loading, attendees, searchParams, navigate, location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      const newAttendeesPerPage = getAttendeesPerPage();
      if (newAttendeesPerPage !== prevAttendeesPerPageRef.current) {
        prevAttendeesPerPageRef.current = newAttendeesPerPage;
        setCurrentPage(1);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleClearFilters = () => {
    setSelectedStatuses([]);
    setSelectedIndustries([]);
    setSelectedLocations([]);
    setSelectedPriorities([]);
    setShowSpeakers(false);
    setShowCompetitors(false);
    setQuickFilterMode('all');
  };
  
  const handleShowAll = () => {
    setSelectedStatuses([]);
    setQuickFilterMode('all');
  };

  const handleExport = () => {
    const safePrefix = event?.name.replace(/\s+/g, '_') || 'Event';
    void exportMarkedConnections(attendees, `${safePrefix}_my-notes`, event?.id)
      .then(() => toast.success('Exported your private notes for this event'))
      .catch(() => toast.error('Could not export notes'));
  };

  const followUpCount = useMemo(
    () => attendees.filter((attendee) => (statusCache.get(attendee.id) || []).includes('follow_up_needed')).length,
    [attendees, statusCache],
  );
  const canEditCards = canEditAttendeeCards(event, userId, isAdmin);
  const canManageAccess = canManageEventAccess(event, userId, isAdmin);
  const canBulkImport = isAdmin;

  if (loading) {
    return (
      <div className={`min-h-screen ${shellBg}`}>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="h-8 bg-white dark:bg-slate-900 rounded-lg shadow-sm w-48 mb-2"></div>
            <div className="h-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm w-64"></div>
          </div>
          
          {/* Search Bar Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="h-10 bg-white dark:bg-slate-900 rounded-lg shadow-md w-full max-w-md"></div>
          </div>
          
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 space-y-3 shadow-lg border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (lockedEvent) {
    return (
      <div className={`min-h-screen ${shellBg} flex items-center justify-center p-4`}>
        <div className="text-center max-w-md rounded-2xl bg-white dark:bg-slate-900 px-8 py-10 shadow-xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invite only</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {lockedEvent.name} is private. Ask the organizer to invite your username, or enter a door code if you were given one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('/events')} variant="outline">Back to events</Button>
            <Button onClick={() => setPinDialogOpen(true)}>I have a door code</Button>
          </div>
        </div>
        <PinVerificationDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          eventName={lockedEvent.name}
          onVerify={async (pin) => {
            if (await verifyEventPin(lockedEvent.id, pin)) {
              setAccessNonce((value) => value + 1);
              return true;
            }
            return false;
          }}
        />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={`min-h-screen ${shellBg} flex items-center justify-center p-4`}>
        <div className="text-center max-w-md rounded-2xl bg-white dark:bg-slate-900 px-8 py-10 shadow-xl border-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">This event isn’t available</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error || 'Event not found'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => navigate('/events')} className="bg-brand-blue hover:bg-brand-blue-hover text-white shadow-md hover:shadow-lg transition-all border-0">
              Back to events
            </Button>
            {eventSlug ? (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${shellBg}`}>
      <Header
        title={event.name}
        backTo="/events"
        onExport={handleExport}
        statusOptions={statusOptions}
        activeStatuses={selectedStatuses}
        onStatusesChange={setSelectedStatuses}
        industries={sectors.map(sector => ({
          id: sector.toLowerCase(),
          label: sector,
          count: attendees.filter(a => (a.sector ?? getSector(a.id)) === sector).length
        }))}
        locations={locations.map(location => ({
          id: location.toLowerCase(),
          label: location,
          count: attendees.filter(a => a.location === location).length
        }))}
        priorities={['P1', 'P2', 'P3', 'P4'].map((priority) => ({
          id: priority.toLowerCase(),
          label: priority,
          count: attendees.filter((a) => a.priority?.toUpperCase() === priority).length,
        }))}
        selectedIndustries={selectedIndustries}
        selectedLocations={selectedLocations}
        selectedPriorities={selectedPriorities}
        showSpeakers={showSpeakers}
        showCompetitors={showCompetitors}
        onFilterApply={(industries, locations, priorities, speakers, competitors) => {
          setSelectedIndustries(industries);
          setSelectedLocations(locations);
          setSelectedPriorities(priorities);
          setShowSpeakers(speakers);
          setShowCompetitors(competitors);
        }}
      />

      <main className="app-page mx-auto w-full max-w-screen-2xl px-3 pt-3 sm:px-6 sm:pt-5 lg:px-8">
        {cachedAt && (
          <div
            role="status"
            className="mx-auto mt-4 w-full max-w-screen-2xl rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            Offline roster from {new Date(cachedAt).toLocaleString()}. You can still add notes and priority flags — they save on this device and sync when connection returns.
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
          <div className="min-w-0 shrink">
            <p className="truncate text-xs font-medium text-slate-900 dark:text-white sm:text-sm">
              {filteredAttendees.length} result{filteredAttendees.length !== 1 ? 's' : ''}
            </p>
            {(eventIntel.conversations > 0 || followUpCount > 0) && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {eventIntel.conversations} conversation{eventIntel.conversations === 1 ? '' : 's'}
                {eventIntel.painPoints ? ` · ${eventIntel.painPoints} pain points` : ''}
                {eventIntel.opportunities ? ` · ${eventIntel.opportunities} opportunities` : ''}
                {followUpCount ? ` · ${followUpCount} need follow-up` : ''}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            {followUpCount > 0 && (
              <Button
                size="sm"
                variant={selectedStatuses.length === 1 && selectedStatuses[0] === 'follow_up_needed' ? 'default' : 'outline'}
                className="h-8 shrink-0 px-2 text-xs sm:h-9 sm:px-3"
                onClick={() => setSelectedStatuses(selectedStatuses[0] === 'follow_up_needed' && selectedStatuses.length === 1 ? [] : ['follow_up_needed'])}
              >
                <span className="hidden min-[400px]:inline">Follow-up </span>({followUpCount})
              </Button>
            )}
          {canManageAccess && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAccessOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center p-0 text-xs sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Access</span>
            </Button>
          )}
          {canBulkImport && (
            <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIngestOpen((open) => !open)}
              className="flex h-8 w-8 shrink-0 items-center justify-center p-0 text-xs sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            </>
          )}
          {canEditCards && (
            <Button
              size="sm"
              onClick={() => {
                setManageModalMode('add');
                setManageModalAttendee(null);
                setManageModalOpen(true);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center p-0 text-xs sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-sm"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          )}
          </div>
        </div>

        {event && canBulkImport && ingestOpen && (
          <div className="mb-4 w-full">
            <PeopleIngestPanel eventId={event.id} onSaved={() => { setIngestOpen(false); void loadEventData(); }} />
          </div>
        )}

        {filteredAttendees.length === 0 && attendees.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <StickyNote className="w-8 h-8 text-slate-400 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">Bring the room in</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Import a roster, add a person, then let Jelly brief you before you walk over.
              </p>
              {canEditCards || canBulkImport ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {canBulkImport ? (
                    <Button onClick={() => setIngestOpen(true)} className="bg-brand-blue hover:bg-brand-blue-hover text-white shadow-md hover:shadow-lg transition-all border-0">
                      <Upload className="w-4 h-4 mr-2" />
                      Import people
                    </Button>
                  ) : null}
                  {canEditCards ? (
                    <Button variant="outline" onClick={() => {
                      setManageModalMode('add');
                      setManageModalAttendee(null);
                      setManageModalOpen(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add person
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Ask an organiser to import the attendee list.</p>
              )}
            </div>
          </div>
        ) : filteredAttendees.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base lg:text-lg mb-4">
              No attendees match your current filters.
            </p>
            <Button variant="outline" onClick={handleClearFilters} className="border-0 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all">
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="grid w-full auto-rows-fr grid-cols-2 items-stretch gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {currentAttendees.map((attendee, index) => (
                <div
                  key={`${attendee.id}-${currentPage}`}
                  className="flex h-full min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-300"
                  style={{ 
                    animationDelay: `${Math.min(index * 30, 600)}ms`,
                    animationFillMode: 'backwards'
                  }}
                >
                  <AttendeeCard
                    attendee={attendee}
                    statuses={statusCache.get(attendee.id) || []}
                    onViewDetails={() => {
                      unlockUi();
                      setSelectedAttendee(attendee);
                    }}
                    onAddNote={() => setNoteModalAttendee(attendee)}
                    onStatusChange={(attendeeId, statuses) => {
                      setStatusCache((prev) => new Map(prev).set(attendeeId, statuses));
                    }}
                    canEdit={canEditCards}
                    canMarkRoles={isAdmin}
                    onEdit={() => {
                      // Find the Supabase attendee data
                      const supabaseAttendee = attendees.find(a => a.id === attendee.id) as any;
                      setManageModalMode('edit');
                      setManageModalAttendee(supabaseAttendee);
                      setManageModalOpen(true);
                    }}
                    storageVersion={storageVersion}
                  />
                </div>
              ))}
            </div>

            {!showAll && totalPages > 1 && (
              <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-lg border-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 text-center sm:text-left">
                    Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">{Math.min(endIndex, filteredAttendees.length)}</span> of{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">{filteredAttendees.length}</span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAll(true);
                      setCurrentPage(1);
                    }}
                    className="text-xs hover:bg-brand-blue/10 text-brand-blue transition-all duration-200 hover:scale-105 border-0"
                  >
                    Show All
                  </Button>
                </div>
                
                {/* Pagination controls */}
                <div className="window-tab-scroll flex w-full items-center justify-center gap-2 sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[2.75rem] h-10 sm:h-9 hover:bg-brand-blue/10 border-0 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 touch-manipulation"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* Page numbers */}
                  <div className="flex max-w-[min(100%,14rem)] items-center gap-1 overflow-x-auto sm:max-w-none">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = 
                        page === 1 ||
                        page === totalPages ||
                        page === currentPage ||
                        page === currentPage - 1 ||
                        page === currentPage + 1;
                      
                      // Show ellipsis
                      const showEllipsisBefore = page === 2 && currentPage > 3;
                      const showEllipsisAfter = page === totalPages - 1 && currentPage < totalPages - 2;
                      
                      if (showEllipsisBefore || showEllipsisAfter) {
                        return (
                          <span key={`ellipsis-${page}`} className="px-1 text-slate-500 dark:text-slate-400 font-semibold text-sm">
                            ...
                          </span>
                        );
                      }
                      
                      if (!showPage) {
                        return null;
                      }

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[2.5rem] h-10 sm:h-9 transition-all duration-200 hover:scale-105 border-0 shadow-sm hover:shadow-md touch-manipulation ${
                            currentPage === page 
                              ? 'bg-brand-blue hover:bg-brand-blue-hover text-white' 
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[2.75rem] h-10 sm:h-9 hover:bg-brand-blue/10 border-0 bg-slate-100 dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 touch-manipulation"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Page indicator for mobile */}
                <div className="sm:hidden text-xs text-slate-700 dark:text-slate-300">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            )}
            
            {showAll && filteredAttendees.length > 40 && (
              <div className="mt-8 sm:mt-12 flex items-center justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowAll(false);
                    setCurrentPage(1);
                  }}
                  className="shadow-md hover:shadow-lg transition-shadow border-0 bg-white dark:bg-slate-900"
                >
                  Show Pagination
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {selectedAttendee && (
        <ErrorBoundary level="component">
        <AttendeeModal
          open={!!selectedAttendee}
          onOpenChange={(next) => {
            if (!next) {
              unlockUi();
              setSelectedAttendee(null);
            }
          }}
          attendee={selectedAttendee}
          eventId={event?.id}
          eventName={event?.name}
          canEdit={canEditCards}
          onAddNote={() => {
            setNoteModalAttendee(selectedAttendee);
          }}
          onChangeStatus={() => {}}
          onEditNote={(noteId, initialText) => {
            // Set editing state and open note modal
            setEditingNoteId(noteId);
            setEditingNoteText(initialText);
            setNoteModalAttendee(selectedAttendee);
          }}
          onDeleteNote={async (noteId) => {
            console.log('Deleting note from AttendeeModal:', noteId);
            try {
              await attendeeDataService.deleteNote(noteId);
              console.log('Note deleted successfully');
              setStorageVersion((v) => v + 1);
              setSelectedAttendee({ ...selectedAttendee });
            } catch (error) {
              console.error('Error deleting note:', error);
              toast.error('Could not delete that note.');
            }
          }}
          onViewAllNotes={() => {
            setViewAllNotesAttendee(selectedAttendee);
          }}
        />
        </ErrorBoundary>
      )}

      {noteModalAttendee && (
        <ImprovedNoteModal
          open={!!noteModalAttendee}
          onOpenChange={(open) => !open && setNoteModalAttendee(null)}
          attendeeId={noteModalAttendee.id}
          attendeeName={noteModalAttendee.name}
          editingNoteId={editingNoteId}
          editingNoteText={editingNoteText}
          onSave={() => setStorageVersion((v) => v + 1)}
        />
      )}

      {viewAllNotesAttendee && (
        <ViewAllNotesModal
          open={!!viewAllNotesAttendee}
          onOpenChange={(open) => !open && setViewAllNotesAttendee(null)}
          notes={[]} // Will be loaded by the modal itself
          attendeeId={viewAllNotesAttendee.id}
          attendeeName={viewAllNotesAttendee.name}
          onEditNote={(noteId, initialText) => {
            // For now, just open note modal with the existing text
            // TODO: Implement proper edit functionality
            setNoteModalAttendee(viewAllNotesAttendee);
            setViewAllNotesAttendee(null);
          }}
          onDeleteNote={async (noteId) => {
            console.log('Deleting note from ViewAllNotesModal:', noteId);
            try {
              await attendeeDataService.deleteNote(noteId);
              console.log('Note deleted successfully');
              setStorageVersion((v) => v + 1);
              // Force refresh of the modal's notes
              setViewAllNotesAttendee({ ...viewAllNotesAttendee });
            } catch (error) {
              console.error('Error deleting note:', error);
              toast.error('Could not delete that note.');
            }
          }}
        />
      )}

      {/* Attendee Management Modal */}
      {event && (
        <AttendeeManageModal
          open={manageModalOpen}
          onOpenChange={setManageModalOpen}
          eventId={event.id}
          attendee={manageModalAttendee}
          mode={manageModalMode}
          onSuccess={() => {
            // Reload attendees after add/edit/delete
            loadEventData();
            setStorageVersion((v) => v + 1);
          }}
        />
      )}

      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Event access</DialogTitle>
            <DialogDescription>
              Choose active users and grant View or Edit. Card changes (names, photos, details) are visible to everyone on the event. Notes, recordings, and conversations stay private to each person.
            </DialogDescription>
          </DialogHeader>
          {event && <EventAccessPanel eventId={event.id} isPrivate={event.is_private} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventPage;
















