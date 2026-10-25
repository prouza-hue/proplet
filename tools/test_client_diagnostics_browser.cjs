'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const url=process.env.TEST_URL||'http://127.0.0.1:8765';assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const oldApp=execFileSync('git',['show','1627610426894e16044396a05a348cb1cf26e7bf:public/app.js'],{encoding:'utf8',maxBuffer:1024*1024});
const output=process.env.RESULT_PATH||'browser-results/client-diagnostics.json';fs.mkdirSync(require('node:path').dirname(output),{recursive:true});
(async()=>{
 const checks=[],browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const mobile of [false,true]){
   const run=crypto.randomUUID(),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Test':'1','X-Proplet-Fixture-Run':run}});
   await context.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
   const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));await page.goto(url+'/?tutorial=1');await page.waitForFunction(()=>currentGame?.mode==='starter');
   const received=async()=>{const data=await fetch(url+'/__fixture/events').then(r=>r.json());return data.requests.filter(r=>r.path==='/api/client-error'&&r.headers['x-proplet-fixture-run']===run)};
   async function send(fn){const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/client-error');await page.evaluate(fn);const r=await response;assert.equal(r.status(),200);await page.waitForFunction(()=>!reportingClientError);}
   await send(()=>reportClientError('verification_provenance','controlled probe'));
   await send(()=>window.dispatchEvent(new ErrorEvent('error',{message:'synthetic window error',filename:location.origin+'/app.js?code=private&fbclid=private#access_token=private',lineno:123,colno:7})));
   await send(()=>{const before=currentGame;currentGame={mode:'daily',puzzle:{answers:[{word:'PES'}]}};Promise.resolve().then(()=>updateGameFeel()).finally(()=>{currentGame=before});});
   await send(()=>{const cell=document.querySelector('#board .cell');cell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:99}));cell.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:99}));});
   const rows=await received();assert.equal(rows.length,4);
   const release=await page.evaluate(()=>APP_PREVIEW_RELEASE);
   for(const row of rows){assert.equal(row.headers['x-proplet-client-release'],release);assert.equal(row.headers['x-proplet-analytics'],'2');assert.equal(row.headers['x-proplet-test'],'1');assert.equal(row.body.client_release,release);assert.equal(row.body.is_test,true);assert(!/private|fbclid|access_token|code=/.test(JSON.stringify(row.body)));}
   assert.deepEqual(rows[1].body.source_file,'/app.js');assert.equal(rows[1].body.source_line,123);assert.equal(rows[1].body.source_column,7);
   assert.equal(rows[2].body.code,'unhandled_rejection');assert(rows[2].body.message.includes('length'));assert.equal(rows[2].body.source_file,'/app.js');assert(rows[2].body.source_line>0);
   assert.equal(rows[3].body.code,'gesture_conflict');
   // Execute the actual base Daily share handler, not a test substitute.
   await page.evaluate(async()=>{const p=await historicalDailyPuzzle(pragueDateISO());const rec={elapsedMs:10000,moves:p.answers.length};saveState({...getState(),completed:{...getState().completed,['daily:'+pragueDateISO()]:{...rec,puzzleId:p.id,mode:'daily'}}});const body=bind.toString().match(/\$\('#shareDailyBtn'\)\.onclick=([^\r\n]*?);\r?\n/)[1];shareDaily=()=>{};document.querySelector('#shareDailyBtn').onclick=eval('('+body+')');document.querySelector('#shareDailyBtn').onclick();renderGameHUD();updateGameFeel();drawPaths();});
   assert.equal((await received()).length,4,'legitimate repaired Daily share path emits no extra errors');
   checks.push({mobile,release,cases:['ordinary reporter','window error safe coordinates','actual promise rejection source','gesture provenance','Daily share snapshot'],requests:rows});await context.close();
  }
  // A cached pre-PR189 app retains its own producer version under the new adapter.
  const run=crypto.randomUUID(),context=await browser.newContext({serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Test':'1','X-Proplet-Fixture-Run':run}});
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==url)return r.abort();return u.pathname==='/app.js'?r.fulfill({contentType:'text/javascript',body:oldApp}):r.continue()});
  const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));await page.goto(url+'/?tutorial=1');await page.waitForFunction(()=>currentGame?.mode==='starter');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/client-error');await page.evaluate(()=>reportClientError('verification_mixed_cache','cached old reporter'));assert.equal((await response).status(),200);
  const rows=(await fetch(url+'/__fixture/events').then(r=>r.json())).requests.filter(r=>r.path==='/api/client-error'&&r.headers['x-proplet-fixture-run']===run);
  assert.equal(rows.length,1);assert.equal(rows[0].headers['x-proplet-client-release'],'proplet-v4.05.2-dailygen6-20261008-usage1');assert.equal(rows[0].headers['x-proplet-version'],'4.05.2');assert.equal(rows[0].headers['x-proplet-test'],'1');
  assert.equal(rows[0].body.client_release,rows[0].headers['x-proplet-client-release']);
  assert.equal(rows[0].body.reporter_release,fs.readFileSync('public/app/client-diagnostics.js','utf8').match(/REPORTER_RELEASE='([^']+)'/)[1]);
  assert.equal(rows[0].body.source_availability,'missing');assert.equal(rows[0].body.is_test,true);
  checks.push({name:'mixed cached older app accurately tagged by new diagnostic adapter',requests:rows});await context.close();
  fs.writeFileSync(output,JSON.stringify({checks,synthetic:true},null,2));console.log('PASS desktop/touch error events, safe coordinates, gesture, Daily share and mixed-cache actual producer');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
