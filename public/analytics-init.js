(()=>{
  'use strict';
  if(window.__PROPLET_VERCEL_ANALYTICS__)return;
  window.__PROPLET_VERCEL_ANALYTICS__=true;
  // Aggregate acquisition only. Never run a platform probe from preview,
  // tutorial/technical runs, localhost or OAuth return URLs.
  const params=new URLSearchParams(location.search),meta=window.PROPLET_RUNTIME_META;
  const guide=!meta && location.hostname==='hrajproplet.cz' && document.documentElement.hasAttribute('data-proplet-guide');
  const productionGame=['hrajproplet.cz','www.hrajproplet.cz'].includes(location.hostname) && meta?.environment==='production';
  if(!(productionGame||guide)||params.get('tutorial')==='1'||params.has('auth')||params.has('code')||/access_token|refresh_token/.test(location.hash))return;
  // The Web Analytics SDK can also read document.referrer outside beforeSend.
  if(guide && /[?#]/.test(document.referrer))return;
  const beforeSend=event=>{
    try{
      const url=new URL(event.url);url.search='';url.hash='';
      const clean={...event,url:url.toString()};
      if(clean.referrer){const referrer=new URL(clean.referrer);referrer.search='';referrer.hash='';clean.referrer=referrer.toString()}
      return clean;
    }catch{return null}
  };
  window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
  window.va('beforeSend',beforeSend);
  const sources=['/_vercel/insights/script.js'];
  if(productionGame){
    window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};
    window.si('beforeSend',beforeSend);
    sources.push('/_vercel/speed-insights/script.js');
  }
  for(const src of sources){
    if(document.querySelector('script[src="'+src+'"]'))continue;
    const script=document.createElement('script');script.src=src;script.defer=true;document.head.append(script);
  }
})();
