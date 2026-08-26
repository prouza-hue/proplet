(()=>{
  'use strict';
  if(window.__PROPLET_DAILY_WIN_MENU_V40123__)return;
  window.__PROPLET_DAILY_WIN_MENU_V40123__=true;

  const boot=()=>{
    const button=document.querySelector('#winMenuBtn');
    if(!button)return;
    const normalize=()=>{
      if((button.textContent||'').trim()==='← Dnes')button.textContent='← Menu';
    };
    normalize();
    new MutationObserver(normalize).observe(button,{childList:true,subtree:true,characterData:true});
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
