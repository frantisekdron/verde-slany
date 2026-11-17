import {env} from 'cloudflare:workers';
import {db,site} from './cms';
const runtime=()=>env as any;
const emailOK=(s:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)&&s.length<=254;
const adminURL='https://frantisekdron.github.io/verde-slany/admin/';
export async function notificationState(){
 const row:any=await db().prepare('SELECT * FROM notification_settings WHERE id=1').first();
 const recent=(await db().prepare('SELECT id,kind,entity,status,created,attempted,provider_id,error FROM mail_outbox ORDER BY created DESC LIMIT 15').all()).results;
 const configured=runtime().DEMO_MODE!=='true'&&!!runtime().RESEND_API_KEY&&emailOK(runtime().NOTIFICATION_FROM||'');
 return {recipients:row?JSON.parse(row.recipients):[],enabled:!!row?.enabled,version:row?.version||0,configured,live:configured&&runtime().NOTIFICATIONS_ENABLED==='true'&&!!row?.enabled,recent};
}
export async function saveNotificationSettings(body:any,user:any){
 if(!['owner','superadmin'].includes(user.role))throw new Error("403|Only the owner can change notification settings.");
 const recipients=[...new Set(String(body.recipients||'').split(/[,;\n]/).map(x=>x.trim().toLowerCase()).filter(Boolean))];
 if(recipients.length>5||recipients.some(x=>!emailOK(x)))throw new Error("400|Enter up to 5 valid email addresses.");
 const current=await notificationState();if(body.enabled&&(!current.configured||runtime().NOTIFICATIONS_ENABLED!=='true'||!recipients.length))throw new Error("400|Connect email delivery and confirm the recipients first.");
 if(body.version!==current.version)throw new Error("409|The settings have changed. Refresh the overview.");
 const result=current.version?await db().prepare('UPDATE notification_settings SET recipients=?,enabled=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(recipients),body.enabled?1:0,body.version).run():await db().prepare('INSERT OR IGNORE INTO notification_settings(id,recipients,enabled,version) VALUES(1,?,?,1)').bind(JSON.stringify(recipients),body.enabled?1:0).run();
 if(result.meta.changes!==1)throw new Error("409|The settings have changed. Refresh the overview.");return notificationState();
}
export async function notificationStatement(id:string,kind:string,unit:string,entity:string,guard?:{sql:string,args:any[]}){
 const cfg=await notificationState();const title=site.pages.find((p:any)=>p.slug===unit)?.title||'Verde Slaný';
 const label=kind==='inquiry'?'Nová poptávka':kind==='reminder'?'Zkontrolujte platnost rezervace':'Změna dostupnosti jednotky';
 // No visitor contact details in email. They are visible only after authorised sign-in.
 const payload={from:runtime().NOTIFICATION_FROM||'',to:cfg.recipients,subject:`${label} · ${title}`,text:`${label}\n${title}\n\nPodrobnosti najdete v soukromé administraci:\n${adminURL}#units\n\nPoptávka sama jednotku nerezervuje. Rozhodnutí o rezervaci potvrzuje prodejce.`};
 return db().prepare(`INSERT OR IGNORE INTO mail_outbox(id,kind,entity,payload,status,attempts,created,attempted,lease_until,provider_id,error) SELECT ?,?,?,?,?,0,?,'','','','' ${guard?'WHERE '+guard.sql:''}`).bind(id,kind,entity,JSON.stringify(payload),cfg.live?'pending':'held',new Date().toISOString(),...(guard?.args||[]));
}
export async function deliverNotifications(fetcher:typeof fetch=fetch){
 const cfg=await notificationState();if(!cfg.live)return {sent:0,paused:true};
 const now=new Date().toISOString();
 const rows:any[]=(await db().prepare("SELECT * FROM mail_outbox WHERE (status='pending' OR (status='sending' AND lease_until<?)) AND attempts<5 ORDER BY created LIMIT 10").bind(now).all()).results;
 let sent=0;
 for(const row of rows){
  // Resend retains idempotency keys for 24h. Never blindly retry an ambiguous older attempt.
  if(row.attempted&&Date.now()-Date.parse(row.attempted)>23*3600000){await db().prepare("UPDATE mail_outbox SET status='review',error='Doručení je nutné ověřit u poskytovatele; znovu neposíláme naslepo.' WHERE id=?").bind(row.id).run();continue;}
  const lease=new Date(Date.now()+300000).toISOString();
  const claim=await db().prepare("UPDATE mail_outbox SET status='sending',attempts=attempts+1,lease_until=?,attempted=CASE WHEN attempted='' THEN ? ELSE attempted END WHERE id=? AND (status='pending' OR (status='sending' AND lease_until<?))").bind(lease,now,row.id,now).run();if(claim.meta.changes!==1)continue;
  try{
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+runtime().RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'verde/'+row.id},body:row.payload,signal:AbortSignal.timeout(12000)});
   if(!response.ok){const retry=response.status===429||response.status>=500;await db().prepare('UPDATE mail_outbox SET status=?,error=?,lease_until=? WHERE id=?').bind(retry?'sending':'failed','Odesílací služba vrátila HTTP '+response.status,lease,row.id).run();continue;}
   const result:any=await response.json();if(!result.id)throw new Error('Missing provider ID');
   await db().prepare("UPDATE mail_outbox SET status='accepted',provider_id=?,error='',lease_until='' WHERE id=?").bind(result.id,row.id).run();sent++;
  }catch{await db().prepare("UPDATE mail_outbox SET status='sending',error='Odpověď služby není potvrzená. Čeká na bezpečné opakování.' WHERE id=?").bind(row.id).run();}
 }
 await db().prepare("UPDATE mail_outbox SET status='review',error='Opakované odeslání nebylo potvrzené. Ověřte u poskytovatele.' WHERE status='sending' AND attempts>=5 AND lease_until<?").bind(now).run();return {sent,paused:false};
}
export async function deadlineReminders(){
 const until=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const due:any[]=(await db().prepare("SELECT id,unit,expires FROM sales_cases WHERE stage='reserved' AND expires!='' AND expires<=?").bind(until).all()).results;
 for(const c of due)await(await notificationStatement('reminder:'+c.id+':'+c.expires,'reminder',c.unit,c.id)).run();
 return {due:due.length};
}
