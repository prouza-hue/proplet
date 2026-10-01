/* Independent loopback Chromium checks. Actual mouse and CDP touch gestures.
 * The Browser skill was consulted first; its runtime reported no available
 * browsers. This uses a new headless test profile, never the user's profile.
 * Supply NODE_PATH for installed Playwright; no runtime test mutation of game.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const output=path.resolve(option('--output',path.join(root,'work/mk100-browser')));
const staticDir=path.resolve(option('--static',path.join(root,'dist-mk100')));
const chromiumPath=option('--chromium',process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const bankSource=fs.readFileSync(path.join(staticDir,'bank.js'),'utf8');
const bank=JSON.parse(bankSource.slice(bankSource.indexOf('=')+1).trim().replace(/;$/,''));
const verificationPath=option('--verification',path.join(root,'content/gen6/mozkokalypsa-100/independent-verification.json'));
const verification=fs.existsSync(verificationPath)?JSON.parse(fs.readFileSync(verificationPath,'utf8')):null;
const report={status:'RUNNING',bankContentHash:bank.contentHash,sourceSha:bank.sourceSha,boards:bank.boards.length,
  browserSurface:'headless installed Chromium / separate test profile',preferredBrowserUnavailable:true,
  physicalDeviceTested:false,emulations:[{name:'desktop',width:1440,height:1080,isMobile:false,hasTouch:false,input:'mouse',theme:'light'}],layoutScreenshots:[],checks:[],completedThroughPointer:[],screenshots:[],errors:[],gameplayRequests:[]};
fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';
  const file=path.resolve(staticDir,'.'+name);
  if(!file.startsWith(staticDir+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:chromiumPath});
  report.browserVersion=browser.version();
  const monitor=page=>{page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(r.method()!=='GET'||['fetch','xhr','websocket'].includes(r.resourceType())||r.url().includes('/api/'))report.gameplayRequests.push({method:r.method(),url:r.url(),type:r.resourceType()})})};
  async function menu(page,set){await page.goto(origin+(set==='representative'?'/?set=representative':''),{waitUntil:'networkidle'});await page.locator('#previewBoards button').first().waitFor();assert.equal(await page.locator('#previewBoards button').count(),set==='representative'?12:bank.boards.length)}
  async function centers(page,route){return page.locator('#board').evaluate((board,route)=>route.map(index=>{const r=board.querySelector(`.cell[data-index="${index}"]`).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1}}),route)}
  async function draw(page,route,cdp){
    const points=await centers(page,route);
    if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});for(const p of points.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
    else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y);await page.mouse.up()}
  }
  async function screenshot(page,name){await page.screenshot({path:path.join(output,name),fullPage:true});report.screenshots.push(name)}
  async function playBoard(page,cdp){
    const answers=await page.evaluate(()=>currentGame.puzzle.answers.filter((a,i)=>!currentGame.found.some(f=>f.answerIndex===i)));
    for(const answer of answers){const before=await page.evaluate(()=>currentGame.found.length);await draw(page,answer.path,cdp);await page.waitForFunction(n=>currentGame.found.length===n+1,before)}
    await page.locator('#finishModal:not(.hidden)').waitFor();
    assert.equal(await page.locator('#board .cell.used').count(),100);
    assert.equal(await page.evaluate(()=>currentGame.used.size),100);
    return await page.evaluate(()=>currentGame.puzzle.id);
  }
  let page;
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
    page=await context.newPage();page.setDefaultTimeout(12000);monitor(page);await menu(page,bank.boards.length===12?'representative':'hundred');
    await screenshot(page,'catalog-desktop.png');
    if(bank.boards.length===100){await page.locator('#catalogRepresentative').click();assert.equal(await page.locator('#previewBoards button').count(),12);await page.locator('#catalogHundred').click();assert.equal(await page.locator('#previewBoards button').count(),100);report.checks.push('catalog-switch-100-12-100')}
    await page.locator('#previewBoards button').first().click();await page.locator('#board .cell').first().waitFor();
    // Independently enumerated side word is submitted before any cells are used.
    const firstId=await page.evaluate(()=>currentGame.puzzle.id);
    const bonusRow=(verification?.boards||[]).find(b=>b.id===firstId);
    const bonus=bonusRow?.bonusRecognition?.words?.find(w=>w.samplePath?.length>=4);
    if(bank.boards.length===100)assert(bonus,'Final browser test requires an independently enumerated side word on board one');
    if(bonus){assert.equal(bonusRow.contentHash,bank.boards.find(b=>b.id===firstId).meta.contentHash);report.sideWordInventorySource={file:path.basename(verificationPath),sha256:crypto.createHash('sha256').update(fs.readFileSync(verificationPath)).digest('hex'),boardContentHash:bonusRow.contentHash};await draw(page,bonus.samplePath);await page.waitForFunction(()=>currentGame.moves===1);assert.equal(await page.evaluate(()=>currentGame.found.length),0);assert.equal(await page.locator('#board .cell.used').count(),0);assert.match(await page.locator('#gameMessage').innerText(),/platné slovo navíc/);await page.waitForTimeout(250);report.bonusSubmitted={word:bonus.word,path:bonus.samplePath};report.checks.push('valid-side-word-retained-zero-coverage-zero-XP')}
    const first=await page.evaluate(()=>currentGame.puzzle.answers[0]);await draw(page,first.path);await page.waitForFunction(()=>currentGame.found.length===1);
    assert.equal(await page.locator('#board .cell.used').count(),first.path.length);
    assert.equal(await page.locator(`#board .cell[data-index="${first.path[0]}"]`).textContent(),first.word[0]);
    const priorMoves=await page.evaluate(()=>currentGame.moves);const usedStart=(await centers(page,[first.path[0]]))[0];await page.mouse.move(usedStart.x,usedStart.y);await page.mouse.down();await page.mouse.up();assert.equal(await page.evaluate(()=>currentGame.moves),priorMoves);assert.equal(await page.evaluate(()=>currentGame.path.length),0);
    await page.reload({waitUntil:'networkidle'});await page.locator('#previewBoards button').first().click();assert.equal(await page.evaluate(()=>currentGame.found.length),1);report.checks.push('real-mouse-found-cells-blocked-progress-reload');
    for(const [width,height,name] of [[320,820,'narrow'],[390,844,'mobile-mouse'],[768,1024,'fold-mouse'],[1440,1080,'desktop']]){
      await page.setViewportSize({width,height});await page.waitForTimeout(120);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} horizontal overflow`);
      assert(await page.locator('#hintBtn').isVisible());
      report.layoutScreenshots.push({name,width,height,input:'mouse',theme:'light'});
      await screenshot(page,`board-${name}.png`);
    }
    const completed=[];
    for(let i=0;i<bank.boards.length;i++){
      completed.push(await playBoard(page));
      if(i===0)await screenshot(page,'first-win-desktop.png');
      await page.locator('#nextBoard').click();
      if((i+1)%10===0)process.stdout.write(`Mouse completions ${i+1}/${bank.boards.length}\n`);
    }
    assert(await page.locator('#screen-preview').evaluate(e=>e.classList.contains('active')));
    assert.equal(await page.locator('#previewBoards .done').count(),bank.boards.length);
    report.completedThroughPointer=completed;report.checks.push(`all-${bank.boards.length}-mouse-completions-next-and-menu`);
    await context.close();
    const reps=bank.boards.filter(b=>bank.representativeIds.includes(b.id));
    for(const [width,height,name] of [[390,844,'mobile'],[768,1024,'fold-portrait'],[1024,768,'fold-landscape']]){
      const mobile=await browser.newContext({viewport:{width,height},screen:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
      page=await mobile.newPage();page.setDefaultTimeout(12000);monitor(page);const cdp=await mobile.newCDPSession(page);await menu(page,'representative');await page.locator('#previewBoards button').first().tap();
      await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length===100);
      assert.equal(await page.locator('#magnifierQuickBtn').getAttribute('aria-pressed'),'true');assert((await page.locator('#magnifierQuickBtn svg').boundingBox()).width>=16);
      const first=await page.evaluate(()=>currentGame.puzzle.answers[0]);await draw(page,first.path,cdp);await page.waitForFunction(()=>currentGame.found.length===1);
      await page.locator('#magnifierQuickBtn').tap();await page.waitForTimeout(100);assert.equal(await page.locator('#magnifierQuickBtn').getAttribute('aria-pressed'),'false');
      await page.locator('#magnifierQuickBtn').tap();assert.equal(await page.locator('#magnifierQuickBtn').getAttribute('aria-pressed'),'true');
      await page.locator('#hintBtn').tap();await page.locator('#hintChoices button').first().tap();assert.equal(await page.evaluate(()=>currentGame.hints),1);
      await page.locator('#hintBtn').tap();await page.locator('#hintModal [data-close]').tap();assert(!(await page.locator('#hintModal').isVisible()));
      await page.locator('#calmRunBtn').tap();assert.equal(await page.locator('#calmRunBtn').getAttribute('aria-pressed'),'true');await page.locator('#calmRunBtn').tap();assert.equal(await page.locator('#calmRunBtn').getAttribute('aria-pressed'),'false');
      await page.reload({waitUntil:'networkidle'});await page.locator('#previewBoards button').first().tap();assert.equal(await page.evaluate(()=>currentGame.found.length),1);assert.equal(await page.evaluate(()=>currentGame.hints),1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const layout=await page.evaluate(()=>document.documentElement.dataset.gameLayoutMode);report.emulations.push({name,width,height,isMobile:true,hasTouch:true,input:'CDP touch',theme:'light',layout});
      await screenshot(page,`board-touch-${name}.png`);
      const ids=[];
      // Both phone and unfolded portrait complete the representative twelve.
      // Landscape additionally verifies real touch input, hints and a full win.
      const count=name==='fold-landscape'?1:reps.length;
      for(let i=0;i<count;i++){ids.push(await playBoard(page,cdp));if(i===0)await screenshot(page,`win-touch-${name}.png`);await page.locator('#nextBoard').tap()}
      if(count===12)assert.equal(await page.locator('#previewBoards .done').count(),12);
      report.checks.push(`${name}-touch-${count}-completions-hint-loupe-calm-next-reload`);report[`${name}Completions`]=ids;
      await mobile.close();
    }
    assert.equal(report.errors.length,0);assert.equal(report.gameplayRequests.length,0);
    report.checks.push('zero-page-errors-zero-gameplay-network-zero-result-writes');report.status='PASS';
  }catch(error){report.status='FAIL';report.failure=error.stack;try{await screenshot(page,'failure.png')}catch{};throw error}
  finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({status:report.status,checks:report.checks,output})+'\n')}
}
main().catch(e=>{process.stderr.write(e.stack+'\n');process.exitCode=1});
