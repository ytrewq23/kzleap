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
