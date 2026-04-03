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

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('dragover');
}

function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const validTypes = ['.xlsx', '.csv', '.json'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validTypes.includes(ext)) {
    showToast('Invalid file type. Please upload .xlsx, .csv or .json');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large. Maximum size is 50 MB');
    return;
  }

  // Show progress
  const prog = document.getElementById('upload-progress');
  prog.style.display = 'block';
  document.getElementById('up-filename').textContent = file.name;
  document.getElementById('up-filesize').textContent = (file.size / 1024).toFixed(1) + ' KB';

  let pct = 0;
  const bar = document.getElementById('up-bar');
  const pctEl = document.getElementById('up-pct');
  const interval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 15, 100);
    bar.style.width = Math.round(pct) + '%';
    pctEl.textContent = Math.round(pct) + '%';
    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        prog.style.display = 'none';
        addToTable(file);
        showToast('✓ ' + file.name + ' uploaded successfully!');
      }, 400);
    }
  }, 150);
}

function addToTable(file) {
  const tbody = document.getElementById('datasets-table');
  const row = document.createElement('tr');
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  row.innerHTML = `
    <td><div class="ds-name">${file.name}</div><div class="ds-sub">Uploaded ${date}</div></td>
    <td>—</td>
    <td>—</td>
    <td>${(file.size / 1024).toFixed(0)} KB</td>
    <td>${user.name}</td>
    <td><span class="ds-status active">● Active</span></td>
    <td><button class="btn-sm" onclick="previewDataset(this)">Preview</button> <button class="btn-sm red" onclick="deleteDataset(this)">Delete</button></td>
  `;
  tbody.insertBefore(row, tbody.firstChild);
}

function previewDataset(btn) {
  const name = btn.closest('tr').querySelector('.ds-name').textContent;
  showToast('Opening preview for ' + name + '...');
}

function deleteDataset(btn) {
  if (confirm('Delete this dataset?')) {
    btn.closest('tr').remove();
    showToast('Dataset deleted.');
  }
}