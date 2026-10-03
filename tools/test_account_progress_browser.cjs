// Synthetic account and delayed responses only; never runs against a deployment.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const url=process.env.TEST_URL;
 assert(url&&['127.0.0.1','localhost'].includes(new URL(url).hostname));
 const health=await fetch(url+'/api/health').then(r=>r.json());
 assert(health.isolatedFixture&&health.database===false);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const report={sha:health.sha,started:new Date().toISOString(),browser:browser.version(),synthetic:true,checks:[]};
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1104,height:884}});
  context.setDefaultTimeout(15000);
  const page=await context.newPage();let release,fail=false,requests=0,completed=[];
  const waitForRequests=async target=>{for(let i=0;i<80&&requests<target;i++)await page.waitForTimeout(50);assert(requests>=target,`expected ${target} progress reads, got ${requests}`)};
  // The committed Tajenka fixture is release slot 3; keep the test on that date.
  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
  await context.addInitScript(()=>localStorage.setItem('proplet:content-release:g5-r1','1'));
  // Model the enabled production capability; the generic static fixture has no ordering API.
  const orderRecords=new Map();
  await page.route('**/api/free-order/config',r=>r.fulfill({json:{enabled:true}}));
  await page.route('**/api/free-order',r=>{
   const owner=r.request().headers().authorization||'guest';
   const records=orderRecords.get(owner)||{};orderRecords.set(owner,records);
   if(r.request().method()==='POST'){
    const b=r.request().postDataJSON();
    const record={mode:b.mode,revision:(records[b.difficulty]?.revision||0)+1,offered:true,newcomer:!!b.newcomer,plan:{version:'pestre-v1',difficulty:b.difficulty,kind:'varied',ids:b.ids}};
    records[b.difficulty]=record;return r.fulfill({json:{record}});
   }
   return r.fulfill({json:{enabled:true,records,resumeIds:{}}});
  });
  // Existing test accounts have already chosen anonymous leaderboard visibility.
  await page.route('**/api/account/snapshot*',async r=>{requests++;await new Promise(resolve=>release=resolve);await r.fulfill({status:fail?503:200,json:fail?{detail:'synthetic outage'}:{name:'Synthetic player',publicRankings:false,stats:{points:34018},avatar:'🙂',completed,cursor:new Date().toISOString()}})});
  await page.goto(url);await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB&&typeof tajenkaPuzzle!=='undefined'&&tajenkaPuzzle?.id&&typeof document.querySelector('#playDailyBtn')?.onclick==='function');
  completed=await page.evaluate(()=>{
   closeTransientModals();stopTimer();currentGame=null;nav('daily');
   const batch=puzzleDB.free.hardcore.slice(0,3);
   puzzleDB.contentStatus={latestBatch:{id:'synthetic-week',availableFrom:pragueDateISO(),count:3,levels:batch.map(p=>({id:p.id,difficulty:'hardcore'}))}};
   return [...batch.map(p=>({puzzleId:p.id,challengeKey:challengeKey('free',p,null),mode:'free',difficulty:'hardcore',level:p.meta.level,contentGeneration:4,elapsedMs:42000,moves:12,points:100,completedAt:'2026-09-15T09:00:00Z'})),{puzzleId:tajenkaPuzzle.id,challengeKey:'tajenka:'+tajenkaPuzzle.id,mode:'tajenka',elapsedMs:42000,moves:5,points:200}];
  });
  await page.evaluate(()=>{window.PROPLET_RUNTIME_ENV='preview';acceptAccountProfile({publicRankings:false,id:'synthetic-a',token:'synthetic-token',name:'Synthetic player'});syncQueue();renderDaily();renderFree()});
  await page.waitForFunction(()=>document.body.classList.contains('account-progress-pending'));
  await page.waitForTimeout(1000);assert.equal(requests,1,'login and sync share one snapshot read');
  assert.equal(await page.locator('#quickPlayCard').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#quickPlayGrid').evaluate(e=>getComputedStyle(e).visibility),'hidden','unknown counts are hidden');
  await page.evaluate(()=>{startFree('hardcore');startTajenka();startGame(puzzleDB.free.hardcore[0],'free',null)});
  assert.equal(await page.evaluate(()=>!!currentGame),false,'all entry paths reject unknown progress');
  await page.screenshot({path:(process.env.RESULT_PATH||'account-progress.json')+'.pending.png'});
  report.checks.push('delayed preview login hides unknown counts, deduplicates reads, blocks game entry');
  release();await page.waitForFunction(()=>accountProgressAvailable());
  assert.equal(await page.evaluate(()=>freeProgress('hardcore').done),3);
  assert.equal(await page.evaluate(()=>latestContentUnplayed().length),0);
  assert(await page.locator('#newContentBanner').textContent().then(t=>t.includes('Týdenní várka dohraná')));
  assert(await page.locator('#todayNewContentBanner').evaluate(e=>e.classList.contains('hidden')),'Today must hide a fully completed weekly batch');
  assert.equal(await page.locator('#todayNewContentBanner').textContent(),'');
  assert(await page.locator('#tajenkaPreviewCard.completed [data-tajenka-recap]').count());
  assert.equal(await page.locator('#quickPlayCard').getAttribute('aria-busy'),'false');
  // The default is now the shared varied route, not the next numeric slot.
  // Completing historical slots 1–3 must preserve those results while offering
  // the first unplayed board of the approved shared route (Gen5, level 217).
  const expectedNext='g5-r1-hardcore-001';
  assert(!completed.some(result=>result.puzzleId===expectedNext));
  await page.waitForFunction(()=>freeOrder().enabled()&&freeOrder().ready(),null,{timeout:15000});
  assert.equal(await page.evaluate(()=>freeOrder().record('hardcore').mode),'varied');
  assert.equal(await page.evaluate(()=>freeProgress('hardcore').nextUnsolved.id),expectedNext);
  await page.evaluate(()=>startFree('hardcore'));
  await page.waitForFunction(id=>currentGame?.puzzle.id===id,expectedNext,{timeout:15000});
  assert.equal(await page.evaluate(()=>currentGame.puzzle.meta.level),217);
  assert.equal(await page.evaluate(()=>freeProgress('hardcore').done),3,'starting the shared next board preserves completed historical slots');
  report.checks.push('history, completed Tajenka and weekly batch rerender without reload; shared next game is g5-r1-hardcore-001 (level 217)');
  const beforeFailure=requests;
  await page.evaluate(()=>{nav('daily');currentGame=null;stopTimer();acceptAccountProfile({publicRankings:false,id:'synthetic-b',token:'synthetic-b-token',name:'Other synthetic player'})});
  await page.waitForTimeout(300);fail=true;release();
  await waitForRequests(beforeFailure+2);
  assert.equal(await page.evaluate(()=>accountProgressError),false,'first transient failure is hidden while automatic retry is pending');
  release();await page.waitForFunction(()=>accountProgressError);
  assert.equal(await page.evaluate(()=>accountProgressAvailable()),false,'failed new account cannot use other account history');
  const beforeManual=requests;
  await page.locator('#screen-daily .account-progress-status button').click();
  await waitForRequests(beforeManual+1);fail=false;completed=[];release();await page.waitForFunction(()=>accountProgressAvailable());
  assert.equal(await page.evaluate(()=>freeProgress('hardcore').done),0,'confirmed empty history is valid');
  report.checks.push('first transient failure retries silently; second failure blocks; explicit retry accepts genuinely empty history');
  await page.evaluate(()=>acceptAccountProfile({publicRankings:false,id:'synthetic-c',token:'synthetic-c-token',name:'Delayed account'}));
  await page.waitForTimeout(200);const staleRelease=release;
  await page.evaluate(()=>acceptAccountProfile({publicRankings:false,id:'synthetic-d',token:'synthetic-d-token',name:'Current account'}));
  await page.waitForTimeout(200);release();await page.waitForFunction(()=>accountProgressAvailable());
  staleRelease();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>accountProgressReady.id),'synthetic-d');
  assert.equal(await page.evaluate(()=>getState('synthetic-c').remoteProgressLoadedAt),undefined);
  report.checks.push('late previous-account response cannot mark progress ready or write its history');
  await page.reload();await page.waitForFunction(()=>typeof accountProgressAvailable==='function'&&accountProgressAvailable());
  await page.waitForTimeout(500);assert.equal(await page.locator('body.account-progress-pending').count(),0);
  assert.equal(await page.locator('.account-progress-status:not([hidden])').count(),0,'verified cached history refreshes silently');
  release();await page.waitForFunction(()=>accountProgressAvailable());
  await context.setOffline(true);await page.evaluate(()=>accountProgressReady=null);assert.equal(await page.evaluate(()=>accountProgressAvailable()),true,'persisted verified history remains available offline');
  report.checks.push('reload uses verified account cache immediately; background refresh and offline play remain available');
  report.finished=new Date().toISOString();fs.writeFileSync(process.env.RESULT_PATH||'account-progress.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
