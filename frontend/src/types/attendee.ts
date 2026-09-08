export type StatusColor = 'high_priority' | 'meeting_required' | 'follow_up_needed' | 'strong_connect' | 'deal_potential' | 'watchlist' | 'grey';

export const STAGE_OPTIONS = ['Running', 'Sick', 'KPO', 'Upcoming'] as const;
export type StageOption = (typeof STAGE_OPTIONS)[number];
export type StageValue = '-' | StageOption;
export const DEFAULT_STAGE: StageValue = '-';

export interface Attendee {
  id: string;
  name: string;
  company: string;
  designation: string;
  location: string;
  sector?: string;
  stage: StageValue;
  photo: string;
  linkedin?: string;
  keyPoints: string[];
  iceBreakers: string[];
  website?: string;
  extra?: Record<string, string>;
  speaker: boolean;
  competitor: boolean;
  priority?: string;
}

export interface AttendeeStatus {
  color: StatusColor;
  label: string;
}

export interface AttendeeNote {
  id: string;
  attendeeId: string;
  text: string;
  timestamp: number;
  updatedAt?: string;
}

export const STATUS_OPTIONS: Record<StatusColor, { label: string; description: string }> = {
  high_priority: { label: 'High Priority', description: 'Important connection requiring immediate attention' },
  meeting_required: { label: 'Meeting Required', description: 'Schedule a meeting with this person' },
  follow_up_needed: { label: 'Follow-up Needed', description: 'Requires follow-up action' },
  strong_connect: { label: 'Strong Connect', description: 'Strong connection established' },
  deal_potential: { label: 'Deal Potential', description: 'Potential for business deal' },
  watchlist: { label: 'Watchlist', description: 'Keep an eye on for future opportunities' },
  grey: { label: 'Untagged', description: 'No status yet' },
};
