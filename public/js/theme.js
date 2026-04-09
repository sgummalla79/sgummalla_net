/**
 * theme.js
 * Loaded synchronously in <head> — reads saved preference and applies it
 * before first paint to prevent flash of wrong theme.
 */
(function () {
  var saved = localStorage.getItem('portal-theme') || 'light';
  document.documentElement.dataset.theme = saved;
})();

function toggleTheme() {
  var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('portal-theme', next);
}