(()=>{
  'use strict';
  if(window.__PROPLET_CHALLENGE_CTA_V3333__)return;
  window.__PROPLET_CHALLENGE_CTA_V3333__=true;

  const $=s=>document.querySelector(s);
  const primaryHandlers=new WeakMap();

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

  function rewardPresentation(source){
    const strong=source?.querySelector('strong'),small=source?.querySelector('small');
    const headline=(strong?.textContent||source?.textContent||'').trim();
    const detail=(small?.textContent||'').trim();
    const numeric=headline.match(/^(\+\s*[0-9][0-9\s\u00a0,.]*\s*XP)(?:\s*[·–—]\s*(.+))?$/i);
    if(numeric)return {value:numeric[1].trim(),status:[numeric[2],detail].filter(Boolean).join(' · ')};
    if(headline==='XP'&&detail==='Ověřujeme')return {value:'',status:'Odměnu ověřujeme.'};
    return {value:'',status:[headline,detail].filter(Boolean).join(' · ')};
  }

  function syncRewardPresentation(){
    const source=$('#winXp'),value=$('#winRewardValue'),status=$('#winRewardStatus');
    if(!source||!value||!status)return;
    const presentation=rewardPresentation(source);
    setText(value,presentation.value);setText(status,presentation.status);
    value.hidden=!presentation.value;status.hidden=!presentation.status;
  }

  function restorePrimaryHandler(primary){
    const previous=primaryHandlers.get(primary);if(!previous)return;
    if(primary.onclick===previous.assigned)primary.onclick=previous.original;
    primaryHandlers.delete(primary);
  }

  function syncResultAction(primary,extra,secondary,actions,modal){
    const game=typeof currentGame==='undefined'?null:currentGame;
    const recap=typeof tajenkaRecapOpen!=='undefined'&&tajenkaRecapOpen;
    const protectedFlow=modal.classList.contains('starter-win')||modal.classList.contains('first-steps-win')||game?.postStarterWarmup;
    const menu=$('#winMenuBtn');if(menu)menu.hidden=false;
    setClass(primary,'result-secondary-action',false);
    if(protectedFlow){restorePrimaryHandler(primary);return;}
    const daily=game?.mode==='daily',special=game?.mode==='daily_special',tajenka=game?.mode==='tajenka'||recap;
    if(daily&&!recap){
      setText(primary,'Zpět na Dnes');
      if(typeof closeWinToMenu==='function'){
        const previous=primaryHandlers.get(primary);
        if(!previous||primary.onclick!==previous.assigned)primaryHandlers.set(primary,{original:primary.onclick,assigned:closeWinToMenu});
        primary.onclick=closeWinToMenu;
      }
    }else{
      restorePrimaryHandler(primary);
      if((special||tajenka)&&!recap)setText(primary,'Zpět na Dnes');
    }
    if(menu&&(daily||special||tajenka))menu.hidden=true;
    const offerExtra=daily&&extra&&!extra.classList.contains('hidden')&&!extra.hidden;
    if(offerExtra){
      setClass(primary,'result-secondary-action',true);
      if(primary.parentElement!==secondary||secondary.firstElementChild!==primary)secondary.prepend(primary);
    }else if(primary.parentElement!==actions)actions.append(primary);
  }

  function syncWinLayout(win){
    const modal=$('#winModal'),primary=$('#winPrimaryBtn'),summary=modal?.querySelector('.win-summary'),secondary=modal?.querySelector('.win-secondary-actions');
    if(!primary||!summary||!secondary)return;
    if(typeof renderWinExtraAction==='function')renderWinExtraAction();
    const extra=$('#winExtraBtn');
    const card=modal.querySelector('.win-card'),starter=modal.classList.contains('starter-win')||modal.classList.contains('first-steps-win');
    const scroll=card.querySelector(':scope > .win-result-scroll'),footer=card.querySelector(':scope > .win-result-footer');
    // Keep canonical nodes and every earned award; only their presentation moves.
    if(scroll){for(const child of [...scroll.childNodes])card.insertBefore(child,scroll);scroll.remove()}
    if(footer){for(const child of [...footer.childNodes])card.insertBefore(child,footer);footer.remove()}
    setClass(modal,'result-action-docked',false);
    setClass(modal,'result-compact',!starter);
    if(modal.getAttribute('aria-labelledby')!=='winTitle')modal.setAttribute('aria-labelledby','winTitle');
    const title=$('#winTitle'),xp=$('#winXp'),menu=$('#winMenuBtn');
    if(starter){
      const oldHeader=card.querySelector('.win-result-heading');
      if(oldHeader){oldHeader.before(title);oldHeader.remove()}
      const originalChips=summary.querySelector('.win-summary-chips');
      if(originalChips&&(xp.parentElement!==originalChips||originalChips.firstElementChild!==xp))originalChips.prepend(xp);
      setClass(xp,'xp-sticker',false);
      restorePrimaryHandler(primary);setClass(primary,'result-secondary-action',false);if(menu)menu.hidden=false;
      $('#winRewardStatus')?.remove();
      if(summary.nextElementSibling!==primary)summary.after(primary);
      if(win.parentElement!==secondary)secondary.prepend(win);
      const oldActions=$('#winResultActions');if(oldActions){for(const child of [...oldActions.children])oldActions.before(child);oldActions.remove()}
      return;
    }
    let header=card.querySelector('.win-result-heading');
    if(!header){header=document.createElement('div');header.className='win-result-heading';title.before(header)}
    if(title.parentElement!==header)header.append(title);
    const chips=summary.querySelector('.win-summary-chips');if(chips&&xp.parentElement!==chips)chips.prepend(xp);
    setClass(xp,'xp-sticker',false);
    let reward=$('#winRewardValue');
    if(!reward){reward=document.createElement('span');reward.id='winRewardValue';reward.className='xp-sticker';header.append(reward)}
    let status=$('#winRewardStatus');
    if(!status){status=document.createElement('p');status.id='winRewardStatus';status.className='win-reward-status';status.setAttribute('role','status')}
    if(header.nextElementSibling!==summary)header.after(summary);
    const phrase=$('#tajenkaWinPhrase'),anchor=phrase&&!phrase.classList.contains('hidden')?phrase:summary;
    if(anchor===phrase&&summary.nextElementSibling!==phrase)summary.after(phrase);
    if(anchor.nextElementSibling!==status)anchor.after(status);
    let actions=$('#winResultActions');
    if(!actions){actions=document.createElement('div');actions.id='winResultActions';actions.className='win-result-actions'}
    if(status.nextElementSibling!==actions)status.after(actions);
    if(extra&&extra.parentElement!==actions)actions.prepend(extra);
    if(win.parentElement!==secondary)secondary.prepend(win);
    syncResultAction(primary,extra,secondary,actions,modal);
    if(actions.nextElementSibling!==secondary)actions.after(secondary);
    const ranking=$('#levelLeaderboardBox');if(ranking&&secondary.nextElementSibling!==ranking)secondary.after(ranking);
    modal.querySelector('.win-main-actions')?.remove();
    syncRewardPresentation();
  }

  function setChallengeContent(el){
    delete el.dataset.plainInvite;
    setText(el,'Sdílet výsledek');
    setClass(el,'painted-action-control',false);
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
    const extraGame=mode==='daily_special';
    const challengeMode=free||dailyGame||extraGame||mode==='tajenka'||$('#winModal')?.classList.contains('tajenka-daily-result');

    if(win){
      if(challengeMode){
        setText(win,'Sdílet výsledek');
        setClass(win,'challenge-share-cta',false);
        delete win.dataset.plainInvite;
        setAriaLabel(win,$('#winModal')?.classList.contains('tajenka-daily-result')||mode==='tajenka'?'Sdílet výsledek Tajenky':extraGame?'Sdílet výsledek Extra výzvy':dailyGame?'Sdílet výsledek Denní výzvy':'Sdílet výsledek této desky');
      }else{
        if(win.classList.contains('challenge-share-cta'))setText(win,'↗ Sdílet');
        setClass(win,'challenge-share-cta',false);
        setAriaLabel(win,'');
      }
      syncWinLayout(win);
    }

    if(daily){
      setChallengeContent(daily);
      setClass(daily,'daily-challenge-cta',true);
      setAriaLabel(daily,'Sdílet výsledek dnešní výzvy');
      syncDailyLayout(daily);
    }

    if(detail){
      setChallengeContent(detail);
      setClass(detail,'challenge-share-cta',true);
      setClass(detail,'challenge-share-detail-cta',true);
      setAriaLabel(detail,'Sdílet výsledek této úrovně');
    }
  }

  function boot(){
    syncShareCtas();
    const observer=new MutationObserver(syncShareCtas);
    const winModal=$('#winModal');
    const detailModal=$('#levelDetailModal');
    const daily=$('#shareDailyBtn');
    if(winModal)observer.observe(winModal,{attributes:true,attributeFilter:['class']});
    const rewardSource=$('#winXp');
    if(rewardSource)observer.observe(rewardSource,{childList:true,subtree:true,characterData:true});
    if(detailModal)observer.observe(detailModal,{attributes:true,attributeFilter:['class']});
    if(daily)observer.observe(daily,{attributes:true,attributeFilter:['class']});
    window.addEventListener('pageshow',syncShareCtas);
    window.matchMedia('(max-width:999px)').addEventListener('change',syncShareCtas);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
