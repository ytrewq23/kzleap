
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
  const p = prefix || '';
  const s = suffix || '';
  document.getElementById(id).textContent = p + val + s;
}

function calcCO2() {
  const re   = parseFloat(document.querySelector('#tab-lc input[type=range]:nth-of-type(1)') ?.value || 50);
  const coal = parseFloat(document.querySelector('#tab-lc input[type=range]:nth-of-type(2)')?.value || 2);
  const eff  = parseFloat(document.querySelector('#tab-lc input[type=range]:nth-of-type(3)')?.value || 1.5);
  const ev   = parseFloat(document.querySelector('#tab-lc input[type=range]:nth-of-type(5)')?.value || 40);


  const bauCO2 = 487;
  const reduction = (re * 0.3) + (coal * 8) + (eff * 6) + (ev * 0.15);
  const lcCO2 = Math.round(Math.max(bauCO2 - reduction, 150));
  const pct = Math.round(((bauCO2 - lcCO2) / bauCO2) * 100);
  const vs2023 = Math.round(((342 - lcCO2) / 342) * 100);

  document.getElementById('co2-result').textContent = lcCO2 + ' Mt';
  const sign = vs2023 >= 0 ? '−' : '+';
  document.getElementById('co2-reduction').textContent =
    `−${pct}% vs BAU · ${sign}${Math.abs(vs2023)}% vs 2023 baseline`;
}

function saveScenario(type) {
  const tbody = document.getElementById('scenarios-table');
  const row = document.createElement('tr');
  const co2 = type === 'BAU' ? '487 Mt' : document.getElementById('co2-result').textContent;
  row.innerHTML = `
    <td>${type} — Kazakhstan 2050</td>
    <td><span class="tag ${type === 'BAU' ? 'blue' : 'green'}">${type}</span></td>
    <td>2024–2050</td>
    <td>${user.name}</td>
    <td><span class="tag green">Ready</span></td>
    <td><a href="results.html" class="link">View results →</a></td>
  `;
  tbody.appendChild(row);

  const toast = document.getElementById('toast');
  toast.textContent = `✓ ${type} scenario saved successfully!`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}