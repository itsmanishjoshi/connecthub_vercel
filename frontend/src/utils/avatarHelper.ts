/**
 * Avatar Helper
 * Handles profile photos with server proxy for blocked domains (e.g., LinkedIn)
 */

function isInvalidPhotoValue(value: string): boolean {
  return /^#(?:VALUE|REF|N\/A|NAME|NUM|NULL|DIV\/0)!?$/i.test(value.trim());
}

/**
 * Resolve avatar URL. Protected API paths are fetched via useAuthenticatedImage.
 */
export const getAvatarUrl = (
  _name: string,
  photoUrl?: string | null,
  _attendeeId?: string,
): string | null => {
  const trimmed = photoUrl?.trim() || '';
  if (!trimmed || isInvalidPhotoValue(trimmed)) {
    return null;
  }

  if (trimmed.includes('/api/attendees/') && trimmed.includes('/photo')) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  if (isPhotoUrlBlocked(trimmed)) {
    return getProxiedImageUrl(trimmed);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
};

/**
 * Proxy external images through the API (LinkedIn, etc.)
 */
export const getProxiedImageUrl = (imageUrl: string): string | null => {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({ url: trimmed });
  return `/api/photos/proxy?${params.toString()}`;
};

/**
 * Check if a photo URL is from LinkedIn or other blocked domains
 */
export const isPhotoUrlBlocked = (photoUrl?: string | null): boolean => {
  if (!photoUrl) return false;

  const blockedDomains = ['linkedin.com', 'licdn.com'];
  return blockedDomains.some((domain) => photoUrl.includes(domain));
};
