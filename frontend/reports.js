const BACKEND = 'http://localhost:8000';

const user = JSON.parse(sessionStorage.getItem('kzleap_user') || '{"name":"Ali B.","role":"analyst"}');
const avatarColors = { analyst: '#1D9E75', researcher: '#534AB7', policymaker: '#993C1D' };
const badgeStyles = {
  analyst:     { bg: '#e1f5ee', color: '#085041', get text(){ return typeof t==='function'?t('role_analyst'):'Energy Analyst'; } },
  researcher:  { bg: '#eeedfe', color: '#3C3489', get text(){ return typeof t==='function'?t('role_researcher'):'Researcher'; } },
  policymaker: { bg: '#faece7', color: '#712B13', get text(){ return typeof t==='function'?t('role_policymaker'):'Policymaker'; } },
};
document.getElementById('user-name').textContent = user.name;
document.getElementById('user-role').textContent = badgeStyles[user.role].text;
document.getElementById('user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('');
document.getElementById('user-avatar').style.background = avatarColors[user.role];
const badge = document.getElementById('role-badge');
badge.textContent = badgeStyles[user.role].text;
badge.style.background = badgeStyles[user.role].bg;
badge.style.color = badgeStyles[user.role].color;

function confirmDelete() {
  document.getElementById('delete-modal').style.display = 'flex';
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
  if (!password) { error.textContent = 'Please enter your password.'; error.style.display = 'block'; return; }
  try {
    const res = await fetch(`${BACKEND}/api/delete-account`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: user.email, password }) });
    const data = await res.json();
    if (!res.ok) { error.textContent = data.detail || 'Failed.'; error.style.display = 'block'; return; }
    sessionStorage.clear(); window.location.href = 'index.html';
  } catch { error.textContent = 'Cannot connect to server.'; error.style.display = 'block'; }
}

if (user.role === 'researcher') {
  document.querySelectorAll('.btn-generate').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    btn.title = 'Available for Policymaker and Analyst only';
  });
  const msg = document.createElement('div');
  msg.style.cssText = 'background:#fff3cd;color:#856404;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:13px;';
  msg.textContent = '⚠ Report generation is available for Policymaker and Analyst roles only.';
  document.querySelector('.content')?.prepend(msg);
}

// ── Локализация отчётов ────────────────────────────────────────────────────
// Получаем текущий язык интерфейса (задаётся в translations.js)
function getCurrentLang() {
  return (typeof window.currentLang === 'string' && window.currentLang)
    ? window.currentLang
    : (localStorage.getItem('kzleap_lang') || 'en');
}

const REPORT_I18N = {
  en: {
    // PDF — заголовки
    report_title:        'KZLEAP — Kazakhstan Energy Scenario Report',
    generated:           'Generated',
    analyst_label:       'Energy Analyst',
    scenarios_label:     'Scenarios',
    period_label:        'Period',
    model_label:         'Model',
    exec_summary:        'Executive Summary',
    ndc_section:         'NDC Compliance Assessment',
    co2_section:         'CO₂ Projections 2025–2060',
    assumptions:         'Key Assumptions',
    footer_text:         'KZLEAP — Kazakhstan Energy Forecasting Platform · Based on LEAP methodology (SEI) · Data sources: IEA, KEGOC, BNS Kazakhstan, Our World in Data, World Bank WDI · LP optimization: PuLP/CBC solver',
    // PDF — карточки
    bau_card:            'BAU CO₂ by 2050',
    mt_card:             'MT CO₂ by 2050',
    dd_card:             'DD CO₂ by 2050',
    vs_bau:              'vs BAU',
    vs_2023:             'vs 2023',
    // PDF — таблица NDC
    col_scenario:        'Scenario',
    col_co2_2030:        'CO₂ 2030 (Mt)',
    col_ndc15:           'NDC −15% (246 Mt)',
    col_ndc25:           'NDC −25% (217 Mt)',
    col_status:          'Status',
    ndc_above:           '✗ Above',
    ndc_met:             '✓ Met',
    status_non:          'Non-compliant',
    status_partial:      'Partially compliant',
    status_full:         'Fully compliant',
    // PDF — таблица CO₂
    col_year:            'Year',
    col_bau:             'BAU (Mt CO₂)',
    col_mt:              'MT (Mt CO₂)',
    col_dd:              'DD (Mt CO₂)',
    col_reduction:       'DD vs BAU reduction',
    ndc_year_mark:       '← NDC year',
    // PDF — таблица допущений
    col_param:           'Parameter',
    row_re:              'Renewables by 2050',
    row_coal:            'Coal share by 2050',
    row_carbon:          'Carbon price (2030)',
    row_nuclear:         'Nuclear (GW by 2035)',
    row_ev:              'EV penetration 2050',
    // Кнопки
    btn_print:           '🖨 Print',
    btn_save_pdf:        '⬇ Save PDF',
    saving:              '⏳ Saving...',
    saved:               '✓ Saved!',
    // AI-отчёт
    ai_title:            'KZLEAP — AI Analytical Report',
    ai_platform:         'Kazakhstan Energy Forecasting Platform',
    btn_print_save:      'Print / Save PDF',
    // AI промпт
    ai_prompt_intro:     "Write a professional analytical report on Kazakhstan's energy transition based on the following model results.",
    ai_prompt_structure: `Structure the report with these four numbered sections:

1. Executive Summary
Two paragraphs covering the key finding across scenarios and Kazakhstan's decarbonization trajectory.

2. Scenario Analysis
Compare BAU, MT, and DD across CO2 trajectory, NDC compliance, and electricity demand growth. Use the numbers provided.

3. Key Risks and Opportunities
Three to four paragraphs on the main structural challenges (coal dependence, grid infrastructure, financing) and opportunities (solar and wind potential, nuclear option, regional export).

4. Policy Recommendations
Four to five concrete recommendations for policymakers with specific numerical targets where possible.`,
    ai_prompt_footer:    "Keep total length around 350-400 words. Plain text only — no markdown, no asterisks, no hashes.",
    // CSV заголовки
    csv_year:            'Year',
    csv_bau_co2:         'BAU_CO2_Mt',
    csv_mt_co2:          'MT_CO2_Mt',
    csv_dd_co2:          'DD_CO2_Mt',
    csv_bau_elec:        'BAU_Electricity_TWh',
    csv_mt_elec:         'MT_Electricity_TWh',
    csv_dd_elec:         'DD_Electricity_TWh',
    csv_bau_re:          'BAU_RE_Share_pct',
    csv_mt_re:           'MT_RE_Share_pct',
    csv_dd_re:           'DD_RE_Share_pct',
    csv_bau_coal:        'BAU_Coal_Share_pct',
    csv_mt_coal:         'MT_Coal_Share_pct',
    csv_dd_coal:         'DD_Coal_Share_pct',
    csv_ndc_unc:         'NDC_Unconditional_Mt',
    csv_ndc_con:         'NDC_Conditional_Mt',
    // Summary CSV
    sum_dd_vs_bau:       'DD_vs_BAU_Mt',
    sum_reduction:       'Reduction_pct',
    // Тосты
    toast_csv_gen:       '⏳ Generating CSV export...',
    toast_csv_ok:        '✓ CSV exported successfully!',
    toast_backend:       '✗ Backend not running. Start with: uvicorn main:app --reload',
    toast_sum_gen:       '⏳ Generating summary...',
    toast_sum_ok:        '✓ Summary exported!',
    toast_backend_short: '✗ Backend not running.',
    toast_pdf_gen:       '⏳ Preparing report...',
    toast_pdf_ok:        '✓ Report opened — click "Save PDF" button in the report',
    toast_ai_ok:         'AI report generated successfully',
    toast_copied:        'Report copied to clipboard',
    toast_downloaded:    'File already downloaded',
  },

  ru: {
    report_title:        'KZLEAP — Отчёт по сценариям энергетики Казахстана',
    generated:           'Сформирован',
    analyst_label:       'Энергетический аналитик',
    scenarios_label:     'Сценарии',
    period_label:        'Период',
    model_label:         'Модель',
    exec_summary:        'Исполнительное резюме',
    ndc_section:         'Оценка соответствия НОО',
    co2_section:         'Прогноз выбросов CO₂ 2025–2060',
    assumptions:         'Ключевые допущения',
    footer_text:         'KZLEAP — Платформа прогнозирования энергетики Казахстана · Методология LEAP (SEI) · Источники: МЭА, KEGOC, БНС РК, Our World in Data, World Bank WDI · LP-оптимизация: PuLP/CBC',
    bau_card:            'CO₂ (BAU) к 2050',
    mt_card:             'CO₂ (МП) к 2050',
    dd_card:             'CO₂ (ГД) к 2050',
    vs_bau:              'к BAU',
    vs_2023:             'к 2023',
    col_scenario:        'Сценарий',
    col_co2_2030:        'CO₂ 2030 (Мт)',
    col_ndc15:           'НОО −15% (246 Мт)',
    col_ndc25:           'НОО −25% (217 Мт)',
    col_status:          'Статус',
    ndc_above:           '✗ Выше цели',
    ndc_met:             '✓ Выполнено',
    status_non:          'Не соответствует',
    status_partial:      'Частично соответствует',
    status_full:         'Полностью соответствует',
    col_year:            'Год',
    col_bau:             'BAU (Мт CO₂)',
    col_mt:              'МП (Мт CO₂)',
    col_dd:              'ГД (Мт CO₂)',
    col_reduction:       'Снижение ГД к BAU',
    ndc_year_mark:       '← Год НОО',
    col_param:           'Параметр',
    row_re:              'ВИЭ к 2050',
    row_coal:            'Доля угля к 2050',
    row_carbon:          'Цена углерода (2030)',
    row_nuclear:         'Атомная энергетика (ГВт к 2035)',
    row_ev:              'Доля ЭВ к 2050',
    btn_print:           '🖨 Печать',
    btn_save_pdf:        '⬇ Сохранить PDF',
    saving:              '⏳ Сохранение...',
    saved:               '✓ Сохранено!',
    ai_title:            'KZLEAP — AI Аналитический отчёт',
    ai_platform:         'Платформа прогнозирования энергетики Казахстана',
    btn_print_save:      'Печать / Сохранить PDF',
    ai_prompt_intro:     'Напишите профессиональный аналитический отчёт об энергетическом переходе Казахстана на основе следующих результатов модели. Весь отчёт — на русском языке.',
    ai_prompt_structure: `Структурируйте отчёт по четырём разделам:

1. Исполнительное резюме
Два абзаца: ключевые выводы по сценариям и траектория декарбонизации Казахстана.

2. Анализ сценариев
Сравните BAU, МП и ГД по траектории CO₂, соответствию НОО и росту спроса на электроэнергию. Используйте предоставленные цифры.

3. Ключевые риски и возможности
Три-четыре абзаца: структурные вызовы (угольная зависимость, электросетевая инфраструктура, финансирование) и возможности (солнечный и ветровой потенциал, атомная энергетика, региональный экспорт).

4. Рекомендации для политиков
Четыре-пять конкретных рекомендаций с числовыми целевыми показателями.`,
    ai_prompt_footer:    'Объём — около 350–400 слов. Только обычный текст, без маркдауна, звёздочек и знаков решётки.',
    csv_year:            'Год',
    csv_bau_co2:         'BAU_CO2_Мт',
    csv_mt_co2:          'МП_CO2_Мт',
    csv_dd_co2:          'ГД_CO2_Мт',
    csv_bau_elec:        'BAU_Электроэнергия_ТВтч',
    csv_mt_elec:         'МП_Электроэнергия_ТВтч',
    csv_dd_elec:         'ГД_Электроэнергия_ТВтч',
    csv_bau_re:          'BAU_ВИЭ_доля_%',
    csv_mt_re:           'МП_ВИЭ_доля_%',
    csv_dd_re:           'ГД_ВИЭ_доля_%',
    csv_bau_coal:        'BAU_Уголь_доля_%',
    csv_mt_coal:         'МП_Уголь_доля_%',
    csv_dd_coal:         'ГД_Уголь_доля_%',
    csv_ndc_unc:         'НОО_Безусловная_Мт',
    csv_ndc_con:         'НОО_Условная_Мт',
    sum_dd_vs_bau:       'ГД_к_BAU_Мт',
    sum_reduction:       'Снижение_%',
    toast_csv_gen:       '⏳ Формирование CSV...',
    toast_csv_ok:        '✓ CSV успешно экспортирован!',
    toast_backend:       '✗ Бэкенд не запущен. Запустите: uvicorn main:app --reload',
    toast_sum_gen:       '⏳ Формирование сводки...',
    toast_sum_ok:        '✓ Сводка экспортирована!',
    toast_backend_short: '✗ Бэкенд не запущен.',
    toast_pdf_gen:       '⏳ Подготовка отчёта...',
    toast_pdf_ok:        '✓ Отчёт открыт — нажмите кнопку «Сохранить PDF» в отчёте',
    toast_ai_ok:         'AI-отчёт успешно сформирован',
    toast_copied:        'Отчёт скопирован в буфер обмена',
    toast_downloaded:    'Файл уже загружен',
  },

  kk: {
    report_title:        'KZLEAP — Қазақстан энергетикасының сценарийлер есебі',
    generated:           'Жасалған күні',
    analyst_label:       'Энергетика талдаушысы',
    scenarios_label:     'Сценарийлер',
    period_label:        'Кезең',
    model_label:         'Модель',
    exec_summary:        'Атқарушы қорытынды',
    ndc_section:         'ҰАЖ сәйкестігін бағалау',
    co2_section:         'CO₂ шығарындылары болжамы 2025–2060',
    assumptions:         'Негізгі болжамдар',
    footer_text:         'KZLEAP — Қазақстан энергетикасын болжау платформасы · LEAP әдіснамасы (SEI) · Деректер: ХЭА, KEGOC, ҚР БҒА, Our World in Data, World Bank WDI · LP оңтайландыру: PuLP/CBC',
    bau_card:            'CO₂ (BAU) 2050-ге дейін',
    mt_card:             'CO₂ (ОК) 2050-ге дейін',
    dd_card:             'CO₂ (ТД) 2050-ге дейін',
    vs_bau:              'BAU-ға қарағанда',
    vs_2023:             '2023-ке қарағанда',
    col_scenario:        'Сценарий',
    col_co2_2030:        'CO₂ 2030 (Мт)',
    col_ndc15:           'ҰАЖ −15% (246 Мт)',
    col_ndc25:           'ҰАЖ −25% (217 Мт)',
    col_status:          'Мәртебе',
    ndc_above:           '✗ Жоғары',
    ndc_met:             '✓ Орындалды',
    status_non:          'Сәйкес емес',
    status_partial:      'Ішінара сәйкес',
    status_full:         'Толық сәйкес',
    col_year:            'Жыл',
    col_bau:             'BAU (Мт CO₂)',
    col_mt:              'ОК (Мт CO₂)',
    col_dd:              'ТД (Мт CO₂)',
    col_reduction:       'ТД vs BAU азаюы',
    ndc_year_mark:       '← ҰАЖ жылы',
    col_param:           'Параметр',
    row_re:              'ЖЭК үлесі 2050-ге дейін',
    row_coal:            'Көмір үлесі 2050-ге дейін',
    row_carbon:          'Көміртек бағасы (2030)',
    row_nuclear:         'Ядролық энергия (ГВт, 2035-ке дейін)',
    row_ev:              'ЭКК үлесі 2050',
    btn_print:           '🖨 Басып шығару',
    btn_save_pdf:        '⬇ PDF сақтау',
    saving:              '⏳ Сақталуда...',
    saved:               '✓ Сақталды!',
    ai_title:            'KZLEAP — AI Талдамалық есеп',
    ai_platform:         'Қазақстан энергетикасын болжау платформасы',
    btn_print_save:      'Басып шығару / PDF сақтау',
    ai_prompt_intro:     'Төмендегі модель нәтижелері негізінде Қазақстанның энергетикалық өтпелі кезеңі туралы кәсіби талдамалық есеп жазыңыз. Бүкіл есеп қазақ тілінде болуы тиіс.',
    ai_prompt_structure: `Есепті төрт бөлімге бөліңіз:

1. Атқарушы қорытынды
Сценарийлер бойынша негізгі тұжырымдар мен Қазақстанның декарбонизация траекториясы туралы екі абзац.

2. Сценарийлерді талдау
BAU, ОК және ТД сценарийлерін CO₂ траекториясы, ҰАЖ сәйкестігі және электр энергиясына сұраныстың өсуі бойынша салыстырыңыз. Берілген сандарды пайдаланыңыз.

3. Негізгі тәуекелдер мен мүмкіндіктер
Үш-төрт абзац: құрылымдық проблемалар (көмірге тәуелділік, электр желілері инфрақұрылымы, қаржыландыру) және мүмкіндіктер (күн мен жел потенциалы, атом энергетикасы, аймақтық экспорт).

4. Саясаткерлерге ұсыныстар
Нақты сандық мақсаттары бар төрт-бес нақты ұсыныс.`,
    ai_prompt_footer:    'Жалпы көлем — шамамен 350–400 сөз. Тек қарапайым мәтін, маркдаун, жұлдызша және торкөз белгілерінсіз.',
    csv_year:            'Жыл',
    csv_bau_co2:         'BAU_CO2_Мт',
    csv_mt_co2:          'ОК_CO2_Мт',
    csv_dd_co2:          'ТД_CO2_Мт',
    csv_bau_elec:        'BAU_Электр_ТВтс',
    csv_mt_elec:         'ОК_Электр_ТВтс',
    csv_dd_elec:         'ТД_Электр_ТВтс',
    csv_bau_re:          'BAU_ЖЭК_үлес_%',
    csv_mt_re:           'ОК_ЖЭК_үлес_%',
    csv_dd_re:           'ТД_ЖЭК_үлес_%',
    csv_bau_coal:        'BAU_Көмір_үлес_%',
    csv_mt_coal:         'ОК_Көмір_үлес_%',
    csv_dd_coal:         'ТД_Көмір_үлес_%',
    csv_ndc_unc:         'ҰАЖ_шартсыз_Мт',
    csv_ndc_con:         'ҰАЖ_шартты_Мт',
    sum_dd_vs_bau:       'ТД_BAU-ға_Мт',
    sum_reduction:       'Азаю_%',
    toast_csv_gen:       '⏳ CSV экспорты дайындалуда...',
    toast_csv_ok:        '✓ CSV сәтті экспортталды!',
    toast_backend:       '✗ Бэкенд іске қосылмаған. Іске қосыңыз: uvicorn main:app --reload',
    toast_sum_gen:       '⏳ Жиынтық дайындалуда...',
    toast_sum_ok:        '✓ Жиынтық экспортталды!',
    toast_backend_short: '✗ Бэкенд іске қосылмаған.',
    toast_pdf_gen:       '⏳ Есеп дайындалуда...',
    toast_pdf_ok:        '✓ Есеп ашылды — есептегі «PDF сақтау» батырмасын басыңыз',
    toast_ai_ok:         'AI есебі сәтті жасалды',
    toast_copied:        'Есеп алмасу буферіне көшірілді',
    toast_downloaded:    'Файл жүктелді',
  },
};

/** Получить строку перевода для текущего языка интерфейса */
function rpt(key) {
  const lang = getCurrentLang();
  const dict = REPORT_I18N[lang] || REPORT_I18N['en'];
  return dict[key] !== undefined ? dict[key] : (REPORT_I18N['en'][key] || key);
}

// ── CSV export ─────────────────────────────────────────────────────────────
async function exportExcel() {
  showToast(rpt('toast_csv_gen'));
  const lang = getCurrentLang();
  try {
    const res = await fetch(`${BACKEND}/api/export/csv?lang=${lang}`);
    if (!res.ok) throw new Error('Backend error');
    const text = await res.text();
    // Бэкенд уже использует ';', просто скачиваем
    const bom = '\uFEFF';
    const blob = new Blob([bom + text], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'KZLEAP_Scenarios_2024_2060.csv');
    addToHistory('KZLEAP_Scenarios_2024_2060.csv', 'CSV', 'BAU + MT + DD');
    showToast(rpt('toast_csv_ok'));
  } catch {
    showToast(rpt('toast_backend'));
  }
}

async function exportSummary() {
  showToast(rpt('toast_sum_gen'));
  const lang = getCurrentLang();
  try {
    const res = await fetch(`${BACKEND}/api/export/summary?lang=${lang}`);
    if (!res.ok) throw new Error('Backend error');
    const text = await res.text();
    const bom = '\uFEFF';
    const blob = new Blob([bom + text], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'KZLEAP_Summary.csv');
    addToHistory('KZLEAP_Summary.csv', 'CSV', 'BAU + MT + DD · Milestones');
    showToast(rpt('toast_sum_ok'));
  } catch {
    showToast(rpt('toast_backend_short'));
  }
}

// ── PDF generation ─────────────────────────────────────────────────────────
async function generatePDF() {
  showToast(rpt('toast_pdf_gen'));

  let bau = null, mt = null, dd = null;
  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (res.ok) {
      const data = await res.json();
      bau = data.BAU; mt = data.MT; dd = data.DD;
    }
  } catch {}

  const idx2050 = bau?.years?.indexOf(2050) ?? -1;
  const bau2050 = idx2050 >= 0 ? bau.co2[idx2050] : 311;
  const mt2050  = idx2050 >= 0 ? mt.co2[idx2050]  : 210;
  const dd2050  = idx2050 >= 0 ? dd.co2[idx2050]  : 127;

  const lang    = getCurrentLang();
  const today   = new Date().toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  const filename = 'KZLEAP_Full_Report_' + new Date().getFullYear() + '.pdf';

  // Сценарии: подписи в зависимости от языка
  const scenarioNames = {
    en: { bau: 'BAU', mt: 'Moderate Transition', dd: 'Deep Decarbonization' },
    ru: { bau: 'BAU', mt: 'Умеренный переход',   dd: 'Глубокая декарбонизация' },
    kk: { bau: 'BAU', mt: 'Орташа көшу',         dd: 'Терең декарбонизация' },
  };
  const sn = scenarioNames[lang] || scenarioNames['en'];

  const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${rpt('report_title')}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a2b4a; font-size: 13px; }
    h1 { font-size: 24px; color: #0F6E56; margin-bottom: 4px; }
    h2 { font-size: 16px; border-bottom: 2px solid #e8eef5; padding-bottom: 6px; margin-top: 32px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }
    .card { background: #f8fffe; border: 1px solid #d4ede7; border-radius: 8px; padding: 16px; }
    .card-val { font-size: 28px; font-weight: 700; color: #0F6E56; }
    .card-label { font-size: 11px; color: #666; margin-top: 4px; }
    .card.red .card-val { color: #D85A30; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #f0f4f8; padding: 8px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .ndc { color: #0F6E56; font-weight: 600; }
    .footer { margin-top: 48px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
    .btn-bar { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 999; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-pdf { background: #0F6E56; color: white; }
    .btn-print { background: #f0f4f8; color: #1a2b4a; }
    @media print { .btn-bar { display: none; } }
  </style>
</head>
<body>
  <div class="btn-bar">
    <button class="btn btn-print" onclick="window.print()">${rpt('btn_print')}</button>
    <button class="btn btn-pdf" onclick="savePDF()">${rpt('btn_save_pdf')}</button>
  </div>

  <h1>${rpt('report_title')}</h1>
  <div class="meta">
    ${rpt('generated')}: ${today} · KZLEAP v1.0 · ${rpt('analyst_label')}: ${user.name}<br>
    ${rpt('scenarios_label')}: ${sn.bau} · ${sn.mt} (MT) · ${sn.dd} (DD) · ${rpt('period_label')}: 2024–2060<br>
    ${rpt('model_label')}: LEAP-methodology energy accounting + LP optimization · Data: IEA, KEGOC, BNS KZ, Our World in Data
  </div>

  <h2>${rpt('exec_summary')}</h2>
  <div class="grid">
    <div class="card red">
      <div class="card-val">${Math.round(bau2050)} Mt</div>
      <div class="card-label">${rpt('bau_card')} · +${Math.round((bau2050-242)/242*100)}% ${rpt('vs_2023')}</div>
    </div>
    <div class="card">
      <div class="card-val">${Math.round(mt2050)} Mt</div>
      <div class="card-label">${rpt('mt_card')} · −${Math.round((bau2050-mt2050)/bau2050*100)}% ${rpt('vs_bau')}</div>
    </div>
    <div class="card">
      <div class="card-val">${Math.round(dd2050)} Mt</div>
      <div class="card-label">${rpt('dd_card')} · −${Math.round((bau2050-dd2050)/bau2050*100)}% ${rpt('vs_bau')}</div>
    </div>
  </div>

  <h2>${rpt('ndc_section')}</h2>
  <table>
    <thead><tr>
      <th>${rpt('col_scenario')}</th>
      <th>${rpt('col_co2_2030')}</th>
      <th>${rpt('col_ndc15')}</th>
      <th>${rpt('col_ndc25')}</th>
      <th>${rpt('col_status')}</th>
    </tr></thead>
    <tbody>
      <tr>
        <td>${sn.bau}</td>
        <td>${bau ? Math.round(bau.co2[bau.years.indexOf(2030)]) : '—'} Mt</td>
        <td>${rpt('ndc_above')}</td>
        <td>${rpt('ndc_above')}</td>
        <td>${rpt('status_non')}</td>
      </tr>
      <tr>
        <td>${sn.mt}</td>
        <td>${mt ? Math.round(mt.co2[mt.years.indexOf(2030)]) : '—'} Mt</td>
        <td class="ndc">${rpt('ndc_met')}</td>
        <td>${rpt('ndc_above')}</td>
        <td>${rpt('status_partial')}</td>
      </tr>
      <tr>
        <td>${sn.dd}</td>
        <td>${dd ? Math.round(dd.co2[dd.years.indexOf(2030)]) : '—'} Mt</td>
        <td class="ndc">${rpt('ndc_met')}</td>
        <td class="ndc">${rpt('ndc_met')}</td>
        <td>${rpt('status_full')}</td>
      </tr>
    </tbody>
  </table>

  <h2>${rpt('co2_section')}</h2>
  <table>
    <thead><tr>
      <th>${rpt('col_year')}</th>
      <th>${rpt('col_bau')}</th>
      <th>${rpt('col_mt')}</th>
      <th>${rpt('col_dd')}</th>
      <th>${rpt('col_reduction')}</th>
    </tr></thead>
    <tbody>
      ${[2025,2030,2035,2040,2045,2050,2060].map(y => {
        if (!bau) return '';
        const i = bau.years.indexOf(y);
        if (i < 0) return '';
        const b = Math.round(bau.co2[i]), m = Math.round(mt.co2[i]), d = Math.round(dd.co2[i]);
        const pct = Math.round((b-d)/b*100);
        const ndcMark = y === 2030 ? ` <span class="ndc">${rpt('ndc_year_mark')}</span>` : '';
        return `<tr><td><strong>${y}</strong>${ndcMark}</td><td>${b} Mt</td><td>${m} Mt</td><td>${d} Mt</td><td>−${b-d} Mt (−${pct}%)</td></tr>`;
      }).join('')}
    </tbody>
  </table>

  <h2>${rpt('assumptions')}</h2>
  <table>
    <thead><tr>
      <th>${rpt('col_param')}</th>
      <th>${sn.bau}</th>
      <th>MT</th>
      <th>DD</th>
    </tr></thead>
    <tbody>
      <tr><td>${rpt('row_re')}</td><td>15%</td><td>40%</td><td>70%</td></tr>
      <tr><td>${rpt('row_coal')}</td><td>45%</td><td>25%</td><td>5%</td></tr>
      <tr><td>${rpt('row_carbon')}</td><td>$5/t</td><td>$20/t</td><td>$50/t</td></tr>
      <tr><td>${rpt('row_nuclear')}</td><td>0</td><td>1.2 GW</td><td>2.4 GW</td></tr>
      <tr><td>${rpt('row_ev')}</td><td>10%</td><td>30%</td><td>80%</td></tr>
    </tbody>
  </table>

  <div class="footer">${rpt('footer_text')}</div>

  <script>
    async function savePDF() {
      const btn = document.querySelector('.btn-pdf');
      btn.textContent = '${rpt('saving')}';
      btn.disabled = true;
      try {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(document.body, {
          scale: 2, useCORS: true,
          ignoreElements: el => el.classList.contains('btn-bar')
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = (canvas.height * pdfW) / canvas.width;
        const pageH = pdf.internal.pageSize.getHeight();
        let yOffset = 0;
        while (yOffset < pdfH) {
          if (yOffset > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfW, pdfH);
          yOffset += pageH;
        }
        pdf.save('${filename}');
        btn.textContent = '${rpt('saved')}';
        setTimeout(() => { btn.textContent = '${rpt('btn_save_pdf')}'; btn.disabled = false; }, 2000);
      } catch(e) {
        btn.textContent = '✗ Error'; btn.disabled = false; console.error(e);
      }
    }
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(reportHTML);
  win.document.close();
  addToHistory(filename, 'PDF', 'BAU + MT + DD');
  showToast(rpt('toast_pdf_ok'));
}

async function generateSummary() {
  showToast(rpt('toast_pdf_gen'));
  await generatePDF();
}

// ── AI Report (streaming, language-aware) ──────────────────────────────────
async function callClaudeStream(messages, onChunk) {
  const response = await fetch(`${BACKEND}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      max_tokens: 1000,
      stream: true,
      system: 'You are an expert energy economist specializing in Kazakhstan energy policy. Write clear, professional analytical reports. Use plain text only — no markdown, no asterisks, no hashes, no bullet symbols. Use numbered sections separated by blank lines.' + (typeof getLangInstruction === 'function' ? getLangInstruction() : ''),
      messages,
    }),
  });
  if (!response.ok) throw new Error(' API error ' + response.status);

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
  output.textContent  = 'Fetching scenario data...';
  sub.textContent     = 'Generating with AI...';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let bau = null, mt = null, dd = null;
  try {
    const res = await fetch(`${BACKEND}/api/compare`);
    if (res.ok) { const data = await res.json(); bau = data.BAU; mt = data.MT; dd = data.DD; }
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
    await callClaudeStream([{ role: 'user', content: prompt }], chunk => { output.textContent += chunk; });
    sub.textContent = (lang === 'ru' ? 'Отчёт сформирован' : lang === 'kk' ? 'Есеп жасалды' : 'Report generated') + ' · ' + today;
    addToHistory('KZLEAP_AI_Report_' + new Date().getFullYear() + '.txt', 'AI', 'BAU + MT + DD');
    showToast(rpt('toast_ai_ok'));
  } catch (err) {
    output.textContent = (lang === 'ru' ? 'Ошибка генерации: ' : lang === 'kk' ? 'Қате: ' : 'Report generation failed: ') + err.message;
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
  body{font-family:Arial,sans-serif;margin:48px;color:#1a2b4a;font-size:13px;line-height:1.8;}
  h1{font-size:20px;color:#0F6E56;margin-bottom:4px;}
  .meta{color:#888;font-size:11px;margin-bottom:32px;}
  .content{white-space:pre-wrap;}
  .footer{margin-top:48px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;}
  @media print{button{display:none;}}
  .btn-bar{position:fixed;top:16px;right:16px;}
  button{padding:8px 18px;background:#0F6E56;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;}
</style></head><body>
<div class="btn-bar"><button onclick="window.print()">${rpt('btn_print_save')}</button></div>
<h1>${rpt('ai_title')}</h1>
<div class="meta">${rpt('generated')}: ${today} · ${rpt('ai_platform')}</div>
<div class="content">${text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
<div class="footer">KZLEAP v1.0 · LEAP methodology · LP optimization: PuLP/CBC · AI analysis</div>
</body></html>`);
  win.document.close();
}

// ── Utilities ──────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addToHistory(filename, type, scenarios) {
  const tbody = document.getElementById('reports-table');
  if (!tbody) return;
  const lang  = getCurrentLang();
  const today = new Date().toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : lang === 'kk' ? 'kk-KZ' : 'en-GB',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
  const tagColor     = type === 'PDF' ? '#fdecea' : '#e8f5e9';
  const tagTextColor = type === 'PDF' ? '#c0392b' : '#1B5E20';
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div style="font-weight:500;">${filename}</div></td>
    <td><span style="background:${tagColor};color:${tagTextColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${type}</span></td>
    <td>${scenarios}</td>
    <td>${user.name}</td>
    <td>${today}</td>
    <td><button onclick="showToast('${rpt('toast_downloaded')}')" style="font-size:12px;padding:4px 10px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#fff;">Download</button></td>
  `;
  tbody.prepend(tr);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}