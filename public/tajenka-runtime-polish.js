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

  function syncSemanticHint(){
    const game=q('#screen-game');
    const message=q('#gameMessage');
    const banner=q('#tajenkaHintBanner');
    if(!game?.classList.contains('tajenka-mode')){
      message?.classList.remove('tajenka-semantic-hint');
      banner?.classList.remove('tajenka-semantic-hint');
      return;
    }

    const bannerRaw=String(banner?.textContent||'').trim();
    const messageRaw=String(message?.textContent||'').trim();
    const bannerLooksSemantic=!!bannerRaw;
    const messageLooksSemantic=/^[💭💡]/u.test(messageRaw);
    const clue=semanticHintText(bannerLooksSemantic?bannerRaw:(messageLooksSemantic?messageRaw:''));
    if(!clue)return;

    const text=`💡 ${clue}`;
    if(banner){
      banner.classList.add('tajenka-semantic-hint');
      if(String(banner.textContent||'').trim()!==text)banner.textContent=text;
    }
    if(message&&messageLooksSemantic){
      message.classList.add('tajenka-semantic-hint');
      if(String(message.textContent||'').trim()!==text)message.textContent=text;
    }
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
