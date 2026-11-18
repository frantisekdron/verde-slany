import copy from './locales/cs.json' with {type:'json'};
export type AdminLanguage='cs'|'en';
const dictionary=copy as Record<string,string>;
const english=new Map(Object.entries(dictionary).map(([key,value])=>[value,key]));
let language:AdminLanguage=typeof location!=='undefined'&&new URLSearchParams(location.search).get('lang')==='en'?'en':'cs';
export const adminLanguage=()=>language;
export const adminLocale=()=>language==='cs'?'cs-CZ':'en-GB';
// Only interface copy is translated. Form values, identifiers, customer records
// and authored Czech/English articles remain in their original language.
export function t(value:unknown,...values:unknown[]):string{
 const raw=String(value??'');
 const usedIn=raw.match(/^This file is used in: (.+)\. Remove those references first\.$/);
 if(usedIn&&usedIn[1]!=='{0}')return t('This file is used in: {0}. Remove those references first.',usedIn[1]);
 const source=Object.hasOwn(dictionary,raw)?raw:english.get(raw)||raw;
 const translated=language==='cs'?(dictionary[source]??source):source;
 return translated.replace(/\{(\d+)\}/g,(token,index)=>Number(index)<values.length?String(values[Number(index)]??''):token);
}
function syncDocument(){if(typeof document==='undefined')return;document.documentElement.lang=language;document.title=language==='cs'?'Verde Slaný · Administrace':'Verde Slaný · Administration';}
export function setAdminLanguage(next:AdminLanguage){
 if(next===language)return;
 language=next;syncDocument();
 if(typeof location!=='undefined'){const url=new URL(location.href);if(next==='en')url.searchParams.set('lang','en');else url.searchParams.delete('lang');history.replaceState({},'',url);window.dispatchEvent(new Event('verde-admin-language'));}
}
syncDocument();
