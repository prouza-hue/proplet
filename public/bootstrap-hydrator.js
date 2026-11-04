(()=>{
  if(window.__PROPLET_BOOTSTRAP_HYDRATOR_INSTALLED__)return;
  window.__PROPLET_BOOTSTRAP_HYDRATOR_INSTALLED__=true;

  let startGameWrapped=false;
  let hydrationPromise=null;
  let pendingStart=0;

  const playablePuzzle=puzzle=>{
    const rows=Number(puzzle?.rows),cols=Number(puzzle?.cols);
    return !!(puzzle?.id&&Array.isArray(puzzle?.answers)&&puzzle.answers.length&&Array.isArray(puzzle?.letters)&&Array.isArray(puzzle?.mask)&&rows>0&&cols>0&&puzzle.letters.length===rows*cols&&puzzle.mask.length);
  };

  const cacheCanonicalResponse=response=>{
    if(!response?.ok||!('caches' in window))return;
    try{const cachedResponse=response.clone();caches.open('proplet-data-v12-dated-daily').then(cache=>cache.put('/puzzles.json',cachedResponse)).catch(()=>{})}catch{}
  };

  const fetchCanonical=()=>fetch('/puzzles.json',{cache:'no-store'}).then(response=>{
    if(!response?.ok)throw new Error(`canonical-puzzle-db-${response?.status||'fetch'}`);
    cacheCanonicalResponse(response);
    return response.json();
  });

  const fullData=()=>{
    if(window.__PROPLET_FETCH_FULL_PUZZLE_DATA)return window.__PROPLET_FETCH_FULL_PUZZLE_DATA();
    const prefetched=window.__PROPLET_FULL_PUZZLE_DATA_PROMISE;
    if(prefetched)return Promise.resolve(prefetched).catch(()=>fetchCanonical());
    return fetchCanonical();
  };

  const canonicalPuzzle=(full,puzzle,mode)=>{
    if(!puzzle?.id)return null;
    if(mode==='rescue')return (full?.rescue||[]).find(candidate=>candidate.id===puzzle.id)||null;
    if(mode==='free'){
      const hinted=full?.free?.[puzzle.difficulty]||[];
      const direct=hinted.find(candidate=>candidate.id===puzzle.id);
      if(direct)return direct;
      for(const bank of Object.values(full?.free||{})){
        const found=(bank||[]).find(candidate=>candidate.id===puzzle.id);
        if(found)return found;
      }
    }
    return null;
  };

  const installFullDatabase=full=>{
    if(typeof compatiblePuzzleDatabase!=='function'||!compatiblePuzzleDatabase(full))throw new Error('canonical-puzzle-db-version');
    if(typeof puzzleDB==='undefined'||!puzzleDB?.bootstrapSchema)return puzzleDB;

    const bootstrap=puzzleDB;
    const rolling=bootstrap.rollingContent;
    const content=bootstrap.contentStatus;
    const rollingExtras={};
    for(const difficulty of Object.keys(bootstrap.free||{})){
      rollingExtras[difficulty]=(bootstrap.free[difficulty]||[]).filter(puzzle=>puzzle?.meta?.rollingContent&&playablePuzzle(puzzle));
    }

    puzzleDB=full;
    for(const [difficulty,extras] of Object.entries(rollingExtras)){
      const bank=puzzleDB.free?.[difficulty];
      if(!Array.isArray(bank))continue;
      const seen=new Set(bank.map(puzzle=>puzzle.id));
      for(const puzzle of extras){
        if(!seen.has(puzzle.id)){bank.push(puzzle);seen.add(puzzle.id)}
      }
    }
    if(rolling)puzzleDB.rollingContent=rolling;
    if(content)puzzleDB.contentStatus=content;

    window.__PROPLET_BOOTSTRAP_HYDRATED__=true;
    document.dispatchEvent(new CustomEvent('proplet:content-ready'));
    try{typeof renderDaily==='function'&&renderDaily()}catch{}
    try{typeof renderFree==='function'&&renderFree()}catch{}
    return puzzleDB;
  };

  const ensureFullDatabase=()=>{
    if(typeof puzzleDB!=='undefined'&&!puzzleDB?.bootstrapSchema)return Promise.resolve(puzzleDB);
    if(!window.__PROPLET_BOOTSTRAP_DELIVERED__)return Promise.resolve(typeof puzzleDB==='undefined'?null:puzzleDB);
    if(hydrationPromise)return hydrationPromise;
    hydrationPromise=fullData().then(installFullDatabase).catch(error=>{
      hydrationPromise=null;
      throw error;
    });
    return hydrationPromise;
  };

  const installStartGate=()=>{
    try{
      if(typeof startGame!=='function'){
        setTimeout(installStartGate,0);
        return;
      }
      if(startGameWrapped)return;
      startGameWrapped=true;
      const canonicalStartGame=startGame;
      startGame=function(puzzle,mode,dailyDate,options={}){
        if(mode!=='starter'&&typeof allowAccountGameStart==='function'&&!allowAccountGameStart())return;
        const request=++pendingStart;
        const requestedProfile=typeof getProfile==='function'?getProfile():null;
        const requestedScreen=typeof currentScreen==='undefined'?null:currentScreen;
        const needsFull=!puzzle?.meta?.archiveExperience&&(mode==='free'||mode==='rescue')&&typeof puzzleDB!=='undefined'&&puzzleDB?.bootstrapSchema===1;
        if(!needsFull)return canonicalStartGame(puzzle,mode,dailyDate,options);
        return ensureFullDatabase().then(full=>{
          if(request!==pendingStart)return;
          if(requestedScreen!==null&&currentScreen!==requestedScreen)return;
          if(typeof getProfile==='function'){
            const active=getProfile();
            if(active?.id!==requestedProfile?.id||active?.token!==requestedProfile?.token)return;
          }
          const resolved=canonicalPuzzle(full,puzzle,mode);
          if(!playablePuzzle(resolved))throw new Error('canonical-puzzle-missing');
          return canonicalStartGame(resolved,mode,dailyDate,options);
        }).catch(error=>{
          if(request!==pendingStart)return;
          console.warn('bootstrap hydration failed before game start',error);
          if(options.firstSteps)return false;
          try{typeof showToast==='function'&&showToast('Herní banka se ještě načítá. Zkus to prosím znovu.')}catch{}
        });
      };
      window.__PROPLET_ENSURE_FULL_PUZZLE_DB=ensureFullDatabase;

      // Free/rescue entry above is the demand boundary. Daily/home need only
      // the bootstrap; no full-bank parsing or readiness polling in idle.
    }catch{setTimeout(installStartGate,0)}
  };

  installStartGate();
})();

