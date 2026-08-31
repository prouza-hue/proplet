(()=>{
  'use strict';
  if(window.__PROPLET_COMPETITIVE_SHARING_V3331__)return;

  const SESSION_KEY='proplet-v3-33-1-shared-challenge';
  const DAILY_SESSION_KEY='proplet-v4-01-14-shared-daily';
  const PARAMS=['play','t','h','m'];
  let installed=false;
  let activeChallenge=null;
  let incomingRaw=null;
  let pendingResolved=null;
  let pendingResolvePromise=null;
  let baseStartGame=null;
  let baseFinishGame=null;
  let basePerformPostWinAction=null;
  let baseStartStarter=null;
  let baseStartDaily=null;
  let baseShareDaily=null;

  const intParam=(value,min,max)=>{
    const n=Number.parseInt(String(value??''),10);
    return Number.isFinite(n)?Math.max(min,Math.min(max,n)):null;
  };

  const parseIncoming=()=>{
    try{
      const q=new URLSearchParams(location.search),puzzleId=String(q.get('play')||'').trim();
      if(!puzzleId)return null;
      return {
        puzzleId:puzzleId.slice(0,100),
        elapsedMs:intParam(q.get('t'),1000,24*60*60*1000),
        hintsUsed:intParam(q.get('h'),0,99),
        moves:intParam(q.get('m'),1,9999),
        openedAt:new Date().toISOString(),
        source:'share'
      };
    }catch{return null}
  };

  const loadDailySession=()=>{
    try{
      const value=JSON.parse(sessionStorage.getItem(DAILY_SESSION_KEY)||'null');
      return value?.completedTracked?null:value;
    }catch{return null}
  };
  const saveDailySession=value=>{
    try{if(value)sessionStorage.setItem(DAILY_SESSION_KEY,JSON.stringify(value));else sessionStorage.removeItem(DAILY_SESSION_KEY)}catch{}
  };
  const parseIncomingDaily=()=>{
    try{
      const q=new URLSearchParams(location.search);
      if(q.get('via')!=='share-daily')return loadDailySession();
      const value={openedTracked:true,startedTracked:false,completedTracked:false,openedAt:new Date().toISOString()};
      saveDailySession(value);
      track('shared_daily_opened');
      const u=new URL(location.href);u.searchParams.delete('via');history.replaceState(history.state,'',`${u.pathname}${u.search}${u.hash}`);
      return value;
    }catch{return loadDailySession()}
  };

  const saveSession=ctx=>{
    try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(ctx||null))}catch{}
  };
  const loadSession=()=>{
    try{
      const v=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(v?.completedTracked){sessionStorage.removeItem(SESSION_KEY);return null}
      return v?.puzzleId?v:null;
    }catch{return null}
  };
  const clearSession=()=>{
    activeChallenge=null;
    pendingResolved=null;
    try{sessionStorage.removeItem(SESSION_KEY)}catch{}
    document.body.classList.remove('game-shared-challenge');
    document.querySelector('#sharedChallengeTarget')?.remove();
  };

  const stripChallengeQuery=()=>{
    try{
      const u=new URL(location.href);
      PARAMS.forEach(k=>u.searchParams.delete(k));
      const qs=u.searchParams.toString();
      const clean=`${u.pathname}${qs?`?${qs}`:''}${u.hash||''}`;
      history.replaceState(history.state,'',clean||'/');
    }catch{}
  };

  const track=event=>{
    try{api('/api/challenge-event',{method:'POST',body:JSON.stringify({event_type:event})}).catch(()=>{})}catch{}
  };
  const diffLabel=diff=>DIFF?.[diff]?.label||diff||'Proplet';
  const cleanLabel=hints=>{
    const n=Number(hints||0);
    return n===0?'✨ čistě':`💡 ${countCz(n,'nápověda','nápovědy','nápověd')}`;
  };
  const formatDelta=ms=>{
    const total=Math.max(1,Math.round(Number(ms||0)/1000));
    if(total<60)return `${total} s`;
    const min=Math.floor(total/60),sec=total%60;
    return sec?`${min} min ${sec} s`:`${min} min`;
  };

  const activePuzzleById=id=>{
    try{
      for(const diff of Object.keys(DIFF||{})){
        const puzzle=sortedFreeBank(diff).find(p=>p.id===id);
        if(puzzle)return puzzle;
      }
    }catch{}
    return null;
  };

  const resolvePuzzle=async id=>{
    const active=activePuzzleById(id);
    if(active)return active;
    try{
      const archived=await archivedFreePuzzle(id);
      if(archived?.id===id&&archived?.difficulty&&DIFF?.[archived.difficulty])return archived;
    }catch{}
    return null;
  };

  const hasBenchmark=ctx=>Number.isFinite(ctx?.elapsedMs)&&Number.isFinite(ctx?.hintsUsed)&&Number.isFinite(ctx?.moves);
  const benchmarkShort=ctx=>{
    if(!hasBenchmark(ctx))return '🎯 Sdílená výzva';
    return `🎯 Překonej ${fmtTime(ctx.elapsedMs)} · ${Number(ctx.hintsUsed||0)===0?'čistě':`${ctx.hintsUsed}× nápověda`}`;
  };

  const attachGameChallengeUi=ctx=>{
    if(!ctx||currentGame?.mode!=='free')return;
    document.body.classList.add('game-shared-challenge');
    currentGame.sharedChallenge=ctx;
    const label=document.querySelector('#gameModeLabel');
    if(label){label.textContent='Výzva od kamaráda';label.classList.remove('hidden')}
    const title=document.querySelector('.game-title');
    if(title){
      let target=document.querySelector('#sharedChallengeTarget');
      if(!target){target=document.createElement('span');target.id='sharedChallengeTarget';target.className='shared-challenge-target';title.appendChild(target)}
      target.textContent=benchmarkShort(ctx);
    }
    if(!ctx.startedTracked){ctx.startedTracked=true;saveSession(ctx);track('shared_level_started')}
  };

  const contextForPuzzle=id=>{
    if(activeChallenge?.puzzleId===id)return activeChallenge;
    const saved=loadSession();
    if(saved?.puzzleId===id){activeChallenge=saved;return saved}
    return null;
  };

  const startSharedChallenge=(puzzle,ctx)=>{
    if(!puzzle||!ctx)return;
    activeChallenge={...ctx,puzzleId:puzzle.id,difficulty:puzzle.difficulty,level:Number(puzzle.meta?.level)||null};
    saveSession(activeChallenge);
    stripChallengeQuery();
    baseStartGame(puzzle,'free',null,{sharedChallenge:true});
    attachGameChallengeUi(activeChallenge);
  };

  const challengeResult=(attempt,bench)=>{
    if(!hasBenchmark(bench))return {outcome:'complete',title:'🎯 Výzva dokončena',copy:'Teď můžeš poslat svůj výsledek dál.'};
    const aHints=Number(attempt.hintsUsed||0),bHints=Number(bench.hintsUsed||0),aClean=aHints===0,bClean=bHints===0;
    if(aClean!==bClean)return aClean
      ?{outcome:'win',title:'🏆 Překonal jsi výzvu!',copy:'Vyhrál jsi čistým řešením.'}
      :{outcome:'loss',title:'Těsně vedle.',copy:'Soupeř měl čisté řešení. Zkus to ještě jednou.'};
    if(aHints!==bHints)return aHints<bHints
      ?{outcome:'win',title:'🏆 Překonal jsi výzvu!',copy:`Použil jsi o ${bHints-aHints} ${bHints-aHints===1?'nápovědu':'nápovědy'} méně.`}
      :{outcome:'loss',title:'Těsně vedle.',copy:`Soupeř použil o ${aHints-bHints} ${aHints-bHints===1?'nápovědu':'nápovědy'} méně.`};
    const dt=Math.round(Number(attempt.elapsedMs||0)-Number(bench.elapsedMs||0));
    if(dt!==0){
      const delta=Math.abs(dt);
      return dt<0
        ?{outcome:'win',title:'🏆 Překonal jsi výzvu!',copy:`Byl jsi o ${formatDelta(delta)} rychlejší.`}
        :{outcome:'loss',title:'Těsně!',copy:`Chybělo ${formatDelta(delta)}.`};
    }
    const dm=Number(attempt.moves||0)-Number(bench.moves||0);
    if(dm!==0)return dm<0
      ?{outcome:'win',title:'🏆 Překonal jsi výzvu!',copy:`Stejný čas, ale o ${Math.abs(dm)} ${Math.abs(dm)===1?'tah':'tahy'} méně.`}
      :{outcome:'loss',title:'Těsně!',copy:`Stejný čas, soupeř měl o ${Math.abs(dm)} ${Math.abs(dm)===1?'tah':'tahy'} méně.`};
    return {outcome:'tie',title:'🤝 Plichta.',copy:'Stejný výkon. Tohle si říká o odvetu.'};
  };

  const ensureResultCard=()=>{
    let card=document.querySelector('#sharedChallengeResult');
    if(card)return card;
    const leaderboard=document.querySelector('#levelLeaderboardBox');
    if(!leaderboard?.parentNode)return null;
    card=document.createElement('div');
    card.id='sharedChallengeResult';
    card.className='shared-challenge-result hidden';
    leaderboard.parentNode.insertBefore(card,leaderboard);
    return card;
  };

  const renderChallengeResult=ctx=>{
    const g=currentGame;if(!ctx||!g?.finished||g.mode!=='free')return;
    const attempt={elapsedMs:Math.max(1000,Math.round(g.elapsedMs||0)),hintsUsed:Number(g.hints||0),moves:Number(g.moves||0)};
    const verdict=challengeResult(attempt,ctx),card=ensureResultCard();
    if(card){
      const benchmark=hasBenchmark(ctx)?`Cíl: ${fmtTime(ctx.elapsedMs)} · ${cleanLabel(ctx.hintsUsed)} · ${countCz(ctx.moves,'tah','tahy','tahů')}`:'Sdílená úroveň';
      card.className=`shared-challenge-result ${verdict.outcome}`;
      card.innerHTML=`<div class="shared-challenge-result-icon">${verdict.outcome==='win'?'🏆':verdict.outcome==='tie'?'🤝':'🎯'}</div><div><strong>${verdict.title}</strong><p>${verdict.copy}</p><small>${benchmark}</small></div>`;
    }
    $('#winPrimaryBtn').textContent='Pokračovat v mém postupu';
    $('#winMenuBtn').textContent='← Volná hra';
    if(!ctx.completedTracked){ctx.completedTracked=true;saveSession(ctx);track('shared_level_completed');if(verdict.outcome==='win')track('shared_level_beaten')}
  };

  const buildChallengeUrl=(puzzle,rec)=>{
    const u=new URL(SHARE_URL||`${location.origin}/`);
    u.searchParams.set('play',puzzle.id);
    u.searchParams.set('t',String(Math.max(1000,Math.round(Number(rec.elapsedMs)||1000))));
    u.searchParams.set('h',String(Math.max(0,Math.round(Number(rec.hintsUsed)||0))));
    u.searchParams.set('m',String(Math.max(1,Math.round(Number(rec.moves)||1))));
    return u.href;
  };

  const buildDailyUrl=()=>{
    const u=new URL(SHARE_URL||`${location.origin}/`);
    PARAMS.forEach(k=>u.searchParams.delete(k));
    u.searchParams.set('open','daily');
    u.searchParams.set('via','share-daily');
    return u.href;
  };

  const shareDailyChallenge=async()=>{
    const g=currentGame?.mode==='daily'?currentGame:null;
    const date=g?.dailyDate||pragueDateISO();
    let daily=null;
    try{daily=dailyResultState(date)}catch{}
    const puzzle=g?.puzzle||daily?.puzzle;
    const stored=daily?.active||null;
    const rec=g?.finished?{
      elapsedMs:g.elapsedMs,
      moves:g.moves,
      hintsUsed:g.hints||0,
      cleanSolve:(g.hints||0)===0
    }:stored;
    if(!puzzle||!rec)return baseShareDaily?.();

    const stats=effectiveStats();
    const rank=winDailyGlobalData?.date===date&&winDailyGlobalData?.myRank
      ?` · 🌍 ${winDailyGlobalData.myRank}. z ${winDailyGlobalData.total}`
      :'';
    const clean=Number(rec.hintsUsed||0)===0?'✨ čistě':`💡 ${countCz(Number(rec.hintsUsed||0),'nápověda','nápovědy','nápověd')}`;
    const url=buildDailyUrl();
    const title='Proplet · dnešní výzva';
    const text=`☀️ Dnešní Proplet mám za ${fmtTime(rec.elapsedMs)}. Překonáš mě?\n📅 ${formatDateCZ(date)} · ${diffLabel(puzzle.difficulty)} · 🔥 ${countCz(stats.currentStreak,'den','dny','dní')}${rank}\n${clean} · ${countCz(rec.moves,'tah','tahy','tahů')}`;
    track('daily_share_clicked');
    try{
      if(navigator.share){await navigator.share({title,text,url});track('daily_share_native_completed')}
      else{await navigator.clipboard.writeText(`${text}\n${url}`);track('daily_share_clipboard_completed');showToast('Výzva i odkaz jsou ve schránce ✓')}
      track('daily_share_created');
    }catch(e){if(e?.name==='AbortError')track('daily_share_cancelled');else{track('daily_share_failed');showToast('Sdílení se nepovedlo. Zkus to znovu.')}}
  };

  const shareCompetitive=async(puzzle,rec,rankText='')=>{
    if(!puzzle||!rec)return;
    const level=Number(puzzle.meta?.level)||'?',diff=diffLabel(puzzle.difficulty),url=buildChallengeUrl(puzzle,rec),clean=Number(rec.hintsUsed||0)===0?'✨ čistě':`💡 ${rec.hintsUsed||0}×`,title=`Proplet výzva · ${diff} #${level}`,text=`🧩 ${title}${rankText?` · ${rankText}`:''}\n⏱ ${fmtTime(rec.elapsedMs)} · ${clean} · ${countCz(rec.moves,'tah','tahy','tahů')}\nDokážeš mě porazit? 👀`;
    track('level_share_clicked');
    try{
      if(navigator.share){await navigator.share({title,text,url});track('level_share_native_completed')}
      else{await navigator.clipboard.writeText(`${text}\n${url}`);track('level_share_clipboard_completed');showToast('Výzva i odkaz jsou ve schránce ✓')}
      track('level_share_created');
    }catch(e){if(e?.name==='AbortError')track('level_share_cancelled');else{track('level_share_failed');showToast('Sdílení se nepovedlo. Zkus to znovu.')}}
  };

  const shareCurrent=async()=>{
    const g=currentGame;
    if(g?.mode==='daily')return shareDailyChallenge();
    if(g?.mode!=='free'||!g?.puzzle){return baseShareDaily?.()}
    const stored=getState().completed?.[`free:${g.puzzle.id}`];
    const rec=g.finished?{elapsedMs:g.elapsedMs,moves:g.moves,hintsUsed:g.hints||0,cleanSolve:(g.hints||0)===0}:(stored||g);
    const rank=levelDetailContext?.puzzleId===g.puzzle.id&&levelDetailContext?.globalRank?`🌍 ${levelDetailContext.globalRank}. globálně`:levelDetailContext?.puzzleId===g.puzzle.id&&levelDetailContext?.teamRank?`${levelDetailContext.teamRank}. v týmu`:'';
    await shareCompetitive(g.puzzle,rec,rank);
  };

  const shareDetail=async()=>{
    const c=levelDetailContext;if(!c)return;
    const puzzle=activePuzzleById(c.puzzleId);const rec=localLevelResult(c.puzzleId)||c.result;
    if(!puzzle||!rec)return;
    const rank=c.globalRank?`🌍 ${c.globalRank}. globálně`:c.teamRank?`${c.teamRank}. v týmu`:'';
    await shareCompetitive(puzzle,rec,rank);
  };

  const bindShareHandlers=()=>{
    const win=document.querySelector('#winShareBtn'),detail=document.querySelector('#levelDetailShareBtn'),daily=document.querySelector('#shareDailyBtn'),playDaily=document.querySelector('#playDailyBtn');
    if(win)win.onclick=shareCurrent;
    if(detail)detail.onclick=shareDetail;
    if(daily)daily.onclick=shareDailyChallenge;
    if(playDaily)playDaily.onclick=startDaily;
  };

  const resolveIncoming=async()=>{
    if(!incomingRaw)return null;
    const puzzle=await resolvePuzzle(incomingRaw.puzzleId);
    if(!puzzle){track('shared_level_invalid');stripChallengeQuery();showToast('Tahle sdílená úroveň už není dostupná. Otevírám Volnou hru.');nav('free',{replace:true});incomingRaw=null;return null}
    const ctx={...incomingRaw,puzzleId:puzzle.id,difficulty:puzzle.difficulty,level:Number(puzzle.meta?.level)||null};
    track('shared_level_opened');
    pendingResolved={puzzle,ctx};
    let onboarded=false;try{onboarded=!!localStorage.getItem(ONBOARD_KEY)}catch{}
    if(onboarded){pendingResolved=null;startSharedChallenge(puzzle,ctx)}
    return {puzzle,ctx};
  };

  const install=()=>{
    if(installed)return true;
    try{
      if(typeof startGame!=='function'||typeof finishGame!=='function'||typeof performPostWinAction!=='function'||typeof startStarter!=='function'||typeof startDaily!=='function'||typeof shareDaily!=='function')return false;
      baseStartGame=startGame;basePerformPostWinAction=performPostWinAction;baseStartStarter=startStarter;baseStartDaily=startDaily;baseShareDaily=shareDaily;

      const sharingSessionHook={
        id:'competitive-sharing-session-v3331',
        priority:30,
        afterStart(event){
          const {puzzle,mode}=event;
          if(mode==='free'){
            const ctx=contextForPuzzle(puzzle?.id);
            if(ctx)attachGameChallengeUi(ctx);else{document.body.classList.remove('game-shared-challenge');document.querySelector('#sharedChallengeTarget')?.remove()}
          }else{document.body.classList.remove('game-shared-challenge');document.querySelector('#sharedChallengeTarget')?.remove()}
        },
      };
      if(typeof registerGameSessionHook==='function')registerGameSessionHook(sharingSessionHook);

      const sharingCompletionHook={
        id:'competitive-sharing-v3331',
        priority:30,
        before(event){
          const game=event.game;
          event.data.competitiveSharing={
            challenge:game?.mode==='free'?contextForPuzzle(game?.puzzle?.id):null,
            daily:game?.mode==='daily'?loadDailySession():null,
          };
        },
        after(event){
          const state=event.data.competitiveSharing||{},game=event.game;
          if(state.challenge)renderChallengeResult(state.challenge);
          if(state.daily&&game?.mode==='daily'&&game?.finished&&!state.daily.completedTracked){state.daily.completedTracked=true;track('shared_daily_completed');saveDailySession(null)}
        },
      };
      const sharingCompletionHookInstalled=typeof registerGameCompletionHook==='function'&&registerGameCompletionHook(sharingCompletionHook)!==false;
      if(!sharingCompletionHookInstalled){
        baseFinishGame=finishGame;
        finishGame=async function(){
          const ctx=currentGame?.mode==='free'?contextForPuzzle(currentGame?.puzzle?.id):null;
          const dailyCtx=currentGame?.mode==='daily'?loadDailySession():null;
          const out=await baseFinishGame.apply(this,arguments);
          if(ctx)renderChallengeResult(ctx);
          if(dailyCtx&&currentGame?.mode==='daily'&&currentGame?.finished&&!dailyCtx.completedTracked){dailyCtx.completedTracked=true;track('shared_daily_completed');saveDailySession(null)}
          return out;
        };
      }

      startDaily=function(){
        const out=baseStartDaily.apply(this,arguments),dailyCtx=loadDailySession();
        if(dailyCtx&&currentGame?.mode==='daily'&&!currentGame?.finished&&!dailyCtx.startedTracked){dailyCtx.startedTracked=true;saveDailySession(dailyCtx);track('shared_daily_started')}
        return out;
      };

      performPostWinAction=function(action){
        const ctx=currentGame?.sharedChallenge||contextForPuzzle(currentGame?.puzzle?.id);
        if(ctx&&currentGame?.finished&&currentGame?.mode==='free'){
          const diff=currentGame.puzzle.difficulty;
          document.querySelector('#sharedChallengeResult')?.classList.add('hidden');
          if(action==='continue'){track('shared_level_returned_to_progress');clearSession();startFree(diff);return}
          clearSession();nav('free',{replace:currentScreen==='game'});return;
        }
        return basePerformPostWinAction.apply(this,arguments);
      };

      startStarter=function(){
        if(pendingResolved){const {puzzle,ctx}=pendingResolved;pendingResolved=null;startSharedChallenge(puzzle,ctx);return}
        if(pendingResolvePromise){pendingResolvePromise.then(res=>{if(res&&pendingResolved){const {puzzle,ctx}=pendingResolved;pendingResolved=null;startSharedChallenge(puzzle,ctx)}else baseStartStarter()});return}
        return baseStartStarter.apply(this,arguments);
      };

      installed=true;window.__PROPLET_COMPETITIVE_SHARING_V3331__=true;
      incomingRaw=parseIncoming();
      parseIncomingDaily();
      activeChallenge=loadSession();
      const waitForBoot=()=>{
        if(typeof puzzleDB!=='undefined'&&puzzleDB){bindShareHandlers();if(incomingRaw&&!pendingResolvePromise)pendingResolvePromise=resolveIncoming().finally(()=>{pendingResolvePromise=null});return}
        setTimeout(waitForBoot,60);
      };
      waitForBoot();
      [300,800,1600].forEach(ms=>setTimeout(bindShareHandlers,ms));
      return true;
    }catch{return false}
  };

  let tries=0;
  const boot=()=>{if(install()||++tries>=100)return;setTimeout(boot,40)};
  boot();
})();
