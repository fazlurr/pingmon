// =============================================================================
// ping-monitor worker — src/index.js
// Routes:
//   POST /report          — ingest ping report from VPS
//   GET  /                — dashboard (chart UI)
//   GET  /api/reports     — JSON: recent reports (query: hostname, limit, hours)
//   GET  /api/hostnames   — JSON: distinct hostnames in DB
// =============================================================================

import { handleReport } from './handlers/report';
import { handleDashboard } from './handlers/dashboard';
import { handleApiReports, handleApiHostnames } from './handlers/api';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse('', 204);
    }

    try {
      if (method === 'POST' && url.pathname === '/report') {
        return await handleReport(request, env);
      }

      if (method === 'GET') {
        if (url.pathname === '/api/reports') return await handleApiReports(request, env);
        if (url.pathname === '/api/hostnames') return await handleApiHostnames(request, env);
        if (url.pathname === '/' || url.pathname === '/dashboard') {
          return handleDashboard();
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return jsonResponse({ error: 'Internal server error', detail: err.message }, 500);
    }
  },
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function corsResponse(body, status = 200, contentType = 'text/plain') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
