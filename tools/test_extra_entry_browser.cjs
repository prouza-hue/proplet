// Real runtime and real clicks, synthetic local-only API and progress.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const url=process.env.TEST_URL;assert(url&&['127.0.0.1','localhost'].includes(new URL(url).hostname));
 const health=await fetch(url+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&health.database===false);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const report={sha:health.sha,checks:[],screenshots:[]};fs.mkdirSync('artifacts/extra-entry',{recursive:true});
 try{
  for(const [label,viewport] of [['mobile',{width:390,height:844}],['fold',{width:768,height:1000}]]){
   const context=await browser.newContext({serviceWorkers:'block',viewport});const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
   await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'));
   await context.addInitScript(()=>{
    for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(key,'done');
    localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
    for(const key of ['g5-r1','mk100-v2','refresh300-v1'])localStorage.setItem('proplet:content-release:'+key,'1');
    localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.parse('2026-10-21T09:00:00Z')}));
   });
   await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(url).origin?r.continue():r.abort());
   const config=JSON.parse(fs.readFileSync('tests/fixtures/browser/config.json','utf8'));
   await page.route('**/api/config',r=>r.fulfill({json:{...config,archiveEnabled:true}}));
   await page.route('**/api/play-session/config',r=>r.fulfill({json:{enabled:false}}));
   const dailyPuzzle=JSON.parse(fs.readFileSync('public/puzzles.json','utf8')).daily[0];
   const dailyDescriptor={schemaVersion:1,serverToday:'2026-10-21',validUntil:'2026-10-21T22:00:00Z',dailyDate:'2026-10-21',bankVersion:'synthetic-daily',contentHash:'b'.repeat(64),challengeKey:'daily:2026-10-21',puzzleId:dailyPuzzle.id,puzzle:dailyPuzzle,official:true,rewardEligible:true};
   await page.route('**/api/daily',r=>r.fulfill({json:dailyDescriptor}));
   let descriptor=null;
   await page.route('**/api/daily-special*',r=>r.fulfill({json:{schemaVersion:1,serverToday:'2026-10-21',validUntil:'2026-10-21T22:00:00Z',special:descriptor,schedule:[]}}));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&document.querySelectorAll('#difficultyCards [data-play-free]').length>=4&&window.PropletArchiveExperience?.isEnabled());
   await page.waitForFunction(()=>window.__PROPLET_ONBOARDING_MODEL_V3328__&&window.__PROPLET_ONBOARDING_RETURN_V3332__);
   descriptor=await page.evaluate(async()=>{
    closeOnboarding(true);closeTransientModals();window.PropletRefreshRelease?.close();window.PropletContentRelease?.close();
    await window.__PROPLET_ENSURE_FULL_PUZZLE_DB?.();
    const date=pragueDateISO(),p=structuredClone(puzzleDB.free.hardcore[0]);p.id='synthetic-extra-entry';
    return {schemaVersion:1,serverToday:date,validUntil:'2026-10-21T22:00:00Z',dailyDate:date,difficulty:'hardcore',bankVersion:'synthetic-extra',contentHash:'a'.repeat(64),challengeKey:'daily-special:'+date+':hardcore',puzzleId:p.id,puzzle:p,official:true,rewardEligible:true};
   });
   assert.equal(descriptor.dailyDate,'2026-10-21');
   await page.evaluate(async d=>{datedSpecial().remember(d);await refreshDatedSpecial();nav('daily');renderDaily();closeTransientModals();},descriptor);
   await page.locator('#axHomeFree').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('#axHomeFree [data-home-free]').count(),0,'Today does not duplicate the difficulty catalog');
   assert.equal(await page.locator('#axHomeFree button').count(),1,'one unambiguous entry opens the real Play catalog');
   assert.equal(await page.locator('#axHomeFree [data-archive-action="free"]').count(),1);
   for(const theme of ['light','dark']){
    await page.evaluate(t=>applyTheme(t,{persist:false}),theme);
    const path=`artifacts/extra-entry/${label}-home-${theme}.png`;await page.locator('#axHomeFree').screenshot({path});report.screenshots.push(path);
   }
   for(const diff of ['easy','medium','hard','hardcore','mozkomor','mozkokalypsa']){
    await page.locator('#axHomeFree [data-archive-action="free"]').click();
    await page.waitForFunction(()=>currentScreen==='free');
    await page.locator(`#difficultyCards [data-play-free="${diff}"]`).click();
    await page.waitForFunction(d=>currentScreen==='game'&&currentGame?.mode==='free'&&currentGame.puzzle.difficulty===d,diff);
    await page.evaluate(()=>{stopTimer();nav('daily');closeTransientModals()});
   }
   await page.locator('#axHomeFree [data-archive-action="free"]').click();await page.waitForFunction(()=>currentScreen==='free');
   await page.evaluate(async()=>{
    nav('daily');const p=dailyPuzzleFor(pragueDateISO());await startGame(p,'daily',pragueDateISO());
    currentGame.found=p.answers.map((a,i)=>({...a,answerIndex:i,colorIndex:i%COLORS.length}));currentGame.moves=p.answers.length;
    await finishGame();
   });
   await page.waitForFunction(()=>!document.querySelector('#winModal').classList.contains('hidden')&&!document.querySelector('#winExtraBtn').classList.contains('hidden'));
   assert.equal(await page.locator('#winExtraBtn').textContent(),'Hraj Extra');
   assert.equal(await page.locator('#winPrimaryBtn').textContent(),'Zpět na Dnes');
   assert.equal(await page.locator('#winExtraBtn').evaluate(el=>el.parentElement.id),'winResultActions');
   assert.equal(await page.locator('#winPrimaryBtn').evaluate(el=>el.parentElement.classList.contains('win-secondary-actions')),true,'Daily back action is secondary to Extra');
   const screenshot=`artifacts/extra-entry/${label}-daily-result.png`;await page.locator('#winModal .win-card').screenshot({path:screenshot});report.screenshots.push(screenshot);
   await page.locator('#winExtraBtn').click();await page.waitForFunction(()=>currentScreen==='game'&&currentGame?.mode==='daily_special');
   assert.equal(await page.locator('#winModal').evaluate(el=>el.classList.contains('hidden')),true);
   await page.evaluate(()=>{saveGameProgress();stopTimer();nav('daily');closeTransientModals()});
   assert.equal(await page.locator('.daily-hero').evaluate(el=>el.classList.contains('daily-special-selected')),true,'completed Daily automatically promotes unfinished Extra');
   assert.equal(await page.locator('#dailyHeroTitle').textContent(),'Extra výzva');
   assert.equal(await page.locator('#playDailyBtn').textContent(),'Pokračovat ve speciálu');
   assert.match(await page.locator('#dailyMeta').textContent(),/Mozkožrout.*200 XP/);
   assert.equal(await page.locator('#studioDailyResult').isVisible(),true,'completed base result stays accessible');
   assert(!(await page.locator('#playDailyBtn').textContent()).includes('Sérii neovlivní'));
   assert.equal(await page.locator('#playDailyBtn small').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(errors,[]);report.checks.push(label+': one Today entry, six real starts from Play, actual Daily finish -> Extra, automatic promotion and resume/result access, no overflow/errors');
   await context.close();
  }
  fs.writeFileSync('artifacts/extra-entry/report.json',JSON.stringify(report,null,2));console.log('PASS '+report.checks.join('; '));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
