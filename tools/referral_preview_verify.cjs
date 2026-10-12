'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173',out='referral-preview-evidence';
fs.mkdirSync(out,{recursive:true});
const report={base,checks:[],screenshots:[],requests:[]};
function check(s){report.checks.push(s);console.log('PASS '+s)}
async function draw(page,indices){
 const coords=[];for(const i of indices){const b=await page.locator('#screen-game .cell[data-index="'+i+'"]').boundingBox();assert(b);coords.push({x:b.x+b.width/2,y:b.y+b.height/2})}
 await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();
 for(const p of coords.slice(1)){await page.mouse.move(p.x,p.y,{steps:3});await page.waitForTimeout(45)}
 await page.mouse.up();
}
async function ready(page,query=''){
 await page.goto(base+'/'+query);
 try{await page.waitForFunction(()=>window.PropletReferralPreview&&document.querySelector('#referralHome')&&PropletReferralPreview.revision===4&&window.PropletReferralUiRevision===11)}catch(e){console.error('BOOT_STATE '+JSON.stringify(await page.evaluate(()=>({ref:window.PropletReferralUiRevision,preview:window.PropletReferralPreview?.revision,body:document.body.innerText.slice(0,3000)}))));throw e}
 assert.equal(await page.locator('#puzzleBootError').count(),0);
 await page.waitForFunction(()=>document.querySelector('#difficultyCards')?.children.length>0);
}
async function visual(page,selector,name){await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const bytes=await page.locator(selector).screenshot({type:'jpeg',quality:65});fs.writeFileSync(out+'/'+name+'.jpg',bytes);console.log('PREVIEW_IMAGE:'+name+':'+bytes.toString('base64'))}
async function screenshot(page,name){await page.screenshot({path:out+'/'+name+'.png',fullPage:true});report.screenshots.push(name);}
(async()=>{
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.deepEqual(config.builds,[{use:'@vercel/static',src:'public/**'}]);
 assert(!config.crons&&!config.env&&!config.functions);
 check('Static-only deployment has no Python functions, cron or database env configuration');
 const apiResponse=await fetch(base+'/api/account/snapshot',{method:'POST'});
 assert.equal(apiResponse.status,410);check('Unmocked server API returns 410, including POST');
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_ERROR '+e.message)});
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await ready(page);await screenshot(page,'01-native-home');await visual(page,'#referralHome','home-inviter');
  assert.equal(await page.locator('#referralDialog:not(.hidden)').count(),0);check('No unsolicited promotional modal');
  await page.locator('#referralHome [data-ref-open]').click();
  assert.match(await page.locator('#referralDialog').innerText(),/týdenních XP hráče ani týmu/);
  assert((await page.locator('#refLink').boundingBox()).width>100,'invitation link remains readable on mobile');
  const referralLink=await page.locator('#refLink').inputValue();assert.equal(new URL(referralLink).origin,new URL(base).origin);
  assert.equal(await page.locator('.ref-sheet-intro').count(),0);
  assert.equal(await page.locator('#refShare').innerText(),'Pozvi kamaráda do Propletu');
  assert.equal(await page.locator('#refShare').evaluate(el=>getComputedStyle(el).fontWeight),'400');
  await screenshot(page,'02-invitation');await visual(page,'#referralDialog .ref-sheet','intro');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#referralDialog').isVisible(),false);
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  assert.match(await page.locator('#referralProfile').innerText(),/Eliška/);await screenshot(page,'03-native-profile');
  check('Invitation and progress are integrated into native Dnes and Já');
  await page.locator('.bottom-nav [data-nav="daily"]').click();
  await page.locator('#referralHome [data-ref-home-close]').click();
  assert.equal(await page.locator('#referralHome').isVisible(),false);
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  await page.locator('#referralProfile [data-ref-open]').click();
  assert.equal(await page.locator('#referralDialog').isVisible(),true);
  await page.keyboard.press('Escape');
  check('Dismissed announcement leaves invitation available in profile');
  for(const width of [320,390,690,1440]){
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']){
    await ready(page,'?theme='+theme);
    await visual(page,'#referralHome','discovery-'+width+'-'+theme);
    await screenshot(page,'discovery-full-'+width+'-'+theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
  }
  await page.setViewportSize({width:390,height:844});
  await ready(page,'?view=new&invite=KATKA');
  assert.equal(await page.evaluate(()=>getProfile()),null);
  assert.equal(await page.evaluate(()=>document.querySelector('#referralHome').previousElementSibling.classList.contains('daily-hero')),true);
  assert.equal(await page.locator('#freeRefreshToday').isVisible(),false);
  await visual(page,'#referralHome','home-new-invitee');
  check('New invitee sees invitation directly below Daily, with no 300-board promotion');
  await page.locator('#referralHome [data-ref-accept]').click();
  await page.locator('#refCreateAccount').click();
  await page.locator('#playerNameInput').fill('Testovací Eliška');
  await page.locator('#playerPasswordInput').fill('preview-only-123');
  await page.locator('#saveProfileBtn').click();
  await page.waitForFunction(()=>getProfile()?.id==='preview-elis'&&document.querySelector('#profileModal').classList.contains('hidden'));
  assert.equal(await page.evaluate(()=>PropletReferralPreview.model.accepted),true);
  assert.equal(await page.evaluate(()=>PropletReferralPreview.model.count),0);
  check('Native account form accepts invitation through local fixture; no live registration');
  await ready(page,'?view=four&open=free');
  const before=await page.evaluate(()=>PropletReferralPreview.stats());assert.equal(before.referralBonusXp,0);
  await page.evaluate(()=>startFree('easy'));
  await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.answers?.length);
  await page.locator('#screen-game .cell').first().waitFor();
  const puzzleId=await page.evaluate(()=>currentGame.puzzle.id);
  const paths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
  for(let i=0;i<paths.length;i++){await draw(page,paths[i]);await page.waitForFunction(n=>currentGame.found.length===n,i+1)}
  await page.locator('#winModal').waitFor({state:'visible'});
  await page.waitForFunction(()=>PropletReferralPreview.model.paid===true);
  const after=await page.evaluate(()=>PropletReferralPreview.stats());
  assert.equal(after.referralBonusXp,1000);
  assert.equal(after.points-before.points,1015);
  assert.equal(after.weeklyXp-before.weeklyXp,15);
  assert.equal(after.weeklyTeamXp-before.weeklyTeamXp,15);
  assert.equal(await page.locator('#winClean').isVisible(),false);
  await screenshot(page,'04-real-fifth-board-reward');
  assert.equal(await page.locator('#referralHome .ref-steps .done').count(),5);
  assert.equal(await page.locator('#winResultActions #winShareBtn').count(),1);
  await page.locator('#referralWin [data-ref-reward-close]').click();
  await page.locator('#winMenuBtn').click();
  assert.equal(await page.locator('#referralHome').isVisible(),false);
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  assert.match(await page.locator('#referralProfile').innerText(),/Bonus máte oba/);
  await page.locator('.bottom-nav [data-nav="daily"]').click();
  assert.equal(await page.locator('#referralHome').isVisible(),false);
  check('Paid reward can be dismissed; it stays hidden through navigation and remains in Já');
  assert.equal(await page.evaluate(()=>PropletReferralPreview.complete(currentGame)),false);
  assert.equal(await page.evaluate(()=>PropletReferralPreview.stats().referralBonusXp),1000);
  check('Drawing actual native board '+puzzleId+' pays both sides once; bonus excluded from weekly player/team XP');
  await page.locator('.bottom-nav [data-nav="leaderboard"]').click();
  await page.locator('[data-ranking-period="all"]').click();await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList')?.textContent.replace(/\s/g,'').includes('1575'));
  await screenshot(page,'05-total-ranking');
  await page.locator('[data-ranking-period="week"]').click();await page.waitForFunction(()=>document.querySelector('#xpLeaderboardList .me .leader-score strong')?.textContent.includes('75'));
  const inviterPoints=await page.evaluate(async()=>{const r=await fetch('/api/rankings/xp?period=all');return (await r.json()).players.find(p=>p.name==='Katka').xp});
  assert.equal(inviterPoints,4150);
  check('Native total and weekly rankings show separated amounts; inviter receives the same bonus');
  await ready(page,'?view=four');
  await page.evaluate(()=>startTajenka());
  await page.waitForFunction(()=>currentGame?.mode==='tajenka');
  if(await page.locator('#tajenkaRulesModal').isVisible())await page.locator('#tajenkaRulesDone').click();
  await page.waitForFunction(()=>currentGame?.pausedAt==null);
  const tajenkaPaths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
  for(let i=0;i<tajenkaPaths.length;i++){await draw(page,tajenkaPaths[i]);await page.waitForFunction(n=>currentGame.found.length===n,i+1)}
  await page.waitForFunction(()=>PropletReferralPreview.model.paid===true);
  assert.equal(await page.evaluate(()=>PropletReferralPreview.model.count),5);
  assert.equal(await page.evaluate(()=>PropletReferralPreview.stats().referralBonusXp),1000);
  check('Native Tajenka completion counts toward the same five-board reward');

  await ready(page,'?view=four&theme=dark');await visual(page,'#referralHome','home-progress-dark');await screenshot(page,'06-dark-mobile');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.setViewportSize({width:320,height:740});await page.locator('#refPreviewControls summary').click();await screenshot(page,'07-narrow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.setViewportSize({width:1440,height:1000});await ready(page);await screenshot(page,'08-desktop');
  check('Native layout supports 320px, mobile dark and desktop');
  // Check the real result card at desktop size and preserve native challenge sharing.
  await page.evaluate(()=>startFree('easy'));
  await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.answers?.length);
  const inviterPaths=await page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
  for(let i=0;i<inviterPaths.length;i++){await draw(page,inviterPaths[i]);await page.waitForFunction(n=>currentGame.found.length===n,i+1)}
  await page.locator('#winModal').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#winResultActions #winShareBtn')?.textContent.includes('Pozvi kamaráda'));
  const box=await page.locator('#winResultActions').boundingBox(),parent=await page.locator('#winResultActions').evaluate(el=>el.parentElement.getBoundingClientRect().toJSON());
  assert(box.width<=542&&Math.abs(box.x+box.width/2-parent.x-parent.width/2)<3,'result invitation is centered and constrained');
  assert.equal(await page.locator('.win-secondary-actions #winShareBtn').count(),0);
  await page.evaluate(()=>{window.__refNativeShare=null;Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__refNativeShare=data}})});
  await page.locator('#winResultActions #winShareBtn').click();
  await page.locator('#refShareBoard').click();
  await page.waitForFunction(()=>window.__refNativeShare);
  assert(!new URL(await page.evaluate(()=>window.__refNativeShare.url)).searchParams.has('invite'),'challenge keeps native board link rather than bonus invite');
  assert.equal(await page.locator('#referralDialog:not(.hidden)').count(),0);
  await visual(page,'#winModal .win-card','result-desktop');
  await page.locator('#winShareBtn').click();
  await page.locator('#referralDialog [data-ref-open]').click();
  assert.equal(await page.locator('#referralDialog').isVisible(),true);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});
  await visual(page,'#winModal .win-card','result-mobile');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  
  assert.equal(await page.locator('#levelLeaderboardBox [role="tablist"]').count(),0);
  assert.equal(await page.locator('#winClean').isVisible(),false);
  assert.equal(await page.locator('#winShareBtn img').count(),0);
  assert.equal(await page.locator('#winPrimaryBtn').innerText(),'Hraj další úroveň');
  const shortBoard=await page.evaluate(()=>{
   const box=document.getElementById('levelLeaderboardBox'),data=box.postWinData;
   window.__originalBoard=data;
   renderFreeLeaderboardPanel(box,{world:{...data.world,total:3}},getProfile().id);
   return box.querySelectorAll('.ranking-expand').length;
  });
  assert.equal(shortBoard,0,'complete three-player ranking needs no expansion');
  await page.evaluate(()=>renderFreeLeaderboardPanel(document.getElementById('levelLeaderboardBox'),window.__originalBoard,getProfile().id));
  await page.locator('#levelLeaderboardBox .ranking-expand summary').click();
  await page.waitForFunction(()=>document.querySelectorAll('#levelLeaderboardBox .ranking-expanded-rows .mini-leader-row').length===14);
  await page.locator('#levelLeaderboardBox .ranking-expand summary').click();
  check('Short complete ranking has no redundant toggle; expanded ranking shows all 14 fixture players');
  for(const width of [320,390,690,1440]){
   await page.setViewportSize({width,height:950});
   for(const theme of ['light','dark']){
    await page.evaluate(t=>applyTheme(t),theme);
    const layout=await page.evaluate(()=>{
     const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();
     return {rank:rect('levelLeaderboardBox'),next:rect('winPrimaryBtn'),invite:rect('winShareBtn'),xp:rect('winXp'),title:rect('winTitle'),overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert(layout.rank.bottom<=layout.next.top+2&&layout.next.bottom<=layout.invite.top+2,'ranking, next game, invitation order');
    assert(!layout.overflow);
    assert(layout.xp.top<layout.rank.top,'XP stays with the result title');
    const header=await page.locator('.win-result-heading').boundingBox();
    assert(Math.abs(layout.title.x+layout.title.width/2-header.x-header.width/2)<2,'victory title centered');
    const share=await page.locator('#winShareBtn').evaluate(el=>({weight:getComputedStyle(el).fontWeight,fill:getComputedStyle(el).backgroundImage}));
    assert.equal(share.weight,'400');assert(share.fill.includes('169, 50, 98'));
    await visual(page,'#winModal .win-card','result-'+width+'-'+theme);
   }
  }
  await page.locator('#winPrimaryBtn').click();
  await page.waitForFunction(()=>currentGame&&!currentGame.finished&&document.querySelector('#winModal').classList.contains('hidden'));
  check('Continue action starts next real board; compact result order verified at four widths in both themes');

  await ready(page,'?view=four');
  await page.evaluate(()=>{PropletReferralPreview.model.inviterName='SuperPropletač_2026';document.dispatchEvent(new Event('proplet:screen-changed'))});
  assert.match(await page.locator('#referralHome').innerText(),/ty i SuperPropletač_2026/);
  assert(!(await page.locator('#referralHome').innerText()).includes('Hraj vlastním tempem'));
  assert((await page.locator('#referralHome').boundingBox()).height<340);
  await visual(page,'#referralHome','progress-wide');
  await ready(page,'?view=reward');
  assert((await page.locator('#referralHome').boundingBox()).height<310);
  await visual(page,'#referralHome','home-paid');
  check('Single result invitation opens distinct board and bonus routes; original native sharing preserved');
  const blocked=await page.evaluate(async()=>{const r=await fetch('https://iopyhluayfszskyqqpuc.supabase.co/rest/v1/players',{method:'POST',body:'{}'});return {status:r.status,audit:PropletReferralPreview.audit}});
  assert.equal(blocked.status,403);
  const production=requests.filter(r=>/supabase\.co|hrajproplet\.cz|facebook|google-analytics/.test(new URL(r.url).hostname));
  assert.deepEqual(production,[]);
  assert.equal(requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')).length,0);
  assert.deepEqual(errors,[]);
  report.requests=requests;check('Browser sends zero API or production requests; external fetch blocked; no JS errors');
 }finally{await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);fs.writeFileSync(out+'/failure.txt',e.stack);process.exit(1)});

