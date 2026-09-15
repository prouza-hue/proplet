(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_BONUS_V3331__)return;
  window.__PROPLET_ACCOUNT_BONUS_V3331__=true;

  const BONUS_XP=500;
  let bonusXp=0;
  let activeProfileId=null;
  let syncInFlight=false;
  let patched=false;
  let offerTracked=false;
  let createIntentTracked=false;

  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const hasAccount=()=>!!profile()?.token;
  const bonusEvent=event=>{
    try{
      if(typeof api==='function')api('/api/account-bonus-event',{method:'POST',body:JSON.stringify({event_type:event})}).catch(()=>{});
    }catch{}
  };
  const trackOfferOnce=()=>{if(offerTracked)return;offerTracked=true;bonusEvent('account_bonus_offer_seen')};
  const trackCreateOnce=()=>{if(createIntentTracked)return;createIntentTracked=true;bonusEvent('account_bonus_create_clicked')};

  function adjustRankingData(data){
    if(!data||!Array.isArray(data.players)||data.accountRewardsIncluded===true)return data;
    return {...data,players:data.players.map(row=>({...row,lifetimePoints:Number(row.lifetimePoints||0)+BONUS_XP}))};
  }

  function patchUiFunctions(){
    if(patched)return true;
    if(typeof effectiveStats!=='function'||typeof renderProfile!=='function'||typeof setAccountMode!=='function')return false;
    patched=true;

    const originalEffectiveStats=effectiveStats;
    effectiveStats=function(){
      const stats=originalEffectiveStats.apply(this,arguments);
      if(!stats||!hasAccount()||bonusXp<=0)return stats;
      const alreadyIncluded=Math.max(0,Number(stats.accountBonusXp||0));
      const missing=Math.max(0,bonusXp-alreadyIncluded);
      if(!missing)return stats;
      return {...stats,points:Number(stats.points||0)+missing,accountBonusXp:alreadyIncluded+missing};
    };

    const originalSetAccountMode=setAccountMode;
    setAccountMode=function(mode){
      const result=originalSetAccountMode.apply(this,arguments);
      if(mode==='create'){
        trackOfferOnce();
        const tab=document.querySelector('#profileModeCreate');if(tab)tab.textContent='Uložit + 500 XP';
        const title=document.querySelector('#profileModalTitle');if(title)title.textContent='Ulož si postup a získej 500 XP';
        const desc=document.querySelector('#profileModalDesc');if(desc)desc.textContent='Jméno a heslo stačí. Postup uložíme do cloudu a hned dostaneš +500 XP; tým je volitelný.';
        const save=document.querySelector('#saveProfileBtn');if(save)save.textContent='Vytvořit účet · +500 XP';
      }else{
        const tab=document.querySelector('#profileModeCreate');if(tab)tab.textContent='Uložit + 500 XP';
      }
      return result;
    };

    if(typeof openProfileModal==='function'){
      const originalOpenProfileModal=openProfileModal;
      openProfileModal=function(mode='login'){
        if(mode==='create')trackCreateOnce();
        return originalOpenProfileModal.apply(this,arguments);
      };
    }

    if(typeof renderAccountNudge==='function'){
      const originalRenderAccountNudge=renderAccountNudge;
      renderAccountNudge=function(stage){
        originalRenderAccountNudge.apply(this,arguments);
        trackOfferOnce();
      };
    }

    if(typeof updateWinAccountCta==='function'){
      const originalUpdateWinAccountCta=updateWinAccountCta;
      updateWinAccountCta=function(){
        const result=originalUpdateWinAccountCta.apply(this,arguments);
        const button=document.querySelector('#winAccountBtn');
        if(button&&!button.classList.contains('hidden'))button.textContent='🎁 Uložit postup · +500 XP';
        return result;
      };
    }

    return true;
  }

  function refreshVisibleUi(){
    try{if(typeof renderDaily==='function')renderDaily()}catch{}
    try{if(typeof renderFree==='function')renderFree()}catch{}
    try{if(typeof renderProfile==='function')renderProfile()}catch{}
    try{if(typeof updateWinAccountCta==='function')updateWinAccountCta()}catch{}
  }

  async function syncBonus(){
    patchUiFunctions();
    const p=profile();
    if(!p?.token){activeProfileId=null;bonusXp=0;return}
    const id=String(p.id||p.playerId||p.name||'account');
    if(syncInFlight||activeProfileId===id)return;
    syncInFlight=true;
    try{
      if(typeof api!=='function')return;
      const data=await api('/api/account-bonus/claim',{method:'POST'});
      activeProfileId=id;
      bonusXp=Math.max(0,Number(data?.bonusXp||0));
      window.PROPLET_ACCOUNT_BONUS={xp:bonusXp,creationBonusXp:Number(data?.accountCreationBonusXp||BONUS_XP),granted:data?.accountCreationBonusGranted===true,simulated:data?.simulated===true};
      if(data?.newlyGranted){
        bonusEvent('account_bonus_granted');
        try{if(typeof showToast==='function')showToast('🎁 +500 XP za účet!')}catch{}
      }
      refreshVisibleUi();
    }catch{}
    finally{syncInFlight=false}
  }

  let tries=0;
  const boot=()=>{
    patchUiFunctions();
    syncBonus();
    if(++tries<240)setTimeout(boot,500);
  };
  boot();

  window.PROPLET_ACCOUNT_BONUS_API=Object.freeze({
    bonusXp:()=>bonusXp,
    sync:syncBonus,
    track:bonusEvent,
    offerSeen:trackOfferOnce,
    createClicked:trackCreateOnce,
    adjustRankingData
  });
})();
