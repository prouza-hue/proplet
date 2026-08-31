(function installPropletGameHints(global){
'use strict';

const DEFAULT_CHOICES=[
  ['Lehká','Ukáže začátek a délku vhodného slova.'],
  ['Silnější','Ukáže první tři políčka cesty.'],
  ['Odhalit','Na chvíli ukáže celé slovo i jeho cestu.'],
];
const TAJENKA_CHOICES=[
  ['Významová stopa','Napoví význam hledaného slova.'],
  ['Kde začít','Ukáže první písmeno a délku.'],
  ['Odhalit cestu','Ukáže celé slovo i jeho cestu.'],
];

function create(deps={}){
  const getGame=deps.getGame||(()=>null);
  const supportMode=deps.supportMode||(()=> 'none');

  function choices(mode){return (mode==='tajenka'?TAJENKA_CHOICES:DEFAULT_CHOICES).map(row=>[...row])}
  function pickTarget(){
    const game=getGame();if(!game?.puzzle)return null;
    if(game.mode==='starter'&&!game.found.some(f=>f.answerIndex===2))return {a:game.puzzle.answers[2],i:2};
    return game.puzzle.answers.map((a,i)=>({a,i}))
      .filter(x=>!game.found.some(f=>f.answerIndex===x.i))
      .sort((x,y)=>(x.a.turns||0)-(y.a.turns||0)||x.a.word.length-y.a.word.length)[0]||null;
  }
  function applyState(level,target=pickTarget(),callbacks={}){
    const game=getGame();if(!game||!target)return null;
    const numericLevel=Math.max(1,Math.min(3,Number(level)||1)),starter=game.mode==='starter',tajenka=game.mode==='tajenka',
      source=game.nextHintSource||'manual',complimentary=!starter&&!tajenka&&!game.isReplay&&(supportMode()==='beginner'||supportMode()==='younger')&&(game.hints||0)===0&&numericLevel===1;
    game.nextHintSource='manual';
    const plan={game,pick:target,path:target.a.path,level:numericLevel,starter,tajenka,source,complimentary};
    if(starter){
      game.starterHintUsed=true;callbacks.onStarter?.(plan);
    }else{
      game.hints=(game.hints||0)+1;if(source==='helper')game.helperHintUsed=true;
      if(!tajenka){
        callbacks.onScored?.(plan);
        game.maxHintLevel=Math.max(game.maxHintLevel||0,numericLevel);game.cleanSolve=false;
      }
    }
    return plan;
  }

  return {choices,pickTarget,applyState};
}

const api={create};
if(global)global.PropletGameHints=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
