/** Thin HTTP helpers — no business logic. */

const DEFAULT_TIMEOUT_MS = 20_000;

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

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Check that the ConnectHub server is running.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetchWithTimeout(
    `${apiBase()}${path}`,
    {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeaders(),
        ...(init.headers || {}),
      },
    },
    timeoutMs,
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || json?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return json as T;
}
