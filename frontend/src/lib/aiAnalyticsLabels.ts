const KNOWN_ROUTES: Record<string, string> = {
  '/api/ai/chat': 'General AI chat',
  '/api/ai/jelly/chat': 'Jelly chatbot',
  '/api/ai/jelly/analyze': 'Jelly assistant',
  '/api/conversations/{id}/analyze': 'Conversation intelligence',
  '/api/events/{id}/people/extract': 'People card import',
};

export function normalizeApiRoute(route: string): string {
  return route
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{id}')
    .replace(/\/\d+(?=\/|$)/g, '/{id}');
}

export function humanizeRoute(route: string): string {
  const normalized = normalizeApiRoute(route);
  if (KNOWN_ROUTES[normalized]) return KNOWN_ROUTES[normalized];
  if (KNOWN_ROUTES[route]) return KNOWN_ROUTES[route];
  const label = normalized
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter((part) => part && part !== '{id}')
    .map((part) => part.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(' · ');
  return label || route;
}

export function humanizeTask(task?: string): string {
  if (!task || task === 'unknown') return 'Unknown';
  return task.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function displayAiFeature(feature?: string, route?: string): string {
  const trimmed = feature?.trim();
  if (trimmed) return trimmed;
  return humanizeRoute(route ?? '');
}

export function logDetail(meta?: Record<string, unknown>): string {
  if (!meta || !Object.keys(meta).length) return '';
  if (meta.conversation_id) return `Conversation ${String(meta.conversation_id).slice(0, 8)}…`;
  if (meta.event_id) return `Event ${String(meta.event_id).slice(0, 8)}…`;
  return Object.entries(meta)
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}
