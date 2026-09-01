(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletContentProgression=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function create(deps={}){
    const getPuzzleDB=deps.getPuzzleDB||(()=>null);
    const readState=deps.getState||(()=>({completed:{}}));
    const dayOffsetISO=deps.dayOffsetISO||(()=>0);
    const sortedFreeBank=deps.sortedFreeBank||(()=>[]);
    const localFreeSlotState=deps.localFreeSlotState||(()=>({actual:new Set(),transferred:new Set()}));
    const resumableFreePuzzle=deps.resumableFreePuzzle||(()=>null);
    const pragueDateISO=deps.pragueDateISO||(()=>new Date().toISOString().slice(0,10));
    const addDaysISO=deps.addDaysISO||((iso)=>iso);
    const getContentPreviewDate=deps.getContentPreviewDate||(()=>null);

    function dailyBankFor(iso){
      const puzzleDB=getPuzzleDB()||{},gen4From=puzzleDB.dailyGeneration4From||puzzleDB.release?.dailyGeneration4From||null,active=puzzleDB.daily||[];
      if(gen4From){
        if(iso>=gen4From)return {bank:active.filter(p=>Number(p.meta?.contentGeneration||4)===4),base:puzzleDB.dailyRotationBaseDate||gen4From};
        const window=(puzzleDB.archive?.dailyWindows||[]).find(w=>(!w.activeFrom||iso>=w.activeFrom)&&(!w.activeUntil||iso<=w.activeUntil));
        if(window?.puzzleIds?.length){const base=window.rotationBaseDate||'2026-01-01',i=((dayOffsetISO(iso,base)%window.puzzleIds.length)+window.puzzleIds.length)%window.puzzleIds.length,id=window.puzzleIds[i],puzzle=active.find(p=>p.id===id);if(puzzle)return {bank:[puzzle],base:iso}}
      }
      const switchDate=puzzleDB.dailyGeneration3From||null,previous=puzzleDB.previousDaily;
      if(switchDate&&iso<switchDate&&previous?.puzzles?.length)return {bank:previous.puzzles,base:previous.rotationBaseDate||'2026-01-01'};
      return {bank:active,base:puzzleDB.dailyRotationBaseDate||switchDate||'2026-01-01'};
    }

    function dailyPuzzleFor(iso){const source=dailyBankFor(iso),n=source.bank.length;if(!n)throw new Error('Daily banka je prázdná');const i=((dayOffsetISO(iso,source.base)%n)+n)%n;return source.bank[i]}
    function dailyResultState(iso){const puzzle=dailyPuzzleFor(iso),stored=readState().completed?.[`daily:${iso}`]||null;return {puzzle,stored,active:stored?.puzzleId===puzzle.id?stored:null,legacy:stored&&stored.puzzleId!==puzzle.id?stored:null}}

    function freeProgress(diff){
      const list=sortedFreeBank(diff),total=list.length,slots=localFreeSlotState(diff),done=slots.actual.size,resume=resumableFreePuzzle(diff,list),nextUnsolved=list.find(p=>!slots.actual.has(Number(p.meta?.level)))||null,pct=total?Math.round(done/total*100):0;
      return {list,total,done,actual:slots.actual.size,transferred:slots.transferred.size,resume,nextUnsolved,pct,slots};
    }

    function latestContentBatch(){return getPuzzleDB()?.contentStatus?.latestBatch||null}
    function latestContentIsFresh(){const b=latestContentBatch(),today=getContentPreviewDate()||pragueDateISO();if(!b?.availableFrom)return false;return today>=b.availableFrom&&today<=addDaysISO(b.availableFrom,6)}
    function latestContentPuzzles(){
      const batch=latestContentBatch();if(!batch||!latestContentIsFresh())return[];
      return (batch.levels||[]).map(row=>sortedFreeBank(row.difficulty).find(p=>p.id===row.id)).filter(Boolean);
    }
    function latestContentUnplayed(){const state=readState();return latestContentPuzzles().filter(p=>!state.completed?.[`free:${p.id}`])}
    function newContentCount(diff){return latestContentUnplayed().filter(p=>p.difficulty===diff).length}

    return {dailyBankFor,dailyPuzzleFor,dailyResultState,freeProgress,latestContentBatch,latestContentIsFresh,latestContentPuzzles,latestContentUnplayed,newContentCount};
  }

  return {create};
});
