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
 for(const mode of ['valid','recover','error','timeout']){
  let calls=0,reports=0,timer;const scripts=[];
  const x={window:{PropletHomeLayout:mode==='valid'?{renderResumeCard(){calls++}}:{renderResumeCard:1}},
   document:{createElement:()=>({remove(){}}),head:{append:s=>scripts.push(s)}},
   setTimeout:fn=>{timer=fn;return 1},clearTimeout(){},reportClientError:()=>reports++};
  vm.createContext(x);vm.runInContext(app.slice(app.indexOf('let homeLayoutRecovery='),app.indexOf('function renderFree(){')),x);
  x.renderFreeResumeCard();x.renderFreeResumeCard();
  if(mode==='valid'){assert.equal(calls,2);assert.equal(scripts.length,0);continue;}
  assert.equal(scripts.length,1,'concurrent renders share one recovery');
  if(mode==='recover'){x.window.PropletHomeLayout={renderResumeCard(){calls++}};scripts[0].onload();}
  else if(mode==='error')scripts[0].onerror();else timer();
  await vm.runInContext('homeLayoutRecovery',x);
  if(mode==='recover'){assert.equal(calls,1);assert.equal(reports,0);}
  else{assert.equal(reports,1);x.renderFreeResumeCard();assert.equal(scripts.length,1,'failed recovery cannot loop');}
 }
 console.log('PASS callable HomeLayout, shared recovery, failure/timeout and no automatic retry loop');
}
recovery().catch(error=>{console.error(error);process.exitCode=1});
