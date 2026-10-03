'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FREE_REFRESH_PREVIEW_URL.replace(/\/$/,''),out=process.env.FREE_REFRESH_QA_OUTPUT||'qa-free-refresh-300-online';fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],measurements=[],requests=[];const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name)};
const shot=(p,n)=>p.screenshot({path:path.join(out,'cta-v4-'+n+'.png'),fullPage:true});
const ready=p=>p.waitForFunction(()=>!!window.PropletRefreshRelease&&document.querySelectorAll('#freeOrderSettings select').length===4);
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});page.on('request',r=>requests.push(r.url()));
 await page.goto(base+'/',{waitUntil:'networkidle'});await ready(page);await page.locator('#freeRefreshAnnouncement').waitFor({state:'visible'});
 check('returning-player preview automatically opens release modal',await page.locator('#freeRefreshAnnouncement').isVisible());
 check('dialog has a labelled title and description, focus on the main action',await page.evaluate(()=>{const m=document.querySelector('#freeRefreshAnnouncement');return m.getAttribute('aria-modal')==='true'&&document.getElementById(m.getAttribute('aria-labelledby'))?.textContent.includes('rozplétat')&&!!document.getElementById(m.getAttribute('aria-describedby'))&&document.activeElement.matches('[data-refresh-play]')}));
 check('modal makes background inert and prevents background scrolling',await page.evaluate(()=>document.body.style.overflow==='hidden'&&[...document.body.children].filter(n=>n.tagName==='DIV'&&n.id!=='freeRefreshAnnouncement').every(n=>n.inert)));
 await page.keyboard.press('Tab');check('Tab reaches secondary action',await page.evaluate(()=>document.activeElement.matches('[data-refresh-back]')));await page.keyboard.press('Tab');check('Tab wraps inside dialog',await page.evaluate(()=>document.activeElement.matches('[data-refresh-close]')));await page.keyboard.press('Shift+Tab');check('reverse Tab wraps inside dialog',await page.evaluate(()=>document.activeElement.matches('[data-refresh-back]')));
 for(const [width,height] of [[320,640],[360,740],[390,844],[840,900],[1440,1000],[320,480]]){
  await page.setViewportSize({width,height});
  const m=await page.evaluate(()=>{const c=document.querySelector('.refresh-announcement'),r=c.getBoundingClientRect(),cards=[...document.querySelectorAll('.refresh-release-series')].map(n=>n.getBoundingClientRect()),imgs=[...document.querySelectorAll('.refresh-release-series img')].map(n=>({loaded:n.complete&&n.naturalWidth>0,r:n.getBoundingClientRect().toJSON()}));return{width:innerWidth,height:innerHeight,card:r.toJSON(),overflow:document.documentElement.scrollWidth>innerWidth+1,aligned:cards.every(c=>Math.abs(c.top-cards[0].top)<1),separated:cards.slice(1).every((c,i)=>c.left>=cards[i].right),images:imgs,scrollable:c.scrollHeight>c.clientHeight}});measurements.push(m);
  check('modal fits and illustration cards align at '+width+'×'+height,!m.overflow&&m.card.left>=0&&m.card.right<=width&&m.card.top>=0&&m.card.bottom<=height&&m.aligned&&m.separated&&m.images.every(i=>i.loaded&&i.r.width>=40));
  if(height>=640)await shot(page,'modal-'+width);
 }
 await page.setViewportSize({width:390,height:844});await page.keyboard.press('Escape');
 check('Escape closes modal and restores the background',await page.evaluate(()=>document.querySelector('#freeRefreshAnnouncement').classList.contains('hidden')&&document.body.style.overflow!=='hidden'&&![...document.body.children].some(n=>n.inert)));
 await page.reload({waitUntil:'networkidle'});await ready(page);
 check('dismissal prevents automatic reappearance after reload',!(await page.locator('#freeRefreshAnnouncement').isVisible()));
 check('dismissing modal leaves the Today box visible',await page.locator('#freeRefreshToday').isVisible());
 for(const width of [320,360,390,840,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>nav('daily'));
  const m=await page.evaluate(()=>{const box=document.querySelector('#freeRefreshToday'),r=box.getBoundingClientRect(),imgs=[...box.querySelectorAll('.refresh-entry-art img')].map(n=>({loaded:n.complete&&n.naturalWidth>0,r:n.getBoundingClientRect().toJSON()})),h=document.querySelector('.daily-hero h1'),days=[...document.querySelectorAll('#dailyWeekRhythm .daily-week-day')];return{width:innerWidth,box:r.toJSON(),bg:getComputedStyle(box).backgroundImage,images:imgs,overflow:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(h).fontFamily,oldTextHidden:['dailyDate','dailyMeta'].every(id=>getComputedStyle(document.getElementById(id)).display==='none')&&!document.querySelector('.daily-week-rhythm-head'),days:days.length,active:days.filter(n=>n.getAttribute('aria-current')==='date').length,dayFont:parseFloat(getComputedStyle(days[0].querySelector('b')).fontSize),iconSize:days[0].querySelector('img').getBoundingClientRect().width}});measurements.push(m);
  check('all three banner icons are visible, aligned and separated at '+width,m.images.length===3&&m.images.every(i=>i.loaded&&i.r.width>=32&&i.r.top>=m.box.top&&i.r.bottom<=m.box.bottom)&&m.images.every(i=>Math.abs(i.r.top-m.images[0].r.top)<1)&&m.images.slice(1).every((i,k)=>i.r.left>=m.images[k].r.right));
  check('highlighted banner and readable simplified daily card fit '+width,!m.overflow&&m.bg!=='none'&&m.font.includes('Fraunces')&&m.oldTextHidden&&m.days===7&&m.active===1&&m.dayFont>=13&&m.iconSize>=23);
  await shot(page,'today-'+width);
 }
 await page.locator('[data-refresh-choose]').click();check('banner action opens difficulty selection',await page.locator('#screen-free').isVisible());
 await page.goto(base+'/?announcement=refresh',{waitUntil:'networkidle'});await ready(page);await page.locator('#freeRefreshAnnouncement').waitFor({state:'visible'});
 await page.locator('[data-refresh-play]').click();check('modal action closes cleanly and opens difficulty selection',await page.locator('#screen-free').isVisible()&&!(await page.locator('#freeRefreshAnnouncement').isVisible())&&await page.evaluate(()=>!document.querySelector('.app')?.inert));
 await page.setViewportSize({width:390,height:844});await page.locator('#settingsHeaderBtn').click();await page.locator('[data-theme-mode="dark"]').click();await page.evaluate(()=>nav('daily'));await shot(page,'today-dark-390');
 await page.evaluate(()=>PROPLET_FREE_REFRESH_PREVIEW.showAnnouncement());await shot(page,'modal-dark-390');await page.locator('[data-refresh-back]').click();
 check('secondary dismissal works in dark mode',!(await page.locator('#freeRefreshAnnouncement').isVisible()));
 await page.evaluate(()=>PROPLET_FREE_REFRESH_PREVIEW.showAnnouncement());await page.locator('#freeRefreshAnnouncement').click({position:{x:4,y:4}});check('backdrop dismissal restores background',!(await page.locator('#freeRefreshAnnouncement').isVisible())&&await page.evaluate(()=>document.body.style.overflow!=='hidden'));
 await page.evaluate(()=>{nav('free');nav('daily');PROPLET_FREE_REFRESH_PREVIEW.showAnnouncement()});await page.goBack();
 check('native Back closes modal and restores interactive background',await page.evaluate(()=>document.querySelector('#freeRefreshAnnouncement').classList.contains('hidden')&&document.body.style.overflow!=='hidden'&&![...document.body.children].some(n=>n.inert)));
 await page.locator('[data-refresh-dismiss]').click();await page.reload({waitUntil:'networkidle'});await ready(page);await page.locator('[data-refresh-close]').click();
 check('box dismissal is independent and persists',!(await page.locator('#freeRefreshToday').isVisible()));
 const newcomer=await browser.newPage({viewport:{width:390,height:844}});await newcomer.goto(base+'/?onboarding=1',{waitUntil:'networkidle'});await ready(newcomer);
 check('new player sees native training and no release modal',await newcomer.evaluate(()=>currentGame?.mode==='starter'&&!document.querySelector('#freeRefreshAnnouncement:not(.hidden)')));await newcomer.close();
 check('no runtime or HTTP errors',errors.length===0);check('no external or API request reaches network',requests.every(url=>url.startsWith(base+'/')&&!new URL(url).pathname.startsWith('/api/')));
 console.log(JSON.stringify({checks,errors,measurements},null,2));
 }catch(e){errors.push(String(e));console.log(JSON.stringify({checks,errors,measurements},null,2));throw e}
 finally{fs.writeFileSync(path.join(out,'cta-v4-verification.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,measurements},null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
