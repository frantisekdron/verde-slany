import {env} from 'cloudflare:workers';
import * as routes from './routes';
import * as auth from './auth-routes';
import * as files from './file-route';
import {withRequest} from './context';
import {allowedOrigin,secureResponse} from './security';
import {accessLink,validAccessLink} from './access-links';
import {db,member,state,render,site} from '../lib/cms';
import {permissions,requirePermission} from '../lib/permissions';
import {listPosts,injectPosts} from '../lib/news';
import {catalogData} from '../lib/public-api';
import englishApp from './preview-en.txt';
import czechApp from './preview-cs.txt';
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function dispatch(request:Request):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='OPTIONS')return new Response(null,{status:allowedOrigin(request)?204:403});
 if((env as any).AUTH_MODE!=='password'||String((env as any).AUTH_PEPPER||'').length<32)return json({error:'The administration server is awaiting secure configuration.'},503);
 if(path==='/health'){
  await db().prepare('SELECT id FROM cms_state LIMIT 1').all();
  return json({ok:true,service:'verde-admin-api'});
 }
 if(path==='/preview-app.js'&&request.method==='GET')return new Response(url.searchParams.get('lang')==='cs'?czechApp:englishApp,{headers:{'Content-Type':'text/javascript','Cache-Control':'public, max-age=300'}});
 if(path==='/preview'&&request.method==='GET'){
  const target=url.searchParams.get('target')||'';
  if(!await validAccessLink(request,'preview',target))return json({error:'This private preview has expired. Open a fresh preview from the administration.'},403);
  const snapshot=await state();let html=render(target,snapshot.draft,true);if(!html)return json({error:'Page not found.'},404);
  const locale=target==='cs'||target.startsWith('cs/')?'cs':'en';
  if(target==='aktuality'||target==='cs/aktuality')html=injectPosts(html,await listPosts(),true,locale)!;
  const publicBase=String((env as any).PUBLIC_BASE),session=url.searchParams.get('session')!;
  const catalog=catalogData(snapshot.draft,snapshot.version,snapshot.updated,true);
  html=html.replace(/(["'])\/web\//g,'$1'+publicBase).replaceAll('href="/admin-verde"','href="'+publicBase+'admin/"');
  html=html.replace(/\/files\/([a-f0-9-]+\.(?:jpg|png|webp|pdf|mp4))/g,(_all,id)=>accessLink(url.origin,'file',id,session).replaceAll('&','&amp;'));
  html=html.replace(/<script src="[^"]*\/(?:cs\/)?app\.js[^\"]*"><\/script>/,`<script src="${url.origin}/preview-app.js?lang=${locale}"></script>`);
  const safeJSON=JSON.stringify(catalog).replaceAll('<','\\u003c');
  html=html.replace('<head>','<head><base href="'+publicBase+'"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">');
  html=html.replace('</head>','<script>window.__VERDE_PREVIEW_CATALOG='+safeJSON+';</script></head>');
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"frame-ancestors 'none'; object-src 'none'"}});
 }
 if(path==='/api/preview-link'&&request.method==='POST'){
  if(!allowedOrigin(request))return json({error:'Invalid request origin.'},403);
  const user=await member();requirePermission(user,'content');
  const body=await request.json() as any,target=String(body.target||'');
  const slug=target==='cs'?'':target.startsWith('cs/')?target.slice(3):target;
  if(!site.pages.some((page:any)=>page.slug===slug))return json({error:'Page not found.'},404);
  return json({url:accessLink(url.origin,'preview',target,user.sessionId)});
 }
 if(path.startsWith('/files/')&&request.method==='GET')return files.GET(request,{params:Promise.resolve({id:path.slice(7)})});
 let response:Response;
 if(path.startsWith('/api/auth/')){
  const action=path.slice('/api/auth/'.length),context={params:Promise.resolve({action})};
  if(request.method==='GET')response=await auth.GET(request,context);
  else if(request.method==='POST')response=await auth.POST(request,context);
  else return json({error:'Method not allowed.'},405);
 }else if(path.startsWith('/api/')){
  const context={params:Promise.resolve({path:path.slice(5).split('/')})};
  if(request.method==='GET')response=await routes.GET(request,context);
  else if(request.method==='POST')response=await routes.POST(request,context);
  else return json({error:'Method not allowed.'},405);
  if(response.ok&&['/api/state','/api/upload'].includes(path)){
   const user=await member();
   if(permissions(user.role).content){
    const body=await response.json() as any;
    const rows=(await db().prepare("SELECT id FROM media WHERE removed_at='' ORDER BY created DESC").all()).results;
    body.fileUrls=Object.fromEntries(rows.map((row:any)=>['/files/'+row.id,accessLink(url.origin,'file',row.id,user.sessionId)]));
    response=json(body,response.status);
   }
  }
 }else return json({error:'Not found.'},404);
 return response;
}
export default {async fetch(request:Request){
 return withRequest(request,async()=>{
  try{return secureResponse(await dispatch(request),request);}
  catch(error:any){const [status,...message]=String(error.message).split('|');return secureResponse(json({error:message.length?message.join('|'):'The request could not be completed.'},/^\d{3}$/.test(status)?Number(status):500),request);}
 });
}};
