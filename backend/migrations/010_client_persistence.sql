-- Browser-only features moved to PostgreSQL (Jelly chats, GCC notebook, pipeline, calendar, sectors)

CREATE TABLE IF NOT EXISTS jelly_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jelly_chat_sessions_user_updated
  ON jelly_chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS jelly_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES jelly_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jelly_chat_messages_session
  ON jelly_chat_messages(session_id, sort_order);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'note',
  category TEXT NOT NULL DEFAULT 'general',
  related_entity JSONB,
  participants JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  note_date TEXT,
  note_time TEXT,
  duration TEXT,
  location TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_user_updated
  ON meeting_notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS calendar_reminders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  lead_minutes INT NOT NULL DEFAULT 10,
  trigger_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_user_trigger
  ON calendar_reminders(user_id, trigger_at);

CREATE TABLE IF NOT EXISTS attendee_sectors (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendee_id TEXT NOT NULL,
  sector TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, attendee_id)
);

CREATE TABLE IF NOT EXISTS pipeline_workspace (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
