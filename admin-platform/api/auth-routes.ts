import {allowedOrigin} from './security';
import {login,logout,changePassword,passwordUser,passwordMode,sessionCookie} from '../lib/password-auth';
import {permissions} from '../lib/permissions';
export const dynamic='force-dynamic';
const json=(value:any,status=200,cookie?:string)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function GET(req:Request,{params}:any){const{action}=await params;if(action!=='session')return json({error:'Not found.'},404);if(!passwordMode())return json({passwordMode:false,user:null});const user=await passwordUser(req.headers);return json({passwordMode:passwordMode(),user:user?{email:user.email,role:user.role,mustChange:user.mustChange,permissions:permissions(user.role)}:null});}
export async function POST(req:Request,{params}:any){try{
 if(!allowedOrigin(req))return json({error:"Invalid request origin."},403);
 if(!passwordMode())return json({error:"Password sign-in is not available in this mode."},409);
 const{action}=await params;if(action==='logout'){await logout(req);return json({ok:true},200);}
 const reader=req.body?.getReader();let length=0;const chunks:Uint8Array[]=[];if(reader)while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>16000){await reader.cancel();return json({error:"The request is too large."},413);}chunks.push(part.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const body=JSON.parse(new TextDecoder().decode(bytes));
 if(action==='login'){const result=await login(req,body);return json({ok:true,mustChange:result.mustChange,token:result.token},200);}
 if(action==='password'){const result=await changePassword(req,body);return json({ok:true,token:result.token},200);}
 return json({error:'Not found.'},404);
 }catch(e:any){const[status,...message]=String(e.message).split('|');return json({error:message.length?message.join('|'):'Sign-in could not be completed. Please try again.'},/^\d{3}$/.test(status)?Number(status):500);}}
