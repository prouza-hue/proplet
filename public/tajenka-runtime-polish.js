(()=>{
  'use strict';
  if(window.__PROPLET_TAJENKA_RUNTIME_POLISH__)return;
  window.__PROPLET_TAJENKA_RUNTIME_POLISH__=true;

  const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
  const qa=(selector,root=document)=>[...(root?.querySelectorAll?.(selector)||[])];
  let queued=false;

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

  function syncSemanticHint(){
    const game=q('#screen-game');
    const message=q('#gameMessage');
    const banner=q('#tajenkaHintBanner');
    if(!game?.classList.contains('tajenka-mode')){
      clearSemanticHint(message);
      clearSemanticHint(banner);
      return;
    }

    /* The dedicated banner is the stable source of truth for level-1 Tajenka
       clues. It may already have had its emoji converted by organic-ui, so never
       use an emoji as the semantic marker here. */
    const clue=semanticHintText(banner?.dataset.tajenkaSemanticClue||banner?.textContent||'');
    if(!clue){
      clearSemanticHint(message);
      clearSemanticHint(banner);
      return;
    }

    renderSemanticHint(banner,clue);

    /* On Fold/tablet/desktop the visible clue surface is #gameMessage inside
       “Skládáš”. Organic UI may have replaced the original pictograph before
       this observer runs, so match by clue text instead of emoji. Do not steal
       later level-2/3 feedback: only own the message while it still contains
       this exact semantic clue. */
    const messageText=semanticHintText(message?.dataset.tajenkaSemanticClue||message?.textContent||'');
    if(message&&messageText===clue)renderSemanticHint(message,clue);
    else if(message)clearSemanticHint(message);
  }

  function calmRunActive(){
    if(document.body.classList.contains('calm-run-v334'))return true;
    try{return !!window.currentGame?.calmMode}catch{return false}
  }

  function syncCalmAction(){
    const active=calmRunActive();
    qa('#calmRunBtn').forEach(btn=>{
      if(active){
        btn.dataset.tajenkaCalmForcedHidden='1';
        btn.style.setProperty('display','none','important');
        btn.style.setProperty('visibility','hidden','important');
        btn.setAttribute('aria-hidden','true');
      }else if(btn.dataset.tajenkaCalmForcedHidden==='1'){
        delete btn.dataset.tajenkaCalmForcedHidden;
        btn.style.removeProperty('display');
        btn.style.removeProperty('visibility');
        btn.removeAttribute('aria-hidden');
      }
    });
  }

  function run(){
    queued=false;
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
    [0,80,220,500].forEach(ms=>setTimeout(queue,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
