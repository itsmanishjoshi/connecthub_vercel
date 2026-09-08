import { supabase } from './supabaseClient';
import { readSnapshot, saveSnapshot, type CachedValue } from './offlineStore';

export interface ReadResult<T> {
  data: T;
  source: 'network' | 'cache';
  cachedAt?: number;
}

const eventListKey = 'events:list';
const eventSlugKey = (slug: string) => `events:slug:${slug}`;
const attendeesKey = (eventId: string) => `attendees:event:${eventId}`;

function cacheEvents(events: Event[]): void {
  void saveSnapshot(eventListKey, events).catch(() => {});
  void Promise.all(events.map((event) => saveSnapshot(eventSlugKey(event.slug), event))).catch(() => {});
}

export async function readCachedEvents(): Promise<CachedValue<Event[]> | null> {
  return readSnapshot(eventListKey);
}

export async function readCachedEventBySlug(slug: string): Promise<CachedValue<Event> | null> {
  return readSnapshot(eventSlugKey(slug));
}

export async function readCachedAttendees(eventId: string): Promise<CachedValue<Attendee[]> | null> {
  return readSnapshot(attendeesKey(eventId));
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  date?: string;
  place?: string;
  event_picture_url?: string;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  attendee_count?: number;
  is_private?: boolean;
  access_pin?: string;
  has_door_code?: boolean;
  access_role?: 'view' | 'edit' | null;
  can_edit?: boolean;
}

export interface Attendee {
  id: string;
  event_id: string;
  name: string;
  designation?: string;
  company?: string;
  industry?: string;
  location?: string;
  city?: string;
  profile_pic_url?: string;
  linkedin_url?: string;
  key_insights?: string;
  ice_breakers?: string;
  website_url?: string;
  extra_data?: Record<string, string>;
  event_association?: string;
  speaker?: boolean;
  competitor?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendeeNote {
  id: string;
  attendee_id: string;
  note: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  name: string;
  slug: string;
  date?: string;
  place?: string;
  event_picture_url?: string;
  created_by?: string;
  creator_name?: string;
  is_private?: boolean;
  access_pin?: string;
}

export interface UpdateEventData {
  name?: string;
  slug?: string;
  date?: string;
  place?: string;
  event_picture_url?: string;
  is_private?: boolean;
  access_pin?: string;
}

export interface CreateAttendeeData {
  event_id: string;
  name: string;
  designation?: string;
  company?: string;
  industry?: string;
  location?: string;
  city?: string;
  profile_pic_url?: string;
  linkedin_url?: string;
  website_url?: string;
  key_insights?: string;
  ice_breakers?: string;
  extra_data?: Record<string, string>;
  event_association?: string;
  speaker?: boolean;
  competitor?: boolean;
}

export interface UpdateAttendeeData {
  name?: string;
  designation?: string;
  company?: string;
  industry?: string;
  location?: string;
  city?: string;
  profile_pic_url?: string;
  linkedin_url?: string;
  website_url?: string;
  key_insights?: string;
  ice_breakers?: string;
  extra_data?: Record<string, string>;
  event_association?: string;
  speaker?: boolean;
  competitor?: boolean;
}

export async function verifyEventPin(eventId: string, pin: string): Promise<boolean> {
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const token = localStorage.getItem('connecthub_token');
  const response = await fetch(`${apiBase}/api/events/${eventId}/verify-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pin }),
  });
  return response.ok;
}

// ============= EVENT OPERATIONS =============

// Fetch all events with attendee counts
export async function fetchEvents(): Promise<Event[]> {
  return (await fetchEventsWithSource()).data;
}

export async function fetchEventsWithSource(): Promise<ReadResult<Event[]>> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, attendees(count)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    // Sort by created_at date (newest first)
    const events = (data || []).map((event: any) => ({
      ...event,
      attendee_count: event.attendees?.[0]?.count || 0,
    })).sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Newest first
    });
    cacheEvents(events);
    return { data: events, source: 'network' };
  } catch (error) {
    console.error('Failed to fetch shared events:', error);
    const cached = await readSnapshot<Event[]>(eventListKey);
    if (cached) return { data: cached.data, source: 'cache', cachedAt: cached.savedAt };
    throw error;
  }
}

// Fetch single event by slug
export async function fetchEventBySlug(slug: string): Promise<Event | null> {
  return (await fetchEventBySlugWithSource(slug)).data;
}

export async function fetchEventBySlugWithSource(slug: string): Promise<ReadResult<Event | null> & { locked?: Event }> {
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const token = localStorage.getItem('connecthub_token');
  try {
    const response = await fetch(`${apiBase}/api/events/by-slug/${encodeURIComponent(slug)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await response.json().catch(() => ({}));
    if (response.status === 403 && json.error?.code === 'EVENT_LOCKED') {
      return { data: null, source: 'network', locked: json.event };
    }
    if (!response.ok) {
      throw new Error(json.error?.message || 'Event not found');
    }
    const event = json.data || null;
    if (event) void saveSnapshot(eventSlugKey(slug), event).catch(() => {});
    return { data: event, source: 'network' };
  } catch (error) {
    console.error('Error fetching event:', error);
    const cached = await readSnapshot<Event>(eventSlugKey(slug));
    if (cached) return { data: cached.data, source: 'cache', cachedAt: cached.savedAt };
    throw error;
  }
}

// Fetch single event by ID
export async function fetchEventById(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return null;
  }

  return data;
}

// Create a new event
export async function createEvent(eventData: CreateEventData): Promise<Event> {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
      .single();

    if (error) {
      console.error('Error creating event on Supabase:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create shared event:', error);
    throw error;
  }
}

// Update an event
export async function updateEvent(id: string, eventData: UpdateEventData): Promise<Event> {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update shared event:', error);
    throw error;
  }
}

// Delete an event
export async function deleteEvent(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete shared event:', error);
    throw error;
  }
}

// ============= ATTENDEE OPERATIONS =============

// Fetch attendees for an event
export async function fetchAttendeesByEvent(eventId: string): Promise<Attendee[]> {
  return (await fetchAttendeesByEventWithSource(eventId)).data;
}

export async function fetchAttendeesByEventWithSource(eventId: string): Promise<ReadResult<Attendee[]>> {
  try {
    const { data, error } = await supabase
      .from('attendees')
      .select('*')
      .eq('event_id', eventId)
      .order('name', { ascending: true });

    if (error) throw error;
    const attendees = data || [];
    void saveSnapshot(attendeesKey(eventId), attendees).catch(() => {});
    return { data: attendees, source: 'network' };
  } catch (error) {
    console.error('Error fetching attendees:', error);
    const cached = await readSnapshot<Attendee[]>(attendeesKey(eventId));
    if (cached) return { data: cached.data, source: 'cache', cachedAt: cached.savedAt };
    throw error;
  }
}

// Create a single attendee
export async function createAttendee(attendeeData: CreateAttendeeData): Promise<Attendee> {
  const { data, error } = await supabase
    .from('attendees')
    .insert([attendeeData])
    .select()
    .single();

  if (error) {
    console.error('Error creating attendee:', error);
    throw error;
  }

  return data;
}

// Update an attendee
export async function updateAttendee(id: string, attendeeData: UpdateAttendeeData): Promise<Attendee> {
  const { data, error } = await supabase
    .from('attendees')
    .update(attendeeData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating attendee:', error);
    throw error;
  }

  return data;
}

// Delete an attendee
export async function deleteAttendee(id: string): Promise<void> {
  const { error } = await supabase
    .from('attendees')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting attendee:', error);
    throw error;
  }
}

// Bulk insert attendees
export async function bulkInsertAttendees(attendees: CreateAttendeeData[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('attendees')
      .insert(attendees);

    if (error) {
      console.error('Error inserting attendees:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to insert shared attendees:', error);
    throw error;
  }
}

// ============= NOTES OPERATIONS =============

// Fetch notes for an attendee
export async function fetchNotesByAttendee(attendeeId: string): Promise<AttendeeNote[]> {
  const { data, error } = await supabase
    .from('attendee_notes')
    .select('*')
    .eq('attendee_id', attendeeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }

  return data || [];
}

// Create a note
export async function createNote(attendeeId: string, note: string): Promise<AttendeeNote> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('attendee_notes')
      .insert([{
        attendee_id: attendeeId,
        note,
        created_by: user?.id,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create attendee note:', error);
    throw error;
  }
}

// Update a note
export async function updateNote(id: string, note: string): Promise<AttendeeNote> {
  try {
    const { data, error } = await supabase
      .from('attendee_notes')
      .update({ note })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating note:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update attendee note:', error);
    throw error;
  }
}

// Delete a note
export async function deleteNote(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('attendee_notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete attendee note:', error);
    throw error;
  }
}

// ============= FILE UPLOAD OPERATIONS =============

// Upload event picture
export async function uploadEventPicture(file: File, eventId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${eventId}-${Date.now()}.${fileExt}`;
  const filePath = `events/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('event-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error('Error uploading event picture:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  console.log('Upload successful:', uploadData);

  const { data } = supabase.storage
    .from('event-images')
    .getPublicUrl(filePath);

  console.log('Public URL:', data.publicUrl);

  return data.publicUrl;
}

// Upload profile picture
export async function uploadProfilePicture(file: File, attendeeId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${attendeeId}-${Date.now()}.${fileExt}`;
  const filePath = `profiles/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('profile-pictures')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading profile picture:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
