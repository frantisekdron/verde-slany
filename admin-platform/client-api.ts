import {t,adminLocale,adminLanguage} from './i18n';
// Session credentials stay in memory and are never written to browser storage.
type Config={apiBase:string;publicBase:string;demo:boolean};
let config:Config={apiBase:'',publicBase:'/verde-slany/',demo:false};
let token='';
const views=new Map<string,string>();
const publications=typeof BroadcastChannel==='function'?new BroadcastChannel('verde-publication'):null;
export async function initialize(){
 const response=await globalThis.fetch(new URL('./config.json',document.baseURI),{cache:'no-store'});
 if(!response.ok)throw new Error(t('The administration configuration could not be loaded.'));
 const value:any=await response.json();
 const demo=new URLSearchParams(location.search).get('demo')==='1';
 const server=demo?value.demoApiBase:value.apiBase;
 if(!server)throw new Error(t('The administration server is not configured.'));
 const url=new URL(server);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw new Error(t('Invalid administration server.'));
 config={apiBase:url.origin,publicBase:value.publicBase||'/verde-slany/',demo};
}
export const demoMode=()=>config.demo;
export function apiURL(path:string){return config.apiBase+path;}
export function fileURL(path:string){return path.startsWith('/files/')?(views.get(path)||apiURL(path)):path;}
export async function apiFetch(input:RequestInfo|URL,options:RequestInit={}){
 const path=String(input);
 if(!path.startsWith('/api/')&&!path.startsWith('/files/'))return globalThis.fetch(input,options);
 const head=new Headers(options.headers);
 if(token)head.set('Authorization','Bearer '+token);
 const response=await globalThis.fetch(apiURL(path),{...options,headers:head,credentials:'omit',cache:'no-store'});
 if(response.headers.get('Content-Type')?.includes('application/json')){
  const data:any=await response.clone().json();
  if(response.ok&&typeof data.token==='string'&&/^[-\w]{43}$/.test(data.token))token=data.token;
  for(const [key,value] of Object.entries(data.fileUrls||{}))if(typeof value==='string')views.set(key,value);
  if(response.ok&&options.method==='POST'){
   let action='';try{action=JSON.parse(String(options.body||'{}')).action||'';}catch{}
   if(['/api/apply','/api/publish','/api/sales'].includes(path)||path==='/api/news'&&['publish','archive'].includes(action))publications?.postMessage({type:'published',demo:config.demo});
  }
 }
 if(path==='/api/auth/logout'||response.status===401&&path!=='/api/auth/login'){
  token='';views.clear();
  window.dispatchEvent(new Event('verde-session-changed'));
 }
 return response;
}
export async function downloadBackup(){
 const response=await apiFetch('/api/export');if(!response.ok)throw new Error(t('The backup could not be downloaded.'));
 const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
 link.href=url;link.download='verde-private-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function openPreview(path:string){
 const slug=path.replace(/^\/verde-slany\//,'').replace(/\?.*$/,'').replace(/\/$/,'').replace(/^(?:cs|en)(?:\/|$)/,'');
 const target=adminLanguage()==='cs'?'cs'+(slug?'/'+slug:''):slug;
 const popup=window.open('about:blank','_blank');
 try{
  const response=await apiFetch('/api/preview-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target})});
  const data:any=await response.json();if(!response.ok)throw new Error(data.error||t('Preview is unavailable.'));
  if(popup){popup.opener=null;popup.location.href=data.url;}else location.assign(data.url);
 }catch(error){popup?.close();window.alert(t((error as Error).message));}
}
