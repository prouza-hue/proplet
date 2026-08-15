(()=>{
  if(window.__propletHomeLayoutInstalled)return;

  const htmlEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shortHomeDate=iso=>{
    const [y,m,d]=iso.split('-').map(Number);
    const text=new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)));
    return text.charAt(0).toUpperCase()+text.slice(1);
  };

  function moveStatusStrip(){
    const screen=document.querySelector('#screen-daily'),hero=screen?.querySelector('.daily-hero'),level=document.querySelector('#levelCard');
    if(!screen||!hero||!level)return;
    screen.classList.add('home-layout-active');
    level.classList.add('home-status-strip');
    if(level.nextElementSibling!==hero)screen.insertBefore(level,hero);
  }

  function compactDailyHero(){
    const hero=document.querySelector('#screen-daily .daily-hero'),main=hero?.querySelector('.hero-main>div'),date=document.querySelector('#dailyDate'),meta=document.querySelector('#dailyMeta');
    if(!hero||!main||!date||!meta)return;
    let line=main.querySelector('.daily-title-meta');
    if(!line){
      line=document.createElement('div');
      line.className='daily-title-meta';
      const title=main.querySelector('h1');
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
        else if(daily.legacy)button.textContent='Zahrát nový dnešní Proplet';
        else if(dailyProgressExists(date,daily))button.textContent='Pokračovat';
        else button.textContent='Hrát dnešní Proplet';
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

  function latestFreeDifficulty(history=freeHistory()){
    const progress=[...history.progress].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    if(progress[0]?.difficulty)return progress[0].difficulty;
    const completed=[...history.completed].sort((a,b)=>(Date.parse(b.completedAt||'')||0)-(Date.parse(a.completedAt||'')||0));
    if(completed[0]?.difficulty)return completed[0].difficulty;
    return 'easy';
  }

  function difficultyTiles(){
    return Object.entries(DIFF).map(([key,info])=>{
      const q=freeProgress(key),pct=Number.isFinite(q.pct)?q.pct:0;
      return `<button class="home-diff-tile" type="button" data-home-free="${key}" data-diff="${key}" aria-label="${htmlEsc(info.label)}, ${q.done} z ${q.total} hotovo"><span class="home-diff-top"><span>${info.icon}</span><strong>${htmlEsc(info.label)}</strong></span><small>${q.done} / ${q.total}</small><i class="home-diff-progress"><b style="width:${pct}%"></b></i></button>`;
    }).join('');
  }

  function renderHomeQuickPlay(){
    const root=document.querySelector('#quickPlayGrid'),card=document.querySelector('#quickPlayCard');
    if(!root||!card||typeof puzzleDB==='undefined'||!puzzleDB)return;
    const head=card.querySelector('.quick-play-head'),title=head?.querySelector('h2'),all=head?.querySelector('#openAllGamesBtn');
    const history=freeHistory();
    card.classList.toggle('home-free-new',!history.hasAny);
    if(title)title.textContent=history.hasAny?'Pokračuj':'Volná hra';
    if(all)all.innerHTML='Všechny <span>→</span>';

    const tiles=difficultyTiles();
    if(!history.hasAny){
      root.innerHTML=`<div class="home-diff-grid">${tiles}</div>`;
    }else{
      const targetDiff=latestFreeDifficulty(history),target=freeProgress(targetDiff),d=DIFF[targetDiff],puzzle=target.resume||target.nextUnsolved||target.list?.[0]||null,level=Number(puzzle?.meta?.level)||1;
      const resumed=!!target.resume,complete=target.total>0&&target.done>=target.total;
      const detail=resumed?`Rozehráno · ${target.done} z ${target.total} hotovo`:complete?`Všech ${target.total} hotovo · trénink`:`Další úroveň · ${target.done} z ${target.total} hotovo`;
      const action=resumed?'Pokračovat':complete?'Znovu':'Hrát';
      root.innerHTML=`<button class="home-continue" type="button" data-home-continue="${targetDiff}" data-diff="${targetDiff}"><span class="home-continue-icon">${d.icon}</span><span class="home-continue-copy"><strong>${htmlEsc(d.label)} ${level}</strong><small>${htmlEsc(detail)}</small></span><span class="home-continue-cta">${action}</span></button><div class="home-alt-label">Jiná obtížnost</div><div class="home-diff-grid">${tiles}</div>`;
      root.querySelector('[data-home-continue]')?.addEventListener('click',()=>startFree(targetDiff));
    }
    root.querySelectorAll('[data-home-free]').forEach(btn=>btn.addEventListener('click',()=>startFree(btn.dataset.homeFree)));
  }

  function install(){
    if(window.__propletHomeLayoutInstalled)return true;
    if(typeof renderDaily!=='function'||typeof renderQuickPlay!=='function'||typeof freeProgress!=='function'||typeof getState!=='function')return false;
    window.__propletHomeLayoutInstalled=true;
    const baseDaily=renderDaily;
    renderQuickPlay=renderHomeQuickPlay;
    renderDaily=function(){
      baseDaily();
      moveStatusStrip();
      compactDailyHero();
      tuneDailyState();
    };
    moveStatusStrip();
    compactDailyHero();
    try{renderDaily()}catch{}
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
