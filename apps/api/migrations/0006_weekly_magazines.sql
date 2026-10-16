-- Immutable Monday-issued weekly magazine snapshots.
CREATE TABLE IF NOT EXISTS weekly_magazines (
  week_start TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
