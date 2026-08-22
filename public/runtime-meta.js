(()=>{
  'use strict';
  const canonicalOrigin='https://hrajproplet.cz';
  const productionAliases=new Set([
    'www.hrajproplet.cz',
    'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app',
    'proplet-git-main-pavel-prouzas-projects.vercel.app'
  ]);
  const gen4CandidatePreview=location.hostname==='proplet-git-agent-v3340-medium-ca-024677-pavel-prouzas-projects.vercel.app';
  const META=Object.freeze({
    version:'3.34.0',
    canonicalOrigin,
    gen4CandidatePreview,
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
      accountCreationBonusXp:500,
      accountBonusLeaderboardExcluded:true,
      growthReleaseNotes:true,
      returningPlayerOnboardingSkip:true,
      onboardingLoginEscape:true,
      gen4ReleaseQualityPass:true,
      calmMode:true,
      calmModeLeaderboardExcluded:true,
      gen4ProgressArchiveUx:true
    })
  });
  window.PROPLET_RUNTIME_META=META;
  window.PROPLET_VERSION=META.version;

  /* v3.34 quality layer stays additive so the candidate content remains frozen while
     presentation, migration communication and calm-mode UX can iterate independently. */
  if(!document.querySelector('link[data-proplet-quality-v334]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='/quality-v334.css?v=1';link.dataset.propletQualityV334='1';
    document.head.appendChild(link);
  }
  const loadQualityLayer=()=>{
    if(document.querySelector('script[data-proplet-quality-v334]'))return;
    const script=document.createElement('script');
    script.src='/quality-v334.js?v=1';script.async=false;script.dataset.propletQualityV334='1';
    document.body.appendChild(script);
  };
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadQualityLayer,{once:true});
  else loadQualityLayer();

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

  const loadPushOriginGuard=()=>{
    if(legacyOriginSession)return;
    if(document.querySelector('script[data-proplet-push-origin]'))return;
    const script=document.createElement('script');
    script.src='/push-origin-v3325.js?v=1';
    script.async=false;
    script.dataset.propletPushOrigin='1';
    document.body.appendChild(script);
  };
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadPushOriginGuard,{once:true});
  else loadPushOriginGuard();
})();