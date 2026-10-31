'use strict';
// Local-only PWA fixture: exact current updater and worker lifecycle, with a
// one-page shell instead of production assets. Never contacts production/API data.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const {chromium}=require('playwright');
const app=fs.readFileSync('public/app.js','utf8');
// The release probe consumes server capabilities before checking the worker.
const capabilities=app.slice(app.indexOf('let livePlayerPreviewEnabled='),app.indexOf('window.PropletClientDiagnostics?.claimErrorListeners'));
const updater=app.slice(app.indexOf('function canAutomaticallyUpdate('),app.indexOf('function ensureAudio('));
const worker=fs.readFileSync('public/sw.js','utf8').replace(/const SHELL=\[[\s\S]*?\];/,"const SHELL=['/'];");
const target=worker.match(/const SHELL_CACHE='([^']+)'/)[1];
const counts=new Map(),errors=[];
function fixture(release,scenario){
 return `<!doctype html><html><body><div id="updateBanner" class="hidden"><span></span><button id="applyUpdateBtn">Aktualizovat</button></div><input id="editing"><script>
 const APP_PREVIEW_RELEASE=${JSON.stringify(release)},APP_VERSION='fixture';
 let currentScreen=${JSON.stringify(scenario==='game'?'game':'daily')},automaticUpdateTimer=null,automaticUpdateTarget='',runtimeRecoveryBusy=false,runtimeUpdateRequired=false,pendingSW=null,canonicalUpdateTarget=null,serviceWorkerFirstInstallMessagePending=false,releaseProbeBusy=false,lastReleaseProbeAt=0;
 const $=s=>document.querySelector(s),openTransientModal=()=>null,trackProductEvent=()=>{};
 localStorage.setItem('test-player-progress',localStorage.getItem('test-player-progress')||'keep-me');
 window.PROPLET_RUNTIME_META={canonicalOrigin:location.origin};
 ${capabilities}
 ${updater}
 document.querySelector('#applyUpdateBtn').onclick=applyPendingUpdate;
 (async()=>{const data=await caches.open('proplet-data-v12-dated-daily');await data.put('/test-player-data',new Response('keep-data'));registerServiceWorker()})();
 <\/script></body></html>`;
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),scenario=u.searchParams.get('scenario')||'retry';
 res.setHeader('Cache-Control','no-store');
 if(u.pathname==='/sw.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return}
 if(u.pathname==='/api/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({environment:'preview'}));return}
 if(u.pathname==='/'){
  const navigation=req.headers['sec-fetch-mode']==='navigate';
  if(navigation)counts.set(scenario,(counts.get(scenario)||0)+1);
  const n=counts.get(scenario)||0;
  const release=scenario==='retry'&&n>=3||scenario==='game'&&n>=2?target:'fixture-old';
  res.setHeader('Content-Type','text/html');res.end(fixture(release,scenario));return;
 }
 res.statusCode=404;res.end();
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,...(process.env.PROPLET_BROWSER_CHANNEL?{channel:process.env.PROPLET_BROWSER_CHANNEL}:{})});
 try{
  const ctx=await browser.newContext(),page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/?scenario=retry');
  await page.waitForFunction(target=>APP_PREVIEW_RELEASE===target,target,{timeout:35000});
  await page.waitForFunction(target=>sessionStorage.getItem('proplet-auto-update-'+target)===null,target);
  assert.equal(counts.get('retry'),3,'one stale reload is retried and then the executing target confirms success');
  assert.equal(await page.evaluate(()=>localStorage.getItem('test-player-progress')),'keep-me');
  await page.waitForTimeout(2000);assert.equal(counts.get('retry'),3,'current page stops reloading');
  assert.deepEqual((await page.evaluate(()=>caches.keys())).sort(),[target,'proplet-data-v12-dated-daily'].sort());
  assert.equal(await page.evaluate(async()=>await (await caches.match('/test-player-data')).text()),'keep-data');
  await ctx.close();
  const gameCtx=await browser.newContext(),game=await gameCtx.newPage();
  game.on('pageerror',e=>errors.push(e.message));
  await gameCtx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await game.goto(base+'/?scenario=game');
  await game.waitForTimeout(3000);assert.equal(counts.get('game'),1,'game is never interrupted');
  await game.evaluate(()=>{currentScreen='daily';document.querySelector('#editing').focus()});
  await game.waitForTimeout(2000);assert.equal(counts.get('game'),1,'editing is not interrupted');
  await game.evaluate(()=>document.querySelector('#editing').blur());
  await game.waitForFunction(target=>APP_PREVIEW_RELEASE===target,target,{timeout:15000});
  assert.equal(counts.get('game'),2);assert.equal(await game.evaluate(()=>localStorage.getItem('test-player-progress')),'keep-me');
  await gameCtx.close();assert.deepEqual(errors,[]);
  console.log('PASS local browser PWA: actual worker activation and reload, stale first reload retries, executing target confirms, no loop, game/form deferred, progress retained, no page errors');
 }finally{await browser.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
