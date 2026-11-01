(function installPropletGameHints(global){
'use strict';

const DEFAULT_CHOICES=[
  ['Lehká','Začátek a délka slova.'],
  ['Silnější','První tři políčka cesty.'],
  ['Odhalit','Na chvíli celé slovo i cestu.'],
];
const TAJENKA_CHOICES=[
  ['Významová stopa','Napoví, co slovo znamená.'],
  ['Kde začít','První písmeno a délka slova.'],
  ['Odhalit cestu','Na chvíli celé slovo i cestu.'],
];
const MODAL_STATE=new WeakMap();
const HINT_ART=['gentle','steps','reveal'].map(name=>`/assets/hints/printshop/${name}-v1.webp`);

function modalState(modal){
  let state=MODAL_STATE.get(modal);
  if(state)return state;
  state={opener:null};MODAL_STATE.set(modal,state);
  modal.addEventListener('keydown',event=>{
    if(modal.classList.contains('hidden'))return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();modal.querySelector('#closeHintModal')?.click();return;
    }
    if(event.key!=='Tab')return;
    const focusable=[...modal.querySelectorAll('button:not([disabled])')].filter(button=>!button.hidden);
    if(!focusable.length)return;
    const active=modal.ownerDocument.activeElement,first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&(active===first||!modal.contains(active))){event.preventDefault();last.focus({preventScroll:true})}
    else if(!event.shiftKey&&(active===last||!modal.contains(active))){event.preventDefault();first.focus({preventScroll:true})}
  });
  return state;
}

function renderChoices(modal,mode='default'){
  if(!modal)return;
  const rows=mode==='tajenka'?TAJENKA_CHOICES:DEFAULT_CHOICES;
  modal.querySelectorAll('[data-hint-level]').forEach((button,index)=>{
    const row=rows[index];if(!row)return;
    button.querySelector('strong').textContent=row[0];button.querySelector('small').textContent=row[1];
    const art=button.querySelector('.hint-art');if(art&&art.getAttribute('src')!==HINT_ART[index])art.setAttribute('src',HINT_ART[index]);
  });
}

function openModal(modal,{mode='default'}={}){
  if(!modal)return;
  const state=modalState(modal);
  if(modal.classList.contains('hidden'))state.opener=modal.ownerDocument.activeElement;
  renderChoices(modal,mode);
  modal.classList.toggle('starter-hint',mode==='starter');modal.dataset.hintMode=mode;
  modal.setAttribute('aria-labelledby','hintTitle');
  const title=modal.querySelector('#hintTitle');
  if(title)title.textContent=mode==='starter'?'Zkus malé postrčení':mode==='tajenka'?'Jak moc napovědět?':'Kolik pomoci chceš?';
  const consequence=modal.querySelector('#hintConsequence');
  if(consequence){
    consequence.hidden=!['default','free','daily','daily_special'].includes(mode);
    if(consequence.hidden)modal.removeAttribute('aria-describedby');
    else modal.setAttribute('aria-describedby','hintConsequence');
  }
  modal.classList.remove('hidden');
  modal.querySelector('#closeHintModal')?.focus({preventScroll:true});
}

function closeModal(modal){
  if(!modal)return;
  modal.classList.add('hidden');
  const opener=MODAL_STATE.get(modal)?.opener;
  const target=opener?.isConnected&&!opener.disabled?opener:modal.ownerDocument.querySelector('#hintBtn');
  if(target&&!modal.contains(target))target.focus({preventScroll:true});
}

function create(deps={}){
  const getGame=deps.getGame||(()=>null);
  const supportMode=deps.supportMode||(()=> 'none');

  function choices(mode){return (mode==='tajenka'?TAJENKA_CHOICES:DEFAULT_CHOICES).map(row=>[...row])}
  function pickTarget(){
    const game=getGame();if(!game?.puzzle)return null;
    if(game.mode==='starter'){
      const i=game.puzzle.answers.findIndex((a,index)=>!game.found.some(f=>f.answerIndex===index));
      return i<0?null:{a:game.puzzle.answers[i],i};
    }
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

const api={create,renderChoices,openModal,closeModal};
if(global)global.PropletGameHints=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
