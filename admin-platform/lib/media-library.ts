/* eslint-disable @typescript-eslint/no-explicit-any */
import {db,site,state} from './cms';
import {listPosts} from './news';
import {requirePermission} from './permissions';
import metadata from '../content/admin-metadata.json';

type MediaRow={id:string;name:string;mime:string;size:number;created:string;folder:string;removed_at:string};
const mimeFor=(url:string)=>/\.(jpe?g)(?:[?#]|$)/i.test(url)?'image/jpeg':/\.png(?:[?#]|$)/i.test(url)?'image/png':/\.webp(?:[?#]|$)/i.test(url)?'image/webp':/\.mp4(?:[?#]|$)/i.test(url)?'video/mp4':/\.pdf(?:[?#]|$)/i.test(url)?'application/pdf':'';
const fileURL=(id:string)=>'/files/'+id;
const extract=(v:unknown)=>JSON.stringify(v??'');
function safeName(url:string){try{return decodeURIComponent(new URL(url,'https://local.invalid').pathname.split('/').pop()||url).replace(/[-_]+/g,' ').slice(0,180);}catch{return url.slice(0,180);}}
function staticInventory(){
 const items=new Map<string,any>();
 const add=(url:string,name:string,folder:string,preview?:string)=>{if(!url||url.startsWith('/files/')||url.startsWith('data:')||url.startsWith('//'))return;const mime=mimeFor(url);if(!mime||(!url.startsWith('/')&&!url.startsWith('https://')))return;const old=items.get(url);if(!old||old.name===safeName(url))items.set(url,{url,name:name||safeName(url),mime,folder,source:'web',preview:preview||null,removable:false});};
 for(const f of Object.values(site.fields) as any[]){const folder=f.kind==='document'?'Website documents':f.kind==='video'?'Website videos':'Website photos';if(['image','video','document'].includes(f.kind))add(f.value,f.kind==='document'?(metadata as any).documents?.[f.id]?.name||f.label:f.label,folder,(metadata as any).documents?.[f.id]?.preview);if(f.kind==='gallery')for(const image of f.value||[])add(image.src,image.alt||safeName(image.src),'Website photos');}
 for(const page of site.pages as any[]){const html=String(page.html||'');for(const match of html.matchAll(/\b(?:src|href|poster|data-src|data-full|srcset)\s*=\s*["']([^"']+)["']/gi)){for(const part of match[1].split(',')){const url=part.trim().split(/\s+/)[0].replaceAll('&amp;','&');add(url,safeName(url),mimeFor(url)==='application/pdf'?'Website documents':mimeFor(url)==='video/mp4'?'Website videos':'Website photos');}}}
 return [...items.values()];
}
async function referenceSources(){
 const [s,posts,revisions]=await Promise.all([state(),listPosts(),db().prepare('SELECT snapshot FROM revisions').all()]);
 return [
  ['Default website content',extract(Object.values(site.fields).map((f:any)=>f.value))],
  ['Website draft',extract(s.draft)],
  ['Published website',extract(s.published)],
  ['News drafts',extract(posts.map((p:any)=>p.draft))],
  ['Published news',extract(posts.map((p:any)=>p.published))],
  ['Version history',extract(revisions.results.map((r:any)=>r.snapshot))],
  ['Original pages',extract((site.pages as any[]).map(p=>p.html))],
 ] as [string,string][];
}
function usage(id:string,sources:[string,string][]) {const url=fileURL(id);return sources.filter(([,content])=>content.includes(url)).map(([label])=>label);}
export async function listMediaLibrary(user:any){
 requirePermission(user,'content');
 const s=await state(),builtIn=staticInventory(),byUrl=new Map(builtIn.map(x=>[x.url,x]));
 const addCurrent=(v:unknown)=>{if(typeof v==='string'){if(!byUrl.has(v)&&mimeFor(v)&&(v.startsWith('/')&&!v.startsWith('//')||v.startsWith('https://'))&&!v.startsWith('/files/'))byUrl.set(v,{url:v,name:safeName(v),mime:mimeFor(v),folder:'Other website assets',source:'web',preview:null,removable:false});}else if(Array.isArray(v))v.forEach(addCurrent);else if(v&&typeof v==='object')Object.values(v).forEach(addCurrent);};
 addCurrent(s.draft);addCurrent(s.published);for(const p of await listPosts()){addCurrent(p.draft?.images??p.draft?.image);addCurrent(p.published?.images??p.published?.image);}
 const [mediaRows,folderRows,placementRows,sources]=await Promise.all([db().prepare('SELECT * FROM media ORDER BY created DESC').all(),db().prepare('SELECT name FROM library_folders ORDER BY name').all(),db().prepare('SELECT url,folder FROM library_placements').all(),referenceSources()]);
 const uploads=(mediaRows.results as MediaRow[]).map(r=>({...r,url:fileURL(r.id),source:'upload',usage:usage(r.id,sources),removable:true}));
 const placements=new Map(placementRows.results.map((r:any)=>[r.url,r.folder]));
 const website=[...byUrl.values()].map(x=>({...x,folder:placements.get(x.url)||x.folder}));
 const folders=[...new Set([...folderRows.results.map((r:any)=>r.name),...uploads.map(x=>x.folder),...website.map(x=>x.folder)])];
 return {uploads,site:website,folders};
}
function checkedFolder(value:unknown){const folder=String(value||'').trim();if(!folder||folder.length>80||/[\u0000-\u001f<>/\\]/.test(folder))throw new Error('400|Enter a folder name of up to 80 characters.');return folder;}
export async function updateMediaLibrary(body:any,user:any){
 requirePermission(user,'content');const action=String(body?.action||'');
 if(action==='create-folder'){const folder=checkedFolder(body.folder);await db().prepare('INSERT OR IGNORE INTO library_folders(name,created) VALUES(?,?)').bind(folder,new Date().toISOString()).run();return {ok:true};}
 if(action==='folder'&&body.url&&!body.id){
  const folder=checkedFolder(body.folder),url=String(body.url),inventory=await listMediaLibrary(user);
  if(!inventory.site.some((item:any)=>item.url===url))throw new Error('404|The website asset was not found.');
  await db().batch([db().prepare('INSERT OR IGNORE INTO library_folders(name,created) VALUES(?,?)').bind(folder,new Date().toISOString()),db().prepare('INSERT INTO library_placements(url,folder) VALUES(?,?) ON CONFLICT(url) DO UPDATE SET folder=excluded.folder').bind(url,folder)]);
  return {ok:true};
 }
 const id=String(body?.id||'');if(!/^[a-f0-9-]+\.(jpg|png|webp|pdf|mp4)$/.test(id))throw new Error('400|Invalid file.');
 const row=await db().prepare('SELECT * FROM media WHERE id=?').bind(id).first() as MediaRow|null;if(!row)throw new Error('404|The file was not found.');
 if(action==='folder'){
  const folder=checkedFolder(body.folder);
  await db().batch([db().prepare('INSERT OR IGNORE INTO library_folders(name,created) VALUES(?,?)').bind(folder,new Date().toISOString()),db().prepare('UPDATE media SET folder=? WHERE id=?').bind(folder,id)]);return {ok:true};
 }
 if(action==='restore'){await db().prepare("UPDATE media SET removed_at='' WHERE id=?").bind(id).run();return {ok:true};}
 // Archive hides a file from the picker; the stored file and existing URLs remain intact.
 if(action==='remove'){
  const inUse=usage(id,await referenceSources());if(inUse.length)throw new Error('409|This file is used in: '+inUse.join(', ')+'. Remove those references first.');
  const result=await db().prepare("UPDATE media SET removed_at=? WHERE id=? AND removed_at=''").bind(new Date().toISOString(),id).run();if(result.meta.changes!==1)throw new Error('409|The file is already archived.');return {ok:true};
 }
 throw new Error('400|Unknown library action.');
}
