(async()=>{
 const {cs, postCopy, siteRoot}=window.VERDE_LOCALE;
 const host=document.querySelector('#newsList');if(!host)return;
 try{
  const response=await fetch(siteRoot+'news.json',{cache:'no-store'});if(!response.ok)throw new Error('news');
  const data=await response.json(),posts=Array.isArray(data)?data:data.posts||[];
  if(!posts.length)return;
  const items=posts.map(record=>{
   const post=postCopy(record);
   const article=document.createElement('article'),title=document.createElement('h2'),date=document.createElement('small'),body=document.createElement('p');
   title.textContent=post.title||'';date.textContent=post.date||'';body.textContent=post.text||post.body||'';
   const photos=(Array.isArray(post.images)&&post.images.length?post.images:[post.image]).filter(Boolean);
   if(photos.length){const gallery=document.createElement('div');gallery.className='news-gallery';photos.forEach((src,index)=>{try{const url=new URL(src,new URL(siteRoot,location.origin));if(!['http:','https:'].includes(url.protocol))return;const link=document.createElement('a'),image=document.createElement('img');link.href=url.href;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',(cs?'Otevřít fotografii ':'Open photo ')+(index+1)+': '+(post.title||''));image.src=url.href;image.alt=(post.title||(cs?'Fotografie projektu':'Project photograph'))+' · '+(index+1);image.loading='lazy';image.decoding='async';link.append(image);gallery.append(link);}catch{}});article.append(gallery)}
   article.append(date,title,body);return article;
  });host.replaceChildren(...items);
 }catch{host.querySelector('p').textContent=cs?"Novinky se právě nepodařilo načíst. Nabídku bytů najdete na hlavní stránce.":"News could not be loaded. You can find the apartment listings on the home page."}
})();
