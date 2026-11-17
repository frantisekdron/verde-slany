(() => {
  let sdk;
  function loadSDK() {
    if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
    if (!sdk) sdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/vimeo-player.js?v=20261117-final', document.baseURI).href;
      script.onload = () => window.Vimeo?.Player ? resolve(window.Vimeo) : reject(new Error('Player unavailable'));
      script.onerror = reject;
      document.head.append(script);
    });
    return sdk;
  }
  document.querySelectorAll('.vimeo-film').forEach(stage => {
    const trigger = stage.querySelector('.vimeo-play');
    const panel = stage.closest('[role="tabpanel"]');
    let player;
    function pause() { if (player) player.pause().catch(() => {}); stage.querySelector('video')?.pause(); }
    if (panel) new MutationObserver(() => { if (panel.hidden) pause(); }).observe(panel, {attributes: true, attributeFilter: ['hidden']});
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    function fallback() {
      if (stage.dataset.fallbackActive) return;
      stage.dataset.fallbackActive = 'true';
      if (player) player.destroy().catch(() => {});
      stage.querySelector('iframe')?.remove();
      const movie = document.createElement('video');
      movie.controls = true; movie.playsInline = true; movie.preload = 'none';
      movie.src = stage.dataset.fallback;
      movie.poster = stage.querySelector('.vimeo-poster').src;
      movie.setAttribute('aria-label', stage.dataset.title);
      if (stage.dataset.captions) {
        const track = document.createElement('track'); track.kind = 'captions'; track.src = stage.dataset.captions; track.srclang = 'en'; track.label = 'English'; movie.append(track);
      }
      stage.append(movie); trigger.hidden = true;
      movie.play().catch(() => {});
    }
    trigger.addEventListener('click', async () => {
      trigger.disabled = true;
      try {
        const frame = document.createElement('iframe');
        frame.title = stage.dataset.title;
        frame.src = stage.dataset.vimeoSrc;
        frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        stage.append(frame); trigger.hidden = true;
        const Vimeo = await loadSDK();
        player = new Vimeo.Player(frame);
        stage.vimeoPlayer = player;
        player.on('error', fallback);
        await player.ready();
        stage.dataset.ready = 'true';
        if (panel?.hidden || document.hidden) pause();
        else player.play().catch(() => {});
      } catch { fallback(); }
      finally { trigger.disabled = false; }
    });
  });
})();
