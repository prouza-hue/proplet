const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.resolve(__dirname,'../../public');
(async()=>{
 const shellSource=fs.readFileSync(path.join(root,'sw.js'),'utf8').split('];',1)[0];
 const currentShell=shellSource.match(/SHELL_CACHE='([^']+)'/)[1];
 for(const file of ['index.html','theme-init.js']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of source.matchAll(/["'](\/[^"'\s]+\.(?:js|css)(?:\?[^"'\s]*)?)["']/g)){
   const url=match[1];
   if(fs.existsSync(path.join(root,url.split('?')[0])))assert(shellSource.includes("'"+url+"'"),'offline shell misses '+url);
  }
 }
 // Real Response streams plus delayed CacheStorage: JSON consumption must not
 // invalidate the independently owned cache response in either startup path.
 for(const [file,responseName] of [['theme-init.js','fullResponse'],['bootstrap-hydrator.js','response']]){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const start=source.indexOf("try{const cachedResponse=");
  assert(start>=0,file);
  const code=source.slice(start,source.indexOf('catch{}',start)+7);
  let release,stored;const opened=new Promise(resolve=>release=resolve);
  const response=new Response('{"ok":true}');
  vm.runInNewContext(code,{[responseName]:response,caches:{open:()=>opened}});
  assert.deepEqual(await response.json(),{ok:true});
  release({put:async(_,r)=>{stored=await r.json()}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(stored,{ok:true},file+' caches after original body consumption');
 }
 // Execute the actual worker install lifecycle. Failed fetch/cache writes must
 // reject waitUntil and must never skipWaiting (old cache remains untouched).
 for(const failure of ['http','network','cache',null]){
  const handlers={};let skipped=0,deleted=[],installation;
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{
   URL,console,caches:{open:async()=>({put:async()=>{if(failure==='cache')throw Error('quota')}}),match:async()=>null,delete:async name=>deleted.push(name)},
   fetch:async()=>{if(failure==='network')throw Error('offline');return {ok:failure!=='http',status:503}},
   self:{addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>skipped++}
  });
  handlers.install({waitUntil:p=>installation=p});
  if(failure)await assert.rejects(installation);else await installation;
  assert.equal(skipped,failure?0:1);assert.deepEqual(deleted,failure?[currentShell]:[]);
 }
 // A slow sibling fetch must finish writing before candidate cache cleanup.
 {
  const handlers={},order=[];let release,installation,fetchCount=0;
  const slow=new Promise(resolve=>release=resolve);
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{
   URL,console,caches:{open:async()=>({put:async()=>order.push('put')}),match:async()=>null,delete:async()=>order.push('delete')},
   fetch:async()=>{const index=fetchCount++;if(index===0)throw Error('offline');if(index===1)await slow;return {ok:true}},
   self:{addEventListener:(n,f)=>handlers[n]=f,skipWaiting:()=>order.push('activate')}
  });
  handlers.install({waitUntil:p=>installation=p});const rejected=assert.rejects(installation);
  await new Promise(resolve=>setImmediate(resolve));assert(!order.includes('delete'));
  release();await rejected;assert.equal(order.at(-1),'delete');assert(!order.includes('activate'));
 }
 // Model browser class mutations, including no-op remove notifications.
 // A hidden result must settle, and bursts must schedule only one callback.
 let observerCallback,queue=[],removes=0;
 const classes=new Set(['hidden']);
 const modal={classList:{contains:n=>classes.has(n),remove:n=>{removes++;classes.delete(n);observerCallback?.()}}};
 const context={console,localStorage:{getItem:()=>null,setItem(){}},document:{readyState:'complete',querySelector:s=>s==='#winModal'?modal:null},MutationObserver:class{constructor(cb){observerCallback=cb}observe(){}},setTimeout:fn=>queue.push(fn)};
 context.window=context;context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'app/engagement/nudges.js'),'utf8'),context);
 context.PropletEngagementNudges.install({});
 assert.equal(removes,0);assert.equal(queue.length,0);
 classes.add('difficulty-nudge-active');observerCallback();observerCallback();observerCallback();
 assert.equal(queue.length,1,'coalesce observer bursts');
 for(let i=0;queue.length&&i<10;i++)queue.shift()();
 assert.equal(queue.length,0,'result cleanup reaches quiescence');assert.equal(removes,1);
 // The decorator may observe timer/style mutations without asking the game
 // renderer to replace an already complete phrase subtree.
 let frames=[],renders=0,decoratorObserver;
 const tokens=new Set(['tajenka-mode']);
 const game={classList:{contains:n=>tokens.has(n)},querySelector:()=>null};
 const box={querySelector:()=>({}),classList:{contains:()=>false}};
 const document={readyState:'complete',body:{classList:{contains:()=>false}},querySelector:s=>({'#screen-game':game,'#tajenkaPhrase':box}[s]||null),querySelectorAll:()=>[]};
 const decorator={document,window:{addEventListener(){}},screen:{},navigator:{},currentGame:{mode:'tajenka'},renderTajenkaPhrase:()=>renders++,requestAnimationFrame:fn=>frames.push(fn),setTimeout(){},MutationObserver:class{constructor(cb){decoratorObserver=cb}observe(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'tajenka-runtime-polish.js'),'utf8'),decorator);
 for(let i=0;i<20;i++){decoratorObserver();while(frames.length)frames.shift()()}
 assert.equal(renders,0,'unrelated mutations must not rebuild Tajenka');
 // Full-bank fallback has reached readiness; no background timer may survive.
 const hydrator=fs.readFileSync(path.join(root,'bootstrap-hydrator.js'),'utf8');
 let timers=0;vm.runInNewContext(hydrator,{window:{},puzzleDB:{free:{}},startGame(){},setTimeout(){timers++},console});
 assert.equal(timers,0);
 // Bootstrap stays idle until a free game is requested. Multiple quick
 // requests share one fetch and only the latest selection starts a game.
 let resolveBank,fetches=0;const started=[];
 const bankReady=new Promise(resolve=>resolveBank=resolve);
 const descriptor={id:'synthetic-free',difficulty:'easy',meta:{level:1,contentGeneration:4}};
 const canonical={...descriptor,rows:1,cols:4,letters:['T','E','S','T'],mask:[0,1,2,3],answers:[{word:'TEST',path:[0,1,2,3]}]};
 const demand={window:{__PROPLET_BOOTSTRAP_DELIVERED__:true,__PROPLET_FETCH_FULL_PUZZLE_DATA:()=>{fetches++;return bankReady}},puzzleDB:{bootstrapSchema:1,free:{easy:[descriptor]}},startGame:puzzle=>started.push(puzzle),compatiblePuzzleDatabase:()=>true,setTimeout:()=>{throw Error('unexpected readiness timer')},console};
 vm.runInNewContext(hydrator,demand);
 assert.equal(fetches,0);
 demand.startGame(descriptor,'free');demand.startGame(descriptor,'free');
 assert.equal(fetches,1);assert.equal(started.length,0);
 resolveBank({free:{easy:[canonical]}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(started.length,1);assert.equal(started[0].answers[0].word,'TEST');
 console.log('PASS offline response ownership, atomic SW installation, full-bank readiness');
})().catch(e=>{console.error(e);process.exitCode=1});

