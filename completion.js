(()=>{
 const review=document.querySelector('.variant-review');if(review){review.hidden=false;if(new URLSearchParams(location.search).get("review")==="1")review.open=true;}
 const media=document.querySelector('#media'),body=document.querySelector('#mediaBody'),gallery=document.querySelector('#galleryDialog');
 if(!media||!body||!gallery)return;
 const grid=document.querySelector('#visualGallery'),toggle=document.querySelector('#galleryToggle');
 if(grid&&toggle&&grid.children.length>4){grid.classList.add('is-collapsible');toggle.hidden=false;const total=grid.children.length;toggle.textContent='Zobrazit všech '+total+' vizualizací';toggle.addEventListener('click',()=>{const open=grid.classList.toggle('is-expanded');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Zobrazit méně':'Zobrazit všech '+total+' vizualizací';if(!open)document.querySelector('#galerie').scrollIntoView({block:'start'});});}

 let galleryTrigger=null,arealTrigger=null;
 document.querySelectorAll('.gallery-open').forEach(button=>button.addEventListener('click',()=>{galleryTrigger=button;document.querySelector('#galleryDialogTitle').textContent=button.dataset.caption;const image=document.querySelector('#galleryDialogImage');image.src=button.dataset.image;image.alt=button.querySelector('img').alt;gallery.showModal()}));
 gallery.addEventListener('close',()=>{document.querySelector('#galleryDialogImage').removeAttribute('src');galleryTrigger?.focus()});
 function openAreal(trigger){
  arealTrigger=trigger;document.querySelector('#mediaTitle').textContent=trigger.dataset.interior?'Z areálu do ukázkového interiéru':'Celý areál Verde Slaný ve 3D';media.classList.add('areal-media');
  const url=new URL('/verde-slany/areal/',location.origin);if(trigger.dataset.interior)url.searchParams.set('interior',trigger.dataset.interior);if(trigger.dataset.etapy)url.searchParams.set('zapnout','etapy');
  body.innerHTML='<p class="areal-access"><a target="_blank" rel="noopener">Otevřít model v samostatném okně ↗</a><button id="arealToCatalog" type="button">Vybrat byt podle půdorysu →</button></p>';
  body.querySelector('a').href=url.pathname+url.search;const frame=document.createElement('iframe');frame.src=url.pathname+url.search;frame.title='Ilustrační 3D areál Verde Slaný s volitelnými dalšími etapami a vstupem do bytu';frame.allow='fullscreen';frame.allowFullscreen=true;body.append(frame);
  body.querySelector('#arealToCatalog').onclick=()=>{media.close();document.querySelector('#vyber').scrollIntoView();document.querySelector('[data-project="verde"]').focus()};media.showModal();
 }
 document.querySelectorAll('#openAreal,.open-areal-inline').forEach(button=>button.addEventListener('click',()=>openAreal(button)));
 media.addEventListener('close',()=>{media.classList.remove('connected-media');if(media.classList.contains('areal-media')){media.classList.remove('areal-media');arealTrigger?.focus()}});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==body.querySelector('iframe')?.contentWindow)return;if(event.data?.type==='verde-close-model')media.close()});
 const phaseNames={SO01:'SO 01 · plánovaný dům do U',SO03:'SO 03 · plánovaný zalomený dům',SO04:'SO 04 · plánovaný bytový dům'};
 document.querySelectorAll('[data-phase]').forEach(button=>button.addEventListener('click',()=>{const code=button.dataset.phase;document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.phase===code)));const status=document.querySelector('#phaseStatus');status.replaceChildren();const heading=document.createElement('h3');heading.textContent=phaseNames[code];const p=document.createElement('p');p.textContent=document.getElementById('phaseText'+code)?.textContent||'Termíny výstavby upřesní prodejce.';const date=document.createElement('p');date.textContent='Aktualizace: '+(document.querySelector('.update-stamp time')?.textContent||'9. 11. 2026')+' · ilustrační návrh budoucího stavu.';status.append(heading,p,date)}));
 document.querySelectorAll('.film-play').forEach(button=>{const video=document.getElementById(button.dataset.film);button.addEventListener('click',()=>{button.hidden=true;video.play().catch(()=>{button.hidden=false})});video.addEventListener('play',()=>button.hidden=true);video.addEventListener('ended',()=>button.hidden=false)});
})();
