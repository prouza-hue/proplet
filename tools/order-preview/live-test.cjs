'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const origin='https://proplet-git-preview-pestre-poradi-pavel-prouzas-projects.vercel.app',host=new URL(origin).hostname,root=path.resolve('.vercel/output/static'),dir=path.resolve('order-preview-evidence');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),checks=[],errors=[],apiRequests=[],writes=[],fonts=[];
const result={origin,commit:process.env.GITHUB_SHA,status:'PENDING',checks,errors,apiRequests,writes,fonts};
const save=()=>fs.writeFileSync(path.join(dir,'hosted-results.json'),JSON.stringify(result,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 let ready=false,lastStatus=0;const expected=hash(fs.readFileSync(path.join(root,'order-preview.css')));
 for(let i=0;i<24;i++){
  try{const r=await fetch(origin+'/order-preview.css',{redirect:'manual',signal:AbortSignal.timeout(10000)});lastStatus=r.status;if(r.ok&&hash(Buffer.from(await r.arrayBuffer()))===expected){ready=true;break}}catch{}
  await sleep(5000);
 }
 if(!ready){result.status='NOT_VERIFIED';result.reason='Hosted asset unavailable, protected, or not yet matching this commit; HTTP '+lastStatus;save();throw new Error(result.reason)}
 for(const name of ['index.html','app.js','order-engine.js','order-prelude.js','order-preview.css']){const r=await fetch(origin+'/'+name);assert(r.ok);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(fs.readFileSync(path.join(root,name))),name+' deployed content mismatch')}
 checks.push('PASS deployed HTML, application, engine, network guard and CSS exactly match local tested build');
 const blocked=await fetch(origin+'/api/config');assert.equal(blocked.status,403);assert.match(blocked.headers.get('content-security-policy')||'',/connect-src 'self'/);assert.match(await blocked.text(),/No API or database/);
 checks.push('PASS hosted API returns 403 and CSP forbids database/cross-origin connections');
 const browser=await chromium.launch({headless:true});let page;
 try{
  for(const spec of [{width:320,height:740,theme:'light'},{width:768,height:1024,theme:'dark'}]){
   const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},colorScheme:spec.theme,reducedMotion:'reduce'});page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))apiRequests.push(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.url())});
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(![host,'fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return route.abort();return route.continue()});
   await page.goto(origin+'/?open=free&scenario=existing');await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW?.ready);await page.evaluate(()=>document.fonts.ready);
   fonts.push(await page.evaluate(()=>({wordmark:getComputedStyle(document.querySelector('.brand-copy strong')).fontFamily,loaded:[...document.fonts].map(f=>({family:f.family,status:f.status})),theme:document.documentElement.dataset.theme||document.body.dataset.theme||null})));
   await page.screenshot({path:path.join(dir,'hosted-existing-'+spec.width+'-'+spec.theme+'.png'),fullPage:true});
   await page.locator('[data-diff="medium"] .order-optin').click();
   const snapshot=()=>page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.snapshot());let s=await snapshot();assert.equal(s.medium.next[0].gen5,true);const id=s.medium.next[0].id;
   await page.locator('[data-play-free="medium"]').click();await page.waitForFunction(wanted=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.id===wanted,id);
   // Real pointer events through the actual board/input handlers, not the QA shortcut.
   const answerPath=await page.evaluate(()=>currentGame.puzzle.answers[0].path);
   await page.locator('#boardStage').scrollIntoViewIfNeeded();
   const points=[];for(const cell of answerPath){const rect=await page.locator('.cell[data-index="'+cell+'"]').boundingBox();assert(rect);points.push({x:rect.x+rect.width/2,y:rect.y+rect.height/2})}
   await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y,{steps:3});await page.mouse.up();
   await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.found===1);
   await page.screenshot({path:path.join(dir,'hosted-game-'+spec.width+'-'+spec.theme+'.png'),fullPage:true});
   await page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.solve(false));await page.waitForSelector('#winModal:not(.hidden)');assert.equal((await snapshot()).medium.done,13);
   await page.screenshot({path:path.join(dir,'hosted-win-'+spec.width+'-'+spec.theme+'.png'),fullPage:true});
   await page.locator('#winPrimaryBtn').click();await page.waitForFunction(()=>{const c=window.PROPLET_ORDER_PREVIEW.snapshot().current;return c&&!c.gen5&&!c.finished});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
   checks.push('PASS hosted '+spec.width+'x'+spec.height+' '+spec.theme+': real pointer word submission, medium Gen5 opt-in, win, XP/local progress and next original board');
   await context.close();page=null;
  }
  assert.equal(errors.length,0,errors.join('; '));assert.equal(apiRequests.length,0);assert.equal(writes.length,0);result.status='PASS';save();console.log(JSON.stringify(result,null,2));
 }catch(e){result.status='FAIL';result.error=e.stack;if(page)try{await page.screenshot({path:path.join(dir,'hosted-failure.png'),fullPage:true})}catch{}save();throw e}
 finally{await browser.close()}
})().catch(e=>{if(result.status==='PENDING'){result.status='FAIL';result.error=e.stack;save()}console.error(e);process.exitCode=1});
