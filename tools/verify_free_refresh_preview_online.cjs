/* Native browser verification for the isolated static refresh preview. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=(process.env.FREE_REFRESH_PREVIEW_URL||'http://127.0.0.1:8874').replace(/\/$/,'');
const out=process.env.FREE_REFRESH_QA_OUTPUT||'content/gen6/free-refresh-300/preview-verification';
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],requests=[];
const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw new Error(name)};
function monitor(page){page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('request',r=>requests.push({url:r.url(),method:r.method(),type:r.resourceType()}));page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())})}
const screenshot=(page,name)=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
(async()=>{
  const launch={headless:true};if(process.env.FREE_REFRESH_BROWSER_EXECUTABLE)launch.executablePath=process.env.FREE_REFRESH_BROWSER_EXECUTABLE;
  const browser=await chromium.launch(launch);let coverage=[],bankHash=null,onboarding=[];
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});monitor(page);
    await page.goto(base+'/?review=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('[data-refresh-board]').length===300);
    bankHash=await page.evaluate(()=>PROPLET_FREE_REFRESH_PREVIEW.bankHash);
    check('native startup and 300 catalog entries',await page.evaluate(()=>!!window.PROPLET_FREE_REFRESH_PREVIEW&&!!document.querySelector('#freeRefreshToday')));
    check('route version comes from manifest',await page.evaluate(()=>freeOrder().record('easy').plan.version===PROPLET_SHARED_FREE_ORDER_MANIFEST.version));
    check('prior release does not obscure proposed CTA',await page.evaluate(()=>!document.querySelector('#mk100LaunchPreview:not(.hidden)')));
    await screenshot(page,'desktop');await page.locator('#freeRefreshToday [data-refresh-choose]').click();check('CTA reaches native difficulty selection',await page.locator('#screen-free').isVisible());await screenshot(page,'hub-desktop');
    coverage=await page.evaluate(async()=>{const rows=[];for(const p of PROPLET_FREE_REFRESH_FIXTURES.refreshBoards){await startGame(p,'free',null);rows.push({id:p.id,ok:currentGame?.puzzle?.id===p.id&&document.querySelectorAll('#board .cell').length===p.mask.length})}return rows});
    check('all 300 boards render through native game',coverage.length===300&&coverage.every(r=>r.ok));
    await page.evaluate(()=>{const s=getState();s.completed={};s.inProgress={};saveState(s);currentGame=null});
    for(const diff of ['easy','medium','hard']){
      await page.evaluate(async d=>{await startFree(d)},diff);check('shared route starts '+diff,await page.evaluate(d=>currentGame.puzzle.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][0],diff));
      if(diff==='easy'){
        const route=await page.evaluate(()=>currentGame.puzzle.answers[0].path),first=await page.locator('.cell[data-index="'+route[0]+'"]').boundingBox();
        await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();
        for(const index of route.slice(1)){const box=await page.locator('.cell[data-index="'+index+'"]').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:2})}
        await page.mouse.up();check('native pointer input recognizes target',await page.evaluate(()=>currentGame.found.length===1));
        await page.evaluate(()=>{saveGameProgress();nav('free')});await page.evaluate(async()=>{await startFree('easy')});
        check('resume keeps found word and stable ID',await page.evaluate(()=>currentGame.found.length===1&&currentGame.puzzle.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[0]));
      }
      await page.evaluate(()=>{for(const [i,a]of currentGame.puzzle.answers.entries())if(!currentGame.found.some(f=>f.answerIndex===i)){currentGame.path=[...a.path];submitPath()}});
      await page.waitForFunction(d=>!!getState().completed['free:'+PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][0]],diff);
      check('native completion preserves identity and XP '+diff,await page.evaluate(d=>{const r=getState().completed['free:'+PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][0]];return r.mode==='free'&&r.contentGeneration===4&&r.points===({easy:15,medium:25,hard:50})[d]},diff));
      await page.locator('#winPrimaryBtn').click();await page.waitForFunction(d=>currentGame.puzzle.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][1],diff);check('native next action follows shared route '+diff,true);
      await page.evaluate(()=>{document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));const s=getState();s.inProgress={};saveState(s);nav('free')});
    }
    const beforeReplay=await page.evaluate(()=>({records:JSON.stringify(getState().completed),xp:Object.values(getState().completed).reduce((n,r)=>n+(r.points||0),0)}));
    await page.evaluate(async()=>{const p=puzzleDB.free.easy.find(p=>p.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[0]);await startGame(p,'free',null);for(const a of currentGame.puzzle.answers){currentGame.path=[...a.path];submitPath()}});
    await page.waitForFunction(()=>!document.querySelector('#winModal').classList.contains('hidden')&&currentGame.finished);
    check('replay does not duplicate XP or first result',await page.evaluate(before=>JSON.stringify(getState().completed)===before.records&&Object.values(getState().completed).reduce((n,r)=>n+(r.points||0),0)===before.xp&&currentGame.winBaseXpAwarded===0,beforeReplay));
    await page.evaluate(()=>{document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));const s=getState();s.inProgress={};saveState(s);nav('free')});
    const preserved=await page.evaluate(async()=>{const before=JSON.stringify(getState().completed);await PROPLET_FREE_REFRESH_PREVIEW.controller.change('easy','numeric');const numeric=freeProgress('easy').nextUnsolved.id;await PROPLET_FREE_REFRESH_PREVIEW.controller.change('easy','varied');return {same:before===JSON.stringify(getState().completed),numeric,shared:freeProgress('easy').nextUnsolved.id}});
    check('numeric option and shared default preserve existing results',preserved.same&&preserved.numeric==='g4-e-001'&&preserved.shared===await page.evaluate(()=>PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[1]));
    await page.evaluate(async()=>{const old=puzzleDB.free.easy.find(p=>p.id==='g4-e-001');await startGame(old,'free',null);currentGame.path=[...old.answers[0].path];submitPath();nav('free');await startFree('easy')});
    check('old unfinished game takes priority over new release',await page.evaluate(()=>currentGame.puzzle.id==='g4-e-001'&&currentGame.found.length===1));
    await page.evaluate(()=>{nav('daily');PROPLET_FREE_REFRESH_PREVIEW.showAnnouncement()});await screenshot(page,'announcement-desktop');check('proposed announcement opens manually',await page.locator('#freeRefreshAnnouncement').isVisible());await page.locator('#freeRefreshAnnouncement [data-refresh-close]').first().click();
    for(const width of [320,390]){
      await page.setViewportSize({width,height:673});await page.evaluate(()=>nav('daily'));await screenshot(page,'today-'+width);check('today no horizontal overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>nav('free'));await screenshot(page,'hub-'+width);check('hub no horizontal overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>PROPLET_FREE_REFRESH_PREVIEW.showAnnouncement());await screenshot(page,'announcement-'+width);check('announcement fits viewport '+width,await page.evaluate(()=>{const b=document.querySelector('.refresh-announcement').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight}));await page.locator('#freeRefreshAnnouncement [data-refresh-close]').first().click();
    }
    function bucket(id){let hash=2166136261;for(const char of 'first-board-v1:'+id){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0)%100}
    for(const target of ['control_e001','challenger_e009']){
      let identity;for(let i=0;i<1000;i++){const candidate='free-refresh-review-ab-'+i;if((bucket(candidate)<50?'control_e001':'challenger_e009')===target){identity=candidate;break}}
      const context=await browser.newContext({viewport:{width:390,height:673},reducedMotion:'reduce'}),onboard=await context.newPage();monitor(onboard);
      await onboard.addInitScript(({hash,id})=>localStorage.setItem('proplet-free-refresh-preview:'+hash.slice(0,16)+':hc0:onboarding:proplet-v3-15-anonymous-id',id),{hash:bankHash,id:identity});
      await onboard.goto(base+'/?onboarding=1',{waitUntil:'networkidle'});await screenshot(onboard,'onboarding-'+target);
      check('onboarding starts original 9-cell training '+target,await onboard.evaluate(()=>currentGame.mode==='starter'&&currentGame.puzzle.meta.starterVersion===3&&currentGame.puzzle.mask.length===9));
      await onboard.evaluate(()=>{for(const a of currentGame.puzzle.answers){currentGame.path=[...a.path];submitPath()}});
      await onboard.waitForFunction(()=>document.querySelector('#winTitle').textContent==='Trénink v kapse, odznak čeká!');
      await onboard.locator('#winPrimaryBtn').click();await onboard.waitForFunction(()=>currentGame.mode==='free');
      const assignment=await onboard.evaluate(()=>({assignment:PropletFirstSteps.firstBoardExperiment(),board:currentGame.puzzle.id}));onboarding.push(assignment);
      check('first-board AB identity preserved '+target,assignment.assignment?.variant===target&&assignment.board===({control_e001:'g4-e-001',challenger_e009:'g4-e-009'})[target]);
      await screenshot(onboard,'first-board-'+target);await context.close();
    }
    check('no external or API request reaches network',!requests.some(r=>!r.url.startsWith(base+'/')||new URL(r.url).pathname.startsWith('/api/')));
    check('no console, page or HTTP errors',errors.length===0);
    console.log(JSON.stringify({checks,errors,coverage:coverage.length,bankHash},null,2));
  }catch(error){errors.push(String(error));throw error}
  finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,requests,coverage,onboarding,bankHash,recoverySources:true},null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
