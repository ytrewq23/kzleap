const BACKEND = 'http://localhost:8000';

let CFG = { base_co2: 242, base_elec: 115, base_tpes: 85, base_year: 2023, ndc_unconditional: 246.5, ndc_conditional: 217.5 };
async function loadConfig() {
  try { const r = await fetch(`${BACKEND}/api/config`); if (r.ok) CFG = await r.json(); } catch {}
}

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
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

['nav-upload', 'nav-scenario', 'nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  const access = { analyst: true, researcher: true, policymaker: false };
  if (el && !access[user.role]) el.classList.add('locked');
});

async function loadDashboard() {
  await loadConfig();
  let co2Data = null, wbData = null;

  try {
    const dsRes = await fetch(`${BACKEND}/api/datasets`);
    if (dsRes.ok) {
      const datasets = await dsRes.json();

      const owidKey = Object.keys(datasets).find(k => datasets[k].source === 'owid');
      if (owidKey) {
        const co2Res = await fetch(`${BACKEND}/api/datasets/${encodeURIComponent(owidKey)}/co2`);
        if (co2Res.ok) co2Data = await co2Res.json();
      }

      const wbKey = Object.keys(datasets).find(k => datasets[k].source === 'worldbank');
      if (wbKey) {
        const wbRes = await fetch(`${BACKEND}/api/datasets/${encodeURIComponent(wbKey)}/co2`);
        if (wbRes.ok) wbData = await wbRes.json();
      }
    }
  } catch {}

  let hist = null;
  try {
    const res = await fetch(`${BACKEND}/api/historical`);
    if (res.ok) hist = await res.json();
  } catch {}

  renderAll(co2Data, wbData, hist);
}

function renderAll(co2Data, wbData, hist) {
  let co2Years, co2Values;

  if (co2Data && co2Data.years && co2Data.years.length > 0) {
    co2Years  = co2Data.years;
    co2Values = co2Data.values;
    showDataBadge('co2-source', 'Our World in Data (uploaded)');
  } else if (hist) {
    const pairs = hist.years.map((y,i) => [y, hist.co2[i]]).filter(p => p[1] != null);
    co2Years  = pairs.map(p => p[0]);
    co2Values = pairs.map(p => p[1]);
    showDataBadge('co2-source', 'Built-in data (IEA)');
  } else {
    co2Years  = [1990,2000,2010,2015,2020,2023];
    co2Values = [290, 140, 230, 250, 235, 242];
  }

  let gdpYears = [], gdpValues = [];
  if (wbData && wbData.indicators) {
    const gdpInd = wbData.indicators.find(i => i.code === 'NY.GDP.MKTP.CD');
    if (gdpInd) {
      const pairs = Object.entries(gdpInd.data)
        .map(([y,v]) => [+y, v/1e9])
        .filter(p => p[0] >= 1990)
        .sort((a,b) => a[0]-b[0]);
      gdpYears  = pairs.map(p => p[0]);
      gdpValues = pairs.map(p => Math.round(p[1]*10)/10);
    }
  }

  let reYears = [], reValues = [];
  if (wbData && wbData.indicators) {
    const reInd = wbData.indicators.find(i => i.code === 'EG.ELC.RNEW.ZS');
    if (reInd) {
      const pairs = Object.entries(reInd.data)
        .map(([y,v]) => [+y, v])
        .filter(p => p[0] >= 1990)
        .sort((a,b) => a[0]-b[0]);
      reYears  = pairs.map(p => p[0]);
      reValues = pairs.map(p => Math.round(p[1]*10)/10);
    }
  }

  const lastCO2 = co2Values[co2Values.length - 1] || CFG.base_co2;
  const ndcTarget = CFG.ndc_unconditional;
  const ndcGap = Math.round(lastCO2 - ndcTarget);
  const lastYear = co2Years[co2Years.length - 1] || CFG.base_year;

  setKPI('kpi-co2',  Math.round(lastCO2) + ' Mt',
    `CO₂ ${lastYear} · Source: ${co2Data ? 'Our World in Data' : 'IEA'}`);
  setKPI('kpi-elec', CFG.base_elec + ' TWh', `Electricity ${CFG.base_year} · KEGOC`);
  setKPI('kpi-tpes', CFG.base_tpes + ' Mtoe', `Total primary energy ${CFG.base_year} · IEA`);
  setKPI('kpi-ndc',
    (ndcGap > 0 ? '+' : '') + ndcGap + ' Mt',
    ndcGap > 0 ? 'Above NDC 2030 target (−15% vs 1990)' : '✓ Below NDC target');

  renderNDCGauges(CFG, hist);

  const ndc = CFG.ndc_unconditional;
  const colors = co2Values.map(v => v > ndc ? '#D85A30' : '#1D9E75');

  renderChart('sectorChart', {
    type: 'bar',
    data: {
      labels: co2Years,
      datasets: [
        {
          label: 'CO₂ emissions (Mt)',
          data: co2Values,
          backgroundColor: colors,
          borderRadius: 3,
        },
        {
          label: 'NDC −15% target (246 Mt)',
          data: co2Years.map(() => ndc),
          type: 'line',
          borderColor: '#B07C10',
          borderWidth: 1.5,
          borderDash: [5,4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' Mt CO₂' } }
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { min: 0, ticks: { callback: v => v + ' Mt', font: { size: 10 } } }
      }
    }
  });

  const mix = hist?.elec_mix_2023 || { coal:61, gas:24, hydro:10, wind:3.5, solar:1.5 };
  renderChart('pieChart', {
    type: 'doughnut',
    data: {
      labels: ['Coal', 'Gas', 'Hydro', 'Wind', 'Solar'],
      datasets: [{ data: [mix.coal, mix.gas, mix.hydro, mix.wind, mix.solar],
        backgroundColor: ['#4a4a6a','#378ADD','#5BB8F5','#1D9E75','#F5A623'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + '%' } }
      }
    }
  });

  // ── Electricity generation — из hist (всегда из /api/historical, данные Excel или встроенные)
  if (hist && hist.electricity) {
    const elecPairs = hist.years
      .map((y, i) => [y, hist.electricity[i]])
      .filter(p => p[1] != null);
    const elecYears  = elecPairs.map(p => p[0]);
    const elecValues = elecPairs.map(p => p[1]);

    renderChart('ironChart', {
      type: 'line',
      data: {
        labels: elecYears,
        datasets: [{
          label: 'Electricity generation (TWh)',
          data: elecValues,
          borderColor: '#378ADD',
          backgroundColor: 'rgba(55,138,221,0.08)',
          tension: 0.35, borderWidth: 2.5, fill: true, pointRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' TWh' } }
        },
        scales: {
          y: { ticks: { callback: v => v + ' TWh', font: { size: 10 } } },
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
        }
      }
    });

    const source = hist.source === 'excel' ? 'Excel (загружен)' : 'IEA / KEGOC';
    const titleEl = document.querySelector('#ironChart')?.closest('.card')?.querySelector('.card-title');
    if (titleEl) titleEl.textContent = `Electricity generation ${Math.min(...elecYears)}–${Math.max(...elecYears)}`;
    const subEl = document.querySelector('#ironChart')?.closest('.card')?.querySelector('.card-sub');
    if (subEl) subEl.textContent = `Kazakhstan · TWh · Source: ${source}`;
  }

  // ── GDP — рисуем отдельно если есть World Bank данные
  if (gdpYears.length > 0) {
    renderChart('gdpChart', {
      type: 'line',
      data: {
        labels: gdpYears,
        datasets: [{
          label: 'GDP (Billion USD)',
          data: gdpValues,
          borderColor: '#7F77DD',
          backgroundColor: 'rgba(127,119,221,0.08)',
          tension: 0.35, borderWidth: 2.5, fill: true, pointRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => '$' + ctx.parsed.y + 'B' } }
        },
        scales: {
          y: { ticks: { callback: v => '$' + v + 'B', font: { size: 10 } } },
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
        }
      }
    });
    document.getElementById('gdpChartCard')?.style && (document.getElementById('gdpChartCard').style.display = '');
    const titleEl2 = document.querySelector('#gdpChart')?.closest('.card')?.querySelector('.card-title');
    if (titleEl2) titleEl2.textContent = 'GDP 1990–present (World Bank)';
    const subEl2 = document.querySelector('#gdpChart')?.closest('.card')?.querySelector('.card-sub');
    if (subEl2) subEl2.textContent = 'Kazakhstan · Billion USD · Source: World Bank WDI (uploaded)';
  }
}

function renderChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  new Chart(el, config);
}

function setKPI(id, value, sub) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = el.querySelector('.metric-value');
  const s = el.querySelector('.metric-change');
  if (v) v.textContent = value;
  if (s) s.textContent = sub;
}

function showDataBadge(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

loadDashboard();
function confirmDelete() {
  const modal = document.getElementById('delete-modal');
  modal.style.display = 'flex';
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

  if (!password) {
    error.textContent = 'Please enter your password.';
    error.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/delete-account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.detail || 'Failed to delete account.';
      error.style.display = 'block';
      return;
    }

    sessionStorage.clear();
    window.location.href = 'index.html';

  } catch {
    error.textContent = 'Cannot connect to server.';
    error.style.display = 'block';
  }
}

/* ── NDC Gauge Renderer ─────────────────────────────── */
function drawGauge(canvasId, pctId, statusId, value, maxVal, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 180, H = 100;
  canvas.width = W; canvas.height = H;

  const cx = W / 2, cy = H - 8;
  const r = 78, strokeW = 14;
  const startA = Math.PI, endA = 2 * Math.PI;

  // clamp 0–1
  const ratio = Math.min(Math.max(value / maxVal, 0), 1);

  // color by ratio
  let color;
  if (opts.inverse) {
    // lower is better (CO₂ gap, budget used)
    color = ratio < 0.4 ? '#1D9E75' : ratio < 0.75 ? '#EF9F27' : '#D85A30';
  } else {
    // higher is better (RE share, reduction achieved)
    color = ratio > 0.7 ? '#1D9E75' : ratio > 0.35 ? '#EF9F27' : '#D85A30';
  }

  // Track (grey arc)
  ctx.beginPath();
  ctx.arc(cx, cy, r, startA, endA);
  ctx.lineWidth = strokeW;
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Value arc
  if (ratio > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, startA + ratio * Math.PI);
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Tick marks
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    const x1 = cx + (r - strokeW / 2 - 3) * Math.cos(a);
    const y1 = cy + (r - strokeW / 2 - 3) * Math.sin(a);
    const x2 = cx + (r + strokeW / 2 + 3) * Math.cos(a);
    const y2 = cy + (r + strokeW / 2 + 3) * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Update text
  const pctEl = document.getElementById(pctId);
  if (pctEl) {
    pctEl.textContent = opts.displayVal;
    pctEl.style.color = color;
  }

  // Status badge
  const statusEl = document.getElementById(statusId);
  if (statusEl) {
    statusEl.textContent = opts.statusText;
    statusEl.className = 'gauge-status ' + opts.statusClass;
  }
}

function renderNDCGauges(cfg, hist) {
  const co2Base1990 = 290; // Mt — 1990 baseline
  const currentCO2 = cfg?.base_co2 || 242;
  const ndcUnc = cfg?.ndc_unconditional || 246.5;   // −15% = 246.5 Mt
  const ndcCond = cfg?.ndc_conditional  || 217.5;   // −25% = 217.5 Mt
  const reTarget2030 = 15;  // % renewables NDC target
  const currentRE = hist?.elec_mix_2023
    ? (hist.elec_mix_2023.wind + hist.elec_mix_2023.solar + hist.elec_mix_2023.hydro)
    : 15.0; // wind 3.5 + solar 1.5 + hydro 10

  // KZ carbon budget 1.5°C: 0.6% of ~300 Gt global remaining = ~1.8 Gt = 1800 Mt
  // Cumulative since 2020 approx: 242*4 = ~968 Mt used
  const kzBudget15 = 1800;
  const usedSince2020 = 242 * 4; // rough approx

  // 1. CO₂ reduction achieved vs 1990
  const reductionAchieved = ((co2Base1990 - currentCO2) / co2Base1990) * 100; // ~16.5%
  const reductionTarget = 15;
  drawGauge('gaugeCanvas0', 'gauge-pct-0', 'gauge-status-0',
    reductionAchieved, reductionTarget * 1.5,
    {
      inverse: false,
      displayVal: reductionAchieved.toFixed(1) + '%',
      statusText: reductionAchieved >= reductionTarget ? '✓ NDC Target Met' : `${(reductionTarget - reductionAchieved).toFixed(1)}% still needed`,
      statusClass: reductionAchieved >= reductionTarget ? 'green' : reductionAchieved > 10 ? 'amber' : 'red',
    }
  );

  // 2. Renewables share
  drawGauge('gaugeCanvas1', 'gauge-pct-1', 'gauge-status-1',
    currentRE, reTarget2030,
    {
      inverse: false,
      displayVal: currentRE.toFixed(1) + '%',
      statusText: currentRE >= reTarget2030 ? '✓ On Track' : `${(reTarget2030 - currentRE).toFixed(1)}% to go`,
      statusClass: currentRE >= reTarget2030 ? 'green' : currentRE > 8 ? 'amber' : 'red',
    }
  );

  // 3. Unconditional NDC gap
  const ndcGap = Math.max(currentCO2 - ndcUnc, 0);
  const ndcGapMax = 60; // Mt scale
  drawGauge('gaugeCanvas2', 'gauge-pct-2', 'gauge-status-2',
    ndcGap, ndcGapMax,
    {
      inverse: true,
      displayVal: ndcGap > 0 ? '+' + Math.round(ndcGap) + ' Mt' : '✓',
      statusText: ndcGap <= 0 ? '✓ Below Target' : ndcGap < 20 ? 'Close to target' : 'Action needed',
      statusClass: ndcGap <= 0 ? 'green' : ndcGap < 20 ? 'amber' : 'red',
    }
  );

  // 4. Carbon budget 1.5°C used
  const budgetRatio = (usedSince2020 / kzBudget15) * 100;
  drawGauge('gaugeCanvas3', 'gauge-pct-3', 'gauge-status-3',
    budgetRatio, 100,
    {
      inverse: true,
      displayVal: budgetRatio.toFixed(0) + '%',
      statusText: budgetRatio < 40 ? 'Budget Safe' : budgetRatio < 70 ? 'Budget Shrinking' : 'Critical',
      statusClass: budgetRatio < 40 ? 'green' : budgetRatio < 70 ? 'amber' : 'red',
    }
  );
}

/* ── News Feed ─────────────────────────────────────────────── */
const NEWS = [
  {
    date: 'Mar 17, 2026',
    tag: 'Capacity',
    tag_color: '#1D9E75',
    title: 'Kazakhstan Renewable Capacity to Hit 12.9 GW by 2035',
    text: 'Installed renewable capacity expected to surge from 3.5 GW in 2025 to 12.9 GW by 2035. Onshore wind projected to rise from 1.9 GW to 8.7 GW, solar PV from 1.3 GW to 3.7 GW.',
    source: 'GlobalData / GreentechLead',
    url: 'https://greentechlead.com/renewable-energy/kazakhstan-renewable-energy-capacity-to-hit-12-9-gw-by-2035-as-wind-and-solar-investments-accelerate-52652',
    relevance: 'Directly supports DD scenario projections in KZLEAP model',
  },
  {
    date: 'Oct 23, 2025',
    tag: 'Policy',
    tag_color: '#378ADD',
    title: 'Kazakhstan Targets 50% Renewables by 2050 — London Forum',
    text: 'Deputy Minister Zharkeshov announced Kazakhstan aims for 50% RE share by 2050. Country now operates 158 RE facilities with 3+ GW combined capacity, planning 8.4 GW more by 2035.',
    source: 'Times of Central Asia',
    url: 'https://timesca.com/kazakhstan-unveils-green-energy-transition-strategy-at-london-forum/',
    relevance: 'Validates MT and DD scenario RE targets in KZLEAP',
  },
  {
    date: 'Sep 19, 2025',
    tag: 'Analysis',
    tag_color: '#EF9F27',
    title: 'Why Kazakhstan\'s Energy Transition Is Stalling Despite Bold Pledges',
    text: 'Policy framework established but progress remains limited. RE share reached only 7% by end of 2024 vs 10% target for 2030. Gap between pledges and implementation highlighted.',
    source: 'The Diplomat',
    url: 'https://thediplomat.com/2025/09/why-kazakhstans-energy-transition-is-stalling-despite-bold-pledges/',
    relevance: 'Supports BAU scenario risk — current trajectory below NDC target',
  },
  {
    date: 'Apr 17, 2025',
    tag: 'Projects',
    tag_color: '#1D9E75',
    title: '9 New Renewable Projects Commissioned in 2025 — 503 MW Total',
    text: '5 wind farms (387 MW), 3 solar plants (90 MW), 1 hydro plant (26 MW) across Karaganda, Aktobe, Kyzylorda and other regions. RE share reached 7% of total generation.',
    source: 'QazaqGreen / Astana Times',
    url: 'https://astanatimes.com/2025/04/kazakhstan-accelerates-renewable-energy-transition-with-nine-projects/',
    relevance: 'Confirms wind and solar CAPEX assumptions used in LP Optimizer',
  },
  {
    date: 'Jan 2026',
    tag: 'Investment',
    tag_color: '#9F77DD',
    title: 'International Investors Scale Up: TotalEnergies, Masdar, China Power',
    text: 'By December 2025, around 4 GW allocated to international strategic investors. Competitive auctions attracting foreign capital as Kazakhstan positions as Central Asia\'s top clean energy market.',
    source: 'QazaqGreen',
    url: 'https://qazaqgreen.com/en/news/kazakhstan/3275/',
    relevance: 'Supports lower WACC assumptions in Investment Calculator scenarios',
  },
];

function renderNewsFeed() {
  const el = document.getElementById('news-feed');
  if (!el) return;
  el.innerHTML = NEWS.map((n, i) => `
    <div style="
      padding:14px 0;
      border-bottom:${i < NEWS.length-1 ? '1px solid #f0f4f8' : 'none'};
      display:flex; gap:14px; align-items:flex-start;
    ">
      <div style="flex-shrink:0; padding-top:2px;">
        <div style="
          width:8px; height:8px; border-radius:50%;
          background:${n.tag_color}; margin-top:5px;
        "></div>
      </div>
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap;">
          <span style="
            font-size:10px; font-weight:700; padding:2px 8px;
            border-radius:10px; background:${n.tag_color}18; color:${n.tag_color};
            text-transform:uppercase; letter-spacing:.05em;
          ">${n.tag}</span>
          <span style="font-size:11px; color:#8a94a0;">${n.date}</span>
          <span style="font-size:11px; color:#b0b8c4;">· ${n.source}</span>
        </div>
        <div style="font-size:13px; font-weight:600; color:#1a2332; margin-bottom:4px; line-height:1.4;">
          <a href="${n.url}" target="_blank" style="color:#1a2332; text-decoration:none;"
            onmouseover="this.style.color='#1D9E75'" onmouseout="this.style.color='#1a2332'">
            ${n.title} ↗
          </a>
        </div>
        <div style="font-size:12px; color:#6b7a8d; line-height:1.55; margin-bottom:6px;">
          ${n.text}
        </div>
        <div style="
          font-size:11px; color:#1D9E75; background:#e1f5ee;
          padding:3px 10px; border-radius:6px; display:inline-block;
        ">
          🔗 KZLEAP: ${n.relevance}
        </div>
      </div>
    </div>
  `).join('');
}

renderNewsFeed();
