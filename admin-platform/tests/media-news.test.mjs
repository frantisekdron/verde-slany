import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {injectPosts,postImages} from '../lib/news-render.ts';

async function moduleWith(path,names,dependencies){
 const source=stripTypeScriptTypes(await readFile(new URL(path,import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/^export \{.*\} from .*;\s*$/gm,'').replace(/\bexport /g,'');
 return new Function(...Object.keys(dependencies),source+';return {'+names.join(',')+'};')(...Object.values(dependencies));
}
const requirePermission=(user,permission)=>{if(!user[permission])throw new Error('403|Denied');};
const writer={content:true,publishContent:true};
function database(){
 const sql=new DatabaseSync(':memory:');
 const prepare=query=>{
  const statement=sql.prepare(query);
  function bound(args=[]){return {bind:(...next)=>bound(next),async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return {meta:statement.run(...args)};}};}
  return bound();
 };
 return {sql,prepare,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
async function fixture(){
 const db=database();
 for(const name of ['0000_happy_darkstar','0001_famous_vulcan','0002_flippant_black_knight','0003_little_christian_walker','0004_verde_media_library'])db.sql.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 const cms=await readFile(new URL('../lib/cms.ts',import.meta.url),'utf8');
 const urlCode=stripTypeScriptTypes(cms.slice(cms.indexOf('export function validURL'),cms.indexOf('export function validate'))).replace('export ','');
 const validURL=new Function(urlCode+';return validURL;')();
 const news=await moduleWith('../lib/news.ts',['savePost','listPosts'],{db:()=>db,validURL,requirePermission});
 return {db,news};
}
const article={title:'Project update',body:'First paragraph\n\nSecond paragraph',date:'2026-11-17'};

test('news keeps old single images, preserves gallery order, rejects duplicate or unsafe photos',async()=>{
 const {db,news}=await fixture();
 try{
  const result=await news.savePost({...article,image:'/old.jpg',action:'save'},writer);
  let row=(await news.listPosts())[0];assert.deepEqual(row.draft.images,['/old.jpg']);assert.equal(row.published,null);
  await news.savePost({...row.draft,id:result.id,version:row.version,images:['/second.jpg','/first.jpg'],action:'publish'},writer);
  row=(await news.listPosts())[0];assert.deepEqual(row.published.images,['/second.jpg','/first.jpg']);assert.equal(row.published.image,'/second.jpg');
  for(const images of [['/same.jpg','/same.jpg'],['javascript:alert(1)'],Array.from({length:13},(_,i)=>'/photo-'+i+'.jpg'),['/bad image.jpg']])await assert.rejects(()=>news.savePost({...article,images,action:'save'},writer),/400/);
  await assert.rejects(()=>news.savePost({...article,date:'2026-02-31',action:'save'},writer),/400/);
  await assert.rejects(()=>news.savePost({...article,action:'publish'},{content:true}),/403/);
 }finally{db.sql.close();}
});

test('two simultaneous article edits preserve one winner; drafts and archived news stay private',async()=>{
 const {db,news}=await fixture();
 try{
  const {id}=await news.savePost({...article,images:['/one.jpg','/two.jpg'],action:'publish'},writer);
  const attempts=await Promise.allSettled(['Draft A','Draft B'].map(title=>news.savePost({...article,id,version:1,title,images:['/one.jpg','/two.jpg'],action:'save'},writer)));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.match(attempts.find(x=>x.status==='rejected').reason.message,/409/);
  let posts=await news.listPosts();const html='<main><!--VERDE_NEWS--><p>Existing content</p></main>';
  assert(!injectPosts(html,posts).includes('Draft A'));assert(!injectPosts(html,posts).includes('Draft B'));assert.match(injectPosts(html,posts,true),/Draft [AB]/);
  const row=posts[0];await news.savePost({...row.draft,id,version:row.version,action:'archive'},writer);posts=await news.listPosts();assert.equal(injectPosts(html,posts),html);
 }finally{db.sql.close();}
});

test('gallery renderer escapes text and preserves Verde insertion point and old articles',()=>{
 const post={...article,title:'<script>title</script>',body:'<script>alert(1)</script>',images:['/first.jpg','/second.jpg']};
 const html=injectPosts('<main><h1>Verde</h1><!--VERDE_NEWS--><p>Archive</p></main>',[{draft:null,published:post}]);
 assert.equal((html.match(/<img /g)||[]).length,2);assert(html.indexOf('/first.jpg')<html.indexOf('/second.jpg'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('<p>Archive</p>'));assert(!html.includes('<!--VERDE_NEWS-->'));
 assert.deepEqual(postImages({...article,image:'/legacy.jpg'}),['/legacy.jpg']);assert.deepEqual(postImages({...article,image:'/legacy.jpg',images:[]}),[]);
});

test('library migration preserves uploads; archive protects drafts, all news photos and history',async()=>{
 const {db,news}=await fixture();
 const ids=['aaaa.jpg','bbbb.jpg','cccc.jpg','dddd.jpg'];
 for(const id of ids)db.sql.prepare('INSERT INTO media(id,name,mime,size,created) VALUES(?,?,?,?,?)').run(id,id,'image/jpeg',20,'2026-11-17');
 const draft={'image':'/files/aaaa.jpg'},published={};
 await news.savePost({...article,images:['/cover.jpg','/files/bbbb.jpg'],action:'save'},writer);
 db.sql.prepare('INSERT INTO revisions(id,action,snapshot,author,created) VALUES(?,?,?,?,?)').run('history','save',JSON.stringify({draft:{image:'/files/cccc.jpg'}}),'test@example.test','2026-11-17');
 const site={fields:{cover:{id:'cover',kind:'image',value:'/static-cover.jpg',label:'Cover'}},pages:[]};
 const library=await moduleWith('../lib/media-library.ts',['listMediaLibrary','updateMediaLibrary'],{db:()=>db,site,state:async()=>({draft,published}),listPosts:news.listPosts,requirePermission,metadata:{}});
 try{
  let list=await library.listMediaLibrary(writer);assert.equal(list.uploads.length,4);assert.equal(list.uploads[0].folder,'Unfiled');
  for(const id of ids.slice(0,3))await assert.rejects(()=>library.updateMediaLibrary({action:'remove',id},writer),/409/);
  await library.updateMediaLibrary({action:'create-folder',folder:'Construction'},writer);
  await library.updateMediaLibrary({action:'folder',id:'dddd.jpg',folder:'Construction'},writer);
  await library.updateMediaLibrary({action:'folder',url:'/static-cover.jpg',folder:'Construction'},writer);
  await library.updateMediaLibrary({action:'remove',id:'dddd.jpg'},writer);
  list=await library.listMediaLibrary(writer);assert(list.uploads.find(x=>x.id==='dddd.jpg').removed_at);assert.equal(list.site.find(x=>x.url==='/static-cover.jpg').folder,'Construction');
  assert.equal(db.sql.prepare('SELECT COUNT(*) count FROM media').get().count,4,'Archiving must retain stored file metadata');
  await library.updateMediaLibrary({action:'restore',id:'dddd.jpg'},writer);assert.equal(db.sql.prepare('SELECT removed_at FROM media WHERE id=?').get('dddd.jpg').removed_at,'');
  await assert.rejects(()=>library.updateMediaLibrary({action:'create-folder',folder:'Private'},{}),/403/);assert.equal(db.sql.prepare('SELECT name FROM library_folders WHERE name=?').get('Private'),undefined);
  await assert.rejects(()=>library.updateMediaLibrary({action:'folder',id:'dddd.jpg',folder:'bad/name'},writer),/400/);
 }finally{db.sql.close();}
});

test('unsaved changes cancel navigation once even when both page and panel are dirty',async()=>{
 const browser=new EventTarget(),cleanups=[];let prompts=0,selected='news';
 browser.confirm=()=>{prompts++;return false;};
 const guards=await moduleWith('../app/editor-guards.ts',['useUnsavedGuard'],{t:value=>value,window:browser,useEffect:callback=>{const cleanup=callback();if(cleanup)cleanups.push(cleanup);}});
 guards.useUnsavedGuard(true);guards.useUnsavedGuard(true);
 const source=await readFile(new URL('../app/ui.tsx',import.meta.url),'utf8');
 const code=stripTypeScriptTypes(source.slice(source.indexOf('function navigate('),source.indexOf('async function api(')));
 const navigate=new Function('window','setTab',code+';return navigate;')(browser,value=>{selected=value;});
 assert.equal(navigate('units'),false);assert.equal(selected,'news');assert.equal(prompts,1);
 cleanups.forEach(cleanup=>cleanup());assert.equal(navigate('units'),true);assert.equal(selected,'units');
});
