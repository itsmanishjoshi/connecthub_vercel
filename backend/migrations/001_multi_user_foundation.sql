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
