async function callClaudeStream(messages, onChunk) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 1000,
      stream: true,
      system: 'You are an expert energy economist specializing in Kazakhstan energy policy. Write clear, professional analytical reports in English. Use plain text only — no markdown, no asterisks, no hashes, no bullet symbols. Use numbered sections separated by blank lines.',
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
  sub.textContent     = 'Generating with Claude...';

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let bau = null, mt = null, dd = null;

  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (res.ok) {
      const data = await res.json();
      bau = data.BAU; mt = data.MT; dd = data.DD;
    }
  } catch {}

  let contextBlock = 'Scenario data unavailable — base analysis only.';

  if (bau && mt && dd) {
    const pick = (arr, years, targets) =>
      targets.map(y => {
        const i = years.indexOf(y);
        return i >= 0 ? Math.round(arr[i]) : null;
      }).filter(v => v !== null);

    const years   = bau.years;
    const bauCO2  = pick(bau.co2,  years, [2025, 2030, 2040, 2050, 2060]);
    const mtCO2   = pick(mt.co2,   years, [2025, 2030, 2040, 2050, 2060]);
    const ddCO2   = pick(dd.co2,   years, [2025, 2030, 2040, 2050, 2060]);
    const bauElec = pick(bau.electricity || [], years, [2030, 2040, 2050]);
    const mtElec  = pick(mt.electricity  || [], years, [2030, 2040, 2050]);
    const ddElec  = pick(dd.electricity  || [], years, [2030, 2040, 2050]);

    contextBlock = `Kazakhstan Energy Model Results (KZLEAP)
Scenarios: BAU (Business as Usual), MT (Moderate Transition), DD (Deep Decarbonization)
Period: 2024-2060

CO2 Emissions (Mt) at milestones [2025, 2030, 2040, 2050, 2060]:
BAU:  ${bauCO2.join(', ')}
MT:   ${mtCO2.join(', ')}
DD:   ${ddCO2.join(', ')}

Electricity demand (TWh) [2030, 2040, 2050]:
BAU:  ${bauElec.join(', ')}
MT:   ${mtElec.join(', ')}
DD:   ${ddElec.join(', ')}

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
    await callClaudeStream([{ role: 'user', content: prompt }], (chunk) => {
      output.textContent += chunk;
    });
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
  const text = document.getElementById('ai-report-output').textContent;
  const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>KZLEAP AI Report</title>
<style>
  body { font-family: Arial, sans-serif; margin: 48px; color: #1a2b4a; font-size: 13px; line-height: 1.8; }
  h1 { font-size: 20px; color: #0F6E56; margin-bottom: 4px; }
  .meta { color: #888; font-size: 11px; margin-bottom: 32px; }
  .content { white-space: pre-wrap; }
  .footer { margin-top: 48px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { button { display: none; } }
  .btn-bar { position: fixed; top: 16px; right: 16px; }
  button { padding: 8px 18px; background: #0F6E56; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
</style></head><body>
<div class="btn-bar"><button onclick="window.print()">Print / Save PDF</button></div>
<h1>KZLEAP — AI Analytical Report</h1>
<div class="meta">Generated: ${today} · Kazakhstan Energy Forecasting Platform</div>
<div class="content">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<div class="footer">KZLEAP v1.0 · LEAP methodology · LP optimization: PuLP/CBC · AI analysis: Claude</div>
</body></html>`);
  win.document.close();
}
