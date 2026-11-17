import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.VERDE_TEST_API;
const origin='http://127.0.0.1:8786';
test('independent admin: authentication, roles, drafts, conflicts, reservations and private files',{skip:!base},async()=>{
 assert(new URL(base).hostname==='127.0.0.1','Integration writes are restricted to the isolated local database.');
 const accounts=JSON.parse(await readFile(new URL('../.private/local-accounts.json',import.meta.url),'utf8'));
 async function request(path,{token,body,method,from=origin}={}){
  const headers={Origin:from,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})};
  const response=await fetch(base+path,{method:method||(body?'POST':'GET'),headers,...(body?{body:JSON.stringify(body)}:{})});
  const data=response.headers.get('Content-Type')?.includes('application/json')?await response.json():await response.text();return {response,data};
 }
 assert.equal((await request('/api/state')).response.status,401);
 const spoof=await fetch(base+'/api/state',{headers:{Origin:origin,'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@verde.test'}});assert.equal(spoof.status,401);
 assert.equal((await request('/api/state',{method:'OPTIONS'})).response.status,204);
 const forbidden=await request('/api/auth/login',{method:'OPTIONS',from:'https://untrusted.example'});assert.equal(forbidden.response.status,403);assert(!forbidden.response.headers.has('Access-Control-Allow-Origin'));
 async function signIn(account){
  let result=await request('/api/auth/login',{body:{email:account.email,password:account.password}});
  if(result.response.status===401)result=await request('/api/auth/login',{body:{email:account.email,password:account.newPassword}});
  assert.equal(result.response.status,200);assert(!result.response.headers.has('Set-Cookie'));
  let token=result.data.token;
  if(result.data.mustChange){
   assert.equal((await request('/api/state',{token})).response.status,428);
   result=await request('/api/auth/password',{token,body:{currentPassword:account.password,password:account.newPassword}});assert.equal(result.response.status,200);token=result.data.token;
  }
  return token;
 }
 const owner=await signIn(accounts[0]),sales=await signIn(accounts[1]);
 const state=()=>request('/api/state',{token:owner}).then(result=>result.data);
 let snapshot=await state();assert.equal(snapshot.pages.filter(page=>page.group==='units').length,72);
 assert.equal(snapshot.passwordMode,true);assert.equal(snapshot.sitesMode,false);
 assert.equal((await request('/api/members',{token:sales})).response.status,403);
 assert.equal((await request('/api/news',{token:sales})).response.status,403);
 assert.equal((await request('/api/save',{token:owner,body:{version:snapshot.version,patch:{}},from:'https://untrusted.example'})).response.status,403);
 const field=Object.values(snapshot.fields).find(field=>field.kind==='text'&&!field.shared&&field.pages.includes(''));
 const before=snapshot.published[field.id]??field.value,marker='LOCAL MIGRATION CHECK '+Date.now();
 assert.equal((await request('/api/save',{token:owner,body:{version:snapshot.version,patch:{[field.id]:marker}}})).response.status,200);
 assert.equal((await request('/api/save',{token:owner,body:{version:snapshot.version,patch:{[field.id]:'stale'}}})).response.status,409);
 snapshot=await state();assert.equal(snapshot.draft[field.id],marker);assert.equal(snapshot.published[field.id]??field.value,before);
 const preview=await request('/api/preview-link',{token:owner,body:{target:''}});assert.equal(preview.response.status,200);
 const previewResponse=await fetch(preview.data.url);assert.equal(previewResponse.status,200);const html=await previewResponse.text();assert(html.includes(marker));assert(html.includes('window.__VERDE_PREVIEW_CATALOG='));
 assert(!html.includes('.chatgpt.site'));assert(!html.includes('signin-with-chatgpt'));
 snapshot=await state();assert.equal((await request('/api/discard',{token:owner,body:{version:snapshot.version}})).response.status,200);
 snapshot=await state();const status=Object.values(snapshot.fields).find(field=>field.shared?.endsWith(':Stav')&&(snapshot.published[field.id]??field.value)==='Na prodej');
 assert(status);const unit='flats/'+status.shared.split(':')[1];
 const contact={unit,name:'Local migration test',email:'local-check@example.test',phone:'',note:'Isolated local test',stage:'reserved',cmsVersion:snapshot.version};
 const reservation=await request('/api/sales',{token:sales,body:contact});assert.equal(reservation.response.status,200);
 snapshot=await state();assert.equal(snapshot.published[status.id],'Rezervováno');
 const publicCatalog=await request('/api/public-catalog');assert.equal(publicCatalog.data.units.find(row=>'flats/'+row.key===unit).status,'rezervováno');
 assert.equal((await request('/api/sales',{token:owner,body:{...contact,cmsVersion:snapshot.version}})).response.status,409);
 const rows=(await request('/api/sales',{token:sales})).data.cases;const row=rows.find(row=>row.id===reservation.data.id);
 assert.equal((await request('/api/sales',{token:sales,body:{...row,stage:'closed',note:'Finished local test',cmsVersion:snapshot.version}})).response.status,200);
 const png=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/aRZsAAAAASUVORK5CYII=','base64'),Buffer.alloc(1024*1024,123)]);
 const upload=new FormData();upload.append('file',new Blob([png],{type:'image/png'}),'local-check.png');
 const uploadedResponse=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+owner},body:upload});assert.equal(uploadedResponse.status,200);const uploaded=await uploadedResponse.json();
 assert.equal((await fetch(base+uploaded.url)).status,403);
 const signed=uploaded.fileUrls[uploaded.url];assert(signed);assert.equal((await fetch(signed)).status,200);const partial=await fetch(signed,{headers:{Range:'bytes=0-9'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,10);
 assert.deepEqual(Buffer.from(await (await fetch(signed)).arrayBuffer()),png);
 const spanning=await fetch(signed,{headers:{Range:'bytes=260000-530000'}});assert.equal(spanning.status,206);assert.deepEqual(Buffer.from(await spanning.arrayBuffer()),png.subarray(260000,530001));
 const suffix=await fetch(signed,{headers:{Range:'bytes=-17'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),png.subarray(-17));
 assert.equal((await fetch(signed,{headers:{Range:'bytes=999999999-'}})).status,416);
 const staleRange=await fetch(signed,{headers:{Range:'bytes=0-9','If-Range':'"old"'}});assert.equal(staleRange.status,200);assert.equal((await staleRange.arrayBuffer()).byteLength,png.length);
 const damaged=new URL(signed);damaged.searchParams.set('target','other.png');assert.equal((await fetch(damaged)).status,403);
 assert.equal((await request('/api/auth/logout',{token:owner,body:{}})).response.status,200);
 assert.equal((await request('/api/state',{token:owner})).response.status,401);
 assert.equal((await fetch(signed)).status,403);assert.equal((await fetch(preview.data.url)).status,403);
 await request('/api/auth/logout',{token:sales,body:{}});
});
