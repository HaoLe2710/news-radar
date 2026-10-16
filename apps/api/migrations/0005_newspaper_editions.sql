-- Immutable daily newspaper payload; snapshots survive changes in RSS records.
CREATE TABLE IF NOT EXISTS newspaper_editions (
 issue_date TEXT PRIMARY KEY,
 payload_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
