// KZLEAP — What-If Analyzer JS
const BACKEND = 'http://localhost:8000';
const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', get text(){ return typeof t==='function'?t('role_analyst'):'Energy Analyst'; } },
  researcher:  { bg: '#eeedfe', color: '#3C3489', get text(){ return typeof t==='function'?t('role_researcher'):'Researcher'; } },
  policymaker: { bg: '#faece7', color: '#712B13', get text(){ return typeof t==='function'?t('role_policymaker'):'Policymaker'; } },
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

const COAL_PLANTS = [
  { id: 'ekibastuz1', name: 'Ekibastuz GRES-1', cap: 4000, co2: 28.0, region: 'Pavlodar' },
  { id: 'ekibastuz2', name: 'Ekibastuz GRES-2', cap: 1000, co2: 7.0,  region: 'Pavlodar' },
  { id: 'karaganda',  name: 'Karaganda GRES-2', cap: 540,  co2: 3.8,  region: 'Karaganda' },
  { id: 'zhambyl',    name: 'Zhambyl GRES',     cap: 1230, co2: 8.6,  region: 'Zhambyl' },
  { id: 'aksu',       name: 'Aksu Power Plant',  cap: 2098, co2: 14.7, region: 'Pavlodar' },
];

const plantState = {};
COAL_PLANTS.forEach(p => plantState[p.id] = true);

function _ (key, fallback) {
  return typeof t === 'function' ? t(key) : fallback;
}

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

  // Update translated slider labels
  const labels = document.querySelectorAll('.wi-slider-label');
  const subs   = document.querySelectorAll('.wi-slider-sub');
  const sliderKeys = [
    ['wi_commissioning', 'Commissioning year'],
    ['wi_num_units',     'Number of units'],
    ['wi_res_tariff',    'Residential tariff'],
    ['wi_ind_tariff',    'Industrial tariff'],
    ['wi_re_invest',     'Annual RE investment'],
    ['wi_grid',          'Grid modernization'],
    ['wi_export_cn',     'Export to China'],
    ['wi_import_kg',     'Import from Kyrgyzstan'],
  ];
  const subKeys = [
    ['wi_npp_desc',        'Post-referendum NPP · 1.2 GW · Ulken site'],
    ['wi_units_desc',      'Each unit = 1.2 GW · VVER-1200 technology'],
    ['wi_res_tariff_desc', 'Current: ~21 KZT/kWh · Higher tariff = lower demand'],
    ['wi_ind_tariff_desc', 'Price elasticity −0.3 for industry'],
    ['wi_re_invest_desc',  'Billion USD/yr → new wind & solar capacity'],
    ['wi_grid_desc',       'Billion USD/yr → enables more RE integration'],
    ['wi_export_cn_desc',  'Clean energy corridor · reduces domestic coal use'],
    ['wi_import_kg_desc',  'Hydropower import · zero-carbon'],
  ];
  labels.forEach((el, i) => { if (sliderKeys[i]) el.textContent = _(sliderKeys[i][0], sliderKeys[i][1]); });
  subs.forEach((el, i)   => { if (subKeys[i])    el.textContent = _(subKeys[i][0],    subKeys[i][1]); });

  // NDC legend
  const legs = document.querySelectorAll('.ndc-leg-item');
  if (legs[0]) legs[0].innerHTML = `<div class="ndc-leg-dot" style="background:#1D9E75"></div> ${_('wi_below_ndc15','Below NDC −15%')}`;
  if (legs[1]) legs[1].innerHTML = `<div class="ndc-leg-dot" style="background:#F5A623"></div> ${_('wi_between','Between targets')}`;
  if (legs[2]) legs[2].innerHTML = `<div class="ndc-leg-dot" style="background:#D85A30"></div> ${_('wi_above_ndc_leg','Above NDC target')}`;

  // Investment table headers
  const ths = document.querySelectorAll('.inv-table th');
  const thKeys = [
    ['wi_col_technology','Technology'],
    ['wi_col_investment','Investment'],
    ['wi_col_new_cap',   'New capacity'],
    ['wi_col_share',     'Share'],
  ];
  ths.forEach((th, i) => { if (thKeys[i]) th.textContent = _(thKeys[i][0], thKeys[i][1]); });

  // Info strip
  const strip = document.querySelector('.info-strip div');
  if (strip) {
    strip.innerHTML = `<strong>KZLEAP What-If Analyzer</strong> — ${_('wi_kzleap_info', 'unlike standard LEAP, this tool calculates policy impacts in real-time without rerunning the full model. Results are based on LEAP-methodology energy accounting combined with LP optimization.')}`;
  }
}

function togglePlant(id, toggleEl, e) {
  e.stopPropagation();
  plantState[id] = !plantState[id];
  const item = toggleEl.closest('.plant-item');
  toggleEl.classList.toggle('off');
  item.classList.toggle('closed');
  recalc();
}

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

let wiChart = null;
let currentChartType = 'co2';
let lastResult = null;

function recalc() {
  const s = getSliders();

  const coalCO2Saved = COAL_PLANTS.filter(p => !plantState[p.id]).reduce((sum, p) => sum + p.co2, 0);
  const closedCapMW  = COAL_PLANTS.filter(p => !plantState[p.id]).reduce((sum, p) => sum + p.cap, 0);
  const nucGW  = s.nucUnits * 1.2;
  const reGW   = s.reInvest / 1.2;
  const gridBonus = s.gridInvest * 0.5;
  const resTariffEffect = -((s.resTariff - 21) / 21) * 0.3 * 0.4;
  const indTariffEffect = -((s.indTariff - 18) / 18) * 0.3 * 0.45;
  const demandReduction = (resTariffEffect + indTariffEffect) * 115;
  const exportCoalReplace = s.exportCN * 0.6;
  const importCoalReplace = s.importKG;

  const years = [], co2BAU = [], co2WI = [], elecBAU = [], elecWI = [], investCumul = [];
  const BASE_CO2 = 242, BASE_ELEC = 115;
  let cumInvest = 0;

  for (let year = 2024; year <= 2060; year++) {
    years.push(year);
    const tt = year - 2023;
    const bauCO2  = BASE_CO2  * Math.pow(1.018, tt);
    const bauElec = BASE_ELEC * Math.pow(1.018, tt);
    co2BAU.push(Math.round(bauCO2 * 10) / 10);
    elecBAU.push(Math.round(bauElec * 10) / 10);

    const nucCoalReplace = year >= s.nucYear ? Math.min((year - s.nucYear) / 3, 1) * nucGW * 0.9 * 8.76 * 0.82 : 0;
    const reEffect   = Math.min(tt / 5, 1) * reGW * 0.3 * 8.76 * 0.82;
    const gridEffect = Math.min(tt / 5, 1) * gridBonus * 0.3 * 8.76 * 0.82;
    const tariffCO2  = Math.min(tt / 3, 1) * demandReduction * 0.61 * 0.82;
    const tradeCO2   = Math.min(tt / 4, 1) * (exportCoalReplace + importCoalReplace) * 0.82;
    const totalReduction = coalCO2Saved + nucCoalReplace + reEffect + gridEffect + tariffCO2 + tradeCO2;

    co2WI.push(Math.round(Math.max(bauCO2 - totalReduction, 20) * 10) / 10);
    elecWI.push(Math.round(Math.max(bauElec + demandReduction * Math.min(tt/3,1) + s.importKG * Math.min(tt/4,1), 80) * 10) / 10);
    cumInvest += (s.reInvest + s.gridInvest);
    investCumul.push(Math.round(cumInvest * 10) / 10);
  }

  const idx2050 = years.indexOf(2050);
  const idx2030 = years.indexOf(2030);
  const avoided2050 = Math.round(co2BAU[idx2050] - co2WI[idx2050]);
  const co22030 = co2WI[idx2030];
  const totalInvest = Math.round(cumInvest);
  const reShare = Math.min(5 + (reGW + gridBonus + (s.nucUnits > 0 ? nucGW : 0)) * 3 + s.importKG * 0.5, 75);

  document.getElementById('wi-avoided').textContent = avoided2050 + ' Mt';
  document.getElementById('wi-avoided-sub').textContent = `vs BAU in 2050 · ${Math.round(avoided2050/co2BAU[idx2050]*100)}% reduction`;
  document.getElementById('wi-invest').textContent = totalInvest + ' B$';
  document.getElementById('wi-invest-sub').textContent = _('wi_cumulative', '2024–2060 cumulative');
  document.getElementById('wi-re').textContent = Math.round(reShare) + '%';
  document.getElementById('wi-re-sub').textContent = _('wi_wind_solar_hydro', 'wind + solar + hydro + nuclear');

  const ndc15 = 246.5, ndc25 = 217.5, maxCO2 = 290;
  const barPct = Math.min(co22030 / maxCO2 * 100, 100);
  const bar = document.getElementById('ndc-bar');
  bar.style.width = barPct + '%';
  bar.style.background = co22030 <= ndc25 ? '#1D9E75' : co22030 <= ndc15 ? '#F5A623' : '#D85A30';
  document.getElementById('ndc-bar-label').textContent = Math.round(co22030) + ' Mt';
  document.getElementById('ndc-co2-val').textContent = Math.round(co22030) + ' Mt CO₂';
  document.getElementById('ndc-status-wi').textContent =
    co22030 <= ndc25 ? _('wi_ndc25_met', '✓ NDC −25% met') :
    co22030 <= ndc15 ? _('wi_ndc15_met', '~ NDC −15% met') :
                       _('wi_above_ndc', '✗ Above NDC target');

  lastResult = { years, co2BAU, co2WI, elecBAU, elecWI, investCumul };
  renderChart(currentChartType);
  renderInvTable(s, nucGW, reGW, gridBonus, coalCO2Saved, closedCapMW);
}

function renderChart(type) {
  if (!lastResult) return;
  const { years, co2BAU, co2WI, elecBAU, elecWI, investCumul } = lastResult;
  const datasets = type === 'co2' ? [
    { label: 'BAU',           data: co2BAU,   borderColor: '#D85A30', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [5,4] },
    { label: _('whatif_vs_bau','Your scenario'), data: co2WI, borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.08)', borderWidth: 2.5, pointRadius: 0, fill: true },
  ] : type === 'elec' ? [
    { label: 'BAU',           data: elecBAU,  borderColor: '#378ADD', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [5,4] },
    { label: _('whatif_vs_bau','Your scenario'), data: elecWI, borderColor: '#1D9E75', borderWidth: 2.5, pointRadius: 0, fill: false },
  ] : [
    { label: _('whatif_invest_breakdown','Cumulative investment (B$)'), data: investCumul, borderColor: '#F5A623', backgroundColor: 'rgba(245,166,35,0.1)', borderWidth: 2.5, pointRadius: 0, fill: true },
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
    { key: 'wi_wind_solar',   name: 'Wind & Solar',        invest: s.reInvest * 37,   cap: reGW.toFixed(1) + ' GW' },
    { key: 'wi_grid_upgrade', name: 'Grid upgrade',         invest: s.gridInvest * 37, cap: '+' + gridBonus.toFixed(1) + ' GW enabled' },
    { key: 'wi_nuclear',      name: 'Nuclear',              invest: nucGW * 5,          cap: nucGW.toFixed(1) + ' GW' },
    { key: 'wi_coal_phaseout',name: 'Coal phase-out costs', invest: closedMW * 0.1,    cap: (closedMW/1000).toFixed(1) + ' GW retired' },
  ];

  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    if (r.invest === 0 && r.key !== 'wi_coal_phaseout') return;
    const pct = total > 0 ? Math.round(r.invest / total * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;">${_(r.key, r.name)}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${Math.round(r.invest)} B$</td>
      <td style="color:#6b7a8d;">${r.cap}</td>
      <td style="width:80px;"><div class="inv-bar" style="width:${pct}%"></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// Init
renderPlants();
recalc();

// Re-apply translations when language changes
const _origSetLang = typeof setLang === 'function' ? setLang : null;
document.addEventListener('DOMContentLoaded', () => {
  // patch setLang to also re-render plants on lang change
  const origSetLang = window.setLang;
  if (origSetLang) {
    window.setLang = function(lang) {
      origSetLang(lang);
      renderPlants();
      recalc();
    };
  }
});