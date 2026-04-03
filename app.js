
const users = {
  'ali@kzleap.kz':    { name: 'Ali B.',    role: 'analyst',     password: 'kzleap2026' },
  'aliya@kzleap.kz':  { name: 'Aliya S.',  role: 'researcher',  password: 'kzleap2026' },
  'aizada@kzleap.kz': { name: 'Aizada Y.', role: 'policymaker', password: 'kzleap2026' },
};

let selectedRole = 'analyst';

function selectRole(role, btn) {
  selectedRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');


  const emailMap = {
    analyst:     'ali@kzleap.kz',
    researcher:  'aliya@kzleap.kz',
    policymaker: 'aizada@kzleap.kz',
  };
  document.getElementById('email').value = emailMap[role];
}


function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-msg');

  const user = users[email];

  if (!user || user.password !== password) {
    errorMsg.style.display = 'block';
    return;
  }

  if (user.role !== selectedRole) {
    errorMsg.textContent = `This account is registered as "${user.role}", not "${selectedRole}".`;
    errorMsg.style.display = 'block';
    return;
  }


  sessionStorage.setItem('kzleap_user', JSON.stringify(user));


  window.location.href = 'dashboard.html';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') handleLogin();
});