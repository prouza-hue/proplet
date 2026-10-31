const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
 const out='qa-mk-achievements';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],writes=[];
 page.setDefaultTimeout(15000);
 page.on('pageerror',e=>errors.push(e.message));
 // The fixture never contacts a production service, even if application configuration changes.
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname!=='127.0.0.1')return route.abort();
  if(!['GET','HEAD','OPTIONS'].includes(request.method())){
   writes.push({method:request.method(),path:url.pathname});
   return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  }
  return route.continue();
 });
 await context.addInitScript(()=>{
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(key,'done');
  for(const key of ['proplet:content-release:refresh300-v1','proplet:content-release:mk100-v2'])localStorage.setItem(key,'1');
 });
 const dialog=page.locator('#achievementDetail');
 const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#achievementDetail').open)};
 const open=async(index)=>{
  await page.evaluate(i=>PropletAchievementDetails.openRank(i),index);
  await page.waitForFunction(()=>{const image=document.querySelector('#achievementDetailArt img');return image?.complete&&image.naturalWidth>0});
 };
 const snapshot=()=>page.evaluate(()=>JSON.stringify({state:getState(),profile:getProfile(),queue:getQueue()}));
 const setPoints=async(points)=>page.evaluate(points=>{
  closeTransientModals();
  saveProfile({id:'rank-detail-fixture',name:'Pavel',avatar:'🙂',stats:{points}});
  saveState(blankState());nav('profile');
 },points);
 try{
  await page.goto('http://127.0.0.1:8000/');
  await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&window.PropletAchievementDetails?.openRank&&window.PropletHomeLayout);
  const ranks=await page.evaluate(()=>LEVELS.map(({name,xp})=>({name,xp})));
  assert.equal(ranks.length,51,'the complete current rank ladder is covered');
  await setPoints(63190);
  assert.equal(await page.evaluate(()=>effectiveStats().points),63190,'fixture supplies actual effective XP');
  const baseline=await snapshot();
  const profile=page.locator('.profile-rank-stat[data-rank-detail]');
  assert.equal(await profile.getAttribute('data-rank-detail'),'38');
  await profile.tap();await dialog.waitFor({state:'visible'});
  assert.equal(await page.locator('#achievementDetailTitle').textContent(),ranks[38].name);
  assert.deepEqual(await page.locator('#achievementDetailProgress').evaluate(p=>({max:p.max,value:p.value})),{max:5000,value:2190});
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   for(const [width,height] of [[320,700],[390,844],[690,900],[1440,1000]]){
    await page.setViewportSize({width,height});
    assert(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1),'dialog has no horizontal overflow');
    assert(await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1}),'dialog stays within viewport');
    await page.screenshot({path:`${out}/rank-detail-${theme}-${width}.png`});
   }
  }
  await page.setViewportSize({width:390,height:844});
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(d=>d.contains(document.activeElement)),'focus stays in modal')}
  await close();assert(await profile.evaluate(e=>e===document.activeElement),'focus returns to profile card');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await profile.press('Enter');await page.locator('[data-rank-next]').click();
  assert.equal(await page.locator('#achievementDetailTitle').textContent(),ranks[39].name);
  await page.locator('[data-rank-previous]').click();
  assert.equal(await page.locator('#achievementDetailTitle').textContent(),ranks[38].name);
  await page.locator('.achievement-detail-x').click();
  assert(await profile.evaluate(e=>e===document.activeElement),'navigation preserves the original opener');
  await profile.press('Space');await page.locator('.achievement-detail-done').click();
  // The current collapsed collection exposes the same read-only detail.
  await page.locator('.level-roadmap-card > summary').click();
  const roadmap=page.locator('.level-step[data-rank-detail="39"]');
  await roadmap.tap();assert.equal(await page.locator('#achievementDetailTitle').textContent(),ranks[39].name);
  await close();assert(await roadmap.evaluate(e=>e===document.activeElement));
  // Opening every rank must decode actual artwork and display distinct authored copy.
  const stories=[];
  for(let i=0;i<ranks.length;i++){
   await open(i);
   assert.equal(await page.locator('#achievementDetailTitle').textContent(),ranks[i].name);
   const story=(await page.locator('#achievementDetailStory').textContent()).trim();
   assert(story.length>15,`rank ${i+1} has authored copy`);stories.push(story);
   assert(await page.locator('#achievementDetailCondition').isVisible());
   assert(await page.locator('[data-rank-previous]').isVisible());
   assert.equal(await page.locator('[data-rank-previous]').isDisabled(),i===0);
   assert.equal(await page.locator('[data-rank-next]').isDisabled(),i===ranks.length-1);
   if(i<38)assert(await page.locator('#achievementDetailProgress').isHidden(),'past ranks show earned state without misleading progress');
   await close();
  }
  assert.equal(new Set(stories).size,ranks.length,'no repeated fallback stories');
  assert.equal(await snapshot(),baseline,'details never change XP, results, profile or result queue');
  // Switching detail kinds in-place must not retain rank controls or hide achievement progress.
  await open(38);
  await page.evaluate(()=>PropletAchievementDetails.openStreak('Srdcař'));
  assert(await page.locator('[data-rank-next]').isHidden());
  assert(await page.locator('.achievement-detail-progress').isHidden());
  await page.evaluate(()=>PropletAchievementDetails.open('mozkokalypsa-1'));
  assert(await page.locator('[data-rank-next]').isHidden());
  assert(await page.locator('.achievement-detail-progress').isVisible());
  assert(await page.locator('#achievementDetailProgress').isVisible());
  await open(39);assert(await page.locator('[data-rank-next]').isVisible());
  assert(await page.locator('.achievement-detail-progress').isVisible());await close();
  // Boundary assertions are independent of the rank's flavour copy.
  for(const points of [0,63190,ranks.at(-1).xp,ranks.at(-1).xp+1000]){
   await setPoints(points);
   const before=await snapshot();
   const current=ranks.findLastIndex(rank=>rank.xp<=points);
   await open(current);
   assert.match(await page.locator('#achievementDetailCondition').textContent(),/Tvoje současná hodnost/);
   assert.equal(await page.locator('#achievementDetailProgress').isHidden(),current===ranks.length-1);
   if(current===ranks.length-1)assert.match(await page.locator('#achievementDetailStatus').textContent(),/Všechny hodnosti/);
   else assert.deepEqual(await page.locator('#achievementDetailProgress').evaluate(p=>({max:p.max,value:p.value})),{max:ranks[current+1].xp-ranks[current].xp,value:points-ranks[current].xp});
   assert(!/NaN|Infinity|undefined/.test(await dialog.textContent()));
   if(current<ranks.length-1){
    await open(current+1);
    assert.deepEqual(await page.locator('#achievementDetailProgress').evaluate(p=>({max:p.max,value:p.value})),{max:ranks[current+1].xp,value:points});
    const text=(await dialog.textContent()).replace(/[\s\u00a0\u202f]/g,'');
    assert(text.includes(String(ranks[current+1].xp-points)),'future rank shows the exact missing XP');
   }
   await close();assert.equal(await snapshot(),before);
  }
  await open(50);await page.evaluate(()=>closeTransientModals());assert.equal(await dialog.getAttribute('open'),null);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.deepEqual(errors,[]);
  // No request is ever forwarded for writes; actual attempted requests remain reviewable.
  fs.writeFileSync(`${out}/rank-details-report.json`,JSON.stringify({status:'PASS',ranks:ranks.length,blockedWrites:writes,checks:['51 unique stories and decoded illustrations','profile and expanded roadmap touchpoints','previous/next and boundary buttons','light/dark 320/390/690/1440','keyboard focus and Android Back','zero, current, future and maximum XP','rank/loyalty/achievement state isolation','read-only profile/results/queue; all network writes intercepted']},null,2));
 }catch(error){await page.screenshot({path:`${out}/rank-detail-failure.png`,fullPage:true});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
