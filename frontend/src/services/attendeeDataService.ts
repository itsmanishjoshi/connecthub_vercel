/**
 * Attendee Data Service
 * Handles all data operations for attendee-related data (notes, statuses, stages)
 * Routes to Supabase for authenticated users, localStorage for guests
 */

import { supabase } from '@/lib/supabaseClient';
import { STATUS_OPTIONS, type StatusColor, type StageValue, type AttendeeNote } from '@/types/attendee';
import type { DbAttendeeNote, DbAttendeeStatus, DbAttendeeStage } from '@/types/database';
import { dbNoteToAttendeeNote, attendeeNoteToDbInsert } from '@/types/database';
import * as localStorage from '@/utils/localStorage';
import { enqueueSync } from './syncQueue';
import { isOffline, notifyLocalSave } from '@/lib/offlineWrite';
import { randomUUID } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationResult {
  success: boolean;
  notesCount: number;
  statusesCount: number;
  stagesCount: number;
  errors: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the current authenticated user ID
 */
async function getCurrentUserId(): Promise<string | null> {
  return window.localStorage.getItem('current_user_id');
}

/**
 * Checks if user is authenticated
 */
async function isAuthenticated(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null && Boolean(window.localStorage.getItem('connecthub_token'));
}

// ============================================================================
// NOTES OPERATIONS
// ============================================================================

/**
 * Get all notes for a specific attendee
 */
export async function getNotes(attendeeId: string): Promise<AttendeeNote[]> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    // Guest mode: use localStorage
    return localStorage.getAttendeeNotes(attendeeId);
  }
  
  // Authenticated mode: fetch from Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('attendee_notes')
      .select('*')
      .eq('user_id', userId)
      .eq('attendee_id', attendeeId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching notes:', error);
      // Fallback to localStorage cache
      return localStorage.getAttendeeNotes(attendeeId);
    }
    
    const notes = (data as DbAttendeeNote[]).map(dbNoteToAttendeeNote);
    
    // Update localStorage cache
    localStorage.replaceAttendeeNotes(attendeeId, notes);
    
    return notes;
  } catch (error) {
    console.error('Error in getNotes:', error);
    return localStorage.getAttendeeNotes(attendeeId);
  }
}

/**
 * Save a new note for an attendee
 */
export async function saveNote(attendeeId: string, text: string): Promise<AttendeeNote> {
  const authenticated = await isAuthenticated();
  
  const newNote: AttendeeNote = {
    id: randomUUID(),
    attendeeId,
    text,
    timestamp: Date.now(),
  };
  
  if (!authenticated) {
    localStorage.saveNote(newNote);
    return newNote;
  }

  // Offline / weak connectivity: save locally and queue for sync (user-scoped, token required to flush).
  if (isOffline()) {
    localStorage.saveNote(newNote);
    enqueueSync({
      type: 'note:create',
      payload: { id: newNote.id, attendeeId, text },
    });
    notifyLocalSave('note');
    return newNote;
  }
  
  // Authenticated mode: save to Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      localStorage.saveNote(newNote);
      return newNote;
    }
    
    const dbInsert = attendeeNoteToDbInsert({ attendeeId, text }, userId);
    
    const { data, error } = await supabase
      .from('attendee_notes')
      .insert(dbInsert)
      .select()
      .single();
    
    if (error) {
      console.error('Error saving note:', error);
      localStorage.saveNote(newNote);
      enqueueSync({
        type: 'note:create',
        payload: { id: newNote.id, attendeeId, text },
      });
      notifyLocalSave('note');
      return newNote;
    }
    
    const savedNote = dbNoteToAttendeeNote(data as DbAttendeeNote);
    
    // Update localStorage cache
    localStorage.saveNote(savedNote);
    
    return savedNote;
  } catch (error) {
    console.error('Error in saveNote:', error);
    localStorage.saveNote(newNote);
    enqueueSync({
      type: 'note:create',
      payload: { id: newNote.id, attendeeId, text },
    });
    notifyLocalSave('note');
    return newNote;
  }
}

/**
 * Update an existing note
 */
export async function updateNote(noteId: string, text: string): Promise<void> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    localStorage.updateNote(noteId, text);
    return;
  }

  if (isOffline()) {
    localStorage.updateNote(noteId, text);
    enqueueSync({ type: 'note:update', payload: { noteId, text } });
    notifyLocalSave('note');
    return;
  }
  
  // Authenticated mode: update in Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      localStorage.updateNote(noteId, text);
      return;
    }
    
    const cached = localStorage.getNotes().find((note) => note.id === noteId);
    const { error } = await supabase
      .from('attendee_notes')
      .update({ text, expected_updated_at: cached?.updatedAt })
      .eq('id', noteId)
      .eq('user_id', userId);
    
    if (error?.code === 'CONFLICT') {
      window.dispatchEvent(new CustomEvent('connecthub:sync-conflict', {
        detail: { type: 'note', id: noteId },
      }));
      enqueueSync({ type: 'note:update', payload: { noteId, text } });
    } else if (error) {
      console.error('Error updating note:', error);
      enqueueSync({ type: 'note:update', payload: { noteId, text } });
      notifyLocalSave('note');
    }
    
    // Update localStorage cache
    localStorage.updateNote(noteId, text);
  } catch (error) {
    console.error('Error in updateNote:', error);
    localStorage.updateNote(noteId, text);
    enqueueSync({ type: 'note:update', payload: { noteId, text } });
    notifyLocalSave('note');
  }
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<void> {
  const authenticated = await isAuthenticated();
  
  console.log('deleteNote called for noteId:', noteId, 'authenticated:', authenticated);
  
  if (!authenticated) {
    localStorage.deleteNote(noteId);
    return;
  }

  if (isOffline()) {
    localStorage.deleteNote(noteId);
    enqueueSync({ type: 'note:delete', payload: { noteId } });
    notifyLocalSave('note');
    return;
  }
  
  // Authenticated mode: delete from Supabase
  try {
    const userId = await getCurrentUserId();
    console.log('Current userId:', userId);
    
    if (!userId) {
      console.log('No userId found, falling back to localStorage');
      localStorage.deleteNote(noteId);
      return;
    }
    
    console.log('Attempting to delete from Supabase...');
    const { error, data } = await supabase
      .from('attendee_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('Error deleting note from Supabase:', error);
      throw error;
    }
    
    console.log('Successfully deleted from Supabase:', data);
    
    // Update localStorage cache
    localStorage.deleteNote(noteId);
    console.log('Also removed from localStorage cache');
  } catch (error) {
    console.error('Error in deleteNote:', error);
    localStorage.deleteNote(noteId);
    enqueueSync({ type: 'note:delete', payload: { noteId } });
    notifyLocalSave('note');
  }
}

// ============================================================================
// STATUSES OPERATIONS
// ============================================================================

/**
 * Get statuses for a specific attendee
 */
export async function getStatuses(attendeeId: string): Promise<StatusColor[]> {
  const map = await getStatusesMap([attendeeId]);
  return map.get(attendeeId) || [];
}

/**
 * Load statuses for many attendees in one request.
 */
export async function getStatusesMap(attendeeIds?: string[]): Promise<Map<string, StatusColor[]>> {
  const result = new Map<string, StatusColor[]>();
  const ids = attendeeIds?.filter(Boolean) ?? [];
  if (ids.length) {
    ids.forEach((id) => result.set(id, []));
  }

  const authenticated = await isAuthenticated();
  if (!authenticated) {
    for (const attendeeId of ids) {
      result.set(attendeeId, localStorage.getStatus(attendeeId));
    }
    return result;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) return result;

    let query = supabase
      .from('attendee_statuses')
      .select('attendee_id, status_color')
      .eq('user_id', userId);

    if (ids.length) {
      query = query.in('attendee_id', ids);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching statuses:', error);
      for (const attendeeId of ids) {
        result.set(attendeeId, localStorage.getStatus(attendeeId));
      }
      return result;
    }

    for (const row of (data as DbAttendeeStatus[])) {
      const attendeeId = String(row.attendee_id);
      const status = row.status_color;
      if (!(status in STATUS_OPTIONS)) continue;
      const current = result.get(attendeeId) || [];
      current.push(status);
      result.set(attendeeId, current);
      localStorage.saveStatuses(attendeeId, current);
    }

    return result;
  } catch (error) {
    console.error('Error in getStatusesMap:', error);
    for (const attendeeId of ids) {
      result.set(attendeeId, localStorage.getStatus(attendeeId));
    }
    return result;
  }
}

/**
 * Save statuses for an attendee
 */
export async function saveStatuses(attendeeId: string, colors: StatusColor[]): Promise<void> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    localStorage.saveStatuses(attendeeId, colors);
    return;
  }

  if (isOffline()) {
    localStorage.saveStatuses(attendeeId, colors);
    enqueueSync({ type: 'statuses:set', payload: { attendeeId, colors } });
    notifyLocalSave('status');
    return;
  }
  
  // Authenticated mode: save to Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      localStorage.saveStatuses(attendeeId, colors);
      return;
    }
    
    // Delete existing statuses for this attendee
    const { error: deleteError } = await supabase
      .from('attendee_statuses')
      .delete()
      .eq('user_id', userId)
      .eq('attendee_id', attendeeId);
    if (deleteError) throw deleteError;
    
    // Insert new statuses
    if (colors.length > 0) {
      const inserts = colors.map(color => ({
        user_id: userId,
        attendee_id: attendeeId,
        status_color: color,
      }));
      
      const { error } = await supabase
        .from('attendee_statuses')
        .insert(inserts);
      
      if (error) {
        throw error;
      }
    }
    
    // Update localStorage cache
    localStorage.saveStatuses(attendeeId, colors);
  } catch (error) {
    console.error('Error in saveStatuses:', error);
    localStorage.saveStatuses(attendeeId, colors);
    enqueueSync({ type: 'statuses:set', payload: { attendeeId, colors } });
    notifyLocalSave('status');
  }
}

// ============================================================================
// STAGES OPERATIONS
// ============================================================================

/**
 * Get stage for a specific attendee
 */
export async function getStage(attendeeId: string): Promise<StageValue | undefined> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    // Guest mode: use localStorage
    return localStorage.getStage(attendeeId);
  }
  
  // Authenticated mode: fetch from Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) return undefined;
    
    const { data, error } = await supabase
      .from('attendee_stages')
      .select('stage')
      .eq('user_id', userId)
      .eq('attendee_id', attendeeId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching stage:', error);
      return localStorage.getStage(attendeeId);
    }
    
    const stage = data ? (data as DbAttendeeStage).stage : undefined;
    
    // Update localStorage cache
    if (stage) {
      localStorage.saveStage(attendeeId, stage);
    }
    
    return stage;
  } catch (error) {
    console.error('Error in getStage:', error);
    return localStorage.getStage(attendeeId);
  }
}

/**
 * Save stage for an attendee
 */
export async function saveStage(attendeeId: string, stage: StageValue): Promise<void> {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    // Guest mode: save to localStorage
    localStorage.saveStage(attendeeId, stage);
    return;
  }
  
  // Authenticated mode: save to Supabase
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      localStorage.saveStage(attendeeId, stage);
      return;
    }
    
    // Upsert (insert or update)
    const { error } = await supabase
      .from('attendee_stages')
      .upsert({
        user_id: userId,
        attendee_id: attendeeId,
        stage,
      }, {
        onConflict: 'user_id,attendee_id',
      });
    
    if (error) {
      throw error;
    }
    
    // Update localStorage cache
    localStorage.saveStage(attendeeId, stage);
  } catch (error) {
    console.error('Error in saveStage:', error);
    localStorage.saveStage(attendeeId, stage);
    enqueueSync({ type: 'stage:set', payload: { attendeeId, stage } });
  }
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate data from localStorage to Supabase
 */
export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    notesCount: 0,
    statusesCount: 0,
    stagesCount: 0,
    errors: [],
  };
  
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      result.errors.push('User not authenticated');
      return result;
    }
    
    // Migrate notes
    const notes = localStorage.getNotes();
    for (const note of notes) {
      try {
        const dbInsert = attendeeNoteToDbInsert(note, userId);
        const { error } = await supabase.from('attendee_notes').upsert(dbInsert);
        if (error) throw error;
        result.notesCount++;
      } catch (error) {
        result.errors.push(`Failed to migrate note ${note.id}: ${error}`);
      }
    }
    
    // Migrate statuses
    const statuses = localStorage.getStatuses();
    for (const [attendeeId, colors] of Object.entries(statuses)) {
      try {
        const colorArray = Array.isArray(colors) ? colors : [colors];
        const inserts = colorArray.map(color => ({
          user_id: userId,
          attendee_id: attendeeId,
          status_color: color,
        }));
        const { error: deleteError } = await supabase
          .from('attendee_statuses')
          .delete()
          .eq('user_id', userId)
          .eq('attendee_id', attendeeId);
        if (deleteError) throw deleteError;
        const { error } = await supabase.from('attendee_statuses').insert(inserts);
        if (error) throw error;
        result.statusesCount += colorArray.length;
      } catch (error) {
        result.errors.push(`Failed to migrate statuses for ${attendeeId}: ${error}`);
      }
    }
    
    // Migrate stages
    const stages = localStorage.getStages();
    for (const [attendeeId, stage] of Object.entries(stages)) {
      try {
        const { error } = await supabase.from('attendee_stages').upsert({
          user_id: userId,
          attendee_id: attendeeId,
          stage,
        }, {
          onConflict: 'user_id,attendee_id',
        });
        if (error) throw error;
        result.stagesCount++;
      } catch (error) {
        result.errors.push(`Failed to migrate stage for ${attendeeId}: ${error}`);
      }
    }
    
    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
    return result;
  }
}

export async function migrateLocalDataOnce(userId: string): Promise<void> {
  const marker = `connecthub_local_migration_v1_${userId}`;
  if (window.localStorage.getItem(marker)) return;
  const result = await migrateFromLocalStorage();
  if (result.success) {
    window.localStorage.setItem(marker, new Date().toISOString());
  } else if (result.errors.length) {
    console.warn('Local data migration remains pending:', result.errors);
  }
}

// ============================================================================
// INSIGHTS OPERATIONS
// ============================================================================

/**
 * Get insights for a specific attendee (global - visible to all users)
 */
export async function getInsights(attendeeId: string): Promise<string | null> {
  try {
    console.log('Loading insights for attendee:', attendeeId);
    
    const { data, error } = await supabase
      .from('attendee_insights')
      .select('insights')
      .eq('attendee_id', attendeeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching insights:', error);
      return null;
    }

    console.log('Insights loaded:', data?.insights || 'No insights found');
    return data?.insights || null;
  } catch (error) {
    console.error('Error in getInsights:', error);
    return null;
  }
}

/**
 * Save or update directory insights for an attendee (visible to everyone on the event).
 * Personal meeting notes belong in attendee_notes, not here.
 */
export async function saveInsights(attendeeId: string, insights: string): Promise<boolean> {
  try {
    // Get current user from Supabase auth
    const userId = window.localStorage.getItem('current_user_id') || 'anonymous';
    
    console.log('Saving insights:', { attendeeId, insights, userId });

    const { data, error } = await supabase
      .from('attendee_insights')
      .upsert({
        attendee_id: attendeeId,
        insights: insights,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        created_by: userId,
      }, {
        onConflict: 'attendee_id'
      })
      .select();

    if (error) {
      console.error('Error saving insights:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('Insights saved successfully:', data);
    return true;
  } catch (error) {
    console.error('Error in saveInsights:', error);
    return false;
  }
}

// ============================================================================
// SPEAKER/COMPETITOR OPERATIONS (PUBLIC - VISIBLE TO ALL USERS)
// ============================================================================

/**
 * Toggle speaker status for an attendee (PUBLIC - affects all users)
 */
export async function toggleSpeaker(attendeeId: string, isSpeaker: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('attendees')
      .update({ speaker: isSpeaker })
      .eq('id', attendeeId);
    
    if (error) {
      console.error('Error toggling speaker status:', error);
      throw error;
    }
    
    console.log(`✅ Speaker status updated GLOBALLY for ${attendeeId}: ${isSpeaker}`);
  } catch (error) {
    console.error('Error in toggleSpeaker:', error);
    throw error;
  }
}

/**
 * Toggle competitor status for an attendee (PUBLIC - affects all users)
 */
export async function toggleCompetitor(attendeeId: string, isCompetitor: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('attendees')
      .update({ competitor: isCompetitor })
      .eq('id', attendeeId);
    
    if (error) {
      console.error('Error toggling competitor status:', error);
      throw error;
    }
    
    console.log(`✅ Competitor status updated GLOBALLY for ${attendeeId}: ${isCompetitor}`);
  } catch (error) {
    console.error('Error in toggleCompetitor:', error);
    throw error;
  }
}
