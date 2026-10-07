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
  for(const mobile of [false,true]){
   await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reset:true,firstSteps:true,firstBoardPolicy:policy})});
   const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
   await ctx.addInitScript(()=>localStorage.setItem('proplet-v3-15-anonymous-id','synthetic-2'));
   await ctx.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-10-07T00:00:00Z'));
   await page.goto(url);await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&document.querySelectorAll('#board .cell').length===9);
   async function solve(){
    const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
    const isStarter=await page.evaluate(()=>currentGame.mode==='starter');
    for(let i=0;i<paths.length;i++){
     if(isStarter){for(const index of paths[i])await page.locator('#board .cell[data-index="'+index+'"]').click();}
     else{
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
    await page.locator('#winModal').waitFor({state:'visible'});
   }
   await solve();assert.equal(await page.locator('#firstStepsAccount').isVisible(),false);
   await page.getByRole('button',{name:'Hrát dál',exact:true}).click();
   await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-009'&&!currentGame.finished);
   await page.locator('#winModal').waitFor({state:'hidden'});await solve();
   await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   const ev=(await fetch(url+'/__fixture/events').then(r=>r.json())).events;
   const phases=ev.filter(e=>e.event.startsWith('first_board_experiment_'));
   assert.equal(phases.length,3);assert(phases.every(e=>e.headers['x-proplet-puzzle']==='g4-e-009'&&e.headers['x-proplet-experiment-variant']==='challenger_e009'&&e.headers['x-proplet-experiment-policy']===policy));
   assert.equal(new Set(phases.map(e=>e.headers['x-proplet-first-steps-run'])).size,1);
   assert.equal(ev.filter(e=>e.event==='first_steps_v1_offer').length,1);
   assert.deepEqual(errors,[]);console.log('PASS '+(mobile?'mobile':'desktop')+' starter -> e009 -> account offer, consistent rollout telemetry');
   await ctx.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
