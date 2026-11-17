(() => {
  const dialog = document.getElementById('galleryDialog');
  if (!dialog) return;
  const play = document.getElementById('galleryClipPlay');
  const player = document.getElementById('galleryClipVideo');
  const image = document.getElementById('galleryDialogImage');
  const viewport = image.closest('.gallery-image-viewport') || image;
  function resetVideo() {
    player.pause();
    if (player.hasAttribute('src')) {
      player.removeAttribute('src');
      player.load();
    }
    player.hidden = true;
    viewport.hidden = false;
    play.hidden = true;
    delete play.dataset.src;
  }
  document.querySelectorAll('.gallery-open, .locality-zoom').forEach(button => {
    const customImage = button.dataset.defaultImage && button.dataset.image !== button.dataset.defaultImage;
    if (customImage) {
      const thumb = button.querySelector('img');
      thumb.removeAttribute('srcset');
      thumb.src = button.dataset.image;
    }
    button.addEventListener('click', () => {
      resetVideo();
      if (button.dataset.clip && !customImage) {
        play.dataset.src = button.dataset.clip;
        play.hidden = false;
        play.textContent = window.VERDE_LOCALE.cs ? 'Přehrát záběr' : 'Play clip';
      }
    });
  });
  play.addEventListener('click', () => {
    if (!player.hidden) {
      player.pause();
      player.hidden = true;
      viewport.hidden = false;
      play.textContent = window.VERDE_LOCALE.cs ? 'Přehrát záběr' : 'Play clip';
      return;
    }
    player.src = play.dataset.src;
    player.setAttribute('aria-label', document.getElementById('galleryDialogTitle').textContent);
    viewport.hidden = true;
    player.hidden = false;
    play.textContent = window.VERDE_LOCALE.cs ? 'Zobrazit snímek' : 'Show still image';
    player.play().catch(() => { /* Native controls remain available. */ });
  });
  dialog.addEventListener('close', resetVideo);
})();
