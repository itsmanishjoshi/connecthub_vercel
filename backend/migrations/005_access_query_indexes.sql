-- Access-check helpers used by getAccessibleEventIds / attendee scoping.
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_access_grants_event_id ON event_access_grants(event_id);
CREATE INDEX IF NOT EXISTS idx_attendee_notes_user_attendee ON attendee_notes(user_id, attendee_id);
