import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Building, 
  Phone, 
  Mail, 
  Video, 
  Coffee,
  Car,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { notebookService, MeetingNote } from '@/services/notebookService';
import NotebookNoteModal from '@/components/NotebookNoteModal';
import {
  hydrateRemindersFromDb,
  loadReminders,
  saveReminders,
  type CalendarReminder,
} from '@/services/calendarRemindersService';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  type: 'meeting' | 'call' | 'deadline' | 'reminder' | 'travel' | 'other';
  priority: 'high' | 'medium' | 'low';
  status: 'scheduled' | 'completed' | 'cancelled';
  location?: string;
  attendees?: string[];
  company?: string;
  description?: string;
  meetingLink?: string;
  createdBy?: string;
}

type CorporateCalendarProps = {
  companies?: any[];
};

const CorporateCalendar = ({ companies = [] }: CorporateCalendarProps) => {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notebookNotes, setNotebookNotes] = useState<MeetingNote[]>([]);
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<string>('10');
  const scheduledTimeoutsRef = useRef<Map<string, number>>(new Map());

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);

  const parseEventDateTime = (dateStr: string, timeStr: string): Date | null => {
    const d = (dateStr || '').trim();
    const t = (timeStr || '').trim();
    if (!d || !t) return null;

    // Prefer ISO-style time (HH:mm)
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const iso = `${d}T${t}:00`;
      const dt = new Date(iso);
      if (!Number.isNaN(dt.getTime())) return dt;
    }

    // Fallback for strings like "10:30 AM"
    const dt = new Date(`${d} ${t}`);
    if (!Number.isNaN(dt.getTime())) return dt;
    return null;
  };

  const ensureNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast({
        title: 'Notifications not supported',
        description: 'Your browser does not support notifications.',
        variant: 'destructive',
        duration: 3000,
      });
      return false;
    }

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      toast({
        title: 'Notifications blocked',
        description: 'Enable notifications in your browser settings to use alarms.',
        variant: 'destructive',
        duration: 4000,
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const fireReminder = (reminder: CalendarReminder, eventTitle: string) => {
    toast({
      title: '⏰ Reminder',
      description: eventTitle,
      duration: 6000,
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Reminder', { body: eventTitle });
    }

    const remaining = loadReminders().filter((r) => r.id !== reminder.id);
    saveReminders(remaining);
    const timeoutId = scheduledTimeoutsRef.current.get(reminder.id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      scheduledTimeoutsRef.current.delete(reminder.id);
    }
  };

  const scheduleReminder = (reminder: CalendarReminder, eventTitle: string) => {
    const delay = reminder.triggerAt - Date.now();
    if (delay <= 0) return;
    if (scheduledTimeoutsRef.current.has(reminder.id)) return;
    const timeoutId = window.setTimeout(() => fireReminder(reminder, eventTitle), delay);
    scheduledTimeoutsRef.current.set(reminder.id, timeoutId);
  };

  const mapNoteTypeToCalendarType = (type: MeetingNote['type']): CalendarEvent['type'] => {
    switch (type) {
      case 'meeting':
        return 'meeting';
      case 'call':
        return 'call';
      default:
        return 'other';
    }
  };

  const mapNotePriorityToCalendarPriority = (priority: MeetingNote['priority']): CalendarEvent['priority'] => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  };

  // Load notebook notes and sync with calendar
  useEffect(() => {
    const loadNotes = () => {
      const notes = notebookService.getNotes();
      setNotebookNotes(notes);
      
      // Convert notebook notes to calendar events
      const calendarEvents: CalendarEvent[] = notes
        .filter(note => note.date && note.time) // Only include notes with date and time
        .map(note => ({
          id: `note-${note.id}`,
          title: note.title,
          date: note.date!,
          time: note.time!,
          duration: note.duration || '1h',
          type: mapNoteTypeToCalendarType(note.type),
          priority: mapNotePriorityToCalendarPriority(note.priority),
          status: note.status === 'completed' ? 'completed' : 'scheduled',
          attendees: note.participants || [],
          company: note.relatedEntity?.name,
          description: note.content,
          location: note.location,
          createdBy: note.createdBy
        }));
      
      setEvents(calendarEvents);
    };

    loadNotes();
    
    // Subscribe to notebook changes
    const unsubscribe = notebookService.subscribe((updatedNotes) => {
      setNotebookNotes(updatedNotes);
      
      // Update calendar events when notes change
      const calendarEvents: CalendarEvent[] = updatedNotes
        .filter(note => note.date && note.time)
        .map(note => ({
          id: `note-${note.id}`,
          title: note.title,
          date: note.date!,
          time: note.time!,
          duration: note.duration || '1h',
          type: mapNoteTypeToCalendarType(note.type),
          priority: mapNotePriorityToCalendarPriority(note.priority),
          status: note.status === 'completed' ? 'completed' : 'scheduled',
          attendees: note.participants || [],
          company: note.relatedEntity?.name,
          description: note.content,
          location: note.location,
          createdBy: note.createdBy
        }));
      
      setEvents(calendarEvents);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    void hydrateRemindersFromDb().then((reminders) => {
      const eventTitleById = new Map(events.map((e) => [e.id, e.title]));
      reminders.forEach((r) => {
        const title = eventTitleById.get(r.eventId) || 'Calendar Event';
        scheduleReminder(r, title);
      });
    });

    return () => {
      scheduledTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      scheduledTimeoutsRef.current.clear();
    };
  }, [events]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getTypeIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting': return Users;
      case 'call': return Phone;
      case 'deadline': return AlertCircle;
      case 'reminder': return Clock;
      case 'travel': return Car;
      default: return CalendarIcon;
    }
  };

  const getTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'call': return 'bg-green-100 text-green-800 border-green-200';
      case 'deadline': return 'bg-red-100 text-red-800 border-red-200';
      case 'reminder': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'travel': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: CalendarEvent['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: CalendarEvent['status']) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: CalendarEvent['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'cancelled': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  const filteredEvents = events.filter(event => {
    const matchesType = filterType === 'all' || event.type === filterType;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (event.company && event.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 border border-gray-100 dark:border-gray-700"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <div
          key={day}
          className={`h-16 border border-gray-100 dark:border-gray-700 p-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
            isToday ? 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-600' : ''
          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-xs font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {day}
            </span>
            {dayEvents.length > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {dayEvents.length}
              </Badge>
            )}
          </div>
          <div className="space-y-1 overflow-hidden">
            {dayEvents.slice(0, 1).map((event, idx) => (
              <div
                key={idx}
                className={`text-xs p-1 rounded truncate ${getTypeColor(event.type)}`}
              >
                {event.time} {event.title.substring(0, 15)}...
              </div>
            ))}
            {dayEvents.length > 1 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">+{dayEvents.length - 1} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderEventList = () => {
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateA.getTime() - dateB.getTime();
    });

    return sortedEvents.map((event) => {
      const TypeIcon = getTypeIcon(event.type);
      const StatusIcon = getStatusIcon(event.status);
      const isAlarmSet = loadReminders().some((r) => r.eventId === event.id && r.triggerAt > Date.now());

      return (
        <Card key={event.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(event.priority)}`}></div>
                <TypeIcon className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                <Badge className={getTypeColor(event.type)}>
                  {event.type}
                </Badge>
                {/* Show if event is from notebook */}
                {event.id.startsWith('note-') && (
                  <Badge variant="outline" className="text-xs ml-2">
                    📝 Notebook
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon className={`w-4 h-4 ${getStatusColor(event.status)}`} />
                <span className={`text-xs ${getStatusColor(event.status)}`}>
                  {event.status}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={async () => {
                    const ok = await ensureNotificationPermission();
                    if (!ok) return;
                    const dt = parseEventDateTime(event.date, event.time);
                    if (!dt) {
                      toast({
                        title: 'Invalid event time',
                        description: 'This event does not have a valid date/time to schedule an alarm.',
                        variant: 'destructive',
                        duration: 3000,
                      });
                      return;
                    }

                    const lead = Math.max(0, Number(reminderLeadMinutes) || 0);
                    const triggerAt = dt.getTime() - lead * 60 * 1000;
                    if (triggerAt <= Date.now()) {
                      toast({
                        title: 'Alarm time has passed',
                        description: 'Choose a smaller lead time or a future event.',
                        variant: 'destructive',
                        duration: 3000,
                      });
                      return;
                    }

                    const reminder: CalendarReminder = {
                      id: `rem-${event.id}-${lead}-${triggerAt}`,
                      eventId: event.id,
                      triggerAt,
                      leadMinutes: lead,
                      createdAt: Date.now(),
                    };

                    const all = loadReminders();
                    const withoutSame = all.filter((r) => !(r.eventId === reminder.eventId && r.leadMinutes === reminder.leadMinutes));
                    withoutSame.push(reminder);
                    saveReminders(withoutSame);
                    scheduleReminder(reminder, event.title);

                    toast({
                      title: 'Alarm set',
                      description: lead > 0 ? `You'll be notified ${lead} min before.` : 'You’ll be notified at start time.',
                      duration: 2500,
                    });
                  }}
                >
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  {isAlarmSet ? 'Alarm On' : 'Set Alarm'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-3 h-3" />
                <span>{event.date}</span>
                <Clock className="w-3 h-3" />
                <span>{event.time} ({event.duration})</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            {event.company && (
              <div className="flex items-center gap-2 mb-2">
                <Building className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium">{event.company}</span>
              </div>
            )}

            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3 h-3 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {event.attendees.slice(0, 2).map((attendee, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {attendee}
                    </Badge>
                  ))}
                  {event.attendees.length > 2 && (
                    <span className="text-xs text-gray-500">+{event.attendees.length - 2}</span>
                  )}
                </div>
              </div>
            )}

            {event.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
            )}
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <h2 className="shrink-0 text-xl font-bold sm:text-2xl">Corporate Calendar</h2>
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-0 flex-1 text-center text-sm font-medium sm:min-w-[9rem] sm:text-base">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Button
          className="w-full shrink-0 sm:w-auto"
          onClick={() => {
          const defaultDate = selectedDate
            ? selectedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];

          // Open the same modal UX as Notebook tab (NotebookNoteModal)
          setEditingNote({
            id: 'new',
            title: '',
            content: '',
            type: 'meeting',
            category: 'general',
            relatedEntity: undefined,
            participants: [],
            tags: [],
            priority: 'medium',
            status: 'draft',
            createdBy: 'current-user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            date: defaultDate,
            time: '09:00',
            duration: '1h',
            location: '',
            metadata: {},
          });
          setIsNoteModalOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Event
        </Button>
      </div>

      <NotebookNoteModal
        open={isNoteModalOpen}
        onOpenChange={setIsNoteModalOpen}
        note={editingNote}
        companies={companies}
        onSave={(noteData) => {
          const user = JSON.parse(localStorage.getItem('gcc_user') || '{}');
          const createdBy = user?.username || 'current-user';

          const primaryParticipant = noteData.participants?.[0]?.trim();
          const relatedEntity = noteData.relatedEntity
            ? noteData.relatedEntity
            : primaryParticipant && noteData.category !== 'general'
              ? {
                  type: noteData.category as 'company' | 'person' | 'opportunity',
                  id: primaryParticipant,
                  name: primaryParticipant,
                }
              : undefined;

          const tags = Array.from(new Set([...(noteData.tags || []), 'calendar']));

          notebookService.addNote({
            ...noteData,
            createdBy,
            relatedEntity,
            tags,
          });

          toast({
            title: '🗓️ Event Added',
            description: `"${noteData.title}" has been added to your calendar.`,
            duration: 2000,
          });
          setEditingNote(null);
        }}
      />

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0 sm:max-w-sm"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="deadline">Deadlines</SelectItem>
              <SelectItem value="reminder">Reminders</SelectItem>
              <SelectItem value="travel">Travel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Select value={reminderLeadMinutes} onValueChange={setReminderLeadMinutes}>
            <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
              <SelectValue placeholder="Reminder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">At start time</SelectItem>
              <SelectItem value="5">5 min before</SelectItem>
              <SelectItem value="10">10 min before</SelectItem>
              <SelectItem value="15">15 min before</SelectItem>
              <SelectItem value="30">30 min before</SelectItem>
              <SelectItem value="60">60 min before</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50 dark:bg-gray-900 p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
            {day}
          </div>
        ))}
        {renderMonthView()}
      </div>

      {/* Events List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Upcoming Events ({filteredEvents.length})
        </h3>
        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No events found</p>
              <p className="text-sm mt-1">Create notes with date/time to see them here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderEventList()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CorporateCalendar;
