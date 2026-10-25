'use strict';
// Real historical modules and workers on loopback; every API write is synthetic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:18775',legacy='958706b6286a2dd7099fa8e3ceb097b757b507e7';
const reporterRelease=fs.readFileSync(path.join(root,'public/app/client-diagnostics.js'),'utf8').match(/REPORTER_RELEASE='([^']+)'/)[1];
const historical=(sha,file)=>execFileSync('git',['show',sha+':public/'+file],{cwd:root,encoding:'utf8',maxBuffer:1024*1024});
const oldTeam=historical('c2501bc31fcb5c4da4c8fa3d5932ad910c8f432b','team-victories.js');
const oldHints=historical('07350e5','app/game/hints.js'),beforeAccount=historical('9f8ae24','app/account/account.js'),beforeApp=historical('9f8ae24','app.js');
const profile={id:'onboarding-synthetic',name:'Fixture Player',token:'fixture-token-not-a-credential',avatar:'🙂',hasPassword:true,supportMode:'none'};
const fixture=spawn(process.execPath,['tools/onboarding_fixture_server.cjs'],{cwd:root,env:{...process.env,PORT:'18775',TEST_BASELINE_SHA:legacy},stdio:['ignore','pipe','pipe']});
let log='';fixture.stdout.on('data',s=>log+=s);fixture.stderr.on('data',s=>log+=s);
const checks=[];
async function control(value){assert((await fetch(base+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)})).ok)}
async function context(browser,{width=1280,height=900,sw=false}={}){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:width<800,hasTouch:width<800,serviceWorkers:sw?'allow':'block',extraHTTPHeaders:{'X-Proplet-Test':'1'}});
 await ctx.addInitScript(profile=>{window.__contractReady=false;document.addEventListener('proplet:ready',()=>window.__contractReady=true);
  if(!localStorage.getItem('proplet-v2-profile'))localStorage.setItem('proplet-v2-profile',JSON.stringify(profile));
  localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
 },profile);
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());return ctx;
}
async function load(ctx,ready=true){const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));await page.goto(base);await page.waitForFunction(()=>typeof renderProfile==='function');if(ready)await page.waitForFunction(()=>window.__contractReady&&!document.documentElement.classList.contains('proplet-current-ui-booting'));return {page,errors}}
async function profilePage(page){await page.evaluate(()=>{document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));applyScreen('profile');renderProfile()});await page.locator('#profileCard').waitFor();await page.locator('#profileCard .profile-name').waitFor();assert.equal(await page.locator('#logoutBtn').count(),1,'logout remains available in account settings, which can be collapsed');assert.equal(await page.locator('#syncBtn').count(),1)}
async function hintClose(page){await page.evaluate(()=>{document.querySelector('#hintModal').classList.remove('hidden');document.querySelector('#closeHintModal').click()});assert(await page.locator('#hintModal').evaluate(el=>el.classList.contains('hidden')))}
(async()=>{let browser;try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 for(const signature of ['renderProfile','closeModal']){
  await control({reset:true});const ctx=await context(browser);
  if(signature==='renderProfile'){await ctx.route('**/app/account/account.js*',r=>r.fulfill({contentType:'text/javascript',body:beforeAccount}));await ctx.route('**/team-victories.js*',r=>r.fulfill({contentType:'text/javascript',body:oldTeam}))}
  else{await ctx.route('**/app.js*',r=>r.fulfill({contentType:'text/javascript',body:beforeApp}));await ctx.route('**/app/game/hints.js*',r=>r.fulfill({contentType:'text/javascript',body:oldHints}))}
  const {page,errors}=await load(ctx,signature!=='renderProfile');
  if(signature==='closeModal')await page.evaluate(()=>document.querySelector('#closeHintModal').click());
  await page.waitForFunction(()=>true);assert(errors.some(e=>e.includes(signature)),JSON.stringify(errors));
  checks.push('BASELINE actual historical module reproduces '+signature);await ctx.close();
 }
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:673,height:841}]){
  console.log('CHECK mixed modules '+viewport.width);await control({reset:true});const ctx=await context(browser,viewport);let stale=true;
  await ctx.route('**/team-victories.js*',r=>stale?r.fulfill({contentType:'text/javascript',body:oldTeam}):r.continue());
  await ctx.route('**/app/game/hints.js*',r=>stale?r.fulfill({contentType:'text/javascript',body:oldHints}):r.continue());
  const {page,errors}=await load(ctx);await profilePage(page);assert.equal(await page.locator('#profileTeamContractStatus button').count(),1);
  const stored=await page.evaluate(()=>localStorage.getItem('proplet-v2-profile'));
  await page.evaluate(()=>{renderProfile();renderProfile()});
  await hintClose(page);
  // An already-open old modal can still apply a single hint through its valid controller.
  const result=await page.evaluate(async()=>{
   const puzzle=puzzleDB.free.easy[0];await startGame(puzzle,'free');
   const before=currentGame,prior=before.hints||0;document.querySelector('#hintModal').classList.remove('hidden');applySmartHint(1);
   const after={same:currentGame===before,hints:currentGame.hints-prior};
   window.PropletGameHints={create:1,closeModal:1};gameHintsController=null;
   const hints=currentGame.hints;applySmartHint(1);return {...after,invalidPreserved:currentGame===before&&currentGame.hints===hints};
  });assert.deepEqual(result,{same:true,hints:1,invalidPreserved:true});
  const rows=(await fetch(base+'/__fixture/events').then(r=>r.json())).requests.filter(r=>r.path==='/api/client-error');
  assert.equal(rows.filter(r=>r.body.code==='team_victories_contract').length,1,'re-renders do not spam telemetry');
  // Producer identifies app.js; reporter identifies the independently cached
  // diagnostic transport. They need not have the same release suffix.
  for(const row of rows){assert.equal(row.body.client_release,row.headers['x-proplet-client-release']);assert.equal(row.body.client_release,await page.evaluate(()=>APP_PREVIEW_RELEASE));assert.equal(row.body.reporter_release,reporterRelease);assert.equal(row.body.source_availability,'available');assert.equal(row.body.is_test,true)}
  // User-triggered repair uses the existing safe update path, not cache/storage deletion.
  await profilePage(page);stale=false;
  await Promise.all([page.waitForEvent('load'),page.locator('#profileTeamContractStatus button').click()]);
  await page.waitForFunction(()=>window.__contractReady&&!document.documentElement.classList.contains('proplet-current-ui-booting'));
  await profilePage(page);await page.locator('#profileTeamVictories').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('proplet-v2-profile')),stored);
  await hintClose(page);assert.deepEqual(errors,[]);checks.push('PASS mixed historical modules, explicit repair, real hints/profile '+viewport.width);await ctx.close();
 }
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:673,height:841}]){
  console.log('CHECK actual 4.09.9 worker upgrade '+viewport.width);await control({reset:true,release:'baseline'});
  const ctx=await context(browser,{...viewport,sw:true}),{page,errors}=await load(ctx);await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const old=await page.evaluate(()=>APP_PREVIEW_RELEASE);assert.equal(old,'proplet-v4.09.9-mama1');
  await page.evaluate(()=>{const s=getState();s.completed['free:g4-e-001']={puzzleId:'g4-e-001',mode:'free',difficulty:'easy',elapsedMs:30000,points:15,completedAt:'2026-09-15T09:00:00Z'};s.inProgress['free:g4-e-009']={puzzleId:'g4-e-009',mode:'free',difficulty:'easy',found:[],hints:2,moves:3,elapsedMs:2500};saveState(s)});
  const snapshot=await page.evaluate(()=>({profile:localStorage.getItem('proplet-v2-profile'),completed:getState().completed['free:g4-e-001'],inProgress:getState().inProgress['free:g4-e-009']}));
  await control({release:'current'});await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update()});
  await page.waitForFunction(old=>typeof APP_PREVIEW_RELEASE!=='undefined'&&APP_PREVIEW_RELEASE!==old,old,{timeout:45000});await page.waitForFunction(()=>window.__contractReady&&!document.documentElement.classList.contains('proplet-current-ui-booting'));
  await profilePage(page);await page.locator('#profileTeamVictories').waitFor();
  assert.deepEqual(await page.evaluate(()=>({profile:localStorage.getItem('proplet-v2-profile'),completed:getState().completed['free:g4-e-001'],inProgress:getState().inProgress['free:g4-e-009']})),snapshot);
  await page.evaluate(async()=>{await startGame(puzzleDB.free.easy[0],'free');openHintModal()});await page.locator('#hintModal').waitFor();await page.locator('#closeHintModal').click();assert(await page.locator('#hintModal').evaluate(el=>el.classList.contains('hidden')));
  assert.deepEqual(errors,[]);checks.push('PASS real 4.09.9 SW -> current, profile/hints, account/completion/in-progress unchanged '+viewport.width);await ctx.close();
 }
 fs.mkdirSync(path.join(root,'browser-results'),{recursive:true});fs.writeFileSync(path.join(root,'browser-results/module-contracts.json'),JSON.stringify({synthetic:true,productionRequests:0,checks},null,2));console.log(JSON.stringify(checks,null,2));
}finally{if(browser)await browser.close();fixture.kill()}})().catch(e=>{console.error(e);console.error(log);fixture.kill();process.exitCode=1});
