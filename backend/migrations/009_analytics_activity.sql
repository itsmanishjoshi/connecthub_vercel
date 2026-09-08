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
