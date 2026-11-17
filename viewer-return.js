(() => {
  if (parent !== window) return;
  const link = document.querySelector('.viewer-return');
  if (link) link.hidden = false;
})();
