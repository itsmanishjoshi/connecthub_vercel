import { getAuthUserId, loadUserRows } from '@/lib/userPersistence';
import { randomUUID } from '@/lib/utils';

import { supabase } from '@/lib/supabaseClient';



export interface StoredJellyMessage {

  id: string;

  role: 'user' | 'assistant';

  content: string;

}



export interface JellyChatSession {

  id: string;

  title: string;

  messages: StoredJellyMessage[];

  updatedAt: number;

  createdAt: number;

}



interface JellyChatState {

  activeSessionId: string;

  sessions: JellyChatSession[];

}



const STORAGE_BASE = 'connecthub_jelly_chats';

const MAX_SESSIONS = 40;



function storageKey() {

  const userId = localStorage.getItem('current_user_id');

  return userId ? `${STORAGE_BASE}_user_${userId}` : `${STORAGE_BASE}_guest`;

}



export function welcomeMessage(): StoredJellyMessage {

  return {

    id: 'welcome',

    role: 'assistant',

    content: 'Hi - I’m Jelly. I can brief you on people, tell you who matters at an event, and sit in on conversations. Ask me, or open Voice to capture a meeting.',

  };

}



function readState(): JellyChatState | null {

  try {

    const raw = localStorage.getItem(storageKey());

    if (!raw) return null;

    const parsed = JSON.parse(raw) as JellyChatState;

    if (!parsed?.activeSessionId || !Array.isArray(parsed.sessions)) return null;

    return parsed;

  } catch {

    return null;

  }

}



function writeStateLocal(state: JellyChatState) {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function writeState(state: JellyChatState) {
  writeStateLocal(state);
  void syncStateToDb(state);
}



async function syncStateToDb(state: JellyChatState): Promise<void> {

  const userId = getAuthUserId();

  if (!userId) return;



  const sessionIds = state.sessions.map((session) => session.id);

  const existing = await loadUserRows<{ id: string }>('jelly_chat_sessions');

  const staleIds = existing.map((row) => row.id).filter((id) => !sessionIds.includes(id));



  if (staleIds.length) {

    await supabase.from('jelly_chat_sessions').delete().eq('user_id', userId).in('id', staleIds);

  }



  for (const session of state.sessions) {

    const { error: sessionError } = await supabase.from('jelly_chat_sessions').upsert({

      id: session.id,

      user_id: userId,

      title: session.title,

      is_active: session.id === state.activeSessionId,

      created_at: new Date(session.createdAt).toISOString(),

      updated_at: new Date(session.updatedAt).toISOString(),

    }, { onConflict: 'id' });

    if (sessionError) {

      console.warn('Could not save Jelly session:', sessionError.message);

      continue;

    }



    await supabase.from('jelly_chat_messages').delete().eq('session_id', session.id).eq('user_id', userId);

    if (!session.messages.length) continue;



    const { error: messageError } = await supabase.from('jelly_chat_messages').insert(

      session.messages.map((message, index) => ({

        id: message.id === 'welcome' || !/^[0-9a-f-]{36}$/i.test(message.id) ? randomUUID() : message.id,

        session_id: session.id,

        user_id: userId,

        role: message.role,

        content: message.content,

        sort_order: index,

      })),

    );

    if (messageError) console.warn('Could not save Jelly messages:', messageError.message);

  }

}



export async function hydrateJellyChatsFromDb(): Promise<void> {

  const userId = getAuthUserId();

  if (!userId) return;



  const sessionRows = await loadUserRows<Record<string, unknown>>('jelly_chat_sessions', {

    column: 'updated_at',

    ascending: false,

  });

  if (!sessionRows.length) {

    const local = readState();

    if (local) await syncStateToDb(local);

    return;

  }



  const messageRows = await loadUserRows<Record<string, unknown>>('jelly_chat_messages', {

    column: 'sort_order',

    ascending: true,

  });



  const messagesBySession = new Map<string, StoredJellyMessage[]>();

  for (const row of messageRows) {

    const sessionId = String(row.session_id);

    const list = messagesBySession.get(sessionId) || [];

    list.push({

      id: String(row.id),

      role: row.role as StoredJellyMessage['role'],

      content: String(row.content),

    });

    messagesBySession.set(sessionId, list);

  }



  const sessions: JellyChatSession[] = sessionRows.map((row) => ({

    id: String(row.id),

    title: String(row.title || 'New chat'),

    messages: messagesBySession.get(String(row.id))?.length

      ? messagesBySession.get(String(row.id))!

      : [welcomeMessage()],

    createdAt: new Date(String(row.created_at)).getTime(),

    updatedAt: new Date(String(row.updated_at)).getTime(),

  }));



  const active = sessionRows.find((row) => row.is_active) || sessionRows[0];

  writeStateLocal({
    activeSessionId: String(active.id),
    sessions: sessions.slice(0, MAX_SESSIONS),
  });
}



export function createSession(): JellyChatSession {

  const now = Date.now();

  return {

    id: randomUUID(),

    title: 'New chat',

    messages: [welcomeMessage()],

    createdAt: now,

    updatedAt: now,

  };

}



export function loadActiveSession(): { session: JellyChatSession; sessions: JellyChatSession[] } {

  const existing = readState();

  if (existing?.sessions.length) {

    const session = existing.sessions.find((item) => item.id === existing.activeSessionId)

      || existing.sessions[0];

    return { session, sessions: existing.sessions };

  }

  const session = createSession();

  writeState({ activeSessionId: session.id, sessions: [session] });

  return { session, sessions: [session] };

}



export function listSessions(): JellyChatSession[] {

  const existing = readState();

  return (existing?.sessions || []).slice().sort((a, b) => b.updatedAt - a.updatedAt);

}



export function sessionTitleFromMessages(messages: StoredJellyMessage[]): string {

  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim());

  if (!firstUser) return 'New chat';

  const text = firstUser.content.trim().replace(/\s+/g, ' ');

  return text.length > 48 ? `${text.slice(0, 48)}…` : text;

}



export function persistSession(session: JellyChatSession, allSessions: JellyChatSession[]) {

  const title = sessionTitleFromMessages(session.messages);

  const nextSession: JellyChatSession = {

    ...session,

    title,

    updatedAt: Date.now(),

  };

  const others = allSessions.filter((item) => item.id !== session.id);

  const sessions = [nextSession, ...others]

    .sort((a, b) => b.updatedAt - a.updatedAt)

    .slice(0, MAX_SESSIONS);

  writeState({ activeSessionId: nextSession.id, sessions });

  return { session: nextSession, sessions };

}



export function activateSession(sessionId: string): JellyChatSession | null {

  const existing = readState();

  if (!existing) return null;

  const session = existing.sessions.find((item) => item.id === sessionId);

  if (!session) return null;

  writeState({ activeSessionId: session.id, sessions: existing.sessions });

  return session;

}



export function startNewChatSession(): { session: JellyChatSession; sessions: JellyChatSession[] } {

  const existing = readState();

  const sessions = existing?.sessions || [];

  const session = createSession();

  const merged = [session, ...sessions].slice(0, MAX_SESSIONS);

  writeState({ activeSessionId: session.id, sessions: merged });

  return { session, sessions: merged };

}



export function deleteSession(sessionId: string): { session: JellyChatSession; sessions: JellyChatSession[] } | null {

  const existing = readState();

  if (!existing) return null;

  const sessions = existing.sessions.filter((item) => item.id !== sessionId);

  if (!sessions.length) {

    const session = createSession();

    writeState({ activeSessionId: session.id, sessions: [session] });

    return { session, sessions: [session] };

  }

  const session = existing.activeSessionId === sessionId

    ? sessions[0]

    : sessions.find((item) => item.id === existing.activeSessionId) || sessions[0];

  writeState({ activeSessionId: session.id, sessions });

  return { session, sessions };

}


