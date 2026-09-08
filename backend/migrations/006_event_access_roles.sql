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
