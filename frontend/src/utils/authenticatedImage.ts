/**
 * Fetch protected API images with Authorization header (no token in URL).
 */

function authToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('connecthub_token');
}

function needsAuthFetch(url: string): boolean {
  if (url.includes('/uploads/event-images/')) return false;
  return url.includes('/api/attendees/') && url.includes('/photo')
    || url.includes('/api/photos/proxy')
    || url.startsWith('/uploads/');
}

export async function fetchAuthenticatedBlobUrl(url: string): Promise<string | null> {
  const token = authToken();
  if (!token) return null;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'same-origin',
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function resolveProtectedImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() || '';
  if (!trimmed) return null;
  if (needsAuthFetch(trimmed)) return trimmed;
  return trimmed;
}

export { needsAuthFetch };
