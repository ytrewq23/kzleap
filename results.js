
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

const years = [];
for (let y = 2021; y <= 2050; y++) years.push(y);

const bauData = years.map(y => Math.round(342 * Math.pow(1.02, y - 2023)));

const lcData = years.map(y => {
  if (y <= 2023) return 342;
  const t = y - 2023;
  return Math.round(342 * Math.pow(1.005, t) * Math.pow(0.975, t));
});

const bauEnergy = years.map(y => Math.round(1782 * Math.pow(1.018, y - 2023)));
const lcEnergy  = years.map(y => Math.round(1782 * Math.pow(1.005, y - 2023)));

new Chart(document.getElementById('co2Chart'), {
  type: 'line',
  data: {
    labels: years,
    datasets: [
      {
        label: 'BAU',
        data: bauData,
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.08)',
        tension: 0.3,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
      {
        label: 'Low Carbon',
        data: lcData,
        borderColor: '#1D9E75',
        backgroundColor: 'rgba(29,158,117,0.08)',
        tension: 0.3,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' Mt CO₂'
        }
      }
    },
    scales: {
      y: {
        ticks: { callback: v => v + ' Mt', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        ticks: {
          font: { size: 11 },
          autoSkip: true,
          maxTicksLimit: 10
        },
        grid: { display: false }
      }
    }
  }
});

new Chart(document.getElementById('energyChart'), {
  type: 'line',
  data: {
    labels: years,
    datasets: [
      {
        label: 'BAU',
        data: bauEnergy,
        borderColor: '#378ADD',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Low Carbon',
        data: lcEnergy,
        borderColor: '#1D9E75',
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: v => v + ' PJ', font: { size: 10 } } },
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 6 }, grid: { display: false } }
    }
  }
});

new Chart(document.getElementById('fuelChart'), {
  type: 'bar',
  data: {
    labels: ['Coal', 'Natural Gas', 'Oil', 'Renewables', 'Nuclear'],
    datasets: [
      { label: 'BAU 2050',        data: [45, 25, 20, 8,  2],  backgroundColor: '#378ADD' },
      { label: 'Low Carbon 2050', data: [15, 20, 15, 42, 8],  backgroundColor: '#1D9E75' },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: v => v + '%', font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } }, grid: { display: false } }
    }
  }
});

function buildTable(filter) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const milestones = [2025, 2030, 2035, 2040, 2045, 2050];

  years.forEach((y, i) => {
    if (filter === '5' && !milestones.includes(y) && y !== 2021 && y !== 2023) return;

    const bau = bauData[i];
    const lc  = lcData[i];
    const diff = bau - lc;
    const pct  = Math.round((diff / bau) * 100);

    const tr = document.createElement('tr');
    if (milestones.includes(y)) tr.classList.add('milestone');

    tr.innerHTML = `
      <td><strong>${y}</strong></td>
      <td class="bau-val">${bau.toLocaleString()} Mt</td>
      <td class="lc-val">${lc.toLocaleString()} Mt</td>
      <td class="diff-val">−${diff.toLocaleString()} Mt</td>
      <td class="pct-val">−${pct}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTable(mode) {
  buildTable(mode);
}

buildTable('5');