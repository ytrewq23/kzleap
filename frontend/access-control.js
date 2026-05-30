

const ACCESS_RULES = {
  'dashboard.html':        ['researcher', 'policymaker', 'analyst'],
  'upload.html':           ['analyst'],
  'scenario.html':         ['researcher', 'analyst'],
  'results.html':          ['researcher', 'policymaker', 'analyst'],
  'whatif.html':           ['researcher', 'policymaker', 'analyst'],
  'reports.html':          ['policymaker', 'analyst'],
  'lp-optimizer.html':     ['analyst'],
  'scenario-ai.html':      ['policymaker', 'analyst'],
  'sensitivity.html':      ['analyst'],
  'carbon-budget.html':    ['researcher', 'policymaker', 'analyst'],
  'map.html':              ['researcher', 'policymaker', 'analyst'],
  'compare-countries.html':['researcher', 'policymaker', 'analyst'],
  'investment-calculator.html': ['policymaker', 'analyst'],
};

// Сообщения по ролям
const ACCESS_DENIED_MSG = {
  en: 'This page is not available for your role.',
  ru: 'Эта страница недоступна для вашей роли.',
  kk: 'Бұл бет сіздің рөліңіз үшін қолжетімді емес.',
};

(function checkAccess() {
  const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{}');
  const role = user.role || '';

  // Не залогинен — на логин
  if (!role) {
    window.location.href = 'index.html';
    return;
  }

  // Определяем текущую страницу
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  const allowed = ACCESS_RULES[page];

  // Если страница в правилах и роль не разрешена
  if (allowed && !allowed.includes(role)) {
    const lang = localStorage.getItem('lang') || 'en';
    const msg = ACCESS_DENIED_MSG[lang] || ACCESS_DENIED_MSG['en'];

    // Показываем баннер вместо редиректа
    document.addEventListener('DOMContentLoaded', function () {
      // Блокируем интерактивные элементы
      const allInputs = document.querySelectorAll('input, button, select, textarea');
      allInputs.forEach(el => {
        if (el.id !== 'dark-mode-btn' && !el.classList.contains('lang-btn')) {
          el.disabled = true;
          el.style.pointerEvents = 'none';
          el.style.opacity = '0.4';
        }
      });

      // Вставляем баннер
      const banner = document.createElement('div');
      banner.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffc107;
        color: #856404;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 16px;
      `;
      banner.textContent = msg;

      const main = document.querySelector('.main-content') || document.querySelector('.content') || document.querySelector('.main') || document.body;
      main.insertBefore(banner, main.firstChild);
    });
  }
})();