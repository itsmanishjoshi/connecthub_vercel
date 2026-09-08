import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, History, Loader2, MessageSquare, Mic, Paperclip, Plus, Send, SquarePen, Trash2, X } from 'lucide-react';
import { fetchAttendeesByEvent, fetchEvents } from '@/lib/eventsApi';
import { chatWithConnectHub } from '@/services/aiService';
import { analyzeQuery, executeAction, undoAction, type AIAction } from '@/services/smartAIService';
import { ConversationIntelligencePanel } from '@/components/ConversationIntelligencePanel';
import { JellyIcon } from '@/components/JellyIcon';
import { JELLY_OPEN_EVENT, type JellyOpenDetail } from '@/lib/jellyEvents';
import { deleteConversation, listConversations, type Conversation } from '@/services/conversationService';
import { EventExportPanel } from '@/components/EventExportPanel';
import { commitIngestedPeople, extractPeopleFromSources } from '@/lib/peopleIngest';
import {
  deleteSession,
  loadActiveSession,
  persistSession,
  startNewChatSession,
  type JellyChatSession,
  type StoredJellyMessage,
} from '@/lib/jellyChatStore';

interface Message extends StoredJellyMessage {
  action?: AIAction;
  needsConfirmation?: boolean;
  undoData?: any;
}

interface JellyChatbotProps {
  open: boolean;
  onClose: () => void;
}

function normalizeMode(mode?: JellyOpenDetail['mode']): 'chat' | 'voice' {
  if (mode === 'voice' || mode === 'capture') return 'voice';
  return 'chat';
}

function voiceConversationStatus(item: Conversation) {
  if (item.ai_processing_status === 'complete') return 'Analyzed';
  if (item.ai_processing_status === 'analyzing') return 'Analyzing';
  if (item.ai_processing_status === 'failed') return 'Needs review';
  return 'Captured';
}

function isWriteQuery(query: string) {
  return /^(please\s+)?(add|create|delete|remove|update|edit|rename)\b/i.test(query.trim())
    && /(event|attendee|person|people|note|contact)/i.test(query);
}

function isPeopleImportQuery(query: string) {
  return /add (these )?(people|attendees|speakers|participants)|import .*(people|attendees|list|roster|csv|excel|pdf)|here (is|are) (the )?(people|attendees|speakers|list)/i.test(query)
    || (query.split(/\n/).length >= 3 && /\b(inc|ltd|llp|corp|pvt|speaker|linkedin|cfo|ceo|director)\b/i.test(query));
}

function isExportQuery(query: string) {
  const q = query.trim().toLowerCase();
  if (/^(download|export)(\s+(it|now|file|please|my|the))?$/i.test(q)) return true;
  if (/\bexport\b/.test(q) && /\b(event|even|data|notes|conversations|my)\b/.test(q)) return true;
  if (/\bdownload\b/.test(q) && /\b(notes|data|export|event|my)\b/.test(q)) return true;
  return /export my (event )?data|download my notes|export my notes|export my conversations/i.test(query);
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function isTableSeparator(line: string) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim());
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderChatText(content: string) {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      nodes.push(<div key={`sp-${index}`} className="h-2" />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = parseTableRow(trimmed);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      nodes.push(
        <div key={`tbl-${index}`} className="my-2 overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-700">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80">
              <tr>
                {headers.map((header, headerIndex) => (
                  <th key={headerIndex} className="px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-slate-200/70 dark:border-slate-700/70">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-2.5 py-2 align-top text-slate-700 dark:text-slate-200">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      nodes.push(
        <p key={`num-${index}`} className="mb-1.5 pl-0.5 leading-relaxed">
          {renderInline(trimmed.replace(/^(\d+\.)\s*/, '$1 '))}
        </p>,
      );
      index += 1;
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      nodes.push(
        <p key={`bul-${index}`} className="mb-1 pl-1 leading-relaxed">
          {renderInline(`• ${trimmed.replace(/^[-*]\s+/, '')}`)}
        </p>,
      );
      index += 1;
      continue;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      nodes.push(
        <p key={`hd-${index}`} className="mb-1.5 mt-2 text-sm font-semibold text-slate-900 dark:text-white">
          {renderInline(trimmed.replace(/^#{1,3}\s+/, ''))}
        </p>,
      );
      index += 1;
      continue;
    }

    nodes.push(
      <p key={`ln-${index}`} className="mb-1 last:mb-0 leading-relaxed">
        {renderInline(trimmed)}
      </p>,
    );
    index += 1;
  }

  return nodes;
}

export function JellyChatbot({ open, onClose }: JellyChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [appData, setAppData] = useState<any>(null);
  const [lastUndoData, setLastUndoData] = useState<any>(null);
  const [captureContext, setCaptureContext] = useState<JellyOpenDetail | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);
  const [sessions, setSessions] = useState<JellyChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceHistoryOpen, setVoiceHistoryOpen] = useState(false);
  const [voiceConversations, setVoiceConversations] = useState<Conversation[]>([]);
  const [voicePanelKey, setVoicePanelKey] = useState(0);
  const persistTimerRef = useRef<number | null>(null);

  const suggestions = useMemo(() => {
    const events = appData?.events || [];
    const firstEvent = events[0]?.name;
    const firstCity = events.flatMap((event: any) => event.attendees || []).find((person: any) => person.city || person.location);
    return [
      firstEvent ? `Who should I meet first at ${firstEvent}?` : 'What events do I have?',
      firstCity ? `Who is from ${firstCity.city || firstCity.location}?` : 'Who has deal potential?',
      'Who needs a follow-up today?',
      'Summarize my conversations',
      'Export my event data',
    ];
  }, [appData]);

  useEffect(() => {
    if (!open) return;
    loadAppData();
    const { session, sessions: stored } = loadActiveSession();
    setSessions(stored);
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setHistoryOpen(false);
    fetch(`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/health`)
      .then((response) => response.json().catch(() => ({})))
      .then((health) => setAiConfigured(health.ai === 'configured'))
      .catch(() => setAiConfigured(null));
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (!open || !activeSessionId) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      setSessions((currentSessions) => {
        const storedMessages = messages.map(({ id, role, content }) => ({ id, role, content }));
        const existing = currentSessions.find((item) => item.id === activeSessionId);
        const current: JellyChatSession = {
          id: activeSessionId,
          title: existing?.title || 'New chat',
          messages: storedMessages,
          updatedAt: Date.now(),
          createdAt: existing?.createdAt || Date.now(),
        };
        const { sessions: nextSessions } = persistSession(current, currentSessions);
        return nextSessions;
      });
    }, 250);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [messages, activeSessionId, open]);

  function switchSession(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session || sessionId === activeSessionId) {
      setHistoryOpen(false);
      return;
    }
    const storedMessages = messages.map(({ id, role, content }) => ({ id, role, content }));
    const current: JellyChatSession = {
      id: activeSessionId!,
      title: sessions.find((item) => item.id === activeSessionId)?.title || 'New chat',
      messages: storedMessages,
      updatedAt: Date.now(),
      createdAt: sessions.find((item) => item.id === activeSessionId)?.createdAt || Date.now(),
    };
    const { sessions: savedSessions } = persistSession(current, sessions);
    const next = savedSessions.find((item) => item.id === sessionId) || session;
    setSessions(savedSessions);
    setActiveSessionId(next.id);
    setMessages(next.messages);
    setShowExportPanel(false);
    setHistoryOpen(false);
    setLastUndoData(null);
  }

  function handleNewChat() {
    const storedMessages = messages.map(({ id, role, content }) => ({ id, role, content }));
    if (activeSessionId) {
      const current: JellyChatSession = {
        id: activeSessionId,
        title: sessions.find((item) => item.id === activeSessionId)?.title || 'New chat',
        messages: storedMessages,
        updatedAt: Date.now(),
        createdAt: sessions.find((item) => item.id === activeSessionId)?.createdAt || Date.now(),
      };
      persistSession(current, sessions);
    }
    const { session, sessions: nextSessions } = startNewChatSession();
    setSessions(nextSessions);
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setShowExportPanel(false);
    setHistoryOpen(false);
    setLastUndoData(null);
    setInput('');
    setPendingFiles([]);
  }

  function saveCurrentSessionNow(nextSessions = sessions) {
    if (!activeSessionId) return nextSessions;
    const storedMessages = messages.map(({ id, role, content }) => ({ id, role, content }));
    const existing = nextSessions.find((item) => item.id === activeSessionId);
    const current: JellyChatSession = {
      id: activeSessionId,
      title: existing?.title || 'New chat',
      messages: storedMessages,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || Date.now(),
    };
    const { sessions: saved } = persistSession(current, nextSessions);
    setSessions(saved);
    return saved;
  }

  function handleClose() {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    saveCurrentSessionNow();
    onClose();
  }

  function handleDeleteSession(sessionId: string) {
    const result = deleteSession(sessionId);
    if (!result) return;
    setSessions(result.sessions);
    setActiveSessionId(result.session.id);
    setMessages(result.session.messages);
    setShowExportPanel(false);
    if (result.sessions.length <= 1) setHistoryOpen(false);
  }

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<JellyOpenDetail>).detail || {};
      setMode(normalizeMode(detail.mode));
      setCaptureContext(detail);
      setVoiceHistoryOpen(false);
      if (detail.prompt) {
        setMode('chat');
        setLoading(false);
        setSeedPrompt(detail.prompt);
      }
    };
    window.addEventListener(JELLY_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(JELLY_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open || mode !== 'voice') return;
    void refreshVoiceConversations();
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== 'chat' || historyOpen) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollChatToBottom('auto'));
    });
  }, [mode, open, historyOpen, activeSessionId]);

  useEffect(() => {
    if (!open || mode !== 'chat' || historyOpen) return;
    scrollChatToBottom('smooth');
  }, [messages, loading]);

  async function loadAppData() {
    try {
      const [events, conversations] = await Promise.all([fetchEvents(), listConversations().catch(() => [])]);
      const eventsWithAttendees = await Promise.all(
        events.map(async (event) => ({
          ...event,
          attendees: await fetchAttendeesByEvent(event.id),
        }))
      );
      const next = { events: eventsWithAttendees, conversations };
      setAppData(next);
      setVoiceConversations(conversations);
      setDataReady(true);
      return next;
    } catch (error) {
      console.error('Failed to load app data:', error);
      setDataReady(false);
      return null;
    }
  }

  async function refreshVoiceConversations() {
    try {
      const rows = await listConversations();
      setVoiceConversations(rows);
      setAppData((current: any) => (current ? { ...current, conversations: rows } : current));
    } catch {
      setVoiceConversations(appData?.conversations || []);
    }
  }

  function openVoiceConversation(conversationId: string) {
    setCaptureContext((current) => ({ ...(current || {}), conversationId }));
    setVoiceHistoryOpen(false);
    setVoicePanelKey((key) => key + 1);
  }

  function startNewVoiceCapture() {
    setCaptureContext((current) => {
      if (!current) return null;
      const { conversationId: _ignored, ...rest } = current;
      return Object.keys(rest).length > 0 ? rest : null;
    });
    setVoiceHistoryOpen(false);
    setVoicePanelKey((key) => key + 1);
  }

  function returnToPresentRecording() {
    startNewVoiceCapture();
  }

  function scrollChatToBottom(behavior: ScrollBehavior = 'smooth') {
    const container = chatMessagesRef.current;
    if (container) {
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  async function handleDeleteVoiceConversation(conversationId: string) {
    if (!confirm('Delete this conversation, transcript, and insights?')) return;
    await deleteConversation(conversationId);
    if (captureContext?.conversationId === conversationId) {
      startNewVoiceCapture();
    }
    await refreshVoiceConversations();
  }

  async function sendQuery(raw: string) {
    const query = raw.trim();
    if ((!query && !pendingFiles.length) || loading) return;

    setMessages((current) => [...current, { id: String(Date.now()), role: 'user', content: query }]);
    setInput('');
    setLoading(true);
    requestAnimationFrame(() => inputRef.current?.focus());

    try {
      if (/record|transcribe|start conversation intelligence|\bvoice\b/i.test(query) && /record|transcribe|voice|conversation intelligence|meeting/i.test(query)) {
        setMode('voice');
        setMessages((current) => [...current, {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'Opening Voice. I’ll sit in like an analyst - capture the discussion, gather requirements, and map systems, decisions, and follow-ups.',
        }]);
        return;
      }

      if (isExportQuery(query)) {
        setShowExportPanel(true);
        setMessages((current) => [...current, {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: showExportPanel
            ? 'Use the **Preview** button on an event below, then **Download .md** or **JSON**. That file contains only your private notes, flags, and conversations — not the shared attendee roster.'
            : 'Here are the events where you left notes, flags, or recorded conversations. Tap **Preview**, then **Download .md** or **JSON**. Files are named **Your Name - Event Name**.',
        }]);
        return;
      }

      let data = appData;
      if (!data?.events) {
        data = await loadAppData();
      }

      const files = pendingFiles;
      if (files.length || isPeopleImportQuery(query)) {
        const events = data?.events || [];
        const named = events.find((event: any) => event.name && query.toLowerCase().includes(String(event.name).toLowerCase()));
        const event = named
          || events.find((item: any) => item.id === captureContext?.eventId)
          || (events.length === 1 ? events[0] : null);
        if (!event) {
          setPendingFiles([]);
          setMessages((current) => [...current, {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: 'Which event should I add these people to? Name the event in your message.',
          }]);
          return;
        }
        if (event.can_edit === false) {
          setPendingFiles([]);
          setMessages((current) => [...current, {
            id: String(Date.now() + 1),
            role: 'assistant',
            content: `You can view ${event.name}, but you cannot add people. Ask an organizer to give you edit access.`,
          }]);
          return;
        }
        const extracted = await extractPeopleFromSources(event.id, { text: query, files });
        const saved = await commitIngestedPeople(event.id, extracted.people);
        setPendingFiles([]);
        await loadAppData();
        const names = extracted.people.slice(0, 8).map((person) => person.name).join(', ');
        const parts = [];
        if (saved.added) parts.push(`added ${saved.added}`);
        if (saved.updated) parts.push(`updated ${saved.updated}`);
        if (saved.skipped) parts.push(`skipped ${saved.skipped}`);
        setMessages((current) => [...current, {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `${parts.length ? parts.join(' · ') : 'No changes'} for ${event.name}. ${names}${extracted.people.length > 8 ? '…' : ''}${extracted.warnings?.length ? `\n\n${extracted.warnings.join(' ')}` : ''}`,
        }]);
        return;
      }

      if (isWriteQuery(query)) {
        const aiResponse = await analyzeQuery(query);
        setMessages((current) => [...current, {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: aiResponse.message,
          action: aiResponse.action,
          needsConfirmation: aiResponse.needsConfirmation,
        }]);
        return;
      }

      const history = messages
        .filter((item) => item.id !== 'welcome')
        .slice(-8)
        .map((item) => ({ role: item.role, content: item.content }));
      const answer = await chatWithConnectHub(query, history);
      setMessages((current) => [...current, { id: String(Date.now() + 1), role: 'assistant', content: answer }]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: aiConfigured === false
          ? 'Chat needs an AI key on this server. Voice capture still works without it.'
          : 'I couldn’t complete that just now. Try again in a moment.',
      }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function handleConfirm(action: AIAction) {
    setLoading(true);
    try {
      const result = await executeAction(action);
      await loadAppData();
      setMessages((current) => [...current, {
        id: String(Date.now()),
        role: 'assistant',
        content: result.message,
        undoData: result.undoData,
      }]);
      if (result.undoData) setLastUndoData(result.undoData);
    } catch (error: any) {
      setMessages((current) => [...current, {
        id: String(Date.now()),
        role: 'assistant',
        content: error.message || 'That change could not be completed.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    if (!lastUndoData) return;
    setLoading(true);
    try {
      const result = await undoAction(lastUndoData);
      await loadAppData();
      setLastUndoData(null);
      setMessages((current) => [...current, { id: String(Date.now()), role: 'assistant', content: result.message }]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !seedPrompt || loading) return;
    const query = seedPrompt;
    setSeedPrompt(null);
    void sendQuery(query);
  }, [open, seedPrompt, loading]);

  if (!open) return null;

  const activeTitle = sessions.find((item) => item.id === activeSessionId)?.title || 'New chat';
  const activeVoiceConversation = voiceConversations.find((item) => item.id === captureContext?.conversationId);
  const viewingPastRecording = Boolean(captureContext?.conversationId);
  const showVoiceBackToPresent = voiceHistoryOpen || viewingPastRecording;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent
        hideClose
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        className="fixed bottom-0 left-[50%] top-auto z-[70] flex h-[min(100dvh,720px)] w-[calc(100vw-0.5rem)] max-w-none translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl border-0 bg-gradient-to-b from-slate-50 to-white p-0 shadow-2xl outline-none focus:outline-none focus-visible:outline-none dark:from-slate-900 dark:to-slate-950 sm:bottom-auto sm:top-[50%] sm:h-[min(90vh,760px)] sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-2xl md:max-w-xl lg:h-[min(90vh,820px)] lg:max-w-2xl xl:max-w-3xl"
      >
        <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <JellyIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Jelly</h2>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {mode === 'voice'
                  ? voiceHistoryOpen
                    ? 'Past recordings'
                    : activeVoiceConversation?.title
                      ? activeVoiceConversation.title
                      : captureContext?.attendeeName
                        ? `Voice · ${captureContext.attendeeName}`
                        : 'Meeting capture & analysis'
                  : historyOpen
                    ? 'Past chats'
                    : dataReady
                      ? activeTitle
                      : 'Your event assistant'}
              </p>
            </div>
            {mode === 'chat' && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((current) => !current)}
                  className={`rounded-lg p-2 ${historyOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white'}`}
                  aria-label="Chat history"
                  title="Past chats"
                >
                  <History className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="New chat"
                  title="New chat"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </div>
            )}
            {mode === 'voice' && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={startNewVoiceCapture}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="New recording"
                  title="New recording"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
            <button type="button" onClick={handleClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setMode('chat');
                setVoiceHistoryOpen(false);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === 'chat'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('voice');
                setHistoryOpen(false);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === 'voice'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              Voice
            </button>
          </div>
        </header>

        {mode === 'voice' ? (
          <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
            {voiceHistoryOpen ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                <div className="space-y-1">
                  {voiceConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                        conversation.id === captureContext?.conversationId ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openVoiceConversation(conversation.id)}
                        className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      >
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {conversation.title || 'Untitled conversation'}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {conversation.company_name || 'No company'} · {voiceConversationStatus(conversation)}
                          {conversation.created_at ? ` · ${new Date(conversation.created_at).toLocaleString()}` : ''}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteVoiceConversation(conversation.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                        aria-label={`Delete ${conversation.title || 'conversation'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {!voiceConversations.length && (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">
                      No saved recordings yet. Start a new one with the microphone.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden">
                <ConversationIntelligencePanel
                  key={`${voicePanelKey}-${captureContext?.conversationId || 'new'}`}
                  context={captureContext}
                  embedded
                />
              </div>
            )}
            <div className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
              <button
                type="button"
                onClick={() => {
                  if (showVoiceBackToPresent) {
                    returnToPresentRecording();
                    return;
                  }
                  void refreshVoiceConversations();
                  setVoiceHistoryOpen(true);
                }}
                className="w-full rounded-lg py-2 text-center text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
              >
                {showVoiceBackToPresent ? 'Back to recording' : 'View past conversations'}
              </button>
            </div>
          </div>
        ) : historyOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <p className="px-2 pb-2 text-xs text-slate-500 dark:text-slate-400">
              Chats are saved on this device for your account.
            </p>
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1 ${
                    session.id === activeSessionId ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => switchSession(session.id)}
                    className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{session.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(session.updatedAt).toLocaleString()} · {Math.max(0, session.messages.filter((m) => m.id !== 'welcome').length)} messages
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(session.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                    aria-label={`Delete ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={chatMessagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
                      <JellyIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className={`text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm'
                      : 'max-w-[calc(100%-2.25rem)] rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100'
                  }`}>
                    {renderChatText(message.content)}
                    {message.needsConfirmation && message.action && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="h-8" disabled={loading} onClick={() => handleConfirm(message.action!)}>
                          <Check className="mr-1 h-3 w-3" />Confirm
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" disabled={loading} onClick={() => setMessages((current) => [...current, { id: String(Date.now()), role: 'assistant', content: 'Cancelled. Nothing was changed.' }])}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {message.undoData && (
                      <button type="button" className="mt-2 text-xs text-slate-400 hover:text-slate-600" disabled={loading} onClick={handleUndo}>
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  </div>
                  <p className="rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/90">
                    Jelly is looking through your data…
                  </p>
                </div>
              )}
              {showExportPanel && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <EventExportPanel compact />
                </div>
              )}
              {messages.length <= 1 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => sendQuery(item)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendQuery(input);
              }}
              className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-1.5 dark:border-slate-700 dark:bg-slate-800/80">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="sr-only"
                  accept=".csv,.txt,.xlsx,.xls,.pdf,image/*"
                  onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
                />
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach a list"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={pendingFiles.length ? `${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''} attached` : 'Ask Jelly…'}
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 text-[16px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-50 dark:placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" size="icon" className={`h-11 w-11 shrink-0 rounded-xl ${(!input.trim() && !pendingFiles.length) || loading ? 'pointer-events-none opacity-50' : ''}`}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
