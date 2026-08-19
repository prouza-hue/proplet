(()=>{
  const PHONE_CLASS='game-phone-landscape-blocked';
  const TABLET_CLASS='game-tablet-landscape';
  const DESKTOP_CLASS='game-desktop-wide';
  let pausedByGuard=false;
  let currentWord=null;
  let currentWordParent=null;
  let currentWordNext=null;
  let gameInfo=null;
  let gameInfoParent=null;
  let gameInfoNext=null;
  let raf=0;

  const coarsePointer=()=>{
    try{return !!window.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0}catch{return navigator.maxTouchPoints>0}
  };
  const finePointer=()=>{
    try{return !!window.matchMedia?.('(any-pointer: fine)')?.matches}catch{return false}
  };

  const dimensions=()=>{
    const vv=window.visualViewport;
    const w=Math.max(1,Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||1));
    const h=Math.max(1,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||1));
    const sw=Math.max(1,Math.round(Number(screen.width)||w));
    const sh=Math.max(1,Math.round(Number(screen.height)||h));
    return {w,h,sw,sh};
  };

  const physicalLandscape=({w,h,sw,sh})=>{
    const screenLandscape=sw>sh;
    const viewportLandscape=w>h;
    const screenDelta=Math.abs(sw-sh)/Math.max(sw,sh);
    if(screenDelta>=0.035&&screenLandscape===viewportLandscape)return screenLandscape;
    try{
      const type=screen.orientation?.type||'';
      if(type.startsWith('landscape'))return true;
      if(type.startsWith('portrait'))return false;
    }catch{}
    if(screenDelta>=0.035)return screenLandscape;
    return viewportLandscape;
  };

  const phoneLike=({w,h,sw,sh})=>{
    if(!coarsePointer())return false;
    const screenShort=Math.min(sw,sh);
    const viewShort=Math.min(w,h);
    const viewLong=Math.max(w,h);
    const viewRatio=viewLong/Math.max(1,viewShort);
    const unfoldedLike=viewLong>=600&&viewShort>=480&&viewRatio<1.55;
    if(unfoldedLike)return false;
    return screenShort<600||(viewShort<=560&&viewRatio>=1.6);
  };

  const ensureNodes=()=>{
    if(!currentWord){
      currentWord=document.querySelector('.game-board-column>.current-word')||document.querySelector('.current-word');
      if(currentWord){currentWordParent=currentWord.parentNode;currentWordNext=currentWord.nextSibling}
    }
    if(!gameInfo){
      gameInfo=document.querySelector('.game-board-column>.game-info')||document.querySelector('.game-info');
      if(gameInfo){gameInfoParent=gameInfo.parentNode;gameInfoNext=gameInfo.nextSibling}
    }
    if(!document.querySelector('.phone-landscape-guard')){
      const guard=document.createElement('div');
      guard.className='phone-landscape-guard';
      guard.setAttribute('role','status');
      guard.setAttribute('aria-live','polite');
      guard.innerHTML='<div class="phone-landscape-guard-card"><div class="phone-landscape-guard-icon" aria-hidden="true">📱↻</div><strong>Otoč telefon na výšku</strong><p>Proplet potřebuje na mobilu víc výšky pro mřížku. Otoč telefon a hned pokračujeme.</p></div>';
      document.body.appendChild(guard);
    }
  };

  const restoreNode=(node,parent,next)=>{
    if(!node||!parent||node.parentNode===parent)return;
    if(next&&next.parentNode===parent)parent.insertBefore(node,next);
    else parent.appendChild(node);
  };

  const moveCurrentWordToRail=()=>{
    ensureNodes();
    const rail=document.querySelector('.game-control-column');
    if(currentWord&&rail&&currentWord.parentNode!==rail)rail.insertBefore(currentWord,rail.firstChild);
  };

  const moveDesktopStatusToRail=()=>{
    ensureNodes();
    const rail=document.querySelector('.game-control-column');
    if(!rail)return;
    if(currentWord&&currentWord.parentNode!==rail)rail.insertBefore(currentWord,rail.firstChild);
    if(gameInfo&&gameInfo.parentNode!==rail){
      const anchor=currentWord?.parentNode===rail?currentWord.nextSibling:rail.firstChild;
      rail.insertBefore(gameInfo,anchor);
    }
  };

  const restoreCurrentWord=()=>restoreNode(currentWord,currentWordParent,currentWordNext);
  const restoreGameInfo=()=>restoreNode(gameInfo,gameInfoParent,gameInfoNext);
  const restoreGameBoardNodes=()=>{
    // Current word was originally directly after game info. Restore it first so the saved
    // game-info anchor exists again, then put game info back in front of it.
    restoreCurrentWord();
    restoreGameInfo();
  };

  const refit=()=>requestAnimationFrame(()=>{
    try{if(typeof fitGameBoard==='function')fitGameBoard()}catch{}
    try{if(typeof drawPaths==='function')drawPaths()}catch{}
  });

  const setDebugMode=(mode,d,landscape,device)=>{
    const root=document.documentElement;
    root.dataset.gameLayoutMode=mode;
    root.dataset.gameLayoutOrientation=landscape?'landscape':'portrait';
    root.dataset.gameLayoutDevice=device;
    root.dataset.gameLayoutMetrics=`${d.w}x${d.h}|${d.sw}x${d.sh}`;
  };

  const apply=()=>{
    raf=0;
    ensureNodes();
    const playing=document.body.classList.contains('playing');
    const d=dimensions();
    const landscape=physicalLandscape(d);
    const phone=phoneLike(d);
    const blocked=playing&&landscape&&phone;

    document.body.classList.toggle(PHONE_CLASS,blocked);
    if(blocked){
      setDebugMode('phone-landscape-blocked',d,landscape,'phone');
      document.body.classList.remove(TABLET_CLASS,DESKTOP_CLASS);
      restoreGameBoardNodes();
      if(!pausedByGuard){
        try{if(typeof pauseGameClock==='function')pausedByGuard=!!pauseGameClock('landscape')}catch{}
      }
      refit();
      return;
    }

    if(pausedByGuard){
      try{if(typeof resumeGameClock==='function')resumeGameClock()}catch{}
      pausedByGuard=false;
    }

    /* A fine pointer plus a genuinely wide viewport gets its own laptop/monitor composition.
       Touch-first Fold/tablet behavior remains unchanged and takes precedence below 1000px. */
    const desktopWide=playing&&!phone&&finePointer()&&d.w>=1000&&d.h>=650;
    const tabletLandscape=playing&&!desktopWide&&landscape&&!phone&&coarsePointer()&&d.w>=600&&d.w<=1280;
    document.body.classList.toggle(TABLET_CLASS,tabletLandscape);
    document.body.classList.toggle(DESKTOP_CLASS,desktopWide);

    if(desktopWide){
      moveDesktopStatusToRail();
    }else if(tabletLandscape){
      restoreGameInfo();
      moveCurrentWordToRail();
    }else{
      restoreGameBoardNodes();
    }

    setDebugMode(
      desktopWide?'desktop-wide':tabletLandscape?'tablet-landscape':playing?'standard':'inactive',
      d,
      landscape,
      desktopWide?'desktop':tabletLandscape?'large-touch':phone?'phone':'standard',
    );
    refit();
  };

  const schedule=()=>{
    if(raf)return;
    raf=requestAnimationFrame(apply);
  };

  const boot=()=>{
    ensureNodes();
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('orientationchange',schedule,{passive:true});
    window.visualViewport?.addEventListener?.('resize',schedule,{passive:true});
    screen.orientation?.addEventListener?.('change',schedule);
    navigator.devicePosture?.addEventListener?.('change',schedule);
    schedule();
    [80,220,500].forEach(ms=>setTimeout(schedule,ms));
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
