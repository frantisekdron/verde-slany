import {db} from './cms';
import {Buffer} from 'node:buffer';
const CHUNK=256*1024, BATCH=8;

// Keep private uploads in the account's existing D1 service. Each row stays
// below D1's 2 MB limit; batching also bounds Worker subrequests and memory.
export async function saveFile(id:string,bytes:Uint8Array,mime:string){
 const etag='"'+Buffer.from(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)).toString('hex')+'"';
 try{
  for(let offset=0;offset<bytes.length;offset+=CHUNK*BATCH){
   const inserts=[];
   for(let start=offset;start<Math.min(bytes.length,offset+CHUNK*BATCH);start+=CHUNK){
    inserts.push(db().prepare('INSERT INTO file_chunks(file_id,part,data) VALUES(?,?,?)')
     .bind(id,start/CHUNK,bytes.slice(start,start+CHUNK).buffer));
   }
   await db().batch(inserts);
  }
  await db().prepare('INSERT INTO file_objects(id,size,mime,etag,created) VALUES(?,?,?,?,?)')
   .bind(id,bytes.length,mime,etag,new Date().toISOString()).run();
 }catch(error){
  await db().prepare('DELETE FROM file_chunks WHERE file_id=?').bind(id).run();
  throw error;
 }
}
export function parseRange(header:string|null,size:number){
 if(!header)return {offset:0,length:size,partial:false};
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);
 if(!match||!match[1]&&!match[2])return null;
 const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 const end=match[1]?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return null;
 return {offset:start,length:end-start+1,partial:true};
}
export async function fileResponse(id:string,request:Request,publicFile:boolean){
 const meta:any=await db().prepare('SELECT * FROM file_objects WHERE id=?').bind(id).first();
 if(!meta)return new Response('Not found',{status:404});
 const headers=new Headers({'Content-Type':meta.mime,'ETag':meta.etag,
  'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes',
  'Cache-Control':publicFile?'public, max-age=3600':'private, no-store'});
 if(request.headers.get('if-none-match')===meta.etag)return new Response(null,{status:304,headers});
 const ifRange=request.headers.get('if-range');
 const range=parseRange(!ifRange||ifRange===meta.etag?request.headers.get('range'):null,meta.size);
 if(!range){headers.set('Content-Range','bytes */'+meta.size);return new Response(null,{status:416,headers});}
 headers.set('Content-Length',String(range.length));
 if(range.partial)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${meta.size}`);
 let part=Math.floor(range.offset/CHUNK);
 const end=range.offset+range.length, last=Math.floor((end-1)/CHUNK);
 const body=new ReadableStream<Uint8Array>({
  async pull(controller){
   try{
    const until=Math.min(last+1,part+BATCH);
    const rows=await db().prepare('SELECT part,hex(data) data FROM file_chunks WHERE file_id=? AND part>=? AND part<? ORDER BY part').bind(id,part,until).all();
    if(rows.results.length!==until-part)throw new Error('Incomplete stored file');
    for(const row of rows.results as any[]){
     const bytes=Buffer.from(row.data,'hex'),base=row.part*CHUNK;
     controller.enqueue(bytes.subarray(Math.max(0,range.offset-base),Math.min(bytes.length,end-base)));
    }
    part=until;
    if(part>last)controller.close();
   }catch(error){controller.error(error);}
  }
 });
 return new Response(body,{status:range.partial?206:200,headers});
}
