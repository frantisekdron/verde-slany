import {t,adminLocale,adminLanguage,setAdminLanguage} from './i18n';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Admin from './app/ui';
import {Login,PasswordPanel} from './app/auth-ui';
import {initialize,apiFetch,openPreview,demoMode} from './client-api';
import './app/globals.css';
function LanguageSwitch(){return <div className="admin-language" role="group" aria-label={t('Administration language')}><button type="button" lang="cs" aria-label="Čeština" aria-pressed={adminLanguage()==='cs'} onClick={()=>setAdminLanguage('cs')}>CZ</button><button type="button" lang="en" aria-label="English" aria-pressed={adminLanguage()==='en'} onClick={()=>setAdminLanguage('en')}>EN</button></div>;}
function Application(){
 const [language,selectLanguage]=useState(adminLanguage);
 useEffect(()=>{const changed=()=>selectLanguage(adminLanguage());window.addEventListener('verde-admin-language',changed);return()=>window.removeEventListener('verde-admin-language',changed);},[]);
 const [ready,setReady]=useState(false),[user,setUser]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{try{const response=await apiFetch('/api/auth/session');if(!response.ok)throw new Error(t('Sign-in is temporarily unavailable.'));const data:any=await response.json();if(active){setUser(data.user);setReady(true);}}catch(e){if(active)setError((e as Error).message);}};
  initialize().then(refresh).catch(e=>setError(e.message));
  const onSession=()=>void refresh();window.addEventListener('verde-session-changed',onSession);
  const preview=(event:MouseEvent)=>{const a=(event.target as Element).closest('a');if(a?.getAttribute('href')?.startsWith('/verde-slany/')&&a.search.includes('draft=1')){event.preventDefault();void openPreview(a.pathname);}};
  const demoLink=(event:Event)=>{const a=(event.target as Element).closest('a');if(!demoMode()||!a?.getAttribute('href')?.startsWith('/verde-slany/')||a.search.includes('draft=1'))return;const url=new URL(a.href,location.href);url.searchParams.set('demo','1');a.href=url.href;};
  for(const type of ['pointerdown','contextmenu','click'])document.addEventListener(type,demoLink,true);
  document.addEventListener('click',preview);
  return()=>{active=false;window.removeEventListener('verde-session-changed',onSession);document.removeEventListener('click',preview);for(const type of ['pointerdown','contextmenu','click'])document.removeEventListener(type,demoLink,true);};
 },[]);
 let screen;
 if(error)screen=<main className="auth-page"><section className="auth-card"><h1>{t("Verde Slaný administration")}</h1><p role="alert">{t(error)}</p><button className="primary" onClick={()=>location.reload()}>{t("Try again")}</button><p><a href="/verde-slany/">{t("Open website")}</a></p></section></main>;
 else if(!ready)screen=<main className="auth-page" aria-live="polite">{t("Loading secure administration…")}</main>;
 else if(!user)screen=<Login demo={demoMode()}/>;
 else if(user.mustChange)screen=<PasswordPanel email={user.email} required/>;
 else screen=<Admin key={user.email} demo={demoMode()}/>;
 return <><LanguageSwitch/>{screen}</>;
}
createRoot(document.getElementById('root')!).render(<Application/>);
