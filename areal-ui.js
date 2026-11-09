(()=>{
 const embedded=window.parent!==window;
 const close=document.createElement('button');close.type='button';close.className='model-close';close.textContent=embedded?'Zavřít 3D ✕':'← Zpět na web';close.onclick=()=>{if(embedded)parent.postMessage({type:'verde-close-model'},location.origin);else location.href='/verde-slany/#areal'};document.body.append(close);
 const note=document.createElement('p');note.className='model-note';note.textContent='Ilustrační model. Další etapy a okolní infrastruktura jsou orientační; termín výstavby bude upřesněn.';document.body.append(note);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('#byt:not(.skryt)'))close.click()});
 setTimeout(()=>{const loading=document.querySelector('#nacitani');if(loading&&!loading.classList.contains('skryt')){const fallback=document.createElement('a');fallback.className='model-error-link';fallback.href='/verde-slany/#vyber';fallback.textContent='Přejít na výběr bytů bez 3D →';document.body.append(fallback);const observer=new MutationObserver(()=>{if(loading.classList.contains('skryt')){fallback.remove();observer.disconnect()}});observer.observe(loading,{attributes:true,attributeFilter:['class']})}},20000);
})();
