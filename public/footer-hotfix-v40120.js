(()=>{
  'use strict';
  const apply=()=>{
    const footer=document.querySelector('.app-footer');
    if(!footer)return;
    const line=footer.querySelector('span');
    const author=footer.querySelector('strong');
    if(line)line.textContent='Upleteno s ❤️ v roce 2026';
    if(author)author.textContent='Pavel Prouza';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
