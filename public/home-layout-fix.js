(()=>{
  const daily=()=>document.querySelector('#screen-daily');
  const bottom=()=>document.querySelector('.bottom-nav');

  function repairHomeShell(){
    const screen=daily();
    if(!screen?.classList.contains('active'))return;
    document.body.classList.remove('playing');
    bottom()?.classList.remove('hidden');
    document.documentElement.style.overflowY='';
    document.body.style.overflowY='';
  }

  const observe=()=>{
    const screen=daily();
    if(!screen)return;
    const observer=new MutationObserver(repairHomeShell);
    observer.observe(screen,{attributes:true,attributeFilter:['class']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    repairHomeShell();
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();
  window.addEventListener('pageshow',repairHomeShell);
  window.addEventListener('popstate',()=>requestAnimationFrame(repairHomeShell));
  window.addEventListener('orientationchange',()=>setTimeout(repairHomeShell,80));
})();
