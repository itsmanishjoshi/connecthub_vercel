# ConnectHub Conversation Intelligence — Implementation Plan

Written from the current repository, not from a greenfield spec.

## A. Existing relevant functionality

- **Frontend:** Vite + React SPA. Jelly already exists in [`ConnectHub/src/components/JellyChatbot.tsx`](ConnectHub/src/components/JellyChatbot.tsx) but is **not mounted**. [`App.tsx`](ConnectHub/src/App.tsx) shows a “Coming Soon” FAB instead.
- **Chat AI:** [`smartAIService.ts`](ConnectHub/src/services/smartAIService.ts) + [`aiService.ts`](ConnectHub/src/services/aiService.ts) call Express `POST /api/ai/chat` (Groq). Web search uses `POST /api/ai/search` (Tavily).
- **Python Cherry orchestrator** (`ConnectHub/backend`) is unwired. Do not depend on it.
- **Data:** PostgreSQL via `POST /api/db`. Events, attendees, per-user notes, `follow_ups` table (no UI), global `attendee_insights` text blob.
- **No companies table.** Company is a string on attendees.
- **No conversations, transcripts, audio, pain points, MoM, or speech APIs.**
- **Storage:** local `server/uploads` image buckets only.
- **Auth:** Bearer sessions; private tables scoped to `user_id`.
- **Offline:** IndexedDB event cache + mutation outbox for notes/settings. Not for audio.

## B. What needs to be added

1. Restore and harden Jelly (mount + bug fixes).
2. Conversation Intelligence panel **inside Jelly** (third mode: Capture).
3. Schema: `conversations`, `transcript_segments`, `conversation_insights`, `conversation_audio`.
4. Browser microphone capture (MediaRecorder chunks) + Web Speech API live transcript.
5. Speech/LLM provider abstractions (browser STT + Groq now; Whisper/local later).
6. Persist finalized segments; run a chunked AI pipeline for summary, key points, pain points, requirements, decisions, actions, questions, opportunity, MoM, next step.
7. Review/edit/export/delete in the same panel.
8. Link conversations to event + attendee when the user selects them.
9. Auth-gated audio storage (`conversation-audio`).
10. Offline local buffering of segments; sync when online.

## C. What needs to be modified

- `App.tsx` — open Jelly instead of Coming Soon.
- `JellyChatbot.tsx` — fix `cycleAvatar` / `setPendingAction`; add Capture tab.
- `smartAIService.ts` — replace `require()` with ESM imports.
- `server/index.js` — whitelist tables, audio bucket, analyze endpoint.
- `init-schema` / migrations — new tables.
- Docs for audio backup vs DB backup.

## D. Database changes

Migration `003_conversation_intelligence.sql`:

- `conversations` (user-owned; optional `event_id`, `attendee_id`, `company_name`, statuses, consent, source)
- `transcript_segments` (timestamped, language, speaker_label, is_final)
- `conversation_insights` (kind + evidence timestamps + fact/inference)
- `conversation_audio` (path metadata only; files on disk)

## E. Backend changes

- Scope all four tables to the authenticated user.
- `POST /api/conversations/:id/analyze` — load transcript, run Groq pipeline, store insights.
- Audio uploads to `conversation-audio` (webm/ogg/mp4/wav), not public listing.
- Provider-independent analyze function.

## F. Frontend changes

- `JellyChatbot` Capture mode hosts `ConversationIntelligencePanel`.
- Browser speech provider + conversation service.
- Consent gate, live transcript, pause/stop, intelligence review, transcript search/edit, follow-up copy, preliminary solution copy.
- Context: pick event/attendee from live ConnectHub data.

## G. AI changes

Do not send one “summarize this meeting” prompt as the only step. Pipeline:

1. Understanding / executive summary  
2. Key points  
3. Pain points / requirements / decisions / actions / questions / impact / opportunity  
4. MoM + next action  

Each insight stores `evidence_kind` and timestamp range. Cache by transcript version. If Groq is unconfigured, show a configuration state — never fake AI.

## H. Audio / transcription architecture

```
Mic → echo/noise constraints → MediaRecorder chunks + Web Speech
        ↓
  local draft (IndexedDB/localStorage)
        ↓
  finalized segments → PostgreSQL
  audio files → server/uploads/conversation-audio
```

Web Speech API is the first `SpeechToTextProvider` (Chrome/Edge, multilingual best-effort). Abstraction allows Whisper later. Online meeting adapters are interfaces only (Teams/Zoom/Meet not faked).

## I. Offline considerations

- Keep live segments in memory + local draft.
- Queue unsynced segments.
- Existing transcript survives network loss.
- Analyze waits until online + Groq available.

## J. Security / privacy

- Explicit consent before mic.
- Conversations private to creator.
- Audio not anonymously listable.
- Delete conversation deletes segments, insights, and files.
- Retention fields reserved (`retain_audio_until`).

## K. Future online meeting integrations

`MeetingProvider` interface only. MVP sources: microphone, uploaded audio, uploaded/pasted transcript.

## L. On-premise architecture

Same Express + PostgreSQL + local disk. Speech/LLM behind providers so a later office can swap Groq for a private Whisper/LLM. Audio stays on the office host.

## Backup / recovery

- PostgreSQL backups cover conversations, transcript segments, and insights.
- Audio files live under `ConnectHub/server/uploads/conversation-audio` and need a separate file-level backup (copy that folder, or later MinIO/S3 versioning).
- Restoring the database without the uploads folder keeps searchable transcripts but loses playable audio.

## Implementation order

1. Plan (this file)  
2. Fix Jelly chatbot  
3. Schema + API  
4. Capture + live transcript  
5. Persist + analyze  
6. Intelligence UI in Jelly  
7. Tests / existing suite  

Out of first implementation (interfaces only): Teams/Zoom/Meet, local Whisper, semantic vector search, PDF/DOCX export libraries, CRDT speaker ID.
