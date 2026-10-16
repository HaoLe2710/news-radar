-- Browser-managed opt-in Web Push subscriptions. No account required.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  preferences_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_checked_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS push_deliveries (
  subscription_id TEXT NOT NULL,
  issue_kind TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sending','delivered','failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(subscription_id, issue_kind, issue_key)
);
CREATE TABLE IF NOT EXISTS push_registration_limits (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(day,ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_checked ON push_subscriptions(last_checked_at);
