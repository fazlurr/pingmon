// src/handlers/dashboard.js

export function handleDashboard() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Ping Monitor Dashboard</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --border: #2a2d3e;
    --text: #e2e8f0;
    --muted: #64748b;
    --green: #22c55e;
    --yellow: #eab308;
    --red: #ef4444;
    --blue: #3b82f6;
    --purple: #a855f7;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; min-height: 100vh; }
  header { padding: 1.25rem 2rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 1rem; }
  header h1 { font-size: 1.1rem; font-weight: 600; }
  header span { font-size: 0.8rem; color: var(--muted); }
  #pulse { width: 10px; height: 10px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }
  .controls { padding: 1rem 2rem; display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; border-bottom: 1px solid var(--border); }
  select, button {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    padding: .4rem .75rem; border-radius: 6px; font-size: .85rem; cursor: pointer;
  }
  select:focus, button:hover { border-color: var(--blue); outline: none; }
  button.active { border-color: var(--blue); background: #1d3557; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1.25rem 2rem; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
  .stat .label { font-size: .75rem; color: var(--muted); margin-bottom: .25rem; text-transform: uppercase; letter-spacing: .05em; }
  .stat .value { font-size: 1.6rem; font-weight: 700; }
  .stat .sub { font-size: .75rem; color: var(--muted); margin-top: .2rem; }
  .green { color: var(--green); } .yellow { color: var(--yellow); } .red { color: var(--red); } .blue { color: var(--blue); }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 0 2rem 1.5rem; }
  @media (max-width: 800px) { .charts { grid-template-columns: 1fr; } }
  .chart-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; }
  .chart-box h2 { font-size: .85rem; color: var(--muted); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: .05em; }
  .chart-box.wide { grid-column: 1 / -1; }
  canvas { max-height: 220px; }
  .table-wrap { padding: 0 2rem 2rem; }
  table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  th { text-align: left; padding: .5rem .75rem; color: var(--muted); border-bottom: 1px solid var(--border); font-weight: 500; }
  td { padding: .45rem .75rem; border-bottom: 1px solid #1e2130; }
  tr:hover td { background: #1e2130; }
  .badge { display: inline-block; padding: .15rem .5rem; border-radius: 4px; font-size: .75rem; font-weight: 600; }
  .badge-stable { background: #14532d; color: var(--green); }
  .badge-unstable { background: #450a0a; color: var(--red); }
  .badge-unreachable { background: #431407; color: #fb923c; }
  #loading { text-align: center; padding: 3rem; color: var(--muted); }
  #error-msg { display: none; color: var(--red); padding: .5rem 2rem; font-size: .85rem; }
</style>
</head>
<body>

<header>
  <div id="pulse"></div>
  <h1>Ping Monitor</h1>
  <span id="last-updated">—</span>
</header>

<div class="controls">
  <label style="font-size:.85rem;color:var(--muted)">Host:</label>
  <select id="host-select"><option value="">All hosts</option></select>

  <label style="font-size:.85rem;color:var(--muted)">Window:</label>
  <button class="active" data-hours="1">1h</button>
  <button data-hours="6">6h</button>
  <button data-hours="24">24h</button>
  <button data-hours="72">3d</button>

  <button id="refresh-btn" style="margin-left:auto">⟳ Refresh</button>
</div>

<div id="error-msg"></div>
<div id="loading">Loading data…</div>

<div id="dashboard" style="display:none">
  <div class="stats">
    <div class="stat"><div class="label">Avg RTT</div><div class="value blue" id="s-avg">—</div><div class="sub">milliseconds</div></div>
    <div class="stat"><div class="label">Min RTT</div><div class="value green" id="s-min">—</div><div class="sub">milliseconds</div></div>
    <div class="stat"><div class="label">Max RTT</div><div class="value yellow" id="s-max">—</div><div class="sub">milliseconds</div></div>
    <div class="stat"><div class="label">Packet Loss</div><div class="value" id="s-loss">—</div><div class="sub">average %</div></div>
    <div class="stat"><div class="label">Total Spikes</div><div class="value red" id="s-spikes">—</div><div class="sub">this window</div></div>
    <div class="stat"><div class="label">Alert Windows</div><div class="value red" id="s-alerts">—</div><div class="sub">of <span id="s-total">—</span> total</div></div>
  </div>

  <div class="charts">
    <div class="chart-box wide"><h2>RTT over time (avg / min / max)</h2><canvas id="chart-rtt"></canvas></div>
    <div class="chart-box"><h2>Packet Loss %</h2><canvas id="chart-loss"></canvas></div>
    <div class="chart-box"><h2>Spikes per window</h2><canvas id="chart-spikes"></canvas></div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Time</th><th>Host</th><th>Status</th>
          <th>Avg ms</th><th>Min ms</th><th>Max ms</th>
          <th>Loss %</th><th>Spikes</th><th>Reasons</th>
        </tr>
      </thead>
      <tbody id="report-table"></tbody>
    </table>
  </div>
</div>

<script>
const BASE = '';   // same origin
let charts = {};
let currentHours = 1;
let currentHost = '';

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  await loadHostnames();
  await loadData();

  document.querySelectorAll('[data-hours]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-hours]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHours = parseInt(btn.dataset.hours);
      loadData();
    });
  });

  document.getElementById('host-select').addEventListener('change', e => {
    currentHost = e.target.value;
    loadData();
  });

  document.getElementById('refresh-btn').addEventListener('click', loadData);

  // Auto-refresh every 90 seconds
  setInterval(loadData, 90_000);
}

async function loadHostnames() {
  try {
    const res = await fetch(BASE + '/api/hostnames');
    const data = await res.json();
    const sel = document.getElementById('host-select');
    data.hostnames.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.hostname;
      opt.textContent = h.hostname;
      sel.appendChild(opt);
    });
  } catch {}
}

async function loadData() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('error-msg').style.display = 'none';

  try {
    const params = new URLSearchParams({ hours: currentHours, limit: 500 });
    if (currentHost) params.set('hostname', currentHost);
    const res = await fetch(BASE + '/api/reports?' + params);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'API error');

    render(data.rows);
    document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (err) {
    const el = document.getElementById('error-msg');
    el.textContent = 'Failed to load data: ' + err.message;
    el.style.display = 'block';
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function render(rows) {
  if (!rows.length) {
    document.getElementById('report-table').innerHTML = '<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:2rem">No data for this period</td></tr>';
    updateStats([]);
    renderCharts([]);
    return;
  }

  updateStats(rows);
  renderCharts(rows);
  renderTable(rows);
}

function updateStats(rows) {
  if (!rows.length) {
    ['s-avg','s-min','s-max','s-loss','s-spikes','s-alerts','s-total'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }

  const valid = rows.filter(r => r.rtt_avg_ms !== null);
  const avg = valid.length ? (valid.reduce((s,r) => s + r.rtt_avg_ms, 0) / valid.length).toFixed(2) : '—';
  const min = valid.length ? Math.min(...valid.map(r => r.rtt_min_ms)).toFixed(2) : '—';
  const max = valid.length ? Math.max(...valid.map(r => r.rtt_max_ms)).toFixed(2) : '—';
  const loss = (rows.reduce((s,r) => s + (r.packet_loss_pct || 0), 0) / rows.length).toFixed(1);
  const spikes = rows.reduce((s,r) => s + (r.spikes || 0), 0);
  const alerts = rows.filter(r => r.alert).length;

  const lossEl = document.getElementById('s-loss');
  lossEl.textContent = loss + '%';
  lossEl.className = 'value ' + (parseFloat(loss) === 0 ? 'green' : parseFloat(loss) < 5 ? 'yellow' : 'red');

  document.getElementById('s-avg').textContent = avg + 'ms';
  document.getElementById('s-min').textContent = min + 'ms';
  document.getElementById('s-max').textContent = max + 'ms';
  document.getElementById('s-spikes').textContent = spikes;
  document.getElementById('s-alerts').textContent = alerts;
  document.getElementById('s-total').textContent = rows.length;
}

function renderCharts(rows) {
  const labels = rows.map(r => {
    const d = new Date(r.window_start);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // Destroy old charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const grid = { color: '#2a2d3e' };
  const font = { color: '#64748b' };

  // RTT chart
  charts.rtt = new Chart(document.getElementById('chart-rtt'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg',
          data: rows.map(r => r.rtt_avg_ms),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Min',
          data: rows.map(r => r.rtt_min_ms),
          borderColor: '#22c55e',
          borderDash: [4,2],
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Max',
          data: rows.map(r => r.rtt_max_ms),
          borderColor: '#eab308',
          borderDash: [4,2],
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { ticks: { ...font, maxTicksLimit: 12, font: { size: 10 } }, grid },
        y: { ticks: { ...font, callback: v => v + 'ms' }, grid },
      },
    },
  });

  // Loss chart
  charts.loss = new Chart(document.getElementById('chart-loss'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Loss %',
        data: rows.map(r => r.packet_loss_pct),
        backgroundColor: rows.map(r => r.packet_loss_pct > 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.4)'),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { ...font, maxTicksLimit: 12, font: { size: 10 } }, grid },
        y: { ticks: { ...font, callback: v => v + '%' }, grid, min: 0 },
      },
    },
  });

  // Spikes chart
  charts.spikes = new Chart(document.getElementById('chart-spikes'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spikes',
        data: rows.map(r => r.spikes || 0),
        backgroundColor: rows.map(r => (r.spikes || 0) > 0 ? 'rgba(168,85,247,0.7)' : 'rgba(168,85,247,0.15)'),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { ...font, maxTicksLimit: 12, font: { size: 10 } }, grid },
        y: { ticks: { ...font, stepSize: 1 }, grid, min: 0 },
      },
    },
  });
}

function renderTable(rows) {
  const tbody = document.getElementById('report-table');
  // Show last 50 in table (newest first)
  const slice = [...rows].reverse().slice(0, 50);
  tbody.innerHTML = slice.map(r => {
    const badge = r.status === 'stable'
      ? '<span class="badge badge-stable">stable</span>'
      : r.status === 'unstable'
        ? '<span class="badge badge-unstable">unstable</span>'
        : '<span class="badge badge-unreachable">unreachable</span>';
    const reasons = (r.alert_reasons || []).join(', ') || '—';
    const ts = new Date(r.window_start).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    return \`<tr>
      <td style="white-space:nowrap">\${ts}</td>
      <td>\${r.hostname}</td>
      <td>\${badge}</td>
      <td>\${r.rtt_avg_ms !== null ? r.rtt_avg_ms.toFixed(2) : '—'}</td>
      <td>\${r.rtt_min_ms !== null ? r.rtt_min_ms.toFixed(2) : '—'}</td>
      <td>\${r.rtt_max_ms !== null ? r.rtt_max_ms.toFixed(2) : '—'}</td>
      <td style="color:\${r.packet_loss_pct > 0 ? 'var(--red)' : 'var(--green)'}">\${r.packet_loss_pct}</td>
      <td style="color:\${r.spikes > 0 ? 'var(--purple)' : 'inherit'}">\${r.spikes}</td>
      <td style="color:var(--muted);font-size:.75rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="\${reasons}">\${reasons}</td>
    </tr>\`;
  }).join('');
}

init();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
