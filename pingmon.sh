#!/bin/bash
# =============================================================================
# pingmon.sh — Ping Google, summarize every minute, POST to Report URL
# =============================================================================
# Usage:
#   chmod +x pingmon.sh
#   cp .env.example .env && nano .env
#   ./pingmon.sh
# =============================================================================

# ── Load .env if present ──────────────────────────────────────────────────────
if [[ -f "$(dirname "$0")/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$(dirname "$0")/.env"
  set +a
fi

# ── Configuration (overridable via .env or environment) ──────────────────────
TARGET="${TARGET:-google.com}"
INTERVAL="${INTERVAL:-60}"            # Summary window in seconds
PING_INTERVAL="${PING_INTERVAL:-2}"   # Seconds between pings (ping -i)
SPIKE_THRESHOLD="${SPIKE_THRESHOLD:-50}"   # ms — spike threshold
WARN_AVG_ABOVE="${WARN_AVG_ABOVE:-10}"     # ms — alert if avg exceeds this
REPORT_URL="${REPORT_URL:-}"               # Required: Cloudflare Worker URL

# ── Validate REPORT_URL ───────────────────────────────────────────────────────
if [[ -z "$REPORT_URL" ]]; then
  echo "[ERROR] REPORT_URL is not set."
  echo "  Set it in .env or: REPORT_URL=\"https://your-worker.workers.dev\" ./pingmon.sh"
  exit 1
fi

HOSTNAME_VAL=$(hostname -f 2>/dev/null || hostname)
PING_COUNT=$(( INTERVAL / PING_INTERVAL ))

echo "============================================="
echo " Ping Monitor Starting"
echo "  Host    : $HOSTNAME_VAL"
echo "  Target  : $TARGET"
echo "  Window  : ${INTERVAL}s (${PING_COUNT} pings @ ${PING_INTERVAL}s each)"
echo "  Spike   : > ${SPIKE_THRESHOLD} ms"
echo "  Avg warn: > ${WARN_AVG_ABOVE} ms"
echo "  Report  : $REPORT_URL"
echo "============================================="
echo ""

# ── Helpers ───────────────────────────────────────────────────────────────────
send_report() {
  local payload="$1"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${REPORT_URL}/report" \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
    --max-time 10)
  echo "[report] HTTP $http_code → ${REPORT_URL}/report"
}

# ── Main loop ─────────────────────────────────────────────────────────────────
while true; do
  WINDOW_START=$(date '+%Y-%m-%dT%H:%M:%S')

  RAW=$(ping -i "$PING_INTERVAL" -c "$PING_COUNT" -W 5 "$TARGET" 2>&1)

  WINDOW_END=$(date '+%Y-%m-%dT%H:%M:%S')

  mapfile -t RTTS < <(echo "$RAW" | grep -oP 'time=\K[0-9]+\.?[0-9]*')

  TOTAL=${#RTTS[@]}

  if [[ $TOTAL -eq 0 ]]; then
    echo "[$WINDOW_START] No RTTs captured — host unreachable?"
    SUMMARY_JSON=$(printf '{"hostname":"%s","window_start":"%s","window_end":"%s","target":"%s","status":"unreachable","pings_sent":%s,"pings_received":0,"packet_loss_pct":100,"rtt_avg_ms":null,"rtt_min_ms":null,"rtt_max_ms":null,"spikes":0,"alert":true,"alert_reasons":["host_unreachable"]}' \
      "$HOSTNAME_VAL" "$WINDOW_START" "$WINDOW_END" "$TARGET" "$PING_COUNT")
    send_report "$SUMMARY_JSON"
    continue
  fi

  # ── Compute stats ─────────────────────────────────────────────────────────
  STATS=$(printf '%s\n' "${RTTS[@]}" | awk -v spike="$SPIKE_THRESHOLD" '
  BEGIN { min=999999; max=0; sum=0; spikes=0 }
  {
    v = $1+0
    sum += v
    if (v < min) min = v
    if (v > max) max = v
    if (v > spike) spikes++
  }
  END {
    avg = (NR > 0) ? sum/NR : 0
    printf "%.3f %.3f %.3f %d %d", avg, min, max, spikes, NR
  }')

  read -r AVG MIN MAX SPIKES RECEIVED <<< "$STATS"

  LOST=$(( PING_COUNT - RECEIVED ))
  LOSS_PCT=$(awk "BEGIN { printf \"%.1f\", ($LOST/$PING_COUNT)*100 }")

  # ── Alert logic ───────────────────────────────────────────────────────────
  ALERT=false
  REASONS=()

  if (( SPIKES > 0 )); then
    REASONS+=("spike_detected_${SPIKES}_times_above_${SPIKE_THRESHOLD}ms")
    ALERT=true
  fi

  AVG_HIGH=$(awk "BEGIN { print ($AVG > $WARN_AVG_ABOVE) ? 1 : 0 }")
  if [[ "$AVG_HIGH" == "1" ]]; then
    REASONS+=("avg_${AVG}ms_exceeds_${WARN_AVG_ABOVE}ms_baseline")
    ALERT=true
  fi

  if (( LOST > 0 )); then
    REASONS+=("packet_loss_${LOSS_PCT}pct")
    ALERT=true
  fi

  if [[ ${#REASONS[@]} -gt 0 ]]; then
    REASONS_JSON=$(printf '"%s",' "${REASONS[@]}")
    REASONS_JSON="[${REASONS_JSON%,}]"
  else
    REASONS_JSON="[]"
  fi

  STATUS="stable"
  [[ "$ALERT" == "true" ]] && STATUS="unstable"

  # ── Build payload ─────────────────────────────────────────────────────────
  SUMMARY_JSON=$(printf '{
  "hostname": "%s",
  "window_start": "%s",
  "window_end": "%s",
  "target": "%s",
  "status": "%s",
  "pings_sent": %s,
  "pings_received": %s,
  "packet_loss_pct": %s,
  "rtt_avg_ms": %s,
  "rtt_min_ms": %s,
  "rtt_max_ms": %s,
  "spikes": %s,
  "alert": %s,
  "alert_reasons": %s
}' \
    "$HOSTNAME_VAL" "$WINDOW_START" "$WINDOW_END" "$TARGET" "$STATUS" \
    "$PING_COUNT" "$RECEIVED" "$LOSS_PCT" \
    "$AVG" "$MIN" "$MAX" \
    "$SPIKES" "$ALERT" "$REASONS_JSON")

  # ── Console summary ───────────────────────────────────────────────────────
  echo "─────────────────────────────────────────────"
  echo " [$WINDOW_START → $WINDOW_END]"
  echo " Status  : $STATUS"
  echo " RTT     : avg=${AVG}ms  min=${MIN}ms  max=${MAX}ms"
  echo " Spikes  : $SPIKES (>${SPIKE_THRESHOLD}ms)   Loss: ${LOSS_PCT}%"
  [[ "$ALERT" == "true" ]] && echo " ⚠  ALERT : ${REASONS[*]}"
  echo ""

  send_report "$SUMMARY_JSON"
  echo ""

done
