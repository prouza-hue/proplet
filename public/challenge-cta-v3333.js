(()=>{
  'use strict';
  if(window.__PROPLET_CHALLENGE_CTA_V3333__)return;
  window.__PROPLET_CHALLENGE_CTA_V3333__=true;

  const $=s=>document.querySelector(s);

  function syncShareCtas(){
    const win=$('#winShareBtn');
    const detail=$('#levelDetailShareBtn');
    let free=false;
    try{free=typeof currentGame!=='undefined'&&currentGame?.mode==='free'}catch{}

    if(win){
      if(free){
        win.textContent='⚔️ Pošli výzvu';
        win.classList.add('challenge-share-cta');
        win.setAttribute('aria-label','Poslat kamarádovi výzvu na stejný Proplet');
      }else{
        if(win.classList.contains('challenge-share-cta'))win.textContent='↗ Sdílet';
        win.classList.remove('challenge-share-cta');
        win.removeAttribute('aria-label');
      }
    }

    if(detail){
      detail.textContent='⚔️ Pošli výzvu';
      detail.classList.add('challenge-share-cta','challenge-share-detail-cta');
      detail.setAttribute('aria-label','Poslat kamarádovi výzvu na tuto úroveň');
    }
  }

  const observer=new MutationObserver(()=>syncShareCtas());
  function boot(){
    syncShareCtas();
    if(document.body)observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  [120,400,900,1800].forEach(ms=>setTimeout(syncShareCtas,ms));
})();
