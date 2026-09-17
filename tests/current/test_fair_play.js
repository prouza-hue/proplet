const assert=require('node:assert/strict');
const {mergeProgress,create}=require('../../public/app/core/storage.js');
const {create:session}=require('../../public/app/account/session.js');
const {create:clock}=require('../../public/app/game/state.js');
const old={puzzleId:'p',mode:'daily',attemptId:'old',elapsedMs:1000,moves:0,found:[]};
const guest={...old,attemptId:'guest',elapsedMs:20000,moves:1,hints:1,found:[{answerIndex:0,word:'TEST',path:[0,1,2,3]}]};
const merged=mergeProgress(old,guest);
assert.equal(merged.elapsedMs,20000);assert.equal(merged.found.length,1);assert.equal(merged.hints,1);assert.equal(merged.mergedAttempts,true);
assert.equal(mergeProgress(merged,guest).elapsedMs,20000);
assert.equal(mergeProgress(merged,{...guest,elapsedMs:30000}).elapsedMs,30000);
const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const core=create({storage});core.writeState('s',{completed:{},inProgress:{key:guest}},'guest');core.writeState('s',{completed:{},inProgress:{key:old}},'p');
session({storage,adoptGuestData:id=>core.adoptGuest({profileId:id,stateKey:'s',queueKey:'q'})}).accept({id:'p',token:'synthetic'});
assert.equal(core.readState('s','p').inProgress.key.elapsedMs,20000);
core.writeState('s',{completed:{},inProgress:{key:guest}},'guest');storage.setItem=()=>{throw Error('quota')};
assert.equal(core.adoptGuest({profileId:'p',stateKey:'s',queueKey:'q'}),false);assert(data.has('s:guest'));
let now=20000;const game=clock({performanceNow:()=>now});game.replace({start:0,baseElapsedMs:0,mode:'daily',puzzle:{id:'p'},dailyDate:'2026-09-17',found:[],finished:false});game.pause();now=80000;assert.equal(game.elapsed(),20000);game.resume();now=81000;assert.equal(game.elapsed(),21000);
console.log('PASS guest merge, monotonic clock, retry and quota retention, intentional pauses');

(async()=>{
 const {create:fairPlay}=require('../../public/app/game/fair-play.js');
 let fail=false,finished=false,completed=false,timers=0,claimed=0;
 const controller=fairPlay({owner:'synthetic-owner',profile:()=>null,elapsed:g=>g.baseElapsedMs||0,key:(m,p)=>m+':'+p.id,now:()=>100,
  completed:()=>completed,claim:async()=>claimed++,setInterval:()=>++timers,clearInterval:()=>timers--,
  api:async(path,opts)=>{if(path.endsWith('/config'))return {enabled:true};if(fail)throw Error('network');return {attempt_id:'server-attempt',verified:true,finished,elapsed_ms:20000,progress:{elapsedMs:20000,found:[{answerIndex:0,path:[0]}],moves:1}};}});
 for(const mode of ['daily','free','tajenka']){
  const prepared=await controller.prepare({id:'p'},mode,null,null);
  assert.equal(prepared.restored.elapsedMs,20000);assert.equal(prepared.restored.found.length,1);
 }
 const g={puzzle:{id:'p'},mode:'daily',attemptId:'server-attempt',fairPlay:true,found:[],baseElapsedMs:0,pausedAt:null};
 controller.start(g);controller.start(g);assert.equal(timers,1);
 await controller.pause(g);assert.equal(timers,0);
 await controller.resume(g);assert.equal(claimed,1);assert.equal(g.baseElapsedMs,20000);assert.equal(g.found.length,1);
 fail=true;await controller.send(g,'pulse');assert.equal(!!g.timingUnverified,false);
 await controller.finish(g);assert.equal(g.timingUnverified,true);
 fail=false;finished=true;
 assert.equal((await controller.prepare({id:'p'},'daily',null,null)).restored.found.length,1);
 completed=true;assert.equal((await controller.prepare({id:'p'},'daily',null,null)).replay,true);
 console.log('PASS session restore, single heartbeat, pause cleanup, transient retry, offline finish and receipt recovery');
})().catch(error=>{console.error(error);process.exitCode=1});

// Exercise the actual app adapter with receiver-sensitive browser timers.
const appSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../public/app.js'),'utf8');
const timerAdapter=appSource.match(/now:\(\)=>performance.now\(\),(setInterval:.*?),status:renderTimingStatus/)[1];
const host={setInterval(fn,ms){assert.equal(this,host);assert.equal(ms,15000);return 7},clearInterval(id){assert.equal(this,host);assert.equal(id,7)}};
const adapter=require('node:vm').runInNewContext('({'+timerAdapter+'})',{window:host});
adapter.clearInterval(adapter.setInterval(()=>{},15000));
console.log('PASS browser timer adapter preserves the Window receiver');
