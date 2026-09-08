/**
 * Attendee search helpers. Event people are loaded from the API/database, not local CSV files.
 */

import { Attendee } from '@/types/attendee';

export interface AttendeeWithEvent extends Attendee {
  event: string;
  sector?: string;
  gender?: string;
}

export async function loadAllAttendees(): Promise<AttendeeWithEvent[]> {
  return [];
}

export interface SearchFilters {
  name?: string;
  company?: string;
  designation?: string;
  location?: string;
  sector?: string;
  gender?: string;
  event?: string;
}

export function advancedSearch(attendees: AttendeeWithEvent[], filters: SearchFilters): AttendeeWithEvent[] {
  return attendees.filter((a) => {
    if (filters.name && !a.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.company && !a.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.designation && !a.designation.toLowerCase().includes(filters.designation.toLowerCase())) return false;
    if (filters.location && !a.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.sector && !a.sector?.toLowerCase().includes(filters.sector.toLowerCase())) return false;
    if (filters.gender && a.gender !== filters.gender) return false;
    if (filters.event && !a.event.toLowerCase().includes(filters.event.toLowerCase())) return false;
    return true;
  });
}

export function searchAttendees(attendees: AttendeeWithEvent[], query: string): AttendeeWithEvent[] {
  const lowerQuery = query.toLowerCase();
  return attendees.filter(
    (a) =>
      a.name.toLowerCase().includes(lowerQuery) ||
      a.company.toLowerCase().includes(lowerQuery) ||
      a.designation.toLowerCase().includes(lowerQuery)
  );
}

export function getAttendeesByCompany(attendees: AttendeeWithEvent[], company: string): AttendeeWithEvent[] {
  const lowerCompany = company.toLowerCase();
  return attendees.filter((a) => a.company.toLowerCase().includes(lowerCompany));
}

export function getAttendeesByLocation(attendees: AttendeeWithEvent[], location: string): AttendeeWithEvent[] {
  const lowerLocation = location.toLowerCase();
  return attendees.filter((a) => a.location.toLowerCase().includes(lowerLocation));
}

export function getAttendeesInMultipleEvents(attendees: AttendeeWithEvent[]): Map<string, AttendeeWithEvent[]> {
  const nameMap = new Map<string, AttendeeWithEvent[]>();
  attendees.forEach((a) => {
    const key = `${a.name}-${a.company}`.toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(a);
  });
  const multiEventAttendees = new Map<string, AttendeeWithEvent[]>();
  nameMap.forEach((list) => {
    if (list.length > 1) multiEventAttendees.set(`${list[0].name}-${list[0].company}`, list);
  });
  return multiEventAttendees;
}
