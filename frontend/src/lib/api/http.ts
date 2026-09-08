/** Thin HTTP helpers — no business logic. */

export function apiBase(): string {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || json?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return json as T;
}
