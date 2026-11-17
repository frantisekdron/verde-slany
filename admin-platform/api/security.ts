import {env} from 'cloudflare:workers';
export function allowedOrigins(){return String((env as any).ADMIN_ORIGINS||'https://frantisekdron.github.io').split(',').map(s=>s.trim()).filter(Boolean);}
export function allowedOrigin(request:Request){const origin=request.headers.get('origin');return !!origin&&(allowedOrigins().includes(origin)||origin===new URL(request.url).origin);}
export function secureResponse(response:Response,request:Request){
 const result=new Response(response.body,response);
 result.headers.set('X-Content-Type-Options','nosniff');
 result.headers.set('Referrer-Policy','no-referrer');
 result.headers.set('X-Robots-Tag','noindex, nofollow');
 result.headers.set('Vary','Origin');
 if(allowedOrigin(request)){
  result.headers.set('Access-Control-Allow-Origin',request.headers.get('origin')!);
  result.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  result.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  result.headers.set('Access-Control-Max-Age','600');
 }
 if(!result.headers.has('Cache-Control'))result.headers.set('Cache-Control','private, no-store');
 return result;
}
