'use strict';
// Combined real-app review: all server calls are in-page fixtures, never a DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PROPLET_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),publicRoot=path.join(root,'public'),artifacts=path.join(root,'artifacts/refinements-review');
fs.mkdirSync(artifacts,{recursive:true});
const networkApi=[],errors=[],checks=[];
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://isolated');
 if(u.pathname.startsWith('/api/')){networkApi.push({method:req.method,path:u.pathname});res.writeHead(418,{'Content-Type':'application/json'});return res.end('{"detail":"No network API exists in this isolated review"}')}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end()}
 const name=path.resolve(publicRoot,'.'+decodeURIComponent(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
 if(!name.startsWith(publicRoot+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){res.writeHead(404);return res.end('missing')}
 res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(name));
});
let browser,base;
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});
async function boot(context,mode,theme,word){
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await page.goto(base+'/design/refinements/?review='+mode+'&theme='+theme+(word?'&word='+word:''),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PropletRefinementsReview?.ready===true||window.PropletRefinementsReview?.error);
 assert.equal(await page.evaluate(()=>window.PropletRefinementsReview.error),null);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
 await settle(page);return page;
}
async function noOverflow(page,label){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': viewport has no horizontal overflow');
}
// Navigation behavior is covered once by test_rankings_navigation_browser.cjs
// in this workflow; this review retains responsive screenshots, hints and words.
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.PROPLET_CHROMIUM?{executablePath:process.env.PROPLET_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:320,height:840},{width:390,height:844},{width:768,height:1000},{width:1000,height:768}])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport,screen:viewport,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const hints=await boot(context,'hints',theme);
  await hints.locator('#hintModal:not(.hidden)').waitFor().catch(async error=>{console.error('Hint startup',await hints.evaluate(()=>({ready:window.PropletRefinementsReview?.ready,mode:window.PropletRefinementsReview?.mode,game:typeof currentGame==='undefined'?null:{mode:currentGame?.mode,id:currentGame?.puzzle?.id},hint:document.querySelector('#hintModal')?.outerHTML,button:document.querySelector('#hintBtn')?.outerHTML,screen:typeof currentScreen==='undefined'?null:currentScreen,errors:window.PropletRefinementsReview?.error,onclick:String(document.querySelector('#hintBtn')?.onclick),module:Object.keys(window.PropletGameHints||{}),finished:currentGame?.finished})));await hints.screenshot({path:path.join(artifacts,'hint-startup-failure.png')});throw error});
  assert.equal(await hints.locator('#hintModal [data-hint-level]').count(),3);
  assert.equal(await hints.locator('#hintEyebrow,#hintCopy').count(),0,'obsolete hint copy is removed from native DOM');
  await hints.waitForFunction(()=>[...document.querySelectorAll('#hintModal .hint-choice img')].length===3&&[...document.querySelectorAll('#hintModal .hint-choice img')].every(img=>img.complete&&img.naturalWidth>0));
  assert(await hints.locator('#hintModal .modal-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'hint card fits');
  assert(await hints.locator('#hintModal .modal-card').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1}),'hint card stays inside visual viewport');
  await noOverflow(hints,'hints '+viewport.width+' '+theme);
  await hints.screenshot({path:path.join(artifacts,`hints-${viewport.width}-${theme}.png`)});
  await hints.locator('#closeHintModal').click();assert.equal(await hints.locator('#hintModal').isVisible(),false);
  const rankings=await boot(context,'rankings',theme);
  await rankings.locator('.screen.active [data-ranking-view="daily"]').click();
  await rankings.waitForFunction(()=>document.querySelectorAll('#dailyLeaderboardList .ranking-row').length===6);
  await noOverflow(rankings,'rankings '+viewport.width+' '+theme);
  await rankings.locator('#dailyLeaderboardList').locator('..').screenshot({path:path.join(artifacts,`daily-${viewport.width}-${theme}.png`)});
  await rankings.locator('.screen.active [data-ranking-view="xp"]').click();
  await rankings.waitForSelector('#xpLeaderboardList .ranking-row');
  await rankings.locator('#xpLeaderboardList').locator('..').screenshot({path:path.join(artifacts,`xp-${viewport.width}-${theme}.png`)});
  await context.close();
 }
 // A short landscape viewport still exposes every hint choice and the close control.
 {
  const context=await browser.newContext({viewport:{width:1000,height:440},screen:{width:1000,height:768},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await boot(context,'hints','dark');
  assert(await page.locator('#hintModal .hint-card').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'all choices fit short landscape');
  await page.locator('#hintModal [data-hint-level="3"]').focus();await page.keyboard.press('Tab');
  assert.equal(await page.locator('#closeHintModal').evaluate(el=>el===document.activeElement),true,'hint focus wraps to close');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#hintModal').isVisible(),false,'Escape closes hint');
  assert.equal(await page.locator('#hintBtn').evaluate(el=>el===document.activeElement),true,'focus returns to native opener');
  await context.close();
 }
 for(const word of ['OBRNA','STROFA','AORTA','KANCL','KATION']){
  const context=await browser.newContext({viewport:{width:768,height:1000},screen:{width:768,height:1000},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await boot(context,'bonus','light',word);
  await page.waitForFunction(word=>document.querySelector('#gameMessage')?.textContent.includes(word)&&document.querySelector('#gameMessage')?.textContent.includes('+1 XP'),word);
  const result=await page.evaluate(()=>({puzzle:currentGame.puzzle.id,xp:currentGame.wordDiscoveryXpAwarded,found:currentGame.found.length,claims:window.PropletRefinementsReview.claims.size,networkFallback:window.PropletRefinementsReview.requests.filter(r=>r.path==='/api/word-recognition').length}));
  assert.equal(result.xp,1,word+' is credited by native discovery');assert.equal(result.found,0,word+' remains outside the board solution');assert.equal(result.claims,1);assert.equal(result.networkFallback,0,word+' recognized by actual offline lexicon');
  await noOverflow(page,'bonus '+word);await page.screenshot({path:path.join(artifacts,'bonus-'+word.toLowerCase()+'.png')});
  await context.close();
 }
 checks.push('OBRNA/STROFA/AORTA/KANCL/KATION: original boards, real submit wrapper and lexicon, local receipt, no remote recognition');
 assert.deepEqual(networkApi,[],'all API requests must be intercepted before network');assert.deepEqual(errors,[],'zero uncaught JS errors');
 console.log('PASS '+checks.join('; ')+'; 320/390/768/1000 light/dark screenshots; zero network API requests');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve))});
