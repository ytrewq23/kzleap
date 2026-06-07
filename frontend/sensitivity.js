const BACKEND = 'http://localhost:8000';

const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const avatarColors = { analyst: '#1D9E75', researcher: '#534AB7', policymaker: '#993C1D' };
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', get text(){ return typeof t==='function'?t('role_analyst'):'Energy Analyst'; } },
  researcher:  { bg: '#eeedfe', color: '#3C3489', get text(){ return typeof t==='function'?t('role_researcher'):'Researcher'; } },
  policymaker: { bg: '#faece7', color: '#712B13', get text(){ return typeof t==='function'?t('role_policymaker'):'Policymaker'; } },
};
document.getElementById('user-name').textContent = user.name;
document.getElementById('user-role').textContent = badgeStyles[user.role].text;
document.getElementById('user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('');
document.getElementById('user-avatar').style.background = avatarColors[user.role];
const roleBadge = document.getElementById('role-badge');
roleBadge.textContent = badgeStyles[user.role].text;
roleBadge.style.background = badgeStyles[user.role].bg;
roleBadge.style.color = badgeStyles[user.role].color;

function confirmDelete() {
  document.getElementById('delete-modal').style.display = 'flex';
  document.getElementById('delete-password').value = '';
  document.getElementById('delete-error').style.display = 'none';
}
function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}
async function deleteAccount() {
  const password = document.getElementById('delete-password').value.trim();
  const error = document.getElementById('delete-error');
  error.style.display = 'none';
  if (!password) { error.textContent = 'Please enter your password.'; error.style.display = 'block'; return; }
  try {
    const res = await fetch(`${BACKEND}/api/delete-account`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: user.email, password }) });
    const data = await res.json();
    if (!res.ok) { error.textContent = data.detail || 'Failed.'; error.style.display = 'block'; return; }
    sessionStorage.clear(); window.location.href = 'index.html';
  } catch { error.textContent = 'Cannot connect to server.'; error.style.display = 'block'; }
}

(async function checkBackend() {
  const el = document.getElementById('backend-badge');
  try {
    const r = await fetch(`${BACKEND}/api/config`);
    el.textContent = r.ok
      ? (typeof t==='function' ? t('backend_connected') : '● Backend connected')
      : (typeof t==='function' ? t('backend_offline')   : '● Offline mode');
    el.style.color = r.ok ? '#0F6E56' : '#B07C10';
  } catch {
    el.textContent = typeof t==='function' ? t('backend_offline') : '● Offline mode';
    el.style.color = '#B07C10';
  }
})();

function getLang()     { return localStorage.getItem('kzleap_lang') || 'en'; }
function getLangName() { return ({ en: 'English', ru: 'Russian', kk: 'Kazakh' })[getLang()] || 'English'; }

// ── Параметры шоков — теперь включают нефть ────────────────────────────────
const SHOCK_PARAMS = [
  { value: 'gas_fuel_cost',  label: 'Gas fuel cost',         unit: '%' },
  { value: 'coal_fuel_cost', label: 'Coal fuel cost',        unit: '%' },
  { value: 'oil_fuel_cost',  label: 'Oil fuel cost',         unit: '%' },  // новый
  { value: 'solar_capex',    label: 'Solar capex',           unit: '%' },
  { value: 'wind_capex',     label: 'Wind capex',            unit: '%' },
  { value: 'nuclear_capex',  label: 'Nuclear capex',         unit: '%' },
  { value: 'coal_capex',     label: 'Coal capex',            unit: '%' },
  { value: 'oil_capex',      label: 'Oil capex',             unit: '%' },  // новый
  { value: 'demand',         label: 'Electricity demand',    unit: '%' },
  { value: 'carbon_price',   label: 'Carbon price ($/t)',    unit: 'abs' },
];

let shocks    = [];
let charts    = {};
let lastData  = null;

// ── Рендер списка шоков ────────────────────────────────────────────────────
function renderShockList() {
  const list = document.getElementById('sa-shocks-list');
  list.innerHTML = '';
  shocks.forEach((shock, i) => {
    const param   = SHOCK_PARAMS.find(p => p.value === shock.param) || SHOCK_PARAMS[0];
    const isAbs   = param.unit === 'abs';
    const row     = document.createElement('div');
    row.className = 'sa-shock-row';
    row.innerHTML = `
      <select class="sa-shock-select" onchange="updateShock(${i}, 'param', this.value)">
        ${SHOCK_PARAMS.map(p =>
          `<option value="${p.value}" ${p.value === shock.param ? 'selected' : ''}>${p.label}</option>`
        ).join('')}
      </select>
      <span style="font-size:11px;color:#888;white-space:nowrap;">
        ${isAbs ? 'Value ($/t):' : 'Change (%):'}
      </span>
      <input class="sa-shock-input" type="number"
        value="${isAbs ? (shock.value ?? 50) : (shock.delta_pct ?? 30)}"
        onchange="updateShock(${i}, '${isAbs ? 'value' : 'delta_pct'}', +this.value)"
        placeholder="${isAbs ? '50' : '+30'}">
      <button class="sa-shock-remove" onclick="removeShock(${i})">✕</button>
    `;
    list.appendChild(row);
  });
}

function addShock() {
  shocks.push({ param: 'gas_fuel_cost', delta_pct: 30, value: null, label: 'Gas fuel cost +30%' });
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
    shocks[i].value     = null;
    renderShockList();
  }
  shocks[i].label = buildLabel(shocks[i]);
}

function buildLabel(shock) {
  const param = SHOCK_PARAMS.find(p => p.value === shock.param);
  const name  = param?.label || shock.param;
  if (param?.unit === 'abs') return `Carbon price $${shock.value ?? 50}/t`;
  const sign  = (shock.delta_pct ?? 0) > 0 ? '+' : '';
  return `${name} ${sign}${shock.delta_pct ?? 0}%`;
}

// ── Пресеты — исправлены, теперь каждый шок уникален ──────────────────────
function loadPreset(type) {
  if (type === 'price') {
    // Ценовые шоки: разные топлива, разные направления
    shocks = [
      { param: 'gas_fuel_cost',  delta_pct: +30, value: null, label: 'Gas fuel cost +30%' },
      { param: 'coal_fuel_cost', delta_pct: +20, value: null, label: 'Coal fuel cost +20%' },
      { param: 'oil_fuel_cost',  delta_pct: +50, value: null, label: 'Oil fuel cost +50%' },
    ];
  } else if (type === 'tech') {
    // Технологические шоки: снижение CAPEX ВИЭ + рост ядерного
    shocks = [
      { param: 'solar_capex',   delta_pct: -30, value: null, label: 'Solar capex −30%' },
      { param: 'wind_capex',    delta_pct: -25, value: null, label: 'Wind capex −25%' },
      { param: 'nuclear_capex', delta_pct: -15, value: null, label: 'Nuclear capex −15%' },
    ];
  } else if (type === 'carbon') {
    // Три уровня углеродной цены
    shocks = [
      { param: 'carbon_price', delta_pct: 0, value: 20,  label: 'Carbon price $20/t' },
      { param: 'carbon_price', delta_pct: 0, value: 50,  label: 'Carbon price $50/t' },
      { param: 'carbon_price', delta_pct: 0, value: 100, label: 'Carbon price $100/t' },
    ];
  } else if (type === 'oil') {
    // Нефтяные шоки: влияние цены нефти на систему
    shocks = [
      { param: 'oil_fuel_cost', delta_pct: +30, value: null, label: 'Oil fuel cost +30%' },
      { param: 'oil_fuel_cost', delta_pct: +80, value: null, label: 'Oil fuel cost +80%' },
      { param: 'oil_fuel_cost', delta_pct: -30, value: null, label: 'Oil fuel cost −30%' },
    ];
  }
  renderShockList();
}

// ── Утилиты ────────────────────────────────────────────────────────────────
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

function buildBarChart(canvasId, labels, baselineVal, shockVals, label) {
  destroyChart(canvasId);
  const allVals = [baselineVal, ...shockVals.filter(v => v !== null)];
  const minVal  = Math.min(...allVals);
  const maxVal  = Math.max(...allVals);
  const padding = (maxVal - minVal) * 0.15 || 1;

  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels: ['Baseline', ...labels],
      datasets: [{
        label,
        data: [baselineVal, ...shockVals],
        backgroundColor: [
          '#c8d6e5',
          ...shockVals.map(v => v === null ? '#eee' : v > baselineVal ? '#e57373' : '#81c995'),
        ],
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => (ctx.parsed.y ?? '—') + ' ' + label } },
      },
      scales: {
        y: { min: 0, max: maxVal + padding, ticks: { font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxRotation: 30 }, grid: { display: false } },
      },
    },
  });
}

// ── Основной запрос ────────────────────────────────────────────────────────
async function runSensitivity() {
  if (shocks.length === 0) {
    document.getElementById('sa-error').style.display  = 'block';
    document.getElementById('sa-error').textContent    = 'Add at least one shock before running.';
    return;
  }

  const btn = document.getElementById('sa-run-btn');
  btn.disabled    = true;
  btn.textContent = 'Running...';
  document.getElementById('sa-error').style.display   = 'none';
  document.getElementById('sa-results').style.display = 'none';
  document.getElementById('sa-spinner').style.display = 'flex';

  try {
    const payload = {
      scenario: document.getElementById('sa-scenario').value,
      year:     +document.getElementById('sa-year').value,
      shocks:   shocks.map(s => {
        const param = SHOCK_PARAMS.find(p => p.value === s.param);
        return {
          param:     s.param,
          delta_pct: param?.unit === 'abs' ? 0 : (s.delta_pct ?? 0),
          value:     param?.unit === 'abs' ? (s.value ?? 50) : null,
          label:     buildLabel(s),
        };
      }),
    };

    const res = await fetch(`${BACKEND}/api/sensitivity`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Backend error ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    lastData = data;

    document.getElementById('sa-spinner').style.display  = 'none';
    document.getElementById('sa-results').style.display  = 'block';
    document.getElementById('sa-ai-output').textContent  =
      typeof t==='function' ? t('lp_ai_hint') : 'Click "Explain results" to get an AI interpretation.';

    // ── Baseline карточки ──────────────────────────────────────────────
    const b = data.baseline;


    document.getElementById('sa-baseline-cards').innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Baseline cost</div>
        <div class="metric-value" style="color:#0F6E56;">${b.total_cost_bn_usd} B$</div>
        <div class="metric-change neutral">USD/yr</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Baseline CO₂</div>
        <div class="metric-value" style="color:#D85A30;">${b.total_co2_mt} Mt</div>
        <div class="metric-change neutral">Operational</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Baseline RE share</div>
        <div class="metric-value" style="color:#1D9E75;">${b.re_share_pct}%</div>
        <div class="metric-change neutral">Of generation</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Baseline LCOE</div>
        <div class="metric-value" style="color:#1a2b4a;">${b.lcoe_usd_mwh}</div>
        <div class="metric-change neutral">USD/MWh</div>
      </div>
    `;

    // ── Таблица шоков ──────────────────────────────────────────────────
    const tbody = document.getElementById('sa-table-body');
    tbody.innerHTML = '';
    data.shocks.forEach(s => {
      const r   = s.result;
      const err = !!r.error;
      const tr  = document.createElement('tr');


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

    // ── Графики ────────────────────────────────────────────────────────
    const labels   = data.shocks.map(s => s.label);
    const costVals = data.shocks.map(s => s.result.error ? null : s.result.total_cost_bn_usd);
    const co2Vals  = data.shocks.map(s => s.result.error ? null : s.result.total_co2_mt);
    const reVals   = data.shocks.map(s => s.result.error ? null : s.result.re_share_pct);
    const oilVals  = data.shocks.map(s =>
      (!s.result.error && s.result.oil_share_pct !== undefined) ? s.result.oil_share_pct : null
    );

    buildBarChart('sa-cost-chart', labels, b.total_cost_bn_usd, costVals, 'B$/yr');
    buildBarChart('sa-co2-chart',  labels, b.total_co2_mt,      co2Vals,  'Mt');
    buildBarChart('sa-re-chart',   labels, b.re_share_pct,      reVals,   '%');

    // Нефтяной график — рендерим только если canvas существует
    const oilCanvas = document.getElementById('sa-oil-chart');
    if (oilCanvas && b.oil_share_pct !== undefined) {
      buildBarChart('sa-oil-chart', labels, b.oil_share_pct, oilVals, '%');
    }

  } catch (err) {
    document.getElementById('sa-spinner').style.display = 'none';
    document.getElementById('sa-error').style.display   = 'block';
    document.getElementById('sa-error').textContent     = 'Analysis failed: ' + err.message;
  }

  btn.disabled    = false;
  btn.textContent = 'Run sensitivity analysis';
}

// ── AI объяснение ──────────────────────────────────────────────────────────
async function explainSensitivity() {
  if (!lastData) return;
  const btn    = document.getElementById('sa-explain-btn');
  const output = document.getElementById('sa-ai-output');
  btn.disabled    = true;
  btn.textContent = typeof t==='function' ? t('cb_analyzing') : 'Analyzing...';
  output.textContent = '';

  const b = lastData.baseline;
  const oilBaseline = b.oil_share_pct !== undefined
    ? `\nBaseline oil share: ${b.oil_share_pct}% (existing 1.2 GW, no new capacity allowed)`
    : '';

  const shockSummary = lastData.shocks
    .filter(s => !s.result.error)
    .map(s => {
      const oilNote = s.result.oil_share_pct !== undefined && b.oil_share_pct !== undefined
        ? `, oil share Δ${(s.result.oil_share_pct - b.oil_share_pct).toFixed(1)} pp`
        : '';
      return `${s.label}: cost ${fmtDelta(s.cost_delta_pct)}, CO₂ ${fmtDelta(s.co2_delta_pct)}, RE ${fmtDelta(s.re_delta_ppt, ' pp')}, LCOE ${fmtDelta(s.lcoe_delta_pct)}${oilNote}`;
    })
    .join('\n');

  const hasOilShock = lastData.shocks.some(s => s.label?.includes('Oil') || s.label?.includes('oil'));

  const prompt = `You are a senior energy economist analyzing sensitivity results for Kazakhstan's electricity system.

Scenario: ${lastData.scenario}, Year: ${lastData.year}
Baseline: cost=${b.total_cost_bn_usd} B$/yr, CO₂=${b.total_co2_mt} Mt, RE=${b.re_share_pct}%, LCOE=${b.lcoe_usd_mwh} $/MWh${oilBaseline}

Shock results (Δ vs baseline):
${shockSummary}

Kazakhstan context: major oil exporter, oil-fired generation in remote areas (1.2 GW existing, no new capacity by policy), coal dominant (61%), NDC −15%/−25% vs 1990.

Analyze — interpret, do not restate numbers:
1. Most impactful shock: which parameter change has the largest system-wide effect and why?
2. CO₂ sensitivity: which shocks materially change emissions and through what mechanism?
3. Renewables response: do RE cost reductions actually raise RE share, or are grid/policy caps binding?
${hasOilShock ? '4. Oil dynamics: how does oil fuel price volatility affect dispatch and system cost — given oil is the most expensive fuel? Does higher oil price push the optimizer toward coal or RE?\n5.' : '4.'} Carbon price effectiveness: at what level does carbon pricing start changing the mix?
${hasOilShock ? '6.' : '5.'} Risk ranking: rank shocks from highest to lowest risk for Kazakhstan energy planning.

2-3 sentences per point. Plain text only, no markdown, number each point. Respond in ${getLangName()}.`;

  try {
    const response = await fetch(`${BACKEND}/api/claude`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        system:   `Expert energy economist, Kazakhstan specialist. Plain text, no markdown, number points. Respond in ${getLangName()}.`,
        max_tokens: 1500,
        stream: true,
      }),
    });

    const reader  = response.body.getReader();
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
        const d = line.slice(6).trim();
        if (d === '[DONE]') break;
        try {
          const parsed = JSON.parse(d);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) output.textContent += text;
        } catch {}
      }
    }
  } catch (err) {
    output.textContent = 'Analysis failed: ' + err.message;
  }

  btn.disabled    = false;
  btn.textContent = typeof t==='function' ? t('btn_explain') : 'Explain results';
}

// ── Старт ──────────────────────────────────────────────────────────────────
loadPreset('price');