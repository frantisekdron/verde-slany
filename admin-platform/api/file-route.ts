import {validAccessLink} from './access-links';
import {postImages} from '../lib/news-render';
import {fileResponse} from '../lib/file-storage';
import {member,state,site} from '../lib/cms';
import {requirePermission} from '../lib/permissions';
import {listPosts} from '../lib/news';
export async function GET(req:Request,{params}:any){const{id}=await params;if(!/^[a-f0-9-]+\.(jpg|png|webp|pdf|mp4)$/.test(id))return new Response('Nenalezeno',{status:404});const reference='/files/'+id;const s=await state();const publicFile=JSON.stringify(Object.values(site.fields).map((f:any)=>s.published[f.id]??f.value)).includes(reference)||(await listPosts()).some((p:any)=>p.published&&!p.published.archived&&postImages(p.published).includes(reference));if(!publicFile&&!await validAccessLink(req,'file',id)){try{requirePermission(await member(),'content');}catch{return new Response('Přístup odepřen',{status:403,headers:{'Cache-Control':'no-store'}});}}return fileResponse(id,req,publicFile);}
