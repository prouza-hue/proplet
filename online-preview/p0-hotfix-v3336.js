(()=>{
  'use strict';
  if(window.__PROPLET_P0_HOTFIX_V3336__)return;
  window.__PROPLET_P0_HOTFIX_V3336__=true;

  function closeStarterChoiceBeforePlay(){
    const modal=document.getElementById('winModal');
    if(modal){
      modal.classList.add('hidden');
      modal.classList.remove('starter-win');
    }
    document.getElementById('starterHardActions')?.classList.add('hidden');
  }

  function bindStarterChoiceGuards(){
    for(const id of ['starterWarmupBtn','starterHardDailyBtn']){
      const button=document.getElementById(id);
      if(!button||button.dataset.p0StarterGuard==='1')continue;
      button.dataset.p0StarterGuard='1';
      // Capture phase intentionally runs before the legacy onclick handler starts the next game.
      button.addEventListener('click',closeStarterChoiceBeforePlay,true);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindStarterChoiceGuards,{once:true});
  else bindStarterChoiceGuards();
})();
