(() => {
  const header = document.querySelector('.site-header');
  const menu = header?.querySelector('.site-menu');
  const navigation = document.getElementById('siteNavigation');
  if (!header || !menu || !navigation) return;

  function setMenu(open, restoreFocus = false) {
    header.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    if (restoreFocus) menu.focus();
  }
  menu.hidden = false;
  header.classList.add('menu-ready');
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => {
    if (!header.contains(event.target) || event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) setMenu(false, true);
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
  });
  matchMedia('(min-width: 721px)').addEventListener('change', () => setMenu(false));

  const title = document.querySelector('.hero h1');
  const lineBreak = title?.querySelector('br');
  if (lineBreak?.nextSibling) {
    const emphasis = document.createElement('em');
    while (lineBreak.nextSibling) emphasis.append(lineBreak.nextSibling);
    title.append(emphasis);
    title.classList.add('has-emphasis');
  }
  document.querySelectorAll('.project-picture[data-default-image]').forEach(image => {
    if (image.getAttribute('src') !== image.dataset.defaultImage) image.removeAttribute('srcset');
  });
  document.querySelectorAll('#visualGallery figcaption').forEach(caption => {
    const words = caption.textContent.trim().split(' · ');
    if (words.length > 2 && ['Verde II', 'Byty Borovského'].includes(words[0])) caption.textContent = words.at(-1) === "Visualisation" ? words.slice(-2).join(' · ') : words.at(-1);
  });

  const tabList = document.querySelector('.media-tabs');
  const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
  const panels = new Map(tabs.map(tab => [tab, document.getElementById(tab.getAttribute('aria-controls'))]));
  const usable = tabs.filter(tab => {
    const available = Boolean(panels.get(tab)?.querySelector('section'));
    tab.hidden = !available;
    return available;
  });
  function activate(tab, {push = false, focus = false} = {}) {
    for (const other of tabs) {
      const active = other === tab;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
      const panel = panels.get(other);
      if (!active && !panel.hidden) {
        panel.querySelectorAll('video').forEach(video => video.pause());
      }
      panel.hidden = !active;
    }
    if (push && location.hash !== '#' + tab.dataset.mediaTarget) {
      const url = new URL(location.href);
      url.hash = tab.dataset.mediaTarget;
      history.pushState(history.state, '', url);
    }
    if (focus) tab.focus({preventScroll: true});
  }
  function reveal(hash, scroll = false) {
    const target = document.getElementById(hash.slice(1));
    if (!target) return false;
    const pane = target.closest('.media-pane');
    const tab = usable.find(item => panels.get(item) === pane);
    if (tab) activate(tab);
    if (target.tagName === 'DETAILS') target.open = true;
    if (scroll && (pane || target.tagName === 'DETAILS') && !document.querySelector('dialog[open]')) {
      const destination = tab?.dataset.mediaTarget === target.id ? tabList : target;
      requestAnimationFrame(() => destination.scrollIntoView({block: 'start', behavior: 'instant'}));
    }
    return Boolean(tab);
  }
  if (usable.length) {
    tabList.hidden = false;
    if (!reveal(location.hash, true)) activate(usable[0]);
  }
  for (const [index, tab] of usable.entries()) {
    tab.addEventListener('click', () => activate(tab, {push: true, focus: true}));
    tab.addEventListener('keydown', event => {
      const keys = {ArrowLeft: (index + usable.length - 1) % usable.length, ArrowRight: (index + 1) % usable.length, Home: 0, End: usable.length - 1};
      if (!(event.key in keys)) return;
      event.preventDefault();
      activate(usable[keys[event.key]], {push: true, focus: true});
    });
  }
  window.addEventListener('hashchange', () => reveal(location.hash, true));
  window.addEventListener('popstate', () => {
    if (!reveal(location.hash, true) && usable.length) activate(usable[0]);
  });
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor || anchor.target === '_blank') return;
    const url = new URL(anchor.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
      reveal(url.hash, url.hash === location.hash);
    }
  });

  const chapters = Array.from(navigation.querySelectorAll('a'), link => ({
    link, section: document.getElementById(new URL(link.href).hash.slice(1))
  })).filter(item => item.section);
  const contact = document.getElementById('kontakt');
  let scheduled = false;
  function markSection() {
    scheduled = false;
    const boundary = header.offsetHeight + 90;
    let active = null;
    for (const item of chapters) {
      if (item.section.getBoundingClientRect().top <= boundary) active = item.link;
    }
    if (contact?.getBoundingClientRect().top <= boundary) active = null;
    for (const {link} of chapters) {
      if (link === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(markSection); }
  }, {passive: true});
  markSection();
})();
