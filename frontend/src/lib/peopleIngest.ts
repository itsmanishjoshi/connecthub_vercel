export interface IngestedPerson {
  name: string;
  designation?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  city?: string | null;
  profile_pic_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  key_insights?: string | null;
  ice_breakers?: string | null;
  event_association?: string | null;
  speaker?: boolean;
  competitor?: boolean;
  extra_data?: Record<string, string>;
  status?: 'added' | 'updated';
  id?: string;
  possible_duplicate?: boolean;
  duplicate_with?: string[];
  already_in_event?: boolean;
  ingest_action?: 'add' | 'skip' | 'upsert' | 'update';
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('connecthub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text().catch(() => '')).slice(0, 160);
    if (preview.startsWith('A server') || preview.startsWith('Internal Server')) {
      return 'API server error. The file may be too large for cloud hosting (try CSV under 4 MB).';
    }
    if (response.status === 413) {
      return 'File is too large for cloud import (max about 4 MB). Save as CSV or remove embedded photos.';
    }
    return preview || `${fallback} (HTTP ${response.status})`;
  }
  const json = await response.json().catch(() => ({}));
  return json.error?.message || json.message || fallback;
}

const MAX_CLOUD_UPLOAD_BYTES = 4 * 1024 * 1024;

function assertUploadSize(files: File[] | undefined) {
  const tooLarge = (files || []).find((file) => file.size > MAX_CLOUD_UPLOAD_BYTES);
  if (!tooLarge) return;
  throw new Error(
    `"${tooLarge.name}" is too large for cloud import (${Math.ceil(tooLarge.size / (1024 * 1024))} MB). ` +
      'Use CSV under 4 MB, or remove embedded photos and import photos separately.',
  );
}

export async function extractPeopleFromSources(eventId: string, { text, files }: { text?: string; files?: File[] }) {
  assertUploadSize(files);
  const body = new FormData();
  if (text?.trim()) body.append('text', text.trim());
  (files || []).forEach((file) => body.append('files', file));
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not read people from that source'));
  }
  return (await response.json()) as { people: IngestedPerson[]; warnings: string[] };
}

export async function commitIngestedPeople(eventId: string, people: IngestedPerson[]) {
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/commit`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ people }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not save people'));
  }
  return (await response.json()) as {
    added: number;
    updated: number;
    skipped?: number;
    people: IngestedPerson[];
    photos?: { saved: number; skipped: number; unmatched: string[] };
  };
}

export async function importPhotosFromSpreadsheet(eventId: string, file?: File) {
  if (file) assertUploadSize([file]);
  const body = new FormData();
  if (file) body.append('file', file);
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/import-photos`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not import photos from Excel'));
  }
  return (await response.json()) as {
    saved: number;
    skipped: number;
    unmatched: string[];
    embedded_photos_in_file: number;
    people_in_file: number;
  };
}

export const PEOPLE_TEMPLATE_CSV = `name,company,designation,location,industry,linkedin,photo,website,key_insights,ice_breakers,speaker
Priya Nair,Acme,CFO,Bengaluru,BFSI,https://linkedin.com/in/priya,https://example.com/priya.jpg,https://acme.com,Leads GCC finance transformation,Ask about cricket and GCC talent,false
`;
