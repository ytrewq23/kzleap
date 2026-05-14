// ── Show custom scenario results ──
function showCustomResults(data, params, type) {
  const labels = { MT: 'Moderate Transition', DD: 'Deep Decarbonization', BAU: 'BAU' };
  const colors = { MT: '#B07C10', DD: '#1D9E75', BAU: '#378ADD' };
  const color  = colors[type] || '#378ADD';

  showBackendBadge(true);

  // Update page subtitle
  const sub = document.querySelector('.topbar p');
  if (sub) sub.textContent = `Custom scenario: ${params.name} · 2024–2060`;

  const years  = data.years;
  const co2    = data.co2;
  const elec   = data.electricity;
  const re     = data.renewables_share;
  const coal   = data.coal_share;

  // KPI cards
  const idx2050 = years.indexOf(2050);
  const co2_2050 = co2[idx2050] || co2[co2.length-1];
  const co2_2030 = co2[years.indexOf(2030)] || co2[6];
  const ndc = 246.5;

  setCard('card-baseline', '242 Mt', 'Historical baseline 2023');
  setCard('card-bau', co2_2050 + ' Mt', `Your scenario 2050`);
  setCard('card-dd',  co2_2030 + ' Mt', `${co2_2030 <= ndc ? '✓ NDC met' : '✗ Above NDC'} in 2030`);
  setCard('card-avoided', Math.round(params.renewables_2050) + '%', 'RE share by 2050');

  // CO2 chart
  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(document.getElementById('co2Chart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        { label: params.name, data: co2, borderColor: color, backgroundColor: color + '15',
          tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 0 },
        { label: 'NDC −15% (246 Mt)', data: years.map(() => 246.5),
          type: 'line', borderColor: '#D85A30', borderWidth: 1.5,
          borderDash: [6,4], pointRadius: 0, fill: false },
        { label: 'NDC −25% (217 Mt)', data: years.map(() => 217.5),
          type: 'line', borderColor: '#993C1D', borderWidth: 1.5,
          borderDash: [6,4], pointRadius: 0, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: { size: 11 }, boxWidth: 14 } } },
      scales: {
        y: { ticks: { callback: v => v + ' Mt', font: { size: 11 } } },
        x: { ticks: { font: { size: 11 }, maxTicksLimit: 10 }, grid: { display: false } }
      }
    }
  });

  // Electricity chart
  if (energyChart) energyChart.destroy();
  energyChart = new Chart(document.getElementById('energyChart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [{ label: 'Electricity (TWh)', data: elec,
        borderColor: color, tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => v + ' TWh', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 6 }, grid: { display: false } }
      }
    }
  });

  // Fuel mix 2050 chart
  const i50 = idx2050 >= 0 ? idx2050 : coal.length - 1;
  const fuelData = [
    Math.round(coal[i50]),
    Math.round(data.gas_share[i50]),
    Math.round(data.hydro_share ? data.hydro_share[i50] : 10),
    Math.round(re[i50]),
    Math.round(data.nuclear_share ? data.nuclear_share[i50] : 0),
  ];

  if (fuelChart) fuelChart.destroy();
  fuelChart = new Chart(document.getElementById('fuelChart'), {
    type: 'bar',
    data: {
      labels: ['Coal', 'Gas', 'Hydro', 'Wind & Solar', 'Nuclear'],
      datasets: [{ label: '2050 mix', data: fuelData,
        backgroundColor: ['#4a4a6a','#378ADD','#5BB8F5','#1D9E75','#7F77DD'],
        borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });

  // Demographics charts if available
  if (data.population && data.population.length > 0) {
    renderCustomDemoCharts(data, years);
  }

  // Table
  buildTable('5', years, co2, co2, co2, { ndc_unconditional_2030: 246.5, ndc_conditional_2030: 217.5 });
}

function renderCustomDemoCharts(data, years) {
  const popEl = document.getElementById('demo-pop-chart');
  if (popEl) {
    new Chart(popEl, {
      type: 'line',
      data: { labels: years, datasets: [
        { label: 'Population', data: data.population, borderColor: '#1D9E75', borderWidth: 2, pointRadius: 0, fill: false }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => v + 'M', font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 } } }
      }
    });
  }
  const co2pcEl = document.getElementById('demo-co2pc-chart');
  if (co2pcEl && data.co2_per_capita) {
    new Chart(co2pcEl, {
      type: 'line',
      data: { labels: years, datasets: [
        { label: 'CO₂/capita', data: data.co2_per_capita, borderColor: '#D85A30', borderWidth: 2, pointRadius: 0, fill: false }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => v + ' t', font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 } } }
      }
    });
  }
}

// KZLEAP — Results Page
// Fetches real data from Python backend (http://localhost:8000)
// Falls back to built-in model if backend is offline

const BACKEND = 'http://localhost:8000';

// ── User / role setup ──
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

const access = {
  analyst:     ['nav-upload', 'nav-scenario', 'nav-simulation'],
  researcher:  ['nav-upload', 'nav-scenario'],
  policymaker: [],
};
['nav-upload', 'nav-scenario', 'nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  if (el && !access[user.role].includes(id)) el.classList.add('locked');
});

// ── Chart instances (kept for later destroy on re-render) ──
let co2Chart, energyChart, fuelChart;

// ── Fallback data (if backend offline) ──
function getFallbackData() {
  const years = [];
  for (let y = 2021; y <= 2060; y++) years.push(y);

  const bau = years.map(y => {
    if (y <= 2023) return [2021,245,2022,240,2023,242].includes(y) ? {2021:245,2022:240,2023:242}[y] : 242;
    return Math.round(242 * Math.pow(1.018, y - 2023));
  });
  const mt = years.map(y => {
    if (y <= 2023) return {2021:245,2022:240,2023:242}[y] || 242;
    const t = y - 2023;
    return Math.round(242 * Math.pow(1.005, t) * Math.pow(0.982, t));
  });
  const dd = years.map(y => {
    if (y <= 2023) return {2021:245,2022:240,2023:242}[y] || 242;
    const t = y - 2023;
    return Math.round(Math.max(242 * Math.pow(0.958, t), 5));
  });

  return {
    BAU: { years, co2: bau, electricity: years.map(y => Math.round(115 * Math.pow(1.018, y-2023))),
           coal_share: years.map(y => Math.max(61 - (y-2023)*0.3, 45)),
           renewables_share: years.map(y => Math.min(5 + (y-2023)*0.3, 15)) },
    MT:  { years, co2: mt,  electricity: years.map(y => Math.round(115 * Math.pow(1.012, y-2023))),
           coal_share: years.map(y => Math.max(61 - (y-2023)*1.4, 25)),
           renewables_share: years.map(y => Math.min(5 + (y-2023)*1.4, 40)) },
    DD:  { years, co2: dd,  electricity: years.map(y => Math.round(115 * Math.pow(1.008, y-2023))),
           coal_share: years.map(y => Math.max(61 - (y-2023)*2.3, 5)),
           renewables_share: years.map(y => Math.min(5 + (y-2023)*2.8, 70)) },
    _targets: { ndc_unconditional_2030: 246.5, ndc_conditional_2030: 217.5, neutrality_2060: 0 },
  };
}

// ── Fetch from backend ──
async function loadData() {
  showLoading(true);
  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (!res.ok) throw new Error('Backend error');
    const data = await res.json();
    showLoading(false);
    showBackendBadge(true);
    return data;
  } catch {
    showLoading(false);
    showBackendBadge(false);
    return getFallbackData();
  }
}

function showLoading(on) {
  const el = document.getElementById('loading-msg');
  if (el) el.style.display = on ? 'block' : 'none';
}

function showBackendBadge(connected) {
  const el = document.getElementById('backend-badge');
  if (!el) return;
  el.textContent = connected ? '● Backend connected' : '● Offline mode';
  el.style.color  = connected ? '#0F6E56' : '#B07C10';
}

// ── Render everything ──
async function init() {
  // Check if we have custom scenario results from Scenario Builder
  const urlParams = new URLSearchParams(window.location.search);
  const scenarioType = urlParams.get('scenario');
  const customResults = JSON.parse(sessionStorage.getItem('kzleap_custom_results') || '{}');

  if (scenarioType && customResults[scenarioType]) {
    // Show custom scenario results
    const custom = customResults[scenarioType];
    showCustomResults(custom.results, custom.params, scenarioType);
    return;
  }

  // Default: show all 3 scenarios comparison
  const data = await loadData();

  const BAU = data.BAU;
  const MT  = data.MT;
  const DD  = data.DD;
  const targets = data._targets;

  const years     = BAU.years;
  const bauCO2    = BAU.co2;
  const mtCO2     = MT.co2;
  const ddCO2     = DD.co2;

  // ── Update metric cards ──
  const bau2050 = bauCO2[years.indexOf(2050)] || bauCO2[bauCO2.length - 1];
  const mt2050  = mtCO2[years.indexOf(2050)]  || mtCO2[mtCO2.length - 1];
  const dd2050  = ddCO2[years.indexOf(2050)]  || ddCO2[ddCO2.length - 1];
  const avoided = Math.round(bau2050 - dd2050);

  setCard('card-baseline', '242 Mt', 'Historical baseline 2023');
  setCard('card-bau',      bau2050 + ' Mt', `▲ +${Math.round((bau2050-242)/242*100)}% vs baseline`);
  setCard('card-dd',       dd2050  + ' Mt', `▼ −${Math.round((bau2050-dd2050)/bau2050*100)}% vs BAU`);
  setCard('card-avoided',  avoided + ' Mt', 'Per year vs BAU by 2050');

  // ── NDC reference lines (horizontal) ──
  const ndcLine = (value, label, color) => ({
    type: 'line',
    label,
    data: years.map(() => value),
    borderColor: color,
    borderWidth: 1.5,
    borderDash: [6, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  });

  // ── CO₂ chart ──
  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(document.getElementById('co2Chart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'BAU',
          data: bauCO2,
          borderColor: '#378ADD',
          backgroundColor: 'rgba(55,138,221,0.07)',
          tension: 0.3, fill: true, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Moderate Transition',
          data: mtCO2,
          borderColor: '#B07C10',
          backgroundColor: 'rgba(176,124,16,0.07)',
          tension: 0.3, fill: true, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Deep Decarbonization',
          data: ddCO2,
          borderColor: '#1D9E75',
          backgroundColor: 'rgba(29,158,117,0.07)',
          tension: 0.3, fill: true, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 4,
        },
        ndcLine(targets.ndc_unconditional_2030, 'NDC −15% (2030)', '#D85A30'),
        ndcLine(targets.ndc_conditional_2030,   'NDC −25% (2030)', '#993C1D'),
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' Mt CO₂' } }
      },
      scales: {
        y: { ticks: { callback: v => v + ' Mt', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } }
      }
    }
  });

  // ── Energy demand chart ──
  if (energyChart) energyChart.destroy();
  energyChart = new Chart(document.getElementById('energyChart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        { label: 'BAU', data: BAU.electricity,
          borderColor: '#378ADD', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'MT',  data: MT.electricity,
          borderColor: '#B07C10', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'DD',  data: DD.electricity,
          borderColor: '#1D9E75', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        y: { ticks: { callback: v => v + ' TWh', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 6 }, grid: { display: false } }
      }
    }
  });

  // ── Fuel mix 2050 chart ──
  const idx2050 = years.indexOf(2050);
  const fuelLabels = ['Coal', 'Gas', 'Hydro', 'Wind & Solar', 'Nuclear'];

  function fuelMix2050(scenario) {
    const i = idx2050 >= 0 ? idx2050 : scenario.coal_share.length - 1;
    const coal = scenario.coal_share[i] || 0;
    const re   = scenario.renewables_share[i] || 0;
    const nuc  = scenario.nuclear_share ? (scenario.nuclear_share[i] || 0) : 0;
    const hydro = scenario.hydro_share ? (scenario.hydro_share[i] || 0) : 10;
    const gas  = Math.max(100 - coal - re - nuc - hydro, 0);
    return [Math.round(coal), Math.round(gas), Math.round(hydro), Math.round(re), Math.round(nuc)];
  }

  if (fuelChart) fuelChart.destroy();
  fuelChart = new Chart(document.getElementById('fuelChart'), {
    type: 'bar',
    data: {
      labels: fuelLabels,
      datasets: [
        { label: 'BAU 2050',  data: fuelMix2050(BAU), backgroundColor: '#378ADD' },
        { label: 'MT 2050',   data: fuelMix2050(MT),  backgroundColor: '#B07C10' },
        { label: 'DD 2050',   data: fuelMix2050(DD),  backgroundColor: '#1D9E75' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });

  // ── Table ──
  buildTable('5', years, bauCO2, mtCO2, ddCO2, targets);
}

function setCard(id, value, sub) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = el.querySelector('.metric-value');
  const s = el.querySelector('.metric-change');
  if (v) v.textContent = value;
  if (s) s.textContent = sub;
}

// ── Results table ──
let _tableData = null;

function buildTable(filter, years, bauCO2, mtCO2, ddCO2, targets) {
  if (years) _tableData = { years, bauCO2, mtCO2, ddCO2, targets };
  else if (_tableData) ({ years, bauCO2, mtCO2, ddCO2, targets } = _tableData);
  else return;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  const milestones = [2025, 2030, 2035, 2040, 2045, 2050, 2060];

  years.forEach((y, i) => {
    if (filter === '5' && !milestones.includes(y) && y !== 2021 && y !== 2023) return;
    const bau = bauCO2[i], mt = mtCO2[i], dd = ddCO2[i];
    const diffMT = Math.round(bau - mt);
    const diffDD = Math.round(bau - dd);
    const pctDD  = Math.round((bau - dd) / bau * 100);

    const tr = document.createElement('tr');
    if (milestones.includes(y)) tr.classList.add('milestone');

    // NDC flag for 2030
    let ndcFlag = '';
    if (y === 2030) {
      const t = targets || {};
      ndcFlag = dd <= (t.ndc_conditional_2030 || 217)
        ? ' <span style="color:#0F6E56;font-size:10px;">✓ NDC −25%</span>'
        : dd <= (t.ndc_unconditional_2030 || 246)
          ? ' <span style="color:#B07C10;font-size:10px;">~ NDC −15%</span>'
          : ' <span style="color:#D85A30;font-size:10px;">✗ above NDC</span>';
    }

    tr.innerHTML = `
      <td><strong>${y}</strong>${ndcFlag}</td>
      <td class="bau-val">${Math.round(bau)} Mt</td>
      <td style="color:#B07C10;font-weight:500;">${Math.round(mt)} Mt</td>
      <td class="lc-val">${Math.round(dd)} Mt</td>
      <td class="diff-val">−${diffDD} Mt</td>
      <td class="pct-val">−${pctDD}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTable(mode) {
  if (_tableData) buildTable(mode);
}

// ── Start ──
init();

// ── LP Optimization ──

const TECH_COLORS = {
  coal:    '#4a4a6a',
  gas:     '#378ADD',
  hydro:   '#5BB8F5',
  wind:    '#1D9E75',
  solar:   '#F5A623',
  nuclear: '#7F77DD',
};

const TECH_LABELS = {
  coal: 'Coal', gas: 'Natural Gas', hydro: 'Hydro',
  wind: 'Wind', solar: 'Solar PV', nuclear: 'Nuclear',
};

let lpChart = null;

async function runLP() {
  const scenario = document.getElementById('lp-scenario').value;
  const year     = document.getElementById('lp-year').value;
  const btn      = document.getElementById('lp-run-btn');

  // Show spinner overlay, keep results visible (no resize)
  document.getElementById('lp-spinner').style.display = 'flex';
  document.getElementById('lp-error').style.display   = 'none';
  btn.disabled    = true;
  btn.textContent = '⏳ Running...';

  try {
    const res = await fetch(`${BACKEND}/api/optimize/quick/${scenario}/${year}`);
    if (!res.ok) throw new Error('Backend returned ' + res.status);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    document.getElementById('lp-spinner').style.display = 'none';
    document.getElementById('lp-results').style.display = 'block';
    btn.disabled    = false;
    btn.textContent = '▶ Run LP';

    // Summary cards
    document.getElementById('lp-gen').textContent  = data.total_gen_twh + ' TWh';
    document.getElementById('lp-cost').textContent = data.total_cost_bn_usd + ' B$';
    document.getElementById('lp-co2').textContent  = data.total_co2_mt + ' Mt';
    document.getElementById('lp-re').textContent   = data.re_share_pct + '%';

    // Table
    const tbody = document.getElementById('lp-tbody');
    tbody.innerHTML = '';
    const mix = data.mix;

    Object.entries(mix).forEach(([tech, v]) => {
      if (v.generation_twh === 0 && v.new_capacity_gw === 0) return;
      const tr = document.createElement('tr');
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TECH_COLORS[tech]};margin-right:6px;"></span>`;
      tr.innerHTML = `
        <td>${dot}${TECH_LABELS[tech]}</td>
        <td>${v.generation_twh.toFixed(1)}</td>
        <td>${v.share_pct.toFixed(1)}%</td>
        <td>${v.new_capacity_gw > 0 ? '+' + v.new_capacity_gw.toFixed(2) : '—'}</td>
        <td>${v.co2_mt > 0 ? v.co2_mt.toFixed(2) : '0'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Bar chart
    const techs  = Object.keys(mix).filter(t => mix[t].generation_twh > 0);
    const values = techs.map(t => mix[t].generation_twh);
    const colors = techs.map(t => TECH_COLORS[t]);
    const labels = techs.map(t => TECH_LABELS[t]);

    // Fix Y axis to total demand — same scale across all scenarios/years
    const yMax = Math.ceil(data.demand_twh * 1.15 / 50) * 50;

    if (lpChart) lpChart.destroy();
    lpChart = new Chart(document.getElementById('lpChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Optimal mix ${scenario} ${year} (TWh)`,
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' TWh' } }
        },
        scales: {
          y: { min: 0, max: yMax, ticks: { callback: v => v + ' TWh', font: { size: 10 } } },
          x: { ticks: { font: { size: 11 } }, grid: { display: false } }
        }
      }
    });

  } catch (err) {
    document.getElementById('lp-spinner').style.display = 'none';
    document.getElementById('lp-error').style.display   = 'block';
    document.getElementById('lp-error').textContent     = '✗ LP failed: ' + err.message + '. Make sure backend is running at localhost:8000.';
    btn.disabled    = false;
    btn.textContent = '▶ Run LP';
  }
}



// ── LP Modal controls ──
function openLP() {
  const modal = document.getElementById('lp-modal');
  modal.style.display = 'flex';
}

function closeLP() {
  document.getElementById('lp-modal').style.display = 'none';
}

document.getElementById('lp-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeLP();
});

async function loadDemographics() {
  try {
    const res = await fetch(`${BACKEND}/api/compare/demographics`);
    if (!res.ok) return;
    const data = await res.json();
    renderDemoCharts(data);
  } catch {}
}

let popChart, co2pcChart, sectorDemoChart;

function renderDemoCharts(data) {
  const BAU = data.BAU, MT = data.MT, DD = data.DD;
  const years = BAU.years;

  const popEl = document.getElementById('demo-pop-chart');
  if (popEl) {
    if (popChart) popChart.destroy();
    popChart = new Chart(popEl, {
      type: 'line',
      data: { labels: years, datasets: [
        { label: 'BAU', data: BAU.population, borderColor: '#378ADD', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'MT',  data: MT.population,  borderColor: '#B07C10', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'DD',  data: DD.population,  borderColor: '#1D9E75', borderWidth: 2, pointRadius: 0, fill: false },
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: { y: { ticks: { callback: v => v + 'M', font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } } }
      }
    });
  }

  const co2pcEl = document.getElementById('demo-co2pc-chart');
  if (co2pcEl) {
    if (co2pcChart) co2pcChart.destroy();
    co2pcChart = new Chart(co2pcEl, {
      type: 'line',
      data: { labels: years, datasets: [
        { label: 'BAU', data: BAU.co2_per_capita, borderColor: '#378ADD', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'MT',  data: MT.co2_per_capita,  borderColor: '#B07C10', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'DD',  data: DD.co2_per_capita,  borderColor: '#1D9E75', borderWidth: 2, pointRadius: 0, fill: false },
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: { y: { ticks: { callback: v => v + ' t/person', font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } } }
      }
    });
  }

  const secEl = document.getElementById('demo-sector-chart');
  if (secEl) {
    if (sectorDemoChart) sectorDemoChart.destroy();
    sectorDemoChart = new Chart(secEl, {
      type: 'line',
      data: { labels: years, datasets: [
        { label: 'Residential (TWh)', data: BAU.residential_demand, borderColor: '#F5A623', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'Industry (TWh)',    data: BAU.industry_demand,    borderColor: '#4a4a6a', borderWidth: 2, pointRadius: 0, fill: false },
        { label: 'Transport (PJ)',    data: BAU.transport_demand,   borderColor: '#1D9E75', borderWidth: 2, pointRadius: 0, fill: false },
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: { y: { ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } } }
      }
    });
  }
}

window.addEventListener('load', () => setTimeout(loadDemographics, 1200));
