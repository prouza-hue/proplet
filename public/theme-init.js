(()=>{
  try{
    if(history.state?.proplet&&history.state.screen==='game')history.replaceState({...history.state,screen:'daily'},'',location.href);
  }catch{}

  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const apply=()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('proplet-v3-settings')||'{}');
      const pref=['auto','light','dark'].includes(saved.theme)?saved.theme:'auto';
      const dark=pref==='dark'||(pref==='auto'&&!!media?.matches);
      const resolved=dark?'dark':'light';
      const root=document.documentElement;
      root.dataset.theme=resolved;
      root.dataset.themePreference=pref;
      root.style.colorScheme=resolved;
      const meta=document.querySelector('meta[name="theme-color"]');
      if(meta){const light=meta.dataset.lightColor||meta.getAttribute('content')||'#6c5ce7';meta.setAttribute('content',dark?'#111019':light)}
    }catch{}
  };
  apply();
  media?.addEventListener?.('change',apply);
  window.addEventListener?.('storage',e=>{if(e.key==='proplet-v3-settings')apply()});

  // Standalone documents share theme resolution, but must not boot the game shell.
  if(document.documentElement.hasAttribute('data-proplet-theme-only'))return;

  const styles=[
    ['/home-layout.css?v=10','propletHomeLayoutCss'],
    ['/today-brand.css?v=4','propletTodayBrandCss'],
    ['/ranking-polish.css?v=5','propletRankingPolishCss'],
    ['/onboarding-fit.css?v=1','propletOnboardingFitCss'],
    ['/onboarding-model-v3328.css?v=3','propletOnboardingModelCss'],
    ['/game-layout-v3323.css?v=1','propletGameLayoutCss'],
    ['/difficulty-nudge.css?v=2','propletDifficultyNudgeCss'],
    ['/win-actions-v3324.css?v=1','propletWinActionsCss'],
    ['/gesture-guard-v3325.css?v=1','propletGestureGuardCss'],
    ['/copy-density-v3327.css?v=1','propletCopyDensityCss'],
    ['/push-retention-v3329.css?v=1','propletPushRetentionCss'],
    ['/desktop-layout-v3330.css?v=3','propletDesktopLayoutCss'],
    ['/result-layout-v3330.css?v=2','propletResultLayoutCss'],
    ['/profile-layout-v3330.css?v=1','propletProfileLayoutCss'],
    ['/competitive-sharing-v3331.css?v=1','propletCompetitiveSharingCss'],
    ['/challenge-cta-v3333.css?v=4','propletChallengeCtaV3333Css'],
    ['/release-notes-v3331.css?v=1','propletReleaseNotesV3331Css'],
    ['/account-conversion-v3331.css?v=1','propletAccountConversionV3331Css'],
    ['/onboarding-return-v3332.css?v=1','propletOnboardingReturnV3332Css']
  ];

  const loadStyle=(href,key)=>{
    if(document.querySelector(`link[data-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}]`))return;
    const css=document.createElement('link');
    css.rel='stylesheet';css.href=href;css.dataset[key]='1';document.head.appendChild(css);
  };
  styles.forEach(([href,key])=>loadStyle(href,key));

  const loadScript=(src,key,{wait=false}={})=>{
    const selector=`script[data-${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}]`;
    const existing=document.querySelector(selector);
    if(existing){
      if(!wait)return Promise.resolve();
      if(existing.dataset.loaded==='1')return Promise.resolve();
      return new Promise(resolve=>existing.addEventListener('load',resolve,{once:true}));
    }
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.src=src;script.async=false;script.dataset[key]='1';
      script.addEventListener('load',()=>{script.dataset.loaded='1';resolve()},{once:true});
      script.addEventListener('error',resolve,{once:true});
      document.body.appendChild(script);
      if(!wait)resolve();
    });
  };

  const loadExtras=async()=>{
    /* Runtime metadata is the single public release marker. Anything displaying/guarding a
       version loads only after it, so a release cannot drift between footer and cache metadata. */
    await loadScript('/runtime-meta.js?v=1','propletRuntimeMeta',{wait:true});
    loadScript('/version.js?v=3','propletVersion');
    loadScript('/home-layout.js?v=11','propletHomeLayout');
    loadScript('/ranking-polish.js?v=2','propletRankingPolish');
    if(!document.querySelector('link[data-proplet-account-auth-css]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='/account-auth.css?v=5';css.dataset.propletAccountAuthCss='1';document.head.appendChild(css);
    }
    loadScript('/auth-recovery-guard-v3326.js?v=1','propletAuthRecoveryGuard');
    loadScript('/account-auth.js?v=6','propletAccountAuth');
    loadScript('/game-layout-v3330.js?v=3','propletGameLayout');
    loadScript('/starter-copy-hotfix.js?v=1','propletStarterCopyHotfix');
    loadScript('/difficulty-nudge.js?v=2','propletDifficultyNudge');
    loadScript('/onboarding-model-v3328.js?v=3','propletOnboardingModel');
    loadScript('/gesture-guard-v3325.js?v=2','propletGestureGuard');
    loadScript('/valid-word-feedback-v3330.js?v=1','propletValidWordFeedback');
    loadScript('/copy-density-v3327.js?v=1','propletCopyDensity');
    loadScript('/push-retention-v3329.js?v=1','propletPushRetention');
    loadScript('/account-team-v33210.js?v=2','propletAccountTeamIntegrity');
    loadScript('/competitive-sharing-v3331.js?v=4','propletCompetitiveSharing');
    loadScript('/challenge-cta-v3333.js?v=3','propletChallengeCtaV3333');
    await loadScript('/account-bonus-v3331.js?v=1','propletAccountBonusV3331',{wait:true});
    await loadScript('/account-conversion-v3331.js?v=2','propletAccountConversionV3331',{wait:true});
    loadScript('/onboarding-return-v3332.js?v=2','propletOnboardingReturnV3332');
    loadScript('/release-notes-v3331.js?v=2','propletReleaseNotesV3331');
  };

  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadExtras,{once:true});
  else loadExtras();
})();
