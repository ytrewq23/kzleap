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

const access = {
  analyst:     ['nav-upload', 'nav-scenario', 'nav-simulation'],
  researcher:  ['nav-upload', 'nav-scenario'],
  policymaker: [],
};
['nav-upload', 'nav-scenario', 'nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  if (el && !access[user.role].includes(id)) el.classList.add('locked');
});

const dropzone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone?.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length) handleFiles(files);
});
dropzone?.addEventListener('click', () => fileInput?.click());
fileInput?.addEventListener('change', e => { if (e.target.files.length) handleFiles(e.target.files); });

async function handleFiles(files) {
  for (const file of files) {
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  if (!file.name.endsWith('.csv')) {
    showResult('error', file.name, 'Only CSV files supported (.csv)');
    return;
  }

  showResult('loading', file.name, 'Uploading...');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${BACKEND}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      showResult('error', file.name, data.detail || 'Upload failed');
      return;
    }

    let summary = '';
    if (data.source === 'owid') {
      summary = `✓ Our World in Data · ${data.summary.indicator} · ${data.summary.years_range} · ${data.summary.data_points} data points`;
    } else if (data.source === 'worldbank') {
      summary = `✓ World Bank · ${data.summary.indicators_found} indicators · Energy indicators: ${data.summary.energy_indicators.join(', ')}`;
    }

    showResult('success', file.name, summary, data.dataset_id);

    const stored = JSON.parse(sessionStorage.getItem('kzleap_datasets') || '[]');
    stored.push({ id: data.dataset_id, name: file.name, source: data.source, summary });
    sessionStorage.setItem('kzleap_datasets', JSON.stringify(stored));

    addToTable(file.name, data.source, summary, data.dataset_id);

  } catch (err) {
    showResult('error', file.name, 'Backend not running. Start with: python main.py');
  }
}

function showResult(type, filename, message) {
  const el = document.getElementById('upload-result');
  if (!el) return;
  const colors = { success: '#e1f5ee', error: '#fff3f3', loading: '#f0f4ff' };
  const icons  = { success: '✓', error: '✗', loading: '⏳' };
  el.style.display = 'block';
  el.style.background = colors[type] || '#f5f5f5';
  el.style.padding = '12px 16px';
  el.style.borderRadius = '8px';
  el.style.marginTop = '12px';
  el.style.fontSize = '13px';
  el.textContent = `${icons[type]} ${filename}: ${message}`;
}

function addToTable(name, source, summary, id) {
  const tbody = document.getElementById('datasets-table');
  if (!tbody) return;
  const tr = document.createElement('tr');
  const sourceLabel = source === 'owid' ? 'Our World in Data' : 'World Bank WDI';
  const today = new Date().toLocaleDateString('en-GB');
  tr.innerHTML = `
    <td>${name}</td>
    <td><span class="tag blue">${sourceLabel}</span></td>
    <td>${today}</td>
    <td>${user.name}</td>
    <td style="font-size:11px;color:#666;">${summary}</td>
    <td><span class="tag green">Ready</span></td>
  `;
  tbody.prepend(tr);
}

async function loadExisting() {
  try {
    const res = await fetch(`${BACKEND}/api/datasets`);
    if (!res.ok) return;
    const data = await res.json();
    Object.entries(data).forEach(([id, ds]) => {
      addToTable(id, ds.source, ds.indicator || '', id);
    });
  } catch {}
}

loadExisting();
