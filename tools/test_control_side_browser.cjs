'use strict';
// Real application, real pointer gestures, isolated guest fixtures. No production requests.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright'));
const root=path.resolve(__dirname,'..'),base=process.env.TEST_URL||'http://127.0.0.1:8879';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'loopback required');
const errors=[],checks=[];let server,browser;
const artifacts=path.join(root,'artifacts/control-side');fs.mkdirSync(artifacts,{recursive:true});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
const ready=async page=>{
 await page.waitForFunction(()=>window.__sideBootReady===true&&typeof puzzleDB!=='undefined'&&puzzleDB?.free?.hard?.[0]&&document.querySelector('#gameSideToggle'));
 // Real users cannot start a game until the final shell is visible.
 await page.locator('#propletBootScreen').waitFor({state:'detached'});
};
async function gesture(page,points,duringDrag){
  const touch=await page.evaluate(()=>navigator.maxTouchPoints>0);
  const cdp=touch?await page.context().newCDPSession(page):null;
  try{
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();}
    assert(await page.evaluate(()=>currentGame.dragging),'pointerdown must reach a playable cell');
    if(duringDrag)await duringDrag();
    for(const p of points.slice(1)){
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});
      else await page.mouse.move(p.x,p.y,{steps:5});
      await page.waitForTimeout(40);
    }
  }finally{
    if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
    else await page.mouse.up();
  }
}
async function start(page,mode='free',puzzleId=null){
  await page.evaluate(async ({mode,puzzleId})=>{
    if(typeof closeOnboarding==='function')closeOnboarding(true);
    window.PropletRefreshRelease?.close();window.PropletContentRelease?.close();
    document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));
    document.querySelector('.release-notes-v3331-backdrop')?.remove();
    const puzzle=puzzleId?Object.values(puzzleDB.free).flat().find(p=>p.id===puzzleId):mode==='tajenka'?window.__sideTajenka:puzzleDB.free.hard[0];
    if(!puzzle)throw new Error('Missing fixture board '+puzzleId);
    await startGame(puzzle,mode,null);
    if(mode==='tajenka')closeTajenkaRules();
  },{mode,puzzleId});
  await page.waitForFunction(()=>document.body.classList.contains('playing')&&document.querySelectorAll('#board .cell').length>0);
  await settle(page);
}
async function geometry(page,left){
  const g=await page.evaluate(()=>{
    const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    return {board:rect('.game-board-column'),rail:rect('.game-control-column'),toggle:rect('#gameSideToggle'),stage:rect('#boardStage'),w:innerWidth,h:innerHeight,dir:getComputedStyle(document.querySelector('#board')).direction,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert(left?g.rail.right<=g.board.x:g.board.right<=g.rail.x,JSON.stringify(g));
  assert.equal(g.dir,'ltr');assert(g.overflow<=1,JSON.stringify(g));
  assert(g.toggle.y>=g.rail.y-1&&g.toggle.bottom<=g.h+1&&g.stage.height>80,JSON.stringify(g));
  return g;
}
async function dragNext(page){
  await settle(page);
  const before=await page.evaluate(()=>currentGame.found.length);
  const points=await page.evaluate(()=>currentGame.puzzle.answers.find((a,i)=>!currentGame.found.some(f=>f.answerIndex===i)).path.map(i=>{
    const r=document.querySelector(`.cell[data-index="${i}"]`).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
  }));
  await gesture(page,points);await page.waitForFunction(n=>currentGame.found.length===n+1,before);
  await settle(page);
  assert(await page.locator('#pathLayer .path-found').count()>0,'found path drawn');
}
async function swapPreserving(page,left){
  await page.evaluate(()=>{
    window.__sideState=JSON.stringify({found:currentGame.found,path:currentGame.path,moves:currentGame.moves,hints:currentGame.hints,id:currentGame.puzzle.id});
    window.__sideGame=currentGame;
    window.__sideNodes=['#board','#pathLayer','#currentWord','#tajenkaPhrase','.game-control-column'].map(s=>[s,document.querySelector(s)]);
  });
  await page.locator('#gameSideToggle').click();await settle(page);
  assert(await page.evaluate(()=>window.__sideGame===currentGame&&window.__sideNodes.every(([s,node])=>node===document.querySelector(s))&&window.__sideState===JSON.stringify({found:currentGame.found,path:currentGame.path,moves:currentGame.moves,hints:currentGame.hints,id:currentGame.puzzle.id})),'swap preserves game and live DOM nodes');
  await geometry(page,left);
  await page.screenshot({path:path.join(artifacts,`${page.viewportSize().width}-${await page.evaluate(()=>currentGame.mode)}-${left?'left':'right'}.png`)});
}
async function boot(context){
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const req=route.request();if(new URL(req.url()).origin!==new URL(base).origin)return route.abort();
    if(!['GET','HEAD'].includes(req.method()))return route.fulfill({status:503,contentType:'application/json',body:'{"detail":"isolated test: writes disabled"}'});
    return route.continue();
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await ready(page);
  await page.evaluate(p=>window.__sideTajenka=p,JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/browser/tajenka.json'),'utf8')));
  return page;
}
async function context(options){
  const ctx=await browser.newContext({...options,serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{
    // puzzleDB is assigned before boot awaits content and installs pointer listeners.
    // Do not start a synthetic game until the application's actual ready event.
    document.addEventListener('proplet:ready',()=>{window.__sideBootReady=true},{once:true});
    localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
    localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');sessionStorage.setItem('proplet-gen4-release-modal-v1','1');
    for(const key of ['g5-r1','mk100-v2','refresh300-v1'])localStorage.setItem('proplet:content-release:'+key,'1');
    localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  });return ctx;
}
(async()=>{
  if(!process.env.TEST_URL){
    server=spawn(process.execPath,[path.join(__dirname,'browser_fixture_server.cjs')],{cwd:root,env:{...process.env,PORT:new URL(base).port},stdio:['ignore','pipe','inherit']});
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('fixture exited '+code)))});
  }
  const health=await fetch(base+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&health.database===false,'isolated static fixture required');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  const ctx=await context({viewport:{width:768,height:1000},screen:{width:768,height:1000},hasTouch:true});
  const page=await boot(ctx);await start(page);await geometry(page,false);await dragNext(page);
  await swapPreserving(page,true);await dragNext(page);checks.push('actual word gestures before and after swap; game and DOM identity preserved');
  // A second pointer / keyboard activation must not move a board during a gesture.
  const cell=await page.locator('#board .cell:not(.used)').first().boundingBox();
  await gesture(page,[{x:cell.x+cell.width/2,y:cell.y+cell.height/2}],async()=>{
    await page.evaluate(()=>document.querySelector('#gameSideToggle').click());await geometry(page,true);
  });
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  await start(page);await geometry(page,true);checks.push('preference survives reload; gesture guard');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!document.body.classList.contains('game-tablet-landscape'));
  assert.equal(await page.locator('#gameSideToggle').isVisible(),false);assert.equal(await page.locator('.game-main').evaluate(el=>el.classList.contains('game-controls-left')),false);
  await page.setViewportSize({width:768,height:1000});await page.waitForFunction(()=>document.body.classList.contains('game-tablet-landscape'));await settle(page);await geometry(page,true);checks.push('phone hides switch, unfolding restores preference');
  // Fold training uses one column even though its device class still says rail.
  await page.evaluate(()=>startStarter());
  await page.waitForFunction(()=>currentGame?.mode==='starter'&&document.querySelector('#screen-game').classList.contains('starter-mode'));
  await settle(page);
  const stacked=await page.evaluate(()=>{
    const board=document.querySelector('.board-stage').getBoundingClientRect(),actions=document.querySelector('.game-actions').getBoundingClientRect();
    return {tablet:document.body.classList.contains('game-tablet-landscape'),boardBottom:board.bottom,actionsTop:actions.top,side:localStorage.getItem('proplet-game-control-side')};
  });
  assert(stacked.tablet&&stacked.actionsTop>=stacked.boardBottom-1,'fixture must exercise stacked Fold training');
  assert.equal(await page.locator('#gameSideToggle').isVisible(),false);
  assert.equal(await page.locator('.game-main').evaluate(el=>el.classList.contains('game-controls-left')),false);
  await page.evaluate(()=>document.querySelector('#gameSideToggle').click());
  assert.equal(await page.evaluate(()=>localStorage.getItem('proplet-game-control-side')),stacked.side,'hidden toggle cannot change saved preference');
  await start(page);await geometry(page,true);checks.push('stacked Fold training hides/disables swap; normal rail restores saved side');
  await page.evaluate(p=>window.__sideTajenka=p,JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/browser/tajenka.json'),'utf8')));
  await start(page,'tajenka');await geometry(page,true);await dragNext(page);await swapPreserving(page,false);
  assert(await page.evaluate(()=>document.querySelector('#tajenkaPhrase').previousElementSibling===document.querySelector('.current-word')),'Tajenka phrase remains below current word');checks.push('Tajenka drag and live phrase placement');
  // A pending sync notification must not consume board height after folding
  // or rotating, and must remain visible again outside gameplay.
  await start(page,'free','g4-z-072');
  assert.equal(await page.evaluate(()=>currentGame.puzzle.meta.geometryProfile),'gen4-mozkomor-endgame-10x10');
  const pendingRecord=await page.evaluate(()=>{
    saveProfile({id:'fold-fixture',token:'synthetic-fold',name:'Synthetic Fold'});
    const row={queueId:'fold-pending',attemptId:'desktop-fold',puzzleId:currentGame.puzzle.id,challengeKey:'free:'+currentGame.puzzle.id,mode:'free',difficulty:currentGame.puzzle.difficulty,elapsedMs:43000,moves:13,completedAt:'2026-10-18T20:31:00Z'};
    saveQueue([row]);renderOfflineStatus();return row;
  });
  let conflictPosts=0,receiptReads=0;
  await page.route('**/api/result',async route=>{
    assert.equal(route.request().headers().authorization,'Bearer synthetic-fold');conflictPosts++;
    await route.fulfill({status:409,json:{detail:'IDEMPOTENCY_CONFLICT'}});
  });
  await page.route('**/api/result-receipt?*',async route=>{
    assert.equal(route.request().headers().authorization,'Bearer synthetic-fold');receiptReads++;
    const query=new URL(route.request().url()).searchParams;assert.equal(query.get('attempt_id'),'desktop-fold');
    await route.fulfill({json:{committed:true,attemptId:'desktop-fold',completed:{...pendingRecord,elapsedMs:42000,completedAt:'2026-10-18T20:30:00Z',points:150}}});
  });
  for(const viewport of [{width:768,height:1000},{width:1000,height:768},{width:800,height:540},{width:768,height:1000}]){
    await page.setViewportSize(viewport);await settle(page);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#offlineConnectionStatus')).display==='none');
    const bounds=await page.locator('#board .cell').evaluateAll(cells=>cells.map(cell=>{const r=cell.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom}}));
    assert(bounds.length>0);assert(bounds.every(r=>r.x>=-1&&r.y>=-1&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1),'all board rows remain inside rotated Fold viewport');
  }
  await page.screenshot({path:path.join(artifacts,'fold-pending-portrait.png')});
  await page.setViewportSize({width:1000,height:768});await settle(page);
  await page.screenshot({path:path.join(artifacts,'fold-pending-landscape.png')});
  await page.evaluate(()=>nav('profile'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#offlineConnectionStatus')).display!=='none');
  assert.match(await page.locator('#offlineConnectionStatus').innerText(),/čeká na odeslání/);
  checks.push('Fold Mozkomor 72 (10×10) pending sync: full last row after portrait/landscape rotation; notification returns outside game');
  const recovery=await page.evaluate(async()=>{
    const result=await resultQueue().sync();renderOfflineStatus();
    return {result,queue:getQueue(),completed:getState().completed,backup:JSON.parse(localStorage.getItem(scopedStorageKey(REJECTED_QUEUE_KEY))||'[]')};
  });
  assert.equal(recovery.result.reconciled,1);assert.equal(recovery.queue.length,0);
  assert.equal(recovery.completed[pendingRecord.challengeKey].elapsedMs,42000);
  assert.equal(recovery.backup[0].elapsedMs,43000);assert.equal(recovery.backup[0].rejectedReason,'ALREADY_COMMITTED');
  assert.equal(conflictPosts,1);assert.equal(receiptReads,1);
  await page.waitForFunction(()=>document.querySelector('#offlineConnectionStatus').hidden);
  checks.push('native app: authenticated desktop/Fold conflict, canonical history and raw backup, empty queue, no resubmit');

  await ctx.close();
  const short=await context({viewport:{width:800,height:540},screen:{width:800,height:540},hasTouch:true}),sp=await boot(short);
  await start(sp,'tajenka');await geometry(sp,false);await swapPreserving(sp,true);checks.push('short landscape tablet Tajenka bounds');await short.close();
  const desktop=await context({viewport:{width:1440,height:900}}),dp=await boot(desktop);await start(dp);await geometry(dp,false);await swapPreserving(dp,true);await dragNext(dp);checks.push('desktop swap and drag');
  await dp.evaluate(()=>startStarter());await dp.waitForFunction(()=>currentGame?.mode==='starter');await settle(dp);
  assert.equal(await dp.locator('#gameSideToggle').isVisible(),true,'side-by-side desktop training retains swap');
  assert(await dp.evaluate(()=>{const b=document.querySelector('.board-stage').getBoundingClientRect(),a=document.querySelector('.game-actions').getBoundingClientRect();return a.right<=b.left+1||b.right<=a.left+1}),'desktop training has actual side-by-side controls');
  checks.push('side-by-side desktop training keeps useful swap');await desktop.close();
  assert.deepEqual(errors,[],'browser errors');console.log(JSON.stringify({passed:true,checks},null,2));
})().catch(async error=>{console.error(error);for(const context of browser?.contexts()||[])for(const page of context.pages()){console.error(await page.evaluate(()=>({body:document.body.className,text:document.body.innerText.slice(-3000)})).catch(()=>null));await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}process.exitCode=1}).finally(async()=>{fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({checks,errors,passed:!process.exitCode},null,2));await browser?.close();server?.kill()});

