(async()=>{
 const host=document.querySelector('#newsList');if(!host)return;
 try{
  const response=await fetch('../news.json',{cache:'no-store'});if(!response.ok)throw new Error('news');
  const data=await response.json(),posts=Array.isArray(data)?data:data.posts||[];
  if(!posts.length)return;
  const items=posts.map(post=>{
   const article=document.createElement('article'),title=document.createElement('h2'),date=document.createElement('small'),body=document.createElement('p');
   title.textContent=post.title||'';date.textContent=post.date||'';body.textContent=post.text||post.body||'';
   if(post.image){const url=new URL(post.image,location.href);if(['http:','https:'].includes(url.protocol)){const image=document.createElement('img');image.src=url.href;image.alt=post.title||'Fotografie aktuality';image.loading='lazy';article.append(image)}}
   article.append(date,title,body);return article;
  });host.replaceChildren(...items);
 }catch{host.querySelector('p').textContent='Novinky se právě nepodařilo načíst. Nabídku bytů najdete na hlavní stránce.'}
})();
