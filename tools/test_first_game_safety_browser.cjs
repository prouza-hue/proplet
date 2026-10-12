'use strict';
// Loopback-only real client regression; all synthetic traffic carries X-Proplet-Test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.TEST_URL||'http://127.0.0.1:18769';
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const output=process.env.RESULT_PATH||'browser-results/first-game-safety.json';fs.mkdirSync(require('node:path').dirname(output),{recursive:true});
const report={checks:[],synthetic:true};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const mobile of [false,true]){
   await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reset:true,firstSteps:true,firstBoardPolicy:'challenger_rollout_20261007'})});
   const run=crypto.randomUUID(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Test':'1','X-Proplet-Fixture-Run':run}});
   await context.addInitScript(()=>localStorage.setItem('proplet-v3-15-anonymous-id','synthetic-first-game-safety'));
   await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
   await page.goto(url);await page.waitForFunction(()=>currentGame?.mode==='starter'&&document.querySelectorAll('#board .cell').length===9);
   async function solve(){
    const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path)),training=await page.evaluate(()=>currentGame.mode==='starter');
    for(let n=0;n<paths.length;n++){
     if(training){for(const i of paths[n])await page.locator('#board .cell[data-index="'+i+'"]').click();}
     else{
      const points=[];for(const i of paths[n]){const b=await page.locator('#board .cell[data-index="'+i+'"]').boundingBox();points.push({x:b.x+b.width/2,y:b.y+b.height/2});}
      if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});for(const p of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await page.waitForTimeout(40);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1)){await page.mouse.move(p.x,p.y,{steps:3});await page.waitForTimeout(40);}await page.mouse.up();}
     }
     try{await page.waitForFunction(count=>currentGame.found.length===count,n+1,{timeout:10000});}
     catch(error){report.failure={mobile,word:n,errors,game:await page.evaluate(()=>({mode:currentGame.mode,id:currentGame.puzzle.id,found:currentGame.found,path:currentGame.path,paused:currentGame.pausedAt,finished:currentGame.finished,modal:document.querySelector('#winModal').className}))};await page.screenshot({path:output+'.failed.png',fullPage:true});throw error;}
    }
    await page.locator('#winModal').waitFor({state:'visible'});
   }
   await solve();await page.getByRole('button',{name:'Hrát dál',exact:true}).click();
   await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-009');
   await page.locator('#winModal').waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length===currentGame.puzzle.mask.length);
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   const attemptId=await page.evaluate(()=>currentGame.attemptId);
   // The optional award slot may already be absent in an old live DOM.
   await page.evaluate(()=>document.querySelector('#newBadgeBox').remove());
   await solve();await page.locator('#firstStepsGoogle').waitFor({state:'visible'});
   await page.evaluate(()=>productAnalytics().flush());
   const received=(await fetch(url+'/__fixture/events').then(r=>r.json())).events.filter(e=>e.headers['x-proplet-fixture-run']===run);
   const phases=['first_board_experiment_assigned','first_board_experiment_started','first_board_experiment_completed','first_steps_v1_offer'];
   for(const phase of phases)assert.equal(received.filter(e=>e.event===phase).length,1,phase+' exactly once');
   const flow=received.filter(e=>phases.includes(e.event));assert.equal(new Set(flow.map(e=>e.headers['x-proplet-first-steps-run'])).size,1);
   assert(flow.every(e=>e.headers['x-proplet-onboarding']==='board-v3-short'&&e.headers['x-proplet-puzzle']==='g4-e-009'&&e.headers['x-proplet-experiment-policy']==='challenger_rollout_20261007'&&e.headers['x-proplet-test']==='1'));
   for(const event of flow.filter(e=>e.event!=='first_board_experiment_assigned'))assert.equal(event.headers['x-proplet-run'],attemptId,'same actual game attempt');
   assert.equal(await page.locator('#newBadgeBox').count(),1,'missing slot safely rebuilt');
   await page.screenshot({path:output+'.'+(mobile?'mobile':'desktop')+'.png',fullPage:true});
   report.checks.push({name:(mobile?'mobile':'desktop')+' first game, recovered optional badge and exact telemetry',ok:true,attemptId,events:flow});
   // Actual historical-result renderer, followed by both formerly failing consumers.
   await page.evaluate(async()=>{const date=pragueDateISO(),p=await historicalDailyPuzzle(date);await showDailyResult(date,{puzzleId:p.id,elapsedMs:10000,moves:p.answers.length,cleanSolve:true});renderGameHUD();updateGameFeel();});
   assert.equal(await page.evaluate(()=>Array.isArray(currentGame.found)&&Array.isArray(currentGame.path)&&currentGame.isReplay),true);
   report.checks.push({name:(mobile?'mobile':'desktop')+' historical result with complete snapshot',ok:true});
   if(mobile){
    await page.waitForSelector('#winModal #winResultActions');
    // A cached client can leave an old footer behind; simulate that legacy DOM
    // without expecting newly rendered mobile results to use the retired dock.
    await page.evaluate(()=>{
     window.__originalBadgeSlot=document.querySelector('#newBadgeBox');
     const card=document.querySelector('#winModal .win-card'),footer=document.createElement('div');
     footer.className='win-result-footer';card.append(footer);
     footer.append(window.__originalBadgeSlot,document.querySelector('#winPrimaryBtn'));
     window.dispatchEvent(new Event('pageshow'));
    });
    await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(()=>!document.querySelector('#winModal .win-result-footer'));
    assert.equal(await page.evaluate(()=>window.__originalBadgeSlot.isConnected&&document.querySelector('#newBadgeBox')===window.__originalBadgeSlot),true,'legacy footer migration preserves original award slot');
    await page.evaluate(()=>renderWinBadges('synthetic award'));
    report.checks.push({name:'inline results preserve moved badge from legacy cached footer',ok:true});
   }
   assert.deepEqual(errors,[],'no uncaught browser errors');await context.close();
   fs.writeFileSync(output,JSON.stringify(report,null,2));
  }
  console.log('PASS '+report.checks.length+' real-client safety checks, exact once-only flow and attempt links, zero uncaught errors');
 }finally{await browser.close();}
})().catch(e=>{report.error=e.stack;fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(e);process.exitCode=1});
