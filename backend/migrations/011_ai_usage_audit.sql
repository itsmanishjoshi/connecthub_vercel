ALTER TABLE api_usage_logs
  ADD COLUMN IF NOT EXISTS task TEXT,
  ADD COLUMN IF NOT EXISTS feature TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_feature_created
  ON api_usage_logs(feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_feature
  ON api_usage_logs(user_id, feature, created_at DESC);
