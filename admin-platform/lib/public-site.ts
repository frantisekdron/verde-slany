// An explicit allowlist keeps CRM contacts, drafts and internal CMS fields out
// of the anonymous feed consumed by GitHub Pages.
export function publishedSiteData(catalog:any,posts:any[],apiOrigin:string,publicBase:string,demo=false){
 const mediaURL=(value:unknown)=>{
  if(typeof value!=='string'||!value)return '';
  if(value.startsWith('/files/'))return new URL(value,apiOrigin).href;
  if(value.startsWith('/web/'))return new URL(value.slice(5),publicBase).href;
  if(value.startsWith('/')&&!value.startsWith('//'))return new URL(value,publicBase).href;
  try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}
 };
 const units=catalog.units.filter((unit:any)=>unit.project==='verde').map((unit:any)=>({key:unit.key,price:unit.price,status:unit.status}));
 const articles=posts.filter(post=>post.published&&!post.published.archived).map(post=>{
  const article=post.published;
  const images=(Array.isArray(article.images)?article.images:article.image?[article.image]:[]).map(mediaURL).filter(Boolean);
  const english=article.translations?.en;
  return {id:post.id,title:article.title,body:article.body,date:article.date,images,
   ...(english?.title&&english?.body?{translations:{en:{title:english.title,body:english.body}}}:{})};
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 return {schema:1,demo,units,posts:articles};
}
