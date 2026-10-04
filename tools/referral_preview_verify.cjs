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
 await page.waitForFunction(()=>window.PropletReferralPreview&&document.querySelector('#referralHome')&&PropletReferralPreview.revision===4);
 assert.equal(await page.locator('#puzzleBootError').count(),0);
 await page.waitForFunction(()=>document.querySelector('#difficultyCards')?.children.length>0);
}
async function screenshot(page,name){await page.screenshot({path:out+'/'+name+'.png',fullPage:true});report.screenshots.push(name);if(!process.env.PREVIEW_URL&&['01-native-home','02-invitation'].includes(name))console.log('PREVIEW_IMAGE:'+name+':'+fs.readFileSync(out+'/'+name+'.png').toString('base64'))}
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
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await ready(page);await screenshot(page,'01-native-home');
  assert.equal(await page.locator('#referralDialog:not(.hidden)').count(),0);check('No unsolicited promotional modal');
  await page.locator('#referralHome [data-ref-open]').click();
  assert.match(await page.locator('#referralDialog').innerText(),/týdenních XP hráče ani týmu/);
  assert((await page.locator('#refLink').boundingBox()).width>100,'invitation link remains readable on mobile');
  const referralLink=await page.locator('#refLink').inputValue();assert.equal(new URL(referralLink).origin,new URL(base).origin);
  await screenshot(page,'02-invitation');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#referralDialog').isVisible(),false);
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  assert.match(await page.locator('#referralProfile').innerText(),/Eliška/);await screenshot(page,'03-native-profile');
  check('Invitation and progress are integrated into native Dnes and Já');
  await ready(page,'?view=new&invite=KATKA');
  assert.equal(await page.evaluate(()=>getProfile()),null);
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
  assert.match(await page.locator('#referralWin').innerText(),/Týden|týdenních/);
  await screenshot(page,'04-real-fifth-board-reward');
  assert.equal(await page.evaluate(()=>PropletReferralPreview.complete(currentGame)),false);
  assert.equal(await page.evaluate(()=>PropletReferralPreview.stats().referralBonusXp),1000);
  check('Drawing actual native board '+puzzleId+' pays both sides once; bonus excluded from weekly player/team XP');
  await page.locator('#winMenuBtn').click();await page.locator('.bottom-nav [data-nav="leaderboard"]').click();
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

  await ready(page,'?view=four&theme=dark');await screenshot(page,'06-dark-mobile');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.setViewportSize({width:320,height:740});await page.locator('#refPreviewControls summary').click();await screenshot(page,'07-narrow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.setViewportSize({width:1440,height:1000});await ready(page);await screenshot(page,'08-desktop');
  check('Native layout supports 320px, mobile dark and desktop');
  const blocked=await page.evaluate(async()=>{const r=await fetch('https://iopyhluayfszskyqqpuc.supabase.co/rest/v1/players',{method:'POST',body:'{}'});return {status:r.status,audit:PropletReferralPreview.audit}});
  assert.equal(blocked.status,403);
  const production=requests.filter(r=>/supabase\.co|hrajproplet\.cz|facebook|google-analytics/.test(new URL(r.url).hostname));
  assert.deepEqual(production,[]);
  assert.equal(requests.filter(r=>new URL(r.url).pathname.startsWith('/api/')).length,0);
  assert.deepEqual(errors,[]);
  report.requests=requests;check('Browser sends zero API or production requests; external fetch blocked; no JS errors');
 }finally{await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);fs.writeFileSync(out+'/failure.txt',e.stack);process.exit(1)});
