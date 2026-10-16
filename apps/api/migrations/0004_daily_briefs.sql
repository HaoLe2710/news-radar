-- One immutable daily digest per Vietnam calendar date.
-- Existing articles, feeds and migrations are untouched.
CREATE TABLE IF NOT EXISTS daily_briefs (
  brief_date TEXT PRIMARY KEY,
  overview TEXT NOT NULL,
  articles_json TEXT NOT NULL,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('ai', 'headlines')),
  ai_model TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
