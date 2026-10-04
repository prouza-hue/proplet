const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true}),out='qa-mk-achievements';fs.mkdirSync(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await context.addInitScript(()=>{localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('proplet:content-release:refresh300-v1','1');localStorage.setItem('proplet:content-release:mk100-v2','1')});
 try{
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB?.free?.mozkokalypsa?.length===100&&window.PropletAchievementDetails);
  await page.evaluate(()=>{closeTransientModals();const s=getState();s.completed={};for(const p of puzzleDB.free.mozkokalypsa.slice(0,25))s.completed['free:'+p.id]={mode:'free',difficulty:'mozkokalypsa',puzzleId:p.id,level:p.meta.level,contentGeneration:4,elapsedMs:100000,points:200,completedAt:'2026-10-04T00:00:00Z'};saveState(s);nav('profile')});
  const baseline=await page.evaluate(()=>JSON.stringify(getState()));
  // Summary is interactive, too; opening it cannot change progress or mark a celebration seen.
  const summary=page.locator('.achievement-peek[data-achievement-detail]').first();await summary.tap();await page.locator('#achievementDetail[open]').waitFor();await page.keyboard.press('Escape');
  await page.locator('#achievementToggleBtn').click();
  const groups=await page.locator('.achievement-group-head>strong').allTextContents();assert.equal(groups[groups.indexOf('Mozkožrout')+1],'Mozkomor');assert.equal(groups[groups.indexOf('Mozkožrout')+2],'Mozkokalypsa');
  const tamer=page.locator('.achievement[data-achievement="mozkokalypsa-25"]');await tamer.tap();
  const dialog=page.locator('#achievementDetail');await page.waitForFunction(()=>document.querySelector('#achievementDetailArt img')?.naturalWidth>0);
  assert.equal(await page.locator('#achievementDetailTitle').textContent(),'Krotitel pohromy');assert.match(await page.locator('#achievementDetailArt img').getAttribute('src'),/tamer2/);assert.equal(await page.locator('#achievementDetailStatus').textContent(),'Získáno');
  for(const [width,height] of [[320,700],[390,844],[768,1024],[1440,1000]]){
   await page.setViewportSize({width,height});
   assert(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1),'no horizontal overflow');
   assert(await page.evaluate(()=>{const d=document.querySelector('#achievementDetail').getBoundingClientRect();return d.left>=0&&d.right<=innerWidth&&d.top>=0&&d.bottom<=innerHeight}));
   await page.screenshot({path:`${out}/achievement-detail-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:`${out}/achievement-detail-dark.png`});
  // Native dialog keeps keyboard focus inside; Escape returns it without moving the page.
  for(let i=0;i<4;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(d=>d.contains(document.activeElement)))}
  await page.keyboard.press('Escape');assert.equal(await page.locator('#achievementDetail[open]').count(),0);assert(await tamer.evaluate(t=>document.activeElement===t));assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await tamer.press('Enter');await page.locator('.achievement-detail-x').click();await tamer.press('Space');await page.locator('.achievement-detail-done').click();
  // Android/browser Back closes the detail first and preserves the current screen.
  await tamer.tap();await page.evaluate(()=>history.back());await page.waitForFunction(()=>!document.querySelector('#achievementDetail').open);assert.equal(await page.evaluate(()=>currentScreen),'profile');assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await tamer.tap();await page.mouse.click(2,2);await page.waitForFunction(()=>!document.querySelector('#achievementDetail').open);
  // Locked art is intentionally inspectable in colour, with an unambiguous requirement/progress.
  await page.locator('.achievement[data-achievement="mozkokalypsa-100"]').tap();assert.equal(await page.locator('#achievementDetailStatus').textContent(),'25 / 100 · Zatím nezískáno');assert.equal(await page.locator('#achievementDetail .is-locked').count(),0);await page.screenshot({path:`${out}/achievement-detail-locked.png`});await page.keyboard.press('Escape');
  // Every live ID has its own copy and usable illustration, including long titles and speed goals.
  const all=await page.evaluate(()=>ACHIEVEMENTS.map(a=>({id:a.id,name:a.name,desc:a.desc,group:a.group})));
  for(const a of all){await page.evaluate(id=>PropletAchievementDetails.open(id),a.id);assert.equal(await page.locator('#achievementDetailTitle').textContent(),a.name);assert.equal(await page.locator('#achievementDetailCondition').textContent(),a.desc);assert((await page.locator('#achievementDetailStory').textContent()).length>15);await page.waitForFunction(()=>document.querySelector('#achievementDetailArt img')?.naturalWidth>0);assert.equal(await page.locator('#achievementDetailProgress').isHidden(),a.group==='speed');await page.keyboard.press('Escape')}
  assert.equal(await page.evaluate(()=>JSON.stringify(getState())),baseline,'opening details is read-only');
  await tamer.tap();await page.evaluate(()=>closeTransientModals());assert.equal(await page.locator('#achievementDetail[open]').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/achievement-details-report.json`,JSON.stringify({status:'PASS',count:all.length,checks:['97 unique stories and decoded illustrations','touch, Enter, Space, focus containment and return','Escape, close buttons, backdrop, Android Back, global close','320/390/768/1440, dark and locked','read-only state, difficulty order']},null,2));
 }catch(error){await page.screenshot({path:`out/failure.png`.replace('out/',out+'/'),fullPage:true});throw error}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
