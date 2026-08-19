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
    version:'3.32.9',
    canonicalOrigin,
    capabilities:Object.freeze({
      phoneLandscapeBlocking:true,
      tabletLandscapeReflow:true,
      embeddedBrowserGestureGuard:true,
      canonicalPushOrigin:true,
      legacyOriginSessionPreservation:true,
      authRecoveryGuard:true,
      copyDensityPolish:true,
      actionFirstOnboarding:true,
      contextualHelperDefault:true,
      validNonSolutionFailsafe:true,
      pushDeliveryAudit:true,
      pushSelfTest:true,
      iosPwaPushGuidance:true
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
      // v3.32.5 redirected authenticated players before their origin-scoped localStorage could
      // follow them. Keep existing legacy-origin sessions alive until we ship an explicit,
      // lossless account migration. New/anonymous traffic still converges on hrajproplet.cz.
      window.PROPLET_LEGACY_ORIGIN_SESSION=true;
    }else{
      const target=new URL(location.href);
      target.protocol='https:';
      target.host='hrajproplet.cz';
      location.replace(target.href);
      return;
    }
  }

  const loadPushOriginGuard=()=>{
    if(legacyOriginSession)return;
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
