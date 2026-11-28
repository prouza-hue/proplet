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
  const node = tag => ({
    tag, textContent:'', children:[], attrs:{}, open:false,
    append(...children) { this.children.push(...children); },
    setAttribute(name,value) { this.attrs[name]=value; },
    addEventListener() {}, remove() {}, close() { this.open=false; }, showModal() { this.open=true; }
  });
  const document = {body:node('body'), createElement:node, addEventListener() {}, dispatchEvent() {}, getElementById() {return null;}};
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

  // A November board saved by a pre-series client remains resumable. The same
  // ordinal in another edition cannot read or overwrite it, even on this account.
  const novemberKey = 'proplet:pet-otisku:nov26:account:p1:' + puzzle.id;
  values.set(novemberKey, JSON.stringify({found:[1], hints:2}));
  assert.equal(gift.restore(puzzle,{...ctx,edition:'2026-11',completed:[]}).hints,2);
  const december = '2026-12';
  const decemberCtx = {...ctx,edition:december,completed:[]};
  assert.equal(gift.restore(puzzle,decemberCtx),null);
  const decemberBoard = {...puzzle,id:'gift-2026-12-01'};
  const newGame = {...game,puzzle:decemberBoard,finished:false,otisky:decemberCtx,hints:0,found:[]};
  const hints = require('../../public/app/game/hints.js').create({getGame:()=>newGame});
  const target = hints.pickTarget();
  assert.deepEqual(hints.applyState(3,target).path,decemberBoard.answers[target.i].path);
  newGame.found = decemberBoard.answers.map(item);
  assert.equal(gift.persist(newGame),true);
  assert.equal(gift.restore(decemberBoard,decemberCtx).hints,1);
  context.api = async (url,opts) => {
    assert.equal(url,'/api/gift-editions/2026-12/complete');
    assert.deepEqual(JSON.parse(opts.body),{board:1,solution:puzzle.answers.map(a=>a.path)});
    return {completed:[1],awardedXp:300};
  };
  await gift.finish(newGame);
  assert.equal(newGame.finished,true);
  assert.ok(values.has(novemberKey));
  assert.equal(gift.restore(decemberBoard,decemberCtx),null);

  const fetches=[];
  context.fetch=async url=>{
    fetches.push(url);
    return {ok:true,json:async()=>({boards:bank.boards.map((b,i)=>({...b,id:'fixture-'+i}))})};
  };
  context.api=async ()=>{throw new Error('Preview must stay local');};
  context.showToast=msg=>{throw new Error(msg);};
  context.message=()=>{};
  context.startGame=async (p,mode,date,opts)=>{
    context.currentGame={puzzle:p,mode,otisky:opts.otisky,found:[],hints:1};
    return true;
  };
  values.set('proplet:pet-otisku:nov26:preview:completed','[1,2]');
  values.set('proplet:pet-otisku:2026-12:preview:completed','[1,2,3,4,5]');
  values.set('proplet:pet-otisku:2026-12:preview:fixture-0',JSON.stringify({found:[1]}));
  assert.equal(await gift.open({edition:december,preview:true}),true);
  const demo=context.currentGame;
  assert.equal(demo.otisky.board,1);
  assert.equal(gift.restore(demo.puzzle,demo.otisky),null);
  assert.equal(fetches[0],'/app/content/2026-12.json?v=2');
  demo.found=demo.puzzle.answers.map(item);
  await gift.finish(demo);
  assert.deepEqual(Array.from(gift.previewCompleted(december)),[1]);
  assert.deepEqual(Array.from(gift.previewCompleted('2026-11')),[1,2]);
  assert.equal(await gift.open({edition:december,preview:true}),true);
  assert.equal(context.currentGame.otisky.board,2);
  assert.equal(await gift.open({edition:december,preview:true,board:4}),false);
  assert.equal(fetches.length,1);
  // Neither progress nor accessible names expose a fragment of the final note.
  // The original November letter puzzle still reveals its earned characters.
  async function overview(edition) {
    assert.equal(await gift.open({edition,preview:true,overview:true}),true);
    return document.body.children.at(-1);
  }
  const partial = await overview(december);
  const strip = partial.children[1];
  assert.equal(strip.className,'otisky-progress');
  assert.deepEqual(strip.children.map(n=>n.textContent),['','Dohráno 1 z 5']);
  assert.deepEqual(strip.children[0].attrs,{'aria-hidden':'true'});
  assert.deepEqual(strip.attrs,{});
  assert.doesNotMatch(JSON.stringify(partial),/NÁŠUP|Když zbude|otisky-sign/);
  const legacy = await overview('2026-11');
  assert.equal(legacy.children[1].className,'otisky-strip');
  assert.deepEqual(legacy.children[1].children.map(n=>n.textContent),['','','K','','!']);
  for (let n=2;n<=5;n++) {
    assert.equal(await gift.open({edition:december,preview:true}),true);
    const nextGame=context.currentGame;
    assert.equal(nextGame.otisky.board,n);
    nextGame.found=nextGame.puzzle.answers.map(item);
    await gift.finish(nextGame);
    const result=await overview(december);
    if(n<5) assert.doesNotMatch(JSON.stringify(result),/NÁŠUP|Když zbude|otisky-sign/);
    else {
      assert.equal(result.children[0].textContent,'NÁŠUP');
      assert.match(JSON.stringify(result),/Když zbude/);
      assert.match(JSON.stringify(result),/Pavel/);
    }
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
