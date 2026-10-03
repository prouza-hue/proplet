(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_CONVERSION_V3331__)return;
  window.__PROPLET_ACCOUNT_CONVERSION_V3331__=true;

  let patched=false;
  const $=s=>document.querySelector(s);

  function isCreateMode(){return !!$('#profileModeCreate')?.classList.contains('active')}
  function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}

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
    const slot=block.querySelector('.google-primary-slot');
    if(slot&&button.parentElement!==slot)slot.appendChild(button);
    window.PropletInAppBrowserHelp?.mount(button);
    if(desc.nextElementSibling!==block)desc.insertAdjacentElement('afterend',block);

    let divider=$('#googleManualDivider');
    if(!divider){
      divider=document.createElement('div');
      divider.id='googleManualDivider';
      divider.className='account-auth-divider google-manual-divider';
      divider.innerHTML='<span>nebo jménem a heslem</span>';
    }
    if(block.nextElementSibling!==divider)block.insertAdjacentElement('afterend',divider);

    const oldDivider=$('#accountAuthExtras .account-auth-divider');
    if(oldDivider&&!oldDivider.classList.contains('account-auth-divider-obsolete'))oldDivider.classList.add('account-auth-divider-obsolete');
    return true;
  }

  function polishAuthModal(){
    if(!positionGoogleFirst())return;
    const create=isCreateMode();
    const title=$('#profileModalTitle'),desc=$('#profileModalDesc'),save=$('#saveProfileBtn');
    const divider=$('#googleManualDivider span'),head=$('#googlePrimaryBlock .google-primary-head span'),note=$('#googlePrimaryBlock .google-primary-note');
    const inApp=!!window.PropletInAppBrowserHelp?.context();
    const speed=$('#googlePrimaryBlock .google-primary-head small');
    if(speed)speed.hidden=inApp;

    if(create&&$('#profileModal')?.classList.contains('first-steps-auth')){
      setText(title,'Ulož si postup');
      setText(desc,'Zvol si přezdívku a heslo. E-mail pro obnovu účtu můžeš přidat níže.');
      setText(save,'Vytvořit účet');return;
    }
    if(create){
      setText(title,'Nepřijď o své výsledky');
      setText(desc,'Založ si účet, trvá to pár vteřin. Uložíme XP, výsledky i sérii — a přidáme ti +500 XP.');
      setText(save,'Založit jménem a heslem · +500 XP');
      setText(divider,'nebo přezdívkou a heslem');
      setText(head,inApp?'PŘIHLÁŠENÍ PŘES GOOGLE':'NEJRYCHLEJŠÍ ZPŮSOB');
      setText(note,'Bez vytváření nového hesla · +500 XP po založení.');
    }else{
      setText(title,'Přihlásit se');
      setText(desc,inApp?'Přihlas se přes Google. Nebo použij herní jméno či ověřený e-mail a heslo.':'Nejrychleji přes Google. Nebo použij herní jméno či ověřený e-mail a heslo.');
      setText(save,'Přihlásit se');
      setText(divider,'nebo jménem a heslem');
      setText(head,inApp?'PŘIHLÁŠENÍ PŘES GOOGLE':'NEJRYCHLEJŠÍ PŘIHLÁŠENÍ');
      setText(note,inApp?'Použij svůj Google účet.':'Bez vyplňování jména a hesla.');
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

  let bootScheduled=false;
  function scheduleBoot(){
    if(bootScheduled)return;
    bootScheduled=true;
    queueMicrotask(()=>{bootScheduled=false;boot()});
  }
  function start(){
    boot();
    const modal=$('#profileModal');
    if(modal)new MutationObserver(scheduleBoot).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  setTimeout(boot,250);
  setTimeout(boot,1000);
})();
