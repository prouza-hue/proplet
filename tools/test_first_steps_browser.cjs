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
let fixtureRun='';
const recording=()=>fetch(url+'/__fixture/events').then(r=>r.json()).then(data=>({...data,events:data.events.filter(e=>e.headers['x-proplet-fixture-run']===fixtureRun),requests:data.requests.filter(r=>r.headers['x-proplet-fixture-run']===fixtureRun)}));
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

async function tapCell(page,index,touch=false){
 const target=page.locator('#board .cell[data-index="'+index+'"]');
 if(!touch){await target.click();return;}
 const box=await target.boundingBox(),cdp=await page.context().newCDPSession(page);
 try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1,radiusX:3,radiusY:3,force:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}
}
async function starter(page,touch=false,style='drag'){
 const paths=[[0,1,2],[3,6,7],[4,5,8]];
 for(let n=0;n<paths.length;n++){
  if(style==='tap'||(style==='mixed'&&n!==1)){
   for(let k=0;k<paths[n].length;k++){
    await tapCell(page,paths[n][k],touch);
    if(k<paths[n].length-1){assert.equal(await page.evaluate(()=>currentGame.found.length),n);assert.deepEqual(await page.evaluate(()=>currentGame.path),paths[n].slice(0,k+1));assert.equal(await page.locator('#board .cell.active').count(),k+1);}
   }
  }else await draw(page,paths[n],touch);
  await page.waitForFunction(count=>currentGame.found.length===count,n+1);
  assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
 }
 await page.locator('#winModal').waitFor({state:'visible'});
 assert.equal((await events()).some(e=>e.event==='first_steps_v1_offer'),false,'starter is not first real win');
 for(const name of ['starter_v1_interaction','starter_v1_first_correct','starter_v1_completed','starter_completed','onboarding_completed'])await eventOnce(name);
 const ev=await events(),phases=['starter_v1_requested','starter_v1_data_ready','starter_v1_ready','starter_v1_interaction','starter_v1_first_correct','starter_v1_completed'];
 const records=phases.map(name=>ev.find(e=>e.event===name));assert(records.every(Boolean));
 const positions=records.map(e=>ev.indexOf(e));assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 assert(records.every(e=>e.headers['x-proplet-starter-run']));assert.equal(new Set(records.map(e=>e.headers['x-proplet-starter-run'])).size,1);assert.equal(new Set(records.map(e=>e.headers['x-proplet-client-release'])).size,1);
 assert(records.every(e=>e.headers['x-proplet-onboarding']==='board-v3-short'&&e.headers['x-proplet-auth-at-event']==='anonymous'));
 const elapsed=records.map(e=>Number(e.headers['x-proplet-starter-ms']));assert.deepEqual(elapsed,[...elapsed].sort((a,b)=>a-b));
}
async function assertAccountFlow(method){
 await eventOnce('first_steps_v1_saved');await eventOnce('account_created');
 const ev=await events(),names=['first_steps_v1_offer','first_steps_v1_'+method,'account_created','first_steps_v1_saved'];
 const rows=names.map(n=>ev.find(e=>e.event===n));
 const ids=rows.map(e=>e.headers['x-proplet-first-steps-run']);assert(ids.every(Boolean));assert.equal(new Set(ids).size,1);
 assert.equal(rows[2].headers['x-proplet-creation-source'],'first_steps_v1');assert(rows[2].authoritative);
 assert(rows.every(e=>e.headers['x-proplet-onboarding']==='board-v3-short'));
 const measured=[rows[0],rows[1],rows[3]];assert.equal(new Set(measured.map(e=>e.headers['x-proplet-experiment'])).size,1);assert.equal(new Set(measured.map(e=>e.headers['x-proplet-experiment-variant'])).size,1);
 const times=rows.map(e=>Date.parse(e.headers['x-proplet-event-time'])||e.at);
 // Batches may arrive after the authoritative signup event. Compare captured
 // client event times and retain the server-signup-before-saved assertion.
 const captured=measured.map(e=>Date.parse(e.headers['x-proplet-event-time'])||e.at);
 assert.deepEqual(captured,[...captured].sort((a,b)=>a-b));
 assert.equal(rows[1].headers['x-proplet-auth-at-event'],'anonymous');
 assert(ev.indexOf(rows[2])<ev.indexOf(rows[3]));
 assert((await recording()).requests.some(r=>r.path==='/api/anonymous/claim'));
}
async function ready(page){await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&currentGame.puzzle.meta.starterVersion===3&&document.querySelectorAll('#board .cell').length===9,null,{timeout:15000});await page.locator('#starterCoach').waitFor({state:'visible'});}
async function solve(page,touch=false){const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));for(let i=0;i<paths.length;i++){await draw(page,paths[i],touch);await page.waitForFunction(n=>currentGame.found.length===n,i+1);}await page.locator('#winModal').waitFor({state:'visible'});}
async function firstWin(page,touch=false,style='drag',boardId='g4-e-001'){await page.goto(url);await ready(page);await starter(page,touch,style);await page.screenshot({path:output+'.training-'+(touch?'mobile':'desktop')+'.png',fullPage:true});await page.getByRole('button',{name:'Hrát dál',exact:true}).click();await page.waitForFunction(expected=>currentGame?.mode==='free'&&currentGame.puzzle.id===expected&&!currentGame.finished,boardId);await page.locator('#winModal').waitFor({state:'hidden'});assert.match(await page.locator('#gameDifficulty').innerText(),/první hra/);await eventOnce('first_board_experiment_assigned');await eventOnce('first_board_experiment_started');await solve(page,touch);await eventOnce('first_board_experiment_completed');await page.locator('#firstStepsGoogle').waitFor({state:'visible'});}
(async()=>{
 const health=await fetch(url+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&!health.database);if(process.env.EXPECTED_SHA)assert.equal(health.sha,process.env.EXPECTED_SHA);report.sha=health.sha;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 async function scenario(name,fn,options={}){
  await control({reset:true,firstSteps:true});
  fixtureRun=crypto.randomUUID();
  const context=await browser.newContext({viewport:options.mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:!!options.mobile,hasTouch:!!options.mobile,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Fixture-Run':fixtureRun},...(options.userAgent?{userAgent:options.userAgent}:{})});
  // Consent UI has its own tests; it must not intercept the board gestures here.
  await context.addInitScript(identity=>{localStorage.setItem('proplet-v3-15-anonymous-id',identity);localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));},options.experimentIdentity||'synthetic-2');
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  const page=await context.newPage(),errors=[],warnings=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))warnings.push({type:m.type(),text:m.text()})});page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=500)network.push({url:r.url(),status:r.status()})});await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
  console.log('SCENARIO '+name);
  try{await fn(page,context);assert.deepEqual(errors,[]);await page.screenshot({path:output+'.'+name+'.png',fullPage:true});const localFailures=network.filter(r=>['127.0.0.1','localhost'].includes(new URL(r.url).hostname)&&r.error!=='net::ERR_ABORTED');if(name.startsWith('short-'))assert.deepEqual(localFailures,[],'no failed local request or 5xx');report.checks.push({name,ok:true,events:await events(),warnings,network});}
  catch(error){report.checks.push({name,ok:false,error:error.stack,errors});await page.screenshot({path:output+'.'+name+'.failed.png',fullPage:true}).catch(()=>{});console.error(name+': '+error.message);}
  finally{await page.evaluate(()=>productAnalytics()?.flush()).catch(()=>{});fs.writeFileSync(output,JSON.stringify(report,null,2));await context.close();}
 }
 try{
  for(const [mobile,style] of [[false,'drag'],[true,'drag'],[false,'tap'],[true,'tap'],[false,'mixed']])await scenario('short-'+(mobile?'touch':'mouse')+'-'+style+'-first-win',async page=>{
   await firstWin(page,mobile,style);
   await eventOnce('starter_completed');await eventOnce('onboarding_completed');await eventOnce('first_steps_v1_offer');
   const received=await events();assert(received.filter(e=>e.event.startsWith('starter_')).every(e=>e.headers['x-proplet-onboarding']==='board-v3-short'));
   assert.equal(await page.locator('#accountNudgeModal').isVisible(),false);assert.equal(await page.locator('#profileModal').isVisible(),false);
   const completed=await page.evaluate(()=>Object.keys(getState().completed).length);assert.equal(completed,2);
   await page.screenshot({path:output+'.'+(mobile?'mobile-offer':'desktop-offer')+'.png',fullPage:true});
   await page.getByRole('button',{name:'Hrát dál bez účtu',exact:true}).click();await page.waitForFunction(()=>currentGame?.mode==='free'&&!currentGame.finished&&currentGame.puzzle.id!=='g4-e-001');await eventOnce('first_steps_v1_continue');await eventOnce('first_steps_v1_offer');
   for(const id of ['accountNudgeModal','pushNudgeModal','installNudgeModal'])assert.equal(await page.locator('#'+id).isVisible(),false);
  },{mobile});
  await scenario('challenger-e009-first-win',async page=>{
   await firstWin(page,false,'tap','g4-e-009');
   const experiment=(await events()).filter(e=>e.event.startsWith('first_board_experiment_'));
   assert.equal(experiment.length,3);assert(experiment.every(e=>e.headers['x-proplet-experiment']==='first-board-v1'&&e.headers['x-proplet-experiment-variant']==='challenger_e009'&&e.headers['x-proplet-puzzle']==='g4-e-009'&&e.headers['x-proplet-first-steps-run']));
   await page.locator('#firstStepsManual').click();await page.locator('#playerNameInput').fill('Challenger Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
   await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});await assertAccountFlow('manual');
  },{experimentIdentity:'synthetic-0'});
  await scenario('tap-cancel-reset-navigation',async page=>{
   await page.goto(url);await ready(page);await tapCell(page,0);await tapCell(page,4);assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await tapCell(page,0);await tapCell(page,1);await tapCell(page,1);assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await tapCell(page,0);await page.evaluate(()=>document.querySelector('#board').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})));assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await tapCell(page,0);await page.evaluate(()=>resetGame());assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await tapCell(page,0);await page.locator('.onboarding-return-login').click();assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);await page.locator('#closeProfileModal').click();
   await tapCell(page,0);await page.evaluate(()=>nav('daily'));assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await page.evaluate(()=>startGame(currentGame.puzzle,'starter'));await ready(page);assert.deepEqual(await page.evaluate(()=>currentGame.path),[]);
   await tapCell(page,0);await tapCell(page,1);await tapCell(page,2);await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1})));
   assert.equal(await page.evaluate(()=>currentGame.found.length),1);assert.equal(await page.evaluate(()=>currentGame.moves),1);
  });
  await scenario('progressive-help',async page=>{
   await page.goto(url);await ready(page);await draw(page,[0,1,2]);await page.waitForFunction(()=>currentGame.found.length===1);
   await page.locator('#hintBtn').click();assert.equal(await page.locator('#hintModal').isVisible(),false);
   assert.equal(await page.locator('#board .starter-guide').count(),3);assert.equal(await page.evaluate(()=>currentGame.found.length),1,'help does not award the word');await eventOnce('first_steps_v1_assisted');
  });
  await scenario('manual-account-and-sync',async page=>{
   await firstWin(page);await page.locator('#firstStepsManual').click();await eventOnce('first_steps_v1_manual');await page.locator('#playerNameInput').fill('New Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
   await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#profileModal').isVisible(),false);assert.equal(await page.evaluate(()=>getQueue().length),0);await assertAccountFlow('manual');assert.equal(await page.locator('#rankingPrivacyModal').isVisible(),false);assert.equal(await page.locator('#mk100LaunchPreview:not(.hidden)').count(),0);
   await page.getByRole('button',{name:'Hrát další Proplet',exact:true}).click();await page.waitForFunction(()=>currentGame?.mode==='free'&&!currentGame.finished);await eventOnce('first_steps_v1_continue');assert.equal((await events()).find(e=>e.event==='first_steps_v1_continue').headers['x-proplet-onboarding'],'board-v3-short');
  });
  await scenario('google-direct-round-trip',async page=>{
   await firstWin(page);await page.locator('#firstStepsGoogle').click();await eventOnce('first_steps_v1_google');
   await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#profileModal').isVisible(),false);assert.equal(await page.evaluate(()=>getQueue().length),0);
   assert((await recording()).requests.some(r=>r.path==='/api/auth/google/start'));await assertAccountFlow('google');assert.equal(await page.locator('#rankingPrivacyModal').isVisible(),false);assert.equal(await page.locator('#mk100LaunchPreview:not(.hidden)').count(),0);
   assert.equal(await page.locator('#installNudgeModal').isVisible(),false);
  });
  await scenario('google-cancel-return',async page=>{
   await firstWin(page);await control({auth:'cancel'});await page.locator('#firstStepsGoogle').click();await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   await page.getByText('Přihlášení se nedokončilo. Zkus to znovu nebo hraj dál.',{exact:true}).waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),2);assert.equal(await page.evaluate(()=>!!getProfile()?.token),false);await eventOnce('first_steps_v1_auth_cancelled');assert(!(await events()).some(e=>['account_created','first_steps_v1_saved'].includes(e.event)));
  });
  await scenario('save-failure-is-not-success',async page=>{
   await firstWin(page);await control({result:'fail'});await page.locator('#firstStepsManual').click();await page.locator('#playerNameInput').fill('New Player');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();
   await page.getByText('Účet je připravený. Výsledek ještě čeká na uložení.',{exact:true}).waitFor({state:'visible',timeout:20000});
   await eventOnce('first_steps_v1_save_failed');assert(await page.evaluate(()=>getQueue().length>0));assert.equal((await events()).some(e=>e.event==='first_steps_v1_saved'),false);
   await control({result:'ok'});await page.clock.setFixedTime(new Date('2026-09-15T10:01:01Z'));await page.locator('#firstStepsRetry').click();await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible',timeout:20000});
  });
  await scenario('manual-cancel-and-embedded-alternative',async page=>{
   await firstWin(page);await page.locator('#firstStepsBrowserNote').waitFor({state:'visible'});
   await page.locator('#firstStepsManual').click();await page.locator('#closeProfileModal').click();await page.locator('#firstStepsGoogle').waitFor({state:'visible'});await eventOnce('first_steps_v1_auth_cancelled');assert(!(await events()).some(e=>['account_created','first_steps_v1_saved'].includes(e.event)));
   assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),2);
  },{mobile:true,userAgent:'Mozilla/5.0 (Linux; Android 15; wv) AppleWebKit/537.36 Chrome/133.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/500]'});
  for(const method of ['manual','google'])await scenario(method+'-auth-failed',async page=>{
   await firstWin(page);await control({auth:'fail'});
   await page.locator(method==='manual'?'#firstStepsManual':'#firstStepsGoogle').click();
   if(method==='manual'){await page.locator('#playerNameInput').fill('Synthetic failure');await page.locator('#playerPasswordInput').fill('fixture-password');await page.locator('#saveProfileBtn').click();}
   await eventOnce('first_steps_v1_auth_failed');assert(!(await events()).some(e=>['account_created','first_steps_v1_saved'].includes(e.event)));
   const e=(await events()).find(e=>e.event==='first_steps_v1_auth_failed');assert.equal(e.headers['x-proplet-first-steps-reason'],'request');
  });
  await scenario('test-run-remains-test',async page=>{
   await page.goto(url+'/?tutorial=1');await ready(page);await starter(page,false,'tap');
   assert((await events()).filter(e=>e.event.startsWith('starter_v1_')).every(e=>e.headers['x-proplet-test']==='1'));
  });
  await scenario('invitation-priority',async page=>{
   await page.goto(url+'/?play=g4-e-002&kind=free&t=45000&h=0&m=8');await ready(page);await solve(page);await page.locator('#winPrimaryBtn').click();await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-002');
  });
  await scenario('existing-player-keeps-progress',async(page,context)=>{
   await context.addInitScript(()=>localStorage.setItem('proplet-v3-7-required-onboarding','done'));await page.goto(url);await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB);assert.equal(await page.evaluate(()=>currentGame?.mode==='starter'),false);assert.equal(await page.locator('#winModal').isVisible(),false);
  });
  assert(report.checks.every(c=>c.ok),'All first-step browser scenarios must pass; see report');report.finished=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({sha:report.sha,passed:report.checks.map(c=>c.name)}));
 }finally{await browser.close();}
})().catch(error=>{fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(error);process.exitCode=1});



