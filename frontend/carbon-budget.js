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

const SC_COLORS = { BAU: '#4a5568', MT: '#1D9E75', DD: '#534AB7' };
const SC_NAMES  = { BAU: 'Business as Usual', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
let cbData = null;
let complianceChart = null;

function na(val, suffix = '') {
  if (val === null || val === undefined) return 'Not achieved';
  return val + suffix;
}

async function loadCarbonBudget() {
  try {
    const res = await fetch(`${BACKEND}/api/carbon-budget`);
    if (!res.ok) throw new Error('Backend error ' + res.status);
    cbData = await res.json();

    document.getElementById('cb-spinner').style.display = 'none';
    document.getElementById('cb-content').style.display = 'block';

    renderSummaryCards();
    renderTrajectoryChart();
    renderBudgetChart();
    renderComplianceTable();
    showCompliance('MT');

  } catch (err) {
    document.getElementById('cb-spinner').style.display = 'none';
    document.getElementById('cb-error').style.display   = 'block';
    document.getElementById('cb-error').textContent     = 'Failed to load data: ' + err.message;
  }
}

function renderSummaryCards() {
  const cards = document.getElementById('cb-summary-cards');
  const ndc   = cbData.ndc_target_mt;
  const cond  = cbData.cond_ndc_target_mt;
  const b15   = cbData.budget_15c_mt;
  const b20   = cbData.budget_20c_mt;

  cards.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">1990 baseline (NDC base)</div>
      <div class="metric-value" style="color:#1a2b4a;">${cbData.base_year_1990_mt} Mt</div>
      <div class="metric-change neutral">CO2 reference year</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">NDC target 2030 (-15%)</div>
      <div class="metric-value" style="color:#D85A30;">${ndc} Mt</div>
      <div class="metric-change neutral">Unconditional</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">NDC conditional 2030 (-25%)</div>
      <div class="metric-value" style="color:#D85A30;">${cond} Mt</div>
      <div class="metric-change neutral">With intl. support</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">KZ share 1.5C budget</div>
      <div class="metric-value" style="color:#534AB7;">${b15} Mt</div>
      <div class="metric-change neutral">Cumulative 2024-2060 · ${cbData.ipcc_kz_share_pct}% of global</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">KZ share 2C budget</div>
      <div class="metric-value" style="color:#378ADD;">${b20} Mt</div>
      <div class="metric-change neutral">Cumulative 2024-2060</div>
    </div>
  `;
}

function renderTrajectoryChart() {
  const years   = cbData.scenarios.BAU?.ndc_compliance.map(r => r.year) || [];
  const datasets = Object.entries(cbData.scenarios).map(([sc, d]) => ({
    label:       SC_NAMES[sc],
    data:        d.ndc_compliance.map(r => r.co2_mt),
    borderColor: SC_COLORS[sc],
    backgroundColor: SC_COLORS[sc] + '18',
    fill: false,
    tension: 0.3,
    borderWidth: 2,
    pointRadius: 0,
  }));

  datasets.push({
    label: 'NDC -15% (246 Mt)',
    data:  years.map(() => cbData.ndc_target_mt),
    borderColor: '#D85A30',
    borderDash: [6, 3],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
  });
  datasets.push({
    label: 'NDC -25% (217 Mt)',
    data:  years.map(() => cbData.cond_ndc_target_mt),
    borderColor: '#B07C10',
    borderDash: [3, 3],
    borderWidth: 1.5,
    pointRadius: 0,
    fill: false,
  });

  new Chart(document.getElementById('cb-trajectory-chart'), {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 16 } } },
      scales: {
        y: { ticks: { callback: v => v + ' Mt', font: { size: 10 } }, title: { display: true, text: 'Mt CO2', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderBudgetChart() {
  const labels = Object.keys(cbData.scenarios).map(s => SC_NAMES[s]);
  const pct15  = Object.values(cbData.scenarios).map(d => d.pct_budget_15c_used);
  const pct20  = Object.values(cbData.scenarios).map(d => d.pct_budget_20c_used);

  new Chart(document.getElementById('cb-budget-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '1.5C budget used (%)', data: pct15, backgroundColor: '#534AB7', borderRadius: 4 },
        { label: '2C budget used (%)',   data: pct20, backgroundColor: '#378ADD', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 14 } } },
      scales: {
        y: { min: 0, max: 110, ticks: { callback: v => v + '%', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderComplianceTable() {
  const tbody = document.getElementById('cb-compliance-body');
  tbody.innerHTML = '';
  Object.entries(cbData.scenarios).forEach(([sc, d]) => {
    const tr = document.createElement('tr');
    const ndc30 = d.co2_2030_mt;
    const meetsNDC = ndc30 !== null && ndc30 <= cbData.ndc_target_mt;
    tr.innerHTML = `
      <td style="color:${SC_COLORS[sc]};font-weight:700;">${SC_NAMES[sc]}</td>
      <td class="${meetsNDC ? 'met' : 'not-met'}">${ndc30 ?? '—'} Mt</td>
      <td>${na(d.ndc_achieved_year)}</td>
      <td>${na(d.cond_ndc_achieved_year)}</td>
      <td>${na(d.neutrality_projected_yr)}</td>
      <td>${d.cumulative_2024_2060_mt} Mt</td>
      <td>${d.pct_budget_15c_used}%</td>
      <td>${na(d.budget_15c_exhausted_yr)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showCompliance(sc) {
  document.querySelectorAll('.cb-sc-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + sc).classList.add('active');

  const d     = cbData.scenarios[sc];
  const rows  = d.ndc_compliance;
  const years = rows.map(r => r.year);
  const surplus = rows.map(r => r.surplus_mt);

  if (complianceChart) complianceChart.destroy();

  complianceChart = new Chart(document.getElementById('cb-compliance-chart'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: `Surplus vs NDC -15% (Mt) · ${SC_NAMES[sc]}`,
        data:  surplus,
        backgroundColor: surplus.map(v => v >= 0 ? '#81c99520' : '#e5737320'),
        borderColor:     surplus.map(v => v >= 0 ? '#1D9E75'   : '#D85A30'),
        borderWidth: 1.5,
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => (ctx.parsed.y > 0 ? '+' : '') + ctx.parsed.y + ' Mt vs NDC target' } } },
      scales: {
        y: { ticks: { callback: v => (v > 0 ? '+' : '') + v + ' Mt', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

async function explainBudget() {
  if (!cbData) return;
  const btn    = document.getElementById('cb-explain-btn');
  const output = document.getElementById('cb-ai-output');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  output.textContent = '';

  const summary = Object.entries(cbData.scenarios).map(([sc, d]) =>
    `${SC_NAMES[sc]}: CO2 in 2030=${d.co2_2030_mt}Mt, NDC-15% achieved=${na(d.ndc_achieved_year)}, NDC-25% achieved=${na(d.cond_ndc_achieved_year)}, neutrality=${na(d.neutrality_projected_yr)}, cumulative 2024-2060=${d.cumulative_2024_2060_mt}Mt, 1.5C budget used=${d.pct_budget_15c_used}%, 1.5C budget exhausted=${na(d.budget_15c_exhausted_yr)}`
  ).join('\n');

  const prompt = `You are a senior climate policy economist. Analyze Kazakhstan's carbon budget situation based on energy model results.

Kazakhstan NDC: -15% CO2 by 2030 (unconditional), -25% conditional. 1990 baseline: 290 Mt. Carbon neutrality target: 2060.
IPCC 1.5C budget for Kazakhstan: ${cbData.budget_15c_mt} Mt cumulative. 2C budget: ${cbData.budget_20c_mt} Mt.

Scenario results:
${summary}

Analyze — do not restate numbers, interpret them:

1. NDC compliance gap: Which scenarios meet the 2030 NDC and which fail? What is the structural reason for the gap in the failing scenarios?

2. Carbon budget alignment: How does Kazakhstan's cumulative emissions under each scenario compare to the IPCC 1.5C and 2C budgets? What does it mean to exhaust the 1.5C budget by a specific year?

3. Neutrality feasibility: Is carbon neutrality by 2060 realistic under any scenario? What are the main barriers?

4. International context: Kazakhstan contributes ${cbData.ipcc_kz_share_pct}% of the global IPCC budget. How does its per-capita effort compare to what a fair-share approach would require?

5. Urgent recommendation: What single policy action would most improve Kazakhstan's carbon budget trajectory in the next five years?

Keep each point to 2-3 sentences. Plain text only, no markdown, number each point.`;

  try {
    const response = await fetch(`${BACKEND}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], system: 'You are an expert climate policy economist. Plain text only, no markdown, number each point.', max_tokens: 1500, stream: true }),
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

loadCarbonBudget();


// ── Custom Target ──

let ctCharts = {};

function destroyCTChart(id) {
  if (ctCharts[id]) { ctCharts[id].destroy(); delete ctCharts[id]; }
}

function loadCTPreset(type) {
  const presets = {
    ndc:        { year: 2060, red2030: 15,  red2050: 50  },
    paris15:    { year: 2050, red2030: 25,  red2050: 80  },
    neutrality: { year: 2060, red2030: 15,  red2050: 60  },
    ambitious:  { year: 2050, red2030: 35,  red2050: 90  },
  };
  const p = presets[type];
  if (!p) return;
  document.getElementById('ct-year').value    = p.year;
  document.getElementById('ct-red2030').value = p.red2030;
  document.getElementById('ct-red2050').value = p.red2050;
}

async function runCustomTarget() {
  const btn = document.getElementById('ct-run-btn');
  btn.disabled = true; btn.textContent = 'Calculating...';
  document.getElementById('ct-error').style.display   = 'none';
  document.getElementById('ct-results').style.display = 'none';
  document.getElementById('ct-spinner').style.display = 'block';

  try {
    const res = await fetch(`${BACKEND}/api/carbon-budget/custom-target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        neutrality_year:    +document.getElementById('ct-year').value,
        reduction_pct_2030: +document.getElementById('ct-red2030').value,
        reduction_pct_2050: +document.getElementById('ct-red2050').value,
      }),
    });
    if (!res.ok) throw new Error('Backend error ' + res.status);
    const data = await res.json();
    window._ctData = data;

    document.getElementById('ct-spinner').style.display  = 'none';
    document.getElementById('ct-results').style.display  = 'block';

    renderCTKPICards(data);
    renderCTTrajectoryChart(data);
    renderCTBudgetChart(data);
    renderCTGapsTable(data);
    document.getElementById('ct-ai-output').textContent = 'Click "Assess feasibility" for an AI analysis of this target pathway.';

  } catch (err) {
    document.getElementById('ct-spinner').style.display = 'none';
    document.getElementById('ct-error').style.display   = 'block';
    document.getElementById('ct-error').textContent     = 'Failed: ' + err.message;
  }
  btn.disabled = false; btn.textContent = 'Calculate';
}

function renderCTKPICards(data) {
  const cards = document.getElementById('ct-kpi-cards');
  const compatible = Object.values(data.scenario_gaps).filter(s => s.compatible).map((_,i) => Object.keys(data.scenario_gaps)[i]);
  const sc_names = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const compat_list = Object.entries(data.scenario_gaps).filter(([,v]) => v.compatible).map(([k]) => sc_names[k] || k).join(', ') || 'None';

  cards.innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Target 2030</div>
      <div class="metric-value" style="color:#D85A30;">${data.target_2030_mt} Mt</div>
      <div class="metric-change neutral">−${data.reduction_pct_2030}% vs 1990</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Target 2050</div>
      <div class="metric-value" style="color:#B07C10;">${data.target_2050_mt} Mt</div>
      <div class="metric-change neutral">−${data.reduction_pct_2050}% vs 1990</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Neutrality year</div>
      <div class="metric-value" style="color:#1a2b4a;">${data.neutrality_year}</div>
      <div class="metric-change neutral">Zero emissions target</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">1.5C budget used</div>
      <div class="metric-value" style="color:${data.pct_budget_15c_used > 100 ? '#D85A30' : '#1D9E75'};">${data.pct_budget_15c_used}%</div>
      <div class="metric-change neutral">${data.budget_15c_exhausted_yr ? 'Exhausted ' + data.budget_15c_exhausted_yr : 'Within budget'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Required annual cut 2024–2030</div>
      <div class="metric-value" style="color:#534AB7;">${data.ann_reduction_rate_2030}%</div>
      <div class="metric-change neutral">per year vs 1990 baseline</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Compatible scenarios</div>
      <div class="metric-value" style="font-size:14px;color:#0F6E56;">${compat_list}</div>
      <div class="metric-change neutral">Meet target at all milestones</div>
    </div>
  `;
}

function renderCTTrajectoryChart(data) {
  destroyCTChart('ct-trajectory-chart');
  const traj   = data.custom_trajectory;
  const years  = traj.map(r => r.year);
  const custom = traj.map(r => r.co2_mt);

  const datasets = [
    { label: 'Custom target', data: custom, borderColor: '#D85A30', backgroundColor: '#D85A3020', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 0, borderDash: [6,3] },
  ];

  if (cbData && cbData.scenarios) {
    const sc_colors = { BAU: '#4a5568', MT: '#1D9E75', DD: '#534AB7' };
    const sc_names  = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
    Object.entries(cbData.scenarios).forEach(([sc, d]) => {
      const vals = d.ndc_compliance.map(r => r.co2_mt);
      const yrs  = d.ndc_compliance.map(r => r.year);
      const aligned = years.map(y => {
        const idx = yrs.indexOf(y);
        return idx >= 0 ? vals[idx] : null;
      });
      datasets.push({
        label: sc_names[sc], data: aligned,
        borderColor: sc_colors[sc], fill: false,
        tension: 0.3, borderWidth: 1.5, pointRadius: 0,
      });
    });
  }

  ctCharts['ct-trajectory-chart'] = new Chart(document.getElementById('ct-trajectory-chart'), {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        y: { ticks: { callback: v => v + ' Mt', font: { size: 10 } }, min: 0 },
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } }
      }
    }
  });
}

function renderCTBudgetChart(data) {
  destroyCTChart('ct-budget-chart');
  const traj = data.custom_trajectory;
  const milestones = [2030, 2035, 2040, 2045, 2050, 2055, 2060];
  const filtered = traj.filter(r => milestones.includes(r.year));

  ctCharts['ct-budget-chart'] = new Chart(document.getElementById('ct-budget-chart'), {
    type: 'bar',
    data: {
      labels: filtered.map(r => r.year),
      datasets: [
        { label: 'Cumulative CO2 (Mt)', data: filtered.map(r => r.cumulative_mt), backgroundColor: '#378ADD80', borderColor: '#378ADD', borderWidth: 1, borderRadius: 3 },
        { label: '1.5C budget limit', data: filtered.map(() => data.budget_15c_mt), type: 'line', borderColor: '#D85A30', borderDash: [5,3], borderWidth: 1.5, pointRadius: 0, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        y: { ticks: { callback: v => v + ' Mt', font: { size: 9 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderCTGapsTable(data) {
  const tbody = document.getElementById('ct-gaps-tbody');
  tbody.innerHTML = '';
  const sc_names = { BAU: 'Business as Usual', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const sc_colors = { BAU: '#4a5568', MT: '#1D9E75', DD: '#534AB7' };

  Object.entries(data.scenario_gaps).forEach(([sc, info]) => {
    const tr = document.createElement('tr');
    const compat = info.compatible
      ? '<span style="color:#1D9E75;font-weight:600;">✓ Compatible</span>'
      : '<span style="color:#D85A30;font-weight:600;">✗ Exceeds target</span>';

    const gapCell = (yr) => {
      const g = info.gaps[yr];
      if (!g) return '<td style="color:#888;">—</td>';
      const cls = g.gap_mt <= 0 ? 'color:#1D9E75' : 'color:#D85A30';
      return `<td style="${cls};font-weight:500;">${g.gap_mt > 0 ? '+' : ''}${g.gap_mt} Mt</td>`;
    };

    tr.innerHTML = `
      <td style="color:${sc_colors[sc]};font-weight:700;">${sc_names[sc]}</td>
      <td>${compat}</td>
      ${gapCell(2030)}${gapCell(2040)}${gapCell(2050)}${gapCell(2060)}
    `;
    tbody.appendChild(tr);
  });
}

async function explainCustomTarget() {
  const data = window._ctData;
  if (!data) return;
  const btn    = document.getElementById('ct-explain-btn');
  const output = document.getElementById('ct-ai-output');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  output.textContent = '';

  const sc_names = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const gapsSummary = Object.entries(data.scenario_gaps).map(([sc, info]) => {
    const g2030 = info.gaps[2030];
    const g2050 = info.gaps[2050];
    return `${sc_names[sc]}: compatible=${info.compatible}, gap 2030=${g2030 ? g2030.gap_mt + ' Mt' : '—'}, gap 2050=${g2050 ? g2050.gap_mt + ' Mt' : '—'}`;
  }).join('\n');

  const prompt = `You are a senior climate policy economist analyzing Kazakhstan's custom CO2 reduction target.

Custom target parameters:
- Neutrality year: ${data.neutrality_year}
- Reduction by 2030: ${data.reduction_pct_2030}% vs 1990 baseline (target: ${data.target_2030_mt} Mt)
- Reduction by 2050: ${data.reduction_pct_2050}% vs 1990 baseline (target: ${data.target_2050_mt} Mt)
- Required annual reduction rate 2024-2030: ${data.ann_reduction_rate_2030}%/yr
- Required annual reduction rate 2030-2050: ${data.ann_reduction_rate_2050}%/yr

Carbon budget impact:
- Cumulative emissions 2024-2060 under this path: ${data.cumulative_2024_2060_mt} Mt
- Kazakhstan 1.5C budget: ${data.budget_15c_mt} Mt — ${data.pct_budget_15c_used}% used
- 1.5C budget exhausted: ${data.budget_15c_exhausted_yr || 'Not exhausted'}
- 2C budget exhausted: ${data.budget_20c_exhausted_yr || 'Not exhausted'}

Scenario compatibility:
${gapsSummary}

Analyze — do not restate numbers, interpret them:

1. Feasibility: Is the required annual reduction rate of ${data.ann_reduction_rate_2030}%/yr achievable for Kazakhstan given its coal-heavy economy and current policy trajectory?

2. IPCC alignment: Does this path keep Kazakhstan within its fair share of the 1.5C carbon budget? What does the gap or surplus mean in practice?

3. Scenario match: Which of the three modeled scenarios (BAU, MT, DD) is most compatible with this target, and what additional policies would be needed to close any gaps?

4. Structural barriers: What are the top two structural barriers Kazakhstan would face in meeting this specific trajectory?

5. Recommendation: One concrete policy lever Kazakhstan should prioritize in the next three years to stay on this path.

Keep each point to 2-3 sentences. Plain text only, no markdown, number each point.`;

  try {
    const response = await fetch(`${BACKEND}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        system: 'You are an expert climate policy economist specializing in Kazakhstan. Plain text only, no markdown, number each point.',
        max_tokens: 1500,
        stream: true,
      }),
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
  btn.disabled = false; btn.textContent = 'Assess feasibility';
}
