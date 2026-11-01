(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_BONUS_V3331__)return;
  window.__PROPLET_ACCOUNT_BONUS_V3331__=true;

  const BONUS_XP=500;
  let bonusXp=0;
  let bonusSimulated=false;
  let activeProfileKey=null,profileKey='';
  let pendingClaim=null;
  let failedToken=null,retryAt=0;
  let patched=false;
  let offerTracked=false;
  let createIntentTracked=false;

  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const hasAccount=()=>!!profile()?.token;
  const identity=p=>p?.token?JSON.stringify([p.id||p.playerId||p.name||'account',p.token]):'';
  function syncIdentity(){
    const next=identity(profile());
    if(next!==profileKey){
      profileKey=next;activeProfileKey=null;pendingClaim=null;bonusXp=0;bonusSimulated=false;failedToken=null;retryAt=0;
      window.PROPLET_ACCOUNT_BONUS=null;
    }
    return next;
  }
  const bonusEvent=(event,authProfile)=>{
    try{
      if(typeof api==='function')api('/api/account-bonus-event',{method:'POST',body:JSON.stringify({event_type:event}),...(authProfile?{authProfile}:{})}).catch(()=>{});
    }catch{}
  };
  const trackOfferOnce=()=>{if(offerTracked)return;offerTracked=true;bonusEvent('account_bonus_offer_seen')};
  const trackCreateOnce=()=>{if(createIntentTracked)return;createIntentTracked=true;bonusEvent('account_bonus_create_clicked')};

  function adjustRankingData(data){
    syncIdentity();
    if(!data||!Array.isArray(data.players)||data.accountRewardsIncluded===true||data.xpAuthoritative===true||bonusSimulated)return data;
    return {...data,players:data.players.map(row=>({...row,lifetimePoints:Number(row.lifetimePoints||0)+BONUS_XP}))};
  }

  function patchUiFunctions(){
    if(patched)return true;
    if(typeof effectiveStats!=='function'||typeof renderProfile!=='function'||typeof setAccountMode!=='function')return false;
    patched=true;

    const originalEffectiveStats=effectiveStats;
    effectiveStats=function(){
      syncIdentity();
      const stats=originalEffectiveStats.apply(this,arguments);
      if(!stats||!hasAccount()||bonusXp<=0)return stats;
      if(bonusSimulated&&stats.xpAuthoritative===true)return stats;
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
    const key=syncIdentity(),p={...profile()};
    if(!key)return;
    if(pendingClaim||activeProfileKey===key||(failedToken===p.token&&Date.now()<retryAt))return;
    const claim={key};pendingClaim=claim;
    const current=()=>syncIdentity()===key&&pendingClaim===claim;
    try{
      if(typeof api!=='function')return;
      const data=await api('/api/account-bonus/claim',{method:'POST',authProfile:p});
      if(!current())return;
      activeProfileKey=key;
      bonusXp=Math.max(0,Number(data?.bonusXp||0));
      bonusSimulated=data?.simulated===true;
      window.PROPLET_ACCOUNT_BONUS={xp:bonusXp,creationBonusXp:Number(data?.accountCreationBonusXp||BONUS_XP),granted:data?.accountCreationBonusGranted===true,simulated:bonusSimulated};
      if(data?.newlyGranted&&!bonusSimulated){
        bonusEvent('account_bonus_granted',p);
        try{if(typeof showToast==='function')showToast('🎁 +500 XP za účet!')}catch{}
      }
      refreshVisibleUi();
    }catch(error){if(current()){failedToken=p.token;retryAt=error?.status===401?Infinity:Date.now()+Math.max(30000,Number(error?.retryAfterMs)||0)}}
    finally{if(pendingClaim===claim)pendingClaim=null}
  }

  let tries=0;
  const boot=()=>{
    patchUiFunctions();
    syncBonus();
    if(++tries<240)setTimeout(boot,500);
  };
  boot();
  document.addEventListener?.('proplet:account-changed',syncBonus);

  window.PROPLET_ACCOUNT_BONUS_API=Object.freeze({
    bonusXp:()=>{syncIdentity();return bonusXp;},
    sync:syncBonus,
    track:bonusEvent,
    offerSeen:trackOfferOnce,
    createClicked:trackCreateOnce,
    adjustRankingData
  });
})();
