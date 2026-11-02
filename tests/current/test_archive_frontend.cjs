/* Archive reward boundary: real runtime module with isolated storage/API adapters. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'public/app/archive/boards.json'),'utf8'));
const entry=fixture.boards.find(row=>row.puzzle.id==='g3-e-009');
const editionId=fixture.editionId,solutionPolicyRevision=entry.solutions.solutionPolicyRevision;
const ownerA={id:'alice',token:'token-a'},ownerB={id:'bob',token:'token-b'};
let catalogueCovers=fixture.completeCovers;
let profile=ownerA,serverClaims={},claimLoad=null,claimsFail=false,xpDisplay=null,config={archiveEnabled:false};
const states=new Map(),storage=new Map(),calls=[];
function state(scope=profile?.id||'guest'){if(!states.has(scope))states.set(scope,{completed:{},inProgress:{}});return structuredClone(states.get(scope));}
const context={console,structuredClone,Set,Map,URLSearchParams,location:{search:''},currentGame:null,currentScreen:'daily',
 document:{querySelector:()=>null,querySelectorAll:()=>[]},window:null,
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
 getProfile:()=>profile,playerScope:()=>profile?.id||'guest',getState:state,
 saveState:(value,scope=profile?.id||'guest')=>states.set(scope,structuredClone(value)),
 accountProfileMatches:owner=>!!owner?.id&&owner.id===profile?.id&&owner.token===profile?.token,
 setWinXpDisplay:(text,detail)=>{xpDisplay={text,detail};},
 samePath:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
 startGame:async puzzle=>{context.currentGame={puzzle,found:[],archiveHints:[],archiveScope:profile?.id||'guest'};},
 api:async (url,options={})=>{
  calls.push({url,owner:options.authProfile?.id});
  if(url==='/api/config')return config;
  if(url==='/api/archive')return {editionId,solutionPolicyRevision,completeCovers:catalogueCovers,boards:fixture.boards.map(row=>({puzzleId:row.puzzle.id,level:row.level,difficulty:row.puzzle.difficulty,rewardXp:row.rewardXp,rewardSlotKey:row.rewardSlotKey}))};
  if(url.startsWith('/api/archive/puzzle?'))return {editionId,...structuredClone(entry),difficulty:entry.puzzle.difficulty};
  if(url==='/api/archive/claims'){if(claimLoad)return claimLoad;if(claimsFail)throw Error('offline');return {editionId,claims:serverClaims,completedPuzzleIds:[]};}
  throw Error('Unexpected API '+url);
 }
};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive/solution-contract.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive/experience.js'),'utf8'),context);
const archive=context.PropletArchiveExperience;
function configurationHarness({responses=[],online=true,cached=null}={}){
 const elements=new Map(),events=new Map();let requests=0,sessionHooks=0,completionHooks=0,reveals=0;
 const on=(name,fn)=>events.set(name,[...(events.get(name)||[]),fn]);
 const add=element=>{if(element.id)elements.set('#'+element.id,element)};
 const element=()=>({dataset:{},classList:{add(){},remove(){},contains(){return false}},setAttribute(){},append:add,after:add,innerHTML:''});
 const free=element();free.id='screen-free';add(free);
 const c={console,structuredClone,Set,Map,URLSearchParams,location:{search:''},currentScreen:'daily',currentGame:null,
  navigator:{onLine:online},ROUTE_SCREENS:new Set(),DIFF:Object.fromEntries(['easy','medium','hard','hardcore'].map(key=>[key,{label:key}])),
  document:{documentElement:{dataset:{}},body:{classList:{add(){}},append:add},querySelector:selector=>elements.get(selector)||null,querySelectorAll:()=>[],createElement:element,addEventListener:on},
  localStorage:{getItem:()=>null,setItem(){}},getProfile:()=>null,playerScope:()=> 'guest',getState:()=>({completed:{},inProgress:{}}),
  registerGameSessionHook(){sessionHooks++},registerGameCompletionHook(){completionHooks++},addEventListener:on,
  PropletOffline:{getPublicConfig:async()=>cached},__PROPLET_REVEAL_CURRENT_UI(){reveals++},
  api:async url=>{assert.equal(url,'/api/config');requests++;const response=responses.shift();if(response instanceof Error)throw response;return response},
 };
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive/experience.js'),'utf8'),c);
 return {context:c,archive:c.PropletArchiveExperience,emit:async name=>{await Promise.all((events.get(name)||[]).map(fn=>fn()))},counts:()=>({requests,sessionHooks,completionHooks,reveals})};
}
async function configurationRecoveryChecks(){
 // Boot starts configure before install. They share the same cold request; a
 // timeout must not permanently memoize null and prevent the ready-time retry.
 const cold=configurationHarness({responses:[Error('cold timeout'),{archiveEnabled:true}]});
 const first=cold.archive.configure(),mount=cold.archive.install();
 assert.equal(await first,null);assert.equal(await mount,false);assert.equal(cold.counts().requests,1);
 await cold.emit('online');assert.equal(cold.counts().requests,1,'recovery waits for the ready boundary');
 await cold.emit('proplet:ready');assert.equal(cold.archive.isEnabled(),true);assert.equal(cold.context.document.documentElement.dataset.archiveReady,'1');
 assert.deepEqual(cold.counts(),{requests:2,sessionHooks:1,completionHooks:1,reveals:1});
 await Promise.all([cold.emit('online'),cold.emit('proplet:screen-changed'),cold.archive.install()]);
 assert.deepEqual(cold.counts(),{requests:2,sessionHooks:1,completionHooks:1,reveals:1},'recovery cannot duplicate mounted hooks or requests');

 const denied=configurationHarness({responses:[{archiveEnabled:false},{archiveEnabled:true}],cached:{archiveEnabled:true}});
 assert.equal(await denied.archive.install(),false);await denied.emit('proplet:ready');await denied.emit('online');await denied.emit('proplet:screen-changed');
 assert.equal(denied.archive.isEnabled(),false);assert.equal(denied.counts().requests,1,'explicit false wins over cache and is not retried as an error');

 const offline=configurationHarness({online:false,cached:null,responses:[{archiveEnabled:true}]});
 assert.equal(await offline.archive.install(),false);await offline.emit('proplet:ready');assert.equal(offline.archive.isEnabled(),false);assert.equal(offline.counts().requests,0,'offline unknown release gate stays closed without API calls');
 offline.context.navigator.onLine=true;offline.context.currentScreen='game';await offline.emit('online');assert.equal(offline.counts().requests,0,'late recovery does not mount UI during play');
 offline.context.currentScreen='daily';await offline.emit('proplet:screen-changed');assert.equal(offline.archive.isEnabled(),true);assert.equal(offline.counts().requests,1);

 const racing=configurationHarness({responses:[{archiveEnabled:true}]});
 await Promise.all([racing.archive.install(),racing.archive.install(),racing.emit('proplet:ready')]);
 assert.deepEqual(racing.counts(),{requests:1,sessionHooks:1,completionHooks:1,reveals:1},'concurrent successful callers install the real owner once');
  let release;
  const navigationRace=configurationHarness({responses:[new Promise(resolve=>{release=resolve})]});
  const pendingReady=navigationRace.emit('proplet:ready');
  navigationRace.context.currentScreen='game';release({archiveEnabled:true});await pendingReady;
  assert.equal(navigationRace.archive.isEnabled(),false,'a game started during configuration must defer late mounting');
  assert.deepEqual(navigationRace.counts(),{requests:1,sessionHooks:0,completionHooks:0,reveals:0});
  navigationRace.context.currentScreen='daily';await navigationRace.emit('proplet:screen-changed');
  assert.equal(navigationRace.archive.isEnabled(),true);
  assert.deepEqual(navigationRace.counts(),{requests:1,sessionHooks:1,completionHooks:1,reveals:1},'safe return uses the confirmed cached config and mounts once');
 console.log('PASS Archive cold config recovery, explicit false, offline unknown, ready/game boundaries and single installation');
}
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
vm.runInContext(app.match(/^function queuedResultPayload\(r\)\{.*$/m)[0],context);
(async()=>{
 await configurationRecoveryChecks();
 assert.equal(archive.isEnabled(),false);assert.equal(await archive.install(),false);assert.equal(states.size,0);assert.equal(storage.size,0);
 let claims=await archive.refreshClaims();assert.equal(claims.status,'ready');assert.equal(calls.at(-1).owner,'alice');
 claimsFail=true;claims=await archive.refreshClaims({force:true});assert.equal(claims.status,'unavailable');assert.equal(Object.keys(claims.claims).length,0);
 // A delayed account A response is never applied to the account B UI.
 claimsFail=false;let release;claimLoad=new Promise(resolve=>{release=resolve});
 const pending=archive.refreshClaims({force:true});profile=ownerB;
 release({editionId,claims:{'legacy-free:easy:1':{points:15}},completedPuzzleIds:['g3-e-001']});
 claims=await pending;assert.equal(claims.identity,'bob:token-b');assert.equal(claims.status,'unknown');assert.equal(Object.keys(claims.claims).length,0);claimLoad=null;
 profile=null;claims=await archive.refreshClaims();assert.equal(claims.status,'guest');
 catalogueCovers=undefined;
 await assert.rejects(archive.loadBank(),/nepodařilo ověřit/,'Missing authoritative cover count must reject the catalogue');
 catalogueCovers=fixture.completeCovers;
 profile=ownerA;await archive.start(entry.puzzle.id);
 assert.equal(calls.some(call=>call.url.startsWith('/api/archive/puzzle?')),true);
 assert.equal(archive.reward(context.currentGame.puzzle),0,'Unknown XP must never be credited optimistically');
 const alternative=entry.solutions.solutionSets[1],g=context.currentGame;
 for(const trace of alternative){archive.beforeSubmit(g,trace.word,trace.path);g.found.push(structuredClone(trace));}
 archive.prepareCompletion(g);assert.equal(g.archiveSolution.editionId,editionId);assert.equal(g.archiveSolution.found.length,alternative.length);
 const rec={puzzleId:entry.puzzle.id,challengeKey:'free:'+entry.puzzle.id,mode:'free',difficulty:'easy',level:9,contentGeneration:3,attemptId:'attempt-1',completedAt:'2026-10-13T12:00:00Z',elapsedMs:65000,moves:5,archiveSolution:g.archiveSolution,points:0};
 const payload=context.queuedResultPayload(rec);assert.deepEqual(payload.archive_solution,g.archiveSolution);
 g.resultRecord=rec;g.finished=true;const s=state();s.completed[rec.challengeKey]=rec;context.saveState(s);
 archive.renderResult(g);assert.equal(xpDisplay.text,'XP');assert.equal(xpDisplay.detail,'Ověřujeme');
 assert.throws(()=>archive.resultConfirmed(rec,{ok:true},ownerA),/nepotvrdil/,'Missing receipt must keep result queued');
 archive.resultConfirmed(rec,{awardedPoints:15,firstCompletion:true},ownerA);
 assert.equal(state('alice').completed[rec.challengeKey].points,15);assert.equal(xpDisplay.text,'+15 XP');
 archive.resultConfirmed(rec,{awardedPoints:15,firstCompletion:true},ownerA);
 assert.equal(state('alice').completed[rec.challengeKey].points,15,'Idempotent receipt does not double local XP');
 profile=ownerB;xpDisplay=null;archive.resultConfirmed(rec,{awardedPoints:15,firstCompletion:true},ownerA);
 assert.equal(state('bob').completed[rec.challengeKey],undefined);assert.equal(xpDisplay,null,'Stale account receipt cannot alter active result');
 console.log('PASS Archive config gate, authoritative API/claims, offline and account isolation, approved alternative evidence, queue payload, pending/confirmed/idempotent XP.');
})().catch(error=>{console.error(error);process.exitCode=1});
