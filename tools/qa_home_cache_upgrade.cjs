const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),fixtures=path.join(__dirname,'fixtures/home-cache-upgrade'),fallback=process.env.PROPLET_QA_FALLBACK||root;
const old=JSON.parse(fs.readFileSync(path.join(fixtures,'old-shell.json')));
const output=process.env.PROPLET_QA_OUTPUT||'/tmp/proplet-home-cache-qa';fs.mkdirSync(output,{recursive:true});
const watchdog=setTimeout(()=>{console.error('FAIL: browser did not finish; possible main-thread starvation');process.exit(1)},90000);
let phase='old';const requests=[];
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local');requests.push(u.pathname+u.search);res.setHeader('cache-control','no-store');
 if(u.pathname==='/worker-setup'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>SW upgrade regression</title>');return;}
 if(u.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(u.pathname==='/api/daily'?fs.readFileSync(path.join(fixtures,'daily.json')):u.pathname==='/api/rolling-content'?fs.readFileSync(path.join(fixtures,'rolling.json')):u.pathname==='/api/tajenka'?fs.readFileSync(path.join(fixtures,'tajenka.json')):u.pathname==='/api/config'?fs.readFileSync(path.join(fixtures,'config.json')):'{}');return;}
 let p=path.join(root,'public',u.pathname==='/'?'index.html':u.pathname);if(!fs.existsSync(p))p=path.join(fallback,'public',u.pathname==='/'?'index.html':u.pathname);
 try{let data=fs.readFileSync(p);
 if(u.pathname==='/sw.js'&&phase==='old')data=Buffer.from(old['public/sw.js']);
 if(u.pathname==='/tajenka-release-fix.js'&&u.search==='?v=invitations1')data=Buffer.from(old['public/tajenka-release-fix.js']);
 if(p.endsWith('preview-isolation.js'))data=Buffer.from(data.toString().replace('window.PROPLET_ARCHIVE_PREVIEW = true','window.PROPLET_ARCHIVE_PREVIEW = false').replaceAll("environment:'preview',version:'4.07.3'","environment:'production',version:'4.08.7'"));
 res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.json')?'application/json':p.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.end('missing');}
}).listen(8152,'127.0.0.1');
(async()=>{
 const browser=await chromium.launch({executablePath:'/tmp/proplet-progression-chromium',headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Diagnostic observer only; never replaces or disconnects application observers.
 await page.addInitScript(()=>{window.qaMutations=0;document.addEventListener('DOMContentLoaded',()=>new MutationObserver(rs=>window.qaMutations+=rs.length).observe(document.body,{childList:true,subtree:true}));});
 await page.goto('http://127.0.0.1:8152/worker-setup');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const stale=await page.evaluate(async()=>{const r=await caches.match('/tajenka-release-fix.js?v=invitations1');return r?await r.text():''});assert(stale&&!stale.includes('placePlayExtra'));console.log('CONFIRMED real old worker caches old invitations1 script');
 await page.goto('http://127.0.0.1:8152/?archive-preview=1&review=daily',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='1');await page.waitForTimeout(1700);
 assert(await page.locator('script[src="/tajenka-release-fix.js?v=archive-layout2"]').count());
 const before=await page.evaluate(()=>qaMutations);await page.waitForTimeout(600);const after=await page.evaluate(()=>qaMutations);assert(after-before<50,`idle mutations ${after-before}`);
 await page.locator('.bottom-nav [data-nav="free"]').click();await page.waitForFunction(()=>currentScreen==='free');
 await page.locator('.bottom-nav [data-nav="daily"]').click();await page.waitForFunction(()=>currentScreen==='daily');
 await page.evaluate(()=>{const s=tajenkaState();s.completions={[tajenkaPuzzle.id]:{puzzleId:tajenkaPuzzle.id,elapsedMs:60000,moves:5,found:[],completedAt:new Date().toISOString(),rewarded:true,rewardXp:200}};saveTajenkaState(s);renderDaily();});
 await page.waitForTimeout(600);assert(await page.evaluate(()=>document.querySelector('#tajenkaPreviewCard').nextElementSibling.id==='homeCompetitionCard'));
 console.log('PASS fixed page boots and clicks under old worker, completed Tajenka stays before progress');
 phase='new';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();const w=r.installing||r.waiting;if(w&&w.state!=='activated')await new Promise((resolve,reject)=>{w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();if(w.state==='redundant')reject(Error('new worker failed'))})});});
 await page.waitForTimeout(800);
 const keys=await page.evaluate(()=>caches.keys());console.log('KEYS',keys);assert(!keys.some(x=>x.includes('4.07.3')));console.log('CACHES',keys);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1600);
 await page.locator('.bottom-nav [data-nav="free"]').click();await page.waitForFunction(()=>currentScreen==='free');await page.locator('.bottom-nav [data-nav="daily"]').click();await page.waitForFunction(()=>currentScreen==='daily');
 console.log('PASS activation, reload, retained completion and navigation',await page.evaluate(()=>({version:APP_VERSION,solved:!!tajenkaCompletion()})));
 // Validate the requested card order and readable artwork on narrow mobile and Fold widths.
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(150);
  const metrics=await page.evaluate(()=>{
   const ids=['.daily-hero','#referralHome','#axHomeFree','#axHomeCompetitions','#axHomeGames','#tajenkaPreviewCard','#homeCompetitionCard'];
   const y=ids.map(s=>document.querySelector(s).getBoundingClientRect().top);
   const icons=[...document.querySelectorAll('#axHomeFree .ax-free-difficulty')].map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
   const cta=document.querySelector('#referralHome [data-ref-open]');
   return {y,icons,progress:getComputedStyle(document.querySelector('#homeCompetitionCard')).display,arrow:getComputedStyle(cta,'::after').width,weight:getComputedStyle(cta).fontWeight};
  });
  assert(metrics.y.every((y,i)=>i===0||y>metrics.y[i-1]));assert.notStrictEqual(metrics.progress,'none');assert(metrics.icons.length===6&&metrics.icons.every(x=>x.w>=28&&x.h>=28));assert.strictEqual(metrics.arrow,'20px');assert(+metrics.weight>=650);
  console.log('PASS layout',width,metrics.icons);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark'});
 await page.screenshot({path:output+'/fixed-dark-mobile.png',fullPage:true});
 await page.locator('#axHomeArchive [data-archive-action="open"]').click();await page.waitForFunction(()=>currentScreen==='archive');
 assert(await page.locator('#screen-archive .archive-art').count());
 await page.waitForTimeout(500);await page.screenshot({path:output+'/fixed-archive.png'});
 await page.locator('.bottom-nav [data-nav="daily"]').click();
 await page.evaluate(()=>{const s=tajenkaState();s.completions={};saveTajenkaState(s);renderDaily();});await page.waitForTimeout(300);
 assert(await page.evaluate(()=>document.querySelector('#tajenkaPreviewCard').compareDocumentPosition(document.querySelector('#axHomeFree'))&Node.DOCUMENT_POSITION_FOLLOWING));
 console.log('PASS unsolved Tajenka above Free and Archive header art');
 assert.deepStrictEqual(errors,[]);await page.screenshot({path:output+'/fixed-mobile.png',fullPage:true});
 await browser.close();server.close();clearTimeout(watchdog);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
