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
async function draw(page,indices,touch=false){
 const coordinates=[];for(const i of indices){const box=await page.locator('#screen-game .cell[data-index="'+i+'"]').boundingBox();assert(box,'board cell exists');coordinates.push({x:box.x+box.width/2,y:box.y+box.height/2})}
 if(touch){
  const cdp=await page.context().newCDPSession(page);
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...coordinates[0],id:1,radiusX:3,radiusY:3,force:1}]});for(const point of coordinates.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1,radiusX:3,radiusY:3,force:1}]});await page.waitForTimeout(55)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}finally{await cdp.detach()}
 }else{
  await page.mouse.move(coordinates[0].x,coordinates[0].y);await page.mouse.down();for(const point of coordinates.slice(1)){await page.mouse.move(point.x,point.y,{steps:3});await page.waitForTimeout(45)}await page.mouse.up();
 }
}

async function ready(page){await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&currentGame.puzzle.meta.starterVersion===3&&document.querySelectorAll('#board .cell').length===9,null,{timeout:15000});await page.locator('#starterCoach').waitFor({state:'visible'});}
async function solve(page,touch=false){const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));for(let i=0;i<paths.length;i++){await draw(page,paths[i],touch);await page.waitForFunction(n=>currentGame.found.length===n,i+1);}await page.locator('#winModal').waitFor({state:'visible'});}
async function firstWin(page,touch=false){await page.goto(url);await ready(page);await solve(page,touch);await page.getByRole('button',{name:'Hrát první hru',exact:true}).click();await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-001'&&!currentGame.finished);await page.locator('#winModal').waitFor({state:'hidden'});await solve(page,touch);await page.locator('#firstStepsGoogle').waitFor({state:'visible'});}
(async()=>{
 const health=await fetch(url+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&!health.database);if(process.env.EXPECTED_SHA)assert.equal(health.sha,process.env.EXPECTED_SHA);report.sha=health.sha;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 async function scenario(name,fn,options={}){
  await control({reset:true,firstSteps:true});
  const context=await browser.newContext({viewport:options.mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:!!options.mobile,hasTouch:!!options.mobile,serviceWorkers:'block',...(options.userAgent?{userAgent:options.userAgent}:{})});
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
  console.log('SCENARIO '+name);
  try{await fn(page,context);assert.deepEqual(errors,[]);await page.screenshot({path:output+'.'+name+'.png',fullPage:true});report.checks.push({name,ok:true,events:await events()});}
  catch(error){report.checks.push({name,ok:false,error:error.stack,errors});await page.screenshot({path:output+'.'+name+'.failed.png',fullPage:true}).catch(()=>{});console.error(name+': '+error.message);}
  finally{fs.writeFileSync(output,JSON.stringify(report,null,2));await context.close();}
 }
 try{
  for(const mobile of [false,true])await scenario(mobile?'short-touch-first-win':'short-mouse-first-win',async page=>{
   await firstWin(page,mobile);
   await eventOnce('starter_completed');await eventOnce('onboarding_completed');await eventOnce('first_steps_v1_offer');
   const received=await events();assert(received.filter(e=>e.event.startsWith('starter_')).every(e=>e.headers['x-proplet-onboarding']==='board-v3-short'));
   assert.equal(await page.locator('#accountNudgeModal').isVisible(),false);assert.equal(await page.locator('#profileModal').isVisible(),false);
   const completed=await page.evaluate(()=>Object.keys(getState().completed).length);assert.equal(completed,2);
   await page.screenshot({path:output+'.'+(mobile?'mobile-offer':'desktop-offer')+'.png',fullPage:true});
   await page.getByRole('button',{name:'Hrát dál bez účtu',exact:true}).click();await page.waitForFunction(()=>currentGame?.mode==='free'&&!currentGame.finished&&currentGame.puzzle.id!=='g4-e-001');
   for(const id of ['accountNudgeModal','pushNudgeModal','installNudgeModal'])assert.equal(await page.locator('#'+id).isVisible(),false);
  },{mobile});
  await scenario('progressive-help',async page=>{
   await page.goto(url);await ready(page);await draw(page,[0,1,2]);await page.waitForFunction(()=>currentGame.found.length===1);
   await page.locator('#hintBtn').click();assert.equal(await page.locator('#hintModal').isVisible(),false);
   assert.equal(await page.locator('#board .starter-guide').count(),3);assert.equal(await page.evaluate(()=>currentGame.found.length),1,'help does not award the word');await eventOnce('first_steps_v1_assisted');
  });
  await scenario('manual-account-and-sync',async page=>{
   await firstWin(page);await page.locator('#firstStepsManual').click();await page.locator('#playerNameInput').fill('New Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
   await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#profileModal').isVisible(),false);assert.equal(await page.evaluate(()=>getQueue().length),0);await eventOnce('first_steps_v1_saved');assert.equal(await page.locator('#rankingPrivacyModal').isVisible(),false);assert.equal(await page.locator('#contentReleaseModal[open]').count(),0);
   await page.getByRole('button',{name:'Hrát další Proplet',exact:true}).click();await page.waitForFunction(()=>currentGame?.mode==='free'&&!currentGame.finished);
  });
  await scenario('google-direct-round-trip',async page=>{
   await firstWin(page);await page.locator('#firstStepsGoogle').click();
   await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#profileModal').isVisible(),false);assert.equal(await page.evaluate(()=>getQueue().length),0);
   assert((await recording()).requests.some(r=>r.path==='/api/auth/google/start'));await eventOnce('first_steps_v1_saved');assert.equal(await page.locator('#rankingPrivacyModal').isVisible(),false);assert.equal(await page.locator('#contentReleaseModal[open]').count(),0);
   assert.equal(await page.locator('#installNudgeModal').isVisible(),false);
  });
  await scenario('google-cancel-return',async page=>{
   await firstWin(page);await control({auth:'cancel'});await page.locator('#firstStepsGoogle').click();await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   await page.getByText('Přihlášení se nedokončilo. Zkus to znovu nebo hraj dál.',{exact:true}).waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),2);assert.equal(await page.evaluate(()=>!!getProfile()?.token),false);
  });
  await scenario('save-failure-is-not-success',async page=>{
   await firstWin(page);await control({result:'fail'});await page.locator('#firstStepsManual').click();await page.locator('#playerNameInput').fill('New Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
   await page.getByText('Účet je připravený. Výsledek ještě čeká na uložení.',{exact:true}).waitFor({state:'visible',timeout:20000});
   assert(await page.evaluate(()=>getQueue().length>0));assert.equal((await events()).some(e=>e.event==='first_steps_v1_saved'),false);
   await control({result:'ok'});await page.locator('#firstStepsRetry').click();await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
  });
  await scenario('manual-cancel-and-embedded-alternative',async page=>{
   await firstWin(page);await page.locator('#firstStepsBrowserNote').waitFor({state:'visible'});
   await page.locator('#firstStepsManual').click();await page.locator('#closeProfileModal').click();await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),2);
  },{mobile:true,userAgent:'Mozilla/5.0 (Linux; Android 15; wv) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/500]'});
  await scenario('invitation-priority',async page=>{
   await page.goto(url+'/?play=g4-e-002&kind=free&t=45000&h=0&m=8');await ready(page);await solve(page);await page.locator('#winPrimaryBtn').click();await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-002');
  });
  await scenario('existing-player-keeps-progress',async(page,context)=>{
   await context.addInitScript(()=>localStorage.setItem('proplet-v3-7-required-onboarding','done'));await page.goto(url);await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false);assert.equal(await page.locator('#winModal').isVisible(),false);
  });
  assert(report.checks.every(c=>c.ok),'All first-step browser scenarios must pass; see report');report.finished=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({sha:report.sha,passed:report.checks.map(c=>c.name)}));
 }finally{await browser.close();}
})().catch(error=>{fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(error);process.exitCode=1});
