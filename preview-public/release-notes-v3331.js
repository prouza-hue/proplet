(()=>{
  'use strict';
  if(window.__PROPLET_RELEASE_NOTES_V40132__)return;
  window.__PROPLET_RELEASE_NOTES_V40132__=true;

  const RELEASE_ID='4.01.32';
  const RELEASE_DATE='2026-08-29';
  const SEEN_KEY=`proplet-release-notes-seen:${RELEASE_ID}`;
  let shown=false;

  const track=event=>{
    try{
      if(window.PROPLET_ACCOUNT_BONUS_API?.track)window.PROPLET_ACCOUNT_BONUS_API.track(event);
      else if(typeof api==='function')api('/api/account-bonus-event',{method:'POST',body:JSON.stringify({event_type:event})}).catch(()=>{});
    }catch{}
  };
  const alreadySeen=()=>{try{return localStorage.getItem(SEEN_KEY)==='1'}catch{return false}};
  const markSeen=()=>{try{localStorage.setItem(SEEN_KEY,'1')}catch{}};
  const today=()=>{try{return typeof pragueDateISO==='function'?pragueDateISO():new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague'}).format(new Date())}catch{return ''}};
  const isPreview=()=>location.hostname.endsWith('.vercel.app');

  function canShow(){
    if(!isPreview()&&today()<RELEASE_DATE)return false;
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
    const backdrop=document.createElement('div');
    backdrop.className='release-notes-v3331-backdrop';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-labelledby','releaseNotesV40132Title');
    backdrop.innerHTML=`<section class="release-notes-v3331-panel">
      <button type="button" class="release-notes-v3331-close" aria-label="Zavřít">×</button>
      <div class="release-notes-v3331-art" aria-hidden="true">
        <span class="release-notes-v3331-tile tile-p">P</span>
        <span class="release-notes-v3331-tile tile-l">L</span>
        <span class="release-notes-v3331-tile tile-t">T</span>
      </div>
      <h2 id="releaseNotesV40132Title">Novinky v Propletu</h2>
      <div class="release-notes-v3331-features">
        <div class="release-notes-v3331-feature feature-tajenka">
          <span class="release-notes-v3331-icon" aria-hidden="true">🧩</span>
          <div><strong>Tajenka</strong><span>nová každou sobotu</span></div>
        </div>
        <div class="release-notes-v3331-feature feature-mozkomor">
          <span class="release-notes-v3331-icon" aria-hidden="true">🧠</span>
          <div><strong>Mozkomor</strong><span>100 nových úrovní</span></div>
        </div>
        <div class="release-notes-v3331-feature feature-xp">
          <span class="release-notes-v3331-icon" aria-hidden="true">✨</span>
          <div><strong>+1 XP</strong><span>za platná slova navíc</span></div>
        </div>
      </div>
      <button type="button" class="release-notes-v3331-account">Jdu hrát</button>
    </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('release-notes-v3331-open');
    track('release_notes_shown');

    const finish=()=>{
      markSeen();
      document.body.classList.remove('release-notes-v3331-open');
      document.removeEventListener('keydown',onKey);
    };
    const close=(event='release_notes_dismissed')=>{
      if(backdrop.classList.contains('closing'))return;
      finish();
      track(event);
      backdrop.classList.add('closing');
      setTimeout(()=>backdrop.remove(),180);
    };
    const onKey=e=>{if(e.key==='Escape')close()};
    backdrop.querySelector('.release-notes-v3331-close')?.addEventListener('click',()=>close());
    backdrop.querySelector('.release-notes-v3331-account')?.addEventListener('click',()=>close('release_notes_primary_clicked'));
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>backdrop.classList.add('visible'));
    setTimeout(()=>backdrop.querySelector('.release-notes-v3331-account')?.focus(),180);
  }

  let tries=0;
  const tick=()=>{
    if(canShow()){show();return}
    if(++tries<360)setTimeout(tick,250);
  };
  if(document.readyState==='complete')setTimeout(tick,650);
  else window.addEventListener('load',()=>setTimeout(tick,650),{once:true});
})();
