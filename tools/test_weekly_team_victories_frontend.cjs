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
  const screen={id:options.screen||'screen-game'};
  let blocked=false;
  const anchor={after:n=>nodes.push(n)};
  const document={hidden:false,activeElement:null,body:{append:n=>nodes.push(n)},addEventListener:(name,fn)=>{events[name]=fn;},querySelector:s=>s==='.screen.active'?screen:s==='#profileCard .profile-grid'?anchor:s==='#profileTeamVictories'?nodes.find(n=>n.id==='profileTeamVictories'):s==='.modal:not(.hidden),dialog[open]'?(blocked?{}:null):null,querySelectorAll:()=>[],createElement:tag=>({tag,open:false,remove(){const i=nodes.indexOf(this);if(i>=0)nodes.splice(i,1)},addEventListener(){},close(){this.open=false},showModal(){this.open=true},querySelector(){return {focus(){},addEventListener(){},classList:{toggle(){},add(){}}}},querySelectorAll(){return []},setAttribute(){}})};
  const context={document,location:{search:options.search||''},URLSearchParams,Intl,Date,Number,String,Set,Promise,Math,queueMicrotask,setTimeout:fn=>timers.push(fn),clearTimeout(){},MutationObserver:class{observe(){}},getProfile:()=>account,api:(path,opts)=>{calls.push({path,opts});return responder(path,opts);},currentGame:{finished:true,mode:'daily',puzzle:{id:'p'},attemptId:'run'},matchMedia:()=>({matches:true})};
  context.window=context;context.window.addEventListener=()=>{};context.PROPLET_RUNTIME_ENV=options.preview?'preview':'production';
  context.PROPLET_RUNTIME_META={environment:options.preview?'preview':'production',gen5CandidatePreview:!!options.gen5};
  if(Object.hasOwn(options,'live'))context.livePlayerPreview=()=>options.live;
  vm.createContext(context);vm.runInContext(source,context);
  return {context,events,calls,nodes,timers,screen,setBlocked:b=>blocked=b,setAccount:p=>account=p,setResponder:r=>responder=r,profile:()=>account,start:async()=>{events['proplet:ready']();await tick();},result:record=>context.PropletTeamVictories.resultConfirmed({mode:'daily',puzzleId:'p',attemptId:'run',completedAt:new Date().toISOString(),...record},{awardedPoints:100},account)};
}
test('preview boundary makes no rewards or acknowledgement request',async()=>{const h=harness({preview:true});await h.start();h.result();await tick();assert.equal(h.calls.length,0);});

test('server-confirmed live preview loads actual personal trophies with the current account',async()=>{
 const h=harness({preview:true,live:true,screen:'screen-profile',responder:()=>Promise.resolve({enabled:true,totalGold:1,history:[{teamName:'Skutečný tým',weekStart:'2026-10-05',weekEnd:'2026-10-12',xp:100}]})});
 h.setAccount({id:'a',token:'token-a',familyCode:null});
 await h.start();await tick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/team-victories/personal');assert.equal(h.calls[0].opts.authProfile.id,'a');
 assert.match(h.nodes.find(n=>n.id==='profileTeamVictories').innerHTML,/Skutečný tým/);
 assert.equal(h.calls.filter(c=>c.opts?.method==='POST').length,0,'reading profile trophies does not acknowledge an award');
 assert.equal(h.context.PROPLET_RUNTIME_ENV,'preview','live preview retains its own environment');
});

test('tutorial, Gen5 and unconfirmed preview stay closed even with profile navigation',async()=>{
 for(const options of [{preview:true},{preview:true,live:false},{preview:true,live:'true'},{preview:true,live:true,search:'?tutorial=1'},{preview:true,live:true,gen5:true}]){
  const h=harness({...options,screen:'screen-profile'});await h.start();h.result();h.events['proplet:profile-refreshed']();await tick();
  assert.equal(h.calls.length,0,JSON.stringify(options));assert.equal(h.nodes.some(n=>n.id==='profileTeamVictories'),false);
 }
 const pending=harness({preview:true,screen:'screen-profile'});delete pending.context.PROPLET_RUNTIME_ENV;
 await pending.start();assert.equal(pending.calls.length,0,'preview metadata alone must fail closed before config is confirmed');
});
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


const victory={enabled:true,team:{name:'Tým',totalGold:1},intro:{seen:true},pendingAward:{id:'award-1',weekStart:'2026-10-05',weekEnd:'2026-10-12',teamName:'Tým',totalGold:1,previousGold:0,xp:100}};
test('an earned win appears once on every safe return screen',async()=>{
 for(const id of ['screen-daily','screen-free','screen-profile','screen-leaderboard']){
  const h=harness({screen:id,responder:()=>Promise.resolve(victory)});await h.start();
  for(const t of h.timers)t();await tick();
  assert.equal(h.nodes.find(n=>n.tag==='dialog').open,true,id);
  assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,1,id);
  h.events['proplet:profile-refreshed']();await tick();
  assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,1,id);
 }
});
test('playing or a blocking modal defers the victory without acknowledging it',async()=>{
 const h=harness({responder:()=>Promise.resolve(victory)});await h.start();for(const t of h.timers)t();
 assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,0);
 h.screen.id='screen-free';h.setBlocked(true);h.events['proplet:screen-changed']();await tick();
 assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,0);
 h.setBlocked(false);h.events['proplet:screen-changed']();await tick();
 assert.equal(h.calls.filter(c=>c.path.endsWith('/seen')).length,1);
});
test('personal wins load lazily, deduplicate, and remain visible without a current team',async()=>{
 const personal={enabled:true,totalGold:1,history:[{id:'a',teamName:'Bývalý <tým>',weekStart:'2026-10-05',weekEnd:'2026-10-12',xp:100}]};
 const h=harness({responder:()=>Promise.resolve(personal)});h.setAccount({id:'a',token:'token-a',familyCode:null});await h.start();
 assert.equal(h.calls.length,0);
 h.screen.id='screen-profile';h.events['proplet:screen-changed']();h.events['proplet:profile-refreshed']();await tick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/team-victories/personal');
 const card=h.nodes.find(n=>n.id==='profileTeamVictories');assert.match(card.innerHTML,/První otisk/);assert.match(card.innerHTML,/Bývalý &lt;tým&gt;/);
 h.events['proplet:profile-refreshed']();await tick();assert.equal(h.calls.length,1);
});
test('late personal history cannot populate the next account',async()=>{
 let finish;const h=harness({responder:path=>path.endsWith('/personal')?new Promise(r=>finish=r):Promise.resolve({enabled:false})});await h.start();
 h.screen.id='screen-profile';h.events['proplet:screen-changed']();
 h.setAccount({id:'b',token:'token-b',familyCode:null});
 finish({enabled:true,totalGold:1,history:[{teamName:'SECRET OLD TEAM',weekStart:'2026-10-05',weekEnd:'2026-10-12'}]});await tick();
 assert.ok(h.nodes.every(n=>!String(n.innerHTML).includes('SECRET OLD TEAM')));
});

test('a restored profile opens its personal wins without waiting for another navigation',async()=>{
 const h=harness({screen:'screen-profile',responder:()=>Promise.resolve({enabled:true,totalGold:0,history:[]})});
 h.setAccount({id:'a',token:'token-a',familyCode:null});await h.start();await tick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/team-victories/personal');
 assert.match(h.nodes.find(n=>n.id==='profileTeamVictories').innerHTML,/První zlato čeká/);
});
