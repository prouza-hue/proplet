// Exercise privacy / reward gating without simulating the app's visual implementation.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/team-victories.js','utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(options={}){
  const events={},calls=[],nodes=[],timers=[];
  let account={id:'a',token:'token-a',familyCode:'TEAM'};
  let responder=options.responder||(()=>Promise.resolve({enabled:false}));
  const screen={id:'screen-game'};
  const document={hidden:false,activeElement:null,body:{append:n=>nodes.push(n)},addEventListener:(name,fn)=>{events[name]=fn;},querySelector:s=>s==='.screen.active'?screen:null,querySelectorAll:()=>[],createElement:tag=>({tag,open:false,addEventListener(){},close(){this.open=false},showModal(){this.open=true},querySelector(){return {focus(){}}},querySelectorAll(){return []},setAttribute(){}})};
  const context={document,location:{search:''},URLSearchParams,Intl,Date,Number,String,Set,Promise,Math,queueMicrotask,setTimeout:fn=>timers.push(fn),clearTimeout(){},MutationObserver:class{observe(){}},getProfile:()=>account,api:(path,opts)=>{calls.push({path,opts});return responder(path,opts);},currentGame:{finished:true,mode:'daily',puzzle:{id:'p'},attemptId:'run'},matchMedia:()=>({matches:true})};
  context.window=context;context.window.addEventListener=()=>{};context.PROPLET_RUNTIME_ENV=options.preview?'preview':'production';
  vm.createContext(context);vm.runInContext(source,context);
  return {context,events,calls,nodes,timers,setAccount:p=>account=p,setResponder:r=>responder=r,profile:()=>account,start:async()=>{events['proplet:ready']();await tick();},result:record=>context.PropletTeamVictories.resultConfirmed({mode:'daily',puzzleId:'p',attemptId:'run',completedAt:new Date().toISOString(),...record},{awardedPoints:100},account)};
}
test('preview boundary makes no rewards or acknowledgement request',async()=>{const h=harness({preview:true});await h.start();h.result();await tick();assert.equal(h.calls.length,0);});
test('stale account, calm play, old queue, zero XP never trigger rewards refresh',async()=>{
 const h=harness();await h.start();h.calls.length=0;
 h.context.PropletTeamVictories.resultConfirmed({mode:'daily',puzzleId:'p',completedAt:new Date().toISOString()},{awardedPoints:100},{id:'other',token:'other',familyCode:'TEAM'});
 h.result({calmMode:true});h.result({puzzleId:'previous-puzzle'});h.result({attemptId:'old-attempt'});h.result({completedAt:'2020-01-01T00:00:00Z'});
 h.context.PropletTeamVictories.resultConfirmed({mode:'daily',puzzleId:'p',completedAt:new Date().toISOString()},{awardedPoints:0},h.profile());
 h.context.currentGame=null;h.result();await tick();assert.equal(h.calls.length,0);
});
test('a confirmed matching game requests authoritative eligibility',async()=>{const h=harness();await h.start();h.calls.length=0;h.result();await tick();assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/team-victories');assert.equal(h.calls[0].opts.authProfile.id,'a');});
test('a stale asynchronous response cannot acknowledge or render for another account',async()=>{
 let resolve;const h=harness({responder:()=>new Promise(r=>resolve=r)});h.events['proplet:ready']();
 h.setAccount({id:'b',token:'token-b',familyCode:'OTHER'});
 resolve({enabled:true,team:{name:'PRIVATE OLD TEAM'},pendingAward:{id:'foreign'},intro:{eligible:true,seen:false}});await tick();
 for(const timer of h.timers)timer();await tick();
 assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,0);
 assert.ok(h.nodes.every(n=>!String(n.innerHTML).includes('PRIVATE OLD TEAM')));
});
