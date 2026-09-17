const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const url=process.env.TEST_URL||'http://127.0.0.1:8878';assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
 const fixture=await fetch(url+'/__fixture').then(r=>r.json());assert(fixture.isolated);
 const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const errors=[];
 try{
  async function page(viewport){
   const c=await b.newContext({viewport,serviceWorkers:'block'});
   await c.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
   await c.addInitScript(id=>{
    localStorage.setItem('proplet-v2-profile',JSON.stringify({id,name:'Synthetic session',token:'synthetic-session'}));
    localStorage.setItem('proplet:content-release:g5-r1','1');
    localStorage.setItem('proplet-v3-7-required-onboarding','done');
    localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
    localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
   },fixture.player);
   const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));await p.goto(url);
   await p.waitForFunction(()=>typeof startGame==='function'&&puzzleDB?.daily&&accountProgressAvailable());
   await p.evaluate(()=>{closeTransientModals();document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));closeOnboarding?.(true)});
   return p;
  }
  const a=await page({width:1440,height:1000});await a.bringToFront();
  await a.evaluate(()=>startDaily());await a.waitForFunction(()=>currentGame?.fairPlay===true);
  // Execute one genuine production submitPath using the fixture's known answer.
  await a.evaluate(()=>{currentGame.path=[...currentGame.puzzle.answers[0].path];submitPath()});
  await a.waitForTimeout(2100);
  await a.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await a.waitForFunction(()=>currentGame.pausedAt!=null);
  assert.equal(await a.locator('#boardWrap').evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.equal(await a.locator('#boardWrap').evaluate(e=>e.inert),true);
  const before=await a.evaluate(()=>({elapsed:gameElapsed(),found:currentGame.found.length,attempt:currentGame.attemptId}));
  await a.waitForTimeout(1200);assert.equal(await a.evaluate(()=>gameElapsed()),before.elapsed);
  await a.screenshot({path:process.env.PAUSE_SCREENSHOT||'../fix-verification/fair-play-pause.png'});
  const other=await page({width:390,height:844});await other.bringToFront();
  await other.evaluate(()=>startDaily());await other.waitForFunction(()=>currentGame?.fairPlay===true);
  const after=await other.evaluate(()=>({elapsed:gameElapsed(),found:currentGame.found.length,attempt:currentGame.attemptId}));
  assert.equal(after.found,1);assert.equal(after.attempt,before.attempt);assert(after.elapsed>=before.elapsed);
  await other.evaluate(()=>pauseGameClock('test-end'));
  // A delayed resume response arriving after another blur must leave both clocks paused.
  await other.evaluate(()=>fairPlay().drain());
  let releaseOpen,openSeen;
  const seen=new Promise(resolve=>openSeen=resolve);
  await other.route('**/api/play-session',async route=>{
   if(route.request().postDataJSON()?.action==='open'){
    openSeen();await new Promise(resolve=>releaseOpen=resolve);
   }
   await route.continue();
  });
  await other.evaluate(()=>resumeGameClock());await seen;
  await other.evaluate(()=>pauseGameClock('blur-during-resume'));releaseOpen();
  await other.waitForFunction(()=>!currentGame.resumePending);
  await other.evaluate(()=>fairPlay().drain());
  assert(await other.evaluate(()=>currentGame.pausedAt!=null));
  const raceTime=await other.evaluate(()=>gameElapsed());await other.waitForTimeout(500);
  assert.equal(await other.evaluate(()=>gameElapsed()),raceTime);
  await other.unroute('**/api/play-session');
  await other.evaluate(()=>resumeGameClock());await other.waitForFunction(()=>currentGame.pausedAt==null);
  // Finish offline: all local moves and completion survive; notice explains timing exclusion.
  await other.context().setOffline(true);
  await other.evaluate(()=>{for(let i=0;i<currentGame.puzzle.answers.length;i++){if(!currentGame.found.some(f=>f.answerIndex===i)){currentGame.path=[...currentGame.puzzle.answers[i].path];submitPath()}}});
  await other.waitForFunction(()=>currentGame.finished===true);
  await other.waitForFunction(()=>!document.querySelector('#winModal').classList.contains('hidden'));
  assert.equal(await other.locator('#winTimingNotice').isVisible(),true);
  assert(await other.evaluate(()=>!!getState().completed[challengeKey(currentGame.mode,currentGame.puzzle,currentGame.dailyDate)]));
  await other.context().setOffline(false);
  assert.deepEqual(errors,[]);
  const report={browser:b.version(),contexts:['desktop 1440x1000','mobile viewport 390x844'],physicalDevices:false,before,after,checks:['paused clock stable','opaque hidden board and inert input','same account resumes same attempt/time/word on independent browser storage','delayed resume followed by blur stays paused','offline finish preserves local completion and shows unverified time']};
  fs.writeFileSync(process.env.RESULT_PATH||'../fix-verification/fair-play-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
