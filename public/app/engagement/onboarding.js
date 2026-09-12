(function(root,factory){
  'use strict';
  if(root?.PropletEngagementOnboarding){
    if(typeof module!=='undefined'&&module.exports)module.exports=root.PropletEngagementOnboarding;
    return;
  }
  const api=factory(root);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.PropletEngagementOnboarding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  let installed=false;

  function shouldOfferStarterHint(input={}){
    const game=input.game;
    if(!game||game.mode!=='starter'||game.finished||game.starterHintUsed||game.starterHintOfferShown||game.found.length<2||game.dragging||input.hidden||input.transientOpen)return false;
    return Number(input.now)-(game.lastProgressAt||game.start)>=10000;
  }

  function advancePesTapPath(path=[],index){
    const target=[0,1,4],current=Array.isArray(path)?path:[];
    const prefix=current.every((value,pos)=>value===target[pos])?current:[];
    if(index===target[prefix.length]){
      const next=[...prefix,index];
      return {path:next,done:next.length===target.length,valid:true};
    }
    if(index===target[0])return {path:[target[0]],done:false,valid:true};
    return {path:[],done:false,valid:false};
  }

  function completeTutorial(){
    try{localStorage.setItem(ONBOARD_KEY,'done');localStorage.setItem(HELPER_ONBOARD_KEY,'done');localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1')}catch{}
    onboardingMandatory=false;
    document.querySelector('#starterReturningActions')?.classList.add('hidden');
    try{trackProductEvent('onboarding_completed')}catch{}
  }

  function installModel(){
    if(window.__PROPLET_ONBOARDING_MODEL_V3328__)return;
    window.__PROPLET_ONBOARDING_MODEL_V3328__=true;
    openOnboarding=function(force=false){
      let seen=false;try{seen=!!localStorage.getItem(ONBOARD_KEY)}catch{}
      if(!force&&seen)return;
      if(!puzzleDB?.starter)return;
      if(currentScreen==='game'&&currentGame?.mode!=='starter'&&!force)return;
      onboardingFocusedHelper=false;onboardingMandatory=!force&&!seen;
      if(!localSupportMode()&&!validSupportMode(getProfile()?.supportMode))rememberSupportMode('younger');
      document.querySelector('#onboardingModal')?.classList.add('hidden');
      if(!force)trackProductEvent('onboarding_started');
      // Start the real training board; pending invitations resume after training.
      startGame(puzzleDB.starter,'starter',null,{starter:true});
    };
  }

  function installReturningPlayer(){
    
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
        document.querySelector('#starterReturningActions')?.classList.add('hidden');
        nav('daily');
        window.PropletSharing?.resumeInvitation?.();
      }
    
      function restoreOnboardingAfterCancelledAuth(){
        if(!authIntent()||profile()?.token)return;
        setAuthIntent(false);
        if(currentGame?.mode==='starter'&&!currentGame.finished){resumeGameClock();startTimer();}
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
        document.querySelector('#starterReturningActions')?.classList.add('hidden');
        try{if(typeof nav==='function')nav('daily');window.PropletSharing?.resumeInvitation?.()}catch{}
      }
    
      function loginFromIntro(){
        track('onboarding_login_clicked');
        setAuthIntent(true);
        pauseGameClock('login');stopTimer();
        $('#onboardingModal')?.classList.add('hidden');
        try{
          if(typeof openProfileModal==='function')openProfileModal('login');
          else throw new Error('login-unavailable');
        }catch{
          setAuthIntent(false);
          resumeGameClock();startTimer();
          return;
        }
        watchAuthFlow();
      }
    
      function injectActions(){
        const wrap=$('#starterReturningActions');
        if(!wrap)return;
        const active=typeof currentGame!=='undefined'&&currentGame?.mode==='starter'&&!currentGame.finished;
        wrap.classList.toggle('hidden',!active);
        const login=wrap.querySelector('.onboarding-return-login');
        login.classList.toggle('hidden',!!profile()?.token);
        login.onclick=loginFromIntro;
        wrap.querySelector('.onboarding-return-skip').onclick=skipKnownIntro;
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
          const gameScreen=$('#screen-game');
          if(gameScreen)observer.observe(gameScreen,{attributes:true,attributeFilter:['class']});
        }
      }
    
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
      else boot();
      setTimeout(boot,120);
      setTimeout(boot,500);
    
  }

  function install(){
    if(installed)return api;
    installed=true;
    if(!root||!root.document)return api;
    installModel();
    installReturningPlayer();
    return api;
  }

  const api={install,shouldOfferStarterHint,advancePesTapPath,completeTutorial};
  return api;
});
