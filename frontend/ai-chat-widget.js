
(function() {
  const API_URL = 'http://localhost:8000/api/claude';

  const style = document.createElement('style');
  style.textContent = `
    #kzai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%);
      box-shadow: 0 4px 16px rgba(29,158,117,0.45);
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #kzai-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(29,158,117,0.55); }
    #kzai-fab svg { width: 26px; height: 26px; fill: #fff; }

    #kzai-panel {
      position: fixed; bottom: 96px; right: 28px; z-index: 9998;
      width: 360px; max-height: 520px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,.14);
      border: 1px solid #e8ecf0;
      display: flex; flex-direction: column;
      transform: scale(0.92) translateY(16px); opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.4,0,.2,1), opacity .22s;
    }
    #kzai-panel.open {
      transform: scale(1) translateY(0); opacity: 1; pointer-events: all;
    }
    #kzai-header {
      padding: 14px 16px; border-bottom: 1px solid #f0f0f0;
      display: flex; align-items: center; gap: 10px;
    }
    .kzai-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #1D9E75, #0F6E56);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 15px; font-weight: 700; flex-shrink: 0;
    }
    #kzai-title { font-size: 14px; font-weight: 600; color: #1a2332; }
    #kzai-subtitle { font-size: 11px; color: #6b7a8d; }
    #kzai-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: #888; font-size: 20px; line-height: 1; padding: 2px 6px;
    }
    #kzai-messages {
      flex: 1; overflow-y: auto; padding: 14px 14px 6px;
      display: flex; flex-direction: column; gap: 10px; min-height: 200px;
    }
    .kzai-msg { max-width: 86%; font-size: 13px; line-height: 1.55; }
    .kzai-msg.user {
      align-self: flex-end;
      background: #1D9E75; color: #fff;
      padding: 8px 12px; border-radius: 12px 12px 2px 12px;
    }
    .kzai-msg.bot {
      align-self: flex-start;
      background: #f4f5f7; color: #1a2332;
      padding: 8px 12px; border-radius: 12px 12px 12px 2px;
    }
    .kzai-msg.bot.typing { opacity: 0.6; }
    #kzai-input-row {
      padding: 10px 12px; border-top: 1px solid #f0f0f0;
      display: flex; gap: 8px; align-items: flex-end;
    }
    #kzai-input {
      flex: 1; border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 8px 12px; font-size: 13px; resize: none;
      font-family: inherit; outline: none; max-height: 80px; min-height: 38px;
      line-height: 1.4;
    }
    #kzai-input:focus { border-color: #1D9E75; }
    #kzai-send {
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: #1D9E75; color: #fff; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    #kzai-send:hover { background: #0F6E56; }
    #kzai-send:disabled { background: #ccc; cursor: default; }
    .kzai-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; }
    .kzai-chip {
      font-size: 11px; padding: 4px 10px; border-radius: 16px;
      border: 1px solid #e0e0e0; background: #fafafa; color: #555;
      cursor: pointer; transition: all .15s;
    }
    .kzai-chip:hover { border-color: #1D9E75; color: #1D9E75; background: #e1f5ee; }
  `;
  document.head.appendChild(style);

  // ── Detect page context ───────────────────────────────────────────────
  function getPageContext() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    const contexts = {
      'dashboard.html':    'The user is on the Dashboard page showing KPIs: current CO₂ 242 Mt, electricity 115 TWh, renewables share ~5%. Kazakhstan energy overview.',
      'scenario.html':     'The user is on the Scenario Builder page. They can run BAU (Business as Usual), MT (Moderate Transition), DD (Deep Decarbonization) scenarios, or build a custom scenario.',
      'results.html':      'The user is on the Simulation Results page showing forecast charts for CO₂, electricity, renewables share, coal/gas share up to 2060.',
      'whatif.html':       'The user is on the What-If Analyzer. They can run LP optimization for specific years and demand levels to find optimal electricity mix.',
      'lp-optimizer.html': 'The user is on the LP Optimizer page. Linear programming finds minimum-cost electricity generation mix with constraints on renewables target, CO₂ budget, nuclear availability.',
      'sensitivity.html':  'The user is on Sensitivity Analysis. They apply shocks (±% changes) to parameters like gas price, coal price, solar CAPEX, carbon price to see impact on optimal mix.',
      'carbon-budget.html':'The user is on Carbon Budget page showing Kazakhstan\'s remaining carbon budget vs IPCC 1.5°C and 2°C pathways (KZ share = 0.6% of global).',
      'scenario-ai.html':  'The user is on Smart Scenario Analysis page which combines LP optimization with AI-generated policy recommendations.',
      'reports.html':      'The user is on Reports page. They can export scenario data to CSV or generate AI-written reports.',
      'map.html':          'The user is on the Energy Map page showing Kazakhstan power plants (coal, gas, hydro, wind, solar, nuclear) with scenario overlays.',
      'upload.html':       'The user is on the Upload Dataset page. They can upload an Excel (KZLEAP format) or CSV (OWID/World Bank) file to replace built-in data.',
    };
    return contexts[page] || 'The user is using the KZLEAP platform — Kazakhstan Energy Forecasting Platform.';
  }

  const SYSTEM_PROMPT = `You are KZLeap AI Assistant — an expert in Kazakhstan energy policy, energy transition, and climate economics. You help users understand the KZLEAP platform results and Kazakhstan's energy situation.

Context: ${getPageContext()}

Key facts about Kazakhstan energy:
- Current CO₂: 242 Mt/year (2023), base year 1990: 290 Mt
- NDC target: -15% unconditional, -25% conditional from 1990 level by 2030
- Carbon neutrality target: 2060
- Current electricity mix: 61% coal, 24% gas, 10% hydro, 3.5% wind, 1.5% solar
- 3 scenarios: BAU (coal stays), MT (moderate NDC), DD (deep decarbonization to 2060)

Respond in the same language the user writes in (Russian or English). Be concise, practical, and helpful. When discussing numbers, be specific. Keep replies to 2-4 sentences unless more detail is requested.`;

  function getChips() {
    const page = (window.location.pathname.split('/').pop() || '');
    const defaults = ['What is Kazakhstan\'s NDC target?', 'Explain the 3 scenarios', 'How is CO₂ calculated?'];
    const map = {
      'dashboard.html':    ['Why is CO₂ = 242 Mt?', 'What is NDC?', 'Compare scenarios briefly'],
      'scenario.html':     ['How does DD differ from MT?', 'What is BAU?', 'How to set custom scenario?'],
      'results.html':      ['Why does CO₂ rise in BAU?', 'When will RE reach 50%?', 'Explain Simulation Results'],
      'lp-optimizer.html': ['What is LCOE?', 'Why is coal cheaper?', 'How does LP optimization work?'],
      'sensitivity.html':  ['What is sensitivity analysis?', 'Which parameter matters most?'],
      'carbon-budget.html':['What is the IPCC carbon budget?', 'When will KZ exhaust 1.5°C budget?'],
      'map.html':          ['Largest coal plant in Kazakhstan?', 'Where are new wind farms?', 'What will Ulken NPP give?'],
    };
    return map[page] || defaults;
  }

  
  const fab = document.createElement('button');
  fab.id = 'kzai-fab';
  fab.title = 'Ask AI Assistant';
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  const panel = document.createElement('div');
  panel.id = 'kzai-panel';
  panel.innerHTML = `
    <div id="kzai-header">
      <div class="kzai-avatar">AI</div>
      <div>
        <div id="kzai-title">KZLEAP Assistant</div>
        <div id="kzai-subtitle">Ask anything about Kazakhstan energy</div>
      </div>
      <button id="kzai-close">×</button>
    </div>
    <div id="kzai-messages">
      <div class="kzai-msg bot">👋 Hi! I'm your KZLEAP AI assistant. I can explain scenario results, LP optimization, carbon budgets, or anything about Kazakhstan's energy transition. What would you like to know?</div>
    </div>
    <div class="kzai-chips" id="kzai-chips"></div>
    <div id="kzai-input-row">
      <textarea id="kzai-input" placeholder="Ask about energy, scenarios, results..." rows="1"></textarea>
      <button id="kzai-send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);


  const chipsEl = document.getElementById('kzai-chips');
  getChips().forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'kzai-chip';
    btn.textContent = chip;
    btn.onclick = () => sendMessage(chip);
    chipsEl.appendChild(btn);
  });

 
  let isOpen = false;
  fab.onclick = () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
  };
  document.getElementById('kzai-close').onclick = () => {
    isOpen = false;
    panel.classList.remove('open');
  };

  
  const history = [];

  
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    const msgs = document.getElementById('kzai-messages');
    const sendBtn = document.getElementById('kzai-send');
    const input = document.getElementById('kzai-input');

   
    const userBubble = document.createElement('div');
    userBubble.className = 'kzai-msg user';
    userBubble.textContent = text;
    msgs.appendChild(userBubble);

    
    const typingBubble = document.createElement('div');
    typingBubble.className = 'kzai-msg bot typing';
    typingBubble.textContent = '...';
    msgs.appendChild(typingBubble);
    msgs.scrollTop = msgs.scrollHeight;

    input.value = '';
    sendBtn.disabled = true;

    history.push({ role: 'user', content: text });

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: history,
          max_tokens: 512,
          stream: false
        })
      });
      const data = await res.json();
     
      const reply = data?.choices?.[0]?.message?.content
        || data?.content?.[0]?.text
        || 'Sorry, I could not get a response. Make sure the backend is running.';

      typingBubble.textContent = reply;
      typingBubble.classList.remove('typing');
      history.push({ role: 'assistant', content: reply });
    } catch(e) {
      typingBubble.textContent = '⚠️ Connection error. Make sure the backend server is running on localhost:8000.';
      typingBubble.classList.remove('typing');
    }

    sendBtn.disabled = false;
    msgs.scrollTop = msgs.scrollHeight;
  }


  document.getElementById('kzai-send').onclick = () => {
    sendMessage(document.getElementById('kzai-input').value.trim());
  };
  document.getElementById('kzai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value.trim());
    }
  });
})();