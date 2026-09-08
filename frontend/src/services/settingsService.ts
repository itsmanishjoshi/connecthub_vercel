/**
 * Settings Service
 * 
 * Manages user settings and preferences with local and remote storage
 */

import { supabase } from '@/lib/supabaseClient';
import { STORAGE_KEYS, CACHE_DURATIONS } from '@/constants';
import type {
  UserPreferences,
  SettingsValidationResult,
  Theme,
  Density,
  FontSize,
  ProfileVisibility,
} from '@/types/settings';
import { DEFAULT_PREFERENCES } from '@/types/settings';
import { enqueueSync } from './syncQueue';

interface CachedSettings {
  data: UserPreferences;
  timestamp: number;
  userId: string | null;
}

let settingsCache: CachedSettings | null = null;

const preferencesStorageKey = (userId: string | null) =>
  `${STORAGE_KEYS.USER_PREFERENCES}_${userId || 'guest'}`;

/**
 * Load user settings from storage
 * Priority: Cache > Remote (Supabase) > Local (localStorage) > Defaults
 */
export async function loadSettings(userId: string | null): Promise<UserPreferences> {
  // Return cached settings if valid
  if (
    settingsCache &&
    settingsCache.userId === userId &&
    Date.now() - settingsCache.timestamp < CACHE_DURATIONS.SETTINGS
  ) {
    return settingsCache.data;
  }

  // Try loading from Supabase for authenticated users
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const preferences = {
          ...mapDatabaseToPreferences(data),
          updatedAt: data.updated_at as string | undefined,
        } as UserPreferences & { updatedAt?: string };
        settingsCache = { data: preferences, timestamp: Date.now(), userId };
        return preferences;
      }
    } catch (error) {
      console.error('Error loading settings from Supabase:', error);
    }
  }

  // Fall back to localStorage
  try {
    const stored = localStorage.getItem(preferencesStorageKey(userId));
    if (stored) {
      const preferences = { ...JSON.parse(stored), theme: 'dark' as Theme } as UserPreferences;
      settingsCache = { data: preferences, timestamp: Date.now(), userId };
      return preferences;
    }
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
  }

  // Return defaults
  return DEFAULT_PREFERENCES;
}

/**
 * Save user settings to storage
 * Saves to both local and remote storage for authenticated users
 */
export async function saveSettings(
  userId: string | null,
  preferences: Partial<UserPreferences>
): Promise<void> {
  // Merge with existing preferences
  const current = settingsCache?.data || DEFAULT_PREFERENCES;
  const updated: UserPreferences = {
    ...current,
    ...preferences,
    notifications: { ...current.notifications, ...preferences.notifications },
    display: { ...current.display, ...preferences.display },
    privacy: { ...current.privacy, ...preferences.privacy },
  };

  // Validate settings
  const validation = validateSettings(updated);
  if (!validation.valid) {
    throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
  }

  // Update cache
  settingsCache = { data: updated, timestamp: Date.now(), userId };

  // Save to localStorage
  try {
    localStorage.setItem(preferencesStorageKey(userId), JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }

  // Save to Supabase for authenticated users
  if (userId) {
    const dbData = mapPreferencesToDatabase(updated);
    const updatedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...dbData,
          updated_at: updatedAt,
          expected_updated_at: (settingsCache?.data as UserPreferences & { updatedAt?: string })?.updatedAt,
        });

      if (error?.code === 'CONFLICT') {
        window.dispatchEvent(new CustomEvent('connecthub:sync-conflict', {
          detail: { type: 'preferences' },
        }));
        enqueueSync({ type: 'preferences:set', payload: { data: dbData, updatedAt } });
      } else if (error) {
        console.error('Error saving settings to Supabase:', error);
        enqueueSync({ type: 'preferences:set', payload: { data: dbData, updatedAt } });
      }
    } catch (error) {
      console.error('Error saving settings to Supabase:', error);
      enqueueSync({ type: 'preferences:set', payload: { data: dbData, updatedAt } });
    }
  }
}

/**
 * Get default settings
 */
export function getDefaults(): UserPreferences {
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Validate settings
 */
export function validateSettings(preferences: Partial<UserPreferences>): SettingsValidationResult {
  const errors: string[] = [];

  // Validate theme (dark-only app)
  if (preferences.theme && preferences.theme !== 'dark') {
    errors.push('Invalid theme value');
  }

  // Validate display preferences
  if (preferences.display) {
    if (preferences.display.density && !['comfortable', 'compact'].includes(preferences.display.density)) {
      errors.push('Invalid density value');
    }
    if (preferences.display.fontSize && !['small', 'medium', 'large'].includes(preferences.display.fontSize)) {
      errors.push('Invalid fontSize value');
    }
  }

  // Validate privacy preferences
  if (preferences.privacy) {
    if (preferences.privacy.profileVisibility && !['public', 'private'].includes(preferences.privacy.profileVisibility)) {
      errors.push('Invalid profileVisibility value');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge settings with conflict resolution
 * Local preferences override remote preferences
 */
export function mergeSettings(
  local: UserPreferences,
  remote: UserPreferences
): UserPreferences {
  return {
    ...remote,
    ...local,
    notifications: { ...remote.notifications, ...local.notifications },
    display: { ...remote.display, ...local.display },
    privacy: { ...remote.privacy, ...local.privacy },
  };
}

/**
 * Clear settings cache
 */
export function clearCache(): void {
  settingsCache = null;
}

/**
 * Map database row to UserPreferences
 */
function mapDatabaseToPreferences(data: Record<string, unknown>): UserPreferences {
  return {
    theme: 'dark',
    notifications: {
      enabled: data.notifications_enabled as boolean,
      email: data.notifications_email as boolean,
      push: data.notifications_push as boolean,
      sound: data.notifications_sound as boolean,
      types: {
        mentions: data.notifications_mentions as boolean,
        updates: data.notifications_updates as boolean,
        reminders: data.notifications_reminders as boolean,
      },
    },
    display: {
      density: data.display_density as Density,
      fontSize: data.display_font_size as FontSize,
      animations: data.display_animations as boolean,
      reducedMotion: data.display_reduced_motion as boolean,
    },
    privacy: {
      profileVisibility: data.privacy_profile_visibility as ProfileVisibility,
      showEmail: data.privacy_show_email as boolean,
      showCompany: data.privacy_show_company as boolean,
    },
  };
}

/**
 * Map UserPreferences to database row
 */
function mapPreferencesToDatabase(preferences: UserPreferences): Record<string, unknown> {
  return {
    theme: preferences.theme,
    notifications_enabled: preferences.notifications.enabled,
    notifications_email: preferences.notifications.email,
    notifications_push: preferences.notifications.push,
    notifications_sound: preferences.notifications.sound,
    notifications_mentions: preferences.notifications.types.mentions,
    notifications_updates: preferences.notifications.types.updates,
    notifications_reminders: preferences.notifications.types.reminders,
    display_density: preferences.display.density,
    display_font_size: preferences.display.fontSize,
    display_animations: preferences.display.animations,
    display_reduced_motion: preferences.display.reducedMotion,
    privacy_profile_visibility: preferences.privacy.profileVisibility,
    privacy_show_email: preferences.privacy.showEmail,
    privacy_show_company: preferences.privacy.showCompany,
  };
}
