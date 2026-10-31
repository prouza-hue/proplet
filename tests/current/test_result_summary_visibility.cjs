'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/challenge-cta-v3333.js','utf8'),app=fs.readFileSync('public/app.js','utf8');
const classes=new Set(),frames=[],observations=[],events={};let writes=0,rows=[],profile={id:'p',token:'fixture'};
const modal={classList:{contains:n=>classes.has(n),toggle(n,on){writes++;on?classes.add(n):classes.delete(n);}}};
const box={resultContext:null,querySelectorAll:s=>{assert.equal(s,'.result-player-row.me');return rows;}};
const ctx={$:s=>s==='#winModal'?modal:s==='#levelLeaderboardBox'?box:null,currentGame:null,getProfile:()=>profile,navigator:{onLine:true},document:{addEventListener:(n,f)=>events[n]=f},window:{addEventListener:(n,f)=>events[n]=f,matchMedia:()=>({addEventListener(){}})},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){observations.push({target,fn:this.fn});}},setClass:(el,name,on)=>{if(el.classList.contains(name)!==on)el.classList.toggle(name,on);}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function ownRowRepresentsResult('),source.indexOf('  function referralChoiceAvailable(')),ctx);
const game={mode:'free',finished:true,puzzle:{id:'board-a'},attemptId:'attempt-a'},record={mode:'free',puzzleId:'board-a',attemptId:'attempt-a',elapsedMs:154999,moves:7,hintsUsed:2,cleanSolve:false};
ctx.currentGame=game;const row={dataset:{resultElapsed:'154001',resultMoves:'7',resultHints:'2',resultClean:'false'},getClientRects:()=>[{}],closest:()=>null};
const duplicate=()=>classes.has('result-metrics-in-ranking');
ctx.syncResultMetrics();assert(!duplicate(),'loading keeps own summary');
box.resultContext={game,record,profileId:'p'};ctx.syncResultMetrics();assert(!duplicate(),'absent own row keeps own summary');
rows=[row];ctx.syncResultMetrics();assert(duplicate(),'same displayed seconds/moves/hints/clean are redundant');
const stableWrites=writes;for(let n=0;n<100;n++)ctx.syncResultMetrics();assert.equal(writes,stableWrites,'stable observer callbacks do not rewrite the class');
for(const [field,value] of [['resultMoves','8'],['resultHints','0'],['resultClean','true'],['resultElapsed','155000'],['resultElapsed','']]){
 const old=row.dataset[field];row.dataset[field]=value;ctx.syncResultMetrics();assert(!duplicate(),field+' mismatch restores fallback');row.dataset[field]=old;
}
row.getClientRects=()=>[];ctx.syncResultMetrics();assert(!duplicate(),'closed/collapsed/hidden rows do not replace a visible summary');row.getClientRects=()=>[{}];
row.closest=()=>({});ctx.syncResultMetrics();assert(!duplicate(),'busy or hidden ancestor restores summary');row.closest=()=>null;
game.isReplay=true;ctx.syncResultMetrics();assert(!duplicate(),'replay may show an older first result');game.isReplay=false;
const recap={mode:'daily',finished:true,isReplay:true,puzzle:{id:'daily-a'},resultRecord:{...record,mode:'daily',puzzleId:'daily-a'}};
ctx.currentGame=recap;box.resultContext={game:recap,record:recap.resultRecord,profileId:'p'};ctx.syncResultMetrics();assert(duplicate(),'saved recap of the exact loaded record may deduplicate');
box.resultContext.record={...recap.resultRecord};ctx.syncResultMetrics();assert(!duplicate(),'another replay record cannot use the saved-recap exception');
ctx.currentGame=game;box.resultContext={game,record,profileId:'p'};
ctx.currentGame={...game};ctx.syncResultMetrics();assert(!duplicate(),'another attempt cannot reuse old ranking context');ctx.currentGame=game;
profile={id:'different',token:'fixture'};ctx.syncResultMetrics();assert(!duplicate(),'account switch restores fallback');profile={id:'p',token:'fixture'};
const oldAttempt=record.attemptId;record.attemptId='older-attempt';ctx.syncResultMetrics();assert(!duplicate());record.attemptId=oldAttempt;
ctx.navigator.onLine=false;ctx.syncResultMetrics();assert(!duplicate(),'offline retains own summary');ctx.navigator.onLine=true;
box.resultContext=null;ctx.syncResultMetrics();assert(!duplicate(),'error/refresh with stale rows still restores fallback');
// Exercise the real observer wiring: async rows are reconciled in one frame.
ctx.syncShareCtas=ctx.syncResultMetrics;
vm.runInContext(source.slice(source.indexOf('  function boot(){'),source.indexOf('\n  if(document.readyState')),ctx);ctx.boot();
const rankingObserver=observations.find(o=>o.target===box);assert(rankingObserver);
box.resultContext={game,record,profileId:'p'};rankingObserver.fn([]);rankingObserver.fn([]);assert.equal(frames.length,1);frames.shift()();assert(duplicate());
ctx.navigator.onLine=false;events.offline();frames.shift()();assert(!duplicate());ctx.navigator.onLine=true;events.online();frames.shift()();assert(duplicate());
// No presentation operation mutates source scores or attempts.
assert.equal(record.elapsedMs,154999);assert.equal(row.dataset.resultElapsed,'154001');

// Daily requests now have the same stale-game/account guard as Free and Extra.
async function dailyGuards(){
 let pending=[],current={mode:'daily',puzzle:{id:'daily-a'}},actor={id:'A',token:'A-token'};
 const target={classList:{add(){},remove(){}},innerHTML:'',resultContext:'old'},rendered=[];
 const d={$:()=>target,currentGame:current,getProfile:()=>actor,api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),transformRankingPayload:x=>x,renderDailyGlobalLeaderboardBox:(el,data)=>{rendered.push(data);el.innerHTML='loaded';},esc:String,winDailyGlobalData:null};
 vm.createContext(d);vm.runInContext(app.slice(app.indexOf('async function loadWinDailyGlobalLeaderboard('),app.indexOf('async function loadWinSpecialLeaderboard(')),d);
 const first=d.loadWinDailyGlobalLeaderboard('2026-10-27',record);assert.equal(target.resultContext,null);
 d.currentGame={mode:'daily',puzzle:{id:'daily-b'}};pending.shift().resolve({tag:'stale'});await first;assert.equal(rendered.length,0);
 const second=d.loadWinDailyGlobalLeaderboard('2026-10-27',record);actor={id:'B',token:'B-token'};pending.shift().resolve({tag:'other-account'});await second;assert.equal(rendered.length,0);
 const third=d.loadWinDailyGlobalLeaderboard('2026-10-27',record);pending.shift().reject(Error('offline'));await third;assert.equal(target.resultContext,null);assert(target.innerHTML.includes('Výsledek tím není ohrožený'));
 const fourth=d.loadWinDailyGlobalLeaderboard('2026-10-27',record);pending.shift().resolve({tag:'current'});await fourth;assert.equal(rendered.length,1);assert.equal(target.resultContext.game,d.currentGame);assert.equal(target.resultContext.record,record);
}
dailyGuards().then(()=>console.log('PASS result deduplication: exact visible own metrics, safe fallback, coalesced async updates and Daily response identity')).catch(e=>{console.error(e);process.exitCode=1;});
