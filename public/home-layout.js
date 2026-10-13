(()=>{
  if(window.__propletHomeLayoutInstalled)return;

  const htmlEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shortHomeDate=iso=>{
    const [y,m,d]=iso.split('-').map(Number);
    const text=new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)));
    return text.charAt(0).toUpperCase()+text.slice(1);
  };
  let rankingCache=null;
  let rankingCacheAt=0;
  let rankingCacheScope=null;
  let rankingLoading=null;
  let rankingLoadingScope=null;

  function rankingSessionScope(){
    const p=typeof getProfile==='function'?getProfile():null;
    return p?.id&&p?.token?`player:${p.id}:${p.token}`:'anonymous';
  }

  function tuneNoviceIcon(){
    try{if(typeof LEVELS!=='undefined'&&LEVELS[0]?.name==='Nováček')LEVELS[0].icon='🔰'}catch{}
  }

  function tuneBrand(){
    const brand=document.querySelector('.brand'),mark=brand?.querySelector('.brand-mark');
    if(!brand||!mark)return;
    brand.classList.add('home-brand');
    // Keep the authoritative letterpress mark in the home header as an image.
    if(!mark.querySelector('img')){
      mark.innerHTML='<img src="/brand/mark.svg?v=brand1" alt="" aria-hidden="true">';
    }
    delete mark.dataset.homeMark;
  }

  function compactDailyHero(){
    const hero=document.querySelector('#screen-daily .daily-hero'),main=hero?.querySelector('.hero-main>div'),date=document.querySelector('#dailyDate'),meta=document.querySelector('#dailyMeta');
    if(!hero||!main||!date||!meta)return;
    const title=main.querySelector('h1');
    const titleRow=title?.closest('.daily-title-choice-row')||title;
    if(title&&!title.dataset.dailySpecialTitle)title.textContent='Denní výzva';
    let line=main.querySelector('.daily-title-meta');
    if(!line){
      line=document.createElement('div');
      line.className='daily-title-meta';
      titleRow?.insertAdjacentElement('afterend',line);
      date.classList.remove('date-pill','light-pill');
      date.classList.add('daily-inline-date');
      line.append(date,meta);
    }
    if(titleRow&&line.parentElement!==main)titleRow.insertAdjacentElement('afterend',line);
  }

  function dailyProgressExists(date,daily){
    try{
      const key=challengeKey('daily',daily.puzzle,date);
      return !!getState()?.inProgress?.[key];
    }catch{return false}
  }

  function tuneDailyState(){
    try{
      const date=pragueDateISO(),daily=dailyResultState(date),button=document.querySelector('#playDailyBtn'),sync=document.querySelector('#dailySyncStatus'),dateEl=document.querySelector('#dailyDate'),meta=document.querySelector('#dailyMeta');
      if(dateEl)dateEl.textContent=shortHomeDate(date);
      if(meta)meta.textContent=DIFF[daily.puzzle.difficulty]?.label||'';
      if(button){
        if(daily.active)button.textContent='Zobrazit dnešní výsledek';
        else if(daily.legacy)button.textContent='Zahrát dnešní výzvu';
        else if(dailyProgressExists(date,daily))button.textContent='Pokračovat v Denní výzvě';
        else button.textContent='Hrát Denní výzvu';
      }
      if(sync){
        const text=(sync.textContent||'').trim();
        sync.classList.toggle('home-sync-benign',/^✓|^📱/.test(text));
      }
    }catch{}
  }

  function todayDifficultyVisible(key){
    return !!DIFF[key];
  }

  function freeHistory(){
    const state=getState?.()||{};
    const visibleOnToday=r=>r?.mode==='free'&&todayDifficultyVisible(r.difficulty);
    const progress=Object.values(state.inProgress||{}).filter(visibleOnToday);
    const completed=Object.values(state.completed||{}).filter(visibleOnToday);
    return {progress,completed,hasAny:progress.length>0||completed.length>0};
  }

  function latestFreeResume(){
    const progress=[...freeHistory().progress].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    for(const item of progress){
      const difficulty=item.difficulty,q=freeProgress(difficulty);
      if(q.resume)return {difficulty,q};
    }
    return null;
  }

  function difficultyTiles(){
    return Object.keys(DIFF).filter(todayDifficultyVisible).map(key=>[key,DIFF[key]]).map(([key,info])=>{
      const q=freeProgress(key),pct=Number.isFinite(q.pct)?q.pct:0,action=q.resume?'Pokračovat':q.done>=q.total&&q.total?'Zahrát znovu':'Hrát';
      return `<button class="today-card ${key}" type="button" data-home-free="${key}" data-diff="${key}" aria-label="${action}: ${htmlEsc(info.label)}, ${q.done} z ${q.total} dokončeno, +${info.xp} XP za novou úroveň">${difficultyIconMarkup(key,'today-art')}<span class="today-title"><strong>${htmlEsc(info.label)}</strong><span class="today-xp">+${info.xp} XP</span></span><span class="today-progress"><span class="today-count"><b>${q.done}</b> / ${q.total}</span><span class="today-track" aria-hidden="true"><span style="width:${pct}%"></span></span></span><span class="today-action">${action} <span class="today-arrow" aria-hidden="true">→</span></span></button>`;
    }).join('');
  }

  function renderHomeQuickPlay(){
    const root=document.querySelector('#quickPlayGrid'),card=document.querySelector('#quickPlayCard');
    if(!root||!card||typeof puzzleDB==='undefined'||!puzzleDB)return;
    const head=card.querySelector('.quick-play-head'),title=head?.querySelector('h2'),all=head?.querySelector('#openAllGamesBtn');
    card.classList.add('home-free-section');
    if(title)title.textContent='Volná hra';
    if(all)all.innerHTML='Všechny hry <span>→</span>';
    root.innerHTML=`<div class="today-grid">${difficultyTiles()}</div>`;
    root.querySelectorAll('[data-home-free]').forEach(btn=>btn.addEventListener('click',()=>startFree(btn.dataset.homeFree)));
  }

  function renderResumeCard(){
    const screen=document.querySelector('#screen-daily'),hero=screen?.querySelector('.daily-hero');
    if(!screen||!hero)return;
    let card=screen.querySelector('#homeResumeCard');
    const resume=latestFreeResume();
    if(!resume){card?.remove();return}
    const {difficulty,q}=resume,d=DIFF[difficulty],level=Number(q.resume?.meta?.level)||1;
    if(!card){
      card=document.createElement('button');
      card.id='homeResumeCard';
      card.type='button';
      card.className='home-resume-card';
    }
    card.dataset.diff=difficulty;
    card.innerHTML=`<span class="home-resume-icon">${difficultyIconMarkup(difficulty,'home-resume-difficulty-icon')}</span><span class="home-resume-copy"><span>ROZEHRANÁ HRA</span><strong>${htmlEsc(d.label)} · úroveň ${level}</strong></span><b>Pokračovat <i>→</i></b>`;
    card.onclick=()=>startFree(difficulty);
    if(hero.previousElementSibling!==card)screen.insertBefore(card,hero);
  }

  function ensureCompetitionCard(){
    const screen=document.querySelector('#screen-daily'),quick=screen?.querySelector('#quickPlayCard');
    if(!screen||!quick)return null;
    let card=screen.querySelector('#homeCompetitionCard');
    if(!card){
      card=document.createElement('section');
      card.id='homeCompetitionCard';
      card.className='card home-competition-card';
      card.innerHTML=`<div class="home-competition-head"><h2>Tvůj postup</h2><button type="button" id="homeLeaderboardBtn">Celkové pořadí <b>→</b></button></div><div id="homeCompetitionSelf" class="home-competition-self"></div><div id="homeCompetitionRows" class="home-competition-rows"><div class="home-ranking-loading">Načítám pořadí…</div></div>`;
      card.querySelector('#homeLeaderboardBtn').onclick=()=>nav('leaderboard');
    }
    if(window.PropletArchiveExperience?.isEnabled?.()){
      if(card.parentElement!==screen)screen.append(card);
    }else if(quick.nextElementSibling!==card)quick.insertAdjacentElement('afterend',card);
    return card;
  }

  function renderCompetitionSelf(selfRow=null){
    const root=document.querySelector('#homeCompetitionSelf');if(!root)return;
    const stats=effectiveStats(),points=stats.points||0,streak=stats.currentStreak||0,l=levelFor(points),p=getProfile?.();
    const place=selfRow?.rank?`${selfRow.rank}. místo`:'—',days=streak===1?'den':streak>=2&&streak<=4?'dny':'dní';
    const remaining=l.next?Math.max(0,l.next.xp-points):0;
    const art=window.PropletRibbonArt?.art(l.current.name,{category:'rank',size:160});
    const next=l.next?`<div class="rank-track" role="progressbar" aria-label="Postup k hodnosti ${htmlEsc(l.next.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(l.pct)}" aria-valuetext="Do další hodnosti zbývá ${remaining} XP"><span style="width:${l.pct}%"></span></div><p class="rank-next"><strong>${remaining.toLocaleString('cs-CZ')} XP <span aria-hidden="true">→</span></strong><span>${htmlEsc(l.next.name)}</span></p>`:'<p class="rank-next">Nejvyšší hodnost. Klobouk dolů!</p>';
    root.innerHTML=`<div class="rank-hero"><div class="rank-art" aria-hidden="true">${art?.outerHTML||l.current.icon}</div><div class="rank-copy"><h3>${htmlEsc(l.current.name)}</h3>${next}</div></div><dl class="rank-metrics"><div><dt>Celkem XP</dt><dd>${points.toLocaleString('cs-CZ')}</dd></div><div><dt>V pořadí</dt><dd>${place}</dd>${!selfRow?.rank&&!p?.token?'<small>po přihlášení</small>':''}</div><div><dt>Denní série</dt><dd><img src="/rewards/printshop/symbol-streak.svg" alt="" width="28" height="32">${streak} <span>${days}</span></dd></div></dl>`;
  }

  function renderCompetitionRows(data){
    const root=document.querySelector('#homeCompetitionRows');if(!root)return;
    const players=Array.isArray(data?.players)?data.players:[],top=players.slice(0,3),self=players.find(r=>r.isMine)||null;
    renderCompetitionSelf(self);
    if(!top.length){root.innerHTML='<div class="home-ranking-subhead"><h3>Špička žebříčku</h3></div><div class="home-ranking-empty"><strong>Pořadí se právě rozjíždí.</strong><span>Nasbírej XP a zabydli se nahoře.</span></div>';return}
    const medals=['🥇','🥈','🥉'];
    root.innerHTML=`<div class="home-ranking-subhead"><h3>Špička žebříčku</h3></div><div class="home-ranking-list">${top.map((r,i)=>`<div class="home-ranking-row ${r.isMine?'mine':''}"><span class="home-ranking-medal">${medals[i]}</span><span class="home-ranking-avatar">${htmlEsc(r.avatar||'🙂')}</span><strong>${htmlEsc(r.name||'Hráč')}${r.isMine?' <span class="home-ranking-you">TY</span>':''}</strong><b>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</b></div>`).join('')}</div>`+(!getProfile?.()?.token?'<button type="button" class="home-ranking-login" data-home-profile>Přihlas se a ukaž svoje místo v pořadí →</button>':'');
    root.querySelector('[data-home-profile]')?.addEventListener('click',()=>nav('profile'));
  }

  async function loadCompetition(){
    const card=ensureCompetitionCard();if(!card)return;
    renderCompetitionSelf();
    const scope=rankingSessionScope(),fresh=rankingCache&&rankingCacheScope===scope&&Date.now()-rankingCacheAt<60000;
    if(fresh){renderCompetitionRows(rankingCache);return}
    if(rankingLoading&&rankingLoadingScope===scope){await rankingLoading;return}
    const request=(async()=>{
      try{
        const data=typeof api==='function'?await api('/api/rankings/xp?period=all'):await fetch('/api/rankings/xp?period=all',{cache:'no-store'}).then(r=>r.json());
        if(rankingSessionScope()!==scope)return;
        rankingCache=data;rankingCacheAt=Date.now();rankingCacheScope=scope;renderCompetitionRows(data);
      }catch{if(rankingSessionScope()===scope){const root=document.querySelector('#homeCompetitionRows');if(root)root.innerHTML='<div class="home-ranking-empty"><strong>Pořadí teď nedoběhlo.</strong><span>Zkus ho otevřít za chvíli.</span></div>'}}
    })();
    rankingLoading=request;rankingLoadingScope=scope;
    try{await request}finally{if(rankingLoading===request){rankingLoading=null;rankingLoadingScope=null}}
    if(rankingSessionScope()!==scope)await loadCompetition();
  }

  function placeMetaProgress(){
    const screen=document.querySelector('#screen-daily'),level=document.querySelector('#levelCard'),competition=ensureCompetitionCard();
    if(!screen||!level||!competition)return;
    screen.classList.add('home-layout-active');
    level.classList.add('home-status-strip');
    if(competition.nextElementSibling!==level)competition.insertAdjacentElement('afterend',level);
  }

  function applyLayout(){
    tuneBrand();
    compactDailyHero();
    tuneDailyState();
    renderResumeCard();
    ensureCompetitionCard();
    placeMetaProgress();
    const tajenka=document.querySelector('#tajenkaPreviewCard');
    if(tajenka)document.querySelector('#screen-daily')?.appendChild(tajenka);
    loadCompetition();
    if(window.PropletArchiveExperience?.isEnabled?.())window.PropletArchiveExperience.home();
    if(typeof renderDailySpecialUI==='function')renderDailySpecialUI();
  }

  function install(){
    if(window.__propletHomeLayoutInstalled)return true;
    if(typeof renderDaily!=='function'||typeof renderQuickPlay!=='function'||typeof freeProgress!=='function'||typeof getState!=='function')return false;
    window.__propletHomeLayoutInstalled=true;
    tuneNoviceIcon();
    renderQuickPlay=renderHomeQuickPlay;
    applyLayout();
    try{renderDaily()}catch{}
    return true;
  }

  window.PropletHomeLayout={applyDailyLayout:applyLayout,install};

  let tries=0;
  const boot=()=>{
    if(install())return;
    if(++tries<120)setTimeout(boot,100);
  };
  if(document.readyState==='complete')boot();
  else window.addEventListener('load',boot,{once:true});
})();
