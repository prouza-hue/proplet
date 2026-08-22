(()=>{
  'use strict';
  const canonicalOrigin='https://hrajproplet.cz';
  const productionAliases=new Set([
    'www.hrajproplet.cz',
    'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app',
    'proplet-git-main-pavel-prouzas-projects.vercel.app'
  ]);
  const gen4CandidatePreview=location.hostname==='proplet-git-agent-v3340-medium-ca-024677-pavel-prouzas-projects.vercel.app';
  if(gen4CandidatePreview)document.documentElement?.classList?.add('gen4-preview-booting');
  const META=Object.freeze({
    version:'3.34.0',
    canonicalOrigin,
    gen4CandidatePreview,
    capabilities:Object.freeze({
      phoneLandscapeBlocking:true,
      tabletLandscapeReflow:true,
      desktopWideLayout:true,
      desktopGameRail:true,
      embeddedBrowserGestureGuard:true,
      canonicalPushOrigin:true,
      legacyOriginSessionPreservation:true,
      authRecoveryGuard:true,
      copyDensityPolish:true,
      actionFirstOnboarding:true,
      contextualHelperDefault:true,
      validNonSolutionFailsafe:true,
      recognitionLexiconV2:true,
      remoteRecognitionFallback:true,
      pushDeliveryAudit:true,
      pushSelfTest:true,
      iosPwaPushGuidance:true,
      accountCreateRaceGuard:true,
      dedupeAwareLogin:true,
      canonicalAccountMetrics:true,
      teamLeagueOptOutDefault:true,
      competitiveLevelSharing:true,
      sharedLevelDeepLinks:true,
      sharedChallengeReturnToProgress:true,
      challengeFirstShareCta:true,
      dailyChallengeShareCta:true,
      clientObserverScopeV3334:true,
      accountCreationBonusXp:500,
      accountBonusLeaderboardExcluded:true,
      growthReleaseNotes:true,
      returningPlayerOnboardingSkip:true,
      onboardingLoginEscape:true,
      gen4ReleaseQualityPass:true,
      calmMode:true,
      calmModeLeaderboardExcluded:true,
      gen4ProgressArchiveUx:true,
      gen4FlashFreeBoot:true,
      gen4PreviewAuthTesting:true,
      canonicalStarterPinned:true
    })
  });
  window.PROPLET_RUNTIME_META=META;
  window.PROPLET_VERSION=META.version;

  /* Gen4 preview keeps gameplay mutations blocked, but auth must be testable.
     It also pins the tutorial starter to the canonical production asset. The
     starter is scripted UX, not generated content, and must never drift with
     a content generation. */
  if(gen4CandidatePreview&&typeof window.fetch==='function'&&!window.__PROPLET_PREVIEW_FETCH_GUARD__){
    const nativeFetch=window.fetch.bind(window);
    const authRoutes=new Map([
      ['/api/login','login'],
      ['/api/player','player'],
      ['/api/auth/google/complete','google-complete']
    ]);
    const starterWords=['MRAK','JABLKO','ČOKOLÁDA','AUTOBUS'];
    const validCanonicalStarter=starter=>
      starter?.id==='starter-v1'&&starter?.rows===5&&starter?.cols===5&&
      Array.isArray(starter?.answers)&&starter.answers.map(a=>a?.word).join('|')===starterWords.join('|');

    window.fetch=async function(input,init={}){
      try{
        const raw=typeof input==='string'||input instanceof URL?String(input):input?.url;
        const url=new URL(raw,location.origin),method=String(init?.method||input?.method||'GET').toUpperCase();
        const action=url.origin===location.origin&&method==='POST'?authRoutes.get(url.pathname):null;
        if(action){
          const bridge=`/api/preview-auth/${action}`;
          return nativeFetch(bridge,{...init,method:'PROPFIND'});
        }
        if(url.origin===location.origin&&method==='GET'&&url.pathname==='/api/puzzle-database'){
          const [candidateResponse,baselineResponse]=await Promise.all([
            nativeFetch(input,{...init,cache:'no-store'}),
            nativeFetch('/puzzles.json',{cache:'no-store'})
          ]);
          if(!candidateResponse.ok)return candidateResponse;
          if(!baselineResponse.ok)throw new Error('canonical-starter-baseline-unavailable');
          const [candidate,baseline]=await Promise.all([candidateResponse.json(),baselineResponse.json()]);
          if(!validCanonicalStarter(baseline?.starter))throw new Error('canonical-starter-baseline-invalid');
          candidate.starter=baseline.starter;
          const headers=new Headers(candidateResponse.headers);
          headers.set('Content-Type','application/json; charset=utf-8');
          headers.set('Cache-Control','no-store');
          headers.set('X-Proplet-Starter','canonical-starter-v1');
          return new Response(JSON.stringify(candidate),{status:candidateResponse.status,statusText:candidateResponse.statusText,headers});
        }
      }catch(error){
        if(String(error?.message||'').startsWith('canonical-starter-'))throw error;
      }
      return nativeFetch(input,init);
    };
    window.__PROPLET_PREVIEW_AUTH_FETCH__=true;
    window.__PROPLET_PREVIEW_FETCH_GUARD__=true;
  }

  let legacyOriginSession=false;
  if(productionAliases.has(location.hostname)&&location.origin!==canonicalOrigin){
    try{
      const stored=JSON.parse(localStorage.getItem('proplet-v2-profile')||'null');
      legacyOriginSession=!!(stored?.id&&stored?.token);
    }catch{}
    if(legacyOriginSession){
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
