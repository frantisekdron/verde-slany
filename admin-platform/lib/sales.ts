import {env} from 'cloudflare:workers';
import {requirePermission} from './permissions';
import {db,site,state} from './cms';
import {notificationStatement,notificationState} from './notifications';
const stages=['new','contacted','reserved','won','closed'];
export function unitFields(unit:string){if(unit==='general'||['project/verde','project/borovskeho'].includes(unit))return {page:{title:unit==='general'?'General enquiry':unit==='project/verde'?'Verde Slaný II':'Byty Borovského'},status:null,price:null};const page=site.pages.find((p:any)=>p.slug===unit&&p.group==='units');if(!page)throw new Error("400|Select an existing unit.");const fields=Object.values(site.fields) as any[];const prefix='unit:'+unit.split('/')[1]+':';return {page,status:fields.find(f=>f.shared===prefix+'Stav'),price:fields.find(f=>f.shared===prefix+'Cena')};}
function clean(body:any){
 const c={unit:String(body.unit||''),name:String(body.name||'').trim(),email:String(body.email||'').trim().toLowerCase(),phone:String(body.phone||'').trim(),note:String(body.note||'').trim(),expires:String(body.expires||'')};unitFields(c.unit);
 if(!c.name||c.name.length>150||(!c.email&&!c.phone)||c.phone.length>60||(c.phone&&(!/^[+\d ()-]+$/.test(c.phone)||c.phone.replace(/\D/g,'').length<6))||c.note.length>3000||(c.email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email))||c.email.length>254)throw new Error("400|Enter a name and a valid email address or phone number. The note can contain up to 3000 characters.");
 if(c.expires&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.expires)||!Number.isFinite(Date.parse(c.expires))||new Date(c.expires+'T00:00:00Z').toISOString().slice(0,10)!==c.expires))throw new Error('400|Check the expiry date.');return c;
}
export async function salesState(){
 const cases=(await db().prepare('SELECT * FROM sales_cases ORDER BY updated DESC LIMIT 2000').all()).results;
 return {cases,intakeConfigured:true,notifications:await notificationState()};
}
export async function caseHistory(id:string){return (await db().prepare('SELECT * FROM sales_events WHERE case_id=? ORDER BY created DESC LIMIT 80').bind(id).all()).results;}
export async function changeCase(body:any,user:any,external=false){
 if(!external)requirePermission(user,'sales');
 const current:any=body.id?await db().prepare('SELECT * FROM sales_cases WHERE id=?').bind(String(body.id)).first():null;
 if(body.id&&!current)throw new Error("404|Contact not found.");
 if(current&&body.version!==current.version)throw new Error("409|A colleague has changed this record. Refresh the overview.");
 const c=clean(body);if(current&&current.unit!==c.unit)throw new Error("400|You cannot change the unit on an existing record. Create a new enquiry.");
 const stage=external?'new':String(body.stage||'new');if(!stages.includes(stage))throw new Error("400|Invalid enquiry status.");
 if(!current&&stage!=='new'&&stage!=='reserved')throw new Error("400|Create a new record as an enquiry or a reservation.");
 if(current&&['closed','won'].includes(current.stage)&&stage!==current.stage)throw new Error("400|A closed case cannot be changed. Create a new enquiry.");
 if(current?.stage==='reserved'&&!['reserved','closed','won'].includes(stage))throw new Error("400|End the reservation by cancelling it or completing a sale.");
 if(stage==='won'&&current?.stage!=='reserved'&&current?.stage!=='won')throw new Error("400|Confirm the sale from an active reservation.");
 const requestKey=current?current.request_key:body.requestKey?String(body.requestKey):external?'':null;
 if((external||requestKey!==null)&&!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey!))throw new Error("400|Invalid enquiry ID.");
 if(requestKey&&!current){const prior:any=await db().prepare('SELECT id FROM sales_cases WHERE request_key=?').bind(requestKey).first();if(prior)return {id:prior.id,duplicate:true};}
 const s=await state(),f=unitFields(c.unit),actual=f.status?(s.published[f.status.id]??f.status.value):null;
 const entering=stage==='reserved'&&current?.stage!=='reserved',leaving=current?.stage==='reserved'&&stage!=='reserved';
 const active:any=await db().prepare("SELECT id FROM sales_cases WHERE unit=? AND stage='reserved'").bind(c.unit).first();
 if(entering){
  if(!f.status)throw new Error("400|This item's availability is not tracked separately.");
  if(actual==='Prodáno'||active)throw new Error("409|This unit is already reserved or sold.");
  if(actual==='Rezervováno'&&!body.adopt)throw new Error("409|This unit has a carried-over reservation. Add contact details to that reservation.");
  if(actual==='Na prodej'&&body.adopt)throw new Error("409|The unit's status has changed. Refresh the overview.");
 }
 if((entering||leaving)&&body.cmsVersion!==s.version&&!external)throw new Error("409|A colleague has changed the availability. Refresh the overview.");
 if(leaving&&actual!=='Rezervováno')throw new Error("409|The unit's status does not match the records. Refresh the overview.");
 if(leaving&&!c.note)throw new Error("400|Add a brief note explaining why the reservation is ending.");
 if(stage==='reserved'&&c.expires&&c.expires<new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague'}).format(new Date())&&c.expires!==current?.expires)throw new Error("400|The new reservation expiry date cannot be in the past.");
 const id=current?.id||crypto.randomUUID(),eventId=crypto.randomUUID(),now=new Date().toISOString();
 const kind=entering?(body.adopt?'adopt':'reserved'):leaving?(stage==='won'?'sold':'cancelled'):current?'updated':'inquiry';
 const detail=JSON.stringify({from:current?.stage||null,to:stage,expires:c.expires});
 const guard=current?'EXISTS(SELECT 1 FROM sales_cases WHERE id=? AND version=?)':'1=1';const guardArgs=current?[id,current.version]:[];
 const batch:any[]=[db().prepare(`INSERT INTO sales_events(id,case_id,unit,kind,author,detail,created) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cms_state WHERE id=1 AND version=?) AND ${guard}`).bind(eventId,id,c.unit,kind,user.email,detail,now,s.version,...guardArgs)];
 const exists='EXISTS(SELECT 1 FROM sales_events WHERE id=?)';
 if(current)batch.push(db().prepare(`UPDATE sales_cases SET name=?,email=?,phone=?,note=?,stage=?,expires=?,version=version+1,updated=? WHERE id=? AND ${exists}`).bind(c.name,c.email,c.phone,c.note,stage,stage==='reserved'?c.expires:'',now,id,eventId));
 else batch.push(db().prepare(`INSERT INTO sales_cases(id,unit,name,email,phone,note,stage,expires,source,request_key,version,created,updated) SELECT ?,?,?,?,?,?,?,?,?,?,1,?,? WHERE ${exists}`).bind(id,c.unit,c.name,c.email,c.phone,c.note,stage,stage==='reserved'?c.expires:'',external?'web':'manual',requestKey,now,now,eventId));
 const target=entering?'Rezervováno':leaving?(stage==='won'?'Prodáno':'Na prodej'):null;
 if(target&&f.status){const patch={[f.status.id]:target};batch.push(db().prepare(`INSERT INTO revisions(id,action,snapshot,author,created) SELECT ?,'reservation',?,?,? WHERE ${exists}`).bind(eventId,JSON.stringify({draft:s.draft,published:s.published}),user.email,now,eventId));batch.push(db().prepare(`UPDATE cms_state SET draft=?,published=?,version=version+1,updated=? WHERE id=1 AND ${exists}`).bind(JSON.stringify({...s.draft,...patch}),JSON.stringify({...s.published,...patch}),now,eventId));}
 if(kind!=='updated')batch.push(await notificationStatement(eventId,kind==='inquiry'?'inquiry':'availability',c.unit,id,{sql:exists,args:[eventId]}));
 let results;try{results=await db().batch(batch);}catch(e:any){if(String(e).includes('UNIQUE')&&requestKey){const duplicate:any=await db().prepare('SELECT id FROM sales_cases WHERE request_key=?').bind(requestKey).first();if(duplicate)return {id:duplicate.id,duplicate:true};}if(String(e).includes('UNIQUE'))throw new Error("409|The record has already been saved, or a colleague has reserved the unit. Refresh the overview.");throw e;}
 if(results[0].meta.changes!==1)throw new Error("409|A colleague has changed the data. Refresh the overview.");return {id,duplicate:false};
}
