'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8000',out='qa-refresh300';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[];function check(name,pass){checks.push({name,pass:!!pass});assert(pass,name)}
(async()=>{const browser=await chromium.launch(process.env.PROPLET_BROWSER_EXECUTABLE?{executablePath:process.env.PROPLET_BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']} : {});try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await page.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.continue());
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(localStorage.getItem('qa-seeded'))return;localStorage.setItem('qa-seeded','1');
  for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(key,'done');
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  localStorage.setItem('proplet-v2-state:guest',JSON.stringify({completed:{'free:g4-e-001':{puzzleId:'g4-e-001',mode:'free',difficulty:'easy',level:1,contentGeneration:4,completedAt:'2026-10-01T08:00:00Z',points:15}},rescues:{},inProgress:{},dailyDates:[],statsVersion:5}));
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__PROPLET_PRINTSHOP_RELEASE_POLISH_V2__===true&&document.querySelector('#freeOrderSettings'));
 await page.evaluate(()=>document.fonts.ready);
 // The 300-board campaign is retired. Its immutable boards and the native
 // difficulty selection remain supported, but guests must never get a promo.
 for(const width of [320,390,840,1440]){
  await page.setViewportSize({width,height:900});
  check('retired 300 announcement is never mounted '+width,await page.locator('#freeRefreshAnnouncement').count()===0);
  check('guest has no automatic discovery dialog '+width,await page.locator('#mk100LaunchPreview:not(.hidden),#dailyExtraIntro:not(.hidden),#referralDialog:not(.hidden),#archiveExperienceModal:not(.hidden)').count()===0);
 }
 await page.locator('.bottom-nav [data-nav="free"]').click();
 check('native navigation opens real difficulty selection',await page.locator('#screen-free').isVisible());
 check('retired new-board counters stay absent',await page.locator('#difficultyCards .refresh-count').count()===0);
 await page.evaluate(()=>nav('daily'));
 for(const width of [320,390,840]){
  await page.setViewportSize({width,height:900});
  check('Daily title and gap '+width,await page.evaluate(()=>{const h=document.querySelector('.daily-hero h1'),strip=document.querySelector('#dailyWeekRhythm');return getComputedStyle(h).fontFamily.includes('Fraunces')&&strip.getBoundingClientRect().top-h.getBoundingClientRect().bottom<=25&&!document.querySelector('.daily-week-rhythm-head')}));
  check('retired300-board card stays absent '+width,await page.locator('#freeRefreshToday').count()===0);
  await page.screenshot({path:`${out}/today-${width}.png`,fullPage:true});
 }
 check('no second campaign in same page visit',await page.evaluate(()=>!document.querySelector('#mk100LaunchPreview:not(.hidden)')));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#freeOrderSettings'));check('retired campaign stays absent after reload',await page.evaluate(()=>!document.querySelector('#freeRefreshAnnouncement:not(.hidden)')));
 await page.evaluate(()=>nav('free'));
 await page.waitForFunction(()=>freeOrder().enabled());
 check('400 levels and varied next board',await page.evaluate(()=>puzzleDB.free.easy.filter(p=>!p.meta?.rollingContent).length===400&&freeOrder().record('easy').mode==='varied'&&freeOrder().next('easy',null).id==='g6-refresh-easy-001'));
 check('compact next-board information; no card switch',await page.evaluate(()=>document.querySelectorAll('#difficultyCards .order-next').length===6&&!document.querySelector('#difficultyCards select')));
 // A guest remains quiet after a reload; settings stay explicitly accessible.
 await page.locator('#settingsHeaderBtn').click();await page.locator('#freeOrderSettings summary').click();
 check('four opt-outs, endgames excluded',await page.locator('#freeOrderSettings select').count()===4);
 await page.locator('#freeOrder-easy').selectOption('numeric');await page.waitForFunction(()=>freeOrder().record('easy').mode==='numeric');check('explicit numeric preference takes effect',await page.evaluate(()=>freeOrder().record('easy').mode==='numeric'));
 await page.locator('#freeOrder-easy').selectOption('varied');await page.waitForFunction(()=>freeOrder().record('easy').mode==='varied');
 await page.evaluate(()=>nav('free'));await page.locator('#difficultyCards [data-diff="easy"] [data-play-free]').click();
 await page.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='free');
 check('native game starts approved new board',await page.evaluate(()=>currentGame?.puzzle?.id==='g6-refresh-easy-001'&&currentGame.mode==='free'));
 await page.screenshot({path:`${out}/new-board.png`});

 // Both tabs must resume the same saved board, without creating another run.
 const saved=await page.evaluate(()=>({id:currentGame.puzzle.id,found:currentGame.found.length}));
 await page.evaluate(()=>nav('free'));
 check('Play resume appears above difficulties',await page.evaluate(()=>(()=>{const card=document.querySelector('#freeResumeCard'),grid=document.querySelector('#difficultyCards');return !!card&&card.getBoundingClientRect().bottom<=grid.getBoundingClientRect().top})()));
 check('both tabs show the same resume',await page.evaluate(()=>document.querySelector('#freeResumeCard').textContent===document.querySelector('#homeResumeCard').textContent));
 await page.locator('#freeResumeCard').click();
 check('Play resume restores the saved board',await page.evaluate(saved=>currentGame.puzzle.id===saved.id&&currentGame.found.length===saved.found,saved));
 // Fixture: completed results for every difficulty, no unfinished board.
 await page.evaluate(()=>{const state=getState();state.inProgress={};for(const diff of Object.keys(DIFF)){const p=sortedFreeBank(diff)[0];state.completed['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:diff,level:p.meta.level,contentGeneration:p.meta.contentGeneration||4,elapsedMs:125000,moves:25,hintsUsed:0,cleanSolve:true,points:DIFF[diff].xp,completedAt:new Date().toISOString()}}saveState(state);currentGame=null;nav('free')});
 check('finished games leave no stale resume on either tab',await page.locator('#homeResumeCard,#freeResumeCard').count()===0);
 for(const theme of ['light','dark'])for(const width of [320,390,690,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const diff of ['easy','medium','hard','hardcore','mozkomor','mozkokalypsa']){
   await page.evaluate(diff=>openPlayedLevels(diff),diff);
   check(`history layout ${diff} ${width} ${theme}`,await page.evaluate(()=>{const close=document.querySelector('#closePlayedLevelsModal').getBoundingClientRect(),ring=document.querySelector('#playedLevelsProgress').getBoundingClientRect(),card=document.querySelector('.played-levels-card');return close.bottom+4<=ring.top&&card.scrollWidth<=card.clientWidth+1}));
   check(`no duplicate progress or clean stars ${diff} ${width} ${theme}`,await page.evaluate(()=>!document.querySelector('#playedLevelsMeta').textContent.trim()&&Array.from(document.querySelectorAll('#playedLevelsList .level-history-main small')).every(el=>!/[✨☆★]/.test(el.textContent)&&!el.querySelector('svg'))));
  }
  if((width===390&&theme==='light')||(width===690&&theme==='dark'))await page.screenshot({path:`${out}/history-${theme}-${width}.png`});
  await page.locator('#closePlayedLevelsModal').click();
  check('history close works',await page.locator('#playedLevelsModal').isHidden());
 }
 const newcomer=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await newcomer.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.continue());await newcomer.goto(base,{waitUntil:'domcontentloaded'});
 await newcomer.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter');
 check('newcomer retains native onboarding without CTA',await newcomer.evaluate(()=>currentGame?.mode==='starter'&&!document.querySelector('#freeRefreshAnnouncement:not(.hidden)')));await newcomer.close();
 check('no browser runtime errors',errors.length===0);
 }finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});


