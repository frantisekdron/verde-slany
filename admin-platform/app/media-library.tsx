import {apiFetch as fetch} from '../client-api';
'use client';
import {useEffect,useMemo,useState} from 'react';
import {FileText,Upload,RotateCcw,Trash2,FolderPlus,Search} from 'lucide-react';
import {documentURL} from './operations';

type Asset={id?:string;url:string;name:string;mime:string;folder:string;source:string;preview?:string|null;removed_at?:string;usage?:string[];size?:number};
type Library={uploads:Asset[];site:Asset[];folders:string[]};
const messageFor=(error:unknown)=>error instanceof Error?error.message:'The operation could not be completed.';

export function MediaLibrary({upload,onChange}:{upload:(file:File)=>Promise<string|null>;onChange:()=>Promise<void>}){
 const [data,setData]=useState<Library|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(''),[folder,setFolder]=useState(''),[kind,setKind]=useState('all'),[showArchived,setShowArchived]=useState(false),[newFolder,setNewFolder]=useState('');
 async function refresh(){
  const response=await fetch('/api/media-library',{cache:'no-store'}),result=await response.json() as Library&{error?:string};
  if(!response.ok)throw new Error(result.error||'The media library could not be loaded.');
  setData(result);
 }
 useEffect(()=>{const timer=setTimeout(()=>{refresh().catch(e=>setError(messageFor(e)));},0);return()=>clearTimeout(timer);},[]);
 async function update(item:Asset|null,action:string,value?:string){
  if(busy||(!item&&action!=='create-folder'))return false;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/media-library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:item?.id,url:item?.source==='web'?item.url:undefined,folder:value})}),result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||'The change could not be saved.');
   await refresh();await onChange();
   setMessage(action==='remove'?'File archived. Its stored content and existing links remain available.':action==='restore'?'File restored to the library.':action==='create-folder'?'Folder created. You can now add files to it.':'Folder updated.');
   return true;
  }catch(e:unknown){setError(messageFor(e));return false;}finally{setBusy(false);}
 }
 async function addFile(file:File){
  setBusy(true);setError('');setMessage('');
  try{const url=await upload(file);if(!url)throw new Error('The upload could not be completed.');await refresh();setMessage('File added to the library.');}
  catch(e:unknown){setError(messageFor(e));}finally{setBusy(false);}
 }
 const folders=useMemo(()=>[...new Set([...(data?.uploads||[]).map(x=>x.folder),...(data?.site||[]).map(x=>x.folder),...(data?.folders||[])])].sort((a,b)=>a.localeCompare(b,'en')),[data]);
 const assets=useMemo(()=>[...(data?.uploads||[]),...(data?.site||[])].filter(x=>(showArchived?!!x.removed_at:!x.removed_at)&&(!folder||x.folder===folder)&&(kind==='all'||(kind==='image'?x.mime.startsWith('image/'):kind==='video'?x.mime.startsWith('video/'):x.mime==='application/pdf'))&&(!query||(x.name+' '+x.url).toLocaleLowerCase().includes(query.toLocaleLowerCase()))),[data,folder,kind,query,showArchived]);
 return <section className="library-page">
  <div className="library-intro"><p>Organize uploaded files and existing website assets into folders. Files used by the website, news or version history are protected from archiving.</p><label className="upload"><Upload size={18}/><span>{busy?'Working…':'Upload JPG, PNG, WebP, PDF or MP4 · up to 25 MB'}</span><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(file)void addFile(file);}}/></label></div>
  {(error||message)&&<div role="status" className={'notice '+(error?'error':'success')}>{error||message}</div>}
  <div className="library-toolbar"><label className="search"><Search size={17}/><input aria-label="Search files" placeholder="Find a file…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Folder" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">All folders</option>{folders.map(x=><option key={x}>{x}</option>)}</select><select aria-label="File type" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All file types</option><option value="image">Photos</option><option value="document">PDF</option><option value="video">Videos</option></select><label className="library-check"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Archived files</label></div>
  <div className="library-folder"><FolderPlus size={18}/><input aria-label="New folder name" placeholder="New folder name" maxLength={80} value={newFolder} disabled={busy} onChange={e=>setNewFolder(e.target.value)}/><button className="secondary" disabled={busy||!newFolder.trim()} onClick={async()=>{if(await update(null,'create-folder',newFolder))setNewFolder('');}}>Create folder</button></div>
  {!data&&!error?<p role="status">Loading media library…</p>:<><p className="library-count">{assets.length} {assets.length===1?'file':'files'}{folder?' · '+folder:''}</p><div className="library-grid">{assets.map(x=><article className="library-card" key={x.url}>
   <a className="library-preview" href={documentURL(x.url)} target="_blank" rel="noreferrer" title={'Open '+x.name}>{x.mime.startsWith('image/')||x.preview?<img src={documentURL(x.preview||x.url)} alt="" loading="lazy"/>:x.mime.startsWith('video/')?<video src={documentURL(x.url)} muted preload="metadata"/>:<FileText size={38}/>}</a>
   <div className="library-card-body"><span className="library-source">{x.source==='upload'?'Uploaded file':'Website asset'} · {x.mime==='application/pdf'?'PDF':x.mime.startsWith('video/')?'Video':'Photo'}</span><strong title={x.name}>{x.name}</strong><small>{x.source==='upload'?(x.usage?.length?x.usage.join(' · '):'Not currently used'):'Original asset included with the website.'}</small><select aria-label={'Folder for '+x.name} value={x.folder} disabled={busy||!!x.removed_at} onChange={e=>void update(x,'folder',e.target.value)}>{[...new Set([...folders,x.folder])].filter(Boolean).map(f=><option key={f}>{f}</option>)}</select>{x.source==='upload'&&(x.removed_at?<button className="text-button" disabled={busy} onClick={()=>void update(x,'restore')}><RotateCcw size={14}/> Restore file</button>:<button className="text-button" disabled={busy||!!x.usage?.length} title={x.usage?.length?'Files that are in use cannot be archived':''} onClick={()=>void update(x,'remove')}><Trash2 size={14}/> Archive file</button>)}</div>
  </article>)}</div>{!assets.length&&<div className="panel">No files match these filters.</div>}</>}
 </section>;
}
