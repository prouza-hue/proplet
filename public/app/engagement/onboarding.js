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

  function installStarterCopy(){
    
      const FROM='Zkus ČOKOLÁDU';
      const TO='Najdi slovo ČOKOLÁDA';
      const patch=()=>{
        const title=document.querySelector('#starterCoachTitle');
        if(title?.textContent===FROM)title.textContent=TO;
      };
      const boot=()=>{
        patch();
        const title=document.querySelector('#starterCoachTitle');
        if(title)new MutationObserver(patch).observe(title,{childList:true,characterData:true,subtree:true});
      };
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
      else boot();
    
  }

  function installModel(){
    
      'use strict';
      if(window.__PROPLET_ONBOARDING_MODEL_V3328__)return;
    
      const RULE_SEEN_KEY='proplet-v3-32-8-rule-principle-seen';
      let installed=false;
      let principleTracked=false;
    
      const pesStep={
        title:'Najdi PES',
        interactive:true,
        html:`<div class="onboard-content onboard-action-first"><span class="eyebrow">ZAČNI ROVNOU HRÁT</span><h2>Najdi PES</h2><p class="muted">Táhni, nebo postupně klepni na P, E a S. Jen přes políčka vedle sebe.</p><div class="tutorial-wrap"><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">L</div><div class="tutorial-cell" data-tidx="3">A</div><div class="tutorial-cell" data-tidx="4">S</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`
      };
    
      const principleStep={
        title:'Jak Proplet funguje',
        principle:true,
        cta:'Jdu na první Proplet 🧩',
        html:`<div class="onboard-content onboard-principle"><span class="eyebrow">JAK FUNGUJE PROPLET</span><h2>Jedna deska. Jedno řešení.</h2><div class="principle-board-demo" aria-hidden="true"><div class="mini-demo-board"><div class="mini-board-grid"><span class="mini-cell mini-target-a">M</span><span class="mini-cell mini-target-a">A</span><span class="mini-cell mini-target-a">N</span><span class="mini-cell mini-target-a">G</span><span class="mini-cell mini-target-a">O</span><span class="mini-cell mini-target-b">S</span><span class="mini-cell mini-target-b">A</span><span class="mini-cell mini-target-b">L</span><span class="mini-cell mini-target-b">Á</span><span class="mini-cell mini-target-b">T</span><span class="mini-cell mini-target-c">K</span><span class="mini-cell mini-target-c">O</span><span class="mini-cell mini-target-c">B</span><span class="mini-cell mini-target-c">E</span><span class="mini-cell mini-target-c">R</span><span class="mini-cell mini-target-d">M</span><span class="mini-cell mini-target-d mini-decoy">O</span><span class="mini-cell mini-target-d mini-decoy">P</span><span class="mini-cell mini-target-c">C</span><span class="mini-cell mini-target-c">E</span><span class="mini-cell mini-target-d">E</span><span class="mini-cell mini-target-d mini-decoy">R</span><span class="mini-cell mini-target-d mini-decoy">A</span><span class="mini-cell mini-target-d">N</span><span class="mini-cell mini-target-d">Č</span><svg class="mini-board-path" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="mini-decoy-path" points="30,90 30,70 50,70 50,90"/></svg></div><div class="principle-word-chips"><span class="demo-word demo-word-decoy">ROPA <b>×</b></span><span class="demo-word demo-word-a">MANGO</span><span class="demo-word demo-word-b">SALÁT</span><span class="demo-word demo-word-c">KOBEREC</span><span class="demo-word demo-word-d">POMERANČ</span></div></div></div><p class="principle-copy">Na desce najdeš i jiná slova. <strong>Do řešení patří jen ta, která společně vyplní celou plochu.</strong></p></div>`
      };
    
      const applyDefaultHelper=force=>{
        try{
          const local=localSupportMode();
          const profileMode=getProfile()?.supportMode;
          if(local||validSupportMode(profileMode))return local||profileMode;
          rememberSupportMode('younger');
          if(!force&&typeof trackProductEvent==='function')trackProductEvent('helper_default_applied');
          return 'younger';
        }catch{return 'younger'}
      };
    
      const install=()=>{
        if(installed)return true;
        try{
          if(typeof ONBOARD_STEPS==='undefined'||typeof openOnboarding!=='function'||typeof onboardingNext!=='function'||typeof renderOnboarding!=='function')return false;
    
          ONBOARD_STEPS.splice(0,ONBOARD_STEPS.length,pesStep,principleStep);
          const baseRender=renderOnboarding;
    
          openOnboarding=function(force=false){
            let seen=false;
            try{seen=!!localStorage.getItem(ONBOARD_KEY)}catch{}
            if(!force&&seen)return;
            onboardingFocusedHelper=false;
            onboardingMandatory=!force&&!seen;
            onboardingStep=0;
            tutorialState={dragging:false,path:[],done:false};
            onboardingTutorialTracked=false;
            onboardingSupportTracked=true;
            principleTracked=false;
            onboardingSupportMode=applyDefaultHelper(force);
            $('#skipOnboardingBtn')?.classList.toggle('hidden',onboardingMandatory);
            $('#onboardingModal')?.classList.remove('hidden');
            if(!force&&typeof trackProductEvent==='function')trackProductEvent('onboarding_started');
            renderOnboarding();
          };
    
          renderOnboarding=function(){
            const step=ONBOARD_STEPS[onboardingStep];
            baseRender();
            if(step?.principle){
              try{localStorage.setItem(RULE_SEEN_KEY,'1')}catch{}
              if(onboardingMandatory&&!principleTracked){
                principleTracked=true;
                try{trackProductEvent('onboarding_principle_shown')}catch{}
              }
            }
          };
    
          onboardingNext=function(){
            const step=ONBOARD_STEPS[onboardingStep];
            if(step?.interactive&&!tutorialState.done)return;
            if(onboardingStep<ONBOARD_STEPS.length-1){
              onboardingStep++;
              renderOnboarding();
              return;
            }
            const launchStarter=onboardingMandatory;
            try{localStorage.setItem(RULE_SEEN_KEY,'1')}catch{}
            if(launchStarter){
              try{trackProductEvent('onboarding_principle_completed')}catch{}
            }
            onboardingMandatory=false;
            try{trackProductEvent('onboarding_completed')}catch{}
            closeOnboarding(true);
            if(launchStarter)startStarter();else nav('daily');
          };
    
          const next=$('#onboardNextBtn');
          if(next)next.onclick=()=>onboardingNext();
    
          installed=true;
          window.__PROPLET_ONBOARDING_MODEL_V3328__=true;
    
          const modal=$('#onboardingModal');
          if(modal&&!modal.classList.contains('hidden')){
            if(onboardingFocusedHelper&&!onboardingMandatory){
              try{localStorage.setItem(HELPER_ONBOARD_KEY,'done')}catch{}
              applyDefaultHelper(false);
              modal.classList.add('hidden');
              onboardingFocusedHelper=false;
            }else{
              onboardingFocusedHelper=false;
              onboardingStep=0;
              tutorialState={dragging:false,path:[],done:false};
              principleTracked=false;
              renderOnboarding();
            }
          }
          return true;
        }catch{return false}
      };
    
      let tries=0;
      const boot=()=>{
        if(install()||++tries>=80)return;
        setTimeout(boot,50);
      };
      boot();
    
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
    
  }

  function install(){
    if(installed)return api;
    installed=true;
    if(!root||!root.document)return api;
    installStarterCopy();
    installModel();
    installReturningPlayer();
    return api;
  }

  const api={install,shouldOfferStarterHint,advancePesTapPath};
  return api;
});
