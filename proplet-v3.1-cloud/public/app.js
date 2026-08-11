const COLORS=['#ffd6cc','#d7eadf','#dbe7ff','#ffe8a8','#eadcff','#f7d5e8','#cfe8e8','#ffd9a8','#dff0bd','#d9edf8'];
const DIFF={easy:{label:'Snadná',icon:'🌱',desc:'Menší 6×6 plocha, 6–7 slov.'},medium:{label:'Střední',icon:'🧠',desc:'Větší 7×7 plocha a víc možností.'},hard:{label:'Těžká',icon:'🧨',desc:'Nepravidelná 8×8 plocha, 9–10 slov.'}};
const BADGES=[
 {days:1,icon:'🥉',name:'První zářez'},{days:3,icon:'❤️',name:'Srdcař'},{days:5,icon:'⭐',name:'Pětka'},
 {days:7,icon:'🔥',name:'Týden v plamenech'},{days:10,icon:'🏆',name:'Desítka'},{days:14,icon:'⚡',name:'Blesk'},
 {days:21,icon:'🦉',name:'Mistr slov'},{days:30,icon:'👑',name:'Koruna'},{days:50,icon:'💎',name:'Diamant'},{days:100,icon:'🚀',name:'Legenda'}
];
const STORE_KEY='proplet-v2-state';
const PROFILE_KEY='proplet-v2-profile';
const QUEUE_KEY='proplet-v2-sync-queue';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let puzzleDB=null;
let currentScreen='daily';
let currentGame=null;
let timerId=null;
let leaderTab='daily';

function blankState(){return {completed:{},dailyDates:[],statsVersion:2};}
function getState(){try{return {...blankState(),...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}}catch{return blankState()}}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s))}
function getProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function saveProfile(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));updateProfileChip()}
function getQueue(){try{return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]')}catch{return []}}
function saveQueue(q){localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}

function fmtTime(ms){if(ms==null)return '—';const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function formatDateCZ(iso){const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)))}
function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function dayNumber(iso){const [y,m,d]=iso.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(2026,0,1))/86400000)}
function dailyPuzzleFor(iso){const n=puzzleDB.daily.length;const i=((dayNumber(iso)%n)+n)%n;return puzzleDB.daily[i]}
function challengeKey(mode,puzzle,date){return mode==='daily'?`daily:${date}`:`free:${puzzle.id}`}
function currentLocalStats(){
 const s=getState();const rows=Object.values(s.completed);const dates=[...new Set(rows.filter(r=>r.mode==='daily').map(r=>r.dailyDate).filter(Boolean))];
 const streak=calcStreak(dates),longest=calcLongest(dates);const dailyTimes=rows.filter(r=>r.mode==='daily').map(r=>r.elapsedMs);
 const free={easy:0,medium:0,hard:0};rows.filter(r=>r.mode==='free').forEach(r=>free[r.difficulty]=(free[r.difficulty]||0)+1);
 return {points:rows.reduce((a,r)=>a+(r.points||0),0),totalCompleted:rows.length,dailyCompleted:dates.length,freeCompleted:free,currentStreak:streak,longestStreak:longest,bestDailyMs:dailyTimes.length?Math.min(...dailyTimes):null};
}
function calcStreak(dateStrings){const set=new Set(dateStrings);if(!set.size)return 0;const today=pragueDateISO();const y=new Date(`${today}T12:00:00Z`);const prev=new Date(y.getTime()-86400000).toISOString().slice(0,10);let anchor=set.has(today)?today:(set.has(prev)?prev:null);if(!anchor)return 0;let n=0,d=new Date(`${anchor}T12:00:00Z`);while(set.has(d.toISOString().slice(0,10))){n++;d=new Date(d.getTime()-86400000)}return n}
function calcLongest(dateStrings){const arr=[...new Set(dateStrings)].sort();let best=0,cur=0,prev=null;for(const s of arr){const d=Date.parse(`${s}T12:00:00Z`);cur=prev!==null&&d-prev===86400000?cur+1:1;best=Math.max(best,cur);prev=d}return best}
function pointsFor(mode,difficulty){return mode==='daily'?100:{easy:10,medium:20,hard:35}[difficulty]}

function nav(screen){
 currentScreen=screen;$$('.screen').forEach(x=>x.classList.remove('active'));$(`#screen-${screen}`).classList.add('active');
 $$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===screen));
 $('.bottom-nav').classList.toggle('hidden',screen==='game');
 if(screen==='daily')renderDaily();if(screen==='free')renderFree();if(screen==='leaderboard')renderLeaderboard();if(screen==='profile')renderProfile();
 window.scrollTo({top:0,behavior:'instant'});
}

function renderDaily(){
 const date=pragueDateISO(),p=dailyPuzzleFor(date),stats=currentLocalStats(),done=getState().completed[`daily:${date}`];
 $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${p.meta.cells} políček · ${p.answers.length} slov`;
 $('#streakCount').textContent=stats.currentStreak;$('#dailyCompletedStat').textContent=stats.dailyCompleted;$('#longestStreakStat').textContent=stats.longestStreak;$('#bestDailyStat').textContent=fmtTime(stats.bestDailyMs);
 $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':'Hrát dnešní výzvu';$('#shareDailyBtn').classList.toggle('hidden',!done);
 const next=BADGES.find(b=>stats.currentStreak<b.days);$('#nextBadgeText').textContent=next?`${next.icon} ${next.days-stats.currentStreak} d. do „${next.name}“`:'🚀 Jsi legenda';
 $('#badgeRail').innerHTML=BADGES.slice(0,8).map(b=>`<div class="badge-step ${stats.longestStreak>=b.days?'earned':''} ${next?.days===b.days?'current':''}"><span class="emoji">${b.icon}</span><strong>${b.days} dní</strong><small>${b.name}</small></div>`).join('');
}

function renderFree(){
 const s=getState();
 $('#difficultyCards').innerHTML=Object.entries(DIFF).map(([key,d])=>{const total=puzzleDB.free[key].length;const done=puzzleDB.free[key].filter(p=>s.completed[`free:${p.id}`]).length;const pct=Math.round(done/total*100);return `<article class="difficulty-card card"><div><span class="eyebrow">${done}/${total} HOTOVO</span><h2>${d.icon} ${d.label}</h2><p class="muted">${d.desc}</p><div class="progress-line"><span style="width:${pct}%"></span></div></div><div class="difficulty-icon">${d.icon}</div><button class="secondary-btn" data-play-free="${key}">${done===total?'Hrát znovu':'Najít další úlohu'}</button></article>`}).join('');
 $$('[data-play-free]').forEach(b=>b.onclick=()=>startFree(b.dataset.playFree));
}

function startFree(diff){const s=getState(),list=puzzleDB.free[diff],unsolved=list.filter(p=>!s.completed[`free:${p.id}`]);const pool=unsolved.length?unsolved:list;const p=pool[Math.floor(Math.random()*pool.length)];startGame(p,'free',null)}

function startDaily(){const date=pragueDateISO(),done=getState().completed[`daily:${date}`];if(done){showDailyResult(date,done);return}startGame(dailyPuzzleFor(date),'daily',date)}

function startGame(puzzle,mode,dailyDate){
 stopTimer();currentGame={puzzle,mode,dailyDate,found:[],used:new Map(),path:[],dragging:false,moves:0,start:performance.now(),elapsedMs:0,finished:false};
 $('#gameModeLabel').textContent=mode==='daily'?'Denní výzva':'Volná hra';$('#gameDifficulty').textContent=`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}`;
 renderGameBoard();renderGameHUD();message('');nav('game');startTimer();
}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function startTimer(){stopTimer();timerId=setInterval(()=>{if(!currentGame||currentGame.finished)return;currentGame.elapsedMs=performance.now()-currentGame.start;$('#timer').textContent=fmtTime(currentGame.elapsedMs)},250)}
function renderGameHUD(){const g=currentGame,p=g.puzzle;$('#moves').textContent=`${g.moves} tahů`;$('#gameProgress').textContent=`${g.found.length} / ${p.answers.length}`;$('#lengths').innerHTML=p.lengths.map((len,i)=>{const found=g.found.find(f=>f.answerIndex===i);return `<span class="length-pill ${found?'found':''}" ${found?`style="background:${COLORS[found.colorIndex%COLORS.length]}"`:''}>${found?found.word:len}</span>`}).join('');$('#undoBtn').disabled=!g.found.length}
function renderGameBoard(){
 const g=currentGame,p=g.puzzle,mask=new Set(p.mask),board=$('#board');board.style.gridTemplateColumns=`repeat(${p.cols},1fr)`;board.innerHTML='';
 for(let i=0;i<p.rows*p.cols;i++){if(!mask.has(i)){const v=document.createElement('div');v.className='void-cell';board.appendChild(v);continue}const c=document.createElement('div');c.className='cell';c.dataset.index=i;c.textContent=p.letters[i];const color=g.used.get(i);if(color!=null){c.classList.add('used');c.style.setProperty('--word-color',COLORS[color%COLORS.length])}c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointerenter',pointerEnter);board.appendChild(c)}requestAnimationFrame(drawPaths)}
function pNeighbours(i){const p=currentGame.puzzle,r=Math.floor(i/p.cols),c=i%p.cols,mask=new Set(p.mask),out=[];[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{const j=rr*p.cols+cc;if(rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols&&mask.has(j))out.push(j)});return out}
function pointerDown(e){e.preventDefault();const i=+e.currentTarget.dataset.index;if(currentGame.used.has(i))return;currentGame.dragging=true;currentGame.path=[i];updateActive();try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}}
function pointerEnter(e){if(currentGame?.dragging)extendPath(+e.currentTarget.dataset.index)}
function pointerMove(e){if(!currentGame?.dragging)return;const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.cell');if(el)extendPath(+el.dataset.index)}
function extendPath(i){const g=currentGame,path=g.path,last=path.at(-1);if(i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();updateActive();return}if(g.used.has(i)||path.includes(i)||!pNeighbours(last).includes(i))return;path.push(i);updateActive()}
function pointerUp(){if(!currentGame?.dragging)return;currentGame.dragging=false;submitPath()}
function currentWord(){return currentGame.path.map(i=>currentGame.puzzle.letters[i]).join('')}
function updateActive(){$$('.cell').forEach(c=>c.classList.toggle('active',currentGame.path.includes(+c.dataset.index)));$('#currentWord').textContent=currentGame.path.length?currentWord():'—';drawPaths()}
function samePath(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function submitPath(){
 const g=currentGame,word=currentWord();if(!word){g.path=[];return updateActive()}g.moves++;
 const ai=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
 if(ai>=0){const colorIndex=g.found.length%COLORS.length;g.found.push({answerIndex:ai,word,colorIndex,path:[...g.path]});g.path.forEach(i=>g.used.set(i,colorIndex));message(`✓ ${word}`,'good')}else message(word.length<3?'Zkus delší slovo.':`„${word}“ do řešení nezapadá.`,'bad');
 g.path=[];renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';if(g.found.length===g.puzzle.answers.length)finishGame();
}
function undo(){const g=currentGame,f=g.found.pop();if(!f)return;f.path.forEach(i=>g.used.delete(i));g.moves++;message(`Vráceno: ${f.word}`);renderGameBoard();renderGameHUD()}
function resetGame(){const g=currentGame;g.found=[];g.used=new Map();g.path=[];g.moves=0;g.start=performance.now();g.elapsedMs=0;message('Úloha resetována.');renderGameBoard();renderGameHUD()}
function hint(){const g=currentGame,missing=g.puzzle.answers.map((a,i)=>({a,i})).filter(x=>!g.found.some(f=>f.answerIndex===x.i));if(!missing.length)return;const pick=missing[Math.floor(Math.random()*missing.length)],cell=$(`.cell[data-index="${pick.a.path[0]}"]`);cell?.classList.add('hint');message(`Začni písmenem ${pick.a.word[0]}. Hledáš ${pick.a.word.length} písmen.`);setTimeout(()=>cell?.classList.remove('hint'),2200)}
function message(t,kind=''){$('#gameMessage').textContent=t;$('#gameMessage').className=`game-message ${kind}`}
function drawPaths(){
 if(!currentGame)return;const board=$('#board'),svg=$('#pathLayer'),br=board.getBoundingClientRect();if(!br.width)return;svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
 const paths=[...currentGame.found.map(f=>({path:f.path,color:COLORS[f.colorIndex%COLORS.length]}))];if(currentGame.path.length>1)paths.push({path:currentGame.path,color:'#6b8877'});
 paths.forEach(({path,color})=>{if(path.length<2)return;const pts=path.map(i=>{const c=$(`.cell[data-index="${i}"]`),r=c.getBoundingClientRect();return `${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`}).join(' ');const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',color);pl.setAttribute('stroke-width','8');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');pl.setAttribute('opacity','.58');svg.appendChild(pl)});
}

async function finishGame(){
 const g=currentGame;g.finished=true;g.elapsedMs=performance.now()-g.start;stopTimer();const key=challengeKey(g.mode,g.puzzle,g.dailyDate),state=getState(),old=state.completed[key];
 const rec={puzzleId:g.puzzle.id,challengeKey:key,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate,elapsedMs:Math.round(g.elapsedMs),moves:g.moves,points:pointsFor(g.mode,g.puzzle.difficulty),completedAt:new Date().toISOString()};
 if(!old){state.completed[key]=rec}else{state.completed[key]={...old,elapsedMs:Math.min(old.elapsedMs,rec.elapsedMs),moves:Math.min(old.moves,rec.moves)}}saveState(state);queueResult(rec);
 const beforeLongest=calcLongest(Object.values(getState().completed).filter(r=>r.mode==='daily'&&r.challengeKey!==key).map(r=>r.dailyDate));const stats=currentLocalStats();const newBadge=(!old&&g.mode==='daily')?BADGES.find(b=>b.days>beforeLongest&&b.days<=stats.longestStreak):null;
 $('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';$('#winTitle').textContent=g.mode==='daily'?'Daily hotovo!':'Vyřešeno!';$('#winText').textContent=`${fmtTime(g.elapsedMs)} · ${g.moves} tahů · ${DIFF[g.puzzle.difficulty].label}`;
 $('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="background:${COLORS[f.colorIndex%COLORS.length]}">${f.word}</span>`).join('');
 $('#newBadgeBox').classList.toggle('hidden',!newBadge);if(newBadge)$('#newBadgeBox').innerHTML=`<span class="emoji">${newBadge.icon}</span><strong> Nový odznak: ${newBadge.name}</strong><div>${newBadge.days} dní v řadě</div>`;
 $('#winShareBtn').classList.toggle('hidden',g.mode!=='daily');$('#winMenuBtn').classList.toggle('hidden',g.mode!=='free');$('#winPrimaryBtn').textContent=g.mode==='daily'?'Zpět na dnešek':'Další úloha';$('#winModal').classList.remove('hidden');renderDaily();renderFree();renderProfile();syncQueue();
}
function closeWinAndContinue(){const mode=currentGame?.mode,diff=currentGame?.puzzle.difficulty;$('#winModal').classList.add('hidden');if(mode==='free')startFree(diff);else nav('daily')}
function closeWinToMenu(){const mode=currentGame?.mode;$('#winModal').classList.add('hidden');nav(mode==='daily'?'daily':'free')}
function showDailyResult(date,rec){
 const p=dailyPuzzleFor(date),stats=currentLocalStats();stopTimer();currentGame={puzzle:p,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};
 $('#winBadge').textContent='☀️';$('#winTitle').textContent='Dnešní Daily už máš hotovou';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${rec.moves} tahů · ${DIFF[p.difficulty].label}`;
 $('#winWords').innerHTML=p.answers.map((a,i)=>`<span class="win-word" style="background:${COLORS[i%COLORS.length]}">${a.word}</span>`).join('');
 $('#newBadgeBox').classList.add('hidden');$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').textContent='Zpět na dnešek';$('#winModal').classList.remove('hidden');
}
function shareText(){const g=currentGame,stats=currentLocalStats(),date=g?.dailyDate||pragueDateISO();return `Proplet · ${formatDateCZ(date)}\n${DIFF[g?.puzzle.difficulty||dailyPuzzleFor(date).difficulty].icon} ${DIFF[g?.puzzle.difficulty||dailyPuzzleFor(date).difficulty].label} · ⏱ ${fmtTime(g?.elapsedMs||getState().completed[`daily:${date}`]?.elapsedMs)} · 🔥 ${stats.currentStreak} dní\n${stats.currentStreak?BADGES.filter(b=>b.days<=stats.longestStreak).at(-1)?.icon||'🧩':'🧩'} proplet`}
async function shareDaily(){const text=shareText();try{if(navigator.share)await navigator.share({title:'Proplet',text});else{await navigator.clipboard.writeText(text);alert('Výsledek je zkopírovaný do schránky.')}}catch{}}

function queueResult(rec){const q=getQueue();q.push(rec);saveQueue(q)}
async function api(path,opts={}){const p=getProfile(),headers={'Content-Type':'application/json',...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;const r=await fetch(path,{...opts,headers});if(!r.ok){let msg='Server neodpověděl';try{msg=(await r.json()).detail||msg}catch{}throw new Error(msg)}return r.json()}
async function syncQueue(){const p=getProfile();if(!p?.token)return;const q=getQueue();if(!q.length){refreshRemoteProfile();return}const left=[];for(const r of q){try{await api('/api/result',{method:'POST',body:JSON.stringify({puzzle_id:r.puzzleId,challenge_key:r.challengeKey,mode:r.mode,difficulty:r.difficulty,elapsed_ms:r.elapsedMs,moves:r.moves,daily_date:r.dailyDate})})}catch{left.push(r)}}saveQueue(left);refreshRemoteProfile()}
async function refreshRemoteProfile(){const p=getProfile();if(!p?.token)return null;try{const me=await api('/api/me');saveProfile({...p,name:me.name,familyCode:me.familyCode,stats:me.stats});return me}catch{return null}}

function updateProfileChip(){const p=getProfile();$('#profileChipText').textContent=p?.name||'Hráč'}
function openProfileModal(){$('#profileModal').classList.remove('hidden');const p=getProfile();if(p){$('#playerNameInput').value=p.name||'';$('#familyCodeInput').value=p.familyCode||''}}
async function saveNewProfile(){const name=$('#playerNameInput').value.trim(),family_code=$('#familyCodeInput').value.trim();$('#profileFormError').textContent='';if(!name||!family_code){$('#profileFormError').textContent='Vyplň jméno i rodinný kód.';return}try{const p=await api('/api/player',{method:'POST',body:JSON.stringify({name,family_code})});saveProfile({id:p.id,name:p.name,familyCode:p.familyCode,token:p.token,stats:p.stats});$('#profileModal').classList.add('hidden');await syncQueue();renderProfile();renderLeaderboard()}catch(e){$('#profileFormError').textContent=e.message.includes('Failed to fetch')?'Server zatím není spuštěný. Hra funguje dál lokálně.':e.message}}

function renderProfile(){
 const p=getProfile(),local=currentLocalStats(),stats=p?.stats||local;if(!p){$('#profileCard').innerHTML=`<h2>Hraješ lokálně</h2><p class="muted">Výsledky se ukládají v tomto telefonu. Připojením hráče je můžeš posílat do rodinného leaderboardu.</p><button id="profileConnectBtn" class="primary-btn big">Připojit hráče</button>`;setTimeout(()=>$('#profileConnectBtn')&&($('#profileConnectBtn').onclick=openProfileModal),0)}else{$('#profileCard').innerHTML=`<div class="profile-summary"><div><div class="profile-name">${esc(p.name)}</div><div class="profile-family">Rodina: ${esc(p.familyCode)}</div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>${stats.currentStreak||0}</strong><small>dní</small></div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">Body</span><strong>${stats.points??local.points}</strong></div><div class="profile-stat"><span class="stat-label">Hotovo</span><strong>${stats.totalCompleted??local.totalCompleted}</strong></div><div class="profile-stat"><span class="stat-label">Daily</span><strong>${stats.dailyCompleted??local.dailyCompleted}</strong></div><div class="profile-stat"><span class="stat-label">Rekord streak</span><strong>${stats.longestStreak??local.longestStreak}</strong></div></div><button id="syncBtn" class="secondary-btn" style="width:100%;margin-top:12px">Synchronizovat (${getQueue().length} čeká)</button>`;setTimeout(()=>$('#syncBtn')&&($('#syncBtn').onclick=async()=>{await syncQueue();renderProfile()}),0)}
 const longest=stats.longestStreak??local.longestStreak;$('#profileBadges').innerHTML=BADGES.map(b=>`<div class="profile-badge ${longest>=b.days?'earned':''}"><span class="emoji">${b.icon}</span><strong>${b.name}</strong><small>${b.days} dní v řadě</small></div>`).join('');
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

async function renderLeaderboard(){
 const p=getProfile(),gate=$('#leaderboardGate'),content=$('#leaderboardContent');if(!p?.familyCode){gate.classList.remove('hidden');content.classList.add('hidden');gate.innerHTML=`<h2>Připoj rodinu</h2><p class="muted">Stačí jméno a společný rodinný kód.</p><button id="leaderConnectBtn" class="primary-btn big">Připojit hráče</button>`;setTimeout(()=>$('#leaderConnectBtn')&&($('#leaderConnectBtn').onclick=openProfileModal),0);return}
 gate.classList.add('hidden');content.classList.remove('hidden');$('#leaderboardList').innerHTML='<div class="gate card">Načítám pořadí…</div>';
 try{const data=await api(`/api/leaderboard?family_code=${encodeURIComponent(p.familyCode)}&daily_date=${pragueDateISO()}`);renderLeaderData(data)}catch{$('#leaderboardList').innerHTML='<div class="gate card"><strong>Leaderboard je offline.</strong><p class="muted">Lokální hraní funguje dál; po spuštění serveru se výsledky dosynchronizují.</p></div>'}
}
function renderLeaderData(data){const rows=leaderTab==='daily'?data.daily:data.overall;if(!rows.length){$('#leaderboardList').innerHTML='<div class="gate card">Zatím tu nikdo nemá výsledek.</div>';return}$('#leaderboardList').innerHTML=rows.map(r=>`<div class="leader-row"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.name)}</strong><small>${leaderTab==='daily'?`${r.moves} tahů`:`🔥 ${r.currentStreak} · ${r.totalCompleted} úloh`}</small></div><div class="leader-score"><strong>${leaderTab==='daily'?fmtTime(r.elapsedMs):`${r.points} b.`}</strong><small>${leaderTab==='daily'?'čas':'body'}</small></div></div>`).join('')}

function bind(){
 $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$('#playDailyBtn').onclick=startDaily;$('#shareDailyBtn').onclick=()=>{const date=pragueDateISO(),rec=getState().completed[`daily:${date}`];currentGame={puzzle:dailyPuzzleFor(date),dailyDate:date,elapsedMs:rec?.elapsedMs};shareDaily()};
 $('#backFromGame').onclick=()=>{stopTimer();nav(currentGame?.mode==='daily'?'daily':'free')};$('#undoBtn').onclick=undo;$('#resetBtn').onclick=resetGame;$('#hintBtn').onclick=hint;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;
 $('#closeProfileModal').onclick=()=>$('#profileModal').classList.add('hidden');$('#skipProfileBtn').onclick=()=>$('#profileModal').classList.add('hidden');$('#saveProfileBtn').onclick=saveNewProfile;
 $$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});
 $('#board').addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('resize',drawPaths);
}

async function boot(){
 try{puzzleDB=await fetch('/puzzles.json').then(r=>{if(!r.ok)throw new Error();return r.json()})}catch{$('body').innerHTML='<main style="padding:30px;font-family:system-ui"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Spusť aplikaci přes server podle README.</p></main>';return}
 bind();updateProfileChip();renderDaily();renderFree();renderProfile();syncQueue();
 if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});
 let lastKnownDate=pragueDateISO();
 setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily();}},60000);
}
boot();
