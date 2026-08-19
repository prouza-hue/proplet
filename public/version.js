(()=>{
  const VERSION=window.PROPLET_RUNTIME_META?.version||window.PROPLET_VERSION;
  if(!VERSION)return;
  window.PROPLET_VERSION=VERSION;

  const attachFooter=()=>{
    const footer=document.getElementById('appVersionFooter');
    if(!footer)return false;
    const sync=()=>{
      const expected=`Proplet v${VERSION}`;
      if(footer.textContent!==expected)footer.textContent=expected;
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(footer,{childList:true,characterData:true,subtree:true});
    return true;
  };

  const boot=()=>{
    if(attachFooter())return;
    let tries=0;
    const timer=setInterval(()=>{
      if(attachFooter()||++tries>=100)clearInterval(timer);
    },50);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
