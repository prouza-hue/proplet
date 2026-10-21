/* First script in the generated review only. No production application edits. */
(()=>{'use strict';
const banned=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
if(banned.has(location.hostname))throw Error('Studio fixture refuses production origin');
window.PROPLET_STUDIO_PREVIEW=true;window.PROPLET_ARCHIVE_PREVIEW=true;window.PROPLET_RUNTIME_ENV='preview';
const nativeFetch=window.fetch.bind(window),requests=[];window.PROPLET_STUDIO_NETWORK=requests;
window.fetch=(input,init={})=>{
 const target=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href),method=String(init.method||input?.method||'GET').toUpperCase();
 if(target.origin!==location.origin||target.username||target.password||target.pathname.startsWith('/api/')||!['GET','HEAD'].includes(method)){
  requests.push({path:target.pathname,method,blocked:true});
  return Promise.resolve(new Response(JSON.stringify({detail:'Isolated preview: network API disabled'}),{status:403,headers:{'content-type':'application/json'}}));
 }
 const headers=new Headers(init.headers||input?.headers||{});headers.delete('Authorization');headers.delete('Cookie');
 requests.push({path:target.pathname,method,blocked:false});
 return nativeFetch(target.href,{...init,method,headers,credentials:'omit',redirect:'error'});
};
try{Object.defineProperty(navigator,'sendBeacon',{value:()=>false,configurable:true})}catch{}
for(const name of ['WebSocket','EventSource','XMLHttpRequest','Worker','SharedWorker']){
 try{Object.defineProperty(window,name,{configurable:true,value:class{constructor(){throw new DOMException('Disabled in isolated preview','SecurityError')}}})}catch{}
}
try{if(navigator.serviceWorker)Object.defineProperty(navigator.serviceWorker,'register',{value:()=>Promise.reject(new Error('Service worker disabled in isolated preview'))})}catch{}
try{Object.defineProperty(navigator,'share',{value:()=>Promise.reject(new Error('Sdílení je v tomto náhledu vypnuté.')),configurable:true})}catch{}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href]');if(!link)return;
 const url=new URL(link.href,location.href);
 if(url.origin!==location.origin||url.pathname.startsWith('/api/')){event.preventDefault();event.stopImmediatePropagation();}
},true);
})();
