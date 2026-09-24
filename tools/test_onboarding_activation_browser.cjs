// Browser-to-API regressions: real pointer input, synthetic loopback APIs only.
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),url=process.env.TEST_URL||'http://127.0.0.1:8765';
assert(['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname),'never run against a deployment');
const output=process.env.RESULT_PATH||'onboarding-browser-results.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
const report={started:new Date().toISOString(),synthetic:true,checks:[]};
const control=async value=>{const response=await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});assert(response.ok);return response.json()};
const recording=()=>fetch(url+'/__fixture/events').then(r=>r.json());
const events=async()=> (await recording()).events;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function eventually(fn,message,timeout=10000){const end=Date.now()+timeout;do{if(await fn())return;await delay(100)}while(Date.now()<end);throw Error(message)}
async function eventOnce(name){await eventually(async()=> (await events()).some(e=>e.event===name),'event never received: '+name);assert.equal((await events()).filter(e=>e.event===name).length,1,'event exactly once: '+name)}
async function ready(page){await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&currentGame.puzzle.answers.length===4&&document.querySelectorAll('#screen-game .cell').length===25,{},{timeout:12000});await page.locator('#starterCoach').waitFor({state:'visible'});assert.equal(await page.locator('#onboardingModal').isVisible(),false,'automatic intro is the board');assert.equal(new URL(page.url()).searchParams.has('tutorial'),false,'exercise actual anonymous activation, never tutorial override')}
async function draw(page,indices,touch=false){
 const coordinates=[];for(const i of indices){const box=await page.locator('#screen-game .cell[data-index="'+i+'"]').boundingBox();assert(box,'board cell exists');coordinates.push({x:box.x+box.width/2,y:box.y+box.height/2})}
 if(touch){
  const cdp=await page.context().newCDPSession(page);
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...coordinates[0],id:1,radiusX:3,radiusY:3,force:1}]});for(const point of coordinates.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1,radiusX:3,radiusY:3,force:1}]});await page.waitForTimeout(55)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}finally{await cdp.detach()}
 }else{
  await page.mouse.move(coordinates[0].x,coordinates[0].y);await page.mouse.down();for(const point of coordinates.slice(1)){await page.mouse.move(point.x,point.y,{steps:3});await page.waitForTimeout(45)}await page.mouse.up();
 }
}
async function solve(page,touch=false){
 const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
 assert.equal(paths.length,4);for(let i=0;i<paths.length;i++){await draw(page,paths[i],touch);await page.waitForFunction(count=>currentGame.found.length===count,i+1);}
 await page.locator('#winModal.starter-win').waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>currentGame.finished),true);
 assert.equal(await page.evaluate(()=>Object.values(getState().completed).filter(r=>r.mode==='starter').length),1);
}
(async()=>{
 const health=await fetch(url+'/api/health').then(r=>r.json());
 assert(health.isolatedFixture&&health.database===false);if(process.env.EXPECTED_SHA)assert.equal(health.sha,process.env.EXPECTED_SHA);
 report.sha=health.sha;report.baseline=health.baseline;
 await control({reset:true});report.assets={};
 for(const name of ['index.html','app.js','sw.js','app/engagement/onboarding.js']){const actual=Buffer.from(await(await fetch(url+'/'+name)).arrayBuffer());assert(actual.equals(fs.readFileSync(path.join(repo,'public',name))),'fixture asset mismatch: '+name);report.assets[name]=crypto.createHash('sha256').update(actual).digest('hex')}
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});report.browser=browser.version();
 async function scenario(name,fn,options={}){
  await control({reset:true});
  const context=await browser.newContext({viewport:options.mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:!!options.mobile,hasTouch:!!options.mobile,serviceWorkers:options.serviceWorkers?'allow':'block'});
  // Block every non-loopback request (analytics tags/fonts included).
  await context.route('**/*',route=>{const target=new URL(route.request().url());return ['127.0.0.1','localhost','[::1]'].includes(target.hostname)?route.continue():route.abort()});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
  const start=Date.now();console.log('SCENARIO '+name);
  try{await fn(page,context);assert.deepEqual(errors,[],'uncaught browser errors');await page.screenshot({path:output+'.'+name+'.png',fullPage:true});report.checks.push({name,ok:true,ms:Date.now()-start,events:await events()})}
  catch(error){report.checks.push({name,ok:false,error:error.stack,errors,events:await events()});await page.screenshot({path:output+'.'+name+'.failed.png',fullPage:true}).catch(()=>{});throw error}
  finally{fs.writeFileSync(output,JSON.stringify(report,null,2));await context.close()}
 }
 try{
  if(process.env.TEST_EXPECT_BASELINE==='1'){
   assert(health.baseline,'baseline SHA required');
   await scenario('baseline-reproduction',async page=>{
    await control({release:'baseline',eventDelayMs:1000});await page.goto(url);await ready(page);
    await draw(page,await page.evaluate(()=>currentGame.puzzle.answers[0].path));await page.waitForFunction(()=>currentGame.found.length===1);await page.waitForTimeout(2500);
    const state=await page.evaluate(()=>({mode:currentGame?.mode||null,events:Object.keys(localStorage).filter(k=>k.startsWith('proplet-events-v2:')).flatMap(k=>JSON.parse(localStorage.getItem(k)||'[]')).map(e=>e.event)}));
    assert.equal(state.mode,'starter','baseline intro remains playable');assert(state.events.includes('starter_started'),'original queue strands starter_started behind an in-flight event');
    assert.equal((await events()).some(e=>e.event==='starter_started'),false,'stranded starter event not yet received');report.baselineReproduction=state;
   });
  }else{
   for(const mobile of [false,true])await scenario(mobile?'mobile-touch':'desktop-mouse',async page=>{
    await page.goto(url);await ready(page);await solve(page,mobile);
    for(const name of ['onboarding_started','starter_started','starter_word_1_completed','starter_word_2_completed','starter_word_3_completed','starter_completed','onboarding_completed','starter_v1_requested','starter_v1_data_ready','starter_v1_ready','starter_v1_interaction','starter_v1_first_correct','starter_v1_completed'])await eventOnce(name);
    const received=await events(),readyEvent=received.find(e=>e.event==='starter_v1_ready');
    assert(readyEvent.headers['x-proplet-event-id'],'diagnostic has deduplicatable event ID');
    const trace=received.filter(e=>e.event.startsWith('starter_v1_'));
    assert.match(readyEvent.headers['x-proplet-starter-run'],/^[a-f0-9-]{36}$/,'starter run is a UUID');
    assert.equal(new Set(trace.map(e=>e.headers['x-proplet-starter-run'])).size,1,'all diagnostic phases belong to one run');
    assert(trace.every(e=>e.headers['x-proplet-auth-at-event']==='anonymous'),'auth captured at event time');
    assert(trace.every(e=>Number.isFinite(Number(e.headers['x-proplet-starter-ms']))&&Number(e.headers['x-proplet-starter-ms'])>=0),'valid per-run elapsed times');
    assert.equal(received.some(e=>e.headers['x-proplet-test']==='1'),false,'production funnel exercised');
    await page.reload();await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&typeof document.querySelector('#playDailyBtn')?.onclick==='function');await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false,'completed intro does not restart');
    for(const name of ['starter_started','starter_completed','onboarding_completed'])await eventOnce(name);
   },{mobile});
   await scenario('known-player-skip',async page=>{
    await page.goto(url);await ready(page);await page.locator('.onboarding-return-skip').click();
    await page.waitForFunction(()=>currentScreen==='daily');await eventOnce('onboarding_skipped_known_player');
    assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),0,'skip awards no results');
    await page.reload();await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&typeof document.querySelector('#playDailyBtn')?.onclick==='function');await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false);
   });
   await scenario('existing-local-progress',async(page,context)=>{
    const bank=JSON.parse(fs.readFileSync(path.join(repo,'public/puzzles.json'))),p=bank.free.easy[0];
    const record={puzzleId:p.id,challengeKey:'free:'+p.id,mode:'free',difficulty:'easy',level:p.meta.level,contentGeneration:4,elapsedMs:45000,moves:8,points:15,completedAt:'2026-09-14T10:00:00Z'};
    await context.addInitScript(rec=>localStorage.setItem('proplet-v2-state:guest',JSON.stringify({completed:{[rec.challengeKey]:rec},rescues:{},inProgress:{},dailyDates:[],statsVersion:5})),record);
    await page.goto(url);await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&typeof document.querySelector('#playDailyBtn')?.onclick==='function');
    await eventOnce('onboarding_skipped_returning_state');
    assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false,'prior local player bypasses first-visit board');
    assert.deepEqual(await page.evaluate(key=>getState().completed[key],record.challengeKey),record,'local progress unchanged by automatic skip');
   });
   await scenario('login-during-intro',async page=>{
    await page.goto(url);await ready(page);
    const record=await page.evaluate(()=>{const p=puzzleDB.free.easy[0];return {puzzleId:p.id,challengeKey:challengeKey('free',p,null),mode:'free',difficulty:'easy',level:p.meta.level,contentGeneration:4,elapsedMs:45000,moves:8,points:15,completedAt:'2026-09-14T10:00:00Z'}});
    await control({progress:[record]});
    // Existing account cache belongs to a different scope from the active guest.
    await page.evaluate(rec=>{const state=getState('onboarding-synthetic');state.completed[rec.challengeKey]=rec;saveState(state,'onboarding-synthetic')},record);
    await page.locator('.onboarding-return-login').click();await page.locator('#playerNameInput').fill('Fixture Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
    await page.waitForFunction(()=>getProfile()?.id==='onboarding-synthetic'&&currentScreen==='daily'&&accountProgressAvailable(),null,{timeout:15000});
    assert.deepEqual(await page.evaluate(key=>getState().completed[key],record.challengeKey),record,'existing account result survives intro login');
    assert.equal(await page.evaluate(()=>Object.values(getState().completed).some(r=>r.mode==='starter')),false,'unfinished guest intro awards nothing');
    await eventOnce('onboarding_login_authenticated');await page.reload();await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&accountProgressAvailable());
    assert.deepEqual(await page.evaluate(key=>getState().completed[key],record.challengeKey),record,'account result survives reload');
    assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false);
   });
   await scenario('shared-invitation',async page=>{
    const bank=JSON.parse(fs.readFileSync(path.join(repo,'public/puzzles.json'))),puzzle=bank.free.easy[0];
    await page.goto(url+'/?play='+encodeURIComponent(puzzle.id)+'&kind=free&t=45000&h=0&m=8');await ready(page);
    assert.equal(await page.evaluate(()=>currentGame.mode),'starter','invitation waits for intro');await solve(page);
    const cta=page.locator('#winPrimaryBtn');if(await cta.isVisible())await cta.click();else await page.locator('#starterWarmupBtn').click();
    await page.waitForFunction(id=>currentGame?.mode==='free'&&currentGame.puzzle.id===id,puzzle.id);
    assert(await page.locator('#gameModeLabel').textContent().then(s=>s.includes('kamaráda')),'shared UI is attached');await eventOnce('shared_level_started');
   });
   await scenario('slow-rolling-content',async page=>{
    await control({rolling:'hold'});await page.goto(url);await ready(page);
    assert((await recording()).requests.some(r=>r.path==='/api/rolling-content'),'held rolling request actually issued');
    await draw(page,await page.evaluate(()=>currentGame.puzzle.answers[0].path));await page.waitForFunction(()=>currentGame.found.length===1);
    await control({rolling:'ok'});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>currentGame.found.length),1,'background content arrival preserves active intro');await eventOnce('starter_started');
   });
   await scenario('unavailable-rolling-content',async page=>{
    await control({rolling:'fail'});await page.goto(url);await ready(page);await draw(page,await page.evaluate(()=>currentGame.puzzle.answers[0].path));await page.waitForFunction(()=>currentGame.found.length===1);await eventOnce('starter_started');
   });
   await scenario('observable-startup-failure',async page=>{
    await control({failDatabase:true});await page.goto(url);await page.getByText('Nepodařilo se načíst databázi úloh.',{exact:false}).waitFor({state:'visible'});await eventOnce('starter_v1_failed');
   });
   if(health.baseline)await scenario('service-worker-upgrade',async(page,context)=>{
    await control({release:'baseline'});
    await context.addInitScript(()=>{if(!localStorage.getItem('fixture-initialized')){localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('fixture-initialized','1')}});
    await page.goto(url);await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000});
    const saved=await page.evaluate(()=>{const p=puzzleDB.free.easy[0],state=getState();state.completed[challengeKey('free',p,null)]={puzzleId:p.id,challengeKey:challengeKey('free',p,null),mode:'free',difficulty:'easy',level:p.meta.level,contentGeneration:4,elapsedMs:45000,moves:8,points:15,completedAt:'2026-09-14T10:00:00Z'};saveState(state);return JSON.stringify(state.completed)});
    const prior=await page.evaluate(()=>caches.keys());await control({release:'current'});
    await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update()});
    const match=fs.readFileSync(path.join(repo,'public/sw.js'),'utf8').match(/const SHELL_CACHE=['"]([^'"]+)/);assert(match);const shell=match[1];
    assert(!prior.includes(shell),'baseline and current service workers must have distinct shell versions');
    await eventually(async()=>{try{return await page.evaluate(async({expected,old})=>{const keys=await caches.keys();return keys.includes(expected)&&old.every(key=>!keys.includes(key))&&navigator.serviceWorker.controller?.state==='activated'},{expected:shell,old:prior.filter(key=>key.startsWith('proplet-v'))})}catch{return false}},'new worker never activated and removed its old shell',45000);
    await page.reload();await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&typeof getState==='function');
    assert.equal(await page.evaluate(()=>JSON.stringify(getState().completed)),saved,'old-to-new SW update preserves account-independent progress');
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);assert.equal(await page.evaluate(()=>JSON.stringify(getState().completed)),saved,'upgraded shell retains progress offline');await context.setOffline(false);
   },{serviceWorkers:true});
   else report.limitations=['Service-worker old-to-new scenario requires TEST_BASELINE_SHA with the baseline commit available locally.'];
  }
  report.finished=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({sha:report.sha,passed:report.checks.map(c=>c.name)}));
 }finally{await browser.close()}
})().catch(error=>{fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(error);process.exitCode=1});
