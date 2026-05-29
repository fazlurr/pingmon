# pingmon

A two-part network monitoring setup:

1. **`pingmon.sh`** — Bash script that runs on your Ubuntu VPS, pings `google.com` every 2s, and POSTs a JSON summary to your Cloudflare Worker every minute.
2. **`worker/`** — Cloudflare Worker that receives reports, stores them in **D1** (SQLite), and serves a live chart dashboard.

---

## Project Structure

```
pingmon.sh        ← runs on your VPS
.env.example           ← copy to .env, fill in REPORT_URL
worker/
  wrangler.toml        ← Worker config + D1 binding
  package.json
  migrations/
    0001_init.sql      ← D1 schema
  src/
    index.js           ← router
    handlers/
      report.js        ← POST /report
      api.js           ← GET /api/reports, /api/hostnames
      dashboard.js     ← GET / (chart UI)
```

---

## Part 1 — VPS Script

### Requirements

- Ubuntu VPS with `bash`, `ping`, `curl` (all pre-installed)

### Setup

```bash
chmod +x pingmon.sh
cp .env.example .env
nano .env          # set REPORT_URL to your Worker URL
```

**.env**

```env
REPORT_URL=https://pingmon.YOUR_SUBDOMAIN.workers.dev

# Optional overrides
TARGET=google.com
INTERVAL=60
PING_INTERVAL=2
SPIKE_THRESHOLD=50
WARN_AVG_ABOVE=10
```

### Run

```bash
./pingmon.sh
```

**Background (persistent):**

```bash
nohup ./pingmon.sh > pingmon.log 2>&1 &
tail -f pingmon.log
```

**Stop:**

```bash
pkill -f pingmon.sh
```

**As a systemd service:**

```bash
sudo nano /etc/systemd/system/pingmon.service
```

```ini
[Unit]
Description=Ping Monitor
After=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
EnvironmentFile=/home/ubuntu/.env
ExecStart=/home/ubuntu/pingmon.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pingmon
sudo journalctl -u pingmon -f
```

---

## Part 2 — Cloudflare Worker

### Requirements

- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- A Cloudflare account (free tier works)

### 1. Install dependencies

```bash
cd worker
pnpm install
```

### 2. Authenticate Wrangler

```bash
wrangler login
```

### 3. Create the D1 database

```bash
pnpm run db:create
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "pingmon-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← paste here
```

### 4. Run the migration

```bash
# Local dev
pnpm run db:migrate

# Production (remote D1)
pnpm run db:migrate:remote
```

### 5. Deploy

```bash
pnpm run deploy
```

Your Worker URL will be printed: `https://pingmon.YOUR_SUBDOMAIN.workers.dev`

Set this as `REPORT_URL` in your VPS `.env`.

### 6. Local development

```bash
pnpm run dev
# Worker runs at http://localhost:8787
```

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Live chart dashboard |
| `POST` | `/report` | Ingest a ping report (used by the shell script) |
| `GET` | `/api/reports` | JSON: recent reports |
| `GET` | `/api/hostnames` | JSON: known hostnames |

### `GET /api/reports` query params

| Param | Default | Description |
|-------|---------|-------------|
| `hostname` | *(all)* | Filter by VPS hostname |
| `hours` | `24` | How far back to look |
| `limit` | `120` | Max rows (cap: 500) |

---

## Dashboard

Open `https://your-worker.workers.dev` in a browser.

- **RTT chart** — avg / min / max latency over time
- **Packet loss chart** — % loss per window (green = 0%, red = any loss)
- **Spikes chart** — spike count per window
- **Summary cards** — overall avg, min, max, loss, spikes, alert count
- **Recent reports table** — last 50 windows with status badges and alert reasons
- **Host selector** — filter by VPS hostname (useful for multiple servers)
- **Time window** — 1h / 6h / 24h / 3d
- **Auto-refresh** every 90 seconds

---

## JSON Payload (POST /report)

```json
{
  "hostname": "vps-sg-01",
  "window_start": "2026-05-29T14:00:00",
  "window_end": "2026-05-29T14:01:00",
  "target": "google.com",
  "status": "unstable",
  "pings_sent": 30,
  "pings_received": 28,
  "packet_loss_pct": 6.7,
  "rtt_avg_ms": 14.530,
  "rtt_min_ms": 3.210,
  "rtt_max_ms": 87.100,
  "spikes": 2,
  "alert": true,
  "alert_reasons": [
    "spike_detected_2_times_above_50ms",
    "avg_14.530ms_exceeds_10ms_baseline",
    "packet_loss_6.7pct"
  ]
}
```

---

## Alert Conditions

| Condition | Trigger |
|-----------|---------|
| Spike | Any single RTT > `SPIKE_THRESHOLD` (default 50ms) |
| High average | Window avg > `WARN_AVG_ABOVE` (default 10ms) |
| Packet loss | Any pings dropped in the window |
| Unreachable | Zero pings returned (100% loss) |

---

## D1 Schema

```sql
CREATE TABLE ping_reports (
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
  alert            INTEGER NOT NULL DEFAULT 0,
  alert_reasons    TEXT    NOT NULL DEFAULT '[]',
  created_at       TEXT    NOT NULL
);
```
