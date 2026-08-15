(()=>{
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

  const addStyle=href=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    document.head.appendChild(link);
  };
  addStyle('/home-layout.css?v=3');
  addStyle('/home-layout-fix.css?v=3');

  const loadHomeLayout=()=>{
    if(document.querySelector('script[data-proplet-home-layout]'))return;
    const script=document.createElement('script');
    script.src='/home-layout.js?v=3';
    script.dataset.propletHomeLayout='1';
    script.onload=()=>{
      if(document.querySelector('script[data-proplet-home-layout-fix]'))return;
      const fix=document.createElement('script');
      fix.src='/home-layout-fix.js?v=3';
      fix.dataset.propletHomeLayoutFix='1';
      document.body.appendChild(fix);
    };
    document.body.appendChild(script);
  };
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',loadHomeLayout,{once:true});
  else loadHomeLayout();
})();
