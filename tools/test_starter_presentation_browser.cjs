// Real DOM/hit-test + actual analytics headers; synthetic loopback API only.
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const url=process.env.TEST_URL||'http://127.0.0.1:8765';
assert(['127.0.0.1','localhost'].includes(new URL(url).hostname),'loopback fixture only');
const output=process.env.RESULT_PATH||'browser-results/starter-presentation.json';
fs.mkdirSync(require('node:path').dirname(output),{recursive:true});
async function eventually(fn,message,ms=16000){const end=Date.now()+ms;do{const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}while(Date.now()<end);throw Error(message)}
(async()=>{
 const health=await fetch(url+'/api/health').then(r=>r.json());assert(health.isolatedFixture&&!health.database);
 const report={synthetic:true,fixtureSha:health.sha,checks:[]},browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{for(const viewport of[{width:390,height:844},{width:690,height:829}]){
  const response=await fetch(url+'/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reset:true,firstSteps:true})});assert(response.ok);
  const run=crypto.randomUUID(),context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block',extraHTTPHeaders:{'X-Proplet-Fixture-Run':run}});
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await context.addInitScript(()=>{
   localStorage.setItem('proplet-v3-15-anonymous-id','synthetic-presentation');
   localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.parse('2026-09-15T09:00:00Z')}));
   const arm=()=>{const observer=new MutationObserver(()=>{
    if(document.querySelectorAll('#board .cell').length!==9)return;
    const modal=document.getElementById('profileModal');if(!modal)return;
    observer.disconnect();modal.classList.remove('hidden');modal.style.zIndex='2147483000';window.__qaObstructionApplied=true;
   });observer.observe(document.documentElement,{childList:true,subtree:true});};
   if(document.documentElement)arm();else document.addEventListener('DOMContentLoaded',arm,{once:true});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));await page.goto(url);
  const events=async()=>{const data=await fetch(url+'/__fixture/events').then(r=>r.json());return data.events.filter(e=>e.headers['x-proplet-fixture-run']===run)};
  const initial=await eventually(async()=> (await events()).find(e=>e.event==='starter_v1_presentation_checked'),'initial presentation not received');
  assert.equal(initial.headers['x-proplet-starter-reason'],'obscured');assert.equal(initial.headers['x-proplet-starter-stage'],'initial');
  assert.equal(initial.headers['x-proplet-starter-obscurer'],'profileModal');
  assert.equal(initial.headers['x-proplet-starter-viewport-width'],String(viewport.width));assert.equal(initial.headers['x-proplet-starter-viewport-height'],String(viewport.height));
  await page.screenshot({path:output+'.'+viewport.width+'-initial.png',fullPage:true});
  await page.evaluate(()=>document.getElementById('profileModal').classList.add('hidden'));
  const idle=await eventually(async()=> (await events()).find(e=>e.event==='starter_v1_idle'),'idle presentation not received');
  assert.equal(idle.headers['x-proplet-starter-reason'],'visible');assert.equal(idle.headers['x-proplet-starter-stage'],'idle');
  assert.equal(idle.headers['x-proplet-starter-obscurer'],'none');
  assert.equal(initial.headers['x-proplet-starter-run'],idle.headers['x-proplet-starter-run']);
  assert.equal(initial.headers['x-proplet-client-release'],idle.headers['x-proplet-client-release']);
  const all=await events();assert.equal(all.filter(e=>e.event==='starter_v1_presentation_checked').length,1);assert.equal(all.filter(e=>e.event==='starter_v1_idle').length,1);
  assert(!all.some(e=>['starter_v1_interaction','starter_v1_first_correct','starter_v1_completed'].includes(e.event)),'presentation cannot invent funnel conversions');
  assert.deepEqual(errors,[]);await page.screenshot({path:output+'.'+viewport.width+'-idle.png',fullPage:true});
  report.checks.push({viewport,initial:initial.headers,idle:idle.headers});await context.close();
 }}finally{await browser.close()}
 fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('PASS real phone/Fold DOM obstruction -> visibility, run/release headers, one row per phase, no invented funnel events and no page errors');
})().catch(e=>{console.error(e);process.exitCode=1});
