function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('connecthub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson(response: Response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Request failed');
  return json;
}

const mediaTokenCache = new Map<string, string>();

export async function assetContentUrl(id: string, download = false) {
  const cacheKey = `${id}:${download ? '1' : '0'}`;
  if (mediaTokenCache.has(cacheKey)) {
    return mediaTokenCache.get(cacheKey)!;
  }
  const response = await fetch(`${apiBase()}/api/assets/items/${id}/content${download ? '?download=1' : ''}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Could not load asset');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  mediaTokenCache.set(cacheKey, url);
  return url;
}

export async function listAssetLibraries() {
  const json = await readJson(await fetch(`${apiBase()}/api/assets/libraries`, { headers: authHeaders() }));
  return json.libraries as Array<{
    id: string;
    slug: string;
    name: string;
    kind: string;
    description?: string;
    restricted: boolean;
    role: string;
  }>;
}

export async function listAssetContents(slug: string, folderId?: string | null) {
  const qs = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  return readJson(await fetch(`${apiBase()}/api/assets/libraries/${slug}/contents${qs}`, { headers: authHeaders() }));
}

export async function createAssetFolder(slug: string, name: string, parentId?: string | null) {
  const json = await readJson(
    await fetch(`${apiBase()}/api/assets/libraries/${slug}/folders`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null }),
    })
  );
  return json.folder;
}

export async function renameAssetFolder(id: string, name: string) {
  const json = await readJson(
    await fetch(`${apiBase()}/api/assets/folders/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  );
  return json.folder;
}

export async function deleteAssetFolder(id: string) {
  await readJson(await fetch(`${apiBase()}/api/assets/folders/${id}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function uploadAssetItem(slug: string, file: File, folderId?: string | null) {
  const body = new FormData();
  body.append('file', file);
  if (folderId) body.append('folderId', folderId);
  const json = await readJson(
    await fetch(`${apiBase()}/api/assets/libraries/${slug}/items`, { method: 'POST', headers: authHeaders(), body })
  );
  return json.item;
}

export async function renameAssetItem(id: string, name: string) {
  const json = await readJson(
    await fetch(`${apiBase()}/api/assets/items/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  );
  return json.item;
}

export async function deleteAssetItem(id: string) {
  await readJson(await fetch(`${apiBase()}/api/assets/items/${id}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function searchAssetPeople(q: string) {
  const json = await readJson(
    await fetch(`${apiBase()}/api/assets/people?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
  );
  return json.people as Array<{ id: string; username: string; first_name?: string; last_name?: string }>;
}

export async function listAssetAccess(slug: string) {
  return readJson(await fetch(`${apiBase()}/api/assets/libraries/${slug}/access`, { headers: authHeaders() }));
}

export async function grantAssetAccess(slug: string, body: { userId: string; role: string; folderId?: string | null }) {
  await readJson(
    await fetch(`${apiBase()}/api/assets/libraries/${slug}/access`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

export async function setLibraryRestricted(slug: string, restricted: boolean) {
  await readJson(
    await fetch(`${apiBase()}/api/assets/libraries/${slug}/access`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ restricted }),
    })
  );
}

export async function revokeAssetAccess(id: string) {
  await readJson(await fetch(`${apiBase()}/api/assets/access/${id}`, { method: 'DELETE', headers: authHeaders() }));
}
