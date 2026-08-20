(()=>{
  'use strict';
  if(window.__PROPLET_ONBOARDING_RETURN_V3332__)return;
  window.__PROPLET_ONBOARDING_RETURN_V3332__=true;

  const ONBOARD_KEY='proplet-v3-7-required-onboarding';
  const HELPER_ONBOARD_KEY='proplet-v3-16-2-helper-onboarding';
  const RULE_SEEN_KEY='proplet-v3-32-8-rule-principle-seen';
  const AUTH_INTENT_KEY='proplet-v3-33-2-onboarding-auth-intent';
  const DEFAULT_SUPPORT_MODE='younger';
  let patched=false;
  let observer=null;
  let authWatch=null;

  const $=s=>document.querySelector(s);
  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const track=name=>{try{if(typeof trackProductEvent==='function')trackProductEvent(name)}catch{}};
  const seen=()=>{try{return localStorage.getItem(ONBOARD_KEY)==='done'}catch{return false}};
  const authIntent=()=>{try{return sessionStorage.getItem(AUTH_INTENT_KEY)==='1'}catch{return false}};
  const setAuthIntent=value=>{try{if(value)sessionStorage.setItem(AUTH_INTENT_KEY,'1');else sessionStorage.removeItem(AUTH_INTENT_KEY)}catch{}};

  function hasPriorLocalPlay(){
    try{
      if(typeof getState!=='function')return false;
      const state=getState()||{};
      return Object.keys(state.completed||{}).length>0||Object.keys(state.inProgress||{}).length>0;
    }catch{return false}
  }

  function rememberDefaultSupport(){
    try{
      const current=typeof localSupportMode==='function'?localSupportMode():null;
      if(!current&&typeof rememberSupportMode==='function')rememberSupportMode(DEFAULT_SUPPORT_MODE);
    }catch{}
  }

  function markOnboardingKnown(eventName){
    try{
      localStorage.setItem(ONBOARD_KEY,'done');
      localStorage.setItem(HELPER_ONBOARD_KEY,'done');
      localStorage.setItem(RULE_SEEN_KEY,'1');
    }catch{}
    rememberDefaultSupport();
    if(eventName)track(eventName);
  }

  function hideOnboarding(){
    $('#onboardingModal')?.classList.add('hidden');
    try{if(typeof onboardingMandatory!=='undefined')onboardingMandatory=false}catch{}
    try{if(typeof onboardingFocusedHelper!=='undefined')onboardingFocusedHelper=false}catch{}
  }

  function finishReturningAuth(){
    markOnboardingKnown('onboarding_login_authenticated');
    setAuthIntent(false);
    hideOnboarding();
  }

  function restoreOnboardingAfterCancelledAuth(){
    if(!authIntent()||profile()?.token)return;
    setAuthIntent(false);
    const modal=$('#onboardingModal');
    if(modal){
      try{if(typeof onboardingMandatory!=='undefined')onboardingMandatory=true}catch{}
      modal.classList.remove('hidden');
      injectActions();
    }
  }

  function watchAuthFlow(){
    if(authWatch)return;
    authWatch=setInterval(()=>{
      if(!authIntent()){
        clearInterval(authWatch);authWatch=null;return;
      }
      if(profile()?.token){
        finishReturningAuth();
        clearInterval(authWatch);authWatch=null;return;
      }
      const profileModal=$('#profileModal');
      const googleReturning=new URLSearchParams(location.search).get('auth')==='google'||location.hash.includes('access_token=');
      if(profileModal?.classList.contains('hidden')&&!googleReturning){
        restoreOnboardingAfterCancelledAuth();
        clearInterval(authWatch);authWatch=null;
      }
    },120);
  }

  function skipKnownIntro(){
    markOnboardingKnown('onboarding_skipped_known_player');
    hideOnboarding();
    try{if(typeof nav==='function')nav('daily')}catch{}
  }

  function loginFromIntro(){
    track('onboarding_login_clicked');
    setAuthIntent(true);
    $('#onboardingModal')?.classList.add('hidden');
    try{
      if(typeof openProfileModal==='function')openProfileModal('login');
      else throw new Error('login-unavailable');
    }catch{
      setAuthIntent(false);
      $('#onboardingModal')?.classList.remove('hidden');
      return;
    }
    watchAuthFlow();
  }

  function injectActions(){
    const modal=$('#onboardingModal'),content=$('#onboardContent'),next=$('#onboardNextBtn');
    if(!modal||modal.classList.contains('hidden')||!content||!next)return;
    let mandatory=false;
    try{mandatory=typeof onboardingMandatory!=='undefined'&&!!onboardingMandatory}catch{}
    let step=0;
    try{step=typeof onboardingStep!=='undefined'?Number(onboardingStep||0):0}catch{}
    const old=$('#onboardingReturningActions');
    if(!mandatory||step!==0){old?.remove();return}
    if(old)return;

    const wrap=document.createElement('div');
    wrap.id='onboardingReturningActions';
    wrap.className='onboarding-return-v3332';
    wrap.innerHTML='<span>Už Proplet znáš?</span><div><button type="button" class="onboarding-return-login">Přihlásit se</button><button type="button" class="onboarding-return-skip">Přeskočit úvod</button></div>';
    next.insertAdjacentElement('afterend',wrap);
    wrap.querySelector('.onboarding-return-login')?.addEventListener('click',loginFromIntro);
    wrap.querySelector('.onboarding-return-skip')?.addEventListener('click',skipKnownIntro);
  }

  function maybeAutoSkipReturning(){
    if(seen()||authIntent())return false;
    const authenticated=!!profile()?.token;
    const priorPlay=hasPriorLocalPlay();
    if(!authenticated&&!priorPlay)return false;
    track('onboarding_returning_state_detected');
    markOnboardingKnown('onboarding_skipped_returning_state');
    hideOnboarding();
    return true;
  }

  function patchOpenOnboarding(){
    if(patched||typeof openOnboarding!=='function')return;
    patched=true;
    const original=openOnboarding;
    openOnboarding=function(force=false){
      if(!force&&!seen()&&!authIntent()&&(profile()?.token||hasPriorLocalPlay())){
        track('onboarding_returning_state_detected');
        markOnboardingKnown('onboarding_skipped_returning_state');
        return;
      }
      const result=original.apply(this,arguments);
      setTimeout(injectActions,0);
      return result;
    };
  }

  function boot(){
    patchOpenOnboarding();
    if(authIntent()){
      $('#onboardingModal')?.classList.add('hidden');
      watchAuthFlow();
    }else{
      maybeAutoSkipReturning();
      injectActions();
    }
    if(!observer&&document.body){
      observer=new MutationObserver(()=>{
        if(authIntent()&&profile()?.token)finishReturningAuth();
        else injectActions();
      });
      const onboardingModal=$('#onboardingModal');
      const profileModal=$('#profileModal');
      if(onboardingModal)observer.observe(onboardingModal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
      if(profileModal)observer.observe(profileModal,{attributes:true,attributeFilter:['class']});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(boot,120);
  setTimeout(boot,500);
})();
