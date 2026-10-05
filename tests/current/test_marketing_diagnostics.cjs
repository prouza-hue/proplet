'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,pixelGate,CONSENT_KEY}=require('../../public/app/marketing.js');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
const calls=[],storage=memory();let time=1e12;
const marketing=create({storage,now:()=>time,enabled:()=>true,load:()=>calls.push(['sdk_queued']),send:(...args)=>calls.push(args),revoke(){},diagnose:(...args)=>calls.push(args)});
marketing.start();marketing.registration({id:'real-server-id',accountCreated:true});assert.deepEqual(calls,[],'no diagnostic or Meta activity before opt-in');
marketing.choose('denied');marketing.start();assert.deepEqual(calls,[]);
marketing.choose('granted');marketing.start();marketing.start();
assert.equal(calls.filter(row=>row[0]==='marketing_measurement_ready').length,1,'one consented landing per page, not per retry');
assert.equal(calls.filter(row=>row[0]==='CompleteRegistration').length,0,'consent does not replay a pre-consent registration');
assert.equal(calls.filter(row=>row[0]==='PageView').length,1);
const restored=[];create({storage,now:()=>time,enabled:()=>true,load(){},send(){},revoke(){},diagnose:(...args)=>restored.push(args)}).start();
assert.deepEqual(restored,[['marketing_measurement_ready','eligible']],'stored valid consent also produces a current landing');
time+=181*86400000;const expired=[];create({storage,now:()=>time,enabled:()=>true,load(){},send(){},revoke(){},diagnose:(...args)=>expired.push(args)}).start();assert.deepEqual(expired,[]);
for(const [url,expected] of [
 ['https://hrajproplet.cz/?utm_source=ig&utm_medium=paid_social&utm_campaign=52560585419909&utm_content=52512345&utm_term=52523456&fbclid=opaque','eligible'],
 ['https://hrajproplet.cz/?igsh=opaque','unknown_parameter'],
 ['https://hrajproplet.cz/?auth=google#access_token=private','auth_url'],
 ['https://hrajproplet.cz/?token=private','auth_url'],
 ['https://hrajproplet.cz/privacy.html','non_game_path'],
 ['http://localhost/','nonproduction']
])assert.equal(pixelGate(url),expected);
assert.equal(pixelGate('https://hrajproplet.cz/',{environment:'preview'}),'nonproduction');

const source=fs.readFileSync('public/app/marketing.js','utf8').replace(/const PIXEL_ID = '[^']*';/,"const PIXEL_ID = '12345';");
function browser({consent,ready=false,url='https://hrajproplet.cz/',telemetryThrows=false,historyThrows=false}={}){
 const store=memory();if(consent)store.setItem(CONSENT_KEY,JSON.stringify({value:consent,at:Date.now()}));
 const scripts=[],notices=[],events=[],timers=[],listeners=new Map();
 const document={readyState:'complete',head:{appendChild:script=>scripts.push(script)},body:{appendChild:notice=>notices.push(notice)},createElement:()=>({setAttribute(){},addEventListener(){},hidden:false}),querySelectorAll:()=>[]};
 const window={document,location:new URL(url),localStorage:store,__PROPLET_CURRENT_UI_READY:ready,
  trackProductEvent:(name,properties)=>{if(telemetryThrows)throw Error('storage unavailable');events.push({name,properties})},addEventListener:(name,fn)=>listeners.set(name,fn),setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length},clearTimeout(){}};
 window.history={state:{screen:'daily'},replaceState(state,title,href){if(historyThrows)throw Error('history unavailable');assert.equal(state,this.state);window.location=new URL(href)}};
 vm.runInNewContext(source,{window,URL,Date});return {window,scripts,notices,events,timers,listeners};
}
const waiting=browser();assert.equal(waiting.timers.length,0,'banner waits for actual UI readiness');assert.equal(waiting.scripts.length,0);assert.equal(waiting.events.length,0);
waiting.listeners.get('proplet-ui-ready')();waiting.listeners.get('proplet-ui-ready')();assert.equal(waiting.timers.length,1);assert.equal(waiting.timers[0].delay,800);
waiting.timers[0].fn();assert.equal(waiting.notices.length,1);assert.equal(waiting.events.length,0,'showing banner does not imply opt-in');assert.equal(waiting.scripts.length,0);
assert(!waiting.notices[0].innerHTML.includes('role="dialog"'),'notice remains nonmodal');
const alreadyReady=browser({ready:true});assert.equal(alreadyReady.timers.length,1,'late marketing bootstrap sees persisted ready flag');
const opted=browser({consent:'granted'});assert.equal(opted.timers.length,0);assert.equal(opted.scripts.length,1);
assert.deepEqual(JSON.parse(JSON.stringify(opted.events)),[{name:'marketing_measurement_ready',properties:{marketingGate:'eligible'}}]);
opted.scripts[0].onload();opted.scripts[0].onload();assert.equal(opted.events.filter(row=>row.name==='marketing_sdk_loaded').length,1);
assert(!opted.events.some(row=>/received|receipt|delivered/.test(row.name)),'script load never claims Meta event acceptance');
const failed=browser({consent:'granted'});failed.scripts[0].onerror();assert.equal(failed.events.at(-1).name,'marketing_sdk_failed');
const noTelemetry=browser({consent:'granted',telemetryThrows:true});assert.equal(noTelemetry.scripts.length,1,'a diagnostic failure must not suppress the opted-in Pixel');assert.doesNotThrow(()=>noTelemetry.scripts[0].onload());assert.doesNotThrow(()=>noTelemetry.scripts[0].onerror());
const revoked=browser({consent:'granted'});revoked.window.PropletMarketing.choose('denied');revoked.scripts[0].onload();revoked.scripts[0].onerror();assert.equal(revoked.events.length,1,'SDK callbacks after withdrawal cannot create marketing diagnostics');
const landing='https://hrajproplet.cz/?utm_source=ig&utm_medium=paid_social&utm_campaign=52561604329109&utm_content=52562644428109&utm_term=52561604328909&fbclid=opaque&igsh=private&extra=private';
const repaired=browser({consent:'granted',url:landing});assert.equal(repaired.scripts.length,1);assert.equal(repaired.events[0].properties.marketingGate,'eligible');assert(!repaired.window.location.href.includes('private'));assert.equal(repaired.window.location.searchParams.get('fbclid'),'opaque');assert.equal(repaired.window.location.searchParams.get('utm_content'),'52562644428109');
const bootRetry=browser({consent:'granted',url:landing+'&styleRetry=1'});assert.equal(bootRetry.scripts.length,1);assert.equal(bootRetry.window.location.searchParams.get('styleRetry'),'1','retain the genuine boot retry counter');
repaired.window.PropletMarketing.registration({id:'actual-new-fixture',accountCreated:true});repaired.window.PropletMarketing.registration({id:'actual-new-fixture',accountCreated:true});assert.equal(repaired.window.fbq.queue.filter(args=>args[2]==='CompleteRegistration').length,1,'cleaned landing retains real-new-account deduplication');
for(const consent of [undefined,'denied']){const untouched=browser({consent,url:landing});assert.equal(untouched.window.location.href,landing);assert.equal(untouched.scripts.length,0);assert.equal(untouched.events.length,0);}
for(const suffix of ['&auth=google#access_token=private','&Token=private','&refresh_token=private','&tutorial=1','&play=shared-board']){const protectedUrl=landing+suffix;const protectedPage=browser({consent:'granted',url:protectedUrl});assert.equal(protectedPage.scripts.length,0);assert.equal(protectedPage.window.location.href,protectedUrl);}
const blocked=browser({consent:'granted',url:landing,historyThrows:true});assert.equal(blocked.scripts.length,0);assert.equal(blocked.events[0].properties.marketingGate,'unknown_parameter');assert(!JSON.stringify(blocked.events).includes('private'));
assert.equal(browser({consent:'denied'}).events.length,0);

const theme=fs.readFileSync('public/theme-init.js','utf8');const fragment=theme.slice(theme.indexOf('    window.__PROPLET_REVEAL_CURRENT_UI=()=>{'),theme.indexOf('    let readyChecks='));
const readyEvents=[],appEvents=new Map();const themeWindow={dispatchEvent:event=>readyEvents.push(event.type)};
const context={window:themeWindow,revealed:false,document:{getElementById:()=>null,addEventListener:(name,fn)=>appEvents.set(name,fn)},root:{classList:{add(){},remove(){}}},bootStyle:{remove(){}},setTimeout(){},Event:class{constructor(type){this.type=type}}};
vm.runInNewContext(fragment,context);themeWindow.__PROPLET_REVEAL_CURRENT_UI();themeWindow.__PROPLET_REVEAL_CURRENT_UI();assert.equal(themeWindow.__PROPLET_CURRENT_UI_READY,undefined,'a boot fallback/error reveal cannot qualify as a usable game');assert.deepEqual(readyEvents,[]);
appEvents.get('proplet:ready')();appEvents.get('proplet:ready')();assert.equal(themeWindow.__PROPLET_CURRENT_UI_READY,true);assert.deepEqual(readyEvents,['proplet-ui-ready']);
console.log('PASS opt-in landing, immutable bounded gate, stored consent, SDK/error semantics, withdrawal and UI-ready banner');

(async()=>{
 // Use the runtime's actual queue configuration, not a duplicate test-only policy.
 const app=fs.readFileSync('public/app.js','utf8'),queueStore=memory();let optedIn=true,captured;
 const queueContext={productAnalyticsController:null,window:{PropletAnalytics:{create:options=>{captured=options;return {}}},PropletMarketing:{consented:()=>optedIn}},localStorage:queueStore,getProfile:()=>null,getAnonymousId:()=> 'anonymous-test',analyticsHeaders:()=>({}),CONTENT_PREVIEW_DATE:false,GEN4_CANDIDATE_PREVIEW:false,GEN5_CANDIDATE_PREVIEW:false,api(){}};
 vm.runInNewContext(app.slice(app.indexOf('function productAnalytics(){'),app.indexOf('function trackProductEvent(')),queueContext);queueContext.productAnalytics();
 assert.equal(captured.shouldSend('marketing_measurement_ready'),true);optedIn=false;
 assert.equal(captured.shouldSend('marketing_sdk_loaded'),false);assert.equal(captured.shouldSend('app_open'),true);optedIn=true;
 const {create:makeQueue}=require('../../public/app/analytics.js');let timestamp=Date.now(),offline=true;const requests=[];
 const queue=makeQueue({storage:queueStore,now:()=>timestamp,getScope:()=> 'a:test',shouldSend:captured.shouldSend,getHeaders:()=>({'X-Proplet-Marketing-Gate':'eligible'}),request:async(path,options)=>{requests.push(JSON.parse(options.body));if(offline)throw Error('offline')}});
 queue.track('marketing_measurement_ready');queue.track('app_open');await queue.flush();
 assert.equal(JSON.parse(queueStore.getItem('proplet-events-v2:a:test')).length,2,'an offline failure keeps captured events pending');
 optedIn=false;offline=false;timestamp+=61000;await queue.flush();
 assert.deepEqual(requests.slice(1),[{event_type:'app_open'}],'withdrawal drops only queued marketing diagnostics before retry');
 assert.deepEqual(JSON.parse(queueStore.getItem('proplet-events-v2:a:test')),[]);
 queue.track('marketing_sdk_failed');assert.equal(requests.length,2,'no new diagnostic can bypass consent through direct queue use');
 console.log('PASS actual offline queue withdraw/retry preserves ordinary product telemetry');

 // app.js can boot and flush before the later marketing.js script restores consent.
 delete queueContext.window.PropletMarketing;
 assert.equal(captured.shouldSend('marketing_sdk_loaded'),null,'not-yet-restored consent is unknown, not a rejection');
 const saved=memory(),startupRequests=[];const beforeInit={id:'old-opted-in-diagnostic',event:'marketing_sdk_loaded',at:timestamp,headers:{'X-Proplet-Marketing-Gate':'eligible'}};
 saved.setItem(CONSENT_KEY,JSON.stringify({value:'granted',at:timestamp}));saved.setItem('proplet-events-v2:a:startup',JSON.stringify([beforeInit]));
 const startup=makeQueue({storage:saved,now:()=>timestamp,getScope:()=> 'a:startup',shouldSend:captured.shouldSend,request:async(path,options)=>startupRequests.push(JSON.parse(options.body))});
 startup.track('starter_v1_requested');await startup.flush();
 assert.deepEqual(startupRequests,[{event_type:'starter_v1_requested'}],'ordinary boot events pass while marketing consent awaits initialization');
 assert.deepEqual(JSON.parse(saved.getItem('proplet-events-v2:a:startup')),[beforeInit],'saved marketing diagnostic is preserved unchanged before consent restoration');
 queueContext.window.PropletMarketing=create({storage:saved,now:()=>timestamp,enabled:()=>true,load(){},send(){},revoke(){}});queueContext.window.PropletMarketing.start();await startup.flush();
 assert.deepEqual(startupRequests.at(-1),{event_type:'marketing_sdk_loaded'},'restored valid opt-in releases the pending diagnostic');
 assert.deepEqual(JSON.parse(saved.getItem('proplet-events-v2:a:startup')),[]);

 delete queueContext.window.PropletMarketing;const fallbackRequests=[];
 const fallback=makeQueue({shouldSend:captured.shouldSend,request:async(path,options)=>fallbackRequests.push(JSON.parse(options.body))});
 fallback.track('marketing_sdk_loaded');fallback.track('app_open');await fallback.flush();assert.deepEqual(fallbackRequests,[{event_type:'app_open'}],'storage-less unknown consent holds marketing without blocking ordinary telemetry');
 queueContext.window.PropletMarketing=create({storage:saved,now:()=>timestamp,enabled:()=>true,load(){},send(){},revoke(){}});await fallback.flush();assert.deepEqual(fallbackRequests.at(-1),{event_type:'marketing_sdk_loaded'},'storage-less deferred diagnostic resumes after real consent initialization');
 console.log('PASS persisted consent pre-init race and storage-less deferred transport');
})().catch(error=>{console.error(error);process.exitCode=1});
