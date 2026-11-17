import {scrypt,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const randomToken=()=>randomBytes(32).toString('base64url');
export const temporaryPassword=()=>randomBytes(18).toString('base64url');
export function digest(value:string){return createHmac('sha256','verde-session-lookup-v1').update(value).digest('hex');}
export function privateDigest(value:string,pepper:string){return createHmac('sha256',pepper).update(value).digest('hex');}
export async function passwordHash(password:string,pepper:string,salt=randomBytes(16).toString('hex')){
 if(!pepper||pepper.length<32)throw new Error("503|Sign-in has not been configured.");
 const derived=await new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));
 return `scrypt-v1$${salt}$${createHmac('sha256',pepper).update(derived).digest('hex')}`;
}
export async function verifyPassword(password:string,stored:string,pepper:string){
 const parts=stored.split('$');if(parts[0]!=='scrypt-v1'||!/^\w{32}$/.test(parts[1]||'')||!/^\w{64}$/.test(parts[2]||''))return false;
 const actual=await passwordHash(password,pepper,parts[1]);return timingSafeEqual(Buffer.from(actual),Buffer.from(stored));
}
export function validatePassword(password:unknown,email=''){
 if(typeof password!=='string'||password.length<15||password.length>128||password.toLowerCase().includes(email.split('@')[0].toLowerCase())&&email||/^(.)\1+$/.test(password))throw new Error("400|Your password must contain 15–128 characters, must not include your email address and must not consist of a single repeated character. A longer phrase is recommended.");
 return password as string;
}
