'use strict';
// Actual local application; APIs are intercepted synthetic fixtures, never remote writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.PROPLET_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PROPLET_PREVIEW_ORIGIN||'http://127.0.0.1:8000';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'loopback app only');
const output=path.resolve(process.env.PROPLET_QA_OUTPUT||'artifacts/free-expansion-news');
const release='free-expansion-600-20261102';
const fixtureDay='2026-11-02';
const series=[['easy','Snadná','easy.webp'],['medium','Střední','medium.webp'],['hard','Těžká','hard.webp'],
 ['hardcore','Mozkožrout','hardcore.webp'],['mozkomor','Mozkomor','mozkomor.webp'],['mozkokalypsa','Mozkokalypsa','mozkokalypsa-series-ochre.svg']];
const checks=[],errors=[],requests=[],screenshots=[],layouts=[];
let allPassed=false;
const check=(name,value)=>{assert(value,name);checks.push(name)};
const syntheticProfile={id:'announcement-browser-fixture',name:'QA fixture',token:'synthetic-not-a-credential',
 avatar:'🙂',hasPassword:true,supportMode:'none',publicRankings:false,stats:{totalCompleted:6,points:100}};
let config,daily,rolling,tajenka;
async function localJSON(url){const response=await fetch(base+url);assert(response.ok,'local fixture '+url);return response.json()}
async function context(browser,{onboarded=true,authenticated=false,holdBudget=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(({onboarded,authenticated,holdBudget,profile})=>{
  window.__announcementAppReady=false;
  document.addEventListener('proplet:ready',()=>window.__announcementAppReady=true,{once:true});
  localStorage.setItem('proplet-theme','light');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');
  if(onboarded){localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done')}
  if(authenticated&&!localStorage.getItem('proplet-v2-profile'))localStorage.setItem('proplet-v2-profile',JSON.stringify(profile));
  // Returning veteran already read these older, higher-priority feature notices.
  if(authenticated){
   for(const id of ['archive-extra-v1','mozkokalypsa-100-v2'])localStorage.setItem('proplet:announcement:'+id+':account:'+profile.id,'1');
   localStorage.setItem('proplet:content-release:mk100-v2:account:'+profile.id,'1');
  }
  if(holdBudget&&!sessionStorage.getItem('announcement-qa-initialized')){
   sessionStorage.setItem('proplet:announcements:session:v1','1');sessionStorage.setItem('announcement-qa-initialized','1');
  }
 },{onboarded,authenticated,holdBudget,profile:syntheticProfile});
 await ctx.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base){requests.push({external:url.origin,method:request.method(),blocked:true});return route.abort()}
  if(!url.pathname.startsWith('/api/')){
   assert(['GET','HEAD'].includes(request.method()),'assets never accept writes');return route.continue();
  }
  requests.push({path:url.pathname,method:request.method(),mocked:true});
  const fulfill=json=>route.fulfill({status:200,json});
  if(url.pathname==='/api/config')return fulfill({...config,environment:'preview',livePlayerPreview:false});
  if(url.pathname==='/api/daily')return fulfill(daily);
  if(url.pathname==='/api/rolling-content')return fulfill(rolling);
  if(url.pathname==='/api/tajenka')return fulfill(tajenka);
  if(url.pathname==='/api/release-news')return fulfill({campaignId:'november-2026-release-v1',enabled:false,eligible:false,canShowAutomatically:false});
  if(url.pathname==='/api/patrons')return fulfill({enabled:false,authenticated,patron:false,thanksPending:false,canOffer:false});
  if(['/api/play-session/config','/api/free-order/config'].includes(url.pathname))return fulfill({enabled:false});
  if(url.pathname==='/api/me')return fulfill(syntheticProfile);
  if(url.pathname==='/api/account/snapshot')return fulfill({...syntheticProfile,completed:[],cursor:new Date().toISOString()});
  if(url.pathname==='/api/progress')return fulfill({completed:[]});
  if(url.pathname==='/api/team-victories')return fulfill({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[]});
  if(url.pathname==='/api/team-victories/personal')return fulfill({enabled:false,totalGold:0,history:[]});
  if(url.pathname==='/api/daily-special')return fulfill({schemaVersion:1,special:null,schedule:[]});
  if(!['GET','HEAD'].includes(request.method()))return fulfill({ok:true,synthetic:true});
  return fulfill({enabled:false,rows:[],players:[],history:[],total:0,myRank:null});
 });
 return ctx;
}
async function load(ctx){
 const page=await ctx.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date(fixtureDay+'T12:00:00+01:00'));
 await page.goto(base+'/?open=free',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__announcementAppReady&&window.PropletFreeExpansionRelease
  &&!document.documentElement.classList.contains('proplet-current-ui-booting'));
 await page.evaluate(async()=>{await window.__PROPLET_ENSURE_FULL_PUZZLE_DB();nav('free')});
 return page;
}
async function layout(page){
 return page.locator('#freeExpansionRelease').evaluate(dialog=>{
  const box=dialog.getBoundingClientRect(),style=getComputedStyle(dialog),title=dialog.querySelector('h2');
  const content=[title,...dialog.querySelectorAll('p,strong,button')].map(node=>{
   const r=node.getBoundingClientRect();return {text:node.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,
    width:r.width,height:r.height,fontSize:getComputedStyle(node).fontSize,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};
  });
  return {viewport:{width:innerWidth,height:innerHeight},box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},
   pageOverflow:document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:dialog.scrollWidth>dialog.clientWidth+1,
   background:style.backgroundColor,titleFamily:getComputedStyle(title).fontFamily,content,
   icons:[...dialog.querySelectorAll('.expansion-series img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})),
   labels:[...dialog.querySelectorAll('.expansion-series strong')].map(node=>node.textContent),
   focusedTitle:document.activeElement===title};
 });
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 [config,rolling]=await Promise.all(['/api/config','/api/rolling-content'].map(localJSON));
 const dailyBank=JSON.parse(fs.readFileSync('data/daily_gen6_private.json','utf8'));
 const binding=dailyBank.bindings.find(row=>row.dailyDate===fixtureDay);assert(binding,'frozen local Daily fixture');
 const puzzle=Object.values(dailyBank.puzzles).find(row=>row.id===binding.puzzleId);assert(puzzle);
 daily={schemaVersion:1,...binding,serverToday:fixtureDay,validUntil:fixtureDay+'T23:59:59+01:00',official:true,
  cacheKey:`daily:${fixtureDay}:${binding.bankVersion}`,puzzle};
 tajenka=JSON.parse(fs.readFileSync('tests/fixtures/browser/tajenka.json','utf8'));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:
  process.env.PROPLET_BROWSER_CHANNEL?{channel:process.env.PROPLET_BROWSER_CHANNEL}:{})});
 try{
  if(!process.argv.includes('--flows-only')){
  const ctx=await context(browser),page=await load(ctx);
  for(const theme of ['light','dark'])for(const viewport of [
   {width:320,height:740},{width:390,height:844},{width:690,height:900},{width:840,height:1024},{width:1280,height:900}]){
   await page.setViewportSize(viewport);
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;nav('free');document.querySelector('#difficultyCards [data-play-free="easy"]').focus()},theme);
   check(`native announcement opens ${viewport.width}/${theme}`,await page.evaluate(()=>PropletFreeExpansionRelease.open()));
   await page.locator('#freeExpansionRelease[open]').waitFor();await page.evaluate(()=>document.fonts.ready);
   const row=await layout(page);row.theme=theme;layouts.push(row);
   check(`dialog contained and readable ${viewport.width}/${theme}`,
    !row.pageOverflow&&!row.dialogOverflow&&row.box.left>=0&&row.box.right<=viewport.width+1&&row.box.top>=0&&row.box.bottom<=viewport.height+1
    &&row.content.every(item=>item.width>0&&item.height>0&&item.scrollWidth<=item.clientWidth+1));
   check(`six correct loaded icons ${viewport.width}/${theme}`,row.icons.length===6&&row.icons.every((img,i)=>img.loaded&&img.src==='/difficulty/printshop/'+series[i][2]));
   check(`approved labels, minimal copy and focus ${viewport.width}/${theme}`,JSON.stringify(row.labels)===JSON.stringify(series.map(s=>s[1]))&&row.focusedTitle
    &&await page.locator('#freeExpansionRelease .eyebrow').count()===0
    &&await page.locator('#freeExpansionCopy').textContent()==='Po 100 v každé obtížnosti.');
   const file=path.join(output,`announcement-${viewport.width}-${theme}.png`);await page.screenshot({path:file});screenshots.push(file);
   await page.locator('#freeExpansionRelease .expansion-close').click();
   check(`close restores native opener ${viewport.width}/${theme}`,await page.evaluate(()=>document.activeElement?.dataset.playFree==='easy'&&!document.querySelector('#freeExpansionRelease').open));
  }
  await page.evaluate(()=>{document.documentElement.dataset.theme='light';nav('daily');document.querySelector('#settingsHeaderBtn').focus()});
  check('manual open from Today',await page.evaluate(()=>PropletFreeExpansionRelease.open()));
  await page.locator('#freeExpansionRelease .expansion-later').click();
  check('Later restores visible Today opener',await page.evaluate(()=>document.activeElement.id==='settingsHeaderBtn'&&!document.querySelector('#freeExpansionRelease').open));
  await page.evaluate(()=>PropletFreeExpansionRelease.open());
  await page.keyboard.press('Escape');
  check('Escape closes and restores visible Today opener',await page.evaluate(()=>document.activeElement.id==='settingsHeaderBtn'&&!document.querySelector('#freeExpansionRelease').open));
  await page.evaluate(()=>PropletFreeExpansionRelease.open());
  await page.locator('#freeExpansionRelease [data-expansion-play]').click();
  check('CTA reaches existing six-difficulty selection and focuses its first button',await page.evaluate(()=>currentScreen==='free'
   &&document.querySelectorAll('#difficultyCards [data-play-free]').length===6&&document.activeElement.dataset.playFree==='easy'
   &&!document.querySelector('#freeExpansionRelease').open));
  // Use the native Settings entry, not the announcement controller shortcut.
  await page.setViewportSize({width:390,height:844});
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;nav('daily')},theme);
   await page.locator('#settingsHeaderBtn').click();
   await page.locator('#releaseNewsSettings').click();await page.locator('#releaseNewsDialog[open]').waitFor();
   check(`manual What is new includes the short 600 note ${theme}`,await page.locator('#releaseNewsDialog .release-news-levels').textContent().then(text=>/600 nových úrovní/.test(text)&&/Po\s+100 v\s+každé obtížnosti/.test(text)));
   const file=path.join(output,`manual-news-390-${theme}.png`);await page.screenshot({path:file});screenshots.push(file);
   await page.locator('#releaseNewsDialog .release-news-close').click();
  }
  await ctx.close();
  }
  // Positive automatic control follows two real app states that must defer it.
  const automaticContext=await context(browser,{onboarded:true,authenticated:false,holdBudget:true}),automatic=await load(automaticContext);
  await automatic.evaluate(()=>{localStorage.removeItem('proplet-v3-7-required-onboarding');localStorage.removeItem('proplet-v3-16-2-helper-onboarding');
   openOnboarding();sessionStorage.removeItem('proplet:announcements:session:v1')});
  await automatic.waitForFunction(()=>currentGame?.mode==='starter'&&onboardingMandatory===true);
  await automatic.evaluate(()=>PropletAnnouncements.kick());await automatic.waitForTimeout(120);
  check('automatic announcement does not interrupt actual mandatory training',await automatic.locator('#freeExpansionRelease[open]').count()===0
   &&!await automatic.evaluate(()=>PropletFreeExpansionRelease.open()));
  await automatic.evaluate(async profile=>{closeOnboarding(true);await startGame(puzzleDB.free.easy[0],'free');saveProfile(profile);PropletAnnouncements.kick()},syntheticProfile);
  await automatic.waitForTimeout(120);
  check('automatic announcement does not interrupt actual free-game screen',await automatic.evaluate(()=>currentScreen==='game'&&currentGame.mode==='free'
   &&!document.querySelector('#freeExpansionRelease[open]')&&!PropletAnnouncements.sessionUsed()&&PropletFreeExpansionRelease.open()===false));
  await automatic.evaluate(()=>nav('free'));
  await automatic.waitForTimeout(120);
  check('actual training session stays quiet after returning to the menu',await automatic.evaluate(()=>PropletFirstSteps.quiet()
   &&!document.querySelector('#freeExpansionRelease[open]')&&!PropletAnnouncements.sessionUsed()));
  await automaticContext.close();
  const returningContext=await context(browser,{onboarded:true,authenticated:true}),returning=await load(returningContext);
  try{await returning.locator('#freeExpansionRelease[open]').waitFor()}catch(error){
   const state=await returning.evaluate(()=>({screen:currentScreen,profile:getProfile()?.id,completed:getProfile()?.stats?.totalCompleted,
    quiet:PropletFirstSteps.quiet(),mandatory:onboardingMandatory,onboarded:localStorage.getItem('proplet-v3-7-required-onboarding'),
    used:PropletAnnouncements.sessionUsed(),blocked:[...document.querySelectorAll('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)')].map(el=>el.id),
    pending:['archive-extra-v1','mozkokalypsa-100-v2','referrals-v1','november-2026-release-v1','free-expansion-600-20261102'].map(id=>[id,PropletAnnouncements.hasPending(id)])}));
   fs.writeFileSync(path.join(output,'automatic-failure.json'),JSON.stringify(state,null,2));
   await returning.screenshot({path:path.join(output,'automatic-failure.png')});throw error;
  }
  check('eligible returning account automatically receives the new announcement',await returning.evaluate(()=>PropletAnnouncements.sessionUsed()
   &&localStorage.getItem('proplet:announcement:free-expansion-600-20261102:account:announcement-browser-fixture')==='1'));
  await returning.locator('#freeExpansionRelease [data-expansion-close]').first().click();
  await returning.reload({waitUntil:'domcontentloaded'});await returning.waitForFunction(()=>window.__announcementAppReady);
  check('same-tab reload preserves automatic one-per-session budget',await returning.evaluate(()=>PropletAnnouncements.sessionUsed()&&!document.querySelector('#freeExpansionRelease[open]')));
  await returningContext.close();
  check('no browser runtime errors',errors.length===0);
  check('all API writes were intercepted locally',requests.filter(request=>request.method!=='GET'&&request.method!=='HEAD').every(request=>request.mocked||request.blocked));
  allPassed=true;
 }finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({allPassed,mode:process.argv.includes('--flows-only')?'flows-only':'full',checks,errors,layouts,screenshots,requests,
   scope:'Native app on loopback; synthetic intercepted APIs; viewport emulation, not physical devices'},null,2));
  console.log(JSON.stringify({passed:checks.length,errors,screenshots:screenshots.length}));await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
