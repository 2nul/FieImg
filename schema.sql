CREATE TABLE IF NOT EXISTS assets (
  token TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
