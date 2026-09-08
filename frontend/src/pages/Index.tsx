import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Attendee, StatusColor, AttendeeNote, StageValue } from '@/types/attendee';
import { loadAttendeesFromCSV } from '@/utils/csvParser';
import { saveStatus, saveNote, getStatus, getAttendeeNotes, clearAllData, updateNote, deleteNote, saveStage, getStages } from '@/utils/localStorage';
import { exportMarkedConnections } from '@/utils/export';
import { SECTORS, getSector } from '@/utils/sectors';
import { Header } from '@/components/Header';
import { FilterPanel } from '@/components/FilterPanel';
import { MobileFilterDrawer } from '@/components/MobileFilterDrawer';
import { StatsPanel } from '@/components/StatsPanel';
import { AttendeeCard } from '@/components/AttendeeCard';
import { AttendeeModal } from '@/components/AttendeeModal';
import { StatusMenu } from '@/components/StatusMenu';
import { NoteModal } from '@/components/NoteModal';
import { QuickActions } from '@/components/QuickActions';
import { SortOption } from '@/components/SortDropdown';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Search, Users, CheckCircle, Clock, FileText, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ATTENDEES_STORAGE_KEY = 'attendeesData';

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Single-select state for filters
  const [selectedStatuses, setSelectedStatuses] = useState<StatusColor[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set());
  const [selectedStages, setSelectedStages] = useState<Set<StageValue>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [statusMenuAttendee, setStatusMenuAttendee] = useState<Attendee | null>(null);
  const [noteModalAttendee, setNoteModalAttendee] = useState<Attendee | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [quickFilterMode, setQuickFilterMode] = useState<'all' | 'connections' | 'notes'>('all');
  const [speakerFilterActive, setSpeakerFilterActive] = useState(false);
  const [competitorFilterActive, setCompetitorFilterActive] = useState(false);
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const attendeesPerPage = 40;

  // Load attendees on mount (prefer localStorage, fallback to CSV)
  useEffect(() => {
    const loadData = async () => {
      try {
        const eventId = searchParams.get('event') ?? 'machinecon2025';
        const csvFile = eventId === 'aiimpact2026' ? 'attendees2026.csv' : 'attendees.csv';
        const data = await loadAttendeesFromCSV(csvFile);

        // Restore any per-user stage overrides from localStorage so stages
        // persist across refresh and per account.
        const stageOverrides = getStages();
        const withStages = data.map((attendee) => {
          const override = stageOverrides[attendee.id] as StageValue | undefined;
          return override ? { ...attendee, stage: override } : attendee;
        });

        setAttendees(withStages);
      } catch (err) {
        setError('Failed to load attendee data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [searchParams]);

  // Get unique sectors and locations from data
  const { sectorsFromData, locations } = useMemo(() => {
    const sectorSet = new Set<string>();
    const locationSet = new Set<string>();
    
    attendees.forEach(attendee => {
      if (attendee.sector) sectorSet.add(attendee.sector);
      if (attendee.location) locationSet.add(attendee.location);
    });
    
    return {
      sectorsFromData: Array.from(sectorSet).sort(),
      locations: Array.from(locationSet).sort()
    };
  }, [attendees]);

  // Filter and sort attendees
  const filteredAttendees = useMemo(() => {
    let filtered = [...attendees];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.company.toLowerCase().includes(query) ||
          a.designation.toLowerCase().includes(query) ||
          a.location.toLowerCase().includes(query)
      );
    }

    // Apply all filters in a single pass for better performance
    filtered = filtered.filter((attendee) => {
      // Status filter (multi-select)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(getStatus(attendee.id))) {
        return false;
      }

      // Location filter (multi-select: OR within group)
      if (selectedLocations.size > 0 && !selectedLocations.has(attendee.location)) {
        return false;
      }

      // Sector filter (multi-select, prefer CSV-provided sector, fallback to deterministic dummy)
      const attendeeSector = attendee.sector ?? getSector(attendee.id);
      if (selectedSectors.size > 0 && (!attendeeSector || !selectedSectors.has(attendeeSector))) {
        return false;
      }

      // Stage filter (multi-select)
      if (selectedStages.size > 0 && (attendee.stage === '-' || !selectedStages.has(attendee.stage))) {
        return false;
      }

      return true;
    });

    // Quick filter mode
    if (quickFilterMode === 'connections') {
      filtered = filtered.filter((a) => getStatus(a.id) !== 'grey');
    } else if (quickFilterMode === 'notes') {
      filtered = filtered.filter((a) => getAttendeeNotes(a.id).length > 0);
    }

    if (speakerFilterActive && competitorFilterActive) {
      filtered = filtered.filter((a) => a.speaker || a.competitor);
    } else if (speakerFilterActive) {
      filtered = filtered.filter((a) => a.speaker);
    } else if (competitorFilterActive) {
      filtered = filtered.filter((a) => a.competitor);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'company-asc':
          return a.company.localeCompare(b.company);
        case 'location-asc':
          return a.location.localeCompare(b.location);
        case 'designation-asc':
          return a.designation.localeCompare(b.designation);
        case 'notes-recent': {
          const aNotes = getAttendeeNotes(a.id);
          const bNotes = getAttendeeNotes(b.id);
          const aLatest = aNotes.length > 0 ? Math.max(...aNotes.map(n => n.timestamp)) : 0;
          const bLatest = bNotes.length > 0 ? Math.max(...bNotes.map(n => n.timestamp)) : 0;
          return bLatest - aLatest;
        }
        case 'priority': {
          const order: Record<StatusColor, number> = { red: 0, yellow: 1, blue: 2, green: 3, grey: 4 };
          return order[getStatus(a.id)] - order[getStatus(b.id)];
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [attendees, searchQuery, selectedStatuses, selectedLocations, selectedSectors, selectedStages, sortBy, quickFilterMode, getStatus, getSector, getAttendeeNotes]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAttendees.length / attendeesPerPage);
  const startIndex = (currentPage - 1) * attendeesPerPage;
  const endIndex = startIndex + attendeesPerPage;
  const currentAttendees = filteredAttendees.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedLocations, selectedSectors, selectedStages, sortBy, quickFilterMode, speakerFilterActive, competitorFilterActive]);

  // Handlers
  const handleStatusChange = (attendeeId: string, status: StatusColor) => {
    saveStatus(attendeeId, status);
    setAttendees([...attendees]); // Trigger re-render
    toast({
      title: 'Status Updated',
      description: 'Attendee status has been changed.',
    });
  };

  const handleAddNote = (attendeeId: string, text: string) => {
    const note: AttendeeNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      attendeeId,
      text,
      timestamp: Date.now(),
    };
    saveNote(note);
    setAttendees([...attendees]); // Trigger re-render
    toast({
      title: 'Note Saved',
      description: 'Your note has been saved successfully.',
    });
  };

  const handleUpdateNote = (noteId: string, text: string) => {
    updateNote(noteId, text);
    setAttendees([...attendees]);
    toast({
      title: 'Note Updated',
      description: 'Your note has been updated.',
    });
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNote(noteId);
    setAttendees([...attendees]);
    toast({
      title: 'Note Deleted',
      description: 'The note has been removed.',
    });
  };

  const handleUpdateAttendee = (updated: Attendee) => {
    setAttendees((prev) => {
      const prevAttendee = prev.find((a) => a.id === updated.id);
      if (prevAttendee && prevAttendee.stage !== updated.stage) {
        // Persist stage change per user so it survives refresh and
        // remains isolated by auth account.
        saveStage(updated.id, updated.stage);
      }
      return prev.map((a) => (a.id === updated.id ? updated : a));
    });
    if (selectedAttendee && selectedAttendee.id === updated.id) {
      setSelectedAttendee(updated);
    }
    if (statusMenuAttendee && statusMenuAttendee.id === updated.id) {
      setStatusMenuAttendee(updated);
    }
    if (noteModalAttendee && noteModalAttendee.id === updated.id) {
      setNoteModalAttendee(updated);
    }
  };

  const handleExport = () => {
    exportMarkedConnections(attendees);
    toast({
      title: 'Export Complete',
      description: 'Your connections have been downloaded.',
    });
  };

  const handleReset = () => {
    clearAllData();
    setAttendees([...attendees]); // Trigger re-render
    setShowResetDialog(false);
    toast({
      title: 'Reset Complete',
      description: 'All statuses and notes have been cleared.',
    });
  };

  const handleClearFilters = () => {
    setSelectedStatuses([]);
    setSelectedLocations(new Set());
    setSelectedSectors(new Set());
    setSelectedStages(new Set());
    setQuickFilterMode('all');
  };

  // Calculate active filter count
  const activeFilterCount =
    selectedStatuses.length +
    (selectedLocations.size > 0 ? 1 : 0) +
    (selectedSectors.size > 0 ? 1 : 0) +
    (selectedStages.size > 0 ? 1 : 0) +
    (quickFilterMode !== 'all' ? 1 : 0) +
    (speakerFilterActive ? 1 : 0) +
    (competitorFilterActive ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading attendees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header Component Only */}
      <Header
        attendeeCount={attendees.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        title="Machine Con"
        subtitle="November 2025 - Goa"
        backTo="/"
      />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24">
        {/* Stats Panel */}
        <div className="mb-3 sm:mb-4 md:mb-6">
          <StatsPanel
            attendees={attendees}
            onFilterByStatus={(status) => {
              setSelectedStatuses([status]);
              setQuickFilterMode('all');
            }}
            onFilterByNotes={() => {
              setSelectedStatuses([]);
              setQuickFilterMode((prev) => (prev === 'notes' ? 'all' : 'notes'));
            }}
            onShowAll={() => {
              setSelectedStatuses([]);
              setQuickFilterMode('all');
              setSpeakerFilterActive(false);
              setCompetitorFilterActive(false);
            }}
            activeStatus={selectedStatuses.length === 1 ? selectedStatuses[0] : null}
            notesActive={quickFilterMode === 'notes'}
            allActive={selectedStatuses.length === 0 && quickFilterMode === 'all' && !speakerFilterActive && !competitorFilterActive}
            onShowSpeakers={() => {
              setSelectedStatuses([]);
              setQuickFilterMode('all');
              setSpeakerFilterActive((prev) => !prev);
            }}
            onShowCompetitors={() => {
              setSelectedStatuses([]);
              setQuickFilterMode('all');
              setCompetitorFilterActive((prev) => !prev);
            }}
            speakerActive={speakerFilterActive}
            competitorActive={competitorFilterActive}
          />
        </div>

        {/* Filters - Desktop */}
        <div className="hidden sm:block mb-3 sm:mb-4 md:mb-6">
          <FilterPanel
            selectedSectors={selectedSectors}
            onSectorsChange={setSelectedSectors}
            selectedLocations={selectedLocations}
            onLocationsChange={setSelectedLocations}
            selectedStages={selectedStages}
            onStagesChange={setSelectedStages}
            locations={locations}
            sectors={sectorsFromData}
            onClearFilters={handleClearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>

        {/* Filters - Mobile Drawer */}
        <div className="mb-3 sm:hidden">
          <MobileFilterDrawer activeFilterCount={activeFilterCount}>
            <FilterPanel
              selectedSectors={selectedSectors}
              onSectorsChange={setSelectedSectors}
              selectedLocations={selectedLocations}
              onLocationsChange={setSelectedLocations}
              selectedStages={selectedStages}
              onStagesChange={setSelectedStages}
              locations={locations}
              sectors={sectorsFromData}
              onClearFilters={handleClearFilters}
              activeFilterCount={activeFilterCount}
            />
          </MobileFilterDrawer>
        </div>

        {/* Results Count */}
        <div className="mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {filteredAttendees.length} result{filteredAttendees.length !== 1 ? 's' : ''} found
            {quickFilterMode === 'connections' && ' (My Connections)'}
            {quickFilterMode === 'notes' && ' (With Notes)'}
            {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
          </p>
        </div>

        {/* Attendee Grid */}
        {filteredAttendees.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">No attendees found matching your criteria.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {currentAttendees.map((attendee) => (
                <AttendeeCard
                  key={attendee.id}
                  attendee={attendee}
                  onViewDetails={() => setSelectedAttendee(attendee)}
                  onAddNote={() => setNoteModalAttendee(attendee)}
                  onStatusMenuClick={() => setStatusMenuAttendee(attendee)}
                />
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredAttendees.length)} of {filteredAttendees.length} attendees
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="min-w-[2.5rem]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Show max 5 page numbers with ellipsis for many pages
                      if (totalPages <= 5 || 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="min-w-[2.5rem]"
                          >
                            {page}
                          </Button>
                        );
                      } else if (
                        (page === currentPage - 2 && currentPage > 3) ||
                        (page === currentPage + 2 && currentPage < totalPages - 2)
                      ) {
                        return <span key={page} className="px-2 text-muted-foreground">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="min-w-[2.5rem]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {selectedAttendee && (
        <AttendeeModal
          open={!!selectedAttendee}
          onOpenChange={(open) => !open && setSelectedAttendee(null)}
          attendee={selectedAttendee}
          onAddNote={() => {
            setNoteModalAttendee(selectedAttendee);
          }}
          onChangeStatus={() => {
            setStatusMenuAttendee(selectedAttendee);
          }}
          onEditNote={(noteId, text) => {
            setEditingNote({ id: noteId, text });
            setNoteModalAttendee(selectedAttendee);
          }}
          onDeleteNote={(noteId) => handleDeleteNote(noteId)}
          onUpdateAttendee={handleUpdateAttendee}
        />
      )}

      {statusMenuAttendee && (
        <StatusMenu
          open={!!statusMenuAttendee}
          onOpenChange={(open) => !open && setStatusMenuAttendee(null)}
          currentStatus={getStatus(statusMenuAttendee.id)}
          onStatusChange={(status) => handleStatusChange(statusMenuAttendee.id, status)}
          attendeeName={statusMenuAttendee.name}
        />
      )}

      {noteModalAttendee && (
        <NoteModal
          open={!!noteModalAttendee}
          onOpenChange={(open) => {
            if (!open) {
              setNoteModalAttendee(null);
              setEditingNote(null);
            }
          }}
          onSave={(text) => {
            if (editingNote) {
              handleUpdateNote(editingNote.id, text);
              setEditingNote(null);
            } else {
              handleAddNote(noteModalAttendee.id, text);
            }
          }}
          attendeeName={noteModalAttendee.name}
          initialText={editingNote?.text}
        />
      )}

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all status colors and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Button */}
      <QuickActions onExport={handleExport} />
    </div>
  );
};

export default Index;
