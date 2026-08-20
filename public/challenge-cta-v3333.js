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

  function syncWinLayout(win,challengeMode){
    const modal=$('#winModal');
    const primary=$('#winPrimaryBtn');
    const secondary=modal?.querySelector('.win-secondary-actions');
    let row=modal?.querySelector('.win-main-actions');
    if(!modal||!primary||!secondary)return;

    const pair=challengeMode&&!modal.classList.contains('hidden')&&!win.classList.contains('hidden');
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

  function syncDailyLayout(daily){
    const hero=daily?.closest('.daily-hero');
    const play=$('#playDailyBtn');
    let row=hero?.querySelector('.daily-main-actions');
    if(!hero||!play||!daily)return;

    const pair=!daily.classList.contains('hidden');
    if(pair){
      if(!row){
        row=document.createElement('div');
        row.className='daily-main-actions';
        play.before(row);
      }
      if(play.parentElement!==row)row.appendChild(play);
      if(daily.parentElement!==row)row.appendChild(daily);
    }else if(row){
      row.before(play);
      row.before(daily);
      row.remove();
    }
  }

  function syncShareCtas(){
    const win=$('#winShareBtn');
    const detail=$('#levelDetailShareBtn');
    const daily=$('#shareDailyBtn');
    let mode=null;
    try{mode=typeof currentGame!=='undefined'?currentGame?.mode:null}catch{}
    const free=mode==='free';
    const dailyGame=mode==='daily';
    const challengeMode=free||dailyGame;

    if(win){
      if(challengeMode){
        setText(win,'⚔️ Vyzvat kamaráda');
        setClass(win,'challenge-share-cta',true);
        setAriaLabel(win,dailyGame?'Vyzvat kamaráda na dnešní Proplet':'Vyzvat kamaráda na stejný Proplet');
      }else{
        if(win.classList.contains('challenge-share-cta'))setText(win,'↗ Sdílet');
        setClass(win,'challenge-share-cta',false);
        setAriaLabel(win,'');
      }
      syncWinLayout(win,challengeMode);
    }

    if(daily){
      setText(daily,'⚔️ Vyzvat kamaráda');
      setClass(daily,'daily-challenge-cta',true);
      setAriaLabel(daily,'Vyzvat kamaráda na dnešní Proplet');
      syncDailyLayout(daily);
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
    const daily=$('#shareDailyBtn');
    if(winModal)observer.observe(winModal,{attributes:true,attributeFilter:['class']});
    if(detailModal)observer.observe(detailModal,{attributes:true,attributeFilter:['class']});
    if(daily)observer.observe(daily,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pageshow',syncShareCtas);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
