/* Archive release review on the native 4.07.1 application.
 * This is a local API adapter, not a server reward implementation.
 * Production database writes, production credentials and unpublished Daily
 * content are never used. Optional Extra scenarios reuse public free boards.
 */
(() => {
'use strict';
if (!document.documentElement.hasAttribute('data-archive-preview')) return;
if (['127.0.0.1','localhost'].includes(location.hostname)
    && new URLSearchParams(location.search).get('archive-preview') !== '1') return;
window.PROPLET_ARCHIVE_PREVIEW = true;
const nativeStorage = window.localStorage;
const nativeSession = window.sessionStorage;
const settingsKey = 'proplet:archive-release-review:20261013:settings';
const extras = {hardcore:'2026-10-14',mozkomor:'2026-10-16',mozkokalypsa:'2026-10-18'};
const referralStates = new Set(['member','incoming','paid','guest']);
const referralAliases = {invite:'member',progress:'incoming',earned:'paid'};
let stored = {};
try { stored = JSON.parse(nativeStorage.getItem(settingsKey) || '{}'); } catch {}
const scenario = {
 extra: extras[stored.extra] ? stored.extra : 'live',
 referral: referralStates.has(stored.referral) ? stored.referral : 'member',
 announcement: ['extra','referral'].includes(stored.announcement) ? stored.announcement : 'none'
};
const prefix = 'proplet:archive-release-review:20261013:v2:' + scenario.extra + ':' + scenario.referral + ':';
function scopedStorage(storage) {
 const keys = () => Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k?.startsWith(prefix));
 return {
  getItem:key=>storage.getItem(prefix+key),
  setItem:(key,value)=>storage.setItem(prefix+key,String(value)),
  removeItem:key=>storage.removeItem(prefix+key),
  clear:()=>keys().forEach(key=>storage.removeItem(key)),
  key:index=>keys()[index]?.slice(prefix.length)??null,
  get length(){return keys().length;}
 };
}
const local = scopedStorage(nativeStorage), session = scopedStorage(nativeSession);
Object.defineProperty(window,'localStorage',{configurable:true,value:local});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:session});
const read=(key,fallback)=>{try{return JSON.parse(local.getItem(key)||'null')??fallback;}catch{return fallback;}};
const save=(key,value)=>local.setItem(key,JSON.stringify(value));
const profileId='archive-review', token='REVIEW-ONLY-NOT-A-PRODUCTION-TOKEN';
const fixtureProfile={id:profileId,name:'Alex',avatar:'🦊',token,hasPassword:true,supportMode:'none',
 familyCode:null,leagueName:null,googleLinked:false,useGoogleAvatar:false};
if (!local.getItem('initialized')) {
 local.setItem('initialized','1');
 local.setItem('proplet-v3-7-required-onboarding','done');
 local.setItem('proplet-v3-16-2-helper-onboarding','done');
 save('proplet-v3-settings',{theme:'light',sound:false,haptics:false,wakeLock:false});
 local.setItem('proplet:content-release:refresh300-v1','1');
 local.setItem('proplet:content-release:mk100-v2','1');
 if (scenario.referral!=='guest') save('proplet-v2-profile',fixtureProfile);
}
save('proplet-marketing-consent-v1',{value:'denied',at:Date.now()});
if(scenario.announcement!=='referral')local.setItem('proplet:referral-announcement-seen:v1:'+profileId,'1');
else local.removeItem('proplet:referral-announcement-seen:v1:'+profileId);
const extraReceipt='proplet:daily-extra-intro:v1:account:'+profileId;
if(scenario.announcement!=='extra')local.setItem(extraReceipt,'1');else local.removeItem(extraReceipt);
if(scenario.referral==='guest')session.setItem('proplet:pending-referral:v1',JSON.stringify({code:'REVIEWONLYKATKA',at:Date.now()}));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const net=window.fetch.bind(window);
const requests=window.PROPLET_REVIEW_REQUESTS=[];
const liveDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const today=()=>extras[scenario.extra]||liveDate();
const validity=()=>new Date(Date.now()+86400000).toISOString();
const profile=()=>{try{return typeof getProfile==='function'?getProfile():read('proplet-v2-profile',null);}catch{return read('proplet-v2-profile',null);}};
const state=()=>{try{return typeof getState==='function'?getState():{completed:{},inProgress:{}};}catch{return {completed:{},inProgress:{}};}};
const stats=()=>{
 let value={points:0,totalCompleted:0,dailyCompleted:0,freeCompleted:{},currentStreak:0,longestStreak:0,cleanSolves:0};
 try{if(typeof currentLocalStats==='function')value={...value,...currentLocalStats()};}catch{}
 return value;
};
const snapshot=()=>({...fixtureProfile,...profile(),stats:stats(),completed:[],cursor:new Date().toISOString()});
const ownInvite=()=>({code:'REVIEWONLYALEX',url:location.origin+location.pathname+'?invite=REVIEWONLYALEX'});
const emptyResult={ok:true,reviewOnly:true,enabled:false,available:false,allowed:false,rows:[],members:[],leagues:[],records:{},completed:[],events:[],results:[],items:[]};
let publicBankPromise=null;
const fetchPublished=path=>net(path,{method:'GET',credentials:'omit',cache:'no-store'});
async function publicBank(){
 if(!publicBankPromise)publicBankPromise=fetchPublished('/puzzles.json').then(async r=>{if(!r.ok)throw Error('review-public-bank-unavailable');return r.json();});
 return publicBankPromise;
}
async function digest(puzzle){
 const text=JSON.stringify({rows:puzzle.rows,cols:puzzle.cols,letters:puzzle.letters,mask:puzzle.mask,answers:puzzle.answers,lengths:puzzle.lengths});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
async function modelPuzzle(kind){
 // Public free boards avoid revealing or relocating any real dated Extra board.
 const difficulty=kind==='special'?scenario.extra:(scenario.extra==='mozkokalypsa'?'hard':'medium');
 const bank=await publicBank();
 const source=bank.free?.[difficulty]?.find(p=>Array.isArray(p.answers)&&p.answers.length);
 if(!source)throw Error('review-public-puzzle-missing:'+difficulty);
 return {...structuredClone(source),id:'review-only-'+kind+'-'+today(),
  meta:{...source.meta,reviewOnly:true,reviewSourceId:source.id}};
}
async function modelDaily(){
 const puzzle=await modelPuzzle('base');
 return {schemaVersion:1,serverToday:today(),dailyDate:today(),validUntil:validity(),
  puzzleId:puzzle.id,puzzle,challengeKey:'daily:'+today(),contentHash:await digest(puzzle),
  bankVersion:'review-public-free-v1',official:true,rewardEligible:true,reviewOnly:true};
}
async function specialResponse(){
 const clock={schemaVersion:1,serverToday:today(),validUntil:validity(),reviewOnly:true,
  schedule:[{weekday:3,difficulty:'hardcore'},{weekday:5,difficulty:'mozkomor'},{weekday:7,difficulty:'mozkokalypsa'}]};
 if(scenario.extra==='live'){
  // Real publication stays server-owned; a disabled preview API gives a faithful no-Extra day.
  const response=await fetchPublished('/api/daily-special');
  if(response.ok){const data=await response.json();if(data?.serverToday&&Object.prototype.hasOwnProperty.call(data,'special'))return data;}
  return {...clock,special:null};
 }
 const puzzle=await modelPuzzle('special');
 return {...clock,special:{schemaVersion:1,mode:'daily_special',challengeKind:'special',
  serverToday:today(),dailyDate:today(),validUntil:clock.validUntil,difficulty:scenario.extra,
  challengeKey:'daily-special:'+today()+':'+scenario.extra,puzzleId:puzzle.id,puzzle,
  bankVersion:'review-public-free-v1',contentHash:await digest(puzzle),official:true,rewardEligible:true,reviewOnly:true}};
}
let ready=false;
function completionIds(){return [...new Set(Object.values(state().completed||{}).filter(r=>['free','daily','daily_special','tajenka'].includes(r.mode)).map(r=>r.puzzleId).filter(Boolean))];}
function referralIncoming(){
 if(!['incoming','paid','guest'].includes(scenario.referral))return null;
 if(scenario.referral==='guest'&&!profile()?.id)return null;
 if(!local.getItem('referralBaseline')&&ready)save('referralBaseline',completionIds());
 const before=new Set(read('referralBaseline',completionIds()));
 const extra=completionIds().filter(id=>!before.has(id)).length;
 const count=scenario.referral==='paid'?5:Math.min(5,(scenario.referral==='guest'?0:3)+extra);
 const paid=count===5;
 return {id:'review-incoming-katka',inviter:{id:'review-katka',name:'Katka',avatar:'🦊'},completedBoards:count,
  paid,rewardDismissed:local.getItem('referralDismissed')==='1',reviewOnly:true};
}
const referralStatus=()=>({enabled:true,invite:ownInvite(),incoming:referralIncoming(),referrals:[],referralCount:0,reviewOnly:true});
function boardRanking(url){
 const mine=profile()?.id||profileId;
 const rows=[{id:'review-klara',name:'Klára',avatar:'🌺',rank:1,elapsedMs:42000,moves:8,hintsUsed:0,cleanSolve:true},
  {id:mine,name:profile()?.name||'Alex',avatar:profile()?.avatar||'🦊',rank:2,elapsedMs:65000,moves:9,hintsUsed:0,cleanSolve:true},
  {id:'review-matej',name:'Matěj',avatar:'🐉',rank:3,elapsedMs:72000,moves:10,hintsUsed:0,cleanSolve:true}];
 return {rows,total:3,myRank:2,position:2,players:rows,nextOffset:null,reviewOnly:true,
  puzzleId:url.searchParams.get('puzzle_id'),date:url.searchParams.get('daily_date')||today(),
  challengeKey:url.searchParams.get('challenge_key'),challengeKind:url.pathname.includes('daily-special')?'special':undefined};
}
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
 const method=String(init.method||input?.method||'GET').toUpperCase();
 if(url.origin!==location.origin)return json({detail:'Testovací náhled neposílá síťové požadavky mimo svůj původ.'},403);
 if(!url.pathname.startsWith('/api/')){
  if(!['GET','HEAD'].includes(method))return json({detail:'Testovací náhled nemá serverové zápisy.'},403);
  const headers=new Headers(init.headers||input?.headers||{});headers.delete('Authorization');headers.delete('Cookie');
  return net(url.href,{...init,method,headers,credentials:'omit'});
 }
 requests.push({path:url.pathname,method,reviewOnly:true});
 let body={};try{body=JSON.parse(init.body||'{}');}catch{}
 const path=url.pathname;
 if(method==='GET'&&path==='/api/config'){
  let config={"badges":[{"days":1,"icon":"🥉","name":"První zářez"},{"days":3,"icon":"❤️","name":"Srdcař"},{"days":5,"icon":"⭐","name":"Pětka"},{"days":7,"icon":"🔥","name":"Týden v plamenech"},{"days":10,"icon":"🏆","name":"Desítka"},{"days":14,"icon":"⚡","name":"Blesk"},{"days":21,"icon":"🦉","name":"Mistr slov"},{"days":30,"icon":"👑","name":"Koruna"},{"days":50,"icon":"💎","name":"Diamant"},{"days":100,"icon":"🚀","name":"Legenda"}],"points":{"daily":100,"easy":15,"medium":25,"hard":50,"hardcore":100,"mozkomor":150,"starter":10,"mozkokalypsa":200},"dictionarySize":13939,"dailyRotationSize":365,"dailyGeneration":4,"dailyGeneration3From":"2026-08-17","dailyCadence":{"weekdays":["easy","easy","medium","medium","medium","hard","hard"],"counts":{"easy":105,"medium":156,"hard":104}},"rescueBankSize":30,"pushAvailable":false,"environment":"preview","version":"4.07.1","historicalFreeWriteEnabled":false,"referralsEnabled":true,"dailySpecialsEnabled":true};
  try{const response=await fetchPublished('/api/config');if(response.ok)config={...config,...await response.json()};}catch{}
  return json({...config,environment:'preview',version:'4.07.1',historicalFreeWriteEnabled:false,reviewOnly:true});
 }
 if(method==='GET'&&path==='/api/daily'){
  if(scenario.extra!=='live')return json(await modelDaily());
  return fetchPublished(path+url.search);
 }
 if(method==='GET'&&path==='/api/daily-special')return json(await specialResponse());
 if(method==='GET'&&['/api/tajenka','/api/rolling-content'].includes(path))return fetchPublished(path+url.search);
 if(path==='/api/referrals'&&method==='GET')return json(referralStatus());
 if(path==='/api/referrals/invite'&&method==='POST')return json({...ownInvite(),rewardXp:1000,requiredBoards:5,reviewOnly:true});
 if(path.startsWith('/api/referrals/invite/')&&method==='GET')return json({enabled:true,inviter:{name:'Katka',avatar:'🦊'},reviewOnly:true});
 if(path==='/api/referrals/dismiss'&&method==='POST'){local.setItem('referralDismissed','1');return json({ok:true,reviewOnly:true});}
 if(method==='GET'&&['/api/account/snapshot','/api/me'].includes(path))return json(snapshot());
 if(method==='GET'&&path==='/api/progress')return json({completed:[],rescues:[],inProgress:[],dailyDates:[],reviewOnly:true});
 if(path==='/api/free-order/config')return json({enabled:true,isolatedPreview:true,reviewOnly:true});
 if(path==='/api/play-session/config')return json({enabled:false,isolatedPreview:false,reviewOnly:true});
 if(path==='/api/rescue/status')return json({state:'unavailable',reviewOnly:true});
 if(method==='GET'&&(path.includes('global-leaderboard')||path==='/api/rankings/daily-special'))return json(boardRanking(url));
 if(method==='GET'&&(path.includes('rankings')||path.includes('leaderboard')))return json({
  players:[{id:'review-1',name:'Lukáš',avatar:'🦊',xp:32400,rank:1},{id:'review-2',name:'Klára',avatar:'🌺',xp:29600,rank:2},{id:profileId,name:'Alex',avatar:'🦊',xp:stats().points,rank:3}],
  teams:[{id:'review-team',code:'review-team',name:'Sazeči',xp:4820,rank:1}],rows:[],period:url.searchParams.get('period')||'all',reviewOnly:true});
 if(['POST','PUT','PATCH','DELETE'].includes(method)){
  if(path==='/api/player'||path==='/api/auth/google/complete')return json({...snapshot(),name:String(body.name||'Alex'),accountCreated:true,reviewOnly:true});
  if(path==='/api/result')return json({ok:true,accepted:true,awardedXp:0,wordDiscoveryXp:0,reviewOnly:true});
  if(path==='/api/support-report'||path==='/api/account')return json({detail:'Tato akce je dostupná pouze v ostrém Propletu; náhled nic neodesílá.'},409);
  return json({...emptyResult,ok:true,accepted:[],reviewOnly:true,wordDiscoveryXp:0,awardedXp:0});
 }
 return json(emptyResult);
};
try{navigator.sendBeacon=()=>false;}catch{}
// Defensive transport guard: no API call can evade the fetch adapter via XHR.
if(window.XMLHttpRequest){
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,setHeader=XMLHttpRequest.prototype.setRequestHeader;
 const denied=new WeakSet();
 XMLHttpRequest.prototype.open=function(method,url,...args){
  const target=new URL(String(url),location.href);
  if(target.origin!==location.origin||target.pathname.startsWith('/api/')||!['GET','HEAD'].includes(String(method).toUpperCase()))denied.add(this);
  else denied.delete(this);
  return open.call(this,method,url,...args);
 };
 XMLHttpRequest.prototype.setRequestHeader=function(name,value){
  if(String(name).toLowerCase()==='authorization')return;
  return setHeader.call(this,name,value);
 };
 XMLHttpRequest.prototype.send=function(...args){
  if(denied.has(this))throw new DOMException('Review blocks API writes and external XHR','SecurityError');
  return send.apply(this,args);
 };
}
const api={
 getScenario:()=>({...scenario,modelDate:extras[scenario.extra]||null,version:'4.07.1',scope:prefix}),
 setScenario(next={}){
  const change=next.reset?{extra:'live',referral:'member',announcement:'none'}:{...scenario,...next};
  change.referral=referralAliases[change.referral]||change.referral;
  delete change.reset;
  if(!['live',...Object.keys(extras)].includes(change.extra)||!referralStates.has(change.referral)
    ||!['none','extra','referral'].includes(change.announcement))throw Error('Unknown review scenario');
  nativeStorage.setItem(settingsKey,JSON.stringify(change));location.reload();
 },
 requests,
 reset(){local.clear();session.clear();location.reload();}
};
window.PropletArchiveReview=api;
document.addEventListener('DOMContentLoaded',()=>{
 const bar=document.createElement('aside');bar.id='archiveReviewNotice';
 const copy=document.createElement('span');
 copy.textContent='Testovací Proplet · postup a pozvánky zůstávají v tomto náhledu'
  +(extras[scenario.extra]?' · modelový den '+extras[scenario.extra]+', Extra používá ukázkovou volnou desku':'');
 const button=document.createElement('button');button.type='button';button.dataset.archiveAction='review';button.textContent='Ovládání náhledu';
 bar.append(copy,button);document.body.prepend(bar);
});
document.addEventListener('proplet:ready',()=>{
 ready=true;
 if(!local.getItem('referralBaseline'))save('referralBaseline',completionIds());
 // Defaults are returning-player fixtures. Explicit announcement scenarios still
 // use the native eligibility/gating code; we never force-open a launch modal.
}, {once:true});
})();
