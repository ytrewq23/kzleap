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

if (user.role === 'researcher') {
  document.querySelectorAll('.btn-generate').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    btn.title = 'Available for Policymaker and Analyst only';
  });
  const msg = document.createElement('div');
  msg.style.cssText = 'background:#fff3cd;color:#856404;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;';
  msg.textContent = '⚠ Report generation is available for Policymaker and Analyst roles only.';
  document.querySelector('.content')?.prepend(msg);
}

// ── CSV export ─────────────────────────────────────────────────────────────
async function exportExcel() {
  showToast('⏳ Generating CSV export...');
  try {
    const res = await fetch(`${BACKEND}/api/export/csv`);
    if (!res.ok) throw new Error('Backend error');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const converted = lines.map(line => line.split(',').join(';')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + converted], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'KZLEAP_Scenarios_2024_2060.csv');
    addToHistory('KZLEAP_Scenarios_2024_2060.csv', 'CSV', 'BAU + MT + DD');
    showToast('✓ CSV exported successfully!');
  } catch {
    showToast('✗ Backend not running. Start with: uvicorn main:app --reload');
  }
}

async function exportSummary() {
  showToast('⏳ Generating summary...');
  try {
    const res = await fetch(`${BACKEND}/api/export/summary`);
    if (!res.ok) throw new Error('Backend error');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const converted = lines.map(line => line.split(',').join(';')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + converted], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'KZLEAP_Summary.csv');
    addToHistory('KZLEAP_Summary.csv', 'CSV', 'BAU + MT + DD · Milestones');
    showToast('✓ Summary exported!');
  } catch {
    showToast('✗ Backend not running.');
  }
}

// ── PDF generation ─────────────────────────────────────────────────────────
async function generatePDF() {
  showToast('⏳ Preparing report...');

  let bau = null, mt = null, dd = null;
  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (res.ok) {
      const data = await res.json();
      bau = data.BAU; mt = data.MT; dd = data.DD;
    }
  } catch {}

  const idx2050 = bau?.years?.indexOf(2050) ?? -1;
  const bau2050 = idx2050 >= 0 ? bau.co2[idx2050] : 311;
  const mt2050  = idx2050 >= 0 ? mt.co2[idx2050]  : 210;
  const dd2050  = idx2050 >= 0 ? dd.co2[idx2050]  : 127;
  const today   = new Date().toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const filename = 'KZLEAP_Full_Report_' + new Date().getFullYear() + '.pdf';

  const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KZLEAP — Full Scenario Report</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a2b4a; font-size: 13px; }
    h1 { font-size: 24px; color: #0F6E56; margin-bottom: 4px; }
    h2 { font-size: 16px; border-bottom: 2px solid #e8eef5; padding-bottom: 6px; margin-top: 32px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .card { background: #f8fffe; border: 1px solid #d4ede7; border-radius: 8px; padding: 16px; }
    .card-val { font-size: 28px; font-weight: 700; color: #0F6E56; }
    .card-label { font-size: 11px; color: #666; margin-top: 4px; }
    .card.red .card-val { color: #D85A30; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #f0f4f8; padding: 8px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .ndc { color: #0F6E56; font-weight: 600; }
    .footer { margin-top: 48px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
    .btn-bar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-pdf { background: #0F6E56; color: white; }
    .btn-print { background: #f0f4f8; color: #1a2b4a; }
    @media print { .btn-bar { display: none; } }
  </style>
</head>
<body>
  <div class="btn-bar">
    <button class="btn btn-print" onclick="window.print()">🖨 Print</button>
    <button class="btn btn-pdf" onclick="savePDF()">⬇ Save PDF</button>
  </div>

  <h1>KZLEAP — Kazakhstan Energy Scenario Report</h1>
  <div class="meta">
    Generated: ${today} · KZLEAP v1.0 · Energy Analyst: ${user.name}<br>
    Scenarios: BAU · Moderate Transition (MT) · Deep Decarbonization (DD) · Period: 2024–2060<br>
    Model: LEAP-methodology energy accounting + LP optimization · Data: IEA, KEGOC, BNS KZ, Our World in Data
  </div>

  <h2>Executive Summary</h2>
  <div class="grid">
    <div class="card red">
      <div class="card-val">${Math.round(bau2050)} Mt</div>
      <div class="card-label">BAU CO₂ by 2050 · +${Math.round((bau2050-242)/242*100)}% vs 2023</div>
    </div>
    <div class="card">
      <div class="card-val">${Math.round(mt2050)} Mt</div>
      <div class="card-label">MT CO₂ by 2050 · −${Math.round((bau2050-mt2050)/bau2050*100)}% vs BAU</div>
    </div>
    <div class="card">
      <div class="card-val">${Math.round(dd2050)} Mt</div>
      <div class="card-label">DD CO₂ by 2050 · −${Math.round((bau2050-dd2050)/bau2050*100)}% vs BAU</div>
    </div>
  </div>

  <h2>NDC Compliance Assessment</h2>
  <table>
    <thead><tr><th>Scenario</th><th>CO₂ 2030 (Mt)</th><th>NDC −15% (246 Mt)</th><th>NDC −25% (217 Mt)</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>BAU</td><td>${bau ? Math.round(bau.co2[bau.years.indexOf(2030)]) : '—'} Mt</td><td>✗ Above</td><td>✗ Above</td><td>Non-compliant</td></tr>
      <tr><td>Moderate Transition</td><td>${mt ? Math.round(mt.co2[mt.years.indexOf(2030)]) : '—'} Mt</td><td class="ndc">✓ Met</td><td>✗ Above</td><td>Partially compliant</td></tr>
      <tr><td>Deep Decarbonization</td><td>${dd ? Math.round(dd.co2[dd.years.indexOf(2030)]) : '—'} Mt</td><td class="ndc">✓ Met</td><td class="ndc">✓ Met</td><td>Fully compliant</td></tr>
    </tbody>
  </table>

  <h2>CO₂ Projections 2025–2060</h2>
  <table>
    <thead><tr><th>Year</th><th>BAU (Mt CO₂)</th><th>MT (Mt CO₂)</th><th>DD (Mt CO₂)</th><th>DD vs BAU reduction</th></tr></thead>
    <tbody>
      ${[2025,2030,2035,2040,2045,2050,2060].map(y => {
        if (!bau) return '';
        const i = bau.years.indexOf(y);
        if (i < 0) return '';
        const b = Math.round(bau.co2[i]), m = Math.round(mt.co2[i]), d = Math.round(dd.co2[i]);
        const pct = Math.round((b-d)/b*100);
        const ndcMark = y === 2030 ? ' <span class="ndc">← NDC year</span>' : '';
        return '<tr><td><strong>' + y + '</strong>' + ndcMark + '</td><td>' + b + ' Mt</td><td>' + m + ' Mt</td><td>' + d + ' Mt</td><td>−' + (b-d) + ' Mt (−' + pct + '%)</td></tr>';
      }).join('')}
    </tbody>
  </table>

  <h2>Key Assumptions</h2>
  <table>
    <thead><tr><th>Parameter</th><th>BAU</th><th>MT</th><th>DD</th></tr></thead>
    <tbody>
      <tr><td>Renewables by 2050</td><td>15%</td><td>40%</td><td>70%</td></tr>
      <tr><td>Coal share by 2050</td><td>45%</td><td>25%</td><td>5%</td></tr>
      <tr><td>Carbon price (2030)</td><td>$5/t</td><td>$20/t</td><td>$50/t</td></tr>
      <tr><td>Nuclear (GW by 2035)</td><td>0</td><td>1.2 GW</td><td>2.4 GW</td></tr>
      <tr><td>EV penetration 2050</td><td>10%</td><td>30%</td><td>80%</td></tr>
    </tbody>
  </table>

  <div class="footer">
    KZLEAP — Kazakhstan Energy Forecasting Platform · Based on LEAP methodology (SEI) ·
    Data sources: IEA, KEGOC, BNS Kazakhstan, Our World in Data, World Bank WDI ·
    LP optimization: PuLP/CBC solver
  </div>

  <script>
    async function savePDF() {
      const btn = document.querySelector('.btn-pdf');
      btn.textContent = '⏳ Saving...';
      btn.disabled = true;
      try {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(document.body, {
          scale: 2, useCORS: true,
          ignoreElements: el => el.classList.contains('btn-bar')
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = (canvas.height * pdfW) / canvas.width;
        const pageH = pdf.internal.pageSize.getHeight();
        let yOffset = 0;
        while (yOffset < pdfH) {
          if (yOffset > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfW, pdfH);
          yOffset += pageH;
        }
        pdf.save('${filename}');
        btn.textContent = '✓ Saved!';
        setTimeout(() => { btn.textContent = '⬇ Save PDF'; btn.disabled = false; }, 2000);
      } catch(e) {
        btn.textContent = '✗ Error'; btn.disabled = false; console.error(e);
      }
    }
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(reportHTML);
  win.document.close();
  addToHistory(filename, 'PDF', 'BAU + MT + DD');
  showToast('✓ Report opened — click "Save PDF" button in the report');
}

async function generateSummary() {
  showToast('⏳ Generating executive summary...');
  await generatePDF();
}

// ── AI Report (streaming, language-aware) ──────────────────────────────────
async function callClaudeStream(messages, onChunk) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 1000,
      stream: true,
      // getLangInstruction() is defined in translations.js — responds in the UI language
      system: 'You are an expert energy economist specializing in Kazakhstan energy policy. Write clear, professional analytical reports. Use plain text only — no markdown, no asterisks, no hashes, no bullet symbols. Use numbered sections separated by blank lines.' + getLangInstruction(),
      messages,
    }),
  });
  if (!response.ok) throw new Error('Claude API error ' + response.status);

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onChunk(text);
      } catch {}
    }
  }
}

async function generateAIReport() {
  const panel  = document.getElementById('ai-report-panel');
  const output = document.getElementById('ai-report-output');
  const sub    = document.getElementById('ai-report-sub');

  panel.style.display = 'block';
  output.textContent  = 'Fetching scenario data...';
  sub.textContent     = 'Generating with AI...';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let bau = null, mt = null, dd = null;
  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (res.ok) { const data = await res.json(); bau = data.BAU; mt = data.MT; dd = data.DD; }
  } catch {}

  let contextBlock = 'Scenario data unavailable — base analysis only.';
  if (bau && mt && dd) {
    const pick = (arr, years, targets) =>
      targets.map(y => { const i = years.indexOf(y); return i >= 0 ? Math.round(arr[i]) : null; }).filter(v => v !== null);
    const years = bau.years;
    contextBlock = `Kazakhstan Energy Model Results (KZLEAP)
Scenarios: BAU (Business as Usual), MT (Moderate Transition), DD (Deep Decarbonization)
Period: 2024-2060

CO2 Emissions (Mt) at milestones [2025, 2030, 2040, 2050, 2060]:
BAU:  ${pick(bau.co2,  years, [2025,2030,2040,2050,2060]).join(', ')}
MT:   ${pick(mt.co2,   years, [2025,2030,2040,2050,2060]).join(', ')}
DD:   ${pick(dd.co2,   years, [2025,2030,2040,2050,2060]).join(', ')}

Electricity demand (TWh) [2030, 2040, 2050]:
BAU:  ${pick(bau.electricity||[], years, [2030,2040,2050]).join(', ')}
MT:   ${pick(mt.electricity ||[], years, [2030,2040,2050]).join(', ')}
DD:   ${pick(dd.electricity ||[], years, [2030,2040,2050]).join(', ')}

Kazakhstan NDC targets: -15% CO2 by 2030 (246 Mt), -25% by 2030 (217 Mt) vs 2005 baseline of ~290 Mt.`;
  }

  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `Write a professional analytical report on Kazakhstan's energy transition based on the following model results.

${contextBlock}

Structure the report with these four numbered sections:

1. Executive Summary
Two paragraphs covering the key finding across scenarios and Kazakhstan's decarbonization trajectory.

2. Scenario Analysis
Compare BAU, MT, and DD across CO2 trajectory, NDC compliance, and electricity demand growth. Use the numbers provided.

3. Key Risks and Opportunities
Three to four paragraphs on the main structural challenges (coal dependence, grid infrastructure, financing) and opportunities (solar and wind potential, nuclear option, regional export).

4. Policy Recommendations
Four to five concrete recommendations for policymakers with specific numerical targets where possible.

Report date: ${today}
Keep total length around 350-400 words. Plain text only — no markdown, no asterisks, no hashes.`;

  output.textContent = '';
  try {
    await callClaudeStream([{ role: 'user', content: prompt }], chunk => { output.textContent += chunk; });
    sub.textContent = 'Report generated · ' + today;
    addToHistory('KZLEAP_AI_Report_' + new Date().getFullYear() + '.txt', 'AI', 'BAU + MT + DD');
    showToast('AI report generated successfully');
  } catch (err) {
    output.textContent = 'Report generation failed: ' + err.message;
    sub.textContent = 'Error';
  }
}

function copyAIReport() {
  const text = document.getElementById('ai-report-output').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Report copied to clipboard'));
}

function printAIReport() {
  const text  = document.getElementById('ai-report-output').textContent;
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const win   = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>KZLEAP AI Report</title>
<style>
  body{font-family:Arial,sans-serif;margin:48px;color:#1a2b4a;font-size:13px;line-height:1.8;}
  h1{font-size:20px;color:#0F6E56;margin-bottom:4px;}
  .meta{color:#888;font-size:11px;margin-bottom:32px;}
  .content{white-space:pre-wrap;}
  .footer{margin-top:48px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;}
  @media print{button{display:none;}}
  .btn-bar{position:fixed;top:16px;right:16px;}
  button{padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;}
</style></head><body>
<div class="btn-bar"><button onclick="window.print()">Print / Save PDF</button></div>
<h1>KZLEAP — AI Analytical Report</h1>
<div class="meta">Generated: ${today} · Kazakhstan Energy Forecasting Platform</div>
<div class="content">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<div class="footer">KZLEAP v1.0 · LEAP methodology · LP optimization: PuLP/CBC · AI analysis</div>
</body></html>`);
  win.document.close();
}

// ── Utilities ──────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addToHistory(filename, type, scenarios) {
  const tbody = document.getElementById('reports-table');
  if (!tbody) return;
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  const tagColor     = type === 'PDF' ? '#fdecea' : '#e8f5e9';
  const tagTextColor = type === 'PDF' ? '#c0392b' : '#1B5E20';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div style="font-weight:500;">${filename}</div></td>
    <td><span style="background:${tagColor};color:${tagTextColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${type}</span></td>
    <td>${scenarios}</td>
    <td>${user.name}</td>
    <td>${today}</td>
    <td><button onclick="showToast('File already downloaded')" style="font-size:12px;padding:4px 10px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#fff;">Download</button></td>
  `;
  tbody.prepend(tr);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}