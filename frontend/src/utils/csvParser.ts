import Papa from 'papaparse';
import { Attendee, DEFAULT_STAGE, STAGE_OPTIONS, StageValue } from '@/types/attendee';

const normalizeStage = (value: unknown): StageValue => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return DEFAULT_STAGE;
  }

  const stringValue = String(value).trim().toLowerCase();
  const matched = STAGE_OPTIONS.find((option) => option.toLowerCase() === stringValue);
  return matched ?? DEFAULT_STAGE;
};

const getCell = (row: any, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
};

const parseBooleanCell = (row: any, keys: string[]): boolean => {
  const raw = getCell(row, keys);
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return ['yes', 'true', '1', 'y'].includes(normalized);
};

export const parseCSV = (csvText: string): Attendee[] => {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data.map((row: any, index: number) => {
    const name = getCell(row, ['name', 'Name']);
    const company = getCell(row, ['company', 'Company']);
    const designation = getCell(row, ['designation', 'Designation', 'role', 'Role']);
    const location = getCell(row, ['location', 'Location', 'city', 'City']);
    const sectorRaw = getCell(row, ['sector', 'Sector', 'industry', 'Industry']);
    const stageRaw = getCell(row, ['Stage', 'stage']);

    return {
      id: `attendee-${index}`,
      name: name || '',
      company: company || '',
      designation: designation || '',
      location: location || '',
      sector: sectorRaw || undefined,
      stage: normalizeStage(stageRaw),
      photo: row.photo || '',
      keyPoints: [
        row.keyPoint1 || '',
        row.keyPoint2 || '',
        row.keyPoint3 || '',
        row.keyPoint4 || '',
        row.keyPoint5 || '',
      ].filter(Boolean),
      iceBreakers: [],
      speaker: parseBooleanCell(row, ['speaker', 'Speaker']),
      competitor: parseBooleanCell(row, ['competitor', 'Competitor']),
    } as Attendee;
  });
};

export const loadAttendeesFromCSV = async (csvFile: string = 'attendees.csv'): Promise<Attendee[]> => {
  try {
    const response = await fetch(`/${csvFile}`);
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error loading attendees:', error);
    throw new Error('Failed to load attendee data');
  }
};
