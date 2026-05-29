-- migrations/0001_init.sql
-- Run with: wrangler d1 execute ping-monitor-db --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS ping_reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname         TEXT    NOT NULL,
  window_start     TEXT    NOT NULL,
  window_end       TEXT,
  target           TEXT    NOT NULL DEFAULT 'google.com',
  status           TEXT    NOT NULL DEFAULT 'unknown',
  pings_sent       INTEGER,
  pings_received   INTEGER,
  packet_loss_pct  REAL,
  rtt_avg_ms       REAL,
  rtt_min_ms       REAL,
  rtt_max_ms       REAL,
  spikes           INTEGER NOT NULL DEFAULT 0,
  alert            INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  alert_reasons    TEXT    NOT NULL DEFAULT '[]', -- JSON array
  created_at       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hostname       ON ping_reports (hostname);
CREATE INDEX IF NOT EXISTS idx_window_start   ON ping_reports (window_start);
CREATE INDEX IF NOT EXISTS idx_hostname_time  ON ping_reports (hostname, window_start);
