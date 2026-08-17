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
  let rankingLoading=null;

  function tuneNoviceIcon(){
    try{if(typeof LEVELS!=='undefined'&&LEVELS[0]?.name==='Nováček')LEVELS[0].icon='🔰'}catch{}
  }

  function tuneBrand(){
    const brand=document.querySelector('.brand'),mark=brand?.querySelector('.brand-mark');
    if(!brand||!mark)return;
    brand.classList.add('home-brand');
    if(!mark.dataset.homeMark){
      mark.dataset.homeMark='1';
      mark.innerHTML='<i>P</i><i>R</i><i>O</i><i>P</i>';
    }
  }

  function compactDailyHero(){
    const hero=document.querySelector('#screen-daily .daily-hero'),main=hero?.querySelector('.hero-main>div'),date=document.querySelector('#dailyDate'),meta=document.querySelector('#dailyMeta');
    if(!hero||!main||!date||!meta)return;
    const title=main.querySelector('h1');
    if(title)title.textContent='Denní výzva';
    let line=main.querySelector('.daily-title-meta');
    if(!line){
      line=document.createElement('div');
      line.className='daily-title-meta';
      title?.insertAdjacentElement('afterend',line);
      date.classList.remove('date-pill','light-pill');
      date.classList.add('daily-inline-date');
      line.append(date,meta);
    }
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

  function freeHistory(){
    const state=getState?.()||{};
    const progress=Object.values(state.inProgress||{}).filter(r=>r?.mode==='free'&&DIFF[r.difficulty]);
    const completed=Object.values(state.completed||{}).filter(r=>r?.mode==='free'&&DIFF[r.difficulty]);
    return {progress,completed,hasAny:progress.length>0||completed.length>0};
  }

  function latestFreeResume(){
    const progress=[...freeHistory().progress].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    if(!progress.length)return null;
    const difficulty=progress[0].difficulty;
    const q=freeProgress(difficulty);
    return q.resume?{difficulty,q}:null;
  }

  function difficultyTiles(){
    return Object.entries(DIFF).map(([key,info])=>{
      const q=freeProgress(key),pct=Number.isFinite(q.pct)?q.pct:0,next=Number((q.resume||q.nextUnsolved)?.meta?.level)||1;
      const state=q.resume?'Rozehráno':q.done>=q.total&&q.total?'Dokončeno':`Další: ${next}`;
      return `<button class="home-diff-tile" type="button" data-home-free="${key}" data-diff="${key}" aria-label="${htmlEsc(info.label)}, ${q.done} z ${q.total} hotovo"><span class="home-diff-top"><span class="home-diff-icon-wrap">${difficultyIconMarkup(key,'home-diff-icon')}</span><strong>${htmlEsc(info.label)}</strong><b class="home-diff-xp">+${info.xp} XP</b></span><span class="home-diff-meta"><b>${htmlEsc(state)}</b><span>${q.done} / ${q.total}</span></span><i class="home-diff-progress"><b style="width:${pct}%"></b></i></button>`;
    }).join('');
  }

  function renderHomeQuickPlay(){
    const root=document.querySelector('#quickPlayGrid'),card=document.querySelector('#quickPlayCard');
    if(!root||!card||typeof puzzleDB==='undefined'||!puzzleDB)return;
    const head=card.querySelector('.quick-play-head'),title=head?.querySelector('h2'),all=head?.querySelector('#openAllGamesBtn');
    card.classList.add('home-free-section');
    if(title)title.textContent='Volná hra';
    if(all)all.innerHTML='Všechny hry <span>→</span>';
    root.innerHTML=`<div class="home-diff-grid">${difficultyTiles()}</div>`;
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
      card.innerHTML=`<div class="home-competition-head"><div><span>XP A POŘADÍ</span><h2>Jak si vedeš</h2></div><button type="button" id="homeLeaderboardBtn">Celé pořadí <b>→</b></button></div><div id="homeCompetitionSelf" class="home-competition-self"></div><div id="homeCompetitionRows" class="home-competition-rows"><div class="home-ranking-loading">Načítám pořadí…</div></div>`;
      card.querySelector('#homeLeaderboardBtn').onclick=()=>nav('leaderboard');
    }
    if(quick.nextElementSibling!==card)quick.insertAdjacentElement('afterend',card);
    return card;
  }

  function renderCompetitionSelf(selfRow=null){
    const root=document.querySelector('#homeCompetitionSelf');if(!root)return;
    const stats=effectiveStats(),points=stats.points||0,streak=stats.currentStreak||0,l=levelFor(points),p=getProfile?.();
    const place=selfRow?.rank?`#${selfRow.rank}`:(p?.token?'—':'bez pořadí');
    root.innerHTML=`<div class="home-xp-level"><span>${l.current.icon}</span><div><b>${htmlEsc(l.current.name)}</b><small>${l.next?`${Math.max(0,l.next.xp-points).toLocaleString('cs-CZ')} XP do ${htmlEsc(l.next.name)}`:'Nejvyšší hodnost'}</small></div></div><div class="home-xp-number"><strong>${points.toLocaleString('cs-CZ')}</strong><span>XP</span></div><div class="home-xp-place"><strong>${place}</strong><span>pořadí</span></div><div class="home-xp-streak"><strong>🔥 ${streak}</strong><span>${streak===1?'den':streak>=2&&streak<=4?'dny':'dní'}</span></div>`;
  }

  function renderCompetitionRows(data){
    const root=document.querySelector('#homeCompetitionRows');if(!root)return;
    const players=Array.isArray(data?.players)?data.players:[],top=players.slice(0,3),self=players.find(r=>r.isMine)||null;
    renderCompetitionSelf(self);
    if(!top.length){root.innerHTML='<div class="home-ranking-empty"><strong>Pořadí se právě rozjíždí.</strong><span>Nasbírej XP a zabydli se nahoře.</span></div>';return}
    const medals=['🥇','🥈','🥉'];
    root.innerHTML=top.map((r,i)=>`<div class="home-ranking-row ${r.isMine?'mine':''}"><span class="home-ranking-medal">${medals[i]}</span><span class="home-ranking-avatar">${htmlEsc(r.avatar||'🙂')}</span><strong>${htmlEsc(r.name||'Hráč')}</strong><b>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</b></div>`).join('')+((self&&self.rank>3)?`<div class="home-ranking-selfline"><span>Tvoje místo</span><strong>#${self.rank} · ${Number(self.xp||0).toLocaleString('cs-CZ')} XP</strong></div>`:(!getProfile?.()?.token?'<button type="button" class="home-ranking-login" data-home-profile>Přihlas se a ukaž svoje místo v pořadí →</button>':''));
    root.querySelector('[data-home-profile]')?.addEventListener('click',()=>nav('profile'));
  }

  async function loadCompetition(){
    const card=ensureCompetitionCard();if(!card)return;
    renderCompetitionSelf();
    const fresh=rankingCache&&Date.now()-rankingCacheAt<60000;
    if(fresh){renderCompetitionRows(rankingCache);return}
    if(rankingLoading)return;
    rankingLoading=(async()=>{
      try{
        const data=typeof api==='function'?await api('/api/rankings/xp?period=all'):await fetch('/api/rankings/xp?period=all',{cache:'no-store'}).then(r=>r.json());
        rankingCache=data;rankingCacheAt=Date.now();renderCompetitionRows(data);
      }catch{const root=document.querySelector('#homeCompetitionRows');if(root)root.innerHTML='<div class="home-ranking-empty"><strong>Pořadí teď nedoběhlo.</strong><span>Zkus ho otevřít za chvíli.</span></div>'}
      finally{rankingLoading=null}
    })();
    await rankingLoading;
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
    loadCompetition();
  }

  function install(){
    if(window.__propletHomeLayoutInstalled)return true;
    if(typeof renderDaily!=='function'||typeof renderQuickPlay!=='function'||typeof freeProgress!=='function'||typeof getState!=='function')return false;
    window.__propletHomeLayoutInstalled=true;
    tuneNoviceIcon();
    const baseDaily=renderDaily;
    renderQuickPlay=renderHomeQuickPlay;
    renderDaily=function(){
      baseDaily();
      applyLayout();
    };
    applyLayout();
    try{renderDaily()}catch{}
    document.querySelectorAll('[data-nav="daily"]').forEach(el=>el.addEventListener('click',()=>setTimeout(applyLayout,40)));
    return true;
  }

  let tries=0;
  const boot=()=>{
    if(install())return;
    if(++tries<120)setTimeout(boot,100);
  };
  if(document.readyState==='complete')boot();
  else window.addEventListener('load',boot,{once:true});
})();
