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





const dropzone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone?.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});
dropzone?.addEventListener('click', () => fileInput?.click());
fileInput?.addEventListener('change', e => { if (e.target.files.length) handleFiles(e.target.files); });

function handleDragOver(e) { e.preventDefault(); dropzone?.classList.add('dragover'); }
function handleDragLeave()  { dropzone?.classList.remove('dragover'); }
function handleDrop(e)      { e.preventDefault(); dropzone?.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }

async function handleFiles(files) {
  for (const file of files) await uploadFile(file);
}

async function uploadFile(file) {
  const name = file.name.toLowerCase();
  const allowed = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');

  if (!allowed) {
    showResult('error', file.name, 'Unsupported format. Use .xlsx (KZLEAP template) or .csv (OWID / World Bank)');
    return;
  }

  showProgress(file);
  showResult('loading', file.name, 'Uploading...');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${BACKEND}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    hideProgress();
    const data = await res.json();

    if (!res.ok) {
      showResult('error', file.name, data.detail || 'Upload failed');
      return;
    }

    let summary = '';
    if (data.source === 'kzleap_excel') {
      const s = data.summary;
      summary = `Excel loaded · base year ${s.base_year} · CO2 ${s.base_co2_mt} Mt · Elec ${s.base_elec_twh} TWh`;
    } else if (data.source === 'owid') {
      summary = `Our World in Data · ${data.summary.indicator} · ${data.summary.years_range} · ${data.summary.data_points} data points`;
    } else if (data.source === 'worldbank') {
      summary = `World Bank · ${data.summary.indicators_found} indicators · ${(data.summary.energy_indicators || []).join(', ')}`;
    }

    showResult('success', file.name, summary);
    addToTable(file.name, data.source, summary, data.dataset_id);
    showToast('File uploaded successfully');

  } catch (err) {
    hideProgress();
    showResult('error', file.name, 'Backend not running. Start with: uvicorn main:app --reload --port 8000');
  }
}

function showProgress(file) {
  const card = document.getElementById('upload-progress');
  if (!card) return;
  card.style.display = 'block';
  const fn = document.getElementById('up-filename');
  const fs = document.getElementById('up-filesize');
  if (fn) fn.textContent = file.name;
  if (fs) fs.textContent = (file.size / 1024).toFixed(1) + ' KB';

  let pct = 0;
  const bar = document.getElementById('up-bar');
  const pctEl = document.getElementById('up-pct');
  const interval = setInterval(() => {
    pct = Math.min(pct + 10, 90);
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (pct >= 90) clearInterval(interval);
  }, 150);
  card._interval = interval;
}

function hideProgress() {
  const card = document.getElementById('upload-progress');
  if (!card) return;
  if (card._interval) clearInterval(card._interval);
  const bar = document.getElementById('up-bar');
  const pctEl = document.getElementById('up-pct');
  if (bar) bar.style.width = '100%';
  if (pctEl) pctEl.textContent = '100%';
  setTimeout(() => { card.style.display = 'none'; }, 800);
}

function showResult(type, filename, message) {
  const el = document.getElementById('upload-result');
  if (!el) return;
  const colors = { success: '#e1f5ee', error: '#fff3f3', loading: '#f0f4ff' };
  const icons  = { success: '✓', error: '✗', loading: '...' };
  el.style.display    = 'block';
  el.style.background = colors[type] || '#f5f5f5';
  el.style.padding    = '12px 16px';
  el.style.borderRadius = '8px';
  el.style.marginTop  = '12px';
  el.style.fontSize   = '13px';
  el.style.color      = type === 'error' ? '#c0392b' : type === 'success' ? '#0F6E56' : '#333';
  el.textContent = `${icons[type]} ${filename}: ${message}`;
}

function addToTable(name, source, summary, id) {
  const tbody = document.getElementById('datasets-table');
  if (!tbody) return;
  const sourceLabels = {
    kzleap_excel: 'KZLEAP Excel',
    owid:         'Our World in Data',
    worldbank:    'World Bank WDI',
  };
  const today = new Date().toLocaleDateString('en-GB');
  const tr = document.createElement('tr');
  tr.setAttribute('data-id', id);
  tr.innerHTML = `
    <td><div class="ds-name">${name}</div></td>
    <td>${sourceLabels[source] || source}</td>
    <td>${today}</td>
    <td>${user.name}</td>
    <td style="font-size:11px;color:#666;">${summary}</td>
    <td><span class="ds-status active">● Active</span></td>
    <td><button class="btn-sm red" onclick="deleteDatasetById('${id}', this)">Delete</button></td>
  `;
  tbody.prepend(tr);
}

async function deleteDatasetById(id, btn) {
  if (!confirm('Delete this dataset?')) return;
  try {
    const res = await fetch(`${BACKEND}/api/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      btn.closest('tr')?.remove();
      showToast('Dataset deleted');
    }
  } catch {}
}

async function loadExisting() {
  try {
    const res = await fetch(`${BACKEND}/api/datasets`);
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('datasets-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(ds => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', ds.dataset_id);
      tr.innerHTML = `
        <td><div class="ds-name">${ds.filename}</div></td>
        <td>${ds.source || '—'}</td>
        <td>${ds.uploaded_at || '—'}</td>
        <td>${ds.uploaded_by || '—'}</td>
        <td style="font-size:11px;color:#666;">—</td>
        <td><span class="ds-status active">● Active</span></td>
        <td><button class="btn-sm red" onclick="deleteDatasetById('${ds.dataset_id}', this)">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch {}
}

async function downloadTemplate() {
  try {
    const res = await fetch(`${BACKEND}/api/template`);
    if (!res.ok) { showToast('Template download failed'); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'KZLEAP_DATA_TEMPLATE.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  } catch { showToast('Backend not running'); }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

loadExisting();
