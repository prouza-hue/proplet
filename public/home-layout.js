(()=>{
  if(window.__propletHomeLayoutInstalled)return;

  const htmlEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shortHomeDate=iso=>{
    const [y,m,d]=iso.split('-').map(Number);
    const text=new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)));
    return text.charAt(0).toUpperCase()+text.slice(1);
  };
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
    const title=main.querySelector('#dailyHeroTitle');
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
    const date=pragueDateISO(),studioDate=document.querySelector('#studioTodayDate');
    if(studioDate){studioDate.textContent=shortHomeDate(date);studioDate.setAttribute('datetime',date)}
    try{
      const daily=dailyResultState(date),button=document.querySelector('#playDailyBtn'),sync=document.querySelector('#dailySyncStatus'),dateEl=document.querySelector('#dailyDate'),meta=document.querySelector('#dailyMeta');
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
    const resume=latestFreeResume();
    for(const [screenId,cardId,anchorSelector] of [['screen-daily','homeResumeCard','.daily-hero'],['screen-free','freeResumeCard','#difficultyCards']]){
      const screen=document.getElementById(screenId),anchor=screen?.querySelector(anchorSelector);
      if(!screen||!anchor)continue;
      let card=document.getElementById(cardId);
      if(!resume){card?.remove();continue}
      const {difficulty,q}=resume,d=DIFF[difficulty],level=Number(q.resume?.meta?.level)||1;
      if(!card){
        card=document.createElement('button');
        card.id=cardId;
        card.type='button';
        card.className='home-resume-card';
      }
      card.dataset.diff=difficulty;
      card.innerHTML=`<span class="home-resume-icon">${difficultyIconMarkup(difficulty,'home-resume-difficulty-icon')}</span><span class="home-resume-copy"><strong>Rozehráno: ${htmlEsc(d.label)} · úroveň ${level}</strong></span><b>Pokračovat <i>→</i></b>`;
      card.onclick=()=>startFree(difficulty);
      if(screenId==='screen-daily'){if(card.parentElement!==screen)screen.append(card)}
      else if(anchor.previousElementSibling!==card)screen.insertBefore(card,anchor);
    }
  }

  function ensureCompetitionCard(){
    const screen=document.querySelector('#screen-daily');if(!screen)return null;
    let card=screen.querySelector('#homeCompetitionCard');
    if(!card){
      card=document.createElement('section');card.id='homeCompetitionCard';card.className='studio-progress-strip';
      card.innerHTML='<div id="homeCompetitionSelf"></div><button type="button" class="text-btn" id="homeProgressBtn">Můj postup →</button>';
      card.querySelector('#homeProgressBtn').onclick=()=>nav('profile');screen.append(card);
    }
    return card;
  }

  function renderCompetitionSelf(){
    ensureCompetitionCard();const root=document.querySelector('#homeCompetitionSelf');if(!root)return;
    const stats=effectiveStats(),points=stats.points||0,streak=stats.currentStreak||0,l=levelFor(points);
    const days=streak===1?'den':streak>=2&&streak<=4?'dny':'dní';
    const remaining=l.next?Math.max(0,l.next.xp-points):0;
    const next=l.next?`<span class="studio-progress-next">Do hodnosti ${htmlEsc(l.next.name)} zbývá ${remaining.toLocaleString('cs-CZ')} XP</span>`:'';
    root.innerHTML=`<img src="/rewards/printshop/symbol-streak.svg" alt="" width="38" height="42"><div><strong>${streak} ${days} v řadě</strong><span>${htmlEsc(l.current.name)} · ${points.toLocaleString('cs-CZ')} XP</span>${next}</div>`;
  }

  function orderDailyNodes(){
    const screen=document.querySelector('#screen-daily');if(!screen)return;
    screen.classList.add('home-layout-active');
    const complete=screen.querySelector('.daily-hero')?.dataset.studioState==='complete';
    const destinations=complete?['#axHomeFree','#axHomeCompetitions','#studioExtraCard','#tajenkaPreviewCard']:['#studioExtraCard','#tajenkaPreviewCard','#axHomeFree','#axHomeCompetitions'];
    const nodes=['#studioTodayHeading','#studioDailyResult','.daily-hero','#axArchiveResume','#homeResumeCard','#referralHome','#rescueCard','#mozkokalypsaInvite',...destinations,'#studioArchiveShortcut','#homeCompetitionCard','#levelCard']
      .map(selector=>screen.querySelector(':scope > '+selector)).filter(Boolean);
    let previous=null;
    for(const node of nodes){
      if(previous){if(previous.nextElementSibling!==node)previous.after(node)}
      else if(screen.firstElementChild!==node)screen.prepend(node);
      previous=node;
    }
  }

  function applyLayout(){
    tuneBrand();
    compactDailyHero();
    tuneDailyState();
    renderResumeCard();
    ensureCompetitionCard();
    renderCompetitionSelf();
    if(window.PropletArchiveExperience?.isEnabled?.())window.PropletArchiveExperience.home();
    if(typeof renderDailySpecialUI==='function')renderDailySpecialUI();
    orderDailyNodes();
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

  window.PropletHomeLayout={applyDailyLayout:applyLayout,renderResumeCard,orderDailyNodes,install};

  let tries=0;
  const boot=()=>{
    if(install())return;
    if(++tries<120)setTimeout(boot,100);
  };
  if(document.readyState==='complete')boot();
  else window.addEventListener('load',boot,{once:true});
})();

