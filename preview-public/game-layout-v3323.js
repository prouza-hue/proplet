(()=>{
  const PHONE_CLASS='game-phone-landscape-blocked';
  const TABLET_CLASS='game-tablet-landscape';
  let pausedByGuard=false;
  let currentWord=null;
  let originalParent=null;
  let originalNext=null;
  let raf=0;

  const coarsePointer=()=>{
    try{return !!window.matchMedia?.('(pointer: coarse)')?.matches||navigator.maxTouchPoints>0}catch{return navigator.maxTouchPoints>0}
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

    /* Fold-safe rule: if stable screen geometry and the viewport agree, trust that before
       Orientation API. Browser chrome can change viewport height, but not screen geometry. */
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

    /* Samsung Fold inner displays are near-square and can be only ~680 CSS px wide depending
       on display scaling. Recognize that shape before applying phone thresholds. */
    const unfoldedLike=viewLong>=600&&viewShort>=480&&viewRatio<1.55;
    if(unfoldedLike)return false;

    return screenShort<600||(viewShort<=560&&viewRatio>=1.6);
  };

  const ensureNodes=()=>{
    if(!currentWord){
      currentWord=document.querySelector('.game-board-column>.current-word')||document.querySelector('.current-word');
      if(currentWord){originalParent=currentWord.parentNode;originalNext=currentWord.nextSibling}
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

  const moveCurrentWordToRail=()=>{
    ensureNodes();
    const rail=document.querySelector('.game-control-column');
    if(currentWord&&rail&&currentWord.parentNode!==rail)rail.insertBefore(currentWord,rail.firstChild);
  };

  const restoreCurrentWord=()=>{
    if(!currentWord||!originalParent||currentWord.parentNode===originalParent)return;
    if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(currentWord,originalNext);
    else originalParent.appendChild(currentWord);
  };

  const refit=()=>requestAnimationFrame(()=>{
    try{if(typeof fitGameBoard==='function')fitGameBoard()}catch{}
    try{if(typeof drawPaths==='function')drawPaths()}catch{}
  });

  const setDebugMode=(mode,d,landscape,phone)=>{
    const root=document.documentElement;
    root.dataset.gameLayoutMode=mode;
    root.dataset.gameLayoutOrientation=landscape?'landscape':'portrait';
    root.dataset.gameLayoutDevice=phone?'phone':'large-touch';
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
      setDebugMode('phone-landscape-blocked',d,landscape,phone);
      document.body.classList.remove(TABLET_CLASS);
      restoreCurrentWord();
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

    /* 600px is deliberate: Fold 7 inner landscape can land around 680 CSS px under Samsung
       display scaling. Phone cover landscape is already excluded above by phoneLike(). */
    const tabletLandscape=playing&&landscape&&!phone&&coarsePointer()&&d.w>=600&&d.w<=1280;
    document.body.classList.toggle(TABLET_CLASS,tabletLandscape);
    if(tabletLandscape)moveCurrentWordToRail();else restoreCurrentWord();
    setDebugMode(tabletLandscape?'tablet-landscape':playing?'standard':'inactive',d,landscape,phone);
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
