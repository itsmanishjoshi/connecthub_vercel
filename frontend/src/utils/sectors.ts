import { SECTORS, type Sector } from '@/utils/sectorsCore';
import { getAuthUserId, loadUserRows, upsertUserRow } from '@/lib/userPersistence';

export { SECTORS, type Sector } from '@/utils/sectorsCore';

const STORAGE_KEY = 'gcc_connecthub_sectors_map';
let sectorCache: Record<string, Sector> = {};
let cacheUserId: string | null = null;

const readMap = (): Record<string, Sector> => {
  if (cacheUserId === getAuthUserId() && Object.keys(sectorCache).length) {
    return sectorCache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    sectorCache = raw ? JSON.parse(raw) : {};
    cacheUserId = getAuthUserId();
    return sectorCache;
  } catch {
    return {};
  }
};

const writeMap = (map: Record<string, Sector>) => {
  sectorCache = map;
  cacheUserId = getAuthUserId();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const pickDeterministic = (key: string): Sector => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const idx = hash % SECTORS.length;
  return SECTORS[idx];
};

async function persistSector(attendeeId: string, sector: Sector): Promise<void> {
  if (!getAuthUserId()) return;
  await upsertUserRow('attendee_sectors', {
    attendee_id: attendeeId,
    sector,
    updated_at: new Date().toISOString(),
  }, 'user_id,attendee_id');
}

export async function hydrateSectorsFromDb(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId) return;

  const rows = await loadUserRows<Record<string, unknown>>('attendee_sectors');
  if (!rows.length) {
    const local = readMap();
    await Promise.all(Object.entries(local).map(([attendeeId, sector]) => persistSector(attendeeId, sector)));
    return;
  }

  const map: Record<string, Sector> = {};
  for (const row of rows) {
    map[String(row.attendee_id)] = row.sector as Sector;
  }
  writeMap(map);
}

export const getSector = (attendeeId: string, seed?: string): Sector => {
  const map = readMap();
  if (map[attendeeId]) return map[attendeeId];
  const sector = pickDeterministic(seed || attendeeId);
  map[attendeeId] = sector;
  writeMap(map);
  void persistSector(attendeeId, sector);
  return sector;
};

export const setSector = (attendeeId: string, sector: Sector) => {
  const map = readMap();
  map[attendeeId] = sector;
  writeMap(map);
  void persistSector(attendeeId, sector);
};
