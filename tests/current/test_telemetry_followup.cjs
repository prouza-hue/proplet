'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const ready=()=>Object.fromEntries(['analyticsVersion','trainingPuzzle','captureFirstGame','isFirstGame','recordStarted','recordCompleted','afterStart','eventHeaders','prepareEntry'].map(k=>[k,()=>{}]));
const recovery=app.slice(app.indexOf('let firstStepsRuntimeRequest='),app.indexOf('function createStarterTrace('));
async function verifyRecovery(){
 const scripts=[],toasts=[],errors=[],original={attemptId:'preserve-me'};
 const c={window:{PropletFirstSteps:{captureFirstGame:'not-callable'}},currentGame:original,starterBootTrace:null,
  document:{createElement:()=>({remove(){}}),head:{append:s=>scripts.push(s)}},setTimeout:()=>1,clearTimeout(){},trackStarterPhase(){},reportClientError:(...x)=>errors.push(x),showToast:x=>toasts.push(x)};
 vm.createContext(c);vm.runInContext(recovery,c);
 const a=c.ensureFirstStepsRuntime(),b=c.ensureFirstStepsRuntime();assert.equal(scripts.length,1,'concurrent recovery has one request');
 c.window.PropletFirstSteps=ready();scripts[0].onload();await Promise.all([a,b]);
 await c.ensureFirstStepsRuntime();assert.equal(scripts.length,1,'valid module is not reloaded');assert.equal(c.currentGame,original);
 c.window.PropletFirstSteps={captureFirstGame:'bad'};
 vm.runInContext(app.slice(app.indexOf('async function startGame('),app.indexOf('function tajenkaRulesKey(')),c);
 const failed=c.startGame({id:'untouched'},'free');scripts.at(-1).onerror();assert.equal(await failed,false);
 assert.equal(c.currentGame,original,'failed recovery must not replace current game/attempt');assert.equal(toasts.length,1);assert.equal(errors[0][0],'first_steps_module_unavailable');
 const retry=c.ensureFirstStepsRuntime();c.window.PropletFirstSteps=ready();scripts.at(-1).onload();await retry;assert(c.firstStepsRuntimeReady(),'explicit next action can retry');
 const pipeline=require('../../public/app/core/completion-pipeline.js').create();let owner='';
 pipeline.register({id:'first-steps-v1',after:()=>{owner='old'}});pipeline.register({id:'first-steps-v1',after:()=>{owner='ignored'}});await pipeline.runAfter({});assert.equal(owner,'old');
 pipeline.register({id:'first-steps-v1',replace:true,after:()=>{owner='recovered'}});await pipeline.runAfter({});assert.equal(owner,'recovered');assert.equal(pipeline.registeredIds().length,1);
 console.log('PASS callable module recovery, failed start preserves game, explicit retry, one replaced completion hook');
}
function verifyPresentation(){
 const events=[],timers=new Map();let id=0,top;const board={getBoundingClientRect:()=>({x:0,y:0,width:200,height:200}),querySelectorAll:()=>[1,2,3,4,5,6,7,8,9],contains:el=>el===board};top=board;
 const g={puzzle:{mask:Array(9)},starterTrace:{id:'run',started:0,seen:new Set(),provenance:Object.freeze({clientRelease:'producer',onboardingVersion:'board-v3-short'})},pausedAt:null};
 const c={currentGame:g,currentScreen:'game',document:{hidden:false,elementFromPoint:()=>top},$:()=>board,performance:{now:()=>100},setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),trackProductEvent:(name,props)=>events.push({name,props})};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function trackStarterPhase('),app.indexOf('function freshStarterVisit(')),c);
 c.observeStarterPresentation(g);assert.equal(events[0].name,'starter_v1_presentation_checked');assert.equal(events[0].props.starterReason,'visible');assert.equal(events[0].props.starterRunId,'run');
 top={};assert.equal(c.starterPresentationReason(g),'obscured');g.pausedAt=1;assert.equal(c.starterPresentationReason(g),'paused');c.document.hidden=true;assert.equal(c.starterPresentationReason(g),'visibility');c.document.hidden=false;g.pausedAt=null;top=board;
 timers.get(g.starterTrace.idleTimer)();assert.equal(events.at(-1).name,'starter_v1_idle');assert.equal(events.at(-1).props.starterReason,'visible');
 c.trackStarterPhase(g.starterTrace,'interaction');assert.equal(timers.size,0,'interaction clears timer');assert.equal(events.filter(x=>x.name==='starter_v1_completed').length,0,'idle is not abandonment/completion');
 console.log('PASS bounded once-only presentation/idle diagnostics distinguish visibility, pause and obstruction without changing funnel');
}
function verifyPlatform(){
 const code=fs.readFileSync('public/analytics-init.js','utf8');
 function load(host='hrajproplet.cz',search='',environment='production',hash=''){
  const nodes=[],c={window:{PROPLET_RUNTIME_META:{environment}},location:{hostname:host,search,hash},URL,URLSearchParams,document:{querySelector:()=>null,createElement:()=>({}),head:{append:s=>nodes.push(s)}}};vm.createContext(c);vm.runInContext(code,c);vm.runInContext(code,c);return {c,nodes};
 }
 const {c,nodes}=load();assert.deepEqual(nodes.map(x=>x.src),['/_vercel/insights/script.js','/_vercel/speed-insights/script.js']);
 for(const q of [c.window.vaq,c.window.siq]){const clean=q[0][1]({url:'https://hrajproplet.cz/?code=private#access_token=private',referrer:'https://example.test/?q=private#secret'});assert.equal(clean.url,'https://hrajproplet.cz/');assert.equal(clean.referrer,'https://example.test/');assert.equal(q[0][1]({url:'invalid'}),null);}
 for(const args of [['preview.vercel.app'],['localhost'],['hrajproplet.cz','?tutorial=1'],['hrajproplet.cz','?auth=google'],['hrajproplet.cz','?code=secret'],['hrajproplet.cz','','preview'],['hrajproplet.cz','','production','#access_token=secret']])assert.equal(load(...args).nodes.length,0);
 assert(fs.readFileSync('public/index.html','utf8').includes('/analytics-init.js?v=telemetry1'));
 console.log('PASS platform collection loads once in canonical production only; query/hash/referrer redacted, technical/OAuth/preview excluded');
}
async function verifyDiagnostics(){
 const fallbackListeners=[],fallback={window:{addEventListener:(type,fn)=>fallbackListeners.push(type)}};
 vm.createContext(fallback);vm.runInContext(app.slice(app.indexOf('let reportingClientError=false;'),app.indexOf('let accountUIController=')),fallback);
 fallback.bindClientErrorReporting();fallback.bindClientErrorReporting();assert.deepEqual(fallbackListeners,['error','unhandledrejection'],'fallback also installs only once when diagnostic script is unavailable');
 const calls=[],listeners={},c={URL,URLSearchParams,Headers,location:{href:'https://hrajproplet.cz/?fbclid=private',origin:'https://hrajproplet.cz',pathname:'/',search:'?tutorial=1'}};
 c.window={fetch:(url,options)=>{calls.push({url,options});return Promise.resolve({ok:true})},navigator:{onLine:true},PROPLET_RUNTIME_META:{version:'99.0.0'},addEventListener:(type,fn)=>listeners[type]=fn};
 vm.createContext(c);vm.runInContext(fs.readFileSync('public/app/client-diagnostics.js','utf8'),c);
 listeners.error({message:'Script error.'});let body=JSON.parse(calls[0].options.body);assert.equal(body.client_release,undefined);assert.equal(body.unknown_producer_reason,'before_app_release');assert.equal(body.source_availability,'opaque');assert(!calls[0].options.body.includes('99.0.0'),'runtime meta never becomes producer');
 c.APP_PREVIEW_RELEASE='proplet-v4.05.2-dailygen6-20261008-usage1';listeners.error({message:'legacy listener owns this'});assert.equal(calls.length,1,'do not double-report errors from a cached app with its own listeners');
 c.APP_PREVIEW_RELEASE='proplet-v4.09.8-telemetry1';c.window.PropletClientDiagnostics.claimErrorListeners();
 listeners.unhandledrejection({reason:{message:'synthetic length',stack:'TypeError private\n at https://hrajproplet.cz/app.js?code=private:10:2\n at https://evil.test/private.js:2:1\n at https://hrajproplet.cz/app/account/account.js#secret:12:4'}});
 body=JSON.parse(calls.at(-1).options.body);assert.equal(body.client_release,c.APP_PREVIEW_RELEASE);assert.equal(body.reporter_release,fs.readFileSync('public/app/client-diagnostics.js','utf8').match(/REPORTER_RELEASE='([^']+)'/)[1]);assert.equal(body.is_test,true);assert.equal(body.source_frames.length,2);assert.equal(body.source_file,'/app.js');assert(!/private|secret|evil|stack/.test(JSON.stringify(body)));
 assert.equal(body.source_availability,'available');assert.equal(calls.at(-1).options.headers['X-Proplet-Test'],'1');
 console.log('PASS bootstrap vs producer release, legacy listener isolation, opaque errors and safe frame-only JS diagnostics');
}
(async()=>{await verifyRecovery();verifyPresentation();verifyPlatform();await verifyDiagnostics()})().catch(e=>{console.error(e);process.exitCode=1});
