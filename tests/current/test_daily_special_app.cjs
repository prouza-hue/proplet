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
let state={completed:{},inProgress:{},rescues:{}},records=[],leaderboards=[];
const game=Game.create({readState:()=>state,writeState:value=>state=value,performanceNow:()=>5000,dateNow:()=>Date.parse('2026-10-21T12:00:00Z'),colorCount:4});
Object.assign(context,{document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>node('generated')},gameSession:()=>game,getState:()=>state,saveState:value=>state=value,getProfile:()=>null,pragueDateISO:()=> '2026-10-21',localFreeSlotState:()=>({actual:new Set(),effective:new Set(),transferred:new Set()}),tajenkaState:()=>({completions:{}}),runGameCompletionHooks:async()=>{},sleep:async()=>{},releaseGameWakeLock(){},renderGameBoard(){},renderGameHUD(){},updateGameFeel(){},renderCompletionPraise(){},renderRunWinXp(){},completionAchievements:()=>[],renderWinBadges(){},updateWinAccountCta(){},renderWinFeedback(){},confetti(){},fx(){},renderDaily(){},renderFree(){},renderProfile(){},queueResult:record=>records.push(record),finishAttemptTelemetry:async()=>{},loadWinSpecialLeaderboard:async(_date,record)=>leaderboards.push(record.challengeKey),loadWinDailyGlobalLeaderboard:async(date)=>leaderboards.push('daily:'+date)});
vm.runInContext('puzzleDB={freeGeneration:6,free:{}};',context);
const date='2026-10-21',hash='a'.repeat(64),answer={word:'AB',path:[0,1]},base={id:'base',difficulty:'medium',answers:[answer],letters:['A','B'],meta:{cells:2}};
const store=Special.create({dateISO:()=>date});
const descriptor=store.remember({schemaVersion:1,serverToday:date,validUntil:'2026-10-21T22:00:00Z',dailyDate:date,difficulty:'hardcore',bankVersion:'special-v1',contentHash:hash,challengeKey:`daily-special:${date}:hardcore`,puzzleId:'special',puzzle:{...base,id:'special',difficulty:'hardcore'},official:true,rewardEligible:true});
function run(puzzle,mode,attemptId){return {puzzle,mode,dailyDate:date,attemptId,found:[{...answer,answerIndex:0,colorIndex:0}],moves:1,hints:0,wrongAttempts:0,maxHintLevel:0,start:0,baseElapsedMs:0,finished:false};}

(async()=>{
 for(const order of [['daily_special','daily'],['daily','daily_special']]){
  state={completed:{},inProgress:{},rescues:{}};records=[];leaderboards=[];
  for(const mode of order){game.replace(run(mode==='daily'?base:descriptor.puzzle,mode,mode+'-attempt'));await context.finishGame();}
  const stats=context.currentLocalStats();assert.equal(Object.keys(state.completed).length,2);assert.equal(stats.points,200);assert.equal(stats.dailyCompleted,1);assert.equal(stats.dailySpecialCompleted,1);assert.equal(stats.dailyChallengeCompleted,2);assert.equal(stats.totalCompleted,1,'legacy badge total stays base/free');assert.equal(stats.currentStreak,1);assert.equal(stats.cleanDaily,1);assert.equal(stats.cleanSolves,1);
  assert(records.some(row=>row.challengeKey==='daily:'+date));const special=records.find(row=>row.mode==='daily_special');assert.equal(special.contentHash,hash);assert.equal(special.points,100);assert.equal(special.level,null);assert.equal(special.official,true);assert(leaderboards.includes(descriptor.challengeKey));
  const original=state.completed[descriptor.challengeKey],practice=store.asPractice(descriptor);
  game.replace(run(practice.puzzle,'daily_special','practice-attempt'));await context.finishGame();
  assert.equal(Object.keys(state.completed).length,2,'practice never adds official completion');assert.equal(state.completed[descriptor.challengeKey],original,'practice cannot replace first official result');assert.equal(records.at(-1).points,0);assert.equal(records.at(-1).rewardEligible,false);assert.match(records.at(-1).challengeKey,/^daily-special-practice:/);assert.equal(game.get().winBaseXpAwarded,0);
 }
 state={completed:{},inProgress:{},rescues:{}};game.replace(run(descriptor.puzzle,'daily_special','only-special'));await context.finishGame();
 const only=context.currentLocalStats();assert.equal(only.dailyCompleted,0);assert.equal(only.currentStreak,0);assert.equal(only.cleanDaily,0);assert.equal(only.totalCompleted,0);assert.equal(only.dailyChallengeCompleted,1);
 const payload=context.queuedResultPayload(records.at(-1));assert.equal(payload.content_hash,hash);assert.equal(payload.mode,'daily_special');assert.equal(payload.daily_date,date);
 const rec=state.completed[descriptor.challengeKey];const snapshot=context.dailyResultSnapshot(descriptor.puzzle,date,rec,'daily_special');game.replace(snapshot);const shared=context.shareText();assert.match(shared,/speciál Mozkožrout/);assert.match(shared,/open=daily-special/);assert.doesNotMatch(shared,/🔥/,'special share does not imply streak credit');
 console.log('PASS actual app finish: base/special in both orders,100XP isolation, unchanged badge/streak counters, practice once-only, payload/hash, result snapshot and share link');
})().catch(error=>{console.error(error);process.exit(1)});
