'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const events=[],trace=()=>({id:'run',seen:new Set(),started:0,provenance:{clientRelease:'captured'}});
const c={currentGame:{mode:'starter',starterTrace:trace()},performance:{now:()=>42},trackProductEvent:(type,properties)=>events.push({type,properties})};vm.createContext(c);
vm.runInContext(app.slice(app.indexOf('function trackStarterInput('),app.indexOf('function starterPresentationReason(')),c);
for(const outcome of ['correct','invalid','empty','cancelled']){
 c.currentGame.starterTrace=trace();events.length=0;
 c.trackStarterInput(outcome);c.trackStarterInput('correct');
 assert.equal(events.length,1);assert.equal(events[0].properties.starterInputOutcome,outcome);
 assert.equal(events[0].properties.starterRunId,'run');assert.equal(events[0].properties.starterProvenance.clientRelease,'captured');
 assert(!c.currentGame.starterTrace.seen.has('first_correct'),'diagnostic never replaces canonical first_correct');
}
c.currentGame.mode='free';events.length=0;c.trackStarterInput('correct');assert.equal(events.length,0);
c.currentGame.mode='starter';c.currentGame.starterTrace=trace();c.trackStarterInput('private word');assert.equal(events.length,0);
console.log('PASS finite first terminal input outcome once per run, immutable provenance and independent canonical funnel');
async function recovery(){
 for(const mode of ['valid','recover','error','timeout','missing_export','shared','compact','empty']){
  let calls=0,timer,clock=0;const scripts=[],reports=[];
  function script(){const s=new EventTarget();s.dataset={};s.remove=()=>{};return s;}
  const existing=mode==='shared'?script():null;
  const state={inProgress:mode==='empty'?{}:{'free:fixture':{mode:'free',puzzleId:'fixture'}},completed:{}};
  const before=JSON.stringify(state);
  const screen={classList:{contains:name=>mode==='compact'&&name==='play-compact'}};
  const x={window:{PropletHomeLayout:mode==='valid'?{renderResumeCard(){calls++}}:{renderResumeCard:1}},
   document:{createElement:script,getElementById:id=>id==='screen-free'?screen:null,querySelector:()=>existing,head:{append:s=>scripts.push(s)}},
   Date:{now:()=>clock},getState:()=>state,
   setTimeout:fn=>{timer=fn;return 1},clearTimeout(){},reportClientError:(...args)=>reports.push(args)};
  vm.createContext(x);vm.runInContext(app.slice(app.indexOf('let homeLayoutRecovery='),app.indexOf('function renderFree(){')),x);
  x.renderFreeResumeCard();x.renderFreeResumeCard();
  if(mode==='compact'||mode==='empty'){assert.equal(scripts.length,0);assert.equal(reports.length,0);assert.equal(calls,0);continue;}
  if(mode==='valid'){assert.equal(calls,2);assert.equal(scripts.length,0);continue;}
  assert.equal(scripts.length,mode==='shared'?0:1,'join shell load or share one recovery');
  const loadedScript=existing||scripts[0];
  if(mode==='recover'||mode==='shared'){
   x.window.PropletHomeLayout={renderResumeCard(){calls++}};
   loadedScript.dispatchEvent(new Event('load'));
  }else if(mode==='error')loadedScript.dispatchEvent(new Event('error'));
  else if(mode==='missing_export')loadedScript.dispatchEvent(new Event('load'));
  else timer();
  await vm.runInContext('homeLayoutRecovery',x);
  if(mode==='recover'||mode==='shared'){assert.equal(calls,1);assert.equal(reports.length,0);}
  else{
   assert.equal(reports.length,1);
   assert.match(reports[0][1],new RegExp(mode==='error'?'load_error':mode));
   x.renderFreeResumeCard();assert.equal(scripts.length,1,'immediate renders cannot loop');
   clock=30000;x.renderFreeResumeCard();assert.equal(scripts.length,2,'a later render may recover once');
   scripts[1].dispatchEvent(new Event('error'));await vm.runInContext('homeLayoutRecovery',x);
   clock=60000;x.renderFreeResumeCard();assert.equal(scripts.length,2,'bounded retry cannot loop');
  }
  assert.equal(JSON.stringify(state),before,'loader never changes saved game or results');
 }
 console.log('PASS compact/empty skip, callable HomeLayout, shell-load sharing, finite reasons and bounded recovery');
}
recovery().catch(error=>{console.error(error);process.exitCode=1});
