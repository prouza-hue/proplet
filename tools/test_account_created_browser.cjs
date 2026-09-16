const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const url=process.env.TEST_URL;
 assert(url&&['127.0.0.1','localhost'].includes(new URL(url).hostname));
 const health=await fetch(url+'/api/health').then(r=>r.json());
 assert(health.isolatedFixture&&health.syntheticOnly&&health.database.startsWith('proplet_test_'));
 const before=await fetch(url+'/__fixture/counts').then(r=>r.json());
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const results=[];
 try{
  for(const entry of ['profile','win_cta','post_game_nudge','progress_guard','onboarding']){
   const context=await browser.newContext({serviceWorkers:'block'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
   const page=await context.newPage();await page.goto(url);
   await page.waitForFunction(()=>typeof document.querySelector('#saveProfileBtn')?.onclick==='function');
   // Invoke the existing entry helper; submit through the actual visible form.
   if(entry==='onboarding')await page.waitForSelector('.onboarding-return-login',{state:'attached'});
   await page.evaluate(entry=>{
    closeTransientModals();
    if(entry==='win_cta')openAccountFromWin();
    else if(entry==='post_game_nudge')openAccountFromNudge('create');
    else if(entry==='progress_guard')openProgressGuardAccount();
    else if(entry==='onboarding')document.querySelector('.onboarding-return-login').click();
    else openProfileModal('create');
   },entry);
   if(entry==='onboarding')await page.locator('#profileModeCreate').click();
   await page.locator('#playerNameInput').fill('Test '+entry.slice(0,4)+' '+Date.now().toString().slice(-8));
   await page.locator('#playerPasswordInput').fill('synthetic-password');
   const response=page.waitForResponse(r=>r.url().endsWith('/api/player')&&r.request().method()==='POST');
   await page.locator('#saveProfileBtn').click();assert.equal((await response).status(),200);
   await page.waitForFunction(()=>getProfile()?.id);
   results.push({entry,created:true});await context.close();
  }
  const after=await fetch(url+'/__fixture/counts').then(r=>r.json());
  assert.equal(after.players-before.players,5);assert.equal(after.events-before.events,5);assert.equal(after.duplicates,0);
  const out={localPreview:true,syntheticOnly:true,oauthProviderTested:false,browser:browser.version(),before,after,results};
  fs.writeFileSync(process.env.RESULT_PATH||'account-created-browser.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
