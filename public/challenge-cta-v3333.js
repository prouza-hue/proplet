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

  function syncWinLayout(win,free){
    const modal=$('#winModal');
    const primary=$('#winPrimaryBtn');
    const secondary=modal?.querySelector('.win-secondary-actions');
    let row=modal?.querySelector('.win-main-actions');
    if(!modal||!primary||!secondary)return;

    const pair=free&&!modal.classList.contains('hidden')&&!win.classList.contains('hidden');
    if(pair){
      if(!row){
        row=document.createElement('div');
        row.className='win-main-actions';
        primary.before(row);
      }
      if(primary.parentElement!==row)row.appendChild(primary);
      if(win.parentElement!==row)row.appendChild(win);
    }else if(row){
      row.before(primary);
      secondary.insertBefore(win,secondary.firstChild);
      row.remove();
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
      syncWinLayout(win,free);
    }

    if(detail){
      setText(detail,'⚔️ Vyzvat kamaráda');
      setClass(detail,'challenge-share-cta',true);
      setClass(detail,'challenge-share-detail-cta',true);
      setAriaLabel(detail,'Vyzvat kamaráda na tuto úroveň');
    }
  }

  function boot(){
    syncShareCtas();
    const observer=new MutationObserver(syncShareCtas);
    const winModal=$('#winModal');
    const detailModal=$('#levelDetailModal');
    if(winModal)observer.observe(winModal,{attributes:true,attributeFilter:['class']});
    if(detailModal)observer.observe(detailModal,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pageshow',syncShareCtas);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
