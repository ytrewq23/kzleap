const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', text: 'Energy Analyst' },
  researcher:  { bg: '#eeedfe', color: '#3C3489', text: 'Researcher' },
  policymaker: { bg: '#faece7', color: '#712B13', text: 'Policymaker' },
};
const avatarColors = { analyst: '#1D9E75', researcher: '#534AB7', policymaker: '#993C1D' };

document.getElementById('user-name').textContent = user.name;
document.getElementById('user-role').textContent = badgeStyles[user.role].text;
document.getElementById('user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('');
document.getElementById('user-avatar').style.background = avatarColors[user.role];
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

const access = { analyst: ['nav-upload','nav-scenario','nav-simulation'], researcher: ['nav-upload','nav-scenario'], policymaker: [] };
['nav-upload','nav-scenario','nav-simulation'].forEach(id => {
  const el = document.getElementById(id);
  if (el && !access[user.role].includes(id)) el.classList.add('locked');
});

function startSimulation() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running...';

  document.getElementById('progress-bar-wrap').style.display = 'block';
  document.getElementById('progress-sub').textContent = 'Simulation in progress...';

  const steps = [
    { id: 1, delay: 0,    duration: 1200 },
    { id: 2, delay: 1200, duration: 1000 },
    { id: 3, delay: 2200, duration: 2000 },
    { id: 4, delay: 4200, duration: 2000 },
    { id: 5, delay: 6200, duration: 800  },
  ];

  const totalTime = 7000;

  const bar = document.getElementById('progress-bar');
  let pct = 0;
  const barInterval = setInterval(() => {
    pct = Math.min(pct + 1, 98);
    bar.style.width = pct + '%';
    if (pct >= 98) clearInterval(barInterval);
  }, totalTime / 100);

  steps.forEach(step => {
    setTimeout(() => {
      const dot = document.querySelector(`#step-${step.id} .step-dot`);
      const status = document.getElementById(`s${step.id}-status`);
      dot.className = 'step-dot running';
      status.textContent = 'Running...';
      status.className = 'step-status running';
    }, step.delay);

    setTimeout(() => {
      const dot = document.querySelector(`#step-${step.id} .step-dot`);
      const status = document.getElementById(`s${step.id}-status`);
      dot.className = 'step-dot done';
      status.textContent = '✓ Done';
      status.className = 'step-status done';
    }, step.delay + step.duration);
  });

  setTimeout(() => {
    clearInterval(barInterval);
    bar.style.width = '100%';
    document.getElementById('progress-sub').textContent = 'Completed successfully';
    document.getElementById('done-msg').style.display = 'block';
    btn.textContent = '✓ Simulation Complete';
    btn.style.background = '#0F6E56';
  }, 7200);
}