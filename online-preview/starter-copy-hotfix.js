(()=>{
  const FROM='Zkus ČOKOLÁDU';
  const TO='Najdi slovo ČOKOLÁDA';
  const patch=()=>{
    const title=document.querySelector('#starterCoachTitle');
    if(title?.textContent===FROM)title.textContent=TO;
  };
  const boot=()=>{
    patch();
    const title=document.querySelector('#starterCoachTitle');
    if(title)new MutationObserver(patch).observe(title,{childList:true,characterData:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
