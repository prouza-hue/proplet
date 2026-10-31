/* Weekly team rewards. Server owns every award and the one-time announcement receipt. */
(() => {
  'use strict';
  const assets='/rewards/team-victories/';
  const medal=`${assets}weekly-gold.svg`;
  const badges={'first-print':'first-imprint','golden-crew':'golden-party',masters:'workshop-masters',legend:'proplet-legend'};
  const fallbackMilestones=[{id:'first-print',name:'První otisk',threshold:1},{id:'golden-crew',name:'Zlatá parta',threshold:3},{id:'masters',name:'Mistři dílny',threshold:10},{id:'legend',name:'Legendy Propletu',threshold:25}];
  const $=selector=>document.querySelector(selector);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profile=()=>typeof getProfile==='function'?getProfile():null;
  const identity=p=>p?.id&&p?.token?`${p.id}:${p.token}:${p.familyCode||''}`:'';
  const activeScreen=()=>$('.screen.active')?.id;
  const safeScreen=()=>['screen-daily','screen-free','screen-profile','screen-leaderboard'].includes(activeScreen());
  const safePreview=()=>new URLSearchParams(location.search).has('tutorial')||window.PROPLET_RUNTIME_META?.gen5CandidatePreview||((window.PROPLET_RUNTIME_ENV==='preview'||window.PROPLET_RUNTIME_META?.environment==='preview')&&!(typeof livePlayerPreview==='function'&&livePlayerPreview()===true));
  const number=n=>Math.max(0,Number(n)||0);
  const badge=id=>`${assets}${badges[id]||'proplet-legend'}.webp`;
  const roman=n=>{if(n>3999)return String(n);const values=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let out='';for(const [v,c] of values)while(n>=v){out+=c;n-=v;}return out;};
  const gold=n=>`${n.toLocaleString('cs-CZ')} ${n===1?'zlatá':n>=2&&n<=4?'zlaté':'zlatých'}`;
  const date=value=>{const d=new Date(`${value}T12:00:00Z`);return Number.isFinite(+d)?d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'}):''};
  const week=award=>{const end=new Date(`${award.weekEnd}T12:00:00Z`);end.setUTCDate(end.getUTCDate()-1);return `${date(award.weekStart)} – ${date(end.toISOString().slice(0,10))}`;};
  const pragueDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague'}).format(value||new Date());
  let lastReadDay='',lastReadAt=0;
  let state=null,stateKey='',flight=null,dialog=null,returnFocus=null,counterTimer=null,ready=false,introPending=false,introInFlight=false,openedAward=null;
  const shownAwards=new Set();
  let personal=null,personalKey='',personalFlight=null,personalAt=0,personalError=false;
  function same(key){return !!key&&identity(profile())===key;}
  function close(){clearTimeout(counterTimer);if(dialog?.open)dialog.close();openedAward=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function reset(){close();personal=null;personalKey='';personalFlight=null;personalAt=0;personalError=false;$('#profileTeamVictories')?.remove();state=null;flight=null;lastReadDay='';lastReadAt=0;introPending=false;introInFlight=false;$('#tvIntro')?.remove();$('#tvReminder')?.remove();}
  async function refresh(force=false){
    const p=profile(),key=identity(p);
    if(key!==stateKey){reset();stateKey=key;}
    if(!p?.familyCode||!key||safePreview())return null;
    if(!force&&state)return state;
    if(flight?.key===key){await flight.promise;return force?refresh(true):state;}
    const request={key,promise:null};flight=request;lastReadDay=pragueDay();lastReadAt=Date.now();
    request.promise=api('/api/team-victories',{authProfile:p}).then(data=>{
      if(!same(key))return null;
      state=data;renderReminder();return state;
    }).catch(()=>null).finally(()=>{if(flight===request)flight=null;});
    return request.promise;
  }
  function available(){return state?.enabled===true&&state?.team&&same(stateKey);}
  function blocked(){return !ready||!available()||!safeScreen()||dialog?.open||document.hidden||window.PropletFirstSteps?.quiet()||!!$('.modal:not(.hidden),dialog[open]');}
  function renderReminder(){
    $('#tvReminder')?.remove();
    if(!available()||!state.previousWeekWinner)return;
    const b=document.createElement('button');b.id='tvReminder';b.className='tv-reminder';
    b.innerHTML=`<img src="${medal}" alt=""><span>Vítězové minulého týdne · ${escape(state.team.name)}</span><span aria-hidden="true">›</span>`;
    b.onclick=openCabinet;$('#screen-daily')?.prepend(b);
  }
  function nextMilestone(total){return fallbackMilestones.find(m=>m.threshold>total)||{id:'legend',name:`Legendy Propletu ${roman(Math.floor(total/25)+1)}`,threshold:(Math.floor(total/25)+1)*25};}
  function earnedMilestone(award){const n=number(award.totalGold),previous=number(award.previousGold);return [...fallbackMilestones,...(n>=50?[{id:'legend',name:`Legendy Propletu ${roman(Math.floor(n/25))}`,threshold:Math.floor(n/25)*25}]:[])].filter(m=>m.threshold>previous&&m.threshold<=n).pop();}
  function celebration(award){
    const n=number(award.totalGold),milestone=earnedMilestone(award),goal=nextMilestone(n),remaining=goal.threshold-n;
    return `<section class="tv-celebration"><button class="tv-close" data-tv-close aria-label="Zavřít oslavu">×</button><div class="tv-kicker"><img src="${medal}" alt="">1. místo v týdenních týmových XP</div><h1 id="tvTitle">${escape(award.teamName)}<br><span>Týdenní zlato je vaše!</span></h1><p class="tv-week">${escape(week(award))}${award.sharedFirst?' · Sdílené 1. místo':''}</p><div class="tv-stage"><img class="tv-badge-hero" src="${milestone?badge(milestone.id):medal}" alt="${milestone?escape(milestone.name):'Týdenní týmové zlato'}" width="184" height="184"></div><h2 class="tv-award-name">${milestone?escape(milestone.name):'Další společné zlato'}</h2><p class="tv-subline">${n===1?'První zlato do vaší vitríny.':'Vaše výhra zůstává ve vitríně.'}</p><div class="tv-score"><img src="${medal}" alt=""><span class="tv-number" aria-hidden="true">${n}</span><span class="tv-score-label">${n===1?'zlatá':n>=2&&n<=4?'zlaté':'zlatých'} ve společné vitríně</span><span id="tvCountStatus" class="sr-only" role="status" aria-live="polite"></span></div><div class="tv-goal"><img src="${badge(goal.id)}" alt=""><div class="tv-goal-body"><p>Ještě <strong>${remaining} vítězství</strong> do trofeje<br><strong>${escape(goal.name)}.</strong></p><div class="tv-progress" role="progressbar" aria-label="${escape(goal.name)}" aria-valuemin="0" aria-valuemax="${goal.threshold}" aria-valuenow="${n}"><span style="width:${n/goal.threshold*100}%"></span></div></div></div><div class="tv-actions"><button class="tv-primary" data-tv-action="continue">Jdeme pro další</button><button class="tv-secondary" data-tv-action="cabinet">Vitrína týmu</button></div></section>`;
  }
  function cabinet(){
    const team=state.team,n=number(team.totalGold),milestones=team.milestones?.length?team.milestones:fallbackMilestones;
    const legendLevel=Math.floor(n/25),next=nextMilestone(n);
    return `<section class="tv-cabinet"><button class="tv-close" data-tv-close aria-label="Zavřít vitrínu">×</button><h2 id="tvCabinetTitle">Vitrína týmu</h2><p class="tv-subline">${escape(team.name)}</p><div class="tv-cabinet-total"><img src="${medal}" alt=""><div><strong>${gold(n)}</strong><small>Za vítězství v týdenních týmových XP</small></div></div><ol class="tv-milestones">${milestones.slice(0,4).map(m=>{const achieved=n>=number(m.threshold);return `<li class="tv-milestone"><img src="${badge(m.id)}" class="${achieved?'':'tv-locked'}" alt=""><div><strong>${escape(m.name)}${m.id==='legend'&&legendLevel>1?` ${roman(legendLevel)}`:''}</strong>${achieved?'<small class="tv-earned">Získáno</small>':`<small>${number(m.threshold)} týmových vítězství</small><div class="tv-progress"><span style="width:${Math.min(100,n/number(m.threshold)*100)}%"></span></div>`}</div><span>${achieved?'<span aria-label="Získáno">✓</span>':`${n} / ${number(m.threshold)}<br><span class="tv-lock" aria-label="Zamčeno"></span>`}</span></li>`}).join('')}</ol>${n>=25?`<p class="tv-rules">Další milník: <strong>${escape(next.name)}</strong> · ${n} / ${next.threshold} vítězství. Zlata zůstávají navždy.</p>`:''}${team.competitionEligible===false?'<p class="tv-rules tv-private-note"><strong>Váš tým je zatím soukromý.</strong><br>O zlato soutěží veřejné týmy. Zapojení můžete povolit v nastavení týmu.</p><button class="tv-secondary" data-tv-action="settings">Nastavení týmu</button>':''}<p class="tv-rules"><strong>Každý týden hrajete o jedno zlato.</strong><br>Rozhoduje součet týmových XP od pondělí do neděle, podle českého času. Při shodě získají zlato všechny týmy na prvním místě. Nový týden nuluje skóre, úspěchy zůstávají.</p><p class="tv-rules">Soutěž běží od ${escape(date(state.launchDate))}. Odměny jsou automatické, bez bonusových XP a bez povinné série.</p><button class="tv-primary" data-tv-action="competition" style="width:100%">Na týdenní soutěž</button>${state.history?.length?`<details class="tv-history"><summary>Vyhrané týdny (${state.history.length})</summary><ol>${state.history.map(a=>`<li><strong>${escape(week(a))}</strong><span>${number(a.xp).toLocaleString('cs-CZ')} XP${a.sharedFirst?' · Sdílené 1. místo':''}</span></li>`).join('')}</ol></details>`:''}</section>`;
  }
  function show(kind,award){
    if(kind==='personal'?!personalAvailable():!available())return;
    clearTimeout(counterTimer);if(!dialog.open)returnFocus=document.activeElement;else dialog.close();
    dialog.innerHTML=kind==='personal'?personalCabinet():kind==='cabinet'?cabinet():celebration(award);
    dialog.setAttribute('aria-labelledby',kind==='personal'?'tvPersonalTitle':kind==='cabinet'?'tvCabinetTitle':'tvTitle');
    dialog.querySelector('[data-tv-close]').onclick=close;
    dialog.querySelectorAll('[data-tv-action]').forEach(b=>b.onclick=()=>{if(b.dataset.tvAction==='cabinet')openCabinet();else if(b.dataset.tvAction==='competition')openCompetition();else if(b.dataset.tvAction==='settings'){close();if(typeof openFamilyLeagueModal==='function')openFamilyLeagueModal();}else close();});
    dialog.showModal();dialog.querySelector('[data-tv-close]').focus({preventScroll:true});
    if(kind!=='celebration')return;
    openedAward=award.id;
    const n=number(award.totalGold),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,counter=dialog.querySelector('.tv-number');
    dialog.querySelector('.tv-celebration').classList.toggle('tv-animating',!reduced);
    counter.textContent=String(reduced?n:number(award.previousGold));
    const finish=()=>{counter.textContent=String(n);counter.classList.add('tv-count-in');const status=dialog.querySelector('#tvCountStatus');if(status)status.textContent=`${gold(n)} ve společné vitríně.`;};
    if(reduced)finish();else counterTimer=setTimeout(finish,850);
  }
  function maybeCelebrate(){
    if(blocked())return;
    const award=state.pendingAward;
    if(!award?.id||shownAwards.has(`${stateKey}:${award.id}`))return;
    shownAwards.add(`${stateKey}:${award.id}`);show('celebration',award);
    const p=profile();api('/api/team-victories/seen',{method:'POST',body:JSON.stringify({kind:'award',awardId:award.id}),authProfile:p}).catch(()=>{});
  }
  async function openCabinet(){
    if(window.PropletWeeklyCompetition){close();return window.PropletWeeklyCompetition.open("cabinet");}
    const data=await refresh(true);
    if(!data?.enabled||!data.team){if(typeof showToast==='function')showToast('Vitrína se teď nepodařila načíst. Zkus to prosím za chvíli.');return;}
    show('cabinet');
  }
  function openCompetition(){
    close();$('#tvIntro')?.remove();$('#winModal')?.classList.add('hidden');
    if(window.PropletWeeklyCompetition)return window.PropletWeeklyCompetition.open();
    if(typeof rankingsOrchestration==='function')rankingsOrchestration().openWeeklyTeams({render:false});
    if(typeof nav==='function')nav('leaderboard');
    requestAnimationFrame(()=>$('#xpLeaderboardList')?.closest('.card')?.scrollIntoView({block:'start',behavior:'instant'}));
  }
  function introHost(){
    if(window.PropletFirstSteps?.quiet()||document.hidden)return null;
    const result=$('#winModal');
    if(result&&!result.classList.contains('hidden')&&typeof currentGame!=='undefined'&&currentGame?.finished&&['free','daily','tajenka'].includes(currentGame.mode))return $('#winPrimaryBtn');
    if(activeScreen()==='screen-daily'&&!$('.modal:not(.hidden),dialog[open]'))return $('#screen-daily .daily-hero');
    return null;
  }
  function makeIntro(host){
    if($('#tvIntro'))return;
    const card=document.createElement('aside');card.id='tvIntro';card.className='tv-intro';card.setAttribute('aria-labelledby','tvIntroTitle');
    card.innerHTML=`<button class="tv-intro-close" aria-label="Skrýt novinku o týmové soutěži">×</button><div class="tv-intro-heading"><img class="tv-intro-art" src="${badge('first-print')}" alt="" width="72" height="72"><h3 id="tvIntroTitle">Týmy hrají<br>o zlato.</h3></div><p>Vaše XP už pomáhají týmu. Vyhrajte týden a první zlato ve vitríně je vaše.</p><div class="tv-intro-footer"><span>Po–Ne · každý bod pomáhá</span><button class="primary-btn big">Mrknout na soutěž</button></div>`;
    card.querySelector('.tv-intro-close').onclick=()=>card.remove();card.querySelector('.tv-intro-footer button').onclick=openCompetition;
    host.insertAdjacentElement('afterend',card);
  }
  async function maybeIntro(){
    if(!introPending||introInFlight||!available()||state.intro?.seen||!state.intro?.eligible)return;
    const host=introHost();if(!host)return;
    const key=stateKey,p=profile();introInFlight=true;
    try{
      const response=await api('/api/team-victories/seen',{method:'POST',body:JSON.stringify({kind:'intro'}),authProfile:p});
      if(!same(key))return;
      introPending=false;state.intro.seen=true;
      // Another device may already have shown it. A late response never interrupts a new game.
      const target=introHost();if(response.firstSeen===true&&target)makeIntro(target);
    }catch{}finally{if(same(key))introInFlight=false;}
  }
  function resultConfirmed(record,receipt,account){
    if(!ready||!account?.familyCode||identity(account)!==identity(profile())||number(receipt?.awardedPoints)<=0||!['daily','free','tajenka'].includes(record?.mode))return;
    const game=typeof currentGame!=='undefined'?currentGame:null;
    if(!game?.finished||game.calmMode||record.calmMode||game.puzzle?.id!==record.puzzleId||(record.attemptId&&game.attemptId!==record.attemptId))return;
    const completed=new Date(record.completedAt||'');if(!Number.isFinite(+completed))return;
    const today=pragueDay();
    const day=pragueDay(completed);if(day!==today)return;
    const key=identity(account);refresh(true).then(data=>{if(!same(key)||!data?.intro?.eligible||data.intro.seen)return;introPending=true;maybeIntro();});
  }
  function personalAvailable(){return personal?.enabled===true&&same(personalKey);}
  const wins=n=>`${number(n).toLocaleString('cs-CZ')} vítězství`;
  function personalCabinet(){
    const n=number(personal.totalGold),history=personal.history||[];
    return `<section class="tv-cabinet tv-personal-cabinet"><button class="tv-close" data-tv-close aria-label="Zavřít týmové výhry">×</button><h2 id="tvPersonalTitle">Moje týmové výhry</h2><div class="tv-cabinet-total"><img src="${medal}" alt=""><div><strong>${wins(n)}</strong><small>V týmu, se kterým jsi vyhrál.</small></div></div><p class="tv-rules">Tady máš všechna svá týmová zlata. Zůstanou ti i po změně týmu.</p>${n?`<div class="tv-personal-trophies">${fallbackMilestones.filter(m=>n>=m.threshold).map(m=>`<div><img src="${badge(m.id)}" alt="" width="88" height="88"><strong>${escape(m.name)}${m.id==='legend'&&n>=50?' '+roman(Math.floor(n/25)):''}</strong><span>Za ${m.threshold} vítězství</span></div>`).join('')}</div><ol class="tv-personal-history">${history.map(a=>`<li><img src="${medal}" alt="1. místo" width="40" height="40"><div><strong>${escape(a.teamName)}</strong><span>${escape(week(a))}</span><span>${number(a.xp).toLocaleString('cs-CZ')} týmových XP${a.sharedFirst?' · Sdílené 1. místo':''}</span></div></li>`).join('')}</ol>${n>history.length?'<p class="tv-rules">Zobrazuje se posledních 100 výher. Celkový počet zahrnuje všechny.</p>':''}`:'<p class="tv-rules">Až s týmem vyhrajete týdenní soutěž, první zlato přibude sem.</p>'}<button class="tv-primary" data-tv-action="competition" style="width:100%">Na týdenní soutěž</button></section>`;
  }
  function paintPersonal(){
    const host=$('#profileTeamVictories');if(!host)return;
    if(safePreview()||!identity(profile())){host.hidden=true;return;}
    host.hidden=false;
    if(!personalAvailable()){
      if(personal?.enabled===false){host.hidden=true;return;}
      host.innerHTML=`<h3>Týmové výhry</h3><p role="status">${personalError?'Výhry se teď nepodařilo načíst.':'Načítám týmové výhry…'}</p>${personalError?'<button type="button" class="secondary-btn" data-tv-personal-retry>Zkusit znovu</button>':''}`;
      host.querySelector('[data-tv-personal-retry]')?.addEventListener('click',()=>loadPersonal(true));return;
    }
    const n=number(personal.totalGold),last=personal.history?.[0],earned=fallbackMilestones.filter(m=>n>=m.threshold).pop(),goal=nextMilestone(n);
    host.innerHTML=`<div class="tv-profile-heading"><h3>Týmové výhry</h3>${n?`<span>${wins(n)}</span>`:''}</div><button type="button" class="tv-profile-award" data-tv-personal aria-haspopup="dialog"><img src="${earned?badge(earned.id):medal}" alt="" width="88" height="88"><span><strong>${earned?escape(earned.name)+(earned.id==='legend'&&n>=50?' '+roman(Math.floor(n/25)):''):'První zlato čeká'}</strong><span>${last?escape(last.teamName)+' · '+escape(week(last)):'Vyhrajte s týmem týdenní soutěž.'}</span><span class="tv-profile-link">${n?'Moje výhry a trofeje':'Jak se hraje o zlato'} <span aria-hidden="true">→</span></span></span></button>${n?`<p class="tv-profile-next">${goal.threshold-n===1?'Ještě jedno vítězství':'Ještě '+(goal.threshold-n)+' vítězství'} do trofeje ${escape(goal.name)}.</p>`:''}`;
    host.querySelector('[data-tv-personal]').onclick=()=>n?show('personal'):openCompetition();
  }
  async function loadPersonal(force=false){
    const p=profile(),key=identity(p);
    if(personalKey!==key){personal=null;personalAt=0;personalError=false;personalKey=key;}
    if(!key||safePreview()){paintPersonal();return;}
    if(personalFlight?.key===key)return personalFlight.promise;
    if(!force&&((personal&&Date.now()-personalAt<300000)||(personalError&&Date.now()-personalAt<30000))){paintPersonal();return;}
    personalError=false;personalAt=Date.now();paintPersonal();const request={key,promise:null};personalFlight=request;
    request.promise=api('/api/team-victories/personal',{authProfile:p}).then(data=>{
      if(!same(key)||personalKey!==key||personalFlight!==request)return;
      if(typeof data?.enabled!=='boolean'||(data.enabled&&(!Array.isArray(data.history)||!Number.isInteger(data.totalGold))))throw Error('Invalid victory history');
      personal=data;personalAt=Date.now();paintPersonal();
    }).catch(()=>{if(same(key)&&personalKey===key&&personalFlight===request){personal=null;personalError=true;paintPersonal();}}).finally(()=>{if(personalFlight===request)personalFlight=null;});
    return request.promise;
  }
  function renderProfile(p){
    let host=$('#profileTeamVictories');
    if(!identity(p)||safePreview()){host?.remove();return;}
    if(!host){const anchor=$('#profileCard .profile-grid');if(!anchor)return;host=document.createElement('section');host.id='profileTeamVictories';host.className='tv-profile';anchor.after(host);}
    if(personalKey!==identity(p)){personal=null;personalAt=0;personalError=false;personalKey=identity(p);}
    paintPersonal();if(ready&&activeScreen()==='screen-profile')loadPersonal();
  }
  function check(){
    if(identity(profile())!==stateKey){refresh().then(()=>{maybeCelebrate();maybeIntro();});return;}
    if(!document.hidden&&safeScreen()&&lastReadDay&&lastReadDay!==pragueDay()){refresh(true).then(()=>{maybeCelebrate();maybeIntro();});return;}
    // Discovery follows a result; an earned victory waits for any safe return screen.
    maybeIntro();maybeCelebrate();
  }
  function visit(){
    if(activeScreen()==='screen-profile')renderProfile(profile());
    if(!document.hidden&&safeScreen()&&!$('.modal:not(.hidden),dialog[open]')&&lastReadAt&&Date.now()-lastReadAt>=300000){refresh(true).then(check);return;}
    check();
  }
  function setup(){
    if(ready)return;ready=true;
    dialog=document.createElement('dialog');dialog.id='tvRewardDialog';dialog.className='tv-dialog';document.body.append(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close();});
    const observer=new MutationObserver(()=>{const intro=$('#tvIntro');if(intro?.closest('#winModal')&&$('#winModal')?.classList.contains('hidden'))intro.remove();queueMicrotask(check);});
    document.querySelectorAll('.modal').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
    document.addEventListener('proplet:screen-changed',()=>{if(activeScreen()==='screen-game'&&!$('#winModal')?.classList.contains('hidden'))return;if(activeScreen()==='screen-game')$('#tvIntro')?.remove();visit();});
    document.addEventListener('proplet:account-changed',()=>{refresh().then(()=>{renderProfile(profile());check();});});
    document.addEventListener('proplet:profile-refreshed',()=>{renderProfile(profile());check();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)visit();});
    window.addEventListener('storage',()=>{if(identity(profile())!==stateKey)check();});
    document.addEventListener('close',()=>queueMicrotask(check),true);
    refresh().then(()=>{renderProfile(profile());setTimeout(check,1100);});
  }
  window.PropletTeamVictories={resultConfirmed,openCabinet,openCompetition,renderProfile};
  document.addEventListener('proplet:ready',setup,{once:true});
})();


