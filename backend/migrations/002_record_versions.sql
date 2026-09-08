ALTER TABLE attendee_notes
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

ALTER TABLE user_notes
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS client_updated_at TIMESTAMPTZ;
