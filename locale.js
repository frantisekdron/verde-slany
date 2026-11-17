(() => {
  const language = document.documentElement.lang === 'cs' ? 'cs' : 'en';
  const cs = language === 'cs';
  const siteRoot = '/verde-slany/';
  const home = siteRoot + (cs ? '' : 'en/');

  function syncLanguageLinks() {
    document.querySelectorAll('a[data-locale-link]').forEach(link => {
      const target = new URL(link.getAttribute('href'), location.origin);
      target.search = location.search;
      target.hash = location.hash;
      link.href = target.href;
    });
  }

  function postCopy(post) {
    const copy = post.translations?.[language];
    return copy ? {...post, ...copy} : post;
  }

  window.VERDE_LOCALE = { language, cs, siteRoot, home, postCopy, syncLanguageLinks };

  document.addEventListener('DOMContentLoaded', syncLanguageLinks);
  window.addEventListener('hashchange', syncLanguageLinks);
  window.addEventListener('popstate', syncLanguageLinks);
  // Resolve the current state for direct clicks, context menus and modified clicks.
  for (const type of ['pointerdown', 'contextmenu', 'click']) {
    document.addEventListener(type, event => {
      if (event.target.closest?.('[data-locale-link]')) syncLanguageLinks();
    }, true);
  }
})();
