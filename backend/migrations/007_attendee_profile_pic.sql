-- Store attendee photos in Postgres. Excel is import-only; bytes live on the person row.
ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS profile_pic BYTEA,
  ADD COLUMN IF NOT EXISTS profile_pic_mime TEXT;
