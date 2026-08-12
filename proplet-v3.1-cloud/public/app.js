const APP_VERSION='3.9';
const COLORS=['#ff9585','#68cfaa','#7ca8ff','#ffd064','#b295ff','#f391c3','#62cbd8','#ffad63','#a6d86d','#76c3ee','#da87e4','#66bea0'];
const AVATARS=['🙂','😎','🤓','🥳','🦊','🐱','🐶','🐼','🐯','🦁','🐸','🐵','🦄','🐲','🦖','🐙','🦉','🐝','🦋','🐧','🚀','⚡','🔥','🌈','🍕','⚽','🎮','🧩','🤯','👑'];
const DIFF={
  easy:{label:'Snadná',icon:'🌱',desc:'Menší 6×6 plocha, klidnější cesty.',xp:10},
  medium:{label:'Střední',icon:'🧠',desc:'Větší 7×8 plocha a víc možností.',xp:20},
  hard:{label:'Těžká',icon:'🧨',desc:'8×8 nebo 9×9. Od 10. úrovně hlavně delší slova a pořádné zákruty.',xp:35},
  hardcore:{label:'Mozkožrout',icon:'🤯',desc:'10×10. Od 10. úrovně minimum drobků, maximum dlouhých slov a šneků.',xp:60}
};
const BADGES=[
 {days:1,icon:'🥉',name:'První zářez'},{days:3,icon:'❤️',name:'Srdcař'},{days:5,icon:'⭐',name:'Pětka'},
 {days:7,icon:'🔥',name:'Týden v plamenech'},{days:10,icon:'🏆',name:'Desítka'},{days:14,icon:'⚡',name:'Blesk'},
 {days:21,icon:'🦉',name:'Mistr slov'},{days:30,icon:'👑',name:'Koruna'},{days:50,icon:'💎',name:'Diamant'},{days:100,icon:'🚀',name:'Legenda'}
];
const LEVELS=[
 {xp:0,icon:'🌱',name:'Nováček'},
 {xp:100,icon:'🧩',name:'Písmenkář'},
 {xp:250,icon:'🔎',name:'Slovolovec'},
 {xp:400,icon:'🧵',name:'Hledač nití'},
 {xp:600,icon:'🪢',name:'Propletač'},
 {xp:850,icon:'↪️',name:'Kličkař'},
 {xp:1100,icon:'🧭',name:'Mistr cest'},
 {xp:1400,icon:'♟️',name:'Slovní taktik'},
 {xp:1750,icon:'✨',name:'Slovní mág'},
 {xp:2150,icon:'🧶',name:'Uzlovač'},
 {xp:2600,icon:'👑',name:'Legenda Propletu'},
 {xp:3100,icon:'🛤️',name:'Cestář'},
 {xp:3650,icon:'🐉',name:'Krotitel'},
 {xp:4250,icon:'🌀',name:'Mistr zákrut'},
 {xp:4900,icon:'🧱',name:'Labyrintník'},
 {xp:5600,icon:'💎',name:'Velmistr Propletu'},
 {xp:6350,icon:'🥷',name:'Propletový ninja'},
 {xp:7150,icon:'⚗️',name:'Slovní alchymista'},
 {xp:8000,icon:'🐌',name:'Mistr šneků'},
 {xp:8900,icon:'🔮',name:'Mřížkový mág'},
 {xp:10000,icon:'🌌',name:'Nadslovník'},
 {xp:11250,icon:'🤯',name:'Krotitel Mozkožroutů'},
 {xp:12500,icon:'🏰',name:'Král mřížky'},
 {xp:14000,icon:'🎓',name:'Arcimistr Propletu'},
 {xp:16000,icon:'🪄',name:'Slovočaroděj'},
 {xp:18500,icon:'🗿',name:'Propletový titán'},
 {xp:21500,icon:'♾️',name:'Mistr nekonečna'},
 {xp:25000,icon:'🌠',name:'Hvězdný propletač'},
 {xp:29000,icon:'🛰️',name:'Orbitální luštitel'},
 {xp:34000,icon:'🚀',name:'Galaktický slovolovec'},
 {xp:40000,icon:'🛡️',name:'Strážce všech cest'},
 {xp:47000,icon:'🏆',name:'Absolutní Propletač'}
];
const ACHIEVEMENTS=[
 {icon:'🧩',name:'První Proplet',desc:'Vyřeš první úlohu',value:s=>s.totalCompleted||0,target:1},
 {icon:'🔟',name:'Rozjezd',desc:'Vyřeš 10 úloh',value:s=>s.totalCompleted||0,target:10},
 {icon:'💯',name:'Stovka',desc:'Nasbírej 100 XP',value:s=>s.points||0,target:100},
 {icon:'🧠',name:'Mozkovna',desc:'5 středních úloh',value:s=>s.freeCompleted?.medium||0,target:5},
 {icon:'🧨',name:'Nebojácný',desc:'3 těžké úlohy',value:s=>s.freeCompleted?.hard||0,target:3},
 {icon:'🤯',name:'Mozkožrout',desc:'Dokonči první Mozkožrout',value:s=>s.freeCompleted?.hardcore||0,target:1},
 {icon:'☀️',name:'Ranní ptáče',desc:'Dokonči 5 denních výzev',value:s=>s.dailyCompleted||0,target:5},
 {icon:'🔥',name:'Držíš nit',desc:'Udrž sérii 7 dní',value:s=>s.longestStreak||0,target:7},
 {icon:'⚡',name:'Rychlík',desc:'Denní výzva pod 2 minuty',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<120000?1:0,target:1},
 {icon:'✨',name:'Bez berliček',desc:'10 čistých řešení bez nápovědy',value:s=>s.cleanSolves||0,target:10}
];
ACHIEVEMENTS.forEach(a=>a.test=s=>a.value(s)>=a.target);
const SHARE_URL='https://proplet-nine.vercel.app/';
const STORE_KEY='proplet-v2-state';
const PROFILE_KEY='proplet-v2-profile';
const QUEUE_KEY='proplet-v2-sync-queue';
const SETTINGS_KEY='proplet-v3-settings';
const ONBOARD_KEY='proplet-v3-7-required-onboarding';
const ACCOUNT_NUDGE_KEY='proplet-v3-5-account-nudge';
const PUSH_NUDGE_KEY='proplet-v3-8-2-push-nudge';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let puzzleDB=null;
let currentScreen='daily';
let currentGame=null;
let timerId=null;
let leaderTab='daily';
let leagueScope='family';
let globalWeekOffset=0;
let globalLeagueData=null;
let audioCtx=null;
let toastTimer=null;
let syncState={status:'idle',error:null,lastAt:null};
let accountMode='login';
let rescueStatus=null;
let onboardingStep=0;
let tutorialState={dragging:false,path:[],done:false};
let pendingSW=null;
let winFeedbackSent=false;
let pendingPostWinAction=null;
let pendingPushPostWinAction=null;
let profileModalFromNudge=false;
let leagueCreateMode='join';
let leaguesCache=[];
let onboardingMandatory=false;
let levelDetailContext=null;
let pushUiBusy=false;

function blankState(){return {completed:{},rescues:{},inProgress:{},dailyDates:[],statsVersion:5};}
function getProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function playerScope(){return getProfile()?.id||'guest'}
function scopedStorageKey(base,scope=playerScope()){return `${base}:${scope}`}
function getState(){try{return {...blankState(),...JSON.parse(localStorage.getItem(scopedStorageKey(STORE_KEY))||'{}')}}catch{return blankState()}}
function saveState(s){localStorage.setItem(scopedStorageKey(STORE_KEY),JSON.stringify(s))}
function saveProfile(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));updateProfileChip()}
function getQueue(){try{return JSON.parse(localStorage.getItem(scopedStorageKey(QUEUE_KEY))||'[]')}catch{return []}}
function saveQueue(q){localStorage.setItem(scopedStorageKey(QUEUE_KEY),JSON.stringify(q))}
function migrateScopedStorage(){
 const marker='proplet-v3-9-scoped-storage';if(localStorage.getItem(marker))return;const scope=playerScope();
 const legacyState=localStorage.getItem(STORE_KEY),legacyQueue=localStorage.getItem(QUEUE_KEY);
 if(legacyState&&!localStorage.getItem(scopedStorageKey(STORE_KEY,scope)))localStorage.setItem(scopedStorageKey(STORE_KEY,scope),legacyState);
 if(legacyQueue&&!localStorage.getItem(scopedStorageKey(QUEUE_KEY,scope)))localStorage.setItem(scopedStorageKey(QUEUE_KEY,scope),legacyQueue);
 localStorage.setItem(marker,'1');
}
function adoptGuestData(profileId){
 const guestStateKey=scopedStorageKey(STORE_KEY,'guest'),guestQueueKey=scopedStorageKey(QUEUE_KEY,'guest'),playerStateKey=scopedStorageKey(STORE_KEY,profileId),playerQueueKey=scopedStorageKey(QUEUE_KEY,profileId);
 try{const guest={...blankState(),...JSON.parse(localStorage.getItem(guestStateKey)||'{}')},player={...blankState(),...JSON.parse(localStorage.getItem(playerStateKey)||'{}')};for(const [k,r] of Object.entries(guest.completed||{}))player.completed[k]=player.completed[k]?firstResult(player.completed[k],r):r;for(const [k,r] of Object.entries(guest.inProgress||{}))if(!player.completed[k]&&!player.inProgress[k])player.inProgress[k]=r;player.rescues={...(player.rescues||{}),...(guest.rescues||{})};localStorage.setItem(playerStateKey,JSON.stringify(player))}catch{}
 try{const gq=JSON.parse(localStorage.getItem(guestQueueKey)||'[]'),pq=JSON.parse(localStorage.getItem(playerQueueKey)||'[]');const ids=new Set(pq.map(r=>r.attemptId||`${r.challengeKey}:${r.completedAt}`));for(const r of gq){const id=r.attemptId||`${r.challengeKey}:${r.completedAt}`;if(!ids.has(id)){pq.push(r);ids.add(id)}}localStorage.setItem(playerQueueKey,JSON.stringify(pq))}catch{}
 localStorage.removeItem(guestStateKey);localStorage.removeItem(guestQueueKey);
}
function getSettings(){try{return {sound:true,haptics:true,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {sound:true,haptics:true}}}
function saveSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}

function fmtTime(ms){if(ms==null)return '—';const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function czPlural(n,one,few,many){const a=Math.abs(Number(n)||0);return a===1?one:(a>=2&&a<=4?few:many)}
function countCz(n,one,few,many){return `${n} ${czPlural(n,one,few,many)}`}
function resultRankTuple(r){return [r?.cleanSolve===true?0:1,Number(r?.hintsUsed??99),Number(r?.elapsedMs??1e15),Number(r?.moves??1e9),Number(r?.wrongAttempts??999)]}
function betterResult(a,b){if(!a)return b;if(!b)return a;const x=resultRankTuple(a),y=resultRankTuple(b);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return y[i]<x[i]?b:a}return a}
function firstResult(a,b){
 if(!a)return b;if(!b)return a;
 const ta=Date.parse(a.completedAt||'')||Number.MAX_SAFE_INTEGER,tb=Date.parse(b.completedAt||'')||Number.MAX_SAFE_INTEGER;
 return tb<ta?b:a;
}
function sortedFreeBank(diff){return [...(puzzleDB?.free?.[diff]||[])].sort((a,b)=>(a.meta?.level||9999)-(b.meta?.level||9999)||(a.meta?.difficultyScore||0)-(b.meta?.difficultyScore||0))}
function normalizeLeagueCode(v){return String(v||'').trim().toLocaleUpperCase('cs-CZ').replace(/\s+/g,'').replace(/[^0-9A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ_-]/g,'').slice(0,24)}
function selectedLeague(){return leaguesCache.find(l=>l.code===$('#leagueSelect')?.value)||null}
function togglePassword(inputIds,btn){const ids=Array.isArray(inputIds)?inputIds:[inputIds],show=ids.some(id=>$('#'+id)?.type==='password');ids.forEach(id=>{const el=$('#'+id);if(el)el.type=show?'text':'password'});if(btn)btn.textContent=show?'🙈 Skrýt heslo':'👁 Zobrazit heslo'}
function formatDateCZ(iso){const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)))}
function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function addDaysISO(iso,days){const [y,m,d]=iso.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d+days,12));return dt.toISOString().slice(0,10)}
function dayNumber(iso){const [y,m,d]=iso.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(2026,0,1))/86400000)}
function dailyPuzzleFor(iso){const n=puzzleDB.daily.length;const i=((dayNumber(iso)%n)+n)%n;return puzzleDB.daily[i]}
function challengeKey(mode,puzzle,date){return mode==='daily'?`daily:${date}`:`free:${puzzle.id}`}
function pointsFor(mode,difficulty){return mode==='daily'?100:DIFF[difficulty].xp}
function savedProgressFor(puzzle,mode,dailyDate){
 if(mode==='rescue')return null;const s=getState(),key=challengeKey(mode,puzzle,dailyDate);if(s.completed?.[key])return null;const r=s.inProgress?.[key];
 if(!r||r.puzzleId!==puzzle.id||r.mode!==mode)return null;
 const seen=new Set(),found=[];
 for(const f of r.found||[]){const a=puzzle.answers?.[f.answerIndex];if(!a||seen.has(f.answerIndex)||a.word!==f.word||!samePath(a.path,f.path||[]))continue;seen.add(f.answerIndex);found.push({answerIndex:f.answerIndex,word:f.word,colorIndex:Number.isFinite(f.colorIndex)?f.colorIndex:found.length%COLORS.length,path:[...f.path]})}
 return {...r,found,moves:Math.max(0,Number(r.moves)||0),hints:Math.max(0,Number(r.hints)||0),wrongAttempts:Math.max(0,Number(r.wrongAttempts)||0),maxHintLevel:Math.max(0,Number(r.maxHintLevel)||0),elapsedMs:Math.max(0,Number(r.elapsedMs)||0)};
}
function gameElapsed(g=currentGame){if(!g)return 0;if(g.mode==='daily'&&g.wallStartedAt)return Math.max(0,Date.now()-g.wallStartedAt);return Math.max(0,(g.baseElapsedMs||0)+(performance.now()-g.start))}
function saveGameProgress(){
 const g=currentGame;if(!g||g.finished||g.mode==='rescue')return;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();s.inProgress=s.inProgress||{},elapsed=gameElapsed(g);
 s.inProgress[key]={puzzleId:g.puzzle.id,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate||null,found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,cleanSolve:(g.hints||0)===0,elapsedMs:Math.round(elapsed),wallStartedAt:g.mode==='daily'?g.wallStartedAt:null,attemptId:g.attemptId||null,savedAt:Date.now()};saveState(s);g.lastAutosaveAt=Date.now();
}
function clearGameProgress(mode,puzzle,dailyDate){const s=getState(),key=challengeKey(mode,puzzle,dailyDate);if(s.inProgress?.[key]){delete s.inProgress[key];saveState(s)}}
function resumableFreePuzzle(diff,list){const s=getState(),rows=Object.values(s.inProgress||{}).filter(r=>r?.mode==='free'&&r.difficulty===diff&&!s.completed?.[`free:${r.puzzleId}`]).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));return rows.length?list.find(p=>p.id===rows[0].puzzleId)||null:null}

function currentLocalStats(){
 const s=getState(),rows=Object.values(s.completed),dailyDates=[...new Set(rows.filter(r=>r.mode==='daily').map(r=>r.dailyDate).filter(Boolean))];
 const rescueDates=Object.entries(s.rescues||{}).filter(([,r])=>r?.status==='passed').map(([d])=>d),effectiveDates=[...new Set([...dailyDates,...rescueDates])];
 const streak=calcStreak(effectiveDates),longest=calcLongest(effectiveDates),dailyTimes=rows.filter(r=>r.mode==='daily').map(r=>r.elapsedMs);
 const free={easy:0,medium:0,hard:0,hardcore:0};rows.filter(r=>r.mode==='free').forEach(r=>free[r.difficulty]=(free[r.difficulty]||0)+1);
 const cleanRows=rows.filter(r=>r.cleanSolve===true);
 return {points:rows.reduce((a,r)=>a+(r.points||0),0),totalCompleted:rows.length,dailyCompleted:dailyDates.length,freeCompleted:free,currentStreak:streak,longestStreak:longest,bestDailyMs:dailyTimes.length?Math.min(...dailyTimes):null,cleanSolves:cleanRows.length,cleanDaily:cleanRows.filter(r=>r.mode==='daily').length,rescuedDays:rescueDates.length};
}
function effectiveStats(){
 const local=currentLocalStats(),remote=getProfile()?.stats;if(!remote)return local;
 const free={easy:0,medium:0,hard:0,hardcore:0};for(const k of Object.keys(free))free[k]=Math.max(local.freeCompleted?.[k]||0,remote.freeCompleted?.[k]||0);
 return {
  points:Math.max(local.points||0,remote.points||0),totalCompleted:Math.max(local.totalCompleted||0,remote.totalCompleted||0),
  dailyCompleted:Math.max(local.dailyCompleted||0,remote.dailyCompleted||0),freeCompleted:free,
  currentStreak:Math.max(local.currentStreak||0,remote.currentStreak||0),longestStreak:Math.max(local.longestStreak||0,remote.longestStreak||0),
  bestDailyMs:[local.bestDailyMs,remote.bestDailyMs].filter(v=>v!=null).sort((a,b)=>a-b)[0]??null,
  cleanSolves:Math.max(local.cleanSolves||0,remote.cleanSolves||0),cleanDaily:Math.max(local.cleanDaily||0,remote.cleanDaily||0),rescuedDays:Math.max(local.rescuedDays||0,remote.rescuedDays||0)
 };
}
function isoShift(iso,days){const d=new Date(`${iso}T12:00:00Z`);return new Date(d.getTime()+days*86400000).toISOString().slice(0,10)}
function streakEndingOn(dateStrings,anchor){const set=new Set(dateStrings),start=typeof anchor==='string'?anchor:anchor.toISOString().slice(0,10);let n=0,d=start;while(set.has(d)){n++;d=isoShift(d,-1)}return n}
function localRescueStatus(){
 const st=getState(),today=pragueDateISO(),missed=isoShift(today,-1),before=isoShift(today,-2),daily=Object.values(st.completed).filter(r=>r.mode==='daily'&&r.dailyDate).map(r=>r.dailyDate),passed=Object.entries(st.rescues||{}).filter(([,r])=>r?.status==='passed').map(([d])=>d),effective=[...new Set([...daily,...passed])],existing=st.rescues?.[missed],prior=streakEndingOn(effective,before);
 if(existing?.status==='started'){const elapsed=Date.now()-(existing.startedAt||0);if(elapsed>30000){st.rescues[missed]={...existing,status:'failed',elapsedMs:elapsed};saveState(st);return {eligible:false,state:'failed',missedDate:missed,priorStreak:prior}}return {eligible:true,state:'started',missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId,timeLimitMs:30000,secondsRemaining:Math.max(0,(30000-elapsed)/1000)}}
 if(existing)return {eligible:false,state:existing.status,missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId};
 const eligible=!effective.includes(missed)&&effective.includes(before)&&prior>0;return {eligible,state:eligible?'available':'none',missedDate:eligible?missed:null,priorStreak:eligible?prior:0};
}
function calcStreak(dateStrings){const set=new Set(dateStrings);if(!set.size)return 0;const today=pragueDateISO();const y=new Date(`${today}T12:00:00Z`);const prev=new Date(y.getTime()-86400000).toISOString().slice(0,10);let anchor=set.has(today)?today:(set.has(prev)?prev:null);if(!anchor)return 0;let n=0,d=new Date(`${anchor}T12:00:00Z`);while(set.has(d.toISOString().slice(0,10))){n++;d=new Date(d.getTime()-86400000)}return n}
function calcLongest(dateStrings){const arr=[...new Set(dateStrings)].sort();let best=0,cur=0,prev=null;for(const s of arr){const d=Date.parse(`${s}T12:00:00Z`);cur=prev!==null&&d-prev===86400000?cur+1:1;best=Math.max(best,cur);prev=d}return best}
function levelFor(points){let i=0;for(let n=0;n<LEVELS.length;n++)if(points>=LEVELS[n].xp)i=n;const current=LEVELS[i],next=LEVELS[i+1]||null;const pct=next?Math.max(0,Math.min(100,((points-current.xp)/(next.xp-current.xp))*100)):100;return {index:i+1,current,next,pct}}

const ROUTE_SCREENS=new Set(['daily','free','leaderboard','profile','game']);
function applyScreen(screen){
 screen=ROUTE_SCREENS.has(screen)?screen:'daily';const prev=currentScreen;
 if(prev==='game'&&screen!=='game'){if(currentGame?.mode!=='rescue')saveGameProgress();stopTimer()}
 currentScreen=screen;$$('.screen').forEach(x=>x.classList.remove('active'));$(`#screen-${screen}`).classList.add('active');
 document.body.classList.toggle('playing',screen==='game');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===screen));$('.bottom-nav').classList.toggle('hidden',screen==='game');
 if(screen==='daily'){renderDaily();refreshRescueStatus()}if(screen==='free')renderFree();if(screen==='leaderboard')renderLeaderboard();if(screen==='profile')renderProfile();if(screen==='game')requestAnimationFrame(fitGameBoard);else window.scrollTo({top:0,behavior:'instant'});
}
function nav(screen,{replace=false,fromPop=false}={}){
 screen=ROUTE_SCREENS.has(screen)?screen:'daily';
 if(!fromPop&&screen!==currentScreen){const state={proplet:true,screen};if(replace)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href)}
 applyScreen(screen);
}
function initNavigation(){
 const initial=ROUTE_SCREENS.has(history.state?.screen)&&history.state?.proplet?history.state.screen:'daily';
 history.replaceState({proplet:true,screen:initial},'',location.href);applyScreen(initial);
 window.addEventListener('popstate',async e=>{
  const modal=openTransientModal();
  if(modal){
   if(modal.id==='onboardingModal'&&onboardingMandatory){history.pushState({proplet:true,screen:currentScreen},'',location.href);return}
   if(modal.id==='winModal'&&shouldOfferAccountNudge())maybeOfferAccountNudge('menu');
   else if(modal.id==='winModal'&&await maybeOfferPushNudge('menu')){} 
   else if(modal.id==='accountNudgeModal')dismissAccountNudge();
   else if(modal.id==='pushNudgeModal')dismissPushNudge();
   else if(modal.id==='profileModal'&&profileModalFromNudge){modal.classList.add('hidden');resumeAfterAccountNudge()}
   else modal.classList.add('hidden');
   history.pushState({proplet:true,screen:currentScreen},'',location.href);return
  }
  const screen=e.state?.proplet&&ROUTE_SCREENS.has(e.state.screen)?e.state.screen:'daily';nav(screen,{fromPop:true});
 });
}
function transientModals(){return ['winModal','accountNudgeModal','pushNudgeModal','profileModal','passwordModal','hintModal','rescueOfferModal','onboardingModal','wordReportModal','playedLevelsModal','levelDetailModal'].map(id=>document.getElementById(id)).filter(Boolean)}
function openTransientModal(){return transientModals().find(el=>!el.classList.contains('hidden'))||null}
function closeTransientModals(){transientModals().forEach(el=>el.classList.add('hidden'))}
function goBackFromGame(){
 if(currentScreen!=='game')return;
 if(currentGame?.mode!=='rescue')saveGameProgress();stopTimer();
 if(history.state?.proplet&&history.state.screen==='game'&&history.length>1)history.back();
 else nav(currentGame?.mode==='free'?'free':'daily',{replace:true});
}

function renderLevelCard(stats){
 const l=levelFor(stats.points||0),toNext=l.next?l.next.xp-(stats.points||0):0;
 $('#levelCard').innerHTML=`<div class="level-orb">${l.current.icon}</div><div class="level-copy"><div class="level-top"><strong>Hodnost ${l.index} · ${l.current.name}</strong><span>${stats.points||0} XP</span></div><div class="xp-track"><span style="width:${l.pct}%"></span></div><div class="level-hint">${l.next?`Ještě ${toNext.toLocaleString('cs-CZ')} XP → ${l.next.name}`:'Dál už nic není. Zatím. 👑'}</div></div>`;
}
function renderDaily(){
 const date=pragueDateISO(),p=dailyPuzzleFor(date),stats=effectiveStats(),done=getState().completed[`daily:${date}`],risk=rescueStatus&&(rescueStatus.state==='available'||rescueStatus.state==='started');
 $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${countCz(p.meta.cells,'políčko','políčka','políček')} · ${countCz(p.answers.length,'slovo','slova','slov')}`;
 const shownStreak=risk?Math.max(stats.currentStreak||0,rescueStatus.priorStreak||0):stats.currentStreak;$('#streakCount').textContent=shownStreak;$('#streakUnit').textContent=czPlural(shownStreak,'den','dny','dní');$('#streakBubble').classList.toggle('at-risk',!!risk);$('#dailyCompletedStat').textContent=stats.dailyCompleted;$('#longestStreakStat').textContent=stats.longestStreak;$('#bestDailyStat').textContent=fmtTime(stats.bestDailyMs);
 $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':'Hrát dnešní výzvu';$('#shareDailyBtn').classList.toggle('hidden',!done);renderLevelCard(stats);
 const streakForGoal=risk?shownStreak:stats.currentStreak,next=BADGES.find(b=>streakForGoal<b.days);$('#nextBadgeText').textContent=risk?'🔥 Nejdřív zachraň sérii':(next?`${next.icon} ${countCz(next.days-streakForGoal,'den','dny','dní')} do „${next.name}“`:'🚀 Jsi legenda');
 $('#badgeRail').innerHTML=BADGES.slice(0,8).map(b=>`<div class="badge-step ${stats.longestStreak>=b.days?'earned':''} ${!risk&&next?.days===b.days?'current':''}"><span class="emoji">${b.icon}</span><strong>${countCz(b.days,'den','dny','dní')}</strong><small>${b.name}</small></div>`).join('');
 const sync=$('#dailySyncStatus');if(!done){sync.classList.add('hidden')}else{sync.classList.remove('hidden');const pfile=getProfile(),queued=getQueue().some(r=>r.challengeKey===`daily:${date}`);if(!pfile?.token)sync.textContent='📱 Výsledek je uložený v tomto telefonu';else if(queued)sync.textContent=syncState.status==='error'?`⚠️ Čeká na synchronizaci: ${syncState.error||'zkus to znovu'}`:'☁️ Výsledek čeká na synchronizaci';else sync.textContent='✓ Výsledek je v týmovém pořadí';}
 renderRescueCard();renderQuickPlay();
}

async function refreshRescueStatus(){
 const profile=getProfile();
 try{rescueStatus=profile?.token?await api('/api/rescue-status'):localRescueStatus()}catch(e){rescueStatus=localRescueStatus()}
 renderDaily();maybeOfferRescue();
 return rescueStatus;
}
function renderRescueCard(){
 const card=$('#rescueCard');if(!card)return;const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started')){card.classList.add('hidden');return}
 card.classList.remove('hidden');$('#rescueTitle').textContent=`Série ${countCz(rs.priorStreak,'den','dny','dní')} je v ohrožení`;
 $('#rescueText').textContent=rs.state==='started'?`Záchranný pokus už běží. Zbývá přibližně ${Math.ceil(rs.secondsRemaining||0)} s.`:`Včerejší Denní výzva ti utekla. Máš jeden pokus, jak navázat tam, kde jsi skončil.`;
 $('#rescueBtn').textContent=rs.state==='started'?`Pokračovat · ${Math.ceil(rs.secondsRemaining||0)} s`:'Zachránit sérii · 30 s';
}
function openRescueOffer(){
 const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started'))return;
 $('#rescueOfferTitle').textContent=rs.state==='started'?'Záchrana už běží!':'Chceš zachránit sérii?';
 $('#rescueOfferText').textContent=rs.state==='started'?`Zbývá ti asi ${countCz(Math.ceil(rs.secondsRemaining||0),'sekunda','sekundy','sekund')}. Čas běží i mimo obrazovku.`:`Máš ${countCz(rs.priorStreak,'den','dny','dní')} v řadě. Když zvládneš rychlý Proplet do 30 sekund, série pokračuje. Když ne, předchozí série končí.`;
 $('#confirmRescueBtn').textContent=rs.state==='started'?'Pokračovat teď 🔥':'Ano, jdu do toho 🔥';$('#rescueOfferModal').classList.remove('hidden');
}
function rescuePuzzleById(id){return (puzzleDB.rescue||[]).find(p=>p.id===id)}
function localRescuePuzzleId(missed){const bank=puzzleDB.rescue||[];let h=0;for(const ch of missed)h=(h*31+ch.charCodeAt(0))>>>0;return bank.length?bank[h%bank.length].id:null}
async function beginRescue(){
 $('#rescueOfferModal').classList.add('hidden');let rs=rescueStatus||localRescueStatus();const profile=getProfile();
 try{
  if(rs.state!=='started'){
   if(profile?.token)rs=await api('/api/rescue/start',{method:'POST',body:'{}'});
   else{const st=getState(),id=localRescuePuzzleId(rs.missedDate);st.rescues=st.rescues||{};st.rescues[rs.missedDate]={status:'started',puzzleId:id,startedAt:Date.now()};saveState(st);rs={...rs,state:'started',puzzleId:id,timeLimitMs:30000,secondsRemaining:30}}
  }
  rescueStatus=rs;const puzzle=rescuePuzzleById(rs.puzzleId);if(!puzzle)throw new Error('Záchranná úloha se nenašla');
  const remaining=Math.max(1000,Math.round((rs.secondsRemaining??30)*1000));startGame(puzzle,'rescue',rs.missedDate,{limitMs:remaining,rescueTotalLimitMs:30000});
 }catch(e){showToast(`Záchrana nejde spustit: ${e.message}`);refreshRescueStatus()}
}
async function finishRescue(passed){
 const g=currentGame;if(!g||g.mode!=='rescue'||g.rescueFinished)return;g.rescueFinished=true;g.finished=true;stopTimer();const elapsed=Math.max(0,Math.round(g.rescueElapsedMs??(performance.now()-g.start))),profile=getProfile();let ok=passed;
 try{
  if(profile?.token){const r=await api('/api/rescue/finish',{method:'POST',body:JSON.stringify({puzzle_id:g.puzzle.id,completed:!!passed,elapsed_ms:Math.min(120000,elapsed)})});ok=!!r.ok;if(r.stats)saveProfile({...profile,stats:r.stats})}
  else{const st=getState(),missed=g.dailyDate;st.rescues=st.rescues||{};st.rescues[missed]={...(st.rescues[missed]||{}),status:passed&&elapsed<=30000?'passed':'failed',puzzleId:g.puzzle.id,elapsedMs:elapsed,completedAt:new Date().toISOString()};saveState(st);ok=passed&&elapsed<=30000}
 }catch(e){ok=false;showToast(`Záchranu se nepodařilo potvrdit: ${e.message}`)}
 $('#winModal').classList.remove('hidden');$('#winBadge').textContent=ok?'🔥':'💨';$('#winTitle').textContent=ok?'Série zachráněna!':'Série tentokrát padla';$('#winText').textContent=ok?`Hotovo za ${fmtTime(elapsed)}. Tvoje série pokračuje.`:'Pokus je vyčerpaný. Dnešní výzva může odstartovat novou sérii.';$('#winXp').textContent=ok?'Série pokračuje · bez XP':'Nový začátek';$('#winClean').classList.add('hidden');$('#winWords').innerHTML=ok?g.found.map(f=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join(''):'';$('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').textContent='Zpět na dnešek';renderWinFeedback();if(ok){confetti();fx('win')}else fx('wrong');await refreshRescueStatus();renderProfile();
}
function failRescue(){finishRescue(false)}

function freeProgress(diff){
 const s=getState(),list=sortedFreeBank(diff),total=list.length,done=list.filter(p=>s.completed[`free:${p.id}`]).length,resume=resumableFreePuzzle(diff,list),pct=total?Math.round(done/total*100):0;
 return {list,total,done,resume,pct};
}
function renderQuickPlay(){
 const root=$('#quickPlayGrid');if(!root||!puzzleDB)return;
 root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),status=q.resume?'Pokračovat':q.done===q.total&&q.total?'Hotovo · hrát znovu':`${q.done}/${q.total}`;return `<button class="quick-game" data-quick-free="${key}" data-diff="${key}"><span class="quick-game-icon">${d.icon}</span><span class="quick-game-copy"><strong>${d.label}</strong><small>${status}</small><i><b style="width:${q.pct}%"></b></i></span><span class="quick-game-arrow">›</span></button>`}).join('');
 $$('[data-quick-free]').forEach(b=>b.onclick=()=>startFree(b.dataset.quickFree));
}

function renderFree(){
 $('#difficultyCards').innerHTML=Object.entries(DIFF).map(([key,d])=>{
  const {total,done,pct,resume}=freeProgress(key),next=Math.min(done+1,total),progressLabel=resume?'ROZEHRÁNO':(done===total?`${done}/${total} HOTOVO`:`ÚROVEŇ ${next} Z ${total}`);
  return `<article class="difficulty-card card" data-diff="${key}"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${d.icon}</span><div><span class="eyebrow">${progressLabel}</span><h2>${d.label}</h2></div></div><p class="muted">${d.desc}</p><span class="xp-chip">+${d.xp} XP za novou úroveň</span><div class="progress-line"><span style="width:${pct}%"></span></div><div class="difficulty-actions"><button class="secondary-btn play-next-btn" data-play-free="${key}">${resume?'Pokračovat':(done===total?'Hrát znovu':'Hraj další úroveň')}</button><button class="text-btn played-levels-btn" data-played-levels="${key}" ${done?'':'disabled'}>▦ Odehrané úrovně${done?` · ${done}`:''}</button></div></div><div class="difficulty-progress" data-play-free="${key}" role="button" tabindex="0" aria-label="${resume?'Pokračovat v rozehrané':'Hrát'} ${d.label}" style="--progress:${pct}%"><div><strong>${done}</strong><small>/${total}</small></div><span>›</span></div></article>`
 }).join('');
 $$('[data-play-free]').forEach(b=>{b.onclick=e=>{e.stopPropagation();startFree(b.dataset.playFree)};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startFree(b.dataset.playFree)}}});
 $$('[data-played-levels]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(!b.disabled)openPlayedLevels(b.dataset.playedLevels)});
}
function startFree(diff){
 const s=getState(),list=sortedFreeBank(diff),resume=resumableFreePuzzle(diff,list),unsolved=list.filter(p=>!s.completed[`free:${p.id}`]);
 const p=resume||(unsolved.length?unsolved[0]:list[0]);if(p)startGame(p,'free',null);
}
function startDaily(){const date=pragueDateISO(),done=getState().completed[`daily:${date}`];if(done){showDailyResult(date,done);return}startGame(dailyPuzzleFor(date),'daily',date)}

function newAttemptId(){try{return crypto.randomUUID()}catch{return `a-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}}
async function startAttemptTelemetry(g){const p=getProfile();if(!p?.token||!g||g.mode==='rescue')return;try{await api('/api/attempt/start',{method:'POST',body:JSON.stringify({attempt_id:g.attemptId,puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),mode:g.mode,difficulty:g.puzzle.difficulty})})}catch{}}
function startGame(puzzle,mode,dailyDate,options={}){
 stopTimer();
 // Když hráč otevře Free hru z rychlé nabídky na Daily, vytvoř v historii mezikrok Free menu.
 // Android/PWA tlačítko Zpět pak vrátí hra → výběr her, ne rovnou na Daily.
 if(mode==='free'&&currentScreen!=='free'&&currentScreen!=='game')history.pushState({proplet:true,screen:'free'},'',location.href);
 if(mode==='rescue'&&currentScreen!=='daily'&&currentScreen!=='game')history.pushState({proplet:true,screen:'daily'},'',location.href);
 const totalLimit=options.rescueTotalLimitMs||30000,remaining=options.limitMs||totalLimit,restored=mode==='rescue'?null:savedProgressFor(puzzle,mode,dailyDate),found=restored?.found||[],used=new Map();found.forEach(f=>f.path.forEach(i=>used.set(i,f.colorIndex)));
 let baseElapsedMs=restored?.elapsedMs||0,wallStartedAt=null;if(mode==='daily'){wallStartedAt=Number(restored?.wallStartedAt)||Date.now()-baseElapsedMs;baseElapsedMs=Math.max(baseElapsedMs,Date.now()-wallStartedAt)}
 currentGame={puzzle,mode,dailyDate,found,used,path:[],dragging:false,lastPointer:null,moves:restored?.moves||0,start:performance.now(),wallStartedAt,baseElapsedMs,elapsedMs:baseElapsedMs,finished:false,lastFound:[],hints:restored?.hints||0,wrongAttempts:restored?.wrongAttempts||0,maxHintLevel:restored?.maxHintLevel||0,cleanSolve:(restored?.hints||0)===0,attemptId:restored?.attemptId||newAttemptId(),rescueFinished:false,rescueTotalLimitMs:totalLimit,rescueOffsetMs:mode==='rescue'?Math.max(0,totalLimit-remaining):0,lastAutosaveAt:Date.now()};
 $('#screen-game').classList.toggle('rescue-mode',mode==='rescue');$('#gameModeLabel').textContent=mode==='daily'?'Denní výzva':mode==='rescue'?'Záchrana série':'Volná hra';const levelNo=Number(puzzle.meta?.level)||null;$('#gameDifficulty').textContent=mode==='rescue'?'🔥 6×6 · jeden pokus':mode==='free'?`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}${levelNo?` ${levelNo}`:''}`:`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}`;
 $('#timer').textContent=mode==='rescue'?fmtCountdown(remaining):fmtTime(baseElapsedMs);message(restored?(mode==='daily'?'Pokračuješ. U Denní výzvy čas běžel i mimo herní obrazovku.':'Pokračuješ přesně tam, kde jsi skončil.'):'Najdi slova. A pamatuj: nestačí slovo, musí sedět i cesta.');nav('game');renderGameBoard();renderGameHUD();startTimer();if(mode!=='rescue')saveGameProgress();startAttemptTelemetry(currentGame);
}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function fmtCountdown(ms){const sec=Math.max(0,Math.ceil(ms/1000));return `00:${String(sec).padStart(2,'0')}`}
function startTimer(){stopTimer();timerId=setInterval(()=>{if(!currentGame||currentGame.finished)return;const live=performance.now()-currentGame.start;if(currentGame.mode==='rescue'){currentGame.rescueElapsedMs=currentGame.rescueOffsetMs+live;const rem=currentGame.rescueTotalLimitMs-currentGame.rescueElapsedMs;$('#timer').textContent=fmtCountdown(rem);if(rem<=0){stopTimer();finishRescue(false)}}else{currentGame.elapsedMs=gameElapsed(currentGame);$('#timer').textContent=fmtTime(currentGame.elapsedMs);if(Date.now()-(currentGame.lastAutosaveAt||0)>5000)saveGameProgress()}},currentGame?.mode==='rescue'?100:250)}
function renderGameHUD(){
 const g=currentGame,p=g.puzzle;$('#moves').textContent=countCz(g.moves,'tah','tahy','tahů');$('#gameProgress').textContent=`${g.found.length}/${p.answers.length}`;
 const remaining=p.answers.map((a,i)=>({len:a.word.length,i})).filter(x=>!g.found.some(f=>f.answerIndex===x.i)).sort((a,b)=>a.len-b.len||a.i-b.i);
 $('#lengths').innerHTML=remaining.length?remaining.map(x=>`<span class="length-pill" title="${countCz(x.len,'písmeno','písmena','písmen')}">${x.len}</span>`).join(''):'<span class="all-found">✓ nic</span>';
 $('#foundWords').innerHTML=g.found.length?g.found.map(f=>`<span class="found-word-chip" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 58%,white)">${esc(f.word)}</span>`).join(''):'<span class="empty-found">zatím nic</span>';
 const clean=$('#cleanStatus');clean.textContent=g.mode==='rescue'?'':(g.hints?'💡 S nápovědou':'✨ Čistě');clean.classList.toggle('lost',!!g.hints);$('#hintBtn').textContent=g.hints?`💡 ${g.hints}×`:'💡 Nápověda';
}
function fitGameBoard(){
 if(!currentGame||currentScreen!=='game')return;const stage=$('#boardStage'),wrap=$('#boardWrap'),board=$('#board');if(!stage||!wrap||!board)return;const p=currentGame.puzzle,cs=getComputedStyle(board),gap=parseFloat(cs.columnGap)||5,ss=getComputedStyle(stage),padX=(parseFloat(ss.paddingLeft)||0)+(parseFloat(ss.paddingRight)||0),padY=(parseFloat(ss.paddingTop)||0)+(parseFloat(ss.paddingBottom)||0),aw=Math.max(80,stage.clientWidth-padX),ah=Math.max(80,stage.clientHeight-padY);const cellByH=Math.max(4,(ah-gap*(p.rows-1))/p.rows),wByH=cellByH*p.cols+gap*(p.cols-1),target=Math.max(80,Math.min(aw,wByH));wrap.style.width=`${target}px`;requestAnimationFrame(drawPaths)
}
function renderGameBoard(){
 const g=currentGame,p=g.puzzle,mask=new Set(p.mask),board=$('#board');board.style.gridTemplateColumns=`repeat(${p.cols},1fr)`;board.classList.toggle('dense-board',p.cols>=9);board.classList.toggle('ultra-board',p.cols>=10);board.innerHTML='';
 for(let i=0;i<p.rows*p.cols;i++){if(!mask.has(i)){const v=document.createElement('div');v.className='void-cell';board.appendChild(v);continue}const c=document.createElement('div');c.className='cell';c.dataset.index=i;c.textContent=p.letters[i];const color=g.used.get(i);if(color!=null){c.classList.add('used');c.style.setProperty('--word-color',COLORS[color%COLORS.length])}if(g.lastFound?.includes(i))c.classList.add('just-found');c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointerenter',pointerEnter);board.appendChild(c)}requestAnimationFrame(()=>{fitGameBoard();drawPaths()});if(g.lastFound?.length)setTimeout(()=>{g.lastFound=[];$$('.just-found').forEach(c=>c.classList.remove('just-found'))},460)}
function pNeighbours(i){const p=currentGame.puzzle,r=Math.floor(i/p.cols),c=i%p.cols,mask=new Set(p.mask),out=[];[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{const j=rr*p.cols+cc;if(rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols&&mask.has(j))out.push(j)});return out}
function pointerDown(e){e.preventDefault();ensureAudio();const i=+e.currentTarget.dataset.index;if(currentGame.used.has(i))return;currentGame.dragging=true;currentGame.path=[i];currentGame.lastPointer={x:e.clientX,y:e.clientY};fx('tap');updateActive();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}}
function pointerEnter(e){if(currentGame?.dragging)extendPath(+e.currentTarget.dataset.index)}
function samplePointer(x,y){const g=currentGame;if(!g?.dragging)return;const prev=g.lastPointer||{x,y},dx=x-prev.x,dy=y-prev.y,dist=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(dist/6));for(let n=1;n<=steps;n++){const px=prev.x+dx*n/steps,py=prev.y+dy*n/steps,el=document.elementFromPoint(px,py)?.closest?.('.cell');if(el)extendPath(+el.dataset.index)}g.lastPointer={x,y}}
function pointerMove(e){if(!currentGame?.dragging)return;const evs=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];for(const ev of evs)samplePointer(ev.clientX,ev.clientY)}
function extendPath(i){const g=currentGame,path=g.path,last=path.at(-1);if(i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();updateActive();return}if(g.used.has(i)||path.includes(i)||!pNeighbours(last).includes(i))return;path.push(i);fx('step');updateActive()}
function pointerUp(){if(!currentGame?.dragging)return;currentGame.dragging=false;currentGame.lastPointer=null;submitPath()}
function currentWord(){return currentGame.path.map(i=>currentGame.puzzle.letters[i]).join('')}
function updateActive(){$$('.cell').forEach(c=>c.classList.toggle('active',currentGame.path.includes(+c.dataset.index)));$('#currentWord').textContent=currentGame.path.length?currentWord():'—';drawPaths()}
function samePath(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function submitPath(){
 const g=currentGame,word=currentWord();if(!word){g.path=[];return updateActive()}g.moves++;
 const ai=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
 const wordIndex=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word),alreadyFound=g.found.some(f=>f.word===word);
 if(ai>=0){const colorIndex=g.found.length%COLORS.length,path=[...g.path];g.found.push({answerIndex:ai,word,colorIndex,path});path.forEach(i=>g.used.set(i,colorIndex));g.lastFound=path;message(`✓ ${word}`,'good');fx('correct')}
 else if(wordIndex>=0){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ sedí. Cesta ne — nepatří do jediného řešení. Zkus ho proplést jinudy.`,'bad');fx('wrong')}
 else if(alreadyFound){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ už máš. Hledej dál.`,'bad');fx('wrong')}
 else{if(word.length>=2)g.wrongAttempts=(g.wrongAttempts||0)+1;message(word.length<3?'Zkus delší slovo.':`„${word}“ do tohohle Propletu nezapadá.`,'bad');fx('wrong')}
 g.path=[];renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';if(g.mode!=='rescue')saveGameProgress();if(g.found.length===g.puzzle.answers.length){if(g.mode==='rescue')finishRescue(true);else finishGame();}
}
function resetGame(){const g=currentGame;if(g.mode==='rescue')return;const usedHints=g.hints||0;g.found=[];g.used=new Map();g.path=[];g.moves=0;g.start=performance.now();g.baseElapsedMs=0;g.elapsedMs=0;g.lastFound=[];g.hints=usedHints;g.cleanSolve=usedHints===0;message(usedHints?'Plocha čistá. Jedeme znovu. Čisté řešení už ale zpátky není.':'Plocha čistá. Jedeme znovu.');renderGameBoard();renderGameHUD();saveGameProgress()}
function openHintModal(){if(!currentGame||currentGame.mode==='rescue'||currentGame.finished)return;$('#hintModal').classList.remove('hidden')}
function pickHintTarget(){return currentGame.puzzle.answers.map((a,i)=>({a,i})).filter(x=>!currentGame.found.some(f=>f.answerIndex===x.i)).sort((x,y)=>(x.a.turns||0)-(y.a.turns||0)||x.a.word.length-y.a.word.length)[0]}
function clearHintTrace(){$$('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}
function applySmartHint(level){const g=currentGame,pick=pickHintTarget();$('#hintModal').classList.add('hidden');if(!pick)return;g.hints=(g.hints||0)+1;g.maxHintLevel=Math.max(g.maxHintLevel||0,level);g.cleanSolve=false;clearHintTrace();const path=pick.a.path;if(level===1){const c=$(`.cell[data-index="${path[0]}"]`);c?.classList.add('hint');message(`Začni na ${pick.a.word[0]}. Hledáš slovo o ${countCz(pick.a.word.length,'písmenu','písmenech','písmenech')}.`)}else if(level===2){path.slice(0,Math.min(3,path.length)).forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}});message(`První tři kroky svítí. Slovo má ${countCz(pick.a.word.length,'písmeno','písmena','písmen')}.`)}else{path.forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-full');if(n<3){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}}});message(`Je to „${pick.a.word}“. Cesta na chvíli svítí.`)}renderGameHUD();saveGameProgress();fx('hint');setTimeout(clearHintTrace,level===3?3600:2600)}
function message(t,kind=''){$('#gameMessage').textContent=t;$('#gameMessage').className=`game-message ${kind}`}
function drawPaths(){
 if(!currentGame)return;const board=$('#board'),svg=$('#pathLayer'),br=board.getBoundingClientRect();if(!br.width)return;svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
 const paths=[...currentGame.found.map(f=>({path:f.path,color:COLORS[f.colorIndex%COLORS.length]}))];if(currentGame.path.length>1)paths.push({path:currentGame.path,color:'#7d6fe7'});
 paths.forEach(({path,color})=>{if(path.length<2)return;const pts=path.map(i=>{const c=$(`.cell[data-index="${i}"]`),r=c.getBoundingClientRect();return `${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`}).join(' ');const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',color);pl.setAttribute('stroke-width','9');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');pl.setAttribute('opacity','.52');svg.appendChild(pl)});
}

async function finishGame(){
 const g=currentGame;g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();const key=challengeKey(g.mode,g.puzzle,g.dailyDate),state=getState(),old=state.completed[key];
 const rec={puzzleId:g.puzzle.id,challengeKey:key,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:pointsFor(g.mode,g.puzzle.difficulty),hintsUsed:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,attemptId:g.attemptId||null,cleanSolve:(g.hints||0)===0,completedAt:new Date().toISOString()};
 if(!old)state.completed[key]=rec;if(state.inProgress?.[key])delete state.inProgress[key];saveState(state);queueResult(rec);
 const beforeLongest=calcLongest(Object.values(getState().completed).filter(r=>r.mode==='daily'&&r.challengeKey!==key).map(r=>r.dailyDate));const stats=effectiveStats(),newBadge=(!old&&g.mode==='daily')?BADGES.find(b=>b.days>beforeLongest&&b.days<=stats.longestStreak):null;
 $('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';$('#winTitle').textContent=g.mode==='daily'?'Dnešní Proplet je doma!':'Propleteno!';const levelSuffix=g.mode==='free'&&g.puzzle.meta?.level?` ${g.puzzle.meta.level}`:'';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')} · ${DIFF[g.puzzle.difficulty].label}${levelSuffix}`;
 $('#winXp').textContent=old&&g.mode==='free'?'Tréninkový pokus · do pořadí platí první výsledek':`+${rec.points} XP`;const wc=$('#winClean');wc.classList.remove('hidden','hinted');wc.textContent=rec.cleanSolve?'✨ Čistě · bez nápovědy':`💡 ${countCz(rec.hintsUsed,'nápověda','nápovědy','nápověd')}`;if(!rec.cleanSolve)wc.classList.add('hinted');$('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join('');
 $('#newBadgeBox').classList.toggle('hidden',!newBadge);if(newBadge)$('#newBadgeBox').innerHTML=`<span class="emoji">${newBadge.icon}</span><strong> Nový odznak: ${newBadge.name}</strong><div>${countCz(newBadge.days,'den','dny','dní')} v řadě</div>`;
 $('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=g.mode==='daily'?'Zpět na dnešek':'Zpět do menu';$('#winPrimaryBtn').textContent=g.mode==='daily'?'Vybrat další hru':'Hraj další úroveň';$('#winModal').classList.remove('hidden');renderWinFeedback();confetti();fx('win');renderDaily();renderFree();renderProfile();
 const sync=syncQueue({announce:false});if(g.mode==='free')sync.finally(()=>loadWinLevelLeaderboard(g.puzzle,rec));else $('#levelLeaderboardBox').classList.add('hidden');
}
function shouldOfferAccountNudge(){
 if(getProfile()?.token||currentGame?.mode==='rescue'||currentGame?.justCompleted!==true)return false;
 return !localStorage.getItem(ACCOUNT_NUDGE_KEY);
}
function performPostWinAction(action){
 const mode=currentGame?.mode,diff=currentGame?.puzzle?.difficulty;
 if(action==='continue'){if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}
 nav(mode==='daily'||mode==='rescue'?'daily':'free',{replace:currentScreen==='game'});
}
function maybeOfferAccountNudge(action){
 if(!shouldOfferAccountNudge())return false;
 localStorage.setItem(ACCOUNT_NUDGE_KEY,JSON.stringify({shownAt:new Date().toISOString()}));
 pendingPostWinAction=action;
 $('#winModal').classList.add('hidden');$('#accountNudgeModal').classList.remove('hidden');
 return true;
}
async function resumeAfterAccountNudge(){
 const action=pendingPostWinAction;pendingPostWinAction=null;profileModalFromNudge=false;
 if(action){if(await maybeOfferPushNudge(action))return;performPostWinAction(action)}
}
function openAccountFromNudge(mode){
 $('#accountNudgeModal').classList.add('hidden');profileModalFromNudge=true;openProfileModal(mode);
}
function dismissAccountNudge(){$('#accountNudgeModal').classList.add('hidden');resumeAfterAccountNudge()}
async function closeWinAndContinue(){if(maybeOfferAccountNudge('continue'))return;if(await maybeOfferPushNudge('continue'))return;$('#winModal').classList.add('hidden');performPostWinAction('continue')}
async function closeWinToMenu(){if(maybeOfferAccountNudge('menu'))return;if(await maybeOfferPushNudge('menu'))return;$('#winModal').classList.add('hidden');performPostWinAction('menu')}
function showDailyResult(date,rec){
 const p=dailyPuzzleFor(date);stopTimer();currentGame={puzzle:p,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};
 $('#winBadge').textContent='☀️';$('#winTitle').textContent='Dnešní Proplet už máš v kapse';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')} · ${DIFF[p.difficulty].label}`;$('#winXp').textContent='+100 XP';const wc=$('#winClean');const knownClean=rec.cleanSolve===true;const hints=rec.hintsUsed||0;wc.classList.remove('hidden','hinted');wc.textContent=knownClean?'✨ Čistě · bez nápovědy':(hints?`💡 ${countCz(hints,'nápověda','nápovědy','nápověd')}`:'Výsledek z dřívější verze');if(!knownClean)wc.classList.add('hinted');
 $('#winWords').innerHTML=p.answers.map((a,i)=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)">${a.word}</span>`).join('');
 $('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Zpět na dnešek';$('#winPrimaryBtn').textContent='Vybrat další hru';$('#winModal').classList.remove('hidden');renderWinFeedback();
}
function shareText(){
 const g=currentGame;if(!g?.puzzle)return `Proplet 🧩

Zahraj si taky: ${SHARE_URL}`;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),rec=getState().completed[key]||g,clean=rec?.cleanSolve===true?'✨ Čistě':(rec?.hintsUsed?`💡 ${countCz(rec.hintsUsed,'nápověda','nápovědy','nápověd')}`:'');
 if(g.mode==='daily'){const stats=effectiveStats(),date=g.dailyDate||pragueDateISO();return `Proplet · ${formatDateCZ(date)}
${DIFF[g.puzzle.difficulty].icon} ${DIFF[g.puzzle.difficulty].label} · ⏱ ${fmtTime(rec.elapsedMs)} · 🔥 ${countCz(stats.currentStreak,'den','dny','dní')}${clean?`
${clean}`:''}

Zahraj si taky: ${SHARE_URL}`}
 const level=g.puzzle.meta?.level||'?';const rank=levelDetailContext?.puzzleId===g.puzzle.id&&levelDetailContext?.myRank?` · ${levelDetailContext.myRank}. místo v lize`:'';
 return `Proplet · ${DIFF[g.puzzle.difficulty].label} · úroveň ${level}${rank}
⏱ ${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')}${clean?` · ${clean}`:''}

Zahraj si taky: ${SHARE_URL}`;
}
async function shareDaily(){const text=shareText();try{if(navigator.share)await navigator.share({title:'Proplet',text});else{await navigator.clipboard.writeText(text);showToast('Výsledek i odkaz jsou ve schránce ✓')}}catch(e){if(e?.name!=='AbortError')showToast('Sdílení se nepovedlo. Zkus to znovu.')}}

function queueResult(rec){
 const q=getQueue();if(rec.mode==='daily'){const i=q.findIndex(x=>x.challengeKey===rec.challengeKey);if(i<0)q.push(rec)}else{const id=rec.attemptId||`${rec.challengeKey}:${rec.completedAt}`;if(!q.some(x=>(x.attemptId||`${x.challengeKey}:${x.completedAt}`)===id))q.push(rec)}saveQueue(q);renderDaily();
}
async function api(path,opts={}){
 const p=getProfile(),headers={'Content-Type':'application/json',...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let r;
 try{r=await fetch(path,{...opts,headers,signal:controller.signal,cache:'no-store'})}catch(e){clearTimeout(timeout);if(e.name==='AbortError')throw new Error('Server se neozval včas');throw new Error(navigator.onLine?'Spojení se serverem selhalo':'Telefon je offline')}
 clearTimeout(timeout);if(!r.ok){let msg=`Server vrátil chybu ${r.status}`;try{const body=await r.json();msg=body.detail||body.message||msg}catch{}throw new Error(msg)}return r.json();
}
async function syncQueue({announce=false}={}){
 const p=getProfile();if(!p?.token){syncState={status:'local',error:null,lastAt:null};if(announce)showToast('Nejdřív připoj hráče k týmu.');renderDaily();renderProfile();return {ok:false,left:getQueue().length,error:'Bez hráče'}}
 const q=getQueue();syncState={status:'syncing',error:null,lastAt:syncState.lastAt};renderProfile();renderDaily();
 if(!q.length){try{await refreshRemoteProfile({throwOnError:true});syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast('Všechno je synchronizované ✓');renderProfile();renderDaily();if(currentScreen==='leaderboard')renderLeaderboard();return {ok:true,left:0}}catch(e){syncState={status:'error',error:e.message,lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace: ${e.message}`);renderProfile();renderDaily();return {ok:false,left:0,error:e.message}}}
 const left=[];let firstError=null,sent=0;
 for(const r of q){try{await api('/api/result',{method:'POST',body:JSON.stringify({puzzle_id:r.puzzleId,challenge_key:r.challengeKey,mode:r.mode,difficulty:r.difficulty,elapsed_ms:Math.max(1000,Math.round(r.elapsedMs)),moves:Math.max(1,r.moves),daily_date:r.dailyDate,hints_used:Math.max(0,r.hintsUsed||0),wrong_attempts:Math.max(0,r.wrongAttempts||0),max_hint_level:Math.max(0,r.maxHintLevel||0),attempt_id:r.attemptId||null,clean_solve:r.cleanSolve===true,completed_at:r.completedAt||null})});sent++}catch(e){left.push(r);if(!firstError)firstError=e.message}}
 saveQueue(left);
 try{await refreshRemoteProfile({throwOnError:left.length===0})}catch(e){if(!firstError)firstError=e.message}
 if(left.length){syncState={status:'error',error:firstError||'Některé výsledky zůstaly ve frontě',lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace selhala: ${syncState.error}`)}else{syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast(sent?`Synchronizováno ${countCz(sent,'výsledek','výsledky','výsledků')} ✓`:'Všechno je synchronizované ✓')}
 renderProfile();renderDaily();if(currentScreen==='leaderboard'&&!left.length)renderLeaderboard();return {ok:!left.length,left:left.length,error:firstError};
}
function mergeRemoteProgress(rows){
 const state=getState();
 for(const r of rows||[]){
  if(!r?.challengeKey)continue;
  const old=state.completed[r.challengeKey];
  if(!old){state.completed[r.challengeKey]=r;if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];continue}
  // Server drží první oficiální dokončení pro Daily i volné úrovně.
  state.completed[r.challengeKey]={...old,...r};
  if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];
 }
 saveState(state);
}
async function refreshRemoteProfile({throwOnError=false}={}){
 const p=getProfile();if(!p?.token)return null;
 try{
  const [me,progress]=await Promise.all([api('/api/me'),api('/api/progress')]);
  mergeRemoteProgress(progress.completed||[]);
  saveProfile({...p,name:me.name,familyCode:me.familyCode,leagueName:me.leagueName,avatar:me.avatar||p.avatar||'🙂',hasPassword:!!me.hasPassword,stats:me.stats});
  return me;
 }catch(e){if(throwOnError)throw e;return null}
}

function updateProfileChip(){const p=getProfile();$('#profileChipText').textContent=p?.name||'Hráč';const a=$('#profileChipAvatar');if(a)a.textContent=p?.avatar||'🙂'}

function setLeagueCreateMode(mode){leagueCreateMode=mode;$('#joinLeagueModeBtn').classList.toggle('active',mode==='join');$('#newLeagueModeBtn').classList.toggle('active',mode==='new');$('#joinLeagueFields').classList.toggle('hidden',mode==='new');$('#newLeagueFields').classList.toggle('hidden',mode!=='new');renderLeaguePinField()}
function renderLeaguePinField(){const l=selectedLeague(),join=leagueCreateMode==='join';const showPin=accountMode==='create'&&join&&!!l;$('#leaguePinLabel').classList.toggle('hidden',!showPin);$('#teamPinHelp').classList.toggle('hidden',!showPin);if(!showPin)$('#leaguePinInput').value=''}
async function loadLeagues(){try{const d=await api('/api/teams');leaguesCache=d.leagues||[]}catch{leaguesCache=[]}const sel=$('#leagueSelect'),prev=sel.value,p=getProfile();const options=['<option value="">Vyber tým…</option>',...leaguesCache.map(l=>`<option value="${esc(l.code)}">${esc(l.name)}${l.members?` · ${countCz(l.members,'hráč','hráči','hráčů')}`:''}</option>` )];sel.innerHTML=options.join('');if(prev&&leaguesCache.some(l=>l.code===prev))sel.value=prev;else if(p?.familyCode&&leaguesCache.some(l=>l.code===p.familyCode))sel.value=p.familyCode;renderLeaguePinField()}
function setAccountMode(mode){
 accountMode=mode;const create=mode==='create';$('#profileModeLogin').classList.toggle('active',!create);$('#profileModeCreate').classList.toggle('active',create);$('#profileModalTitle').textContent=create?'Vytvoř hráče':'Přihlásit hráče';$('#profileModalDesc').textContent=create?'Přidej nového hráče do existujícího týmu pomocí týmového PINu, nebo založ nový tým. Každý hráč má svoje vlastní heslo.':'Vyber tým a zadej svoje hráčské jméno a osobní heslo. PIN týmu při přihlášení nepotřebuješ.';$('#saveProfileBtn').textContent=create?'Vytvořit hráče':'Přihlásit se';$('#playerPasswordInput').setAttribute('autocomplete',create?'new-password':'current-password');$('#leagueCreateTabs').classList.toggle('hidden',!create);if(!create)setLeagueCreateMode('join');$('#profileFormError').textContent='';renderLeaguePinField();
}
async function openProfileModal(mode='login'){
 setAccountMode(mode);$('#profileModal').classList.remove('hidden');await loadLeagues();const p=getProfile();if(p){$('#playerNameInput').value=p.name||'';if(leaguesCache.some(l=>l.code===p.familyCode))$('#leagueSelect').value=p.familyCode}$('#playerPasswordInput').value='';$('#playerPasswordInput').type='password';$('#profilePasswordToggle').textContent='👁 Zobrazit heslo';renderLeaguePinField();
}
async function saveNewProfile(){
 const name=$('#playerNameInput').value.trim(),password=$('#playerPasswordInput').value;$('#profileFormError').textContent='';let family_code='',league_pin=null,create_league=false,league_name=null;
 if(accountMode==='create'&&leagueCreateMode==='new'){league_name=$('#newLeagueNameInput').value.trim();league_pin=$('#newLeaguePinInput').value;family_code=normalizeLeagueCode(league_name);create_league=true;if(!league_name||family_code.length<2){$('#profileFormError').textContent='Pojmenuj nový tým.';return}if((league_pin||'').length<4){$('#profileFormError').textContent='PIN týmu musí mít alespoň 4 znaky.';return}}
 else{const l=selectedLeague();family_code=normalizeLeagueCode(l?.code);if(!family_code){$('#profileFormError').textContent='Vyber tým.';return}if(accountMode==='create'){if(!l?.protected){$('#profileFormError').textContent='Tento tým ještě nemá nastavený vstupní PIN. Některý přihlášený člen ho může nastavit v profilu.';return}league_pin=$('#leaguePinInput').value||null;if((league_pin||'').length<4){$('#profileFormError').textContent='Pro vytvoření nového hráče zadej PIN týmu.';return}}}
 if(!name||!password){$('#profileFormError').textContent='Vyplň jméno a heslo hráče.';return}if(password.length<8){$('#profileFormError').textContent='Heslo hráče musí mít alespoň 8 znaků.';return}
 try{const endpoint=accountMode==='create'?'/api/player':'/api/login',body=accountMode==='create'?{name,family_code,password,league_pin,create_league,league_name}:{name,family_code,password};const profile=await api(endpoint,{method:'POST',body:JSON.stringify(body)});const hadNoProfile=!getProfile();if(hadNoProfile)adoptGuestData(profile.id);saveProfile({id:profile.id,name:profile.name,familyCode:profile.familyCode,leagueName:profile.leagueName,avatar:profile.avatar||'🙂',token:profile.token,hasPassword:!!profile.hasPassword,stats:profile.stats});$('#profileModal').classList.add('hidden');await syncQueue({announce:true});renderProfile();renderDaily();renderFree();renderLeaderboard();if(profileModalFromNudge)resumeAfterAccountNudge()}catch(e){$('#profileFormError').textContent=e.message}
}
function openPasswordModal(){
 $('#passwordFormError').textContent='';$('#setPasswordInput').value='';$('#setPasswordConfirmInput').value='';$('#setPasswordInput').type='password';$('#setPasswordConfirmInput').type='password';$('#setPasswordToggle').textContent='👁 Zobrazit heslo';$('#passwordModal').classList.remove('hidden');
}
async function savePassword(){
 const password=$('#setPasswordInput').value,confirm=$('#setPasswordConfirmInput').value;$('#passwordFormError').textContent='';
 if(password.length<8){$('#passwordFormError').textContent='Heslo musí mít alespoň 8 znaků.';return}
 if(password!==confirm){$('#passwordFormError').textContent='Hesla se neshodují.';return}
 try{
  await api('/api/password',{method:'POST',body:JSON.stringify({password})});
  const p=getProfile();saveProfile({...p,hasPassword:true});$('#passwordModal').classList.add('hidden');showToast('Heslo nastaveno. Teď se můžeš přihlásit i na jiném zařízení ✓');renderProfile();
 }catch(e){$('#passwordFormError').textContent=e.message}
}

function renderProfile(){
 const p=getProfile(),local=currentLocalStats(),stats=effectiveStats(),level=levelFor(stats.points||0),q=getQueue();
 if(!p){
  $('#profileCard').innerHTML=`<h2>Hraješ lokálně</h2><p class="muted">Výsledky se ukládají v tomto zařízení. Přihlášený profil je synchronizuje mezi mobilem, notebookem a týmovým pořadím.</p><div class="account-actions"><button id="profileLoginBtn" class="primary-btn">Přihlásit se</button><button id="profileCreateBtn" class="secondary-btn">Nový hráč</button></div>`;
  setTimeout(()=>{$('#profileLoginBtn')&&($('#profileLoginBtn').onclick=()=>openProfileModal('login'));$('#profileCreateBtn')&&($('#profileCreateBtn').onclick=()=>openProfileModal('create'))},0);
 }else{
  const status=syncState.status==='syncing'?['Synchronizuji…','']:syncState.status==='error'?['Synchronizace čeká',syncState.error||'Neznámá chyba']:q.length?[[countCz(q.length,'výsledek','výsledky','výsledků'),'čeká'].join(' '),'Připoj internet a zkus synchronizovat']:['Vše synchronizováno','Výsledky jsou v týmovém pořadí'];
  const cls=syncState.status==='error'?'error':(!q.length&&syncState.status!=='syncing'?'success':'');
  const account=p.hasPassword
   ?`<div class="account-banner account-ok"><strong>🔐 Hraní na více zařízeních je aktivní</strong><span>Na dalším zařízení vyber tým <b>${esc(p.leagueName||p.familyCode)}</b> a přihlas se jako <b>${esc(p.name)}</b> svým osobním heslem. PIN týmu nepotřebuješ.</span></div>`
   :`<div class="account-banner"><strong>💻 Chceš hrát i na notebooku?</strong><span>Nastav tomuto hráči osobní heslo. Výsledky a XP zůstanou přesně tam, kde jsou.</span><button id="setPasswordBtn" class="secondary-btn">Nastavit heslo hráče</button></div>`;
  const avatars=AVATARS.map(a=>`<button class="avatar-choice ${a===(p.avatar||'🙂')?'selected':''}" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join('');
  $('#profileCard').innerHTML=`<div class="profile-summary"><div class="profile-identity"><div class="profile-avatar-big">${esc(p.avatar||'🙂')}</div><div><div class="profile-name">${esc(p.name)}</div><div class="profile-family">Tým: ${esc(p.leagueName||p.familyCode)}</div></div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>${stats.currentStreak||0}</strong><small>${czPlural(stats.currentStreak||0,'den','dny','dní')}</small></div></div><div class="avatar-picker"><span class="stat-label">TVŮJ AVATAR</span><div class="avatar-grid">${avatars}</div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">XP</span><strong>${stats.points??local.points}</strong></div><div class="profile-stat"><span class="stat-label">Hodnost</span><strong>${level.index}</strong></div><div class="profile-stat"><span class="stat-label">Hotovo</span><strong>${stats.totalCompleted??local.totalCompleted}</strong></div><div class="profile-stat"><span class="stat-label">Výzvy</span><strong>${stats.dailyCompleted??local.dailyCompleted}</strong></div></div>${account}<div class="team-access-card"><div><strong>👥 Přístup do týmu</strong><span>PIN týmu slouží jen jako pozvánka pro vytvoření nového hráče v týmu.</span></div><button id="teamPinBtn" class="secondary-btn">Nastavit / změnit PIN</button></div><div class="sync-panel"><div class="sync-status ${cls}"><div><strong>${esc(status[0])}</strong><div>${esc(status[1])}</div></div><span>${syncState.status==='syncing'?'↻':q.length?'☁️':'✓'}</span></div><button id="syncBtn" class="secondary-btn" ${syncState.status==='syncing'?'disabled':''}>${syncState.status==='syncing'?'Synchronizuji…':`Synchronizovat${q.length?` (${q.length})`:''}`}</button></div><button id="logoutBtn" class="logout-btn">Odhlásit hráče z tohoto zařízení</button>`;
  setTimeout(()=>{
   $('#syncBtn')&&($('#syncBtn').onclick=()=>syncQueue({announce:true}));$('#setPasswordBtn')&&($('#setPasswordBtn').onclick=openPasswordModal);$('#teamPinBtn')&&($('#teamPinBtn').onclick=openTeamPinModal);$('#logoutBtn')&&($('#logoutBtn').onclick=logoutPlayer);
   $$('.avatar-choice').forEach(b=>b.onclick=()=>saveAvatar(b.dataset.avatar));
  },0);
 }
 const points=stats.points||0,longest=stats.longestStreak??local.longestStreak;
 $('#levelRoadmap').innerHTML=LEVELS.map((l,i)=>`<div class="level-step ${points>=l.xp?'earned':''} ${i===level.index-1?'current':''}"><span class="level-num">${i+1}</span><span class="level-step-icon">${l.icon}</span><strong>${l.name}</strong><small>${l.xp.toLocaleString('cs-CZ')} XP</small></div>`).join('');
 $('#profileBadges').innerHTML=BADGES.map(b=>`<div class="profile-badge ${longest>=b.days?'earned':''}"><span class="emoji">${b.icon}</span><strong>${b.name}</strong><small>${countCz(b.days,'den','dny','dní')} v řadě</small></div>`).join('');
 updatePushUI();
 $('#achievementGrid').innerHTML=ACHIEVEMENTS.map(a=>{const v=Math.max(0,a.value(stats)||0),pct=Math.min(100,Math.round(v/a.target*100)),done=a.test(stats);return `<div class="achievement ${done?'earned':''}"><span class="emoji">${a.icon}</span><strong>${a.name}</strong><small>${a.desc}</small><div class="achievement-progress"><span style="width:${pct}%"></span></div><em>${done?'Splněno ✓':`${Math.min(v,a.target)}/${a.target}`}</em></div>`}).join('');renderSettings();
}

async function saveAvatar(avatar){
 const p=getProfile();if(!p?.token)return;try{await api('/api/avatar',{method:'POST',body:JSON.stringify({avatar})});saveProfile({...p,avatar});renderProfile();if(currentScreen==='leaderboard')renderLeaderboard();showToast(`Avatar ${avatar} uložen ✓`)}catch(e){showToast(e.message)}
}
function openTeamPinModal(){const p=getProfile();if(!p?.token){openProfileModal('login');return}$('#teamPinInput').value='';$('#teamPinInput').type='password';$('#teamPinToggle').textContent='👁 Zobrazit PIN';$('#teamPinError').textContent='';$('#teamPinModal').classList.remove('hidden')}
async function saveTeamPin(){const pin=$('#teamPinInput').value;$('#teamPinError').textContent='';if(pin.length<4){$('#teamPinError').textContent='PIN týmu musí mít alespoň 4 znaky.';return}try{await api('/api/team-pin',{method:'POST',body:JSON.stringify({pin})});$('#teamPinModal').classList.add('hidden');showToast('PIN týmu uložen ✓');await loadLeagues()}catch(e){$('#teamPinError').textContent=e.message}}
async function logoutPlayer(){
 const p=getProfile();if(!p)return;const q=getQueue();if(q.length&&navigator.onLine)await syncQueue({announce:false});if(getQueue().length&&!confirm('Některé výsledky ještě čekají na synchronizaci. Opravdu se chceš odhlásit?'))return;
 // Web Push je subscription zařízení. Při střídání hráčů ji odpojíme od starého profilu,
 // aby nový hráč nedostával připomínky podle cizí Denní výzvy.
 try{const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();if(sub){try{await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}await sub.unsubscribe()}}catch{}
 try{await api('/api/logout',{method:'POST'})}catch{}
 localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(PUSH_NUDGE_KEY);localStorage.removeItem(scopedStorageKey(STORE_KEY,'guest'));localStorage.removeItem(scopedStorageKey(QUEUE_KEY,'guest'));syncState={status:'idle',error:null,lastAt:null};currentGame=null;stopTimer();updateProfileChip();renderProfile();renderDaily();renderFree();showToast(`${p.name} je odhlášený. Teď může hrát někdo další.`);nav('daily',{replace:true});
}

function renderSettings(){const s=getSettings(),supported=typeof navigator.vibrate==='function';$('#soundToggle').textContent=`${s.sound?'🔊':'🔇'} Zvuk ${s.sound?'zapnutý':'vypnutý'}`;$('#soundToggle').classList.toggle('on',s.sound);$('#hapticToggle').textContent=supported?`${s.haptics?'📳':'📴'} Vibrace ${s.haptics?'zapnuté':'vypnuté'}`:'📴 Vibrace nepodporovány';$('#hapticToggle').classList.toggle('on',s.haptics&&supported);$('#hapticToggle').disabled=!supported;const test=$('#hapticTestBtn');if(test){test.disabled=!supported||!s.haptics;test.textContent=supported?'📳 Otestovat vibrace':'📴 Prohlížeč vibrace nepodporuje'}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

async function renderLeaderboard(){
 const p=getProfile(),gate=$('#leaderboardGate'),content=$('#leaderboardContent');content.classList.remove('hidden');
 $$('.league-scope-tab').forEach(b=>b.classList.toggle('active',b.dataset.leagueScope===leagueScope));
 const familyPanel=$('#familyLeaderboardPanel'),globalPanel=$('#globalLeaguePanel');
 if(leagueScope==='global'){
  gate.classList.add('hidden');familyPanel.classList.add('hidden');globalPanel.classList.remove('hidden');await renderGlobalLeague();return;
 }
 globalPanel.classList.add('hidden');familyPanel.classList.remove('hidden');
 if(!p?.familyCode){gate.classList.remove('hidden');familyPanel.classList.add('hidden');gate.innerHTML=`<h2>Připoj tým</h2><p class="muted">Přihlas se ke svému hráči, nebo se zatím podívej na 🌍 Ligu týmů.</p><button id="leaderConnectBtn" class="primary-btn big">Přihlásit hráče</button><button id="leaderGlobalBtn" class="secondary-btn bigish">🌍 Liga týmů</button>`;setTimeout(()=>{if($('#leaderConnectBtn'))$('#leaderConnectBtn').onclick=()=>openProfileModal('login');if($('#leaderGlobalBtn'))$('#leaderGlobalBtn').onclick=()=>{leagueScope='global';renderLeaderboard()}},0);return}
 gate.classList.add('hidden');familyPanel.classList.remove('hidden');$('#leaderboardList').innerHTML='<div class="gate card">Načítám pořadí…</div>';
 try{const data=await api(`/api/leaderboard?family_code=${encodeURIComponent(p.familyCode)}&daily_date=${pragueDateISO()}`);renderLeaderData(data)}catch(e){$('#leaderboardList').innerHTML=`<div class="gate card"><strong>Týmové pořadí je offline.</strong><p class="muted">${esc(e.message)}. Lokální hraní funguje dál.</p></div>`}
}
function renderLeaderData(data){const rows=leaderTab==='daily'?data.daily:leaderTab==='weekly'?data.weekly:data.overall;if(!rows.length){$('#leaderboardList').innerHTML='<div class="gate card">Zatím tu nikdo nemá výsledek.</div>';return}$('#leaderboardList').innerHTML=rows.map(r=>{const detail=leaderTab==='daily'?`${r.cleanSolve===true?'✨ Čistě':(r.hintsUsed?`💡 ${r.hintsUsed}×`:'')} ${countCz(r.moves,'tah','tahy','tahů')}`.trim():leaderTab==='weekly'?`☀️ ${countCz(r.daily||0,'výzva','výzvy','výzev')} · ✨ ${r.clean||0} čistě · ${countCz(r.completed||0,'úloha','úlohy','úloh')}`:`🔥 ${countCz(r.currentStreak,'den','dny','dní')} · ${countCz(r.totalCompleted,'úloha','úlohy','úloh')}`,score=leaderTab==='daily'?fmtTime(r.elapsedMs):`${r.points} XP`,label=leaderTab==='daily'?'čas':leaderTab==='weekly'?'tento týden':'celkem';return `<div class="leader-row"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}</strong><small>${detail}</small></div><div class="leader-score"><strong>${score}</strong><small>${label}</small></div></div>`}).join('')}

async function renderGlobalLeague(){
 const list=$('#globalLeagueList'),status=$('#globalLeagueStatus');list.innerHTML='<div class="gate card">Načítám Ligu týmů…</div>';status.innerHTML='';
 try{
  const data=await api(`/api/family-league?week_offset=${globalWeekOffset}`);globalLeagueData=data;
  $('#globalLeagueWeekMeta').textContent=`${formatDateCZ(data.weekStart)} – ${formatDateCZ(data.weekEnd)}`;
  const my=data.myFamily,p=getProfile();
  if(my){
   if(my.enabled){status.innerHTML=`<div class="card my-family-world"><div><span class="eyebrow">TVŮJ TÝM</span><strong>${esc(my.publicName)}</strong><small>${my.eligible?(my.rank?`${my.rank}. místo · ${Math.round(my.score)} / 700 bodů`:'Tento týden zatím bez bodů'):'Liga týmů potřebuje alespoň dva hráče v týmu.'}</small></div><button id="editFamilyWorldBtn" class="secondary-btn">Upravit</button></div>`}
   else{status.innerHTML=`<div class="card global-optin-card"><div><span class="eyebrow">VÁŠ TÝM JE ZATÍM V HLEDIŠTI</span><strong>Pošlete ${esc(my.leagueName)} do Ligy týmů?</strong><small>Veřejně bude vidět jen zvolený název týmu a společné skóre.</small></div><button id="joinFamilyWorldBtn" class="primary-btn">Zapojit tým 🌍</button></div>`}
  }else if(!p?.token){status.innerHTML='<div class="card global-optin-card"><div><strong>Chceš zapojit vlastní rodinu?</strong><small>Přihlas hráče. Samotné pořadí si můžeš prohlížet i bez účtu.</small></div><button id="globalLoginBtn" class="secondary-btn">Přihlásit se</button></div>'}
  const rows=data.standings||[];
  if(!rows.length){list.innerHTML='<div class="gate card"><strong>Startovní rošt je zatím prázdný.</strong><p class="muted">První rodina, která se přihlásí, bere dočasně zlato. 😄</p></div>'}
  else list.innerHTML=rows.map(r=>`<div class="leader-row family-world-row ${r.isMine?'me':''}"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.name)}</strong><small>${countCz(r.memberCount,'člen','členové','členů')} · hráno ${r.daysPlayed}/7 dní</small></div><div class="leader-score"><strong>${Math.round(r.score)}</strong><small>/ 700</small></div></div>`).join('');
  setTimeout(()=>{if($('#editFamilyWorldBtn'))$('#editFamilyWorldBtn').onclick=openFamilyLeagueModal;if($('#joinFamilyWorldBtn'))$('#joinFamilyWorldBtn').onclick=openFamilyLeagueModal;if($('#globalLoginBtn'))$('#globalLoginBtn').onclick=()=>openProfileModal('login')},0);
 }catch(e){list.innerHTML=`<div class="gate card"><strong>Liga týmů je zrovna mimo hřiště.</strong><p class="muted">${esc(e.message)}</p></div>`}
}
function openFamilyLeagueModal(){
 const p=getProfile();if(!p?.token){openProfileModal('login');return}const my=globalLeagueData?.myFamily;if(!my){showToast('Nejdřív načti Ligu týmů.');return}
 $('#familyLeaguePublicName').value=my.publicName||my.leagueName||'';$('#familyLeagueModalError').textContent='';$('#enableFamilyLeagueBtn').textContent=my.enabled?'Uložit změny':'Zařadit tým do Ligy týmů 🌍';$('#disableFamilyLeagueBtn').classList.toggle('hidden',!my.enabled);$('#familyLeagueModal').classList.remove('hidden');
}
async function saveFamilyLeagueSettings(enabled){
 const name=$('#familyLeaguePublicName').value.trim();$('#familyLeagueModalError').textContent='';if(enabled&&name.length<2){$('#familyLeagueModalError').textContent='Pojmenuj veřejný tým.';return}
 try{await api('/api/family-league/settings',{method:'POST',body:JSON.stringify({enabled,public_name:name||null})});$('#familyLeagueModal').classList.add('hidden');showToast(enabled?'Tým je v Lize týmů 🌍':'Tým z Ligy týmů vystoupil.');await renderGlobalLeague()}catch(e){$('#familyLeagueModalError').textContent=e.message}
}

async function sendPuzzleFeedback(kind,{rating=null,word=null,note=null}={}){
 const p=getProfile(),g=currentGame;if(!p?.token||!g?.puzzle||g.mode==='rescue')throw new Error('Pro hodnocení se přihlas ke svému hráči.');
 return api('/api/feedback',{method:'POST',body:JSON.stringify({puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),kind,rating,word,note})});
}
async function rateDifficulty(rating,btn){
 try{await sendPuzzleFeedback('difficulty',{rating});$$('[data-difficulty-rating]').forEach(b=>b.classList.toggle('selected',b===btn));winFeedbackSent=true;showToast('Díky — pomáháš kalibrovat obtížnost ✓')}catch(e){showToast(e.message)}
}
function openWordReport(){
 const g=currentGame;if(!g?.puzzle)return;const select=$('#reportWordSelect');select.innerHTML=g.puzzle.answers.map(a=>`<option value="${esc(a.word)}">${esc(a.word)}</option>`).join('');$('#reportWordNote').value='';$('#wordReportError').textContent='';$('#wordReportModal').classList.remove('hidden');
}
async function saveWordReport(){
 const word=$('#reportWordSelect').value,note=$('#reportWordNote').value.trim();$('#wordReportError').textContent='';try{await sendPuzzleFeedback('word',{word,note});$('#wordReportModal').classList.add('hidden');showToast('Díky. Slovo je nahlášené ✓')}catch(e){$('#wordReportError').textContent=e.message}
}
function renderWinFeedback(){
 const logged=!!getProfile()?.token,g=currentGame,show=logged&&g?.finished&&g.mode!=='rescue';$('#winDifficultyFeedback')?.classList.toggle('hidden',!show);$('#reportWordBtn')?.classList.toggle('hidden',!show);$$('[data-difficulty-rating]').forEach(b=>b.classList.remove('selected'));winFeedbackSent=false;
}
function showUpdateBanner(worker){pendingSW=worker;$('#updateBanner')?.classList.remove('hidden')}
function registerServiceWorker(){
 if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
 navigator.serviceWorker.register('/sw.js').then(reg=>{
  if(reg.waiting)showUpdateBanner(reg.waiting);
  reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner(w)})});
  reg.update().catch(()=>{});
 }).catch(()=>{});
 let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
}

function ensureAudio(){if(!getSettings().sound)return;try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
function tone(freq,duration=0.06,volume=0.025,delay=0){if(!getSettings().sound)return;ensureAudio();if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(0.0001,t+duration);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+duration+.02)}
function vibrate(pattern){if(!getSettings().haptics||typeof navigator.vibrate!=='function')return false;try{return navigator.vibrate(pattern)}catch{return false}}
function fx(type){if(type==='tap'){tone(300,.035,.012);vibrate(24)}else if(type==='step'){tone(360,.028,.009);vibrate(20)}else if(type==='correct'){tone(520,.07,.025);tone(700,.09,.022,.055);vibrate(52)}else if(type==='wrong'){tone(180,.09,.018);vibrate([42,32,42])}else if(type==='hint'){tone(620,.08,.018);vibrate(34)}else if(type==='win'){tone(520,.09,.028);tone(660,.1,.026,.08);tone(820,.15,.025,.16);vibrate([50,35,70,40,95])}}
function testHaptics(){const s=getSettings();if(!s.haptics){showToast('Nejdřív zapni vibrace.');return}if(typeof navigator.vibrate!=='function'){showToast('Tento prohlížeč vibrace nepodporuje.');return}const ok=vibrate([65,45,105]);showToast(ok===false?'Telefon nebo prohlížeč vibraci odmítl. Zkontroluj systémové vibrace.':'Testovací pulz odeslán 📳 Pokud nic necítíš, zkontroluj systémové vibrace.') }
function confetti(){const layer=$('#confettiLayer');layer.innerHTML='';const cs=['#6c5ce7','#55cfa7','#ff816f','#ffd66b','#73a7ff','#f391c3'];for(let i=0;i<28;i++){const el=document.createElement('i');el.className='confetti';el.style.setProperty('--x',`${(Math.random()-.5)*260}px`);el.style.setProperty('--drift',`${(Math.random()-.5)*140}px`);el.style.setProperty('--rot',`${Math.random()*180}deg`);el.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);el.style.setProperty('--c',cs[i%cs.length]);el.style.animationDelay=`${Math.random()*.18}s`;layer.appendChild(el)}setTimeout(()=>layer.innerHTML='',2400)}
function showToast(text){const t=$('#toast');clearTimeout(toastTimer);t.textContent=text;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),3300)}



const ONBOARD_STEPS=[
 {title:'Vítej v Propletu',html:`<div class="onboard-hero-mark">P</div><div class="onboard-content"><span class="eyebrow">RYCHLÝ ÚVOD</span><h2>Propleť celou plochu</h2><p class="muted">Najdi všechna slova tak, aby každé aktivní políčko patřilo právě jednomu z nich. Táhni jen nahoru, dolů, vlevo nebo vpravo. <b>Pozor: nestačí najít správné slovo. Musíš najít i jeho správnou cestu, která zapadne do jediného řešení celé plochy.</b></p><div class="onboard-points"><div class="onboard-point"><span>↕️</span><div><strong>Jen sousední políčka</strong><small>Nahoru, dolů, vlevo nebo vpravo. Diagonály neplatí.</small></div></div><div class="onboard-point"><span>🎨</span><div><strong>Každé slovo má svou barvu</strong><small>Cílem je obarvit celou aktivní plochu.</small></div></div></div></div>`},
 {title:'Zkus si první tah',interactive:true,html:`<div class="onboard-content"><span class="eyebrow">TEĎ TY</span><h2>Najdi slovo PES</h2><p class="muted">Je schované přes roh. Písmena musí sousedit a cesta může zatáčet.</p><div class="tutorial-wrap"><div class="tutorial-instruction">Najdi PES:</div><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">L</div><div class="tutorial-cell" data-tidx="3">A</div><div class="tutorial-cell" data-tidx="4">S</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`},
 {title:'Jak číst herní obrazovku',html:`<div class="onboard-content"><span class="eyebrow">BĚHEM HRY</span><h2>Všechno důležité je po ruce</h2><p class="muted">Nahoře máš dva jasné řádky: <b>Zbývá</b> ukazuje délky ještě nenalezených slov a <b>Nalezeno</b> skutečná chycená slova. <b>Skládáš</b> ti pořád ukazuje, co právě vedeš prstem. Na velké obrazovce Foldu nebo tabletu zůstává vedle desky pořád na očích.</p><div class="onboard-points"><div class="onboard-point"><span>🔢</span><div><strong>Zbývá / Nalezeno</strong><small>Zbývající délky řadíme od nejkratších. Chycená slova zůstávají barevně vidět.</small></div></div><div class="onboard-point"><span>🔒</span><div><strong>Správná cesta se zamkne</strong><small>Když Proplet slovo přijme, jeho políčka už patří do jediného řešení.</small></div></div></div></div>`},
 {title:'Výzva, čisté řešení a série',html:`<div class="onboard-content"><span class="eyebrow">A JEŠTĚ TŘI VĚCI</span><h2>Teď už víš skoro všechno</h2><div class="onboard-points"><div class="onboard-point"><span>✨</span><div><strong>Čisté řešení</strong><small>Vyřeš úroveň bez nápovědy. V pořadí Denní výzvy má čisté řešení přednost před časem.</small></div></div><div class="onboard-point"><span>💡</span><div><strong>Tři stupně nápovědy</strong><small>Od jemného postrčení až po odhalení celé cesty.</small></div></div><div class="onboard-point"><span>🔥</span><div><strong>Série má jednu záchrannou brzdu</strong><small>Když vynecháš jeden den, můžeš ji zachránit 30sekundovým 6×6 Propletem. Jen jeden pokus.</small></div></div></div></div>`}
];

function openOnboarding(force=false){
 let seen=false;try{seen=!!localStorage.getItem(ONBOARD_KEY)}catch{}if(!force&&seen)return;onboardingMandatory=!force&&!seen;onboardingStep=0;tutorialState={dragging:false,path:[],done:false};$('#skipOnboardingBtn').classList.toggle('hidden',onboardingMandatory);$('#onboardingModal').classList.remove('hidden');renderOnboarding();
}
function closeOnboarding(forceClose=false){if(onboardingMandatory&&!forceClose)return;try{localStorage.setItem(ONBOARD_KEY,'done')}catch{}$('#onboardingModal').classList.add('hidden');tutorialState={dragging:false,path:[],done:false};onboardingMandatory=false}
function renderOnboarding(){
 const step=ONBOARD_STEPS[onboardingStep],modal=$('.onboarding-card');
 $('#onboardDots').innerHTML=ONBOARD_STEPS.map((_,i)=>`<i class="${i===onboardingStep?'active':''}"></i>`).join('');
 $('#onboardContent').innerHTML=step.html;modal.classList.toggle('waiting-interaction',!!step.interactive&&!tutorialState.done);
 $('#onboardNextBtn').textContent=onboardingStep===ONBOARD_STEPS.length-1?'Jdu hrát 🧩':(step.interactive&&!tutorialState.done?'Nejdřív najdi PES':'Pokračovat');
 if(step.interactive)setTimeout(bindTutorial,0);
}
function onboardingNext(){
 if(ONBOARD_STEPS[onboardingStep]?.interactive&&!tutorialState.done)return;
 if(onboardingStep<ONBOARD_STEPS.length-1){onboardingStep++;renderOnboarding()}else{onboardingMandatory=false;closeOnboarding(true);nav('daily')}
}
function tutorialAdj(a,b){const ar=Math.floor(a/3),ac=a%3,br=Math.floor(b/3),bc=b%3;return Math.abs(ar-br)+Math.abs(ac-bc)===1}
function renderTutorialPath(){
 $$('.tutorial-cell').forEach(c=>{const i=+c.dataset.tidx;c.classList.toggle('active',tutorialState.path.includes(i));if(tutorialState.done&&[0,1,4].includes(i)){c.classList.remove('active');c.classList.add('done')}});
}
function bindTutorial(){
 const board=$('#tutorialBoard');if(!board)return;
 const add=i=>{const p=tutorialState.path,last=p.at(-1);if(i===last)return;if(p.length>1&&i===p.at(-2)){p.pop();renderTutorialPath();return}if(p.includes(i)||last==null||!tutorialAdj(last,i))return;p.push(i);renderTutorialPath()};
 $$('.tutorial-cell').forEach(c=>c.onpointerdown=e=>{e.preventDefault();tutorialState.dragging=true;tutorialState.path=[+c.dataset.tidx];renderTutorialPath();try{c.setPointerCapture(e.pointerId)}catch{}});
 board.onpointermove=e=>{if(!tutorialState.dragging)return;const c=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.tutorial-cell');if(c)add(+c.dataset.tidx)};
 const finish=()=>{if(!tutorialState.dragging)return;tutorialState.dragging=false;const ok=tutorialState.path.join(',')==='0,1,4';if(ok){tutorialState.done=true;$('#tutorialSuccess').textContent='✓ PES! Přes roh. Přesně tak.';fx('correct');renderTutorialPath();$('.onboarding-card').classList.remove('waiting-interaction');$('#onboardNextBtn').textContent='Super, dál'}else{$('#tutorialSuccess').textContent='PES tam je. Zkus nechat cestu jednou zahnout.';fx('wrong');tutorialState.path=[];renderTutorialPath()}};
 board.onpointerup=finish;board.onpointercancel=finish;
}


async function openPlayedLevels(diff){
 const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').textContent=`${d.icon} ${d.label} · odehrané úrovně`;$('#playedLevelsMeta').textContent='Načítám tvoje první dokončené pokusy…';$('#playedLevelsList').innerHTML='';modal.classList.remove('hidden');const p=getProfile();let levels=[];
 try{if(p?.token){const data=await api(`/api/played-levels?difficulty=${encodeURIComponent(diff)}`);levels=data.levels||[]}else{const state=getState();levels=sortedFreeBank(diff).map(x=>{const r=state.completed[`free:${x.id}`];return r?{puzzleId:x.id,level:x.meta?.level,elapsedMs:r.elapsedMs,moves:r.moves,hintsUsed:r.hintsUsed||0,cleanSolve:r.cleanSolve===true,attempts:1}:null}).filter(Boolean)}}catch(e){$('#playedLevelsMeta').textContent=e.message;return}
 $('#playedLevelsMeta').textContent=levels.length?`${countCz(levels.length,'odehraná úroveň','odehrané úrovně','odehraných úrovní')} ze 100`:'Zatím tu nic není. Nejdřív něco propleť.';
 $('#playedLevelsList').innerHTML=levels.length?levels.map(r=>`<button class="played-level-row" data-level-puzzle="${esc(r.puzzleId)}" data-level-diff="${diff}"><span class="level-index">${r.level}.</span><span class="level-history-main"><strong>${fmtTime(r.elapsedMs)}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}${r.attempts>1?` · hráno ${r.attempts}×`:''}</small></span><span class="played-arrow">›</span></button>`).join(''):'<div class="empty-history">Tady zatím fouká vítr. 🌬️</div>';
 $$('[data-level-puzzle]').forEach(b=>b.onclick=()=>openLevelDetail(b.dataset.levelDiff,b.dataset.levelPuzzle));
}
function localLevelResult(puzzleId){return getState().completed[`free:${puzzleId}`]||null}
async function fetchPuzzleLeaderboard(puzzleId){const p=getProfile();if(!p?.familyCode)return {rows:[],anonymous:true};return api(`/api/puzzle-leaderboard?puzzle_id=${encodeURIComponent(puzzleId)}&family_code=${encodeURIComponent(p.familyCode)}`)}
function renderPuzzleLeaderboardBox(container,data,myId){
 if(data?.anonymous){container.innerHTML='<div class="leaderboard-empty"><strong>Přihlas se a porovnej se s rodinou.</strong><small>Žebříček srovnává přesně tuhle úroveň.</small></div>';return null}const rows=data?.rows||[],my=rows.find(r=>r.id===myId);if(!rows.length){container.innerHTML='<div class="leaderboard-empty">Zatím jsi tady první. To je docela slušný začátek. 👑</div>';return null}container.innerHTML=`<div class="level-board-head"><strong>🏁 Pořadí této úrovně</strong>${my?`<span>Ty: ${my.rank}. místo</span>`:''}<small>Počítá se první dokončený pokus.</small></div>`+rows.slice(0,5).map(r=>`<div class="mini-leader-row ${r.id===myId?'me':''}"><b>${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</b><span><strong>${esc(r.name)}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`}</small></span><em>${fmtTime(r.elapsedMs)}</em></div>`).join('');return my?.rank||null;
}
async function loadWinLevelLeaderboard(puzzle,rec){const box=$('#levelLeaderboardBox');if(!box||currentGame?.mode!=='free'){box?.classList.add('hidden');return}box.classList.remove('hidden');box.innerHTML='<div class="leaderboard-empty">Načítám pořadí…</div>';try{const data=await fetchPuzzleLeaderboard(puzzle.id),rank=renderPuzzleLeaderboardBox(box,data,getProfile()?.id);levelDetailContext={puzzleId:puzzle.id,difficulty:puzzle.difficulty,level:puzzle.meta?.level,myRank:rank,result:rec}}catch(e){box.innerHTML=`<div class="leaderboard-empty">Pořadí se teď nepodařilo načíst. <small>${esc(e.message)}</small></div>`}}
async function openLevelDetail(diff,puzzleId){
 const puzzle=sortedFreeBank(diff).find(p=>p.id===puzzleId);if(!puzzle)return;const rec=localLevelResult(puzzleId);levelDetailContext={puzzleId,difficulty:diff,level:puzzle.meta?.level,myRank:null,result:rec};$('#levelDetailEyebrow').textContent=`${DIFF[diff].label.toUpperCase()} · ÚROVEŇ ${puzzle.meta?.level||'?'}`;$('#levelDetailTitle').textContent=`${DIFF[diff].icon} ${DIFF[diff].label} ${puzzle.meta?.level||''}`;$('#levelDetailResult').innerHTML=rec?`<strong>${fmtTime(rec.elapsedMs)}</strong><span>${rec.cleanSolve?'✨ Čistě':`💡 ${countCz(rec.hintsUsed||0,'nápověda','nápovědy','nápověd')}`} · ${countCz(rec.moves,'tah','tahy','tahů')}</span><small>Do pořadí se počítá první dokončený pokus.</small>`:'<span>Výsledek není na tomto zařízení uložený.</span>';$('#levelDetailLeaderboard').innerHTML='<div class="leaderboard-empty">Načítám pořadí…</div>';$('#levelDetailModal').classList.remove('hidden');try{const data=await fetchPuzzleLeaderboard(puzzleId);levelDetailContext.myRank=renderPuzzleLeaderboardBox($('#levelDetailLeaderboard'),data,getProfile()?.id)}catch(e){$('#levelDetailLeaderboard').innerHTML=`<div class="leaderboard-empty">${esc(e.message)}</div>`}
}
async function shareLevelDetail(){const c=levelDetailContext;if(!c)return;const p=sortedFreeBank(c.difficulty).find(x=>x.id===c.puzzleId),rec=localLevelResult(c.puzzleId)||c.result;if(!p||!rec)return;const clean=rec.cleanSolve?'✨ Čistě':`💡 ${rec.hintsUsed||0}×`,rank=c.myRank?` · ${c.myRank}. místo v lize`:'';const text=`Proplet · ${DIFF[c.difficulty].label} · úroveň ${c.level}${rank}\n⏱ ${fmtTime(rec.elapsedMs)} · ${clean} · ${countCz(rec.moves,'tah','tahy','tahů')}\n\nZahraj si taky: ${SHARE_URL}`;try{if(navigator.share)await navigator.share({title:'Proplet',text});else{await navigator.clipboard.writeText(text);showToast('Výsledek i odkaz jsou ve schránce ✓')}}catch(e){if(e?.name!=='AbortError')showToast('Sdílení se nepovedlo.')}
}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function getPushRegistration(){if(!('serviceWorker' in navigator))throw new Error('Tento prohlížeč neumí oznámení PWA.');return navigator.serviceWorker.ready}
function getPushNudgeState(){try{return JSON.parse(localStorage.getItem(PUSH_NUDGE_KEY)||'{}')}catch{return {}}}
function savePushNudgeState(v){localStorage.setItem(PUSH_NUDGE_KEY,JSON.stringify(v))}
function pushNudgeDue(){
 const st=getPushNudgeState();if(st.accepted||st.done||st.disabledByUser||st.systemDenied)return false;
 if(!st.nextOfferDate)return true;return pragueDateISO()>=st.nextOfferDate;
}
async function shouldOfferPushNudge(){
 const p=getProfile(),g=currentGame;if(!p?.token||g?.mode!=='daily'||g?.justCompleted!==true||!pushNudgeDue())return false;
 if(!('Notification' in window)||!('PushManager' in window)||Notification.permission==='denied')return false;
 try{const cfg=await api('/api/push/config');if(!cfg.available)return false;const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();if(sub){savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return false}return true}catch{return false}
}
async function maybeOfferPushNudge(action){
 if(!(await shouldOfferPushNudge()))return false;pendingPushPostWinAction=action;$('#winModal').classList.add('hidden');$('#pushNudgeModal').classList.remove('hidden');return true;
}
function finishPushNudgeFlow(){const action=pendingPushPostWinAction;pendingPushPostWinAction=null;$('#pushNudgeModal').classList.add('hidden');if(action)performPostWinAction(action)}
function dismissPushNudge(){
 const st=getPushNudgeState(),declines=(st.declines||0)+1,today=pragueDateISO();
 if(declines>=3)savePushNudgeState({...st,declines,done:true,lastDeclinedAt:new Date().toISOString()});
 else savePushNudgeState({...st,declines,nextOfferDate:addDaysISO(today,declines===1?1:7),lastDeclinedAt:new Date().toISOString()});
 finishPushNudgeFlow();
}
async function enablePushReminder(){
 const cfg=await api('/api/push/config');if(!cfg.available)throw new Error('Push ještě není nakonfigurovaný na serveru.');const reg=await getPushRegistration(),existing=await reg.pushManager.getSubscription();if(existing){savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return existing}
 const permission=await Notification.requestPermission();if(permission!=='granted'){savePushNudgeState({...getPushNudgeState(),done:true,systemDenied:true,deniedAt:new Date().toISOString()});throw new Error('Oznámení nejsou povolená. Později je můžeš zapnout v nastavení webu/prohlížeče.')}
 const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.publicKey)}),j=sub.toJSON();await api('/api/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth:j.keys?.auth,user_agent:navigator.userAgent.slice(0,240)})});savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return sub;
}
async function acceptPushNudge(){
 if(pushUiBusy)return;pushUiBusy=true;$('#pushNudgeEnableBtn').disabled=true;try{await enablePushReminder();showToast('Denní připomínka zapnutá 🔔');finishPushNudgeFlow()}catch(e){showToast(e.message)}finally{pushUiBusy=false;$('#pushNudgeEnableBtn').disabled=false;updatePushUI()}
}
async function updatePushUI(){
 const btn=$('#pushToggleBtn'),text=$('#pushStatusText');if(!btn||pushUiBusy)return;const p=getProfile();if(!p?.token){btn.disabled=false;btn.textContent='🔔 Přihlásit a nastavit připomínku';text.textContent='Připomínka se váže ke konkrétnímu hráči.';return}if(!('Notification' in window)||!('PushManager' in window)){btn.disabled=true;btn.textContent='🔕 Oznámení nejsou podporována';text.textContent='Na tomto zařízení/prohlížeči Web Push není dostupný.';return}try{const cfg=await api('/api/push/config');if(!cfg.available){btn.disabled=true;btn.textContent='🔔 Připomínka čeká na nastavení serveru';text.textContent='Hraní funguje normálně. Push ještě není nakonfigurovaný.';return}const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();btn.disabled=false;btn.textContent=sub?'🔕 Vypnout denní připomínku':'🔔 Zapnout denní připomínku';text.textContent=sub?'Zapnuto. Ráno připomeneme jen nevyřešenou Denní výzvu.':Notification.permission==='denied'?'Oznámení jsou v prohlížeči zablokovaná.':'Dobrovolné. O povolení požádáme až po klepnutí.'}catch(e){btn.disabled=true;btn.textContent='🔔 Připomínka není dostupná';text.textContent=e.message}
}
async function togglePushReminder(){
 const p=getProfile();if(!p?.token){openProfileModal('login');return}if(pushUiBusy)return;pushUiBusy=true;const btn=$('#pushToggleBtn');btn.disabled=true;try{const cfg=await api('/api/push/config');if(!cfg.available)throw new Error('Push ještě není nakonfigurovaný na serveru.');const reg=await getPushRegistration(),existing=await reg.pushManager.getSubscription();if(existing){await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:existing.endpoint})});await existing.unsubscribe();savePushNudgeState({done:true,disabledByUser:true,disabledAt:new Date().toISOString()});showToast('Denní připomínka vypnutá.')}else{await enablePushReminder();showToast('Denní připomínka zapnutá 🔔')}}catch(e){showToast(e.message)}finally{pushUiBusy=false;updatePushUI()}
}

function bind(){
 $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$('#playDailyBtn').onclick=startDaily;$('#shareDailyBtn').onclick=()=>{const date=pragueDateISO(),rec=getState().completed[`daily:${date}`];currentGame={puzzle:dailyPuzzleFor(date),mode:'daily',dailyDate:date,elapsedMs:rec?.elapsedMs,moves:rec?.moves,finished:true};shareDaily()};
 $('#backFromGame').onclick=goBackFromGame;$('#resetBtn').onclick=resetGame;$('#hintBtn').onclick=openHintModal;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;
 $('#closeProfileModal').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromNudge)resumeAfterAccountNudge() };$('#skipProfileBtn').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromNudge)resumeAfterAccountNudge() };$('#saveProfileBtn').onclick=saveNewProfile;$('#profileModeLogin').onclick=()=>setAccountMode('login');$('#profileModeCreate').onclick=()=>setAccountMode('create');$('#joinLeagueModeBtn').onclick=()=>setLeagueCreateMode('join');$('#newLeagueModeBtn').onclick=()=>setLeagueCreateMode('new');$('#leagueSelect').onchange=renderLeaguePinField;$('#profilePasswordToggle').onclick=()=>togglePassword('playerPasswordInput',$('#profilePasswordToggle'));
 $('#nudgeCreateBtn').onclick=()=>openAccountFromNudge('create');$('#nudgeLoginBtn').onclick=()=>openAccountFromNudge('login');$('#nudgeSkipBtn').onclick=dismissAccountNudge;
 $('#closePasswordModal').onclick=()=>$('#passwordModal').classList.add('hidden');$('#savePasswordBtn').onclick=savePassword;$('#setPasswordToggle').onclick=()=>togglePassword(['setPasswordInput','setPasswordConfirmInput'],$('#setPasswordToggle'));
 $('#closeTeamPinModal').onclick=()=>$('#teamPinModal').classList.add('hidden');$('#saveTeamPinBtn').onclick=saveTeamPin;$('#teamPinToggle').onclick=()=>togglePassword('teamPinInput',$('#teamPinToggle'));
 $('#closeHintModal').onclick=()=>$('#hintModal').classList.add('hidden');$$('[data-hint-level]').forEach(b=>b.onclick=()=>applySmartHint(+b.dataset.hintLevel));
 $('#rescueBtn').onclick=openRescueOffer;$('#confirmRescueBtn').onclick=beginRescue;$('#cancelRescueBtn').onclick=()=>$('#rescueOfferModal').classList.add('hidden');
 $('#skipOnboardingBtn').onclick=()=>closeOnboarding(false);$('#onboardNextBtn').onclick=onboardingNext;
 $$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});
 $$('.league-scope-tab').forEach(b=>b.onclick=()=>{leagueScope=b.dataset.leagueScope;renderLeaderboard()});$$('.global-week-tab').forEach(b=>b.onclick=()=>{globalWeekOffset=Number(b.dataset.weekOffset||0);$$('.global-week-tab').forEach(x=>x.classList.toggle('active',x===b));renderGlobalLeague()});$('#familyLeagueSettingsBtn').onclick=openFamilyLeagueModal;$('#closeFamilyLeagueModal').onclick=()=>$('#familyLeagueModal').classList.add('hidden');$('#enableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(true);$('#disableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(false);
 $('#openAllGamesBtn').onclick=()=>nav('free');$('#pushToggleBtn').onclick=togglePushReminder;$('#pushNudgeEnableBtn').onclick=acceptPushNudge;$('#pushNudgeLaterBtn').onclick=dismissPushNudge;$('#closePlayedLevelsModal').onclick=()=>$('#playedLevelsModal').classList.add('hidden');$('#closeLevelDetailModal').onclick=()=>$('#levelDetailModal').classList.add('hidden');$('#levelDetailReplayBtn').onclick=()=>{const c=levelDetailContext;if(!c)return;const p=sortedFreeBank(c.difficulty).find(x=>x.id===c.puzzleId);if(!p)return;$('#levelDetailModal').classList.add('hidden');$('#playedLevelsModal').classList.add('hidden');startGame(p,'free')};$('#levelDetailShareBtn').onclick=shareLevelDetail;
 $$('[data-difficulty-rating]').forEach(b=>b.onclick=()=>rateDifficulty(+b.dataset.difficultyRating,b));$('#reportWordBtn').onclick=openWordReport;$('#closeWordReportModal').onclick=()=>$('#wordReportModal').classList.add('hidden');$('#saveWordReportBtn').onclick=saveWordReport;$('#applyUpdateBtn').onclick=()=>pendingSW?.postMessage({type:'SKIP_WAITING'});
 $('#soundToggle').onclick=()=>{const s=getSettings();s.sound=!s.sound;saveSettings(s);renderSettings();if(s.sound){ensureAudio();tone(620,.08,.02)}};$('#hapticToggle').onclick=()=>{const s=getSettings();s.haptics=!s.haptics;saveSettings(s);renderSettings();if(s.haptics)vibrate(45)};$('#hapticTestBtn').onclick=testHaptics;$('#replayIntroBtn').onclick=()=>openOnboarding(true);
 $('#board').addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('resize',()=>{fitGameBoard();drawPaths()});window.addEventListener('online',()=>syncQueue({announce:false}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveGameProgress();else if(getQueue().length)syncQueue({announce:false})});window.addEventListener('pagehide',saveGameProgress);
}

async function boot(){
 try{puzzleDB=await fetch('/puzzles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})}catch{$('body').innerHTML='<main style="padding:30px;font-family:system-ui"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Spusť aplikaci přes server podle README.</p></main>';return}
 migrateScopedStorage();bind();initNavigation();updateProfileChip();renderDaily();renderFree();renderProfile();syncQueue({announce:false});refreshRescueStatus();setTimeout(()=>openOnboarding(false),260);
 registerServiceWorker();setTimeout(updatePushUI,700);
 let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily()}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);
}
boot();
