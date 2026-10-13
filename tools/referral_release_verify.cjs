'use strict';
// Real release JavaScript and avatar files; API replies are explicitly mocked.
// No request to production or a database is allowed by this browser suite.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:4173',out='referral-release-evidence';
const fixture=JSON.parse(fs.readFileSync('tools/fixtures/referral-browser.json','utf8'));
fs.mkdirSync(out,{recursive:true});
const checks=[];function pass(s){checks.push(s);console.log('PASS (mock API) '+s)}
const profile={id:'test-referral-player',token:'TEST-ONLY-NOT-A-REAL-TOKEN',name:'Eliška',avatar:'🦊',hasPassword:true,publicRankings:true,supportMode:'none'};
const stats={points:1500,totalCompleted:5,dailyCompleted:0,freeCompleted:{easy:5},currentStreak:0,longestStreak:0,cleanSolves:5};
const inviteCode='TESTCODE1234';
async function boot(browser,{guest=false,paid=false,announcement=false,query=''}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const apiCalls=[],errors=[];let dismissed=false,registered=!guest;
 await ctx.addInitScript(({profile,stats,guest,announcement})=>{
  if(!guest&&!localStorage.getItem('proplet-v2-profile'))localStorage.setItem('proplet-v2-profile',JSON.stringify({...profile,stats}));
  localStorage.setItem('proplet-v3-settings',JSON.stringify({theme:'light',sound:false,haptics:false}));
  for(const k of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(k,'done');
  for(const k of ['proplet-v3-32-8-rule-principle-seen','proplet:content-release:g5-r1','proplet:content-release:mk100-v2','proplet:content-release:mk100-v2:account:'+profile.id])localStorage.setItem(k,'1');
  if(!guest)for(const k of ['proplet:content-release:refresh300-v1','proplet:content-release:refresh300-v1:account:'+profile.id])localStorage.setItem(k,'1');
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  localStorage.setItem('proplet-v3-26-install-nudge',JSON.stringify({done:true,installed:true}));
  localStorage.setItem('proplet-v3-8-2-push-nudge',JSON.stringify({done:true,dismissedAt:Date.now()}));
  if(!announcement)localStorage.setItem('proplet:referral-announcement-seen:v1:'+profile.id,'1');
 },{profile,stats,guest,announcement});
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!==base){await route.abort();return}
  if(!u.pathname.startsWith('/api/'))return route.continue();
  let body={};try{body=req.postDataJSON()||{}}catch{}
  apiCalls.push({path:u.pathname,method:req.method(),body,headers:req.headers()});
  const reply=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
  if(u.pathname==='/api/config')return reply({...fixture.config,version:'4.07.2',environment:'preview'});
  if(u.pathname==='/api/tajenka')return reply({...fixture.tajenka,week:await req.frame().evaluate(()=>activeTajenkaWeek)});
  if(u.pathname==='/api/referrals')return reply({enabled:true,invite:{url:base+'/?invite=OWNCODE123',code:'OWNCODE123'},incoming:paid?{id:'reward-test',inviter:{name:'Katka',avatar:'🦊'},completedBoards:5,paid:true,rewardDismissed:dismissed}:guest&&registered?{id:'incoming-test',inviter:{name:'Katka'},completedBoards:0,paid:false}:null,referrals:[]});
  if(u.pathname==='/api/referrals/invite/'+inviteCode)return reply({enabled:true,inviter:{name:'Katka',avatar:'🦊'}});
  if(u.pathname==='/api/referrals/invite')return reply({url:base+'/?invite=OWNCODE123',code:'OWNCODE123'});
  if(u.pathname==='/api/referrals/dismiss'){dismissed=true;return reply({ok:true})}
  if(u.pathname==='/api/player'){registered=true;return reply({...profile,stats,accountCreated:true})}
  if(u.pathname==='/api/auth/google/complete'){registered=true;return reply({profile:{...profile,stats},accountCreated:true})}
  if(['/api/account/snapshot','/api/me'].includes(u.pathname))return reply({...profile,stats,completed:[],cursor:new Date().toISOString()});
  if(u.pathname==='/api/progress')return reply({completed:[],rescues:[],inProgress:[],dailyDates:[]});
  if(['/api/free-global-leaderboard','/api/daily-global-leaderboard'].includes(u.pathname))return reply({rows:[{id:'test-other',name:'Honza',avatar:'🐻',rank:1,elapsedMs:20000,moves:8,cleanSolve:true},{id:profile.id,name:profile.name,avatar:profile.avatar,rank:2,elapsedMs:40000,moves:10,cleanSolve:true,isMine:true},{id:'test-third',name:'Tereza',avatar:'🦊',rank:3,elapsedMs:60000,moves:15,cleanSolve:true}],total:3,myRank:2,puzzleId:u.searchParams.get('puzzle_id'),nextOffset:null});
  if(u.pathname.includes('leaderboard')||u.pathname.includes('rankings'))return reply({rows:[],players:[],teams:[],total:0,myRank:null,visibilityReady:true});
  if(u.pathname==='/api/rolling-content')return reply({version:2,asOf:'2026-10-12',puzzles:{},latestBatch:null,nextRelease:null,availableFreeCounts:{}});
  if(u.pathname==='/api/team-victories')return reply({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[]});
  if(u.pathname==='/api/rescue-status')return reply({eligible:false,state:'none'});
  return reply({ok:true,enabled:false,available:false,allowed:false,rows:[],members:[],leagues:[],records:{},completed:[],events:[]});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/'+query);
 await page.waitForFunction(()=>window.PropletReferrals?.model.ready&&document.querySelector('#referralHome'));
 assert.equal(await page.evaluate(()=>!!window.PropletReferralPreview),false);
 assert.equal(await page.locator('#refPreviewControls').count(),0);
 return {ctx,page,apiCalls,errors};
}
async function draw(page,indices){
 const coords=[];for(const i of indices){const b=await page.locator('#screen-game .cell[data-index="'+i+'"]').boundingBox();assert(b);coords.push({x:b.x+b.width/2,y:b.y+b.height/2})}
 await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();
 for(const p of coords.slice(1)){await page.mouse.move(p.x,p.y,{steps:3});await page.waitForTimeout(45)}
 await page.mouse.up();
}
async function avatars(page,selector){
 const imgs=page.locator(selector+' .ref-art img');assert.equal(await imgs.count(),2);
 for(const img of await imgs.all()){assert(await img.isVisible());await img.evaluate(async el=>{await el.decode();if(el.naturalWidth<20)throw Error('Avatar failed to decode')});}
}
async function shot(page,selector,name){
 const b=await page.locator(selector).screenshot({type:'jpeg',quality:70});fs.writeFileSync(out+'/'+name+'.jpg',b);console.log('PREVIEW_IMAGE:'+name+':'+b.toString('base64'));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  let s=await boot(browser,{announcement:true});
  try{await s.page.locator('#referralDialog .ref-announcement').waitFor({state:'visible'})}catch(e){console.log('CTA_STATE '+JSON.stringify(await s.page.evaluate(()=>({model:PropletReferrals.model,modals:[...document.querySelectorAll('.modal:not(.hidden)')].map(x=>({id:x.id,text:x.innerText.slice(0,500)})),screen:currentScreen,onboarding:onboardingMandatory,daily:dailyExtraIntroPending(),quiet:window.PropletFirstSteps?.quiet(),seen:localStorage.getItem('proplet:referral-announcement-seen:v1:'+getProfile()?.id),images:[...document.querySelectorAll('.ref-art img')].map(i=>({src:i.src,ok:i.complete,width:i.naturalWidth})),body:document.body.innerText.slice(0,2000)}))));console.log('JS_ERRORS '+JSON.stringify(s.errors));throw e}
  await avatars(s.page,'#referralDialog');await shot(s.page,'#referralDialog .ref-sheet','cta-real-assets');
  await s.page.keyboard.press('Escape');await s.page.reload();await s.page.waitForTimeout(2000);
  assert.equal(await s.page.locator('#referralDialog:not(.hidden)').count(),0);
  pass('Both actual CTA avatar assets decode and are visible; announcement does not repeat');
  assert(!s.apiCalls.some(c=>(c.body.events||[c.body]).some(e=>e.event_type?.startsWith('referral_'))),'preview must not send referral telemetry');
  await s.page.evaluate(()=>{window.PROPLET_RUNTIME_ENV='production'});
  await s.page.locator('#referralHome [data-ref-open]').click();
  await s.page.locator('#refLink').waitFor();
  assert.equal(new URL(await s.page.locator('#refLink').inputValue()).searchParams.get('invite'),'OWNCODE123');
  assert(s.apiCalls.some(c=>c.path==='/api/referrals/invite'&&c.method==='POST'));
  for(const scenario of ['resolved','cancelled','failed','no_native','copy_ok','copy_error']){
   await s.page.evaluate(scenario=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:scenario==='no_native'?undefined:async()=>{
     if(scenario==='cancelled')throw new DOMException('cancelled','AbortError');
     if(scenario==='failed')throw new Error('test-only native failure');
     if(scenario==='resolved')return new Promise(resolve=>{window.__resolveReferralShare=resolve});
    }});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(scenario==='copy_error')throw new Error('test-only clipboard failure')}}});
   },scenario);
   await s.page.locator(scenario.startsWith('copy_')?'#refCopy':'#refShare').click();
   if(scenario==='resolved'){await s.page.locator('#refShare').click();await s.page.evaluate(()=>window.__resolveReferralShare())}
   await s.page.evaluate(()=>productAnalytics().flush());
  }
  const telemetry=s.apiCalls.filter(c=>c.path==='/api/product-event'||c.path==='/api/product-events').flatMap(c=>(c.body.events||[c.body]).map(event=>({event:event.event_type,headers:c.headers,body:event}))).filter(e=>e.event?.startsWith('referral_'));
  const counts=Object.fromEntries([...new Set(telemetry.map(e=>e.event))].map(event=>[event,telemetry.filter(e=>e.event===event).length]));
  assert.deepEqual(counts,{
   referral_invite_dialog_opened:1,referral_share_requested:4,
   referral_share_native_resolved:1,referral_share_native_cancelled:1,referral_share_native_failed:1,
   referral_copy_succeeded:3,referral_copy_failed:1
  });
  for(const event of telemetry){
   assert.equal(event.headers['x-proplet-referral-source'],'home');
   assert(!JSON.stringify(event).includes('OWNCODE123'));
   assert(!JSON.stringify(event).includes('Katka'));
   assert(!JSON.stringify(event).includes('Eliška'));
  }
  assert.deepEqual(telemetry.filter(e=>e.event==='referral_copy_succeeded').map(e=>e.headers['x-proplet-referral-copy-method']).sort(),['copy_button','no_native','share_fallback']);
  pass('Real analytics queue distinguishes native handoff, cancel, failure and clipboard outcomes once without invite PII');
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Real invitation transport creates own invite URL');
  s=await boot(browser);
  await s.page.waitForFunction(()=>tajenkaPuzzle?.id);
  await s.page.evaluate(fixturePuzzle=>{
   window.PROPLET_RUNTIME_ENV='production';
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__nativeShare=data}});
   const date=pragueDateISO(),p={id:'test-daily-share',difficulty:'easy',rows:fixturePuzzle.rows,cols:fixturePuzzle.cols,letters:fixturePuzzle.letters,answers:fixturePuzzle.answers,meta:{}},state=getState();
   datedDaily().remember({schemaVersion:1,dailyDate:date,serverToday:date,puzzleId:p.id,puzzle:p,bankVersion:'test-daily',contentHash:'a'.repeat(64),challengeKey:'daily:'+date,validUntil:new Date(Date.now()+86400000).toISOString()});
   state.completed['daily:'+date]={puzzleId:p.id,mode:'daily',dailyDate:date,elapsedMs:45000,moves:7,cleanSolve:true,completedAt:new Date().toISOString()};
   saveState(state);
   const ts=tajenkaState();ts.completions=ts.completions||{};
   ts.completions[tajenkaPuzzle.id]={puzzleId:tajenkaPuzzle.id,elapsedMs:60000,moves:8,cleanSolve:true,completedAt:new Date().toISOString()};
   saveTajenkaState(ts);renderDaily();renderTajenkaEntry();
  },fixture.tajenka);
  for(const selector of ['#shareDailyBtn','#screen-daily [data-tajenka-share]']){
   await s.page.locator(selector).waitFor({state:'visible'});
   // Compare with the source button's own original handler, not the last result.
   await s.page.evaluate(sel=>{PropletReferrals.model.ready=false;window.__nativeShare=null;document.querySelector(sel).click()},selector);
   await s.page.waitForFunction(()=>window.__nativeShare);
   const baseline=await s.page.evaluate(()=>window.__nativeShare);
   await s.page.evaluate(()=>{PropletReferrals.model.ready=true;window.__nativeShare=null;currentGame={mode:'free',puzzle:{id:'wrong-stale-result',difficulty:'easy',meta:{level:999}},finished:true}});
   await s.page.locator(selector).click();
   assert.equal(await s.page.evaluate(()=>window.__nativeShare),null);
   await s.page.locator('#refShareBoard').click();
   await s.page.waitForFunction(()=>window.__nativeShare);
   assert.deepEqual(await s.page.evaluate(()=>window.__nativeShare),baseline);
   await s.page.locator(selector).click();
   await s.page.locator('#referralDialog [data-ref-open]').click();
   await s.page.locator('#refLink').waitFor({state:'visible'});
   assert.equal(new URL(await s.page.locator('#refLink').inputValue()).searchParams.get('invite'),'OWNCODE123');
   await s.page.keyboard.press('Escape');
   await s.page.evaluate(()=>productAnalytics().flush());
   const dialogEvents=s.apiCalls.filter(c=>c.path==='/api/product-event'||c.path==='/api/product-events').flatMap(c=>(c.body.events||[c.body]).map(e=>({event:e.event_type,headers:c.headers}))).filter(e=>e.event==='referral_invite_dialog_opened');
   assert.equal(dialogEvents.at(-1).headers['x-proplet-referral-source'],selector==='#shareDailyBtn'?'daily':'tajenka');
   // Tajenka's button is rebuilt by renderDaily; delegation must survive that.
   await s.page.evaluate(()=>renderDaily());
  }
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Dnes Daily and rebuilt Tajenka offer both choices and preserve original board share despite stale result');
  s=await boot(browser);
  await s.page.evaluate(()=>startFree('easy'));
  await s.page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame.puzzle.answers?.length);
  await s.page.locator('#screen-game .cell').first().waitFor();
  const paths=await s.page.evaluate(()=>currentGame.puzzle.answers.map(a=>a.path));
  for(let i=0;i<paths.length;i++){await draw(s.page,paths[i]);await s.page.waitForFunction(n=>currentGame.found.length===n,i+1)}
  await s.page.locator('#winModal').waitFor({state:'visible'});
  await s.page.waitForFunction(()=>document.querySelector('#winResultActions #winShareBtn')?.textContent.includes('Pozvi kamaráda'));
  assert.equal(await s.page.locator('#winPrimaryBtn').innerText(),'Hraj další úroveň');
  assert.equal(await s.page.locator('#winClean').isVisible(),false);
  assert.equal(await s.page.locator('#levelLeaderboardBox [role="tablist"]').count(),0);
  assert.equal(await s.page.locator('#levelLeaderboardBox .ranking-expand').count(),0);
  for(const width of [320,690,1440]){
   await s.page.setViewportSize({width,height:950});
   const layout=await s.page.evaluate(()=>{
    const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();
    return {rank:rect('levelLeaderboardBox'),next:rect('winPrimaryBtn'),invite:rect('winShareBtn'),xp:rect('winXp'),title:rect('winTitle'),heading:document.querySelector('.win-result-heading').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert(layout.rank.bottom<=layout.next.top+2&&layout.next.bottom<=layout.invite.top+2);
   assert(layout.xp.top<layout.rank.top);assert(!layout.overflow);
   assert(Math.abs(layout.title.x+layout.title.width/2-layout.heading.x-layout.heading.width/2)<2);
  }
  await shot(s.page,'#winModal .win-card','native-result');
  await s.page.evaluate(()=>{window.__nativeShare=null;Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__nativeShare=data}})});
  await s.page.locator('#winShareBtn').click();await s.page.locator('#refShareBoard').click();
  await s.page.waitForFunction(()=>window.__nativeShare);
  assert(!new URL(await s.page.evaluate(()=>window.__nativeShare.url)).searchParams.has('invite'));
  await s.page.locator('#winPrimaryBtn').click();
  await s.page.waitForFunction(()=>currentGame&&!currentGame.finished&&document.querySelector('#winModal').classList.contains('hidden'));
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Actual board drawing preserves native result layout, earned XP, board sharing and next level');
  s=await boot(browser,{paid:true});
  assert.equal(await s.page.locator('#referralHome h2').innerText(),'Bonus máš ty i Katka.');
  assert.equal(await s.page.locator('#referralHome .ref-reward small').count(),0);
  assert(await s.page.locator('#referralInviteHome [data-ref-open]').isVisible());
  for(const width of [320,690,1440]){
   await s.page.setViewportSize({width,height:950});await avatars(s.page,'#referralHome');
   assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  await s.page.locator('.bottom-nav [data-nav="profile"]').click();
  await s.page.locator('#referralProfileReward').waitFor({state:'visible'});
  await s.page.locator('#settingsHeaderBtn').click();
  await s.page.waitForFunction(()=>document.querySelector('#screen-profile').classList.contains('settings-open'));
  assert.equal(await s.page.locator('#referralProfileReward').isVisible(),false);
  assert.equal(await s.page.locator('#referralProfile').isVisible(),false);
  await s.page.locator('#profileSettingsBack').click();
  await s.page.locator('#referralProfileReward [data-ref-reward-close]').click();
  await s.page.waitForFunction(()=>!document.querySelector('#referralProfileReward'));
  assert(s.apiCalls.some(c=>c.path==='/api/referrals/dismiss'&&c.method==='POST'));
  await s.page.reload();await s.page.waitForFunction(()=>window.PropletReferrals?.model.ready);
  assert.equal(await s.page.locator('#referralProfileReward').count(),0);
  await s.page.locator('.bottom-nav [data-nav="daily"]').click();
  await s.page.locator('#referralHome [data-ref-open]').waitFor({state:'visible'});
  assert(await s.page.locator('#referralHome [data-ref-open]').isVisible());
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Paid invitee can invite; real dismissal API called; server dismissal survives reload; Settings empty');
  s=await boot(browser,{guest:true,query:'?invite='+inviteCode});
  assert.equal(await s.page.locator('#freeRefreshToday').isVisible(),false);
  assert.equal(await s.page.locator('#freeRefreshAnnouncement:not(.hidden)').count(),0);
  pass('New incoming player has no 300-board promo or announcement');
  await s.page.locator('#referralHome [data-ref-accept]').click();
  await s.page.locator('#refCreateAccount').click();
  await s.page.locator('#playerNameInput').fill('Eliška');
  await s.page.locator('#playerPasswordInput').fill('test-password-only');
  await s.page.locator('#saveProfileBtn').click();
  await s.page.waitForFunction(()=>getProfile()?.id==='test-referral-player');
  const registration=s.apiCalls.find(c=>c.path==='/api/player'&&c.method==='POST');
  assert.equal(registration?.body.inviteCode,inviteCode);
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Native password registration sends preserved inviteCode');
  s=await boot(browser,{guest:true,query:'?invite='+inviteCode+'&auth=google#access_token=TEST-GOOGLE-TOKEN&token_type=bearer'});
  await s.page.waitForFunction(()=>getProfile()?.id==='test-referral-player');
  const google=s.apiCalls.find(c=>c.path==='/api/auth/google/complete');
  assert.equal(google?.body.inviteCode,inviteCode);
  assert.deepEqual(s.errors,[]);await s.ctx.close();
  pass('Native Google return sends preserved inviteCode');
 }finally{await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify({type:'real frontend / mocked API (not database verification)',checks},null,2))}
})().catch(e=>{console.error(e);fs.writeFileSync(out+'/failure.txt',e.stack);process.exitCode=1});
