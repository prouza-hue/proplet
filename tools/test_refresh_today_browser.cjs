'use strict';
// Real native shell with loopback-only guest fixtures; no production or account traffic.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8896';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'loopback fixture required');
const artifacts=path.join(root,'artifacts/refresh-today');fs.mkdirSync(artifacts,{recursive:true});
let browser,server;const checks=[],errors=[];
async function ready(page){
 await page.waitForFunction(()=>window.__refreshBootReady===true);
 await page.locator('#propletBootScreen').waitFor({state:'detached'});
 await page.evaluate(()=>{
  if(typeof closeOnboarding==='function')closeOnboarding(true);
  window.PropletRefreshRelease?.close();window.PropletContentRelease?.close();
  document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));
  document.querySelector('.release-notes-v3331-backdrop')?.remove();
 });
}
async function today(page,label){
 assert.equal(await page.evaluate(()=>currentScreen),'daily',label);
 assert.equal(await page.locator('#screen-daily').isVisible(),true,label+' visible Today');
 assert.equal(await page.locator('.bottom-nav [data-nav="daily"]').evaluate(el=>el.classList.contains('active')),true,label+' active Today tab');
 assert.equal(await page.evaluate(()=>history.state.screen),'daily',label+' history root');
}
async function progressSurvives(){
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(()=>{document.addEventListener('proplet:ready',()=>window.__refreshBootReady=true,{once:true});localStorage.setItem('proplet-v3-7-required-onboarding','done');});
 const page=await ctx.newPage();page.setDefaultTimeout(20000);
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready(page);
 const saved=await page.evaluate(()=>{
  const puzzle=puzzleDB.free.easy[0],key=challengeKey('free',puzzle,null),state=getState();
  const answer=puzzle.answers[0];
  const progress={puzzleId:puzzle.id,mode:'free',difficulty:'easy',dailyDate:null,found:[{answerIndex:0,word:answer.word,colorIndex:0,path:[...answer.path]}],moves:1,hints:0,wrongAttempts:0,maxHintLevel:0,cleanSolve:true,elapsedMs:12000,savedAt:Date.now()};
  state.inProgress=state.inProgress||{};state.inProgress[key]=progress;saveState(state);nav('game');return {key,progress};
 });
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page,'saved game refresh');
 assert.deepEqual(await page.evaluate(key=>getState().inProgress[key],saved.key),saved.progress,'refresh preserves found word/path, moves and elapsed time');
 checks.push('Saved free-game progress survives refresh unchanged');await ctx.close();
}
async function run(viewport,standalone){
 const label=viewport.width+'px '+(standalone?'standalone':'browser');console.log('START '+label);
 const ctx=await browser.newContext({viewport,screen:viewport,hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(({standalone})=>{
  const nativeMatch=window.matchMedia.bind(window);
  window.matchMedia=query=>{const result=nativeMatch(query);if(query==='(display-mode: standalone)')Object.defineProperty(result,'matches',{value:standalone});return result;};
  Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone});
  document.addEventListener('proplet:ready',()=>{window.__refreshBootReady=true},{once:true});
  localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
  localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');sessionStorage.setItem('proplet-gen4-release-modal-v1','1');
  for(const key of ['g5-r1','mk100-v2','refresh300-v1'])localStorage.setItem('proplet:content-release:'+key,'1');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
 },{standalone});
 const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(label+': '+error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready(page);await today(page,label+' cold start');
 assert.equal(await page.evaluate(()=>isStandaloneApp()),standalone,'display mode emulation');
 for(const screen of ['daily','free','profile','leaderboard','weekly','monthly','game']){
  console.log(label+' refresh '+screen);await page.evaluate(screen=>nav(screen),screen);
  assert.equal(await page.evaluate(()=>currentScreen),screen,label+' entered '+screen);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page,label+' refresh from '+screen);
 }
 console.log(label+' awards click');
 // Reproduce the original real interaction which used to poison all later tabs.
 await page.locator('.bottom-nav [data-nav="leaderboard"]').click();
 await page.locator('#screen-monthly [data-monthly-panel="awards"]').click();
 assert.equal(new URL(page.url()).searchParams.has('open'),false,'monthly awards do not create a startup URL');
 await page.locator('.bottom-nav [data-nav="daily"]').click();
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page,label+' awards -> Today refresh');
 for(const open of ['monthly','weekly','free']){console.log(label+' link '+open);
  await page.goto(base+'/?open='+open+(open==='monthly'?'&panel=awards&collection=2026-11':'')+'&utm_source=refresh-check#keep',{waitUntil:'domcontentloaded'});
  await ready(page);assert.equal(await page.evaluate(()=>currentScreen),open,label+' external '+open+' link');
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page,label+' linked '+open+' refresh');
  const url=new URL(page.url());assert.equal(url.searchParams.get('utm_source'),'refresh-check');assert.equal(url.hash,'#keep');
  for(const key of ['open','panel','collection'])assert.equal(url.searchParams.has(key),false,'consumed '+key);
 }
 await page.evaluate(()=>{nav('profile');history.replaceState(history.state,'','/?open=monthly&panel=awards&collection=2026-11&utm_source=legacy#keep')});
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);await today(page,label+' legacy stale URL refresh');
 assert.equal(new URL(page.url()).searchParams.get('utm_source'),'legacy');
 await page.screenshot({path:path.join(artifacts,viewport.width+'-'+(standalone?'standalone':'browser')+'.png'),fullPage:true});
 checks.push(label+': cold start, seven screens, awards interaction, three fresh links/reloads, legacy stale URL');
 await ctx.close();
}
(async()=>{
 if(!process.env.TEST_URL){
  server=spawn(process.execPath,[path.join(__dirname,'browser_fixture_server.cjs')],{cwd:root,env:{...process.env,PORT:new URL(base).port},stdio:['ignore','pipe','inherit']});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('fixture exited '+code)))});
 }
 const health=await fetch(base+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&health.database===false);
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 if(!process.env.REFRESH_PROGRESS_ONLY)for(const viewport of [{width:390,height:844},{width:768,height:1000}])for(const standalone of [false,true])await run(viewport,standalone);
 await progressSurvives();
 assert.deepEqual(errors,[],'browser exceptions');
 fs.writeFileSync(path.join(artifacts,process.env.REFRESH_PROGRESS_ONLY?'progress-report.json':'report.json'),JSON.stringify({ok:true,checks,errors},null,2));
 console.log('PASS refresh Today browser: '+checks.join('; '));
})().catch(error=>{console.error(error,errors);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
