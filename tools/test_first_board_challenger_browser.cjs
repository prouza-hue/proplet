'use strict';
// Actual unchanged browser client against loopback-only synthetic HTTP APIs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:18768';
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const policy='challenger_rollout_20261007';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const {mobile,variant,width} of [
   {mobile:false,variant:null,width:1440},{mobile:true,variant:null,width:390},
   {mobile:true,variant:'A',width:390},{mobile:true,variant:'B',width:344}
  ]){
   await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reset:true,firstSteps:true,firstBoardPolicy:policy,entryVariant:variant})});
   const fixtureRun=crypto.randomUUID();
   const ctx=await browser.newContext({viewport:mobile?{width,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Fixture-Run':fixtureRun}});
   // Keep consent UI out of pointer scenarios, using a date before the fixed fixture clock.
   await ctx.addInitScript(()=>{if(!localStorage.getItem('proplet-v3-15-anonymous-id'))localStorage.setItem('proplet-v3-15-anonymous-id','synthetic-2');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.parse('2026-09-15T09:00:00Z')}));});
   await ctx.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-10-07T00:00:00Z'));
   await page.goto(url);if(variant!=='B')await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&document.querySelectorAll('#board .cell').length===9);
   async function solve(start=0,end){
    const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
    const isStarter=await page.evaluate(()=>currentGame.mode==='starter');
    for(let i=start;i<(end??paths.length);i++){
     if(isStarter){for(const index of paths[i])await page.locator('#board .cell[data-index="'+index+'"]').click();}
     else{
      await page.locator('#board .cell[data-index="'+paths[i][0]+'"]').click({trial:true});
      const points=[];
      for(const index of paths[i]){const b=await page.locator('#board .cell[data-index="'+index+'"]').boundingBox();points.push({x:b.x+b.width/2,y:b.y+b.height/2});}
      if(mobile){
       const cdp=await ctx.newCDPSession(page);
       await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1,radiusX:3,radiusY:3,force:1}]});
       for(const p of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1,radiusX:3,radiusY:3,force:1}]});await page.waitForTimeout(45);}
       await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1)){await page.mouse.move(p.x,p.y,{steps:3});await page.waitForTimeout(45);}await page.mouse.up();}
     }
     await page.waitForFunction(n=>currentGame.found.length===n,i+1);
    }
    if(end===undefined)await page.locator('#winModal').waitFor({state:'visible'});
   }
   if(variant!=='B'){await solve();assert.equal(await page.locator('#firstStepsAccount').isVisible(),false);
   await page.getByRole('button',{name:'Hrát dál',exact:true}).click();}
   await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-009'&&!currentGame.finished);
   await page.locator('#winModal').waitFor({state:'hidden'});
   await page.locator('#hintBtn').waitFor({state:'visible'});
   if(variant==='B'){
    assert.equal(await page.locator('#firstStepsAccount').isVisible(),false);
    await solve(0,1);
    const attempt=await page.evaluate(()=>currentGame.attemptId);
    // Turning off recruitment must not switch returning B into training.
    await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryVariant:null})});
    await page.clock.setFixedTime(new Date('2026-10-08T00:01:00Z'));
    await page.reload();
    await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-009');
    await page.locator('#hintBtn').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>currentGame.attemptId),attempt);
    assert.equal(await page.evaluate(()=>currentGame.found.length),1);
    const fresh=await browser.newContext({serviceWorkers:'block'});
    await fresh.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    const newcomer=await fresh.newPage();
    await newcomer.goto(url);
    await newcomer.waitForFunction(()=>currentGame?.mode==='starter'&&currentGame.puzzle.answers.length===3);
    await fresh.close();
   }
   await solve(variant==='B'?1:0);
   await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   // Poll the awaited server response: async predicates passed to browser
   // waitForFunction can appear truthy before their HTTP result is available.
   const deadline=Date.now()+15000;let ev=[];
   do{
    ev=(await fetch(url+'/__fixture/events').then(r=>r.json())).events.filter(e=>e.headers['x-proplet-fixture-run']===fixtureRun);
    if(ev.some(e=>e.event==='first_steps_v1_offer')&&ev.filter(e=>e.event.startsWith('first_board_experiment_')).length===3)break;
    await new Promise(resolve=>setTimeout(resolve,100));
   }while(Date.now()<deadline);
   const phases=ev.filter(e=>e.event.startsWith('first_board_experiment_'));
   assert.equal(phases.length,3);assert(phases.every(e=>e.headers['x-proplet-puzzle']==='g4-e-009'&&e.headers['x-proplet-experiment-variant']==='challenger_e009'&&e.headers['x-proplet-experiment-policy']===policy));
   assert.equal(new Set(phases.map(e=>e.headers['x-proplet-first-steps-run'])).size,1);
   assert.equal(ev.filter(e=>e.event==='first_steps_v1_offer').length,1);
   if(variant){
    const tracked=ev.filter(e=>['first_board_experiment_started','first_board_experiment_completed','first_steps_v1_offer'].includes(e.event));
    assert(tracked.every(e=>e.headers['x-proplet-entry-variant']===variant));
    assert.equal(ev.some(e=>e.event.startsWith('starter_v1_')),variant==='A');
    assert.equal(ev.some(e=>e.event==='onboarding_started'||e.event==='starter_started'||e.event==='starter_completed'),variant==='A');
    const firstAttempt=await page.evaluate(()=>currentGame.attemptId);
    assert(tracked.every(e=>e.headers['x-proplet-run']===firstAttempt));
    assert.equal(await page.evaluate(()=>!!getState().completed['starter:starter-v1']),variant==='A');
    await page.locator('#firstStepsManual').click();
    await page.locator('#playerNameInput').fill('Entry fixture');
    await page.locator('#playerPasswordInput').fill('fixture-password');
    await page.locator('#saveProfileBtn').click();
    await page.getByText('Postup je uložený v účtu. Můžeš hrát dál.',{exact:true}).waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>getQueue().length),0);
   }
   assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'mobile':'desktop')+' '+(variant||'ordinary flow')+' -> e009 -> account offer, consistent rollout telemetry');
   await ctx.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

