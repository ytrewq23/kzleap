const BACKEND = 'http://localhost:8000';

const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const avatarColors = { analyst: '#1D9E75', researcher: '#534AB7', policymaker: '#993C1D' };
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', text: 'Energy Analyst' },
  researcher:  { bg: '#eeedfe', color: '#3C3489', text: 'Researcher' },
  policymaker: { bg: '#faece7', color: '#712B13', text: 'Policymaker' },
};
document.getElementById('user-name').textContent = user.name;
document.getElementById('user-role').textContent = badgeStyles[user.role].text;
document.getElementById('user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('');
document.getElementById('user-avatar').style.background = avatarColors[user.role];
const roleBadge = document.getElementById('role-badge');
roleBadge.textContent = badgeStyles[user.role].text;
roleBadge.style.background = badgeStyles[user.role].bg;
roleBadge.style.color = badgeStyles[user.role].color;

(async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/api/config`);
    const el = document.getElementById('backend-badge');
    el.textContent = r.ok ? '● Backend connected' : '● Offline mode';
    el.style.color  = r.ok ? '#0F6E56' : '#B07C10';
  } catch {
    const el = document.getElementById('backend-badge');
    el.textContent = '● Offline mode';
    el.style.color = '#B07C10';
  }
})();

const SHOCK_PARAMS = [
  { value: 'gas_fuel_cost',  label: 'Gas fuel cost' },
  { value: 'coal_fuel_cost', label: 'Coal fuel cost' },
  { value: 'solar_capex',    label: 'Solar capex' },
  { value: 'wind_capex',     label: 'Wind capex' },
  { value: 'nuclear_capex',  label: 'Nuclear capex' },
  { value: 'coal_capex',     label: 'Coal capex' },
  { value: 'demand',         label: 'Electricity demand' },
  { value: 'carbon_price',   label: 'Carbon price ($/t)' },
];

let shocks = [];
let charts = {};
let lastData = null;

function renderShockList() {
  const list = document.getElementById('sa-shocks-list');
  list.innerHTML = '';
  shocks.forEach((shock, i) => {
    const row = document.createElement('div');
    row.className = 'sa-shock-row';

    const isCarbon = shock.param === 'carbon_price';

    row.innerHTML = `
      <select class="sa-shock-select" onchange="updateShock(${i}, 'param', this.value)">
        ${SHOCK_PARAMS.map(p => `<option value="${p.value}" ${p.value === shock.param ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
      <span style="font-size:11px;color:#888;white-space:nowrap;">${isCarbon ? 'Value ($/t):' : 'Change (%):' }</span>
      <input class="sa-shock-input" type="number" value="${isCarbon ? (shock.value || 50) : shock.delta_pct}"
        onchange="updateShock(${i}, '${isCarbon ? 'value' : 'delta_pct'}', +this.value)"
        placeholder="${isCarbon ? '50' : '+30'}">
      <button class="sa-shock-remove" onclick="removeShock(${i})">✕</button>
    `;
    list.appendChild(row);
  });
}

function addShock() {
  shocks.push({ param: 'gas_fuel_cost', delta_pct: 30, label: 'Gas fuel cost +30%' });
  renderShockList();
}

function removeShock(i) {
  shocks.splice(i, 1);
  renderShockList();
}

function updateShock(i, field, val) {
  shocks[i][field] = val;
  if (field === 'param') {
    shocks[i].delta_pct = 30;
    shocks[i].value     = 50;
    renderShockList();
  }
  shocks[i].label = buildLabel(shocks[i]);
}

function buildLabel(shock) {
  const name = SHOCK_PARAMS.find(p => p.value === shock.param)?.label || shock.param;
  if (shock.param === 'carbon_price') return `Carbon price $${shock.value}/t`;
  return `${name} ${shock.delta_pct > 0 ? '+' : ''}${shock.delta_pct}%`;
}

function loadPreset(type) {
  if (type === 'price') {
    shocks = [
      { param: 'gas_fuel_cost',  delta_pct: +30, label: 'Gas fuel cost +30%' },
      { param: 'coal_fuel_cost', delta_pct: +20, label: 'Coal fuel cost +20%' },
      { param: 'gas_fuel_cost',  delta_pct: -20, label: 'Gas fuel cost -20%' },
    ];
  } else if (type === 'tech') {
    shocks = [
      { param: 'solar_capex', delta_pct: -30, label: 'Solar capex -30%' },
      { param: 'wind_capex',  delta_pct: -25, label: 'Wind capex -25%' },
      { param: 'solar_capex', delta_pct: -50, label: 'Solar capex -50%' },
    ];
  } else if (type === 'carbon') {
    shocks = [
      { param: 'carbon_price', delta_pct: 0, value: 20,  label: 'Carbon price $20/t' },
      { param: 'carbon_price', delta_pct: 0, value: 50,  label: 'Carbon price $50/t' },
      { param: 'carbon_price', delta_pct: 0, value: 100, label: 'Carbon price $100/t' },
    ];
  }
  shocks.forEach(s => { if (!s.label) s.label = buildLabel(s); });
  renderShockList();
}

function deltaClass(val) {
  if (val === null || val === undefined) return 'delta-zero';
  if (val > 0) return 'delta-pos';
  if (val < 0) return 'delta-neg';
  return 'delta-zero';
}

function fmtDelta(val, suffix = '%') {
  if (val === null || val === undefined) return '—';
  return (val > 0 ? '+' : '') + val + suffix;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function buildBarChart(canvasId, labels, baselineVal, shockVals, label, color) {
  destroyChart(canvasId);
  const allVals = [baselineVal, ...shockVals];
  const minVal  = Math.min(...allVals.filter(v => v !== null));
  const maxVal  = Math.max(...allVals.filter(v => v !== null));
  const padding = (maxVal - minVal) * 0.15 || 1;

  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: ['Baseline', ...labels],
      datasets: [{
        label,
        data: [baselineVal, ...shockVals],
        backgroundColor: ['#c8d6e5', ...shockVals.map(v =>
          v === null ? '#eee' : v > baselineVal ? '#e57373' : '#81c995'
        )],
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' ' + label } } },
      scales: {
        y: { min: Math.max(0, minVal - padding), max: maxVal + padding, ticks: { font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 30 }, grid: { display: false } }
      }
    }
  });
}

async function runSensitivity() {
  if (shocks.length === 0) {
    document.getElementById('sa-error').style.display = 'block';
    document.getElementById('sa-error').textContent   = 'Add at least one shock before running.';
    return;
  }

  const btn = document.getElementById('sa-run-btn');
  btn.disabled = true; btn.textContent = 'Running...';
  document.getElementById('sa-error').style.display   = 'none';
  document.getElementById('sa-results').style.display = 'none';
  document.getElementById('sa-spinner').style.display = 'flex';

  try {
    shocks.forEach(s => { s.label = buildLabel(s); });

    const res = await fetch(`${BACKEND}/api/sensitivity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: document.getElementById('sa-scenario').value,
        year:     +document.getElementById('sa-year').value,
        shocks:   shocks.map(s => ({
          param:     s.param,
          delta_pct: s.delta_pct || 0,
          value:     s.value     || null,
          label:     s.label,
        })),
      }),
    });

    if (!res.ok) throw new Error('Backend error ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    lastData = data;

    document.getElementById('sa-spinner').style.display  = 'none';
    document.getElementById('sa-results').style.display  = 'block';
    document.getElementById('sa-ai-output').textContent  = 'Click "Explain results" to get an AI interpretation.';

    const b = data.baseline;
    const baseCards = document.getElementById('sa-baseline-cards');
    baseCards.innerHTML = `
      <div class="metric-card"><div class="metric-label">Baseline cost</div><div class="metric-value" style="color:#0F6E56;">${b.total_cost_bn_usd} B$</div><div class="metric-change neutral">USD/yr</div></div>
      <div class="metric-card"><div class="metric-label">Baseline CO2</div><div class="metric-value" style="color:#D85A30;">${b.total_co2_mt} Mt</div><div class="metric-change neutral">Operational</div></div>
      <div class="metric-card"><div class="metric-label">Baseline RE share</div><div class="metric-value" style="color:#1D9E75;">${b.re_share_pct}%</div><div class="metric-change neutral">Of generation</div></div>
      <div class="metric-card"><div class="metric-label">Baseline LCOE</div><div class="metric-value" style="color:#1a2b4a;">${b.lcoe_usd_mwh}</div><div class="metric-change neutral">USD/MWh</div></div>
    `;

    const tbody  = document.getElementById('sa-table-body');
    tbody.innerHTML = '';
    data.shocks.forEach(s => {
      const r = s.result;
      const err = !!r.error;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${s.label}</td>
        <td>${err ? '—' : r.total_cost_bn_usd}</td>
        <td class="${deltaClass(s.cost_delta_pct)}">${fmtDelta(s.cost_delta_pct)}</td>
        <td>${err ? '—' : r.total_co2_mt}</td>
        <td class="${deltaClass(s.co2_delta_pct)}">${fmtDelta(s.co2_delta_pct)}</td>
        <td>${err ? '—' : r.re_share_pct}</td>
        <td class="${deltaClass(s.re_delta_ppt)}">${fmtDelta(s.re_delta_ppt, ' pp')}</td>
        <td>${err ? '—' : r.lcoe_usd_mwh}</td>
        <td class="${deltaClass(s.lcoe_delta_pct)}">${fmtDelta(s.lcoe_delta_pct)}</td>
      `;
      tbody.appendChild(tr);
    });

    const labels    = data.shocks.map(s => s.label);
    const costVals  = data.shocks.map(s => s.result.error ? null : s.result.total_cost_bn_usd);
    const co2Vals   = data.shocks.map(s => s.result.error ? null : s.result.total_co2_mt);
    const reVals    = data.shocks.map(s => s.result.error ? null : s.result.re_share_pct);

    buildBarChart('sa-cost-chart', labels, b.total_cost_bn_usd, costVals, 'B$/yr', '#378ADD');
    buildBarChart('sa-co2-chart',  labels, b.total_co2_mt,      co2Vals,  'Mt',    '#D85A30');
    buildBarChart('sa-re-chart',   labels, b.re_share_pct,       reVals,   '%',    '#1D9E75');

  } catch (err) {
    document.getElementById('sa-spinner').style.display  = 'none';
    document.getElementById('sa-error').style.display    = 'block';
    document.getElementById('sa-error').textContent      = 'Analysis failed: ' + err.message;
  }

  btn.disabled = false; btn.textContent = 'Run sensitivity analysis';
}

async function explainSensitivity() {
  if (!lastData) return;
  const btn    = document.getElementById('sa-explain-btn');
  const output = document.getElementById('sa-ai-output');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  output.textContent = '';

  const b = lastData.baseline;
  const shockSummary = lastData.shocks
    .filter(s => !s.result.error)
    .map(s => `${s.label}: cost ${fmtDelta(s.cost_delta_pct)}, CO2 ${fmtDelta(s.co2_delta_pct)}, RE share ${fmtDelta(s.re_delta_ppt, ' pp')}, LCOE ${fmtDelta(s.lcoe_delta_pct)}`)
    .join('\n');

  const prompt = `You are a senior energy economist. Analyze a sensitivity analysis of LP optimization results for Kazakhstan's electricity system.

Scenario: ${lastData.scenario}, Year: ${lastData.year}
Baseline: cost=${b.total_cost_bn_usd} B$/yr, CO2=${b.total_co2_mt} Mt, RE share=${b.re_share_pct}%, LCOE=${b.lcoe_usd_mwh} $/MWh

Shock results (change vs baseline):
${shockSummary}

Analyze — do not restate numbers, interpret them:

1. Most impactful shock: Which single parameter change has the largest effect on system cost and why? What does this tell us about the structure of Kazakhstan's electricity system?

2. CO2 sensitivity: Which shocks significantly change CO2 emissions and why? Does the LP respond to cost shocks by switching fuels, or are constraints binding?

3. Renewables response: Do RE technology cost reductions actually increase RE share, or are RE penetration caps limiting the response? What does this imply for policy?

4. Carbon price effectiveness: If carbon price shocks are included, at what price level does it start meaningfully changing the mix? Is it cost-competitive vs direct regulation?

5. Risk ranking: Rank the tested shocks from highest to lowest risk for Kazakhstan's energy planning, and explain the top risk in one sentence.

Keep each point to 2-3 sentences. Plain text only, no markdown, number each point.`;

  try {
    const response = await fetch(`${BACKEND}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], system: 'You are an expert energy economist specializing in Kazakhstan. Plain text only, no markdown, no bullet symbols, number each point.', max_tokens: 1500, stream: true }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) output.textContent += text;
        } catch {}
      }
    }
  } catch (err) {
    output.textContent = 'Analysis failed: ' + err.message;
  }

  btn.disabled = false; btn.textContent = 'Explain results';
}

loadPreset('price');
