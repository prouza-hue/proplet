const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();
 // Match the committed slot-3 Tajenka fixture without changing running timers.
 await p.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
 await c.addInitScript(()=>localStorage.setItem('proplet:content-release:g5-r1','1'));
 const url=process.env.TEST_URL||'http://127.0.0.1:8765';
 assert(['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname),'use an isolated loopback fixture server');
 const repo=path.resolve(__dirname,'..');
 const expectedSha=process.env.EXPECTED_SHA||execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
 const health=await fetch(url+'/api/health').then(r=>r.json());
 assert(health.isolatedFixture&&health.database===false,'isolated fixture identity required');
 assert.equal(health.sha,expectedSha,'server must serve the expected checkout');
 const assets={};
 for(const name of ['index.html','app.js','sw.js','theme-init.js','puzzles-bootstrap.json']){
  const actual=Buffer.from(await(await fetch(url+'/'+name)).arrayBuffer());
  const expected=fs.readFileSync(path.join(repo,'public',name));
  assert(actual.equals(expected),'served asset differs from checkout/build: '+name);
  assets[name]=crypto.createHash('sha256').update(actual).digest('hex');
 }
 fs.mkdirSync(path.dirname(process.env.RESULT_PATH||'idle-browser-results.json'),{recursive:true});
 const out={sha:expectedSha,assets,started:new Date().toISOString(),browser:b.version(),viewport:{width:1440,height:1000},cpuThrottle:1,guest:true,measurements:[],errors:[]};
 const requests=[];p.on('request',r=>requests.push({method:r.method(),path:new URL(r.url()).pathname}));
 p.on('pageerror',e=>out.errors.push(e.message));
 console.log('Loading isolated frontend');await p.goto(url);await p.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);await p.waitForTimeout(5000);
 const skip=p.locator('.onboarding-return-skip');if(await skip.isVisible())await skip.click();
 out.demandLoading=await p.evaluate(()=>({bootstrap:puzzleDB.bootstrapSchema===1,fullRequests:performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname==='/puzzles.json').length}));
 assert(out.demandLoading.bootstrap,'fixture bootstrap must cover the fixed browser date 2026-09-15');
 if(out.demandLoading.bootstrap)assert.equal(out.demandLoading.fullRequests,0,'home must not fetch the full bank');
 const savedProgress=await p.evaluate(()=>{
  const state=getState();
  for(const difficulty of ['easy','hardcore'])for(const puzzle of puzzleDB.free[difficulty].slice(0,2)){
   const key=challengeKey('free',puzzle,null);
   state.completed[key]={puzzleId:puzzle.id,challengeKey:key,mode:'free',difficulty,level:puzzle.meta.level,contentGeneration:4,elapsedMs:42000,moves:12,points:pointsFor('free',difficulty,puzzle),completedAt:'2026-09-15T09:00:00Z'};
  }
  saveState(state);return JSON.stringify(state.completed);
 });
 if(out.demandLoading.bootstrap){
  console.log('Checking offline bootstrap reload');
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(1000);
  await c.setOffline(true);await p.reload();
  await p.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB?.bootstrapSchema===1);
  await p.waitForFunction(()=>typeof document.querySelector('#playDailyBtn')?.onclick==='function');
  out.offlineBeforeFree=true;
  await c.setOffline(false);
  await p.waitForFunction(()=>typeof tajenkaPuzzle!=='undefined'&&tajenkaPuzzle);
 }
 console.log('Starting free game');await p.evaluate(()=>{closeTransientModals();startGame(puzzleDB.free.easy[0],'free',null,{})});
 await p.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='free'&&currentGame.puzzle.answers?.length>0);
 await p.waitForTimeout(500);
 assert.equal(await p.evaluate(()=>JSON.stringify(getState().completed)),savedProgress,'offline reload/full hydration preserves existing completion records');
 out.preservedSyntheticCompletions=4;
 // CacheStorage writes are asynchronous; wait for completion, not a fixed 500 ms.
 await p.waitForFunction(async()=>!!await caches.match('/puzzles.json'),null,{timeout:15000});
 out.cached=await p.evaluate(async()=>!!await caches.match('/puzzles.json'));assert(out.cached,'first free-game entry caches canonical bank');
 await p.evaluate(()=>{closeTransientModals();startTajenka()});
 await p.waitForFunction(()=>currentGame?.mode==='tajenka',null,{timeout:15000});
 await p.evaluate(()=>closeTajenkaRules());await p.waitForTimeout(3000);
 // Prepare the normal 'helper already declined' state before timed windows.
 // Only the helper's idle timestamp is advanced; the game clock is unchanged.
 await p.evaluate(()=>{currentGame.lastProgressAt=performance.now()-Math.max(600000,helperThreshold()+1);maybeOfferHelper()});
 const helper=p.locator('#helperDismissBtn');if(await helper.isVisible())await helper.click();
 await p.mouse.move(0,0);await p.waitForTimeout(2000);
 out.helperState='offer triggered by synthetic idle timestamp and dismissed before measurement';
 await p.evaluate(()=>{window.renderCount=0;const original=renderTajenkaPhrase;renderTajenkaPhrase=function(...args){window.renderCount++;return original.apply(this,args)};window.nudgeRemoves=0;const remove=DOMTokenList.prototype.remove;DOMTokenList.prototype.remove=function(...args){if(this===document.querySelector('#winModal').classList&&args.includes('difficulty-nudge-active'))window.nudgeRemoves++;return remove.apply(this,args)}});
 const cdp=await c.newCDPSession(p);await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 for(let i=0;i<Number(process.env.REPETITIONS||3);i++){
  const before=await metrics(),start=Date.now(),requestStart=requests.length;await p.waitForTimeout(Number(process.env.MEASURE_MS||60000));const after=await metrics();
  const row={scenario:'tajenka idle',seconds:(Date.now()-start)/1000};for(const k of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'])row[k]=after[k]-before[k];assert.equal(await p.locator('.modal:not(.hidden)').count(),0,'idle board stays unobstructed');row.requests=requests.slice(requestStart);assert(!row.requests.some(r=>r.path==='/puzzles.json'||r.path==='/puzzles-bootstrap.json'),'idle must not refetch puzzle bank');row.heap=after.JSHeapUsedSize;row.nodes=after.Nodes;out.measurements.push(row);console.log(JSON.stringify(row));fs.writeFileSync(process.env.RESULT_PATH||'idle-browser-results.json',JSON.stringify(out,null,2));
 }
 out.idleCounts=await p.evaluate(()=>({renders:renderCount,nudgeRemoves}));assert.equal(out.idleCounts.renders,0);assert.equal(out.idleCounts.nudgeRemoves,0);
 const drag=async answer=>{for(let i=0;i<answer.length;i++){const r=await p.locator('.cell[data-index="'+answer[i]+'"]').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);if(!i)await p.mouse.down();await p.waitForTimeout(40)}await p.mouse.up();await p.waitForTimeout(1500)};
 await drag(await p.evaluate(()=>currentGame.puzzle.answers[0].path));out.found=await p.evaluate(()=>currentGame.found.length);fs.writeFileSync(process.env.RESULT_PATH||'idle-browser-results.json',JSON.stringify(out,null,2));assert.equal(out.found,1);assert(await p.locator('.tajenka-slot.revealed').count()>0);
 for(const viewport of [{width:390,height:844},{width:884,height:1104},{width:1104,height:884}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(700);
  assert(await p.locator('.tajenka-slot.revealed').count()>0,'reveal survives layout move');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 }
 await p.setViewportSize({width:1440,height:1000});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start');await p.waitForTimeout(10000);
 const profile=await cdp.send('Profiler.stop');fs.writeFileSync((process.env.RESULT_PATH||'idle-browser-results.json')+'.cpuprofile',JSON.stringify(profile.profile));
 await p.evaluate(()=>nav('daily'));await p.waitForTimeout(3000);const count=await p.evaluate(()=>renderCount);await p.waitForTimeout(10000);assert.equal(await p.evaluate(()=>renderCount),count);
 for(let i=0;i<20;i++)await p.evaluate(()=>{nav('game');nav('daily')});await p.waitForTimeout(3000);assert.equal(await p.evaluate(()=>renderCount),count);
 await c.setOffline(true);await p.reload();await p.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);out.offlineBank=await p.evaluate(()=>!!puzzleDB);assert(out.offlineBank);
 out.finished=new Date().toISOString();assert.deepEqual(out.errors,[]);fs.writeFileSync(process.env.RESULT_PATH||'idle-browser-results.json',JSON.stringify(out,null,2));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
