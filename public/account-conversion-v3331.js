(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_CONVERSION_V3331__)return;
  window.__PROPLET_ACCOUNT_CONVERSION_V3331__=true;

  let patched=false;
  const $=s=>document.querySelector(s);

  function isCreateMode(){return !!$('#profileModeCreate')?.classList.contains('active')}

  function positionGoogleFirst(){
    const modal=$('#profileModal'),desc=$('#profileModalDesc'),button=$('#googleLoginBtn');
    if(!modal||!desc||!button)return false;

    let block=$('#googlePrimaryBlock');
    if(!block){
      block=document.createElement('section');
      block.id='googlePrimaryBlock';
      block.className='google-primary-auth';
      block.innerHTML='<div class="google-primary-head"><span>NEJRYCHLEJŠÍ ZPŮSOB</span><small>pár vteřin</small></div><div class="google-primary-slot"></div><small class="google-primary-note">Bez vytváření nového hesla.</small>';
    }
    block.querySelector('.google-primary-slot')?.appendChild(button);
    desc.insertAdjacentElement('afterend',block);

    let divider=$('#googleManualDivider');
    if(!divider){
      divider=document.createElement('div');
      divider.id='googleManualDivider';
      divider.className='account-auth-divider google-manual-divider';
      divider.innerHTML='<span>nebo jménem a heslem</span>';
    }
    block.insertAdjacentElement('afterend',divider);

    const oldDivider=$('#accountAuthExtras .account-auth-divider');
    if(oldDivider)oldDivider.classList.add('account-auth-divider-obsolete');
    return true;
  }

  function polishAuthModal(){
    if(!positionGoogleFirst())return;
    const create=isCreateMode();
    const title=$('#profileModalTitle'),desc=$('#profileModalDesc'),save=$('#saveProfileBtn');
    const divider=$('#googleManualDivider span'),head=$('#googlePrimaryBlock .google-primary-head span'),note=$('#googlePrimaryBlock .google-primary-note');

    if(create){
      if(title)title.textContent='Nepřijdi o své výsledky';
      if(desc)desc.textContent='Založ si účet, trvá to pár vteřin. Uložíme XP, výsledky i sérii — a přidáme ti +500 XP.';
      if(save)save.textContent='Založit jménem a heslem · +500 XP';
      if(divider)divider.textContent='nebo přezdívkou a heslem';
      if(head)head.textContent='NEJRYCHLEJŠÍ ZPŮSOB';
      if(note)note.textContent='Bez vytváření nového hesla · +500 XP po založení.';
    }else{
      if(title)title.textContent='Přihlásit se';
      if(desc)desc.textContent='Nejrychleji přes Google. Nebo použij herní jméno či ověřený e-mail a heslo.';
      if(save)save.textContent='Přihlásit se';
      if(divider)divider.textContent='nebo jménem a heslem';
      if(head)head.textContent='NEJRYCHLEJŠÍ PŘIHLÁŠENÍ';
      if(note)note.textContent='Bez vyplňování jména a hesla.';
    }
  }

  function patchFunctions(){
    if(patched)return;
    if(typeof setAccountMode!=='function'||typeof renderProfile!=='function'||typeof renderAccountNudge!=='function')return;
    patched=true;

    const originalSetAccountMode=setAccountMode;
    setAccountMode=function(){
      const result=originalSetAccountMode.apply(this,arguments);
      setTimeout(polishAuthModal,0);
      return result;
    };

    const originalRenderProfile=renderProfile;
    renderProfile=function(){
      const result=originalRenderProfile.apply(this,arguments);
      try{
        if(!getProfile?.()?.token){
          const card=$('#profileCard');
          if(card){
            const h=card.querySelector('h2');
            const p=card.querySelector('p.muted');
            const b=card.querySelector('#profileCreateBtn');
            if(h)h.textContent='Nepřijdi o své výsledky';
            if(p)p.textContent='Účet založíš za pár vteřin. Nejrychleji přes Google — uložíme XP, výsledky i sérii a přidáme +500 XP.';
            if(b)b.textContent='🔒 Uložit výsledky · +500 XP';
          }
        }
      }catch{}
      return result;
    };

    const originalRenderAccountNudge=renderAccountNudge;
    renderAccountNudge=function(stage){
      originalRenderAccountNudge.apply(this,arguments);
      const eyebrow=$('#accountNudgeEyebrow'),title=$('#accountNudgeTitle'),copy=$('#accountNudgeCopy'),button=$('#nudgeCreateBtn');
      const benefits=$('.account-nudge-benefits'),icon=$('.account-nudge-icon');
      if(icon)icon.textContent='🔒';
      if(stage===1){
        if(eyebrow)eyebrow.textContent='NEPŘIJDI O VÝSLEDEK';
        if(title)title.textContent='Ulož si, co už máš';
        if(copy)copy.textContent='Založ si účet, trvá to pár vteřin. Výsledky, XP a série pak nezůstanou jen v tomhle zařízení — a dostaneš +500 XP.';
      }else if(stage===2){
        if(eyebrow)eyebrow.textContent='NEPŘIJDI O SVŮJ POSTUP';
        if(title)title.textContent='Tenhle postup už stojí za uložení';
        if(copy)copy.textContent='Stačí pár vteřin. Nejrychleji přes Google. Uložíme tvoje výsledky do cloudu a přidáme +500 XP.';
      }else{
        if(eyebrow)eyebrow.textContent='POSLEDNÍ PŘIPOMENUTÍ';
        if(title)title.textContent='Nenechávej svůj postup jen tady';
        if(copy)copy.textContent='Když zařízení nebo data zmizí, lokální postup s nimi může zmizet taky. Účet založíš za pár vteřin a dostaneš +500 XP.';
      }
      if(benefits)benefits.innerHTML='<span>🔒 výsledky bezpečně v účtu</span><span>⚡ Google = nejrychlejší cesta</span><span>🎁 +500 XP za založení</span>';
      if(button)button.textContent='Založit účet · +500 XP';
    };

    if(typeof updateWinAccountCta==='function'){
      const originalUpdateWinAccountCta=updateWinAccountCta;
      updateWinAccountCta=function(){
        const result=originalUpdateWinAccountCta.apply(this,arguments);
        const button=$('#winAccountBtn');
        if(button&&!button.classList.contains('hidden'))button.textContent='🔒 Uložit výsledky · +500 XP';
        return result;
      };
    }
  }

  function boot(){
    patchFunctions();
    polishAuthModal();
  }

  const observer=new MutationObserver(()=>setTimeout(boot,0));
  if(document.body)observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(boot,250);
  setTimeout(boot,1000);
})();
