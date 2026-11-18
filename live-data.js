(() => {
  'use strict';
  const {cs,siteRoot}=window.VERDE_LOCALE;
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  const endpoint=demo?'https://verde-slany-admin-demo.frantisekdron.workers.dev':'https://verde-slany-admin-api.frantisekdron.workers.dev';
  const listeners=new Set();
  let snapshot=null,inflight=null,timer=null,checkedAt=null,stale=true,failed=false,lastAttempt=0;
  const statuses=new Set(['volné','v jednání','rezervováno','prodáno']);
  function validate(value){
    if(value?.schema!==1||value.demo!==demo||!Array.isArray(value.units)||!value.units.length||!Array.isArray(value.posts)||!/^[a-f0-9]{64}$/.test(value.revision))throw new Error('Invalid public feed');
    const keys=new Set();
    for(const unit of value.units){
      if(!/^verde-[AB]\.[1-5]\.\d+$/.test(unit.key)||keys.has(unit.key)||typeof unit.price!=='string'||unit.price.length>120||!statuses.has(unit.status))throw new Error('Invalid public unit');
      keys.add(unit.key);
    }
    for(const post of value.posts)if(typeof post.id!=='string'||typeof post.title!=='string'||typeof post.body!=='string'||typeof post.date!=='string'||!Array.isArray(post.images))throw new Error('Invalid public article');
    return value;
  }
  function info(){return {demo,stale,checkedAt,failed};}
  function emit(){for(const listener of listeners)listener(snapshot,info());}
  function schedule(){clearTimeout(timer);if(listeners.size&&!document.hidden)timer=setTimeout(refresh,30000);}
  function refresh(){
    if(inflight)return inflight;
    clearTimeout(timer);lastAttempt=Date.now();
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
    inflight=(async()=>{
      try{
        const response=await fetch(endpoint+'/api/public-site',{cache:'no-store',credentials:'omit',signal:abort.signal});
        if(!response.ok)throw new Error('Public data unavailable');
        snapshot=validate(await response.json());checkedAt=new Date();stale=false;failed=false;
      }catch{stale=true;failed=true;}
      finally{clearTimeout(timeout);inflight=null;emit();schedule();}
      return snapshot;
    })();
    return inflight;
  }
  function subscribe(listener){listeners.add(listener);listener(snapshot,info());if(!inflight&&!checkedAt)void refresh();else schedule();return()=>{listeners.delete(listener);if(!listeners.size)clearTimeout(timer);};}
  function resume(){if(!document.hidden&&listeners.size){if(Date.now()-lastAttempt>1000)void refresh();else schedule();}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else resume();});
  window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);
  // A publication in another tab of this browser can refresh immediately;
  // visitors on other devices are covered by the periodic refresh above.
  if(typeof BroadcastChannel==='function'){
    const publications=new BroadcastChannel('verde-publication');
    publications.onmessage=event=>{if(event.data?.type==='published'&&event.data.demo===demo&&listeners.size&&!document.hidden)void refresh();};
  }
  function price(value){return cs?value:String(value).replace(/Cena nezveřejněna/i,'Price not published').replace(/(?:Cena )?na dotaz/i,'Price on request').replace(/Kč/g,'CZK').replace(/^od /i,'From ');}
  function status(value){return cs?({'volné':'Na prodej','v jednání':'V jednání','rezervováno':'Rezervováno','prodáno':'Prodáno'}[value]||value):({'volné':'Available','v jednání':'Under negotiation','rezervováno':'Reserved','prodáno':'Sold'}[value]||value);}
  function note(state){
    if(state.stale&&state.failed&&!state.checkedAt)return cs?'Aktuální ceny a dostupnost se nepodařilo načíst. Zobrazen uložený ceník; údaje potvrďte s prodejcem.':'Current prices and availability could not be loaded. Showing the saved price list; please confirm with the sales agent.';
    if(state.stale)return state.checkedAt?(cs?'Aktualizace se nezdařila. Zobrazeny poslední načtené ceny a dostupnost; potvrďte je s prodejcem.':'Update unavailable. Showing the last loaded prices and availability; please confirm with the sales agent.'):(cs?'Aktuální ceny a dostupnost se načítají. Do ověření je zobrazen uložený ceník; údaje potvrdí prodejce.':'Loading current prices and availability. The saved price list is shown until verified; please confirm with the sales agent.');
    return (state.demo?(cs?'TESTOVACÍ DATA · ':'DEMO DATA · '):'')+(cs?'Ceny a dostupnost ověřeny ':'Prices and availability checked ')+state.checkedAt.toLocaleTimeString(cs?'cs-CZ':'en-GB',{hour:'2-digit',minute:'2-digit'})+(cs?'. Aktualizují se automaticky. Poptávka není rezervace.':'. Updates are automatic. An enquiry is not a reservation.');
  }
  window.VERDE_LIVE={subscribe,refresh,demo,price,status,note};
  if(demo){
    document.documentElement.dataset.demo='true';
    const banner=document.createElement('aside');banner.className='live-demo-banner';banner.setAttribute('aria-label',cs?'Testovací verze':'Demo website');
    const text=document.createElement('span');text.textContent=cs?'Testovací web · ceny, rezervace a novinky jsou ukázkové.':'Demo website · prices, reservations and news are test data.';
    const link=document.createElement('a');link.href=siteRoot+'admin/?demo=1';link.textContent=cs?'Testovací administrace ↗':'Test administration ↗';banner.append(text,link);document.body.prepend(banner);
    // Keep the demo isolated when following unit, news and language links.
    const preserveDemo=event=>{
      const a=event.target.closest?.('a');if(!a)return;
      const url=new URL(a.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith(siteRoot))return;
      url.searchParams.set('demo','1');a.href=url.href;
    };
    for(const type of ['pointerdown','contextmenu','click'])document.addEventListener(type,preserveDemo,true);
  }
})();
