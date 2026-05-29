// src/handlers/api.js
import { jsonResponse } from '../index';

export async function handleApiReports(request, env) {
  const url = new URL(request.url);
  const hostname = url.searchParams.get('hostname') || null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '120', 10), 500);
  const hours = parseInt(url.searchParams.get('hours') || '24', 10);

  let query, params;

  if (hostname) {
    query = `
      SELECT * FROM ping_reports
      WHERE hostname = ?
        AND window_start >= datetime('now', ? || ' hours')
      ORDER BY window_start ASC
      LIMIT ?
    `;
    params = [hostname, `-${hours}`, limit];
  } else {
    query = `
      SELECT * FROM ping_reports
      WHERE window_start >= datetime('now', ? || ' hours')
      ORDER BY window_start ASC
      LIMIT ?
    `;
    params = [`-${hours}`, limit];
  }

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Parse alert_reasons JSON strings back to arrays
  const rows = results.map(r => ({
    ...r,
    alert: r.alert === 1,
    alert_reasons: (() => {
      try { return JSON.parse(r.alert_reasons); } catch { return []; }
    })(),
  }));

  return jsonResponse({ ok: true, count: rows.length, rows });
}

export async function handleApiHostnames(request, env) {
  const { results } = await env.DB.prepare(`
    SELECT DISTINCT hostname, MAX(window_start) as last_seen
    FROM ping_reports
    GROUP BY hostname
    ORDER BY last_seen DESC
  `).all();

  return jsonResponse({ ok: true, hostnames: results });
}
