/* Installed before boot, in the real application's lexical scope; preview only. */
function installOrderPreview(){
 'use strict';
 if(!window.PROPLET_ORDER_PREVIEW)throw new Error('Missing preview isolation prelude');
 const E=window.PropletFreeOrder,lab=window.PROPLET_ORDER_PREVIEW;
 const labels={existing:'Stávající hráč',newcomer:'Nováček',resume:'Rozehraná deska',seen:'Část Gen 5 hotová'};
 const requested=new URLSearchParams(location.search).get('scenario'),scenario=Object.hasOwn(labels,requested)?requested:'existing';
 const scope='order-preview-v1-'+scenario,orderKey='proplet-order-preview-plan:'+scope;
 let records={},memoryState=null,storageAvailable=true;
 try{records=JSON.parse(localStorage.getItem(orderKey)||'{}')}catch{storageAvailable=false}
 const originalGetState=getState,originalSaveState=saveState;
 getProfile=()=>({id:scope,name:labels[scenario],avatar:'🙂',preview:true});
 getState=(s=scope)=>{try{return originalGetState(s)}catch{storageAvailable=false;return memoryState||blankState()}};
 saveState=(value,s=scope)=>{memoryState=value;try{return originalSaveState(value,s)}catch{storageAvailable=false}};
 const persist=()=>{try{localStorage.setItem(orderKey,JSON.stringify(records))}catch{storageAvailable=false}};
 const completed=diff=>Object.values(getState().completed||{}).filter(r=>r.mode==='free'&&r.difficulty===diff).map(r=>r.puzzleId);
 function record(diff){
  if(!records[diff]){records[diff]={mode:scenario==='newcomer'?'varied':'numeric',offered:scenario==='newcomer',newcomer:scenario==='newcomer'};persist()}
  const r=records[diff];
  if(r.mode==='varied'&&!r.plan){r.plan=E.buildPlan({bank:sortedFreeBank(diff),difficulty:diff,completedIds:completed(diff),newcomer:r.newcomer,recentIds:completed(diff).slice(-2),introIds:window.PROPLET_ORDER_MANIFEST.intro[diff]||[]});persist()}
  return r;
 }
 function seed(data){
  const s=getState();if(s.orderPreviewSeed===1)return;
  const next=blankState();next.orderPreviewSeed=1;
  function complete(p){const key='free:'+p.id;next.completed[key]={puzzleId:p.id,challengeKey:key,mode:'free',difficulty:p.difficulty,level:p.meta.level,contentGeneration:p.meta.contentGeneration||data.freeGeneration,elapsedMs:45000,moves:p.answers.length,points:DIFF[p.difficulty].xp,hintsUsed:0,wrongAttempts:0,maxHintLevel:0,cleanSolve:true,completedAt:new Date(Date.UTC(2026,8,18,12,0,Object.keys(next.completed).length)).toISOString()}}
  if(scenario!=='newcomer')for(const [diff,n] of [['easy',36],['medium',12]]){
   const bank=E.canonicalBank(data.free[diff],diff),old=bank.filter(p=>!E.isGen5(p));old.slice(0,n).forEach(complete);
   if(scenario==='seen')bank.filter(E.isGen5).slice(0,3).forEach(complete);
   if(scenario==='resume'){
    const p=old[n],a=p.answers[0];next.inProgress['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:diff,dailyDate:null,found:[{answerIndex:0,word:a.word,colorIndex:0,path:[...a.path]}],moves:1,hints:0,wrongAttempts:0,maxHintLevel:0,elapsedMs:18000,attemptId:'preview-resume-'+diff,savedAt:Date.now()};
   }
  }
  saveState(next);
 }
 loadPuzzleDatabase=async()=>{const r=await fetch('/puzzles.json');if(!r.ok)throw new Error('Preview content failed');const data=await r.json();seed(data);return data};
 // No production account, analytics, synchronization, update or push paths are used.
 api=async(path)=>{
  if(String(path).startsWith('/api/play-session/config'))return {enabled:false,isolatedPreview:true};
  if(String(path).startsWith('/api/config'))return {environment:'preview',version:APP_VERSION,isolatedPreview:true,backend:'none',canonicalOrigin:location.origin};
  if(/leaderboard|ranking/.test(String(path)))return {rows:[],total:0,anonymous:true,myRank:null,nextOffset:null};
  const error=new Error('V tomto preview není připojený server ani účet.');error.status=403;throw error;
 };
 queueResult=()=>{};syncQueue=async()=>({ok:true});claimTelemetryAfterAuth=async()=>{};
 trackProductEvent=()=>{};startAttemptTelemetry=async()=>{};sendAttemptCheckpoint=async()=>{};finishAttemptTelemetry=async()=>{};
 registerServiceWorker=()=>{};updatePushUI=()=>{};refreshRollingContent=async()=>null;
 loadTajenkaFixture=async()=>{TAJENKA_AVAILABLE=false;tajenkaPuzzle=null;return null};
 openOnboarding=()=>{};maybeOfferAccountNudge=()=>false;shouldOfferAccountNudge=()=>0;maybeOfferPushNudge=async()=>false;maybeOfferInstallNudge=()=>false;maybeOfferProgressGuard=()=>false;
 openProfileModal=()=>showToast('Tady používáš jen testovací postup. Přihlášení je vypnuté.');
 const oldProgress=freeProgress;
 freeProgress=diff=>{
  const q=oldProgress(diff);if(!E.SUPPORTED.includes(diff))return q;
  const r=record(diff),done=completed(diff),picked=E.next({bank:q.list,difficulty:diff,completedIds:done,resumeId:q.resume?.id,mode:r.mode,plan:r.plan}),counts=E.progress({bank:q.list,difficulty:diff,completedIds:done});
  return {...q,done:counts.done,actual:counts.done,total:counts.total,pct:counts.percent,nextUnsolved:picked.puzzle,orderMode:r.mode};
 };
 const oldStart=startFree;
 startFree=async diff=>{if(!E.SUPPORTED.includes(diff))return oldStart(diff);const q=freeProgress(diff),p=q.resume||q.nextUnsolved||q.list[0];if(p)return startGame(p,'free',null)};
 startStarterWarmup=()=>{const q=freeProgress('easy'),p=q.resume||q.nextUnsolved||q.list[0];if(p)return startGame(p,'free',null,{postStarterWarmup:true})};
 function change(diff,mode){
  saveGameProgress();const r=record(diff);r.mode=mode;r.offered=true;persist();record(diff);renderFree();renderQuickPlay();paintDiagnostics();
  showToast(mode==='varied'?'Pestřejší pořadí je zapnuté. Tvůj postup zůstává.':'Pokračuješ podle původních čísel.');
 }
 function mountCardControls(){
  for(const diff of E.SUPPORTED){
   const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
   card.querySelector('.order-controls')?.remove();const r=record(diff),q=freeProgress(diff),node=document.createElement('div');node.className='order-controls';
   const next=q.resume||q.nextUnsolved;
   if(!r.offered&&scenario!=='newcomer')node.innerHTML='<strong>Zkus pestřejší pořadí</strong><p>Novější desky mezi těmi zbývajícími. Tvůj postup zůstane.</p><div class="order-actions"><button type="button" class="order-optin" data-order-mode="varied">Zapnout</button><button type="button" class="order-later">Zatím ne</button></div>';
   else node.innerHTML='<div class="order-switch" role="group" aria-label="Pořadí: '+DIFF[diff].label+'"><button type="button" data-order-mode="varied" aria-pressed="'+(r.mode==='varied')+'">Pestře</button><button type="button" data-order-mode="numeric" aria-pressed="'+(r.mode==='numeric')+'">Podle čísel</button></div>';
   const summary=document.createElement('small');summary.className='order-next';summary.textContent='Vyřešeno '+q.done+' z '+q.total+(next?' · '+(q.resume?'Rozehráno':'Další')+': č. '+next.meta.level:' · Všechno hotovo');node.append(summary);
   card.append(node);
   for(const b of node.querySelectorAll('[data-order-mode]'))b.onclick=e=>{e.stopPropagation();change(diff,b.dataset.orderMode)};
   node.querySelector('.order-later')?.addEventListener('click',()=>{r.offered=true;persist();renderFree()});
  }
 }
 const oldRender=renderFree;renderFree=()=>{oldRender();mountCardControls()};
 const oldGame=startGame;startGame=async(...args)=>{await oldGame(...args);paintDiagnostics()};
 function stateView(){return {scenario,scope,storageAvailable,current:currentGame?{id:currentGame.puzzle.id,level:currentGame.puzzle.meta?.level,gen5:E.isGen5(currentGame.puzzle),found:currentGame.found.length,finished:currentGame.finished}:null,easy:view('easy'),medium:view('medium')}}
 function view(diff){const q=freeProgress(diff),r=record(diff),pending=new Set(completed(diff)),sequence=[];let resume=q.resume?.id;for(let i=0;i<8;i++){const n=E.next({bank:q.list,difficulty:diff,completedIds:pending,resumeId:resume,mode:r.mode,plan:r.plan}).puzzle;if(!n)break;sequence.push({id:n.id,level:n.meta.level,gen5:E.isGen5(n)});pending.add(n.id);resume=null}return {mode:r.mode,done:q.done,total:q.total,next:sequence,completed:completed(diff)}}
 function paintDiagnostics(){
  const el=document.getElementById('order-diagnostics');if(!el||!puzzleDB)return;
  const v=stateView();el.textContent=E.SUPPORTED.map(d=>DIFF[d].label+': '+v[d].next.map(p=>'č. '+p.level+(p.gen5?' (Gen 5)':'')).join(' → ')).join('\n');
  const status=document.getElementById('order-game-status');if(status)status.textContent=v.current?'Hraješ č. '+v.current.level+' · '+(v.current.gen5?'Gen 5':'původní banka'):'';
  for(const id of ['order-solve','order-word']){const b=document.getElementById(id);if(b)b.disabled=!currentGame||currentGame.finished||currentScreen!=='game'}
 }
 async function solve(one=false){
  const g=currentGame;if(!g||g.finished)return;closeTransientModals();if(g.pausedAt!=null)resumeGameClock();
  const missing=g.puzzle.answers.filter((a,i)=>!g.found.some(f=>f.answerIndex===i));
  for(const a of (one?missing.slice(0,1):missing)){if(currentGame!==g||g.finished)break;g.path=[...a.path];submitPath();await new Promise(r=>setTimeout(r,40))}
  paintDiagnostics();
 }
 function mountLab(){
  const box=document.createElement('aside');box.className='order-lab';box.id='order-lab';box.innerHTML='<div class="order-lab-head"><strong>Preview · testovací postup</strong><select id="order-scenario" aria-label="Testovací scénář">'+Object.entries(labels).map(([v,t])=>'<option value="'+v+'"'+(v===scenario?' selected':'')+'>'+t+'</option>').join('')+'</select><button type="button" id="order-reset">Reset scénáře</button></div><p>Skutečné desky, oddělené výsledky. Bez přihlášení a bez databáze.</p><details><summary>Testovací pomůcky a další desky</summary><p id="order-game-status"></p><div class="order-actions"><button type="button" id="order-word">Doplnit jedno slovo</button><button type="button" id="order-solve">Dohrát testově</button><button type="button" id="order-tutorial">Vyzkoušet tutoriál</button></div><pre id="order-diagnostics"></pre></details>';
  document.querySelector('.app-header').after(box);
  document.getElementById('order-scenario').onchange=e=>{saveGameProgress();const u=new URL(location.href);u.searchParams.set('scenario',e.target.value);u.searchParams.set('open','free');u.searchParams.delete('play');location.assign(u.href)};
  document.getElementById('order-reset').onclick=()=>{stopTimer();currentGame=null;saveState(blankState());try{localStorage.removeItem(orderKey)}catch{}location.reload()};
  document.getElementById('order-solve').onclick=()=>solve(false);document.getElementById('order-word').onclick=()=>solve(true);document.getElementById('order-tutorial').onclick=()=>startStarter();
  const observer=new MutationObserver(()=>paintDiagnostics());observer.observe(document.getElementById('screen-game'),{attributes:true,attributeFilter:['class']});
  paintDiagnostics();
 }
 lab.snapshot=stateView;lab.solve=solve;lab.change=change;
 document.addEventListener('proplet:ready',()=>{window.PropletContentRelease?.close?.();closeTransientModals();mountLab();nav('free',{replace:true});renderFree();paintDiagnostics();lab.ready=true},{once:true});
}
