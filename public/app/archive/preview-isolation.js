/* Isolated review adapter. Real app, historical boards, device-only review state. */
(()=>{
'use strict';
if(!document.documentElement.hasAttribute('data-archive-preview'))return;
window.PROPLET_ARCHIVE_PREVIEW=true;
const native=window.localStorage,prefix='proplet:archive-integration-review:v1:';
const store={getItem:k=>native.getItem(prefix+k),setItem:(k,v)=>native.setItem(prefix+k,String(v)),removeItem:k=>native.removeItem(prefix+k),clear:()=>Object.keys(native).filter(k=>k.startsWith(prefix)).forEach(k=>native.removeItem(k)),key:i=>Object.keys(native).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length)??null,get length(){return Object.keys(native).filter(k=>k.startsWith(prefix)).length}};
Object.defineProperty(window,'localStorage',{configurable:true,value:store});
const json=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
const net=window.fetch.bind(window);
window.PROPLET_REVIEW_REQUESTS=[];
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=String(init.method||input?.method||'GET').toUpperCase();
 if(url.origin!==location.origin)return new Response('Review blocks external requests',{status:403});
 if(url.pathname.startsWith('/api/')){
  window.PROPLET_REVIEW_REQUESTS.push({path:url.pathname,method});
  if(method==='GET'&&['/api/daily','/api/tajenka','/api/rolling-content'].includes(url.pathname))return net(input,init);
  if(url.pathname==='/api/config')return json({"badges":[{"days":1,"icon":"🥉","name":"První zářez"},{"days":3,"icon":"❤️","name":"Srdcař"},{"days":5,"icon":"⭐","name":"Pětka"},{"days":7,"icon":"🔥","name":"Týden v plamenech"},{"days":10,"icon":"🏆","name":"Desítka"},{"days":14,"icon":"⚡","name":"Blesk"},{"days":21,"icon":"🦉","name":"Mistr slov"},{"days":30,"icon":"👑","name":"Koruna"},{"days":50,"icon":"💎","name":"Diamant"},{"days":100,"icon":"🚀","name":"Legenda"}],"points":{"daily":100,"easy":15,"medium":25,"hard":50,"hardcore":100,"mozkomor":150,"starter":10},"dictionarySize":13939,"dailyRotationSize":365,"dailyGeneration":4,"dailyGeneration3From":"2026-08-17","dailyCadence":{"weekdays":["easy","easy","medium","medium","medium","hard","hard"],"counts":{"easy":105,"medium":156,"hard":104}},"rescueBankSize":30,"pushAvailable":false,"environment":"preview","version":"4.05.1","historicalFreeWriteEnabled":false});
  if(url.pathname==='/api/free-order/config')return json({enabled:true,isolatedPreview:true});
  if(url.pathname==='/api/rescue/status')return json({state:'unavailable'});
  if(url.pathname.includes('rankings')||url.pathname.includes('leaderboard'))return json({players:[{id:'review-1',name:'Lukáš',avatar:'🦊',xp:32400,rank:1},{id:'review-2',name:'Klára',avatar:'🌺',xp:29600,rank:2},{id:'review-3',name:'Matěj',avatar:'🐉',xp:27800,rank:3}],teams:[{id:'review-team',name:'Sazeči',xp:4820,rank:1}],period:url.searchParams.get('period')||'all'});
  if(url.pathname.includes('sync')||url.pathname.includes('result'))return json({ok:true,accepted:[],results:[],reviewOnly:true});
  if(method!=='GET')return json({ok:true,reviewOnly:true,wordDiscoveryXp:0,awardedXp:0});
  return json({ok:true,enabled:false,results:[],items:[],reviewOnly:true});
 }
 if(method!=='GET'&&method!=='HEAD')return new Response('Review has no server writes',{status:403});
 return net(input,init);
};
try{navigator.sendBeacon=()=>false}catch{}
if(!store.getItem('initialized')){
 store.setItem('initialized','1');
 store.setItem('proplet-v3-7-required-onboarding','done');
 store.setItem('proplet-v3-16-2-helper-onboarding','done');
 store.setItem('proplet-v3-settings',JSON.stringify({theme:'light',sound:false,haptics:false,wakeLock:false}));
 store.setItem('proplet:content-release:refresh300-v1','1');
 store.setItem('proplet:content-release:mk100-v2','1');
 store.setItem('proplet-v2-profile',JSON.stringify({id:'archive-review',name:'Alex',avatar:'🦊'}));
}
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('aside');bar.id='archiveReviewNotice';bar.innerHTML='<span>Testovací Proplet · výsledky zůstávají pouze v tomto náhledu</span><button type="button" data-archive-action="review">Ovládání náhledu</button>';document.body.prepend(bar);
});
})();
