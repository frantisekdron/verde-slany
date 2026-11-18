(() => {
 const {cs,postCopy,siteRoot}=window.VERDE_LOCALE;
 const host=document.querySelector('#newsList');if(!host)return;
 const section=document.querySelector('#aktuality'),home=!!section;
 const status=document.createElement('p');status.className='news-feed-status';status.setAttribute('role','status');status.hidden=true;host.before(status);
 let applied=null;
 window.VERDE_LIVE.subscribe((data,info)=>{
  status.hidden=!info.failed||(!data&&home);
  status.textContent=info.stale?(cs?'Novinky se nepodařilo aktualizovat. Zkuste to prosím později.':'News could not be updated. Please try again later.'):'';
  if(!data)return;
  const posts=data.posts,signature=JSON.stringify(posts);
  if(signature===applied)return;applied=signature;
  if(section)section.hidden=posts.length===0;
  if(!posts.length){
   const empty=document.createElement('p');empty.className='news-empty';empty.textContent=cs?'Novinky připravujeme. Aktuální nabídku bytů najdete na hlavní stránce.':'Project updates are coming soon. Find the current apartment listings on the home page.';host.replaceChildren(empty);return;
  }
  host.replaceChildren(...posts.map(record=>{
   const post=postCopy(record),translated=cs||!!record.translations?.en;
   const article=document.createElement('article'),title=document.createElement(home?'h3':'h2'),date=document.createElement('time'),body=document.createElement('p');
   article.dataset.post=post.id;article.lang=translated?(cs?'cs':'en'):'cs';title.textContent=post.title;body.textContent=post.body;date.dateTime=post.date;
   const parsed=new Date(post.date+'T12:00:00Z');date.textContent=Number.isNaN(parsed.getTime())?post.date:parsed.toLocaleDateString(cs?'cs-CZ':'en-GB',{day:'numeric',month:'long',year:'numeric'});
   if(post.images.length){const gallery=document.createElement('div');gallery.className='news-gallery';post.images.forEach((src,index)=>{
    try{const url=new URL(src,new URL(siteRoot,location.origin));if(url.protocol!=='https:'&&url.origin!==location.origin)return;
     const link=document.createElement('a'),image=document.createElement('img');link.href=url.href;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',(cs?'Otevřít fotografii ':'Open photo ')+(index+1)+': '+post.title);image.src=url.href;image.alt=post.title+' · '+(index+1);image.loading='lazy';image.decoding='async';link.append(image);gallery.append(link);
    }catch{}
   });article.append(gallery);}
   article.append(date,title,body);
   if(!translated){const note=document.createElement('small');note.className='news-language-note';note.lang='en';note.textContent='This update is currently available in Czech.';article.append(note);}
   return article;
  }));
 });
})();
