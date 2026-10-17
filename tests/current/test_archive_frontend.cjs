/* Archive reward boundary: real runtime module with isolated storage/API adapters. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'public/app/archive/boards.json'),'utf8'));
const entry=fixture.boards.find(row=>row.puzzle.id==='g3-e-009');
const editionId=fixture.editionId,solutionPolicyRevision=entry.solutions.solutionPolicyRevision;
const ownerA={id:'alice',token:'token-a'},ownerB={id:'bob',token:'token-b'};
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
  if(url==='/api/archive')return {editionId,solutionPolicyRevision,completeCovers:fixture.completeCovers,boards:fixture.boards.map(row=>({puzzleId:row.puzzle.id,level:row.level,difficulty:row.puzzle.difficulty,rewardXp:row.rewardXp,rewardSlotKey:row.rewardSlotKey}))};
  if(url.startsWith('/api/archive/puzzle?'))return {editionId,...structuredClone(entry),difficulty:entry.puzzle.difficulty};
  if(url==='/api/archive/claims'){if(claimLoad)return claimLoad;if(claimsFail)throw Error('offline');return {editionId,claims:serverClaims,completedPuzzleIds:[]};}
  throw Error('Unexpected API '+url);
 }
};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive/solution-contract.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive/experience.js'),'utf8'),context);
const archive=context.PropletArchiveExperience;
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
vm.runInContext(app.match(/^function queuedResultPayload\(r\)\{.*$/m)[0],context);
(async()=>{
 assert.equal(archive.isEnabled(),false);assert.equal(await archive.install(),false);assert.equal(states.size,0);assert.equal(storage.size,0);
 let claims=await archive.refreshClaims();assert.equal(claims.status,'ready');assert.equal(calls.at(-1).owner,'alice');
 claimsFail=true;claims=await archive.refreshClaims({force:true});assert.equal(claims.status,'unavailable');assert.equal(Object.keys(claims.claims).length,0);
 // A delayed account A response is never applied to the account B UI.
 claimsFail=false;let release;claimLoad=new Promise(resolve=>{release=resolve});
 const pending=archive.refreshClaims({force:true});profile=ownerB;
 release({editionId,claims:{'legacy-free:easy:1':{points:15}},completedPuzzleIds:['g3-e-001']});
 claims=await pending;assert.equal(claims.identity,'bob:token-b');assert.equal(claims.status,'unknown');assert.equal(Object.keys(claims.claims).length,0);claimLoad=null;
 profile=null;claims=await archive.refreshClaims();assert.equal(claims.status,'guest');
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
