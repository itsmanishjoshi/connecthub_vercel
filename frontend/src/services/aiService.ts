/**
 * Jelly AI client — all RAG, prompts, and LLM orchestration live in the Python backend.
 */

import { apiJson } from '@/lib/api/http';

export interface JellyHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export type ActionType =
  | 'read'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'create_attendee'
  | 'update_attendee'
  | 'delete_attendee'
  | 'add_note'
  | 'update_note'
  | 'delete_note';

export interface AIAction {
  type: ActionType;
  description: string;
  data?: Record<string, unknown>;
  requiresConfirmation: boolean;
  reversible: boolean;
}

export interface AIResponse {
  message: string;
  action?: AIAction;
  needsConfirmation?: boolean;
}

export async function chatWithConnectHub(
  query: string,
  history: JellyHistoryItem[] = [],
): Promise<string> {
  const json = await apiJson<{ message: string }>('/api/ai/jelly/chat', {
    method: 'POST',
    body: JSON.stringify({ query, history }),
  });
  return json.message;
}

export async function analyzeQuery(query: string): Promise<AIResponse> {
  return apiJson<AIResponse>('/api/ai/jelly/analyze', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function executeAction(action: AIAction): Promise<{ success: boolean; message: string; undoData?: unknown }> {
  return apiJson('/api/ai/jelly/execute', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function undoAction(undoData: unknown): Promise<{ success: boolean; message: string }> {
  return apiJson('/api/ai/jelly/undo', {
    method: 'POST',
    body: JSON.stringify({ undoData }),
  });
}

/** @deprecated Use chatWithConnectHub */
export async function generateAIResponse(userQuery: string, _context?: string, history: JellyHistoryItem[] = []): Promise<string> {
  return chatWithConnectHub(userQuery, history);
}
