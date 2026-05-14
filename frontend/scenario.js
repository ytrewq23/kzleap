// KZLEAP — Scenario Builder JS
// Sends parameters to backend /api/run/custom on Save

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
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

function updateSlider(input, id, suffix, prefix) {
  const val = parseFloat(input.value);
  document.getElementById(id).textContent = (prefix || '') + val + (suffix || '');
  const tabId = input.closest('.tab-content')?.id;
  if (tabId === 'tab-mt') calcCO2('mt');
  if (tabId === 'tab-dd') calcCO2('dd');
}

function getSlider(type, cls) {
  return parseFloat(document.querySelector(`#tab-${type} .${cls}`)?.value ?? 0);
}

function calcCO2(type) {
  // Energy levers
  const re   = getSlider(type, 'sl-re');
  const coal = getSlider(type, 'sl-coal');
  const eff  = getSlider(type, 'sl-eff');
  const cp   = getSlider(type, 'sl-cp');
  const ev   = getSlider(type, 'sl-ev');

  // Demographic levers
  const popGrowth   = getSlider(type, 'sl-pop')         || 1.2;   // %/yr
  const urban       = getSlider(type, 'sl-urban')        || 0.3;   // %/yr
  const workingAge  = getSlider(type, 'sl-working')      || 64.0;  // %
  const gdpGrowth   = getSlider(type, 'sl-gdp')          || 3.0;   // %/yr
  const elasticity  = getSlider(type, 'sl-elasticity')   || 0.6;

  // Base BAU CO2 at 2050 (without any policy)
  const bauCO2 = 310;

  // Energy policy reductions
  const energyReduction = (re * 0.35) + (coal * 10) + (eff * 8) + (cp * 0.4) + (ev * 0.15);

  // Demographic adjustments:
  // Higher pop growth → more demand → more CO2
  const popEffect = (popGrowth - 1.2) * 15;  // +15 Mt per extra 1%/yr
  // Higher urbanization → slightly more electricity but less heating → small reduction
  const urbanEffect = -(urban - 0.3) * 5;
  // Higher working age → more industry → more CO2
  const workingEffect = (workingAge - 64) * 1.5;
  // Higher GDP growth → more demand → more CO2
  const gdpEffect = (gdpGrowth - 3.0) * 12;
  // Lower elasticity → less energy per unit GDP → less CO2
  const elasticityEffect = (elasticity - 0.6) * 20;

  const demoAdjustment = popEffect + urbanEffect + workingEffect + gdpEffect + elasticityEffect;

  const co2 = Math.round(Math.max(bauCO2 - energyReduction + demoAdjustment, 30));
  const pct = Math.round(((bauCO2 - co2) / bauCO2) * 100);
  const vs2023 = Math.round(((242 - co2) / 242) * 100);
  const vs2023sign = vs2023 >= 0 ? '−' : '+';

  const r = document.getElementById('co2-result-' + type);
  const s = document.getElementById('co2-sub-' + type);
  const n = document.getElementById('ndc-status-' + type);
  if (r) r.textContent = co2 + ' Mt';
  if (s) s.textContent = `−${pct}% vs BAU · ${vs2023sign}${Math.abs(vs2023)}% vs 2023`;
  if (n) {
    if (co2 <= 217) { n.className = 'ndc-badge green'; n.textContent = '✓ NDC conditional target met (−25% vs 1990)'; }
    else if (co2 <= 246) { n.className = 'ndc-badge amber'; n.textContent = '~ NDC unconditional target met (−15% vs 1990)'; }
    else { n.className = 'ndc-badge red'; n.textContent = '✗ Above NDC 2030 target'; }
  }
}

// ── Collect all parameters from a tab ──
function collectParams(type) {
  const base = type === 'mt' ? 'MT' : type === 'dd' ? 'DD' : 'BAU';
  const nameEl = document.querySelector(`#tab-${type} input[type="text"]`);

  return {
    name:    nameEl?.value || base + ' Custom',
    base:    base,
    // Energy levers
    renewables_2050: getSlider(type, 'sl-re'),
    coal_phase_rate: getSlider(type, 'sl-coal'),
    efficiency:      getSlider(type, 'sl-eff'),
    carbon_price:    getSlider(type, 'sl-cp'),
    ev_share:        getSlider(type, 'sl-ev'),
    nuclear_gw:      getSlider(type, 'sl-nuc') || (type === 'mt' ? 1.2 : type === 'dd' ? 2.4 : 0),
    // Demographic levers
    pop_growth_rate:       getSlider(type, 'sl-pop') || 1.2,
    urbanization_rate:     getSlider(type, 'sl-urban') || 0.3,
    working_age_2050:      getSlider(type, 'sl-working') || 64.0,
    gdp_per_capita_growth: getSlider(type, 'sl-gdp') || 3.0,
    income_elasticity:     getSlider(type, 'sl-elasticity') || 0.6,
  };
}

// ── Save scenario — send to backend ──
async function saveScenario(type) {
  const labels = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const tagClass = { BAU: 'blue', MT: 'amber', DD: 'green' };
  const t = type.toLowerCase();

  const params = collectParams(t);

  // Show loading in button
  const btn = document.querySelector(`#tab-${t} .btn-primary`);
  if (btn) { btn.textContent = '⏳ Saving...'; btn.disabled = true; }

  try {
    const res = await fetch(`${BACKEND}/api/run/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error('Backend error');
    const data = await res.json();

    // Store results in sessionStorage for Results page
    const stored = JSON.parse(sessionStorage.getItem('kzleap_custom_results') || '{}');
    stored[type] = { params, results: data, saved_at: new Date().toISOString() };
    sessionStorage.setItem('kzleap_custom_results', JSON.stringify(stored));
    sessionStorage.setItem('kzleap_last_scenario', type);

    // CO2 2050
    const idx2050 = data.years?.indexOf(2050);
    const co2_2050 = idx2050 >= 0 ? data.co2[idx2050] + ' Mt' : '—';

    // Add to table
    addToTable(type, labels[type], tagClass[type], co2_2050, params.name);

    if (btn) { btn.textContent = '✓ Saved!'; setTimeout(() => { btn.textContent = `Save ${type} Scenario`; btn.disabled = false; }, 2000); }
    showToast(`✓ ${labels[type]} scenario saved! CO₂ 2050: ${co2_2050}`);

  } catch (err) {
    if (btn) { btn.textContent = `Save ${type} Scenario`; btn.disabled = false; }
    showToast('✗ Error: backend not running');
  }
}

function addToTable(type, label, tagClass, co2_2050, name) {
  const tbody = document.getElementById('scenarios-table');
  const old = document.getElementById('saved-' + type);
  if (old) old.remove();

  const row = document.createElement('tr');
  row.id = 'saved-' + type;
  row.innerHTML = `
    <td>${name}</td>
    <td><span class="tag ${tagClass}">${type}</span></td>
    <td>2024–2060</td>
    <td>${user.name}</td>
    <td>CO₂ 2050: <strong>${co2_2050}</strong></td>
    <td><span class="tag green">Ready</span></td>
    <td><a href="results.html?scenario=${type}" class="link">View →</a></td>
  `;
  tbody.appendChild(row);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  calcCO2('mt');
  calcCO2('dd');
});
