/* Build-time Preview adapter. It serves the real app and real public lexicon;
 * every /api request is answered locally, and no production identity is read.
 */
(()=>{
'use strict';
if(!document.documentElement.hasAttribute('data-refinements-review'))return;
const params=new URLSearchParams(location.search);
const mode=['hints','rankings','bonus'].includes(params.get('review'))?params.get('review'):'hints';
const theme=params.get('theme')==='dark'?'dark':'light';
const fixtureId='refinements-review',fixtureToken='PREVIEW-ONLY-NO-PRODUCTION-ACCOUNT';
const teamCode='refinements-typesetters';
const choices={OBRNA:{difficulty:'mozkomor',level:63},STROFA:{difficulty:'mozkomor',level:63},AORTA:{difficulty:'mozkomor',level:65},KANCL:{difficulty:'mozkomor',level:65},KATION:{difficulty:'mozkokalypsa',level:20}};
const selectedWord=Object.hasOwn(choices,String(params.get('word')||'').toUpperCase())?String(params.get('word')).toUpperCase():'OBRNA';
function memoryStorage(){
 const data=new Map();return {getItem:key=>data.has(String(key))?data.get(String(key)):null,setItem:(key,value)=>data.set(String(key),String(value)),removeItem:key=>data.delete(String(key)),clear:()=>data.clear(),key:index=>[...data.keys()][index]??null,get length(){return data.size}};
}
// Per-page memory avoids both reading an existing account and leaving test tokens
// in browser storage. Reload starts a clean, deterministic review.
const local=memoryStorage(),session=memoryStorage();
Object.defineProperty(window,'localStorage',{configurable:true,value:local});
Object.defineProperty(window,'sessionStorage',{configurable:true,value:session});
// Existing runtime uses this flag only for local review/SW isolation and nudges.
window.PROPLET_ARCHIVE_PREVIEW=true;
const save=(key,value)=>local.setItem(key,JSON.stringify(value));
const fixtureProfile={id:fixtureId,name:'Alex',avatar:'🦊',token:fixtureToken,hasPassword:true,publicRankings:true,supportMode:'none',familyCode:teamCode,leagueName:'Sazeči'};
save('proplet-v2-profile',fixtureProfile);
save('proplet-v3-settings',{theme,sound:false,haptics:false,wakeLock:false});
for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])local.setItem(key,'done');
for(const key of ['proplet-v3-32-8-rule-principle-seen','proplet:content-release:g5-r1','ax-seeded',
 'proplet:content-release:mk100-v2:account:'+fixtureId,'proplet:content-release:refresh300-v1:account:'+fixtureId,
 'proplet:announcement:archive-extra-v1:account:'+fixtureId,'proplet:referral-announcement-seen:v1:'+fixtureId,
 'proplet:daily-extra-intro:v1:account:'+fixtureId])local.setItem(key,'1');
local.setItem('proplet-v3-16-2-helper-mode','none');
session.setItem('proplet:announcements:session:v1','1');
save('proplet-v3-26-install-nudge',{done:true,installed:true});
save('proplet-v3-8-2-push-nudge',{done:true,dismissedAt:Date.now()});
save('proplet-marketing-consent-v1',{value:'denied',at:Date.now()});
save('proplet-v3-5-account-nudge',{shown:[1,2,3]});
const nativeFetch=window.fetch.bind(window),requests=[],claims=new Map();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const expiry=()=>new Date(Date.now()+86400000).toISOString();
let bankPromise=null;
const publicBank=()=>bankPromise||(bankPromise=nativeFetch('/puzzles.json',{credentials:'omit',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Review public bank unavailable');return r.json()}));
async function daily(){
 const bank=await publicBank(),source=bank.free.medium[0],puzzle=structuredClone(source),day=today();
 const serialized=JSON.stringify({rows:puzzle.rows,cols:puzzle.cols,letters:puzzle.letters,mask:puzzle.mask,answers:puzzle.answers,lengths:puzzle.lengths});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
 return {schemaVersion:1,dailyDate:day,serverToday:day,validUntil:expiry(),puzzleId:puzzle.id,puzzle,challengeKey:'daily:'+day,bankVersion:'preview-public-free-board',contentHash:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),official:true,rewardEligible:true,reviewOnly:true};
}
function players(count,period='today',dailyResults=false){
 return Array.from({length:count},(_,i)=>{
  const rank=i+1,isMine=rank===Math.min(47,count),names=['Klára','Matěj','Lenka','Jakub','Tereza','Adam','Jana','Petr'];
  return {id:isMine?fixtureId:'review-player-'+rank,name:isMine?'Alex':names[i%names.length]+' '+rank,avatar:isMine?'🦊':['🐉','🦉','🐱','🐶'][i%4],rank,isMine,
   xp:(period==='all'?180000:period==='week'?28000:4000)-i*(period==='all'?790:period==='week'?149:27),lifetimePoints:180000-i*800,
   teamName:rank%3===0?'Písmáci':rank%4===0?'Sazeči':null,elapsedMs:26000+i*4350,moves:10+i%9,hintsUsed:rank%7===0?1:0,cleanSolve:rank%7!==0};
 });
}
function teams(count,period='today'){
 return Array.from({length:count},(_,i)=>({id:i===7?teamCode:'review-team-'+i,code:i===7?teamCode:'review-team-'+i,name:i===7?'Sazeči':['Písmáci','Knihomolové','Slovolovci','Sběratelé písmen'][i%4]+' '+(i+1),rank:i+1,isMine:i===7,memberCount:3+i%8,players:2+i%5,score:98-i*1.9,xp:(period==='all'?500000:period==='week'?32000:9000)-i*(period==='all'?7200:period==='week'?613:215)}));
}
const discoveryStatus=()=>({rewardKeys:[...claims.keys()],totalDiscoveryXp:claims.size,discoveredWords:claims.size,boardXpLimit:null,dailyXpLimit:null});
const snapshot=()=>({...fixtureProfile,stats:{points:109000+claims.size,totalCompleted:216,freeCompleted:{easy:80,medium:60,hard:40,hardcore:20,mozkomor:12,mozkokalypsa:4},cleanSolves:201,currentStreak:18,longestStreak:27,discoveredWords:claims.size},completed:[],cursor:new Date().toISOString(),reviewOnly:true});
window.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href),method=String(init.method||input?.method||'GET').toUpperCase();
 if(url.origin!==location.origin){requests.push({path:url.pathname,method,blocked:true,external:true});return json({detail:'Review blocks external requests.'},403)}
 if(!url.pathname.startsWith('/api/')){
  if(!['GET','HEAD'].includes(method))return json({detail:'Review has no server writes.'},403);
  const headers=new Headers(init.headers||input?.headers||{});headers.delete('Authorization');headers.delete('Cookie');
  return nativeFetch(url.href,{...init,method,headers,credentials:'omit'});
 }
 requests.push({path:url.pathname,method,local:true});
 let body={};try{body=JSON.parse(init.body||'{}')}catch{}
 const route=url.pathname,period=url.searchParams.get('period')||'today';
 if(route==='/api/config')return json({environment:'preview',version:window.PROPLET_VERSION||'0.0.0',archiveEnabled:true,referralsEnabled:false,dailySpecialsEnabled:true,pushAvailable:false,historicalFreeWriteEnabled:false,dailyGeneration:4,points:{daily:100,easy:15,medium:25,hard:50,hardcore:100,mozkomor:150,mozkokalypsa:200},reviewOnly:true});
 if(route==='/api/daily')return json(await daily());
 if(route==='/api/daily-special')return json({schemaVersion:1,serverToday:today(),validUntil:expiry(),schedule:[],special:null,reviewOnly:true});
 if(route==='/api/tajenka')return json({detail:'No Tajenka in this focused review.'},404);
 if(route==='/api/rolling-content')return json({version:2,asOf:today(),puzzles:{},meta:{},latestBatch:null,nextRelease:null,availableFreeCounts:{},reviewOnly:true});
 if(route==='/api/play-session/config')return json({enabled:false,isolatedPreview:true,reviewOnly:true});
 if(route==='/api/free-order/config')return json({enabled:false,isolatedPreview:true,reviewOnly:true});
 if(route==='/api/rankings/daily')return json({players:players(124,'today',true),teams:teams(18),visibilityReady:true,reviewOnly:true});
 if(route==='/api/rankings/xp')return json({players:players(period==='all'?173:period==='week'?87:68,period),teams:teams(period==='all'?31:period==='week'?16:11,period),visibilityReady:true,reviewOnly:true});
 if(route==='/api/account/snapshot'||route==='/api/me')return json(snapshot());
 if(route==='/api/progress')return json({completed:[],inProgress:[],rescues:[],dailyDates:[],reviewOnly:true});
 if(route==='/api/team-victories')return json({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[],reviewOnly:true});
 if(route==='/api/team-victories/personal')return json({enabled:false,totalGold:0,history:[],reviewOnly:true});
 if(route==='/api/word-recognition')return json({word:url.searchParams.get('word'),recognized:false,source:'review-no-remote-fallback',reviewOnly:true});
 if(route==='/api/word-discovery/status')return json(discoveryStatus());
 if(route==='/api/word-discovery/claim'){
  const key=String(body.reward_key||body.rewardKey||'word_discovery_v1:'+String(body.puzzle_id||'').trim()+':'+String(body.word||'').normalize('NFC').trim().toLocaleLowerCase('cs-CZ')),isNew=!claims.has(key);if(isNew)claims.set(key,{...body});
  return json({...discoveryStatus(),ok:true,newlyGranted:isNew,awardedPoints:isNew?1:0,limitReason:null,reviewOnly:true});
 }
 if(route==='/api/result')return json({ok:true,firstCompletion:true,awardedPoints:0,transferredSlot:false,dailyGenerationUpgrade:false,stats:snapshot().stats,statsWarning:null,reviewOnly:true});
 if(route==='/api/push/config')return json({available:false,enabled:false,reviewOnly:true});
 if(route.startsWith('/api/offline')||route==='/api/archive/offline')return json({detail:'Offline preparation disabled in review.'},503);
 if(route.includes('rescue'))return json({state:'unavailable',reviewOnly:true});
 if(route==='/api/referrals')return json({enabled:false,incoming:null,referrals:[],referralCount:0,reviewOnly:true});
 return json({ok:true,enabled:false,available:false,rows:[],players:[],teams:[],items:[],events:[],completed:[],records:{},accepted:[],reviewOnly:true});
};
try{navigator.sendBeacon=()=>false}catch{}
if(window.XMLHttpRequest){
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send,setHeader=XMLHttpRequest.prototype.setRequestHeader,denied=new WeakSet();
 XMLHttpRequest.prototype.open=function(method,url,...args){const target=new URL(String(url),location.href);if(target.origin!==location.origin||target.pathname.startsWith('/api/')||!['GET','HEAD'].includes(String(method).toUpperCase()))denied.add(this);else denied.delete(this);return open.call(this,method,url,...args)};
 XMLHttpRequest.prototype.setRequestHeader=function(name,value){if(['authorization','cookie'].includes(String(name).toLowerCase()))return;return setHeader.call(this,name,value)};
 XMLHttpRequest.prototype.send=function(...args){if(denied.has(this))throw new DOMException('Review blocks API and external XHR','SecurityError');return send.apply(this,args)};
}
function pathFor(puzzle,word){
 const mask=new Set(puzzle.mask),letters=puzzle.letters,cols=puzzle.cols;
 function walk(path){if(path.length===word.length)return path;const previous=path[path.length-1];for(const next of [previous-cols,previous+cols,previous-1,previous+1]){if(!mask.has(next)||path.includes(next)||letters[next]!==word[path.length]||Math.abs(Math.floor(previous/cols)-Math.floor(next/cols))+Math.abs(previous%cols-next%cols)!==1)continue;const found=walk([...path,next]);if(found)return found}return null}
 for(const cell of puzzle.mask)if(letters[cell]===word[0]){const found=walk([cell]);if(found)return found}return null;
}
async function openBoard(word=selectedWord){
 const spec=choices[word];if(!spec)throw Error('Unknown review word');
 const bank=await publicBank(),puzzle=bank.free[spec.difficulty].find(row=>Number(row.meta?.level)===spec.level);
 if(!puzzle)throw Error('Public review board missing: '+word);
 if(!pathFor(puzzle,word))throw Error('Review word has no path: '+word);
 await startGame(structuredClone(puzzle),'free');
 // Legacy decorators do not preserve startGame's promise. Wait for the actual
 // playable game/DOM rather than treating an early wrapper return as readiness.
 for(let i=0;i<100&&(typeof currentGame==='undefined'||currentGame?.puzzle?.id!==puzzle.id||currentScreen!=='game'||!document.querySelector('#board .cell'));i++)await new Promise(resolve=>setTimeout(resolve,30));
 if(typeof currentGame==='undefined'||currentGame?.puzzle?.id!==puzzle.id||currentScreen!=='game'||!document.querySelector('#board .cell'))throw Error('Native review board did not start');
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return puzzle;
}
async function tryWord(word=selectedWord){
 const puzzle=await openBoard(word),path=pathFor(puzzle,word);
 // The real submit wrapper performs path validation, shared lexicon recognition
 // and the regular discovery flow. The local receipt grants no production XP.
 for(let i=0;i<100&&typeof submitPath==='function'&&!submitPath.__validWordFailsafe3330;i++)await new Promise(resolve=>setTimeout(resolve,30));
 if(!submitPath.__validWordFailsafe3330)throw Error('Native bonus recognizer did not install');
 currentGame.path=path;updateActive();submitPath();return {word,puzzleId:puzzle.id,path};
}
const review={mode,theme,selectedWord,choices,requests,claims,ready:false,error:null,openBoard,tryWord,pathFor};
window.PropletRefinementsReview=review;
document.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.textContent='#refinementsReviewNotice{padding:9px 14px;border:1px dashed var(--td-muted,#6e675b);border-radius:12px;margin:8px 14px;font:13px/1.4 system-ui;background:var(--td-paper,#f7f2e8);color:var(--td-ink,#332d28)}#refinementsReviewNotice a{color:inherit;text-underline-offset:3px;margin-left:8px}body.playing #refinementsReviewNotice{display:none}';document.head.append(style);
 const note=document.createElement('aside');note.id='refinementsReviewNotice';note.setAttribute('aria-label','Ovládání testovacího náhledu');
 const label=document.createElement('strong');label.textContent='Ukázková data · skutečný Proplet';note.append(label);
 for(const [key,title] of [['hints','Nápovědy'],['rankings','Pořadí'],['bonus','Bonusová slova']]){const a=document.createElement('a');a.href='?review='+key+'&theme='+theme;a.textContent=title;note.append(a)}
 const otherTheme=document.createElement('a');otherTheme.href='?review='+mode+'&theme='+(theme==='dark'?'light':'dark')+(mode==='bonus'?'&word='+selectedWord:'');otherTheme.textContent=theme==='dark'?'Světlý vzhled':'Tmavý vzhled';note.append(otherTheme);
 document.querySelector('.app-shell').before(note);
});
document.addEventListener('proplet:ready',async()=>{
 try{
  if(mode==='rankings')nav('leaderboard');
  else if(mode==='hints'){await openBoard();const opener=document.querySelector('#hintBtn');opener.focus({preventScroll:true});opener.click();if(document.querySelector('#hintModal').classList.contains('hidden'))throw Error('Native hint chooser did not open')}
  else await tryWord();
  review.ready=true;
 }catch(error){review.error=error.message;console.error(error)}
},{once:true});
})();
