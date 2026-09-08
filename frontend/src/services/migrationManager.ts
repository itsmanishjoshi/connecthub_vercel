/**
 * Migration Manager
 * Handles one-time data migration from localStorage to Supabase
 */

import * as localStorage from '@/utils/localStorage';
import * as attendeeDataService from './attendeeDataService';

const MIGRATION_FLAG_KEY = 'gcc_connecthub_migration_complete';

export interface MigrationResult {
  success: boolean;
  notesCount: number;
  statusesCount: number;
  stagesCount: number;
  errors: string[];
}

/**
 * Checks if migration is needed
 * Returns true if localStorage has data and migration hasn't been completed
 */
export function checkMigrationNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if migration already completed
  const migrationComplete = window.localStorage.getItem(MIGRATION_FLAG_KEY);
  if (migrationComplete === 'true') {
    return false;
  }
  
  // Check if there's any data in localStorage
  const notes = localStorage.getNotes();
  const statuses = localStorage.getStatuses();
  const stages = localStorage.getStages();
  
  const hasData = notes.length > 0 || 
                  Object.keys(statuses).length > 0 || 
                  Object.keys(stages).length > 0;
  
  return hasData;
}

/**
 * Performs the migration from localStorage to Supabase
 */
export async function performMigration(): Promise<MigrationResult> {
  return await attendeeDataService.migrateFromLocalStorage();
}

/**
 * Marks migration as complete
 */
export function markMigrationComplete(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
}

/**
 * Resets migration flag (for testing purposes)
 */
export function resetMigrationFlag(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(MIGRATION_FLAG_KEY);
}

/**
 * Gets migration statistics without performing migration
 */
export function getMigrationStats(): { notesCount: number; statusesCount: number; stagesCount: number } {
  const notes = localStorage.getNotes();
  const statuses = localStorage.getStatuses();
  const stages = localStorage.getStages();
  
  let statusesCount = 0;
  for (const colors of Object.values(statuses)) {
    statusesCount += Array.isArray(colors) ? colors.length : 1;
  }
  
  return {
    notesCount: notes.length,
    statusesCount,
    stagesCount: Object.keys(stages).length,
  };
}
