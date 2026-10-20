'use strict';
// Loopback-only real client regression; all synthetic traffic carries X-Proplet-Test.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
// Exact module from before the additive Daily Special method. No production fetch.
const oldProgression=execFileSync('git',['show','cf16817aadfa9cb991630bf99d04aeb62860f6fd^:public/app/content/progression.js'],{encoding:'utf8'});
const url=process.env.TEST_URL||'http://127.0.0.1:18769';
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const output=process.env.RESULT_PATH||'browser-results/first-game-safety.json';fs.mkdirSync(require('node:path').dirname(output),{recursive:true});
const report={checks:[],synthetic:true};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const scenario of [{name:'desktop',width:1440,height:1000,mobile:false},{name:'mobile',width:390,height:844,mobile:true},{name:'fold',width:768,height:900,mobile:true}]){
   const {mobile}=scenario;
   await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reset:true,firstSteps:true,firstBoardPolicy:'challenger_rollout_20261007'})});
   const run=crypto.randomUUID(),context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Test':'1','X-Proplet-Fixture-Run':run}});
   // Keep consent UI out of pointer scenarios, using a date before the fixed fixture clock.
   await context.addInitScript(()=>{localStorage.setItem('proplet-v3-15-anonymous-id','synthetic-first-game-safety');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.parse('2026-09-15T09:00:00Z')}));});
   await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
   await page.goto(url);await page.waitForFunction(()=>currentGame?.mode==='starter'&&document.querySelectorAll('#board .cell').length===9);
   if(scenario.name==='desktop'){
    await page.waitForTimeout(10300);await page.evaluate(()=>productAnalytics().flush());
    const readyRows=(await fetch(url+'/__fixture/events').then(r=>r.json())).events.filter(e=>e.headers['x-proplet-fixture-run']===run);
    for(const phase of ['starter_v1_presentation_checked','starter_v1_idle']){const rows=readyRows.filter(e=>e.event===phase);assert.equal(rows.length,1);assert(['visible','obscured'].includes(rows[0].headers['x-proplet-starter-reason']),'initial paint may still be obscured, never infer visibility from ready');if(phase==='starter_v1_idle')assert.equal(rows[0].headers['x-proplet-starter-reason'],'visible');assert(rows[0].headers['x-proplet-starter-run']);}
    report.checks.push({name:'first paint classification and visible idle before any interaction',ok:true,events:readyRows.filter(e=>['starter_v1_presentation_checked','starter_v1_idle'].includes(e.event))});
   }
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
   await solve();
   const completedBefore=await page.evaluate(()=>JSON.stringify(getState().completed));
   // The actual cached-facade fault: object exists but the required method does not.
   await page.evaluate(()=>{window.PropletFirstSteps={...window.PropletFirstSteps,captureFirstGame:'not-callable'}});
   const recovery=page.waitForRequest(r=>new URL(r.url()).pathname==='/app/engagement/first-steps.js');
   await page.getByRole('button',{name:'Hrát dál',exact:true}).click();await recovery;
   await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.id==='g4-e-009');
   await page.locator('#winModal').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>JSON.stringify(getState().completed)),completedBefore,'recovery preserves completed progress');
   assert.equal(await page.evaluate(()=>window.PropletFirstSteps.contractVersion),2);
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
   await page.screenshot({path:output+'.'+scenario.name+'.png',fullPage:true});
   report.checks.push({name:scenario.name+' stale facade recovery, preserved progress, first game and exact telemetry',ok:true,attemptId,events:flow});
   if(scenario.name==='desktop'){
    await context.route('**/app/engagement/first-steps.js?*',r=>r.abort());
    const preserved=await page.evaluate(async()=>{const old=currentGame,completed=JSON.stringify(getState().completed),profile=JSON.stringify(getProfile());window.PropletFirstSteps={captureFirstGame:'broken'};const result=await startGame(old.puzzle,'free');return {result,sameGame:currentGame===old,sameCompleted:JSON.stringify(getState().completed)===completed,sameProfile:JSON.stringify(getProfile())===profile}});
    assert.deepEqual(preserved,{result:false,sameGame:true,sameCompleted:true,sameProfile:true});
    await context.unroute('**/app/engagement/first-steps.js?*');await page.evaluate(()=>ensureFirstStepsRuntime());
    report.checks.push({name:'failed recovery retains game, completed progress and account; explicit retry restores facade',ok:true});
   }
   // Update skew: new app, actual pre-4.06 progression bytes, intact current state.
   const preserved=await page.evaluate(()=>({profile:JSON.stringify(getProfile()),state:JSON.stringify(getState()),game:currentGame.attemptId}));
   await page.evaluate(code=>{(0,eval)(code);progressionController=null},oldProgression);
   assert.equal(await page.evaluate(()=>typeof window.PropletContentProgression.create({}).dailySpecialResultState),'undefined','baseline is genuinely incompatible');
   const special=await page.evaluate(()=>{const date=pragueDateISO();return {actual:progression().dailySpecialResultState(date),expected:datedSpecial().resultState(date,getState())}});
   assert.deepEqual(special.actual,special.expected,'compatibility reads authoritative special state, not fabricated empty progress');
   assert.deepEqual(await page.evaluate(()=>({profile:JSON.stringify(getProfile()),state:JSON.stringify(getState()),game:currentGame.attemptId})),preserved);
   // Actual historical-result renderer, followed by all previously failing consumers.
   await page.evaluate(async()=>{const date=pragueDateISO(),p=await historicalDailyPuzzle(date);await showDailyResult(date,{puzzleId:p.id,elapsedMs:10000,moves:p.answers.length,cleanSolve:true});renderGameHUD();updateGameFeel();});
   assert.equal(await page.evaluate(()=>Array.isArray(currentGame.found)&&Array.isArray(currentGame.path)&&currentGame.isReplay),true);
   await page.evaluate(()=>{renderWinExtraAction();renderDaily();renderFree();renderProfile()});
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'no horizontal overflow on '+scenario.name);
   report.checks.push({name:scenario.name+' actual old progression + new app: Daily result, Extra CTA, Free, Profile; progress/account/game preserved',ok:true});
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
