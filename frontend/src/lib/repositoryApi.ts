import { fileKindFromName, isRepositoryIndustryId, type RepositoryFileKind, type RepositoryIndustryId } from './repositoryIndustries';

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('connecthub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface RepositoryFile {
  name: string;
  url: string;
  kind: RepositoryFileKind;
  source: 'packaged' | 'uploaded';
  size?: number;
}

export async function listRepositoryFiles(industry: RepositoryIndustryId): Promise<RepositoryFile[]> {
  const response = await fetch(`${apiBase()}/api/repository/${industry}/files`, { headers: authHeaders() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not load files');
  return (json.files || []).map((file: RepositoryFile) => ({
    ...file,
    kind: file.kind || fileKindFromName(file.name),
  }));
}

export async function uploadRepositoryFile(industry: RepositoryIndustryId, file: File): Promise<RepositoryFile> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${apiBase()}/api/repository/${industry}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not upload that file');
  return json.file;
}

export async function removeRepositoryFile(industry: RepositoryIndustryId, name: string) {
  const response = await fetch(`${apiBase()}/api/repository/${industry}/files`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Could not remove that file');
}

export function industryFromUnknown(value: string | null | undefined): RepositoryIndustryId | null {
  if (!value) return null;
  return isRepositoryIndustryId(value) ? value : null;
}
