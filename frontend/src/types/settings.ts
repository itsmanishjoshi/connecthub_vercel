/**
 * User Settings and Preferences Types
 * 
 * Defines all user-configurable settings for ConnectHub
 */

export type Theme = 'dark';
export type Density = 'comfortable' | 'compact';
export type FontSize = 'small' | 'medium' | 'large';
export type ProfileVisibility = 'public' | 'private';

export interface NotificationPreferences {
  enabled: boolean;
  email: boolean;
  push: boolean;
  sound: boolean;
  types: {
    mentions: boolean;
    updates: boolean;
    reminders: boolean;
  };
}

export interface DisplayPreferences {
  density: Density;
  fontSize: FontSize;
  animations: boolean;
  reducedMotion: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: ProfileVisibility;
  showEmail: boolean;
  showCompany: boolean;
}

export interface UserPreferences {
  theme: Theme;
  notifications: NotificationPreferences;
  display: DisplayPreferences;
  privacy: PrivacyPreferences;
}

export interface UserSettings {
  userId: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  notifications: {
    enabled: true,
    email: true,
    push: false,
    sound: true,
    types: {
      mentions: true,
      updates: true,
      reminders: true,
    },
  },
  display: {
    density: 'comfortable',
    fontSize: 'medium',
    animations: true,
    reducedMotion: false,
  },
  privacy: {
    profileVisibility: 'public',
    showEmail: false,
    showCompany: true,
  },
};
