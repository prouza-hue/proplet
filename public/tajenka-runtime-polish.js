(()=>{
  'use strict';
  if(window.__PROPLET_TAJENKA_RUNTIME_POLISH__)return;
  window.__PROPLET_TAJENKA_RUNTIME_POLISH__=true;

  const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const qa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
  let queued=false;
  let lastMobileHintToast='';
  let toastResetTimer=0;

  function isPhoneLayout(){
    return window.matchMedia?.('(max-width:600px)')?.matches===true;
  }

  function semanticHintText(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    return raw.replace(/^[💭💡]\s*/u,'').trim();
  }

  function semanticHintIcon(){
    const icon=document.createElement('span');
    icon.className='tajenka-semantic-hint-icon';
    icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M9 18h6M10 22h4"/><path d="M8.2 14.5A6 6 0 1 1 15.8 14.5c-.9.8-1.3 1.6-1.3 2.5h-5c0-.9-.4-1.7-1.3-2.5Z"/></svg>';
    return icon;
  }

  function renderSemanticHint(el,clue){
    if(!el||!clue)return;
    el.classList.add('tajenka-semantic-hint');
    if(el.dataset.tajenkaSemanticClue===clue&&q('.tajenka-semantic-hint-icon',el)&&q('.tajenka-semantic-hint-text',el))return;
    const text=document.createElement('span');
    text.className='tajenka-semantic-hint-text';
    text.textContent=clue;
    el.replaceChildren(semanticHintIcon(),text);
    el.dataset.tajenkaSemanticClue=clue;
  }

  function clearSemanticHint(el){
    if(!el)return;
    el.classList.remove('tajenka-semantic-hint');
    delete el.dataset.tajenkaSemanticClue;
  }

  function showMobileHintToast(clue){
    if(!clue||clue===lastMobileHintToast)return;
    lastMobileHintToast=clue;
    try{
      if(typeof showToast==='function')showToast(`💡 ${clue}`);
      const toast=q('#toast');
      if(toast){
        toast.classList.add('tajenka-hint-toast');
        clearTimeout(toastResetTimer);
        toastResetTimer=setTimeout(()=>toast.classList.remove('tajenka-hint-toast'),3400);
      }
    }catch{}
  }

  function syncSemanticHint(){
    const game=q('#screen-game');
    const message=q('#gameMessage');
    const banner=q('#tajenkaHintBanner');
    if(!game?.classList.contains('tajenka-mode')){
      clearSemanticHint(message);
      clearSemanticHint(banner);
      lastMobileHintToast='';
      return;
    }

    const bannerClue=semanticHintText(banner?.dataset.tajenkaSemanticClue||banner?.textContent||'');
    if(!bannerClue){
      if(!message?.classList.contains('tajenka-semantic-hint'))clearSemanticHint(message);
      return;
    }

    const messageRaw=message?.classList.contains('tajenka-semantic-hint')
      ? semanticHintText(message.dataset.tajenkaSemanticClue||'')
      : semanticHintText(message?.textContent||'');

    /* Level 2/3 hints replace #gameMessage. Once that happens, the old level-1
       clue must stop owning the surface. */
    if(messageRaw&&messageRaw!==bannerClue){
      banner?.classList.add('hidden');
      clearSemanticHint(banner);
      clearSemanticHint(message);
      lastMobileHintToast='';
      return;
    }

    if(banner){
      banner.dataset.tajenkaSemanticClue=bannerClue;
      banner.classList.add('hidden');
    }
    renderSemanticHint(message,bannerClue);
    if(isPhoneLayout())showMobileHintToast(bannerClue);
  }

  function ensureTajenkaPhraseShell(){
    const box=q('#tajenkaPhrase');
    if(!box)return;
    const game=q('#screen-game');
    if(!game?.classList.contains('tajenka-mode')){
      box.classList.add('hidden');
      return;
    }

    let progress=q('#tajenkaProgress',box);
    let slots=q('#tajenkaSlots',box);
    if(!progress||!slots){
      box.innerHTML='<div class="tajenka-phrase-head"><span class="stat-label">TAJENKA</span><div id="tajenkaProgress" class="tajenka-progress" aria-live="polite"></div></div><div id="tajenkaSlots" class="tajenka-slots"></div>';
      progress=q('#tajenkaProgress',box);
      slots=q('#tajenkaSlots',box);
    }

    if(!progress||!slots)return;
    try{
      if(typeof currentGame!=='undefined'&&currentGame?.mode==='tajenka'&&typeof renderTajenkaPhrase==='function')renderTajenkaPhrase(currentGame);
    }catch{}
  }

  function calmRunActive(){
    try{if(typeof currentGame!=='undefined'&&currentGame?.calmMode===true)return true}catch{}
    return document.body.classList.contains('calm-run-v334');
  }

  function syncCalmAction(){
    if(!calmRunActive())return;
    /* Do not merely hide the action. Remove it from the DOM so Fold/desktop
       layout CSS cannot resurrect it. If the legacy polish recreates it later,
       this observer removes it again on the next frame. */
    qa('#calmRunBtn').forEach(btn=>btn.remove());
  }

  function run(){
    queued=false;
    ensureTajenkaPhraseShell();
    syncSemanticHint();
    syncCalmAction();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(run);
  }

  function install(){
    run();
    const game=q('#screen-game');
    const observer=new MutationObserver(queue);
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(game)observer.observe(game,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',queue,{passive:true});
    window.visualViewport?.addEventListener?.('resize',queue,{passive:true});
    screen.orientation?.addEventListener?.('change',queue);
    navigator.devicePosture?.addEventListener?.('change',queue);
    [0,80,220,500,1200].forEach(ms=>setTimeout(queue,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
