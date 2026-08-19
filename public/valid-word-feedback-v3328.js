(()=>{
  'use strict';

  const EXPLAINED_KEY='proplet-v3-32-8-valid-nonsolution-explained';
  let validWords=null;
  let validWordsPromise=null;
  let sessionExplained=false;

  const normalize=word=>String(word||'').trim().toLocaleUpperCase('cs-CZ');

  const alreadyExplained=()=>{
    if(sessionExplained)return true;
    try{return localStorage.getItem(EXPLAINED_KEY)==='1'}catch{return false}
  };

  const markExplained=()=>{
    sessionExplained=true;
    try{localStorage.setItem(EXPLAINED_KEY,'1')}catch{}
  };

  const loadValidWords=()=>{
    if(validWords)return Promise.resolve(validWords);
    if(validWordsPromise)return validWordsPromise;
    validWordsPromise=fetch('/answer_tiers.json',{cache:'force-cache'})
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        const tiers=data?.tiers;
        if(!tiers||typeof tiers!=='object')return null;
        const words=[];
        Object.values(tiers).forEach(list=>{if(Array.isArray(list))words.push(...list)});
        validWords=new Set(words.map(normalize).filter(Boolean));
        return validWords;
      })
      .catch(()=>null);
    return validWordsPromise;
  };

  if(typeof submitPath!=='function')return;
  const originalSubmitPath=submitPath;

  submitPath=function(){
    let candidate=null;
    try{
      const g=currentGame,word=currentWord();
      if(g&&!g.finished&&g.mode!=='starter'&&g.mode!=='rescue'&&word.length>=4&&!alreadyExplained()){
        const exact=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
        const sameWord=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word);
        const foundAlready=g.found.some(f=>f.word===word);
        if(exact<0&&sameWord<0&&!foundAlready)candidate={game:g,word,expectedMoves:(g.moves||0)+1};
      }
    }catch{}

    const result=originalSubmitPath();

    if(candidate&&!alreadyExplained()){
      loadValidWords().then(set=>{
        if(!set?.has(normalize(candidate.word))||alreadyExplained())return;
        if(currentGame!==candidate.game||candidate.game.finished||candidate.game.moves!==candidate.expectedMoves)return;
        markExplained();
        message(`„${candidate.word}“ je platné slovo 👍 Jen není řešením téhle úrovně. Každý Proplet má vlastní sadu hledaných slov.`,'bad');
      }).catch(()=>{});
    }
    return result;
  };
})();
