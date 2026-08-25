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
  if(gen4CandidatePreview)document.documentElement?.classList?.add('gen4-preview-booting');
  const META=Object.freeze({
    version:'4.01.15',
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
      resultMedalBadgesV4013:true,
      anonymousProgressGuardV4014:true,
      homeProgressHierarchyV4015:true,
      accountBonusLeaderboardIncludedV4015:true,
      analyticsCoverageV4016:true,
      vercelWebAnalyticsV4016:true,
      vercelSpeedInsightsV4016:true,
      unifiedPushV4017:true,
      pushAutoRepairV4017:true,
      weeklyContentBannerV4017:true,
      adminReportNullGuardV4018:true,
      rankingLatencyV4019:true,
      xpRankingAggregateV40110:true,
      legalPageIsolationV40111:true,
      legalPageCacheBustV40112:true,
      wakeLockGoogleAvatarDailyFreshV40113:true,
      retentionSharePushFunnelV40114:true,
      rescue60sV40115:true,
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
      accountBonusLeaderboardExcluded:false,
      growthReleaseNotes:true,
      returningPlayerOnboardingSkip:true,
      onboardingLoginEscape:true,
      gen4ReleaseQualityPass:true,
      calmMode:true,
      calmModeLeaderboardExcluded:true,
      gen4ProgressArchiveUx:true,
      gen4FlashFreeBoot:true,
      gen4PreviewAuthTesting:true,
      canonicalStarterPinned:true,
      mobileRankingPrivacyIconFix:true,
      forcedClientUpdateV400:true,
      pwaStartupHotfixV4001:true,
      dailySyncP0V4002:true,
      updateButtonHotfixV4002:true,
      swHandoverDeadlockFixV4003:true,
      dailyLeaderboardRunFieldFixV4004:true,
      challengeCtaRaspberryV4005:true,
      resultCtaFontParityV4006:true,
      freshGen4FreeProgressionV4007:true,
      legacyBoardDetailRedesignV4007:true,
      levelOverviewRenderFixV4008:true,
      conciseFooterCopyV4009:true,
      gen4PerBoardXpV4010:true,
      gen4RetroactiveXpRepairV4010:true,
      gen4ReturningBonusXp:500,
      releaseModalCohortsV4011:true,
      pwaResumeUpdateCheckV4012:true
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

  const loadStyle=(href,key)=>{
    if(document.querySelector(`link[data-${key}]`))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';
    document.head.appendChild(link);
  };

  const loadScript=(src,key)=>{
    if(document.querySelector(`script[data-${key}]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';
    document.body.appendChild(script);
  };

  const loadP0Hotfix=()=>{
    loadStyle('/p0-hotfix-v3336.css','proplet-p0-v3336');
    loadScript('/p0-hotfix-v3336.js','proplet-p0-v3336');
  };

  const loadQualityHotfix=()=>loadStyle('/quality-hotfix-v334.css','proplet-quality-hotfix-v334');

  const loadPushOriginGuard=()=>{
    if(legacyOriginSession)return;
    if(document.querySelector('script[data-proplet-push-origin]'))return;
    const script=document.createElement('script');
    script.src='/push-origin-v3325.js?v=2';
    script.async=false;
    script.dataset.propletPushOrigin='1';
    document.body.appendChild(script);
  };
  const bootRuntimeExtras=()=>{loadP0Hotfix();loadQualityHotfix();loadPushOriginGuard()};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',bootRuntimeExtras,{once:true});
  else bootRuntimeExtras();
})();
