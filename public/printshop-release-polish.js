(()=>{
  'use strict';
  if(window.__PROPLET_PRINTSHOP_RELEASE_POLISH_V1__)return;
  window.__PROPLET_PRINTSHOP_RELEASE_POLISH_V1__=true;

  const q=(s,r=document)=>r.querySelector(s);
  let freeObserver=null;
  let profileObserver=null;
  let modalObserver=null;
  let initialFreeRefreshDone=false;
  let polishQueued=false;

  function hardcoreDoneForUnlock(){
    try{
      const progress=typeof freeProgress==='function'?freeProgress('hardcore'):null;
      return Math.max(0,Number(progress?.done)||0);
    }catch{return 0}
  }

  function installMozkomorUnlockPatch(){
    if(typeof mozkomorUnlockState!=='function'||mozkomorUnlockState.__printshopAllHardcoreDone)return;
    const base=mozkomorUnlockState;
    const wrapped=function(){
      const state=base.apply(this,arguments)||{};
      const required=Math.max(1,Number(state.required)||200);
      const done=Math.min(required,Math.max(Number(state.done)||0,hardcoreDoneForUnlock()));
      const unlocked=state.unlocked===true||done>=required;
      if(unlocked&&state.unlocked!==true){
        try{
          if(typeof scopedStorageKey==='function'&&typeof MOZKOMOR_UNLOCK_KEY!=='undefined')localStorage.setItem(scopedStorageKey(MOZKOMOR_UNLOCK_KEY),'1');
        }catch{}
      }
      return {...state,done,required,unlocked};
    };
    wrapped.__printshopAllHardcoreDone=true;
    mozkomorUnlockState=wrapped;
  }

  function tuneMozkomorCopy(){
    try{
      if(typeof DIFF!=='undefined'&&DIFF?.mozkomor)DIFF.mozkomor.desc='10×10 · endgame pro hráče, kteří porazili Mozkožrouta.';
    }catch{}
  }

  function positionWeeklyBanner(){
    const banner=q('#newContentBanner'),cards=q('#difficultyCards');
    if(!banner||!cards||!cards.parentElement)return;
    let done=false;
    try{done=typeof latestContentUnplayed==='function'&&latestContentUnplayed().length===0&&typeof latestContentPuzzles==='function'&&latestContentPuzzles().length>0}catch{}
    if(!done)done=(banner.querySelector('h2')?.textContent||'').trim()==='Týdenní várka dohraná';
    if(done){
      if(cards.nextElementSibling!==banner)cards.insertAdjacentElement('afterend',banner);
      const gridStyle=getComputedStyle(cards);
      banner.style.marginTop=gridStyle.rowGap&&gridStyle.rowGap!=='normal'?gridStyle.rowGap:(gridStyle.gap&&gridStyle.gap!=='normal'?gridStyle.gap:'16px');
    }else{
      banner.style.marginTop='';
      if(banner.nextElementSibling!==cards)cards.parentElement.insertBefore(banner,cards);
    }
  }

  function installWeeklyBannerIcon(){
    const spark=q('#newContentBanner .new-content-spark');
    if(!spark||spark.dataset.weeklyIconReady==='1')return;
    spark.textContent='';
    const img=document.createElement('img');
    img.src='/weekly-banner-icon-optimized.svg';
    img.alt='';
    img.setAttribute('aria-hidden','true');
    img.style.width='42px';
    img.style.height='42px';
    img.style.display='block';
    img.style.objectFit='contain';
    spark.appendChild(img);
    spark.dataset.weeklyIconReady='1';
  }

  function polishFreeScreen(){
    q('#freeCalmQuick')?.remove();
    const note=q('#screen-free .mozkomor-lock-note');
    if(note&&note.textContent!=='🔒 Odemkne se po dokončení 200 Mozkožroutů')note.textContent='🔒 Odemkne se po dokončení 200 Mozkožroutů';
    positionWeeklyBanner();
    installWeeklyBannerIcon();
  }

  function polishProfileCopy(){
    q('#screen-profile>.screen-title>.eyebrow')?.remove();
    const card=q('#profileCard');
    if(card&&!getProfile?.()?.token){
      const heading=card.querySelector('h2');
      const button=card.querySelector('#profileCreateBtn');
      if(heading?.textContent?.trim()==='Nepřijdi o své výsledky')heading.textContent='Nepřijď o své výsledky';
      if(button&&button.textContent!=='Uložit výsledky · +500 XP')button.textContent='Uložit výsledky · +500 XP';
    }
    const modalTitle=q('#profileModalTitle');
    if(modalTitle?.textContent?.trim()==='Nepřijdi o své výsledky')modalTitle.textContent='Nepřijď o své výsledky';
    const accountEyebrow=q('#accountNudgeEyebrow');
    if(accountEyebrow?.textContent?.includes('NEPŘIJDI'))accountEyebrow.textContent=accountEyebrow.textContent.replace('NEPŘIJDI','NEPŘIJĎ');
    const winButton=q('#winAccountBtn');
    if(winButton&&!winButton.classList.contains('hidden')&&winButton.textContent.includes('Uložit výsledky')&&winButton.textContent!=='Uložit výsledky · +500 XP')winButton.textContent='Uložit výsledky · +500 XP';
  }

  function polish(){
    installMozkomorUnlockPatch();
    tuneMozkomorCopy();
    polishFreeScreen();
    polishProfileCopy();
  }

  function queuePolish(){
    if(polishQueued)return;
    polishQueued=true;
    queueMicrotask(()=>{polishQueued=false;polish()});
  }

  function wrapRender(name,after){
    const current=globalThis[name];
    if(typeof current!=='function'||current.__printshopReleasePolish)return;
    const wrapped=function(){const result=current.apply(this,arguments);try{after()}catch{}return result};
    wrapped.__printshopReleasePolish=true;
    globalThis[name]=wrapped;
  }

  function install(){
    installMozkomorUnlockPatch();
    tuneMozkomorCopy();
    wrapRender('renderFree',()=>queuePolish());
    wrapRender('renderProfile',()=>queuePolish());
    wrapRender('setAccountMode',()=>queuePolish());
    wrapRender('updateWinAccountCta',()=>queuePolish());
    if(!initialFreeRefreshDone&&typeof renderFree==='function'){
      initialFreeRefreshDone=true;
      try{renderFree()}catch{}
    }
    polish();
    const free=q('#screen-free');
    if(free&&!freeObserver){freeObserver=new MutationObserver(queuePolish);freeObserver.observe(free,{childList:true,subtree:true})}
    const profile=q('#screen-profile');
    if(profile&&!profileObserver){profileObserver=new MutationObserver(queuePolish);profileObserver.observe(profile,{childList:true,subtree:true})}
    const modal=q('#profileModal');
    if(modal&&!modalObserver){modalObserver=new MutationObserver(queuePolish);modalObserver.observe(modal,{childList:true,subtree:true,characterData:true})}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,300);
  setTimeout(install,1200);
})();
