(()=>{
  'use strict';
  if(window.__PROPLET_SETTINGS_POLISH_V40122__)return;
  window.__PROPLET_SETTINGS_POLISH_V40122__=true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
  let scheduled=false;

  function moveHelperIntoSettings(){
    const support=q('.support-mode-card');
    const gameplay=q('#soundToggle')?.closest('.settings-card');
    if(!support||!gameplay)return;
    support.classList.add('settings-support-polished','settings-support-compact');
    const label=q('.stat-label',support);
    if(label){setText(label,'Pomocník');label.classList.add('support-mode-title')}
    q('small',support)?.classList.add('support-mode-desc-pruned');
    const head=q('.section-head',gameplay);
    if(support.parentElement!==gameplay || support.previousElementSibling!==head){
      if(head)head.insertAdjacentElement('afterend',support);
      else gameplay.prepend(support);
    }
  }

  function polishProfileCopy(){
    qa('#profileCard .profile-daily-highlights small').forEach(el=>{
      if((el.textContent||'').trim()==='Nejlepší Daily')setText(el,'Nejrychlejší výzva');
    });
  }

  function polishInstallCard(){
    const card=q('#installAppCard');if(!card)return;
    q('.section-head .eyebrow',card)?.remove();
    setText(q('.section-head h2',card),'Nainstaluj si Proplet');
    setText(q(':scope>p.muted',card),'Nainstaluj si Proplet na plochu telefonu nebo počítače jako aplikaci. Budeš ho mít vždycky snadno po ruce.');
    const status=q('#installAppStatus',card),text=(status?.textContent||'').trim();
    const redundant=/^(Otevře se jako|Přidej si Proplet|Po instalaci|Budeš ho mít)/i.test(text);
    status?.classList.toggle('settings-install-status-redundant',redundant);
  }

  function ensure(){moveHelperIntoSettings();polishProfileCopy();polishInstallCard()}

  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;ensure()});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  const boot=()=>{ensure();setTimeout(ensure,120);setTimeout(ensure,500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
