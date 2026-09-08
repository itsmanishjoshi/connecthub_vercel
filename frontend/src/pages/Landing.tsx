import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, MapPin, Calendar, Plus, Edit, Lock, ArrowUpDown, Globe } from 'lucide-react';
import { shellBackgroundClass, shellOverlayTopClass, shellOverlayBottomClass, panelSurfaceClass, APP_THEME } from '@/lib/themeUtils';
import { UserMenu } from '@/components/UserMenu';
import { CreateEventModal } from '@/components/CreateEventModal';
import { EditEventModal } from '@/components/EditEventModal';
import { fetchEventsWithSource, readCachedEvents, type Event } from '@/lib/eventsApi';
import { canEditEvent } from '@/lib/eventAccess';
import { useAuth } from '@/context/SimpleAuthContext';
import { OfficeWindows, officeWindowTitle, OFFICE_WINDOWS, pathForWindow, windowFromPath, type OfficeWindowId } from '@/components/OfficeWindows';
import { AppRail } from '@/components/AppRail';
import { AppRibbonBar, AppRibbonBrand, AppRibbonRow, AppRibbonTools, type RibbonPathSegment } from '@/components/AppRibbon';
import { GlobalSearch } from '@/components/GlobalSearch';
import { RepositoryWindow } from '@/components/RepositoryWindow';
import { AssetsWindow } from '@/components/AssetsWindow';
import type { AssetTrailCrumb } from '@/components/AssetExplorer';
import { REPOSITORY_INDUSTRIES, isRepositoryIndustryId } from '@/lib/repositoryIndustries';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { GalaxyWindow } from '@/components/GalaxyWindow';
import { MyAccionWindow } from '@/components/MyAccionWindow';
import { resolveAvatarUrl } from '@/lib/avatarUpload';
import { useIsCompactNav } from '@/hooks/use-mobile';
import { toast } from 'sonner';

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = APP_THEME;
  const { mode, userId, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const officeWindow = windowFromPath(location.pathname);
  const isHome = officeWindow === null;
  const [railOpen, setRailOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [assetTrail, setAssetTrail] = useState<AssetTrailCrumb[]>([]);
  const industryParam = searchParams.get('industry');
  const industryId = industryParam && isRepositoryIndustryId(industryParam) ? industryParam : null;

  const folderId = searchParams.get('folder');
  const isDrilledIntoWindow =
    (officeWindow === 'repository' && Boolean(industryId)) ||
    (officeWindow === 'assets' && Boolean(folderId));

  const isCompactNav = useIsCompactNav();
  const showMenuLeading = isHome || (isCompactNav && !isDrilledIntoWindow);

  useEffect(() => {
    if (isHome) return;
    const prefersDesktopRail = window.matchMedia('(min-width: 1024px)').matches;
    setRailOpen(prefersDesktopRail && !isDrilledIntoWindow);
  }, [isHome, isDrilledIntoWindow, officeWindow]);

  useEffect(() => {
    setAssetTrail([]);
  }, [officeWindow, industryId]);

  const goToWindowRoot = useCallback(() => {
    if (!officeWindow) {
      navigate('/');
      return;
    }
    navigate(pathForWindow(officeWindow));
    setSearchParams(new URLSearchParams());
  }, [officeWindow, navigate, setSearchParams]);

  const goToFolderCrumb = useCallback((crumb: AssetTrailCrumb) => {
    const next = new URLSearchParams(searchParams);
    if (crumb.id) next.set('folder', crumb.id);
    else next.delete('folder');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const ribbonPath = useMemo((): RibbonPathSegment[] => {
    if (isHome || !officeWindow) return [];
    const windowName = officeWindowTitle(officeWindow);
    const segments: RibbonPathSegment[] = [
      {
        label: windowName,
        onClick: goToWindowRoot,
      },
    ];

    if (officeWindow === 'repository') {
      if (!industryId) return segments;
      segments.push({
        label: REPOSITORY_INDUSTRIES[industryId].name,
        onClick: () => {
          const next = new URLSearchParams();
          next.set('industry', industryId);
          setSearchParams(next);
        },
      });
      if (assetTrail.length > 1) {
        assetTrail.slice(1).forEach((crumb, index, list) => {
          const isLast = index === list.length - 1;
          segments.push({
            label: crumb.name,
            onClick: isLast ? undefined : () => goToFolderCrumb(crumb),
          });
        });
      }
      return segments;
    }

    if (officeWindow === 'assets' && assetTrail.length > 1) {
      assetTrail.slice(1).forEach((crumb, index, list) => {
        const isLast = index === list.length - 1;
        segments.push({
          label: crumb.name,
          onClick: isLast ? undefined : () => goToFolderCrumb(crumb),
        });
      });
    }

    return segments;
  }, [isHome, officeWindow, industryId, assetTrail, goToWindowRoot, goToFolderCrumb, setSearchParams]);

  const handleRibbonBack = useCallback(() => {
    if (officeWindow === 'repository' && industryId) {
      if (assetTrail.length > 1) {
        const parent = assetTrail[assetTrail.length - 2];
        const next = new URLSearchParams(searchParams);
        if (parent?.id) next.set('folder', parent.id);
        else next.delete('folder');
        setSearchParams(next);
        return;
      }
      if (searchParams.get('folder')) {
        const next = new URLSearchParams(searchParams);
        next.delete('folder');
        setSearchParams(next);
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.delete('industry');
      next.delete('folder');
      setSearchParams(next);
      return;
    }
    if (officeWindow === 'assets' && assetTrail.length > 1) {
      const parent = assetTrail[assetTrail.length - 2];
      const next = new URLSearchParams(searchParams);
      if (parent?.id) next.set('folder', parent.id);
      else next.delete('folder');
      setSearchParams(next);
      return;
    }
    navigate('/');
  }, [officeWindow, industryId, assetTrail, searchParams, setSearchParams, navigate]);

  const openWindow = (id: OfficeWindowId) => {
    const live = OFFICE_WINDOWS.find((item) => item.id === id)?.live;
    if (!live) {
      toast.message(`${officeWindowTitle(id)} is coming soon`);
      return;
    }
    if (isCompactNav) {
      setRailOpen(false);
    }
    navigate(pathForWindow(id));
  };

  useEffect(() => {
    document.title = 'ConnectHub - Remember what matters';
  }, []);

  useEffect(() => {
    if (officeWindow === 'events') void loadEvents();
  }, [officeWindow]);

  const loadEvents = async () => {
    setLoadError(null);

    const cached = await readCachedEvents();
    if (cached?.data?.length) {
      setEvents(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchEventsWithSource();
      const data = result.data;
      setCachedAt(result.source === 'cache' ? result.cachedAt || Date.now() : null);
      setEvents(data?.length ? data : cached?.data?.length ? cached.data : []);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
      let message = 'Unable to load events. Confirm the ConnectHub server is running, then try again.';
      try {
        const health = await fetch('/api/health').then((response) => response.json());
        if (health.database !== 'ok' && health.databaseHint) message = health.databaseHint;
      } catch {
        // Keep the generic message if health is unavailable.
      }
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: Event) => {
    navigateToEvent(event.slug);
  };

  const getSortedEvents = useMemo(() => {
    const sorted = [...events];
    
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'size':
        return sorted.sort((a, b) => (b.attendee_count || 0) - (a.attendee_count || 0));
      case 'date':
      default:
        // Sort by event date (parse the date string)
        return sorted.sort((a, b) => {
          // Try to parse the date strings
          const parseEventDate = (dateStr?: string): number => {
            if (!dateStr) return 0;
            
            try {
              // Handle different date formats
              // "12 Feb, 2026" or "8 Feb, 2026"
              // "29 Nov - 1 Dec, 2025"
              // "February 16-20, 2026"
              
              // Extract year first
              const yearMatch = dateStr.match(/\d{4}/);
              const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
              
              // Handle date ranges - take the start date for sorting
              let dateToUse = dateStr;
              
              // For ranges like "29 Nov - 1 Dec, 2025", take the first date
              if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                dateToUse = parts[0].trim() + ', ' + year;
              }
              
              // For formats like "February 16-20, 2026", extract "February 16, 2026"
              if (dateStr.match(/[A-Za-z]+\s+\d+-\d+,\s*\d{4}/)) {
                const match = dateStr.match(/([A-Za-z]+)\s+(\d+)-\d+,\s*(\d{4})/);
                if (match) {
                  dateToUse = `${match[1]} ${match[2]}, ${match[3]}`;
                }
              }
              
              // Try to parse the date
              const parsed = new Date(dateToUse);
              if (!isNaN(parsed.getTime())) {
                return parsed.getTime();
              }
              
              // If standard parsing fails, try manual parsing for formats like "12 Feb, 2026"
              const manualMatch = dateToUse.match(/(\d+)\s+([A-Za-z]+),?\s*(\d{4})?/);
              if (manualMatch) {
                const day = parseInt(manualMatch[1]);
                const month = manualMatch[2];
                const yearParsed = manualMatch[3] ? parseInt(manualMatch[3]) : year;
                
                const monthMap: Record<string, number> = {
                  'jan': 0, 'january': 0,
                  'feb': 1, 'february': 1,
                  'mar': 2, 'march': 2,
                  'apr': 3, 'april': 3,
                  'may': 4,
                  'jun': 5, 'june': 5,
                  'jul': 6, 'july': 6,
                  'aug': 7, 'august': 7,
                  'sep': 8, 'september': 8,
                  'oct': 9, 'october': 9,
                  'nov': 10, 'november': 10,
                  'dec': 11, 'december': 11
                };
                
                const monthNum = monthMap[month.toLowerCase()];
                if (monthNum !== undefined) {
                  const date = new Date(yearParsed, monthNum, day);
                  return date.getTime();
                }
              }
            } catch (e) {
              console.error('Error parsing date:', dateStr, e);
            }
            
            return 0;
          };
          
          const dateA = parseEventDate(a.date);
          const dateB = parseEventDate(b.date);
          
          // If both dates are valid, sort by date (newest/furthest in future first)
          if (dateA && dateB) {
            return dateB - dateA;
          }
          
          // If dates are invalid, fall back to created_at
          const createdA = new Date(a.created_at).getTime();
          const createdB = new Date(b.created_at).getTime();
          return createdB - createdA;
        });
    }
  }, [events, sortBy]);

  const navigateToEvent = (slug: string) => {
    navigate(`/connect-hub/hub?event=${encodeURIComponent(slug)}`);
  };

  const handleEditEvent = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEditEvent(event, userId, profile?.isAdmin)) return;
    setSelectedEvent(event);
    setEditModalOpen(true);
  };

  const isPortalWindow = officeWindow === 'accion' || officeWindow === 'galaxy';

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden transition-colors duration-700 ${shellBackgroundClass(theme)}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute top-0 left-0 right-0 h-24 transition-colors duration-700 ${shellOverlayTopClass(theme)}`} />
        <div className={`absolute bottom-0 left-0 right-0 h-24 transition-colors duration-700 ${shellOverlayBottomClass(theme)}`} />
      </div>

      <AppRibbonBar>
        <AppRibbonRow stackOnMobile>
          <div className="min-w-0 w-full overflow-hidden sm:flex-1">
          <AppRibbonBrand
            title={isHome ? 'ConnectHub' : undefined}
            pathSegments={isHome ? undefined : ribbonPath}
            showTagline={isHome}
            leading={showMenuLeading ? 'menu' : 'back'}
            onLeadingClick={showMenuLeading ? () => setRailOpen((value) => !value) : handleRibbonBack}
          />
          </div>
          <AppRibbonTools className="w-full justify-end sm:ml-auto sm:w-auto">
            <GlobalSearch compactOnMobile />
            <UserMenu />
          </AppRibbonTools>
        </AppRibbonRow>
      </AppRibbonBar>

      <div className="relative z-10 flex min-h-0 flex-1">
        {railOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setRailOpen(false)}
          />
        ) : null}
        <AppRail
          active={officeWindow}
          onSelect={openWindow}
          open={railOpen}
          onClose={() => setRailOpen(false)}
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className={`app-shell-pane px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-5 md:px-8 ${isHome ? 'flex min-h-[calc(100dvh-4.25rem)] items-start py-4 sm:min-h-[calc(100dvh-5.5rem)] sm:items-center sm:py-8 md:py-10' : 'py-4 sm:py-5'}`}>
            <div className="mx-auto w-full max-w-6xl">
            {isHome ? (
                <OfficeWindows active={null} variant="desktop" onSelect={openWindow} />
            ) : (
            <>
              {isPortalWindow ? (
                <div className="mx-auto w-full max-w-5xl">
                  {officeWindow === 'accion' ? <MyAccionWindow /> : <GalaxyWindow />}
                </div>
              ) : (
              <div
                id="events-floor"
                className={`office-window-surface relative min-w-0 scroll-mt-4 rounded-2xl p-3 transition-all duration-700 sm:p-4 lg:p-6 xl:p-8 ${panelSurfaceClass(theme)}`}>
                
                {officeWindow === 'events' && (
                <div className="mb-6 flex justify-end">
                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                    {/* Sort Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                          <ArrowUpDown className="w-4 h-4 sm:mr-2 text-muted-foreground" />
                          <span className="hidden sm:inline text-foreground">Sort by {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Size'}</span>
                          <span className="sm:hidden text-foreground">Sort</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSortBy('date')}>
                          <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                          <span className="font-medium">Sort by Date</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortBy('name')}>
                          <span className="w-4 h-4 mr-2 flex items-center justify-center text-xs font-bold text-purple-500">Az</span>
                          <span className="font-medium">Sort by Name</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSortBy('size')}>
                          <Users className="w-4 h-4 mr-2 text-emerald-500" />
                          <span className="font-medium">Sort by Size</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <Button onClick={() => setCreateModalOpen(true)} size="sm" className="flex-1 sm:flex-none">
                      <Plus className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">New event</span>
                      <span className="sm:hidden">Create</span>
                    </Button>
                  </div>
                </div>
                )}
                {officeWindow === 'repository' ? (
                  <RepositoryWindow onTrail={setAssetTrail} />
                ) : officeWindow === 'assets' ? (
                  <AssetsWindow onTrail={setAssetTrail} />
                ) : officeWindow === 'analytics' ? (
                  <AnalyticsDashboard />
                ) : officeWindow === 'teams' || officeWindow === 'clients' || officeWindow === 'rooms' ? (
                  <div className="flex min-h-[16rem] flex-col items-center justify-center py-12 text-center">
                    <p className="text-lg font-medium text-foreground">Coming soon</p>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      {officeWindowTitle(officeWindow)} is closed for now. When it opens, Jelly will be able to search this window for files, people, and answers.
                    </p>
                  </div>
                ) : (
                <>
                {cachedAt && (
                  <div
                    role="status"
                    className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    {navigator.onLine
                      ? `Could not refresh events — showing your saved copy from ${new Date(cachedAt).toLocaleString()}.`
                      : `Offline: showing events saved on ${new Date(cachedAt).toLocaleString()}.`}{' '}
                    Changes to events require a connection.
                  </div>
                )}
                                
                {/* Events Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="relative w-12 h-12 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                      </div>
                      <p className="text-sm text-muted-foreground animate-pulse">Loading events...</p>
                    </div>
                  </div>
                ) : loadError ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2 text-foreground">Unable to load events</p>
                    <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                    <Button onClick={loadEvents}>Try again</Button>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2 text-foreground">No events yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Public events appear here for everyone signed in. Private events appear after you are invited.
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create an event to start, or wait for an organizer to invite you.
                    </p>
                    {mode === 'auth' && (
                      <Button onClick={() => setCreateModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create an event
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {getSortedEvents.map((event: Event, index: number) => (
                        <div
                          key={event.id}
                          className="animate-in fade-in"
                          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                          <Card 
                            className="bg-card border-border rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 group cursor-pointer overflow-hidden relative"
                            onClick={() => handleEventClick(event)}
                          >
                        {/* Edit Button - Only show for owner or admin */}
                        {(canEditEvent(event, userId, profile?.isAdmin)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-3 right-3 z-10 opacity-100 transition-all duration-300 bg-card/90 backdrop-blur-sm hover:bg-muted shadow-lg sm:opacity-0 sm:group-hover:opacity-100"
                            onClick={(e) => handleEditEvent(event, e)}
                            title="Edit Event"
                          >
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}

                        <div className="relative aspect-video w-full overflow-hidden bg-muted">
                          {event.event_picture_url ? (
                            <img
                              key={event.event_picture_url}
                              src={resolveAvatarUrl(event.event_picture_url) || event.event_picture_url}
                              alt={event.name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="absolute inset-0 flex w-full items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted/60"
                            style={{ display: event.event_picture_url ? 'none' : 'flex' }}
                          >
                            <span className="line-clamp-2 px-2 text-center text-xl font-bold text-muted-foreground opacity-70 sm:text-2xl">
                              {event.name}
                            </span>
                          </div>
                        </div>

                        {/* Event Details */}
                        <CardContent className="p-3 sm:p-4 space-y-2">
                          <h3 className="text-base font-bold text-foreground line-clamp-2 sm:text-lg">
                            {event.name}
                          </h3>
                          {/* Creator Name with Privacy Icon */}
                          {event.creator_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                              {event.is_private ? (
                                <Lock className="w-3 h-3 flex-shrink-0 text-rose-500 dark:text-rose-400" />
                              ) : (
                                <Globe className="w-3 h-3 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                              )}
                              <span className="line-clamp-1">{event.creator_name}</span>
                            </div>
                          )}
                          
                          {/* Event Date */}
                          <div className="flex items-center gap-2 text-sm text-foreground transition-colors">
                            <Calendar className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                            <span className="line-clamp-1">{event.date}</span>
                          </div>
                          
                          {/* Event Location */}
                          <div className="flex items-center gap-2 text-sm text-foreground transition-colors">
                            <MapPin className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                            <span className="line-clamp-1">{event.place}</span>
                          </div>

                          {/* Attendee Count */}
                          <div className="flex flex-col gap-2 border-t border-border pt-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors">
                              <Users className="w-4 h-4 text-blue-500 dark:text-blue-400 transition-colors" />
                              <span>{event.attendee_count || 0} Attendees</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 sm:group-hover:text-blue-500 dark:sm:group-hover:text-blue-400 font-medium transition-colors">
                              View Details →
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
                  </>
                )}
                </>
                )}
              </div>
              )}
            </>
            )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Create Event Modal */}
      <CreateEventModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen}
        onSuccess={loadEvents}
      />

      {/* Edit Event Modal */}
      <EditEventModal 
        open={editModalOpen} 
        onOpenChange={setEditModalOpen}
        event={selectedEvent}
        onSuccess={loadEvents}
      />
    </div>
  );
};

export default Landing;
