/* Native adapter derived from 553fb357 preview/gen6. No API or account client. */
'use strict';
const previewBank = window.PROPLET_MK100_PREVIEW;
const previewColors = ['#7A3B32','#175944','#2E507E','#66500F','#574A8A','#7A3E61','#0F5862','#6B3F19','#3E5918','#1D526A','#6E3D79','#303A78'];
const previewQuery = selector => document.querySelector(selector);
const previewQueryAll = selector => [...document.querySelectorAll(selector)];
const previewSamePath = (a,b) => Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const previewEscape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const previewSettings = {magnifier:true};
const previewWords = new Set(window.PROPLET_MK100_RECOGNITION||[]);
const previewKey = `proplet-mk100-isolated-v2:${previewBank?.contentHash||'invalid'}`;
const previewProfiles = {relief:'Úleva',main:'Hlavní série',challenge:'Výzva',summit:'Vrchol'};
let previewCatalog = new URLSearchParams(location.search).get('set')==='representative'?'representative':'hundred';
function previewSelectedBoards(){return previewCatalog==='representative'?previewBank.boards.filter(p=>previewBank.representativeIds.includes(p.id)):previewBank.boards}
let currentGame = null;
let previewScreen = 'preview';
let previewState = {};
let previewHintTimer = null;
try { previewState=JSON.parse(localStorage.getItem(previewKey)||'{}'); } catch {}
if(!previewState||typeof previewState!=='object'||Array.isArray(previewState))previewState={};

function previewReadProgress(puzzle){
  const row=previewState[puzzle.id];if(!row||row.contentHash!==puzzle.meta.contentHash)return null;
  const seen=new Set();
  const found=(Array.isArray(row.found)?row.found:[]).filter(f=>{
    const answer=puzzle.answers[f.answerIndex];
    if(!answer||seen.has(f.answerIndex)||answer.word!==f.word||!previewSamePath(answer.path,f.path))return false;
    seen.add(f.answerIndex);return true;
  }).map((f,i)=>({...f,colorIndex:i%previewColors.length}));
  return {...row,found,elapsedMs:Math.max(0,Number(row.elapsedMs)||0),moves:Math.max(found.length,Number(row.moves)||0),hints:Math.max(0,Number(row.hints)||0)};
}
function previewPersist(game=currentGame){
  if(!game)return false;
  previewState[game.puzzle.id]={contentHash:game.puzzle.meta.contentHash,found:game.found,elapsedMs:Math.round(previewSession.elapsed(game)),moves:game.moves,hints:game.hints,wrongAttempts:game.wrongAttempts,maxHintLevel:game.maxHintLevel,finished:game.finished};
  try{localStorage.setItem(previewKey,JSON.stringify(previewState));return true}catch{return false}
}
const previewSession=window.PropletGameState.create({colorCount:previewColors.length,readPlaytestProgress:previewReadProgress,writePlaytestProgress:previewPersist});
const previewBoard=window.PropletGameBoard.create({getGame:()=>currentGame,getScreen:()=>previewScreen,query:previewQuery,queryAll:previewQueryAll,colors:previewColors,requestAnimationFrameFn:requestAnimationFrame,onPointerDown:event=>previewInput.pointerDown(event),onPointerEnter:event=>previewInput.pointerEnter(event)});
const previewInput=window.PropletGameInput.create({getGame:()=>currentGame,neighbours:previewBoard.neighbours,updateActive:previewUpdateActive,clearHints:previewClearHints,submit:previewSubmit,query:previewQuery,colors:previewColors,escapeHtml:previewEscape,getSettings:()=>previewSettings});
const previewHints=window.PropletGameHints.create({getGame:()=>currentGame});
function fitGameBoard(){return previewBoard.fit()}
function drawPaths(){return previewBoard.drawPaths()}
// Touch browsers can suppress a compatibility click after a board drag.
// Activate a stationary touch release, and consume only its duplicate click.
// Keyboard (detail=0) and ordinary mouse activation still use the click path.
function previewBindAction(button,action){
  let pressed=null,lastTouch=-Infinity;
  button.addEventListener('pointerdown',e=>{
    pressed=e.pointerType==='touch'&&e.isPrimary!==false?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  });
  button.addEventListener('pointermove',e=>{
    if(pressed&&e.pointerId===pressed.id&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>12)pressed=null;
  });
  button.addEventListener('pointercancel',()=>{pressed=null});
  button.addEventListener('pointerup',e=>{
    const down=pressed;pressed=null;
    if(!down||e.pointerId!==down.id||button.disabled)return;
    const r=button.getBoundingClientRect();
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>12||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    lastTouch=performance.now();action(e);
  });
  button.addEventListener('click',e=>{
    if(e.detail!==0&&performance.now()-lastTouch<700){e.preventDefault();return}
    action(e);
  });
}
function previewCount(n,one,few,many){return `${n} ${n===1?one:n>=2&&n<=4?few:many}`}
function previewTime(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function previewMessage(text,kind=''){const el=previewQuery('#gameMessage');el.textContent=text;el.className=`game-message ${kind}`}
function previewUpdateActive(){
  const path=currentGame?.path||[],order=new Map(path.map((n,i)=>[n,i]));
  previewQueryAll('.cell').forEach(c=>{const step=order.get(+c.dataset.index),active=step!==undefined;c.classList.toggle('active',active);c.classList.toggle('route-start',active&&step===0);c.classList.toggle('route-end',active&&step===path.length-1);if(active)c.dataset.routeOrder=String(step+1);else delete c.dataset.routeOrder});
  previewQuery('#currentWord').textContent=previewInput.currentWord()||'—';drawPaths();
}
function previewHud(){
  const g=currentGame;if(!g)return;
  const remaining=g.puzzle.answers.filter((a,i)=>!g.found.some(f=>f.answerIndex===i)).map(a=>a.word.length).sort((a,b)=>a-b);
  previewQuery('#lengths').innerHTML=remaining.map(n=>`<span class="length-pill">${n}</span>`).join('')||'<span class="all-found">✓ nic</span>';
  previewQuery('#foundWords').innerHTML=g.found.map(f=>`<span class="found-word-chip" style="--word-color:${previewColors[f.colorIndex]};background:color-mix(in srgb,var(--word-color) 58%,white)">${previewEscape(f.word)}</span>`).join('')||'<span class="empty-found">zatím nic</span>';
  previewQuery('#gameProgress').textContent=`${g.found.length}/${g.puzzle.answers.length}`;
  previewQuery('#moves').textContent=previewCount(g.moves,'tah','tahy','tahů');
  previewQuery('#cleanStatus').textContent=g.hints?'S nápovědou':'Čistě';
  const hintLabel=g.hints?`💡 ${g.hints}×`:'💡 Nápověda',hintButton=previewQuery('#hintBtn');
  // Do not replace a touched label node on every clock tick.
  if(hintButton.textContent!==hintLabel)hintButton.textContent=hintLabel;
  previewQuery('#timer').textContent=previewTime(previewSession.elapsed(g));
  const magnifierButton=previewQuery('#magnifierQuickBtn'),magnifierAvailable=previewInput.magnifierAvailable();
  magnifierButton.classList.toggle('hidden',!magnifierAvailable);
  magnifierButton.classList.toggle('on',previewSettings.magnifier);
  magnifierButton.setAttribute('aria-pressed',String(previewSettings.magnifier));
  magnifierButton.setAttribute('aria-label',previewSettings.magnifier?'Vypnout lupu při tahu':'Zapnout lupu při tahu');
  magnifierButton.title=previewSettings.magnifier?'Lupa při tahu zapnutá':'Lupa při tahu vypnutá';
  magnifierButton.closest('.game-actions')?.classList.toggle('magnifier-control-visible',magnifierAvailable);
  const stage=previewQuery('#boardStage');stage.classList.toggle('board-complete',g.finished);stage.style.setProperty('--solve-progress',g.found.length/g.puzzle.answers.length);
}
function previewClearHints(){clearTimeout(previewHintTimer);previewQueryAll('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}
function previewSubmit(){
  const g=currentGame;if(!g||g.finished||g.pausedAt!=null)return;
  const word=previewInput.currentWord(),path=[...g.path];g.path=[];
  if(word.length<4){previewMessage('Slova mají aspoň 4 písmena.');previewUpdateActive();return}
  g.moves++;
  const ai=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&previewSamePath(a.path,path));
  if(ai>=0){const colorIndex=g.found.length%previewColors.length;g.found.push({answerIndex:ai,word,path,colorIndex});path.forEach(i=>g.used.set(i,colorIndex));g.lastFound=path;previewMessage(`✓ ${word}`,'good')}
  else{
    g.wrongAttempts++;g.wrongPath=path;
    const known=g.puzzle.answers.some(a=>a.word===word);
    previewMessage(known?`„${word}“ je správné slovo, ale tahle cesta se do plochy nevejde.`:previewWords.has(word)?`„${word}“ je platné slovo navíc. V preview bez XP.`:`„${word}“ do tohohle Propletu nezapadá.`,known?'bad':previewWords.has(word)?'good':'bad');
    setTimeout(()=>{if(currentGame!==g)return;g.wrongPath=[];previewBoard.render()},210);
  }
  previewBoard.render();previewHud();previewUpdateActive();previewPersist();
  if(g.found.length===g.puzzle.answers.length)previewFinish();
}
function previewFinish(){
  const g=currentGame;if(!g)return;
  const elapsed=previewSession.elapsed(g);g.baseElapsedMs=elapsed;g.start=performance.now();g.pausedAt=g.start;g.finished=true;previewSession.stopTimer();previewPersist();previewHud();
  previewQuery('#finishSummary').textContent=`${previewTime(elapsed)} · ${previewCount(g.moves,'tah','tahy','tahů')} · ${previewCount(g.hints,'nápověda','nápovědy','nápověd')}`;
  const selected=previewSelectedBoards();previewQuery('#nextBoard').textContent=selected.indexOf(g.puzzle)<selected.length-1?'Další deska':'Přehled desek';
  previewQuery('#finishModal').classList.remove('hidden');previewQuery('#nextBoard').focus();
}
function previewStart(puzzle){
  if(currentGame)previewPersist();previewClearHints();previewSession.stopTimer();
  const row=previewSession.restore(puzzle,'playtest')||{},found=row.found||[];
  currentGame={puzzle,mode:'playtest',found,used:new Map(found.flatMap(f=>f.path.map(i=>[i,f.colorIndex]))),path:[],wrongPath:[],lastFound:[],start:performance.now(),baseElapsedMs:row.elapsedMs||0,pausedAt:null,moves:row.moves||0,hints:row.hints||0,wrongAttempts:row.wrongAttempts||0,maxHintLevel:row.maxHintLevel||0,finished:false,dragging:false};
  previewSession.replace(currentGame);previewScreen='game';
  previewQuery('#screen-preview').classList.remove('active');previewQuery('#screen-game').classList.add('active');document.body.classList.add('playing');
  previewQuery('#gameDifficulty').innerHTML=`<img src="./difficulty/printshop/mozkokalypsa-v2.svg" alt="">Mozkokalypsa · ${puzzle.meta.level}`;
  previewQuery('#gamePauseCover').hidden=true;
  previewMessage(row.found?.length?'Pokračuješ tam, kde jsi skončil.':'Propleť všechna políčka. Slova můžou zatáčet.');previewBoard.render();previewHud();previewUpdateActive();
  previewSession.startTimer(()=>{previewHud();if(Date.now()-(currentGame.lastAutosaveAt||0)>5000){previewPersist();currentGame.lastAutosaveAt=Date.now()}},250);
  if(found.length===puzzle.answers.length)previewFinish();
}
function previewMenu(){
  pauseGameClock('menu');previewScreen='preview';previewQueryAll('.modal').forEach(el=>el.classList.add('hidden'));document.body.classList.remove('playing');previewQuery('#screen-game').classList.remove('active');previewQuery('#screen-preview').classList.add('active');previewRenderMenu();
}
function previewRenderMenu(){
  const el=previewQuery('#previewBoards');el.replaceChildren();
  const selected=previewSelectedBoards();
  previewQuery('#catalogHundred').setAttribute('aria-pressed',String(previewCatalog==='hundred'));
  previewQuery('#catalogRepresentative').setAttribute('aria-pressed',String(previewCatalog==='representative'));
  previewQuery('#previewEvidence').textContent=`${selected.length} desek · 100 políček a 14 slov na každé. Obtížnost kandidátů zatím čeká na ověření hráči.`;
  selected.forEach(p=>{const row=previewReadProgress(p),n=row?.found?.length||0,b=document.createElement('button');b.className=`preview-board${n===p.answers.length?' done':''}`;b.dataset.puzzleId=p.id;b.setAttribute('aria-label',`Deska ${p.meta.level} · ${previewProfiles[p.meta.profile]||''}`);b.innerHTML=`<strong>${String(p.meta.level).padStart(2,'0')}</strong><span>${previewEscape(previewProfiles[p.meta.profile]||'Mozkokalypsa')}</span><small>${n===p.answers.length?'✓ Hotovo':n?`Pokračovat · ${n}/14`:'10 × 10 · 14 slov'}</small>`;previewBindAction(b,()=>previewStart(p));el.appendChild(b)});
}
function pauseGameClock(reason='background'){
  const ok=previewSession.pause(reason,{screen:previewScreen,onUpdateActive:previewUpdateActive});previewInput.hideMagnifier();
  if(ok&&reason!=='menu')previewQuery('#gamePauseCover').hidden=false;return ok;
}
function resumeGameClock(){
  if(document.body.classList.contains('game-phone-landscape-blocked'))return false;
  const ok=previewSession.resume({screen:previewScreen,visibilityState:document.visibilityState,focused:document.hasFocus(),onResume:()=>previewSession.startTimer(()=>previewHud(),250)});
  if(ok)previewQuery('#gamePauseCover').hidden=true;return ok;
}
previewBindAction(previewQuery('#backFromGame'),previewMenu);
previewBindAction(previewQuery('#finishMenu'),previewMenu);
previewBindAction(previewQuery('#nextBoard'),()=>{const selected=previewSelectedBoards(),next=selected[selected.indexOf(currentGame.puzzle)+1];previewQuery('#finishModal').classList.add('hidden');next?previewStart(next):previewMenu()});
function previewSelectCatalog(value){previewCatalog=value;const url=new URL(location.href);value==='representative'?url.searchParams.set('set','representative'):url.searchParams.delete('set');history.replaceState(null,'',url);previewRenderMenu()}
previewBindAction(previewQuery('#catalogHundred'),()=>previewSelectCatalog('hundred'));
previewBindAction(previewQuery('#catalogRepresentative'),()=>previewSelectCatalog('representative'));
previewBindAction(previewQuery('#calmRunBtn'),()=>{const on=document.body.classList.toggle('preview-calm');previewQuery('#calmRunBtn').setAttribute('aria-pressed',String(on))});
previewBindAction(previewQuery('#magnifierQuickBtn'),()=>{previewSettings.magnifier=!previewSettings.magnifier;if(!previewSettings.magnifier)previewInput.hideMagnifier();previewHud()});
previewBindAction(previewQuery('#hintBtn'),()=>{if(currentGame&&!currentGame.finished){previewQuery('#hintModal').classList.remove('hidden');previewQuery('#hintChoices button').focus()}});
previewHints.choices('default').forEach((row,index)=>{const button=document.createElement('button');button.innerHTML=`<strong>${previewEscape(row[0])}</strong><small>${previewEscape(row[1])}</small>`;previewBindAction(button,()=>{
  previewQuery('#hintModal').classList.add('hidden');previewClearHints();const plan=previewHints.applyState(index+1);if(!plan)return;
  const {path,pick,level}=plan;(level===1?path.slice(0,1):level===2?path.slice(0,3):path).forEach((i,n)=>{const c=previewQuery(`.cell[data-index="${i}"]`);c.classList.add(level===1?'hint':level===2?'hint-route':'hint-full');if(level>1&&n<3){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}});
  previewMessage(level===3?`Je to „${pick.a.word}“. Cesta na chvíli svítí.`:level===2?`První tři kroky svítí. Slovo má ${pick.a.word.length} písmen.`:`Začni na ${pick.a.word[0]}. Hledáš slovo o ${pick.a.word.length} písmenech.`);previewHud();previewPersist();previewHintTimer=setTimeout(previewClearHints,level===3?3600:2600);previewQuery('#hintBtn').focus();
});previewQuery('#hintChoices').appendChild(button)});
previewQueryAll('[data-close]').forEach(b=>previewBindAction(b,()=>{previewQuery('#'+b.dataset.close).classList.add('hidden');previewQuery('#hintBtn').focus()}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){previewQuery('#hintModal').classList.add('hidden');previewQuery('#hintBtn').focus()}});
document.addEventListener('pointermove',previewInput.pointerMove,{passive:true});document.addEventListener('pointerup',previewInput.pointerUp);
document.addEventListener('pointercancel',()=>{if(!currentGame)return;currentGame.dragging=false;currentGame.path=[];previewInput.hideMagnifier();previewUpdateActive()});
document.addEventListener('visibilitychange',()=>document.hidden?pauseGameClock():resumeGameClock());window.addEventListener('blur',()=>pauseGameClock());window.addEventListener('focus',resumeGameClock);window.addEventListener('pagehide',()=>previewPersist());
new ResizeObserver(()=>{if(previewScreen==='game'){fitGameBoard();drawPaths();previewHud()}}).observe(previewQuery('#boardStage'));
const expectedCount=previewBank?.previewScope==='development-representative'?12:100;
if(previewBank?.kind!=='gen6-unpublished-preview'||!['verified-unpublished','technically-verified-unpublished','candidate-technically-verified-awaiting-editorial','representative-internally-verified'].includes(previewBank.status)||previewBank.boards?.length!==expectedCount||previewBank.representativeIds?.length!==12||previewBank.publicationAuthorized!==false||previewBank.playtestActivationAuthorized!==false)throw new Error('Preview requires the complete verified candidate package.');
if(expectedCount===12){previewQuery('#catalogHundred').disabled=true;previewCatalog='representative';previewQuery('#previewDescription').textContent='Pracovní dvanáctka pro ověření ovládání.'}
previewRenderMenu();
