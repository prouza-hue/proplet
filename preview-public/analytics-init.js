(()=>{
  'use strict';
  if(window.__PROPLET_VERCEL_ANALYTICS__)return;
  window.__PROPLET_VERCEL_ANALYTICS__=true;
  // Aggregate acquisition only. Never run a platform probe from preview,
  // tutorial/technical runs, localhost or OAuth return URLs.
  const params=new URLSearchParams(location.search),meta=window.PROPLET_RUNTIME_META;
  if(!['hrajproplet.cz','www.hrajproplet.cz'].includes(location.hostname)||meta?.environment!=='production'||params.get('tutorial')==='1'||params.has('auth')||params.has('code')||/access_token|refresh_token/.test(location.hash))return;
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
  window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};
  window.si('beforeSend',beforeSend);
  for(const src of ['/_vercel/insights/script.js','/_vercel/speed-insights/script.js']){
    if(document.querySelector('script[src="'+src+'"]'))continue;
    const script=document.createElement('script');script.src=src;script.defer=true;document.head.append(script);
  }
})();
