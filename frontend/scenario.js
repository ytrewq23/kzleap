const BACKEND_URL = 'http://localhost:8000';
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

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

function updateSlider(input, id, suffix, prefix) {
  const val = parseFloat(input.value);
  document.getElementById(id).textContent = (prefix || '') + val + (suffix || '');
  recalcFromSliders(input.closest('.tab-content')?.id);
}

function recalcFromSliders(tabId) {
  if (!tabId) return;
  if (tabId === 'tab-mt') calcCO2('mt');
  if (tabId === 'tab-dd') calcCO2('dd');
}

function calcCO2(type) {
  const get = (cls) => parseFloat(document.querySelector(`#tab-${type} .${cls}`)?.value ?? 0);
  const re   = get('sl-re');
  const coal = get('sl-coal');
  const eff  = get('sl-eff');
  const cp   = get('sl-cp');
  const ev   = get('sl-ev');

  const bauCO2 = 310;
  const reduction = (re * 0.35) + (coal * 10) + (eff * 8) + (cp * 0.4) + (ev * 0.15);
  const co2 = Math.round(Math.max(bauCO2 - reduction, 30));
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

function saveScenario(type) {
  const labels = { BAU: 'BAU', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
  const tagClass = { BAU: 'blue', MT: 'amber', DD: 'green' };
  let co2 = '310 Mt';
  if (type === 'MT') co2 = document.getElementById('co2-result-mt')?.textContent || '215 Mt';
  if (type === 'DD') co2 = document.getElementById('co2-result-dd')?.textContent || '85 Mt';

  const tbody = document.getElementById('scenarios-table');
  const old = document.getElementById('saved-' + type);
  if (old) old.remove();

  const row = document.createElement('tr');
  row.id = 'saved-' + type;
  row.innerHTML = `
    <td>${labels[type]} — Kazakhstan 2060</td>
    <td><span class="tag ${tagClass[type]}">${type}</span></td>
    <td>2024–2060</td>
    <td>${user.name}</td>
    <td>CO₂ 2050: <strong>${co2}</strong></td>
    <td><span class="tag green">Ready</span></td>
    <td><a href="results.html" class="link">View →</a></td>
  `;
  tbody.appendChild(row);

  const toast = document.getElementById('toast');
  toast.textContent = `✓ ${labels[type]} scenario saved!`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);

  const stored = JSON.parse(sessionStorage.getItem('kzleap_scenarios') || '{}');
  stored[type] = { co2_2050: co2, saved_by: user.name };
  sessionStorage.setItem('kzleap_scenarios', JSON.stringify(stored));
}

document.addEventListener('DOMContentLoaded', () => {
  calcCO2('mt');
  calcCO2('dd');
});
