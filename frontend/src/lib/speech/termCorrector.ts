const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bpowerplayt?forms?\b/gi, 'Power Platform'],
  [/\bpower\s*play\s*t?forms?\b/gi, 'Power Platform'],
  [/\bpower\s*play\s*form(s)?\b/gi, 'Power Platform'],
  [/\bpowerplay\s*forms?\b/gi, 'Power Platform'],
  [/\bpower\s*plat\s*froms?\b/gi, 'Power Platform'],
  [/\bpower\s*plat\s*forms?\b/gi, 'Power Platform'],
  [/\bmicrosoft\s+power\s+platforms?\b/gi, 'Power Platform'],
  [/\bpower\s*platforms?\b/gi, 'Power Platform'],
  [/\bpower\s*auto\s*mates?\b/gi, 'Power Automate'],
  [/\bpower\s*automate\b/gi, 'Power Automate'],
  [/\bpower\s*bi\b/gi, 'Power BI'],
  [/\bpower\s*pages?\b/gi, 'Power Pages'],
  [/\bpower\s*apps?\b/gi, 'Power Apps'],
  [/\bdata\s*verse\b/gi, 'Dataverse'],
  [/\bdynamics\s*365\b/gi, 'Dynamics 365'],
  [/\bsales\s*force\b/gi, 'Salesforce'],
  [/\bservice\s*now\b/gi, 'ServiceNow'],
  [/\bshare\s*point\b/gi, 'SharePoint'],
  [/\bco\s*pilot\b/gi, 'Copilot'],
];

export function correctBusinessTerms(text: string): string {
  if (!text) return text;
  return REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

export function scoreBusinessTerms(text: string): number {
  if (!text) return 0;
  return REPLACEMENTS.reduce((score, [pattern]) => score + (text.match(pattern)?.length || 0), 0);
}

export function pickRichestTranscript(candidates: string[]): string {
  const usable = candidates.map((item) => item.trim()).filter(Boolean);
  if (!usable.length) return '';
  return usable.sort((a, b) => {
    const score = scoreBusinessTerms(b) - scoreBusinessTerms(a);
    if (score !== 0) return score;
    return b.length - a.length;
  })[0];
}
