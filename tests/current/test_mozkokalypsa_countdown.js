// Deterministic full-adapter coverage; synthetic account, clock and DOM only.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('public/app/mozkokalypsa.js','utf8');
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const serverStart=Date.parse('2026-09-27T20:58:59Z');
 let now=serverStart+7*3600000,serial=0,profile={id:'test-invited'},screen='daily',requests=0,toasts=0;
 const end=serverStart+90061000,timers=new Map(),nodes=new Map(),local=new Map(),docEvents={},winEvents={};
 class TestDate extends Date{static now(){return now}}
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const classes=new Set(id.includes('Modal')?['hidden']:[]);
  const n={textContent:'',value:'',children:[],classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s),toggle(s,on){if(on??!classes.has(s))classes.add(s);else classes.delete(s)}},
   querySelector(sel){return id.includes('Countdown')?node(id+sel):null},querySelectorAll(){return []},replaceChildren(){n.children=[]},appendChild(c){n.children.push(c)},focus(){},
   getClientRects(){return (id==='#mkInviteCountdown'?screen==='daily'&&!node('#mozkokalypsaInvite').classList.contains('hidden'):id==='#mkHubCountdown'?!node('#mkHubModal').classList.contains('hidden'):true)?[{}]:[]}};
  nodes.set(id,n);return n;
 }
 node('#mkInviteProgress').children=Array.from({length:12},(_,i)=>node('mark-'+i));
 function advance(ms){const target=now+ms;let guard=0;while(true){const entry=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;if(++guard>200)throw Error('timer loop');now=entry[1].at;timers.delete(entry[0]);entry[1].fn()}now=target}
 const ctx={URLSearchParams,Date:TestDate,Intl,location:{search:''},localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),
  crypto:{randomUUID:()=>`synthetic-${serial}`},console,navigator:{onLine:true},
  document:{hidden:false,querySelector:node,activeElement:null,addEventListener:(k,f)=>docEvents[k]=f,createElement:()=>node('created-'+(++serial))},
  addEventListener:(k,f)=>winEvents[k]=f,getProfile:()=>profile,showToast:()=>toasts++,nav(){screen='daily'},stopTimer(){},releaseGameWakeLock(){},
  api:async(path)=>{requests++;assert(path.startsWith('/api/mozkokalypsa/status'),'countdown must never post or poll');return profile.id==='test-invited'?{eligible:true,qa:false,serverNow:new Date(now-7*3600000).toISOString(),closesAt:new Date(end).toISOString(),order:Array.from({length:12},(_,i)=>`mk2-${String(i+1).padStart(2,'0')}`),attempts:[]}:{eligible:false}},
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);await settle();
 const digits=(id='#mkInviteCountdown')=>['days','hours','minutes','seconds'].map(k=>node(`${id}[data-mk-time="${k}"]`).textContent).join(':');
 assert.equal(digits(),'01:01:01:01','seven-hour-wrong device clock must use server time');
 assert.match(node('#mkInviteDeadline').textContent,/28\.\s*9\. ve 24:00/);
 assert.equal(timers.size,2,'one expiry timer and one visual timer');
 advance(2100);assert.equal(digits(),'01:01:00:59');assert.equal(requests,1,'no per-second API calls');
 for(let i=0;i<25;i++)ctx.PropletPlaytest.render();assert.equal(timers.size,2,'rerenders do not multiply timers');
 await ctx.PropletPlaytest.hub();assert.equal(digits('#mkHubCountdown'),digits());assert.equal(timers.size,2,'both clocks share one timer');
 node('#mkHubClose').onclick();screen='game';docEvents['proplet:screen-changed']();assert.equal(timers.size,1,'hidden screen stops visual timer');
 now+=60000;screen='daily';docEvents['proplet:screen-changed']();assert.equal(digits(),'01:00:59:59','navigation immediately catches up');
 ctx.document.hidden=true;docEvents.visibilitychange();assert.equal(timers.size,1);now+=65000;
 ctx.document.hidden=false;docEvents.visibilitychange();assert.equal(digits(),'01:00:58:54','background sleep does not drift');
 winEvents.pagehide();assert.equal(timers.size,1);winEvents.pageshow();assert.equal(timers.size,2);
 const storageKey='proplet-playtest:mozkokalypsa-round2-20260925:test-invited';
 const attempts={};for(let i=1;i<=12;i++){const id=`mk2-${String(i).padStart(2,'0')}`;attempts[id]={board_id:id,completed:true,reward_points:0}}
 local.set(storageKey,JSON.stringify({attempts}));ctx.PropletPlaytest.render();assert.equal(node('#mkInviteButton').textContent,'Doplnit hodnocení');assert.match(node('#mkInviteProgressText').textContent,/12\/12 dohráno · 0 ohodnoceno/);
 for(const a of Object.values(attempts))a.reward_points=200;
 local.set(storageKey,JSON.stringify({attempts}));ctx.PropletPlaytest.render();assert.equal(node('#mkInviteTitle').textContent,'Druhé kolo pokořeno.');assert.equal(node('#mkInviteButton').textContent,'Prohlédnout druhé kolo');
 profile={id:'outsider'};await ctx.PropletPlaytest.refresh();assert(node('#mozkokalypsaInvite').classList.contains('hidden'));assert.equal(timers.size,0,'account switch clears timers');
 profile={id:'test-invited'};now=end+7*3600000-1500;await ctx.PropletPlaytest.refresh();await ctx.PropletPlaytest.hub();assert.equal(digits(),'00:00:00:02');
 advance(2500);assert(node('#mozkokalypsaInvite').classList.contains('hidden'));assert(node('#mkHubModal').classList.contains('hidden'));assert.equal(toasts,1,'expiry fires exactly once');assert.equal(timers.size,0,'expiry leaves no ticker');
 assert(local.has(storageKey),'expiry preserves all progress');
 console.log('PASS countdown: actual second ticks, server skew, one local timer, no network polling, dual clocks, navigation, background/resume, account switch, missing ratings, completed state, exact expiry');
})().catch(e=>{console.error(e);process.exitCode=1});
