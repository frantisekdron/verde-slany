export type NewsArticle={title:string;body:string;date:string;image?:string;images?:string[];archived?:boolean};
export function postImages(post:NewsArticle|null|undefined){return Array.isArray(post?.images)?post.images.filter((value):value is string=>typeof value==='string'&&!!value):post?.image?[post.image]:[];}
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
function articleMarkup(post:NewsArticle,locale:'en'|'cs'){
 const images=postImages(post);
 const openPhoto=locale==='cs'?'Otevřít fotografii':'Open photo';
 const media=images.length?`<div class="cms-news-media${images.length>1?' multiple':''}">${images.map((src,index)=>`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer" aria-label="${openPhoto} ${index+1}: ${esc(post.title)}"><img src="${esc(src)}" alt="${esc(post.title)} · ${index+1}" decoding="async" loading="lazy"></a>`).join('')}</div>`:'';
 return `<article class="cms-news-entry${images.length?'':' text-only'}">${media}<div class="cms-news-copy"><time datetime="${esc(post.date)}">${esc(post.date.split('-').reverse().join('.'))}</time><h2>${esc(post.title)}</h2>${post.body.split(/\n\s*\n/).map(text=>`<p>${esc(text).replaceAll('\n','<br>')}</p>`).join('')}</div></article>`;
}
const style='<style>.cms-news-list{max-width:1200px;margin:clamp(32px,5vw,80px) auto;padding:0 24px}.cms-news-entry{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:36px;padding:40px 0;border-bottom:1px solid #dce3df}.cms-news-entry.text-only{display:block}.cms-news-media{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;align-content:start}.cms-news-media a{display:block;min-width:0}.cms-news-media a:first-child{grid-column:1/-1}.cms-news-media img{width:100%;height:155px;object-fit:cover;display:block}.cms-news-media a:first-child img{height:min(40vw,420px)}.cms-news-copy time{font-size:14px}.cms-news-copy h2{font-size:clamp(25px,3vw,38px);line-height:1.15}.cms-news-copy p{line-height:1.7;overflow-wrap:anywhere}@media(max-width:700px){.cms-news-entry{grid-template-columns:1fr}.cms-news-media a:first-child img{height:260px}}</style>';
export function injectPosts(html:string|null,posts:{draft:NewsArticle|null;published:NewsArticle|null}[],draft=false,locale:'en'|'cs'='en'){
 if(!html)return html;
 const items=posts.map(post=>draft?post.draft:post.published).filter((item):item is NewsArticle=>!!item&&!item.archived).sort((a,b)=>b.date.localeCompare(a.date));
 if(!items.length)return html;
 const block=`<section class="cms-news-list" aria-label="${locale==='cs'?'Aktuality z projektů':'Project news'}">${items.map(item=>articleMarkup(item,locale)).join('')}</section>${style}`;
 if(html.includes('<!--VERDE_NEWS-->'))return html.replace(/(?:<p class="news-empty">[^<]*<\/p>\s*)?<!--VERDE_NEWS-->/,()=>block);
 const marker='<div class="entry-content entry-content--small" data-add-lightbox="">';
 if(html.includes(marker))return html.replace(marker,marker+block);
 return html.replace('</main>',block+'</main>');
}
