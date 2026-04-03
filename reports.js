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

const access = { analyst: ['nav-upload','nav-scenario','nav-simulation'], researcher: ['nav-upload','nav-scenario'], policymaker: [] };
['nav-upload','nav-scenario','nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  if (el && !access[user.role].includes(id)) el.classList.add('locked');
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function generateReport(name, type) {
  showToast('Generating ' + name + '...');
  setTimeout(() => {
    const tbody = document.getElementById('reports-table');
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const ext = type === 'Excel' ? '.xlsx' : '.pdf';
    const filename = name.replace(/ /g, '_') + '_' + new Date().getFullYear() + ext;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><div class="file-name">${filename}</div><div class="file-size">~1.2 MB</div></td>
      <td><span class="tag ${type === 'Excel' ? 'excel-tag' : 'pdf-tag'}">${type === 'Excel' ? 'Excel' : 'PDF'}</span></td>
      <td>BAU + Low Carbon</td>
      <td>${user.name}</td>
      <td>${date}</td>
      <td><button class="btn-dl" onclick="downloadReport(this)">Download</button></td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
    showToast('✓ ' + name + ' generated successfully!');
  }, 1500);
}

function downloadReport(btn) {
  const row = btn.closest('tr');
  const name = row.querySelector('.file-name').textContent;
  showToast('✓ Downloading ' + name);
}