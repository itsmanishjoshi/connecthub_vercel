/**
 * Application Constants
 * 
 * Centralized configuration and constants for ConnectHub
 */

// Application Metadata
export const APP_NAME = 'ConnectHub';
export const APP_TAGLINE = 'Remember what matters';
export const APP_DESCRIPTION = APP_TAGLINE;
export const APP_VERSION = '2.0.0';

// Cache Durations (in milliseconds)
export const CACHE_DURATIONS = {
  SETTINGS: 5 * 60 * 1000, // 5 minutes
  ATTENDEES: 5 * 60 * 1000, // 5 minutes
  PROFILE: 10 * 60 * 1000, // 10 minutes
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'connecthub_preferences',
  THEME: 'connecthub_theme',
  USER_SCOPE: 'connecthub_user_scope',
  PROFILE_CACHE: 'connecthub_profile_cache',
  SETTINGS_CACHE: 'connecthub_settings_cache',
  ATTENDEE_NOTES: 'connecthub_notes',
  ATTENDEE_STATUSES: 'connecthub_statuses',
  ATTENDEE_STAGES: 'connecthub_stages',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  LOCAL_API_URL: import.meta.env.VITE_API_URL || '',
} as const;

// Event Configuration
// Demo CSV catalogs are not loaded. Events exist only after someone creates them in the UI.

// UI Constants
export const UI = {
  MIN_TOUCH_TARGET: 44, // Minimum touch target size in pixels (WCAG 2.1 AA)
  MOBILE_BREAKPOINT: 640, // sm breakpoint in pixels
  TABLET_BREAKPOINT: 1024, // lg breakpoint in pixels
  MAX_CONTENT_WIDTH: 1280, // max-w-7xl
  HEADER_HEIGHT: {
    MOBILE: 128,
    DESKTOP: 76,
  },
} as const;

// Animation Durations (in milliseconds)
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// Validation Rules
export const VALIDATION = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_NOTE_LENGTH: 5000,
  MAX_NAME_LENGTH: 100,
  MAX_COMPANY_LENGTH: 100,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  FILE_TOO_LARGE: `File size must be less than ${VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB`,
  INVALID_FILE_TYPE: 'Invalid file type. Please upload an image.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVED: 'Changes saved successfully',
  DELETED: 'Deleted successfully',
  EXPORTED: 'Data exported successfully',
  IMPORTED: 'Data imported successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  CONNECT_HUB: '/connect-hub',
  EVENT_HUB: '/connect-hub/hub',
  HR_MEET: '/connect-hub/hr-meet',
  MAINSTREAM: '/connect-hub/mainstream',
  NOT_FOUND: '*',
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_ANALYTICS: false,
  ENABLE_ERROR_REPORTING: false,
  ENABLE_PERFORMANCE_MONITORING: false,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_REAL_TIME_SYNC: true,
} as const;

// Regex Patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]+$/,
  URL: /^https?:\/\/.+/,
} as const;

// Sectors
export const SECTORS = [
  'BFSI',
  'Healthcare',
  'IT',
  'Manufacturing',
  'Retail',
  'Education',
  'Consulting',
  'Real Estate',
  'Automotive',
  'Energy',
  'Telecommunications',
  'Media & Entertainment',
  'Agriculture',
  'Logistics',
  'Hospitality',
] as const;

// Gender Options (for filtering)
export const GENDERS = ['Male', 'Female', 'Unknown'] as const;

// Role Keywords (for search)
export const ROLE_KEYWORDS = [
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'Director',
  'Manager',
  'Founder',
  'Co-Founder',
  'Head',
  'VP',
  'Vice President',
  'President',
  'Lead',
  'Senior',
  'Principal',
] as const;
