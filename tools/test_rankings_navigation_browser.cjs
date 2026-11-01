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
 await page.locator('#propletBootScreen').waitFor({state:'detached'});
 await page.locator('[data-nav="leaderboard"]').click();
 // The competition hub now defaults to Monthly; Daily remains an explicit tab.
 await page.locator('.screen.active [data-ranking-view="daily"]').click();
 await page.waitForSelector('#dailyLeaderboardList .ranking-row');await settle(page);
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
 const calls=[],pending=[],waiters=[];let hold=false,patronCase=false,patronPublic=true;
 const next=(kind,period)=>new Promise((resolve,reject)=>{
  const found=pending.find(row=>!row.claimed&&row.kind===kind&&row.period===period);
  if(found){found.claimed=true;resolve(found);return}
  const waiter={kind,period,used:false,resolve:row=>{clearTimeout(timer);resolve(row)}};
  const timer=setTimeout(()=>{
   waiter.used=true;
   reject(Error(`Missing ranking request ${kind}/${period} after 15s; observed=${JSON.stringify(calls)}; pending=${JSON.stringify(pending.map(({kind,period,claimed})=>({kind,period,claimed})))}`));
  },15000);
  waiters.push(waiter);
 });
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==new URL(base).origin)return route.abort();
  if(!['GET','HEAD'].includes(req.method()))return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"isolated fixture: writes disabled"}'});
  if(url.pathname==='/api/patrons')return route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:patronCase,authenticated:true,patron:patronCase,publicBadge:patronPublic,offersDisabled:true,canOffer:false,thanksPending:false,contributions:[]})});
  const kind=url.pathname==='/api/rankings/xp'?'xp':url.pathname==='/api/rankings/daily'?'daily':null;
  if(!kind)return route.continue();
  const period=kind==='xp'?url.searchParams.get('period'):'daily';calls.push({kind,period});
  let answer={status:200,body:kind==='daily'?data('Denní hráč',120,9):data('Dnešní XP hráč',96,3)};
  if(patronCase)answer.body={players:rows('Ukázkový hráč',24,20).map((r,i)=>({...r,name:i===20?'Pavel':r.name,patron:i===0,teamName:'Propletové – Řeporyje',lifetimePoints:80000,xp:15720-i})),teams:[],visibilityReady:true};
  if(hold)answer=await new Promise(release=>{
   const row={kind,period,release,claimed:false};pending.push(row);
   const waiter=waiters.find(item=>item.kind===kind&&item.period===period&&!item.used);
   if(waiter){waiter.used=true;row.claimed=true;waiter.resolve(row)}
  });
  return route.fulfill({status:answer.status||200,contentType:'application/json',body:JSON.stringify(answer.body)});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready(page);
 const views=page.locator('#screen-leaderboard .ranking-view-tabs');
 assert.equal(await page.locator('#dailyLeaderboardList').isVisible(),true);assert.equal(await page.locator('#xpLeaderboardList').isVisible(),false);
 assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),6);assert.equal(await page.locator('#dailyLeaderboardList .ranking-row.me').count(),1);
 await views.locator('[data-ranking-view="xp"]').click();await page.waitForSelector('#xpLeaderboardList .ranking-row');await settle(page);
 assert.equal(await page.locator('#dailyLeaderboardList').isVisible(),false);assert.equal(await page.locator('#xpLeaderboardList .ranking-row').count(),6);
 let top=await placeControls(page,'xp'),count=calls.length;
 await page.locator('[data-ranking-xp-scope="teams"]').click();await stableControls(page,'xp',top,'cached team scope');assert.equal(calls.length,count);assert.equal(await page.locator('#xpLeaderboardList .ranking-row').count(),3);
 await page.locator('[data-ranking-xp-scope="players"]').click();await stableControls(page,'xp',top,'cached player scope');assert.equal(calls.length,count);
 hold=true;await page.locator('[data-ranking-period="week"]').click();const week=await next('xp','week');await page.locator('[data-ranking-period="all"]').click();const all=await next('xp','all');
 all.release({body:data('Celkové pořadí',2,2)});await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList').textContent.includes('Celkové pořadí'));
 week.release({body:data('Zastaralý týden',20,8)});await settle(page);assert(!(await page.locator('#xpLeaderboardList').textContent()).includes('Zastaralý'));
 await stableControls(page,'xp',top,'out-of-order periods');assert(await page.locator('[data-ranking-period="all"]').evaluate(el=>document.activeElement===el));
 await page.evaluate(()=>{void renderLeaderboard()});const failed=await next('xp','all');failed.release({status:503,body:{detail:'syntetická síťová chyba'}});
 await page.waitForSelector('#xpLeaderboardList .ranking-retry');await stableControls(page,'xp',top,'active view error');
 await page.locator('#xpLeaderboardList .ranking-retry').click();const retry=await next('xp','all');retry.release({body:data('Obnovené XP',24,4)});
 await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList').textContent.includes('Obnovené XP'));await stableControls(page,'xp',top,'retry');assert(await page.locator('[data-ranking-period="all"]').evaluate(el=>document.activeElement===el));
 await page.evaluate(()=>{void renderLeaderboard()});const later=await next('xp','all');await page.mouse.wheel(0,-10000);await page.waitForTimeout(80);const userY=await page.evaluate(()=>scrollY);
 later.release({body:data('Aktuální XP',24,4)});await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList').textContent.includes('Aktuální XP'));await settle(page);assert(Math.abs((await page.evaluate(()=>scrollY))-userY)<=3,'response cannot undo deliberate user scroll');
 hold=false;await page.locator('[data-ranking-period="week"]').click();await page.locator('[data-ranking-xp-scope="teams"]').click();await page.waitForFunction(()=>currentScreen==='weekly');await settle(page);
 assert.equal(await page.locator('#screen-weekly .ranking-view-tabs [data-ranking-view="weekly"]').getAttribute('aria-current'),'page');assert(await page.locator('.bottom-nav [data-nav="leaderboard"]').evaluate(el=>el.classList.contains('active')));assert.equal(await page.locator('#screen-leaderboard').isVisible(),false);
 await page.locator('#screen-weekly [data-ranking-view="xp"]').click();await page.waitForFunction(()=>currentScreen==='leaderboard');await settle(page);
 await page.locator('[data-ranking-period="today"]').click();await page.locator('[data-ranking-xp-scope="teams"]').click();await settle(page);assert.equal(await page.evaluate(()=>currentScreen),'leaderboard');
 await page.locator('[data-ranking-period="all"]').click();await settle(page);assert.equal(await page.evaluate(()=>currentScreen),'leaderboard');
 await views.locator('[data-ranking-view="daily"]').click();await settle(page);const dailySection=page.locator(section('daily')),more=dailySection.locator('.ranking-expand-list');await more.click();await settle(page);assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),120);
 await dailySection.locator('.ranking-back-summary').click();await settle(page);assert.equal(await page.locator('#dailyLeaderboardList .ranking-row').count(),6);assert(await more.evaluate(el=>document.activeElement===el));
 assert.equal(await page.locator('#xpLeaderboardList').isVisible(),false);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const button of await views.locator('button').all()){const box=await button.boundingBox();assert(box.width>=42&&box.height>=44);}
 // Real supporter identity and long metadata must survive narrow ranking columns.
 patronCase=true;await page.evaluate(()=>window.PropletPatrons.refresh());
 for(const view of ['xp','daily']){
  await page.evaluate(async view=>{await rankingsOrchestration().openView(view);if(view==='xp'){document.querySelector('[data-ranking-xp-scope="players"]').click();document.querySelector('[data-ranking-period="week"]').click();}await rankingsOrchestration().renderLeaderboard({refresh:true})},view);
  const own=page.locator(list(view)+' .ranking-row.me');await own.locator('.ranking-player-name').filter({hasText:'Pavel'}).waitFor();await own.locator('.patron-avatar-card').waitFor();await settle(page);
  const geometry=await own.evaluate(row=>{
   const identity=row.querySelector('.ranking-player-name'),avatar=row.querySelector('.ranking-avatar'),copy=row.querySelector('.leader-name'),meta=copy.querySelector('small'),score=row.querySelector('.leader-score');
   const box=e=>{const r=e.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right}};
   return {name:box(identity),avatar:box(avatar),copy:box(copy),meta:box(meta),score:box(score),text:identity.textContent,metaFits:meta.scrollWidth<=meta.clientWidth+1,labelCount:row.querySelectorAll('.ranking-player-identity>.patron-label').length,cards:row.querySelectorAll('.patron-avatar-card').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert(geometry.text.includes('Pavel')&&geometry.name.width>=24,'supporter name remains visible');assert(geometry.avatar.width>=30,'supporter avatar retains its allocated size');assert(geometry.copy.right<=geometry.score.left+1,'identity and metadata never overlap the score');assert(geometry.metaFits&&!geometry.overflow,'long rank/team metadata wraps inside the row');assert.equal(geometry.labelCount,1);assert.equal(geometry.cards,1);
 }
 patronPublic=false;await page.evaluate(()=>window.PropletPatrons.refresh());assert.equal(await page.locator('#dailyLeaderboardList .ranking-row.me .patron-label').count(),0,'private own supporter is not publicly labelled');assert.equal(await page.locator('#dailyLeaderboardList .ranking-row.me .patron-avatar-card').count(),0,'private own supporter has no public avatar mark');
 patronPublic=true;await page.evaluate(()=>window.PropletPatrons.refresh());
 checks.push(viewport.width+'px: XP week/Daily supporter name/avatar, distant own rank, long rank/team wrap, score separation and public-badge privacy');
 await page.screenshot({path:path.join(artifacts,viewport.width+'x'+viewport.height+'.png'),fullPage:true});checks.push(viewport.width+'x'+viewport.height+': active view, own row, cache/races, error/retry focus, scroll, shared weekly, team today/all, full list return');
 await page.locator('.bottom-nav [data-nav="daily"]').click();assert.equal(await page.evaluate(()=>rankingsOrchestration().getState().viewportAnchor),null);assert.equal(await page.evaluate(()=>document.querySelector('.ranking-viewport-tail').style.height),'0px');
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
