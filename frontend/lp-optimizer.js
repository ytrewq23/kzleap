const BACKEND = 'https://kzleap.onrender.com';

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
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

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

function showBackendBadge(connected) {
  const el = document.getElementById('backend-badge');
  if (!el) return;
  el.textContent = connected
    ? (typeof t==='function' ? t('backend_connected') : '● Backend connected')
    : (typeof t==='function' ? t('backend_offline')   : '● Offline mode');
  el.style.color = connected ? '#0F6E56' : '#B07C10';
}

(async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/api/config`);
    showBackendBadge(r.ok);
  } catch { showBackendBadge(false); }
})();

// ── Технологии ─────────────────────────────────────────────────────────────
const TECH_COLORS = {
  coal:    '#4a4a6a',
  gas:     '#378ADD',
  oil:     '#C0632A',   // нефть — тёплый оранжево-коричневый
  hydro:   '#5BB8F5',
  wind:    '#1D9E75',
  solar:   '#F6C90E',
  nuclear: '#7F77DD',
};

const TECH_LABELS = {
  coal:    'Coal',
  gas:     'Natural Gas',
  oil:     'Oil / Fuel Oil',
  hydro:   'Hydro',
  wind:    'Wind',
  solar:   'Solar PV',
  nuclear: 'Nuclear',
};

// i18n-ключи для технологий (добавь в translations.js)
const TECH_I18N = {
  coal:    'tech_coal',
  gas:     'tech_gas',
  oil:     'tech_oil',
  hydro:   'tech_hydro',
  wind:    'tech_wind',
  solar:   'tech_solar',
  nuclear: 'tech_nuclear',
};

function techLabel(t) {
  return typeof window.t === 'function' ? (window.t(TECH_I18N[t]) || TECH_LABELS[t]) : TECH_LABELS[t];
}

function getLang() {
  return localStorage.getItem('kzleap_lang') || 'en';
}
function getLangName() {
  return ({ en: 'English', ru: 'Russian', kk: 'Kazakh' })[getLang()] || 'English';
}

let lpChart   = null;
let lastLPData = null;

// ── Claude streaming ────────────────────────────────────────────────────────
async function callClaude(messages, onChunk, maxTokens = 1500) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: maxTokens,
      stream: true,
      system: `You are an expert energy economist specializing in Kazakhstan energy policy and LP optimization models. You provide concise, data-driven analysis. Use plain text only — no markdown, no bullet symbols, no asterisks, no headers with hashes. Use short paragraphs separated by line breaks. IMPORTANT: Respond in ${getLangName()}.`,
      messages,
    }),
  });

  if (!response.ok) throw new Error('Claude API error: ' + response.status);

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
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

// ── AI объяснение результатов ───────────────────────────────────────────────
async function explainResults() {
  if (!lastLPData) return;

  const btn    = document.getElementById('lp-explain-btn');
  const output = document.getElementById('lp-ai-output');
  const sub    = document.getElementById('lp-ai-panel-sub');

  btn.disabled    = true;
  btn.textContent = typeof t==='function' ? t('cb_analyzing') : 'Analyzing...';
  output.textContent = '';
  sub.textContent = `${lastLPData.scenario} · ${lastLPData.year}`;

  const mix = lastLPData.mix;
  const mixLines = Object.entries(mix)
    .filter(([, v]) => v.generation_twh > 0)
    .map(([tech, v]) =>
      `${TECH_LABELS[tech]}: ${v.generation_twh} TWh (${v.share_pct}%), ` +
      `CO2 operational: ${v.co2_mt} Mt, CO2 lifecycle: ${v.co2_lifecycle_mt} Mt, ` +
      `new capacity: ${v.new_capacity_gw} GW`
    )
    .join('\n');

  const SCENARIO_CONTEXT = {
    BAU: 'Business as Usual — no new climate policy, coal-dominated system, minimal RE expansion.',
    MT:  'Moderate Transition — gradual decarbonization, moderate carbon pricing, renewables growing to ~40% by 2050.',
    DD:  'Deep Decarbonization — aggressive climate policy, high carbon price, 70% RE target by 2050, coal phase-out.',
  };

  const oilShare = lastLPData.oil_share_pct ?? 0;
  const fossilShare = lastLPData.fossil_share_pct ?? 0;

  const prompt = `You are a senior energy economist analyzing LP optimization results for Kazakhstan's electricity system.

Scenario: ${lastLPData.scenario} — ${SCENARIO_CONTEXT[lastLPData.scenario] || ''}
Target year: ${lastLPData.year}
Demand: ${lastLPData.demand_twh} TWh
Total generation: ${lastLPData.total_gen_twh} TWh (reserve margin: ${((lastLPData.total_gen_twh / lastLPData.demand_twh - 1) * 100).toFixed(1)}%)
System cost: ${lastLPData.total_cost_bn_usd} billion USD/year
LCOE estimate: ${lastLPData.lcoe_estimate_usd_mwh} USD/MWh
CO2 operational: ${lastLPData.total_co2_mt} Mt
CO2 lifecycle: ${lastLPData.total_co2_lifecycle_mt} Mt
RE share: ${lastLPData.re_share_pct}%
Fossil share (coal + gas + oil): ${fossilShare}%
Oil / fuel oil share: ${oilShare}% (existing 1.2 GW, no new capacity allowed by policy)

Generation mix:
${mixLines}

Kazakhstan context:
- Major oil exporter — domestic oil-fired generation historically used in remote/isolated areas
- Oil generation is expensive (fuel cost ~80 $/MWh) — optimizer uses it only when forced
- NDC: -15% unconditional, -25% conditional vs 1990 baseline
- Grid has limited balancing flexibility

Analyze across 5 dimensions (5-7 sentences each):
1. Binding constraints — which appear active, what does this reveal?
2. Economic interpretation — why this mix, cost trade-offs?
3. Role of oil — is oil generation significant or marginal, what drives its dispatch?
4. Decarbonization progress — vs Kazakhstan's NDC targets?
5. Policy recommendation — one realistic action for policymakers?

Plain text only, no markdown. Number each point. Respond in ${getLangName()}.`;

  try {
    await callClaude([{ role: 'user', content: prompt }], chunk => {
      output.textContent += chunk;
    }, 1500);
  } catch (err) {
    output.textContent = 'Analysis failed: ' + err.message;
  }

  btn.disabled    = false;
  btn.textContent = typeof t==='function' ? t('btn_explain') : 'Explain results';
}

// ── Запуск LP ───────────────────────────────────────────────────────────────
async function runLP() {
  const scenario = document.getElementById('lp-scenario').value;
  const year     = document.getElementById('lp-year').value;
  const btn      = document.getElementById('lp-run-btn');

  document.getElementById('lp-spinner').style.display  = 'flex';
  document.getElementById('lp-error').style.display    = 'none';
  document.getElementById('lp-ai-panel').style.display = 'none';
  btn.disabled    = true;
  btn.textContent = 'Running...';

  try {
    const res = await fetch(`${BACKEND}/api/optimize/quick/${scenario}/${year}`);
    if (!res.ok) throw new Error('Backend returned ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    lastLPData = data;
    document.getElementById('lp-spinner').style.display = 'none';
    btn.disabled    = false;
    btn.textContent = typeof t==='function' ? t('btn_run_lp') : 'Run LP';

    // ── KPI карточки ────────────────────────────────────────────────────
    document.getElementById('lp-gen').textContent           = data.total_gen_twh + ' TWh';
    document.getElementById('lp-cost').textContent          = data.total_cost_bn_usd + ' B$';
    document.getElementById('lp-co2').textContent           = data.total_co2_mt.toFixed(2) + ' Mt';
    document.getElementById('lp-co2-lifecycle').textContent = data.total_co2_lifecycle_mt.toFixed(4) + ' Mt';
    document.getElementById('lp-re').textContent            = data.re_share_pct + '%';

    // Oil share карточка (если элемент есть)
    const oilEl = document.getElementById('lp-oil');
    if (oilEl) oilEl.textContent = (data.oil_share_pct ?? 0) + '%';

    // ── Таблица микса ────────────────────────────────────────────────────
    const tbody = document.getElementById('lp-tbody');
    tbody.innerHTML = '';
    const mix = data.mix;

    // Порядок отображения
    const ORDER = ['coal', 'gas', 'oil', 'hydro', 'wind', 'solar', 'nuclear'];
    ORDER.forEach(tech => {
      const v = mix[tech];
      if (!v || (v.generation_twh === 0 && v.new_capacity_gw === 0)) return;

      const tr  = document.createElement('tr');
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TECH_COLORS[tech]};margin-right:6px;vertical-align:middle;"></span>`;
      const co2op  = v.co2_mt > 0           ? v.co2_mt.toFixed(2)           : '—';
      const co2lca = v.co2_lifecycle_mt > 0  ? v.co2_lifecycle_mt.toFixed(4) : '—';
      const newCap = v.new_capacity_gw > 0   ? '+' + v.new_capacity_gw.toFixed(2) : '—';

      tr.innerHTML = `
        <td>${dot}${techLabel(tech)}</td>
        <td>${v.generation_twh.toFixed(1)}</td>
        <td>${v.share_pct.toFixed(1)}%</td>
        <td>${newCap}</td>
        <td>${co2op}</td>
        <td>${co2lca}</td>
      `;
      tbody.appendChild(tr);
    });

    // ── График ───────────────────────────────────────────────────────────
    const chartTechs  = ORDER.filter(t => mix[t] && mix[t].generation_twh > 0);
    const chartValues = chartTechs.map(t => mix[t].generation_twh);
    const chartColors = chartTechs.map(t => TECH_COLORS[t]);
    const chartLabels = chartTechs.map(t => techLabel(t));
    const yMax = Math.ceil(data.demand_twh * 1.15 / 50) * 50;

    if (lpChart) lpChart.destroy();
    lpChart = new Chart(document.getElementById('lpChart'), {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [{
          label: `${scenario} ${year} (TWh)`,
          data:  chartValues,
          backgroundColor: chartColors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' TWh' } },
        },
        scales: {
          y: { min: 0, max: yMax, ticks: { callback: v => v + ' TWh', font: { size: 10 } } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });

    document.getElementById('lp-ai-panel').style.display = 'block';
    document.getElementById('lp-ai-output').textContent  =
      typeof t==='function' ? t('lp_ai_hint') : 'Click "Explain results" to get an AI interpretation of this optimization.';

  } catch (err) {
    document.getElementById('lp-spinner').style.display = 'none';
    document.getElementById('lp-error').style.display   = 'block';
    document.getElementById('lp-error').textContent     =
      'LP failed: ' + err.message + '. Make sure backend is running at localhost:8000.';
    btn.disabled    = false;
    btn.textContent = typeof t==='function' ? t('btn_run_lp') : 'Run LP';
  }
}
