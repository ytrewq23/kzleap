const BACKEND = 'https://kzleap.onrender.com';

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

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-msg');
  errorMsg.style.display = 'none';

  try {
    const res = await fetch(`${BACKEND}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.detail || (typeof t === 'function' ? t('login_error_default') : 'Invalid email or password.');
      errorMsg.style.display = 'block';
      return;
    }

    sessionStorage.setItem('kzleap_user', JSON.stringify(data));

    if (data.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }

  } catch {
    errorMsg.textContent = typeof t === 'function' ? t('login_error_default') : 'Cannot connect to server.';
    errorMsg.style.display = 'block';
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') handleLogin();
});

document.addEventListener('DOMContentLoaded', function () {
  if (typeof applyTranslations === 'function') applyTranslations();
});
