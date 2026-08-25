(()=>{
  'use strict';
  if(window.__PROPLET_SETTINGS_IA_V40122__)return;
  window.__PROPLET_SETTINGS_IA_V40122__=true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
  const gearSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>';
  let scheduled=false;

  function profile(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
  function profileScreen(){return q('#screen-profile')}
  function settingsOpen(){return !!profileScreen()?.classList.contains('settings-open')}

  function ensureHeaderGear(){
    const header=q('.app-header'),profileChip=q('#profileChip');if(!header||!profileChip)return;
    let group=q('.quality-header-actions',header);
    if(!group){group=document.createElement('div');group.className='quality-header-actions';profileChip.before(group);group.appendChild(profileChip)}
    let btn=q('#settingsHeaderBtn',group);
    if(!btn){
      btn=document.createElement('button');btn.id='settingsHeaderBtn';btn.type='button';btn.className='settings-header-gear';btn.innerHTML=gearSvg;
      btn.setAttribute('aria-label','Nastavení');btn.title='Nastavení';btn.onclick=openSettings;group.insertBefore(btn,profileChip);
    }
  }

  function ensureProfileSettingsEntry(){
    const title=q('#screen-profile>.screen-title');if(!title)return;
    let btn=q('#profileSettingsBtn',title);
    if(!btn){
      btn=document.createElement('button');btn.id='profileSettingsBtn';btn.type='button';btn.className='profile-settings-entry';
      btn.innerHTML=`${gearSvg}<span>Nastavení</span>`;btn.setAttribute('aria-label','Otevřít nastavení');btn.onclick=openSettings;title.appendChild(btn);
    }
  }

  function ensureSettingsHeader(){
    const screen=profileScreen();if(!screen)return;
    let head=q('#profileSettingsHeader',screen);
    if(!head){
      head=document.createElement('div');head.id='profileSettingsHeader';head.className='profile-settings-header';
      head.innerHTML='<button id="profileSettingsBack" class="profile-settings-back" type="button">← Já</button><div class="profile-settings-heading"><h1>Nastavení</h1><p>Hraní, vzhled, účet a soukromí.</p></div>';
      screen.prepend(head);q('#profileSettingsBack',head).onclick=closeSettings;
    }
  }

  function classifySettingsCards(){
    q('#soundToggle')?.closest('.settings-card')?.classList.add('settings-gameplay-card');
    const trust=q('#reportIssueBtn')?.closest('.settings-card');
    if(trust){
      trust.classList.add('settings-data-card');
      const eyebrow=q('.section-head .eyebrow',trust),h2=q('.section-head h2',trust),copy=q(':scope>p.muted',trust);
      setText(eyebrow,'DATA A PODPORA');setText(h2,'Data pod kontrolou');setText(copy,'Stáhni svá data, nahlas problém nebo účet trvale smaž.');
    }
  }

  function privacyState(){const p=profile();return p?.publicRankings===true?{icon:'👀',title:'Veřejný profil',copy:'V pořadí se ukáže tvoje herní jméno a emoji avatar.'}:{icon:'🎭',title:'Anonymní profil',copy:'Výsledky zůstávají v pořadí pod anonymní přezdívkou.'}}
  function ensurePrivacyCard(){
    const screen=profileScreen();if(!screen)return;
    let card=q('#settingsPrivacyCard',screen);
    if(!card){
      card=document.createElement('div');card.id='settingsPrivacyCard';card.className='card settings-card settings-privacy-card';
      card.innerHTML='<div class="settings-privacy-line"><span class="settings-privacy-icon"></span><div class="settings-privacy-copy"><strong></strong><small></small></div><button class="settings-privacy-action" type="button">Změnit</button></div>';
      screen.appendChild(card);q('.settings-privacy-action',card).onclick=()=>{const p=profile();if(!p?.token){try{openProfileModal('create')}catch{};return}try{openRankingPrivacyModal()}catch{}};
    }
    const state=privacyState(),p=profile();setText(q('.settings-privacy-icon',card),state.icon);setText(q('.settings-privacy-copy strong',card),'Soukromí a pořadí');
    setText(q('.settings-privacy-copy small',card),p?.token?`${state.title} · ${state.copy}`:'Po uložení účtu si zvolíš, jestli se v pořadí ukáže tvoje herní jméno.');
    setText(q('.settings-privacy-action',card),p?.token?'Změnit':'Uložit postup');
  }

  function syncGuestState(){profileScreen()?.classList.toggle('settings-guest',!profile()?.token)}

  function compactRankingNode(el){
    if(!el||el.dataset.v40122Compact==='1')return;
    const text=(el.textContent||'').trim();if(!text)return;
    el.dataset.v40122Compact='1';el.textContent='';
    const details=document.createElement('details');details.className='ranking-compact-explain';
    details.innerHTML='<summary>ⓘ Pravidla pořadí</summary><p>Čisté řešení → méně nápověd → čas → tahy. Počítá se první dokončený pokus. Jméno se ukáže jen po souhlasu; jinak zůstává anonymní přezdívka.</p>';
    el.appendChild(details);
  }
  function compactRankingExplanations(){qa('.daily-world-privacy').forEach(compactRankingNode);qa('.level-board-head>small').forEach(compactRankingNode)}

  function ensureUi(){ensureHeaderGear();ensureProfileSettingsEntry();ensureSettingsHeader();classifySettingsCards();ensurePrivacyCard();syncGuestState();compactRankingExplanations()}

  function openSettings(){
    try{if(typeof nav==='function')nav('profile')}catch{}
    setTimeout(()=>{const screen=profileScreen();if(!screen)return;ensureUi();screen.classList.add('settings-open');syncGuestState();window.scrollTo({top:0,behavior:'auto'});q('#profileSettingsBack')?.focus({preventScroll:true})},20);
  }
  function closeSettings(){const screen=profileScreen();if(!screen)return;screen.classList.remove('settings-open');window.scrollTo({top:0,behavior:'auto'});q('#profileSettingsBtn')?.focus({preventScroll:true})}

  document.addEventListener('click',event=>{const navEl=event.target.closest?.('[data-nav]');if(!navEl||!settingsOpen())return;closeSettings()},true);

  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureUi()})});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:false,attributes:false});

  const boot=()=>{ensureUi();setTimeout(ensureUi,120);setTimeout(ensureUi,500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
