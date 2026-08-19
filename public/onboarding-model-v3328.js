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
})();
