import {env} from 'cloudflare:workers';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {db} from '../lib/cms';
const hmac=(input:string)=>createHmac('sha256',String((env as any).AUTH_PEPPER||'')).update('verde-access-link-v1:'+input).digest('hex');
export function accessLink(base:string,kind:'file'|'preview',target:string,sessionId:string){
 const expires=Date.now()+5*60*1000;
 const path=kind==='file'?'/files/'+target:'/preview';
 const url=new URL(path,base);
 url.search=new URLSearchParams({target,expires:String(expires),session:sessionId,signature:hmac([kind,target,expires,sessionId].join('\n'))}).toString();
 return url.href;
}
export async function validAccessLink(request:Request,kind:'file'|'preview',target:string){
 const q=new URL(request.url).searchParams,expires=Number(q.get('expires')),session=q.get('session')||'',signature=q.get('signature')||'';
 if(q.get('target')!==target||!Number.isFinite(expires)||expires<Date.now()||expires>Date.now()+5*60*1000||!/^\w{64}$/.test(session)||!/^\w{64}$/.test(signature))return false;
 const expected=hmac([kind,target,expires,session].join('\n'));
 if(!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))return false;
 const row=await db().prepare('SELECT s.id FROM auth_sessions s JOIN auth_accounts a ON a.email=s.email JOIN members m ON m.email=a.email WHERE s.id=? AND s.expires>? AND s.last_seen>? AND a.enabled=1 AND a.version=s.version AND a.must_change=0 AND m.role IN (\'superadmin\',\'owner\',\'publisher\',\'content_manager\',\'editor\')').bind(session,Date.now(),Date.now()-3600000).first();
 return !!row;
}
