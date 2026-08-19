(()=>{
  'use strict';
  const canonicalOrigin='https://hrajproplet.cz';
  const productionAliases=new Set([
    'www.hrajproplet.cz',
    'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app',
    'proplet-git-main-pavel-prouzas-projects.vercel.app'
  ]);
  const META=Object.freeze({
    version:'3.32.5',
    canonicalOrigin,
    capabilities:Object.freeze({
      phoneLandscapeBlocking:true,
      tabletLandscapeReflow:true,
      embeddedBrowserGestureGuard:true,
      canonicalPushOrigin:true
    })
  });
  window.PROPLET_RUNTIME_META=META;
  window.PROPLET_VERSION=META.version;

  // Web Push, localStorage and service workers are origin-scoped. Keep all player-facing
  // production traffic on one canonical origin so an alias cannot look like a fresh device.
  if(productionAliases.has(location.hostname)&&location.origin!==canonicalOrigin){
    const target=new URL(location.href);
    target.protocol='https:';
    target.host='hrajproplet.cz';
    location.replace(target.href);
    return;
  }

  const loadPushOriginGuard=()=>{
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
