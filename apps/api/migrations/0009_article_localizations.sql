-- Preserve original RSS content; cache only bounded, source-backed Vietnamese translations.
CREATE TABLE IF NOT EXISTS article_localizations (
  article_id INTEGER PRIMARY KEY,
  title_vi TEXT,
  summary_vi TEXT,
  status TEXT NOT NULL CHECK(status IN ('translated', 'failed')),
  updated_at TEXT NOT NULL,
  FOREIGN KEY(article_id) REFERENCES articles(id)
);
CREATE INDEX IF NOT EXISTS idx_article_localizations_retry
  ON article_localizations(status, updated_at);
