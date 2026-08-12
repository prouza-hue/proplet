const APP_VERSION='3.5';
const COLORS=['#ff9585','#68cfaa','#7ca8ff','#ffd064','#b295ff','#f391c3','#62cbd8','#ffad63','#a6d86d','#76c3ee','#da87e4','#66bea0'];
const DIFF={
  easy:{label:'Snadná',icon:'🌱',desc:'Menší 6×6 plocha, klidnější cesty.',xp:10},
  medium:{label:'Střední',icon:'🧠',desc:'Větší 7×8 plocha a víc možností.',xp:20},
  hard:{label:'Těžká',icon:'🧨',desc:'Střídá 8×8 a 9×9. Slova se často kroutí jako šnek.',xp:35},
  hardcore:{label:'Mozkožrout',icon:'🤯',desc:'10×10, 12–15 slov a hodně zatáček. Na delší sezení.',xp:60}
};
const BADGES=[
 {days:1,icon:'🥉',name:'První zářez'},{days:3,icon:'❤️',name:'Srdcař'},{days:5,icon:'⭐',name:'Pětka'},
 {days:7,icon:'🔥',name:'Týden v plamenech'},{days:10,icon:'🏆',name:'Desítka'},{days:14,icon:'⚡',name:'Blesk'},
 {days:21,icon:'🦉',name:'Mistr slov'},{days:30,icon:'👑',name:'Koruna'},{days:50,icon:'💎',name:'Diamant'},{days:100,icon:'🚀',name:'Legenda'}
];
const LEVELS=[
 {xp:0,icon:'🌱',name:'Nováček'},{xp:100,icon:'🧩',name:'Písmenkář'},{xp:250,icon:'🔎',name:'Slovolovec'},
 {xp:500,icon:'🪢',name:'Propletač'},{xp:900,icon:'🧠',name:'Mistr cest'},{xp:1500,icon:'✨',name:'Slovní mág'},
 {xp:2500,icon:'👑',name:'Legenda Propletu'},{xp:4000,icon:'🐉',name:'Krotitel'},{xp:6500,icon:'💎',name:'Velmistr Propletu'},
 {xp:10000,icon:'🌌',name:'Nadslovník'}
];
const ACHIEVEMENTS=[
 {icon:'🧩',name:'První Proplet',desc:'Vyřeš první úlohu',value:s=>s.totalCompleted||0,target:1},
 {icon:'🔟',name:'Rozjezd',desc:'Vyřeš 10 úloh',value:s=>s.totalCompleted||0,target:10},
 {icon:'💯',name:'Stovka',desc:'Nasbírej 100 XP',value:s=>s.points||0,target:100},
 {icon:'🧠',name:'Mozkovna',desc:'5 středních úloh',value:s=>s.freeCompleted?.medium||0,target:5},
 {icon:'🧨',name:'Nebojácný',desc:'3 těžké úlohy',value:s=>s.freeCompleted?.hard||0,target:3},
 {icon:'🤯',name:'Mozkožrout',desc:'Dokonči první Mozkožrout',value:s=>s.freeCompleted?.hardcore||0,target:1},
 {icon:'☀️',name:'Ranní ptáče',desc:'5 Daily výzev',value:s=>s.dailyCompleted||0,target:5},
 {icon:'🔥',name:'Držíš nit',desc:'7denní streak',value:s=>s.longestStreak||0,target:7},
 {icon:'⚡',name:'Rychlík',desc:'Daily pod 2 minuty',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<120000?1:0,target:1},
 {icon:'✨',name:'Bez berliček',desc:'10 clean solve bez nápovědy',value:s=>s.cleanSolves||0,target:10}
];
ACHIEVEMENTS.forEach(a=>a.test=s=>a.value(s)>=a.target);
const SHARE_URL='https://proplet-nine.vercel.app/';
const STORE_KEY='proplet-v2-state';
const PROFILE_KEY='proplet-v2-profile';
const QUEUE_KEY='proplet-v2-sync-queue';
const SETTINGS_KEY='proplet-v3-settings';
const ONBOARD_KEY='proplet-v3-4-onboarding';
const ACCOUNT_NUDGE_KEY='proplet-v3-5-account-nudge';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let puzzleDB=null;
let currentScreen='daily';
let currentGame=null;
let timerId=null;
let leaderTab='daily';
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
let profileModalFromNudge=false;

function blankState(){return {completed:{},rescues:{},inProgress:{},dailyDates:[],statsVersion:5};}
function getState(){try{return {...blankState(),...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}}catch{return blankState()}}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s))}
function getProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function saveProfile(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));updateProfileChip()}
function getQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch{return []}}
function saveQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}
function getSettings(){try{return {sound:true,haptics:true,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return {sound:true,haptics:true}}}
function saveSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}

function fmtTime(ms){if(ms==null)return '—';const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function formatDateCZ(iso){const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)))}
function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
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
 window.addEventListener('popstate',e=>{
  const modal=openTransientModal();
  if(modal){
   if(modal.id==='winModal'&&shouldOfferAccountNudge())maybeOfferAccountNudge('menu');
   else if(modal.id==='accountNudgeModal')dismissAccountNudge();
   else if(modal.id==='profileModal'&&profileModalFromNudge){modal.classList.add('hidden');resumeAfterAccountNudge()}
   else modal.classList.add('hidden');
   history.pushState({proplet:true,screen:currentScreen},'',location.href);return
  }
  const screen=e.state?.proplet&&ROUTE_SCREENS.has(e.state.screen)?e.state.screen:'daily';nav(screen,{fromPop:true});
 });
}
function transientModals(){return ['winModal','accountNudgeModal','profileModal','passwordModal','hintModal','rescueOfferModal','onboardingModal','wordReportModal'].map(id=>document.getElementById(id)).filter(Boolean)}
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
 $('#levelCard').innerHTML=`<div class="level-orb">${l.current.icon}</div><div class="level-copy"><div class="level-top"><strong>Level ${l.index} · ${l.current.name}</strong><span>${stats.points||0} XP</span></div><div class="xp-track"><span style="width:${l.pct}%"></span></div><div class="level-hint">${l.next?`${toNext} XP do levelu „${l.next.name}“`:'Max level. Respekt. 👑'}</div></div>`;
}
function renderDaily(){
 const date=pragueDateISO(),p=dailyPuzzleFor(date),stats=effectiveStats(),done=getState().completed[`daily:${date}`],risk=rescueStatus&&(rescueStatus.state==='available'||rescueStatus.state==='started');
 $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${p.meta.cells} políček · ${p.answers.length} slov`;
 const shownStreak=risk?Math.max(stats.currentStreak||0,rescueStatus.priorStreak||0):stats.currentStreak;$('#streakCount').textContent=shownStreak;$('#streakBubble').classList.toggle('at-risk',!!risk);$('#dailyCompletedStat').textContent=stats.dailyCompleted;$('#longestStreakStat').textContent=stats.longestStreak;$('#bestDailyStat').textContent=fmtTime(stats.bestDailyMs);
 $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':'Hrát dnešní výzvu';$('#shareDailyBtn').classList.toggle('hidden',!done);renderLevelCard(stats);
 const streakForGoal=risk?shownStreak:stats.currentStreak,next=BADGES.find(b=>streakForGoal<b.days);$('#nextBadgeText').textContent=risk?'🔥 Nejdřív zachraň streak':(next?`${next.icon} ${next.days-streakForGoal} d. do „${next.name}“`:'🚀 Jsi legenda');
 $('#badgeRail').innerHTML=BADGES.slice(0,8).map(b=>`<div class="badge-step ${stats.longestStreak>=b.days?'earned':''} ${!risk&&next?.days===b.days?'current':''}"><span class="emoji">${b.icon}</span><strong>${b.days} dní</strong><small>${b.name}</small></div>`).join('');
 const sync=$('#dailySyncStatus');if(!done){sync.classList.add('hidden')}else{sync.classList.remove('hidden');const pfile=getProfile(),queued=getQueue().some(r=>r.challengeKey===`daily:${date}`);if(!pfile?.token)sync.textContent='📱 Výsledek je uložený v tomto telefonu';else if(queued)sync.textContent=syncState.status==='error'?`⚠️ Čeká na synchronizaci: ${syncState.error||'zkus to znovu'}`:'☁️ Výsledek čeká na synchronizaci';else sync.textContent='✓ Výsledek je v rodinné lize';}
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
 card.classList.remove('hidden');$('#rescueTitle').textContent=`${rs.priorStreak}denní streak je v ohrožení`;
 $('#rescueText').textContent=rs.state==='started'?`Záchranný pokus už běží. Zbývá přibližně ${Math.ceil(rs.secondsRemaining||0)} s.`:`Včerejší Daily ti utekla. Máš jeden pokus, jak navázat tam, kde jsi skončil.`;
 $('#rescueBtn').textContent=rs.state==='started'?`Pokračovat · ${Math.ceil(rs.secondsRemaining||0)} s`:'Zachránit streak · 30 s';
}
function openRescueOffer(){
 const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started'))return;
 $('#rescueOfferTitle').textContent=rs.state==='started'?'Záchrana už běží!':'Chceš zachránit streak?';
 $('#rescueOfferText').textContent=rs.state==='started'?`Zbývá ti asi ${Math.ceil(rs.secondsRemaining||0)} sekund. Čas běží i mimo obrazovku.`:`Máš ${rs.priorStreak} dní v řadě. Když zvládneš rychlý Proplet do 30 sekund, streak pokračuje. Když ne, předchozí série končí.`;
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
 $('#winModal').classList.remove('hidden');$('#winBadge').textContent=ok?'🔥':'💨';$('#winTitle').textContent=ok?'Streak zachráněn!':'Streak tentokrát padl';$('#winText').textContent=ok?`Hotovo za ${fmtTime(elapsed)}. Tvoje série pokračuje.`:'Pokus je vyčerpaný. Dnešní Daily může odstartovat novou sérii.';$('#winXp').textContent=ok?'Streak pokračuje · bez XP':'Nový začátek';$('#winClean').classList.add('hidden');$('#winWords').innerHTML=ok?g.found.map(f=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join(''):'';$('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').textContent='Zpět na dnešek';renderWinFeedback();if(ok){confetti();fx('win')}else fx('wrong');await refreshRescueStatus();renderProfile();
}
function failRescue(){finishRescue(false)}

function freeProgress(diff){
 const s=getState(),list=puzzleDB?.free?.[diff]||[],total=list.length,done=list.filter(p=>s.completed[`free:${p.id}`]).length,resume=resumableFreePuzzle(diff,list),pct=total?Math.round(done/total*100):0;
 return {list,total,done,resume,pct};
}
function renderQuickPlay(){
 const root=$('#quickPlayGrid');if(!root||!puzzleDB)return;
 root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),status=q.resume?'Pokračovat':q.done===q.total&&q.total?'Hotovo · hrát znovu':`${q.done}/${q.total}`;return `<button class="quick-game" data-quick-free="${key}" data-diff="${key}"><span class="quick-game-icon">${d.icon}</span><span class="quick-game-copy"><strong>${d.label}</strong><small>${status}</small><i><b style="width:${q.pct}%"></b></i></span><span class="quick-game-arrow">›</span></button>`}).join('');
 $$('[data-quick-free]').forEach(b=>b.onclick=()=>startFree(b.dataset.quickFree));
}

function renderFree(){
 const s=getState();$('#difficultyCards').innerHTML=Object.entries(DIFF).map(([key,d])=>{
  const {list,total,done,pct,resume}=freeProgress(key),next=Math.min(done+1,total);
  const progressLabel=resume?'ROZEHRÁNO':(done===total?`${done}/${total} HOTOVO`:`ÚROVEŇ ${next} Z ${total}`);
  return `<article class="difficulty-card card" data-diff="${key}"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${d.icon}</span><div><span class="eyebrow">${progressLabel}</span><h2>${d.label}</h2></div></div><p class="muted">${d.desc}</p><span class="xp-chip">+${d.xp} XP za novou úlohu</span><div class="progress-line"><span style="width:${pct}%"></span></div></div><div class="difficulty-progress" data-play-free="${key}" role="button" tabindex="0" aria-label="${resume?'Pokračovat v rozehrané':'Hrát'} ${d.label}" style="--progress:${pct}%"><div><strong>${done}</strong><small>/${total}</small></div><span>›</span></div><button class="secondary-btn" data-play-free="${key}">${resume?'Pokračovat':(done===total?'Hrát znovu':'Hraj další úroveň')}</button></article>`
 }).join('');
 $$('[data-play-free]').forEach(b=>{b.onclick=e=>{e.stopPropagation();startFree(b.dataset.playFree)};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startFree(b.dataset.playFree)}}});
}
function startFree(diff){
 const s=getState(),list=[...(puzzleDB.free[diff]||[])].sort((a,b)=>(a.meta?.difficultyScore||0)-(b.meta?.difficultyScore||0)),resume=resumableFreePuzzle(diff,list),unsolved=list.filter(p=>!s.completed[`free:${p.id}`]);
 const p=resume||(unsolved.length?unsolved[0]:list[Math.floor(Math.random()*list.length)]);if(p)startGame(p,'free',null);
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
 $('#screen-game').classList.toggle('rescue-mode',mode==='rescue');$('#gameModeLabel').textContent=mode==='daily'?'Denní výzva':mode==='rescue'?'Záchrana streaku':'Volná hra';$('#gameDifficulty').textContent=mode==='rescue'?'🔥 6×6 · jeden pokus':`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}`;
 $('#timer').textContent=mode==='rescue'?fmtCountdown(remaining):fmtTime(baseElapsedMs);message(restored?(mode==='daily'?'Pokračuješ. U Daily čas běžel i mimo herní obrazovku.':'Pokračuješ přesně tam, kde jsi skončil.'):'Nejde jen o slovo — jeho cesta musí zapadnout do jediného řešení.');nav('game');renderGameBoard();renderGameHUD();startTimer();if(mode!=='rescue')saveGameProgress();startAttemptTelemetry(currentGame);
}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function fmtCountdown(ms){const sec=Math.max(0,Math.ceil(ms/1000));return `00:${String(sec).padStart(2,'0')}`}
function startTimer(){stopTimer();timerId=setInterval(()=>{if(!currentGame||currentGame.finished)return;const live=performance.now()-currentGame.start;if(currentGame.mode==='rescue'){currentGame.rescueElapsedMs=currentGame.rescueOffsetMs+live;const rem=currentGame.rescueTotalLimitMs-currentGame.rescueElapsedMs;$('#timer').textContent=fmtCountdown(rem);if(rem<=0){stopTimer();finishRescue(false)}}else{currentGame.elapsedMs=gameElapsed(currentGame);$('#timer').textContent=fmtTime(currentGame.elapsedMs);if(Date.now()-(currentGame.lastAutosaveAt||0)>5000)saveGameProgress()}},currentGame?.mode==='rescue'?100:250)}
function renderGameHUD(){const g=currentGame,p=g.puzzle;$('#moves').textContent=`${g.moves} tahů`;$('#gameProgress').textContent=`${g.found.length}/${p.answers.length}`;$('#lengths').innerHTML=p.lengths.map((len,i)=>{const found=g.found.find(f=>f.answerIndex===i);return `<span class="length-pill ${found?'found':''}" title="${found?found.word:`${len} písmen`}" ${found?`style="background:color-mix(in srgb,${COLORS[found.colorIndex%COLORS.length]} 58%,white)"`:''}>${found?found.word:len}</span>`}).join('');$('#undoBtn').disabled=!g.found.length;const clean=$('#cleanStatus');clean.textContent=g.mode==='rescue'?'':(g.hints?'💡 S nápovědou':'✨ Clean');clean.classList.toggle('lost',!!g.hints);$('#hintBtn').textContent=g.hints?`💡 ${g.hints}×`:'💡 Nápověda'}
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
 else if(wordIndex>=0){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ je správné slovo, ale tahle cesta nepatří do jediného řešení. Zkus jinou trasu.`,'bad');fx('wrong')}
 else if(alreadyFound){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ už máš vyřešené.`,'bad');fx('wrong')}
 else{if(word.length>=2)g.wrongAttempts=(g.wrongAttempts||0)+1;message(word.length<3?'Zkus delší slovo.':`„${word}“ do řešení nezapadá.`,'bad');fx('wrong')}
 g.path=[];renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';if(g.mode!=='rescue')saveGameProgress();if(g.found.length===g.puzzle.answers.length){if(g.mode==='rescue')finishRescue(true);else finishGame();}
}
function undo(){const g=currentGame,f=g.found.pop();if(!f)return;f.path.forEach(i=>g.used.delete(i));g.moves++;message(`Vráceno: ${f.word}`);renderGameBoard();renderGameHUD();saveGameProgress()}
function resetGame(){const g=currentGame;if(g.mode==='rescue')return;const usedHints=g.hints||0;g.found=[];g.used=new Map();g.path=[];g.moves=0;g.start=performance.now();g.baseElapsedMs=0;g.elapsedMs=0;g.lastFound=[];g.hints=usedHints;g.cleanSolve=usedHints===0;message(usedHints?'Úloha resetována. Clean solve zůstává zrušený.':'Úloha resetována.');renderGameBoard();renderGameHUD();saveGameProgress()}
function openHintModal(){if(!currentGame||currentGame.mode==='rescue'||currentGame.finished)return;$('#hintModal').classList.remove('hidden')}
function pickHintTarget(){return currentGame.puzzle.answers.map((a,i)=>({a,i})).filter(x=>!currentGame.found.some(f=>f.answerIndex===x.i)).sort((x,y)=>(x.a.turns||0)-(y.a.turns||0)||x.a.word.length-y.a.word.length)[0]}
function clearHintTrace(){$$('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}
function applySmartHint(level){const g=currentGame,pick=pickHintTarget();$('#hintModal').classList.add('hidden');if(!pick)return;g.hints=(g.hints||0)+1;g.maxHintLevel=Math.max(g.maxHintLevel||0,level);g.cleanSolve=false;clearHintTrace();const path=pick.a.path;if(level===1){const c=$(`.cell[data-index="${path[0]}"]`);c?.classList.add('hint');message(`Začni písmenem ${pick.a.word[0]}. Slovo má ${pick.a.word.length} písmen.`)}else if(level===2){path.slice(0,Math.min(3,path.length)).forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}});message(`Tři první kroky jsou zvýrazněné. Slovo má ${pick.a.word.length} písmen.`)}else{path.forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-full');if(n<3){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}}});message(`Hledané slovo je „${pick.a.word}“. Jeho cesta na chvíli svítí.`)}renderGameHUD();saveGameProgress();fx('hint');setTimeout(clearHintTrace,level===3?3600:2600)}
function message(t,kind=''){$('#gameMessage').textContent=t;$('#gameMessage').className=`game-message ${kind}`}
function drawPaths(){
 if(!currentGame)return;const board=$('#board'),svg=$('#pathLayer'),br=board.getBoundingClientRect();if(!br.width)return;svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
 const paths=[...currentGame.found.map(f=>({path:f.path,color:COLORS[f.colorIndex%COLORS.length]}))];if(currentGame.path.length>1)paths.push({path:currentGame.path,color:'#7d6fe7'});
 paths.forEach(({path,color})=>{if(path.length<2)return;const pts=path.map(i=>{const c=$(`.cell[data-index="${i}"]`),r=c.getBoundingClientRect();return `${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`}).join(' ');const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',color);pl.setAttribute('stroke-width','9');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');pl.setAttribute('opacity','.52');svg.appendChild(pl)});
}

async function finishGame(){
 const g=currentGame;g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();const key=challengeKey(g.mode,g.puzzle,g.dailyDate),state=getState(),old=state.completed[key];
 const rec={puzzleId:g.puzzle.id,challengeKey:key,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:pointsFor(g.mode,g.puzzle.difficulty),hintsUsed:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,attemptId:g.attemptId||null,cleanSolve:(g.hints||0)===0,completedAt:new Date().toISOString()};
 if(!old){state.completed[key]=rec}else if(g.mode==='free'){state.completed[key]={...old,elapsedMs:Math.min(old.elapsedMs,rec.elapsedMs),moves:Math.min(old.moves,rec.moves),hintsUsed:Math.min(old.hintsUsed??99,rec.hintsUsed),wrongAttempts:Math.min(old.wrongAttempts??999,rec.wrongAttempts),maxHintLevel:Math.min(old.maxHintLevel??3,rec.maxHintLevel),cleanSolve:old.cleanSolve===true||rec.cleanSolve===true}}if(state.inProgress?.[key])delete state.inProgress[key];saveState(state);queueResult(rec);
 const beforeLongest=calcLongest(Object.values(getState().completed).filter(r=>r.mode==='daily'&&r.challengeKey!==key).map(r=>r.dailyDate));const stats=effectiveStats();const newBadge=(!old&&g.mode==='daily')?BADGES.find(b=>b.days>beforeLongest&&b.days<=stats.longestStreak):null;
 $('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';$('#winTitle').textContent=g.mode==='daily'?'Daily hotovo!':'Vyřešeno!';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${rec.moves} tahů · ${DIFF[g.puzzle.difficulty].label}`;
 $('#winXp').textContent=old&&g.mode==='free'?'Osobní rekord se může zlepšit':`+${rec.points} XP`;const wc=$('#winClean');wc.classList.remove('hidden','hinted');wc.textContent=rec.cleanSolve?'✨ Clean solve · bez nápovědy':`💡 ${rec.hintsUsed}× nápověda`;if(!rec.cleanSolve)wc.classList.add('hinted');$('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join('');
 $('#newBadgeBox').classList.toggle('hidden',!newBadge);if(newBadge)$('#newBadgeBox').innerHTML=`<span class="emoji">${newBadge.icon}</span><strong> Nový odznak: ${newBadge.name}</strong><div>${newBadge.days} dní v řadě</div>`;
 $('#winShareBtn').classList.toggle('hidden',g.mode!=='daily');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=g.mode==='daily'?'Zpět na dnešek':'Zpět do menu';$('#winPrimaryBtn').textContent=g.mode==='daily'?'Vybrat další hru':'Hraj další úroveň';$('#winModal').classList.remove('hidden');renderWinFeedback();confetti();fx('win');renderDaily();renderFree();renderProfile();syncQueue({announce:false});
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
function resumeAfterAccountNudge(){
 const action=pendingPostWinAction;pendingPostWinAction=null;profileModalFromNudge=false;
 if(action)performPostWinAction(action);
}
function openAccountFromNudge(mode){
 $('#accountNudgeModal').classList.add('hidden');profileModalFromNudge=true;openProfileModal(mode);
}
function dismissAccountNudge(){$('#accountNudgeModal').classList.add('hidden');resumeAfterAccountNudge()}
function closeWinAndContinue(){if(maybeOfferAccountNudge('continue'))return;$('#winModal').classList.add('hidden');performPostWinAction('continue')}
function closeWinToMenu(){if(maybeOfferAccountNudge('menu'))return;$('#winModal').classList.add('hidden');performPostWinAction('menu')}
function showDailyResult(date,rec){
 const p=dailyPuzzleFor(date);stopTimer();currentGame={puzzle:p,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};
 $('#winBadge').textContent='☀️';$('#winTitle').textContent='Dnešní Daily už máš hotovou';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${rec.moves} tahů · ${DIFF[p.difficulty].label}`;$('#winXp').textContent='+100 XP';const wc=$('#winClean');const knownClean=rec.cleanSolve===true;const hints=rec.hintsUsed||0;wc.classList.remove('hidden','hinted');wc.textContent=knownClean?'✨ Clean solve · bez nápovědy':(hints?`💡 ${hints}× nápověda`:'Výsledek z dřívější verze');if(!knownClean)wc.classList.add('hinted');
 $('#winWords').innerHTML=p.answers.map((a,i)=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)">${a.word}</span>`).join('');
 $('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Zpět na dnešek';$('#winPrimaryBtn').textContent='Vybrat další hru';$('#winModal').classList.remove('hidden');renderWinFeedback();
}
function shareText(){const g=currentGame,stats=effectiveStats(),date=g?.dailyDate||pragueDateISO(),p=g?.puzzle||dailyPuzzleFor(date),rec=getState().completed[`daily:${date}`];const time=g?.elapsedMs||rec?.elapsedMs,clean=rec?.cleanSolve===true?'✨ Clean solve':(rec?.hintsUsed?`💡 ${rec.hintsUsed}× nápověda`:'');return `Proplet · ${formatDateCZ(date)}\n${DIFF[p.difficulty].icon} ${DIFF[p.difficulty].label} · ⏱ ${fmtTime(time)} · 🔥 ${stats.currentStreak} dní${clean?`\n${clean}`:''}\n${stats.currentStreak?BADGES.filter(b=>b.days<=stats.longestStreak).at(-1)?.icon||'🧩':'🧩'} Proplet\n\nZahraj si taky: ${SHARE_URL}`}
async function shareDaily(){const text=shareText();try{if(navigator.share)await navigator.share({title:'Proplet',text});else{await navigator.clipboard.writeText(text);showToast('Výsledek i odkaz jsou ve schránce ✓')}}catch(e){if(e?.name!=='AbortError')showToast('Sdílení se nepovedlo. Zkus to znovu.')}}

function queueResult(rec){
 const q=getQueue(),i=q.findIndex(x=>x.challengeKey===rec.challengeKey);if(i<0)q.push(rec);else if(rec.mode==='free')q[i]={...q[i],elapsedMs:Math.min(q[i].elapsedMs,rec.elapsedMs),moves:Math.min(q[i].moves,rec.moves),hintsUsed:Math.min(q[i].hintsUsed??99,rec.hintsUsed??99),wrongAttempts:Math.min(q[i].wrongAttempts??999,rec.wrongAttempts??999),maxHintLevel:Math.min(q[i].maxHintLevel??3,rec.maxHintLevel??3),attemptId:rec.attemptId||q[i].attemptId,cleanSolve:q[i].cleanSolve===true||rec.cleanSolve===true};saveQueue(q);renderDaily();
}
async function api(path,opts={}){
 const p=getProfile(),headers={'Content-Type':'application/json',...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let r;
 try{r=await fetch(path,{...opts,headers,signal:controller.signal,cache:'no-store'})}catch(e){clearTimeout(timeout);if(e.name==='AbortError')throw new Error('Server se neozval včas');throw new Error(navigator.onLine?'Spojení se serverem selhalo':'Telefon je offline')}
 clearTimeout(timeout);if(!r.ok){let msg=`Server vrátil chybu ${r.status}`;try{const body=await r.json();msg=body.detail||body.message||msg}catch{}throw new Error(msg)}return r.json();
}
async function syncQueue({announce=false}={}){
 const p=getProfile();if(!p?.token){syncState={status:'local',error:null,lastAt:null};if(announce)showToast('Nejdřív připoj hráče k rodině.');renderDaily();renderProfile();return {ok:false,left:getQueue().length,error:'Bez hráče'}}
 const q=getQueue();syncState={status:'syncing',error:null,lastAt:syncState.lastAt};renderProfile();renderDaily();
 if(!q.length){try{await refreshRemoteProfile({throwOnError:true});syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast('Všechno je synchronizované ✓');renderProfile();renderDaily();if(currentScreen==='leaderboard')renderLeaderboard();return {ok:true,left:0}}catch(e){syncState={status:'error',error:e.message,lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace: ${e.message}`);renderProfile();renderDaily();return {ok:false,left:0,error:e.message}}}
 const left=[];let firstError=null,sent=0;
 for(const r of q){try{await api('/api/result',{method:'POST',body:JSON.stringify({puzzle_id:r.puzzleId,challenge_key:r.challengeKey,mode:r.mode,difficulty:r.difficulty,elapsed_ms:Math.max(1000,Math.round(r.elapsedMs)),moves:Math.max(1,r.moves),daily_date:r.dailyDate,hints_used:Math.max(0,r.hintsUsed||0),wrong_attempts:Math.max(0,r.wrongAttempts||0),max_hint_level:Math.max(0,r.maxHintLevel||0),attempt_id:r.attemptId||null,clean_solve:r.cleanSolve===true})});sent++}catch(e){left.push(r);if(!firstError)firstError=e.message}}
 saveQueue(left);
 try{await refreshRemoteProfile({throwOnError:left.length===0})}catch(e){if(!firstError)firstError=e.message}
 if(left.length){syncState={status:'error',error:firstError||'Některé výsledky zůstaly ve frontě',lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace selhala: ${syncState.error}`)}else{syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast(sent?`Synchronizováno ${sent} výsledků ✓`:'Všechno je synchronizované ✓')}
 renderProfile();renderDaily();if(currentScreen==='leaderboard'&&!left.length)renderLeaderboard();return {ok:!left.length,left:left.length,error:firstError};
}
function mergeRemoteProgress(rows){
 const state=getState();
 for(const r of rows||[]){
  if(!r?.challengeKey)continue;
  const old=state.completed[r.challengeKey];
  if(!old){state.completed[r.challengeKey]=r;if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];continue}
  if(r.mode==='free'){
   state.completed[r.challengeKey]={...old,...r,elapsedMs:Math.min(old.elapsedMs??Infinity,r.elapsedMs??Infinity),moves:Math.min(old.moves??Infinity,r.moves??Infinity),hintsUsed:Math.min(old.hintsUsed??99,r.hintsUsed??99),wrongAttempts:Math.min(old.wrongAttempts??999,r.wrongAttempts??999),maxHintLevel:Math.min(old.maxHintLevel??3,r.maxHintLevel??3),cleanSolve:old.cleanSolve===true||r.cleanSolve===true};
  }else{
   // Daily is immutable: keep the server's first official result on every device.
   state.completed[r.challengeKey]={...old,...r};
  }
  if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];
 }
 saveState(state);
}
async function refreshRemoteProfile({throwOnError=false}={}){
 const p=getProfile();if(!p?.token)return null;
 try{
  const [me,progress]=await Promise.all([api('/api/me'),api('/api/progress')]);
  mergeRemoteProgress(progress.completed||[]);
  saveProfile({...p,name:me.name,familyCode:me.familyCode,hasPassword:!!me.hasPassword,stats:me.stats});
  return me;
 }catch(e){if(throwOnError)throw e;return null}
}

function updateProfileChip(){const p=getProfile();$('#profileChipText').textContent=p?.name||'Hráč'}

function setAccountMode(mode){
 accountMode=mode;
 const create=mode==='create';
 $('#profileModeLogin').classList.toggle('active',!create);$('#profileModeCreate').classList.toggle('active',create);
 $('#profileModalTitle').textContent=create?'Vytvoř hráče':'Přihlásit hráče';
 $('#profileModalDesc').textContent=create?'Jméno je v rodině unikátní. Heslo ti později dovolí hrát pod stejným profilem i na dalších zařízeních.':'Použij stejné jméno, rodinný kód a heslo jako na prvním zařízení.';
 $('#saveProfileBtn').textContent=create?'Vytvořit hráče':'Přihlásit se';
 $('#playerPasswordInput').setAttribute('autocomplete',create?'new-password':'current-password');
 $('#profileFormError').textContent='';
}
function openProfileModal(mode='login'){
 setAccountMode(mode);$('#profileModal').classList.remove('hidden');
 const p=getProfile();if(p){$('#playerNameInput').value=p.name||'';$('#familyCodeInput').value=p.familyCode||''}
 $('#playerPasswordInput').value='';
}
async function saveNewProfile(){
 const name=$('#playerNameInput').value.trim(),family_code=$('#familyCodeInput').value.trim(),password=$('#playerPasswordInput').value;
 $('#profileFormError').textContent='';
 if(!name||!family_code||!password){$('#profileFormError').textContent='Vyplň jméno, rodinný kód i heslo.';return}
 if(password.length<8){$('#profileFormError').textContent='Heslo musí mít alespoň 8 znaků.';return}
 try{
  const endpoint=accountMode==='create'?'/api/player':'/api/login';
  const profile=await api(endpoint,{method:'POST',body:JSON.stringify({name,family_code,password})});
  saveProfile({id:profile.id,name:profile.name,familyCode:profile.familyCode,token:profile.token,hasPassword:!!profile.hasPassword,stats:profile.stats});
  $('#profileModal').classList.add('hidden');
  await syncQueue({announce:true});renderProfile();renderDaily();renderFree();renderLeaderboard();
  if(profileModalFromNudge)resumeAfterAccountNudge();
 }catch(e){$('#profileFormError').textContent=e.message}
}
function openPasswordModal(){
 $('#passwordFormError').textContent='';$('#setPasswordInput').value='';$('#setPasswordConfirmInput').value='';$('#passwordModal').classList.remove('hidden');
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
  $('#profileCard').innerHTML=`<h2>Hraješ lokálně</h2><p class="muted">Výsledky se ukládají v tomto zařízení. Přihlášený profil je synchronizuje mezi mobilem, notebookem a rodinným leaderboardem.</p><div class="account-actions"><button id="profileLoginBtn" class="primary-btn">Přihlásit se</button><button id="profileCreateBtn" class="secondary-btn">Nový hráč</button></div>`;
  setTimeout(()=>{$('#profileLoginBtn')&&($('#profileLoginBtn').onclick=()=>openProfileModal('login'));$('#profileCreateBtn')&&($('#profileCreateBtn').onclick=()=>openProfileModal('create'))},0);
 }else{
  const status=syncState.status==='syncing'?['Synchronizuji…','']:syncState.status==='error'?['Synchronizace čeká',syncState.error||'Neznámá chyba']:q.length?[`${q.length} výsledků čeká`,'Připoj internet a zkus synchronizovat']:['Vše synchronizováno','Výsledky jsou v rodinné lize'];
  const cls=syncState.status==='error'?'error':(!q.length&&syncState.status!=='syncing'?'success':'');
  const account=p.hasPassword
   ?`<div class="account-banner account-ok"><strong>🔐 Hraní na více zařízeních je aktivní</strong><span>Na dalším zařízení se přihlas jako <b>${esc(p.name)}</b> se stejným rodinným kódem a heslem.</span></div>`
   :`<div class="account-banner"><strong>💻 Chceš hrát i na notebooku?</strong><span>Nastav tomuto stávajícímu profilu heslo. Výsledky a XP zůstanou přesně tam, kde jsou.</span><button id="setPasswordBtn" class="secondary-btn">Nastavit heslo</button></div>`;
  $('#profileCard').innerHTML=`<div class="profile-summary"><div><div class="profile-name">${esc(p.name)}</div><div class="profile-family">Rodina: ${esc(p.familyCode)}</div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>${stats.currentStreak||0}</strong><small>dní</small></div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">XP</span><strong>${stats.points??local.points}</strong></div><div class="profile-stat"><span class="stat-label">Level</span><strong>${level.index}</strong></div><div class="profile-stat"><span class="stat-label">Hotovo</span><strong>${stats.totalCompleted??local.totalCompleted}</strong></div><div class="profile-stat"><span class="stat-label">Daily</span><strong>${stats.dailyCompleted??local.dailyCompleted}</strong></div></div>${account}<div class="sync-panel"><div class="sync-status ${cls}"><div><strong>${esc(status[0])}</strong><div>${esc(status[1])}</div></div><span>${syncState.status==='syncing'?'↻':q.length?'☁️':'✓'}</span></div><button id="syncBtn" class="secondary-btn" ${syncState.status==='syncing'?'disabled':''}>${syncState.status==='syncing'?'Synchronizuji…':`Synchronizovat${q.length?` (${q.length})`:''}`}</button></div>`;
  setTimeout(()=>{$('#syncBtn')&&($('#syncBtn').onclick=()=>syncQueue({announce:true}));$('#setPasswordBtn')&&($('#setPasswordBtn').onclick=openPasswordModal)},0);
 }
 const points=stats.points||0,longest=stats.longestStreak??local.longestStreak;
 $('#levelRoadmap').innerHTML=LEVELS.map((l,i)=>`<div class="level-step ${points>=l.xp?'earned':''} ${i===level.index-1?'current':''}"><span class="level-num">${i+1}</span><span class="level-step-icon">${l.icon}</span><strong>${l.name}</strong><small>${l.xp.toLocaleString('cs-CZ')} XP</small></div>`).join('');
 $('#profileBadges').innerHTML=BADGES.map(b=>`<div class="profile-badge ${longest>=b.days?'earned':''}"><span class="emoji">${b.icon}</span><strong>${b.name}</strong><small>${b.days} dní v řadě</small></div>`).join('');
 $('#achievementGrid').innerHTML=ACHIEVEMENTS.map(a=>{const v=Math.max(0,a.value(stats)||0),pct=Math.min(100,Math.round(v/a.target*100)),done=a.test(stats);return `<div class="achievement ${done?'earned':''}"><span class="emoji">${a.icon}</span><strong>${a.name}</strong><small>${a.desc}</small><div class="achievement-progress"><span style="width:${pct}%"></span></div><em>${done?'Splněno ✓':`${Math.min(v,a.target)}/${a.target}`}</em></div>`}).join('');renderSettings();
}

function renderSettings(){const s=getSettings(),supported=typeof navigator.vibrate==='function';$('#soundToggle').textContent=`${s.sound?'🔊':'🔇'} Zvuk ${s.sound?'zapnutý':'vypnutý'}`;$('#soundToggle').classList.toggle('on',s.sound);$('#hapticToggle').textContent=supported?`${s.haptics?'📳':'📴'} Haptika ${s.haptics?'zapnutá':'vypnutá'}`:'📴 Haptika nepodporována';$('#hapticToggle').classList.toggle('on',s.haptics&&supported);$('#hapticToggle').disabled=!supported;const test=$('#hapticTestBtn');if(test){test.disabled=!supported||!s.haptics;test.textContent=supported?'📳 Otestovat haptiku':'📴 Prohlížeč haptiku nepodporuje'}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

async function renderLeaderboard(){
 const p=getProfile(),gate=$('#leaderboardGate'),content=$('#leaderboardContent');if(!p?.familyCode){gate.classList.remove('hidden');content.classList.add('hidden');gate.innerHTML=`<h2>Připoj rodinu</h2><p class="muted">Přihlas se ke svému hráči, nebo vytvoř nový profil.</p><button id="leaderConnectBtn" class="primary-btn big">Přihlásit hráče</button>`;setTimeout(()=>$('#leaderConnectBtn')&&($('#leaderConnectBtn').onclick=()=>openProfileModal('login')),0);return}
 gate.classList.add('hidden');content.classList.remove('hidden');$('#leaderboardList').innerHTML='<div class="gate card">Načítám pořadí…</div>';
 try{const data=await api(`/api/leaderboard?family_code=${encodeURIComponent(p.familyCode)}&daily_date=${pragueDateISO()}`);renderLeaderData(data)}catch(e){$('#leaderboardList').innerHTML=`<div class="gate card"><strong>Leaderboard je offline.</strong><p class="muted">${esc(e.message)}. Lokální hraní funguje dál.</p></div>`}
}
function renderLeaderData(data){const rows=leaderTab==='daily'?data.daily:leaderTab==='weekly'?data.weekly:data.overall;if(!rows.length){$('#leaderboardList').innerHTML='<div class="gate card">Zatím tu nikdo nemá výsledek.</div>';return}$('#leaderboardList').innerHTML=rows.map(r=>{const detail=leaderTab==='daily'?`${r.cleanSolve===true?'✨ Clean':(r.hintsUsed?`💡 ${r.hintsUsed}×`:'')} ${r.moves} tahů`.trim():leaderTab==='weekly'?`☀️ ${r.daily||0} Daily · ✨ ${r.clean||0} Clean · ${r.completed||0} úloh`:`🔥 ${r.currentStreak} · ${r.totalCompleted} úloh`,score=leaderTab==='daily'?fmtTime(r.elapsedMs):`${r.points} XP`,label=leaderTab==='daily'?'čas':leaderTab==='weekly'?'tento týden':'celkem';return `<div class="leader-row"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.name)}</strong><small>${detail}</small></div><div class="leader-score"><strong>${score}</strong><small>${label}</small></div></div>`}).join('')}

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
function testHaptics(){const s=getSettings();if(!s.haptics){showToast('Nejdřív zapni haptiku.');return}if(typeof navigator.vibrate!=='function'){showToast('Tento prohlížeč haptiku nepodporuje.');return}const ok=vibrate([65,45,105]);showToast(ok===false?'Telefon nebo prohlížeč vibraci odmítl. Zkontroluj systémové vibrace.':'Testovací pulz odeslán 📳 Pokud nic necítíš, zkontroluj systémové vibrace.') }
function confetti(){const layer=$('#confettiLayer');layer.innerHTML='';const cs=['#6c5ce7','#55cfa7','#ff816f','#ffd66b','#73a7ff','#f391c3'];for(let i=0;i<28;i++){const el=document.createElement('i');el.className='confetti';el.style.setProperty('--x',`${(Math.random()-.5)*260}px`);el.style.setProperty('--drift',`${(Math.random()-.5)*140}px`);el.style.setProperty('--rot',`${Math.random()*180}deg`);el.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);el.style.setProperty('--c',cs[i%cs.length]);el.style.animationDelay=`${Math.random()*.18}s`;layer.appendChild(el)}setTimeout(()=>layer.innerHTML='',2400)}
function showToast(text){const t=$('#toast');clearTimeout(toastTimer);t.textContent=text;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),3300)}



const ONBOARD_STEPS=[
 {title:'Vítej v Propletu',html:`<div class="onboard-hero-mark">P</div><div class="onboard-content"><span class="eyebrow">RYCHLÝ ÚVOD</span><h2>Propleť celou plochu</h2><p class="muted">Najdi všechna ukrytá česká slova. Každé písmeno patří právě do jednoho slova a cesty mohou pěkně zatáčet. <b>Nestačí jen složit existující slovo — musíš najít jeho konkrétní cestu, která zapadá do jediného řešení celé plochy.</b></p><div class="onboard-points"><div class="onboard-point"><span>↕️</span><div><strong>Jen sousední políčka</strong><small>Nahoru, dolů, vlevo nebo vpravo. Bez diagonál.</small></div></div><div class="onboard-point"><span>🎨</span><div><strong>Každé slovo má svou barvu</strong><small>Cílem je obarvit celou aktivní plochu.</small></div></div></div></div>`},
 {title:'Zkus si první tah',interactive:true,html:`<div class="onboard-content"><span class="eyebrow">TEĎ TY</span><h2>Najdi slovo PES</h2><p class="muted">Táhni prstem nebo myší přes <b>P → E → S</b>. Tohle je přesně stejné gesto jako ve hře.</p><div class="tutorial-wrap"><div class="tutorial-instruction">Táhni přes tři písmena:</div><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">S</div><div class="tutorial-cell" data-tidx="3">L</div><div class="tutorial-cell" data-tidx="4">A</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`},
 {title:'Jak číst herní obrazovku',html:`<div class="onboard-content"><span class="eyebrow">BĚHEM HRY</span><h2>Všechno důležité je po ruce</h2><p class="muted">Nahoře jsou jen délky hledaných slov. <b>Aktuálně</b> ti pořád ukazuje, co právě skládáš. Na velké obrazovce Fold/tabletu se přesune do bočního panelu a zůstává stále viditelné.</p><div class="onboard-points"><div class="onboard-point"><span>🔢</span><div><strong>Délky slov</strong><small>Např. 5 · 7 · 4. Po nalezení se ukáže celé slovo.</small></div></div><div class="onboard-point"><span>↶</span><div><strong>Zpět není trest</strong><small>Vrátíš poslední nalezené slovo a můžeš hledat jinou cestu.</small></div></div></div></div>`},
 {title:'Daily, Clean a streak',html:`<div class="onboard-content"><span class="eyebrow">A JEŠTĚ TŘI VĚCI</span><h2>Teď už víš skoro všechno</h2><div class="onboard-points"><div class="onboard-point"><span>✨</span><div><strong>Clean solve</strong><small>Vyřeš úlohu bez nápovědy. V Daily pořadí má Clean přednost před časem a čas běží i při odchodu do menu.</small></div></div><div class="onboard-point"><span>💡</span><div><strong>Tři úrovně nápovědy</strong><small>Od jemného postrčení po odhalení celé cesty.</small></div></div><div class="onboard-point"><span>🔥</span><div><strong>Streak má jednu záchrannou brzdu</strong><small>Když vynecháš jeden den, můžeš ho zachránit 30sekundovým 6×6 Propletem. Jen jeden pokus.</small></div></div></div></div>`}
];

function openOnboarding(force=false){
 if(!force){try{if(localStorage.getItem(ONBOARD_KEY))return}catch{}}
 onboardingStep=0;tutorialState={dragging:false,path:[],done:false};
 $('#onboardingModal').classList.remove('hidden');renderOnboarding();
}
function closeOnboarding(){try{localStorage.setItem(ONBOARD_KEY,'done')}catch{}$('#onboardingModal').classList.add('hidden');tutorialState={dragging:false,path:[],done:false}}
function renderOnboarding(){
 const step=ONBOARD_STEPS[onboardingStep],modal=$('.onboarding-card');
 $('#onboardDots').innerHTML=ONBOARD_STEPS.map((_,i)=>`<i class="${i===onboardingStep?'active':''}"></i>`).join('');
 $('#onboardContent').innerHTML=step.html;modal.classList.toggle('waiting-interaction',!!step.interactive&&!tutorialState.done);
 $('#onboardNextBtn').textContent=onboardingStep===ONBOARD_STEPS.length-1?'Jdu hrát 🧩':(step.interactive&&!tutorialState.done?'Nejdřív najdi PES':'Pokračovat');
 if(step.interactive)setTimeout(bindTutorial,0);
}
function onboardingNext(){
 if(ONBOARD_STEPS[onboardingStep]?.interactive&&!tutorialState.done)return;
 if(onboardingStep<ONBOARD_STEPS.length-1){onboardingStep++;renderOnboarding()}else{closeOnboarding();nav('daily')}
}
function tutorialAdj(a,b){const ar=Math.floor(a/3),ac=a%3,br=Math.floor(b/3),bc=b%3;return Math.abs(ar-br)+Math.abs(ac-bc)===1}
function renderTutorialPath(){
 $$('.tutorial-cell').forEach(c=>{const i=+c.dataset.tidx;c.classList.toggle('active',tutorialState.path.includes(i));if(tutorialState.done&&[0,1,2].includes(i)){c.classList.remove('active');c.classList.add('done')}});
}
function bindTutorial(){
 const board=$('#tutorialBoard');if(!board)return;
 const add=i=>{const p=tutorialState.path,last=p.at(-1);if(i===last)return;if(p.length>1&&i===p.at(-2)){p.pop();renderTutorialPath();return}if(p.includes(i)||last==null||!tutorialAdj(last,i))return;p.push(i);renderTutorialPath()};
 $$('.tutorial-cell').forEach(c=>c.onpointerdown=e=>{e.preventDefault();tutorialState.dragging=true;tutorialState.path=[+c.dataset.tidx];renderTutorialPath();try{c.setPointerCapture(e.pointerId)}catch{}});
 board.onpointermove=e=>{if(!tutorialState.dragging)return;const c=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.tutorial-cell');if(c)add(+c.dataset.tidx)};
 const finish=()=>{if(!tutorialState.dragging)return;tutorialState.dragging=false;const ok=tutorialState.path.join(',')==='0,1,2';if(ok){tutorialState.done=true;$('#tutorialSuccess').textContent='✓ PES! Přesně tak.';fx('correct');renderTutorialPath();$('.onboarding-card').classList.remove('waiting-interaction');$('#onboardNextBtn').textContent='Super, dál'}else{$('#tutorialSuccess').textContent='Zkus začít na P a táhnout přes E až na S.';fx('wrong');tutorialState.path=[];renderTutorialPath()}};
 board.onpointerup=finish;board.onpointercancel=finish;
}

function maybeOfferRescue(){
 const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started'))return;
 if(rs.state==='started'){openRescueOffer();return}
 const key=`proplet-rescue-offer:${rs.missedDate}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'shown');openRescueOffer();
}

function bind(){
 $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$('#playDailyBtn').onclick=startDaily;$('#shareDailyBtn').onclick=()=>{const date=pragueDateISO(),rec=getState().completed[`daily:${date}`];currentGame={puzzle:dailyPuzzleFor(date),mode:'daily',dailyDate:date,elapsedMs:rec?.elapsedMs,moves:rec?.moves,finished:true};shareDaily()};
 $('#backFromGame').onclick=goBackFromGame;$('#undoBtn').onclick=undo;$('#resetBtn').onclick=resetGame;$('#hintBtn').onclick=openHintModal;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;
 $('#closeProfileModal').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromNudge)resumeAfterAccountNudge() };$('#skipProfileBtn').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromNudge)resumeAfterAccountNudge() };$('#saveProfileBtn').onclick=saveNewProfile;$('#profileModeLogin').onclick=()=>setAccountMode('login');$('#profileModeCreate').onclick=()=>setAccountMode('create');
 $('#nudgeCreateBtn').onclick=()=>openAccountFromNudge('create');$('#nudgeLoginBtn').onclick=()=>openAccountFromNudge('login');$('#nudgeSkipBtn').onclick=dismissAccountNudge;
 $('#closePasswordModal').onclick=()=>$('#passwordModal').classList.add('hidden');$('#savePasswordBtn').onclick=savePassword;
 $('#closeHintModal').onclick=()=>$('#hintModal').classList.add('hidden');$$('[data-hint-level]').forEach(b=>b.onclick=()=>applySmartHint(+b.dataset.hintLevel));
 $('#rescueBtn').onclick=openRescueOffer;$('#confirmRescueBtn').onclick=beginRescue;$('#cancelRescueBtn').onclick=()=>$('#rescueOfferModal').classList.add('hidden');
 $('#skipOnboardingBtn').onclick=closeOnboarding;$('#onboardNextBtn').onclick=onboardingNext;
 $$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});
 $('#openAllGamesBtn').onclick=()=>nav('free');
 $$('[data-difficulty-rating]').forEach(b=>b.onclick=()=>rateDifficulty(+b.dataset.difficultyRating,b));$('#reportWordBtn').onclick=openWordReport;$('#closeWordReportModal').onclick=()=>$('#wordReportModal').classList.add('hidden');$('#saveWordReportBtn').onclick=saveWordReport;$('#applyUpdateBtn').onclick=()=>pendingSW?.postMessage({type:'SKIP_WAITING'});
 $('#soundToggle').onclick=()=>{const s=getSettings();s.sound=!s.sound;saveSettings(s);renderSettings();if(s.sound){ensureAudio();tone(620,.08,.02)}};$('#hapticToggle').onclick=()=>{const s=getSettings();s.haptics=!s.haptics;saveSettings(s);renderSettings();if(s.haptics)vibrate(45)};$('#hapticTestBtn').onclick=testHaptics;$('#replayIntroBtn').onclick=()=>openOnboarding(true);
 $('#board').addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('resize',()=>{fitGameBoard();drawPaths()});window.addEventListener('online',()=>syncQueue({announce:false}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveGameProgress();else if(getQueue().length)syncQueue({announce:false})});window.addEventListener('pagehide',saveGameProgress);
}

async function boot(){
 try{puzzleDB=await fetch('/puzzles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})}catch{$('body').innerHTML='<main style="padding:30px;font-family:system-ui"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Spusť aplikaci přes server podle README.</p></main>';return}
 bind();initNavigation();updateProfileChip();renderDaily();renderFree();renderProfile();syncQueue({announce:false});refreshRescueStatus();setTimeout(()=>openOnboarding(false),260);
 registerServiceWorker();
 let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily()}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);
}
boot();
