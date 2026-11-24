// Play and leave a normal game and a gift board on the same account. Losing a
// completion response must keep the solved grid for a safe server retry.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function run() {
  const bank = JSON.parse(fs.readFileSync('public/app/content/pet-otisku.json'));
  const puzzle = bank.boards[0];
  const values = new Map();
  let player = 'p1', calls = 0, refuse = true;
  const store = {inProgress: {}, completed: {}};
  const document = {addEventListener() {}, dispatchEvent() {}, getElementById() {return null;}};
  const context = vm.createContext({
    document, COLORS: ['blue'], currentScreen:'daily', getProfile: () => ({id:player}),
    playerScope: () => player, gameElapsed: () => 1500, stopTimer() {},
    refreshRemoteProfile: async () => {}, CustomEvent: class {},
    localStorage: {getItem:k=>values.get(k), setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k)},
    api: async (path, opts) => {
      assert.equal(path, '/api/pet-otisku/complete');
      assert.deepEqual(JSON.parse(opts.body), {board:1, solution:puzzle.answers.map(a=>a.path)});
      ++calls;
      if (refuse) throw new Error('Dočasně offline');
      return {completed:[1],awardedXp:0}; // receipt lost after a previous successful commit
    }
  });
  context.window=context;
  for (const script of ['public/app/game/state.js','public/app/game/pet-otisku.js']) {
    vm.runInContext(fs.readFileSync(script,'utf8'),context);
  }
  const gift = context.PropletPetOtiskuGame;
  const session = context.PropletGameState.create({
    readState:()=>store, writeState:()=>{}, performanceNow:()=>20,
    writeOtiskyProgress:game=>gift.persist(game)
  });
  const item = (a,i)=>({word:a.word,path:a.path,answerIndex:i,colorIndex:0});
  const prior = {...puzzle,id:'free-fixture'};
  session.saveProgress({puzzle:prior, mode:'free',found:[item(prior.answers[0],0)],start:0});
  const before=JSON.stringify(store);
  const ctx = {scope:'account:p1',preview:false,board:1,completed:[]};
  const game={puzzle,mode:'otisky',found:[item(puzzle.answers[0],0)],hints:1,otisky:ctx,start:0};
  assert.equal(session.saveProgress(game),true);
  assert.equal(gift.restore(puzzle,ctx).found[0].word,puzzle.answers[0].word);
  player='p2';
  assert.equal(session.saveProgress(game),false);
  assert.equal(gift.restore(puzzle,{...ctx,scope:'account:p2'}),null);
  player='p1';
  game.found=puzzle.answers.map(item).reverse();
  context.currentGame=game;
  await gift.finish(game);
  assert.equal(game.finishing,false);
  assert.equal(gift.restore(puzzle,ctx).found.length,puzzle.answers.length);
  assert.equal(gift.restore(puzzle,{...ctx,completed:[1]}),null);
  refuse=false;
  await gift.finish(game);
  assert.equal(calls,2);
  assert.equal(game.finished,true);
  assert.equal(gift.restore(puzzle,ctx),null);
  assert.equal(JSON.stringify(store),before);
  assert.equal(session.restore(prior,'free').found.length,1);
}
run().catch(error=>{console.error(error);process.exitCode=1;});
