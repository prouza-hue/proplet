(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_BONUS_V3331__)return;
  window.__PROPLET_ACCOUNT_BONUS_V3331__=true;

  const BONUS_XP=500;
  let bonusXp=0;
  let activeProfileId=null;
  let syncInFlight=false;
  let patched=false;

  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const hasAccount=()=>!!profile()?.token;
  const bonusEvent=event=>{
    try{
      if(typeof api==='function')api('/api/account-bonus-event',{method:'POST',body:JSON.stringify({event_type:event})}).catch(()=>{});
    }catch{}
  };

  function patchUiFunctions(){
    if(patched)return true;
    if(typeof effectiveStats!=='function'||typeof renderProfile!=='function'||typeof setAccountMode!=='function')return false;
    patched=true;

    const originalEffectiveStats=effectiveStats;
    effectiveStats=function(){
      const stats=originalEffectiveStats.apply(this,arguments);
      if(!stats||!hasAccount()||bonusXp<=0)return stats;
      return {...stats,points:Number(stats.points||0)+bonusXp,accountBonusXp:bonusXp};
    };

    if(typeof renderXpRanking==='function'){
      const originalRenderXpRanking=renderXpRanking;
      renderXpRanking=function(data){
        if(!data||!Array.isArray(data.players))return originalRenderXpRanking.apply(this,arguments);
        const adjusted={...data,players:data.players.map(row=>({...row,lifetimePoints:Number(row.lifetimePoints||0)+BONUS_XP}))};
        return originalRenderXpRanking.call(this,adjusted);
      };
    }

    const originalRenderProfile=renderProfile;
    renderProfile=function(){
      const result=originalRenderProfile.apply(this,arguments);
      if(!hasAccount()){
        const card=document.querySelector('#profileCard');
        if(card){
          const h=card.querySelector('h2');if(h)h.textContent='Ulož si postup a získej 500 XP';
          const p=card.querySelector('p.muted');if(p)p.textContent='Účet uloží XP, výsledky i sérii do cloudu. A teď za jeho vytvoření dostaneš +500 XP.';
          const b=card.querySelector('#profileCreateBtn');if(b)b.textContent='🎁 Uložit postup · +500 XP';
        }
      }
      return result;
    };

    const originalSetAccountMode=setAccountMode;
    setAccountMode=function(mode){
      const result=originalSetAccountMode.apply(this,arguments);
      if(mode==='create'){
        const tab=document.querySelector('#profileModeCreate');if(tab)tab.textContent='Uložit + 500 XP';
        const title=document.querySelector('#profileModalTitle');if(title)title.textContent='Ulož si postup a získej 500 XP';
        const desc=document.querySelector('#profileModalDesc');if(desc)desc.textContent='Jméno a heslo stačí. Postup uložíme do cloudu a hned dostaneš +500 XP; tým je volitelný.';
        const save=document.querySelector('#saveProfileBtn');if(save)save.textContent='Vytvořit účet · +500 XP';
      }else{
        const tab=document.querySelector('#profileModeCreate');if(tab)tab.textContent='Uložit + 500 XP';
      }
      return result;
    };

    if(typeof renderAccountNudge==='function'){
      const originalRenderAccountNudge=renderAccountNudge;
      renderAccountNudge=function(stage){
        originalRenderAccountNudge.apply(this,arguments);
        const count=typeof completedGameCount==='function'?completedGameCount():0;
        const eyebrow=document.querySelector('#accountNudgeEyebrow');
        const title=document.querySelector('#accountNudgeTitle');
        const copy=document.querySelector('#accountNudgeCopy');
        const icon=document.querySelector('.account-nudge-icon');
        const benefits=document.querySelector('.account-nudge-benefits');
        const button=document.querySelector('#nudgeCreateBtn');
        if(icon)icon.textContent='🎁';
        if(stage===1){
          if(eyebrow)eyebrow.textContent='500 XP ZA ÚČET';
          if(title)title.textContent='První Proplet je doma. Vezmi si bonus.';
          if(copy)copy.textContent='Vytvoř si účet, ulož postup do cloudu a dostaneš +500 XP hned.';
        }else if(stage===2){
          if(eyebrow)eyebrow.textContent='500 XP POŘÁD ČEKÁ';
          if(title)title.textContent='Tenhle postup už stojí za účet';
          if(copy)copy.textContent=`Máš hotové už ${count} Propletů. Ulož si je a přidej k nim +500 XP.`;
        }else{
          if(eyebrow)eyebrow.textContent='POSLEDNÍ PŘIPOMENUTÍ';
          if(title)title.textContent='Nechceš si vzít 500 XP?';
          if(copy)copy.textContent='Tohle je poslední automatická nabídka. Účet uloží postup a bonus +500 XP ti zůstane natrvalo.';
        }
        if(benefits)benefits.innerHTML='<span>🎁 +500 XP okamžitě</span><span>☁️ pokračuj na mobilu i počítači</span><span>🔥 neztrať XP, sérii ani úspěchy</span>';
        if(button)button.textContent='Vytvořit účet · +500 XP';
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
    offerSeen:()=>bonusEvent('account_bonus_offer_seen'),
    createClicked:()=>bonusEvent('account_bonus_create_clicked')
  });
})();
