(()=>{
  'use strict';
  if(window.__PROPLET_RELEASE_NOTES_V40131__)return;
  window.__PROPLET_RELEASE_NOTES_V40131__=true;

  const RELEASE_ID='4.01.31';
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
  const isPreview=()=>{try{return typeof TAJENKA_PREVIEW!=='undefined'&&TAJENKA_PREVIEW===true}catch{return false}};
  const tajenkaReady=()=>{
    try{return typeof TAJENKA_AVAILABLE!=='undefined'&&TAJENKA_AVAILABLE===true&&typeof tajenkaPuzzle!=='undefined'&&!!tajenkaPuzzle}catch{return false}
  };
  const mozkomorReady=()=>window.PROPLET_RUNTIME_META?.capabilities?.mozkomorReleaseEnabled===true;

  function canShow(){
    if(!isPreview()&&today()<RELEASE_DATE)return false;
    if(!tajenkaReady())return false;
    if(shown||alreadySeen()||document.querySelector('.release-notes-v3331-backdrop'))return false;
    if(document.body.classList.contains('playing'))return false;
    if(!document.querySelector('#screen-daily.active'))return false;
    try{if(typeof openTransientModal==='function'&&openTransientModal())return false}catch{}
    if(document.querySelector('#onboardingModal:not(.hidden),#winModal:not(.hidden),#profileModal:not(.hidden)'))return false;
    return true;
  }

  function show(){
    if(shown||!tajenkaReady())return;
    shown=true;
    const backdrop=document.createElement('div');
    backdrop.className='release-notes-v3331-backdrop';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-labelledby','releaseNotesV40131Title');
    const mozkomor=mozkomorReady()?`<div class="release-notes-v3331-feature"><span aria-hidden="true">😈</span><div><strong>Mozkomor je tady</strong><p>Nová vrcholná výzva pro hráče, kterým už běžná cesta nestačí.</p></div></div>`:'';
    backdrop.innerHTML=`<section class="release-notes-v3331-panel">
      <button type="button" class="release-notes-v3331-close" aria-label="Zavřít">×</button>
      <div class="release-notes-v3331-kicker">✨ VÍKENDOVÁ NOVINKA · ${RELEASE_ID}</div>
      <h2 id="releaseNotesV40131Title">Tajenka je tady</h2>
      <div class="release-notes-v3331-hero">
        <div class="release-notes-v3331-gift" aria-hidden="true">✦</div>
        <div class="release-notes-v3331-hero-copy">
          <span>VÍKENDOVÝ BONUS · +200 XP</span>
          <h3>Pět slov. Jedna myšlenka.</h3>
          <p>Najdi propletená slova, nech některá písmena nevyužitá a odhal společnou tajenku. Každý víkend čeká nová.</p>
          <button type="button" class="release-notes-v3331-account">Hrát Tajenku · +200 XP</button>
        </div>
      </div>
      <div class="release-notes-v3331-features"${mozkomorReady()?'':' style="grid-template-columns:1fr"'}>
        <div class="release-notes-v3331-feature"><span aria-hidden="true">✨</span><div><strong>Platné slovo má cenu</strong><p>Za každé nové platné slovo, které při skládání objevíš, získáš navíc +1 XP.</p></div></div>
        ${mozkomor}
      </div>
      <button type="button" class="release-notes-v3331-done">Teď ne, prohlédnout Dnes</button>
    </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('release-notes-v3331-open');
    track('release_notes_shown');

    const finish=()=>{
      markSeen();
      track('release_notes_dismissed');
      document.body.classList.remove('release-notes-v3331-open');
      document.removeEventListener('keydown',onKey);
    };
    const close=()=>{
      if(backdrop.classList.contains('closing'))return;
      finish();
      backdrop.classList.add('closing');
      setTimeout(()=>backdrop.remove(),160);
    };
    const play=()=>{
      finish();
      backdrop.remove();
      try{if(typeof startTajenka==='function')startTajenka()}catch{}
    };
    const onKey=e=>{if(e.key==='Escape')close()};
    backdrop.querySelector('.release-notes-v3331-close')?.addEventListener('click',close);
    backdrop.querySelector('.release-notes-v3331-done')?.addEventListener('click',close);
    backdrop.querySelector('.release-notes-v3331-account')?.addEventListener('click',play);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>backdrop.classList.add('visible'));
    setTimeout(()=>backdrop.querySelector('.release-notes-v3331-account')?.focus(),140);
  }

  let tries=0;
  const tick=()=>{
    if(canShow()){show();return}
    if(++tries<360)setTimeout(tick,250);
  };
  if(document.readyState==='complete')setTimeout(tick,700);
  else window.addEventListener('load',()=>setTimeout(tick,700),{once:true});
})();
