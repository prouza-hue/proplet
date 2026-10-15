'use strict';
// Real browser, real service worker and real shipped game runtime. Only API
// account/result boundaries are a loopback fixture; PostgreSQL is tested apart.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '../..');
const port = Number(process.env.OFFLINE_FIXTURE_PORT || 8765);
const origin = `http://127.0.0.1:${port}`;
const evidence = process.env.OFFLINE_EVIDENCE_DIR || path.join(os.tmpdir(), 'proplet-offline-browser-evidence');
fs.mkdirSync(evidence, {recursive:true});
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'proplet-offline-browser-'));
const report = {fixtureOnly:true, productionWrites:0, startedAt:new Date().toISOString(), checks:[], browserErrors:[], externalRequests:[], failedRequests:[],httpFailures:[],workerEvents:[]};
const json = (url, options) => fetch(origin + url, options).then(async r => {
  const body = await r.json();
  assert.ok(r.ok, `${url}: ${r.status} ${JSON.stringify(body)}`);
  return body;
});
const poll = async (test, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await test()) return; await new Promise(r => setTimeout(r, 100)); }
  throw Error('Acceptance polling timed out');
};
const check = (name, detail) => { report.checks.push({name,...detail}); console.log('PASS', name, JSON.stringify(detail || {})); };
let context, server, serverOutput = '';
let transportOffline=false;
const cdpSessions=new WeakMap();

async function network(offline){
  transportOffline=offline;
  await context.setOffline(offline);
  // Chrome 151 splits transport throttling from the navigator network state.
  // Override through the browser protocol as well; never patch navigator in JS.
  for(const page of context.pages()){
    let cdp=cdpSessions.get(page);
    if(!cdp){cdp=await context.newCDPSession(page);cdpSessions.set(page,cdp)}
    await cdp.send('Network.overrideNetworkState',{offline,latency:0,downloadThroughput:offline?0:-1,uploadThroughput:offline?0:-1});
  }
}

async function launch({offline=false}={}) {
  context = await chromium.launchPersistentContext(userData, {
    headless:true, viewport:{width:412,height:915}, deviceScaleFactor:1,
    serviceWorkers:'allow', args:['--no-sandbox'],
    ...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),
  });
  await context.addInitScript(() => {
    const match = window.matchMedia.bind(window);
    window.matchMedia = query => {
      const value = match(query);
      if (query.includes('display-mode: standalone')) Object.defineProperty(value, 'matches', {value:true});
      return value;
    };
    if (!localStorage.getItem('offline-browser-fixture-seeded')) {
      localStorage.setItem('offline-browser-fixture-seeded', '1');
      localStorage.setItem('proplet-v2-profile', JSON.stringify({id:'fixture-a', name:'Offline tester A', token:'fixture-token-a', avatar:'🦊',hasPassword:true,supportMode:'none',publicRankings:true}));
      for (const [key,value] of Object.entries({
        'proplet-v3-7-required-onboarding':'done','proplet-v3-16-2-helper-onboarding':'done',
        'proplet-v3-32-8-rule-principle-seen':'1','proplet-v3-16-2-helper-mode':'none',
        'proplet:content-release:g5-r1':'1','proplet:content-release:refresh300-v1':'1',
        'proplet:content-release:mk100-v2':'1','proplet:referral-announcement-seen:v1:fixture-a':'1',
        'proplet:daily-extra-intro:v1:account:fixture-a':'1',
      })) localStorage.setItem(key,value);
      localStorage.setItem('proplet-v3-settings', JSON.stringify({theme:'light',sound:false,haptics:false,wakeLock:false}));
      localStorage.setItem('proplet-v3-26-install-nudge', JSON.stringify({done:true,installed:true}));
      localStorage.setItem('proplet-v3-8-2-push-nudge', JSON.stringify({done:true,dismissedAt:Date.now()}));
      localStorage.setItem('proplet-marketing-consent-v1', JSON.stringify({value:'denied',at:Date.now()}));
    }
  });
  // Browser requests cannot accidentally touch production or third parties.
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    report.externalRequests.push(route.request().url()); return route.abort();
  });
  context.on('page', bindPage);
  for (const page of context.pages()) bindPage(page);
  const page=context.pages()[0] || await context.newPage();
  const cdp=await context.newCDPSession(page);
  cdpSessions.set(page,cdp);
  for(const kind of ['workerRegistrationUpdated','workerVersionUpdated','workerErrorReported'])cdp.on('ServiceWorker.'+kind,value=>report.workerEvents.push({kind,...value}));
  await cdp.send('ServiceWorker.enable');
  await network(offline);
  return page;
}

function bindPage(page) {
  page.on('pageerror', error => report.browserErrors.push(error.message));
  page.on('requestfailed', request => report.failedRequests.push({url:request.url().replace(origin,''),error:request.failure()?.errorText}));
  page.on('response', response => {if(response.status()>=400)report.httpFailures.push({url:response.url().replace(origin,''),status:response.status()})});
}

async function ready(page) {
  await page.goto(origin + '/', {waitUntil:'domcontentloaded'});
  // This Chrome build resets navigator's emulated state on navigation while
  // keeping transport offline. Reapply the protocol state to the new renderer.
  await network(transportOffline);
  await page.waitForFunction(() => document.documentElement.dataset.archiveReady === '1' && typeof startFree === 'function', null, {timeout:45000});
  assert.equal(await page.evaluate(() => !!window.PROPLET_ARCHIVE_PREVIEW), false, 'Native app must run without preview fetch adapter');
  assert.equal(await page.evaluate(() => !!document.querySelector('#puzzleBootError')), false);
  console.log('Browser runtime ready', await page.evaluate(()=>({offline:!navigator.onLine,status:window.PropletOffline?.getState?.()})));
}

async function startFreeBoard(page, difficulty) {
  await page.evaluate(async diff => {
    document.querySelectorAll('.modal:not(.hidden)').forEach(el => el.classList.add('hidden'));
    await startFree(diff);
  }, difficulty);
  await page.waitForFunction(diff => window.currentGame?.puzzle?.difficulty === diff && !window.currentGame.finished, difficulty);
  return page.evaluate(() => ({id:currentGame.puzzle.id, answers:currentGame.puzzle.answers,found:currentGame.found.length,timingUnverified:currentGame.timingUnverified}));
}

async function traceWord(page, answer) {
  const before = await page.evaluate(() => currentGame.found.length);
  // DOM pointer events use the actual board/input handlers and submitPath.
  await page.evaluate(path => {
    if (currentGame.pausedAt != null) resumeGameClock();
    const cells = path.map(i => document.querySelector(`.cell[data-index="${i}"]`));
    if (cells.some(c => !c)) throw Error('Missing board cell');
    const event = (type,cell) => {const r=cell.getBoundingClientRect();return new PointerEvent(type,{bubbles:true,pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2});};
    cells[0].dispatchEvent(event('pointerdown',cells[0]));
    for (const cell of cells.slice(1)) cell.dispatchEvent(event('pointerenter',cell));
    document.dispatchEvent(event('pointerup',cells.at(-1)));
  }, answer.path);
  await page.waitForFunction(n => currentGame.found.length === n + 1, before);
}

async function solve(page, answers) {
  for (const answer of answers) await traceWord(page, answer);
  await page.waitForFunction(() => currentGame.finished && !document.querySelector('#winModal').classList.contains('hidden'));
  return page.evaluate(() => ({id:currentGame.puzzle.id,result:currentGame.resultRecord,queue:getQueue(),completed:getState().completed}));
}

async function main() {
  server = spawn(process.env.PYTHON || 'python', [path.join(__dirname, 'fixture_server.py')], {cwd:root,env:{...process.env,OFFLINE_FIXTURE_PORT:String(port)},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data', data => {serverOutput += data}); server.stderr.on('data', data => {serverOutput += data});
  await poll(async () => {try {return (await fetch(origin + '/__fixture/state')).ok}catch{return false}}, 30000);
  const alternative = await json('/__fixture/archive-alternative');
  let page = await launch();
  await ready(page);
  await page.waitForFunction(() => window.PropletOffline?.getState?.().ready === true, null, {timeout:120000});
  const pack = await page.evaluate(async () => ({state:PropletOffline.getState(),cacheKeys:await caches.keys(),profileReady:hasCachedAccountProgress(),counts:Object.fromEntries(Object.entries((await PropletOffline.getPuzzleDatabase()).free).map(([k,v])=>[k,v.length])),controlled:!!navigator.serviceWorker.controller}));
  assert.equal(pack.profileReady,true); assert.equal(pack.controlled,true);
  assert.deepEqual(Object.keys(pack.counts).sort(),['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'].sort());
  check('Automatic pack and service-worker shell ready', pack);
  const contentSafety = await page.evaluate(async () => {
    const names=(await caches.keys()).filter(name=>name.startsWith('proplet-offline-content-v1-'));
    const paths=[];
    for(const name of names)for(const request of await (await caches.open(name)).keys())paths.push(new URL(request.url).pathname);
    const bank=await PropletOffline.getPuzzleDatabase(),today=pragueDateISO();
    return {paths,unreleasedFree:Object.values(bank.free).flat().filter(p=>p.meta?.availableFrom>today).map(p=>p.id),cachedDaily:JSON.parse(localStorage.getItem('proplet-dated-daily-v1')||'[]').map(row=>row.dailyDate),today};
  });
  assert.equal(contentSafety.paths.some(p=>/^\/api\/daily(?:-special)?$/.test(p)),false,'The public pack must not download calendar Daily or Extra endpoints');
  assert.deepEqual(contentSafety.unreleasedFree,[]);
  assert.ok(contentSafety.cachedDaily.every(date=>date<=contentSafety.today));
  check('Public offline bundle contains no future Daily/Extra publication',contentSafety);
  await page.screenshot({path:path.join(evidence,'01-automatic-ready.png'),fullPage:true});
  if(process.env.OFFLINE_SCREENSHOT_ONLY==='1'){
    report.mode='Fresh online shell/font verification and native UI screenshots';
    await page.evaluate(()=>document.fonts.ready);
    const fonts=await page.evaluate(()=>({fraunces:document.fonts.check('650 24px Fraunces'),outfit:document.fonts.check('400 16px Outfit'),faces:[...document.fonts].map(font=>({family:font.family,status:font.status,weight:font.weight}))}));
    assert.equal(fonts.fraunces,true);assert.equal(fonts.outfit,true);
    check('Local Fraunces and Outfit load in the current native shell',fonts);
    await page.locator('#settingsHeaderBtn').click();
    await page.waitForSelector('#screen-profile.settings-open');
    await page.evaluate(()=>renderOfflineStatus());
    await page.locator('#offlineAvailability').scrollIntoViewIfNeeded();
    report.visibleProfileImages=await page.evaluate(()=>[...document.images].filter(image=>image.getBoundingClientRect().width>0&&image.getBoundingClientRect().height>0).map(image=>({src:image.src,loaded:image.complete&&image.naturalWidth>0})));
    await page.screenshot({path:path.join(evidence,'04-profile-offline-ready.png'),fullPage:false,animations:'disabled'});
    assert.match(await page.locator('#offlineAvailability').innerText(),/Připraveno na hraní offline/);
    await page.evaluate(()=>{
      nav('daily');window.scrollTo({top:0,behavior:'instant'});
      document.querySelectorAll('.modal:not(.hidden)').forEach(el=>el.classList.add('hidden'));
      renderInstallModal('daily');document.querySelector('#installNudgeModal').classList.remove('hidden');
    });
    for(const size of [{width:412,height:915},{width:390,height:844}]){
      await page.setViewportSize(size);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(450);
      const layout=await page.evaluate(()=>{const card=document.querySelector('#installNudgeModal .modal-card').getBoundingClientRect();return {title:document.querySelector('#installNudgeTitle').innerText,copy:document.querySelector('#installNudgeCopy').innerText,button:document.querySelector('#installNudgePrimary').innerText,card:{x:card.x,y:card.y,width:card.width,height:card.height,bottom:card.bottom},viewport:{width:innerWidth,height:innerHeight}}});
      assert.equal(layout.title,'Chceš hrát i offline?');assert.equal(layout.button,'Nainstalovat Proplet');
      assert.ok(layout.card.x>=0&&layout.card.y>=0&&layout.card.bottom<=size.height&&layout.card.width<=size.width);
      await page.screenshot({path:path.join(evidence,`05-install-offline-cta-${size.width}.png`),fullPage:false,animations:'disabled'});
      check('Native offline installation CTA fits '+size.width+'px',layout);
    }
    report.ok=true;return;
  }

  // Close the complete browser process, relaunch with airplane mode already on.
  await network(true); await context.close(); context = null;
  page = await launch({offline:true}); await ready(page);
  assert.equal(await page.evaluate(() => navigator.onLine),false);
  check('Airplane-mode cold start after browser process restart', {url:page.url()});

  const played=[];
  for (const difficulty of ['easy','hard','hardcore','mozkomor','mozkokalypsa']) {
    const board = await startFreeBoard(page,difficulty);
    assert.equal(board.found,0,'Each board is previously unopened');
    assert.equal(board.timingUnverified,true,'Offline time is never competitive-verified');
    const done = await solve(page,board.answers); played.push(board.id);
    assert.ok(done.queue.some(r => r.puzzleId === board.id));
    check('Offline solve '+difficulty, {puzzleId:board.id,words:board.answers.length,queued:done.queue.length});
  }

  // One remaining difficulty is intentionally interrupted and restored from disk.
  const partial = await startFreeBoard(page,'medium');
  await traceWord(page,partial.answers[0]);
  await page.evaluate(() => saveGameProgress());
  const progressBefore = await page.evaluate(id => getState().inProgress['free:'+id], partial.id);
  assert.equal(progressBefore.found.length,1);
  await context.close(); context=null;
  page = await launch({offline:true}); await ready(page);
  assert.equal(await page.evaluate(() => getQueue().length),played.length);
  const restored=await startFreeBoard(page,'medium');
  assert.equal(restored.id,partial.id);assert.equal(restored.found,1);
  await solve(page,partial.answers.slice(1)); played.push(partial.id);
  check('Unsent results and partially solved board survive second process restart', {puzzleId:partial.id,foundRestored:restored.found,queued:played.length});

  await page.evaluate(async id => {document.querySelectorAll('.modal:not(.hidden)').forEach(el=>el.classList.add('hidden'));await PropletArchiveExperience.start(id)},alternative.puzzleId);
  await solve(page,alternative.cover); played.push(alternative.puzzleId);
  const archiveRow=await page.evaluate(id=>getQueue().find(row=>row.puzzleId===id),alternative.puzzleId);
  assert.deepEqual(archiveRow.archiveSolution.found,alternative.cover);
  check('Downloaded Archive approved alternative cover works offline', {puzzleId:alternative.puzzleId,words:alternative.cover.length});
  await page.screenshot({path:path.join(evidence,'02-offline-queued.png'),fullPage:true});

  const queued=await page.evaluate(()=>getQueue());
  assert.equal(queued.length,7);assert.equal(Object.keys((await json('/__fixture/state')).ledgers['fixture-a'].results).length,0);
  await network(false);
  await page.waitForFunction(() => getQueue().length === 0, null, {timeout:30000});
  let state = await json('/__fixture/state');
  assert.equal(Object.keys(state.ledgers['fixture-a'].results).length,7);
  assert.equal(state.ledgers['fixture-a'].posts.length,7);
  assert.equal(state.ledgers['fixture-a'].points,565); // 15+25+50+100+150+200 +25 archive.
  const originalPoints=state.ledgers['fixture-a'].points;
  check('Real client POST drains every offline result once after reconnect', {rows:7,posts:7,points:originalPoints});

  // Explicit identical receipt replay travels through real client queue+API.
  await page.evaluate(async row=>{queueResult(row);await syncQueue({announce:false})},queued[0]);
  state=await json('/__fixture/state');
  assert.equal(state.ledgers['fixture-a'].points,originalPoints);
  assert.equal(Object.keys(state.ledgers['fixture-a'].results).length,7);
  assert.equal(state.ledgers['fixture-a'].posts.length,8);
  check('Replayed queued receipt never duplicates fixture reward', {rows:7,points:originalPoints,posts:8});

  // Another account must not adopt the first account's queue or progress.
  await network(true);
  const pending = await startFreeBoard(page,'easy');await solve(page,pending.answers);
  const pendingA=await page.evaluate(()=>getQueue().length);assert.equal(pendingA,1);
  await page.evaluate(()=>saveProfile({id:'fixture-b',name:'Offline tester B',token:'fixture-token-b',avatar:'🦉',hasPassword:true,supportMode:'none',publicRankings:true}));
  assert.equal(await page.evaluate(()=>getQueue().length),0);
  assert.equal(await page.evaluate(()=>Object.keys(getState().completed).length),0);
  await network(false);await page.evaluate(()=>syncQueue({announce:false}));
  state=await json('/__fixture/state');
  assert.equal(state.ledgers['fixture-a'].posts.length,8);assert.equal(state.ledgers['fixture-b'].posts.length,0);
  assert.equal(await page.evaluate(()=>getQueue('fixture-a').length),1);
  check('Account switch isolates queue, results and synchronisation', {pendingA:1,queueB:0,postsB:0});
  await page.evaluate(()=>saveProfile({id:'fixture-a',name:'Offline tester A',token:'fixture-token-a',avatar:'🦊',hasPassword:true,supportMode:'none',publicRankings:true}));
  await page.evaluate(()=>syncQueue({announce:false}));
  await page.waitForFunction(()=>getQueue().length===0);
  state=await json('/__fixture/state');assert.equal(Object.keys(state.ledgers['fixture-a'].results).length,8);
  check('Original account resumes its retained queue', {rows:8});

  // An already-open online Extra may lose connectivity. The final word must
  // remain in progress, and reconnect confirms the completion automatically.
  await json('/__fixture/extra',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,rejectFinish:true})});
  await page.evaluate(async()=>{
    await refreshDatedSpecial();
    const descriptor=datedSpecial().cached(pragueDateISO());
    if(!descriptor)throw Error('Published fixture Extra did not bind');
    document.querySelectorAll('.modal:not(.hidden)').forEach(el=>el.classList.add('hidden'));
    await startGame(descriptor.puzzle,'daily_special',descriptor.dailyDate);
  });
  await page.waitForFunction(()=>currentGame?.mode==='daily_special'&&!currentGame.finished);
  const extra=await page.evaluate(()=>({id:currentGame.puzzle.id,key:challengeKey(currentGame.mode,currentGame.puzzle,currentGame.dailyDate),answers:currentGame.puzzle.answers}));
  await network(true);
  for(const answer of extra.answers)await traceWord(page,answer);
  const extraStored=await page.evaluate(key=>({finished:currentGame.finished,found:currentGame.found.length,progress:getState().inProgress[key],queued:getQueue().filter(row=>row.challengeKey===key),completed:getState().completed[key]}),extra.key);
  assert.equal(extraStored.finished,false);assert.equal(extraStored.found,extra.answers.length);
  assert.equal(extraStored.progress.found.length,extra.answers.length);assert.deepEqual(extraStored.queued,[]);assert.equal(extraStored.completed,undefined);
  check('Connection loss on Extra keeps the final word safely in progress',{puzzleId:extra.id,found:extraStored.found,queued:0});
  await network(false);
  await poll(async()=>{
    const value=await json('/__fixture/state');
    return value.requests.filter(r=>r.path==='/api/play-session').length>=2;
  });
  await page.waitForTimeout(1000);
  const refused=await page.evaluate(key=>({finished:currentGame.finished,found:getState().inProgress[key]?.found.length,queued:getQueue().length}),extra.key);
  assert.equal(refused.finished,false);assert.equal(refused.found,extra.answers.length);assert.equal(refused.queued,0);
  check('Reachable network without a server finish receipt never completes Extra',refused);
  await json('/__fixture/extra',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,rejectFinish:false})});
  await network(true);await network(false);
  await page.waitForFunction(()=>currentGame?.mode==='daily_special'&&currentGame.finished&&getQueue().length===0,null,{timeout:30000});
  await poll(async()=>!!(await json('/__fixture/state')).ledgers['fixture-a'].results[extra.id]);
  state=await json('/__fixture/state');assert.equal(state.ledgers['fixture-a'].points,680);
  assert.equal(state.ledgers['fixture-a'].posts.filter(p=>p.puzzle_id===extra.id).length,1);
  check('Reconnect completes the interrupted Extra once',{rows:Object.keys(state.ledgers['fixture-a'].results).length,points:680});
  await page.screenshot({path:path.join(evidence,'03-online-synchronised.png'),fullPage:true});
  report.finalLedgers=state.ledgers;report.ok=true;
}

main().catch(async error=>{
  report.ok=false;report.error=error.stack;console.error(error);process.exitCode=1;
  const page=context?.pages()?.[0];
  if(page){
    try{report.failureState=await page.evaluate(()=>({offline:!navigator.onLine,status:window.PropletOffline?.getState?.(),body:document.body.innerText.slice(0,12000),sw:!!navigator.serviceWorker.controller,queue:typeof getQueue==='function'?getQueue():null}))}catch{}
    try{await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true})}catch{}
  }
}).finally(async()=>{
  if(context)await context.close();if(server)server.kill('SIGTERM');
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(evidence,'server.log'),serverOutput);
  console.log('Evidence:',evidence);
});
