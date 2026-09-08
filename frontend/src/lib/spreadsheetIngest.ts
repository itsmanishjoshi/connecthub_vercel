import readXlsxFile from 'read-excel-file/browser';

export type ParsedPerson = {
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
};

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'fullname', 'attendee', 'speakername', 'person', 'attendeename', 'speakers', 'candidate', 'participant'],
  designation: ['designation', 'title', 'role', 'jobtitle', 'position'],
  company: ['company', 'organization', 'organisation', 'org', 'firm', 'employer'],
  industry: ['industry', 'sector', 'primaryindustry', 'subindustry'],
  city: ['city', 'contactcity', 'officecity', 'basecity', 'hqcity', 'location', 'place', 'office', 'region'],
  linkedin_url: ['linkedin', 'linkedinurl', 'linkedinprofile'],
  profile_pic_url: ['profilepic', 'profilepicture', 'photo', 'picture', 'image', 'avatar', 'photourl'],
  website_url: ['website', 'websiteurl', 'url', 'web'],
  key_insights: ['keyinsights', 'insights', 'notes', 'bio', 'about'],
  ice_breakers: ['icebreakers', 'icebreaker', 'talkingpoints'],
  speaker: ['speaker', 'isspeaker'],
  competitor: ['competitor'],
  first: ['firstname', 'first', 'givenname'],
  last: ['lastname', 'last', 'surname', 'familyname'],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function mapHeader(value: unknown): string | null {
  const key = normalizeHeader(value);
  if (!key) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asBool(value: unknown): boolean {
  return /^(true|yes|y|1|speaker)$/i.test(String(value ?? '').trim());
}

function looksLikeName(value: unknown): boolean {
  const text = asText(value);
  if (!text || text.length < 3 || text.length > 80) return false;
  if (/^https?:\/\//i.test(text) || text.includes('@')) return false;
  return /[a-zA-Z]{2,}/.test(text);
}

function rowToPerson(headers: Array<string | null>, cells: unknown[]): ParsedPerson | null {
  const raw: Record<string, unknown> = { extra_data: {} as Record<string, string> };
  for (let index = 0; index < headers.length; index += 1) {
    const field = headers[index];
    const value = cells[index];
    const text = asText(value);
    if (!text) continue;
    if (field === 'speaker' || field === 'competitor') {
      raw[field] = asBool(text);
    } else if (field) {
      raw[field] = text;
    }
  }
  if (!raw.name) {
    const combined = [raw.first, raw.last].filter(Boolean).join(' ').trim();
    if (combined) raw.name = combined;
  }
  if (!raw.name) {
    const guess = cells.map(asText).find(looksLikeName);
    if (guess) raw.name = guess;
  }
  const name = asText(raw.name);
  if (!name) return null;
  return {
    name,
    designation: asText(raw.designation) || null,
    company: asText(raw.company) || null,
    industry: asText(raw.industry) || null,
    location: asText(raw.location) || null,
    city: asText(raw.city) || null,
    profile_pic_url: asText(raw.profile_pic_url) || null,
    linkedin_url: asText(raw.linkedin_url) || null,
    website_url: asText(raw.website_url) || null,
    key_insights: asText(raw.key_insights) || null,
    ice_breakers: asText(raw.ice_breakers) || null,
    speaker: Boolean(raw.speaker),
    competitor: Boolean(raw.competitor),
    extra_data: (raw.extra_data as Record<string, string>) || {},
  };
}

function findHeaderRow(rows: unknown[][]): number {
  for (let index = 0; index < Math.min(rows.length, 30); index += 1) {
    const headers = (rows[index] ?? []).map(mapHeader);
    if (headers.includes('name') || (headers.includes('first') && headers.includes('last'))) {
      return index;
    }
  }
  return -1;
}

function peopleFromRows(rows: unknown[][]): ParsedPerson[] {
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return [];
  const headers = (rows[headerRow] ?? []).map(mapHeader);
  const people: ParsedPerson[] = [];
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const cells = rows[index] ?? [];
    if (!cells.some((cell) => asText(cell))) continue;
    const person = rowToPerson(headers, cells);
    if (person) people.push(person);
  }
  return people;
}

async function parseCsvFile(file: File): Promise<ParsedPerson[]> {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.trim()));
  return peopleFromRows(rows);
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedPerson[]> {
  if (/\.csv$/i.test(file.name)) {
    return parseCsvFile(file);
  }
  const rows = await readXlsxFile(file);
  return peopleFromRows(rows);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CLOUD_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

export function shouldParseSpreadsheetLocally(files: File[]): boolean {
  if (!files.length) return false;
  return files.every((file) => /\.(xlsx|xls|csv|ods)$/i.test(file.name));
}
