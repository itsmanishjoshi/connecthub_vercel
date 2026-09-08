// Local events storage service for development
// Uses browser localStorage when Supabase is not available

import { Event, Attendee, AttendeeNote, CreateEventData, UpdateEventData, CreateAttendeeData, UpdateAttendeeData } from './eventsApi';

// Initialize local storage keys
const EVENTS_KEY = 'connecthub_events';
const ATTENDEES_KEY = 'connecthub_attendees';
const NOTES_KEY = 'connecthub_notes';

// Helper function to generate unique IDs
function generateId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============= LOCAL EVENTS STORAGE =============

export function getLocalEvents(): Event[] {
  try {
    const data = localStorage.getItem(EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading events from localStorage:', error);
    return [];
  }
}

export function getLocalEventById(id: string): Event | null {
  const events = getLocalEvents();
  return events.find(e => e.id === id) || null;
}

export function saveLocalEvents(events: Event[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Error saving events to localStorage:', error);
  }
}

export function createLocalEvent(eventData: CreateEventData): Event {
  const events = getLocalEvents();
  
  const newEvent: Event = {
    id: generateId(),
    name: eventData.name,
    slug: eventData.slug || eventData.name.toLowerCase().replace(/\s+/g, '-'),
    date: eventData.date,
    place: eventData.place,
    event_picture_url: eventData.event_picture_url,
    created_by: eventData.created_by || 'local_user',
    creator_name: eventData.creator_name || 'Local User',
    created_at: new Date().toISOString(),
    is_private: eventData.is_private || false,
    access_pin: eventData.access_pin,
    attendee_count: 0,
  };

  events.push(newEvent);
  saveLocalEvents(events);
  
  return newEvent;
}

export function updateLocalEvent(id: string, eventData: UpdateEventData): Event | null {
  const events = getLocalEvents();
  const index = events.findIndex(e => e.id === id);
  
  if (index === -1) return null;
  
  events[index] = {
    ...events[index],
    ...eventData,
  };
  
  saveLocalEvents(events);
  return events[index];
}

export function deleteLocalEvent(id: string): boolean {
  const events = getLocalEvents();
  const index = events.findIndex(e => e.id === id);
  
  if (index === -1) return false;
  
  events.splice(index, 1);
  saveLocalEvents(events);
  
  // Also delete associated attendees and notes
  deleteLocalAttendeesByEventId(id);
  
  return true;
}

// ============= LOCAL ATTENDEES STORAGE =============

export function getLocalAttendees(): Attendee[] {
  try {
    const data = localStorage.getItem(ATTENDEES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading attendees from localStorage:', error);
    return [];
  }
}

export function getLocalAttendeesByEvent(eventId: string): Attendee[] {
  const attendees = getLocalAttendees();
  return attendees.filter(a => a.event_id === eventId);
}

export function saveLocalAttendees(attendees: Attendee[]): void {
  try {
    localStorage.setItem(ATTENDEES_KEY, JSON.stringify(attendees));
  } catch (error) {
    console.error('Error saving attendees to localStorage:', error);
  }
}

export function createLocalAttendee(attendeeData: CreateAttendeeData): Attendee {
  const attendees = getLocalAttendees();
  
  const newAttendee: Attendee = {
    id: generateId(),
    event_id: attendeeData.event_id,
    name: attendeeData.name,
    designation: attendeeData.designation,
    company: attendeeData.company,
    industry: attendeeData.industry,
    location: attendeeData.location,
    city: attendeeData.city,
    profile_pic_url: attendeeData.profile_pic_url,
    linkedin_url: attendeeData.linkedin_url,
    key_insights: attendeeData.key_insights,
    event_association: attendeeData.event_association,
    speaker: false,
    competitor: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  attendees.push(newAttendee);
  saveLocalAttendees(attendees);
  
  // Update event attendee count
  updateEventAttendeeCount(attendeeData.event_id);
  
  return newAttendee;
}

export function updateLocalAttendee(id: string, attendeeData: UpdateAttendeeData): Attendee | null {
  const attendees = getLocalAttendees();
  const index = attendees.findIndex(a => a.id === id);
  
  if (index === -1) return null;
  
  attendees[index] = {
    ...attendees[index],
    ...attendeeData,
    updated_at: new Date().toISOString(),
  };
  
  saveLocalAttendees(attendees);
  return attendees[index];
}

export function deleteLocalAttendee(id: string): boolean {
  const attendees = getLocalAttendees();
  const attendee = attendees.find(a => a.id === id);
  
  if (!attendee) return false;
  
  const newAttendees = attendees.filter(a => a.id !== id);
  saveLocalAttendees(newAttendees);
  
  // Update event attendee count
  updateEventAttendeeCount(attendee.event_id);
  
  // Delete associated notes
  deleteLocalNotesByAttendeeId(id);
  
  return true;
}

export function deleteLocalAttendeesByEventId(eventId: string): void {
  const attendees = getLocalAttendees();
  const attendeeIds = attendees.filter(a => a.event_id === eventId).map(a => a.id);
  
  const newAttendees = attendees.filter(a => a.event_id !== eventId);
  saveLocalAttendees(newAttendees);
  
  // Delete associated notes
  attendeeIds.forEach(deleteLocalNotesByAttendeeId);
}

// ============= LOCAL NOTES STORAGE =============

export function getLocalNotes(): AttendeeNote[] {
  try {
    const data = localStorage.getItem(NOTES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading notes from localStorage:', error);
    return [];
  }
}

export function getLocalNotesByAttendee(attendeeId: string): AttendeeNote[] {
  const notes = getLocalNotes();
  return notes.filter(n => n.attendee_id === attendeeId);
}

export function saveLocalNotes(notes: AttendeeNote[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes to localStorage:', error);
  }
}

export function createLocalNote(attendeeId: string, note: string, createdBy?: string): AttendeeNote {
  const notes = getLocalNotes();
  
  const newNote: AttendeeNote = {
    id: generateId(),
    attendee_id: attendeeId,
    note,
    created_by: createdBy || 'local_user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  notes.push(newNote);
  saveLocalNotes(notes);
  
  return newNote;
}

export function updateLocalNote(id: string, note: string): AttendeeNote | null {
  const notes = getLocalNotes();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) return null;
  
  notes[index] = {
    ...notes[index],
    note,
    updated_at: new Date().toISOString(),
  };
  
  saveLocalNotes(notes);
  return notes[index];
}

export function deleteLocalNote(id: string): boolean {
  const notes = getLocalNotes();
  const index = notes.findIndex(n => n.id === id);
  
  if (index === -1) return false;
  
  notes.splice(index, 1);
  saveLocalNotes(notes);
  
  return true;
}

export function deleteLocalNotesByAttendeeId(attendeeId: string): void {
  const notes = getLocalNotes();
  const newNotes = notes.filter(n => n.attendee_id !== attendeeId);
  saveLocalNotes(newNotes);
}

// ============= HELPER FUNCTIONS =============

function updateEventAttendeeCount(eventId: string): void {
  const events = getLocalEvents();
  const event = events.find(e => e.id === eventId);
  
  if (event) {
    const attendees = getLocalAttendeesByEvent(eventId);
    event.attendee_count = attendees.length;
    saveLocalEvents(events);
  }
}
