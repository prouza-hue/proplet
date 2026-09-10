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

  function currentDailyHasResult(){
    try{
      if(typeof dailyResultState!=='function'||typeof pragueDateISO!=='function')return null;
      return !!dailyResultState(pragueDateISO())?.active;
    }catch{return null}
  }

  function syncWinLayout(win){
    const modal=$('#winModal'),primary=$('#winPrimaryBtn'),summary=modal?.querySelector('.win-summary'),secondary=modal?.querySelector('.win-secondary-actions');
    if(!primary||!summary||!secondary)return;
    // The next game is always the first action, before the standings.
    if(summary.nextElementSibling!==primary)summary.after(primary);
    if(win.parentElement!==secondary)secondary.prepend(win);
    modal.querySelector('.win-main-actions')?.remove();
  }

  function setChallengeContent(el){
    if(el.querySelector(':scope > .painted-action-icon')&&el.textContent.trim()==='Vyzvat kamaráda')return;
    const icon=document.createElement('img');
    icon.src='/rewards/printshop/challenge.svg?v=icons1';
    icon.className='painted-action-icon';icon.alt='';icon.width=24;icon.height=24;
    icon.setAttribute('aria-hidden','true');
    el.replaceChildren(icon,document.createTextNode(' Vyzvat kamaráda'));
    el.classList.add('painted-action-control');
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
        setChallengeContent(win);
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
      // The Daily challenge only makes sense after a completed Daily. Reconcile visibility
      // from authoritative current state as well as renderDaily, so late account/local merges
      // cannot leave behind a stale, non-functional CTA.
      const hasResult=currentDailyHasResult();
      if(hasResult!==null)setClass(daily,'hidden',!hasResult);
      setChallengeContent(daily);
      setClass(daily,'daily-challenge-cta',true);
      setAriaLabel(daily,'Vyzvat kamaráda na dnešní Proplet');
      syncDailyLayout(daily);
    }

    if(detail){
      setChallengeContent(detail);
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
