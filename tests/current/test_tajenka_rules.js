const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('public/app.js','utf8');
const code=app.slice(app.indexOf('function tajenkaRulesKey(){'),app.indexOf('function startStarter(){'));
let hidden=true,paused=0,resumed=0,scope='guest';const storage=new Map();
const modal={classList:{contains:()=>hidden,add:()=>hidden=true,remove:()=>hidden=false}};
const ctx={currentGame:{mode:'tajenka'},playerScope:()=>scope,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},$:s=>s==='#tajenkaRulesModal'?modal:{focus(){}},pauseGameClock:()=>paused++,resumeGameClock:()=>resumed++};
vm.createContext(ctx);vm.runInContext(code,ctx);
assert.equal(ctx.tajenkaRulesSeen(),false);ctx.openTajenkaRules();assert.equal(hidden,false);assert.equal(paused,1);assert.equal(ctx.tajenkaRulesSeen(),false);
ctx.closeTajenkaRules();assert.equal(hidden,true);assert.equal(resumed,1);assert.equal(ctx.tajenkaRulesSeen(),true);
ctx.closeTajenkaRules();assert.equal(resumed,1);ctx.openTajenkaRules();assert.equal(hidden,false);assert.equal(paused,2);ctx.closeTajenkaRules();
scope='another-player';assert.equal(ctx.tajenkaRulesSeen(),false);ctx.currentGame.mode='free';ctx.openTajenkaRules();assert.equal(hidden,true);
const resume=app.slice(app.indexOf('function resumeGameClock('),app.indexOf('async function acquireGameWakeLock(){'));
hidden=false;
const guard={...ctx,$:()=>modal,gameSession:()=>{throw Error('must not resume while rules are open')}};vm.createContext(guard);vm.runInContext(resume,guard);assert.equal(guard.resumeGameClock(),false);
assert(app.includes("else if(modal.id==='tajenkaRulesModal')closeTajenkaRules()"));
console.log('PASS: Tajenka rules persist per player, reopen, pause and block background resume.');

// The Neruda quote shipped with KDO as answer 0. Old games store those original indices.
const bank=JSON.parse(fs.readFileSync('data/tajenka_weekend_v2.json','utf8'));
const quote=bank.puzzles.find(p=>p.sourceId==='tajenka-v2-c56');
const slots={},progress={};
const gameContext={COLORS:['green','red','blue','yellow'],esc:String,$:id=>({
 '#tajenkaPhrase':{classList:{remove(){}}},'#tajenkaSlots':slots,'#tajenkaProgress':progress
}[id])};
vm.createContext(gameContext);
for(const [start,end] of [
 ['function playableTajenkaPuzzle(', 'function adjacentPuzzleCells('],
 ['function tajenkaFoundFromState(', 'function savedTajenkaProgress('],
 ['function tajenkaPhraseWords(', 'function trackTajenkaAbandon('],
 ['function renderTajenkaPhrase(', 'function answerIndexForTajenka('],
 ['function samePath(', '\n']
]){
 const from=app.indexOf(start),to=app.indexOf(end,from+start.length);
 assert(from>=0&&to>from,start);
 vm.runInContext(app.slice(from,to),gameContext);
}
const puzzle=gameContext.playableTajenkaPuzzle(quote);
const game={mode:'tajenka',puzzle,found:[]};
gameContext.renderTajenkaPhrase(game);
assert.deepEqual(Array.from(puzzle.answers,a=>a.word),['CHVÍLI','STÁL','STOJÍ','OPODÁL']);
assert.match(slots.innerHTML,/revealed[^>]*>Kdo<\/span>/);
assert.match(slots.innerHTML,/revealed[^>]*>již<\/span>/);
assert.equal((slots.innerHTML.match(/class="tajenka-slot pending/g)||[]).length,4);
assert.match(progress.innerHTML,/>0\/4</);

const oldFound=quote.answers.flatMap(({word,path},answerIndex)=>
 word==='KDO'?[]:[{word,path,answerIndex,colorIndex:answerIndex-1}]);
game.found=gameContext.tajenkaFoundFromState(puzzle,{puzzleId:quote.id,found:oldFound});
assert.deepEqual(Array.from(game.found,f=>f.answerIndex),[0,1,2,3]);
assert.deepEqual(Array.from(game.found,f=>f.word),oldFound.map(f=>f.word));
gameContext.renderTajenkaPhrase(game);
assert.match(progress.innerHTML,/>4\/4</);
assert(!slots.innerHTML.includes('pending'));
assert.equal(slots.innerHTML.replace(/<[^>]+>/g,''),quote.tajenka.displayText);
console.log('PASS: Kdo and již are visible on entry. The four saved paths complete the original quote.');

// A private local save is evidence only if the four canonical paths were already
// present when the fix went live. Never invite a finished or partial player.
(async()=>{
 let state={},account=null,hidden=true,started=0,status={eligible:false,completed:false};
 const notice={classList:{add(){hidden=true},remove(){hidden=false}}},button={};
 const context={...gameContext,tajenkaPuzzle:puzzle,TAJENKA_RELEASE_ENABLED:true,
  getProfile:()=>account,playerScope:()=>account?.id||'guest',tajenkaState:()=>state,
  tajenkaCompletion:()=>state.completed,api:async()=>status,
  $:s=>s==='#tajenkaRecoveryNotice'?notice:button,
  startGame:async(board,mode,date,options)=>{assert.equal(board.id,quote.id);assert.equal(options.kdoRecovery,true);started++}};
 vm.createContext(context);
 const begin=app.indexOf('const KDO_PUZZLE_ID='),end=app.indexOf('function hideClaimedKdoNotice()',begin);
 vm.runInContext(app.slice(begin,end),context);
 const old={puzzleId:quote.id,savedAt:1793795842700,found:oldFound};
 state.inProgress=old;await context.refreshKdoNotice();assert.equal(hidden,false);
 await button.onclick();assert.equal(started,1);
 for(const row of [{...old,found:oldFound.slice(1)},{...old,savedAt:1793795842702},
  {...old,found:oldFound.map(f=>({...f,path:[0]}))}]){
  state.inProgress=row;await context.refreshKdoNotice();assert.equal(hidden,true);
 }
 account={id:'member',token:'fixture'};state={};status={eligible:true,completed:false};
 await context.refreshKdoNotice();assert.equal(hidden,false);
 status={eligible:false,completed:true};await button.onclick();assert.equal(hidden,true);assert.equal(started,1);
 state={inProgress:old};await context.refreshKdoNotice();assert.equal(hidden,true);
 console.log('PASS: KDO apology checks the original four paths and excludes partial, newer and already rewarded games.');
})().catch(err=>{console.error(err);process.exitCode=1});
