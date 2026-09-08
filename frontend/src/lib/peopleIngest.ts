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

export async function extractPeopleFromSources(eventId: string, { text, files }: { text?: string; files?: File[] }) {
  const body = new FormData();
  if (text?.trim()) body.append('text', text.trim());
  (files || []).forEach((file) => body.append('files', file));
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/extract`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || 'Could not read people from that source');
  }
  return json as { people: IngestedPerson[]; warnings: string[] };
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
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || 'Could not save people');
  }
  return json as {
    added: number;
    updated: number;
    skipped?: number;
    people: IngestedPerson[];
    photos?: { saved: number; skipped: number; unmatched: string[] };
  };
}

export async function importPhotosFromSpreadsheet(eventId: string, file?: File) {
  const body = new FormData();
  if (file) body.append('file', file);
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/import-photos`, {
    method: 'POST',
    headers: authHeaders(),
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error?.message || 'Could not import photos from Excel');
  }
  return json as {
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
