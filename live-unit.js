(() => {
  const key=document.body.dataset.unit;
  if(!key||!window.VERDE_LIVE)return;
  window.VERDE_LIVE.subscribe((data,info)=>{
    const unit=data?.units.find(unit=>unit.key===key);
    if(unit){document.querySelector('[data-unit-price]').textContent=window.VERDE_LIVE.price(unit.price);document.querySelector('[data-unit-status]').textContent=window.VERDE_LIVE.status(unit.status);}
    const note=document.querySelector('.unit-date');if(note)note.textContent=window.VERDE_LIVE.note({...info,stale:info.stale||!unit});
  });
})();
