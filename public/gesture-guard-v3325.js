(()=>{
  'use strict';

  const SELECTOR='#tutorialBoard .tutorial-cell, #board .cell';
  const CANCEL_WINDOW_MS=12000;
  let active=null;
  let cancelTimes=[];
  let conflictReported=false;
  let warningShown=false;

  const interactiveTarget=node=>node?.closest?.(SELECTOR)||null;

  const resetTutorial=()=>{
    try{
      if(typeof tutorialState!=='undefined'){
        tutorialState.dragging=false;
        tutorialState.path=[];
      }
      if(typeof renderTutorialPath==='function')renderTutorialPath();
    }catch{}
  };

  const resetGame=()=>{
    try{
      if(typeof currentGame!=='undefined'&&currentGame){
        currentGame.dragging=false;
        currentGame.path=[];
        currentGame.lastPointer=null;
      }
      if(typeof updateActive==='function'&&typeof currentGame!=='undefined'&&currentGame)updateActive();
    }catch{}
  };

  const reportConflict=()=>{
    if(conflictReported)return;
    conflictReported=true;
    try{
      fetch('/api/client-error',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          code:'gesture_conflict',
          message:active?.kind==='tutorial'?'pointercancel_tutorial':'pointercancel_game',
          route:location.pathname
        }),
        keepalive:true
      }).catch(()=>{});
    }catch{}
  };

  const showWarning=()=>{
    if(warningShown)return;
    warningShown=true;
    const copy='Prohlížeč přebírá tahy. Pokud se to opakuje, otevři Proplet přes ⋯ v Safari nebo Chrome.';
    const tutorial=document.querySelector('#tutorialSuccess');
    if(tutorial){
      const note=document.createElement('div');
      note.className='gesture-browser-warning';
      note.textContent=copy;
      tutorial.insertAdjacentElement('afterend',note);
      return;
    }
    try{if(typeof showToast==='function')showToast(copy)}catch{}
  };

  const recordCancel=()=>{
    const now=Date.now();
    cancelTimes=cancelTimes.filter(ts=>now-ts<=CANCEL_WINDOW_MS);
    cancelTimes.push(now);
    reportConflict();
    if(cancelTimes.length>=2)showWarning();
  };

  document.addEventListener('pointerdown',event=>{
    const target=interactiveTarget(event.target);
    if(!target)return;
    active={
      pointerId:event.pointerId,
      kind:target.closest('#tutorialBoard')?'tutorial':'game'
    };
  },true);

  /* iOS embedded browsers occasionally arbitrate a native navigation gesture after pointerdown.
     A non-passive touchmove is an extra belt-and-suspenders signal on top of touch-action:none. */
  document.addEventListener('touchmove',event=>{
    if(active&&event.cancelable)event.preventDefault();
  },{capture:true,passive:false});

  document.addEventListener('pointercancel',event=>{
    if(!active||event.pointerId!==active.pointerId)return;
    const kind=active.kind;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(kind==='tutorial')resetTutorial();else resetGame();
    recordCancel();
    active=null;
  },true);

  document.addEventListener('pointerup',event=>{
    if(active&&event.pointerId===active.pointerId)active=null;
  },true);

  /* The base tutorial's failure copy assumed the old horizontal-first geometry. Keep the source
     lesson untouched and correct only the rendered sentence when this release layer is active. */
  const syncTutorialCopy=()=>{
    const board=document.querySelector('#tutorialBoard');
    if(!board)return;
    const intro=board.closest('.onboard-content')?.querySelector('p.muted');
    if(intro&&intro.dataset.gestureCopy!=='1'){
      intro.dataset.gestureCopy='1';
      intro.innerHTML='Táhni nejdřív <b>P ↓ E</b> a potom <b>→ S</b>. Jen přes políčka vedle sebe.';
    }
    const success=document.querySelector('#tutorialSuccess');
    if(success&&!success.dataset.gestureCopyObserver){
      success.dataset.gestureCopyObserver='1';
      const rewrite=()=>{
        if(success.textContent?.startsWith('Skoro.'))success.textContent='Skoro. Zkus P ↓ E a potom doprava na S.';
      };
      new MutationObserver(rewrite).observe(success,{childList:true,characterData:true,subtree:true});
      rewrite();
    }
  };

  const observer=new MutationObserver(syncTutorialCopy);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  syncTutorialCopy();
})();
