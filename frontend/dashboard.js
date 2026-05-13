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

['nav-upload', 'nav-scenario', 'nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  const access = { analyst: true, researcher: true, policymaker: false };
  if (el && !access[user.role]) el.classList.add('locked');
});

async function loadDashboard() {
  let co2Data = null, wbData = null;

  try {
    const dsRes = await fetch(`${BACKEND}/api/datasets`);
    if (dsRes.ok) {
      const datasets = await dsRes.json();

      const owidKey = Object.keys(datasets).find(k => datasets[k].source === 'owid');
      if (owidKey) {
        const co2Res = await fetch(`${BACKEND}/api/datasets/${encodeURIComponent(owidKey)}/co2`);
        if (co2Res.ok) co2Data = await co2Res.json();
      }

      const wbKey = Object.keys(datasets).find(k => datasets[k].source === 'worldbank');
      if (wbKey) {
        const wbRes = await fetch(`${BACKEND}/api/datasets/${encodeURIComponent(wbKey)}/co2`);
        if (wbRes.ok) wbData = await wbRes.json();
      }
    }
  } catch {}

  let hist = null;
  try {
    const res = await fetch(`${BACKEND}/api/historical`);
    if (res.ok) hist = await res.json();
  } catch {}

  renderAll(co2Data, wbData, hist);
}

function renderAll(co2Data, wbData, hist) {
  let co2Years, co2Values;

  if (co2Data && co2Data.years && co2Data.years.length > 0) {
    co2Years  = co2Data.years;
    co2Values = co2Data.values;
    showDataBadge('co2-source', 'Our World in Data (uploaded)');
  } else if (hist) {
    const pairs = hist.years.map((y,i) => [y, hist.co2[i]]).filter(p => p[1] != null);
    co2Years  = pairs.map(p => p[0]);
    co2Values = pairs.map(p => p[1]);
    showDataBadge('co2-source', 'Built-in data (IEA)');
  } else {
    co2Years  = [1990,2000,2010,2015,2020,2023];
    co2Values = [290, 140, 230, 250, 235, 242];
  }

  let gdpYears = [], gdpValues = [];
  if (wbData && wbData.indicators) {
    const gdpInd = wbData.indicators.find(i => i.code === 'NY.GDP.MKTP.CD');
    if (gdpInd) {
      const pairs = Object.entries(gdpInd.data)
        .map(([y,v]) => [+y, v/1e9])
        .filter(p => p[0] >= 1990)
        .sort((a,b) => a[0]-b[0]);
      gdpYears  = pairs.map(p => p[0]);
      gdpValues = pairs.map(p => Math.round(p[1]*10)/10);
    }
  }

  let reYears = [], reValues = [];
  if (wbData && wbData.indicators) {
    const reInd = wbData.indicators.find(i => i.code === 'EG.ELC.RNEW.ZS');
    if (reInd) {
      const pairs = Object.entries(reInd.data)
        .map(([y,v]) => [+y, v])
        .filter(p => p[0] >= 1990)
        .sort((a,b) => a[0]-b[0]);
      reYears  = pairs.map(p => p[0]);
      reValues = pairs.map(p => Math.round(p[1]*10)/10);
    }
  }

  const lastCO2 = co2Values[co2Values.length - 1] || 242;
  const ndcTarget = 246.5;
  const ndcGap = Math.round(lastCO2 - ndcTarget);
  const lastYear = co2Years[co2Years.length - 1] || 2023;

  setKPI('kpi-co2',  Math.round(lastCO2) + ' Mt',
    `CO₂ ${lastYear} · Source: ${co2Data ? 'Our World in Data' : 'IEA'}`);
  setKPI('kpi-elec', '115 TWh', 'Electricity 2023 · KEGOC');
  setKPI('kpi-tpes', '85 Mtoe', 'Total primary energy 2023 · IEA');
  setKPI('kpi-ndc',
    (ndcGap > 0 ? '+' : '') + ndcGap + ' Mt',
    ndcGap > 0 ? 'Above NDC 2030 target (−15% vs 1990)' : '✓ Below NDC target');

  const ndc = 246.5;
  const colors = co2Values.map(v => v > ndc ? '#D85A30' : '#1D9E75');

  renderChart('sectorChart', {
    type: 'bar',
    data: {
      labels: co2Years,
      datasets: [
        {
          label: 'CO₂ emissions (Mt)',
          data: co2Values,
          backgroundColor: colors,
          borderRadius: 3,
        },
        {
          label: 'NDC −15% target (246 Mt)',
          data: co2Years.map(() => ndc),
          type: 'line',
          borderColor: '#B07C10',
          borderWidth: 1.5,
          borderDash: [5,4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' Mt CO₂' } }
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { min: 0, ticks: { callback: v => v + ' Mt', font: { size: 10 } } }
      }
    }
  });

  const mix = hist?.elec_mix_2023 || { coal:61, gas:24, hydro:10, wind:3.5, solar:1.5 };
  renderChart('pieChart', {
    type: 'doughnut',
    data: {
      labels: ['Coal', 'Gas', 'Hydro', 'Wind', 'Solar'],
      datasets: [{ data: [mix.coal, mix.gas, mix.hydro, mix.wind, mix.solar],
        backgroundColor: ['#4a4a6a','#378ADD','#5BB8F5','#1D9E75','#F5A623'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + '%' } }
      }
    }
  });

  if (gdpYears.length > 0) {
    renderChart('ironChart', {
      type: 'line',
      data: {
        labels: gdpYears,
        datasets: [{
          label: 'GDP (Billion USD)',
          data: gdpValues,
          borderColor: '#7F77DD',
          backgroundColor: 'rgba(127,119,221,0.08)',
          tension: 0.35, borderWidth: 2.5, fill: true, pointRadius: 3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => '$' + ctx.parsed.y + 'B' } }
        },
        scales: {
          y: { ticks: { callback: v => '$' + v + 'B', font: { size: 10 } } },
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } }
        }
      }
    });
    const titleEl = document.querySelector('#ironChart')?.closest('.card')?.querySelector('.card-title');
    if (titleEl) titleEl.textContent = 'GDP 1990–2023 (World Bank data)';
    const subEl = document.querySelector('#ironChart')?.closest('.card')?.querySelector('.card-sub');
    if (subEl) subEl.textContent = 'Kazakhstan · Billion USD · Source: World Bank WDI (uploaded)';
  }
}

function renderChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  new Chart(el, config);
}

function setKPI(id, value, sub) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = el.querySelector('.metric-value');
  const s = el.querySelector('.metric-change');
  if (v) v.textContent = value;
  if (s) s.textContent = sub;
}

function showDataBadge(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

loadDashboard();
function confirmDelete() {
  const modal = document.getElementById('delete-modal');
  modal.style.display = 'flex';
  document.getElementById('delete-password').value = '';
  document.getElementById('delete-error').style.display = 'none';
}

function closeDeleteModal() {
  document.getElementById('delete-modal').style.display = 'none';
}

async function deleteAccount() {
  const password = document.getElementById('delete-password').value.trim();
  const error = document.getElementById('delete-error');
  error.style.display = 'none';

  if (!password) {
    error.textContent = 'Please enter your password.';
    error.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${BACKEND}/api/delete-account`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.detail || 'Failed to delete account.';
      error.style.display = 'block';
      return;
    }

    sessionStorage.clear();
    window.location.href = 'index.html';

  } catch {
    error.textContent = 'Cannot connect to server.';
    error.style.display = 'block';
  }
}