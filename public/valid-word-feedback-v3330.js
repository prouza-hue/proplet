(()=>{
  'use strict';
  if(window.__PROPLET_VALID_WORD_FAILSAFE_V3330__)return;
  window.__PROPLET_VALID_WORD_FAILSAFE_V3330__=true;

  const FAILSAFE_SHOWN_KEY='proplet-v3-32-8-valid-nonsolution-failsafe-shown';
  const DISCOVERY_STORE_BASE='proplet-v4-word-discovery-v1';
  const DISCOVERY_REWARD_PREFIX='word_discovery_v1:';
  const TRIGGER_STREAK=3;
  let localWords=null;
  let localWordsPromise=null;
  let trackedGame=null;
  let validNonSolutionStreak=0;
  let sessionFailsafeShown=false;
  let explainedWords=new Set();
  const recognitionCache=new Map();
  let effectiveStatsPatched=false;
  let discoveryServerXp=0;
  let discoveryKnownKeys=new Set();
  let activeAccountScope=null;
  let discoverySyncInFlight=false;

  const normalize=word=>String(word||'').trim().toLocaleUpperCase('cs-CZ');
  const canonical=word=>normalize(word).toLocaleLowerCase('cs-CZ');
  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const scope=()=>String(profile()?.id||'guest');
  const discoveryStoreKey=s=>`${DISCOVERY_STORE_BASE}:${s}`;
  const discoveryRewardKey=(puzzleId,word)=>`${DISCOVERY_REWARD_PREFIX}${String(puzzleId||'').trim()}:${canonical(word)}`;

  const readDiscoveryStore=(s=scope())=>{
    try{
      const parsed=JSON.parse(localStorage.getItem(discoveryStoreKey(s))||'{}');
      return {entries:{},serverTotalXp:0,...parsed,entries:{...(parsed?.entries||{})}};
    }catch{return {entries:{},serverTotalXp:0}}
  };
  const writeDiscoveryStore=(value,s=scope())=>{
    try{localStorage.setItem(discoveryStoreKey(s),JSON.stringify(value))}catch{}
  };

  const rewardDisabled=()=>{
    try{
      if(typeof MOZKOMOR_MASOCHIST_PREVIEW!=='undefined'&&MOZKOMOR_MASOCHIST_PREVIEW)return true;
      if(typeof GEN4_CANDIDATE_PREVIEW!=='undefined'&&GEN4_CANDIDATE_PREVIEW)return true;
      if(typeof CONTENT_PREVIEW_DATE!=='undefined'&&CONTENT_PREVIEW_DATE)return true;
    }catch{}
    return false;
  };

  const currentDiscoveryXp=()=>{
    const store=readDiscoveryStore();
    const entries=Object.values(store.entries||{});
    const localTotal=entries.length;
    if(!profile()?.token)return localTotal;
    const pending=entries.filter(row=>row?.status==='pending').length;
    return Math.max(localTotal,Math.max(0,Number(discoveryServerXp||store.serverTotalXp||0))+pending);
  };

  const refreshVisibleUi=()=>{
    try{if(typeof renderDaily==='function')renderDaily()}catch{}
    try{if(typeof renderFree==='function')renderFree()}catch{}
    try{if(typeof renderProfile==='function')renderProfile()}catch{}
    try{if(typeof updateProfileChip==='function')updateProfileChip()}catch{}
  };

  const patchEffectiveStats=()=>{
    if(effectiveStatsPatched)return true;
    if(typeof effectiveStats!=='function')return false;
    effectiveStatsPatched=true;
    const originalEffectiveStats=effectiveStats;
    effectiveStats=function(){
      const stats=originalEffectiveStats.apply(this,arguments);
      const xp=rewardDisabled()?0:currentDiscoveryXp();
      if(!stats||xp<=0)return stats;
      return {...stats,points:Number(stats.points||0)+xp,wordDiscoveryXp:xp};
    };
    return true;
  };

  const ensureXpStyle=()=>{
    if(document.querySelector('#wordDiscoveryXpStyle'))return;
    const style=document.createElement('style');
    style.id='wordDiscoveryXpStyle';
    style.textContent=`
      .word-discovery-xp-pop{position:fixed;z-index:1600;pointer-events:none;font-weight:900;font-size:18px;line-height:1;padding:8px 11px;border-radius:999px;background:rgba(75,181,113,.96);color:#fff;box-shadow:0 8px 24px rgba(20,80,45,.22);transform:translate(-50%,0) scale(.94);opacity:0;animation:wordDiscoveryXpPop .62s cubic-bezier(.2,.8,.2,1) forwards}
      @keyframes wordDiscoveryXpPop{0%{opacity:0;transform:translate(-50%,8px) scale(.92)}18%{opacity:1;transform:translate(-50%,0) scale(1)}72%{opacity:1;transform:translate(-50%,-8px) scale(1)}100%{opacity:0;transform:translate(-50%,-16px) scale(.98)}}
      @media (prefers-reduced-motion:reduce){.word-discovery-xp-pop{animation:wordDiscoveryXpFade .5s linear forwards}@keyframes wordDiscoveryXpFade{0%,100%{opacity:0}20%,75%{opacity:1}}}
    `;
    document.head.appendChild(style);
  };

  const showXpPop=()=>{
    if(rewardDisabled())return;
    ensureXpStyle();
    const anchor=document.querySelector('#gameMessage')||document.querySelector('#currentWord')||document.querySelector('#board');
    const rect=anchor?.getBoundingClientRect?.();
    const pop=document.createElement('div');
    pop.className='word-discovery-xp-pop';
    pop.textContent='+1 XP';
    pop.setAttribute('aria-hidden','true');
    pop.style.left=`${Math.round(rect?.left+(rect?.width||0)/2||window.innerWidth/2)}px`;
    pop.style.top=`${Math.round((rect?.top||window.innerHeight*.55)-10)}px`;
    document.body.appendChild(pop);
    setTimeout(()=>pop.remove(),720);
  };

  const failsafeShown=()=>{
    if(sessionFailsafeShown)return true;
    try{return localStorage.getItem(FAILSAFE_SHOWN_KEY)==='1'}catch{return false}
  };

  const markFailsafeShown=()=>{
    sessionFailsafeShown=true;
    try{localStorage.setItem(FAILSAFE_SHOWN_KEY,'1')}catch{}
  };

  const track=event=>{
    try{if(typeof trackProductEvent==='function')trackProductEvent(event)}catch{}
  };

  const loadLocalWords=()=>{
    if(localWords)return Promise.resolve(localWords);
    if(localWordsPromise)return localWordsPromise;
    localWordsPromise=fetch('/valid-words-v3328.txt',{cache:'force-cache'})
      .then(r=>r.ok?r.text():null)
      .then(text=>{
        if(!text)return null;
        localWords=new Set(text.split(/\r?\n/).map(normalize).filter(w=>w.length>=4));
        return localWords;
      })
      .catch(()=>null);
    return localWordsPromise;
  };

  const recognizeWord=async word=>{
    const normalized=normalize(word);
    if(recognitionCache.has(normalized))return recognitionCache.get(normalized);
    const local=await loadLocalWords();
    if(local?.has(normalized)){
      const hit={recognized:true,source:'offline_seed'};
      recognitionCache.set(normalized,hit);
      return hit;
    }
    try{
      const response=await fetch(`/api/word-recognition?word=${encodeURIComponent(normalized)}`,{cache:'no-store'});
      if(!response.ok)throw new Error('recognition unavailable');
      const data=await response.json();
      const result={recognized:data?.recognized===true,source:data?.source||null};
      recognitionCache.set(normalized,result);
      return result;
    }catch{
      const miss={recognized:false,source:null};
      recognitionCache.set(normalized,miss);
      return miss;
    }
  };

  const migrateGuestDiscoveries=playerId=>{
    if(!playerId||playerId==='guest')return;
    const guest=readDiscoveryStore('guest');
    if(!Object.keys(guest.entries||{}).length)return;
    const target=readDiscoveryStore(playerId);
    for(const [key,row] of Object.entries(guest.entries||{})){
      if(!target.entries[key])target.entries[key]={...row,status:'pending'};
    }
    writeDiscoveryStore(target,playerId);
    try{localStorage.removeItem(discoveryStoreKey('guest'))}catch{}
  };

  const markServerState=(data,s=scope())=>{
    const store=readDiscoveryStore(s);
    const keys=new Set(Array.isArray(data?.rewardKeys)?data.rewardKeys:[]);
    discoveryKnownKeys=keys;
    discoveryServerXp=Math.max(0,Number(data?.totalDiscoveryXp||0));
    store.serverTotalXp=discoveryServerXp;
    for(const key of keys){
      if(store.entries[key])store.entries[key]={...store.entries[key],status:'confirmed'};
    }
    writeDiscoveryStore(store,s);
  };

  const claimPayload=row=>({
    puzzle_id:row.puzzleId,
    mode:row.mode,
    difficulty:row.difficulty,
    word:row.word,
    path:Array.isArray(row.path)?row.path:[],
    daily_date:row.dailyDate||null
  });

  const syncDiscoveries=async()=>{
    patchEffectiveStats();
    const p=profile();
    if(!p?.token){
      activeAccountScope=null;
      discoveryServerXp=0;
      discoveryKnownKeys=new Set();
      return;
    }
    const id=String(p.id||'');
    if(!id||discoverySyncInFlight)return;
    if(activeAccountScope!==id){
      migrateGuestDiscoveries(id);
      activeAccountScope=id;
      discoveryServerXp=0;
      discoveryKnownKeys=new Set();
    }
    discoverySyncInFlight=true;
    try{
      if(typeof api!=='function')return;
      const status=await api('/api/word-discovery/status');
      markServerState(status,id);
      const store=readDiscoveryStore(id);
      let changed=false;
      for(const [key,row] of Object.entries(store.entries||{})){
        if(row?.status!=='pending')continue;
        if(discoveryKnownKeys.has(key)){
          store.entries[key]={...row,status:'confirmed'};changed=true;continue;
        }
        try{
          const result=await api('/api/word-discovery/claim',{method:'POST',body:JSON.stringify(claimPayload(row))});
          store.entries[key]={...row,status:'confirmed'};changed=true;
          markServerState(result,id);
        }catch{}
      }
      if(changed)writeDiscoveryStore(store,id);
      refreshVisibleUi();
    }catch{}
    finally{discoverySyncInFlight=false}
  };

  const awardDiscovery=async candidate=>{
    if(rewardDisabled())return false;
    patchEffectiveStats();
    const key=discoveryRewardKey(candidate.puzzleId,candidate.word);
    const s=scope();
    const store=readDiscoveryStore(s);
    if(store.entries[key]){
      if(store.entries[key].status==='pending'&&profile()?.token)syncDiscoveries();
      return false;
    }

    const row={
      puzzleId:candidate.puzzleId,
      mode:candidate.mode,
      difficulty:candidate.difficulty,
      dailyDate:candidate.dailyDate||null,
      word:normalize(candidate.word),
      path:[...(candidate.path||[])],
      status:'pending',
      createdAt:new Date().toISOString()
    };

    if(!profile()?.token||typeof api!=='function'||navigator.onLine===false){
      store.entries[key]=row;
      writeDiscoveryStore(store,s);
      showXpPop();
      refreshVisibleUi();
      return true;
    }

    if(discoveryKnownKeys.has(key)){
      store.entries[key]={...row,status:'confirmed'};
      writeDiscoveryStore(store,s);
      return false;
    }

    try{
      const data=await api('/api/word-discovery/claim',{method:'POST',body:JSON.stringify(claimPayload(row))});
      store.entries[key]={...row,status:'confirmed'};
      writeDiscoveryStore(store,s);
      markServerState(data,s);
      if(data?.newlyGranted===true){
        showXpPop();
        refreshVisibleUi();
        return true;
      }
      refreshVisibleUi();
      return false;
    }catch{
      // Offline/transient failure: keep one provisional local XP and let the account sync settle
      // the unique server claim later. The reward key prevents replay/device farming.
      store.entries[key]=row;
      writeDiscoveryStore(store,s);
      showXpPop();
      refreshVisibleUi();
      setTimeout(syncDiscoveries,1400);
      return true;
    }
  };

  const resetForGame=g=>{
    if(trackedGame===g)return;
    trackedGame=g;
    validNonSolutionStreak=0;
    explainedWords=new Set();
  };

  const ensureModal=()=>{
    let modal=document.querySelector('#validWordFailsafeModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='validWordFailsafeModal';
    modal.className='modal hidden';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="modal-card helper-offer-card valid-word-failsafe-card"><div class="helper-big-icon">🧩</div><span class="eyebrow">JEN PŘIPOMENUTÍ</span><h2>Jo — jsou to skutečná slova.</h2><p class="muted">Proplet ale nehledá všechna česká slova, která na desce objevíš.</p><strong class="valid-word-rule">Každá deska má předem danou sadu slov. Když je najdeš, přesně vyplní celou plochu.</strong><button type="button" class="primary-btn big">Rozumím, hledám řešení</button></div>`;
    const close=()=>modal.classList.add('hidden');
    modal.querySelector('button').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close()};
    document.body.appendChild(modal);
    return modal;
  };

  const showFailsafe=()=>{
    if(failsafeShown())return;
    markFailsafeShown();
    track('valid_nonsolution_failsafe_shown');
    ensureModal().classList.remove('hidden');
  };

  const install=()=>{
    patchEffectiveStats();
    if(typeof submitPath!=='function')return false;
    if(submitPath.__validWordFailsafe3330)return true;
    const originalSubmitPath=submitPath;

    const wrapped=function(){
      let candidate=null,g=null,foundBefore=0;
      try{
        g=currentGame;
        if(g&&!g.finished&&g.mode!=='starter'&&g.mode!=='rescue'){
          resetForGame(g);
          foundBefore=g.found.length;
          const word=currentWord();
          if(word.length>=4){
            const exact=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
            const sameWord=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word);
            const foundAlready=g.found.some(f=>f.word===word);
            if(exact<0&&sameWord<0&&!foundAlready&&!explainedWords.has(normalize(word))){
              candidate={
                game:g,
                word,
                path:[...g.path],
                puzzleId:g.puzzle.id,
                mode:g.mode,
                difficulty:g.puzzle.difficulty,
                dailyDate:g.dailyDate||null
              };
            }
          }
        }
      }catch{}

      const result=originalSubmitPath.apply(this,arguments);

      try{
        if(g&&g.found.length>foundBefore){
          resetForGame(g);
          validNonSolutionStreak=0;
          return result;
        }
      }catch{}

      if(candidate){
        recognizeWord(candidate.word).then(async hit=>{
          if(!hit?.recognized)return;
          if(currentGame!==candidate.game||candidate.game.finished)return;
          resetForGame(candidate.game);
          const key=normalize(candidate.word);
          if(explainedWords.has(key))return;
          explainedWords.add(key);
          validNonSolutionStreak++;
          track('valid_nonsolution_detected');
          // It remains a wrong attempt for this board. Clean is unchanged because Clean is
          // defined by hints, not by exploratory traces.
          message(`„${candidate.word}“ je slovo 👍 Jen nepatří do řešení.`);
          await awardDiscovery(candidate);
          if(validNonSolutionStreak>=TRIGGER_STREAK&&!failsafeShown())showFailsafe();
        }).catch(()=>{});
      }
      return result;
    };
    wrapped.__validWordFailsafe3330=true;
    submitPath=wrapped;
    setTimeout(()=>loadLocalWords(),700);
    return true;
  };

  document.addEventListener('proplet:profile-refreshed',()=>syncDiscoveries());
  window.addEventListener('online',()=>syncDiscoveries());
  window.addEventListener('storage',e=>{
    if(e.key?.startsWith(DISCOVERY_STORE_BASE))refreshVisibleUi();
  });

  let tries=0;
  const boot=()=>{
    if(install()){
      syncDiscoveries();
      if(++tries<40)setTimeout(boot,1500);
      return;
    }
    if(++tries<100)setTimeout(boot,50);
  };
  boot();

  window.PROPLET_WORD_DISCOVERY_API=Object.freeze({
    xp:currentDiscoveryXp,
    sync:syncDiscoveries,
    rewardKey:discoveryRewardKey
  });
})();
