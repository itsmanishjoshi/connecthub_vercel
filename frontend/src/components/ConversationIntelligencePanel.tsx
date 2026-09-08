import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { fetchEvents, fetchAttendeesByEvent, type Attendee, type Event } from '@/lib/eventsApi';
import { browserSpeechProvider } from '@/lib/speech/browserSpeech';
import { correctBusinessTerms } from '@/lib/speech/termCorrector';
import type { SpeechToTextSession, TranscriptDraft } from '@/lib/speech/types';
import type { JellyOpenDetail } from '@/lib/jellyEvents';
import {
  analyzeConversation,
  applyMeetingToPerson,
  cacheDraft,
  createConversation,
  deleteConversation,
  deleteInsight,
  evidenceLabel,
  exportConversationMarkdown,
  formatClock,
  listConversations,
  listInsights,
  listSegments,
  parsePastedTranscript,
  readDraft,
  saveFinalSegments,
  searchConversations,
  summarizeEventIntelligence,
  updateConversation,
  updateInsight,
  updateSegment,
  uploadAudioChunk,
  type Conversation,
  type ConversationInsight,
} from '@/services/conversationService';

type PanelPhase = 'ready' | 'consent' | 'recording' | 'paused' | 'review';
type SyncState = 'offline' | 'syncing' | 'synced';

interface ConversationIntelligencePanelProps {
  context?: JellyOpenDetail | null;
  /** When true, hides the sidebar and uses a compact layout inside Jelly. */
  embedded?: boolean;
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (/Microphone access needs HTTPS/i.test(message)) return message;
  if (/not-allowed|denied|Permission/i.test(message)) return 'Microphone permission was denied. You can still paste a transcript.';
  if (/not configured/i.test(message)) return 'AI is not configured on this server. Your transcript is safe.';
  if (/decommissioned|does not exist|model/i.test(message) && /llama|gpt-oss|qwen/i.test(message)) {
    return 'The AI model on this server is no longer available. Your transcript is safe.';
  }
  if (/Failed to fetch|Network/i.test(message)) return 'We temporarily lost the connection. Your conversation is safe and will sync when connectivity returns.';
  if (message && message.length < 180) return message;
  return fallback;
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function InsightBody({ text, heading }: { text: string; heading?: string }) {
  const stripped = heading
    ? text.replace(new RegExp(`^#{1,3}\\s*${heading}\\s*`, 'i'), '').trim()
    : text.trim();
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {stripped.split('\n').map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        if (/^###\s/.test(line)) return <p key={index} className="pt-1 font-semibold text-slate-900 dark:text-white">{renderInline(line.replace(/^###\s+/, ''))}</p>;
        if (/^##\s/.test(line)) return <p key={index} className="pt-1 font-semibold text-slate-900 dark:text-white">{renderInline(line.replace(/^##\s+/, ''))}</p>;
        if (/^#\s/.test(line)) return <p key={index} className="font-semibold text-slate-900 dark:text-white">{renderInline(line.replace(/^#\s+/, ''))}</p>;
        if (/^[-*]\s/.test(line)) return <p key={index} className="pl-3">{renderInline(`• ${line.replace(/^[-*]\s+/, '')}`)}</p>;
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

const EVIDENCE_STYLES: Record<string, { label: string; className: string }> = {
  fact: { label: 'Stated in conversation', className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  source_derived: { label: 'From transcript', className: 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200' },
  ai_inference: { label: 'AI inference - review before using', className: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100' },
  user_confirmed: { label: 'Confirmed', className: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200' },
};

function InsightBlock({
  title,
  items,
  markdownHeading,
  onJump,
  onEdit,
  onDelete,
}: {
  title: string;
  items: ConversationInsight[];
  markdownHeading?: string;
  onJump: (item: ConversationInsight) => void;
  onEdit: (item: ConversationInsight, body: string) => void;
  onDelete: (item: ConversationInsight) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => {
          const stamp = evidenceLabel(item.evidence_start_ms, item.evidence_end_ms);
          const evidence = EVIDENCE_STYLES[item.evidence_kind] || {
            label: item.evidence_kind.replace(/_/g, ' '),
            className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
          };
          return (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              {item.title && item.title.toLowerCase() !== title.toLowerCase() && (
                <p className="mb-1 text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
              )}
              {editingId === item.id ? (
                <div className="space-y-2">
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-[72px] text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8" onClick={() => { onEdit(item, draft); setEditingId(null); }}>Save</Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <InsightBody text={item.body} heading={markdownHeading} />
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className={`rounded-full px-2 py-0.5 ${evidence.className}`}>{evidence.label}</span>
                {item.confidence && <span>Confidence: {item.confidence}</span>}
                {item.owner && <span>Owner: {item.owner}</span>}
                {item.due_at && <span>Due: {item.due_at}</span>}
                {stamp && (
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => onJump(item)}>
                    Evidence {stamp}
                  </button>
                )}
                <button type="button" className="hover:underline" onClick={() => { setEditingId(item.id); setDraft(item.body); }}>Edit</button>
                <button type="button" className="text-rose-600 hover:underline" onClick={() => onDelete(item)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ConversationIntelligencePanel({ context, embedded = false }: ConversationIntelligencePanelProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [insights, setInsights] = useState<ConversationInsight[]>([]);
  const [eventInsights, setEventInsights] = useState<ConversationInsight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<PanelPhase>('ready');
  const [search, setSearch] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('all');
  const [eventId, setEventId] = useState(context?.eventId || '');
  const [attendeeId, setAttendeeId] = useState(context?.attendeeId || '');
  const [companyName, setCompanyName] = useState(context?.companyName || '');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'microphone' | 'paste' | 'upload'>('microphone');
  const [drafts, setDrafts] = useState<TranscriptDraft[]>([]);
  const [partial, setPartial] = useState('');
  const [language, setLanguage] = useState('Detecting…');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(navigator.onLine ? 'synced' : 'offline');
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('Jelly is ready to sit in on this conversation.');
  const [error, setError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [focusSegmentMs, setFocusSegmentMs] = useState<number | null>(null);
  const [speechSupported] = useState(() => browserSpeechProvider.isSupported());
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  const sessionRef = useRef<SpeechToTextSession | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalsRef = useRef<TranscriptDraft[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  const selected = conversations.find((item) => item.id === selectedId) || null;
  const visibleConversations = useMemo(() => searchConversations(conversations, search), [conversations, search]);
  const speakers = useMemo(() => Array.from(new Set(drafts.map((item) => item.speakerLabel).filter(Boolean))), [drafts]);
  const visibleDrafts = drafts.filter((draft) => {
    const textMatch = !transcriptSearch || draft.text.toLowerCase().includes(transcriptSearch.toLowerCase());
    const speakerMatch = speakerFilter === 'all' || draft.speakerLabel === speakerFilter;
    return textMatch && speakerMatch;
  });
  const eventConversations = conversations.filter((item) => eventId && item.event_id === eventId);
  const eventStats = summarizeEventIntelligence(eventConversations, eventInsights);

  useEffect(() => {
    loadCatalog();
    fetch(`${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/health`)
      .then((response) => response.json())
      .then((health) => setAiConfigured(health.ai === 'configured'))
      .catch(() => setAiConfigured(null));
  }, []);

  useEffect(() => {
    if (context?.eventId) setEventId(context.eventId);
    if (context?.attendeeId) setAttendeeId(context.attendeeId);
    if (context?.companyName) setCompanyName(context.companyName);
    if (context?.suggestedTitle) {
      setTitle(context.suggestedTitle);
    } else if (context?.attendeeName) {
      const eventName = context.eventName || '';
      setTitle([context.attendeeName, eventName, new Date().toLocaleString()].filter(Boolean).join(' · '));
    }
    if (context?.conversationId) {
      void openConversation(context.conversationId);
      return;
    }
    if (context?.autoStart && context.attendeeId) {
      beginConsent();
    }
  }, [context]);

  useEffect(() => {
    if (!eventId) {
      setAttendees([]);
      return;
    }
    fetchAttendeesByEvent(eventId)
      .then((rows) => {
        setAttendees(rows);
        const match = rows.find((row) => row.id === attendeeId);
        if (match?.company && !companyName) setCompanyName(match.company);
      })
      .catch(() => setAttendees([]));
  }, [eventId]);

  useEffect(() => {
    const online = () => setSyncState('synced');
    const offline = () => setSyncState('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  function resetMainScroll() {
    requestAnimationFrame(() => {
      if (mainRef.current) mainRef.current.scrollTop = 0;
    });
  }

  useEffect(() => {
    if (phase !== 'recording') return;
    const list = transcriptListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [drafts, partial, phase]);

  useEffect(() => () => stopCapture(true), []);

  async function loadCatalog() {
    try {
      const [eventRows, conversationRows] = await Promise.all([fetchEvents(), listConversations()]);
      setEvents(eventRows);
      setConversations(conversationRows);
    } catch (loadError) {
      setError(friendlyError(loadError, 'Could not load conversation history.'));
    }
  }

  async function refreshEventIntelligence(nextEventId = eventId) {
    if (!nextEventId) {
      setEventInsights([]);
      return;
    }
    const related = conversations.filter((item) => item.event_id === nextEventId);
    const rows = (await Promise.all(related.slice(0, 8).map((item) => listInsights(item.id).catch(() => [])))).flat();
    setEventInsights(rows);
  }

  async function persistDrafts(id: string, nextDrafts: TranscriptDraft[]) {
    nextDrafts = nextDrafts.map((draft) => ({ ...draft, text: correctBusinessTerms(draft.text) }));
    cacheDraft(id, nextDrafts);
    if (!navigator.onLine) {
      setSyncState('offline');
      return;
    }
    setSyncState('syncing');
    try {
      await saveFinalSegments(id, nextDrafts);
      await updateConversation(id, { transcription_status: 'saved' });
      setSyncState('synced');
    } catch {
      setSyncState('offline');
    }
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    conversationIdRef.current = id;
    setPhase('review');
    setError(null);
    setTranscriptSearch('');
    setSpeakerFilter('all');
    setFocusSegmentMs(null);
    resetMainScroll();
    try {
      const [conversationRows, segmentRows, insightRows] = await Promise.all([
        listConversations(),
        listSegments(id),
        listInsights(id),
      ]);
      const conversation = conversationRows.find((item) => item.id === id);
      setConversations(conversationRows);
      if (conversation) {
        setEventId(conversation.event_id || '');
        setAttendeeId(conversation.attendee_id || '');
        setCompanyName(conversation.company_name || '');
        setTitle(conversation.title || '');
      }
      const mapped: TranscriptDraft[] = (segmentRows.length ? segmentRows : readDraft(id)).map((segment: any, index: number) => ({
        id: segment.id || `seg-${index}`,
        speakerLabel: segment.speaker_label || segment.speakerLabel || 'Speaker',
        startMs: segment.start_ms ?? segment.startMs ?? index * 1000,
        endMs: segment.end_ms ?? segment.endMs ?? 0,
        language: segment.language,
        text: segment.text,
        confidence: segment.confidence,
        isFinal: true,
      }));
      finalsRef.current = mapped;
      setDrafts(mapped);
      setInsights(insightRows);
      setStatusText(insightRows.length ? 'Conversation intelligence is ready.' : 'Transcript saved. Analyze when you are ready.');
      await refreshEventIntelligence(conversation?.event_id || eventId);
      resetMainScroll();
    } catch (loadError) {
      setError(friendlyError(loadError, 'Could not open that conversation.'));
    }
  }

  function beginConsent() {
    setError(null);
    setPhase('consent');
    setStatusText('Confirm everyone is comfortable being recorded. Jelly will take notes like an analyst in the room.');
  }

  async function startCapture() {
    setBusy(true);
    setError(null);
    try {
      const attendee = attendees.find((row) => row.id === attendeeId);
      const conversation = await createConversation({
        title: title || [attendee?.name || context?.attendeeName, context?.eventName || events.find((item) => item.id === eventId)?.name, new Date().toLocaleString()].filter(Boolean).join(' · ') || 'Conversation',
        event_id: eventId || null,
        attendee_id: attendeeId || null,
        company_name: companyName || attendee?.company || context?.companyName || null,
        conversation_type: 'in_person',
        source,
        consent_confirmed: true,
      });
      conversationIdRef.current = conversation.id;
      setSelectedId(conversation.id);
      setConversations((current) => [conversation, ...current]);
      finalsRef.current = [];
      setDrafts([]);
      setInsights([]);
      setPartial('');
      startedAtRef.current = Date.now();
      elapsedRef.current = 0;
      setElapsedMs(0);
      await updateConversation(conversation.id, {
        status: 'recording',
        recording_status: 'recording',
        transcription_status: source === 'microphone' ? 'listening' : 'idle',
        started_at: new Date().toISOString(),
      });

      if (source === 'microphone') {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Microphone access needs HTTPS (or localhost). Ask IT to enable HTTPS on the server, or open ConnectHub via https://.',
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = async (event) => {
          if (event.data.size < 1 || !conversationIdRef.current) return;
          try {
            await uploadAudioChunk(conversationIdRef.current, event.data);
          } catch {
            setSyncState('offline');
          }
        };
        recorder.start(8000);
        recorderRef.current = recorder;
        if (speechSupported) {
          sessionRef.current = await browserSpeechProvider.startSession({
            onPartial: (draft) => setPartial(draft.text),
            onFinal: (draft) => {
              const next = [...finalsRef.current, { ...draft, id: `${Date.now()}-${finalsRef.current.length}` }];
              finalsRef.current = next;
              setDrafts(next);
              setPartial('');
              if (draft.language) setLanguage(draft.language);
              if (conversationIdRef.current) void persistDrafts(conversationIdRef.current, next);
            },
            onLanguage: (value) => setLanguage(value || 'Detected'),
            onError: (message) => setError(message),
          });
        } else {
          setStatusText('This browser cannot live-transcribe. Audio is still being captured - paste a transcript after you stop.');
        }
      }

      timerRef.current = window.setInterval(() => {
        const next = Date.now() - startedAtRef.current + elapsedRef.current;
        setElapsedMs(next);
      }, 250);
      setPhase('recording');
      setStatusText('Jelly is in the room - capturing the conversation, names, systems, and commitments.');
    } catch (startError) {
      setError(friendlyError(startError, 'Could not start capture.'));
      setPhase('ready');
    } finally {
      setBusy(false);
    }
  }

  async function pauseCapture() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.pause();
    if (timerRef.current) window.clearInterval(timerRef.current);
    elapsedRef.current = elapsedMs;
    if (conversationIdRef.current) {
      await updateConversation(conversationIdRef.current, { recording_status: 'paused' }).catch(() => {});
    }
    setPhase('paused');
    setStatusText('Recording paused. Your transcript so far is kept.');
  }

  async function resumeCapture() {
    startedAtRef.current = Date.now();
    if (recorderRef.current?.state === 'paused') recorderRef.current.resume();
    if (source === 'microphone' && speechSupported) {
      sessionRef.current = await browserSpeechProvider.startSession({
        onPartial: (draft) => setPartial(draft.text),
        onFinal: (draft) => {
          const next = [...finalsRef.current, { ...draft, id: `${Date.now()}-${finalsRef.current.length}` }];
          finalsRef.current = next;
          setDrafts(next);
          setPartial('');
          if (conversationIdRef.current) void persistDrafts(conversationIdRef.current, next);
        },
        onLanguage: (value) => setLanguage(value || 'Detected'),
        onError: (message) => setError(message),
      });
    }
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current + elapsedRef.current);
    }, 250);
    if (conversationIdRef.current) {
      await updateConversation(conversationIdRef.current, { recording_status: 'recording' }).catch(() => {});
    }
    setPhase('recording');
    setStatusText('Listening again.');
  }

  async function stopCapture(silent = false) {
    sessionRef.current?.stop();
    sessionRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    const id = conversationIdRef.current;
    if (!id || silent) return;
    const duration = Math.round((elapsedRef.current + (phase === 'recording' ? Date.now() - startedAtRef.current : 0)) / 1000);
    try {
      await persistDrafts(id, finalsRef.current);
      await updateConversation(id, {
        status: 'transcribed',
        recording_status: 'stopped',
        transcription_status: finalsRef.current.length ? 'saved' : 'idle',
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        primary_language: language !== 'Detecting…' ? language : null,
      });
      await loadCatalog();
    } catch (stopError) {
      setError(friendlyError(stopError, 'Stopped, but sync is pending.'));
    }
    setPhase('review');
    setStatusText(finalsRef.current.length ? 'Transcript saved. Analyze when you are ready.' : 'No transcript yet. Paste text or retry capture.');
  }

  async function applyPastedTranscript() {
    if (!pasteText.trim()) return;
    setBusy(true);
    try {
      const parsed = parsePastedTranscript(pasteText);
      let id = conversationIdRef.current;
      if (!id) {
        const conversation = await createConversation({
          title: title || 'Pasted conversation',
          event_id: eventId || null,
          attendee_id: attendeeId || null,
          company_name: companyName || null,
          source: 'paste',
          consent_confirmed: true,
        });
        id = conversation.id;
        conversationIdRef.current = id;
        setSelectedId(id);
        setConversations((current) => [conversation, ...current]);
      }
      finalsRef.current = parsed;
      setDrafts(parsed);
      await persistDrafts(id, parsed);
      await updateConversation(id, { source: 'paste', status: 'transcribed', transcription_status: 'saved' });
      setPhase('review');
      setStatusText('Pasted transcript saved.');
      setPasteText('');
    } catch (pasteError) {
      setError(friendlyError(pasteError, 'Could not save the pasted transcript.'));
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis() {
    const id = conversationIdRef.current;
    if (!id) return;
    setBusy(true);
    setError(null);
    setStatusText('Analyzing conversation…');
    try {
      await persistDrafts(id, finalsRef.current);
      const result = await analyzeConversation(id);
      const insightRows = result.insights || await listInsights(id);
      setInsights(insightRows);
      if (attendeeId) {
        await applyMeetingToPerson(attendeeId, insightRows).catch(() => null);
      }
      await loadCatalog();
      await refreshEventIntelligence();
      setStatusText('Notes are on this person. Copy the follow-up before you leave the room.');
    } catch (analyzeError) {
      setError(friendlyError(analyzeError, 'AI processing failed. Your transcript is safe.'));
      setStatusText('AI processing failed. Your transcript is safe.');
    } finally {
      setBusy(false);
    }
  }

  function goToVoiceHome() {
    conversationIdRef.current = null;
    setSelectedId(null);
    setDrafts([]);
    setInsights([]);
    setPartial('');
    setPasteText('');
    setError(null);
    setTitle('');
    setCompanyName(context?.companyName || '');
    setSource('microphone');
    setPhase('ready');
    setStatusText('Jelly is ready to sit in on this conversation.');
    resetMainScroll();
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm('Delete this conversation, transcript, and insights?')) return;
    await deleteConversation(id);
    if (selectedId === id) goToVoiceHome();
    await loadCatalog();
  }

  const byKind = (kind: string) => insights.filter((item) => item.kind === kind);
  const copyText = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setStatusText('Copied. Edit before you send it.');
  };

  const reviewing = Boolean(selectedId) || phase === 'recording' || phase === 'paused' || phase === 'consent';

  return (
    <div className={`flex h-full min-h-0 flex-col ${embedded ? '' : 'lg:flex-row'}`}>
      {!embedded && (
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 p-3 dark:border-slate-700 lg:h-full lg:w-64 lg:border-b-0 lg:border-r">
        <Button variant="outline" className="mb-3 h-9 w-full justify-center gap-1.5" onClick={goToVoiceHome}>
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </Button>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations…" className="mb-3 h-9" />
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {visibleConversations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectedId === item.id ? goToVoiceHome() : openConversation(item.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left ${selectedId === item.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.title || 'Untitled conversation'}</p>
              <p className="truncate text-[11px] text-slate-500">{item.company_name || 'No company'} · {item.ai_processing_status === 'complete' ? 'Analyzed' : item.ai_processing_status === 'analyzing' ? 'Analyzing' : item.ai_processing_status === 'failed' ? 'Needs review' : 'Captured'}</p>
            </button>
          ))}
          {!visibleConversations.length && <p className="px-1 text-xs text-slate-500">No saved conversations yet.</p>}
        </div>
      </aside>
      )}

      <div ref={mainRef} className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${embedded ? 'p-3' : 'p-4'}`}>
        <div className={`mb-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${embedded ? 'p-3' : 'mb-4 p-4'}`}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{reviewing ? (selected?.title || 'Conversation') : 'Meeting notes'}</p>
              <p className="text-xs text-slate-500">{reviewing ? 'Review the transcript and what Jelly mapped from the discussion.' : 'Jelly sits in like a business analyst: captures the conversation, gathers requirements, and maps systems, decisions, and follow-ups.'}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[11px] ${syncState === 'synced' ? 'bg-emerald-50 text-emerald-700' : syncState === 'syncing' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {syncState === 'synced' ? 'Synced' : syncState === 'syncing' ? 'Syncing' : 'Offline'}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              Event
              <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-background px-2 text-sm dark:border-slate-700">
                <option value="">Not linked</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Person
              <select value={attendeeId} onChange={(event) => {
                setAttendeeId(event.target.value);
                const match = attendees.find((row) => row.id === event.target.value);
                if (match?.company) setCompanyName(match.company);
                if (match?.name && !title) setTitle(match.name);
              }} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-background px-2 text-sm dark:border-slate-700">
                <option value="">{context?.attendeeName || 'Not linked'}</option>
                {attendees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Company
              <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-1 h-10" placeholder="Company" />
            </label>
            <label className="text-xs text-slate-500">
              Title
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-10" placeholder="Conversation title" />
            </label>
          </div>

          {eventId && eventConversations.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Event intelligence: {eventStats.conversations} conversations · {eventStats.painPoints} pain points · {eventStats.opportunities} opportunities · {eventStats.followUps} follow-ups
            </p>
          )}

          {aiConfigured === false && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              AI analysis is not configured on this server. Recording and transcripts still work. Set an AI provider key (Groq, Grok, OpenRouter, etc.) in the server environment to use intelligence.
            </p>
          )}

          {phase === 'consent' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p>Jelly will record, transcribe, and map this discussion into requirements, systems, decisions, and follow-ups. Confirm that everyone in the room is comfortable with that.</p>
              <div className="mt-3 flex gap-2">
                <Button className="h-10" onClick={startCapture} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Recording'}</Button>
                <Button variant="outline" className="h-10" onClick={() => setPhase('ready')}>Cancel</Button>
              </div>
            </div>
          )}

          {(phase === 'recording' || phase === 'paused') && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{phase === 'recording' ? '● RECORDING' : 'Paused'}</p>
                <p className="font-mono text-lg">{formatClock(elapsedMs)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{language} · {speechSupported ? 'Taking notes…' : 'Audio only'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {phase === 'recording' ? (
                  <Button variant="outline" className="h-10" onClick={pauseCapture}><Pause className="mr-1 h-4 w-4" />Pause</Button>
                ) : (
                  <Button variant="outline" className="h-10" onClick={resumeCapture}><Play className="mr-1 h-4 w-4" />Resume</Button>
                )}
                <Button className="h-10 bg-rose-600 hover:bg-rose-700" onClick={() => stopCapture(false)}><Square className="mr-1 h-4 w-4" />Stop</Button>
              </div>
            </div>
          )}

          {phase === 'ready' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="h-11 min-w-[120px]" onClick={beginConsent}><Mic className="mr-1 h-4 w-4" />Start</Button>
              <Button variant="outline" className="h-11" onClick={() => setSource(source === 'paste' ? 'microphone' : 'paste')}>Paste transcript</Button>
            </div>
          )}

          {source === 'paste' && phase !== 'recording' && (
            <div className="mt-3 space-y-2">
              <Textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste a transcript. Optional format: [04:21] Raj Sharma: text" className="min-h-[96px]" />
              <Button size="sm" onClick={applyPastedTranscript} disabled={busy || !pasteText.trim()}>Save transcript</Button>
            </div>
          )}

          {!reviewing && <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Upload className="h-3 w-3" />
            Upload audio (stored only; live transcription needs the microphone or a pasted transcript)
            <input
              type="file"
              accept="audio/*,.txt"
              className="max-w-full text-xs"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.type.startsWith('text') || file.name.endsWith('.txt')) {
                  setPasteText(await file.text());
                  setSource('paste');
                  return;
                }
                if (!conversationIdRef.current) {
                  const conversation = await createConversation({
                    title: title || file.name,
                    event_id: eventId || null,
                    attendee_id: attendeeId || null,
                    company_name: companyName || null,
                    source: 'upload',
                    consent_confirmed: true,
                  });
                  conversationIdRef.current = conversation.id;
                  setSelectedId(conversation.id);
                  setConversations((current) => [conversation, ...current]);
                }
                await uploadAudioChunk(conversationIdRef.current, file);
                setStatusText('Audio stored. Paste or capture a transcript to analyze - uploaded files are not auto-transcribed without a speech provider.');
              }}
            />
          </label>}
        </div>

        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{statusText}</p>
        {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40">{error}</p>}

        {reviewing && <div className={`grid min-h-0 flex-1 items-start gap-4 ${embedded ? 'lg:grid-cols-2' : 'xl:grid-cols-2'}`}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input value={transcriptSearch} onChange={(event) => setTranscriptSearch(event.target.value)} placeholder="Search transcript…" className="h-9 min-w-0 flex-1" />
              <select value={speakerFilter} onChange={(event) => setSpeakerFilter(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-background px-2 text-sm sm:w-40 dark:border-slate-700">
                <option value="all">All speakers</option>
                {speakers.map((speaker) => <option key={speaker} value={speaker}>{speaker}</option>)}
              </select>
            </div>
            <div ref={transcriptListRef} className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {visibleDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800 ${focusSegmentMs != null && Math.abs((draft.startMs || 0) - focusSegmentMs) < 2000 ? 'ring-2 ring-indigo-400' : ''}`}
                >
                  <p className="mb-1 text-[11px] leading-4 text-slate-500">{formatClock(draft.startMs)} · {draft.speakerLabel}{draft.language ? ` · ${draft.language}` : ''}</p>
                  <textarea
                    defaultValue={draft.text}
                    rows={Math.max(2, Math.ceil((draft.text || '').length / 56))}
                    className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-slate-800 outline-none dark:text-slate-100"
                    onBlur={(event) => {
                      draft.text = event.target.value;
                      finalsRef.current = drafts.map((item) => item.id === draft.id ? { ...item, text: event.target.value } : item);
                      setDrafts(finalsRef.current);
                      if (conversationIdRef.current) {
                        if (draft.id.length > 20) void updateSegment(draft.id, event.target.value, draft.speakerLabel);
                        else void persistDrafts(conversationIdRef.current, finalsRef.current);
                      }
                    }}
                  />
                </div>
              ))}
              {partial && phase === 'recording' && (
                <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm italic text-slate-500">{partial}</p>
              )}
              {!visibleDrafts.length && !partial && <p className="text-xs text-slate-500">Live transcript will appear here.</p>}
              <div ref={transcriptEndRef} />
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" onClick={runAnalysis} disabled={busy || !drafts.length}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Analyze
              </Button>
              {selected && (
                <Button variant="outline" className="h-10" onClick={() => exportConversationMarkdown(selected, drafts.map((d) => ({ speaker_label: d.speakerLabel, start_ms: d.startMs, text: d.text })), insights)}>
                  Export
                </Button>
              )}
              {selected && (
                <Button variant="outline" className="h-10 text-rose-600" onClick={() => handleDeleteConversation(selected.id)}>
                  <Trash2 className="mr-1 h-4 w-4" />Delete
                </Button>
              )}
            </div>

            {byKind('next_action')[0] && (
              <div className="rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-950/40">
                <p className="text-xs font-semibold uppercase text-indigo-700">What should I do next?</p>
                <p className="mt-1">{byKind('next_action')[0].body}</p>
              </div>
            )}
            {byKind('followup')[0] && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-500">Follow-up to send</p>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => copyText(byKind('followup')[0].body)}><Copy className="mr-1 h-3 w-3" />Copy</Button>
                </div>
                <InsightBody text={byKind('followup')[0].body} />
              </div>
            )}
            <InsightBlock title="Executive summary" items={byKind('summary')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Action items" items={byKind('action_item')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            {insights.length > 0 && (
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"
                onClick={() => setShowFullAnalysis((open) => !open)}
              >
                Full analysis
                <ChevronDown className={`h-4 w-4 transition-transform ${showFullAnalysis ? 'rotate-180' : ''}`} />
              </button>
            )}
            {showFullAnalysis && (
              <>
            <InsightBlock title="Key discussion points" items={byKind('key_point')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Tools and platforms" items={byKind('tool')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Pain points" items={byKind('pain_point')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Requirements" items={byKind('requirement')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Stakeholders" items={byKind('stakeholder')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Constraints" items={byKind('constraint')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Decisions" items={byKind('decision')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Open questions" items={byKind('open_question')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Business impact" items={byKind('business_impact')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Potential opportunity" items={byKind('opportunity')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            <InsightBlock title="Minutes of meeting" markdownHeading="Minutes of Meeting" items={byKind('mom')} onJump={(item) => setFocusSegmentMs(item.evidence_start_ms ?? null)} onEdit={(item, body) => { void updateInsight(item.id, body); setInsights((current) => current.map((row) => row.id === item.id ? { ...row, body, evidence_kind: 'user_confirmed' } : row)); }} onDelete={(item) => { void deleteInsight(item.id); setInsights((current) => current.filter((row) => row.id !== item.id)); }} />
            {byKind('solution')[0] && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-500">AI-generated preliminary solution</p>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => copyText(byKind('solution')[0].body)}><Copy className="mr-1 h-3 w-3" />Copy</Button>
                </div>
                <InsightBody text={byKind('solution')[0].body} />
              </div>
            )}
              </>
            )}
          </section>
        </div>}
      </div>
    </div>
  );
}
