'use strict';
// Real browser, optionally real read-only SDK sources, but every browser request
// is fulfilled in memory. No view, performance beacon or identity reaches Vercel.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const paths=['/_vercel/insights/script.js','/_vercel/speed-insights/script.js'];
const report={synthetic:true,externalBrowserWrites:0,cases:[]};
(async()=>{
 const sdk=new Map();
 if(process.env.VERCEL_READONLY_SDK==='1')for(const path of paths){const r=await fetch('https://hrajproplet.cz'+path);assert.equal(r.status,200,'enabled production SDK endpoint: '+path);sdk.set(path,await r.text());}
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  for(const [name,url,environment,enabled]of [
   ['production','https://hrajproplet.cz/?utm_source=private&fbclid=private','production',true],
   ['tutorial','https://hrajproplet.cz/?tutorial=1','production',false],
   ['auth','https://hrajproplet.cz/?auth=google&code=private','production',false],
   ['preview','https://preview.vercel.app/','preview',false]]){
   const context=await browser.newContext({serviceWorkers:'block',userAgent:'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36'}),requests=[],beacons=[];
   // SDKs normally omit automated traffic. Exercise their serialization only
   // inside this fully intercepted context, never against a real collector.
   if(sdk.size)await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
   await context.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());requests.push({path:u.pathname,method:request.method()});
    if(request.method()==='POST'){beacons.push({path:u.pathname,body:request.postData()});return route.fulfill({status:200,body:'{}',contentType:'application/json'});}
    if(u.pathname==='/analytics-init.js')return route.fulfill({body:fs.readFileSync('public/analytics-init.js','utf8'),contentType:'text/javascript'});
    if(paths.includes(u.pathname)){
     const queue=u.pathname.includes('/speed-insights/')?'siq':'vaq';
     const stub=`(()=>{const q=window.${queue}||[];const before=q.find(a=>a[0]==='beforeSend')[1];const data=before({url:location.href});if(data)fetch('${u.pathname.replace('script.js','view')}',{method:'POST',body:JSON.stringify(data)})})();`;
     return route.fulfill({body:sdk.get(u.pathname)||stub,contentType:'text/javascript'});
    }
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script>window.PROPLET_RUNTIME_META={environment:'${environment}'}</script><script src="/analytics-init.js"></script></head><body><h1>Measurement fixture</h1><button style="width:180px;height:70px" onclick="this.textContent='Clicked'">Interact</button></body></html>`});
    return route.fulfill({status:404,body:''});
   });
   const page=await context.newPage();await page.goto(url);await page.getByRole('button').click();await page.waitForTimeout(700);
   if(enabled){
    for(const path of paths)assert.equal(requests.filter(r=>r.path===path).length,1,'one SDK load '+path);
    // Exercise actual SDK page-hide collection after an interaction/paint.
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));});
    await page.waitForTimeout(400);
    assert(beacons.some(b=>b.path.includes('/insights/')),'web analytics collector receives a view');
    assert(beacons.some(b=>b.path.includes('/speed-insights/')),'speed collector receives performance');
    assert(beacons.every(b=>!String(b.body).includes('private')),'no URL attribution/query secret in either collector payload');
   }else assert.equal(requests.filter(r=>paths.includes(r.path)).length,0,'excluded route loads no SDK');
   report.cases.push({name,enabled,requests,beacons});await context.close();
  }
  fs.mkdirSync('browser-results',{recursive:true});fs.writeFileSync('browser-results/platform-analytics.json',JSON.stringify({...report,realSdkSources:sdk.size,automatedTrafficFilterBypassedOnlyInInterceptedFixture:!!sdk.size},null,2));
  console.log('PASS web/performance collection in isolated browser; preview/tutorial/auth excluded; no external beacons');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
