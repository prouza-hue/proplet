(()=>{
'use strict';
if(window.__PROPLET_QUALITY_V334__)return;
window.__PROPLET_QUALITY_V334__=true;
document.documentElement.classList.add('quality-v334');

const CALM_KEY='proplet-calm-mode-v1';
const GEN4_MODAL_KEY='proplet-gen4-release-modal-v1';
const GEN4_XP_MODAL_KEY='proplet-gen4-xp-reward-modal-v1';
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const safeProfile=()=>{try{return typeof getProfile==='function'?getProfile():JSON.parse(localStorage.getItem('proplet-v2-profile')||'null')}catch{return null}};
const calmPreference=()=>{try{return localStorage.getItem(CALM_KEY)==='1'}catch{return false}};
let pendingCalmLaunch=false;
let polishQueued=false;
let calmConfirmKind=null;

function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function setAttr(el,name,value){if(el&&el.getAttribute(name)!==String(value))el.setAttribute(name,String(value))}
function setDisplay(el,value){if(el&&el.style.display!==value)el.style.display=value}

function compactHeading(card,title){
  const head=card?.querySelector('.section-head');if(!head)return;
  head.classList.add('quality-single-head');
  head.querySelector('.eyebrow')?.remove();
  setText(head.querySelector('h2'),title);
}
function ensureRankingInfoButton(wrap){
  if(!wrap||q('#dailyRankingInfoBtn',wrap))return;
  const btn=document.createElement('button');
  btn.id='dailyRankingInfoBtn';btn.className='quality-info-button';btn.type='button';btn.textContent='i';
  btn.setAttribute('aria-label','Jak se řadí Dnešní výzva');btn.setAttribute('aria-expanded','false');
  btn.onclick=e=>{e.stopPropagation();toggleInfoPopover(btn)};
  wrap.appendChild(btn);
}
function closeInfoPopover(){q('#qualityInfoPopover')?.remove();setAttr(q('#dailyRankingInfoBtn'),'aria-expanded','false')}
function toggleInfoPopover(btn){
  if(q('#qualityInfoPopover')){closeInfoPopover();return}
  const pop=document.createElement('div');pop.id='qualityInfoPopover';pop.className='quality-info-popover';pop.setAttribute('role','tooltip');
  pop.innerHTML='<strong>Jak se řadí Dnešní výzva</strong>Čisté řešení → méně nápověd → čas → tahy.';
  document.body.appendChild(pop);
  const r=btn.getBoundingClientRect(),left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(12,r.left));
  pop.style.left=`${left+window.scrollX}px`;pop.style.top=`${r.bottom+8+window.scrollY}px`;setAttr(btn,'aria-expanded','true');
  setTimeout(()=>document.addEventListener('click',closeInfoPopover,{once:true}),0);
}
function polishHierarchy(){
  q('#screen-free>.screen-title')?.remove();
  q('#screen-leaderboard>.screen-title')?.remove();
  q('#rankingPrivacyNote')?.classList.add('hidden');
  const xp=q('#xpLeaderboardList')?.closest('.ranking-section');
  if(xp){const wrap=xp.querySelector('.ranking-section-head>div');wrap?.querySelector('.eyebrow')?.remove();wrap?.querySelector('p.muted')?.remove();setText(q('#xpRankingTitle',xp)||wrap?.querySelector('h2'),'🏆 Nasbírané XP')}
  const daily=q('#dailyLeaderboardList')?.closest('.ranking-section');
  if(daily){const wrap=daily.querySelector('.ranking-section-head>div');if(wrap){wrap.classList.add('quality-ranking-head');wrap.querySelector('.eyebrow')?.remove();wrap.querySelector('p.muted')?.remove();setText(q('#dailyRankingTitle',daily)||wrap.querySelector('h2'),'☀️ Dnešní výzva');ensureRankingInfoButton(wrap)}}
  compactHeading(q('#levelRoadmap')?.closest('.card'),'Dosažená hodnost');
  compactHeading(q('#achievementSummary')?.closest('.card'),'Propletené úspěchy');
  compactHeading(q('#profileBadges')?.closest('.card'),'Odznaky za věrnost');
  q('#screen-profile .appearance-card .section-head .eyebrow')?.remove();
  qa('#screen-profile .eyebrow').forEach(el=>{if(el.textContent.trim().toUpperCase()==='TÝM'&&el.parentElement?.textContent.includes('Tým a společné pořadí'))el.remove()});
}

function privacyState(){const p=safeProfile();if(p?.publicRankings===true)return {icon:'👀',label:'Veřejně'};return {icon:'🎭',label:'Anonymní'}}
function ensurePrivacyMini(){
  const header=q('.app-header'),profile=q('#profileChip');if(!header||!profile)return;
  let group=q('.quality-header-actions',header);
  if(!group){group=document.createElement('div');group.className='quality-header-actions';profile.before(group);group.appendChild(profile)}
  let btn=q('#rankingPrivacyMini',group);
  if(!btn){btn=document.createElement('button');btn.id='rankingPrivacyMini';btn.className='ranking-privacy-mini';btn.type='button';btn.onclick=()=>{const p=safeProfile();if(!p?.token){if(typeof openProfileModal==='function')openProfileModal('create');return}if(typeof openRankingPrivacyModal==='function')openRankingPrivacyModal()};group.insertBefore(btn,profile)}
  let icon=q('.ranking-privacy-mini-icon',btn),label=q('.ranking-privacy-mini-label',btn);
  if(!icon||!label){btn.replaceChildren();icon=document.createElement('span');icon.className='ranking-privacy-mini-icon';label=document.createElement('span');label.className='ranking-privacy-mini-label';btn.append(icon,label)}
  const state=privacyState();setText(icon,state.icon);setText(label,state.label);btn.title='Viditelnost v pořadí';setAttr(btn,'aria-label',`Pořadí: ${state.label}`);setDisplay(btn,calmPreference()?'none':'');
}

function calmControlMarkup(id){
  return `<div class="calm-quick" id="${id}"><strong>🫧 Klidný režim <span>– bez časomíry a žebříčku.</span></strong><button type="button" class="calm-quick-toggle" role="switch" aria-label="Klidný režim" aria-checked="false"></button></div>`;
}
function bindCalmSwitch(root){const b=root?.querySelector('.calm-quick-toggle');if(!b||b.dataset.bound==='1')return;b.dataset.bound='1';b.onclick=toggleCalmPreference}
function ensureQuickCalmControls(){
  const grid=q('#difficultyCards');if(grid&&!q('#freeCalmQuick')){grid.insertAdjacentHTML('beforebegin',calmControlMarkup('freeCalmQuick'));bindCalmSwitch(q('#freeCalmQuick'))}
  q('#dailyCalmQuick')?.remove();
}
function ensureCalmSettings(){
  if(q('#calmModeCard'))return;
  const sound=q('#soundToggle')?.closest('.settings-card');if(!sound)return;
  const card=document.createElement('div');card.id='calmModeCard';card.className='card settings-card calm-settings-card';
  card.innerHTML='<div class="quality-setting-line"><span class="calm-settings-icon">🫧</span><div class="calm-settings-copy"><strong>Klidný režim</strong><small>Hraj bez časomíry a žebříčku. XP i postup zůstávají.</small></div><button id="calmModeToggle" class="calm-setting-toggle" type="button" role="switch" aria-label="Klidný režim" aria-checked="false"></button></div>';
  sound.before(card);q('#calmModeToggle',card).onclick=toggleCalmPreference;
}
function ensureCalmRunButton(){
  const actions=q('.game-actions');if(!actions||q('#calmRunBtn',actions))return;
  const btn=document.createElement('button');btn.id='calmRunBtn';btn.type='button';btn.className='secondary-btn';btn.textContent='🫧 Klidný režim';btn.onclick=()=>openCalmConfirmation('run');actions.appendChild(btn);
}
function ensureCalmConfirmation(){
  if(q('#calmConfirmModal'))return;
  const modal=document.createElement('div');modal.id='calmConfirmModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','calmConfirmTitle');
  modal.innerHTML='<div class="modal-card calm-confirm-card"><div class="calm-confirm-icon" aria-hidden="true">🫧</div><h2 id="calmConfirmTitle">Zapnout Klidný režim?</h2><p id="calmConfirmCopy" class="muted">Časomíru schováme a tento pokus se nebude počítat do žebříčku. XP a postup zůstávají.</p><button id="confirmCalmBtn" class="primary-btn big" type="button">Ano, zapnout</button><button id="cancelCalmBtn" class="secondary-btn bigish" type="button">Zůstat soutěžně</button></div>';
  document.body.appendChild(modal);q('#confirmCalmBtn',modal).onclick=confirmCalmMode;q('#cancelCalmBtn',modal).onclick=closeCalmConfirmation;modal.onclick=e=>{if(e.target===modal)closeCalmConfirmation()};
}
function openCalmConfirmation(kind){
  ensureCalmConfirmation();calmConfirmKind=kind;
  setText(q('#calmConfirmCopy'),kind==='run'?'Časomíru schováme a tento pokus se nebude počítat do žebříčku. XP a postup zůstávají.':'Nové hry poběží bez časomíry a nebudou se počítat do žebříčku. XP a postup zůstávají.');
  q('#calmConfirmModal')?.classList.remove('hidden');setTimeout(()=>q('#confirmCalmBtn')?.focus(),0);
}
function closeCalmConfirmation(){q('#calmConfirmModal')?.classList.add('hidden');calmConfirmKind=null}
function confirmCalmMode(){const kind=calmConfirmKind;closeCalmConfirmation();if(kind==='run')enableCalmForCurrentRun();else if(kind==='preference')setCalmPreference(true)}
function toggleCalmPreference(){if(calmPreference())setCalmPreference(false);else openCalmConfirmation('preference')}
function syncCalmControls(){
  const on=calmPreference();document.documentElement.classList.toggle('calm-preference-v334',on);
  ['#freeCalmQuick .calm-quick-toggle','#calmModeToggle'].forEach(sel=>setAttr(q(sel),'aria-checked',on?'true':'false'));
  setDisplay(q('[data-nav="leaderboard"]'),on?'none':'');ensurePrivacyMini();applyCalmRunUi();
}
function setCalmPreference(enabled,{announce=true}={}){
  try{localStorage.setItem(CALM_KEY,enabled?'1':'0')}catch{}
  syncCalmControls();
  if(enabled&&typeof currentScreen!=='undefined'&&currentScreen==='leaderboard'&&typeof nav==='function')nav('daily',{replace:true});
  try{if(typeof trackProductEvent==='function')trackProductEvent(enabled?'calm_preference_enabled':'calm_preference_disabled')}catch{}
  if(announce&&typeof showToast==='function')showToast(enabled?'Klidný režim zapnutý 🫧':'Soutěžní režim je zpátky 🏆');
}
function saveCalmIntoProgress(){try{const g=currentGame;if(!g||!['daily','free'].includes(g.mode))return;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();if(s.inProgress?.[key]){s.inProgress[key].calmMode=!!g.calmMode;saveState(s)}}catch{}}
function enableCalmForCurrentRun(){
  try{if(!currentGame||currentGame.finished||!['daily','free'].includes(currentGame.mode))return;currentGame.calmMode=true;try{if(typeof trackProductEvent==='function')trackProductEvent('calm_run_enabled')}catch{};saveCalmIntoProgress();try{if(typeof sendAttemptCheckpoint==='function')sendAttemptCheckpoint('resume')}catch{};applyCalmRunUi();if(typeof showToast==='function')showToast('Klidný režim zapnutý. Tenhle pokus už není soutěžní 🫧')}catch{}
}
function applyCalmRunUi(){
  let g=null;try{g=currentGame}catch{}
  const eligible=!!g&&['daily','free'].includes(g.mode)&&!g.finished,calm=eligible&&g.calmMode===true;
  document.body.classList.toggle('calm-run-v334',calm);
  const btn=q('#calmRunBtn');if(btn){btn.classList.toggle('hidden',!eligible||calm);btn.disabled=false}
}
function calmForPayload(body,path){
  let calm=pendingCalmLaunch===true;
  try{if(currentGame&&body?.attempt_id&&currentGame.attemptId===body.attempt_id)calm=calm||currentGame.calmMode===true}catch{}
  if(path==='/api/result'){try{const rec=getQueue().find(r=>(body.attempt_id&&r.attemptId===body.attempt_id)||(r.challengeKey===body.challenge_key&&r.puzzleId===body.puzzle_id));if(rec)calm=rec.calmMode===true}catch{}}
  return calm;
}
function installNetworkCalmFlag(){
  if(typeof api!=='function'||api.__calmWrapped)return;
  const base=api,wrapped=async function(path,opts={}){
    if((path==='/api/result'||path==='/api/attempt/start'||path==='/api/attempt/checkpoint'||path==='/api/attempt/finish')&&opts?.body){try{const body=JSON.parse(opts.body);body.calm_mode=calmForPayload(body,path);opts={...opts,body:JSON.stringify(body)}}catch{}}
    return base(path,opts);
  };wrapped.__calmWrapped=true;api=wrapped;
}
function applyCalmWin(g){
  q('#levelLeaderboardBox')?.classList.add('hidden');q('#winClean')?.classList.add('hidden');
  const details=q('#winDetails');if(details&&!q('.calm-win-note',details))details.insertAdjacentHTML('afterbegin','<div class="calm-win-note">🫧 Hráno v klidu · XP a postup se počítají, pořadí ne.</div>');
}
function installGameWrappers(){
  const calmSessionHook={
    id:'quality-calm-session-v40114',
    priority:20,
    beforeStart(event){
      const eligible=event.mode==='daily'||event.mode==='free',calm=eligible&&(event.restored?.calmMode===true||event.options?.calmMode===true||calmPreference());
      event.data.calmMode=calm;event.data.calmEligible=eligible;pendingCalmLaunch=calm;
    },
    afterStart(event){
      try{if(event.game&&event.data.calmEligible)event.game.calmMode=event.data.calmMode}catch{}
      applyCalmRunUi();pendingCalmLaunch=false;
    },
    afterPersist(){saveCalmIntoProgress()},
  };
  if(typeof registerGameSessionHook==='function')registerGameSessionHook(calmSessionHook);
  if(typeof queueResult==='function'&&!queueResult.__calmWrapped){const base=queueResult,wrapped=function(rec){let calm=false;try{calm=!!(currentGame&&currentGame.attemptId===rec?.attemptId&&currentGame.calmMode)}catch{}if(rec)rec.calmMode=calm;const out=base(rec);try{const s=getState(),stored=s.completed?.[rec.challengeKey];if(stored&&stored.attemptId===rec.attemptId){stored.calmMode=calm;saveState(s)}}catch{}return out};wrapped.__calmWrapped=true;queueResult=wrapped}
  if(typeof loadWinLevelLeaderboard==='function'&&!loadWinLevelLeaderboard.__calmWrapped){const base=loadWinLevelLeaderboard,wrapped=async function(puzzle,rec){if(rec?.calmMode===true||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(puzzle,rec)};wrapped.__calmWrapped=true;loadWinLevelLeaderboard=wrapped}
  if(typeof loadWinDailyGlobalLeaderboard==='function'&&!loadWinDailyGlobalLeaderboard.__calmWrapped){const base=loadWinDailyGlobalLeaderboard,wrapped=async function(date,rec){if(calmPreference()||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(date,rec)};wrapped.__calmWrapped=true;loadWinDailyGlobalLeaderboard=wrapped}
  const calmCompletionHook={id:'quality-calm-v40114',priority:20,after(event){const g=event.game;if(g?.calmMode)applyCalmWin(g);applyCalmRunUi()}};const calmCompletionHookInstalled=typeof registerGameCompletionHook==='function'&&registerGameCompletionHook(calmCompletionHook)!==false;if(!calmCompletionHookInstalled&&typeof finishGame==='function'&&!finishGame.__calmWrapped){const base=finishGame,wrapped=async function(...args){let g=null;try{g=currentGame}catch{}const out=await base(...args);if(g?.calmMode)applyCalmWin(g);applyCalmRunUi();return out};wrapped.__calmWrapped=true;finishGame=wrapped}
  if(typeof showDailyResult==='function'&&!showDailyResult.__calmWrapped){const base=showDailyResult,wrapped=function(date,rec,...rest){const out=base(date,rec,...rest);if(rec?.calmMode===true)applyCalmWin(rec);return out};wrapped.__calmWrapped=true;showDailyResult=wrapped}
}

async function enrichPlayedLevels(diff){
  const list=q('#playedLevelsList'),meta=q('#playedLevelsMeta');if(!list)return;
  let data=null;try{const p=safeProfile();if(p?.token&&typeof api==='function')data=await api(`/api/played-levels?difficulty=${encodeURIComponent(diff)}`)}catch{}
  const legacy=data?.legacyLevels||[],transferred=Number(data?.transferred||0);
  if(meta&&data){const actual=Number(data.actual||0),total=Number(data.total||0);setText(meta,actual?`Nový postup ${actual}/${total}`:transferred?'Nový postup začíná od jedničky.':'Zatím tu nic není. Nejdřív něco propleť.')}
  q('.legacy-history-v334',list)?.remove();if(!legacy.length)return;
  const section=document.createElement('section');section.className='legacy-history-v334';
  section.innerHTML=`<h3>Dříve odehrané</h3><p>Tvoje starší výsledky zůstávají v historii. Původní desky už nemusí být znovu hratelné.</p>${legacy.slice().sort((a,b)=>(a.level||0)-(b.level||0)).map(r=>`<div class="legacy-history-row"><span class="level-index">${Number(r.level)||'–'}.</span><span><strong>${r.elapsedMs&&typeof fmtTime==='function'?fmtTime(r.elapsedMs):'Dokončeno'}</strong><small>${r.cleanSolve?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Dokončeno'} · ${Number(r.moves||0)} tahů${r.calmMode?' · 🫧 Klid':''}</small></span><em>archiv</em></div>`).join('')}`;
  list.appendChild(section);
}
function installHistoryWrapper(){if(typeof openPlayedLevels==='function'&&!openPlayedLevels.__qualityWrapped){const base=openPlayedLevels,wrapped=async function(diff){const out=await base(diff);await enrichPlayedLevels(diff);return out};wrapped.__qualityWrapped=true;openPlayedLevels=wrapped}}

function transferredCount(){try{return Object.keys(DIFF).reduce((sum,d)=>sum+localFreeSlotState(d).transferred.size,0)}catch{return 0}}
function releaseModalStorage(){return window.PROPLET_RUNTIME_META?.gen4CandidatePreview?sessionStorage:localStorage}
function shouldShowReleaseModal(){try{const gen=Number(puzzleDB?.freeGeneration||puzzleDB?.contentGeneration||0);return gen>=4&&!releaseModalStorage().getItem(GEN4_MODAL_KEY)}catch{return false}}
function xpModalKey(){return `${GEN4_XP_MODAL_KEY}:${safeProfile()?.id||'anonymous'}`}
function xpRepairAffected(){try{const stats=safeProfile()?.stats||{},boardRepair=Number(stats.gen4RewardRepairXp||0)-Number(stats.gen4ReturnBonusAwardedNow||0);return boardRepair>0||getState()?.gen4XpRepairNotice===true}catch{return false}}
function shouldShowXpModal(){try{return xpRepairAffected()&&!releaseModalStorage().getItem(GEN4_XP_MODAL_KEY)&&!releaseModalStorage().getItem(xpModalKey())}catch{return false}}
function revealApp(){document.documentElement.classList.remove('gen4-preview-booting')}
let activeReleaseModal='release';
function closeReleaseModal(){q('#qualityReleaseModal')?.classList.add('hidden');try{releaseModalStorage().setItem(activeReleaseModal==='xp'?xpModalKey():GEN4_MODAL_KEY,'1')}catch{}revealApp();setTimeout(maybeShowReleaseModal,100)}
function renderReleaseMain(){
  const card=q('#qualityReleaseCard');if(!card)return;activeReleaseModal='release';
  card.innerHTML='<div class="quality-release-art" aria-hidden="true"><span class="quality-release-tile">P</span><span class="quality-release-tile">L</span><span class="quality-release-tile">T</span></div><h2 id="qualityReleaseTitle">Nové úrovně jsou tady!</h2><p class="quality-release-lead">Vyladěná obtížnost pro více zábavy</p><div class="quality-release-points"><div class="quality-release-point"><span>🧩</span><strong>800 nových volných úrovní</strong></div><div class="quality-release-point"><span>🎯</span><strong>Vyladěná obtížnost napříč všemi režimy</strong></div><div class="quality-release-point"><span>🛡️</span><strong>Tvé XP, historie i odznaky zůstávají</strong></div><div class="quality-release-point"><span>🫧</span><strong>Klidný režim, když si chceš oddechnout od žebříčku</strong></div></div><button id="qualityReleasePlay" class="quality-release-primary" type="button">Jdu si zahrát!</button><button id="qualityReleaseArchive" class="quality-release-link" type="button">Jak se změnil archiv a postup</button>';
  q('#qualityReleasePlay').onclick=closeReleaseModal;q('#qualityReleaseArchive').onclick=renderArchiveExplainer;
}
function renderArchiveExplainer(){
  const card=q('#qualityReleaseCard');if(!card)return;
  card.innerHTML='<button id="qualityReleaseBack" class="quality-release-back" type="button">← Zpět</button><h2>Nový postup od jedničky</h2><p class="quality-release-lead">Všechny nové desky na tebe čekají.</p><div class="quality-archive-copy"><div><strong>🧩 Každá obtížnost začíná úrovní 1</strong><p>O žádnou z 800 nových desek tak nepřijdeš a nové žebříčky se znovu zaplní.</p></div><div><strong>🕘 Staré výsledky nezmizely</strong><p>Časy, tahy, XP a další historie zůstávají uložené.</p></div><div><strong>✨ Nové desky dávají nové XP</strong><p>Plnou odměnu získáš i za úroveň, kterou jsi hrál v dřívější verzi.</p></div></div><button id="qualityReleaseDone" class="quality-release-primary" type="button">Rozumím</button>';
  q('#qualityReleaseBack').onclick=renderReleaseMain;q('#qualityReleaseDone').onclick=closeReleaseModal;
}
function renderXpRewardMain(){const card=q('#qualityReleaseCard');if(!card)return;activeReleaseModal='xp';card.innerHTML='<div class="quality-release-art" aria-hidden="true"><span class="quality-release-tile">X</span><span class="quality-release-tile">P</span><span class="quality-release-tile">!</span></div><h2 id="qualityReleaseTitle">Tvoje nové desky už dávají XP!</h2><p class="quality-release-lead">Odehrané odměny jsme ti dopočítali.</p><div class="quality-release-points"><div class="quality-release-point"><span>↩️</span><strong>XP za dříve odehrané Gen4 desky jsou připsané</strong></div><div class="quality-release-point"><span>🎁</span><strong>Přidáváme ti také návratový bonus 500 XP</strong></div><div class="quality-release-point"><span>✨</span><strong>Každá další nová Gen4 deska dá plné XP</strong></div></div><button id="qualityReleasePlay" class="quality-release-primary" type="button">Paráda!</button>';q('#qualityReleasePlay').onclick=closeReleaseModal}
function ensureReleaseModal(){if(q('#qualityReleaseModal'))return;const modal=document.createElement('div');modal.id='qualityReleaseModal';modal.className='quality-modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','qualityReleaseTitle');modal.innerHTML='<div id="qualityReleaseCard" class="quality-release-card"></div>';document.body.appendChild(modal);modal.onclick=e=>{if(e.target===modal)closeReleaseModal()}}
function maybeShowReleaseModal(){
  if(window.PROPLET_SINGLE_RELEASE_CTA_V40132===true){
    q('#qualityReleaseModal')?.classList.add('hidden');
    revealApp();
    return;
  }
  ensureReleaseModal();
  if(!puzzleDB)return;
  const modal=q('#qualityReleaseModal');if(!modal?.classList.contains('hidden'))return;
  if(shouldShowReleaseModal()){renderReleaseMain();modal.classList.remove('hidden')}
  else if(shouldShowXpModal()){renderXpRewardMain();modal.classList.remove('hidden')}
  revealApp();
}

function polish(){polishQueued=false;polishHierarchy();ensurePrivacyMini();ensureQuickCalmControls();ensureCalmSettings();ensureCalmRunButton();syncCalmControls()}
function schedulePolish(delay=0){if(polishQueued&&delay===0)return;polishQueued=true;setTimeout(polish,delay)}
function bootQuality(){
  installNetworkCalmFlag();installGameWrappers();installHistoryWrapper();polish();
  document.addEventListener('proplet:gen4-xp-repair',maybeShowReleaseModal);
  document.addEventListener('proplet:profile-refreshed',maybeShowReleaseModal);
  [120,300,700,1500,3000].forEach(ms=>setTimeout(()=>{polish();maybeShowReleaseModal()},ms));
  setTimeout(revealApp,4200);
  document.addEventListener('click',e=>{if(e.target.closest('[data-nav],#profileChip,#saveProfileBtn,#acceptRankingPrivacyBtn,#hideRankingPrivacyBtn'))schedulePolish(80)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeInfoPopover();if(!q('#qualityReleaseModal')?.classList.contains('hidden'))closeReleaseModal()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootQuality,{once:true});else bootQuality();
})();
