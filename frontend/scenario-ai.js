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

(async function checkBackend() {
  try {
    const r = await fetch(`${BACKEND}/api/config`);
    const el = document.getElementById('backend-badge');
    el.textContent = r.ok ? '● Backend connected' : '● Offline mode';
    el.style.color  = r.ok ? '#0F6E56' : '#B07C10';
  } catch {
    const el = document.getElementById('backend-badge');
    el.textContent = '● Offline mode';
    el.style.color = '#B07C10';
  }
})();

const TECH_LABELS = {
  coal: 'Coal', gas: 'Natural Gas', hydro: 'Hydro',
  wind: 'Wind', solar: 'Solar PV', nuclear: 'Nuclear',
};

function setExample(btn) {
  document.getElementById('ai-goal-input').value = btn.textContent.trim();
}

function setProgress(text) {
  document.getElementById('sai-progress').style.display = 'block';
  document.getElementById('sai-progress-text').textContent = text;
}

function hideProgress() {
  document.getElementById('sai-progress').style.display = 'none';
}

async function callClaudeStream(messages, system, onChunk) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: 1000, stream: true }),
  });
  if (!response.ok) throw new Error('AI API error ' + response.status);

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

async function runSmartAnalysis() {
  const goal = document.getElementById('ai-goal-input').value.trim();
  if (!goal) return;

  const btn          = document.getElementById('ai-run-btn');
  const errorBox     = document.getElementById('sai-error');
  const runsGrid     = document.getElementById('sai-runs-grid');
  const runsMetrics  = document.getElementById('sai-runs-metrics');
  const resultPanel  = document.getElementById('sai-result-panel');
  const resultOutput = document.getElementById('sai-result-output');
  const resultSub    = document.getElementById('sai-result-sub');

  btn.disabled = true;
  btn.textContent = 'Running...';
  errorBox.style.display   = 'none';
  runsGrid.style.display   = 'none';
  resultPanel.style.display = 'none';
  runsMetrics.innerHTML    = '';
  resultOutput.textContent = '';

  try {
    setProgress('Translating goal into LP parameters...');

    const paramsRes = await fetch(`${BACKEND}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You are an energy modeling assistant. Extract LP optimization parameters from a natural language policy goal. Respond ONLY with a valid JSON object and nothing else — no explanation, no markdown, no code fences.',
        messages: [{
          role: 'user',
          content: `Extract LP optimization parameters from this goal: "${goal}"

The available scenarios are exactly these three — use their codes as-is:
- "BAU" = Business as Usual (no new climate policy, coal-dominated)
- "MT" = Moderate Transition (gradual decarbonization, renewables growing to 40% by 2050)
- "DD" = Deep Decarbonization (aggressive climate policy, 70% RE by 2050, coal phase-out)

Return a JSON object with these fields:
- scenarios: array of scenario codes to run — ALWAYS include all three ["BAU","MT","DD"] unless the user explicitly asks for specific ones
- years: array of target years, chosen from [2030,2035,2040,2050,2060] (pick 1-2 most relevant to the goal)
- interpretation: one sentence explaining what the user is asking for, using full names: "Business as Usual", "Moderate Transition", "Deep Decarbonization"

Example: {"scenarios":["BAU","MT","DD"],"years":[2035,2050],"interpretation":"Comparing all three scenarios to find the cheapest route to 50% renewables."}`
        }],
        max_tokens: 300,
        stream: false,
      }),
    });

    const paramsData = await paramsRes.json();
    const rawText = (paramsData.choices?.[0]?.message?.content || '').trim();
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const params = JSON.parse(cleaned);

    const total = params.scenarios.length * params.years.length;
    setProgress(`Running ${total} LP optimization${total > 1 ? 's' : ''}...`);

    const runs = [];
    for (const scenario of params.scenarios) {
      for (const year of params.years) {
        const r = await fetch(`${BACKEND}/api/optimize/quick/${scenario}/${year}`);
        if (r.ok) {
          const d = await r.json();
          if (!d.error) runs.push(d);
        }
      }
    }

    if (runs.length === 0) throw new Error('All LP runs failed. Make sure the backend is running.');

    runsGrid.style.display = 'block';
    runs.forEach(r => {
      const card = document.createElement('div');
      card.className = 'metric-card';
      const scenarioColors = { BAU: '#4a5568', MT: '#1D9E75', DD: '#534AB7' };
      const scenarioNames = { BAU: 'Business as Usual', MT: 'Moderate Transition', DD: 'Deep Decarbonization' };
      card.innerHTML = `
        <div class="metric-label" style="color:${scenarioColors[r.scenario] || '#333'};font-weight:700;">${scenarioNames[r.scenario] || r.scenario} · ${r.year}</div>
        <div style="margin-top:8px;font-size:12px;color:#555;line-height:1.8;">
          <div>Cost: <strong>${r.total_cost_bn_usd} B$/yr</strong></div>
          <div>CO2: <strong>${r.total_co2_mt} Mt</strong></div>
          <div>RE share: <strong>${r.re_share_pct}%</strong></div>
          <div>Generation: <strong>${r.total_gen_twh} TWh</strong></div>
        </div>
      `;
      runsMetrics.appendChild(card);
    });

    const runsSummary = runs.map(r =>
      `${r.scenario} ${r.year}: cost=${r.total_cost_bn_usd}B$/yr, CO2=${r.total_co2_mt}Mt, RE=${r.re_share_pct}%, generation=${r.total_gen_twh}TWh, LCOE=${r.lcoe_estimate_usd_mwh}$/MWh`
    ).join('\n');

    setProgress('Generating analysis...');
    resultPanel.style.display = 'block';
    resultSub.textContent = `${params.interpretation} · Claude`;
    resultOutput.textContent = '';

    await callClaudeStream(
      [{ role: 'user', content: `A user asked: "${goal}"\n\nLP optimization results for Kazakhstan's electricity system:\n${runsSummary}\n\nProvide a direct answer to the user's question using these results. Compare the scenarios, identify the best option for their stated goal, and give a concrete recommendation with numbers. Keep it under 200 words. Plain text only, no markdown.` }],
      'You are an expert energy economist specializing in Kazakhstan energy policy. Provide concise, data-driven analysis in English. Use plain text only — no markdown, no bullet symbols, no asterisks. Use short paragraphs separated by line breaks.',
      (chunk) => { resultOutput.textContent += chunk; }
    );

    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    errorBox.style.display = 'block';
    errorBox.textContent = 'Analysis failed: ' + err.message;
  }

  hideProgress();
  btn.disabled = false;
  btn.textContent = 'Run analysis';
}

function copySAIResult() {
  const text = document.getElementById('sai-result-output').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.sai-copy-btn');
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}
