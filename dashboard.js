
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
  if (el && !access[user.role].includes(id)) {
    el.classList.add('locked');
  }
});

new Chart(document.getElementById('sectorChart'), {
  type: 'bar',
  data: {
    labels: ['Residential', 'Road transport', 'Commercial', 'Iron & Steel', 'Nonferrous', 'Mining', 'Chemical'],
    datasets: [
      { label: '2021', data: [635, 302, 235, 162, 139, 83, 37], backgroundColor: '#378ADD' },
      { label: '2022', data: [577, 295, 292, 156, 135, 75, 37], backgroundColor: '#1D9E75' },
      { label: '2023', data: [582, 342, 250, 139, 121, 71, 47], backgroundColor: '#D85A30' },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 11 }, maxRotation: 30 } },
      y: { ticks: { callback: v => v + 'k', font: { size: 11 } } }
    }
  }
});

new Chart(document.getElementById('pieChart'), {
  type: 'doughnut',
  data: {
    labels: ['Residential', 'Transport', 'Industry', 'Other'],
    datasets: [{
      data: [33, 19, 16, 32],
      backgroundColor: ['#378ADD', '#1D9E75', '#D85A30', '#7F77DD'],
      borderWidth: 0
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  }
});

new Chart(document.getElementById('ironChart'), {
  type: 'line',
  data: {
    labels: ['2021', '2022', '2023'],
    datasets: [
      { label: 'Electricity', data: [51.7, 47.2, 50.4], borderColor: '#378ADD', tension: 0.3, borderWidth: 2, fill: false },
      { label: 'Heat',        data: [28.4, 22.9, 21.0], borderColor: '#1D9E75', tension: 0.3, borderWidth: 2, fill: false },
      { label: 'Coal',        data: [23.7, 32.1, 24.1], borderColor: '#D85A30', tension: 0.3, borderWidth: 2, fill: false },
      { label: 'Natural Gas', data: [14.4, 15.2, 12.1], borderColor: '#7F77DD', tension: 0.3, borderWidth: 2, fill: false },
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: v => v + 'k TJ', font: { size: 11 } } },
      x: { ticks: { font: { size: 11 } } }
    }
  }
});