(()=>{
  'use strict';
  const apply=()=>{
    const footer=document.querySelector('.app-footer');
    if(!footer)return;

    const line=document.createElement('span');
    line.textContent='© 2026 Proplet · Česká slovní hra';

    const author=document.createElement('span');
    author.className='footer-author';
    author.textContent='Pavel Prouza';

    const version=document.createElement('small');
    version.className='app-version footer-version';
    version.textContent='Proplet v5.0.0';

    const links=document.createElement('small');
    links.className='footer-links';
    links.innerHTML='<a href="/privacy.html">Soukromí</a> · <a href="/terms.html">Podmínky</a>';

    footer.replaceChildren(line,author,version,links);

    // Footer visibility belongs to the app/game layout. Never override display
    // or visibility here: body.playing must remain able to hide the footer.
    [line,author,version,links].forEach(node=>node.style.setProperty('display','block','important'));
    author.style.setProperty('font-weight','650','important');
    version.style.setProperty('opacity','.72','important');
    links.style.setProperty('margin-top','2px','important');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
