export function splitTalkingPoints(raw?: string | null): string[] {
  return uniqueNotes(splitList(raw, false));
}

export function splitIceBreakers(raw?: string | null): string[] {
  return uniqueNotes(splitList(raw, true)).map(stripOuterQuotes).filter(Boolean);
}

export function formatIceBreaker(text: string): string {
  const inner = stripOuterQuotes(text);
  return inner ? `“${inner}”` : '';
}

export function formatTalkingPoint(text: string): string {
  const match = String(text || '').trim().match(/^([A-Za-z][A-Za-z0-9 /&-]{1,32}):\s*(.+)$/);
  if (!match) return String(text || '').trim();
  const body = match[2].replace(/\s*\|\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return `${match[1].trim()}: ${body}`;
}

function splitList(raw: string | null | undefined, ice: boolean): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];

  const quoted = extractQuoted(text);
  const lines = text
    .split(/\n+/)
    .map((part) => part.replace(/^[-*•]\s+/, '').trim())
    .filter(Boolean);

  if (!ice && lines.length >= 2) {
    return lines;
  }

  const piped = mergeShortFragments(
    text
      .split(/\s*\|\s*|\n+/)
      .map((part) => part.replace(/^[-*•]\s+/, '').trim())
      .filter(Boolean),
  );

  const parts = piped.length >= 2 ? piped : quoted.length >= 2 ? quoted : piped.length ? piped : quoted;
  if (!ice) return parts;

  return parts.flatMap((part) => {
    const inner = extractQuoted(part);
    return inner.length >= 2 ? inner : [part];
  });
}

function extractQuoted(text: string): string[] {
  return [...String(text).matchAll(/[“"]([^”"]{8,}?)[”"]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function mergeShortFragments(parts: string[]): string[] {
  const merged: string[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    const looksComplete = part.length >= 42 || /[?]$/.test(part) || /^[“"]/.test(part) || /^\d/.test(part);
    if (previous && !looksComplete) {
      merged[merged.length - 1] = `${previous} | ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

function uniqueNotes(parts: string[]): string[] {
  const expanded = parts.map((part) => part.trim()).filter(Boolean);
  const kept: string[] = [];
  const shortestFirst = [...expanded].sort((a, b) => normalize(a).length - normalize(b).length);

  for (const item of shortestFirst) {
    const value = normalize(item);
    if (!value) continue;
    if (kept.some((existing) => normalize(existing) === value)) continue;
    const contained = kept.filter((existing) => {
      const other = normalize(existing);
      return other.length > 24 && value.includes(other);
    }).length;
    if (contained >= 2) continue;
    kept.push(item);
  }

  return expanded.filter((item) => kept.includes(item));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripOuterQuotes(value: string): string {
  return value.replace(/^[“"'\s]+|[”"'\s]+$/g, '').trim();
}
