(()=>{
 const review=document.querySelector('.variant-review');if(review){review.hidden=false;if(new URLSearchParams(location.search).get("review")==="1")review.open=true;}
 const media=document.querySelector('#media'),body=document.querySelector('#mediaBody'),gallery=document.querySelector('#galleryDialog');
 if(!media||!body||!gallery)return;
 const grid=document.querySelector('#visualGallery'),toggle=document.querySelector('#galleryToggle');
 if(grid&&toggle&&grid.children.length>4){grid.classList.add('is-collapsible');toggle.hidden=false;const total=grid.children.length;toggle.textContent='Zobrazit všech '+total+' vizualizací';toggle.addEventListener('click',()=>{const open=grid.classList.toggle('is-expanded');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Zobrazit méně':'Zobrazit všech '+total+' vizualizací';if(!open)document.querySelector('#galerie').scrollIntoView({block:'start'});});}

 let galleryTrigger=null,arealTrigger=null;
 const mapZoom=document.querySelector('#localityMapZoom');
 function resetMapZoom(){document.querySelector('.gallery-image-viewport').tabIndex=-1;gallery.classList.remove('is-map-zoomed');mapZoom.setAttribute('aria-pressed','false');mapZoom.textContent='Přiblížit popisky +';}
 mapZoom.addEventListener('click',()=>{const zoomed=gallery.classList.toggle('is-map-zoomed');document.querySelector('.gallery-image-viewport').tabIndex=zoomed?0:-1;mapZoom.setAttribute('aria-pressed',String(zoomed));mapZoom.textContent=zoomed?'Zobrazit celý snímek −':'Přiblížit popisky +';});
 document.querySelectorAll('.gallery-open, .locality-zoom').forEach(button=>button.addEventListener('click',()=>{galleryTrigger=button;resetMapZoom();const isMap=button.classList.contains('locality-map');gallery.classList.toggle('is-locality-map',isMap);mapZoom.hidden=!isMap;document.querySelector('#galleryDialogTitle').textContent=button.dataset.caption;const image=document.querySelector('#galleryDialogImage');image.src=button.dataset.image;image.alt=button.querySelector('img').alt;gallery.showModal()}));
 gallery.addEventListener('close',()=>{resetMapZoom();gallery.classList.remove('is-locality-map');mapZoom.hidden=true;document.querySelector('#galleryDialogImage').removeAttribute('src');galleryTrigger?.focus()});
 function openAreal(trigger){
  arealTrigger=trigger;
  document.querySelector('#mediaTitle').textContent='Verde Slaný II · 3D model domu';
  media.classList.add('areal-media');
  const url=new URL('/verde-slany/dum-verde-ii/index.html?v=final-20261116',location.origin);
  body.innerHTML='<p class="areal-access"><a target="_blank" rel="noopener">Otevřít model v samostatném okně ↗</a><button id="arealToCatalog" type="button">Přejít na nabídku bytů →</button></p>';
  body.querySelector('a').href=url.pathname+url.search;const frame=document.createElement('iframe');frame.src=url.pathname+url.search;frame.title='3D model domu Verde Slaný II s bezprostředním okolím';frame.allow='fullscreen';frame.allowFullscreen=true;body.append(frame);
  body.querySelector('#arealToCatalog').onclick=()=>{arealTrigger=null;media.close();document.querySelector('#changeProject').click()};media.showModal();
 }
 document.querySelectorAll('#openAreal,.open-areal-inline').forEach(button=>button.addEventListener('click',()=>openAreal(button)));
 media.addEventListener('close',()=>{media.classList.remove('connected-media');if(media.classList.contains('areal-media')){media.classList.remove('areal-media');arealTrigger?.focus()}});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==body.querySelector('iframe')?.contentWindow)return;if(event.data?.type==='verde-close-model')media.close()});
 const photoLink = document.querySelector('#fotografie a[href$="#fotky-mezonetu"]');
 const photoCollection = document.getElementById('fotky-mezonetu');
 if (photoLink && photoCollection) photoLink.addEventListener('click', () => { photoCollection.open = true; });
 const cover = document.querySelector('.hero-image[data-default-image]');
 if (cover && cover.getAttribute('src') !== cover.dataset.defaultImage) cover.removeAttribute('srcset');
 document.querySelectorAll('.phase-film-image img[data-default-image]').forEach(image => {
  if (image.getAttribute('src') !== image.dataset.defaultImage) image.removeAttribute('srcset');
 });
 const maisonetteNote = document.querySelector('[data-project-film-note="borovskeho"]');
 if (maisonetteNote && document.getElementById('film-borovskeho')) maisonetteNote.hidden = true;
 const phaseSection = document.getElementById('etapy');
 if (phaseSection) {
  const buttons = phaseSection.querySelectorAll('button[data-phase]');
  const panels = phaseSection.querySelectorAll('[data-phase-panel]');
  for (const button of buttons) {
   button.addEventListener('click', () => {
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    for (const panel of panels) panel.hidden = panel.dataset.phasePanel !== button.dataset.phase;
   });
  }
 }
 document.querySelectorAll('.film-play').forEach(button=>{const video=document.getElementById(button.dataset.film);button.addEventListener('click',()=>{button.hidden=true;video.play().catch(()=>{button.hidden=false})});video.addEventListener('play',()=>button.hidden=true);video.addEventListener('ended',()=>button.hidden=false)});
})();

(() => {
  const section = document.getElementById('vizualizace-mezonetu');
  if (!section) return;
  const player = section.querySelector('video');
  const choices = section.querySelectorAll('[data-interior-clip]');
  function openWhenLinked() {
    if (location.hash === '#vizualizace-mezonetu') section.open = true;
  }
  openWhenLinked();
  window.addEventListener('hashchange', openWhenLinked);

  for (const choice of choices) choice.addEventListener('click', () => {
    for (const item of choices) item.setAttribute('aria-pressed', String(item === choice));
    if (player.getAttribute('src') !== choice.dataset.interiorClip) {
      player.pause();
      player.poster = choice.dataset.poster;
      player.src = choice.dataset.interiorClip;
    }
    player.setAttribute('aria-label', choice.textContent.trim());
    player.play().catch(() => {});
  });
  section.addEventListener('toggle', () => { if (!section.open) player.pause(); });
})();
