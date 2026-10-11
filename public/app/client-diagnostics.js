(function(global){
 'use strict';
 if(global.__PROPLET_DIAGNOSTIC_TRANSPORT__)return;
 global.__PROPLET_DIAGNOSTIC_TRANSPORT__=true;
 const nativeFetch=global.fetch.bind(global);
 // Repair only the diagnostic boundary, including a cached older app.js.
 // The producing app's immutable release is the source, never runtime-meta.
 global.fetch=function(input,init){
  try{
   const url=new URL(typeof input==='string'?input:input.url,location.href);
   if(url.origin===location.origin&&url.pathname==='/api/client-error'){
    const headers=new Headers(typeof input==='object'?input.headers:undefined);
    new Headers(init?.headers).forEach((value,key)=>headers.set(key,value));
    const release=typeof APP_PREVIEW_RELEASE==='string'?APP_PREVIEW_RELEASE:null;
    if(release&&/^proplet-v\d+\.\d+\.\d+-[A-Za-z0-9_.-]+$/.test(release)){
     headers.set('X-Proplet-Client-Release',release);headers.set('X-Proplet-Version',release.match(/^proplet-v(\d+\.\d+\.\d+)-/)[1]);headers.set('X-Proplet-Analytics','2');
    }
    if(new URLSearchParams(location.search).get('tutorial')==='1'||global.PROPLET_RUNTIME_ENV==='preview')headers.set('X-Proplet-Test','1');
    return nativeFetch(input,{...init,headers});
   }
  }catch{} // Bootstrap before app.js declares its release remains honestly unknown.
  return nativeFetch(input,init);
 };
})(window);
