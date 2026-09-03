(()=>{
  'use strict';
  const apply=()=>{
    const footer=document.querySelector('.app-footer');
    if(!footer)return;
    const line=footer.querySelector('span');
    const author=footer.querySelector('strong');
    if(line)line.textContent='© 2026 Proplet · Česká slovní hra';
    if(author){author.textContent='';author.hidden=true;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
