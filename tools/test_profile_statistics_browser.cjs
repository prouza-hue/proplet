'use strict';
// Real app/profile/worker on loopback. Synthetic API fixtures only; no production traffic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),port=18774,base='http://127.0.0.1:'+port;
const legacy='03218aed07b44fb4b3e4c1d0a4d4fb3f144ed813';
const before=execFileSync('git',['show','c2501bc31fcb5c4da4c8fa3d5932ad910c8f432b:public/app/account/account.js'],{cwd:root,encoding:'utf8'});
const profile={id:'onboarding-synthetic',name:'Fixture Player',token:'fixture-token-not-a-credential',avatar:'🙂',hasPassword:true,supportMode:'none'};
const fixture=spawn(process.execPath,['tools/onboarding_fixture_server.cjs'],{cwd:root,env:{...process.env,PORT:String(port),TEST_BASELINE_SHA:legacy},stdio:['ignore','pipe','pipe']});
let fixtureLog='';fixture.stdout.on('data',s=>fixtureLog+=s);fixture.stderr.on('data',s=>fixtureLog+=s);
const checks=[];
async function control(value){const r=await fetch(base+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});assert(r.ok);}
async function context(browser,{guest=false,touch=false,serviceWorkers='block'}={}){
 const ctx=await browser.newContext({serviceWorkers,viewport:touch?{width:390,height:844}:{width:1280,height:900},isMobile:touch,hasTouch:touch,extraHTTPHeaders:{'X-Proplet-Test':'1'}});
 await ctx.addInitScript(({profile,guest})=>{
  window.__profileTestReady=false;
  document.addEventListener('proplet:ready',()=>window.__profileTestReady=true);
  if(!guest&&!localStorage.getItem('proplet-v2-profile'))localStorage.setItem('proplet-v2-profile',JSON.stringify(profile));
  localStorage.setItem('profile-repair-preserve','keep-progress');
  localStorage.setItem('proplet-v3-7-required-onboarding','done');
  localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  window.PROPLET_FIRST_STEPS_ENABLED=false;
 },{profile,guest});
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 return ctx;
}
async function pageIn(ctx,{ready=true}={}){
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof renderProfile==='function'&&typeof getState==='function');
 if(ready)await page.waitForFunction(()=>window.__profileTestReady&&!document.documentElement.classList.contains('proplet-current-ui-booting'));
 return {page,errors};
}
async function openProfile(page){
 await page.evaluate(()=>{document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));applyScreen('profile');renderProfile();});
 await page.locator('#profileCard').waitFor({state:'visible'});
}
async function openStatistics(page){
 const details=page.locator('#profileCard .profile-stats-details');
 await details.waitFor({state:'visible'});
 if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click();
 await page.locator('.profile-ledger-count').first().waitFor({state:'visible'});
}
async function omitStatistics(ctx){
 await ctx.route(base+'/',async route=>{
  const response=await route.fetch();let html=await response.text();
  html=html.replace(/<script[^>]+src="[^"]*\/app\/account\/statistics\.js[^"]*"[^>]*><\/script>/g,'');
  await route.fulfill({response,body:html});
 });
}
(async()=>{
 let browser;
 try{
  for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  await control({reset:true});
  // Exact previous account module under an older document reproduces the production signature.
  {
   const ctx=await context(browser);await omitStatistics(ctx);
   await ctx.route('**/app/account/account.js*',r=>r.fulfill({contentType:'text/javascript',body:before}));
   const {page,errors}=await pageIn(ctx,{ready:false});let thrown='';
   try{await openProfile(page);}catch(e){thrown=String(e);}
   assert(/calculate/.test(thrown+' '+errors.join(' ')),'baseline must reproduce missing statistics.calculate: '+JSON.stringify({thrown,errors,loaded:await page.evaluate(()=>!!window.PropletProfileStatistics)}));
   checks.push('BASELINE reproduced statistics.calculate with previous account module and cached document');await ctx.close();
  }
  // Recovery must not block account controls, duplicate requests, or fabricate zero totals.
  for(const mode of ['delayed','failed','guest','normal','normal-touch']){
   console.log('CHECK real profile '+mode);
   await control({reset:true});
   const ctx=await context(browser,{guest:mode==='guest',touch:mode==='normal-touch'});let requests=0,release;
   if(!mode.startsWith('normal'))await omitStatistics(ctx);
   let retry=false;
   // Two independent profile sections may both offer recovery. Exercise both
   // failures and target the statistics control without relying on page-wide text.
   if(mode==='failed')await ctx.route('**/api/team-victories/personal',route=>route.fulfill({status:503,json:{detail:'synthetic trophy outage'}}));
   if(mode==='delayed'||mode==='failed')await ctx.route('**/app/account/statistics.js*',async route=>{
    requests++;
    if(mode==='delayed')await new Promise(resolve=>release=resolve);
    if(mode==='failed'&&!retry)return route.fulfill({status:503,body:'synthetic dependency outage'});
    return route.continue();
   });
   const {page,errors}=await pageIn(ctx);await openProfile(page);
   if(mode==='guest'){
    assert.equal(await page.locator('#profileCreateBtn').count(),1);
    // Guests now see their local statistics and recover the same dependency.
    await openStatistics(page);
    assert.equal(await page.evaluate(()=>!!window.PropletProfileStatistics),true);
    assert.equal(await page.evaluate(()=>getProfile()),null);
    assert.equal(await page.locator('.profile-ledger-count').first().innerText(),'0');
    assert.match(await page.locator('#profileCard').innerText(),/Postup je uložený v tomto zařízení/);
   }else if(mode==='delayed'){
    await page.locator('[data-profile-statistics-status]').waitFor();
    assert.match(await page.locator('#profileCard').innerText(),/Fixture Player/);
    assert.equal(await page.locator('#logoutBtn').count(),1);
    await page.evaluate(()=>{renderProfile();renderProfile();});
    assert.equal(requests,1,'concurrent renders share a single recovery request');
    assert.equal(await page.locator('.profile-ledger-count').count(),0,'unavailable statistics are not displayed as zero');
    release();await openStatistics(page);
   }else if(mode==='failed'){
    await page.locator('#retryProfileStatistics').waitFor();
    await page.locator('#profileTeamVictories [data-tv-personal-retry]').waitFor();
    await page.waitForFunction(()=>!document.querySelector('#retryProfileStatistics').disabled);
    assert.match(await page.locator('#profileCard').innerText(),/uložený postup zůstává/);
    await page.evaluate(()=>{renderProfile();renderProfile();});assert.equal(requests,1,'failure does not create an automatic retry loop');
    retry=true;await page.locator('#retryProfileStatistics').click();
    await openStatistics(page);assert.equal(requests,2);
   }
   if(mode!=='guest'){
    await page.evaluate(()=>{const s=getState();saveState({...s,completed:{...s.completed,'free:g4-e-001':{puzzleId:'g4-e-001',mode:'free',difficulty:'easy',elapsedMs:30000,completedAt:'2026-09-15T09:00:00Z'}}});renderProfile();});
    await openStatistics(page);
    assert.match(await page.locator('.profile-ledger-count').first().innerText(),/1/);
    await page.locator('[data-stat-mode="daily"]').click();
    assert.equal(await page.locator('[data-stat-mode="daily"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-stat-mode="free"]').click();
    assert.equal(await page.locator('.profile-ledger-count').first().innerText(),'1');
    assert.equal(await page.locator('#syncBtn').count(),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('profile-repair-preserve')),'keep-progress');
    assert.equal(await page.evaluate(()=>getProfile()?.id),profile.id);
   }
   assert.deepEqual(errors,[],mode+' has no uncaught JS exceptions');
   checks.push('PASS real profile '+mode+': controls, statistics recovery/mode switch, identity and local progress preserved');await ctx.close();
  }
  // Real historical worker -> current worker, not a mocked reload or cleared browser profile.
  {
   await control({reset:true,release:'baseline'});
   const ctx=await context(browser,{serviceWorkers:'allow'}),{page,errors}=await pageIn(ctx);
   await page.waitForFunction(()=>navigator.serviceWorker.controller);
   const old=await page.evaluate(()=>APP_PREVIEW_RELEASE);
   assert.equal(old,'proplet-v4.05.3-firstgame-telemetry1');
   await openProfile(page);
   await page.evaluate(()=>{const s=getState();s.completed['free:g4-e-001']={puzzleId:'g4-e-001',mode:'free',difficulty:'easy',elapsedMs:30000,points:15,completedAt:'2026-09-15T09:00:00Z'};saveState(s);});
   const completed=await page.evaluate(()=>getState().completed['free:g4-e-001']);
   const stored=await page.evaluate(()=>localStorage.getItem('proplet-v2-profile'));
   await control({release:'current'});
   await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
   await page.waitForFunction(old=>typeof APP_PREVIEW_RELEASE!=='undefined'&&APP_PREVIEW_RELEASE!==old,old,{timeout:45000});
   // The new script marker exists before boot finishes. Wait for the actual
   // ready boundary so initNavigation cannot race the profile click in CI.
   await page.waitForFunction(()=>window.__profileTestReady&&!document.documentElement.classList.contains('proplet-current-ui-booting'));
   await openProfile(page);await openStatistics(page);
   assert.equal(await page.evaluate(()=>localStorage.getItem('proplet-v2-profile')),stored);
   assert.equal(await page.evaluate(()=>localStorage.getItem('profile-repair-preserve')),'keep-progress');
   assert.deepEqual(await page.evaluate(()=>getState().completed['free:g4-e-001']),completed,'actual game completion survives the PWA update');
   assert.equal(await page.locator('.profile-ledger-count').first().innerText(),'1');
   assert.deepEqual(errors,[],'historical PWA upgrade has no JS errors');
   checks.push('PASS actual 4.05.3 service worker -> current client: profile/statistics render and account/local storage retained');await ctx.close();
  }
  const evidence={synthetic:true,productionRequests:0,checks};
  const output=process.env.PROFILE_RESULT_PATH||'browser-results/profile-statistics.json';
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
 }finally{if(browser)await browser.close();fixture.kill();}
})().catch(e=>{console.error(e);console.error(fixtureLog);fixture.kill();process.exitCode=1});


