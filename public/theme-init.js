(()=>{
  window.PROPLET_SINGLE_RELEASE_CTA_V40132=true;

  const themeOnly=document.documentElement.hasAttribute('data-proplet-theme-only');
  if(!themeOnly){
    const root=document.documentElement;
    root.classList.add('proplet-current-ui-booting');
    const bootStyle=document.createElement('style');
    bootStyle.id='propletCurrentUiBootStyle';
    bootStyle.textContent=`
      html.proplet-current-ui-booting .app-shell,
      html.proplet-current-ui-booting .bottom-nav{visibility:hidden!important}
      html.proplet-current-ui-booting body{background:#F7F2E8!important}
      html[data-theme="dark"].proplet-current-ui-booting body{background:#1D2530!important}
      #propletBootScreen{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:28px;background:#F7F2E8;color:#332D28;opacity:1;transition:opacity .24s ease;pointer-events:auto}
      html[data-theme="dark"] #propletBootScreen{background:#1D2530;color:#F5EFE5}
      .proplet-boot-inner{display:flex;flex-direction:column;align-items:center;text-align:center;transform:translateY(-3vh)}
      .proplet-boot-brand{display:flex;align-items:center;gap:13px;margin-bottom:21px}
      .proplet-boot-mark{width:56px;height:56px;display:block;filter:drop-shadow(0 5px 10px rgba(64,43,27,.12))}
      .proplet-boot-wordmark{font:700 31px/1.02 Georgia,'Times New Roman',serif;letter-spacing:-.9px}
      .proplet-boot-copy{font:650 14px/1.3 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.02em;opacity:.72}
      .proplet-boot-dots{display:flex;gap:7px;margin-top:15px;height:9px;align-items:center}
      .proplet-boot-dots i{width:7px;height:7px;border-radius:2px;background:#A64C3E;box-shadow:inset 0 0 0 1px rgba(73,40,30,.14);animation:propletBootStamp 1.08s ease-in-out infinite}
      .proplet-boot-dots i:nth-child(2){animation-delay:.13s}.proplet-boot-dots i:nth-child(3){animation-delay:.26s}
      @keyframes propletBootStamp{0%,60%,100%{transform:translateY(0) rotate(0);opacity:.35}30%{transform:translateY(-5px) rotate(-2deg);opacity:1}}
      html.proplet-current-ui-ready #propletBootScreen{opacity:0;pointer-events:none}
      @media (prefers-reduced-motion:reduce){#propletBootScreen{transition:none}.proplet-boot-dots i{animation:none;opacity:.65}}
    `;
    document.head.appendChild(bootStyle);

    let revealed=false;
    const mountBootScreen=()=>{
      if(revealed||document.getElementById('propletBootScreen'))return;
      if(!document.body){setTimeout(mountBootScreen,0);return}
      const screen=document.createElement('div');
      screen.id='propletBootScreen';
      screen.setAttribute('role','status');
      screen.setAttribute('aria-live','polite');
      screen.innerHTML='<div class="proplet-boot-inner"><div class="proplet-boot-brand"><img class="proplet-boot-mark" src="/brand/mark.svg?v=brand1" alt=""><strong class="proplet-boot-wordmark">Proplet</strong></div><div class="proplet-boot-copy">Rozplétám…</div><div class="proplet-boot-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>';
      document.body.prepend(screen);
    };
    mountBootScreen();

    window.__PROPLET_REVEAL_CURRENT_UI=()=>{
      if(revealed)return;
      revealed=true;
      const loader=document.getElementById('propletBootScreen');
      root.classList.add('proplet-current-ui-ready');
      root.classList.remove('proplet-current-ui-booting');
      setTimeout(()=>{
        loader?.remove();
        bootStyle.remove();
        root.classList.remove('proplet-current-ui-ready');
      },280);
    };

    let readyChecks=0;
    const revealWhenCanonicalHomeReady=()=>{
      if(revealed)return;
      const daily=document.querySelector('#screen-daily');
      const play=document.querySelector('#playDailyBtn');
      const ready=window.__propletHomeLayoutInstalled&&daily?.classList.contains('home-layout-active')&&typeof play?.onclick==='function';
      if(ready){requestAnimationFrame(()=>requestAnimationFrame(()=>window.__PROPLET_REVEAL_CURRENT_UI?.()));return}
      if(++readyChecks<180)setTimeout(revealWhenCanonicalHomeReady,50);
    };
    setTimeout(revealWhenCanonicalHomeReady,25);
    setTimeout(()=>window.__PROPLET_REVEAL_CURRENT_UI?.(),6500);
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

  // Cold-start bootstrap: only a page without a controlling service worker and
  // without an already cached canonical database is eligible. Any bootstrap
  // validation failure falls straight through to the existing /puzzles.json path.
  const bootstrapParams=new URLSearchParams(location.search);
  const bootstrapEligible=!navigator.serviceWorker?.controller&&typeof window.fetch==='function'&&!bootstrapParams.has('content_preview')&&!bootstrapParams.has('tajenka');
  if(bootstrapEligible){
    const baseFetch=window.fetch.bind(window);
    let coldPuzzleConsumed=false;
    const existingCanonical=('caches' in window)
      ?caches.match('/puzzles.json',{ignoreSearch:true}).catch(()=>null)
      :Promise.resolve(null);
    const coldBootstrapFetch=existingCanonical.then(existing=>{
      if(existing?.ok)return null;
      return baseFetch('/puzzles-bootstrap.json',{cache:'no-store'}).then(async response=>{
        if(!response?.ok)return null;
        try{
          const data=await response.clone().json();
          const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
          const valid=data?.bootstrapSchema===1&&[9,10,11].includes(Number(data?.version||0))&&Number(data?.contentGeneration||0)===4&&Number(data?.dailyGeneration||0)===4&&Array.isArray(data?.daily)&&data.daily.length>0&&typeof data?.bootstrapSource?.sha256==='string'&&data.bootstrapSource.sha256.length===64&&typeof data?.bootstrapValidFrom==='string'&&typeof data?.bootstrapValidThrough==='string'&&today>=data.bootstrapValidFrom&&today<=data.bootstrapValidThrough;
          return valid?response:null;
        }catch{return null}
      }).catch(()=>null);
    });
    window.__PROPLET_COLD_BOOTSTRAP_PREFETCH=coldBootstrapFetch;

    const hydrator=document.createElement('script');
    hydrator.src='/bootstrap-hydrator.js?v=1';
    hydrator.async=false;
    hydrator.dataset.propletBootstrapHydrator='1';
    document.head.appendChild(hydrator);

    window.fetch=(input,init)=>{
      try{
        const raw=typeof input==='string'?input:input?.url;
        const url=new URL(raw,location.href);
        if(!coldPuzzleConsumed&&url.origin===location.origin&&url.pathname==='/puzzles.json'){
          coldPuzzleConsumed=true;
          return coldBootstrapFetch.then(response=>{
            if(!response?.ok)return baseFetch(input,init);
            window.__PROPLET_BOOTSTRAP_DELIVERED__=true;
            if(!window.__PROPLET_FULL_PUZZLE_DATA_PROMISE){
              window.__PROPLET_FULL_PUZZLE_DATA_PROMISE=baseFetch('/puzzles.json',{cache:'no-store'}).then(fullResponse=>{
                if(!fullResponse?.ok)throw new Error(`canonical-puzzle-db-${fullResponse?.status||'fetch'}`);
                if('caches' in window){
                  try{caches.open('proplet-data-v11').then(cache=>cache.put('/puzzles.json',fullResponse.clone())).catch(()=>{})}catch{}
                }
                return fullResponse.json();
              });
            }
            return response.clone();
          });
        }
      }catch{}
      return baseFetch(input,init);
    };
  }

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