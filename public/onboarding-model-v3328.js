(()=>{
  'use strict';
  if(window.__PROPLET_ONBOARDING_MODEL_V3328__)return;

  const RULE_SEEN_KEY='proplet-v3-32-8-rule-principle-seen';
  let installed=false;
  let principleTracked=false;

  const pesStep={
    title:'Najdi PES',
    interactive:true,
    html:`<div class="onboard-content onboard-action-first"><span class="eyebrow">ZAČNI ROVNOU HRÁT</span><h2>Najdi PES</h2><p class="muted">Spoj písmena tahem. Jen přes políčka vedle sebe.</p><div class="tutorial-wrap"><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">L</div><div class="tutorial-cell" data-tidx="3">A</div><div class="tutorial-cell" data-tidx="4">S</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`
  };

  const principleStep={
    title:'Jak Proplet funguje',
    principle:true,
    cta:'Jdu na první Proplet 🧩',
    html:`<div class="onboard-content onboard-principle"><span class="eyebrow">TAKHLE FUNGUJE PROPLET</span><h2>Každá deska má svoje řešení</h2><p class="muted">V každém Propletu hledáš několik <b>předem daných slov</b>.</p><div class="onboard-principle-highlight"><strong>Ne každé české slovo, které na desce objevíš, patří do řešení.</strong><span>Správná sada slov do sebe zapadne a vyplní celou plochu.</span></div><p class="onboard-principle-finish">Najdi všechna hledaná slova. Pak je Proplet hotový.</p></div>`
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
})();
