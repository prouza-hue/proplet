'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const {MessageChannel}=require('node:worker_threads');
const source=fs.readFileSync(path.resolve(__dirname,'../../public/app/offline.js'),'utf8');
const EDITION='free-gen3-v1',REVISION='g3-reviewed-covers-20261008-r3';
const INDEX='proplet-offline-index-v1',ACTIVE='/__proplet-offline__/active';
const DIFF=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const clone=value=>structuredClone(value);
function puzzle(id,difficulty,level=1,generation=4){return {id,difficulty,rows:2,cols:2,mask:[0,1,2,3],letters:['A','B','C','D'],answers:[{word:'ABDC',path:[0,1,3,2]}],meta:{level,contentGeneration:generation}};}
function fixtures(){
 const bank={version:11,contentGeneration:4,dailyGeneration:4,free:Object.fromEntries(DIFF.map(d=>[d,[puzzle('g4-'+d,d)]])),daily:[puzzle('daily','easy')],rescue:[puzzle('rescue','rescue')],starter:puzzle('starter','easy')};
 const bankText=JSON.stringify(bank);
 const rolling={version:2,asOf:'2026-10-15',puzzles:{easy:[puzzle('rolling-easy','easy',2)]},meta:{release:'current'}};
 const manifest={schemaVersion:1,bankVersion:createHash('sha256').update(bankText).digest('hex'),archiveEnabled:true,archiveRevision:REVISION,archiveEdition:EDITION,rollingUrl:'/api/rolling-content?week=2026-10-12',rollingVersion:'2026-10-15:r1',version:'4.08.0'};
 const boards=[],entries=[];
 for(const [difficulty,rewardXp] of Object.entries({easy:15,medium:25,hard:50,hardcore:100}))for(let level=1;level<=200;level++){
  const p=puzzle('g3-'+difficulty+'-'+level,difficulty,level,3),row={puzzleId:p.id,difficulty,level,rewardXp,rewardSlotKey:'legacy-free:'+difficulty+':'+level};
  const sets=[p.answers];if(entries.length<79)sets.push([{word:'DCAB',path:[3,2,0,1]}]);
  boards.push(row);entries.push({editionId:EDITION,puzzle:p,...row,solutions:{puzzleId:p.id,gameplayScope:'archive',solutionPolicyRevision:REVISION,solutionSets:sets}});
 }
 const archive={formatVersion:1,boardCount:800,editionId:EDITION,solutionPolicyRevision:REVISION,completeCovers:879,boards,entries};
 return {bank,bankText,rolling,manifest,archive};
}
class MemoryCache{
 constructor(owner,name){this.owner=owner;this.name=name;this.rows=new Map();}
 async match(url){return this.rows.get(String(url))?.clone();}
 async put(url,response){if(this.owner.failPut?.(this.name,String(url)))throw Error('QuotaExceededError');this.rows.set(String(url),response.clone());}
 async keys(){return [...this.rows.keys()].map(url=>({url}));}
}
class MemoryCaches{
 constructor(){this.rows=new Map();this.failPut=null;}
 async open(name){if(!this.rows.has(name))this.rows.set(name,new MemoryCache(this,name));return this.rows.get(name);}
 async delete(name){return this.rows.delete(name);}
 async keys(){return [...this.rows.keys()];}
}
function environment({store=new MemoryCaches(),online=true,installed=true,shellReady=true,fixture=fixtures(),missingChannel=false,timeoutMs=100}={}){
 const events=new EventTarget(),document=new EventTarget(),swEvents=new EventTarget();document.visibilityState='visible';
 let clock=Date.now(),standalone=installed,shellOkay=shellReady,profile=null,progressReady=true,pending=0,persistCalls=0,requests=[],onChange=[];
 const nav={onLine:online,storage:{persist:async()=>{persistCalls++;return false;}},serviceWorker:swEvents};
 const worker={postMessage(message,ports){assert.equal(message.type,'GET_OFFLINE_STATUS');ports[0].postMessage({ready:shellOkay});}};
 nav.serviceWorker.ready=Promise.resolve({active:worker});nav.serviceWorker.controller=worker;
 let rejectUrl=null;
 const fetch=async(url,options)=>{
  requests.push({url,options});
  assert.equal(options.credentials,'omit','public content fetches never carry account cookies');
  assert.equal(options.headers.Authorization,undefined);
  if(rejectUrl&&rejectUrl(url))throw Error('test-network-failed');
  if(url==='/api/offline-manifest')return new Response(JSON.stringify(fixture.manifest));
  if(url==='/puzzles.json')return new Response(fixture.bankText);
  if(url==='/api/archive/offline')return new Response(JSON.stringify(fixture.archive));
  if(url.startsWith('/api/rolling-content?'))return new Response(JSON.stringify(fixture.rolling));
  throw Error('unknown-test-url:'+url);
 };
 const host={navigator:nav,document,caches:store,fetch,Response,MessageChannel:missingChannel?undefined:MessageChannel,AbortController,TextEncoder,TextDecoder,crypto:webcrypto,structuredClone,setTimeout,clearTimeout,matchMedia:()=>({matches:standalone}),addEventListener:events.addEventListener.bind(events)};
 const context={window:host,console};vm.createContext(context);vm.runInContext(source,context,{filename:'offline.js'});
 const api=host.PropletOffline.create({window:host,timeoutMs,now:()=>clock});
 const callbacks={isInstalled:()=>standalone,getProfile:()=>profile,hasCachedProgress:()=>progressReady,getPendingCount:()=>pending,onChange:s=>onChange.push(s)};
 return {api,store,nav,document,host,callbacks,fixture,requests,onChange,
  advance:ms=>{clock+=ms;},setInstalled:value=>{standalone=value;},setShell:value=>{shellOkay=value;},setProfile:value=>{profile=value;},setProgress:value=>{progressReady=value;},setPending:value=>{pending=value;},fail:predicate=>{rejectUrl=predicate;},
  event:name=>events.dispatchEvent(new Event(name)),get persistCalls(){return persistCalls;}};
}
async function pointer(store){return (await(await store.open(INDEX)).match(ACTIVE))?.json();}
async function waitUntil(test){for(let i=0;i<60;i++){if(await test())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('event did not settle');}
async function run(){
 // Installed PWA receives the whole bank and one aggregate Archive request.
 const first=environment();
 const ready=await first.api.install(first.callbacks);
 assert.equal(ready.ready,true);assert.equal(ready.contentReady,true);assert.equal(ready.preparing,false);
 assert.equal(first.persistCalls,1,'storage persistence is requested, but readiness never depends on browser granting it');
 assert.deepEqual(first.requests.map(r=>r.url).sort(),['/api/archive/offline','/api/offline-manifest','/api/rolling-content?week=2026-10-12','/puzzles.json'].sort());
 const active=await pointer(first.store);assert.ok(active.cacheName.startsWith('proplet-offline-content-v1-'));
 assert.equal(Object.keys(active.manifest).includes('token'),false);
 assert.equal((await first.api.getArchiveCatalogue()).boards.length,800);
 assert.equal((await first.api.getArchiveEntry(first.fixture.archive.boards[0].puzzleId)).solutions.solutionSets.length,2);
 assert.equal(await first.api.getArchiveEntry('not-downloaded'),null);
 const db=await first.api.getPuzzleDatabase();assert.equal(db.free.easy.length,2);assert.equal(db.free.easy[1].id,'rolling-easy');
 db.free.easy[0].letters[0]='X';assert.equal((await first.api.getPuzzleDatabase()).free.easy[0].letters[0],'A','caller mutations never corrupt the prepared public pack');
 const before=first.requests.length;await Promise.all([first.api.prepare(),first.api.prepare()]);assert.equal(first.requests.length,before,'already checked manifests do not re-download');
 await first.api.prepare({force:true});assert.equal(first.requests.length,before+1,'forced revalidation downloads only the small unchanged manifest');
 // A release within the same week updates only its small public delta.
 const dailyUpdate=environment();await dailyUpdate.api.install(dailyUpdate.callbacks);
 dailyUpdate.fixture.manifest.rollingVersion='2026-10-15:r2';
 dailyUpdate.fixture.rolling.puzzles.easy.push(puzzle('rolling-third','easy',3));
 await dailyUpdate.api.prepare({force:true});
 assert.equal((await dailyUpdate.api.getPuzzleDatabase()).free.easy.length,3);
 assert.equal(dailyUpdate.requests.filter(r=>r.url==='/puzzles.json').length,1);
 assert.equal(dailyUpdate.requests.filter(r=>r.url==='/api/archive/offline').length,1);
 assert.equal(dailyUpdate.requests.filter(r=>r.url===dailyUpdate.fixture.manifest.rollingUrl).length,2);
 const stableRequests=dailyUpdate.requests.length;
 dailyUpdate.document.dispatchEvent(new Event('visibilitychange'));
 await dailyUpdate.api.prepare();
 assert.equal(dailyUpdate.requests.length,stableRequests,'rapid foreground changes reuse the recently checked manifest');
 dailyUpdate.advance(60001);dailyUpdate.document.dispatchEvent(new Event('visibilitychange'));
 await waitUntil(()=>dailyUpdate.requests.length===stableRequests+1);
 await dailyUpdate.api.prepare();
 assert.equal(dailyUpdate.requests.length,stableRequests+1,'a later foreground revalidates the small manifest');
 // New document/process can start in airplane mode, retaining every board and no
 // dependency on a live server, session token, or runtime memory from above.
 const cold=environment({store:first.store,online:false});
 const offline=await cold.api.install(cold.callbacks);
 assert.equal(offline.ready,true);assert.equal(offline.offline,true);assert.equal(cold.requests.length,0);
 assert.equal((await cold.api.getPuzzleDatabase()).free.easy[1].id,'rolling-easy');
 assert.equal((await cold.api.getPublicConfig()).archiveEnabled,true);
 // Ordinary visitors from ads don't download the 4 MB bank or a 2 MB Archive.
 const visitor=environment({installed:false});await visitor.api.install(visitor.callbacks);
 assert.equal(visitor.requests.length,0);assert.equal(visitor.persistCalls,0);assert.equal(visitor.api.getState().ready,false);
 visitor.event('appinstalled');await waitUntil(()=>visitor.api.getState().ready);
 assert.equal(visitor.requests.filter(r=>r.url==='/puzzles.json').length,1);
 // Account state is private: its availability gates the claim without entering
 // the public cache, and an account switch re-evaluates that condition.
 const account=environment({store:first.store,online:false});
 account.setProfile({id:'private-player',token:'never-persist-this'});account.setProgress(false);
 assert.equal((await account.api.install(account.callbacks)).ready,false);assert.equal(account.api.getState().contentReady,true);
 account.setProgress(true);account.document.dispatchEvent(new Event('proplet:profile-refreshed'));
 await waitUntil(()=>account.api.getState().ready);
 account.setPending(7);account.document.dispatchEvent(new Event('proplet:queue-changed'));
 await waitUntil(()=>account.api.getState().pending===7);
 for(const cache of account.store.rows.values())for(const response of cache.rows.values())assert.equal((await response.clone().text()).includes('never-persist-this'),false);
 // A failure after the bank has been fetched cannot replace the former pack.
 const replacement=environment({store:first.store});replacement.fixture.manifest.rollingUrl='/api/rolling-content?week=2026-10-19';replacement.fail(url=>url.startsWith('/api/rolling-content'));
 const oldPointer=await pointer(first.store);const failed=await replacement.api.install(replacement.callbacks);
 assert.equal(failed.contentReady,true);assert.equal((await pointer(first.store)).cacheName,oldPointer.cacheName);
 assert.equal((await replacement.api.getPuzzleDatabase()).free.easy.length,2);
 assert.ok(failed.error);assert.equal((await first.store.keys()).filter(name=>name.startsWith('proplet-offline-content-v1-')).length,1,'failed candidates are removed without deleting the active pack');
 // Failed commit/quota write also leaves the old pointer and original cache.
 const quota=environment({store:first.store});quota.fixture.manifest.version='4.08.1';quota.store.failPut=(name,url)=>name===INDEX&&url===ACTIVE;
 await quota.api.install(quota.callbacks);assert.equal((await pointer(first.store)).cacheName,oldPointer.cacheName);quota.store.failPut=null;
 // Shell assets are part of readiness; content alone isn't enough.
 const incomplete=environment({shellReady:false});const incompleteResult=await incomplete.api.install(incomplete.callbacks);
 assert.equal(incompleteResult.ready,false);assert.equal(incompleteResult.contentReady,false);assert.equal(await pointer(incomplete.store),undefined);assert.equal(incompleteResult.error,'offline-shell-incomplete');
 incomplete.setShell(true);assert.equal((await incomplete.api.prepare({force:true})).ready,true,'a manual retry can complete preparation');
 const unsupported=environment({missingChannel:true});assert.equal((await unsupported.api.install(unsupported.callbacks)).ready,false);assert.equal(unsupported.requests.length,0);
 // Unsupported storage and hung network promises fail gracefully and cannot
 // leave an unbounded preparation or a fabricated ready indication.
 const noStorage=unsupported.host.PropletOffline.create({window:{...unsupported.host,caches:undefined}});
 assert.equal((await noStorage.install(unsupported.callbacks)).ready,false);
 let hungSignal;
 const hung=first.host.PropletOffline.create({window:{...first.host,caches:new MemoryCaches()},timeoutMs:10,fetch:async(url,{signal})=>{hungSignal=signal;return await new Promise(()=>{});}});
 const timeoutResult=await hung.install(first.callbacks);
 assert.equal(timeoutResult.error,'offline-download-timeout');assert.equal(timeoutResult.preparing,false);assert.equal(hungSignal.aborted,true);
 // Browsers may evict storage despite a persistence request. A remaining index
 // without its bank must not keep claiming the pack is ready.
 const evicted=environment();await evicted.api.install(evicted.callbacks);
 const evictedPointer=await pointer(evicted.store);(await evicted.store.open(evictedPointer.cacheName)).rows.delete('/puzzles.json');
 evicted.nav.onLine=false;const afterEviction=await evicted.api.prepare();
 assert.equal(afterEviction.contentReady,false);assert.equal(afterEviction.ready,false);assert.equal(await evicted.api.getPuzzleDatabase(),null);
 // Reject the tiny bootstrap DB, broken canonical paths, mixed Archive revisions,
 // incomplete downloads, and bytes disagreeing with the manifest's SHA-256.
 for(const [name,mutate] of [
  ['bootstrap',f=>{f.bank.bootstrapSchema=1;f.bankText=JSON.stringify(f.bank);f.manifest.bankVersion=createHash('sha256').update(f.bankText).digest('hex');}],
  ['non-playable-bank',f=>{f.bank.free.easy[0].answers[0].path=[0,3,2,1];f.bankText=JSON.stringify(f.bank);f.manifest.bankVersion=createHash('sha256').update(f.bankText).digest('hex');}],
  ['wrong-hash',f=>{f.manifest.bankVersion='f'.repeat(64);}],
  ['missing-difficulty',f=>{delete f.bank.free.mozkokalypsa;f.bankText=JSON.stringify(f.bank);f.manifest.bankVersion=createHash('sha256').update(f.bankText).digest('hex');}],
  ['archive-revision',f=>{f.archive.entries[0].solutions.solutionPolicyRevision='another-edition';}],
  ['archive-partial',f=>{f.archive.entries.pop();}],
  ['rolling-rebind',f=>{f.rolling.puzzles.easy[0].meta.level=1;}],
 ]){
  const fixture=fixtures();mutate(fixture);const bad=environment({fixture});const result=await bad.api.install(bad.callbacks);
  assert.equal(result.ready,false,name);assert.equal(await pointer(bad.store),undefined,name);assert.ok(result.error,name);
 }
 // A disabled Archive is a confirmed public flag, not permission inferred from
 // the presence of old data, and never triggers a download of those boards.
 const closed=environment();closed.fixture.manifest.archiveEnabled=false;
 assert.equal((await closed.api.install(closed.callbacks)).ready,true);
 assert.equal((await closed.api.getPublicConfig()).archiveEnabled,false);assert.equal(await closed.api.getArchiveCatalogue(),null);
 assert.equal(closed.requests.some(r=>r.url==='/api/archive/offline'),false);
 console.log('PASS offline public content: atomic rollback, cold start, installed gate, SHA, finite covers, account and complete shell readiness');
}
module.exports={environment,fixtures,MemoryCaches,run};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
