CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  attendee_id UUID REFERENCES attendees(id) ON DELETE SET NULL,
  company_name TEXT,
  title TEXT,
  conversation_type TEXT NOT NULL DEFAULT 'in_person',
  source TEXT NOT NULL DEFAULT 'microphone',
  status TEXT NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  primary_language TEXT,
  recording_status TEXT NOT NULL DEFAULT 'idle',
  transcription_status TEXT NOT NULL DEFAULT 'idle',
  ai_processing_status TEXT NOT NULL DEFAULT 'idle',
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  transcript_version INTEGER NOT NULL DEFAULT 0,
  next_action TEXT,
  retain_audio_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_event_id ON conversations(event_id);
CREATE INDEX IF NOT EXISTS idx_conversations_attendee_id ON conversations(attendee_id);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  speaker_label TEXT NOT NULL DEFAULT 'Speaker',
  start_ms INTEGER NOT NULL DEFAULT 0,
  end_ms INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  text TEXT NOT NULL,
  confidence NUMERIC,
  is_final BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_conversation ON transcript_segments(conversation_id, sequence);

CREATE TABLE IF NOT EXISTS conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  category TEXT,
  owner TEXT,
  due_at TEXT,
  confidence TEXT,
  evidence_kind TEXT NOT NULL DEFAULT 'ai_inference',
  evidence_start_ms INTEGER,
  evidence_end_ms INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation ON conversation_insights(conversation_id, kind);

DROP TRIGGER IF EXISTS update_conversation_insights_updated_at ON conversation_insights;
CREATE TRIGGER update_conversation_insights_updated_at
  BEFORE UPDATE ON conversation_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS conversation_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  mime_type TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
