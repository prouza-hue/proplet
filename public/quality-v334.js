(()=>{
'use strict';
if(window.__PROPLET_QUALITY_V334__)return;
window.__PROPLET_QUALITY_V334__=true;
document.documentElement.classList.add('quality-v334');

const CALM_KEY='proplet-calm-mode-v1';
const GEN4_MODAL_KEY='proplet-gen4-release-modal-v1';
const q=(s,r=document)=>r.querySelector(s);
const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const safeProfile=()=>{try{return typeof getProfile==='function'?getProfile():JSON.parse(localStorage.getItem('proplet-v2-profile')||'null')}catch{return null}};
const calmPreference=()=>{try{return localStorage.getItem(CALM_KEY)==='1'}catch{return false}};
let pendingCalmLaunch=false;
let applyingDom=false;

function setCalmPreference(enabled,{announce=true}={}){
  try{localStorage.setItem(CALM_KEY,enabled?'1':'0')}catch{}
  document.documentElement.classList.toggle('calm-preference-v334',enabled);
  syncCalmControls();
  if(enabled&&typeof currentScreen!=='undefined'&&currentScreen==='leaderboard'&&typeof nav==='function')nav('daily',{replace:true});
  if(announce&&typeof showToast==='function')showToast(enabled?'Klidný režim zapnutý 🫧':'Soutěžní režim je zpátky 🏆');
}

function compactHeading(card,title){
  const head=card?.querySelector('.section-head');if(!head)return;
  head.classList.add('quality-single-head');
  const eyebrow=head.querySelector('.eyebrow');if(eyebrow)eyebrow.remove();
  const h2=head.querySelector('h2');if(h2)h2.textContent=title;
}

function polishStaticHierarchy(){
  q('#screen-free>.screen-title')?.remove();
  q('#screen-leaderboard>.screen-title')?.remove();
  q('#rankingPrivacyNote')?.classList.add('hidden');

  const xp=q('#xpLeaderboardList')?.closest('.ranking-section');
  if(xp){
    const wrap=xp.querySelector('.ranking-section-head>div');
    wrap?.querySelector('.eyebrow')?.remove();wrap?.querySelector('p.muted')?.remove();
    const h=wrap?.querySelector('h2');if(h)h.textContent='🏆 Nasbírané XP';
  }
  const daily=q('#dailyLeaderboardList')?.closest('.ranking-section');
  if(daily){
    const wrap=daily.querySelector('.ranking-section-head>div');
    if(wrap){wrap.classList.add('quality-ranking-head');wrap.querySelector('.eyebrow')?.remove();wrap.querySelector('p.muted')?.remove();const h=wrap.querySelector('h2');if(h)h.textContent='☀️ Dnešní výzva';ensureRankingInfoButton(wrap)}
  }

  compactHeading(q('#levelRoadmap')?.closest('.card'),'Dosažená hodnost');
  compactHeading(q('#achievementSummary')?.closest('.card'),'Propletené úspěchy');
  compactHeading(q('#profileBadges')?.closest('.card'),'Odznaky za věrnost');
  qa('#screen-profile .eyebrow').forEach(el=>{if(el.textContent.trim().toUpperCase()==='TÝM'&&el.parentElement?.textContent.includes('Tým a společné pořadí'))el.remove()});
}

function ensureRankingInfoButton(wrap){
  if(q('#dailyRankingInfoBtn',wrap))return;
  const btn=document.createElement('button');btn.id='dailyRankingInfoBtn';btn.className='quality-info-button';btn.type='button';btn.setAttribute('aria-label','Jak se řadí Dnešní výzva');btn.setAttribute('aria-expanded','false');btn.textContent='i';
  btn.onclick=e=>{e.stopPropagation();toggleInfoPopover(btn,'Jak se řadí Dnešní výzva','Čisté řešení → méně nápověd → čas → tahy.')};wrap.appendChild(btn);
}
function closeInfoPopover(){q('#qualityInfoPopover')?.remove();q('#dailyRankingInfoBtn')?.setAttribute('aria-expanded','false')}
function toggleInfoPopover(btn,title,copy){
  if(q('#qualityInfoPopover')){closeInfoPopover();return}
  const pop=document.createElement('div');pop.id='qualityInfoPopover';pop.className='quality-info-popover';pop.setAttribute('role','tooltip');pop.innerHTML=`<strong>${title}</strong>${copy}`;document.body.appendChild(pop);const r=btn.getBoundingClientRect();const left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(12,r.left));pop.style.left=`${left+window.scrollX}px`;pop.style.top=`${r.bottom+8+window.scrollY}px`;btn.setAttribute('aria-expanded','true');setTimeout(()=>document.addEventListener('click',closeInfoPopover,{once:true}),0)
}

function privacyLabel(){const p=safeProfile();if(!p?.token)return '🎭 Soukromě';if(p.publicRankings===true)return '👀 Veřejně';return '🎭 Anonymně'}
function ensurePrivacyMini(){
  const header=q('.app-header'),profile=q('#profileChip');if(!header||!profile)return;
  let group=q('.quality-header-actions',header);if(!group){group=document.createElement('div');group.className='quality-header-actions';profile.before(group);group.appendChild(profile)}
  let btn=q('#rankingPrivacyMini',group);if(!btn){btn=document.createElement('button');btn.id='rankingPrivacyMini';btn.className='ranking-privacy-mini';btn.type='button';btn.onclick=()=>{const p=safeProfile();if(!p?.token){if(typeof openProfileModal==='function')openProfileModal('create');return}if(typeof openRankingPrivacyModal==='function')openRankingPrivacyModal()};group.insertBefore(btn,profile)}
  btn.textContent=privacyLabel();btn.title='Viditelnost v pořadí';btn.setAttribute('aria-label',`Pořadí: ${btn.textContent}`);btn.style.display=calmPreference()?'none':'';
}

function calmControlMarkup(id,context){
  const copy=context==='daily'?'Hraj dnešek bez závodu.':context==='free'?'Bez časomíry a pořadí.':'Hraj bez časomíry a pořadí. XP i postup zůstávají.';
  return `<div class="calm-quick" id="${id}"><div><strong>🫧 Klidný režim</strong><small>${copy}</small></div><button type="button" class="calm-quick-toggle" role="switch" aria-label="Klidný režim" aria-checked="false"></button></div>`;
}
function bindCalmSwitch(root){const b=root?.querySelector('.calm-quick-toggle');if(!b||b.dataset.bound==='1')return;b.dataset.bound='1';b.onclick=()=>setCalmPreference(!calmPreference())}
function ensureQuickCalmControls(){
  const grid=q('#difficultyCards');if(grid&&!q('#freeCalmQuick')){grid.insertAdjacentHTML('beforebegin',calmControlMarkup('freeCalmQuick','free'));bindCalmSwitch(q('#freeCalmQuick'))}
  const hero=q('.daily-hero');const anchor=q('#dailySyncStatus');if(hero&&!q('#dailyCalmQuick')){const html=calmControlMarkup('dailyCalmQuick','daily');if(anchor)anchor.insertAdjacentHTML('beforebegin',html);else hero.insertAdjacentHTML('beforeend',html);bindCalmSwitch(q('#dailyCalmQuick'))}
}
function ensureCalmSettings(){
  if(q('#calmModeCard'))return;
  const sound=q('#soundToggle')?.closest('.settings-card');if(!sound)return;
  const card=document.createElement('div');card.id='calmModeCard';card.className='card settings-card calm-settings-card';card.innerHTML=`<div class="quality-setting-line"><span class="calm-settings-icon">🫧</span><div class="calm-settings-copy"><strong>Klidný režim</strong><small>Hraj bez časomíry a pořadí. XP i postup zůstávají.</small></div><button id="calmModeToggle" class="calm-setting-toggle" type="button" role="switch" aria-label="Klidný režim" aria-checked="false"></button></div>`;sound.before(card);q('#calmModeToggle',card).onclick=()=>setCalmPreference(!calmPreference())
}
function ensureCalmRunButton(){
  const actions=q('.game-actions');if(!actions||q('#calmRunBtn',actions))return;
  const btn=document.createElement('button');btn.id='calmRunBtn';btn.type='button';btn.className='secondary-btn';btn.onclick=()=>enableCalmForCurrentRun();actions.appendChild(btn)
}
function syncCalmControls(){
  const on=calmPreference();document.documentElement.classList.toggle('calm-preference-v334',on);
  ['#freeCalmQuick .calm-quick-toggle','#dailyCalmQuick .calm-quick-toggle','#calmModeToggle'].forEach(sel=>q(sel)?.setAttribute('aria-checked',on?'true':'false'));
  const navButton=q('[data-nav="leaderboard"]');if(navButton)navButton.style.display=on?'none':'';
  ensurePrivacyMini();applyCalmRunUi()
}
function enableCalmForCurrentRun(){
  try{if(!currentGame||currentGame.finished||!['daily','free'].includes(currentGame.mode))return;currentGame.calmMode=true;saveCalmIntoProgress();applyCalmRunUi();if(typeof showToast==='function')showToast('Klidný režim zapnutý. Tenhle pokus už není soutěžní 🫧')}catch{}
}
function applyCalmRunUi(){
  let g=null;try{g=currentGame}catch{}
  const eligible=!!g&&['daily','free'].includes(g.mode)&&!g.finished,calm=eligible&&g.calmMode===true;
  document.body.classList.toggle('calm-run-v334',calm);
  const btn=q('#calmRunBtn');if(btn){btn.classList.toggle('hidden',!eligible);btn.classList.toggle('on',calm);btn.disabled=calm;btn.textContent=calm?'🫧 Klidný režim':'🫧 Přepnout do klidu'}
}
function saveCalmIntoProgress(){
  try{const g=currentGame;if(!g||!['daily','free'].includes(g.mode))return;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();if(s.inProgress?.[key]){s.inProgress[key].calmMode=!!g.calmMode;saveState(s)}}catch{}
}

function calmForPayload(body,path){
  let calm=pendingCalmLaunch===true;
  try{if(currentGame&&body?.attempt_id&&currentGame.attemptId===body.attempt_id)calm=calm||currentGame.calmMode===true}catch{}
  if(path==='/api/result'){
    try{const rec=getQueue().find(r=>(body.attempt_id&&r.attemptId===body.attempt_id)||(r.challengeKey===body.challenge_key&&r.puzzleId===body.puzzle_id));if(rec)calm=rec.calmMode===true}catch{}
  }
  return calm;
}
function installNetworkCalmFlag(){
  if(typeof api!=='function'||api.__calmWrapped)return;
  const base=api;const wrapped=async function(path,opts={}){
    if((path==='/api/result'||path==='/api/attempt/start'||path==='/api/attempt/finish')&&opts?.body){
      try{const body=JSON.parse(opts.body);body.calm_mode=calmForPayload(body,path);opts={...opts,body:JSON.stringify(body)}}catch{}
    }
    return base(path,opts)
  };wrapped.__calmWrapped=true;api=wrapped
}
function installGameWrappers(){
  if(typeof startGame==='function'&&!startGame.__calmWrapped){
    const base=startGame;const wrapped=function(puzzle,mode,dailyDate,options={}){
      let restored=null;try{restored=typeof savedProgressFor==='function'?savedProgressFor(puzzle,mode,dailyDate):null}catch{}
      const eligible=mode==='daily'||mode==='free';const calm=eligible&&(restored?.calmMode===true||options?.calmMode===true||calmPreference());pendingCalmLaunch=calm;
      try{const out=base(puzzle,mode,dailyDate,options);try{if(currentGame&&eligible)currentGame.calmMode=calm}catch{}applyCalmRunUi();return out}finally{pendingCalmLaunch=false}
    };wrapped.__calmWrapped=true;startGame=wrapped
  }
  if(typeof saveGameProgress==='function'&&!saveGameProgress.__calmWrapped){const base=saveGameProgress;const wrapped=function(...args){const out=base(...args);saveCalmIntoProgress();return out};wrapped.__calmWrapped=true;saveGameProgress=wrapped}
  if(typeof queueResult==='function'&&!queueResult.__calmWrapped){
    const base=queueResult;const wrapped=function(rec){
      let calm=false;try{calm=!!(currentGame&&currentGame.attemptId===rec?.attemptId&&currentGame.calmMode)}catch{};if(rec)rec.calmMode=calm;
      const out=base(rec);
      try{
        const s=getState(),stored=s.completed?.[rec.challengeKey];if(stored&&stored.attemptId===rec.attemptId){stored.calmMode=calm;saveState(s)}
        if(rec?.mode==='daily'&&!calm){const list=getQueue(),i=list.findIndex(r=>r.challengeKey===rec.challengeKey&&r.puzzleId===rec.puzzleId);if(i>=0&&list[i]?.calmMode===true){list[i]={...rec,calmMode:false};saveQueue(list)}}
      }catch{}
      return out
    };wrapped.__calmWrapped=true;queueResult=wrapped
  }
  if(typeof loadWinLevelLeaderboard==='function'&&!loadWinLevelLeaderboard.__calmWrapped){const base=loadWinLevelLeaderboard;const wrapped=async function(puzzle,rec){if(rec?.calmMode===true||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(puzzle,rec)};wrapped.__calmWrapped=true;loadWinLevelLeaderboard=wrapped}
  if(typeof loadWinDailyGlobalLeaderboard==='function'&&!loadWinDailyGlobalLeaderboard.__calmWrapped){const base=loadWinDailyGlobalLeaderboard;const wrapped=async function(date,rec){if(rec?.calmMode===true||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(date,rec)};wrapped.__calmWrapped=true;loadWinDailyGlobalLeaderboard=wrapped}
  if(typeof finishGame==='function'&&!finishGame.__calmWrapped){const base=finishGame;const wrapped=async function(...args){let g=null;try{g=currentGame}catch{};const out=await base(...args);if(g?.calmMode)applyCalmWin(g);applyCalmRunUi();return out};wrapped.__calmWrapped=true;finishGame=wrapped}
  if(typeof showDailyResult==='function'&&!showDailyResult.__calmWrapped){const base=showDailyResult;const wrapped=function(date,rec,...rest){const out=base(date,rec,...rest);if(rec?.calmMode===true)applyCalmWin(rec);return out};wrapped.__calmWrapped=true;showDailyResult=wrapped}
  if(typeof openLevelDetail==='function'&&!openLevelDetail.__calmWrapped){const base=openLevelDetail;const wrapped=async function(...args){const out=await base(...args);try{if(levelDetailContext?.result?.calmMode===true){q('#levelDetailLeaderboard')?.classList.add('hidden');const result=q('#levelDetailResult');if(result&&!q('.calm-win-note',result.parentElement))result.insertAdjacentHTML('afterend','<div class="calm-win-note">🫧 Tento pokus byl odehraný v Klidném režimu a není v pořadí.</div>')}}catch{};return out};wrapped.__calmWrapped=true;openLevelDetail=wrapped}
  if(typeof maybeOfferHelper==='function'&&!maybeOfferHelper.__calmWrapped){const base=maybeOfferHelper;const wrapped=function(...args){const out=base(...args);try{if(currentGame?.calmMode&&!q('#helperOfferModal')?.classList.contains('hidden'))q('#helperOfferText').textContent='Chvíli se nic nového nezamklo. Můžu ukázat začátek jednoho slova — bez spěchu.'}catch{};return out};wrapped.__calmWrapped=true;maybeOfferHelper=wrapped}
}
function applyCalmWin(g){
  q('#levelLeaderboardBox')?.classList.add('hidden');
  const text=q('#winText');if(text){const moves=Number(g?.moves??g?.best_moves??0);let suffix='';try{const diff=g?.puzzle?.difficulty||g?.difficulty;if(diff&&typeof DIFF!=='undefined')suffix=` · ${DIFF[diff]?.label||''}`;const level=Number(g?.puzzle?.meta?.level||g?.level)||null;if(level&&g?.mode==='free')suffix+=` ${level}`}catch{};text.textContent=`${typeof countCz==='function'?countCz(moves,'tah','tahy','tahů'):`${moves} tahů`} · Klidný režim${suffix}`}
  q('#winClean')?.classList.add('hidden');
  const details=q('#winDetails');if(details&&!q('.calm-win-note',details))details.insertAdjacentHTML('afterbegin','<div class="calm-win-note">🫧 Hráno v klidu · XP a postup se počítají, pořadí ne.</div>')
}

async function enrichPlayedLevels(diff){
  const list=q('#playedLevelsList'),meta=q('#playedLevelsMeta');if(!list)return;
  let data=null;
  try{const p=safeProfile();if(p?.token&&typeof api==='function')data=await api(`/api/played-levels?difficulty=${encodeURIComponent(diff)}`)}catch{}
  let legacy=data?.legacyLevels||[];
  if(!data){
    try{const activeGeneration=Number(puzzleDB?.freeGeneration)||1,rows=Object.values(getState().completed||{});legacy=rows.map(r=>{if(r?.mode!=='free'||r.difficulty!==diff)return null;const info=(Number(r.level)&&Number(r.contentGeneration))?{level:Number(r.level),generation:Number(r.contentGeneration)}:freePuzzleSlot(r.puzzleId,diff);return info&&Number(info.generation)<activeGeneration?{...r,level:info.level,contentGeneration:info.generation}:null}).filter(Boolean)}catch{}
  }
  const transferred=Number(data?.transferred||0);if(meta&&data)meta.textContent=`Postup ${Number(data.completed||0)}/${Number(data.total||0)}${transferred?` · ${transferred} převedeno`:''}`;
  q('.legacy-history-v334',list)?.remove();if(!legacy.length)return;
  const section=document.createElement('section');section.className='legacy-history-v334';section.innerHTML=`<h3>Dříve odehrané</h3><p>Tvoje starší výsledky zůstávají v historii. Původní desky už nemusí být znovu hratelné.</p>${legacy.slice().sort((a,b)=>(a.level||0)-(b.level||0)).map(r=>`<div class="legacy-history-row"><span class="level-index">${Number(r.level)||'–'}.</span><span><strong>${r.elapsedMs&&typeof fmtTime==='function'?fmtTime(r.elapsedMs):'Dokončeno'}</strong><small>${r.cleanSolve?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Dokončeno'} · ${Number(r.moves||0)} tahů${r.calmMode?' · 🫧 Klid':''}</small></span><em>archiv</em></div>`).join('')}`;list.appendChild(section)
}
function installHistoryWrapper(){if(typeof openPlayedLevels==='function'&&!openPlayedLevels.__qualityWrapped){const base=openPlayedLevels;const wrapped=async function(diff){const out=await base(diff);await enrichPlayedLevels(diff);return out};wrapped.__qualityWrapped=true;openPlayedLevels=wrapped}}

function transferredCount(){try{return Object.keys(DIFF).reduce((sum,d)=>sum+localFreeSlotState(d).transferred.size,0)}catch{return 0}}
function releaseModalStorage(){return window.PROPLET_RUNTIME_META?.gen4CandidatePreview?sessionStorage:localStorage}
function shouldShowReleaseModal(){try{const gen=Number(puzzleDB?.freeGeneration||puzzleDB?.contentGeneration||0);return gen>=4&&!releaseModalStorage().getItem(GEN4_MODAL_KEY)}catch{return false}}
function closeReleaseModal(){q('#qualityReleaseModal')?.classList.add('hidden');try{releaseModalStorage().setItem(GEN4_MODAL_KEY,'1')}catch{}}
function renderReleaseMain(){const card=q('#qualityReleaseCard');if(!card)return;card.innerHTML=`<div class="quality-release-art" aria-hidden="true"><span class="quality-release-tile">P</span><span class="quality-release-tile">L</span><span class="quality-release-tile">T</span></div><h2 id="qualityReleaseTitle">Nové úrovně jsou tady</h2><p class="quality-release-lead"><strong>Víc zábavy, menší frustrace!</strong>Vyladili jsme obtížnost a komplet předělali všechny úrovně.</p><div class="quality-release-points"><div class="quality-release-point"><span>🧩</span><strong>800 nových volných úrovní</strong></div><div class="quality-release-point"><span>🎯</span><strong>Vyladěná obtížnost napříč všemi režimy</strong></div><div class="quality-release-point"><span>🛡️</span><strong>Tvé XP, postup, historie i odznaky zůstávají</strong></div></div><button id="qualityReleasePlay" class="quality-release-primary" type="button">Jdu si zahrát!</button><button id="qualityReleaseArchive" class="quality-release-link" type="button">Jak se změnil archiv a postup</button>`;q('#qualityReleasePlay').onclick=closeReleaseModal;q('#qualityReleaseArchive').onclick=renderArchiveExplainer}
function renderArchiveExplainer(){const card=q('#qualityReleaseCard');if(!card)return;const transferred=transferredCount();card.innerHTML=`<button id="qualityReleaseBack" class="quality-release-back" type="button">← Zpět</button><h2>Tvůj postup zůstává</h2><p class="quality-release-lead">Nové desky neznamenají nový začátek.</p><div class="quality-archive-copy"><div><strong>✓ Splněné úrovně zůstávají splněné</strong><p>${transferred?`${transferred} tvých dříve dokončených úrovní je už převedeno do nového postupu.`:'Dříve dokončené úrovně se převedou do odpovídajících míst nové sady.'}</p></div><div><strong>🕘 Staré výsledky nezmizely</strong><p>Časy, tahy, XP a další historie zůstávají uložené a najdeš je u odehraných úrovní.</p></div><div><strong>🧩 Novou desku si můžeš zahrát i tak</strong><p>U převedené úrovně můžeš nový Proplet odehrát pro radost. Druhé XP za stejné místo už ale nedostaneš.</p></div></div><button id="qualityReleaseDone" class="quality-release-primary" type="button">Rozumím</button>`;q('#qualityReleaseBack').onclick=renderReleaseMain;q('#qualityReleaseDone').onclick=closeReleaseModal}
function ensureReleaseModal(){if(q('#qualityReleaseModal'))return;const modal=document.createElement('div');modal.id='qualityReleaseModal';modal.className='quality-modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','qualityReleaseTitle');modal.innerHTML='<div id="qualityReleaseCard" class="quality-release-card"></div>';document.body.appendChild(modal);modal.onclick=e=>{if(e.target===modal)closeReleaseModal()};renderReleaseMain()}
function maybeShowReleaseModal(){ensureReleaseModal();if(shouldShowReleaseModal())setTimeout(()=>q('#qualityReleaseModal')?.classList.remove('hidden'),180)}

function polishDynamicCopy(){
  if(applyingDom)return;applyingDom=true;
  try{
    polishStaticHierarchy();ensurePrivacyMini();ensureQuickCalmControls();ensureCalmSettings();ensureCalmRunButton();syncCalmControls();
    const teamText=qa('#screen-profile strong,#screen-profile h2').find(el=>el.textContent.trim()==='Tým a společné pořadí');if(teamText)teamText.parentElement?.querySelector('.eyebrow')?.remove();
  }finally{applyingDom=false}
}

function bootQuality(){
  installNetworkCalmFlag();installGameWrappers();installHistoryWrapper();polishDynamicCopy();maybeShowReleaseModal();
  const observer=new MutationObserver(()=>polishDynamicCopy());observer.observe(document.body,{childList:true,subtree:true});window.__propletQualityObserver=observer;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeInfoPopover();if(!q('#qualityReleaseModal')?.classList.contains('hidden'))closeReleaseModal()}});
  setTimeout(()=>{polishDynamicCopy();maybeShowReleaseModal()},650);setTimeout(polishDynamicCopy,1800)
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootQuality,{once:true});else bootQuality();
})();