/* Normal full-app integration, separate headless profile, actual pointer input.
 * Invoke only after the mandatory Browser runtime attempt and an authorized
 * isolated fallback. No API route is fulfilled by this test; unsafe requests
 * are aborted, recorded, and fail the test. No user profile or auth is read.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
assert(args.includes('--approved-isolated-fallback'),'Read Browser skill, try its runtime, and obtain fallback authorization before invoking this script.');
const target=new URL(option('--url','http://127.0.0.1:8765/'));
const productionHosts=new Set(['proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
const fontHosts=new Set(['fonts.googleapis.com','fonts.gstatic.com']);
assert(!productionHosts.has(target.hostname),'Production targets are forbidden.');
assert(['localhost','127.0.0.1','[::1]'].includes(target.hostname)||(target.protocol==='https:'&&target.hostname.endsWith('.vercel.app')),'Only explicit isolated loopback or Vercel preview targets are supported.');
assert(!target.username&&!target.password,'Authentication credentials are forbidden.');
const output=path.resolve(option('--output',path.join(root,'work/mk100-integrated-browser')));
assert(output.startsWith(path.join(root,'work')+path.sep),'Evidence must stay in this repository work/ directory.');
const executablePath=option('--chromium',process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const sourceBank=JSON.parse(fs.readFileSync(path.join(root,'content/gen6/mozkokalypsa-100/bank.json'),'utf8'));
const sourceDB=JSON.parse(fs.readFileSync(path.join(root,'public/puzzles.json'),'utf8'));
const representativePath=option('--representative-path','?review=12');
const representativeIds=sourceBank.boards.filter(b=>Number(b.meta.level)<=11||Number(b.meta.level)===20).map(b=>b.id);
const report={status:'RUNNING',target:target.href,bankContentHash:sourceBank.contentHash,
  browserSurface:'headless installed Chromium / new separate test contexts',preferredBrowserUnavailable:true,
  physicalDeviceTested:false,checks:[],emulations:[],screenshots:[],gating:[],pointerCompletions:[],
  requests:[],fontRequests:[],blockedRequests:[],pageErrors:[],consoleErrors:[],serviceWorkerRequests:[],startedAt:new Date().toISOString()};
fs.mkdirSync(output,{recursive:true});
const signature=b=>JSON.stringify({id:b.id,rows:b.rows,cols:b.cols,mask:b.mask,letters:b.letters,lengths:b.lengths,answers:b.answers});
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const mark=name=>{report.checks.push(name);process.stdout.write(name+'\n')};

async function main(){
  const browser=await chromium.launch({headless:true,executablePath});
  report.browserVersion=browser.version();
  let activePage;
  const touchPages=new WeakSet();
  async function contextFor({width=1440,height=1080,touch=false,name='desktop',completed=0,remembered=false}={}){
    const context=await browser.newContext({viewport:{width,height},screen:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const readonlyNativeFont=url.protocol==='https:'&&fontHosts.has(url.hostname)&&['stylesheet','font'].includes(req.resourceType())&&req.method()==='GET';
      if(readonlyNativeFont)report.fontRequests.push({method:req.method(),url:req.url(),type:req.resourceType(),context:name});
      if(!['GET','HEAD'].includes(req.method())||(url.origin!==target.origin&&!readonlyNativeFont)||url.pathname.startsWith('/api/')||url.pathname==='/sw.js'){
        report.blockedRequests.push({method:req.method(),url:req.url(),type:req.resourceType(),context:name});
        if(url.pathname==='/sw.js')report.serviceWorkerRequests.push(req.url());
        await route.abort('blockedbyclient');return;
      }
      await route.continue();
    });
    const page=await context.newPage();activePage=page;page.setDefaultTimeout(15000);
    if(touch)touchPages.add(page);
    page.on('pageerror',error=>report.pageErrors.push({context:name,message:String(error)}));
    page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({context:name,text:message.text()})});
    page.on('request',req=>report.requests.push({context:name,method:req.method(),url:req.url(),type:req.resourceType()}));
    report.emulations.push({name,width,height,isMobile:touch,hasTouch:touch,input:touch?'CDP touch':'mouse',theme:'light',syntheticHardcoreCompletions:completed,remembered});
    const freshTarget=new URL(target.href);
    if(completed===0)freshTarget.searchParams.set('previewPlayer','new');
    else freshTarget.searchParams.set('previewHC',String(completed));
    await page.goto(freshTarget.href,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB?.free?.mozkokalypsa?.length===100&&document.querySelector('#quickPlayGrid [data-home-free="mozkokalypsa"]'));
    const marker=await page.evaluate(()=>({integrated:window.PROPLET_RUNTIME_META?.mk100IntegratedPreview===true,globalFlag:window.PROPLET_MK100_INTEGRATED_PREVIEW===true,environment:window.PROPLET_RUNTIME_ENV,qa:typeof MOZKOMOR_QA_PREVIEW!=='undefined'&&MOZKOMOR_QA_PREVIEW,gen4:typeof GEN4_CANDIDATE_PREVIEW!=='undefined'&&GEN4_CANDIDATE_PREVIEW,gen5:typeof GEN5_CANDIDATE_PREVIEW!=='undefined'&&GEN5_CANDIDATE_PREVIEW}));
    assert.equal(marker.integrated,true,'Explicit integrated preview marker missing.');assert.equal(marker.globalFlag,true);assert.equal(marker.environment,'preview');
    assert.equal(marker.qa,false,'Preview must preserve Mozkomor gating.');assert.equal(marker.gen4,false);assert.equal(marker.gen5,false);
    const isolation=await page.evaluate(()=>({prefix:window.PROPLET_MK100_PREVIEW?.storagePrefix,count:window.PROPLET_MK100_PREVIEW?.initialHardcoreCount,bankHash:window.PROPLET_MK100_PREVIEW?.bankHash,fixtureOnly:window.PROPLET_MK100_PREVIEW?.fixtureOnly,actual:localFreeSlotState('hardcore').actual.size}));
    assert.match(isolation.prefix,/^proplet-mk100-preview:/);assert.equal(isolation.count,completed);assert.equal(isolation.actual,completed);assert.equal(isolation.bankHash,sourceBank.contentHash);assert.equal(isolation.fixtureOnly,true);
    // Only namespaced local keys of this new test profile are changed.
    // The preview fixture supplies ordinary completions, never an unlock flag.
    await page.evaluate(remembered=>{
      localStorage.setItem('proplet-v3-settings',JSON.stringify({sound:false,haptics:false,wakeLock:false,magnifier:true,theme:'light'}));
      localStorage.setItem('proplet-v3-16-2-helper-mode','none');
      localStorage.setItem('proplet-v3-5-account-nudge',JSON.stringify({shown:[1,2,3,4,5]}));
      localStorage.setItem('proplet-v4-01-4-progress-guard',JSON.stringify({lastShownAt:new Date().toISOString()}));
      if(remembered)localStorage.setItem('proplet-v4-01-32-mozkomor-unlocked:guest','1');
    },remembered);
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof puzzleDB!=='undefined'&&puzzleDB?.free?.mozkokalypsa?.length===100);
    assert.equal(await page.locator('#screen-daily.active').count(),1);
    assert.equal(await page.locator('#mkHubModal:not(.hidden), #mkResultModal:not(.hidden)').count(),0,'Pilot playtest UI must not activate.');
    return {context,page,cdp:touch?await context.newCDPSession(page):null};
  }
  async function click(page,selector,cdp){const item=page.locator(selector);if(cdp)await item.tap();else await item.click()}
  async function nav(page,screen,cdp){await click(page,`.bottom-nav [data-nav="${screen}"]`,cdp);await page.locator(`#screen-${screen}.active`).waitFor()}
  async function screenshot(page,name){
    // Chromium154 resets touch emulation during fullPage capture. Keep the
    // true mobile viewport and capture additional scroll positions instead.
    await page.screenshot({path:path.join(output,name),fullPage:!touchPages.has(page)});report.screenshots.push(name);
    if(touchPages.has(page))assert(await page.evaluate(()=>navigator.maxTouchPoints>0&&matchMedia('(any-pointer: coarse)').matches),'Screenshot must preserve actual touch emulation.');
  }
  async function noOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');}
  async function menuOrder(page,unlocked,cdp){
    await nav(page,'daily',cdp);
    const daily=await page.locator('#quickPlayGrid [data-home-free]').evaluateAll(items=>items.map(x=>x.dataset.homeFree));
    assert.equal(daily.at(-1),'mozkokalypsa');assert.equal(daily.includes('mozkomor'),unlocked);
    if(unlocked)assert.equal(daily.at(-2),'mozkomor');
    await nav(page,'free',cdp);
    const free=await page.locator('#difficultyCards > article[data-diff]').evaluateAll(items=>items.map(x=>x.dataset.diff));
    assert.deepEqual(free,['easy','medium','hard','hardcore','mozkomor','mozkokalypsa']);
    assert.equal(await page.locator('#difficultyCards .cp-locked[data-diff="mozkomor"]').count(),unlocked?0:1);
    assert.equal(await page.locator('#difficultyCards [data-play-free="mozkomor"]').count(),unlocked?1:0);
    assert.equal(await page.locator('#difficultyCards [data-play-free="mozkokalypsa"]').count(),1);
    const total=await page.locator('#difficultyCards [data-diff="mozkokalypsa"] [role="progressbar"]').getAttribute('aria-valuemax');assert.equal(total,'100');
    return {daily,free};
  }
  async function draw(page,route,cdp){
    const points=await page.locator('#board').evaluate((board,route)=>route.map(index=>{const r=board.querySelector(`.cell[data-index="${index}"]`).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1}}),route);
    for(const point of points)assert(point.x>=0&&point.x<=page.viewportSize().width&&point.y>=0&&point.y<=page.viewportSize().height,'Word path must be visible in the viewport.');
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});for(const p of points.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
    else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await page.mouse.up()}
  }
  async function start(page,source,cdp){
    await nav(page,source==='daily'?'daily':'free',cdp);
    await click(page,source==='daily'?'#quickPlayGrid [data-home-free="mozkokalypsa"]':'#difficultyCards [data-play-free="mozkokalypsa"]',cdp);
    await page.waitForFunction(()=>currentGame?.mode==='free'&&currentGame?.puzzle?.difficulty==='mozkokalypsa'&&currentScreen==='game');
    await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length===100);
    assert.match(await page.locator('#gameModeLabel').innerText(),/Volná hra/);
    assert.match(await page.locator('#gameDifficulty').innerText(),/Mozkokalypsa/);
    assert.equal(await page.locator('#mkHubModal:not(.hidden), #mkResultModal:not(.hidden)').count(),0);
    await noOverflow(page);
  }
  async function finish(page,cdp){
    const answers=await page.evaluate(()=>currentGame.puzzle.answers.filter((a,i)=>!currentGame.found.some(f=>f.answerIndex===i)));
    for(const a of answers){const before=await page.evaluate(()=>currentGame.found.length);await draw(page,a.path,cdp);await page.waitForFunction(before=>currentGame.found.length===before+1,before)}
    await page.locator('#winModal:not(.hidden)').waitFor();
    const result=await page.evaluate(()=>({id:currentGame.puzzle.id,mode:currentGame.mode,found:currentGame.found.length,total:currentGame.puzzle.answers.length,used:currentGame.used.size,finished:currentGame.finished,level:currentGame.puzzle.meta.level}));
    assert.equal(result.mode,'free');assert.equal(result.found,result.total);assert.equal(result.used,100);assert.equal(result.finished,true);
    assert.equal(await page.locator('#board .cell.used').count(),100);report.pointerCompletions.push(result);return result;
  }
  async function sideWord(page){
    const route=[35,34,33,23],before=await page.evaluate(()=>({id:currentGame.puzzle.id,points:effectiveStats().points}));
    assert.equal(before.id,'mk100-v2-001');assert.equal(await page.evaluate(route=>route.map(i=>currentGame.puzzle.letters[i]).join(''),route),'AKCI');
    await draw(page,route);
    await page.waitForFunction(()=>document.querySelector('#gameMessage').textContent.includes('AKCI')&&document.querySelector('#gameMessage').textContent.includes('+1 XP'));
    const after=await page.evaluate(()=>({found:currentGame.found.length,used:currentGame.used.size,finished:currentGame.finished,bonusXp:currentGame.wordDiscoveryXpAwarded,points:effectiveStats().points,message:document.querySelector('#gameMessage').textContent,localEntries:Object.values(JSON.parse(localStorage.getItem('proplet-v4-word-discovery-v1:guest')||'{}').entries||{}).filter(r=>r.word==='AKCI')}));
    assert.equal(after.found,0);assert.equal(after.used,0);assert.equal(after.finished,false);assert.equal(after.bonusXp,1);assert.equal(after.points-before.points,1);assert.equal(after.localEntries.length,1);assert.equal(after.localEntries[0].status,'local');
    report.sideWord={word:'AKCI',path:route,board:before.id,found:after.found,used:after.used,finished:after.finished,bonusXp:after.bonusXp,localPointsDelta:after.points-before.points,message:after.message,localStatus:after.localEntries[0].status};
    mark('native-side-word-AKCI-recognized-local-1XP-zero-target-coverage');
  }
  try{
    if(args.includes('--bonus-only')){
      const {context,page}=await contextFor({name:'desktop-sideword',completed:200});await start(page,'daily');await sideWord(page);await screenshot(page,'desktop-sideword.png');await context.close();
      assert.equal(report.blockedRequests.length,0);assert.equal(report.pageErrors.length,0);assert.equal(report.consoleErrors.length,0);mark('zero-server-writes-zero-production-origins-zero-serviceworker-zero-errors');report.status='PASS';return;
    }
    const {context:emptyContext,page:empty}=await contextFor({name:'gate-0'});
    assert(await empty.evaluate(()=>sortedFreeBank('hardcore').length>=200));
    const integrated=await empty.evaluate(()=>({boards:sortedFreeBank('mozkokalypsa'),diffKeys:Object.keys(DIFF),banks:Object.fromEntries(['easy','medium','hard','hardcore','mozkomor'].map(key=>[key,sortedFreeBank(key)]))}));
    assert.equal(integrated.boards.length,100);assert.equal(integrated.diffKeys.at(-1),'mozkokalypsa');
    const profiles={};for(let i=0;i<100;i++){const actual=integrated.boards[i],expected=sourceBank.boards[i];assert.equal(signature(actual),signature(expected),`Integrated board ${i+1} changed`);assert.equal(actual.difficulty,'mozkokalypsa');assert.equal(Number(actual.meta.level),i+1);profiles[actual.meta.profile]=(profiles[actual.meta.profile]||0)+1}
    assert.deepEqual(Object.values(profiles).sort((a,b)=>a-b),[5,15,20,60]);report.integratedBoardSignaturesSha256=hash(integrated.boards.map(signature));report.profiles=profiles;
    for(const diff of ['easy','medium','hard','hardcore','mozkomor']){const lookup=new Map(integrated.banks[diff].map(b=>[b.id,b]));for(const original of sourceDB.free[diff]||[])assert.equal(signature(lookup.get(original.id)),signature(original),`Existing ${diff} ${original.id} changed`)}
    mark('all-100-native-free-bank-identity-geometry-order-profiles-existing-banks-preserved');
    report.gating.push({completions:0,unlocked:false,...await menuOrder(empty,false)});
    await emptyContext.close();
    for(const [completed,remembered,expected] of [[199,false,false],[200,false,true],[0,true,true]]){
      const {context,page}=await contextFor({name:`gate-${completed}${remembered?'-remembered':''}`,completed,remembered});
      const order=await menuOrder(page,expected);report.gating.push({completions:completed,remembered,unlocked:expected,...order});
      if(!expected){const progress=page.locator('#difficultyCards [data-diff="mozkomor"] [role="progressbar"]');assert.equal(await progress.getAttribute('aria-valuemax'),'200');assert.equal(await progress.getAttribute('aria-valuenow'),String(completed))}
      await context.close();
    }
    mark('normal-Mozkomor-gate-0-199-200-remembered-no-QA-bypass');
    for(const [name,width,height,touch] of [['desktop',1440,1080,false],['phone',390,844,true],['fold',768,1024,true]]){
      const {context,page,cdp}=await contextFor({name,width,height,touch,completed:200});
      await menuOrder(page,true,cdp);if(touch)await page.locator('#difficultyCards [data-diff="mozkokalypsa"]').scrollIntoViewIfNeeded();await screenshot(page,`${name}-hrat.png`);await noOverflow(page);
      await nav(page,'daily',cdp);await screenshot(page,`${name}-dnes.png`);if(touch){await page.locator('#quickPlayGrid [data-home-free="mozkokalypsa"]').scrollIntoViewIfNeeded();await screenshot(page,`${name}-dnes-last-cards.png`)}await noOverflow(page);
      await start(page,'daily',cdp);
      if(name==='desktop')await sideWord(page);
      const first=await page.evaluate(()=>currentGame.puzzle.answers[0]);await draw(page,first.path,cdp);await page.waitForFunction(()=>currentGame.found.length===1);
      assert.equal(await page.locator('#board .cell.used').count(),first.path.length);
      const before=await page.evaluate(()=>currentGame.moves);await draw(page,[first.path[0]],cdp);assert.equal(await page.evaluate(()=>currentGame.moves),before);
      await click(page,'#hintBtn',cdp);await click(page,'#hintModal .hint-choice[data-hint-level="1"]',cdp);await page.waitForFunction(()=>currentGame.hints===1);
      if(touch){
        const loupeVisible=await page.locator('#magnifierQuickBtn').isVisible();
        if(!loupeVisible){report.magnifierDiagnostics=await page.evaluate(()=>{const parents=[];let element=document.querySelector('#magnifierQuickBtn');for(let e=element;e;e=e.parentElement){const s=getComputedStyle(e),r=e.getBoundingClientRect();parents.push({tag:e.tagName,id:e.id,className:e.className,display:s.display,visibility:s.visibility,inert:e.inert,rect:{x:r.x,y:r.y,width:r.width,height:r.height}})}return {width:innerWidth,visualWidth:visualViewport.width,touch:navigator.maxTouchPoints,coarse:matchMedia('(any-pointer: coarse)').matches,difficulty:currentGame.puzzle.difficulty,finished:currentGame.finished,available:touchMagnifierAvailable(),device:touchMagnifierDeviceSupported(),parents}});process.stdout.write(JSON.stringify(report.magnifierDiagnostics)+'\n')}
        assert(loupeVisible);await click(page,'#magnifierQuickBtn',cdp);assert.equal(await page.locator('#magnifierQuickBtn').getAttribute('aria-pressed'),'false');await click(page,'#magnifierQuickBtn',cdp);assert.equal(await page.locator('#magnifierQuickBtn').getAttribute('aria-pressed'),'true');
      }
      await screenshot(page,`${name}-game.png`);
      report.emulations.find(x=>x.name===name).gameLayoutDuringPlay=await page.evaluate(()=>document.documentElement.dataset.gameLayoutMode||null);
      await page.reload({waitUntil:'networkidle'});await start(page,'free',cdp);assert.equal(await page.evaluate(()=>currentGame.found.length),1);assert.equal(await page.evaluate(()=>currentGame.hints),1);
      const result=await finish(page,cdp);await screenshot(page,`${name}-win.png`);
      assert.equal(await page.evaluate(()=>getQueue().length),0,'Integrated preview must not enqueue normal server results.');
      await click(page,'#winPrimaryBtn',cdp);await page.waitForFunction(previous=>currentGame?.puzzle.id!==previous&&currentGame?.mode==='free'&&!currentGame.finished,result.id);assert.equal(await page.evaluate(()=>Number(currentGame.puzzle.meta.level)),2);
      await click(page,'#backFromGame',cdp);await page.locator('#screen-free.active').waitFor();
      await click(page,'#difficultyCards [data-played-levels="mozkokalypsa"]',cdp);await page.locator('#playedLevelsModal:not(.hidden)').waitFor();assert.equal(await page.locator(`#playedLevelsList [data-level-puzzle="${result.id}"]`).count(),1);await click(page,'#closePlayedLevelsModal',cdp);
      if(args.includes('--all')&&name==='desktop'){
        await start(page,'free');for(let n=2;n<=100;n++){const completed=await finish(page);assert.equal(completed.level,n);if(n<100){await click(page,'#winPrimaryBtn');await page.waitForFunction(n=>!currentGame.finished&&Number(currentGame.puzzle.meta.level)===n,n+1)}if(n%10===0)process.stdout.write(`Native full-app mouse completions ${n}/100\n`)}
        await click(page,'#winMenuBtn');await page.locator('#screen-free.active').waitFor();assert.equal(await page.locator('#difficultyCards [data-diff="mozkokalypsa"] [role="progressbar"]').getAttribute('aria-valuenow'),'100');mark('all-100-full-app-native-mouse-completions');
      }
      mark(`${name}-Dnes-Hrat-actual-${touch?'touch':'mouse'}-hint-reload-win-next-local-history`);
      report.emulations.find(x=>x.name===name).layoutAfterReturningToMenu=await page.evaluate(()=>document.documentElement.dataset.gameLayoutMode||null);
      report.emulations.find(x=>x.name===name).screenshotCapture=touch?'viewport with separate last-card scroll capture':'full page';
      await context.close();
    }
    const {context,page}=await contextFor({name:'representative-link',completed:200});
    const link=page.locator(`a[href*="${representativePath.replace(/^\?/, '')}"]`).first();assert.equal(await link.count(),1,'Full preview must expose its representative twelve link.');await link.click();
    await page.locator('[data-mk100-board]').first().waitFor();assert.equal(await page.locator('[data-mk100-board]').count(),12);
    const ids=await page.locator('[data-mk100-board]').evaluateAll(items=>items.map(x=>`mk100-v2-${String(x.dataset.mk100Board).padStart(3,'0')}`));
    assert.deepEqual(ids,representativeIds);
    assert.equal(await page.evaluate(()=>puzzleDB.free.mozkokalypsa.length),100);
    await page.locator('[data-mk100-board="20"]').click();await page.waitForFunction(()=>currentGame?.puzzle?.id==='mk100-v2-020'&&currentGame.mode==='free');
    assert.equal(signature(await page.evaluate(()=>currentGame.puzzle)),signature(sourceBank.boards[19]));
    report.representative={url:page.url(),count:12,ids,directBoard:'mk100-v2-020'};mark('full-app-link-to-representative-twelve-normal-native-board20');await context.close();
    assert.equal(report.blockedRequests.length,0,'Bootstrap attempted a forbidden network operation.');assert.equal(report.pageErrors.length,0);assert.equal(report.serviceWorkerRequests.length,0);assert.equal(report.consoleErrors.length,0);
    mark('zero-server-writes-zero-production-origins-zero-serviceworker-zero-errors');report.status='PASS';
  }catch(error){report.status='FAIL';report.failure=error.stack;try{if(activePage&&!activePage.isClosed())await screenshot(activePage,'failure.png')}catch{};throw error}
  finally{report.finishedAt=new Date().toISOString();await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({status:report.status,output,checks:report.checks})+'\n')}
}
main().catch(error=>{process.stderr.write(error.stack+'\n');process.exitCode=1});
