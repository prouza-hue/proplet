/* Defence in depth: this static preview cannot reach a live API. */
(()=>{
'use strict';
const denied=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
if(denied.has(location.hostname))throw new Error('Order preview is forbidden on a production host');
const nativeFetch=window.fetch.bind(window),blocked=[],errors=[];
window.PROPLET_ORDER_PREVIEW={nativeFetch,blocked,errors};
window.addEventListener('error',e=>errors.push(String(e.message)));
window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason?.message||e.reason)));
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.origin),method=String(options.method||input?.method||'GET').toUpperCase();
 if(url.origin!==location.origin){blocked.push({path:url.hostname,method});return response({detail:'External network is disabled in this preview'},403)}
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_vercel/')){
  blocked.push({path:url.pathname,method});
  if(url.pathname==='/api/play-session/config')return response({enabled:false,isolatedPreview:true});
  if(url.pathname==='/api/config')return response({environment:'preview',version:'4.02.2',isolatedPreview:true,backend:'none',canonicalOrigin:location.origin});
  return response({detail:'API unavailable in isolated preview'},403);
 }
 if(!['GET','HEAD'].includes(method))return response({detail:'Writes are disabled'},403);
 return nativeFetch(input,options);
};
try{navigator.sendBeacon=()=>false}catch{}
const originalOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){const u=new URL(url,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/')||!['GET','HEAD'].includes(String(method).toUpperCase()))throw new Error('Preview network isolation');return originalOpen.call(this,method,url,...rest)};
document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(!a)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/')){e.preventDefault();e.stopImmediatePropagation()}},true);
})();
