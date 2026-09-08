import {
  CLOUD_UPLOAD_LIMIT_BYTES,
  formatFileSize,
  parseSpreadsheetFile,
  shouldParseSpreadsheetLocally,
} from './spreadsheetIngest';
import { fetchWithTimeout } from './api/http';

const INGEST_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

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
      return 'API server error. Try reading the roster in your browser (Excel/CSV) or use a smaller file.';
    }
    if (response.status === 413) {
      return 'File is too large to upload. Roster data is read in your browser for large Excel files; use Import photos separately.';
    }
    return preview || `${fallback} (HTTP ${response.status})`;
  }
  const json = await response.json().catch(() => ({}));
  return json.error?.message || json.message || fallback;
}

async function previewIngestedPeople(eventId: string, people: IngestedPerson[]) {
  const response = await fetch(`${apiBase()}/api/events/${eventId}/people/preview`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ people }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not prepare roster for import'));
  }
  return (await response.json()) as { people: IngestedPerson[]; warnings: string[] };
}

async function requestIngestUploadUrl(eventId: string, file: File) {
  const response = await fetchWithTimeout(
    `${apiBase()}/api/events/${eventId}/people/ingest-upload-url`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        fileSize: file.size,
        purpose: 'photos',
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not start cloud upload'));
  }
  return (await response.json()) as {
    signedUrl: string;
    token: string;
    storagePath: string;
  };
}

async function uploadFileToSignedUrl(file: File, signedUrl: string, token: string) {
  const response = await fetchWithTimeout(
    signedUrl,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type':
          file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'x-upsert': 'true',
      },
      body: file,
    },
    INGEST_UPLOAD_TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 160);
    throw new Error(
      detail
        ? `Cloud upload failed: ${detail}`
        : 'Cloud upload failed. Check Supabase Storage settings in Vercel and try again.',
    );
  }
}

export async function uploadSpreadsheetViaSupabase(eventId: string, file: File) {
  const { signedUrl, token, storagePath } = await requestIngestUploadUrl(eventId, file);
  await uploadFileToSignedUrl(file, signedUrl, token);
  return storagePath;
}

async function parseSpreadsheetsLocally(eventId: string, uploadFiles: File[]) {
  const localPeople: IngestedPerson[] = [];
  for (const file of uploadFiles) {
    localPeople.push(...(await parseSpreadsheetFile(file)));
  }
  if (!localPeople.length) {
    throw new Error('No people were found in that spreadsheet. Check column headers (Name, Company, Title).');
  }
  const largest = Math.max(...uploadFiles.map((file) => file.size));
  const preview = await previewIngestedPeople(eventId, localPeople);
  const warnings = [...(preview.warnings || [])];
  if (largest > CLOUD_UPLOAD_LIMIT_BYTES) {
    warnings.unshift(
      `${uploadFiles.map((file) => file.name).join(', ')} (${formatFileSize(largest)}) was read in your browser. Save the roster, then use Import photos from Excel — large files upload via Supabase Storage.`,
    );
  } else {
    warnings.unshift('Roster parsed locally from Excel/CSV.');
  }
  return { people: preview.people, warnings };
}

export async function extractPeopleFromSources(eventId: string, { text, files }: { text?: string; files?: File[] }) {
  const uploadFiles = files || [];

  if (shouldParseSpreadsheetLocally(uploadFiles) && !text?.trim()) {
    return parseSpreadsheetsLocally(eventId, uploadFiles);
  }

  const tooLarge = uploadFiles.find((file) => file.size > CLOUD_UPLOAD_LIMIT_BYTES);
  if (tooLarge) {
    if (shouldParseSpreadsheetLocally(uploadFiles)) {
      return parseSpreadsheetsLocally(eventId, uploadFiles);
    }
    throw new Error(
      `"${tooLarge.name}" is too large for cloud import (${formatFileSize(tooLarge.size)}). ` +
        'Use a smaller file, or save roster data as CSV.',
    );
  }

  const body = new FormData();
  if (text?.trim()) body.append('text', text.trim());
  uploadFiles.forEach((file) => body.append('files', file));
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
  if (file && file.size > CLOUD_UPLOAD_LIMIT_BYTES) {
    const storagePath = await uploadSpreadsheetViaSupabase(eventId, file);
    const response = await fetchWithTimeout(
      `${apiBase()}/api/events/${eventId}/people/import-photos`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storagePath, filename: file.name }),
      },
      INGEST_UPLOAD_TIMEOUT_MS,
    );
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
