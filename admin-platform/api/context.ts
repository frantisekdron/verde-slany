import {AsyncLocalStorage} from 'node:async_hooks';
const requests=new AsyncLocalStorage<Request>();
export function withRequest<T>(request:Request,run:()=>T){return requests.run(request,run);}
export async function headers(){const request=requests.getStore();if(!request)throw new Error('Missing request context');return request.headers;}
