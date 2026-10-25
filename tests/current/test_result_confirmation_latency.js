const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../public/app.js'),'utf8');
const capabilities=source.slice(source.indexOf('let livePlayerPreviewEnabled='),source.indexOf('window.PropletClientDiagnostics?.claimErrorListeners'));
const code=source.slice(source.indexOf('async function syncQueue('),source.indexOf('function mergeRemoteProgress('));
async function scenario(waitForProfile){
 let release,refreshed=0;
 const profile={id:'synthetic',token:'synthetic'};
 const refresh=new Promise(resolve=>release=resolve);
 const result={ok:true,left:0,sent:1};
 const context={navigator:{onLine:true},claimTelemetryAfterAuth:async()=>true,GEN4_CANDIDATE_PREVIEW:false,GEN5_CANDIDATE_PREVIEW:false,window:{},location:{search:''},URLSearchParams,
 getProfile:()=>profile,resultQueue:()=>({getQueue:()=>[{}],sync:async()=>result}),accountProfileMatches:()=>true,
 refreshRemoteProfile:()=>{refreshed++;return refresh},syncState:{},renderProfile(){},renderDaily(){},currentScreen:'game'};
 vm.createContext(context);vm.runInContext(capabilities+'\n'+code,context);
 let settled=false;const work=context.syncQueue({waitForProfile}).then(r=>{settled=true;return r});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(refreshed,1,'history still refreshes in the background');
 assert.equal(settled,!waitForProfile,'confirmed result must not wait for unrelated history');
 release();assert.equal((await work).ok,true);
}
(async()=>{await scenario(false);await scenario(true);console.log('PASS result acknowledgement is independent of slow profile refresh; default refresh still awaited')})().catch(e=>{console.error(e);process.exitCode=1});

const mergeCode=source.slice(source.indexOf('function mergePendingPlayedLevels('),source.indexOf('async function openPlayedLevels('));
const ctx={};vm.createContext(ctx);vm.runInContext(mergeCode,ctx);
const queued={puzzleId:'g4-z-001',level:1,mode:'free',difficulty:'mozkomor',elapsedMs:131000};
let merged=ctx.mergePendingPlayedLevels([], [queued,queued], 'mozkomor');
assert.equal(merged.length,1);assert.equal(merged[0].pendingSync,true);assert.equal(merged[0].elapsedMs,131000);
merged=ctx.mergePendingPlayedLevels([{...queued,elapsedMs:132000}], [queued], 'mozkomor');
assert.equal(merged.length,1);assert.equal(merged[0].pendingSync,undefined);assert.equal(merged[0].elapsedMs,132000);
assert.equal(ctx.mergePendingPlayedLevels([], [queued], 'easy').length,0);
console.log('PASS pending history preserves time, deduplicates and prefers server confirmation');

// One slow/erroring team request cannot hold back the visible world result.
const fetchCode=source.slice(source.indexOf('async function fetchFreeLevelLeaderboards('),source.indexOf('function rankBadge('));
(async()=>{
 for(const teamFails of [false,true]){
  let worldResolve,teamResolve,teamReject;
  const updates=[];
  const world=new Promise(r=>worldResolve=r),team=new Promise((r,j)=>{teamResolve=r;teamReject=j});
  const c={getProfile:()=>({familyCode:'TEST'}),api:()=>world,fetchPuzzleLeaderboard:()=>team,transformRankingPayload:x=>x};
  vm.createContext(c);vm.runInContext(fetchCode,c);
  let settled=false;const work=c.fetchFreeLevelLeaderboards('synthetic',(data,kind)=>updates.push({kind,pending:data.teamPending,rank:data.world?.myRank})).then(x=>{settled=true;return x});
  worldResolve({myRank:2});await new Promise(r=>setImmediate(r));
  assert.equal(updates.length,1);assert.equal(updates[0].kind,'world');assert.equal(updates[0].rank,2);assert.equal(updates[0].pending,true);assert.equal(settled,false);
  if(teamFails)teamReject(Error('synthetic offline'));else teamResolve({rows:[]});
  const result=await work;assert.equal(result.world.myRank,2);assert.equal(result.teamPending,false);assert.equal(!!result.teamError,teamFails);
 }
 console.log('PASS world ranking paints before slow team; team failure preserves world');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 let rendered=0;
 const c={navigator:{onLine:false},renderOfflineStatus:()=>rendered++,getQueue:()=>[{},{}],
   claimTelemetryAfterAuth:()=>{throw Error('offline sync must not contact the server')}};
 vm.createContext(c);vm.runInContext(code,c);
 const result=await c.syncQueue();
 assert.equal(result.ok,false);assert.equal(result.offline,true);assert.equal(result.left,2);assert.equal(rendered,1);
 console.log('PASS offline sync retains both pending results without network access');
})().catch(e=>{console.error(e);process.exitCode=1});
