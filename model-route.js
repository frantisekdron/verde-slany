(() => {
  const params = new URLSearchParams(location.search);
  const language = params.get('lang') === 'cs' || (!params.has('lang') && document.documentElement.lang === 'cs') ? 'cs' : 'en';
  const interior = params.get('interior');
  const base = '/verde-slany/';
  const localized = base + (language === 'cs' ? '' : 'en/');
  let route = localized + 'dum-verde-ii/index.html';

  if (interior === 'verde' || interior === 'borovskeho') {
    route = base + (interior === 'verde' ? 'prohlidka-byt/' : 'prohlidka-mezonet/') + 'index.html';
  } else if (params.get('mode') === 'select') {
    route = localized + 'model/select.html';
  }

  const target = new URL(route, location.origin);
  target.searchParams.set('v', 'verde2-cs-20261118');
  target.searchParams.set('lang', language);
  target.searchParams.set('focus', 'verde');
  for (const key of ['noc', 'bezui', 'ladit']) {
    if (params.get(key) === '1') target.searchParams.set(key, '1');
  }
  location.replace(target.href);
})();
