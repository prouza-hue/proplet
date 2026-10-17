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
const ready=page=>page.waitForFunction(()=>window.__sideBootReady===true&&typeof puzzleDB!=='undefined'&&puzzleDB?.free?.hard?.[0]&&document.querySelector('#gameSideToggle'));
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
async function start(page,mode='free'){
  await page.evaluate(async mode=>{
    if(typeof closeOnboarding==='function')closeOnboarding(true);
    window.PropletRefreshRelease?.close();window.PropletContentRelease?.close();
    document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));
    document.querySelector('.release-notes-v3331-backdrop')?.remove();
    await startGame(mode==='tajenka'?window.__sideTajenka:puzzleDB.free.hard[0],mode,null);
    if(mode==='tajenka')closeTajenkaRules();
  },mode);
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
  await page.evaluate(p=>window.__sideTajenka=p,JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/browser/tajenka.json'),'utf8')));
  await start(page,'tajenka');await geometry(page,true);await dragNext(page);await swapPreserving(page,false);
  assert(await page.evaluate(()=>document.querySelector('#tajenkaPhrase').previousElementSibling===document.querySelector('.current-word')),'Tajenka phrase remains below current word');checks.push('Tajenka drag and live phrase placement');
  await ctx.close();
  const short=await context({viewport:{width:800,height:540},screen:{width:800,height:540},hasTouch:true}),sp=await boot(short);
  await start(sp,'tajenka');await geometry(sp,false);await swapPreserving(sp,true);checks.push('short landscape tablet Tajenka bounds');await short.close();
  const desktop=await context({viewport:{width:1440,height:900}}),dp=await boot(desktop);await start(dp);await geometry(dp,false);await swapPreserving(dp,true);await dragNext(dp);checks.push('desktop swap and drag');await desktop.close();
  assert.deepEqual(errors,[],'browser errors');console.log(JSON.stringify({passed:true,checks},null,2));
})().catch(async error=>{console.error(error);for(const context of browser?.contexts()||[])for(const page of context.pages()){console.error(await page.evaluate(()=>({body:document.body.className,text:document.body.innerText.slice(-3000)})).catch(()=>null));await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(()=>{});}process.exitCode=1}).finally(async()=>{fs.writeFileSync(path.join(artifacts,'report.json'),JSON.stringify({checks,errors,passed:!process.exitCode},null,2));await browser?.close();server?.kill()});
