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

  function syncWinLayout(win){
    const modal=$('#winModal'),primary=$('#winPrimaryBtn'),summary=modal?.querySelector('.win-summary'),secondary=modal?.querySelector('.win-secondary-actions');
    if(!primary||!summary||!secondary)return;
    const card=modal.querySelector('.win-card'),starter=modal.classList.contains('starter-win');
    const scroll=card.querySelector(':scope > .win-result-scroll'),footer=card.querySelector(':scope > .win-result-footer');
    // Preserve every child (including achievements) when leaving the old docked layout.
    if(scroll){for(const child of [...scroll.childNodes])card.insertBefore(child,scroll);scroll.remove()}
    if(footer){for(const child of [...footer.childNodes])card.insertBefore(child,footer);footer.remove()}
    setClass(modal,'result-action-docked',false);
    setClass(modal,'result-compact',!starter);
    const title=$('#winTitle'),xp=$('#winXp');
    if(starter){
      const oldHeader=card.querySelector('.win-result-heading');
      if(oldHeader){oldHeader.before(title);summary.querySelector('.win-summary-chips')?.prepend(xp);oldHeader.remove()}
      xp.classList.remove('xp-sticker');
      if(summary.nextElementSibling!==primary)summary.after(primary);
      if(win.parentElement!==secondary)secondary.prepend(win);
      const oldActions=$('#winResultActions');if(oldActions){for(const child of [...oldActions.children])oldActions.before(child);oldActions.remove()}
      return;
    }
    let header=card.querySelector('.win-result-heading');
    if(!header){header=document.createElement('div');header.className='win-result-heading';title.before(header)}
    if(title.parentElement!==header)header.append(title);
    if(xp.parentElement!==header)header.append(xp);
    xp.classList.add('xp-sticker');
    let actions=$('#winResultActions');
    if(!actions){actions=document.createElement('div');actions.id='winResultActions';actions.className='win-result-actions'}
    const ranking=$('#levelLeaderboardBox');
    const anchor=starter?summary:ranking||summary;
    if(anchor.nextElementSibling!==actions)anchor.after(actions);
    if(primary.parentElement!==actions)actions.append(primary);
    if(win.parentElement!==actions||primary.nextElementSibling!==win)primary.after(win);
    modal.querySelector('.win-main-actions')?.remove();
  }

  function setChallengeContent(el){
    setText(el,'Pozvi kamaráda');
    el.classList.remove('painted-action-control');
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
    const challengeMode=free||dailyGame||mode==='tajenka'||$('#winModal')?.classList.contains('tajenka-daily-result');

    if(win){
      if(challengeMode){
        setChallengeContent(win);
        setClass(win,'challenge-share-cta',true);
        setAriaLabel(win,$('#winModal')?.classList.contains('tajenka-daily-result')||mode==='tajenka'?'Sdílet tuto Tajenku: Pozvi kamaráda':dailyGame?'Sdílet tuto Denní výzvu: Pozvi kamaráda':'Sdílet tuto desku: Pozvi kamaráda');
      }else{
        if(win.classList.contains('challenge-share-cta'))setText(win,'↗ Sdílet');
        setClass(win,'challenge-share-cta',false);
        setAriaLabel(win,'');
      }
      syncWinLayout(win,free||dailyGame);
    }

    if(daily){
      setChallengeContent(daily);
      setClass(daily,'daily-challenge-cta',true);
      setAriaLabel(daily,'Sdílet dnešní výzvu: Pozvi kamaráda');
      syncDailyLayout(daily);
    }

    if(detail){
      setChallengeContent(detail);
      setClass(detail,'challenge-share-cta',true);
      setClass(detail,'challenge-share-detail-cta',true);
      setAriaLabel(detail,'Sdílet tuto úroveň: Pozvi kamaráda');
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
    window.matchMedia('(max-width:999px)').addEventListener('change',syncShareCtas);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
