/**
 * Authenticated image hook for API-protected photo URLs.
 */
import { useEffect, useState } from 'react';
import { fetchAuthenticatedBlobUrl, needsAuthFetch } from '@/utils/authenticatedImage';

export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const trimmed = url?.trim() || '';
    if (!trimmed) {
      setResolved(null);
      return;
    }

    if (!needsAuthFetch(trimmed)) {
      setResolved(trimmed);
      return;
    }

    fetchAuthenticatedBlobUrl(trimmed).then((blobUrl) => {
      if (cancelled) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      objectUrl = blobUrl;
      setResolved(blobUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return resolved;
}
