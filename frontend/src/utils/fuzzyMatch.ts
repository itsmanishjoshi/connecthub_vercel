/** Normalize text for fuzzy comparison. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/** Score 0–100 how well `query` matches `haystack` (typo-tolerant). */
export function fuzzyScore(query: string, haystack: string): number {
  const q = normalizeSearchText(query);
  const h = normalizeSearchText(haystack);
  if (!q || !h) return 0;
  if (h.includes(q)) return 100;

  const qTokens = q.split(' ').filter(Boolean);
  const hTokens = h.split(' ').filter(Boolean);
  let tokenBest = 0;

  for (const qt of qTokens) {
    let best = 0;
    for (const ht of hTokens) {
      if (ht.includes(qt) || qt.includes(ht)) {
        best = Math.max(best, 92);
        continue;
      }
      const dist = levenshtein(qt, ht);
      const maxLen = Math.max(qt.length, ht.length);
      const ratio = 1 - dist / maxLen;
      if (ratio >= 0.68) best = Math.max(best, Math.round(ratio * 88));
    }
    if (best === 0) {
      const dist = levenshtein(qt, h.slice(0, Math.min(h.length, qt.length + 4)));
      const ratio = 1 - dist / Math.max(qt.length, h.length);
      if (ratio >= 0.68) best = Math.round(ratio * 75);
    }
    tokenBest += best;
  }

  return Math.round(tokenBest / qTokens.length);
}

export function matchesFuzzyQuery(query: string, haystack: string, minScore = 55): boolean {
  return fuzzyScore(query, haystack) >= minScore;
}
