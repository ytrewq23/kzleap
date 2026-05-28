// KZLEAP — What-If Analyzer JS
// Real-time policy impact calculator

const BACKEND = 'http://localhost:8000';
const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', text: 'Energy Analyst' },
  researcher:  { bg: '#eeedfe', color: '#3C3489', text: 'Researcher' },
  policymaker: { bg: '#faece7', color: '#712B13', text: 'Policymaker' },
};
const avatarColors = { analyst: '#1D9E75', researcher: '#534AB7', policymaker: '#993C1D' };

document.getElementById('user-name').textContent = user.name;
document.getElementById('user-role').textContent = badgeStyles[user.role].text;
document.getElementById('user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('');
document.getElementById('user-avatar').style.background = avatarColors[user.role];
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

// ── Kazakhstan coal plants data ──
const COAL_PLANTS = [
  { id: 'ekibastuz1', name: 'Ekibastuz GRES-1', cap: 4000, co2: 28.0, region: 'Pavlodar' },
  { id: 'ekibastuz2', name: 'Ekibastuz GRES-2', cap: 1000, co2: 7.0,  region: 'Pavlodar' },
  { id: 'karaganda',  name: 'Karaganda GRES-2', cap: 540,  co2: 3.8,  region: 'Karaganda' },
  { id: 'zhambyl',    name: 'Zhambyl GRES',     cap: 1230, co2: 8.6,  region: 'Zhambyl' },
  { id: 'aksu',       name: 'Aksu Power Plant',  cap: 2098, co2: 14.7, region: 'Pavlodar' },
];

// Plant state: true = operational, false = closed
const plantState = {};
COAL_PLANTS.forEach(p => plantState[p.id] = true);

// ── Render coal plants ──
function renderPlants() {
  const list = document.getElementById('plant-list');
  list.innerHTML = '';
  COAL_PLANTS.forEach(plant => {
    const on = plantState[plant.id];
    const div = document.createElement('div');
    div.className = 'plant-item' + (on ? '' : ' closed');
    div.innerHTML = `
      <div>
        <div class="plant-name">${plant.name}</div>
        <div class="plant-cap">${plant.cap} MW · ${plant.co2} Mt CO₂/yr · ${plant.region}</div>
      </div>
      <div class="plant-toggle ${on ? '' : 'off'}" onclick="togglePlant('${plant.id}', this, event)"></div>
    `;
    list.appendChild(div);
  });
}

function togglePlant(id, toggleEl, e) {
  e.stopPropagation();
  plantState[id] = !plantState[id];
  const item = toggleEl.closest('.plant-item');
  toggleEl.classList.toggle('off');
  item.classList.toggle('closed');
  recalc();
}

// ── Get all slider values ──
function getSliders() {
  const sliders = document.querySelectorAll('input[type=range].wi');
  const vals = [...sliders].map(s => parseFloat(s.value));
  return {
    nucYear:    vals[0] || 2035,
    nucUnits:   vals[1] || 1,
    resTariff:  vals[2] || 21,
    indTariff:  vals[3] || 18,
    reInvest:   vals[4] || 1.5,
    gridInvest: vals[5] || 0.5,
    exportCN:   vals[6] || 0,
    importKG:   vals[7] || 0,
  };
}

// ── Main calculation ──
let wiChart = null;
let currentChartType = 'co2';
let lastResult = null;

function recalc() {
  const s = getSliders();

  // Coal CO2 saved from closed plants
  const coalCO2Saved = COAL_PLANTS
    .filter(p => !plantState[p.id])
    .reduce((sum, p) => sum + p.co2, 0);

  const closedCapMW = COAL_PLANTS
    .filter(p => !plantState[p.id])
    .reduce((sum, p) => sum + p.cap, 0);

  // Nuclear capacity
  const nucGW = s.nucUnits * 1.2;

  // RE capacity from investment (avg $1.2M/MW for wind/solar mix)
  const reGW = s.reInvest / 1.2;

  // Grid investment enables more RE integration
  const gridBonus = s.gridInvest * 0.5; // extra GW enabled

  // Tariff effect on demand (elasticity -0.3 residential, -0.3 industrial)
  const resTariffEffect = -((s.resTariff - 21) / 21) * 0.3 * 0.4;  // 40% residential share
  const indTariffEffect = -((s.indTariff - 18) / 18) * 0.3 * 0.45; // 45% industrial share
  const demandReduction = (resTariffEffect + indTariffEffect) * 115; // TWh saved

  // Export to China: forces more clean generation (less coal burn)
  const exportCoalReplace = s.exportCN * 0.6; // 60% of export forces RE

  // Import from Kyrgyzstan: directly replaces domestic coal
  const importCoalReplace = s.importKG;

  // ── Year-by-year projection 2024–2060 ──
  const years = [];
  const co2BAU = [], co2WI = [];
  const elecBAU = [], elecWI = [];
  const investCumul = [];

  const BASE_CO2  = 242;
  const BASE_ELEC = 115;
  let cumInvest = 0;

  for (let year = 2024; year <= 2060; year++) {
    years.push(year);
    const t = year - 2023;

    // BAU
    const bauCO2  = BASE_CO2  * Math.pow(1.018, t);
    const bauElec = BASE_ELEC * Math.pow(1.018, t);
    co2BAU.push(Math.round(bauCO2 * 10) / 10);
    elecBAU.push(Math.round(bauElec * 10) / 10);

    // What-If CO2 reductions
    // Coal plants: full effect after closure (assume all closed now)
    const coalEffect = coalCO2Saved;

    // Nuclear: ramps up from commissioning year
    const nucEffect = year >= s.nucYear
      ? Math.min((year - s.nucYear) / 3, 1) * nucGW * 0.9 * 8760 / 1000 * 0.0  // zero CO2
      : 0;
    // Nuclear replaces coal: each GW replaces ~0.82 Mt CO2/TWh * CF
    const nucCoalReplace = year >= s.nucYear
      ? Math.min((year - s.nucYear) / 3, 1) * nucGW * 0.9 * 8.76 * 0.82
      : 0;

    // RE investment effect (builds over time)
    const reEffect = Math.min(t / 5, 1) * reGW * 0.3 * 8.76 * 0.82;
    const gridEffect = Math.min(t / 5, 1) * gridBonus * 0.3 * 8.76 * 0.82;

    // Tariff demand reduction → less coal burned
    const tariffCO2 = Math.min(t / 3, 1) * demandReduction * 0.61 * 0.82;

    // Trade effects
    const tradeCO2 = Math.min(t / 4, 1) * (exportCoalReplace + importCoalReplace) * 0.82;

    const totalReduction = coalEffect + nucCoalReplace + reEffect + gridEffect + tariffCO2 + tradeCO2;
    const wiCO2 = Math.max(bauCO2 - totalReduction, 20);
    co2WI.push(Math.round(wiCO2 * 10) / 10);

    // Electricity
    const wiElec = Math.max(bauElec + demandReduction * Math.min(t/3, 1) + s.importKG * Math.min(t/4, 1), 80);
    elecWI.push(Math.round(wiElec * 10) / 10);

    // Cumulative investment
    cumInvest += (s.reInvest + s.gridInvest);
    investCumul.push(Math.round(cumInvest * 10) / 10);
  }

  // ── Key metrics ──
  const idx2050 = years.indexOf(2050);
  const idx2030 = years.indexOf(2030);

  const avoided2050 = Math.round(co2BAU[idx2050] - co2WI[idx2050]);
  const co22030     = co2WI[idx2030];
  const totalInvest = Math.round(cumInvest);

  // RE share estimate
  const reShare = Math.min(
    5 + (reGW + gridBonus + (s.nucUnits > 0 ? nucGW : 0)) * 3 + s.importKG * 0.5,
    75
  );

  // Update impact cards
  document.getElementById('wi-avoided').textContent = avoided2050 + ' Mt';
  document.getElementById('wi-avoided-sub').textContent = `vs BAU in 2050 · ${Math.round(avoided2050/co2BAU[idx2050]*100)}% reduction`;
  document.getElementById('wi-invest').textContent = totalInvest + ' B$';
  document.getElementById('wi-invest-sub').textContent = `2024–2060 cumulative`;
  document.getElementById('wi-re').textContent = Math.round(reShare) + '%';
  document.getElementById('wi-re-sub').textContent = `wind + solar + hydro + nuclear`;

  // NDC bar
  const ndc15 = 246.5;
  const ndc25 = 217.5;
  const maxCO2 = 290; // 1990 base
  const barPct = Math.min(co22030 / maxCO2 * 100, 100);
  const bar = document.getElementById('ndc-bar');
  bar.style.width = barPct + '%';

  if (co22030 <= ndc25) {
    bar.style.background = '#1D9E75';
  } else if (co22030 <= ndc15) {
    bar.style.background = '#F5A623';
  } else {
    bar.style.background = '#D85A30';
  }

  document.getElementById('ndc-bar-label').textContent = Math.round(co22030) + ' Mt';
  document.getElementById('ndc-co2-val').textContent = Math.round(co22030) + ' Mt CO₂';
  document.getElementById('ndc-status-wi').textContent =
    co22030 <= ndc25 ? '✓ NDC −25% met' :
    co22030 <= ndc15 ? '~ NDC −15% met' : '✗ Above NDC target';

  // Store for chart switching
  lastResult = { years, co2BAU, co2WI, elecBAU, elecWI, investCumul };

  renderChart(currentChartType);

  // Investment table
  renderInvTable(s, nucGW, reGW, gridBonus, coalCO2Saved, closedCapMW);
}

function renderChart(type) {
  if (!lastResult) return;
  const { years, co2BAU, co2WI, elecBAU, elecWI, investCumul } = lastResult;

  const datasets = type === 'co2' ? [
    { label: 'BAU', data: co2BAU, borderColor: '#D85A30', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [5,4] },
    { label: 'Your scenario', data: co2WI, borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.08)', borderWidth: 2.5, pointRadius: 0, fill: true },
  ] : type === 'elec' ? [
    { label: 'BAU', data: elecBAU, borderColor: '#378ADD', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [5,4] },
    { label: 'Your scenario', data: elecWI, borderColor: '#1D9E75', borderWidth: 2.5, pointRadius: 0, fill: false },
  ] : [
    { label: 'Cumulative investment (B$)', data: investCumul, borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 2.5, pointRadius: 0, fill: true },
  ];

  const yLabel = type === 'co2' ? 'Mt CO₂' : type === 'elec' ? 'TWh' : 'B$';

  if (wiChart) wiChart.destroy();
  wiChart = new Chart(document.getElementById('wi-chart'), {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: {
        y: { ticks: { callback: v => v + ' ' + yLabel, font: { size: 10 } } },
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } }
      }
    }
  });
}

function switchChart(type, btn) {
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentChartType = type;
  renderChart(type);
}

function renderInvTable(s, nucGW, reGW, gridBonus, coalCO2Saved, closedMW) {
  const total = (s.reInvest + s.gridInvest) * 37 + nucGW * 5 + closedMW * 0.001;
  const rows = [
    { name: 'Wind & Solar', invest: s.reInvest * 37, cap: reGW.toFixed(1) + ' GW' },
    { name: 'Grid upgrade',  invest: s.gridInvest * 37, cap: '+' + gridBonus.toFixed(1) + ' GW enabled' },
    { name: 'Nuclear',       invest: nucGW * 5,  cap: nucGW.toFixed(1) + ' GW' },
    { name: 'Coal phase-out costs', invest: closedMW * 0.1, cap: (closedMW/1000).toFixed(1) + ' GW retired' },
  ];

  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    if (r.invest === 0 && r.name !== 'Coal phase-out costs') return;
    const pct = total > 0 ? Math.round(r.invest / total * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;">${r.name}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${Math.round(r.invest)} B$</td>
      <td style="color:#6b7a8d;">${r.cap}</td>
      <td style="width:80px;"><div class="inv-bar" style="width:${pct}%"></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Init ──
renderPlants();
recalc();
