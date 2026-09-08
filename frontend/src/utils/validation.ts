/**
 * Validation Utilities
 * 
 * Common validation functions for ConnectHub
 */

import { VALIDATION, PATTERNS } from '@/constants';

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return PATTERNS.EMAIL.test(email);
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  return PATTERNS.PHONE.test(phone);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  return PATTERNS.URL.test(url);
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File): boolean {
  return file.size <= VALIDATION.MAX_FILE_SIZE;
}

/**
 * Validate file type (images only)
 */
export function isValidImageType(file: File): boolean {
  return VALIDATION.ALLOWED_IMAGE_TYPES.includes(file.type);
}

/**
 * Validate image file
 */
export function isValidImage(file: File): { valid: boolean; error?: string } {
  if (!isValidImageType(file)) {
    return { valid: false, error: 'Invalid file type. Please upload an image.' };
  }
  
  if (!isValidFileSize(file)) {
    return { valid: false, error: `File size must be less than ${VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  return { valid: true };
}

/**
 * Validate string length
 */
export function isValidLength(value: string, maxLength: number): boolean {
  return value.length <= maxLength;
}

/**
 * Sanitize string input
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Validate required field
 */
export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}
