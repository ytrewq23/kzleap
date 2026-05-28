function showCustomResults(data, params, type) {
  const labels = { MT: 'Moderate Transition', DD: 'Deep Decarbonization', BAU: 'BAU' };
  const colors = { MT: '#B07C10', DD: '#1D9E75', BAU: '#378ADD' };
  const color  = colors[type] || '#378ADD';

  showBackendBadge(true);

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

  const baseline = CFG.base_co2 || 242;
  const reduction = Math.round((baseline - co2_2050) / baseline * 100);
  const ndc30met  = co2_2030 <= ndc;

  const lbl = (id, text) => { const el = document.querySelector(`#${id} .metric-label`); if (el) el.textContent = text; };
  lbl('card-baseline', 'Baseline CO2 (2023)');
  lbl('card-bau',      'Your scenario CO2 (2050)');
  lbl('card-dd',       'Your scenario CO2 (2030)');
  lbl('card-avoided',  'Reduction vs baseline (2050)');

  setCard('card-baseline', baseline + ' Mt',  `Historical baseline ${CFG.base_year}`);
  setCard('card-bau',      co2_2050 + ' Mt',  `${params.name}`);
  setCard('card-dd',       co2_2030 + ' Mt',  `${ndc30met ? '✓ NDC met' : '✗ Above NDC'} · 2030`);
  setCard('card-avoided',  (reduction > 0 ? '-' : '+') + Math.abs(reduction) + '%', `vs ${baseline} Mt baseline`);

  // CO2 chart
  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(document.getElementById('co2Chart'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        { label: params.name, data: co2, borderColor: color, backgroundColor: color + '15',
          tension: 0.3, fill: true, borderWidth: 2.5, pointRadius: 0 },
        { label: `NDC −15% (${CFG.ndc_unconditional} Mt)`, data: years.map(() => CFG.ndc_unconditional),
          type: 'line', borderColor: '#D85A30', borderWidth: 1.5,
          borderDash: [6,4], pointRadius: 0, fill: false },
        { label: `NDC −25% (${CFG.ndc_conditional} Mt)`, data: years.map(() => CFG.ndc_conditional),
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
  buildCustomTable('5', years, co2, params.name);
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


const BACKEND = 'http://localhost:8000';

let CFG = {
  base_co2: 242, base_elec: 115, base_tpes: 85,
  base_year: 2023, ndc_unconditional: 246.5, ndc_conditional: 217.5,
};
async function loadConfig() {
  try {
    const r = await fetch(`${BACKEND}/api/config`);
    if (r.ok) CFG = await r.json();
  } catch {}
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

const access = {
  analyst:     ['nav-upload', 'nav-scenario', 'nav-simulation'],
  researcher:  ['nav-upload', 'nav-scenario'],
  policymaker: [],
};
['nav-upload', 'nav-scenario', 'nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  if (el && !access[user.role].includes(id)) el.classList.add('locked');
});

let co2Chart, energyChart, fuelChart;

function getFallbackData() {
  const b  = CFG.base_co2;
  const el = CFG.base_elec;
  const years = [];
  for (let y = 2021; y <= 2060; y++) years.push(y);
  const bau = years.map(y => y <= CFG.base_year ? b : Math.round(b * Math.pow(1.018, y - CFG.base_year)));
  const mt  = years.map(y => { if (y <= CFG.base_year) return b; const t = y - CFG.base_year; return Math.round(b * Math.pow(1.005, t) * Math.pow(0.982, t)); });
  const dd  = years.map(y => { if (y <= CFG.base_year) return b; const t = y - CFG.base_year; return Math.round(Math.max(b * Math.pow(0.958, t), 5)); });
  return {
    BAU: { years, co2: bau, electricity: years.map(y => Math.round(el * Math.pow(1.018, y - CFG.base_year))),
           coal_share: years.map(y => Math.max(61 - (y - CFG.base_year)*0.3, 45)),
           renewables_share: years.map(y => Math.min(5 + (y - CFG.base_year)*0.3, 15)) },
    MT:  { years, co2: mt,  electricity: years.map(y => Math.round(el * Math.pow(1.012, y - CFG.base_year))),
           coal_share: years.map(y => Math.max(61 - (y - CFG.base_year)*1.4, 25)),
           renewables_share: years.map(y => Math.min(5 + (y - CFG.base_year)*1.4, 40)) },
    DD:  { years, co2: dd,  electricity: years.map(y => Math.round(el * Math.pow(1.008, y - CFG.base_year))),
           coal_share: years.map(y => Math.max(61 - (y - CFG.base_year)*2.3, 5)),
           renewables_share: years.map(y => Math.min(5 + (y - CFG.base_year)*2.8, 70)) },
    _targets: { ndc_unconditional_2030: CFG.ndc_unconditional, ndc_conditional_2030: CFG.ndc_conditional, neutrality_2060: 0 },
  };
}

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
    const custom = customResults[scenarioType];
    showCustomResults(custom.results, custom.params, scenarioType);
    return;
  }

  await loadConfig();

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

  const bau2050 = bauCO2[years.indexOf(2050)] || bauCO2[bauCO2.length - 1];
  const mt2050  = mtCO2[years.indexOf(2050)]  || mtCO2[mtCO2.length - 1];
  const dd2050  = ddCO2[years.indexOf(2050)]  || ddCO2[ddCO2.length - 1];
  const avoided = Math.round(bau2050 - dd2050);

  setCard('card-baseline', CFG.base_co2 + ' Mt', `Historical baseline ${CFG.base_year}`);
  setCard('card-bau',      bau2050 + ' Mt', `▲ +${Math.round((bau2050 - CFG.base_co2) / CFG.base_co2 * 100)}% vs baseline`);
  setCard('card-dd',       dd2050  + ' Mt', `▼ −${Math.round((bau2050-dd2050)/bau2050*100)}% vs BAU`);
  setCard('card-avoided',  avoided + ' Mt', 'Per year vs BAU by 2050');

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

function buildCustomTable(filter, years, co2, scenarioName) {
  const thead = document.querySelector('#results-table thead tr');
  if (thead) thead.innerHTML = `
    <th>Year</th>
    <th style="color:#1D9E75;">${scenarioName} (Mt CO2)</th>
    <th>vs 2023 baseline</th>
    <th>NDC status</th>
  `;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  const milestones = [2025, 2030, 2035, 2040, 2045, 2050, 2060];
  const base = 242;
  const ndc15 = 246.5;
  const ndc25 = 217.5;

  years.forEach((y, i) => {
    if (filter === '5' && !milestones.includes(y)) return;
    const val = Math.round(co2[i]);
    const diff = Math.round(val - base);
    const pct  = Math.round((base - val) / base * 100);
    const diffStr = diff > 0 ? '+' + diff : '' + diff;
    const pctStr  = pct  > 0 ? '−' + pct + '%' : '+' + Math.abs(pct) + '%';

    let ndcFlag = '';
    if (y === 2030) {
      ndcFlag = val <= ndc25
        ? '<span style="color:#0F6E56;font-size:11px;">✓ NDC −25%</span>'
        : val <= ndc15
          ? '<span style="color:#B07C10;font-size:11px;">~ NDC −15%</span>'
          : '<span style="color:#D85A30;font-size:11px;">✗ above NDC</span>';
    }

    const tr = document.createElement('tr');
    if (milestones.includes(y)) tr.classList.add('milestone');
    tr.innerHTML = `
      <td><strong>${y}</strong></td>
      <td style="color:#1D9E75;font-weight:500;">${val} Mt</td>
      <td style="color:${diff <= 0 ? '#0F6E56' : '#D85A30'};">${diffStr} Mt (${pctStr})</td>
      <td>${ndcFlag}</td>
    `;
    tbody.appendChild(tr);
  });

  _tableData = null;
}


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
