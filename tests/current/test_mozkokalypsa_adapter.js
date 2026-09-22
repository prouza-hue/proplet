// Full pilot adapter with deterministic browser/API doubles, no real account.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('public/app/mozkokalypsa.js','utf8');
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const nodes=new Map(),local=new Map(),events={},sent=[];let profile={id:'synthetic-invited',token:'test-only'},revision=0,fail=false,conflict=false;
 const node=(id)=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',classList:{toggle(){},add(){},remove(){},contains(){return true}},querySelector(){return null},querySelectorAll(){return []},replaceChildren(){},appendChild(){},focus(){}});return nodes.get(id)};
 const ctx={URLSearchParams,location:{search:''},localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},crypto:{randomUUID:()=>`event-${sent.length}-${Math.random()}`},console,
  navigator:{onLine:true},document:{querySelector:node,activeElement:null,documentElement:{classList:{contains(){return false}}},addEventListener:(k,f)=>events[k]=f,createElement:()=>node(Math.random())},
  addEventListener(){},getProfile:()=>profile,gameElapsed:g=>g.elapsedMs,showToast(){},confirm:()=>true,
  performance:{now:()=>123},stopTimer(){},releaseGameWakeLock(){},renderGameBoard(){},renderGameHUD(){},fmtTime:()=>'',nav(){},
  startGame:async(p)=>{ctx.currentGame={mode:'playtest',puzzle:p,elapsedMs:500,found:[],moves:0};await ctx.PropletPlaytest.prepare(p);ctx.PropletPlaytest.attach(ctx.currentGame)},
  api:async(path,opts={})=>{
   if(path.includes('/status'))return {eligible:profile?.id==='synthetic-invited',qa:false,order:['mk26-01'],attempts:[]};
   if(path.includes('/open/'))return {puzzle:{id:'mk26-01'},attempt:{id:'attempt',board_id:'mk26-01',revision,progress:{}}};
   const body=JSON.parse(opts.body);sent.push(body);
   assert.equal(opts.authProfile.id,'synthetic-invited');
   if(fail)throw new Error('synthetic offline');
   if(conflict)throw Object.assign(new Error('synthetic concurrent write'),{status:409});
   assert.equal(body.revision,revision);return {revision:++revision};
  }};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);await tick();
 // Native hub -> launch rather than editing the closure's active state.
 let buttons=[];node('#mkBoardList').appendChild=b=>buttons.push(b);
 await ctx.PropletPlaytest.hub();await buttons[0].onclick();
 const g=ctx.currentGame;await ctx.PropletPlaytest.record('correct',g);
 assert.equal(revision,1);
 fail=true;await ctx.PropletPlaytest.record('wrong',g);
 assert.equal(revision,1);assert.equal(JSON.parse([...local.values()][0]).attempts['mk26-01'].pending.length,1);
 fail=false;await ctx.PropletPlaytest.flush();assert.equal(revision,2);
 // Last word/finish/feedback may be followed by navigation and visibility events.
 g.finished=true;await ctx.PropletPlaytest.record('finish',g);
 const done=revision;await ctx.PropletPlaytest.record('leave',g);await ctx.PropletPlaytest.record('resume',g);
 assert.equal(revision,done,'post-finish leave must not lock the completed attempt');
 await ctx.PropletPlaytest.record('feedback',g,{difficulty:4,fun:5});assert.equal(revision,done+1);
 // Concurrent-device divergence is kept locally, never silently merged or dropped.
 conflict=true;await ctx.PropletPlaytest.record('feedback',g,{fun:4});
 let row=JSON.parse([...local.values()][0]).attempts['mk26-01'];assert(row.conflict&&row.pending.length===1);
 const n=sent.length;await ctx.PropletPlaytest.flush();assert.equal(sent.length,n,'no retry loop on a conflict');
 // Switching accounts cannot flush another player's outbox.
 profile={id:'synthetic-outsider',token:'outsider'};await ctx.PropletPlaytest.refresh();await ctx.PropletPlaytest.flush();
 assert.equal(sent.length,n);assert.equal(JSON.parse(local.get('proplet-playtest:mozkokalypsa-20260922-v1:synthetic-invited')).attempts['mk26-01'].pending.length,1);
 console.log('PASS full adapter: native launch, first-load check, offline retry, post-finish guard, CAS conflict, account isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
