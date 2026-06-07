(function () {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
  }
})();

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateIcon(isDark);
}

function updateIcon(isDark) {
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (!sun || !moon) return;
  sun.style.display = isDark ? 'none' : 'block';
  moon.style.display = isDark ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', function () {
  updateIcon(document.body.classList.contains('dark'));
});
