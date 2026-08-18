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

  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='/home-layout.css?v=9';
  document.head.appendChild(css);

  const brandCss=document.createElement('link');
  brandCss.rel='stylesheet';
  brandCss.href='/today-brand.css?v=4';
  document.head.appendChild(brandCss);

  const rankingCss=document.createElement('link');
  rankingCss.rel='stylesheet';
  rankingCss.href='/ranking-polish.css?v=5';
  document.head.appendChild(rankingCss);

  const onboardingFitCss=document.createElement('link');
  onboardingFitCss.rel='stylesheet';
  onboardingFitCss.href='/onboarding-fit.css?v=1';
  onboardingFitCss.dataset.propletOnboardingFitCss='1';
  document.head.appendChild(onboardingFitCss);

  const gameLayoutCss=document.createElement('link');
  gameLayoutCss.rel='stylesheet';
  gameLayoutCss.href='/game-layout-v3323.css?v=1';
  gameLayoutCss.dataset.propletGameLayoutCss='1';
  document.head.appendChild(gameLayoutCss);

  const difficultyNudgeCss=document.createElement('link');
  difficultyNudgeCss.rel='stylesheet';
  difficultyNudgeCss.href='/difficulty-nudge.css?v=2';
  difficultyNudgeCss.dataset.propletDifficultyNudgeCss='1';
  document.head.appendChild(difficultyNudgeCss);

  const winActionsCss=document.createElement('link');
  winActionsCss.rel='stylesheet';
  winActionsCss.href='/win-actions-v3324.css?v=1';
  winActionsCss.dataset.propletWinActionsCss='1';
  document.head.appendChild(winActionsCss);

  const loadVersion=()=>{
    if(document.querySelector('script[data-proplet-version]'))return;
    const script=document.createElement('script');
    script.src='/version.js?v=2';
    script.dataset.propletVersion='1';
    document.body.appendChild(script);
  };

  const loadHomeLayout=()=>{
    if(document.querySelector('script[data-proplet-home-layout]'))return;
    const script=document.createElement('script');
    script.src='/home-layout.js?v=10';
    script.dataset.propletHomeLayout='1';
    document.body.appendChild(script);
  };

  const loadRankingPolish=()=>{
    if(document.querySelector('script[data-proplet-ranking-polish]'))return;
    const script=document.createElement('script');
    script.src='/ranking-polish.js?v=2';
    script.dataset.propletRankingPolish='1';
    document.body.appendChild(script);
  };

  const loadAccountAuth=()=>{
    if(!document.querySelector('link[data-proplet-account-auth-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/account-auth.css?v=4';css.dataset.propletAccountAuthCss='1';document.head.appendChild(css)}
    if(document.querySelector('script[data-proplet-account-auth]'))return;
    const script=document.createElement('script');
    script.src='/account-auth.js?v=4';
    script.dataset.propletAccountAuth='1';
    document.body.appendChild(script);
  };

  const loadReleaseNotes=()=>{
    if(!document.querySelector('link[data-proplet-release-notes-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/release-notes.css?v=3';css.dataset.propletReleaseNotesCss='1';document.head.appendChild(css)}
    if(document.querySelector('script[data-proplet-release-notes]'))return;
    const script=document.createElement('script');
    script.src='/release-notes.js?v=4';
    script.dataset.propletReleaseNotes='1';
    document.body.appendChild(script);
  };

  const loadGameLayout=()=>{
    if(document.querySelector('script[data-proplet-game-layout]'))return;
    const script=document.createElement('script');
    script.src='/game-layout-v3323.js?v=2';
    script.dataset.propletGameLayout='1';
    document.body.appendChild(script);
  };

  const loadStarterCopyHotfix=()=>{
    if(document.querySelector('script[data-proplet-starter-copy-hotfix]'))return;
    const script=document.createElement('script');
    script.src='/starter-copy-hotfix.js?v=1';
    script.dataset.propletStarterCopyHotfix='1';
    document.body.appendChild(script);
  };

  const loadDifficultyNudge=()=>{
    if(document.querySelector('script[data-proplet-difficulty-nudge]'))return;
    const script=document.createElement('script');
    script.src='/difficulty-nudge.js?v=2';
    script.dataset.propletDifficultyNudge='1';
    document.body.appendChild(script);
  };

  const loadExtras=()=>{loadVersion();loadHomeLayout();loadRankingPolish();loadAccountAuth();loadReleaseNotes();loadGameLayout();loadStarterCopyHotfix();loadDifficultyNudge()};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadExtras,{once:true});
  else loadExtras();
})();
