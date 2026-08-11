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
 {icon:'🧩',name:'První Proplet',desc:'Vyřeš první úlohu',test:s=>s.totalCompleted>=1},
 {icon:'🔟',name:'Rozjezd',desc:'Vyřeš 10 úloh',test:s=>s.totalCompleted>=10},
 {icon:'💯',name:'Stovka',desc:'Nasbírej 100 XP',test:s=>s.points>=100},
 {icon:'🧠',name:'Mozkovna',desc:'5 středních úloh',test:s=>(s.freeCompleted?.medium||0)>=5},
 {icon:'🧨',name:'Nebojácný',desc:'3 těžké úlohy',test:s=>(s.freeCompleted?.hard||0)>=3},
 {icon:'🤯',name:'Mozkožrout',desc:'Dokonči první Mozkožrout',test:s=>(s.freeCompleted?.hardcore||0)>=1},
 {icon:'☀️',name:'Ranní ptáče',desc:'5 Daily výzev',test:s=>s.dailyCompleted>=5},
 {icon:'🔥',name:'Držíš nit',desc:'7denní streak',test:s=>s.longestStreak>=7},
 {icon:'⚡',name:'Rychlík',desc:'Daily pod 2 minuty',test:s=>s.bestDailyMs!=null&&s.bestDailyMs<120000}
];
const SHARE_URL='https://proplet-nine.vercel.app/';
const STORE_KEY='proplet-v2-state';
const PROFILE_KEY='proplet-v2-profile';
const QUEUE_KEY='proplet-v2-sync-queue';
const SETTINGS_KEY='proplet-v3-settings';

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

function blankState(){return {completed:{},dailyDates:[],statsVersion:3};}
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

function currentLocalStats(){
 const s=getState();const rows=Object.values(s.completed);const dates=[...new Set(rows.filter(r=>r.mode==='daily').map(r=>r.dailyDate).filter(Boolean))];
 const streak=calcStreak(dates),longest=calcLongest(dates);const dailyTimes=rows.filter(r=>r.mode==='daily').map(r=>r.elapsedMs);
 const free={easy:0,medium:0,hard:0,hardcore:0};rows.filter(r=>r.mode==='free').forEach(r=>free[r.difficulty]=(free[r.difficulty]||0)+1);
 return {points:rows.reduce((a,r)=>a+(r.points||0),0),totalCompleted:rows.length,dailyCompleted:dates.length,freeCompleted:free,currentStreak:streak,longestStreak:longest,bestDailyMs:dailyTimes.length?Math.min(...dailyTimes):null};
}
function effectiveStats(){
 const local=currentLocalStats(),remote=getProfile()?.stats;if(!remote)return local;
 const free={easy:0,medium:0,hard:0,hardcore:0};for(const k of Object.keys(free))free[k]=Math.max(local.freeCompleted?.[k]||0,remote.freeCompleted?.[k]||0);
 return {
  points:Math.max(local.points||0,remote.points||0),totalCompleted:Math.max(local.totalCompleted||0,remote.totalCompleted||0),
  dailyCompleted:Math.max(local.dailyCompleted||0,remote.dailyCompleted||0),freeCompleted:free,
  currentStreak:Math.max(local.currentStreak||0,remote.currentStreak||0),longestStreak:Math.max(local.longestStreak||0,remote.longestStreak||0),
  bestDailyMs:[local.bestDailyMs,remote.bestDailyMs].filter(v=>v!=null).sort((a,b)=>a-b)[0]??null
 };
}
function calcStreak(dateStrings){const set=new Set(dateStrings);if(!set.size)return 0;const today=pragueDateISO();const y=new Date(`${today}T12:00:00Z`);const prev=new Date(y.getTime()-86400000).toISOString().slice(0,10);let anchor=set.has(today)?today:(set.has(prev)?prev:null);if(!anchor)return 0;let n=0,d=new Date(`${anchor}T12:00:00Z`);while(set.has(d.toISOString().slice(0,10))){n++;d=new Date(d.getTime()-86400000)}return n}
function calcLongest(dateStrings){const arr=[...new Set(dateStrings)].sort();let best=0,cur=0,prev=null;for(const s of arr){const d=Date.parse(`${s}T12:00:00Z`);cur=prev!==null&&d-prev===86400000?cur+1:1;best=Math.max(best,cur);prev=d}return best}
function levelFor(points){let i=0;for(let n=0;n<LEVELS.length;n++)if(points>=LEVELS[n].xp)i=n;const current=LEVELS[i],next=LEVELS[i+1]||null;const pct=next?Math.max(0,Math.min(100,((points-current.xp)/(next.xp-current.xp))*100)):100;return {index:i+1,current,next,pct}}

function nav(screen){
 currentScreen=screen;$$('.screen').forEach(x=>x.classList.remove('active'));$(`#screen-${screen}`).classList.add('active');
 $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===screen));$('.bottom-nav').classList.toggle('hidden',screen==='game');
 if(screen==='daily')renderDaily();if(screen==='free')renderFree();if(screen==='leaderboard')renderLeaderboard();if(screen==='profile')renderProfile();window.scrollTo({top:0,behavior:'instant'});
}

function renderLevelCard(stats){
 const l=levelFor(stats.points||0),toNext=l.next?l.next.xp-(stats.points||0):0;
 $('#levelCard').innerHTML=`<div class="level-orb">${l.current.icon}</div><div class="level-copy"><div class="level-top"><strong>Level ${l.index} · ${l.current.name}</strong><span>${stats.points||0} XP</span></div><div class="xp-track"><span style="width:${l.pct}%"></span></div><div class="level-hint">${l.next?`${toNext} XP do levelu „${l.next.name}“`:'Max level. Respekt. 👑'}</div></div>`;
}
function renderDaily(){
 const date=pragueDateISO(),p=dailyPuzzleFor(date),stats=effectiveStats(),done=getState().completed[`daily:${date}`];
 $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${p.meta.cells} políček · ${p.answers.length} slov`;
 $('#streakCount').textContent=stats.currentStreak;$('#dailyCompletedStat').textContent=stats.dailyCompleted;$('#longestStreakStat').textContent=stats.longestStreak;$('#bestDailyStat').textContent=fmtTime(stats.bestDailyMs);
 $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':'Hrát dnešní výzvu';$('#shareDailyBtn').classList.toggle('hidden',!done);renderLevelCard(stats);
 const next=BADGES.find(b=>stats.currentStreak<b.days);$('#nextBadgeText').textContent=next?`${next.icon} ${next.days-stats.currentStreak} d. do „${next.name}“`:'🚀 Jsi legenda';
 $('#badgeRail').innerHTML=BADGES.slice(0,8).map(b=>`<div class="badge-step ${stats.longestStreak>=b.days?'earned':''} ${next?.days===b.days?'current':''}"><span class="emoji">${b.icon}</span><strong>${b.days} dní</strong><small>${b.name}</small></div>`).join('');
 const sync=$('#dailySyncStatus');if(!done){sync.classList.add('hidden')}else{sync.classList.remove('hidden');const pfile=getProfile(),queued=getQueue().some(r=>r.challengeKey===`daily:${date}`);if(!pfile?.token)sync.textContent='📱 Výsledek je uložený v tomto telefonu';else if(queued)sync.textContent=syncState.status==='error'?`⚠️ Čeká na synchronizaci: ${syncState.error||'zkus to znovu'}`:'☁️ Výsledek čeká na synchronizaci';else sync.textContent='✓ Výsledek je v rodinné lize';}
}

function renderFree(){
 const s=getState();$('#difficultyCards').innerHTML=Object.entries(DIFF).map(([key,d])=>{
  const list=puzzleDB.free[key]||[],total=list.length,done=list.filter(p=>s.completed[`free:${p.id}`]).length,pct=total?Math.round(done/total*100):0,next=Math.min(done+1,total);
  const progressLabel=done===total?`${done}/${total} HOTOVO`:`ÚROVEŇ ${next} Z ${total}`;
  return `<article class="difficulty-card card" data-diff="${key}"><div><span class="eyebrow">${progressLabel}</span><h2>${d.icon} ${d.label}</h2><p class="muted">${d.desc}</p><span class="xp-chip">+${d.xp} XP za novou úlohu</span><div class="progress-line"><span style="width:${pct}%"></span></div></div><div class="difficulty-icon">${d.icon}</div><button class="secondary-btn" data-play-free="${key}">${done===total?'Hrát znovu':'Hraj další úroveň'}</button></article>`
 }).join('');
 $$('[data-play-free]').forEach(b=>b.onclick=()=>startFree(b.dataset.playFree));
}
function startFree(diff){
 const s=getState(),list=[...(puzzleDB.free[diff]||[])].sort((a,b)=>(a.meta?.difficultyScore||0)-(b.meta?.difficultyScore||0)),unsolved=list.filter(p=>!s.completed[`free:${p.id}`]);
 const p=unsolved.length?unsolved[0]:list[Math.floor(Math.random()*list.length)];if(p)startGame(p,'free',null);
}
function startDaily(){const date=pragueDateISO(),done=getState().completed[`daily:${date}`];if(done){showDailyResult(date,done);return}startGame(dailyPuzzleFor(date),'daily',date)}

function startGame(puzzle,mode,dailyDate){
 stopTimer();currentGame={puzzle,mode,dailyDate,found:[],used:new Map(),path:[],dragging:false,moves:0,start:performance.now(),elapsedMs:0,finished:false,lastFound:[],hints:0};
 $('#gameModeLabel').textContent=mode==='daily'?'Denní výzva':'Volná hra';$('#gameDifficulty').textContent=`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}`;
 $('#timer').textContent='00:00';renderGameBoard();renderGameHUD();message('');nav('game');startTimer();
}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function startTimer(){stopTimer();timerId=setInterval(()=>{if(!currentGame||currentGame.finished)return;currentGame.elapsedMs=performance.now()-currentGame.start;$('#timer').textContent=fmtTime(currentGame.elapsedMs)},250)}
function renderGameHUD(){const g=currentGame,p=g.puzzle;$('#moves').textContent=`${g.moves} tahů`;$('#gameProgress').textContent=`${g.found.length} / ${p.answers.length}`;$('#lengths').innerHTML=p.lengths.map((len,i)=>{const found=g.found.find(f=>f.answerIndex===i);return `<span class="length-pill ${found?'found':''}" ${found?`style="background:color-mix(in srgb,${COLORS[found.colorIndex%COLORS.length]} 58%,white)"`:''}>${found?found.word:len}</span>`}).join('');$('#undoBtn').disabled=!g.found.length}
function renderGameBoard(){
 const g=currentGame,p=g.puzzle,mask=new Set(p.mask),board=$('#board');board.style.gridTemplateColumns=`repeat(${p.cols},1fr)`;board.classList.toggle('dense-board',p.cols>=9);board.classList.toggle('ultra-board',p.cols>=10);board.innerHTML='';
 for(let i=0;i<p.rows*p.cols;i++){if(!mask.has(i)){const v=document.createElement('div');v.className='void-cell';board.appendChild(v);continue}const c=document.createElement('div');c.className='cell';c.dataset.index=i;c.textContent=p.letters[i];const color=g.used.get(i);if(color!=null){c.classList.add('used');c.style.setProperty('--word-color',COLORS[color%COLORS.length])}if(g.lastFound?.includes(i))c.classList.add('just-found');c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointerenter',pointerEnter);board.appendChild(c)}requestAnimationFrame(drawPaths);if(g.lastFound?.length)setTimeout(()=>{g.lastFound=[];$$('.just-found').forEach(c=>c.classList.remove('just-found'))},460)}
function pNeighbours(i){const p=currentGame.puzzle,r=Math.floor(i/p.cols),c=i%p.cols,mask=new Set(p.mask),out=[];[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{const j=rr*p.cols+cc;if(rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols&&mask.has(j))out.push(j)});return out}
function pointerDown(e){e.preventDefault();ensureAudio();const i=+e.currentTarget.dataset.index;if(currentGame.used.has(i))return;currentGame.dragging=true;currentGame.path=[i];fx('tap');updateActive();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}}
function pointerEnter(e){if(currentGame?.dragging)extendPath(+e.currentTarget.dataset.index)}
function pointerMove(e){if(!currentGame?.dragging)return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.cell');if(el)extendPath(+el.dataset.index)}
function extendPath(i){const g=currentGame,path=g.path,last=path.at(-1);if(i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();updateActive();return}if(g.used.has(i)||path.includes(i)||!pNeighbours(last).includes(i))return;path.push(i);fx('step');updateActive()}
function pointerUp(){if(!currentGame?.dragging)return;currentGame.dragging=false;submitPath()}
function currentWord(){return currentGame.path.map(i=>currentGame.puzzle.letters[i]).join('')}
function updateActive(){$$('.cell').forEach(c=>c.classList.toggle('active',currentGame.path.includes(+c.dataset.index)));$('#currentWord').textContent=currentGame.path.length?currentWord():'—';drawPaths()}
function samePath(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function submitPath(){
 const g=currentGame,word=currentWord();if(!word){g.path=[];return updateActive()}g.moves++;
 const ai=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
 if(ai>=0){const colorIndex=g.found.length%COLORS.length,path=[...g.path];g.found.push({answerIndex:ai,word,colorIndex,path});path.forEach(i=>g.used.set(i,colorIndex));g.lastFound=path;message(`✓ ${word}`,'good');fx('correct')}else{message(word.length<3?'Zkus delší slovo.':`„${word}“ do řešení nezapadá.`,'bad');fx('wrong')}
 g.path=[];renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';if(g.found.length===g.puzzle.answers.length)finishGame();
}
function undo(){const g=currentGame,f=g.found.pop();if(!f)return;f.path.forEach(i=>g.used.delete(i));g.moves++;message(`Vráceno: ${f.word}`);renderGameBoard();renderGameHUD()}
function resetGame(){const g=currentGame;g.found=[];g.used=new Map();g.path=[];g.moves=0;g.start=performance.now();g.elapsedMs=0;g.lastFound=[];g.hints=0;message('Úloha resetována.');renderGameBoard();renderGameHUD()}
function hint(){const g=currentGame,missing=g.puzzle.answers.map((a,i)=>({a,i})).filter(x=>!g.found.some(f=>f.answerIndex===x.i));if(!missing.length)return;g.hints=(g.hints||0)+1;const pick=missing[Math.floor(Math.random()*missing.length)],cell=$(`.cell[data-index="${pick.a.path[0]}"]`);cell?.classList.add('hint');message(`Začni písmenem ${pick.a.word[0]}. Hledáš ${pick.a.word.length} písmen.`);fx('hint');setTimeout(()=>cell?.classList.remove('hint'),2200)}
function message(t,kind=''){$('#gameMessage').textContent=t;$('#gameMessage').className=`game-message ${kind}`}
function drawPaths(){
 if(!currentGame)return;const board=$('#board'),svg=$('#pathLayer'),br=board.getBoundingClientRect();if(!br.width)return;svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
 const paths=[...currentGame.found.map(f=>({path:f.path,color:COLORS[f.colorIndex%COLORS.length]}))];if(currentGame.path.length>1)paths.push({path:currentGame.path,color:'#7d6fe7'});
 paths.forEach(({path,color})=>{if(path.length<2)return;const pts=path.map(i=>{const c=$(`.cell[data-index="${i}"]`),r=c.getBoundingClientRect();return `${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`}).join(' ');const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',color);pl.setAttribute('stroke-width','9');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');pl.setAttribute('opacity','.52');svg.appendChild(pl)});
}

async function finishGame(){
 const g=currentGame;g.finished=true;g.elapsedMs=performance.now()-g.start;stopTimer();const key=challengeKey(g.mode,g.puzzle,g.dailyDate),state=getState(),old=state.completed[key];
 const rec={puzzleId:g.puzzle.id,challengeKey:key,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:pointsFor(g.mode,g.puzzle.difficulty),completedAt:new Date().toISOString()};
 if(!old){state.completed[key]=rec}else if(g.mode==='free'){state.completed[key]={...old,elapsedMs:Math.min(old.elapsedMs,rec.elapsedMs),moves:Math.min(old.moves,rec.moves)}}saveState(state);queueResult(rec);
 const beforeLongest=calcLongest(Object.values(getState().completed).filter(r=>r.mode==='daily'&&r.challengeKey!==key).map(r=>r.dailyDate));const stats=effectiveStats();const newBadge=(!old&&g.mode==='daily')?BADGES.find(b=>b.days>beforeLongest&&b.days<=stats.longestStreak):null;
 $('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';$('#winTitle').textContent=g.mode==='daily'?'Daily hotovo!':'Vyřešeno!';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${rec.moves} tahů · ${DIFF[g.puzzle.difficulty].label}`;
 $('#winXp').textContent=old&&g.mode==='free'?'Osobní rekord se může zlepšit':`+${rec.points} XP`;$('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join('');
 $('#newBadgeBox').classList.toggle('hidden',!newBadge);if(newBadge)$('#newBadgeBox').innerHTML=`<span class="emoji">${newBadge.icon}</span><strong> Nový odznak: ${newBadge.name}</strong><div>${newBadge.days} dní v řadě</div>`;
 $('#winShareBtn').classList.toggle('hidden',g.mode!=='daily');$('#winMenuBtn').classList.toggle('hidden',g.mode!=='free');$('#winPrimaryBtn').textContent=g.mode==='daily'?'Zpět na dnešek':'Hraj další úroveň';$('#winModal').classList.remove('hidden');confetti();fx('win');renderDaily();renderFree();renderProfile();syncQueue({announce:false});
}
function closeWinAndContinue(){const mode=currentGame?.mode,diff=currentGame?.puzzle.difficulty;$('#winModal').classList.add('hidden');if(mode==='free')startFree(diff);else nav('daily')}
function closeWinToMenu(){const mode=currentGame?.mode;$('#winModal').classList.add('hidden');nav(mode==='daily'?'daily':'free')}
function showDailyResult(date,rec){
 const p=dailyPuzzleFor(date);stopTimer();currentGame={puzzle:p,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};
 $('#winBadge').textContent='☀️';$('#winTitle').textContent='Dnešní Daily už máš hotovou';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${rec.moves} tahů · ${DIFF[p.difficulty].label}`;$('#winXp').textContent='+100 XP';
 $('#winWords').innerHTML=p.answers.map((a,i)=>`<span class="win-word" style="background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)">${a.word}</span>`).join('');
 $('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').textContent='Zpět na dnešek';$('#winModal').classList.remove('hidden');
}
function shareText(){const g=currentGame,stats=effectiveStats(),date=g?.dailyDate||pragueDateISO(),p=g?.puzzle||dailyPuzzleFor(date),rec=getState().completed[`daily:${date}`];const time=g?.elapsedMs||rec?.elapsedMs;return `Proplet · ${formatDateCZ(date)}\n${DIFF[p.difficulty].icon} ${DIFF[p.difficulty].label} · ⏱ ${fmtTime(time)} · 🔥 ${stats.currentStreak} dní\n${stats.currentStreak?BADGES.filter(b=>b.days<=stats.longestStreak).at(-1)?.icon||'🧩':'🧩'} Proplet\n\nZahraj si taky: ${SHARE_URL}`}
async function shareDaily(){const text=shareText();try{if(navigator.share)await navigator.share({title:'Proplet',text});else{await navigator.clipboard.writeText(text);showToast('Výsledek i odkaz jsou ve schránce ✓')}}catch(e){if(e?.name!=='AbortError')showToast('Sdílení se nepovedlo. Zkus to znovu.')}}

function queueResult(rec){
 const q=getQueue(),i=q.findIndex(x=>x.challengeKey===rec.challengeKey);if(i<0)q.push(rec);else if(rec.mode==='free')q[i]={...q[i],elapsedMs:Math.min(q[i].elapsedMs,rec.elapsedMs),moves:Math.min(q[i].moves,rec.moves)};saveQueue(q);renderDaily();
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
 for(const r of q){try{await api('/api/result',{method:'POST',body:JSON.stringify({puzzle_id:r.puzzleId,challenge_key:r.challengeKey,mode:r.mode,difficulty:r.difficulty,elapsed_ms:Math.max(1000,Math.round(r.elapsedMs)),moves:Math.max(1,r.moves),daily_date:r.dailyDate})});sent++}catch(e){left.push(r);if(!firstError)firstError=e.message}}
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
  if(!old){state.completed[r.challengeKey]=r;continue}
  if(r.mode==='free'){
   state.completed[r.challengeKey]={...old,...r,elapsedMs:Math.min(old.elapsedMs??Infinity,r.elapsedMs??Infinity),moves:Math.min(old.moves??Infinity,r.moves??Infinity)};
  }else{
   // Daily is immutable: keep the server's first official result on every device.
   state.completed[r.challengeKey]={...old,...r};
  }
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
 $('#achievementGrid').innerHTML=ACHIEVEMENTS.map(a=>`<div class="achievement ${a.test(stats)?'earned':''}"><span class="emoji">${a.icon}</span><strong>${a.name}</strong><small>${a.desc}</small></div>`).join('');renderSettings();
}

function renderSettings(){const s=getSettings();$('#soundToggle').textContent=`${s.sound?'🔊':'🔇'} Zvuk ${s.sound?'zapnutý':'vypnutý'}`;$('#soundToggle').classList.toggle('on',s.sound);$('#hapticToggle').textContent=`${s.haptics?'📳':'📴'} Haptika ${s.haptics?'zapnutá':'vypnutá'}`;$('#hapticToggle').classList.toggle('on',s.haptics)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

async function renderLeaderboard(){
 const p=getProfile(),gate=$('#leaderboardGate'),content=$('#leaderboardContent');if(!p?.familyCode){gate.classList.remove('hidden');content.classList.add('hidden');gate.innerHTML=`<h2>Připoj rodinu</h2><p class="muted">Přihlas se ke svému hráči, nebo vytvoř nový profil.</p><button id="leaderConnectBtn" class="primary-btn big">Přihlásit hráče</button>`;setTimeout(()=>$('#leaderConnectBtn')&&($('#leaderConnectBtn').onclick=()=>openProfileModal('login')),0);return}
 gate.classList.add('hidden');content.classList.remove('hidden');$('#leaderboardList').innerHTML='<div class="gate card">Načítám pořadí…</div>';
 try{const data=await api(`/api/leaderboard?family_code=${encodeURIComponent(p.familyCode)}&daily_date=${pragueDateISO()}`);renderLeaderData(data)}catch(e){$('#leaderboardList').innerHTML=`<div class="gate card"><strong>Leaderboard je offline.</strong><p class="muted">${esc(e.message)}. Lokální hraní funguje dál.</p></div>`}
}
function renderLeaderData(data){const rows=leaderTab==='daily'?data.daily:data.overall;if(!rows.length){$('#leaderboardList').innerHTML='<div class="gate card">Zatím tu nikdo nemá výsledek.</div>';return}$('#leaderboardList').innerHTML=rows.map(r=>`<div class="leader-row"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.name)}</strong><small>${leaderTab==='daily'?`${r.moves} tahů`:`🔥 ${r.currentStreak} · ${r.totalCompleted} úloh`}</small></div><div class="leader-score"><strong>${leaderTab==='daily'?fmtTime(r.elapsedMs):`${r.points} XP`}</strong><small>${leaderTab==='daily'?'čas':'celkem'}</small></div></div>`).join('')}

function ensureAudio(){if(!getSettings().sound)return;try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
function tone(freq,duration=0.06,volume=0.025,delay=0){if(!getSettings().sound)return;ensureAudio();if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(0.0001,t+duration);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+duration+.02)}
function vibrate(pattern){if(getSettings().haptics&&navigator.vibrate)try{navigator.vibrate(pattern)}catch{}}
function fx(type){if(type==='tap'){tone(300,.035,.012);vibrate(6)}else if(type==='step'){tone(360,.028,.009);vibrate(4)}else if(type==='correct'){tone(520,.07,.025);tone(700,.09,.022,.055);vibrate(20)}else if(type==='wrong'){tone(180,.09,.018);vibrate([18,25,18])}else if(type==='hint'){tone(620,.08,.018);vibrate(10)}else if(type==='win'){tone(520,.09,.028);tone(660,.1,.026,.08);tone(820,.15,.025,.16);vibrate([30,35,45])}}
function confetti(){const layer=$('#confettiLayer');layer.innerHTML='';const cs=['#6c5ce7','#55cfa7','#ff816f','#ffd66b','#73a7ff','#f391c3'];for(let i=0;i<28;i++){const el=document.createElement('i');el.className='confetti';el.style.setProperty('--x',`${(Math.random()-.5)*260}px`);el.style.setProperty('--drift',`${(Math.random()-.5)*140}px`);el.style.setProperty('--rot',`${Math.random()*180}deg`);el.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);el.style.setProperty('--c',cs[i%cs.length]);el.style.animationDelay=`${Math.random()*.18}s`;layer.appendChild(el)}setTimeout(()=>layer.innerHTML='',2400)}
function showToast(text){const t=$('#toast');clearTimeout(toastTimer);t.textContent=text;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),3300)}

function bind(){
 $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$('#playDailyBtn').onclick=startDaily;$('#shareDailyBtn').onclick=()=>{const date=pragueDateISO(),rec=getState().completed[`daily:${date}`];currentGame={puzzle:dailyPuzzleFor(date),mode:'daily',dailyDate:date,elapsedMs:rec?.elapsedMs,moves:rec?.moves,finished:true};shareDaily()};
 $('#backFromGame').onclick=()=>{stopTimer();nav(currentGame?.mode==='daily'?'daily':'free')};$('#undoBtn').onclick=undo;$('#resetBtn').onclick=resetGame;$('#hintBtn').onclick=hint;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;
 $('#closeProfileModal').onclick=()=>$('#profileModal').classList.add('hidden');$('#skipProfileBtn').onclick=()=>$('#profileModal').classList.add('hidden');$('#saveProfileBtn').onclick=saveNewProfile;$('#profileModeLogin').onclick=()=>setAccountMode('login');$('#profileModeCreate').onclick=()=>setAccountMode('create');
 $('#closePasswordModal').onclick=()=>$('#passwordModal').classList.add('hidden');$('#savePasswordBtn').onclick=savePassword;
 $$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});
 $('#soundToggle').onclick=()=>{const s=getSettings();s.sound=!s.sound;saveSettings(s);renderSettings();if(s.sound){ensureAudio();tone(620,.08,.02)}};$('#hapticToggle').onclick=()=>{const s=getSettings();s.haptics=!s.haptics;saveSettings(s);renderSettings();if(s.haptics)vibrate(20)};
 $('#board').addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('resize',drawPaths);window.addEventListener('online',()=>syncQueue({announce:false}));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&getQueue().length)syncQueue({announce:false})});
}

async function boot(){
 try{puzzleDB=await fetch('/puzzles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})}catch{$('body').innerHTML='<main style="padding:30px;font-family:system-ui"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Spusť aplikaci přes server podle README.</p></main>';return}
 bind();updateProfileChip();renderDaily();renderFree();renderProfile();syncQueue({announce:false});
 if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').then(r=>r.update()).catch(()=>{});
 let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily()}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);
}
boot();
