(()=>{
  'use strict';
  const apply=()=>{
    const footer=document.querySelector('.app-footer');
    if(!footer)return;

    const line=document.createElement('span');
    line.textContent='© 2026 Proplet · Česká slovní hra';

    const author=document.createElement('div');
    author.className='footer-author';
    author.textContent='Pavel Prouza';

    const version=document.createElement('small');
    version.className='app-version footer-version';
    version.textContent='Proplet v5.0.0';

    footer.replaceChildren(line,author,version);
    footer.style.setProperty('display','flex','important');
    footer.style.setProperty('flex-direction','column','important');
    footer.style.setProperty('align-items','center','important');
    footer.style.setProperty('gap','4px','important');
    footer.style.setProperty('text-align','center','important');
    author.style.setProperty('font-weight','650','important');
    version.style.setProperty('opacity','.72','important');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
