(()=>{
  'use strict';
  if(window.__PROPLET_QUALITY_HOTFIX_V334__)return;
  window.__PROPLET_QUALITY_HOTFIX_V334__=true;

  const candidatePreview=()=>window.PROPLET_RUNTIME_META?.gen4CandidatePreview===true;
  const hidePrivacyModal=()=>{
    if(!candidatePreview())return;
    document.getElementById('rankingPrivacyModal')?.classList.add('hidden');
  };

  function installPrivacyPreviewGuard(){
    if(typeof window.maybeShowRankingPrivacyNotice==='function'&&!window.maybeShowRankingPrivacyNotice.__gen4PreviewGuard){
      const base=window.maybeShowRankingPrivacyNotice;
      const wrapped=function(...args){
        if(candidatePreview()){hidePrivacyModal();return;}
        return base.apply(this,args);
      };
      wrapped.__gen4PreviewGuard=true;
      window.maybeShowRankingPrivacyNotice=wrapped;
    }

    if(typeof window.openRankingPrivacyModal==='function'&&!window.openRankingPrivacyModal.__gen4PreviewGuard){
      const base=window.openRankingPrivacyModal;
      const wrapped=function(...args){
        if(candidatePreview()){
          hidePrivacyModal();
          try{if(typeof window.showToast==='function')window.showToast('Nastavení viditelnosti je v preview jen pro čtení.')}catch{}
          return;
        }
        return base.apply(this,args);
      };
      wrapped.__gen4PreviewGuard=true;
      window.openRankingPrivacyModal=wrapped;
    }

    hidePrivacyModal();
  }

  installPrivacyPreviewGuard();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPrivacyPreviewGuard,{once:true});
  [60,180,500,1200,2600].forEach(ms=>setTimeout(installPrivacyPreviewGuard,ms));
})();
