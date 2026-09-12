(()=>{
  window.PROPLET_SINGLE_RELEASE_CTA_V40132=true;

  const themeOnly=document.documentElement.hasAttribute('data-proplet-theme-only');
  if(!themeOnly){
    const root=document.documentElement;
    root.classList.add('proplet-current-ui-booting');
    const bootStyle=document.createElement('style');
    bootStyle.id='propletCurrentUiBootStyle';
    bootStyle.textContent='html.proplet-current-ui-booting .app-shell,html.proplet-current-ui-booting .bottom-nav{visibility:hidden!important}html.proplet-current-ui-booting body{background:#F7F2E8!important}html[data-theme="dark"].proplet-current-ui-booting body{background:#1D2530!important}';
    document.head.appendChild(bootStyle);
    let revealed=false;
    window.__PROPLET_REVEAL_CURRENT_UI=()=>{
      if(revealed)return;
      revealed=true;
      root.classList.remove('proplet-current-ui-booting');
      bootStyle.remove();
    };
    setTimeout(()=>window.__PROPLET_REVEAL_CURRENT_UI?.(),5000);
  }

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
      if(meta){const light=meta.dataset.lightColor||meta.getAttribute('content')||'#FDFBF7';meta.setAttribute('content',dark?'#1C1C21':light)}
    }catch{}
  };
  apply();
  media?.addEventListener?.('change',apply);
  window.addEventListener?.('storage',e=>{if(e.key==='proplet-v3-settings')apply()});

  if(themeOnly)return;

  const styles=[
    ['/app-play.css?v=40140-s13b','propletAppPlayCss'],
    ['/ranking-polish.css?v=5','propletRankingPolishCss'],
    ['/app-onboarding.css?v=40140-s13b','propletAppOnboardingCss'],
    ['/difficulty-nudge.css?v=2','propletDifficultyNudgeCss'],
    ['/gesture-guard-v3325.css?v=1','propletGestureGuardCss'],
    ['/copy-density-v3327.css?v=1','propletCopyDensityCss'],
    ['/push-retention-v3329.css?v=1','propletPushRetentionCss'],
    ['/desktop-layout-v3330.css?v=3','propletDesktopLayoutCss'],
    ['/game.css?v=40140-s13a','propletGameCss'],
    ['/results.css?v=40140-s13a2','propletResultsCss'],
    ['/competitive-sharing-v3331.css?v=1','propletCompetitiveSharingCss'],
    ['/challenge-cta-v3333.css?v=5','propletChallengeCtaV3333Css'],
    ['/account-conversion-v3331.css?v=1','propletAccountConversionV3331Css'],
    ['/onboarding-return-v3332.css?v=1','propletOnboardingReturnV3332Css'],
    ['/app-profile-settings.css?v=40140-s13b','propletAppProfileSettingsCss'],
    ['/typography-readability-v1.css?v=1','propletTypographyReadabilityV1Css'],
    ['/brand-wordmark-fraunces.css?v=2','propletBrandWordmarkFrauncesCss'],
    ['/tajenka-release-fix.css?v=1','propletTajenkaReleaseFixCss'],
    ['/tajenka-card-polish.css?v=2','propletTajenkaCardPolishCss'],
    ['/game-release-polish.css?v=3','propletGameReleasePolishCss'],
    ['/tajenka-runtime-polish.css?v=1','propletTajenkaRuntimePolishCss'],
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
    await loadScript('/runtime-meta.js?v=1','propletRuntimeMeta',{wait:true});
    loadScript('/version.js?v=3','propletVersion');
    loadScript('/home-layout.js?v=fix20','propletHomeLayout');
    loadScript('/ranking-polish.js?v=3','propletRankingPolish');
    await loadScript('/account-auth.js?v=8','propletAccountAuth',{wait:true});
    loadScript('/auth-recovery-guard-v3326.js?v=2','propletAuthRecoveryGuard');
    loadScript('/game-layout-v3330.js?v=fix20','propletGameLayout');
    loadScript('/gesture-guard-v3325.js?v=fixsep8c','propletGestureGuard');
    loadScript('/valid-word-feedback-v3330.js?v=9','propletValidWordFeedback');
    loadScript('/copy-density-v3327.js?v=2','propletCopyDensity');
    loadScript('/push-retention-v3329.js?v=1','propletPushRetention');
    loadScript('/account-team-v33210.js?v=3','propletAccountTeamIntegrity');
    loadScript('/competitive-sharing-v3331.js?v=4','propletCompetitiveSharing');
    loadScript('/challenge-cta-v3333.js?v=fix20','propletChallengeCtaV3333');
    loadScript('/footer-hotfix-v40120.js?v=3','propletFooterHotfixV40120');
    await loadScript('/account-bonus-v3331.js?v=2','propletAccountBonusV3331',{wait:true});
    await loadScript('/account-conversion-v3331.js?v=2','propletAccountConversionV3331',{wait:true});
    loadScript('/settings-ia-v40122.js?v=2','propletSettingsIaV40122');
    loadScript('/settings-polish-v40122.js?v=2','propletSettingsPolishV40122');
    await loadScript('/printshop-release-polish.js?v=2','propletPrintshopReleasePolish',{wait:true});
    await loadScript('/tajenka-release-fix.js?v=2','propletTajenkaReleaseFix',{wait:true});
    loadScript('/tajenka-cadence-copy.js?v=1','propletTajenkaCadenceCopy');
    loadScript('/tajenka-card-polish.js?v=2','propletTajenkaCardPolish');
    loadScript('/tajenka-runtime-polish.js?v=1','propletTajenkaRuntimePolish');

    // The Hrát card is an exact clone of Dnes. Its child IDs are removed to keep
    // the document valid, so delegate only its active play CTA back to the
    // canonical Tajenka button on Dnes.
    if(!window.__PROPLET_TAJENKA_PLAY_DELEGATE__){
      window.__PROPLET_TAJENKA_PLAY_DELEGATE__=true;
      document.addEventListener('click',event=>{
        const button=event.target?.closest?.('#tajenkaPlayCard:not(.completed) button.primary-btn');
        if(!button)return;
        const source=document.querySelector('#tajenkaPreviewCard #tajenkaPreviewBtn');
        if(!source)return;
        event.preventDefault();
        event.stopPropagation();
        source.click();
      },true);
    }
  };

  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadExtras,{once:true});
  else loadExtras();
})();