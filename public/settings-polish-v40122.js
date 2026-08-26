(()=>{
  'use strict';
  if(window.__PROPLET_SETTINGS_POLISH_V40122__)return;
  window.__PROPLET_SETTINGS_POLISH_V40122__=true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
  let scheduled=false;

  function currentHelperMode(){
    let key='none';
    try{key=(typeof getProfile==='function'?getProfile()?.supportMode:null)||'none'}catch{}
    try{
      if(typeof SUPPORT_MODES!=='undefined'&&SUPPORT_MODES[key])return SUPPORT_MODES[key];
    }catch{}
    return {icon:'🧠',label:'Nenabízet'};
  }

  function ensureSingleHelperSetting(){
    const gameplay=q('#soundToggle')?.closest('.settings-card');
    if(!gameplay)return;

    // The old profile implementation creates a support-mode-card whenever the profile re-renders.
    // Never move it: moving it out of #profileCard causes the next render to create another copy.
    // Remove all legacy copies and render one stable Settings-native control instead.
    qa('#screen-profile .support-mode-card').forEach(el=>el.remove());

    let row=q('#settingsHelperControl',gameplay);
    if(!row){
      row=document.createElement('div');
      row.id='settingsHelperControl';
      row.className='settings-helper-control';
      row.innerHTML='<div class="settings-helper-copy"><strong>Pomocník</strong><small id="settingsHelperValue"></small></div><button id="settingsHelperBtn" class="secondary-btn" type="button">Nastavit</button>';
      const head=q('.section-head',gameplay);
      if(head)head.insertAdjacentElement('afterend',row);else gameplay.prepend(row);
      q('#settingsHelperBtn',row).onclick=()=>{try{openSupportModeModal()}catch{}};
    }
    const mode=currentHelperMode();
    setText(q('#settingsHelperValue',row),`${mode.icon||'🧠'} ${mode.label||'Nenabízet'}`);
  }

  function polishProfileCopy(){
    qa('#profileCard .profile-daily-highlights small').forEach(el=>{
      if((el.textContent||'').trim()==='Nejlepší Daily')setText(el,'Nejrychlejší výzva');
    });
  }

  function polishInstallCard(){
    const card=q('#installAppCard');if(!card)return;
    q('.section-head .eyebrow',card)?.remove();
    setText(q('.section-head h2',card),'Aplikace Proplet');
    setText(q(':scope>p.muted',card),'Nainstaluj si Proplet na plochu telefonu nebo počítače jako aplikaci. Budeš ho mít vždycky snadno po ruce.');
    const status=q('#installAppStatus',card),text=(status?.textContent||'').trim();
    const redundant=/^(Otevře se jako|Přidej si Proplet|Po instalaci|Budeš ho mít)/i.test(text);
    status?.classList.toggle('settings-install-status-redundant',redundant);
  }

  function ensure(){ensureSingleHelperSetting();polishProfileCopy();polishInstallCard()}

  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;ensure()});
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:false});

  const boot=()=>{ensure();setTimeout(ensure,120);setTimeout(ensure,500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
