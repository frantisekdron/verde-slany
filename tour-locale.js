(() => {
  const params = new URLSearchParams(location.search);
  const cs = params.get('lang') === 'cs';
  if (cs) {
    document.documentElement.lang = 'cs';
    document.title = document.querySelector('meta[name="title-cs"]').content;
    document.querySelector('meta[name="description"]').content = 'Interaktivní virtuální prohlídka – FrantišekDron';
  }

  // A shared tour page loads the matching manifest unless a custom one is supplied.
  if (cs && params.has('tour')) {
    const defaultTour = /^tours\/demo\/tour(?:-final-202611(?:10|16))?\.json(?:\?.*)?$/;
    if (defaultTour.test(params.get('tour'))) {
      const url = new URL(location.href);
      url.searchParams.set('tour', 'tours/demo/tour-cs.json?v=bilingual-20261117');
      history.replaceState(history.state, '', url);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const returnLink = document.querySelector('.tour-site-return');
    if (cs) returnLink.href = '/verde-slany/cs/#prohlidka';
    returnLink.setAttribute('aria-label', cs ? 'Zpět na web Verde Slaný' : 'Back to the Verde Slaný website');
    returnLink.hidden = parent !== window;
  });
})();
