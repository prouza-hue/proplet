'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../public/app.js'),'utf8');
const helpers=source.slice(source.indexOf('let livePlayerPreviewEnabled='),source.indexOf('window.PropletClientDiagnostics?.claimErrorListeners'));
const sync=source.slice(source.indexOf('async function syncQueue('),source.indexOf('function mergeRemoteProgress('));
const analytics=source.slice(source.indexOf('function productAnalytics(){'),source.indexOf('function trackProductEvent('));
assert(helpers&&sync&&analytics,'live capability, sync and analytics boundaries must exist');
const tick=()=>new Promise(setImmediate);
function fixture({config={environment:'preview'},fetchOverride,online=true,environment='preview',search='',simulated=false}={}){
 let queue=[{challengeKey:'free:fixture',attemptId:'fixture-attempt'}],fetches=0,sends=0,claims=0;
 const context={
  window:{PROPLET_RUNTIME_META:{environment},PropletAnalytics:{create:options=>options}},
  location:{origin:'https://preview.example',search},navigator:{onLine:online},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
  CONTENT_PREVIEW_DATE:simulated?'2030-01-01':'',TAJENKA_PREVIEW:simulated,GEN4_CANDIDATE_PREVIEW:false,GEN5_CANDIDATE_PREVIEW:simulated,
  refreshTajenkaAvailability(){},productAnalyticsController:null,analyticsHeaders:()=>({}),getAnonymousId:()=> 'fixture-anon',
  localStorage:{getItem(){throw Error('Capability must not trust cached browser data')}},
  fetch:async(...args)=>{fetches++;return fetchOverride?fetchOverride(...args):{ok:true,url:'https://preview.example/api/config',json:async()=>config}},
  getQueue:()=>queue,getProfile:()=>({id:'fixture-player',token:'fixture-token'}),
  claimTelemetryAfterAuth:async()=>{claims++;return true},refreshRemoteProfile:async()=>{},accountProfileMatches:()=>true,
  resultQueue:()=>({getQueue:()=>queue,sync:async()=>{sends++;queue=[];return {ok:true,left:0,sent:1}}}),
  syncState:{lastAt:null},currentScreen:'daily',renderOfflineStatus(){},renderDaily(){},renderProfile(){},renderLeaderboard(){},
 };
 vm.createContext(context);vm.runInContext(helpers+'\n'+sync+'\n'+analytics,context);
 return {context,counts:()=>({fetches,sends,claims,left:queue.length})};
}
(async()=>{
 let release;
 const waiting=fixture({fetchOverride:()=>new Promise(resolve=>{release=resolve})});
 const pending=waiting.context.syncQueue();await tick();
 assert.deepEqual(waiting.counts(),{fetches:1,sends:0,claims:0,left:1},'sync must wait for verified public configuration');
 const shared=waiting.context.loadRuntimeCapabilities();await tick();assert.equal(waiting.counts().fetches,1,'concurrent capability reads share one request');
 release({ok:true,url:'https://preview.example/api/config',json:async()=>({environment:'preview',livePlayerPreview:true})});
 assert.equal((await pending).ok,true);await shared;assert.equal(waiting.counts().sends,1);
 assert.equal(waiting.context.window.PROPLET_RUNTIME_ENV,'preview','live account mode must not masquerade as production');

 for(const config of [{environment:'preview'},{environment:'preview',livePlayerPreview:false},{environment:'preview',livePlayerPreview:'true'},{environment:'production',livePlayerPreview:true}]){
  const f=fixture({config});const result=await f.context.syncQueue();
  assert.equal(result.preview,true);assert.equal(result.left,1,'a blocked preview must report its retained queue');
  assert.equal(f.counts().sends,0);assert.equal(f.counts().claims,0);assert.equal(f.context.productAnalytics().isDisabled(),true);
 }
 const foreign=fixture({fetchOverride:async()=>({ok:true,url:'https://another.example/api/config',json:async()=>({environment:'preview',livePlayerPreview:true})})});
 assert.equal((await foreign.context.syncQueue()).preview,true);assert.equal(foreign.counts().sends,0,'redirected configuration cannot opt in');

 let fail=true;
 const retry=fixture({fetchOverride:async()=>{if(fail)throw Error('offline');return {ok:true,url:'https://preview.example/api/config',json:async()=>({environment:'preview',livePlayerPreview:true})}}});
 assert.equal((await retry.context.syncQueue()).left,1);assert.equal(retry.counts().sends,0);
 fail=false;assert.equal((await retry.context.syncQueue()).ok,true);assert.equal(retry.counts().sends,1,'a failed capability load can be retried without losing the queue');

 const offline=fixture({online:false,config:{environment:'preview',livePlayerPreview:true}});
 assert.equal((await offline.context.syncQueue()).offline,true);assert.deepEqual(offline.counts(),{fetches:0,sends:0,claims:0,left:1});
 offline.context.navigator.onLine=true;assert.equal((await offline.context.syncQueue()).ok,true);assert.equal(offline.counts().sends,1);

 const dated=fixture({simulated:true,config:{environment:'preview',livePlayerPreview:true}});
 await dated.context.loadRuntimeCapabilities();assert.equal(dated.context.CONTENT_PREVIEW_DATE,'');assert.equal(dated.context.TAJENKA_PREVIEW,false);assert.equal(dated.context.GEN5_CANDIDATE_PREVIEW,false);
 assert.equal(dated.context.productAnalytics().isDisabled(),false,'ordinary player events remain labelled preview but can flow');
 dated.context.acceptRuntimeCapabilities({environment:'preview',livePlayerPreview:false});
 assert.equal(dated.context.productAnalytics().isDisabled(),true,'server opt-out disables the existing analytics controller');
 assert.equal((await dated.context.syncQueue()).preview,true);assert.equal(dated.counts().left,1);

 const tutorial=fixture({search:'?tutorial=1',config:{environment:'preview',livePlayerPreview:true}});
 assert.equal((await tutorial.context.syncQueue()).preview,true);assert.equal(tutorial.counts().sends,0,'tutorial remains non-writing even on live preview');
 const production=fixture({environment:'production'});await production.context.syncQueue();
 assert.equal(production.counts().fetches,0);assert.equal(production.counts().sends,1,'ordinary production sync is unchanged');

 const boot=source.slice(source.indexOf('async function boot(){'));
 assert(boot.indexOf('await loadRuntimeCapabilities()')<boot.indexOf('await loadPuzzleDatabaseWithRecovery()'),'boot must resolve capability before selecting dated content');
 assert(source.includes("if(local.environment==='preview'||location.origin===canonicalOrigin)"),'preview must keep its existing own-origin update path');
 console.log('PASS live-player capability: same-origin strict opt-in, early/concurrent sync, retained queue, retry/offline, date isolation, preview analytics identity and production compatibility');
})().catch(error=>{console.error(error);process.exitCode=1});
