async function callClaudeStream(messages, onChunk) {
  const lang = getCurrentLang(); // из reports.js

  const systemByLang = {
    en: 'You are an expert energy economist specializing in Kazakhstan energy policy. Write clear, professional analytical reports in English. Use plain text only — no markdown, no asterisks, no hashes, no bullet symbols. Use numbered sections separated by blank lines.',
    ru: 'Вы — эксперт-энергетик, специализирующийся на энергетической политике Казахстана. Пишите чёткие профессиональные аналитические отчёты на русском языке. Только обычный текст — без маркдауна, звёздочек, знаков решётки и маркеров списков. Разделы нумеруйте и разделяйте пустой строкой.',
    kk: 'Сіз — Қазақстанның энергетика саясатына маманданған энергетика экономисі-сарапшысысыз. Қазақ тілінде нақты, кәсіби талдамалық есептер жазыңыз. Тек қарапайым мәтін — маркдаун, жұлдызша, торкөз белгілері мен тізім маркерлерінсіз. Бөлімдерді нөмірлеп, бос жолмен бөліңіз.',
  };

  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 1000,
      stream: true,
      system: systemByLang[lang] || systemByLang['en'],
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
  output.textContent  = rpt('toast_pdf_gen'); // '⏳ Preparing...'
  sub.textContent     = '...';
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

  const lang  = getCurrentLang();
  const today = new Date().toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const prompt = `${rpt('ai_prompt_intro')}

${contextBlock}

${rpt('ai_prompt_structure')}

Report date: ${today}
${rpt('ai_prompt_footer')}`;

  output.textContent = '';
  try {
    await callClaudeStream([{ role: 'user', content: prompt }], chunk => {
      output.textContent += chunk;
    });
    const doneLabel = { en: 'Report generated', ru: 'Отчёт сформирован', kk: 'Есеп жасалды' };
    sub.textContent = (doneLabel[lang] || doneLabel['en']) + ' · ' + today;
    addToHistory('KZLEAP_AI_Report_' + new Date().getFullYear() + '.txt', 'AI', 'BAU + MT + DD');
    showToast(rpt('toast_ai_ok'));
  } catch (err) {
    const errLabel = { en: 'Report generation failed: ', ru: 'Ошибка генерации: ', kk: 'Қате: ' };
    output.textContent = (errLabel[lang] || errLabel['en']) + err.message;
    sub.textContent = 'Error';
  }
}

function copyAIReport() {
  const text = document.getElementById('ai-report-output').textContent;
  navigator.clipboard.writeText(text).then(() => showToast(rpt('toast_copied')));
}

function printAIReport() {
  const text  = document.getElementById('ai-report-output').textContent;
  const lang  = getCurrentLang();
  const today = new Date().toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${rpt('ai_title')}</title>
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
<div class="btn-bar"><button onclick="window.print()">${rpt('btn_print_save')}</button></div>
<h1>${rpt('ai_title')}</h1>
<div class="meta">${rpt('generated')}: ${today} · ${rpt('ai_platform')}</div>
<div class="content">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<div class="footer">KZLEAP v1.0 · LEAP methodology · LP optimization: PuLP/CBC · AI analysis</div>
</body></html>`);
  win.document.close();
}