(()=>{
  const RELEASE_ID='3.31.9';
  const SEEN_PREFIX='proplet-release-notes-seen';
  let shown=false;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const profileIdentity=p=>p?.playerId||p?.player_id||p?.id||p?.name||p?.displayName||'signed-in';
  const seenKey=p=>`${SEEN_PREFIX}:${RELEASE_ID}:${encodeURIComponent(String(profileIdentity(p)))}`;

  function canShow(){
    if(shown||document.querySelector('.release-notes-backdrop'))return false;
    if(document.body.classList.contains('playing'))return false;
    if(!document.querySelector('#screen-daily.active'))return false;
    try{
      const p=typeof getProfile==='function'?getProfile():null;
      if(!p?.token)return false;
      if(localStorage.getItem(seenKey(p))==='1')return false;
      return p;
    }catch{return false}
  }

  function show(p){
    if(shown)return;
    shown=true;
    const backdrop=document.createElement('div');
    backdrop.className='release-notes-backdrop';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-labelledby','releaseNotesTitle');
    backdrop.innerHTML=`<section class="release-notes-panel">
      <div class="release-notes-kicker">✨ NOVINKY · ${RELEASE_ID}</div>
      <h2 id="releaseNotesTitle">Proplet se zase o kus posunul</h2>
      <p class="release-notes-intro">Tři změny, kterých si stojí za to všimnout.</p>
      <div class="release-notes-list">
        <div class="release-note-item"><span>🔐</span><div><strong>Účet, který neztratíš</strong><p>Recovery e-mail, reset zapomenutého hesla a přihlášení přes Google.</p></div></div>
        <div class="release-note-item"><span>👤</span><div><strong>Přehlednější Já</strong><p>Přezdívka, avatar a zabezpečení účtu jsou teď na jednom logickém místě.</p></div></div>
        <div class="release-note-item"><span>☀️</span><div><strong>Nové Dnes</strong><p>Rychlejší pokračování, kompaktnější Volná hra a přehled celkového XP pořadí.</p></div></div>
      </div>
      <button type="button" class="release-notes-done">Jdu hrát</button>
    </section>`;
    document.body.appendChild(backdrop);
    document.body.classList.add('release-notes-open');
    const close=()=>{
      try{localStorage.setItem(seenKey(p),'1')}catch{}
      document.body.classList.remove('release-notes-open');
      backdrop.classList.add('closing');
      setTimeout(()=>backdrop.remove(),140);
      document.removeEventListener('keydown',onKey);
    };
    const onKey=e=>{if(e.key==='Escape')close()};
    backdrop.querySelector('.release-notes-done')?.addEventListener('click',close);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    document.addEventListener('keydown',onKey);
    requestAnimationFrame(()=>backdrop.classList.add('visible'));
    setTimeout(()=>backdrop.querySelector('.release-notes-done')?.focus(),120);
  }

  let tries=0;
  const tick=()=>{
    const p=canShow();
    if(p){show(p);return}
    if(++tries<180)setTimeout(tick,250);
  };
  if(document.readyState==='complete')setTimeout(tick,300);
  else window.addEventListener('load',()=>setTimeout(tick,300),{once:true});
})();
