(function installPropletGameState(global){
'use strict';

function create(deps={}){
  const performanceNow=deps.performanceNow||(()=>performance.now());
  const dateNow=deps.dateNow||(()=>Date.now());
  const setIntervalFn=deps.setIntervalFn||((fn,ms)=>setInterval(fn,ms));
  const clearIntervalFn=deps.clearIntervalFn||(id=>clearInterval(id));
  const readState=deps.readState||(()=>({completed:{},rescues:{},inProgress:{}}));
  const writeState=deps.writeState||(()=>{});
  const readTajenkaProgress=deps.readTajenkaProgress||(()=>null);
  const writeTajenkaProgress=deps.writeTajenkaProgress||(()=>false);
  const challengeKey=deps.challengeKey||((mode,puzzle,date)=>mode==='daily'?'daily:'+date:'free:'+puzzle?.id);
  const samePath=deps.samePath||((a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]));
  const colorCount=Math.max(1,Number(deps.colorCount)||1);

  let current=null;
  let timerId=null;
  const hooks=new Map();

  function get(){return current}
  function replace(next){current=next||null;return current}
  function clear(){current=null;stopTimer();return null}

  function registerHook(hook){
    if(!hook||typeof hook.id!=='string'||!hook.id.trim())throw new Error('GameSession hook requires id');
    const id=hook.id.trim();
    if(hooks.has(id))return true;
    hooks.set(id,{
      id,
      priority:Number.isFinite(Number(hook.priority))?Number(hook.priority):100,
      beforeStart:typeof hook.beforeStart==='function'?hook.beforeStart:null,
      afterStart:typeof hook.afterStart==='function'?hook.afterStart:null,
      afterPersist:typeof hook.afterPersist==='function'?hook.afterPersist:null,
    });
    return true;
  }
  function orderedHooks(){return [...hooks.values()].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))}
  function runHooks(phase,event){for(const hook of orderedHooks()){const fn=hook[phase];if(fn)fn(event)}}

  function elapsed(game=current){
    if(!game)return 0;
    const end=game.pausedAt??performanceNow();
    return Math.max(0,(game.baseElapsedMs||0)+(end-game.start));
  }

  function restore(puzzle,mode,dailyDate){
    if(mode==='tajenka')return readTajenkaProgress(puzzle);
    if(mode==='rescue'||mode==='starter')return null;
    const state=readState(),key=challengeKey(mode,puzzle,dailyDate),completed=state.completed?.[key];
    if(completed&&!(mode==='daily'&&completed.puzzleId!==puzzle.id))return null;
    const row=state.inProgress?.[key];
    if(!row||row.puzzleId!==puzzle.id||row.mode!==mode)return null;
    const seen=new Set(),found=[];
    for(const item of row.found||[]){
      const answer=puzzle.answers?.[item.answerIndex];
      if(!answer||seen.has(item.answerIndex)||answer.word!==item.word||!samePath(answer.path,item.path||[]))continue;
      seen.add(item.answerIndex);
      found.push({
        answerIndex:item.answerIndex,
        word:item.word,
        colorIndex:Number.isFinite(item.colorIndex)?item.colorIndex:found.length%colorCount,
        path:[...item.path],
      });
    }
    return {
      ...row,
      found,
      moves:Math.max(0,Number(row.moves)||0),
      hints:Math.max(0,Number(row.hints)||0),
      wrongAttempts:Math.max(0,Number(row.wrongAttempts)||0),
      maxHintLevel:Math.max(0,Number(row.maxHintLevel)||0),
      elapsedMs:Math.max(0,Number(row.elapsedMs)||0),
    };
  }

  function saveProgress(game=current){
    const event={game,kind:'standard',saved:false};
    if(!game||game.finished||game.mode==='rescue'||game.mode==='starter'){
      runHooks('afterPersist',event);
      return false;
    }
    if(game.mode==='tajenka'){
      event.kind='tajenka';
      event.saved=writeTajenkaProgress(game)!==false;
      runHooks('afterPersist',event);
      return event.saved;
    }
    const key=challengeKey(game.mode,game.puzzle,game.dailyDate),state=readState();
    state.inProgress=state.inProgress||{};
    state.inProgress[key]={
      puzzleId:game.puzzle.id,
      mode:game.mode,
      difficulty:game.puzzle.difficulty,
      dailyDate:game.dailyDate||null,
      found:game.found.map(item=>({answerIndex:item.answerIndex,word:item.word,colorIndex:item.colorIndex,path:[...item.path]})),
      moves:game.moves||0,
      hints:game.hints||0,
      wrongAttempts:game.wrongAttempts||0,
      maxHintLevel:game.maxHintLevel||0,
      cleanSolve:(game.hints||0)===0,
      elapsedMs:Math.round(elapsed(game)),
      attemptId:game.attemptId||null,
      wordDiscoveryXpAwarded:Math.max(0,Number(game.wordDiscoveryXpAwarded)||0),
      helperOffered:!!game.helperOffered,
      helperHintUsed:!!game.helperHintUsed,
      postStarterWarmup:!!game.postStarterWarmup,
      savedAt:dateNow(),
    };
    writeState(state);
    game.lastAutosaveAt=dateNow();
    event.saved=true;
    runHooks('afterPersist',event);
    return true;
  }

  function saveRescueProgress(game=current){
    if(!game||game.mode!=='rescue'||game.finished||!game.dailyDate)return false;
    const state=readState();
    state.rescues=state.rescues||{};
    state.rescues[game.dailyDate]={
      ...(state.rescues[game.dailyDate]||{}),
      status:'started',
      puzzleId:game.puzzle.id,
      elapsedMs:Math.round(elapsed(game)),
    };
    writeState(state);
    game.lastAutosaveAt=dateNow();
    return true;
  }

  function stopTimer(){
    if(timerId!=null){clearIntervalFn(timerId);timerId=null}
  }

  function startTimer(onTick,intervalMs){
    stopTimer();
    if(!current||current.finished||current.pausedAt!=null)return false;
    timerId=setIntervalFn(()=>{
      const game=current;
      if(!game||game.finished||game.pausedAt!=null)return;
      onTick?.(game,elapsed(game));
    },Math.max(1,Number(intervalMs)||250));
    return true;
  }

  function pause(reason='background',{screen='game',onUpdateActive}={}){
    const game=current;
    if(!game||game.finished||game.pausedAt!=null||screen!=='game')return false;
    const now=performanceNow(),value=elapsed(game);
    game.baseElapsedMs=value;
    game.elapsedMs=value;
    game.start=now;
    game.pausedAt=now;
    game.pauseReason=reason;
    game.dragging=false;
    game.lastPointer=null;
    game.path=[];
    stopTimer();
    onUpdateActive?.();
    if(game.mode==='rescue'){game.rescueElapsedMs=value;saveRescueProgress(game)}
    else saveProgress(game);
    return true;
  }

  function resume({screen='game',visibilityState='visible',focused=true,onResume}={}){
    const game=current;
    if(!game||game.finished||game.pausedAt==null||screen!=='game'||visibilityState==='hidden'||!focused)return false;
    const now=performanceNow();
    game.start=now;
    game.pausedAt=null;
    game.pauseReason=null;
    game.lastProgressAt=now;
    onResume?.();
    return true;
  }

  return {
    get,replace,clear,elapsed,restore,saveProgress,saveRescueProgress,
    pause,resume,startTimer,stopTimer,registerHook,runHooks,
    registeredHookIds:()=>orderedHooks().map(h=>h.id),
  };
}

const api={create};
if(global)global.PropletGameState=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
