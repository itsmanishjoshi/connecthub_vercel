import { fetchEventsWithSource, fetchAttendeesByEvent, type Event, type Attendee } from '@/lib/eventsApi';
import { listRepositoryFiles } from '@/lib/repositoryApi';
import { REPOSITORY_INDUSTRIES, REPOSITORY_INDUSTRY_IDS, type RepositoryIndustryId } from '@/lib/repositoryIndustries';
import { fuzzyScore } from '@/utils/fuzzyMatch';

export type GlobalSearchResultType =
  | 'event'
  | 'attendee'
  | 'success_story'
  | 'repository'
  | 'window';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
  searchText: string;
}

interface SearchIndexItem {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  subtitle?: string;
  href: string;
  searchText: string;
}

let indexCache: SearchIndexItem[] | null = null;
let indexBuiltAt = 0;
const INDEX_TTL_MS = 5 * 60 * 1000;

function attendeeSearchText(attendee: Attendee, event?: Event): string {
  return [
    attendee.name,
    attendee.company,
    attendee.designation,
    attendee.city,
    attendee.location,
    attendee.industry,
    attendee.key_insights,
    attendee.ice_breakers,
    attendee.linkedin_url,
    event?.name,
  ]
    .filter(Boolean)
    .join(' ');
}

async function buildIndex(): Promise<SearchIndexItem[]> {
  const items: SearchIndexItem[] = [];
  const { data: events } = await fetchEventsWithSource();

  for (const event of events) {
    items.push({
      id: `event-${event.id}`,
      type: 'event',
      title: event.name,
      subtitle: [event.place, event.date].filter(Boolean).join(' · '),
      href: `/connect-hub/hub?event=${encodeURIComponent(event.slug)}`,
      searchText: [event.name, event.place, event.date, event.creator_name, event.slug].filter(Boolean).join(' '),
    });

    try {
      const attendees = await fetchAttendeesByEvent(event.id);
      for (const attendee of attendees) {
        items.push({
          id: `attendee-${attendee.id}`,
          type: 'attendee',
          title: attendee.name,
          subtitle: [attendee.designation, attendee.company, event.name].filter(Boolean).join(' · '),
          href: `/connect-hub/hub?event=${encodeURIComponent(event.slug)}&highlight=${encodeURIComponent(attendee.id)}`,
          searchText: attendeeSearchText(attendee, event),
        });
      }
    } catch {
      // Skip attendees for events that fail to load.
    }
  }

  for (const industryId of REPOSITORY_INDUSTRY_IDS) {
    const industry = REPOSITORY_INDUSTRIES[industryId];
    items.push({
      id: `window-repository-${industryId}`,
      type: 'window',
      title: `${industry.name} — Success Stories`,
      subtitle: industry.headline,
      href: `/repository?industry=${industryId}`,
      searchText: [
        industry.name,
        industry.headline,
        industry.pitch,
        ...industry.services,
        ...industry.expertise.map((e) => `${e.title} ${e.detail}`),
      ].join(' '),
    });

    for (const story of industry.caseStudies) {
      items.push({
        id: `story-${industryId}-${story.title}`,
        type: 'success_story',
        title: story.title,
        subtitle: `${story.client} · ${industry.name}`,
        href: `/repository?industry=${industryId}`,
        searchText: [story.title, story.client, story.challenge, story.whatWeDid, story.outcome, industry.name].join(' '),
      });
    }

    try {
      const files = await listRepositoryFiles(industryId as RepositoryIndustryId);
      for (const file of files) {
        items.push({
          id: `repo-${industryId}-${file.name}`,
          type: 'repository',
          title: file.name,
          subtitle: `${industry.name} repository`,
          href: `/repository?industry=${industryId}`,
          searchText: [file.name, industry.name, file.kind].join(' '),
        });
      }
    } catch {
      // Repository files optional offline.
    }
  }

  items.push(
    {
      id: 'window-events',
      type: 'window',
      title: 'Events',
      subtitle: 'Browse all events',
      href: '/events',
      searchText: 'events calendar networking',
    },
    {
      id: 'window-assets',
      type: 'window',
      title: 'Repository',
      subtitle: 'Files and assets',
      href: '/assets',
      searchText: 'repository assets files documents',
    },
    {
      id: 'window-analytics',
      type: 'window',
      title: 'Analytics',
      subtitle: 'Insights and activity',
      href: '/analytics',
      searchText: 'analytics dashboard stats reports',
    },
  );

  return items;
}

export async function ensureSearchIndex(force = false): Promise<SearchIndexItem[]> {
  if (!force && indexCache && Date.now() - indexBuiltAt < INDEX_TTL_MS) {
    return indexCache;
  }
  indexCache = await buildIndex();
  indexBuiltAt = Date.now();
  return indexCache;
}

export function invalidateSearchIndex(): void {
  indexCache = null;
  indexBuiltAt = 0;
}

export async function searchApplication(query: string, limit = 12): Promise<GlobalSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const index = await ensureSearchIndex();
  const scored = index
    .map((item) => ({
      ...item,
      score: fuzzyScore(trimmed, item.searchText),
    }))
    .filter((item) => item.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export function resultTypeLabel(type: GlobalSearchResultType): string {
  switch (type) {
    case 'event':
      return 'Event';
    case 'attendee':
      return 'Person';
    case 'success_story':
      return 'Success story';
    case 'repository':
      return 'File';
    default:
      return 'Go to';
  }
}
