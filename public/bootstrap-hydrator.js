(()=>{
  if(window.__PROPLET_BOOTSTRAP_HYDRATOR_INSTALLED__)return;
  window.__PROPLET_BOOTSTRAP_HYDRATOR_INSTALLED__=true;

  let startGameWrapped=false;
  let hydrationPromise=null;

  const playablePuzzle=puzzle=>{
    const rows=Number(puzzle?.rows),cols=Number(puzzle?.cols);
    return !!(puzzle?.id&&Array.isArray(puzzle?.answers)&&puzzle.answers.length&&Array.isArray(puzzle?.letters)&&Array.isArray(puzzle?.mask)&&rows>0&&cols>0&&puzzle.letters.length===rows*cols&&puzzle.mask.length);
  };

  const cacheCanonicalResponse=response=>{
    if(!response?.ok||!('caches' in window))return;
    try{caches.open('proplet-data-v11').then(cache=>cache.put('/puzzles.json',response.clone())).catch(()=>{})}catch{}
  };

  const fetchCanonical=()=>fetch('/puzzles.json',{cache:'no-store'}).then(response=>{
    if(!response?.ok)throw new Error(`canonical-puzzle-db-${response?.status||'fetch'}`);
    cacheCanonicalResponse(response);
    return response.json();
  });

  const fullData=()=>{
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
        const needsFull=(mode==='free'||mode==='rescue')&&typeof puzzleDB!=='undefined'&&puzzleDB?.bootstrapSchema===1;
        if(!needsFull)return canonicalStartGame(puzzle,mode,dailyDate,options);
        ensureFullDatabase().then(full=>{
          const resolved=canonicalPuzzle(full,puzzle,mode);
          if(!playablePuzzle(resolved))throw new Error('canonical-puzzle-missing');
          canonicalStartGame(resolved,mode,dailyDate,options);
        }).catch(error=>{
          console.warn('bootstrap hydration failed before game start',error);
          try{typeof showToast==='function'&&showToast('Herní banka se ještě načítá. Zkus to prosím znovu.')}catch{}
        });
      };
      window.__PROPLET_ENSURE_FULL_PUZZLE_DB=ensureFullDatabase;

      // Hydrate as soon as both sides are ready. The startGame gate above remains
      // as a race-condition guard for unusually slow connections.
      const hydrateWhenReady=()=>{
        try{
          if(window.__PROPLET_BOOTSTRAP_DELIVERED__&&typeof puzzleDB!=='undefined'&&puzzleDB?.bootstrapSchema===1){
            ensureFullDatabase().catch(error=>console.warn('background bootstrap hydration failed',error));
            return;
          }
          if(!window.__PROPLET_BOOTSTRAP_HYDRATED__)setTimeout(hydrateWhenReady,25);
        }catch{setTimeout(hydrateWhenReady,25)}
      };
      hydrateWhenReady();
    }catch{setTimeout(installStartGate,0)}
  };

  installStartGate();
})();
