'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8000',out='qa-refresh300';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[];function check(name,pass){checks.push({name,pass:!!pass});assert(pass,name)}
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await page.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.continue());
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{if(localStorage.getItem('qa-seeded'))return;localStorage.setItem('qa-seeded','1');
  for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(key,'done');
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  localStorage.setItem('proplet-v2-state:guest',JSON.stringify({completed:{'free:g4-e-001':{puzzleId:'g4-e-001',mode:'free',difficulty:'easy',level:1,contentGeneration:4,completedAt:'2026-10-01T08:00:00Z',points:15}},rescues:{},inProgress:{},dailyDates:[],statsVersion:5}));
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#freeRefreshAnnouncement').waitFor({state:'visible'});
 check('automatic announcement, no autofocus outline',await page.locator('[data-refresh-play]').evaluate(n=>getComputedStyle(n).outlineStyle==='none'||getComputedStyle(n).outlineWidth==='0px'));
 for(const width of [320,390,840,1440]){
  await page.setViewportSize({width,height:900});
  check('modal fits '+width,await page.evaluate(()=>{const r=document.querySelector('.refresh-announcement').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth+1}));
  await page.screenshot({path:`${out}/modal-${width}.png`});
 }
 await page.keyboard.press('Tab');check('keyboard focus restored',await page.evaluate(()=>!document.querySelector('#freeRefreshAnnouncement').classList.contains('refresh-initial-focus')&&document.activeElement.matches('[data-refresh-back]')));
 await page.locator('[data-refresh-play]').click();check('CTA opens real difficulty selection',await page.locator('#screen-free').isVisible());
 await page.evaluate(()=>nav('daily'));
 for(const width of [320,390,840]){
  await page.setViewportSize({width,height:900});
  check('Daily title and gap '+width,await page.evaluate(()=>{const h=document.querySelector('.daily-hero h1'),strip=document.querySelector('#dailyWeekRhythm');return getComputedStyle(h).fontFamily.includes('Fraunces')&&strip.getBoundingClientRect().top-h.getBoundingClientRect().bottom<=25&&!document.querySelector('.daily-week-rhythm-head')}));
  check('all three banner illustrations fit '+width,await page.locator('#freeRefreshToday').evaluate(root=>{const a=[...root.querySelectorAll('img')].map(n=>n.getBoundingClientRect());return a.length===3&&a.every(r=>r.width>=32)&&a.slice(1).every((r,i)=>r.left>=a[i].right&&Math.abs(r.top-a[i].top)<1)}));
  await page.screenshot({path:`${out}/today-${width}.png`,fullPage:true});
 }
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#freeOrderSettings'));check('dismissal remembered and no second promo',await page.evaluate(()=>!document.querySelector('#freeRefreshAnnouncement:not(.hidden)')));
 await page.evaluate(()=>nav('free'));
 check('400 levels and varied next board',await page.evaluate(()=>puzzleDB.free.easy.length===400&&freeOrder().record('easy').mode==='varied'&&freeOrder().next('easy',null).id==='g6-refresh-easy-001'));
 check('compact next-board information; no card switch',await page.evaluate(()=>document.querySelectorAll('#difficultyCards .order-next').length===6&&!document.querySelector('#difficultyCards select')));
 await page.locator('#settingsHeaderBtn').click();await page.locator('#freeOrderSettings summary').click();
 check('four opt-outs, endgames excluded',await page.locator('#freeOrderSettings select').count()===4);
 await page.locator('#freeOrder-easy').selectOption('numeric');check('explicit numeric preference takes effect',await page.evaluate(()=>freeOrder().record('easy').mode==='numeric'));
 await page.locator('#freeOrder-easy').selectOption('varied');
 await page.evaluate(()=>nav('free'));await page.locator('#difficultyCards [data-diff="easy"] [data-play-free]').click();
 check('native game starts approved new board',await page.evaluate(()=>currentGame?.puzzle?.id==='g6-refresh-easy-001'&&currentGame.mode==='free'));
 await page.screenshot({path:`${out}/new-board.png`});
 const newcomer=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await newcomer.route('**/*',route=>new URL(route.request().url()).origin!==base?route.abort():route.continue());await newcomer.goto(base,{waitUntil:'domcontentloaded'});
 await newcomer.waitForFunction(()=>typeof currentGame!=='undefined'&&currentGame?.mode==='starter');
 check('newcomer retains native onboarding without CTA',await newcomer.evaluate(()=>currentGame?.mode==='starter'&&!document.querySelector('#freeRefreshAnnouncement:not(.hidden)')));await newcomer.close();
 check('no browser runtime errors',errors.length===0);
 }finally{fs.writeFileSync(`${out}/report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
