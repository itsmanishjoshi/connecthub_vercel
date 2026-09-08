/**
 * Database Type Definitions
 * Maps between database schema and application types
 */

import type { StatusColor, StageValue } from './attendee';

// ============================================================================
// DATABASE TYPES (matching PostgreSQL schema)
// ============================================================================

export interface DbProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  avatar_url: string | null;
  designation: string | null;
  city: string | null;
  mobile_no: string | null;
  linkedin_url: string | null;
  profile_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface DbAttendeeNote {
  id: string;
  user_id: string;
  attendee_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface DbAttendeeStatus {
  id: string;
  user_id: string;
  attendee_id: string;
  status_color: StatusColor;
  created_at: string;
}

export interface DbAttendeeStage {
  id: string;
  user_id: string;
  attendee_id: string;
  stage: StageValue;
  created_at: string;
  updated_at: string;
}

export interface DbPrivateNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// APPLICATION TYPES (used in UI components)
// ============================================================================

export interface AttendeeNote {
  id: string;
  attendeeId: string;
  text: string;
  timestamp: number;
  updatedAt?: string;
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Converts database note to application note
 */
export function dbNoteToAttendeeNote(dbNote: DbAttendeeNote): AttendeeNote {
  return {
    id: dbNote.id,
    attendeeId: dbNote.attendee_id,
    text: dbNote.text,
    timestamp: new Date(dbNote.created_at).getTime(),
    updatedAt: dbNote.updated_at,
  };
}

/**
 * Converts application note to database insert format
 */
export function attendeeNoteToDbInsert(
  note: Omit<AttendeeNote, 'id' | 'timestamp'>,
  userId: string
): Omit<DbAttendeeNote, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    attendee_id: note.attendeeId,
    text: note.text,
  };
}

/**
 * Converts database profile to application profile
 */
export function dbProfileToUserProfile(dbProfile: DbProfile) {
  return {
    id: dbProfile.id,
    email: dbProfile.email,
    firstName: dbProfile.first_name,
    lastName: dbProfile.last_name,
    company: dbProfile.company,
    avatarUrl: dbProfile.avatar_url,
  };
}
