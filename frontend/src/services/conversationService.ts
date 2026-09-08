import { supabase } from '@/lib/supabaseClient';
import type { TranscriptDraft } from '@/lib/speech/types';
import * as attendeeDataService from '@/services/attendeeDataService';

export interface Conversation {
  id: string;
  user_id: string;
  event_id?: string | null;
  attendee_id?: string | null;
  company_name?: string | null;
  title?: string | null;
  conversation_type: string;
  source: string;
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number;
  primary_language?: string | null;
  recording_status: string;
  transcription_status: string;
  ai_processing_status: string;
  consent_confirmed: boolean;
  next_action?: string | null;
  transcript_version?: number;
  created_at: string;
}

export interface ConversationInsight {
  id: string;
  conversation_id: string;
  kind: string;
  title?: string | null;
  body: string;
  category?: string | null;
  owner?: string | null;
  due_at?: string | null;
  confidence?: string | null;
  evidence_kind: string;
  evidence_start_ms?: number | null;
  evidence_end_ms?: number | null;
  sort_order: number;
}

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('connecthub_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createConversation(input: Partial<Conversation>): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert([{
      title: input.title || 'Untitled conversation',
      event_id: input.event_id || null,
      attendee_id: input.attendee_id || null,
      company_name: input.company_name || null,
      conversation_type: input.conversation_type || 'in_person',
      source: input.source || 'microphone',
      status: 'draft',
      recording_status: 'idle',
      transcription_status: 'idle',
      ai_processing_status: 'idle',
      consent_confirmed: Boolean(input.consent_confirmed),
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function saveFinalSegments(conversationId: string, drafts: TranscriptDraft[]): Promise<void> {
  if (!drafts.length) return;
  const rows = drafts.map((draft, index) => ({
    conversation_id: conversationId,
    sequence: index + 1,
    speaker_label: draft.speakerLabel || 'Speaker',
    start_ms: draft.startMs,
    end_ms: draft.endMs,
    language: draft.language || null,
    text: draft.text,
    confidence: draft.confidence ?? null,
    is_final: true,
  }));
  const { error: clearError } = await supabase
    .from('transcript_segments')
    .delete()
    .eq('conversation_id', conversationId);
  if (clearError) throw clearError;
  const { error } = await supabase.from('transcript_segments').insert(rows);
  if (error) throw error;
}

export async function listSegments(conversationId: string) {
  const { data, error } = await supabase
    .from('transcript_segments')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateSegment(id: string, text: string, speakerLabel?: string) {
  const { error } = await supabase
    .from('transcript_segments')
    .update({ text, ...(speakerLabel ? { speaker_label: speakerLabel } : {}) })
    .eq('id', id);
  if (error) throw error;
}

export async function listInsights(conversationId: string): Promise<ConversationInsight[]> {
  const { data, error } = await supabase
    .from('conversation_insights')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateInsight(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_insights')
    .update({ body, evidence_kind: 'user_confirmed' })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await supabase.from('conversation_insights').delete().eq('id', id);
  if (error) throw error;
}

export async function analyzeConversation(conversationId: string) {
  const response = await fetch(`${apiBase()}/api/conversations/${conversationId}/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || 'Analysis failed');
  return json.data;
}

export async function uploadAudioChunk(conversationId: string, blob: Blob): Promise<void> {
  const userId = localStorage.getItem('current_user_id');
  if (!userId) return;
  const form = new FormData();
  const fileName = `${userId}-${conversationId}-${Date.now()}.webm`;
  form.append('path', fileName);
  form.append('file', blob, fileName);
  const token = localStorage.getItem('connecthub_token');
  const response = await fetch(`${apiBase()}/api/storage/conversation-audio`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) return;
  const json = await response.json();
  await supabase.from('conversation_audio').insert([{
    conversation_id: conversationId,
    path: json.data?.path,
    mime_type: blob.type,
  }]);
}

export function cacheDraft(conversationId: string, drafts: TranscriptDraft[]) {
  localStorage.setItem(`connecthub_ci_draft_${conversationId}`, JSON.stringify(drafts));
}

export function readDraft(conversationId: string): TranscriptDraft[] {
  try {
    return JSON.parse(localStorage.getItem(`connecthub_ci_draft_${conversationId}`) || '[]');
  } catch {
    return [];
  }
}

export function searchConversations(conversations: Conversation[], query: string): Conversation[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return conversations;
  return conversations.filter((item) =>
    [item.title, item.company_name, item.next_action, item.primary_language, item.status]
      .some((value) => String(value || '').toLowerCase().includes(needle))
  );
}

export function conversationsForAttendee(conversations: Conversation[], attendeeId?: string | null) {
  if (!attendeeId) return [];
  return conversations.filter((item) => item.attendee_id === attendeeId);
}

export function conversationsForEvent(conversations: Conversation[], eventId?: string | null) {
  if (!eventId) return [];
  return conversations.filter((item) => item.event_id === eventId);
}

export function conversationsForCompany(conversations: Conversation[], companyName?: string | null) {
  if (!companyName) return [];
  const needle = companyName.toLowerCase();
  return conversations.filter((item) => (item.company_name || '').toLowerCase().includes(needle));
}

export function summarizeEventIntelligence(conversations: Conversation[], insights: ConversationInsight[]) {
  const pain = insights.filter((item) => item.kind === 'pain_point').length;
  const opportunities = insights.filter((item) => item.kind === 'opportunity').length;
  const followUps = insights.filter((item) => item.kind === 'followup' || item.kind === 'action_item').length;
  return {
    conversations: conversations.length,
    opportunities,
    painPoints: pain,
    followUps,
  };
}

export function parsePastedTranscript(text: string): TranscriptDraft[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const timed = line.match(/^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:([A-Za-z][A-Za-z\s]{0,40}):)?\s*(.+)$/);
    if (timed) {
      const hours = timed[3] ? Number(timed[1]) : 0;
      const minutes = timed[3] ? Number(timed[2]) : Number(timed[1]);
      const seconds = timed[3] ? Number(timed[3]) : Number(timed[2]);
      const startMs = ((hours * 60 + minutes) * 60 + seconds) * 1000;
      return {
        id: `paste-${index}`,
        speakerLabel: (timed[4] || 'Speaker').trim(),
        startMs,
        endMs: startMs + 8000,
        text: timed[5].trim(),
        isFinal: true,
      };
    }
    return {
      id: `paste-${index}`,
      speakerLabel: 'Speaker',
      startMs: index * 15000,
      endMs: index * 15000 + 14000,
      text: line,
      isFinal: true,
    };
  });
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function evidenceLabel(startMs?: number | null, endMs?: number | null): string | null {
  if (startMs == null) return null;
  const start = formatClock(startMs).slice(3);
  const end = endMs != null ? formatClock(endMs).slice(3) : null;
  return end ? `${start}–${end}` : start;
}

export function exportConversationMarkdown(
  conversation: Conversation,
  segments: Array<{ speaker_label?: string; start_ms?: number; text: string }>,
  insights: ConversationInsight[],
) {
  const byKind = (kind: string) => insights.filter((item) => item.kind === kind);
  const lines = [
    `# ${conversation.title || 'Conversation Intelligence'}`,
    '',
    conversation.company_name ? `Company: ${conversation.company_name}` : '',
    conversation.started_at ? `Date: ${new Date(conversation.started_at).toLocaleString()}` : '',
    conversation.duration_seconds ? `Duration: ${Math.round(conversation.duration_seconds / 60)} minutes` : '',
    '',
    '## Executive Summary',
    byKind('summary')[0]?.body || 'Not generated yet.',
    '',
    '## Key Discussion Points',
    ...byKind('key_point').map((item, index) => `${index + 1}. ${item.title || item.body}`),
    '',
    '## Pain Points',
    ...byKind('pain_point').map((item) => `- ${item.title || item.body}`),
    '',
    '## Requirements',
    ...byKind('requirement').map((item) => `- ${item.title || item.body}`),
    '',
    '## Stakeholders',
    ...byKind('stakeholder').map((item) => `- ${item.title || item.body}`),
    '',
    '## Constraints',
    ...byKind('constraint').map((item) => `- ${item.title || item.body}`),
    '',
    '## Tools and platforms',
    ...byKind('tool').map((item) => `- ${item.title || item.body}`),
    '',
    '## Decisions',
    ...(byKind('decision').length ? byKind('decision').map((item) => `- ${item.body}`) : ['- No formal decisions identified.']),
    '',
    '## Action Items',
    ...byKind('action_item').map((item) => `- ${item.title || item.body} (Owner: ${item.owner || 'Unassigned'}; Due: ${item.due_at || 'Not specified'})`),
    '',
    '## Open Questions',
    ...byKind('open_question').map((item) => `- ${item.body}`),
    '',
    '## Potential Opportunity',
    byKind('opportunity')[0]?.body || 'None identified.',
    '',
    '## Follow-up message',
    byKind('followup')[0]?.body || 'Not generated yet.',
    '',
    '## Preliminary solution',
    byKind('solution')[0]?.body || 'Not generated yet.',
    '',
    '## Next action',
    byKind('next_action')[0]?.body || 'Not specified.',
    '',
    '## Minutes of Meeting',
    byKind('mom')[0]?.body || 'Not generated yet.',
    '',
    '## Transcript',
    ...segments.map((segment) => `${formatClock(segment.start_ms || 0)} ${segment.speaker_label || 'Speaker'}: ${segment.text}`),
  ].filter((line) => line !== '');

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(conversation.title || 'conversation').replace(/[^\w]+/g, '-')}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function meetingBriefFromInsights(insights: ConversationInsight[]) {
  const pick = (kind: string) => insights.find((item) => item.kind === kind);
  return {
    summary: pick('summary')?.body || '',
    nextAction: pick('next_action')?.body || '',
    followup: pick('followup')?.body || '',
    opportunity: pick('opportunity')?.title || pick('opportunity')?.body || '',
    pain: insights.filter((item) => item.kind === 'pain_point').slice(0, 3).map((item) => item.title || item.body).filter(Boolean),
    actions: insights.filter((item) => item.kind === 'action_item').slice(0, 3).map((item) => item.title || item.body).filter(Boolean),
  };
}

export async function applyMeetingToPerson(attendeeId: string, insights: ConversationInsight[]) {
  if (!attendeeId) return meetingBriefFromInsights(insights);
  const brief = meetingBriefFromInsights(insights);
  const lines = [
    brief.summary && `Summary: ${brief.summary}`,
    brief.nextAction && `Next: ${brief.nextAction}`,
    brief.followup && `Follow-up: ${brief.followup}`,
    brief.opportunity && `Opportunity: ${brief.opportunity}`,
    brief.pain.length ? `Pain: ${brief.pain.join('; ')}` : '',
    brief.actions.length ? `Actions: ${brief.actions.join('; ')}` : '',
  ].filter(Boolean);
  if (lines.length) {
    const stamp = new Date().toLocaleString();
    const block = `Meeting ${stamp}\n${lines.join('\n')}`;
    await attendeeDataService.saveNote(attendeeId, block);
  }
  if (brief.followup || brief.nextAction || brief.actions.length) {
    const statuses = await attendeeDataService.getStatuses(attendeeId);
    if (!statuses.includes('follow_up_needed')) {
      await attendeeDataService.saveStatuses(attendeeId, [...statuses, 'follow_up_needed']);
    }
  }
  return brief;
}
