import {allowedOrigin} from '../api/security';
import catalog from '../content/catalog.json';
import {db,site,state,member} from './cms';
import {requirePermission} from './permissions';
import {changeCase} from './sales';
import {listPosts} from './news';
import {env} from 'cloudflare:workers';
import {publishedSiteData} from './public-site';
export async function publicSite(req:Request){
 // Private previews use their authenticated endpoints. This feed never serves drafts.
 if(new URL(req.url).searchParams.has('draft'))return json({error:'Drafts are available only in the private administration preview.'},403);
 const [snapshot,posts]=await Promise.all([state(),listPosts()]);
 const payload=publishedSiteData(catalogData(snapshot.published,snapshot.version,snapshot.updated),posts,new URL(req.url).origin,String((env as any).PUBLIC_BASE),(env as any).DEMO_MODE==='true');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
 const revision=Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('');
 return json({...payload,revision});
}
export async function publicNews(req:Request){
 const draft=new URL(req.url).searchParams.get('draft')==='1';
 if(draft)requirePermission(await member(),'content');
 const items=(await listPosts()).map((p:any)=>({id:p.id,article:draft?p.draft:p.published})).filter((p:any)=>p.article&&!p.article.archived).map((p:any)=>({id:p.id,title:p.article.title,body:p.article.body,date:p.article.date,image:p.article.image,images:p.article.images||[],translations:p.article.translations||{}} )).sort((a:any,b:any)=>b.date.localeCompare(a.date));
 return json(items);
}
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const mapping:Record<string,string>={'Na prodej':'volné','V jednání':'v jednání','Rezervováno':'rezervováno','Prodáno':'prodáno'};
export async function publicCatalog(req:Request){
 const draft=new URL(req.url).searchParams.get('draft')==='1';if(draft)requirePermission(await member(),'content');
 const s=await state(),values=draft?s.draft:s.published;
 return json(catalogData(values,s.version,s.updated,draft));
}
export function catalogData(values:any,version:number,updated:string,draft=false){
 const fields=Object.values(site.fields) as any[];
 const units=catalog.units.map((unit:any)=>{const next={...unit};for(const [name,key] of [['Cena','price'],['Stav','status'],['Podlaží','floor'],['Dispozice','disposition'],['Plocha (čistá)','area'],['Terasa / balkon','terrace'],['Předzahrádka','garden'],['Dokončení','term'],['Karta bytu','pdf']]){const f=fields.find(f=>f.shared===`unit:${unit.key}:${name}`);if(f&&Object.hasOwn(values,f.id))next[key]=key==='status'?mapping[values[f.id]]:values[f.id];}return next;});
 return {...catalog,units,cms:{version,updated,draft,content:Object.fromEntries(fields.filter(f=>f.contentKey).map(f=>[f.contentKey,values[f.id]??f.value]))}};
}
export async function publicInquiry(req:Request){
 if((env as any).DEMO_MODE==='true')return json({error:'This is a demo website. Please use the test administration to create a sample enquiry.'},409);
 if(!allowedOrigin(req))return json({error:"Invalid request origin."},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:"JSON data expected."},415);
 if(Number(req.headers.get('content-length')||0)>16000)return json({error:"The request is too large."},413);
 const raw=await req.text();if(raw.length>16000)return json({error:"The request is too large."},413);
 let body:any;try{body=JSON.parse(raw);}catch{return json({error:"Invalid request."},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:"Invalid request."},400);
 if(String(body.website||''))return json({error:"The enquiry cannot be accepted."},400);
 const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),note=String(body.note||'').trim();
 if(!name||name.length>150||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254||phone.length>60||(phone&&(!/^[+\d ()-]+$/.test(phone)||phone.replace(/\D/g,'').length<6))||note.length>3000)return json({error:"Enter your name and a valid email address. Check the phone number and message length."},400);
 const unit=String(body.unit||'').replace(/^flats\//,'');if(unit&&!catalog.units.some(u=>u.key===unit))return json({error:"Select an existing unit."},400);
 const project=String(body.project||'');if(unit&&project&&catalog.units.find(u=>u.key===unit)?.project!==project)return json({error:"This unit does not belong to the selected project."},400);
 if(project&&!['verde','borovskeho'].includes(project))return json({error:"Invalid project."},400);
 if(body.requestKey!==undefined&&(typeof body.requestKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestKey)))return json({error:"Invalid request ID."},400);
 const t=Date.now(),expires=t+15*60000,ip=req.headers.get('cf-connecting-ip')||'local';
 for(const [input,limit] of [[email,5],[ip,20]] as const){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)))).map(x=>x.toString(16).padStart(2,'0')).join('');const r:any=await db().prepare('INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING count').bind('inquiry:'+digest,expires,t,t,expires).first();if(r.count>limit)return json({error:"Too many enquiries. Try again in 15 minutes."},429);}
 const requestKey=typeof body.requestKey==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(body.requestKey)?body.requestKey:crypto.randomUUID();
 let id:string;
 if(unit){const result=await changeCase({unit:'flats/'+unit,name,email,phone,note,requestKey},{email:'web'},true);id=result.id;}
 else {id=crypto.randomUUID();const now=new Date().toISOString(),generalUnit=project?'project/'+project:'general';const existing:any=await db().prepare('SELECT id FROM sales_cases WHERE request_key=?').bind(requestKey).first();if(existing)id=existing.id;else try{await db().batch([db().prepare("INSERT INTO sales_cases(id,unit,name,email,phone,note,stage,expires,source,request_key,version,created,updated) VALUES(?,?,?,?,?,?,'new','','web',?,1,?,?)").bind(id,generalUnit,name,email,phone,note,requestKey,now,now),db().prepare("INSERT INTO sales_events(id,case_id,unit,kind,author,detail,created) VALUES(?,?,?,'inquiry','web',?,?)").bind(crypto.randomUUID(),id,generalUnit,JSON.stringify({from:null,to:'new'}),now)]);}catch(e){const prior:any=await db().prepare('SELECT id FROM sales_cases WHERE request_key=?').bind(requestKey).first();if(!prior)throw e;id=prior.id;}}
 return json({ok:true,saved:true,delivered:false,id,message:'Your enquiry has been saved. Email delivery is not enabled yet.'},201);
}
