// KZLEAP — What-If Analyzer  (backend-connected)
// Отправляет параметры на /whatif/calculate, отображает ответ.
// При недоступности бэкенда падает на локальный расчёт.

const BACKEND = 'https://kzleap.onrender.com';
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

// ─── Данные об угольных станциях ───────────────────────────────
const COAL_PLANTS = [
  { id: 'ekibastuz1', name: 'Ekibastuz GRES-1', cap_mw: 4000, co2_mt: 28.0, region: 'Pavlodar' },
  { id: 'ekibastuz2', name: 'Ekibastuz GRES-2', cap_mw: 1000, co2_mt: 7.0,  region: 'Pavlodar' },
  { id: 'karaganda',  name: 'Karaganda GRES-2', cap_mw: 540,  co2_mt: 3.8,  region: 'Karaganda' },
  { id: 'zhambyl',    name: 'Zhambyl GRES',     cap_mw: 1230, co2_mt: 8.6,  region: 'Zhambyl' },
  { id: 'aksu',       name: 'Aksu Power Plant',  cap_mw: 2098, co2_mt: 14.7, region: 'Pavlodar' },
];

const plantState = {};
COAL_PLANTS.forEach(p => plantState[p.id] = true);

// ─── Состояние backend / dataset ───────────────────────────────
let datasetInfo = null;      // ответ от /whatif/dataset-info
let backendAvail = false;
let calcInFlight = false;
let debounceTimer = null;

function _(key, fallback) { return typeof t === 'function' ? t(key) : fallback; }

// ─── Инициализация: загрузка dataset-info ──────────────────────
async function initDataset() {
  const badge = document.getElementById('backend-badge');
  try {
    const res = await fetch(`${BACKEND}/whatif/dataset-info`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(res.statusText);
    datasetInfo = await res.json();
    backendAvail = true;
    badge.textContent = '● Backend connected';
    badge.style.color = '#1D9E75';

    // Обновляем подписи с реальным базовым годом
    const by = datasetInfo.base_year;
    document.querySelector('[data-i18n="whatif_hero_sub"]').textContent =
      `Adjust parameters · real-time CO₂ impact · Kazakhstan energy system ${by}–2060`;
  } catch (e) {
    backendAvail = false;
    badge.textContent = '● Offline (local calc)';
    badge.style.color = '#F5A623';
    console.warn('[KZLEAP] Backend unavailable, using local fallback:', e.message);
  }
  renderPlants();
  recalc();
}

// ─── UI: список угольных станций ───────────────────────────────
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
        <div class="plant-cap">${plant.cap_mw} MW · ${plant.co2_mt} Mt CO₂/yr · ${plant.region}</div>
      </div>
      <div class="plant-toggle ${on ? '' : 'off'}" onclick="togglePlant('${plant.id}', this, event)"></div>
    `;
    list.appendChild(div);
  });

  // NDC legend
  const legs = document.querySelectorAll('.ndc-leg-item');
  if (legs[0]) legs[0].innerHTML = `<div class="ndc-leg-dot" style="background:#1D9E75"></div> ${_('wi_below_ndc15','Below NDC −15%')}`;
  if (legs[1]) legs[1].innerHTML = `<div class="ndc-leg-dot" style="background:#F5A623"></div> ${_('wi_between','Between targets')}`;
  if (legs[2]) legs[2].innerHTML = `<div class="ndc-leg-dot" style="background:#D85A30"></div> ${_('wi_above_ndc_leg','Above NDC target')}`;

  // Investment table headers
  const ths = document.querySelectorAll('.inv-table th');
  [['wi_col_technology','Technology'],['wi_col_investment','Investment'],['wi_col_new_cap','New capacity'],['wi_col_share','Share']]
    .forEach(([k,f], i) => { if (ths[i]) ths[i].textContent = _(k, f); });
}

function togglePlant(id, toggleEl, e) {
  e.stopPropagation();
  plantState[id] = !plantState[id];
  toggleEl.closest('.plant-item').classList.toggle('closed');
  toggleEl.classList.toggle('off');
  recalc();
}

// ─── Считываем слайдеры ─────────────────────────────────────────
function getSliders() {
  const s = document.querySelectorAll('input[type=range].wi');
  const v = [...s].map(x => parseFloat(x.value));
  return {
    nucYear:    v[0] || 2035,
    nucUnits:   v[1] || 1,
    resTariff:  v[2] || 21,
    indTariff:  v[3] || 18,
    reInvest:   v[4] || 1.5,
    gridInvest: v[5] || 0.5,
    exportCN:   v[6] || 0,
    importKG:   v[7] || 0,
  };
}

// ─── Главный вход: вызов с debounce ────────────────────────────
function recalc() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(_doRecalc, 180);
}

async function _doRecalc() {
  if (calcInFlight) return;
  calcInFlight = true;
  document.querySelector('.wi-run-btn').disabled = true;

  const s = getSliders();

  if (backendAvail) {
    await _recalcBackend(s);
  } else {
    _recalcLocal(s);
  }

  document.querySelector('.wi-run-btn').disabled = false;
  calcInFlight = false;
}

// ─── BACKEND расчёт ────────────────────────────────────────────
async function _recalcBackend(s) {
  const payload = {
    coal_plants: COAL_PLANTS.map(p => ({
      id:     p.id,
      name:   p.name,
      cap_mw: p.cap_mw,
      co2_mt: p.co2_mt,
      active: plantState[p.id],
    })),
    nuc_year:    s.nucYear,
    nuc_units:   s.nucUnits,
    res_tariff:  s.resTariff,
    ind_tariff:  s.indTariff,
    re_invest:   s.reInvest,
    grid_invest: s.gridInvest,
    export_cn:   s.exportCN,
    import_kg:   s.importKG,
    year_start:  2024,
    year_end:    2060,
  };

  try {
    const res = await fetch(`${BACKEND}/whatif/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _applyResults(data, s);
  } catch (err) {
    console.warn('[KZLEAP] Backend calc failed, falling back to local:', err.message);
    backendAvail = false;
    document.getElementById('backend-badge').textContent = '● Offline (local calc)';
    document.getElementById('backend-badge').style.color = '#F5A623';
    _recalcLocal(s);
  }
}

// ─── FALLBACK: локальный расчёт (JS) ───────────────────────────
// Используется только когда backend недоступен.
// Оставлен намеренно упрощённым — для production всегда работает backend.
function _recalcLocal(s) {
  const BASE_CO2  = datasetInfo?.base_co2  ?? 242;
  const BASE_ELEC = datasetInfo?.base_elec ?? 115;
  const COAL_SHARE = (datasetInfo?.elec_mix?.coal ?? 61) / 100;

  const coalCO2Saved = COAL_PLANTS.filter(p => !plantState[p.id]).reduce((a, p) => a + p.co2_mt, 0);
  const closedMW     = COAL_PLANTS.filter(p => !plantState[p.id]).reduce((a, p) => a + p.cap_mw, 0);
  const nucGW   = s.nucUnits * 1.2;
  const reGW    = s.reInvest / 1.2;
  const gridGW  = s.gridInvest * 0.5;
  const demRed  = -(((s.resTariff - 21) / 21) * 0.2 * 0.35 + ((s.indTariff - 18) / 18) * 0.3 * 0.45) * BASE_ELEC;
  const expSave = s.exportCN  * COAL_SHARE * 0.82;
  const impSave = s.importKG  * COAL_SHARE * 0.82;

  const years = [], co2BAU = [], co2WI = [], elecBAU = [], elecWI = [], investCumul = [], reSh = [];
  let cumInv = 0;
  for (let yr = 2024; yr <= 2060; yr++) {
    const t = yr - (datasetInfo?.base_year ?? 2023);
    const ramp = (d, l) => Math.min(Math.max((t - d) / l, 0), 1);
    const bCO2  = BASE_CO2  * Math.pow(1.018, Math.max(t, 0));
    const bElec = BASE_ELEC * Math.pow(1.018, Math.max(t, 0));
    const nucTWh = yr >= s.nucYear ? Math.min((yr - s.nucYear) / 3, 1) * nucGW * 0.85 * 8.76 : 0;
    const red = coalCO2Saved * ramp(0,1)
              + nucTWh * COAL_SHARE * 0.82
              + (reGW + gridGW) * ramp(0,6) * 0.3 * 8.76 * COAL_SHARE * 0.82
              + Math.abs(demRed) * 0.82 * COAL_SHARE * ramp(0,3)
              + (expSave + impSave) * ramp(0,4);
    co2BAU.push(+bCO2.toFixed(2));  co2WI.push(+Math.max(bCO2 - red, 5).toFixed(2));
    elecBAU.push(+bElec.toFixed(2)); elecWI.push(+Math.max(bElec + demRed * ramp(0,3), 50).toFixed(2));
    cumInv += s.reInvest + s.gridInvest;
    investCumul.push(+cumInv.toFixed(2));
    reSh.push(Math.min(0.05 + ramp(0, 15) * 0.35, 0.75));
    years.push(yr);
  }

  const idx2050 = years.indexOf(2050), idx2030 = years.indexOf(2030);
  const ndcBase  = datasetInfo?.ndc?.base_co2_mt ?? 290;
  const target15 = ndcBase * 0.85, target25 = ndcBase * 0.75;
  const co22030  = co2WI[idx2030];

  const data = {
    avoided_2050:  +(co2BAU[idx2050] - co2WI[idx2050]).toFixed(1),
    avoided_pct:   +((co2BAU[idx2050] - co2WI[idx2050]) / co2BAU[idx2050] * 100).toFixed(1),
    total_invest:  +(cumInv + nucGW * 5.5 + closedMW * 0.0001).toFixed(1),
    coal_free_2050: (function(){
      const closedCO2 = COAL_PLANTS.filter(p=>!plantState[p.id]).reduce((a,p)=>a+p.co2_mt,0);
      const coalTWH = BASE_ELEC*(1+0.018)**27*0.61;
      const coalAvoided = closedCO2/0.82;
      const reT = (Math.min((s.reInvest/1.05)*27,75)+Math.min((s.gridInvest/0.6*0.3)*27,12))*0.285*8.76;
      const nucT = s.nucUnits*1.2*0.85*8.76;
      const baseRE = BASE_ELEC*0.15;
      const clean = (coalTWH-Math.max(coalTWH-coalAvoided,0))+reT+nucT+baseRE;
      return +Math.min(clean/Math.max(elecWI[idx2050],1)*100,100).toFixed(1);
    })(),
    ndc: {
      co2_2030:    +co22030.toFixed(1),
      target_ndc15: +target15.toFixed(1),
      target_ndc25: +target25.toFixed(1),
      bar_pct:     +Math.min(co22030 / (ndcBase * 1.05) * 100, 100).toFixed(1),
      bar_color:   co22030 <= target25 ? '#1D9E75' : co22030 <= target15 ? '#F5A623' : '#D85A30',
      status_key:  co22030 <= target25 ? 'wi_below_ndc25' : co22030 <= target15 ? 'wi_ndc15_met' : 'wi_above_ndc',
      base_co2:    ndcBase,
      base_year:   datasetInfo?.ndc?.base_year ?? 1990,
    },
    timeline: years.map((y, i) => ({
      year: y, co2_bau: co2BAU[i], co2_wi: co2WI[i],
      elec_bau: elecBAU[i], elec_wi: elecWI[i],
      invest_cumul: investCumul[i], re_share: reSh[i],
    })),
    invest_breakdown: [
      { key:'wi_wind_solar',    name:'Wind & Solar',        invest:+(s.reInvest*37).toFixed(1), cap:reGW.toFixed(1)+' GW',              pct:0 },
      { key:'wi_grid_upgrade',  name:'Grid upgrade',         invest:+(s.gridInvest*37).toFixed(1),cap:gridGW.toFixed(1)+' GW enabled',   pct:0 },
      { key:'wi_nuclear',       name:'Nuclear',              invest:+(nucGW*5.5).toFixed(1),     cap:nucGW.toFixed(1)+' GW',             pct:0 },
      { key:'wi_coal_phaseout', name:'Coal phase-out costs', invest:+(closedMW*0.0001).toFixed(2),cap:(closedMW/1000).toFixed(1)+' GW retired', pct:0 },
    ],
  };
  const totInv = data.invest_breakdown.reduce((a, r) => a + r.invest, 0);
  data.invest_breakdown.forEach(r => { r.pct = totInv ? +(r.invest / totInv * 100).toFixed(1) : 0; });
  _applyResults(data, s);
}

// ─── Применяем ответ к UI ──────────────────────────────────────
let wiChart = null, currentChartType = 'co2', lastResult = null;

function _applyResults(data, s) {
  lastResult = data;

  // KPI cards
  document.getElementById('wi-avoided').textContent = data.avoided_2050 + ' Mt';
  document.getElementById('wi-avoided-sub').textContent =
    `vs BAU in 2050 · ${data.avoided_pct}% reduction`;
  document.getElementById('wi-invest').textContent  = data.total_invest + ' B$';
  document.getElementById('wi-invest-sub').textContent = _('wi_cumulative', '2024–2060 cumulative');
  document.getElementById('wi-re').textContent     = '2060';
  document.getElementById('wi-re-sub').textContent = _('wi_neutrality_sub', 'carbon neutrality target year');

  // NDC bar
  const ndc = data.ndc;
  const bar = document.getElementById('ndc-bar');
  bar.style.width      = ndc.bar_pct + '%';
  bar.style.background = ndc.bar_color;
  document.getElementById('ndc-bar-label').textContent = Math.round(ndc.co2_2030) + ' Mt';
  document.getElementById('ndc-co2-val').textContent   = Math.round(ndc.co2_2030) + ' Mt CO₂';

  const statusMap = {
    wi_below_ndc25: _('wi_ndc25_met',  '✓ NDC −25% met'),
    wi_ndc15_met:   _('wi_ndc15_met',  '~ NDC −15% met'),
    wi_above_ndc:   _('wi_above_ndc',  '✗ Above NDC target'),
  };
  document.getElementById('ndc-status-wi').textContent = statusMap[ndc.status_key] || ndc.status_key;

  // NDC marker positions (относительно max_bar = base_co2 * 1.05)
  const maxBar = ndc.base_co2 * 1.05;
  document.getElementById('ndc-marker-15').style.left = (ndc.target_ndc15 / maxBar * 100) + '%';
  document.getElementById('ndc-marker-25').style.left = (ndc.target_ndc25 / maxBar * 100) + '%';
  document.querySelector('#ndc-marker-15 .ndc-marker-label').textContent =
    `−${Math.abs(datasetInfo?.ndc?.unconditional_pct ?? 15)}% (${Math.round(ndc.target_ndc15)} Mt)`;
  document.querySelector('#ndc-marker-25 .ndc-marker-label').textContent =
    `−${Math.abs(datasetInfo?.ndc?.conditional_pct ?? 25)}% (${Math.round(ndc.target_ndc25)} Mt)`;

  renderChart(currentChartType);
  renderInvTable(data.invest_breakdown);
}

// ─── Chart ─────────────────────────────────────────────────────
function renderChart(type) {
  if (!lastResult) return;
  const tl = lastResult.timeline;
  const years = tl.map(p => p.year);

  const datasets = type === 'co2' ? [
    { label: 'BAU', data: tl.map(p => p.co2_bau), borderColor:'#D85A30', borderWidth:2, pointRadius:0, fill:false, borderDash:[5,4] },
    { label: _('whatif_scenario','Your scenario'), data: tl.map(p => p.co2_wi), borderColor:'#1D9E75', backgroundColor:'rgba(29,158,117,0.08)', borderWidth:2.5, pointRadius:0, fill:true },
  ] : type === 'elec' ? [
    { label: 'BAU', data: tl.map(p => p.elec_bau), borderColor:'#378ADD', borderWidth:2, pointRadius:0, fill:false, borderDash:[5,4] },
    { label: _('whatif_scenario','Your scenario'), data: tl.map(p => p.elec_wi), borderColor:'#1D9E75', borderWidth:2.5, pointRadius:0, fill:false },
  ] : [
    { label: _('whatif_invest_breakdown','Cumulative investment (B$)'), data: tl.map(p => p.invest_cumul), borderColor:'#F5A623', backgroundColor:'rgba(245,166,35,0.1)', borderWidth:2.5, pointRadius:0, fill:true },
  ];
  const yLabel = type==='co2' ? 'Mt CO₂' : type==='elec' ? 'TWh' : 'B$';

  if (wiChart) wiChart.destroy();
  wiChart = new Chart(document.getElementById('wi-chart'), {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:true, labels:{ font:{size:10}, boxWidth:12 } } },
      scales: {
        y: { ticks:{ callback: v => v+' '+yLabel, font:{size:10} } },
        x: { ticks:{ font:{size:10}, maxTicksLimit:10 }, grid:{ display:false } },
      },
    },
  });
}

function switchChart(type, btn) {
  document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentChartType = type;
  renderChart(type);
}

// ─── Investment table ───────────────────────────────────────────
function renderInvTable(rows) {
  const tbody = document.getElementById('inv-tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    if (r.invest === 0 && r.key !== 'wi_coal_phaseout') return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:500;">${_(r.key, r.name)}</td>
      <td style="font-family:'JetBrains Mono',monospace;">${r.invest} B$</td>
      <td style="color:#6b7a8d;">${r.cap}</td>
      <td style="width:80px;"><div class="inv-bar" style="width:${r.pct}%"></div></td>
    `;
    tbody.appendChild(tr);
  });
}

// ─── Перевод ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const origSetLang = window.setLang;
  if (origSetLang) {
    window.setLang = function(lang) {
      origSetLang(lang);
      renderPlants();
      if (lastResult) _applyResults(lastResult, getSliders());
    };
  }
});

// ─── Старт ─────────────────────────────────────────────────────
renderPlants();
initDataset();   // → async: пробует backend, потом recalc()
