const PROFILE_KEY='proplet-v2-profile';
const scopes=new Set();
export function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
export class ApiError extends Error{constructor(message,status=0){super(message);this.status=status}}
export function createRequestScope(getIdentity=()=>profile()?.token){
 let generation=0,controller=null;
 const scope={begin(){scopes.add(scope);controller?.abort();controller=new AbortController();const mine=++generation,identity=getIdentity(),ownController=controller;return {signal:controller.signal,current:()=>generation===mine&&identity===getIdentity()&&!ownController.signal.aborted}},cancel(){generation++;controller?.abort();scopes.delete(scope)}};return scope;
}
export const pageScope=createRequestScope(),detailScope=createRequestScope(),recoveryScope=createRequestScope();
let denied=()=>{};
export function onDenied(callback){denied=callback}
export async function api(path,{signal,...options}={}){
 const token=profile()?.token;if(!token)throw new ApiError('Přihlaš se do svého vlastnického účtu.',401);
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},20000);
 try{const response=await fetch(path,{...options,cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,...options.headers}});const body=await response.json().catch(()=>({}));if(token!==profile()?.token)throw new DOMException('Identita se změnila','AbortError');
 if(!response.ok){const raw=typeof body.detail==='string'?body.detail:typeof body.detail?.message==='string'?body.detail.message:'Požadavek se nepodařilo dokončit.';const requestId=String(body.requestId||'').replace(/[^A-Za-z0-9_.:-]/g,'').slice(0,32),error=new ApiError(`${raw}${requestId?` · kód ${requestId}`:''}`,response.status);if([401,403].includes(response.status))denied(error);throw error}return body;
 }catch(error){if(error.name==='AbortError'&&timedOut)throw new ApiError('Server se neozval včas. Zkus obnovit tuto sekci.');throw error}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export function query(path,values){const p=new URLSearchParams();Object.entries(values).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')p.set(k,String(v))});return `${path}?${p}`}
export function cancelAll(){for(const scope of [...scopes])scope.cancel()}
