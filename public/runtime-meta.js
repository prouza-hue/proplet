(()=>{
  'use strict';
  const canonicalOrigin='https://hrajproplet.cz';
  const productionAliases=new Set([
    'www.hrajproplet.cz',
    'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app',
    'proplet-git-main-pavel-prouzas-projects.vercel.app'
  ]);
  const META=Object.freeze({
    version:'3.33.7',
    canonicalOrigin,
    capabilities:Object.freeze({
      phoneLandscapeBlocking:true,
      tabletLandscapeReflow:true,
      desktopWideLayout:true,
      desktopGameRail:true,
      embeddedBrowserGestureGuard:true,
      canonicalPushOrigin:true,
      legacyOriginSessionPreservation:true,
      authRecoveryGuard:true,
      copyDensityPolish:true,
      actionFirstOnboarding:true,
      contextualHelperDefault:true,
      validNonSolutionFailsafe:true,
      recognitionLexiconV2:true,
      remoteRecognitionFallback:true,
      pushDeliveryAudit:true,
      pushSelfTest:true,
      iosPwaPushGuidance:true,
      accountCreateRaceGuard:true,
      dedupeAwareLogin:true,
      canonicalAccountMetrics:true,
      teamLeagueOptOutDefault:true,
      competitiveLevelSharing:true,
      sharedLevelDeepLinks:true,
      sharedChallengeReturnToProgress:true,
      challengeFirstShareCta:true,
      dailyChallengeShareCta:true,
      clientObserverScopeV3334:true,
      p0StarterTransitionFixV3336:true,
      adaptiveCellRadiusV3336:true,
      layoutRegressionRollbackV3337:true,
      accountCreationBonusXp:500,
      accountBonusLeaderboardExcluded:true,
      growthReleaseNotes:true,
      returningPlayerOnboardingSkip:true,
      onboardingLoginEscape:true
    })
  });
  window.PROPLET_RUNTIME_META=META;
  window.PROPLET_VERSION=META.version;

  let legacyOriginSession=false;
  if(productionAliases.has(location.hostname)&&location.origin!==canonicalOrigin){
    try{
      const stored=JSON.parse(localStorage.getItem('proplet-v2-profile')||'null');
      legacyOriginSession=!!(stored?.id&&stored?.token);
    }catch{}
    if(legacyOriginSession){
      window.PROPLET_LEGACY_ORIGIN_SESSION=true;
    }else{
      const target=new URL(location.href);
      target.protocol='https:';
      target.host='hrajproplet.cz';
      location.replace(target.href);
      return;
    }
  }

  const loadP0Hotfix=()=>{
    if(!document.querySelector('link[data-proplet-p0-v3336]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/p0-hotfix-v3336.css';
      link.dataset.propletP0V3336='1';
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-proplet-p0-v3336]')){
      const script=document.createElement('script');
      script.src='/p0-hotfix-v3336.js';
      script.dataset.propletP0V3336='1';
      document.body.appendChild(script);
    }
  };

  const loadPushOriginGuard=()=>{
    if(legacyOriginSession)return;
    if(document.querySelector('script[data-proplet-push-origin]'))return;
    const script=document.createElement('script');
    script.src='/push-origin-v3325.js?v=1';
    script.async=false;
    script.dataset.propletPushOrigin='1';
    document.body.appendChild(script);
  };
  const bootRuntimeExtras=()=>{loadP0Hotfix();loadPushOriginGuard()};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bootRuntimeExtras,{once:true});
  else bootRuntimeExtras();
})();
