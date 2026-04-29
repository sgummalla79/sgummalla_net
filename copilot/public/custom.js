(function () {
  var params = new URLSearchParams(location.search);

  // Widget mode: hide user avatar and theme toggle via CSS class
  if (params.get('mode') === 'widget') {
    document.documentElement.classList.add('widget-mode');
  }

  // Apply initial theme from parent app (passed as ?theme=dark|light)
  function applyTheme(theme) {
    if (theme !== 'dark' && theme !== 'light') return;
    localStorage.setItem('vite-ui-theme', theme);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }

  applyTheme(params.get('theme'));

  // Listen for live theme changes posted from the parent frame
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'set-theme') {
      applyTheme(e.data.theme);
    }
  });
})();
