'use strict';
// Native Proplet page and production module/CSS, synthetic long leaderboards only.
// Browser traffic is restricted to this checkout; no account or database writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8891';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'isolated loopback fixture required');
const artifacts=path.join(root,'artifacts/ranking-navigation');fs.mkdirSync(artifacts,{recursive:true});
let browser,server;const errors=[],checks=[],missingAssets=new Set();
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
const rows=(name,count,mine=count-2)=>Array.from({length:count},(_,i)=>({rank:i+1,name:`${name} ${i+1}`,avatar:'🦊',isMine:i===mine,xp:2000-i,lifetimePoints:4000,memberCount:3,players:3,score:100-i/100,moves:10,cleanSolve:true,elapsedMs:27000+i*1000}));
const data=(name,players,teams=3)=>({players:rows(name,players),teams:rows(`${name} tým`,teams),visibilityReady:true});
const control=kind=>kind==='xp'?'.ranking-control-row':'.ranking-daily-segment';
const list=kind=>kind==='xp'?'#xpLeaderboardList':'#dailyLeaderboardList';
const section=kind=>`${list(kind)} >> xpath=..`;
async function placeControls(page,kind,top=68){
 // Geometry setup represents a new deliberate scroll, so invalidate any
 // pending anchor before positioning this viewport for the next interaction.
 await page.mouse.wheel(0,1);await settle(page);
 await page.locator(control(kind)).evaluate((element,top)=>window.scrollBy({top:element.getBoundingClientRect().top-top,left:0,behavior:'instant'}),top);await settle(page);
 return page.locator(control(kind)).evaluate(el=>el.getBoundingClientRect().top);
}
async function stableControls(page,kind,expected,label){
 await settle(page);const actual=await page.locator(control(kind)).evaluate(el=>el.getBoundingClientRect().top);
 if(Math.abs(actual-expected)>3)console.error('Ranking anchor diagnostics',JSON.stringify(await page.evaluate(()=>({
  scrollY,viewport:{width:innerWidth,height:innerHeight},scrollHeight:document.scrollingElement.scrollHeight,
  focus:document.activeElement?.outerHTML,screen:typeof currentScreen==='undefined'?null:currentScreen,
  state:rankingsOrchestration().getState(),trace:window.__rankingViewportTrace||[],
  sections:[...document.querySelectorAll('#screen-leaderboard .ranking-navigation-section')].map(section=>({top:section.getBoundingClientRect().top,height:section.getBoundingClientRect().height,rows:section.querySelectorAll('.ranking-row').length})),
  tail:document.querySelector('.ranking-viewport-tail')?.getBoundingClientRect().height,
 })),null,2));
 assert(Math.abs(actual-expected)<=3,`${label}: controls moved from ${expected} to ${actual}`);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${label}: horizontal overflow`);
}
async function ready(page){
 await page.waitForFunction(()=>window.__rankingBootReady===true&&typeof rankingsOrchestration==='function');
 await page.evaluate(()=>{
  if(typeof closeOnboarding==='function')closeOnboarding(true);
  window.PropletRefreshRelease?.close();window.PropletContentRelease?.close();
  document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));
  document.querySelector('.release-notes-v3331-backdrop')?.remove();
 });
 await page.locator('[data-nav="leaderboard"]').click();
 await page.waitForSelector('#dailyLeaderboardList .ranking-row');await page.waitForSelector('#xpLeaderboardList .ranking-row');await settle(page);
}
async function run(viewport){
 const ctx=await browser.newContext({viewport,screen:viewport,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{
  document.addEventListener('proplet:ready',()=>{window.__rankingBootReady=true},{once:true});
  localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
  localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');sessionStorage.setItem('proplet-gen4-release-modal-v1','1');
  for(const key of ['g5-r1','mk100-v2','refresh300-v1'])localStorage.setItem('proplet:content-release:'+key,'1');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
 });
 const page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()===404)missingAssets.add(new URL(response.url()).pathname)});
 const calls=[],pending=[],waiters=[];let hold=false;
 const next=(kind,period)=>new Promise(resolve=>{const found=pending.find(row=>!row.claimed&&row.kind===kind&&row.period===period);if(found){found.claimed=true;resolve(found)}else waiters.push({kind,period,resolve})});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin)return route.abort();
  if(!['GET','HEAD'].includes(req.method()))return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"isolated fixture: writes disabled"}'});
  const kind=url.pathname==='/api/rankings/xp'?'xp':url.pathname==='/api/rankings/daily'?'daily':null;
  if(!kind)return route.continue();
  const period=kind==='xp'?url.searchParams.get('period'):'daily';calls.push({kind,period});
  let answer={status:200,body:kind==='daily'?data('Denní hráč',120,9):data('Dnešní XP hráč',96,3)};
  if(hold)answer=await new Promise(release=>{
   const row={kind,period,release,claimed:false};pending.push(row);
   const waiter=waiters.find(item=>item.kind===kind&&item.period===period&&!item.used);
   if(waiter){waiter.used=true;row.claimed=true;waiter.resolve(row)}
  });
  return route.fulfill({status:answer.status||200,contentType:'application/json',body:JSON.stringify(answer.body)});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready(page);
 await page.evaluate(()=>{
  window.__rankingViewportTrace=[];
  window.__recordRankingViewport=(phase,target)=>{
   const group=document.querySelector('.ranking-control-row');
   window.__rankingViewportTrace.push({phase,scrollY,groupTop:group?.getBoundingClientRect().top,targetTop:target?.getBoundingClientRect?.().top,target:target?.className,state:rankingsOrchestration().getState()});
   if(window.__rankingViewportTrace.length>24)window.__rankingViewportTrace.shift();
  };
  for(const type of ['pointerdown','click'])for(const capture of [true,false])document.addEventListener(type,event=>{
   if(event.target.closest?.('.ranking-scope-tab,.ranking-period-tab,.ranking-retry'))window.__recordRankingViewport(type+(capture?':capture':':bubble'),event.target);
  },capture);
 });
 assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),6,'Daily preview shows 5 leaders plus distant own rank');
 assert.equal(await page.locator('#xpLeaderboardList .ranking-row').count(),6,'XP preview shows 5 leaders plus distant own rank');
 assert(await page.locator('#dailyLeaderboardList .ranking-row.me').count()===1,'own Daily place visible');
 assert(await page.locator('#xpLeaderboardList .ranking-row.me').count()===1,'own XP place visible');
 const dailySection=page.locator(section('daily')),xpSection=page.locator(section('xp'));
 const dailyCollapse=dailySection.locator('.ranking-collapse-toggle'),dailyMore=dailySection.locator('.ranking-expand-list');
 await dailyCollapse.focus();const countBeforeCollapse=calls.length;await page.keyboard.press('Enter');
 assert.equal(await dailyCollapse.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#dailyLeaderboardList').isVisible(),false);
 assert(await dailyCollapse.evaluate(el=>document.activeElement===el),'collapse keeps keyboard focus');
 await page.keyboard.press('Space');assert.equal(await dailyCollapse.getAttribute('aria-expanded'),'true');
 assert.equal(calls.length,countBeforeCollapse,'collapse/expand never refetches data');
 const initialDaily=await page.locator('#dailyLeaderboardList').innerHTML();
 let top=await placeControls(page,'xp');await page.locator('[data-ranking-xp-scope="teams"]').click();await settle(page);
 await stableControls(page,'xp',top,'96 player to 3 team rows');
 assert.equal(await page.locator('#xpLeaderboardList .ranking-row').count(),3);
 assert(await page.locator('[data-ranking-xp-scope="teams"]').evaluate(el=>document.activeElement===el),'scope switch keeps focus');
 assert.equal(await page.locator('#dailyLeaderboardList').innerHTML(),initialDaily,'XP scope does not replace Daily DOM');
 const beforeScope=calls.length;await page.locator('[data-ranking-xp-scope="players"]').click();await stableControls(page,'xp',top,'cached players switch');
 assert.equal(calls.length,beforeScope,'player/team data shares the same response cache');
 // On phones, the first control row may be above the viewport while the
 // period row is still visible. The clicked button remains a valid anchor.
 if(viewport.width<=520)top=await placeControls(page,'xp',-42);
 // Deliberately resolve all-time before the previous weekly read.
 hold=true;await page.locator('[data-ranking-period="week"]').click();const week=await next('xp','week');
 await page.locator('[data-ranking-period="all"]').click();const all=await next('xp','all');
 all.release({body:data('Celkové pořadí',2,2)});await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList').textContent.includes('Celkové pořadí'));
 week.release({body:data('Zastaralý týden',25,7)});await settle(page);
 assert(!(await page.locator('#xpLeaderboardList').textContent()).includes('Zastaralý'),'late weekly response cannot overwrite selected all-time view');
 await stableControls(page,'xp',top,'out-of-order periods');
 assert(await page.locator('[data-ranking-period="all"]').evaluate(el=>document.activeElement===el),'period switch keeps focus');
 // A refresh may change the section ABOVE the clicked controls. Exercise both
 // the error path below the controls and an asynchronous Daily height decrease.
 top=await placeControls(page,'xp');await page.evaluate(()=>{void renderLeaderboard()});
 const failed=await next('xp','all'),shortDaily=await next('daily','daily');
 failed.release({status:503,body:{detail:'syntetická síťová chyba'}});await page.waitForSelector('#xpLeaderboardList .ranking-retry');
 await stableControls(page,'xp',top,'network error');
 shortDaily.release({body:data('Krátká výzva',2,2)});await page.waitForFunction(()=>document.querySelector('#dailyLeaderboardList').textContent.includes('Krátká výzva'));
 await stableControls(page,'xp',top,'height change above active XP controls');
 await page.locator('#xpLeaderboardList .ranking-retry').click();const retried=await next('xp','all');
 retried.release({body:data('Obnovené XP',24,4)});await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList').textContent.includes('Obnovené XP'));
 await stableControls(page,'xp',top,'retry');assert(await page.locator('[data-ranking-period="all"]').evaluate(el=>document.activeElement===el),'retry gives focus to selected period control');
 // A new cached control click renews the global viewport context for a
 // Daily request that was already pending before that click.
 await page.evaluate(()=>{window.__recordRankingViewport('before-renewed-refresh');void renderLeaderboard();window.__recordRankingViewport('after-renewed-refresh-call')});const supersededXp=await next('xp','all'),renewedDaily=await next('daily','daily');
 await page.evaluate(()=>window.__recordRankingViewport('before-renewed-click'));
 await page.locator('[data-ranking-xp-scope="teams"]').click();
 await page.evaluate(()=>window.__recordRankingViewport('after-renewed-click'));
 supersededXp.release({body:data('Překonaná obnova XP',24,4)});renewedDaily.release({body:data('Obnovená dlouhá výzva',120,9)});
 await page.waitForFunction(()=>document.querySelector('#dailyLeaderboardList').textContent.includes('Obnovená dlouhá výzva'));await stableControls(page,'xp',top,'pending Daily follows a renewed XP control anchor');
 assert(!(await page.locator('#xpLeaderboardList').textContent()).includes('Překonaná obnova XP'),'superseded XP refresh does not overwrite a newer cached scope switch');
 // Focus/viewport adjustment can occur after pointerdown and before click.
 // Dispatch those phases explicitly so the race does not depend on Chromium's
 // focus-scroll timing or whether the checkout's native art is already cached.
 await page.evaluate(()=>{
  const button=document.querySelector('[data-ranking-xp-scope="players"]');
  button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  window.scrollBy({top:-120,behavior:'instant'});
  button.click();
 });
 await stableControls(page,'xp',top,'pointerdown position survives focus scroll before click');
 // Native art decoration can settle later than the response's first animation
 // frames. Exercise a genuinely later row-height change above the active
 // controls, independently of machine speed or missing local image assets.
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowAnchor),'none','the actual document scroller delegates ranking anchoring to the controller');
 const heightBeforeLateLayout=await dailySection.evaluate(el=>el.getBoundingClientRect().height);
 await page.evaluate(async()=>{
  await new Promise(resolve=>setTimeout(resolve,100));
  document.querySelectorAll('#dailyLeaderboardList .ranking-row').forEach(row=>row.style.minHeight='180px');
 });
 assert((await dailySection.evaluate(el=>el.getBoundingClientRect().height))-heightBeforeLateLayout>200,'late-layout fixture must actually increase the section height');
 await stableControls(page,'xp',top,'late row layout after response animation frames');
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('proplet:account-changed')));
 assert.equal(await page.evaluate(()=>rankingsOrchestration().getState().viewportAnchor),null,'account changes discard the previous viewport anchor');
 const accountChangeY=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>document.querySelectorAll('#dailyLeaderboardList .ranking-row').forEach(row=>row.style.minHeight='220px'));
 await settle(page);assert(Math.abs((await page.evaluate(()=>scrollY))-accountChangeY)<=3,'account changes disconnect layout restoration');
 // Pending reads must not undo a deliberate subsequent user scroll.
 await page.evaluate(()=>{void renderLeaderboard()});const laterXp=await next('xp','all'),laterDaily=await next('daily','daily');
 await page.mouse.wheel(0,-10000);await page.waitForTimeout(80);const userY=await page.evaluate(()=>scrollY);
 laterXp.release({body:data('Aktuální XP',24,4)});laterDaily.release({body:data('Dlouhá výzva znovu',120,9)});
 await page.waitForFunction(()=>document.querySelector('#dailyLeaderboardList').textContent.includes('Dlouhá výzva znovu'));await settle(page);
 assert(Math.abs((await page.evaluate(()=>scrollY))-userY)<=3,'late response must not return the viewport to an abandoned anchor');
 // Full ranking remains available, with a keyboard-friendly return path.
 await dailyMore.scrollIntoViewIfNeeded();await dailyMore.click();await settle(page);
 assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),120,'full Daily view includes every result');
 const back=dailySection.locator('.ranking-back-summary');await back.click();await settle(page);
 assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),6,'return restores preview and distant own position');
 assert(await dailyMore.evaluate(el=>document.activeElement===el),'return restores focus to stable expand control');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
 const collapseBox=await dailyCollapse.boundingBox();assert(collapseBox.width>=42&&collapseBox.height>=42,'collapse touch target');
 await page.screenshot({path:path.join(artifacts,`${viewport.width}x${viewport.height}.png`),fullPage:true});
 checks.push(`${viewport.width}x${viewport.height}: compact/self, collapse keyboard, cached scope, racing periods, async height and late layout, error/retry, user-scroll cancellation, full list return`);
 await page.locator('.bottom-nav [data-nav="daily"]').click();
 assert.equal(await page.evaluate(()=>rankingsOrchestration().getState().viewportAnchor),null,'leaving rankings discards the viewport anchor');
 assert.equal(await page.evaluate(()=>document.querySelector('.ranking-viewport-tail').style.height),'0px','leaving rankings clears reserved scroll space');
 assert.notEqual(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowAnchor),'none','other pages retain native document anchoring');
 await ctx.close();
}
(async()=>{
 if(!process.env.TEST_URL){
  server=spawn(process.execPath,[path.join(__dirname,'browser_fixture_server.cjs')],{cwd:root,env:{...process.env,PORT:new URL(base).port},stdio:['ignore','pipe','inherit']});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('fixture exited '+code)))});
 }
 const health=await fetch(base+'/api/health').then(response=>response.json());assert(health.isolatedFixture&&health.database===false,'isolated fixture required');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:320,height:780},{width:390,height:844},{width:768,height:1000},{width:1000,height:768}])await run(viewport);
 assert.deepEqual(errors,[],'browser JavaScript exceptions');
 assert.deepEqual([...missingAssets],[],'complete native assets are required for representative ranking geometry');
 fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({ok:true,checks,errors,missingAssets:[...missingAssets]},null,2));console.log('PASS ranking navigation browser: '+checks.join('; '));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
