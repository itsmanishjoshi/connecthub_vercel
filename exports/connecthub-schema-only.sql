-- ConnectHub schema for Supabase SQL editor
-- Run once on an empty database, then run the data section (or full dump).

-- ConnectHub local PostgreSQL schema (office / on-prem)
-- No Supabase auth.users or RLS. App-level auth uses the users table.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============= USERS =============
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE NOT NULL,
    is_first_login BOOLEAN DEFAULT TRUE NOT NULL,
    status TEXT DEFAULT 'active',
    password_changed BOOLEAN DEFAULT FALSE,
    password_changed_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============= USER PROFILES =============
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    mobile_no TEXT,
    email TEXT,
    company TEXT,
    designation TEXT,
    location TEXT,
    linkedin_url TEXT,
    avatar_url TEXT,
    qr_code_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    profile_completed BOOLEAN DEFAULT FALSE NOT NULL,
    onboarding_completed_at TIMESTAMPTZ,
    onboarding_step INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============= EVENTS =============
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    date TEXT,
    place TEXT,
    event_picture_url TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    creator_name TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    access_pin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS event_access_grants (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_access_grants_event_id ON event_access_grants(event_id);

-- ============= ATTENDEES =============
CREATE TABLE IF NOT EXISTS attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT,
    company TEXT,
    industry TEXT,
    location TEXT,
    city TEXT,
    profile_pic_url TEXT,
    profile_pic BYTEA,
    profile_pic_mime TEXT,
    linkedin_url TEXT,
    key_insights TEXT,
    event_association TEXT,
    speaker BOOLEAN DEFAULT FALSE,
    competitor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendees_event_id ON attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_name ON attendees(name);

DROP TRIGGER IF EXISTS update_attendees_updated_at ON attendees;
CREATE TRIGGER update_attendees_updated_at
  BEFORE UPDATE ON attendees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Alias used by some export queries
CREATE OR REPLACE VIEW contacts AS SELECT * FROM attendees;

-- ============= ATTENDEE NOTES =============
CREATE TABLE IF NOT EXISTS attendee_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    note TEXT,
    text TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendee_notes_attendee_id ON attendee_notes(attendee_id);
CREATE INDEX IF NOT EXISTS idx_attendee_notes_user_id ON attendee_notes(user_id);

DROP TRIGGER IF EXISTS update_attendee_notes_updated_at ON attendee_notes;
CREATE TRIGGER update_attendee_notes_updated_at
  BEFORE UPDATE ON attendee_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============= STATUSES / STAGES / INSIGHTS =============
CREATE TABLE IF NOT EXISTS attendee_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    status_color TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, attendee_id, status_color)
);

CREATE TABLE IF NOT EXISTS attendee_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, attendee_id)
);

CREATE OR REPLACE VIEW attendee_stage AS SELECT * FROM attendee_stages;

CREATE TABLE IF NOT EXISTS attendee_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    insights TEXT NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(attendee_id)
);

DROP TRIGGER IF EXISTS update_attendee_insights_updated_at ON attendee_insights;
CREATE TRIGGER update_attendee_insights_updated_at
  BEFORE UPDATE ON attendee_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============= QR CODES =============
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    qr_data TEXT,
    format TEXT DEFAULT 'vcard',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_generated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('note', 'image')),
    title TEXT,
    content TEXT,
    data TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user
  ON gallery_items(user_id, created_at DESC);

-- ============= NOTES / NOTEBOOK =============
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'private',
    attendee_name TEXT,
    event_name TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

CREATE TABLE IF NOT EXISTS user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1 AND page_number <= 10),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON user_notes(user_id);

DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============= PREFERENCES =============
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'system',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_email BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_push BOOLEAN NOT NULL DEFAULT FALSE,
    notifications_sound BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_mentions BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_updates BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    display_density TEXT NOT NULL DEFAULT 'comfortable',
    display_font_size TEXT NOT NULL DEFAULT 'medium',
    display_animations BOOLEAN NOT NULL DEFAULT TRUE,
    display_reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_profile_visibility TEXT NOT NULL DEFAULT 'public',
    privacy_show_email BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_show_company BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============= USER FOLLOW-UPS =============
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_user_due
  ON follow_ups(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_attendee
  ON follow_ups(attendee_id);

DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON follow_ups;
CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON follow_ups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Demo users and events are inserted by: npm run db:seed
-- (passwords are bcrypt-hashed in that script, not stored in this file)

SELECT 'ConnectHub local schema ready' AS status;


-- ---- migrations ----

-- 001_multi_user_foundation.sql

-- Normalize ownership columns left as TEXT by early recovery schemas.
-- Invalid non-UUID legacy values intentionally fail instead of being discarded.

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('events', 'created_by'),
      ('attendee_notes', 'user_id'),
      ('attendee_notes', 'attendee_id'),
      ('attendee_notes', 'created_by'),
      ('attendee_statuses', 'user_id'),
      ('attendee_statuses', 'attendee_id'),
      ('attendee_stages', 'user_id'),
      ('attendee_stages', 'attendee_id'),
      ('attendee_insights', 'user_id'),
      ('attendee_insights', 'attendee_id'),
      ('attendee_insights', 'updated_by'),
      ('attendee_insights', 'created_by'),
      ('qr_codes', 'user_id'),
      ('notes', 'user_id'),
      ('user_notes', 'user_id'),
      ('user_preferences', 'user_id')
    ) AS columns_to_convert(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = item.table_name
        AND column_name = item.column_name
        AND data_type <> 'uuid'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE UUID USING NULLIF(%I::text, '''')::uuid',
        item.table_name, item.column_name, item.column_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('users', 'created_by', 'users', 'id', 'fk_users_created_by', 'SET NULL'),
      ('events', 'created_by', 'users', 'id', 'fk_events_created_by', 'SET NULL'),
      ('attendee_notes', 'user_id', 'users', 'id', 'fk_attendee_notes_user', 'CASCADE'),
      ('attendee_notes', 'attendee_id', 'attendees', 'id', 'fk_attendee_notes_attendee', 'CASCADE'),
      ('attendee_statuses', 'user_id', 'users', 'id', 'fk_attendee_statuses_user', 'CASCADE'),
      ('attendee_statuses', 'attendee_id', 'attendees', 'id', 'fk_attendee_statuses_attendee', 'CASCADE'),
      ('attendee_stages', 'user_id', 'users', 'id', 'fk_attendee_stages_user', 'CASCADE'),
      ('attendee_stages', 'attendee_id', 'attendees', 'id', 'fk_attendee_stages_attendee', 'CASCADE'),
      ('notes', 'user_id', 'users', 'id', 'fk_notes_user', 'CASCADE'),
      ('user_notes', 'user_id', 'users', 'id', 'fk_user_notes_user', 'CASCADE'),
      ('user_preferences', 'user_id', 'users', 'id', 'fk_user_preferences_user', 'CASCADE'),
      ('qr_codes', 'user_id', 'user_profiles', 'id', 'fk_qr_codes_profile', 'CASCADE')
    ) AS constraints_to_add(
      table_name, column_name, ref_table, ref_column, constraint_name, delete_action
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_row
      JOIN pg_attribute column_row
        ON column_row.attrelid = constraint_row.conrelid
       AND column_row.attnum = ANY(constraint_row.conkey)
      WHERE constraint_row.contype = 'f'
        AND constraint_row.conrelid = to_regclass(item.table_name)
        AND column_row.attname = item.column_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE %s',
        item.table_name, item.constraint_name, item.column_name,
        item.ref_table, item.ref_column, item.delete_action
      );
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  details TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS event_access_grants (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('note', 'image')),
  title TEXT,
  content TEXT,
  data TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_user
  ON gallery_items(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_ups_user_due
  ON follow_ups(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_attendee
  ON follow_ups(attendee_id);



-- 002_record_versions.sql

ALTER TABLE attendee_notes
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

ALTER TABLE user_notes
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;



-- 003_conversation_intelligence.sql

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



-- 004_attendee_flexible_fields.sql

ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ice_breakers TEXT,
  ADD COLUMN IF NOT EXISTS extra_data JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_attendees_extra_data ON attendees USING GIN (extra_data);



-- 005_access_query_indexes.sql

-- Access-check helpers used by getAccessibleEventIds / attendee scoping.
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_access_grants_event_id ON event_access_grants(event_id);
CREATE INDEX IF NOT EXISTS idx_attendee_notes_user_attendee ON attendee_notes(user_id, attendee_id);



-- 006_event_access_roles.sql

-- Event membership roles: view (see directory/speakers) vs edit (change event and people).
-- Personal notes, conversations, and recordings stay owner-scoped in existing private tables.

ALTER TABLE event_access_grants
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'view',
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_access_grants_role_check'
  ) THEN
    ALTER TABLE event_access_grants
      ADD CONSTRAINT event_access_grants_role_check
      CHECK (role IN ('view', 'edit'));
  END IF;
END $$;

INSERT INTO event_access_grants (user_id, event_id, role, granted_by)
SELECT created_by, id, 'edit', created_by
  FROM events
 WHERE created_by IS NOT NULL
ON CONFLICT (user_id, event_id) DO UPDATE
   SET role = 'edit';



-- 007_attendee_profile_pic.sql

-- Store attendee photos in Postgres. Excel is import-only; bytes live on the person row.
ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS profile_pic BYTEA,
  ADD COLUMN IF NOT EXISTS profile_pic_mime TEXT;



-- 008_asset_library.sql

-- GCC Assets library: folders, files (metadata + bytes), sharing.
CREATE TABLE IF NOT EXISTS asset_libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'assets',
  description TEXT,
  restricted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_folders_library ON asset_folders(library_id, parent_id);

CREATE TABLE IF NOT EXISTS asset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT,
  kind TEXT NOT NULL DEFAULT 'other',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'db',
  content BYTEA,
  disk_path TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_items_folder ON asset_items(library_id, folder_id);

CREATE TABLE IF NOT EXISTS asset_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES asset_libraries(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES asset_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_access_uniq
  ON asset_access (library_id, user_id, (COALESCE(folder_id, '00000000-0000-0000-0000-000000000000')));

CREATE INDEX IF NOT EXISTS idx_asset_access_user ON asset_access(user_id, library_id);



-- 009_analytics_activity.sql

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  label TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_created
  ON activity_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_kind_created
  ON activity_events(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  route TEXT NOT NULL,
  provider TEXT,
  tokens_in INT,
  tokens_out INT,
  status INT NOT NULL DEFAULT 200,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created
  ON api_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created
  ON api_usage_logs(user_id, created_at DESC);



-- 010_client_persistence.sql

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



-- 011_ai_usage_audit.sql

ALTER TABLE api_usage_logs
  ADD COLUMN IF NOT EXISTS task TEXT,
  ADD COLUMN IF NOT EXISTS feature TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_feature_created
  ON api_usage_logs(feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_feature
  ON api_usage_logs(user_id, feature, created_at DESC);




CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
