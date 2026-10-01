/* Technical availability smoke in empty headless contexts. Never solve,
 * complete, rate or access a real user's profile. Read Browser skill and try
 * its runtime before using this isolated technical runner. */
'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'), args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
assert(args.includes('--approved-isolated-fallback'),'Read Browser skill, try its runtime and explicitly select isolated technical testing.');
assert(!args.some(a=>['--all','--flows-only','--bonus-only'].includes(a)),'This smoke never solves, rates or completes boards.');
const target=new URL(option('--url','http://127.0.0.1:8866/'));
const productionHosts=new Set(['proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
const fontHosts=new Set(['fonts.googleapis.com','fonts.gstatic.com']);
assert(!productionHosts.has(target.hostname),'Production targets are forbidden.');
assert(['localhost','127.0.0.1','[::1]'].includes(target.hostname)||(target.protocol==='https:'&&target.hostname.endsWith('.vercel.app')),'Only explicit loopback or Vercel preview targets supported.');
assert(!target.username&&!target.password,'Authentication credentials are forbidden.');
const output=path.resolve(option('--output',path.join(root,'work/mk100-ungated-local')));
assert(output.startsWith(path.join(root,'work')+path.sep),'Evidence must stay in repository work/.');
const executablePath=option('--chromium',process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const artworkPath='/difficulty/printshop/mozkokalypsa-v2.svg';
const order=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const report={status:'RUNNING',target:target.href,verificationScope:'availability-only',
  browserSurface:'headless installed Chromium / fresh separate contexts',preferredBrowserRuntimeAttempted:true,
  preferredBrowserRuntimeStatus:'available; required isolated-context/network-guard/touch capabilities missing',
  isolationReason:'The isolated runner provides empty contexts, network interception and touch emulation without reading real cookies.',
  physicalDeviceTested:false,checks:[],emulations:[],availability:[],starts:[],reloads:[],artwork:[],screenshots:[],
  requests:[],fontRequests:[],blockedRequests:[],pageErrors:[],consoleErrors:[],serviceWorkerRequests:[],pointerCompletions:[],startedAt:new Date().toISOString()};
fs.mkdirSync(output,{recursive:true});
const mark=name=>{report.checks.push(name);process.stdout.write(name+'\n')};

async function main(){
  const browser=await chromium.launch({headless:true,executablePath});report.browserVersion=browser.version();
  let activePage;const touchPages=new WeakSet();
  async function zero(page){
    const state=await page.evaluate(()=>({completed:Object.keys(getState().completed||{}).length,
      counts:Object.fromEntries(Object.keys(DIFF).map(diff=>[diff,localFreeSlotState(diff).actual.size])),queue:getQueue().length,authenticated:!!getProfile()?.token}));
    assert.equal(state.completed,0);assert.deepEqual(state.counts,Object.fromEntries(order.map(diff=>[diff,0])));assert.equal(state.queue,0);assert.equal(state.authenticated,false);return state;
  }
  async function ready(page){
    await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB?.free?.mozkokalypsa?.length===100&&document.querySelector('#quickPlayGrid [data-home-free="mozkokalypsa"]'));
    assert.equal(await page.locator('#mkHubModal:not(.hidden), #mkResultModal:not(.hidden)').count(),0,'Playtest/rating UI must never activate.');
  }
  async function contextFor({width,height,touch,name}){
    const context=await browser.newContext({viewport:{width,height},screen:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const font=url.protocol==='https:'&&fontHosts.has(url.hostname)&&['stylesheet','font'].includes(req.resourceType())&&req.method()==='GET';
      if(font)report.fontRequests.push({context:name,method:req.method(),url:req.url(),type:req.resourceType()});
      if(!['GET','HEAD'].includes(req.method())||(url.origin!==target.origin&&!font)||url.pathname.startsWith('/api/')||url.pathname==='/sw.js'){
        report.blockedRequests.push({context:name,method:req.method(),url:req.url(),type:req.resourceType()});if(url.pathname==='/sw.js')report.serviceWorkerRequests.push(req.url());await route.abort('blockedbyclient');return;
      }await route.continue();
    });
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);if(touch)touchPages.add(page);
    page.on('pageerror',error=>report.pageErrors.push({context:name,message:String(error)}));
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({context:name,text:message.text()})});
    page.on('request',req=>report.requests.push({context:name,method:req.method(),url:req.url(),type:req.resourceType()}));
    report.emulations.push({name,width,height,isMobile:touch,hasTouch:touch,input:touch?'Playwright touchscreen tap':'mouse click',theme:'light',syntheticHardcoreCompletions:0,screenshotCapture:touch?'viewport preserving touch emulation':'full page'});
    const fresh=new URL(target.href);for(const key of ['previewHC','board','review','announcement'])fresh.searchParams.delete(key);fresh.searchParams.set('previewPlayer','new');
    await page.goto(fresh.href,{waitUntil:'networkidle'});await ready(page);
    const marker=await page.evaluate(()=>({integrated:window.PROPLET_RUNTIME_META?.mk100IntegratedPreview===true,global:window.PROPLET_MK100_INTEGRATED_PREVIEW===true,environment:window.PROPLET_RUNTIME_ENV,
      qa:typeof MOZKOMOR_QA_PREVIEW!=='undefined'&&MOZKOMOR_QA_PREVIEW,gen4:typeof GEN4_CANDIDATE_PREVIEW!=='undefined'&&GEN4_CANDIDATE_PREVIEW,gen5:typeof GEN5_CANDIDATE_PREVIEW!=='undefined'&&GEN5_CANDIDATE_PREVIEW,
      prefix:window.PROPLET_MK100_PREVIEW?.storagePrefix,count:window.PROPLET_MK100_PREVIEW?.initialHardcoreCount,fixtureOnly:window.PROPLET_MK100_PREVIEW?.fixtureOnly,bankHash:window.PROPLET_MK100_PREVIEW?.bankHash}));
    assert.equal(marker.integrated,true);assert.equal(marker.global,true);assert.equal(marker.environment,'preview');assert.equal(marker.qa,false,'Availability must not depend on a QA bypass.');assert.equal(marker.gen4,false);assert.equal(marker.gen5,false);
    assert.match(marker.prefix,/^proplet-mk100-preview:/);assert.equal(marker.count,0);assert.equal(marker.fixtureOnly,true);report.bankContentHash=marker.bankHash;report.emulations.at(-1).storagePrefix=marker.prefix;await zero(page);
    // Preferences only in this empty namespaced fixture. Never add an unlock flag or progress.
    await page.evaluate(()=>localStorage.setItem('proplet-v3-settings',JSON.stringify({sound:false,haptics:false,wakeLock:false,magnifier:true,theme:'light'})));
    await page.reload({waitUntil:'networkidle'});await ready(page);assert.equal(await page.locator('#screen-daily.active').count(),1);await zero(page);return {context,page};
  }
  async function click(page,selector,touch){const item=page.locator(selector);if(touch)await item.tap();else await item.click()}
  async function nav(page,screen,touch){await click(page,`.bottom-nav [data-nav="${screen}"]`,touch);await page.locator(`#screen-${screen}.active`).waitFor()}
  async function noOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow')}
  async function screenshot(page,name){
    // Chromium154 fullPage capture resets touch emulation; preserve viewport.
    await page.screenshot({path:path.join(output,name),fullPage:!touchPages.has(page)});report.screenshots.push(name);
    if(touchPages.has(page))assert(await page.evaluate(()=>navigator.maxTouchPoints>0&&matchMedia('(any-pointer: coarse)').matches),'Capture must retain touch emulation.');
  }
  async function artwork(page,selector,surface,name){
    const img=page.locator(selector);await img.scrollIntoViewIfNeeded();await page.waitForFunction(selector=>{const img=document.querySelector(selector);return img?.complete&&img.naturalWidth>0},selector);assert(await img.isVisible());
    const rendered=await img.evaluate(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight,renderedWidth:img.getBoundingClientRect().width,renderedHeight:img.getBoundingClientRect().height}));
    assert.equal(new URL(rendered.src).origin,target.origin);assert.equal(new URL(rendered.src).pathname,artworkPath);assert(rendered.renderedWidth>0&&rendered.renderedHeight>0);report.artwork.push({context:name,surface,...rendered});
  }
  async function menu(page,screen,touch,name){
    await nav(page,screen,touch);const rootSelector=screen==='daily'?'#quickPlayGrid':'#difficultyCards';
    const actual=await page.locator(screen==='daily'?'#quickPlayGrid [data-home-free]':'#difficultyCards > article[data-diff]').evaluateAll(items=>items.map(x=>x.dataset.homeFree||x.dataset.diff));assert.deepEqual(actual,order);
    for(const diff of order){const button=page.locator(screen==='daily'?`#quickPlayGrid [data-home-free="${diff}"]`:`#difficultyCards [data-play-free="${diff}"]`);assert.equal(await button.count(),1);assert(await button.isEnabled());assert.notEqual(await button.getAttribute('aria-disabled'),'true')}
    assert.equal(await page.locator(`${rootSelector} .cp-locked, ${rootSelector} .mozkomor-locked`).count(),0);
    await artwork(page,screen==='daily'?'#quickPlayGrid [data-home-free="mozkokalypsa"] img':'#difficultyCards [data-diff="mozkokalypsa"] img',screen==='daily'?'Dnes':'Hrát',name);
    await screenshot(page,`${name}-${screen==='daily'?'dnes':'hrat'}.png`);report.availability.push({context:name,screen,freshCompletions:0,order:actual});await noOverflow(page);
  }
  async function gameState(page,diff){
    await page.waitForFunction(diff=>currentGame?.mode==='free'&&currentGame?.puzzle?.difficulty===diff&&currentScreen==='game',diff);
    // Native mask is a list of active cell indices, including valid index 0.
    await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length===currentGame.puzzle.mask.length);
    assert.match(await page.locator('#gameModeLabel').innerText(),/volná hra/i);assert.equal(await page.locator('#mkHubModal:not(.hidden), #mkResultModal:not(.hidden), #winModal:not(.hidden)').count(),0);
    const state=await page.evaluate(()=>({id:currentGame.puzzle.id,difficulty:currentGame.puzzle.difficulty,mode:currentGame.mode,found:currentGame.found.length,used:currentGame.used.size,moves:currentGame.moves,hints:currentGame.hints,finished:currentGame.finished,attemptId:currentGame.attemptId,rows:currentGame.puzzle.rows,cols:currentGame.puzzle.cols,layout:document.documentElement.dataset.gameLayoutMode||null}));
    assert.equal(state.found,0);assert.equal(state.used,0);assert.equal(state.moves,0);assert.equal(state.hints,0);assert.equal(state.finished,false);await zero(page);await noOverflow(page);return state;
  }
  try{
    for(const [name,width,height,touch] of [['desktop',1440,1080,false],['phone',390,844,true],['fold',768,1024,true]]){
      const {context,page}=await contextFor({name,width,height,touch});await menu(page,'daily',touch,name);await menu(page,'free',touch,name);const firstIds={};
      for(const screen of ['daily','free'])for(const diff of ['mozkomor','mozkokalypsa']){
        await nav(page,screen,touch);await click(page,screen==='daily'?`#quickPlayGrid [data-home-free="${diff}"]`:`#difficultyCards [data-play-free="${diff}"]`,touch);const state=await gameState(page,diff);
        if(firstIds[diff])assert.equal(state.id,firstIds[diff],'Hrát must resume the same empty game.');else firstIds[diff]=state.id;
        report.starts.push({context:name,source:screen==='daily'?'Dnes':'Hrát',...state});
        if(diff==='mozkokalypsa'&&await page.locator('#gameDifficulty img').count())await artwork(page,'#gameDifficulty img','game header',name);
        if(screen==='daily'){
          await screenshot(page,`${name}-${diff}-game.png`);await page.reload({waitUntil:'networkidle'});await ready(page);
          const saved=await page.evaluate(id=>{const r=Object.values(getState().inProgress||{}).find(r=>r.puzzleId===id);return r&&{id:r.puzzleId,found:r.found.length,moves:r.moves,hints:r.hints,attemptId:r.attemptId}},state.id);
          assert(saved,'Reload must retain the locally started empty game.');assert.equal(saved.found,0);assert.equal(saved.moves,0);assert.equal(saved.hints,0);
          await nav(page,'free',touch);await click(page,`#difficultyCards [data-play-free="${diff}"]`,touch);const resumed=await gameState(page,diff);assert.equal(resumed.id,state.id);assert.equal(resumed.attemptId,saved.attemptId);assert.match(await page.locator('#gameMessage').innerText(),/Pokračuješ/);
          report.reloads.push({context:name,difficulty:diff,before:state.id,resumed:resumed.id,found:0,moves:0,hints:0});
        }await click(page,'#backFromGame',touch);await page.locator('#screen-free.active').waitFor();
      }
      assert.equal(await page.locator('a[href*="announcement=mozkokalypsa"]').count(),1);await click(page,'a[href*="announcement=mozkokalypsa"]',touch);await page.locator('#mk100LaunchPreview:not(.hidden)').waitFor();
      await artwork(page,'#mk100LaunchPreview .mk-launch-vortex','announcement',name);await screenshot(page,`${name}-announcement.png`);await click(page,'#mk100LaunchPreview [data-mk-launch-play]',touch);
      const launched=await gameState(page,'mozkokalypsa');assert.equal(launched.id,firstIds.mozkokalypsa);report.starts.push({context:name,source:'announcement primary CTA',...launched});await zero(page);
      report.emulations.find(x=>x.name===name).memoryFixtureRequestCount=await page.evaluate(()=>window.PROPLET_MK100_PREVIEW.requests.length);
      mark(`${name}-fresh-zero-all-six-Dnes-Hrat-native-start-reload-resume-original-artwork`);await context.close();
    }
    assert.equal(report.pointerCompletions.length,0);assert.equal(report.blockedRequests.length,0,'Forbidden actual network operation attempted.');assert.equal(report.pageErrors.length,0);assert.equal(report.serviceWorkerRequests.length,0);assert.equal(report.consoleErrors.length,0);
    mark('zero-solutions-zero-ratings-zero-results-zero-server-writes-zero-production-origins-zero-serviceworker-zero-errors');report.status='PASS';
  }catch(error){report.status='FAIL';report.failure=error.stack;try{if(activePage&&!activePage.isClosed())await screenshot(activePage,'failure.png')}catch{};throw error}
  finally{report.finishedAt=new Date().toISOString();await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({status:report.status,output,checks:report.checks})+'\n')}
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1});
