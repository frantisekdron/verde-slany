import {env} from 'cloudflare:workers';
import {headers} from '../api/context';
import {randomToken,digest,privateDigest,passwordHash,verifyPassword,validatePassword,temporaryPassword} from './password-crypto';
import {permissions,roleOptions} from './permissions';
const db=()=>env.DB!;
const cfg=()=>env as any;
export const passwordMode=()=>cfg().AUTH_MODE==='password';
const now=()=>new Date().toISOString();
const pepper=()=>String(cfg().AUTH_PEPPER||'');
const validEmail=(email:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)&&email.length<=254;
const failure=()=>new Error("401|Incorrect email or password, or access is inactive.");
export async function ensureBootstrap(){
 const raw=cfg().AUTH_BOOTSTRAP;if(!raw)return;
 if(await db().prepare("SELECT id FROM auth_install WHERE id='accounts-v1'").first())return;
 const entries=JSON.parse(raw);
 const bootstrapRoles=['superadmin','publisher','content_manager','sales_manager','viewer'];
 if(!Array.isArray(entries)||entries.length<1||entries.length>5||entries.some(e=>!validEmail(e.email)||!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(e.hash)||!bootstrapRoles.includes(e.role??'superadmin'))||new Set(entries.map(e=>e.email)).size!==entries.length)throw new Error('503|The sign-in configuration is invalid.');
 const demo=cfg().DEMO_MODE==='true';
 const stamp=now(),until=new Date(Date.now()+7*86400000).toISOString();const guard="NOT EXISTS(SELECT 1 FROM auth_install WHERE id='accounts-v1')";
 const statements=entries.flatMap(e=>[
  db().prepare(`INSERT INTO members(email,role) SELECT ?,? WHERE ${guard} ON CONFLICT(email) DO UPDATE SET role=excluded.role`).bind(e.email,e.role??'superadmin'),
  db().prepare(`INSERT INTO auth_accounts(email,password_hash,must_change,enabled,version,temporary_until,created,updated) SELECT ?,?,?,1,1,?,?,? WHERE ${guard} ON CONFLICT(email) DO NOTHING`).bind(e.email,e.hash,demo?0:1,until,stamp,stamp),
 ]);
 await db().batch([...statements,db().prepare("INSERT OR IGNORE INTO auth_install(id,created) VALUES('accounts-v1',?)").bind(stamp)]);
}
export function sessionCookie(token:string,req:Request,maxAge=12*3600){const secure=new URL(req.url).protocol==='https:';return `${secure?'__Host-verde_session':'verde_session'}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;}
function readToken(h:Headers){return h.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]||'';}

export async function passwordUser(h?:Headers){
 const head=h||await headers();const token=readToken(head);if(!token)return null;
 const t=Date.now(),row:any=await db().prepare('SELECT s.id session_id,s.version session_version,s.last_seen,a.*,m.role FROM auth_sessions s JOIN auth_accounts a ON a.email=s.email JOIN members m ON m.email=a.email WHERE s.id=? AND s.expires>? AND s.last_seen>? AND a.enabled=1 AND a.version=s.version').bind(digest(token),t,t-3600000).first();
 if(!row||(row.must_change||cfg().DEMO_MODE==='true')&&row.temporary_until<tDate(t))return null;
 if(t-row.last_seen>60000)await db().prepare('UPDATE auth_sessions SET last_seen=? WHERE id=?').bind(t,row.session_id).run();
 return {email:row.email,userId:row.email,displayName:row.email,role:row.role,mustChange:!!row.must_change,authVersion:row.version,sessionId:row.session_id};
}
function tDate(t:number){return new Date(t).toISOString();}
export async function throttle(req:Request,email:string){
 const t=Date.now(),windowMs=15*60000,ip=req.headers.get('cf-connecting-ip')||'local';
 const keys=[{key:privateDigest('email:'+email,pepper()),limit:10},{key:privateDigest('ip:'+ip,pepper()),limit:60}];
 for(const item of keys){const result:any=await db().prepare('INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING count').bind(item.key,t+windowMs,t,t,t+windowMs).first();if(result.count>item.limit)throw new Error("429|Too many attempts. Try signing in again in 15 minutes.");}
 await db().prepare('DELETE FROM auth_attempts WHERE expires<?').bind(t-86400000).run();
}
export async function login(req:Request,body:any){
 if(!passwordMode())throw new Error("503|Password sign-in is not enabled yet.");await ensureBootstrap();
 const email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');if(!validEmail(email)||password.length>128||!password)throw failure();await throttle(req,email);
 const account:any=await db().prepare('SELECT a.*,m.role FROM auth_accounts a JOIN members m ON m.email=a.email WHERE a.email=?').bind(email).first();
 const stored=account?.password_hash||'scrypt-v1$00000000000000000000000000000000$'+'0'.repeat(64);
 const ok=await verifyPassword(password,stored,pepper());if(!ok||!account?.enabled||(account.must_change||cfg().DEMO_MODE==='true')&&account.temporary_until<now())throw failure();
 const token=randomToken(),id=digest(token),t=Date.now();
 const result=await db().prepare('INSERT INTO auth_sessions(id,email,version,created,last_seen,expires) SELECT ?,?,version,?,?,? FROM auth_accounts WHERE email=? AND enabled=1 AND version=?').bind(id,email,t,t,t+12*3600000,email,account.version).run();if(result.meta.changes!==1)throw failure();
 await db().batch([db().prepare('DELETE FROM auth_sessions WHERE expires<?').bind(t),db().prepare('DELETE FROM auth_attempts WHERE key=?').bind(privateDigest('email:'+email,pepper()))]);
 return {token,mustChange:!!account.must_change};
}
export async function logout(req:Request){const token=readToken(req.headers);if(token)await db().prepare('DELETE FROM auth_sessions WHERE id=?').bind(digest(token)).run();}
export async function reauthenticate(user:any,password:unknown){
 const row:any=await db().prepare('SELECT * FROM auth_accounts WHERE email=? AND enabled=1').bind(user.email).first();
 if(typeof password!=='string'||password.length>128||!row||!await verifyPassword(password,row.password_hash,pepper()))throw new Error("403|Confirm this action with your current password.");return row;
}
export async function changePassword(req:Request,body:any){
 const user=await passwordUser(req.headers);if(!user)throw failure();await throttle(req,user.email);const old=await reauthenticate(user,body.currentPassword),password=validatePassword(body.password,user.email);
 if(password===body.currentPassword)throw new Error("400|Choose a password different from your current one.");
 const hash=await passwordHash(password,pepper()),token=randomToken(),t=Date.now(),version=old.version+1;
 const res=await db().batch([
  db().prepare('UPDATE auth_accounts SET password_hash=?,must_change=0,temporary_until=?,version=version+1,updated=? WHERE email=? AND version=? AND enabled=1').bind(hash,cfg().DEMO_MODE==='true'?old.temporary_until:'',now(),user.email,old.version),
  db().prepare('DELETE FROM auth_sessions WHERE email=? AND version=?').bind(user.email,old.version),
  db().prepare('INSERT INTO auth_sessions(id,email,version,created,last_seen,expires) SELECT ?,email,version,?,?,? FROM auth_accounts WHERE email=? AND version=? AND password_hash=?').bind(digest(token),t,t,t+12*3600000,user.email,version,hash),
  audit(user.email,user.email,'password_changed'),
 ]);if(res[0].meta.changes!==1||res[2].meta.changes!==1)throw new Error("409|An administrator has changed this account. Sign in again.");return {token};
}
function audit(actor:string,target:string,action:string){return db().prepare('INSERT INTO auth_audit(id,actor,target,action,created) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actor,target,action,now());}
export async function listAccounts(){return (await db().prepare('SELECT m.email,m.role,a.enabled,a.must_change,a.temporary_until,a.updated,a.version FROM members m LEFT JOIN auth_accounts a ON m.email=a.email ORDER BY m.email').all()).results;}
export async function manageAccount(req:Request,body:any,user:any){
 if(!passwordMode())throw new Error("409|Password account management is not available in this mode.");
 if(!permissions(user.role).admin)throw new Error("403|Users are managed by the super admin.");await throttle(req,user.email);const actor=await reauthenticate(user,body.currentPassword);
 const email=String(body.email||'').trim().toLowerCase(),action=String(body.action||''),role=String(body.role||'viewer');if(!validEmail(email)||!['create','role','disable','enable','reset'].includes(action))throw new Error('400|Check the email address and action.');
 if(email===user.email&&['role','disable','reset'].includes(action))throw new Error("400|Do not change your own permissions or access here. Change your password in My account.");
 if(['create','role'].includes(action)&&!roleOptions.some(r=>r.id===role))throw new Error('400|Choose a valid role.');
 const old:any=await db().prepare('SELECT a.*,m.role FROM auth_accounts a JOIN members m ON m.email=a.email WHERE a.email=?').bind(email).first();
 if(action==='create'&&old)throw new Error("409|This account already exists. Change its role or reset its password.");if(action!=='create'&&!old)throw new Error("404|This account has no separate sign-in. Add it as a new account.");
 if(old&&body.version!==old.version)throw new Error("409|A colleague has changed this account. Refresh the overview.");
 // Check the acting account again inside the transaction: two admins cannot disable each other concurrently.
 const pass=['create','reset'].includes(action)?temporaryPassword():null,hash=pass?await passwordHash(pass,pepper()):null,until=new Date(Date.now()+7*86400000).toISOString();
 const marker=crypto.randomUUID(),guard='EXISTS(SELECT 1 FROM auth_audit WHERE id=?)';
 const actorGuard="EXISTS(SELECT 1 FROM auth_accounts a JOIN members m ON m.email=a.email WHERE a.email=? AND a.enabled=1 AND a.must_change=0 AND a.version=? AND m.role IN ('superadmin','owner'))";
 const targetGuard=action==='create'?'NOT EXISTS(SELECT 1 FROM auth_accounts WHERE email=?)':'EXISTS(SELECT 1 FROM auth_accounts WHERE email=? AND version=?)';
 const statements:any[]=[db().prepare(`INSERT INTO auth_audit(id,actor,target,action,created) SELECT ?,?,?,?,? WHERE ${actorGuard} AND ${targetGuard}`).bind(marker,user.email,email,action+(['create','role'].includes(action)?':'+role:''),now(),user.email,actor.version,email,...(old?[old.version]:[]))];
 if(action==='create'){
  statements.push(db().prepare(`INSERT INTO members(email,role) SELECT ?,? WHERE ${guard} ON CONFLICT(email) DO UPDATE SET role=excluded.role`).bind(email,role,marker));
  statements.push(db().prepare(`INSERT INTO auth_accounts(email,password_hash,must_change,enabled,version,temporary_until,created,updated) SELECT ?,?,1,1,1,?,?,? WHERE ${guard}`).bind(email,hash,until,now(),now(),marker));
 }else{
  if(action==='reset')statements.push(db().prepare(`UPDATE auth_accounts SET password_hash=?,must_change=1,temporary_until=?,version=version+1,updated=? WHERE email=? AND ${guard}`).bind(hash,until,now(),email,marker));
  else statements.push(db().prepare(`UPDATE auth_accounts SET enabled=?,version=version+1,updated=? WHERE email=? AND ${guard}`).bind(action==='enable'?1:action==='disable'?0:old.enabled,now(),email,marker));
  if(action==='role')statements.push(db().prepare(`UPDATE members SET role=? WHERE email=? AND ${guard}`).bind(role,email,marker));
  statements.push(db().prepare(`DELETE FROM auth_sessions WHERE email=? AND ${guard}`).bind(email,marker));
 }
 const result=await db().batch(statements);if(result[0].meta.changes!==1)throw new Error("409|A colleague has changed the account or its permissions. Refresh the overview.");
 return {ok:true,email,...(pass?{temporaryPassword:pass,expires:until}:{})};
}
