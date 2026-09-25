// Mirrors Mantine's localStorage colour-scheme manager so the first paint uses the right scheme.
(function () {
  try {
    var saved = window.localStorage.getItem('helm-color-scheme');
    var scheme = saved === 'light' || saved === 'dark' ? saved : 'auto';
    if (scheme === 'auto') {
      scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-mantine-color-scheme', scheme);
  } catch (error) {
    document.documentElement.setAttribute('data-mantine-color-scheme', 'light');
  }
})();
