(()=>{
  'use strict';
  if(window.__PROPLET_ACCOUNT_CONVERSION_V3331__)return;
  window.__PROPLET_ACCOUNT_CONVERSION_V3331__=true;

  let patched=false,authWasOpen=false,authReturnFocus=null;
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
      block.innerHTML='<div class="google-primary-slot"></div>';
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
      divider.innerHTML='<span>nebo</span>';
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
    const modal=$('#profileModal'),login=$('#profileModeLogin'),signup=$('#profileModeCreate'),tabs=login?.parentElement;
    setText(title,create?'Uložit postup':'Přihlásit se');
    setText(desc,create?'Uchovej své výsledky, XP i sérii. Za nový účet získáš +500 XP.':'');
    if(desc&&desc.hidden===create)desc.hidden=!create;
    setText(save,create?'Vytvořit účet':'Přihlásit se');
    setText(login,'Přihlásit se');setText(signup,'Vytvořit účet');
    if(modal&&modal.getAttribute('aria-labelledby')!=='profileModalTitle')modal.setAttribute('aria-labelledby','profileModalTitle');
    if(title&&title.getAttribute('tabindex')!=='-1')title.setAttribute('tabindex','-1');
    if(tabs){
      let prompt=tabs.querySelector('.auth-mode-prompt');
      if(!prompt){prompt=document.createElement('span');prompt.className='auth-mode-prompt';tabs.prepend(prompt);}
      setText(prompt,create?'Už máš účet?':'Nemáš ještě účet?');
      const anchor=$('#authLegacyOptions')||save;
      if(anchor&&anchor.nextElementSibling!==tabs)anchor.after(tabs);
      // The clicked mode link becomes the hidden active mode. Move focus to the
      // single heading, without clearing fields or overriding password managers.
      if(document.activeElement===login||document.activeElement===signup)title?.focus({preventScroll:true});
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
    syncAuthFocus();
  }

  function syncAuthFocus(){
    const modal=$('#profileModal'),shown=!!modal&&!modal.classList.contains('hidden');
    if(shown&&!authWasOpen){
      authReturnFocus=document.activeElement;
      // Heading focus works with keyboards and screen readers without opening
      // the mobile keyboard or skipping the Google alternative.
      if(!modal.contains(document.activeElement))$('#profileModalTitle')?.focus({preventScroll:true});
    }else if(!shown&&authWasOpen&&!document.querySelector('.modal:not(.hidden),dialog[open]')){
      const target=authReturnFocus?.isConnected?authReturnFocus:$('#profileChip');
      target?.focus({preventScroll:true});authReturnFocus=null;
    }
    authWasOpen=shown;
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
    if(modal){
      new MutationObserver(scheduleBoot).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      modal.addEventListener('keydown',event=>{
        if(event.key!=='Tab'||modal.classList.contains('hidden'))return;
        const controls=[...modal.querySelectorAll('button,input,select,summary,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);if(!first)return;
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('#profileModalTitle'))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      });
    }
  }
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  setTimeout(boot,250);
  setTimeout(boot,1000);
})();
