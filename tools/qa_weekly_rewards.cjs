/* Real native shell; every account/API response is an isolated in-memory fixture. */
const {chromium}=require(process.env.PROPLET_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixtures=path.join(root,'tools/fixtures/home-cache-upgrade');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname.startsWith('/api/')){
  const name={'/api/config':'config','/api/daily':'daily','/api/tajenka':'tajenka','/api/rolling-content':'rolling'}[url.pathname];
  res.setHeader('Content-Type','application/json');return res.end(name?fs.readFileSync(path.join(fixtures,name+'.json')):'{}');
 }
 let rel=decodeURIComponent(url.pathname);if(rel.endsWith('/'))rel+='index.html';
 const file=path.join(root,'public',rel);
 if(!file.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end('missing');}
 const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({...(process.env.PROPLET_CHROMIUM?{executablePath:process.env.PROPLET_CHROMIUM}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/design/team-rewards/?archive-preview=1&teamRewards=`;
 await page.goto(base+'victory');
 await page.waitForSelector('#tvRewardDialog[open]');
 assert.match(await page.locator('#tvRewardDialog').innerText(),/Týdenní zlato je vaše!/);
 assert.equal(await page.locator('#tvRewardDialog .tv-number').innerText(),'1');
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('#tvRewardDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));
 }
 await page.locator('#tvRewardDialog [data-tv-close]').click();
 await page.locator('.bottom-nav [data-nav=profile]').click();
 await page.waitForFunction(()=>document.querySelector('#profileTeamVictories')?.textContent.includes('První otisk'));
 await page.locator('[data-tv-personal]').click();
 assert.match(await page.locator('#tvRewardDialog').innerText(),/Moje týmové výhry/);
 await page.locator('#tvRewardDialog [data-tv-close]').click();
 await page.locator('.bottom-nav [data-nav=free]').click();
 assert.equal(await page.locator('#tvRewardDialog[open]').count(),0,'already displayed victory does not reopen');
 await page.goto(base+'profile');
 await page.waitForFunction(()=>document.querySelector('#profileTeamVictories')?.textContent.includes('Zlatá parta'));
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.locator('[data-tv-personal]').click();
 assert.equal(await page.locator('.tv-personal-history li').count(),3);
 assert.match(await page.locator('.tv-personal-history').innerText(),/Písmáci/);
 assert.match(await page.locator('.tv-personal-history').innerText(),/Sdílené 1. místo/);
 await page.goto(base+'no-team');
 await page.waitForFunction(()=>document.querySelector('#profileTeamVictories')?.textContent.includes('Zlatá parta'));
 assert.match(await page.locator('#profileCard .profile-family').innerText(),/Bez týmu/);
 await page.locator('[data-tv-personal]').click();assert.equal(await page.locator('.tv-personal-history li').count(),3);
 await page.locator('#tvRewardDialog [data-tv-close]').click();
 // An old account's slow response must not populate a new profile.
 await page.evaluate(()=>{
  const old=fetch;let finish;
  window.fetch=(input,opts)=>String(input).includes('/api/team-victories/personal')?new Promise(resolve=>finish=resolve):old(input,opts);
  const original=getProfile();window.qaProfile={...original,id:'race-old',familyCode:null};getProfile=()=>qaProfile;
  document.dispatchEvent(new Event('proplet:account-changed'));
  queueMicrotask(()=>{qaProfile={...qaProfile,id:'race-new'};document.dispatchEvent(new Event('proplet:account-changed'));queueMicrotask(()=>finish?.(new Response(JSON.stringify({enabled:true,totalGold:1,history:[{teamName:'STALE SECRET',weekStart:'2026-10-05',weekEnd:'2026-10-12'}]}),{headers:{'Content-Type':'application/json'}})));});
 });
 await page.waitForTimeout(100);assert.doesNotMatch(await page.locator('#profileTeamVictories').innerText(),/STALE SECRET/);
 assert.deepEqual(errors,[]);
 console.log('PASS native celebration, one-time return, profile milestones/history, team departure, identity race, 320/390/768/1280, reduced motion, zero JS errors');
 await browser.close();await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e);server.close();process.exit(1)});
