-- Per-IP anonymized, hourly token budget for the public Ask News Radar endpoint.
-- Only keyed SHA-256 hashes are retained; never store raw IP addresses or chat contents.
CREATE TABLE IF NOT EXISTS ask_rate_limits (
  bucket TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, client_hash)
);
