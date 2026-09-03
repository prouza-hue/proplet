(()=>{
  'use strict';
  if(window.__PROPLET_SETTINGS_IA_V40122__)return;
  window.__PROPLET_SETTINGS_IA_V40122__=true;

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
  const setClass=(el,name,on)=>{if(el)el.classList.toggle(name,!!on)};
  const gearSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>';
  let scheduled=false;

  function profile(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
  function profileScreen(){return q('#screen-profile')}
  function settingsOpen(){return !!profileScreen()?.classList.contains('settings-open')}
  function removeEyebrow(root){q('.section-head .eyebrow',root)?.remove()}

  function ensureHeaderGear(){
    const header=q('.app-header'),profileChip=q('#profileChip');if(!header||!profileChip)return;
    let group=q('.quality-header-actions',header);
    if(!group){group=document.createElement('div');group.className='quality-header-actions';profileChip.before(group);group.appendChild(profileChip)}
    let btn=q('#settingsHeaderBtn',group);
    if(!btn){
      btn=document.createElement('button');btn.id='settingsHeaderBtn';btn.type='button';btn.className='settings-header-gear';btn.innerHTML=gearSvg;
      btn.setAttribute('aria-label','Nastavení');btn.title='Nastavení';btn.onclick=openSettings;group.insertBefore(btn,profileChip);
    }
    q('#profileSettingsBtn')?.remove();
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

  function polishGameplayCard(){
    const card=q('#soundToggle')?.closest('.settings-card');if(!card)return;
    card.classList.add('settings-gameplay-card');removeEyebrow(card);
    q('#wakeLockNote')?.classList.add('settings-copy-pruned');
    const support=q('.support-mode-card',card);if(!support)return;
    support.classList.add('settings-support-polished');
    const label=q('.stat-label',support);if(label){setText(label,'Pomocník');label.classList.add('support-mode-title')}
  }

  function polishAppearanceCard(){
    const card=q('.appearance-card');if(!card)return;
    q('.appearance-copy',card)?.classList.add('settings-copy-pruned');
    q('#themeModeNote',card)?.classList.add('settings-copy-pruned');
  }

  function polishPushCard(){
    const card=q('.push-card');if(!card)return;
    removeEyebrow(card);
    q(':scope>p.push-copy',card)?.classList.add('settings-copy-pruned');
    const detail=q('.notification-pref-copy>small',card);
    setText(detail,'Dáme vědět o Denní výzvě a každé pondělí o nové várce úrovní.');
    const status=q('#pushStatusText',card),statusText=(status?.textContent||'').trim();
    const redundant=/^(Zapnuto na tomto zařízení|Vypnuto na tomto zařízení)/.test(statusText);
    setClass(status,'settings-status-redundant',redundant);
  }

  function polishDataCard(){
    const card=q('#reportIssueBtn')?.closest('.settings-card');if(!card)return;
    card.classList.add('settings-data-card');removeEyebrow(card);
    setText(q('.section-head h2',card),'Data pod kontrolou');
    setText(q(':scope>p.muted',card),'Stáhni svá data, nahlas problém nebo účet trvale smaž.');
  }

  function polishAccountHub(){
    const hub=q('#profileAccountHub');if(!hub)return;
    const head=q('.profile-account-head',hub);if(!head)return;
    q('.stat-label',head)?.remove();
    setText(q('strong',head),'Tvůj účet');
  }

  function ensureAdminPlacement(){
    const screen=profileScreen(),admin=q('#adminEntryBtn');if(!screen||!admin)return;
    let slot=q('#settingsAdminSlot',screen);
    if(!slot){slot=document.createElement('div');slot.id='settingsAdminSlot';slot.className='settings-admin-slot';screen.appendChild(slot)}
    if(admin.parentElement!==slot)slot.appendChild(admin);
  }

  function classifySettingsCards(){
    polishGameplayCard();polishAppearanceCard();polishPushCard();polishDataCard();polishAccountHub();ensureAdminPlacement();
  }

  function privacyState(){const p=profile();return p?.publicRankings===true?{icon:'👀',title:'Veřejný profil',copy:'V pořadí se ukáže tvoje herní jméno a iniciály.'}:{icon:'🎭',title:'Anonymní profil',copy:'Výsledky zůstávají v pořadí pod anonymní přezdívkou.'}}
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

  function ensureUi(){
    ensureHeaderGear();ensureSettingsHeader();classifySettingsCards();ensurePrivacyCard();syncGuestState();compactRankingExplanations();
  }

  function openSettings(){
    try{if(typeof nav==='function')nav('profile')}catch{}
    setTimeout(()=>{const screen=profileScreen();if(!screen)return;ensureUi();screen.classList.add('settings-open');syncGuestState();window.scrollTo({top:0,behavior:'auto'});q('#profileSettingsBack')?.focus({preventScroll:true})},20);
  }
  function closeSettings(){
    const screen=profileScreen();if(!screen)return;screen.classList.remove('settings-open');window.scrollTo({top:0,behavior:'auto'});q('#settingsHeaderBtn')?.focus({preventScroll:true});
  }

  document.addEventListener('click',event=>{const navEl=event.target.closest?.('[data-nav]');if(!navEl||!settingsOpen())return;closeSettings()},true);

  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureUi()})});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:false,attributes:false});

  const boot=()=>{ensureUi();setTimeout(ensureUi,120);setTimeout(ensureUi,500)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
