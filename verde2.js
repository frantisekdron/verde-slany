(() => {
  'use strict';
  const cs = document.documentElement.lang === 'cs';
  const sendVisibility = (frame, visible) => frame?.contentWindow?.postMessage({type: 'verde-scene-visibility', visible}, location.origin);
  const hero = document.querySelector('.hero-model');
  if (hero) {
    const start = hero.querySelector('.hero-model-start');
    let frame, timeout, visible = true;
    const startLabel = start.querySelector('span').textContent;
    const reset = () => {
      clearTimeout(timeout);
      frame?.remove();
      frame = null;
      hero.classList.remove('is-loading', 'is-active');
      start.disabled = false;
      start.querySelector('span').textContent = cs ? 'Zkusit načíst 3D znovu' : 'Try loading 3D again';
    };
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
      if (event.data?.type === 'verde-scene-ready') {
        clearTimeout(timeout);
        hero.classList.remove('is-loading');
        hero.classList.add('is-active');
        start.querySelector('span').textContent = startLabel;
      } else if (event.data?.type === 'verde-scene-error') reset();
    });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sendVisibility(frame, visible && !document.hidden);
    }, {threshold: .05});
    observer.observe(hero);
    document.addEventListener('visibilitychange', () => sendVisibility(frame, visible && !document.hidden));
    start.addEventListener('click', () => {
      if (frame) return;
      hero.classList.add('is-loading');
      start.disabled = true;
      start.querySelector('span').textContent = cs ? 'Načítám 3D model…' : 'Loading the 3D model…';
      frame = document.createElement('iframe');
      frame.title = cs ? 'Interaktivní model Verde II a okolí' : 'Interactive model of Verde II and its surroundings';
      frame.src = hero.dataset.modelSrc;
      frame.allow = 'fullscreen';
      frame.addEventListener('load', () => {
        sendVisibility(frame, visible && !document.hidden);
      }, {once: true});
      hero.insertBefore(frame, hero.querySelector('figcaption'));
      // The approved poster remains visible until geometry and textures are ready.
      timeout = setTimeout(reset, 60000);
    });
  }

  const viewer = document.getElementById('experience-viewer');
  if (!viewer) return;
  const tabs = [...document.querySelectorAll('.experience-tabs [role=tab]')];
  const external = document.getElementById('experience-open');
  const help = document.getElementById('experience-help');
  const loading = viewer.querySelector('.experience-loading');
  const buildingHelp = help.textContent;
  let frame, active;
  function select(tab, updateURL = true) {
    if (active === tab) return;
    active = tab;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    // Dispose the inactive WebGL scene and any film playback before opening the next view.
    frame?.remove();
    loading.hidden = false;
    viewer.setAttribute('aria-labelledby', tab.id);
    external.href = tab.dataset.src;
    help.textContent = tab.dataset.view === 'building' ? buildingHelp : (cs
      ? 'Kliknutím se přesunete dál. Tažením se rozhlédnete. Tlačítkem Dům a okolí se kdykoli vrátíte ven.'
      : 'Click to move and drag to look around. Choose Building and surroundings to return outside at any time.');
    frame = document.createElement('iframe');
    frame.title = tab.dataset.title;
    frame.allow = 'fullscreen; xr-spatial-tracking; autoplay';
    frame.allowFullscreen = true;
    frame.src = tab.dataset.src;
    frame.addEventListener('load', () => { loading.hidden = true; }, {once: true});
    viewer.append(frame);
    if (updateURL) {
      const url = new URL(location.href);
      if (tab.dataset.view === 'building') url.searchParams.delete('view');
      else url.searchParams.set('view', tab.dataset.view);
      history.pushState({}, '', url);
      window.VERDE_LOCALE?.syncLanguageLinks();
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const key = {ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
      if (key === undefined) return;
      event.preventDefault();
      tabs[key].focus();
      select(tabs[key]);
    });
  });
  function fromURL() { select(tabs.find(tab => tab.dataset.view === new URLSearchParams(location.search).get('view')) || tabs[0], false); }
  window.addEventListener('popstate', fromURL);
  fromURL();
})();
