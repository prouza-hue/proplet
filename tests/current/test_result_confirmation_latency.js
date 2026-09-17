const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../public/app.js'),'utf8');
const code=source.slice(source.indexOf('async function syncQueue('),source.indexOf('function mergeRemoteProgress('));
async function scenario(waitForProfile){
 let release,refreshed=0;
 const profile={id:'synthetic',token:'synthetic'};
 const refresh=new Promise(resolve=>release=resolve);
 const result={ok:true,left:0,sent:1};
 const context={claimTelemetryAfterAuth:async()=>true,GEN4_CANDIDATE_PREVIEW:false,GEN5_CANDIDATE_PREVIEW:false,window:{},location:{search:''},URLSearchParams,
 getProfile:()=>profile,resultQueue:()=>({getQueue:()=>[{}],sync:async()=>result}),accountProfileMatches:()=>true,
 refreshRemoteProfile:()=>{refreshed++;return refresh},syncState:{},renderProfile(){},renderDaily(){},currentScreen:'game'};
 vm.createContext(context);vm.runInContext(code,context);
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
