import { StatusColor, AttendeeNote, StageValue, STATUS_OPTIONS } from '@/types/attendee';
import { STORAGE_KEYS } from '@/constants';

// Local-only storage helpers
//
// Notes, statuses, and stages are cached in localStorage, scoped per signed-in user id.
// Data stays on this device until synced with the server using the user's auth token.
// The backend enforces user_id on all private tables — other users cannot read your notes.
//
// This means:
// - Data persists across page reloads and browser restarts.
// - Data is isolated per browser profile and per device.
// - Clearing the data requires either using the in-app "reset" controls or
//   manually clearing site data in the browser.
// - There is no way to recover this data from a server once it is deleted
//   locally.

// Scope helpers
const getScope = (): string => {
  if (typeof window === 'undefined') return 'guest';
  const stored = window.localStorage.getItem(STORAGE_KEYS.USER_SCOPE);
  return stored || 'guest';
};

const scopedKey = (baseKey: string): string => {
  return `${baseKey}_${getScope()}`;
};

/**
 * Set user scope for storage isolation
 * Called from AuthContext to keep storage namespaced per auth user / guest
 */
export const setUserScope = (userId: string | null): void => {
  if (typeof window === 'undefined') return;
  const scope = userId ? `user_${userId}` : 'guest';
  window.localStorage.setItem(STORAGE_KEYS.USER_SCOPE, scope);
};

/**
 * Adopt data created before authenticated scopes existed. This only copies into
 * an empty user cache and never removes the guest copy.
 */
export const adoptGuestData = (userId: string): boolean => {
  if (typeof window === 'undefined') return false;
  let copied = false;
  const bases = [
    STORAGE_KEYS.ATTENDEE_NOTES,
    STORAGE_KEYS.ATTENDEE_STATUSES,
    STORAGE_KEYS.ATTENDEE_STAGES,
  ];
  for (const base of bases) {
    const guestKey = `${base}_guest`;
    const userKey = `${base}_user_${userId}`;
    const guestValue = window.localStorage.getItem(guestKey);
    if (guestValue && !window.localStorage.getItem(userKey)) {
      window.localStorage.setItem(userKey, guestValue);
      copied = true;
    }
  }
  return copied;
};

/**
 * Save status colors for an attendee
 */
export const saveStatuses = (attendeeId: string, colors: StatusColor[]): void => {
  const statuses = getStatuses();
  statuses[attendeeId] = colors;
  localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_STATUSES), JSON.stringify(statuses));
};

/**
 * Get status colors for an attendee
 */
export const getStatus = (attendeeId: string): StatusColor[] => {
  const statuses = getStatuses();
  const value = statuses[attendeeId];
  let result: StatusColor[] = [];
  
  if (Array.isArray(value)) {
    result = value;
  } else if (typeof value === 'string') {
    result = [value as StatusColor];
  }
  
  result = result.filter((status) => status in STATUS_OPTIONS);

  return result;
};

/**
 * Get all attendee statuses
 */
export const getStatuses = (): Record<string, StatusColor[] | StatusColor> => {
  try {
    const stored = localStorage.getItem(scopedKey(STORAGE_KEYS.ATTENDEE_STATUSES));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

/**
 * Clear all attendee statuses
 */
export const clearStatuses = (): void => {
  localStorage.removeItem(scopedKey(STORAGE_KEYS.ATTENDEE_STATUSES));
};

/**
 * Save a new note for an attendee
 */
export const saveNote = (note: AttendeeNote): void => {
  const notes = getNotes();
  notes.push(note);
  localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_NOTES), JSON.stringify(notes));
};

/**
 * Get all notes
 */
export const getNotes = (): AttendeeNote[] => {
  const stored = localStorage.getItem(scopedKey(STORAGE_KEYS.ATTENDEE_NOTES));
  return stored ? JSON.parse(stored) : [];
};

/**
 * Get notes for a specific attendee
 */
export const getAttendeeNotes = (attendeeId: string): AttendeeNote[] => {
  return getNotes().filter(note => note.attendeeId === attendeeId);
};

export const replaceAttendeeNotes = (attendeeId: string, incoming: AttendeeNote[]): void => {
  const pendingLocal = getNotes().filter(
    (note) => note.attendeeId === attendeeId && !incoming.some((remote) => remote.id === note.id),
  );
  const otherAttendees = getNotes().filter((note) => note.attendeeId !== attendeeId);
  localStorage.setItem(
    scopedKey(STORAGE_KEYS.ATTENDEE_NOTES),
    JSON.stringify([...otherAttendees, ...incoming, ...pendingLocal]),
  );
};

/**
 * Update an existing note
 */
export const updateNote = (noteId: string, text: string): void => {
  const notes = getNotes();
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx !== -1) {
    notes[idx] = { ...notes[idx], text };
    localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_NOTES), JSON.stringify(notes));
  }
};

/**
 * Delete a note and update status if needed
 */
export const deleteNote = (noteId: string): void => {
  const notes = getNotes();
  const noteToDelete = notes.find(n => n.id === noteId);
  const next = notes.filter(n => n.id !== noteId);
  localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_NOTES), JSON.stringify(next));
  
  // If this was the last note for the attendee, remove 'notes' status
  if (noteToDelete) {
    const remainingNotes = next.filter(n => n.attendeeId === noteToDelete.attendeeId);
    if (remainingNotes.length === 0) {
      const statuses = getStatuses();
      const attendeeStatuses = statuses[noteToDelete.attendeeId];
      if (Array.isArray(attendeeStatuses)) {
        const updatedStatuses = attendeeStatuses.filter(s => s !== 'notes');
        if (updatedStatuses.length > 0) {
          statuses[noteToDelete.attendeeId] = updatedStatuses;
        } else {
          delete statuses[noteToDelete.attendeeId];
        }
      } else if (attendeeStatuses === 'notes') {
        delete statuses[noteToDelete.attendeeId];
      }
      localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_STATUSES), JSON.stringify(statuses));
    }
  }
};

/**
 * Clear all notes
 */
export const clearNotes = (): void => {
  localStorage.removeItem(scopedKey(STORAGE_KEYS.ATTENDEE_NOTES));
};

/**
 * Save stage for an attendee
 */
export const saveStage = (attendeeId: string, stage: StageValue): void => {
  const stages = getStages();
  stages[attendeeId] = stage;
  localStorage.setItem(scopedKey(STORAGE_KEYS.ATTENDEE_STAGES), JSON.stringify(stages));
};

/**
 * Get stage for an attendee
 */
export const getStage = (attendeeId: string): StageValue | undefined => {
  const stages = getStages();
  return stages[attendeeId];
};

/**
 * Get all attendee stages
 */
export const getStages = (): Record<string, StageValue> => {
  const stored = localStorage.getItem(scopedKey(STORAGE_KEYS.ATTENDEE_STAGES));
  return stored ? JSON.parse(stored) : {};
};

/**
 * Clear all attendee stages
 */
export const clearStages = (): void => {
  localStorage.removeItem(scopedKey(STORAGE_KEYS.ATTENDEE_STAGES));
};

/**
 * Clear all attendee data (statuses, notes, stages)
 */
export const clearAllData = (): void => {
  clearStatuses();
  clearNotes();
  clearStages();
};
