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
  css.href='/home-layout.css?v=8';
  document.head.appendChild(css);

  const rankingCss=document.createElement('link');
  rankingCss.rel='stylesheet';
  rankingCss.href='/ranking-polish.css?v=5';
  document.head.appendChild(rankingCss);

  const accountCss=document.createElement('link');
  accountCss.rel='stylesheet';
  accountCss.href='/account-auth.css?v=3';
  document.head.appendChild(accountCss);

  const loadHomeLayout=()=>{
    if(document.querySelector('script[data-proplet-home-layout]'))return;
    const script=document.createElement('script');
    script.src='/home-layout.js?v=8';
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
    if(document.querySelector('script[data-proplet-account-auth]'))return;
    const script=document.createElement('script');
    script.src='/account-auth.js?v=3';
    script.dataset.propletAccountAuth='1';
    document.body.appendChild(script);
  };

  const loadExtras=()=>{loadHomeLayout();loadRankingPolish();loadAccountAuth()};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadExtras,{once:true});
  else loadExtras();
})();
