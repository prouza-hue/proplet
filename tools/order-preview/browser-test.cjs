'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve('.vercel/output/static'),evidence=path.resolve('order-preview-evidence');fs.mkdirSync(evidence,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(p===root)p=path.join(root,'index.html');if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}try{const body=fs.readFileSync(p);res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404);res.end('not found')}});
const checks=[],browserErrors=[],requests=[];
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});const page=await context.newPage();
   page.on('pageerror',e=>browserErrors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.abort();return route.continue()});
   const open=async scenario=>{await page.goto('http://127.0.0.1:4173/?open=free&scenario='+scenario);await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW?.ready,{timeout:30000})};
   const snapshot=()=>page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.snapshot());
   await open('existing');let s=await snapshot();assert.equal(s.easy.done,36);assert.equal(s.easy.mode,'numeric');assert.equal(s.easy.next[0].gen5,false);
   await page.screenshot({path:path.join(evidence,'existing-'+viewport.width+'.png'),fullPage:true});
   await page.locator('[data-diff="easy"] .order-optin').click();s=await snapshot();assert.equal(s.easy.mode,'varied');assert.equal(s.easy.next[0].gen5,true);const modern=s.easy.next[0].id;
   await page.locator('[data-play-free="easy"]').click();await page.waitForFunction(id=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.id===id,modern);assert.equal((await snapshot()).current.gen5,true);
   await page.screenshot({path:path.join(evidence,'game-'+viewport.width+'.png'),fullPage:true});
   await page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.solve(true));assert.equal((await snapshot()).current.found,1);
   await page.reload();await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW?.ready);assert.equal((await snapshot()).easy.next[0].id,modern);
   await page.locator('[data-play-free="easy"]').click();await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.found===1);
   await page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.solve(false));await page.waitForSelector('#winModal:not(.hidden)');assert.equal((await snapshot()).easy.done,37);
   await page.screenshot({path:path.join(evidence,'win-'+viewport.width+'.png'),fullPage:true});
   await page.locator('#winPrimaryBtn').click();await page.waitForFunction(()=>{const c=window.PROPLET_ORDER_PREVIEW.snapshot().current;return c&&!c.gen5&&!c.finished});
   await open('newcomer');s=await snapshot();assert.equal(s.easy.done,0);assert.equal(s.easy.mode,'varied');assert.equal(s.easy.next[0].gen5,false);assert.equal(s.easy.next[1].gen5,true);assert.equal(s.easy.next.slice(0,8).filter(p=>p.gen5).length,4);
   await page.screenshot({path:path.join(evidence,'newcomer-'+viewport.width+'.png'),fullPage:true});
   await page.locator('[data-play-free="easy"]').click();await page.waitForFunction(()=>!!window.PROPLET_ORDER_PREVIEW.snapshot().current);await page.evaluate(()=>window.PROPLET_ORDER_PREVIEW.solve(false));await page.waitForSelector('#winModal:not(.hidden)');await page.locator('#winPrimaryBtn').click();await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.gen5===true);
   await open('resume');s=await snapshot();const resume=s.easy.next[0].id;await page.locator('[data-diff="easy"] .order-optin').click();assert.equal((await snapshot()).easy.next[0].id,resume);await page.locator('[data-play-free="easy"]').click();await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW.snapshot().current?.found===1);
   await open('seen');s=await snapshot();assert.equal(s.easy.done,39);await page.locator('[data-diff="easy"] .order-optin').click();s=await snapshot();assert(!s.easy.completed.includes(s.easy.next[0].id));assert.equal(s.easy.next[0].gen5,true);
   await page.locator('[data-diff="easy"] [data-order-mode="numeric"]').click();s=await snapshot();assert.equal(s.easy.done,39);assert.equal(s.easy.mode,'numeric');assert.equal(s.easy.next[0].gen5,false);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+viewport.width);
   await page.locator('#order-reset').click();await page.waitForFunction(()=>window.PROPLET_ORDER_PREVIEW?.ready);assert.equal((await snapshot()).easy.done,39);
   await open('existing');assert.equal((await snapshot()).easy.done,37,'Scenario reset must not clear another player');
   checks.push('PASS '+viewport.width+'x'+viewport.height+': opt-in, actual Gen5 gameplay, word submission, resume/reload, win/next, newcomer, saved partial, completed skip, numeric switch, isolated reset and no horizontal overflow');
   await context.close();
  }
  const apiNetwork=requests.filter(r=>new URL(r.url).pathname.startsWith('/api/'));
  const writes=requests.filter(r=>!['GET','HEAD'].includes(r.method));
  assert.equal(apiNetwork.length,0,'Preview must not issue real API requests');assert.equal(writes.length,0,'Preview must not issue network writes');assert.equal(browserErrors.length,0,'Browser runtime errors: '+browserErrors.join('; '));
  checks.push('PASS no actual API requests, no network writes, no uncaught browser errors');
  fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({status:'PASS',checks,browserErrors,apiNetwork,writes,requestCount:requests.length},null,2));console.log(checks.join('\n'));
 }catch(error){fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify({status:'FAIL',error:error.stack,checks,browserErrors,requests},null,2));throw error}
 finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
