(function(global){
 'use strict';
 if(global.__PROPLET_DIAGNOSTIC_TRANSPORT__)return;
 global.__PROPLET_DIAGNOSTIC_TRANSPORT__=true;
 const REPORTER_RELEASE='proplet-v4.09.14-diagnostics1';
 let appClaimedListeners=false;
 const nativeFetch=global.fetch.bind(global);
 const releasePattern=/^proplet-v\d+\.\d+\.\d+-[A-Za-z0-9_.-]+$/;
 function producer(){try{return typeof APP_PREVIEW_RELEASE==='string'&&releasePattern.test(APP_PREVIEW_RELEASE)?APP_PREVIEW_RELEASE:null}catch{return null}}
 function source(detail){
  const candidates=[];if(detail?.filename)candidates.push([detail.filename,detail.lineno,detail.colno]);
  if(detail?.source_file)candidates.push([detail.source_file,detail.source_line,detail.source_column]);
  if(Array.isArray(detail?.source_frames))for(const frame of detail.source_frames.slice(0,3))candidates.push([frame?.file,frame?.line,frame?.column]);
  // Raw stacks, function names and URL parameters never leave this boundary.
  for(const m of String(detail?.stack||detail?.error?.stack||'').matchAll(/(https?:\/\/[^\s)]+):([0-9]+):([0-9]+)/g))candidates.push([m[1],m[2],m[3]]);
  const frames=[];
  for(const [file,line,column]of candidates){try{
   const url=new URL(file,location.origin),l=Number(line),c=Number(column);
   if(url.origin!==location.origin||url.pathname.length>120||url.pathname.includes('..')||!/^\/(?:app\/)?[A-Za-z0-9_./-]+\.js$/.test(url.pathname)||!Number.isInteger(l)||l<1||l>1000000||!Number.isInteger(c)||c<1||c>1000000)continue;
   const frame={file:url.pathname,line:l,column:c};if(!frames.some(f=>f.file===frame.file&&f.line===l&&f.column===c))frames.push(frame);
   if(frames.length===3)break;
  }catch{}}
  return frames.length?{source_file:frames[0].file,source_line:frames[0].line,source_column:frames[0].column,source_frames:frames,source_availability:'available'}:{source_availability:detail?.message==='Script error.'?'opaque':'missing'};
 }
 function report(code,message,detail,providedHeaders){
  if(global.navigator?.onLine===false)return;
  let inherited={};try{if(typeof clientErrorHeaders==='function')inherited=clientErrorHeaders();else if(typeof analyticsHeaders==='function')inherited=analyticsHeaders()}catch{}
  const headers={...inherited,...providedHeaders,'Content-Type':'application/json'},release=producer();
  // This is the producing app.js constant, not the newer bootstrap or server.
  if(release){headers['X-Proplet-Client-Release']=release;headers['X-Proplet-Version']=release.match(/^proplet-v(\d+\.\d+\.\d+)-/)[1]}
  else{delete headers['X-Proplet-Client-Release'];delete headers['X-Proplet-Version']}
  headers['X-Proplet-Analytics']='2';
  if(new URLSearchParams(location.search).get('tutorial')==='1'||global.PROPLET_RUNTIME_ENV==='preview'||global.PROPLET_RUNTIME_META?.environment==='preview')headers['X-Proplet-Test']='1';
  try{const p=typeof getProfile==='function'?getProfile():null;if(p?.token)headers.Authorization=`Bearer ${p.token}`;else if(typeof getAnonymousId==='function')headers['X-Proplet-Anon-ID']=getAnonymousId()}catch{}
  const body={code:String(code||'client_error').slice(0,80),message:String(message||'').slice(0,200),route:location.pathname.slice(0,120),...(release?{client_release:release,client_version:headers['X-Proplet-Version']}:{unknown_producer_reason:'before_app_release'}),reporter_release:REPORTER_RELEASE,is_test:headers['X-Proplet-Test']==='1',...source(detail)};
  try{return nativeFetch('/api/client-error',{method:'POST',headers,body:JSON.stringify(body),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
 }
 // Catch bootstrap/opaque errors too. Do not install a second app.js listener.
 const ownsErrorListeners=typeof global.addEventListener==='function';
 global.PropletClientDiagnostics=Object.freeze({report,source,ownsErrorListeners,claimErrorListeners:()=>{appClaimedListeners=true}});
 if(ownsErrorListeners){
  // Cached pre-adapter apps install their own listeners. Once their release
  // exists, let those listeners report through the fetch adapter exactly once.
  const ownsEvent=()=>appClaimedListeners||!producer();
  global.addEventListener('error',e=>{if(ownsEvent())report('window_error',e?.message||'JavaScript error',e)});
  global.addEventListener('unhandledrejection',e=>{if(!ownsEvent())return;const r=e?.reason;report('unhandled_rejection',r?.message||String(r||'Promise rejection'),r)});
 }
 // Repair only the diagnostic boundary, including a cached older app.js.
 // The producing app's immutable release is the source, never runtime-meta.
 global.fetch=async function(input,init){
  try{
   const url=new URL(typeof input==='string'?input:input.url,location.href);
   if(url.origin===location.origin&&url.pathname==='/api/client-error'){
    const headers=new Headers(typeof input==='object'?input.headers:undefined);
    new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));
    const release=producer();
    if(release&&/^proplet-v\d+\.\d+\.\d+-[A-Za-z0-9_.-]+$/.test(release)){
     headers.set('X-Proplet-Client-Release',release);headers.set('X-Proplet-Version',release.match(/^proplet-v(\d+\.\d+\.\d+)-/)[1]);headers.set('X-Proplet-Analytics','2');
    }else{headers.delete('X-Proplet-Client-Release');headers.delete('X-Proplet-Version')}
    if(new URLSearchParams(location.search).get('tutorial')==='1'||global.PROPLET_RUNTIME_ENV==='preview')headers.set('X-Proplet-Test','1');
    let body=init?.body;
    if(body===undefined&&typeof Request!=='undefined'&&input instanceof Request&&input.method==='POST')body=await input.clone().text();
    if(typeof body==='string'){
     try{
      const legacy=JSON.parse(body);
      if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)){
       if(legacy.is_test===true)headers.set('X-Proplet-Test','1');
       // Enrich the actual legacy transport request, not a second error event.
       // An allowlist prevents raw stacks/URLs and arbitrary legacy fields leaking.
       body=JSON.stringify({code:String(legacy.code||'client_error').slice(0,80),message:String(legacy.message||'').slice(0,200),route:location.pathname.slice(0,120),
        ...(release?{client_release:release,client_version:headers.get('X-Proplet-Version')}:{unknown_producer_reason:'before_app_release'}),
        reporter_release:REPORTER_RELEASE,is_test:headers.get('X-Proplet-Test')==='1',...source(legacy)});
      }
     }catch{} // Malformed/non-JSON payloads keep their original failure semantics.
    }
    return nativeFetch(input,{...init,headers,...(body!==undefined?{body}:{})});
   }
  }catch{} // Bootstrap before app.js declares its release remains honestly unknown.
  return nativeFetch(input,init);
 };
})(window);
