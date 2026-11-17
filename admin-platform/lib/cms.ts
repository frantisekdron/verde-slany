
import {env} from 'cloudflare:workers';


import source from '../content/site.json';
import {passwordMode,passwordUser} from './password-auth';
import {permissions,fieldAllowed,requirePermission} from './permissions';
import {isValidPrice,normalizePrice} from './price-validation';
export const site=source as any;
export const db=()=>env.DB!;
export const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function member(){
 const user=await passwordUser();
 if(!user)throw new Error('401|Please sign in.');
 if(user.mustChange)throw new Error('428|Change your temporary password first.');
 return user;
}

function readOverrides(json: string, version: number) {
 const overrides = JSON.parse(json);
 const migration = site.supersededDefaults;
 if (migration && version <= migration.throughVersion) {
  for (const [id, previous] of Object.entries(migration.values) as [string, string[]][]) {
   if (previous.includes(overrides[id])) delete overrides[id];
  }
 }
 return overrides;
}

export async function state() {
 const database = db();
 await database.prepare("INSERT OR IGNORE INTO cms_state(id,draft,published,version,updated) VALUES(1,'{}','{}',1,?)").bind(new Date().toISOString()).run();
 const row: any = await database.prepare('SELECT * FROM cms_state WHERE id=1').first();
 return {...row, draft: readOverrides(row.draft, row.version), published: readOverrides(row.published, row.version)};
}
export function validURL(value:string,kind:string){if(typeof value!=='string'||value.length>3000||/[\u0000-\u0020<>"'\\]/.test(value))return false;if(value.startsWith('/')&&!value.startsWith('//'))return kind!=='embed';try{const u=new URL(value);if(kind==='link'&&['mailto:','tel:'].includes(u.protocol))return true;if(u.protocol!=='https:')return false;if(kind==='embed')return ['player.vimeo.com','www.youtube-nocookie.com','www.google.com','maps.google.com'].includes(u.hostname);return true;}catch{return false;}}
export function validate(patch:any){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error("400|Invalid content.");patch={...patch};for(const [id,raw] of Object.entries(patch)){const f=site.fields[id];const value=f?.shared?.endsWith(':Cena')?normalizePrice(raw):raw;patch[id]=value;if(f?.shared?.endsWith(':Stav')&&!['Na prodej','V jednání','Rezervováno','Prodáno'].includes(value as string))throw new Error("400|Status must be Available, Under offer, Reserved or Sold.");if(!f)throw new Error("400|Unknown field.");if(f.shared?.endsWith(':Cena')&&!isValidPrice(value))throw new Error("400|Enter a price in CZK or On request.");if(f.kind==='gallery'){if(!Array.isArray(value)||value.length>200)throw new Error("400|The gallery can contain up to 200 photos.");for(const x of value)if(!x||!validURL(x.src,'image')||typeof x.alt!=='string'||x.alt.length>500||typeof x.caption!=='string'||x.caption.length>1000)throw new Error("400|Invalid photo in the gallery.");}else if(typeof value!=='string'||value.length>12000||(f.kind!=='text'&&!(f.optional&&value==='')&&!validURL(value,f.kind)))throw new Error("400|Invalid text or address.");}if(JSON.stringify(patch).length>900000)throw new Error("400|The content is too large.");return patch;}
export async function change(action:string,version:number,patch:any,user:any){const s=await state();if(s.version!==version)throw new Error("409|Someone else has changed this content. Refresh the page and review the changes.");const caps=permissions(user.role);if(!caps.content&&!caps.sales)throw new Error("403|You have read-only access.");if(action==='restore')requirePermission(user,'admin');if(['publish','discard','apply'].includes(action)&&!caps.publishContent&&!caps.sales)throw new Error("403|Your role does not allow publishing.");if(['save','apply'].includes(action)){validate(patch);for(const id of Object.keys(patch))if(!fieldAllowed(user.role,site.fields[id]))throw new Error("403|You do not have permission to edit this field.");}let draft=s.draft,published=s.published;if(action==='save')draft={...draft,...validate(patch)};else if(action==='apply'){const selected=validate(patch);if(!Object.keys(selected).length)throw new Error("400|Select a change to confirm.");draft={...draft,...selected};published={...published,...selected};}else if(action==='publish'){published={...published};for(const f of Object.values(site.fields) as any[])if(fieldAllowed(user.role,f))published[f.id]=draft[f.id]??f.value;}else if(action==='discard'){draft={...draft};for(const f of Object.values(site.fields) as any[])if(fieldAllowed(user.role,f))draft[f.id]=published[f.id]??f.value;}else if(action==='restore'){const r:any=await db().prepare('SELECT snapshot FROM revisions WHERE id=?').bind(String(patch.id)).first();if(!r)throw new Error('404|The version was not found.');draft=JSON.parse(r.snapshot).draft;}else throw new Error("400|Unknown action.");const now=new Date().toISOString(),revisionId=crypto.randomUUID();const extra:any[]=[];if(['publish','apply'].includes(action)){const {notificationStatement}=await import('./notifications');for(const f of Object.values(site.fields) as any[]){if(!f.shared?.endsWith(':Stav'))continue;const before=s.published[f.id]??f.value,after=published[f.id]??f.value;if(before===after)continue;const slug='flats/'+f.shared.split(':')[1];const active=await db().prepare("SELECT id FROM sales_cases WHERE unit=? AND stage='reserved'").bind(slug).first();if(active)throw new Error("409|This unit has a recorded reservation. Update it in the relevant contact's record.");extra.push(await notificationStatement(revisionId+':'+f.id,'availability',slug,slug,{sql:'EXISTS(SELECT 1 FROM revisions WHERE id=?)',args:[revisionId]}));}}const results=await db().batch([db().prepare('INSERT INTO revisions(id,action,snapshot,author,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cms_state WHERE id=1 AND version=?)').bind(revisionId,action,JSON.stringify({draft:s.draft,published:s.published}),user.email,now,version),db().prepare('UPDATE cms_state SET draft=?,published=?,version=version+1,updated=? WHERE id=1 AND version=?').bind(JSON.stringify(draft),JSON.stringify(published),now,version),...extra]);if(results[1].meta.changes!==1)throw new Error("409|The version has changed. Refresh the page.");return state();}
export function availability(values:any){return site.pages.filter((p:any)=>p.group==='units').map((p:any)=>{const key='unit:'+p.slug.split('/')[1]+':';const fields=Object.values(site.fields) as any[];const get=(name:string)=>{const f=fields.find(x=>x.shared===key+name);return f?values[f.id]??f.value:'';};return {slug:p.slug,title:p.title,status:get('Stav'),price:get('Cena'),floor:get('Podlaží')};});}
type Locale = 'en' | 'cs';

function displayUnitValue(field:any,value:any,locale:Locale){
 if(locale==='cs'||!field.shared?.startsWith('unit:')||typeof value!=='string')return value;
 const key=field.shared.split(':').at(-1);
 if(key==='Stav')return ({'Na prodej':'Available','V jednání':'Under negotiation','Rezervováno':'Reserved','Prodáno':'Sold'} as any)[value]||value;
 if(key==='Podlaží')return value.replace('3. + 4. NP','Levels 3 + 4').replace(/(\d+)\.\s*NP/g,'Level $1');
 if(key==='Dispozice')return ({'1+kk':'Studio (1+kk)','2+kk':'One-bedroom (2+kk)','3+kk':'Two-bedroom (3+kk)','4+kk':'Three-bedroom (4+kk)'} as any)[value]||value;
 if(key==='Dokončení')return value.replace(/([1-4])Q\s*\/\s*(\d{4})/,'Q$1 $2');
 if(key==='Cena')return value.replace(/Cena nezveřejněna/i,'Price not published').replace(/(?:Cena )?na dotaz/i,'Price on request').replace(/Kč/g,'CZK').replace(/^od /i,'From ');
 return value.replace(/(\d),(\d)/g,'$1.$2');
}
function renderFilms(locale:Locale, value:(id:string)=>any){
 const config=site.films[locale];
 const cs=locale==='cs';
 const poster=esc(value(config.poster));
 const clips=[
  {id:'film-verde', name:'Verde Slaný II', url:value(config.project)},
  {id:'film-borovskeho', name:'Byty Borovského', url:value(config.maisonette)},
 ].filter(clip=>clip.url);
 const films=clips.map(clip=>{
  const approved=clip.id==='film-verde'&&clip.url===site.fields[config.project].value;
  const title=cs?`Film o projektu ${clip.name} v češtině`:`${clip.name} — project film in English`;
  const label=cs?`Přehrát film o projektu ${clip.name} v češtině`:`Play the ${clip.name} project film in English`;
  const play=`<span class="play-circle" aria-hidden="true">▶</span><span>${cs?'Přehrát film':'Watch the film'} <b>${esc(clip.name)}${approved?' · 1:44':''}</b></span>`;
  if(approved&&config.vimeo){
   return `<figure class="project-film"><div class="film-stage vimeo-film" id="${clip.id}" data-vimeo-src="${esc(config.vimeo)}" data-fallback="${esc(config.mobile)}" data-captions="${esc(config.captions)}" data-title="${esc(title)}">
    <img class="vimeo-poster" src="${poster}" alt="Verde Slaný II — visualisation" loading="lazy" decoding="async" width="1920" height="1080">
    <button class="vimeo-play" type="button" aria-label="${esc(label)}">${play}</button>
    <noscript><video controls playsinline preload="none" poster="${poster}" src="${esc(clip.url)}" aria-label="${esc(title)}"></video></noscript>
   </div></figure>`;
  }
  const mobile=approved&&config.mobile?` data-mobile-src="${esc(config.mobile)}"`:'';
  const track=approved&&config.captions?`<track kind="captions" src="${esc(config.captions)}" srclang="${locale}" label="${cs?'Čeština':'English'}">`:'';
  return `<figure class="project-film"><div class="film-stage">
   <video${track?' crossorigin="anonymous"':''} id="${clip.id}" controls playsinline preload="none" poster="${poster}" aria-label="${esc(title)}" src="${esc(clip.url)}"${mobile}>${track}</video>
   <button class="film-play" type="button" data-film="${clip.id}" aria-label="${esc(label)}">${play}</button>
  </div></figure>`;
 }).join('');
 return films?`<section class="film-section wrap" id="film" aria-labelledby="filmTitle"><div class="section-head"><div><h3 id="filmTitle">${cs?'Film o Verde II':'Verde II film'}</h3></div></div>${films}</section>`:'';
}

export function render(slug:string,values:any,draft=false,_preview=true){
 const locale:Locale=slug==='cs'||slug.startsWith('cs/')?'cs':'en';
 const pageSlug=locale==='cs'?slug.slice(3):slug;
 const page=site.pages.find((p:any)=>p.slug===pageSlug);
 if(!page)return null;
 const getValue=(id:string)=>Object.hasOwn(values,id)?values[id]:site.fields[id].value;
 let html:string=locale==='cs'?page.htmlCs:page.html;
 // Responsive candidates describe only the default image.
 html=html.replace(/<img\b[^>]*\ssrc="@@CMS_([a-f0-9]+)@@"[^>]*>/g,(tag,id)=>getValue(id)===site.fields[id].value?tag:tag.replace(/\s+srcset="[^"]*"/g,''));
 html=html.replace(/@@CMS_([a-f0-9]+)@@/g,(_,id:string)=>{
  const field=site.fields[id],value=getValue(id);
  if(field.kind==='gallery')return value.map((image:any)=>`<figure><img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy">${image.caption?`<figcaption>${esc(image.caption)}</figcaption>`:''}</figure>`).join('');
  const display=esc(displayUnitValue(field,value,locale));
  return field.linebreaks?display.replaceAll("\n","<br>"):display;
 });
 if(pageSlug==='')html=html.replace('<!--VERDE_FILM-->',()=>renderFilms(locale,getValue));
 if(draft)html=html.replace('</body>',`<aside style="position:fixed;bottom:12px;left:12px;z-index:99999;background:#163f32;color:white;padding:12px 20px;border-radius:8px;font:14px system-ui">${locale==='cs'?'Náhled konceptu':'Draft preview'} · <a style="color:white" href="/admin-verde">${locale==='cs'?'Správa webu':'Administration'}</a></aside></body>`);
 return html;
}
