(()=>{
  const STORAGE_KEY='proplet-v3-32-4-difficulty-nudge';
  const WINDOW_SIZE=5;
  const FAST_REQUIRED=4;
  const RESHOW_AFTER=10;
  const MAX_DECLINES=2;
  const RULES={
    easy:{target:'medium',thresholdMs:45000},
    medium:{target:'hard',thresholdMs:75000},
    hard:{target:'hardcore',thresholdMs:120000}
  };
  let lastRenderedSignature='';

  const scopeId=()=>{
    try{return String(getProfile?.()?.id||'guest')}catch{return 'guest'}
  };
  const key=()=>`${STORAGE_KEY}:${scopeId()}`;
  const readState=()=>{
    try{return JSON.parse(localStorage.getItem(key())||'{}')||{}}catch{return {}}
  };
  const writeState=state=>{
    try{localStorage.setItem(key(),JSON.stringify(state))}catch{}
  };
  const emit=event=>{
    try{if(typeof trackProductEvent==='function')trackProductEvent(event)}catch{}
  };
  const diffLabel=diff=>{
    try{return DIFF?.[diff]?.label||diff}catch{return diff}
  };
  const thresholdLabel=ms=>ms===45000?'45 s':ms===75000?'1 min 15 s':ms===120000?'2 min':`${Math.round(ms/1000)} s`;
  const recordsFor=diff=>{
    try{
      return Object.values(getState?.()?.completed||{})
        .filter(r=>r?.mode==='free'&&r?.difficulty===diff&&r?.completedAt&&!r?.transferred)
        .sort((a,b)=>String(a.completedAt).localeCompare(String(b.completedAt)));
    }catch{return []}
  };
  const hasCompleted=diff=>recordsFor(diff).length>0;

  const previewOverride=()=>{
    try{
      const source=new URLSearchParams(location.search).get('difficulty-nudge-preview');
      return location.hostname.includes('vercel.app')&&RULES[source]?source:null;
    }catch{return null}
  };

  const evaluate=()=>{
    let g;
    try{g=currentGame}catch{return null}
    if(!g?.finished||g.mode!=='free'||g.postStarterWarmup)return null;

    const forced=previewOverride();
    const source=forced||g.puzzle?.difficulty;
    const rule=RULES[source];
    if(!rule)return null;
    if(!forced&&(!g.justCompleted||g.isReplay))return null;
    if(!forced&&hasCompleted(rule.target))return null;

    const records=recordsFor(source),count=records.length,state=readState(),entry=state[source]||{};
    if(!forced){
      if(entry.accepted||Number(entry.declines||0)>=MAX_DECLINES)return null;
      if(count<WINDOW_SIZE)return null;
      if(Number(entry.nextEligibleCount||0)>count)return null;
      if(Number(entry.lastShownCount||0)===count)return null;
      const recent=records.slice(-WINDOW_SIZE);
      const fast=recent.filter(r=>r.cleanSolve===true&&Number(r.elapsedMs||Infinity)<=rule.thresholdMs).length;
      if(fast<FAST_REQUIRED)return null;
      return {source,target:rule.target,thresholdMs:rule.thresholdMs,count,fast,forced:false};
    }
    return {source,target:rule.target,thresholdMs:rule.thresholdMs,count,fast:FAST_REQUIRED,forced:true};
  };

  const followAcceptedProgress=()=>{
    let g;
    try{g=currentGame}catch{return}
    if(!g?.finished||!g.justCompleted||g.isReplay||g.mode!=='free')return;
    const state=readState(),pending=state.pending;
    if(!pending||pending.target!==g.puzzle?.difficulty||pending.lastPuzzleId===g.puzzle?.id)return;
    const n=Math.min(3,Number(pending.completions||0)+1);
    pending.completions=n;
    pending.lastPuzzleId=g.puzzle?.id||null;
    state.pending=n>=3?null:pending;
    writeState(state);
    emit(`difficulty_nudge_followup_${n}`);
    emit(`difficulty_nudge_followup_${n}_${pending.target}`);
  };

  const clearCard=()=>{
    document.querySelector('#difficultyNudgeCard')?.remove();
    document.querySelector('#winModal')?.classList.remove('difficulty-nudge-active');
    lastRenderedSignature='';
  };

  const accept=candidate=>{
    const state=readState(),entry=state[candidate.source]||{};
    entry.accepted=true;
    entry.acceptedAt=new Date().toISOString();
    state[candidate.source]=entry;
    state.pending={source:candidate.source,target:candidate.target,acceptedAt:new Date().toISOString(),completions:0,lastPuzzleId:null};
    writeState(state);
    emit('difficulty_nudge_accepted');
    emit(`difficulty_nudge_accepted_${candidate.source}_${candidate.target}`);
    clearCard();
    document.querySelector('#winModal')?.classList.add('hidden');
    try{if(typeof startFree==='function')startFree(candidate.target)}catch{}
  };

  const decline=candidate=>{
    const state=readState(),entry=state[candidate.source]||{},declines=Number(entry.declines||0)+1;
    entry.declines=declines;
    entry.declinedAt=new Date().toISOString();
    entry.nextEligibleCount=declines>=MAX_DECLINES?null:candidate.count+RESHOW_AFTER;
    entry.done=declines>=MAX_DECLINES;
    state[candidate.source]=entry;
    writeState(state);
    emit('difficulty_nudge_declined');
    emit(`difficulty_nudge_declined_${candidate.source}_${candidate.target}`);
    clearCard();
    document.querySelector('#winModal')?.classList.add('hidden');
    try{if(typeof startFree==='function')startFree(candidate.source)}catch{}
  };

  const render=candidate=>{
    const modal=document.querySelector('#winModal'),primary=document.querySelector('#winPrimaryBtn');
    if(!modal||!primary||modal.classList.contains('hidden'))return;
    const signature=`${candidate.source}:${candidate.target}:${candidate.count}:${candidate.forced?'preview':'real'}`;
    if(lastRenderedSignature===signature&&document.querySelector('#difficultyNudgeCard'))return;
    clearCard();
    lastRenderedSignature=signature;

    const sourceLabel=diffLabel(candidate.source),targetLabel=diffLabel(candidate.target);
    const card=document.createElement('section');
    card.id='difficultyNudgeCard';
    card.className='difficulty-nudge-card';
    card.setAttribute('aria-label','Doporučení obtížnosti');
    card.innerHTML=`
      <div class="difficulty-nudge-kicker">🔥 ČAS PŘITVRDIT?</div>
      <h3>Tohle ti jde nějak podezřele snadno. 😏</h3>
      <p><strong>${candidate.fast} z posledních ${WINDOW_SIZE}</strong> ${sourceLabel.toLocaleLowerCase('cs-CZ')} jsi zvládl do <strong>${thresholdLabel(candidate.thresholdMs)}</strong> bez nápovědy. ${targetLabel} by tě mohla bavit víc.</p>
      <button type="button" class="difficulty-nudge-accept">Zkusit ${targetLabel} →</button>
      <button type="button" class="difficulty-nudge-decline">Ještě jednu ${sourceLabel}</button>`;
    primary.parentNode.insertBefore(card,primary);
    modal.classList.add('difficulty-nudge-active');
    card.querySelector('.difficulty-nudge-accept').onclick=()=>accept(candidate);
    card.querySelector('.difficulty-nudge-decline').onclick=()=>decline(candidate);

    if(!candidate.forced){
      const state=readState(),entry=state[candidate.source]||{};
      entry.lastShownCount=candidate.count;
      entry.lastShownAt=new Date().toISOString();
      state[candidate.source]=entry;
      writeState(state);
      emit('difficulty_nudge_shown');
      emit(`difficulty_nudge_shown_${candidate.source}_${candidate.target}`);
    }
  };

  const handleWin=()=>{
    const modal=document.querySelector('#winModal');
    if(!modal||modal.classList.contains('hidden')){clearCard();return}
    followAcceptedProgress();
    const candidate=evaluate();
    if(candidate)render(candidate);else clearCard();
  };

  const boot=()=>{
    const modal=document.querySelector('#winModal');
    if(!modal)return;
    new MutationObserver(()=>setTimeout(handleWin,0)).observe(modal,{attributes:true,attributeFilter:['class']});
    handleWin();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
