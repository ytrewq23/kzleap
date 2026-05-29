const BACKEND = 'http://localhost:8000';
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
  if (tabId === 'tab-mt') resetPreview('mt');
  if (tabId === 'tab-dd') resetPreview('dd');
}

function resetPreview(type) {
  const r = document.getElementById('co2-result-' + type);
  const s = document.getElementById('co2-sub-' + type);
  const n = document.getElementById('ndc-status-' + type);
  if (r) r.textContent = '— Mt';
  if (s) s.textContent = 'Save scenario to calculate';
  if (n) { n.className = 'ndc-badge'; n.textContent = ''; }
}

function getSlider(type, cls) {
  return parseFloat(document.querySelector(`#tab-${type} .${cls}`)?.value ?? 0);
}

function showResult(type, data, params) {
  const idx2050 = data.years?.indexOf(2050);
  const idx2030 = data.years?.indexOf(2030);
  const co2_2050 = idx2050 >= 0 ? Math.round(data.co2[idx2050]) : null;
  const co2_2030 = idx2030 >= 0 ? Math.round(data.co2[idx2030]) : null;
  const base = 242;

  if (co2_2050 === null) return;

  const pctVsBase = Math.round((base - co2_2050) / base * 100);
  const sign = pctVsBase >= 0 ? '−' : '+';

  const r = document.getElementById('co2-result-' + type);
  const s = document.getElementById('co2-sub-' + type);
  const n = document.getElementById('ndc-status-' + type);

  if (r) r.textContent = co2_2050 + ' Mt';
  if (s) s.textContent = `${sign}${Math.abs(pctVsBase)}% vs 2023 baseline · CO2 2030: ${co2_2030} Mt`;
  if (n) {
    if (co2_2030 !== null && co2_2030 <= 217) {
      n.className = 'ndc-badge green';
      n.textContent = '✓ NDC conditional target met (−25% vs 1990)';
    } else if (co2_2030 !== null && co2_2030 <= 246) {
      n.className = 'ndc-badge amber';
      n.textContent = '~ NDC unconditional target met (−15% vs 1990)';
    } else {
      n.className = 'ndc-badge red';
      n.textContent = '✗ Above NDC 2030 target';
    }
  }
}

function collectParams(type) {
  const base = type === 'mt' ? 'MT' : type === 'dd' ? 'DD' : 'BAU';
  const nameEl = document.querySelector(`#tab-${type} input[type="text"]`);
  return {
    name:    nameEl?.value || base + ' Custom',
    base:    base,
    renewables_2050:       getSlider(type, 'sl-re'),
    coal_phase_rate:       getSlider(type, 'sl-coal'),
    efficiency:            getSlider(type, 'sl-eff'),
    carbon_price:          getSlider(type, 'sl-cp'),
    ev_share:              getSlider(type, 'sl-ev'),
    nuclear_gw:            getSlider(type, 'sl-nuc') || (type === 'mt' ? 1.2 : type === 'dd' ? 2.4 : 0),
    pop_growth_rate:       getSlider(type, 'sl-pop') || 1.2,
    urbanization_rate:     getSlider(type, 'sl-urban') || 0.3,
    working_age_2050:      getSlider(type, 'sl-working') || 64.0,
    gdp_per_capita_growth: getSlider(type, 'sl-gdp') || 3.0,
    income_elasticity:     getSlider(type, 'sl-elasticity') || 0.6,
  };
}

async function saveScenario(type) {
  const labels = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const tagClass = { BAU: 'blue', MT: 'amber', DD: 'green' };
  const t = type.toLowerCase();
  const params = collectParams(t);

  const btn = document.querySelector(`#tab-${t} .btn-primary`);
  if (btn) { btn.textContent = 'Calculating...'; btn.disabled = true; }

  const r = document.getElementById('co2-result-' + t);
  const s = document.getElementById('co2-sub-' + t);
  if (r) r.textContent = '...';
  if (s) s.textContent = 'Running model on backend...';

  try {
    const res = await fetch(`${BACKEND}/api/run/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) throw new Error('Backend error');
    const data = await res.json();

    const stored = JSON.parse(sessionStorage.getItem('kzleap_custom_results') || '{}');
    stored[type] = { params, results: data, saved_at: new Date().toISOString() };
    sessionStorage.setItem('kzleap_custom_results', JSON.stringify(stored));
    sessionStorage.setItem('kzleap_last_scenario', type);

    showResult(t, data, params);

    const idx2050 = data.years?.indexOf(2050);
    const co2_2050 = idx2050 >= 0 ? Math.round(data.co2[idx2050]) + ' Mt' : '—';

    addToTable(type, labels[type], tagClass[type], co2_2050, params.name);

    if (btn) { btn.textContent = '✓ Saved!'; setTimeout(() => { btn.textContent = `Save ${type} Scenario`; btn.disabled = false; }, 2000); }
    showToast(`✓ ${labels[type]} saved · CO2 2050: ${co2_2050}`);

  } catch (err) {
    if (btn) { btn.textContent = `Save ${type} Scenario`; btn.disabled = false; }
    if (r) r.textContent = 'Error';
    if (s) s.textContent = 'Backend not running';
    showToast('Error: backend not running');
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
    <td>CO2 2050: <strong>${co2_2050}</strong></td>
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
  resetPreview('mt');
  resetPreview('dd');
});
