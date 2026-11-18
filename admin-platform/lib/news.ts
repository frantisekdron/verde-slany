import {db,validURL} from './cms';
import {requirePermission} from './permissions';
export {injectPosts,postImages} from './news-render';
export async function listPosts(){return (await db().prepare('SELECT * FROM news_posts ORDER BY updated DESC').all()).results.map((r:any)=>({...r,draft:JSON.parse(r.draft),published:JSON.parse(r.published)}));}
export async function savePost(body:any,user:any){
 requirePermission(user,'content');
 const old:any=body.id?await db().prepare('SELECT * FROM news_posts WHERE id=?').bind(String(body.id)).first():null;
 if(body.id&&!old)throw new Error('404|The article was not found.');
 if(old&&body.version!==old.version)throw new Error('409|Someone else updated this article. Refresh the list before saving.');
 if(!['save','publish','archive'].includes(body.action))throw new Error('400|Invalid article action.');
 if(body.action!=='save')requirePermission(user,'publishContent');
 // Keep the first image for clients that still read the original single-photo field.
 const supplied=body.images===undefined?(body.image?[body.image]:[]):body.images;
 if(!Array.isArray(supplied)||supplied.length>12||supplied.some((url:unknown)=>typeof url!=='string'||!validURL(url,'image'))||new Set(supplied).size!==supplied.length)throw new Error('400|Choose up to 12 different photos with valid URLs.');
 const english={title:String(body.translations?.en?.title||'').trim(),body:String(body.translations?.en?.body||'').trim()};
 if((english.title||english.body)&&(!english.title||!english.body||english.title.length>180||english.body.length>10000))throw new Error('400|Complete both the English title and article text, or leave both empty.');
 const images=supplied as string[],article={title:String(body.title||'').trim(),body:String(body.body||'').trim(),date:String(body.date||''),image:images[0]||'',images,translations:english.title?{en:english}:{},archived:body.action==='archive'};
 if(!article.title||article.title.length>180||!article.body||article.body.length>10000||!/^\d{4}-\d{2}-\d{2}$/.test(article.date)||!Number.isFinite(Date.parse(article.date))||new Date(article.date+'T00:00:00Z').toISOString().slice(0,10)!==article.date)throw new Error('400|Enter a title, a valid date and article text.');
 const id=old?.id||crypto.randomUUID(),draft=JSON.stringify(article),published=body.action==='save'?(old?.published||'null'):draft,now=new Date().toISOString();
 const result=old?await db().prepare('UPDATE news_posts SET draft=?,published=?,version=version+1,updated=? WHERE id=? AND version=?').bind(draft,published,now,id,body.version).run():await db().prepare('INSERT INTO news_posts(id,draft,published,version,updated) VALUES(?,?,?,1,?)').bind(id,draft,published,now).run();
 if(result.meta.changes!==1)throw new Error('409|Someone else updated this article. Refresh the list before saving.');return {id};
}
