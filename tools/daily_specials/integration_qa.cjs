/* Integrated deployed app QA. Real gestures; only the isolated preview may write.
   Existing onboarding/preferences are seeded, never puzzles, progress or results.
   Production is opened in a separate context whose write requests are blocked. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=process.env.PROPLET_QA_OUT||'/tmp/proplet-specials-integration-qa';
fs.mkdirSync(out,{recursive:true});
const report={status:'running',startedAt:new Date().toISOString(),layout:[],checks:[],errors:[],network:{allowedWrites:[],blockedWrites:[],failedApi:[]},humanPlaytest:false};
const save=()=>fs.writeFileSync(path.join(out,'integration-qa.json'),JSON.stringify(report,null,2));
const expectedDate=process.env.PROPLET_EXPECTED_DATE||'2026-10-21',expectedVersion=process.env.PROPLET_EXPECTED_VERSION||fs.readFileSync('proplet_version.py','utf8').match(/^APP_VERSION\s*=\s*"([^"]+)"/m)[1];
const productionOrigin='https://hrajproplet.cz';
let previewOrigin,browser,activePage,createdAccount;
const accounts=[];

function validatePreviewUrl(value){
 const url=new URL(value);
 const local=process.env.PROPLET_QA_ALLOW_LOCAL==='1'&&['127.0.0.1','localhost'].includes(url.hostname);
 assert(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'&&(local||!url.port),'preview_url must be a bare deployment origin');
 assert(local||(url.protocol==='https:'&&/^proplet-[a-z0-9]+-pavel-prouzas-projects\.vercel\.app$/.test(url.hostname)&&!url.hostname.includes('-git-')),'Use an immutable proplet deployment URL, never production or a branch alias');
 return url.origin;
}
async function readJson(origin,endpoint){
 const response=await fetch(origin+endpoint,{redirect:'error'});
 assert(response.ok,`${endpoint} preflight returned ${response.status}`);
 return response.json();
}
async function seed(context,profile=null){
 await context.addInitScript(({profile,origins})=>{
  // Playwright also runs init scripts in the opaque initial about:blank page.
  // Only the actual app document may read preferences or the synthetic profile.
  if(window!==window.top||!['http:','https:'].includes(location.protocol)||!origins.includes(location.origin))return;
  try{
   localStorage.setItem('proplet-v3-7-required-onboarding','done');
   localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
   localStorage.setItem('proplet-v3-settings',JSON.stringify({theme:'light',sound:false,haptics:false,wakeLock:false,magnifier:true}));
   localStorage.setItem('proplet-calm-mode-v1','0');
   localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
   if(profile&&!localStorage.getItem('proplet-v2-profile'))localStorage.setItem('proplet-v2-profile',JSON.stringify(profile));
  }catch(error){window.__QA_SEED_ERROR=error.message;}
  window.__QA_PROPLET_READY=false;document.addEventListener('proplet:ready',()=>window.__QA_PROPLET_READY=true);
 },{profile,origins:[previewOrigin,productionOrigin]});
}
async function dismissAnnouncements(page,{expectExtraIntro=false}={}){
 const controls=[
  '#dailyExtraIntro:not(.hidden) [data-extra-later]',
  '#freeRefreshAnnouncement:not(.hidden) [data-refresh-back]',
  '#mk100LaunchPreview:not(.hidden) [data-mk-launch-back]',
  '#contentReleaseModal[open] .content-release-close',
  '.release-notes-v3331-backdrop .release-notes-v3331-close',
 ];
 let quiet=0,sawExtraIntro=false;
 for(let pass=0;pass<8;pass++){
  let closed=false;
  for(const selector of controls){
   let button=page.locator(selector).first();
   if(!await button.isVisible())continue;
   let testExtraEntry=false;
   if(selector.startsWith('#dailyExtraIntro')){
    sawExtraIntro=true;
    const details=await page.locator('#dailyExtraIntro .modal-card').evaluate(card=>({width:card.getBoundingClientRect().width,scrollWidth:card.scrollWidth,clientWidth:card.clientWidth,title:card.querySelector('h2').textContent,eyebrows:card.querySelectorAll('.eyebrow').length}));
    assert.equal(details.title,'Dnes je tu i Extra');assert.equal(details.eyebrows,0);assert(details.scrollWidth<=details.clientWidth+1,'Extra intro must fit on mobile');
    if(page.viewportSize().width===390&&!report.extraEntryChecked){
     await screenshot(page,'390-extra-intro');button=page.locator('#dailyExtraIntro [data-extra-show]');testExtraEntry=true;
    }
    report.extraIntroductions??=[];report.extraIntroductions.push({width:page.viewportSize().width,...details});
   }
   await button.click();await button.waitFor({state:'hidden',timeout:5000});
   if(testExtraEntry){
    assert.equal(await page.locator('.daily-hero').evaluate(el=>el.classList.contains('daily-special-selected')),true,'intro CTA selects Extra without starting a game');
    assert(await page.locator('#screen-daily.active').isVisible());
    assert.equal(await page.locator('#playDailyBtn').evaluate(el=>el===document.activeElement),true,'intro returns focus to the visible game action');
    await page.locator('#dailyChallengeSwitch button').click();report.extraEntryChecked=true;
   }
   report.dismissedAnnouncements??=[];report.dismissedAnnouncements.push({origin:new URL(page.url()).origin,selector});
   closed=true;break;
  }
  quiet=closed?0:quiet+1;if(quiet>=2){if(expectExtraIntro)assert(sawExtraIntro,'first eligible Extra visit must explain the new challenge');return;}
  await page.waitForTimeout(100);
 }
 throw Error('Release announcements did not settle after their normal dismissal controls');
}
async function guardedContext(options,{readOnly=false,profile=null}={}){
 const context=await browser.newContext({...options,serviceWorkers:'block'});
 await seed(context,profile);
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method();
  const writing=!['GET','HEAD','OPTIONS'].includes(method);
  if(writing&&(readOnly||url.origin!==previewOrigin)){
   report.network.blockedWrites.push({origin:url.origin,path:url.pathname,method,readOnly});
   await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"ignored":true,"qaReadOnly":true}'});return;
  }
  if(writing){assert.equal(url.origin,previewOrigin,'No writes may leave the isolated preview');report.network.allowedWrites.push({path:url.pathname,method});}
  await route.continue();
 });
 context.on('page',page=>{
  page.on('pageerror',error=>report.errors.push({kind:'pageerror',message:error.message.slice(0,500)}));
  page.on('response',response=>{
   const url=new URL(response.url());if(url.origin===previewOrigin&&url.pathname.startsWith('/api/')&&response.status()>=400)report.network.failedApi.push({path:url.pathname,status:response.status()});
  });
 });
 return context;
}
async function open(context,origin){
 const page=await context.newPage();activePage=page;
 await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__QA_PROPLET_READY===true,{},{timeout:60000});
 assert.equal(await page.evaluate(()=>window.__QA_SEED_ERROR||null),null,'app-origin preferences must be writable');
 await page.waitForFunction(()=>typeof accountProgressAvailable==='function'&&accountProgressAvailable(),{},{timeout:60000});
 await page.locator('#screen-daily.active .daily-hero').waitFor({timeout:30000});
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
 // The current archive announcement coordinator suppresses the older standalone Extra intro.
 const archiveEnabled=await page.evaluate(()=>!!window.PropletArchiveExperience?.isEnabled?.());
 await dismissAnnouncements(page,{expectExtraIntro:origin===previewOrigin&&!archiveEnabled});
 if(origin===previewOrigin){
  assert.equal(await page.locator('#freeRefreshToday').count(),0,'retired300-board card must not return');
  assert.equal(await page.locator('#studioExtraCard').isVisible(),true,'unfinished base keeps Extra as a secondary entry');
  const expectedExtraAction=await page.evaluate(()=>{const extra=dailySpecialResultState();return extra.active?'Zobrazit výsledek':extra.progress?'Pokračovat v Extra':'Hrát Extra'});
  assert.equal(await page.locator('#studioExtraCard button').textContent(),expectedExtraAction);
  assert.equal(await page.locator('#dailyHeroTitle').textContent(),'Denní výzva');
 }
 return page;
}
async function screenshot(page,name){
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 if(/^\d+-(base|special)$/.test(name))await page.screenshot({path:path.join(out,name+'-viewport.png'),fullPage:false});
}
async function bounds(page){
 return page.evaluate(()=>{
  const hero=document.querySelector('#screen-daily .daily-hero'),rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
  const box=rect(hero),selectors=['#dailyHeroTitle','#dailyDate','#dailyMeta','#playDailyBtn','#dailyWeekRhythm','#dailyChallengeSwitch','#studioDailyArt'];
  const children=selectors.map(selector=>{const element=document.querySelector(selector);if(!element||!element.getClientRects().length)return null;return{selector,...rect(element),clientWidth:element.clientWidth,scrollWidth:element.scrollWidth}}).filter(Boolean);
  const title=document.querySelector('#dailyHeroTitle'),art=document.querySelector('#studioDailyArt'),nav=document.querySelector('.bottom-nav');
  return {hero:box,children,documentWidth:document.documentElement.clientWidth,documentScrollWidth:document.documentElement.scrollWidth,viewportHeight:innerHeight,primary:rect(document.querySelector('#playDailyBtn')),bottomNav:nav&&nav.getClientRects().length?rect(nav):null,artPair:title&&art&&art.getClientRects().length?{title:rect(title),art:rect(art)}:null};
 });
}
function validateBounds(measurement,label){
 assert(measurement.documentScrollWidth<=measurement.documentWidth+1,label+': page overflows horizontally');
 for(const row of measurement.children){assert(row.x>=measurement.hero.x-1&&row.right<=measurement.hero.right+1,label+': '+row.selector+' exceeds the Daily card');assert(row.scrollWidth<=row.clientWidth+1,label+': '+row.selector+' clips its content');}
 if(measurement.artPair){const {title,art}=measurement.artPair;assert(title.right<=art.x+1||art.right<=title.x+1||title.bottom<=art.y+1||art.bottom<=title.y+1,label+': hero title and illustration overlap');}
 assert(measurement.primary.height>=44,label+': primary action touch target is too short');
}
async function gameInfo(page){return page.evaluate(()=>({mode:currentGame?.mode,id:currentGame?.puzzle?.id,key:currentGame?challengeKey(currentGame.mode,currentGame.puzzle,currentGame.dailyDate):null,found:currentGame?.found.map(row=>row.answerIndex)||[],hints:currentGame?.hints||0,attempt:currentGame?.attemptId,elapsed:currentGame?gameElapsed(currentGame):0,paused:currentGame?.pausedAt!=null,finished:!!currentGame?.finished,record:currentGame?.resultRecord||null}))}
async function start(page,kind){
 await page.bringToFront();
 await dismissAnnouncements(page);
 const specialSelected=await page.locator('.daily-hero').evaluate(el=>el.classList.contains('daily-special-selected'));
 if(kind==='special'&&!specialSelected)await page.locator('#studioExtraCard button').click();
 else{
  if(kind==='base'&&specialSelected)await page.locator('#dailyChallengeSwitch button').click();
  await page.locator('#playDailyBtn').click();
 }
 await page.locator('#screen-game.active #board .cell').first().waitFor({timeout:30000});
 await page.waitForFunction(()=>currentGame&&currentGame.pausedAt==null&&!currentGame.finished,{},{timeout:30000});
 const info=await gameInfo(page);assert.equal(info.mode,kind==='special'?'daily_special':'daily');return info;
}
async function gesture(page,answer,touch){
 await page.locator('#board').scrollIntoViewIfNeeded();
 const coordinates=await page.evaluate(indices=>indices.map(index=>{const cell=document.querySelector(`#board .cell[data-index="${index}"]`);if(!cell)throw Error('Missing answer cell '+index);const r=cell.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}),answer.path);
 const before=(await gameInfo(page)).found.length;
 if(touch){
  const cdp=await page.context().newCDPSession(page);
  try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...coordinates[0],id:1}]});for(const point of coordinates.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach()}
 }else{
  await page.mouse.move(coordinates[0].x,coordinates[0].y);await page.mouse.down();for(const point of coordinates.slice(1))await page.mouse.move(point.x,point.y,{steps:2});await page.mouse.up();
 }
 await page.waitForFunction(previous=>currentGame?.found.length===previous+1,before,{timeout:5000});
}
async function returnToday(page){
 await page.locator('#backFromGame').click();await page.locator('#screen-daily.active').waitFor();
 await page.evaluate(()=>fairPlay().drain());
 const first=await gameInfo(page);assert(first.paused,'leaving the game pauses the clock');await page.waitForTimeout(120);const second=await gameInfo(page);assert(Math.abs(first.elapsed-second.elapsed)<2,'paused game elapsed time stays constant');
}
async function finishByGestures(page,puzzle,touch){
 const found=new Set((await gameInfo(page)).found);
 const remaining=puzzle.answers.map((_,index)=>index).filter(index=>!found.has(index));
 for(const index of remaining){
  if(index===remaining.at(-1)){
   // Real gestures can be faster than a human. Let the unmodified running
   // clock reach the production anti-forgery floor before the final word.
   const minimum=Math.max(2500,puzzle.mask.length*90)+300;
   await page.waitForFunction(ms=>gameElapsed(currentGame)>=ms,minimum,{timeout:30000,polling:100});
  }
  await gesture(page,puzzle.answers[index],touch);
 }
 await page.locator('#winModal:not(.hidden)').waitFor({timeout:30000});
 await page.evaluate(()=>fairPlay().drain());
 assert.equal((await gameInfo(page)).found.length,puzzle.answers.length,'all words solved by actual gestures');
}
async function sync(page){
 const result=await page.evaluate(()=>syncQueue({announce:false}));assert(result.ok,'real server queue sync failed: '+(result.error||JSON.stringify(result)));
 return page.evaluate(()=>api('/api/account/snapshot'));
}
function counters(snapshot,base,special){
 const rows=snapshot.completed.filter(row=>row.mode==='daily'||row.mode==='daily_special');
 assert.equal(rows.filter(row=>row.mode==='daily').length,base);assert.equal(rows.filter(row=>row.mode==='daily_special').length,special);
 assert.equal(snapshot.stats.dailyCompleted,base);assert.equal(snapshot.stats.dailySpecialCompleted,special);assert.equal(snapshot.stats.dailyChallengeCompleted,base+special);assert.equal(snapshot.stats.currentStreak,base?1:0);
 for(const row of rows)assert.equal(row.points,row.mode==='daily_special'?200:100,'official base receipt is 100 XP and Extra receipt is 200 XP');
 return rows;
}
const resultIdentity=row=>JSON.stringify({puzzleId:row.puzzleId,challengeKey:row.challengeKey,attemptId:row.attemptId,elapsedMs:row.elapsedMs,moves:row.moves,points:row.points,completedAt:row.completedAt,contentHash:row.contentHash});

(async()=>{
 previewOrigin=validatePreviewUrl(process.env.PROPLET_PREVIEW_ORIGIN||'');report.previewOrigin=previewOrigin;report.productionOrigin=productionOrigin;report.deployedSourceSha=process.env.PROPLET_DEPLOYED_SOURCE_SHA||null;
 const [config,isolation,sessions,base,specials]=await Promise.all([readJson(previewOrigin,'/api/config'),readJson(previewOrigin,'/api/free-order/config'),readJson(previewOrigin,'/api/play-session/config'),readJson(previewOrigin,'/api/daily'),readJson(previewOrigin,'/api/daily-special')]);
 assert.equal(config.environment,'preview');assert.equal(config.version,expectedVersion);assert.equal(isolation.isolatedPreview,true);assert.equal(isolation.databaseRef,'eanzztstmwlamwfdskbf');assert.equal(sessions.enabled,true);assert.equal(sessions.isolatedPreview,true);assert.equal(base.serverToday,expectedDate);assert.equal(specials.serverToday,expectedDate);assert.equal(specials.special?.mode,'daily_special');assert.equal(specials.special?.dailyDate,expectedDate);assert.equal(specials.special?.rewardEligible,true);assert.equal(specials.special?.difficulty,'hardcore');assert.equal(specials.special?.challengeKey,`daily-special:${expectedDate}:hardcore`);
 report.guard={environment:config.environment,version:config.version,databaseRef:isolation.databaseRef,isolatedPreview:isolation.isolatedPreview,playSessionsEnabled:sessions.enabled,date:base.serverToday,special:specials.special.puzzleId};save();
 const {chromium}=require(process.env.PROPLET_PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({executablePath:process.env.PROPLET_CHROME||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:320,height:740},{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1280,height:960}]){
  const options={viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000};
  const production=await guardedContext(options,{readOnly:true}),productionPage=await open(production,productionOrigin),productionBounds=await bounds(productionPage);
  validateBounds(productionBounds,'production '+viewport.width);await screenshot(productionPage,`${viewport.width}-production`);await production.close();
  const preview=await guardedContext(options),page=await open(preview,previewOrigin),baseBounds=await bounds(page);
  validateBounds(baseBounds,'base '+viewport.width);await screenshot(page,`${viewport.width}-base`);
  // The secondary Extra action now starts the real game. Return through the
  // real game control to inspect its resume presentation without seeding state.
  await start(page,'special');await returnToday(page);
  const specialBounds=await bounds(page);validateBounds(specialBounds,'special '+viewport.width);await screenshot(page,`${viewport.width}-special`);
  report.layout.push({viewport,production:productionBounds,base:baseBounds,special:specialBounds,extraBaseHeight:baseBounds.hero.height-productionBounds.hero.height,extraSpecialHeight:specialBounds.hero.height-productionBounds.hero.height});save();
  // Studio deliberately changes hero proportions; preserve the useful boundary:
  // the principal action is reachable in the initial viewport in both states.
  for(const [kind,measurement] of [['base',baseBounds],['special',specialBounds]]){
   const nav=measurement.bottomNav,limit=nav&&nav.y>measurement.viewportHeight/2?nav.y:measurement.viewportHeight;
   assert(measurement.primary.bottom<=limit+1,`${kind} primary action falls below the first viewport at ${viewport.width}`);
  }
  if(viewport.width===390){
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__QA_PROPLET_READY===true);
   await page.waitForTimeout(350);
   assert.equal(await page.locator('#dailyExtraIntro:not(.hidden)').count(),0,'Extra explanation is shown once, not after reload');
   await dismissAnnouncements(page);
   assert.equal(await page.evaluate(()=>document.body.style.overflow),'','dismissal restores scrolling');
   report.checks.push('announcement coordination, visible Extra entry, mobile fit, CTA selection, reload persistence and retired300-card absent');
  }
  await page.locator('.daily-week-day.has-daily-special').first().click();await page.locator('#dailyWeekDialog:not(.hidden)').waitFor();
  const clippedWeek=await page.locator('#dailyWeekDialog .daily-week-dialog-day>span').evaluateAll(cells=>cells.filter(cell=>cell.scrollWidth>cell.clientWidth+1).map(cell=>cell.textContent));
  assert.deepEqual(clippedWeek,[],`weekly overview labels clip at${viewport.width}`);
  await screenshot(page,`${viewport.width}-week-dialog`);await page.locator('[data-close-daily-week]').click();
  await preview.close();save();
 }
 report.checks.push('production/base/special geometry, first-screen action, clipping, title/art overlap and week dialog at320/360/390/768/1280');
 const mobile=await guardedContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await open(mobile,previewOrigin);
 await start(page,'special');await gesture(page,specials.special.puzzle.answers[0],true);
 await page.locator('#hintBtn').click();await page.locator('#hintModal:not(.hidden)').waitFor();await page.locator('[data-hint-level="2"]').click();assert.equal((await gameInfo(page)).hints,1);await screenshot(page,'390-special-hint');
 // Reset/undo have runtime entry points but no visible controls in the released UI.
 // Exercise those exact owners without inserting synthetic controls or found words.
 await page.evaluate(()=>resetGame());assert.equal((await gameInfo(page)).found.length,0);await page.evaluate(()=>undoReset());assert.equal((await gameInfo(page)).found.length,1);
 await returnToday(page);await start(page,'base');await gesture(page,base.puzzle.answers[0],true);await returnToday(page);
 const progress=await page.evaluate(()=>Object.values(getState().inProgress).map(row=>({mode:row.mode,key:row.challengeKey,puzzleId:row.puzzleId,found:row.found.length,contentHash:row.contentHash})));
 assert.equal(progress.filter(row=>row.mode==='daily').length,1);assert.equal(progress.filter(row=>row.mode==='daily_special').length,1);report.resumeBeforeReload=progress;
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__QA_PROPLET_READY===true,{},{timeout:60000});await start(page,'special');assert.equal((await gameInfo(page)).found.length,1,'reload resumes correct special');assert.equal((await gameInfo(page)).hints,1);await returnToday(page);
 const password=crypto.randomBytes(24).toString('base64url'),name='QA-DS-'+Date.now().toString(36)+'-'+crypto.randomBytes(2).toString('hex');
 createdAccount=await page.evaluate(async credentials=>{const profile=await api('/api/player',{method:'POST',body:JSON.stringify(credentials)});acceptAccountProfile(profile);await claimTelemetryAfterAuth();await fairPlay().drain();return profile},{name,password});accounts.push({id:createdAccount.id,token:createdAccount.token,password});report.syntheticPlayerId=createdAccount.id;
 const loggedIn=await page.evaluate(credentials=>api('/api/login',{method:'POST',body:JSON.stringify(credentials)}),{name,password});assert.equal(loggedIn.id,createdAccount.id);
 const desktop=await guardedContext({viewport:{width:1280,height:960}},{profile:loggedIn}),second=await open(desktop,previewOrigin);
 await start(second,'special');assert.equal((await gameInfo(second)).found.length,1,'second device restores the claimed anonymous session');assert.equal((await gameInfo(second)).hints,1);await screenshot(second,'1280-special-restored-across-devices');
 await finishByGestures(second,specials.special.puzzle,false);const onlySpecial=await sync(second);counters(onlySpecial,0,1);await screenshot(second,'1280-special-result');
 const specialRow=onlySpecial.completed.find(row=>row.challengeKey===specials.special.challengeKey),firstIdentity=resultIdentity(specialRow);
 const ranking=await second.evaluate(key=>api('/api/rankings/daily-special?challenge_key='+encodeURIComponent(key)),specials.special.challengeKey);assert(Array.isArray(ranking.rows),'special ranking exposes the real global-board rows contract');assert(ranking.total>=1&&ranking.myRank>=1,'confirmed player appears in special ranking');
 await page.bringToFront();await start(page,'base');assert.equal((await gameInfo(page)).found.length,1,'base resume survived special completion elsewhere');await finishByGestures(page,base.puzzle,true);const completed=await sync(page),officialRows=counters(completed,1,1);
 await screenshot(page,'390-base-result-after-special');report.officialResults=officialRows.map(({challengeKey,puzzleId,points,mode,timingVerified,hintsUsed})=>({challengeKey,puzzleId,points,mode,timingVerified,hintsUsed}));
 await second.bringToFront();await second.locator('#winReplayBtn').click();await second.locator('#screen-game.active #board .cell').first().waitFor();await second.waitForFunction(()=>currentGame?.pausedAt==null&&!currentGame?.finished);assert.match((await gameInfo(second)).key,/^daily-special-practice:/);
 await finishByGestures(second,specials.special.puzzle,false);const practice=(await gameInfo(second)).record;assert.equal(practice.points,0);assert.equal(practice.rewardEligible,false);const afterPractice=await sync(second);counters(afterPractice,1,1);assert.equal(resultIdentity(afterPractice.completed.find(row=>row.challengeKey===specials.special.challengeKey)),firstIdentity,'practice never changes first official result');await screenshot(second,'1280-special-practice-result');
 report.checks.push('real touch/mouse solves, hints, runtime reset/undo, pause, simultaneous base/special progress, reload, anonymous claim, second-device session resume, base100XP and Extra200XP receipts, base-only streak, special ranking and0XP practice replay');
 assert.equal(report.errors.length,0,'browser runtime errors: '+JSON.stringify(report.errors));assert.equal(report.network.failedApi.length,0,'unexpected preview API failures: '+JSON.stringify(report.network.failedApi));
 report.network.noProductionWrites=true;report.status='passed';report.finishedAt=new Date().toISOString();save();
 await mobile.close();await desktop.close();
})().catch(async error=>{
 report.status='failed';report.failure=error.message;report.finishedAt=new Date().toISOString();save();
 if(activePage&&!activePage.isClosed())try{await screenshot(activePage,'failure')}catch{}
 console.error(error.stack||error);process.exitCode=1;
}).finally(async()=>{
 // Only synthetic accounts created by this run are removed, only after isolation proof.
 for(const account of accounts)try{
  assert(report.guard?.isolatedPreview&&report.guard.databaseRef==='eanzztstmwlamwfdskbf');
  const response=await fetch(previewOrigin+'/api/account',{method:'DELETE',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+account.token},body:JSON.stringify({confirmation:'SMAZAT',password:account.password})});
  report.cleanup={syntheticPlayerId:account.id,deleted:response.ok,status:response.status};
 }catch(error){report.cleanup={deleted:false,error:error.message};}
 await browser?.close();save();console.log(JSON.stringify({status:report.status,output:out,checks:report.checks,layoutSizes:report.layout.map(row=>row.viewport.width),cleanup:report.cleanup}));
});
