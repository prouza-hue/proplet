(()=>{
  'use strict';
  if(window.__PROPLET_VALID_WORD_FAILSAFE_V3330__)return;
  window.__PROPLET_VALID_WORD_FAILSAFE_V3330__=true;

  const FAILSAFE_SHOWN_KEY='proplet-v3-32-8-valid-nonsolution-failsafe-shown';
  const TRIGGER_STREAK=3;
  let localWords=null;
  let localWordsPromise=null;
  let trackedGame=null;
  let validNonSolutionStreak=0;
  let sessionFailsafeShown=false;
  let explainedWords=new Set();
  const recognitionCache=new Map();

  const normalize=word=>String(word||'').trim().toLocaleUpperCase('cs-CZ');

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
            if(exact<0&&sameWord<0&&!foundAlready&&!explainedWords.has(normalize(word)))candidate={game:g,word};
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
        recognizeWord(candidate.word).then(hit=>{
          if(!hit?.recognized)return;
          if(currentGame!==candidate.game||candidate.game.finished)return;
          resetForGame(candidate.game);
          const key=normalize(candidate.word);
          if(explainedWords.has(key))return;
          explainedWords.add(key);
          validNonSolutionStreak++;
          track('valid_nonsolution_detected');
          // Accurate acknowledgement stays useful even after the one-time explanatory modal has
          // already been seen. Each distinct word is explained at most once per game.
          message(`„${candidate.word}“ je slovo 👍 Jen nepatří do řešení.`);
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

  let tries=0;
  const boot=()=>{
    if(install()||++tries>=80)return;
    setTimeout(boot,50);
  };
  boot();
})();
