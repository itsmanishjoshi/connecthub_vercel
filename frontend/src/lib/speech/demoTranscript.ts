import type { TranscriptDraft } from './types';

/** Clearly marked sample only - used to exercise the real analyze pipeline. */
export const DEMO_CONVERSATION_LABEL = 'Sample transcript (demo data, not a live recording)';

export const DEMO_CONTEXT = {
  title: 'Discovery with Raj Sharma - Diageo',
  companyName: 'Diageo',
  conversationType: 'in_person',
};

export function buildDemoTranscript(): TranscriptDraft[] {
  const lines: Array<[number, string, string]> = [
    [72000, 'Raj Sharma', 'Our biggest challenge actually data integration ka hai. Commercial teams still pull numbers from different systems.'],
    [89000, 'You', 'Which systems are involved today?'],
    [105000, 'Raj Sharma', 'Primarily SAP and Salesforce. Finance also keeps a separate spreadsheet for monthly reviews.'],
    [129000, 'You', 'What does that mean for reporting and leadership visibility?'],
    [141000, 'Raj Sharma', 'Significant manual effort is required to consolidate information. Leadership does not have real-time visibility.'],
    [168000, 'Raj Sharma', 'We need unified commercial data visibility, ideally without another six-month IT programme.'],
    [192000, 'You', 'Would a technical discovery session next week help us map the current state?'],
    [206000, 'Raj Sharma', 'Yes. Schedule a technical discovery session. I can include our analytics lead.'],
    [228000, 'You', 'I can share relevant AI solution examples before that discussion.'],
    [241000, 'Raj Sharma', 'Please do. Also tell us which KPIs you would start with. Reporting frequency is still monthly.'],
  ];
  return lines.map(([startMs, speakerLabel, text], index) => ({
    id: `demo-${index}`,
    speakerLabel,
    startMs,
    endMs: startMs + 12000,
    language: 'en',
    text,
    isFinal: true,
  }));
}
