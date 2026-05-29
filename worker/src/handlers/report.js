// src/handlers/report.js
import { jsonResponse } from '../index';

export async function handleReport(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const {
    hostname,
    window_start,
    window_end,
    target,
    status,
    pings_sent,
    pings_received,
    packet_loss_pct,
    rtt_avg_ms,
    rtt_min_ms,
    rtt_max_ms,
    spikes,
    alert,
    alert_reasons,
  } = body;

  if (!hostname || !window_start) {
    return jsonResponse({ error: 'Missing required fields: hostname, window_start' }, 422);
  }

  await env.DB.prepare(`
    INSERT INTO ping_reports (
      hostname, window_start, window_end, target, status,
      pings_sent, pings_received, packet_loss_pct,
      rtt_avg_ms, rtt_min_ms, rtt_max_ms,
      spikes, alert, alert_reasons, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    hostname,
    window_start,
    window_end ?? null,
    target ?? 'google.com',
    status ?? 'unknown',
    pings_sent ?? null,
    pings_received ?? null,
    packet_loss_pct ?? null,
    rtt_avg_ms ?? null,
    rtt_min_ms ?? null,
    rtt_max_ms ?? null,
    spikes ?? 0,
    alert ? 1 : 0,
    Array.isArray(alert_reasons) ? JSON.stringify(alert_reasons) : '[]',
  ).run();

  return jsonResponse({ ok: true, message: 'Report saved' }, 201);
}
