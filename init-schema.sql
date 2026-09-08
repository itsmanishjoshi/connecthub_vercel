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
