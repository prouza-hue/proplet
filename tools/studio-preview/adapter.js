/* Studio Edition isolated fixture adapter derived from the approved archive-review API contracts. All API responses are local, public free boards model Daily/Extra. Never load into production. */
(() => {
'use strict';
if(!window.PROPLET_STUDIO_PREVIEW)throw Error('Studio guard must load first');
window.PROPLET_ARCHIVE_PREVIEW = true;
const nativeStorage = window.localStorage;
const nativeSession = window.sessionStorage;
const settingsKey='proplet:studio-review:20261021:settings';
const extras = {hardcore:'2026-10-21',mozkomor:'2026-10-21',mozkokalypsa:'2026-10-21'};
const referralStates = new Set(['member','incoming','paid','guest']);
const referralAliases = {invite:'member',progress:'incoming',earned:'paid'};
let stored = {};
try { stored = JSON.parse(nativeStorage.getItem(settingsKey) || '{}'); } catch {}
const reviewParams = new URLSearchParams(location.search);
const linkedExtra=reviewParams.get('reviewExtra'),linkedReferral=reviewParams.get('reviewReferral');
if(['live',...Object.keys(extras)].includes(linkedExtra))stored.extra=linkedExtra;
if(referralStates.has(linkedReferral))stored.referral=linkedReferral;
const scenario = {
 extra: reviewParams.get('extra')==='none'?'live':extras[reviewParams.get('extra')]?reviewParams.get('extra'):'hardcore',
 referral: reviewParams.get('account')==='guest'?'guest':reviewParams.get('account')==='incoming'?'incoming':'member',
 announcement:'none'
};
const patronInfoPreview=reviewParams.get('patronInfo')==='1',patronRankingsPreview=reviewParams.get('patronRankings')==='1';
const fixtureState=['ready','done','complete'].includes(reviewParams.get('state'))?reviewParams.get('state'):patronInfoPreview?'done':'ready';
const prefix = 'proplet:studio-review:20261021:v2:' + scenario.extra + ':' + scenario.referral + ':' + fixtureState + (patronRankingsPreview?':patron-rankings:':':');
// Keep native Storage identity. WindowProxy property replacement is not reliable
// across all embedded-browser realms; app controllers must see these same methods.
const storagePrototype=Storage.prototype;
const nativeMethods=Object.fromEntries(['getItem','setItem','removeItem','clear','key'].map(name=>[name,storagePrototype[name]]));
const nativeLength=Object.getOwnPropertyDescriptor(storagePrototype,'length').get;
const owned=storage=>storage===nativeStorage||storage===nativeSession;
const scopedKeys=storage=>Array.from({length:nativeLength.call(storage)},(_,index)=>nativeMethods.key.call(storage,index)).filter(key=>key?.startsWith(prefix));
Object.defineProperties(storagePrototype,{
 getItem:{configurable:true,writable:true,value:function(key){return nativeMethods.getItem.call(this,owned(this)?prefix+String(key):key)}},
 setItem:{configurable:true,writable:true,value:function(key,value){return nativeMethods.setItem.call(this,owned(this)?prefix+String(key):key,String(value))}},
 removeItem:{configurable:true,writable:true,value:function(key){return nativeMethods.removeItem.call(this,owned(this)?prefix+String(key):key)}},
 clear:{configurable:true,writable:true,value:function(){if(!owned(this))return nativeMethods.clear.call(this);for(const key of scopedKeys(this))nativeMethods.removeItem.call(this,key)}},
 key:{configurable:true,writable:true,value:function(index){return owned(this)?scopedKeys(this)[index]?.slice(prefix.length)??null:nativeMethods.key.call(this,index)}},
 length:{configurable:true,get:function(){return owned(this)?scopedKeys(this).length:nativeLength.call(this)}}
});
const local=nativeStorage,session=nativeSession;
// This harness controls its own scenarios; do not inherit Archive's older demo progress.
local.setItem('ax-seeded','1');
session.setItem('proplet:announcements:session:v1','1');
// An explicit invitation review link opens the visible offer; native dismissal
// remains intact for normal navigation and all production sessions.
if(linkedReferral==='member')session.removeItem('proplet:referral-offer-hidden:v1:archive-review');
const read=(key,fallback)=>{try{return JSON.parse(local.getItem(key)||'null')??fallback;}catch{return fallback;}};
const save=(key,value)=>local.setItem(key,JSON.stringify(value));
const profileId='studio-review', token='REVIEW-ONLY-NOT-A-PRODUCTION-TOKEN';
const fixtureProfile={id:profileId,name:patronRankingsPreview?'Pavel':'Ukázkový hráč',avatar:'🦊',token,hasPassword:true,supportMode:'none',
 familyCode:null,leagueName:null,googleLinked:false,useGoogleAvatar:false,publicRankings:true};
if (!local.getItem('initialized')) {
 local.setItem('initialized','1');
 local.setItem('proplet-v3-7-required-onboarding','done');
 local.setItem('proplet-v3-16-2-helper-onboarding','done');
 save('proplet-v3-settings',{theme:reviewParams.get('theme')==='dark'?'dark':'light',sound:false,haptics:false,wakeLock:false});
 local.setItem('proplet:content-release:refresh300-v1','1');
 local.setItem('proplet:content-release:mk100-v2','1');
 if (scenario.referral!=='guest') save('proplet-v2-profile',fixtureProfile);
}
// Returning-player preferences use the same fields and receipts as the release
// browser fixture. Backfill existing review storage without resetting game state.
const existingProfile=read('proplet-v2-profile',null);
if(existingProfile?.id===profileId&&existingProfile.publicRankings==null)
 save('proplet-v2-profile',{...existingProfile,publicRankings:true});
for(const key of ['proplet-v3-32-8-rule-principle-seen','proplet:content-release:g5-r1',
 'proplet:content-release:mk100-v2:account:'+profileId,
 'proplet:content-release:refresh300-v1:account:'+profileId])local.setItem(key,'1');
local.setItem('proplet-v3-16-2-helper-mode','none');
save('proplet-v3-26-install-nudge',{done:true,installed:true});
save('proplet-v3-8-2-push-nudge',{done:true,dismissedAt:Date.now()});
save('proplet-marketing-consent-v1',{value:'denied',at:Date.now()});
if(scenario.announcement!=='referral')local.setItem('proplet:referral-announcement-seen:v1:'+profileId,'1');
else local.removeItem('proplet:referral-announcement-seen:v1:'+profileId);
const extraReceipt='proplet:daily-extra-intro:v1:account:'+profileId;
if(scenario.announcement!=='extra')local.setItem(extraReceipt,'1');else local.removeItem(extraReceipt);
// Guest mode has no invitation or real account.
local.setItem('proplet:archive-release-seen:v1:'+profileId,'1');
const selectedTheme=reviewParams.get('theme');if(['light','dark'].includes(selectedTheme))save('proplet-v3-settings',{...read('proplet-v3-settings',{}),theme:selectedTheme});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const net=window.fetch.bind(window);
const requests=window.PROPLET_REVIEW_REQUESTS=[];
const liveDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const today=()=> '2026-10-21';
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
let archiveBankPromise=null;
async function archiveBank(){
 if(!archiveBankPromise)archiveBankPromise=fetchPublished('/app/archive/boards.json').then(r=>{if(!r.ok)throw Error('review-archive-unavailable');return r.json();});
 return archiveBankPromise;
}
const archiveRevision=bank=>bank.boards[0].solutions.solutionPolicyRevision;
function archiveLedger(){
 const key='review-archive-server:'+(profile()?.id||'guest');
 let ledger=read(key,null);
 if(!ledger){
  const claims={};
  // Model historical G1/G2 claims independently of which G3 board was played.
  if(profile()?.id)for(const [difficulty,points] of Object.entries({easy:15,medium:25,hard:50,hardcore:100}))for(let level=1;level<=14;level++)claims['legacy-free:'+difficulty+':'+level]={sourcePuzzleId:'historical-example-'+difficulty+'-'+level,points};
  ledger={claims,completedPuzzleIds:[],receipts:{}};save(key,ledger);
 }
 return {key,ledger};
}
async function archiveResult(body){
 if(!profile()?.id||!profile()?.token)return json({detail:'Přihlas se pro uložení odměny.'},401);
 const bank=await archiveBank(),entry=bank.boards.find(row=>row.puzzle.id===body.puzzle_id);
 if(!entry||body.archive_solution?.editionId!==bank.editionId||body.archive_solution?.solutionPolicyRevision!==archiveRevision(bank))return json({detail:'Neplatné archivní řešení.'},400);
 const status=window.PropletArchiveSolutions.create(entry.puzzle,entry.solutions).evaluate({...body.archive_solution,revealed:[]});
 if(!status.ok||!status.completed)return json({detail:'Archiv potřebuje úplné schválené řešení.'},400);
 const {key,ledger}=archiveLedger(),receiptId=body.attempt_id||body.challenge_key+':'+body.completed_at;
 if(ledger.receipts[receiptId])return json(ledger.receipts[receiptId]);
 const firstCompletion=!ledger.completedPuzzleIds.includes(entry.puzzle.id),alreadyClaimed=!!ledger.claims[entry.rewardSlotKey];
 const awardedPoints=alreadyClaimed?0:entry.rewardXp;
 ledger.claims[entry.rewardSlotKey]||={sourcePuzzleId:entry.puzzle.id,points:awardedPoints};
 if(firstCompletion)ledger.completedPuzzleIds.push(entry.puzzle.id);
 const receipt={ok:true,firstCompletion,awardedPoints,dailyGenerationUpgrade:false,transferredSlot:alreadyClaimed,wordDiscoveryXp:0,reviewOnly:true};
 ledger.receipts[receiptId]=receipt;save(key,ledger);return json(receipt);
}
async function digest(puzzle){
 const text=JSON.stringify({rows:puzzle.rows,cols:puzzle.cols,letters:puzzle.letters,mask:puzzle.mask,answers:puzzle.answers,lengths:puzzle.lengths});
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
async function modelPuzzle(kind){
 // Public free boards avoid revealing or relocating any real dated Extra board.
 const difficulty=kind==='special'?scenario.extra:'medium';
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
 if(scenario.extra==='live')return {...clock,special:null};
 const puzzle=await modelPuzzle('special');
 return {...clock,special:{schemaVersion:1,mode:'daily_special',challengeKind:'special',
  serverToday:today(),dailyDate:today(),validUntil:clock.validUntil,difficulty:scenario.extra,
  challengeKey:'daily-special:'+today()+':'+scenario.extra,puzzleId:puzzle.id,puzzle,
  bankVersion:'review-public-free-v1',contentHash:await digest(puzzle),official:true,rewardEligible:true,reviewOnly:true}};
}

function sessionCommand(body){
 const key='studio-sessions',sessions=read(key,{}),id=String(body.attempt_id||'');
 if(!id||!['open','pulse','pause','finish'].includes(body.action))return json({detail:'Neplatná ukázková session.'},400);
 const saved=sessions[id]||{attempt_id:id,challenge_key:body.challenge_key,puzzle_id:body.puzzle_id,finished:false};
 if(saved.challenge_key!==body.challenge_key||saved.puzzle_id!==body.puzzle_id)return json({detail:'Ukázkový pokus neodpovídá desce.'},409);
 saved.progress=body.progress||saved.progress||{};saved.elapsed_ms=Number(saved.progress.elapsedMs)||0;
 if(body.action==='finish'){
  if(reviewParams.get('receipt')==='missing')return json({finished:false,verified:false,reviewOnly:true});
  saved.finished=true;
 }
 sessions[id]=saved;save(key,sessions);return json({...saved,verified:false,reviewOnly:true});
}
async function seedState(){
 if(fixtureState==='ready'||local.getItem('studio-state-seeded'))return;
 const descriptors=[await modelDaily()];if(fixtureState==='complete'&&scenario.extra!=='live')descriptors.push((await specialResponse()).special);
 const value=getState();value.completed||={};value.inProgress||={};
 for(const descriptor of descriptors){
  const special=descriptor.mode==='daily_special',mode=special?'daily_special':'daily';
  value.completed[descriptor.challengeKey]={puzzleId:descriptor.puzzleId,challengeKey:descriptor.challengeKey,mode,difficulty:descriptor.puzzle.difficulty,dailyDate:today(),elapsedMs:94000,moves:descriptor.puzzle.answers.length,points:special?200:100,hintsUsed:0,wrongAttempts:0,maxHintLevel:0,attemptId:'studio-seeded-'+mode,completedAt:today()+'T10:00:00Z',cleanSolve:true,timingUnverified:true,contentHash:descriptor.contentHash,official:true,rewardEligible:true};
 }
 saveState(value);local.setItem('studio-state-seeded','1');renderDaily();renderFree();renderProfile();
}

let ready=false;
function completionIds(){
 const rows=Object.values(state().completed||{}).filter(r=>['free','daily','daily_special','tajenka'].includes(r.mode)
  &&r.rewardEligible!==false&&r.official!==false);
 try{if(typeof tajenkaState==='function')rows.push(...Object.values(tajenkaState().completions||{}));}catch{}
 return [...new Set(rows.map(r=>r.puzzleId).filter(Boolean))];
}
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

function freeOrderReview(method,body){
 const key='review-free-order-server:'+(profile()?.id||'guest');
 const ledger=read(key,{records:{},requests:{}});
 ledger.records??={};ledger.requests??={};
 if(method==='GET')return {enabled:true,records:ledger.records,resumeIds:{},reviewOnly:true};
 if(!['easy','medium','hard','hardcore'].includes(body.difficulty)
  ||!['numeric','varied'].includes(body.mode)||!Number.isInteger(body.expected_revision)||body.expected_revision<0
  ||typeof body.request_id!=='string'||!Array.isArray(body.ids)
  ||body.ids.some(id=>typeof id!=='string')||new Set(body.ids).size!==body.ids.length)
  return {reviewError:'Neplatná testovací volba pořadí'};
 if(ledger.requests[body.request_id])return ledger.requests[body.request_id];
 const current=ledger.records[body.difficulty]||{difficulty:body.difficulty,mode:'varied',revision:0,
  offered:true,newcomer:false,plan:{version:'pestre-v1',difficulty:body.difficulty,kind:'varied',ids:[]}};
 const conflict=body.expected_revision!==current.revision;
 const record=conflict?current:{difficulty:body.difficulty,mode:body.mode,revision:current.revision+1,
  offered:true,newcomer:body.newcomer===true,
  plan:{version:'pestre-v1',difficulty:body.difficulty,kind:'varied',ids:[...body.ids]}};
 const response={enabled:true,record,conflict,reviewOnly:true};
 if(!conflict)ledger.records[body.difficulty]=record;
 ledger.requests[body.request_id]=response;
 // Bound only the fixture command receipts; actual choices survive reloads.
 const keys=Object.keys(ledger.requests);
 for(const old of keys.slice(0,Math.max(0,keys.length-80)))delete ledger.requests[old];
 save(key,ledger);
 return response;
}

function boardRanking(url){
 const mine=profile()?.id||profileId;
 const key=url.searchParams.get('challenge_key')||(url.searchParams.get('puzzle_id')?'free:'+url.searchParams.get('puzzle_id'):'daily:'+(url.searchParams.get('daily_date')||today()));
 const record=state().completed[key],elapsed=Number(record?.elapsedMs)||65000;
 // Reflect the same synthetic first result shown by the native recap; never
 // use an unrelated hard-coded own time to exercise duplicate presentation.
 const rows=[{id:'review-klara',name:patronInfoPreview?'Ukázkový Pavel':'Klára',avatar:patronInfoPreview?'🦊':'🌺',patron:patronInfoPreview,rank:1,elapsedMs:Math.max(1000,elapsed-20000),moves:8,hintsUsed:0,cleanSolve:true},
  {id:mine,isMine:!!profile()?.id,name:profile()?.name||'Alex',avatar:profile()?.avatar||'🦊',rank:2,elapsedMs:elapsed,moves:record?.moves??9,hintsUsed:record?.hintsUsed??0,cleanSolve:record?.cleanSolve??true,attemptId:record?.attemptId},
  {id:'review-matej',name:'Matěj',avatar:'🐉',rank:3,elapsedMs:elapsed+30000,moves:10,hintsUsed:0,cleanSolve:true}];
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
 if(path==='/api/patrons'&&method==='GET')return json({enabled:patronInfoPreview||patronRankingsPreview,authenticated:!!profile()?.token,patron:(patronInfoPreview||patronRankingsPreview)&&reviewParams.get('patronOwn')!=='none',publicBadge:reviewParams.get('patronOwn')==='public'||patronRankingsPreview&&reviewParams.get('patronOwn')!=='private',offersDisabled:true,canOffer:false,thanksPending:false,contributions:[],reviewOnly:true});
 if(path.startsWith('/api/patrons/'))return json({detail:'Náhled podpory neprovádí platby ani zápisy.',reviewOnly:true},409);
 if(method==='GET'&&path==='/api/competition/monthly')return json(window.PropletMonthlyV2Fixture.response(reviewParams.get('monthlyCase')));
 if(method==='GET'&&path==='/api/config'){
  let config={"badges":[{"days":1,"icon":"🥉","name":"První zářez"},{"days":3,"icon":"❤️","name":"Srdcař"},{"days":5,"icon":"⭐","name":"Pětka"},{"days":7,"icon":"🔥","name":"Týden v plamenech"},{"days":10,"icon":"🏆","name":"Desítka"},{"days":14,"icon":"⚡","name":"Blesk"},{"days":21,"icon":"🦉","name":"Mistr slov"},{"days":30,"icon":"👑","name":"Koruna"},{"days":50,"icon":"💎","name":"Diamant"},{"days":100,"icon":"🚀","name":"Legenda"}],"points":{"daily":100,"easy":15,"medium":25,"hard":50,"hardcore":100,"mozkomor":150,"starter":10,"mozkokalypsa":200},"dictionarySize":13939,"dailyRotationSize":365,"dailyGeneration":4,"dailyGeneration3From":"2026-08-17","dailyCadence":{"weekdays":["easy","easy","medium","medium","medium","hard","hard"],"counts":{"easy":105,"medium":156,"hard":104}},"rescueBankSize":30,"pushAvailable":false,"environment":"preview","version":"4.09.12","historicalFreeWriteEnabled":false,"referralsEnabled":true,"dailySpecialsEnabled":true};

  return json({...config,environment:'preview',version:window.PROPLET_RUNTIME_META?.version||'4.09.12',archiveEnabled:true,historicalFreeWriteEnabled:true,pushAvailable:false,reviewOnly:true});
 }
 if(method==='GET'&&path==='/api/archive'){
  const bank=await archiveBank();
  return json({editionId:bank.editionId,solutionPolicyRevision:archiveRevision(bank),completeCovers:bank.completeCovers,
   boards:bank.boards.map(({puzzle,level,difficulty,rewardXp,rewardSlotKey})=>({puzzleId:puzzle.id,level,difficulty:difficulty||puzzle.difficulty,rewardXp,rewardSlotKey}))});
 }
 if(method==='GET'&&path==='/api/archive/puzzle'){
  const bank=await archiveBank(),entry=bank.boards.find(row=>row.puzzle.id===url.searchParams.get('puzzle_id'));
  return entry?json({editionId:bank.editionId,...entry,difficulty:entry.difficulty||entry.puzzle.difficulty}):json({detail:'Neznámá archivní deska'},404);
 }
 if(method==='GET'&&path==='/api/archive/claims'){
  if(!profile()?.token)return json({detail:'Přihlas se pro načtení odměn.'},401);
  const bank=await archiveBank(),{ledger}=archiveLedger();return json({editionId:bank.editionId,claims:ledger.claims,completedPuzzleIds:ledger.completedPuzzleIds});
 }
 if(method==='GET'&&path==='/api/daily')return json(await modelDaily());
 if(method==='GET'&&path==='/api/daily-special')return json(await specialResponse());
 if(method==='GET'&&path==='/api/tajenka'){
  const puzzle=await fetchPublished('/studio-fixtures/tajenka.json').then(r=>r.json());
  const week=typeof activeTajenkaWeek==='number'?activeTajenkaWeek:14;
  return json({...puzzle,week,id:'tajenka-v2-week-'+String(week).padStart(2,'0')});
 }
 if(method==='GET'&&path==='/api/rolling-content')return json({version:2,asOf:today(),puzzles:{},latestBatch:null,nextRelease:null,availableFreeCounts:{},reviewOnly:true});
 if(path==='/api/referrals'&&method==='GET')return json(referralStatus());
 if(path==='/api/referrals/invite'&&method==='POST')return json({...ownInvite(),rewardXp:1000,requiredBoards:5,reviewOnly:true});
 if(path.startsWith('/api/referrals/invite/')&&method==='GET')return json({enabled:true,inviter:{name:'Katka',avatar:'🦊'},reviewOnly:true});
 if(path==='/api/referrals/dismiss'&&method==='POST'){local.setItem('referralDismissed','1');return json({ok:true,reviewOnly:true});}
 if(method==='GET'&&['/api/account/snapshot','/api/me'].includes(path))return json(snapshot());
 if(path==='/api/rankings/visibility'&&method==='POST'){
  const enabled=body.enabled===true,storedProfile=profile();
  if(storedProfile)save('proplet-v2-profile',{...storedProfile,publicRankings:enabled});
  return json({publicRankings:enabled,reviewOnly:true});
 }
 if(path==='/api/team-victories')return json({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[],reviewOnly:true});
 if(method==='GET'&&path==='/api/progress')return json({completed:[],rescues:[],inProgress:[],dailyDates:[],reviewOnly:true});
 if(path==='/api/free-order/config')return json({enabled:true,isolatedPreview:true,reviewOnly:true});
 if(path==='/api/free-order'&&['GET','POST'].includes(method)){
  const result=freeOrderReview(method,body);
  return result.reviewError?json({detail:result.reviewError,reviewOnly:true},400):json(result);
 }
 if(path==='/api/play-session/config')return json({enabled:true,isolatedPreview:true,heartbeatMs:25000,reviewOnly:true});
 if(path==='/api/play-session'&&method==='POST')return sessionCommand(body);
 if(path==='/api/rescue/status'||path==='/api/rescue-status')return json({state:'unavailable',reviewOnly:true});
 if(method==='GET'&&(path.includes('global-leaderboard')||path==='/api/rankings/daily-special'))return json(boardRanking(url));
 if(patronRankingsPreview&&method==='GET'&&['/api/rankings/xp','/api/rankings/daily'].includes(path)){
  const players=Array.from({length:24},(_,i)=>({id:i===20?profileId:'patron-ranking-'+i,name:i===20?'Pavel':i===0?'Ukázková podporovatelka':'Ukázkový hráč '+(i+1),avatar:i===20?'🦌':'🦊',patron:i===0||i===20,isMine:i===20,rank:i+1,xp:100000-i*2200,lifetimePoints:80000,teamName:'Propletové – Řeporyje',moves:11,hintsUsed:0,cleanSolve:true,elapsedMs:65000+i*1500}));
  return json({players,teams:[],visibilityReady:true,period:url.searchParams.get('period')||'week',reviewOnly:true});
 }
 if(method==='GET'&&(path.includes('rankings')||path.includes('leaderboard')))return json({
  players:[{id:'review-1',name:'Lukáš',avatar:'🦊',xp:32400,rank:1},{id:'review-2',name:'Klára',avatar:'🌺',xp:29600,rank:2},{id:profileId,name:'Alex',avatar:'🦊',xp:stats().points,rank:3}],
  teams:[{id:'review-team',code:'review-team',name:'Sazeči',xp:4820,rank:1}],rows:[],period:url.searchParams.get('period')||'all',reviewOnly:true});
 if(['POST','PUT','PATCH','DELETE'].includes(method)){
  if(path==='/api/player')return json({detail:'Použij přepínač Ukázkový hráč v ovládání náhledu.'},409);
  if(path==='/api/auth/google/complete')return json({detail:'Skutečné přihlášení v náhledu není dostupné.'},409);
  if(path==='/api/result')return body.archive_solution?archiveResult(body):json({ok:true,accepted:true,firstCompletion:true,awardedPoints:0,wordDiscoveryXp:0,reviewOnly:true});
  if(path==='/api/support-report'||path==='/api/account'||path==='/api/login-integrity'||path==='/api/password')return json({detail:'Tato akce je dostupná pouze v ostrém Propletu; náhled nic neodesílá.'},409);
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
 // Extra's model date must not move the publication slot of real Tajenka content.
 contentDate:today,
 getScenario:()=>({...scenario,modelDate:extras[scenario.extra]||null,version:window.PROPLET_RUNTIME_META?.version||'4.09.12',scope:prefix}),
 setScenario(next={}){
  const change=next.reset?{extra:'live',referral:'member',announcement:'none'}:{...scenario,...next};
  change.referral=referralAliases[change.referral]||change.referral;
  delete change.reset;
  if(!['live',...Object.keys(extras)].includes(change.extra)||!referralStates.has(change.referral)
    ||!['none','extra','referral'].includes(change.announcement))throw Error('Unknown review scenario');
  nativeStorage.setItem(settingsKey,JSON.stringify(change));
  const destination=new URL(location.href);destination.searchParams.set('review','daily');
  destination.searchParams.delete('reviewExtra');destination.searchParams.delete('reviewReferral');
  if(destination.href===location.href)location.reload();else location.replace(destination.href);
 },
 requests,
 reset(){local.clear();session.clear();location.reload();}
};
window.PropletArchiveReview=api;
function diagnostics(){
 let actualProfile=null,actualTheme=null,completed=null;
 try{actualProfile=typeof getProfile==='function'?getProfile()?.id||'guest':read('proplet-v2-profile',null)?.id||'guest'}catch{}
 try{actualTheme=document.documentElement.dataset?.theme||null;completed=Object.keys(state().completed||{}).length}catch{}
 return {scope:prefix,storageMode:'native-prototype-v2',requestedTheme:new URLSearchParams(location.search).get('theme')||'light',storedTheme:read('proplet-v3-settings',{}).theme||null,actualTheme,expectedAccount:scenario.referral==='guest'?'guest':profileId,actualAccount:actualProfile,completed,storageBinding:localStorage===nativeStorage,archiveSeedBlocked:localStorage.getItem('ax-seeded')==='1'};
}
window.PropletStudioFixture={...api,fixtureState,day:today,seedState,diagnostics};

document.addEventListener('proplet:ready',()=>{
 ready=true;
 seedState().then(async()=>{if(patronRankingsPreview){await rankingsOrchestration().openView(reviewParams.get('rankingView')==='daily'?'daily':'xp');if(reviewParams.get('rankingView')!=='daily')document.querySelector('[data-ranking-period=week]')?.click();return;}if(patronInfoPreview)return showDailyResult(today(),getState().completed['daily:'+today()]);}).catch(error=>{console.error('Studio state seed failed',error);window.PROPLET_STUDIO_SEED_ERROR=error.message});
 if(!local.getItem('referralBaseline'))save('referralBaseline',completionIds());
 // Defaults are returning-player fixtures. Explicit announcement scenarios still
 // use the native eligibility/gating code; we never force-open a launch modal.
}, {once:true});
})();
