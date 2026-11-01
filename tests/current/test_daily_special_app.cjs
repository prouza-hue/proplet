'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../public/app.js'),'utf8');
const Game=require('../../public/app/game/state.js');
const Special=require('../../public/app/content/daily-special.js');
const storage=new Map(),nodes=new Map();
function node(selector){
 if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},dataset:{},style:{},before(){},append(){},replaceChildren(){},contains:()=>true});
 return nodes.get(selector);
}
const context={console,URL,URLSearchParams,setTimeout,clearTimeout,setInterval,clearInterval,location:{hostname:'localhost',search:'',href:'https://hrajproplet.cz/'},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},performance:{now:()=>5000},navigator:{onLine:true},window:null,CustomEvent:class{}};
context.window=context;vm.createContext(context);vm.runInContext(source,context);
let receipt={finished:true},savedPending=0,pendingMessage='';
let state={completed:{},inProgress:{},rescues:{}},records=[],leaderboards=[];
const game=Game.create({readState:()=>state,writeState:value=>state=value,performanceNow:()=>5000,dateNow:()=>Date.parse('2026-10-21T12:00:00Z'),colorCount:4});
Object.assign(context,{document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>node('generated')},gameSession:()=>game,getState:()=>state,saveState:value=>state=value,getProfile:()=>null,pragueDateISO:()=> '2026-10-21',localFreeSlotState:()=>({actual:new Set(),effective:new Set(),transferred:new Set()}),tajenkaState:()=>({completions:{}}),saveGameProgress:()=>savedPending++,message:text=>pendingMessage=text,fairPlay:()=>({finish:async()=>receipt}),runGameCompletionHooks:async()=>{},sleep:async()=>{},releaseGameWakeLock(){},renderGameBoard(){},renderGameHUD(){},updateGameFeel(){},renderCompletionPraise(){},completionAchievements:()=>[],renderWinBadges(){},positionWinBadges(){},updateWinAccountCta(){},renderWinFeedback(){},confetti(){},fx(){},renderDaily(){},renderFree(){},renderProfile(){},queueResult:record=>records.push(record),finishAttemptTelemetry:async()=>{},loadWinLevelLeaderboard:async()=>{},loadWinSpecialLeaderboard:async(_date,record)=>leaderboards.push(record.challengeKey),loadWinDailyGlobalLeaderboard:async(date)=>leaderboards.push('daily:'+date)});
vm.runInContext('puzzleDB={freeGeneration:6,free:{}};',context);
const date='2026-10-21',hash='a'.repeat(64),answer={word:'AB',path:[0,1]},base={id:'base',difficulty:'medium',answers:[answer],letters:['A','B'],meta:{cells:2}};
const store=Special.create({dateISO:()=>date});
const descriptor=store.remember({schemaVersion:1,serverToday:date,validUntil:'2026-10-21T22:00:00Z',dailyDate:date,difficulty:'hardcore',bankVersion:'special-v1',contentHash:hash,challengeKey:`daily-special:${date}:hardcore`,puzzleId:'special',puzzle:{...base,id:'special',difficulty:'hardcore'},official:true,rewardEligible:true});
function run(puzzle,mode,attemptId){return {puzzle,mode,fairPlay:mode==='daily_special',dailyDate:date,attemptId,found:[{...answer,answerIndex:0,colorIndex:0}],moves:1,hints:0,wrongAttempts:0,maxHintLevel:0,start:0,baseElapsedMs:0,finished:false};}

(async()=>{
 for(const order of [['daily_special','daily'],['daily','daily_special']]){
  state={completed:{},inProgress:{},rescues:{}};records=[];leaderboards=[];
  for(const mode of order){game.replace(run(mode==='daily'?base:descriptor.puzzle,mode,mode+'-attempt'));await context.finishGame();}
  const stats=context.currentLocalStats();assert.equal(Object.keys(state.completed).length,2);assert.equal(stats.points,300);assert.equal(stats.dailyCompleted,1);assert.equal(stats.dailySpecialCompleted,1);assert.equal(stats.dailyChallengeCompleted,2);assert.equal(stats.totalCompleted,1,'legacy badge total stays base/free');assert.equal(stats.currentStreak,1);assert.equal(stats.cleanDaily,1);assert.equal(stats.cleanSolves,1);
  assert(records.some(row=>row.challengeKey==='daily:'+date));const special=records.find(row=>row.mode==='daily_special');assert.equal(special.contentHash,hash);assert.equal(special.points,200);assert.equal(special.level,null);assert.equal(special.official,true);assert(leaderboards.includes(descriptor.challengeKey));
  const original=state.completed[descriptor.challengeKey],practice=store.asPractice(descriptor);
  game.replace(run(practice.puzzle,'daily_special','practice-attempt'));await context.finishGame();
  assert.equal(Object.keys(state.completed).length,2,'practice never adds official completion');assert.equal(state.completed[descriptor.challengeKey],original,'practice cannot replace first official result');assert.equal(records.at(-1).points,0);assert.equal(records.at(-1).rewardEligible,false);assert.match(records.at(-1).challengeKey,/^daily-special-practice:/);assert.equal(game.get().winBaseXpAwarded,0);
 }
 state={completed:{},inProgress:{},rescues:{}};game.replace(run(descriptor.puzzle,'daily_special','only-special'));await context.finishGame();
 const only=context.currentLocalStats();assert.equal(only.dailyCompleted,0);assert.equal(only.currentStreak,0);assert.equal(only.cleanDaily,0);assert.equal(only.totalCompleted,0);assert.equal(only.dailyChallengeCompleted,1);
 const payload=context.queuedResultPayload(records.at(-1));assert.equal(payload.content_hash,hash);assert.equal(payload.mode,'daily_special');assert.equal(payload.daily_date,date);
 const rec=state.completed[descriptor.challengeKey];const snapshot=context.dailyResultSnapshot(descriptor.puzzle,date,rec,'daily_special');game.replace(snapshot);const shared=context.shareText();assert.match(shared,/speciál Mozkožrout/);assert.match(shared,/open=daily-special/);assert.doesNotMatch(shared,/🔥/,'special share does not imply streak credit');
 // Reopening a saved Extra result shows its stored completion reward.
 Object.assign(context,{datedSpecial:()=>({historical:async()=>descriptor}),renderTimingStatus(){}});
 await context.showSpecialResult(date,{...rec,points:200});assert.equal(node('#winXp').textContent,'+200 XP');
 await context.showSpecialResult(date,{...rec,points:100});assert.equal(node('#winXp').textContent,'+100 XP','historical reward remains truthful');
 // Missing/refused receipt must retain the run without XP or a queued result.
 for(const confirmation of [null,{finished:false}]){
  receipt=confirmation;state={completed:{},inProgress:{},rescues:{}};records=[];leaderboards=[];savedPending=0;
  game.replace(run(descriptor.puzzle,'daily_special','pending-special'));await context.finishGame();
  assert.equal(game.get().finished,false);assert.equal(game.get().finishing,false);
  assert.equal(Object.keys(state.completed).length,0);assert.equal(records.length,0);assert.equal(leaderboards.length,0);
  assert.equal(savedPending,1);assert.match(pendingMessage,/potvrzení/);
  receipt={finished:true};await context.finishGame();
  assert.equal(Object.keys(state.completed).length,1);assert.equal(records.length,1);
 }
 // Anchored Daily/Free completion cannot enter the result queue before server finish.
 for(const mode of ['daily','free']){
  receipt=null;state={completed:{},inProgress:{},rescues:{}};records=[];savedPending=0;
  game.replace({...run(base,mode,'anchored-'+mode),fairPlay:true,serverTimingAnchored:true});
  await context.finishGame();assert.equal(game.get().finished,false);assert.equal(records.length,0);assert.equal(savedPending,1);
  receipt={finished:true};await context.finishGame();assert.equal(game.get().finished,true);assert.equal(records.length,1);
 }
 // Proof that the result already exists must not get stuck waiting for a second finish.
 receipt=null;state={completed:{},inProgress:{},rescues:{}};records=[];
 game.replace({...run(base,'daily','already-committed'),fairPlay:false,serverTimingAnchored:true,remoteCommitted:true});
 await context.finishGame();assert.equal(game.get().finished,true);assert.equal(records.length,0,'remote receipt cannot enqueue another award');
 // A terminal server duration limit is shown verbatim, never overwritten by a retry hint.
 state={completed:{},inProgress:{},rescues:{}};records=[];pendingMessage='';
 const terminal='Tento pokus přesáhl nejdelší podporovanou dobu měření (24 dní).';
 game.replace({...run(base,'daily','duration-limit'),fairPlay:false,serverTimingAnchored:true,fairPlayError:terminal});
 await context.finishGame();assert.equal(pendingMessage,terminal);assert.equal(game.get().finished,false);assert.equal(game.get().finishRetryTimer,null);assert.equal(records.length,0);
 console.log('PASS actual app finish: base/special in both orders,200XP isolation, unchanged badge/streak counters, practice once-only, payload/hash, result snapshot and share link');
})().catch(error=>{console.error(error);process.exit(1)});
