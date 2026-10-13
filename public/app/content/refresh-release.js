/* Current content release. The retired 300-board promotion is never scheduled. */
(function(global){
  'use strict';
  const queue=global.PropletAnnouncements;
  if(!queue)return;
  queue.register({
    id:'archive-extra-v1',priority:100,
    eligible:()=>global.PropletArchiveExperience?.isEnabled?.()===true,
    show:({isCurrent})=>isCurrent()&&global.PropletArchiveExperience.announcement({includeExtra:true})===true,
    close:()=>global.PropletArchiveExperience?.closeModal(),
    onShown:account=>{
      // Both features have just been introduced together. Extra must not repeat
      // as another launch announcement on the next visit.
      try{localStorage.setItem('proplet:daily-extra-intro:v1:account:'+account,'1')}catch{}
    }
  });
  // Kept for older navigation code and cached callers; no old dialog is mounted.
  global.PropletRefreshRelease=Object.freeze({close(){}});
})(window);
