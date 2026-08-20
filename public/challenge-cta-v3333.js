(()=>{
  'use strict';
  if(window.__PROPLET_CHALLENGE_CTA_V3333__)return;
  window.__PROPLET_CHALLENGE_CTA_V3333__=true;

  const $=s=>document.querySelector(s);

  function setText(el,value){
    if(el.textContent!==value)el.textContent=value;
  }

  function setClass(el,name,enabled){
    if(el.classList.contains(name)!==enabled)el.classList.toggle(name,enabled);
  }

  function setAriaLabel(el,value){
    if(value){
      if(el.getAttribute('aria-label')!==value)el.setAttribute('aria-label',value);
    }else if(el.hasAttribute('aria-label')){
      el.removeAttribute('aria-label');
    }
  }

  function syncShareCtas(){
    const win=$('#winShareBtn');
    const detail=$('#levelDetailShareBtn');
    let free=false;
    try{free=typeof currentGame!=='undefined'&&currentGame?.mode==='free'}catch{}

    if(win){
      if(free){
        setText(win,'⚔️ Vyzvat kamaráda');
        setClass(win,'challenge-share-cta',true);
        setAriaLabel(win,'Vyzvat kamaráda na stejný Proplet');
      }else{
        if(win.classList.contains('challenge-share-cta'))setText(win,'↗ Sdílet');
        setClass(win,'challenge-share-cta',false);
        setAriaLabel(win,'');
      }
    }

    if(detail){
      setText(detail,'⚔️ Vyzvat kamaráda');
      setClass(detail,'challenge-share-cta',true);
      setClass(detail,'challenge-share-detail-cta',true);
      setAriaLabel(detail,'Vyzvat kamaráda na tuto úroveň');
    }
  }

  let syncScheduled=false;
  function scheduleSync(){
    if(syncScheduled)return;
    syncScheduled=true;
    requestAnimationFrame(()=>{
      syncScheduled=false;
      syncShareCtas();
    });
  }

  const observer=new MutationObserver(scheduleSync);
  function boot(){
    syncShareCtas();
    if(document.body)observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  [120,400,900,1800].forEach(ms=>setTimeout(scheduleSync,ms));
})();
