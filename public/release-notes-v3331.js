(()=>{
  'use strict';
  if(window.__PROPLET_RELEASE_NOTES_V3331__)return;
  window.__PROPLET_RELEASE_NOTES_V3331__=true;

  const RELEASE_ID='3.33.1';
  const SEEN_KEY=`proplet-release-notes-seen:${RELEASE_ID}`;
  let shown=false;

  const profile=()=>{try{return typeof getProfile==='function'?getProfile():null}catch{return null}};
  const track=event=>{
    try{
      if(window.PROPLET_ACCOUNT_BONUS_API?.track)window.PROPLET_ACCOUNT_BONUS_API.track(event);
      else if(typeof api==='function')api('/api/account-bonus-event',{method:'POST',body:JSON.stringify({event_type:event})}).catch(()=>{});
    }catch{}
  };
  const alreadySeen=()=>{try{return localStorage.getItem(SEEN_KEY)==='1'}catch{return false}};
  const markSeen=()=>{try{localStorage.setItem(SEEN_KEY,'1')}catch{}};

  function canShow(){
    if(shown||alreadySeen()||document.querySelector('.release-notes-v3331-backdrop'))return false;
    if(document.body.classList.contains('playing'))return false;
    if(!document.querySelector('#screen-daily.active'))return false;
    try{if(typeof openTransientModal==='function'&&openTransientModal())return false}catch{}
    if(document.querySelector('#onboardingModal:not(.hidden),#winModal:not(.hidden),#profileModal:not(.hidden)'))return false;
    return true;
  }

  function show(){
    if(shown)return;
    shown=true;
    const signedIn=!!profile()?.token;
    const backdrop=document.createElement('div');
    backdrop.className='release-notes-v3331-backdrop';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-labelledby','releaseNotesV3331Title');
    backdrop.innerHTML=`<section class="release-notes-v3331-panel">
      <button type="button" class="release-notes-v3331-close" aria-label="Zavřít">×</button>
      <div class="release-notes-v3331-kicker">✨ NOVINKY · ${RELEASE_ID}</div>
      <h2 id="releaseNotesV3331Title">Proplet má pár velkých novinek</h2>
      <div class="release-notes-v3331-hero ${signedIn?'is-account':'is-guest'}">
        <div class="release-notes-v3331-gift" aria-hidden="true">🎁</div>
        <div class="release-notes-v3331-hero-copy">
          <span>500 XP BONUS</span>
          <h3>${signedIn?'Máš od nás +500 XP':'500 XP je tvoje'}</h3>
          <p>${signedIn?'Za to, že máš Proplet účet. Díky, že hraješ. 💜':'Vytvoř si účet, zachovej si postup a jako bonus dostaneš <strong>+500 XP</strong>.'}</p>
          ${signedIn?'<div class="release-notes-v3331-earned">✓ Připsáno k tvému postupu</div>':'<button type="button" class="release-notes-v3331-account">Vytvořit účet · +500 XP</button>'}
        </div>
      </div>
      <div class="release-notes-v3331-features">
        <div class="release-notes-v3331-feature"><span aria-hidden="true">⚔️</span><div><strong>Vyzvi kamaráda</strong><p>Pošli svůj výsledek. Kamarád dostane stejný Proplet a může tě rovnou zkusit překonat.</p></div></div>
        <div class="release-notes-v3331-feature"><span aria-hidden="true">💻</span><div><strong>Proplet na velké obrazovce</strong><p>Notebooky a monitory mají nové rozložení s větší deskou, výsledky i profilem.</p></div></div>
      </div>
      <button type="button" class="release-notes-v3331-done">${signedIn?'Paráda, jdu hrát':'Teď ne, jdu hrát'}</button>
    </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('release-notes-v3331-open');
    track('release_notes_shown');
    if(!signedIn)window.PROPLET_ACCOUNT_BONUS_API?.offerSeen?.();

    const close=()=>{
      if(backdrop.classList.contains('closing'))return;
      markSeen();
      track('release_notes_dismissed');
      document.body.classList.remove('release-notes-v3331-open');
      backdrop.classList.add('closing');
      setTimeout(()=>backdrop.remove(),160);
      document.removeEventListener('keydown',onKey);
    };
    const create=()=>{
      markSeen();
      window.PROPLET_ACCOUNT_BONUS_API?.createClicked?.();
      document.body.classList.remove('release-notes-v3331-open');
      backdrop.remove();
      document.removeEventListener('keydown',onKey);
      try{if(typeof openProfileModal==='function')openProfileModal('create')}catch{}
    };
    const onKey=e=>{if(e.key==='Escape')close()};
    backdrop.querySelector('.release-notes-v3331-close')?.addEventListener('click',close);
    backdrop.querySelector('.release-notes-v3331-done')?.addEventListener('click',close);
    backdrop.querySelector('.release-notes-v3331-account')?.addEventListener('click',create);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>backdrop.classList.add('visible'));
    setTimeout(()=>backdrop.querySelector(signedIn?'.release-notes-v3331-done':'.release-notes-v3331-account')?.focus(),140);
  }

  let tries=0;
  const tick=()=>{
    if(canShow()){show();return}
    if(++tries<360)setTimeout(tick,250);
  };
  if(document.readyState==='complete')setTimeout(tick,700);
  else window.addEventListener('load',()=>setTimeout(tick,700),{once:true});
})();
