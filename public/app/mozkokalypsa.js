/* Native-game pilot adapter. No polling; metrics stay isolated, rewards are server-owned. */
(function(global){
'use strict';
let ID='mozkokalypsa-round2-20260925';
const query=new URLSearchParams(location.search);
const wantQa=query.get('mozkokalypsa')==='preview';
let status=null,statusScope='',flight=null,active=null,flushing=null,modalReturn=null,launching=false,feedbackBoard=null,expiryTimer=null,countdownTimer=null,serverOffset=0;
const $=s=>document.querySelector(s),scope=()=>wantQa?'qa':(global.getProfile?.()?.id||'guest');
const key=()=>`proplet-playtest:${ID}:${scope()}`;
const read=()=>{try{return JSON.parse(localStorage.getItem(key())||'{}')}catch{return {}}};
function write(value){try{localStorage.setItem(key(),JSON.stringify(value));return true}catch{global.showToast?.('Testovací postup se nepodařilo uložit na zařízení.');return false}}
const uid=()=>crypto.randomUUID();
const isGame=g=>g?.mode==='playtest';
const completeCount=()=>Object.values(read().attempts||{}).filter(a=>a.completed).length;
function pendingCount(){return Object.values(read().attempts||{}).reduce((n,a)=>n+(a.pending?.length||0),0)}
const request=(path,opts={})=>global.api((path.startsWith('/status')?'/api/mozkokalypsa':ID==='mozkokalypsa-round3-interwoven-v2'?'/api/mozkokalypsa3':'/api/mozkokalypsa')+path,opts);
const ICON='/difficulty/printshop/mozkokalypsa-v2.svg?v=1';
let TOTAL=12;
const round3=()=>status?.round===3||status?.previewRound===3;
let transitionTimer=null;
function armTransition(){
 clearTimeout(transitionTimer);transitionTimer=null;
 const at=Date.parse(status?.nextTransitionAt);
 if(!status?.qa&&Number.isFinite(at)&&at>Date.now()+serverOffset)transitionTimer=setTimeout(()=>refresh(),Math.min(2147483647,at-Date.now()-serverOffset+60));
}
function checkTransition(){
 const at=Date.parse(status?.nextTransitionAt);
 if(!status?.qa&&Number.isFinite(at)&&Date.now()+serverOffset>=at)refresh();
}
let inspecting=false;
const rated=row=>Number(row?.reward_points)===200||(status?.qa&&!!row?.feedback?.difficulty&&!!row?.feedback?.fun);
const closed=()=>!status?.qa&&!!status?.closesAt&&Date.now()+serverOffset>=Date.parse(status.closesAt);
function expire(){
 if(!closed()||status?.eligible===false)return;
 status.eligible=false;clearTimeout(expiryTimer);render();
 for(const id of ['#mkHubModal','#mkResultModal'])$(id)?.classList.add('hidden');
 if(isGame(global.currentGame)){global.stopTimer();global.releaseGameWakeLock();global.nav('daily',{replace:true})}
 global.showToast?.('Playtest skončil. Děkujeme za hraní a hodnocení!');
}
function armExpiry(){
 clearTimeout(expiryTimer);
 if(!status?.qa&&status?.closesAt){
  if(closed())expire();else expiryTimer=setTimeout(expire,Math.min(2147483647,Date.parse(status.closesAt)-Date.now()-serverOffset+25));
 }
}

function put(row){const state=read();state.attempts=state.attempts||{};state.attempts[row.board_id]=row;return write(state)}
function stored(id){return read().attempts?.[id]||null}
function snapshot(g){
 const previous=stored(g.puzzle.id)?.progress||{};
 return {found:g.found.map(f=>({...f,path:[...f.path]})),
  elapsedMs:Math.max(0,Math.round(global.gameElapsed(g))),moves:g.moves||0,hints:g.hints||0,
  wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,
  firstCorrectMs:g.mkFirstCorrectMs??previous.firstCorrectMs??null,
  firstHintMs:g.mkFirstHintMs??previous.firstHintMs??null,
  lastCorrectMs:g.mkLastCorrectMs??previous.lastCorrectMs??null,
  resetCount:g.mkResetCount??previous.resetCount??0,resumeCount:g.mkResumeCount??previous.resumeCount??0,
  calmMode:!!g.calmMode};
}
function persist(g){
 if(inspecting)return false;
 if(!isGame(g)||!active||active.board_id!==g.puzzle.id||active.scope!==scope())return false;
 const row=stored(g.puzzle.id);if(!row)return false;
 row.progress=snapshot(g);if(!put(row))return false;g.lastAutosaveAt=Date.now();return true;
}
function record(kind,g=global.currentGame,feedback={}){
 if(inspecting)return Promise.resolve();
 if(closed()){expire();return Promise.resolve()}
 if(!isGame(g)||!active||active.scope!==scope()||(g.finished&&!['finish','feedback'].includes(kind)))return Promise.resolve();
 const now=Math.max(0,Math.round(global.gameElapsed(g)));
 if(kind==='correct'){g.mkFirstCorrectMs=g.mkFirstCorrectMs??now;g.mkLastCorrectMs=now}
 if(kind==='hint')g.mkFirstHintMs=g.mkFirstHintMs??now;
 if(kind==='reset')g.mkResetCount=(g.mkResetCount||0)+1;
 if(kind==='resume')g.mkResumeCount=(g.mkResumeCount||0)+1;
 persist(g);const row=stored(g.puzzle.id);if(!row)return Promise.resolve();
 const event={event_id:uid(),attempt_id:row.id,board_id:row.board_id,
  revision:row.revision+(row.pending?.length||0),event_type:kind,
  progress:JSON.parse(JSON.stringify(row.progress)),feedback};
 if(status?.qa){row.events=row.events||[];row.events.push(event)}
 if(kind==='finish')row.completed=true;
 if(kind==='feedback')row.feedback=feedback;
 if(!status?.qa){row.pending=row.pending||[];row.pending.push(event)}
 else row.revision++;
 if(!put(row))return Promise.resolve();render();return flush();
}
async function flush(){
 if(closed()){expire();return}
 if(status?.qa||!status?.eligible||!navigator.onLine)return;
 if(flushing)return flushing;
 const owner=scope(),experiment=ID,profile=global.getProfile?.();
 flushing=(async()=>{
  for(const cached of Object.values(read().attempts||{})){
   while(owner===scope()&&experiment===ID){
    const row=stored(cached.board_id),event=row?.pending?.[0];if(!event)break;
    if(row.conflict)break;
    try{
     const reply=await request('/event',{method:'POST',body:JSON.stringify(event),authProfile:profile});
     if(owner!==scope()||experiment!==ID)return;
     const fresh=stored(cached.board_id);if(fresh?.pending?.[0]?.event_id!==event.event_id)return;
     fresh.pending.shift();fresh.revision=reply.revision;fresh.syncError='';fresh.reward_points=reply.rewardPoints||fresh.reward_points||0;put(fresh);
     if(reply.rewardGranted){global.showToast?.('+200 XP za dohrání a hodnocení. Díky!');global.refreshRemoteProfile?.()}
    }catch(error){
     if(owner!==scope()||experiment!==ID)return;
     const fresh=stored(cached.board_id);fresh.syncError=error.message;
     if(error.status===409)fresh.conflict=true;
     if(error.status===410){status.eligible=false;global.showToast?.('Playtest skončil. Nové výsledky ani hodnocení už nelze odeslat.')} 
     put(fresh);render();return;
    }
   }
  }
 })().finally(()=>{flushing=null;render();renderSync()});
 return flushing;
}
async function refresh(){
 const owner=scope();if(flight&&statusScope===owner)return flight;
 statusScope=owner;
 flight=(async()=>{
  if(!wantQa&&owner==='guest'){status=null;clearTimeout(expiryTimer);armTransition();render();return}
  try{
   const result=await request('/status'+(wantQa?'?qa=true':''));
   if(owner!==scope())return;
   status=result;
   if(result.experimentId==='mozkokalypsa-round3-interwoven-v2'&&(result.round===3||result.previewRound===3)){
    if(ID!==result.experimentId){
     active=null;feedbackBoard=null;inspecting=false;
     for(const id of ['#mkHubModal','#mkResultModal'])$(id)?.classList.add('hidden');
     if(isGame(global.currentGame)){global.stopTimer();global.releaseGameWakeLock();global.nav('daily',{replace:true})}
    }
    ID=result.experimentId;TOTAL=result.order.length;setupRound3();
   }
   serverOffset=result.serverNow?Date.parse(result.serverNow)-Date.now():0;armExpiry();armTransition();
   if(result.qa)global.closeOnboarding?.(true);
   if(result.eligible&&!result.qa){
    const state=read();state.attempts=state.attempts||{};
    for(const remote of result.attempts||[]){
     const local=state.attempts[remote.board_id];
     if(!local||(!local.pending?.length&&remote.revision>local.revision))state.attempts[remote.board_id]={...remote,pending:[],events:[]};
    }
    write(state);
   }
  }catch(error){if(owner===scope()){status=null;console.warn('Mozkokalypsa: pozvánku se nepodařilo načíst.',error.message)}}
  render();
 })().finally(()=>{flight=null});
 return flight;
}
function setupRound3(){
 if(document.documentElement.classList.contains('mk-round3'))return;
 document.documentElement.classList.add('mk-round3');
 if(status.qa)document.documentElement.classList.add('mk-round3-preview');
 const notice=document.createElement('p');notice.id='mkPreviewNotice';notice.className='mk-preview-notice';
 notice.textContent='Soukromý náhled · Postup a hodnocení jen v tomto prohlížeči, bez skutečných XP.';
 if(status.qa)$('#screen-daily').prepend(notice);
 $('#mozkokalypsaInvite .mk-invite-facts>span:first-child').innerHTML='<b>8</b> nových desek';
 $('#mozkokalypsaInvite .mk-clock-label').textContent='Do konce třetího kola';
 $('#mozkokalypsaInvite .mk-reward-cap').innerHTML='Za celou osmičku až <b>1 600 XP</b>';
 $('#mozkokalypsaInvite .mk-progress-heading>span').textContent='Tvoje třetí kolo';
 $('#mkInviteProgress').replaceChildren(...Array.from({length:TOTAL},()=>document.createElement('i')));
 $('#mkHubTitle').textContent='Mozkokalypsa III';
 $('#mkRatingNote').placeholder='Slova, propletení, záludné místo…';
 const inspect=document.createElement('button');inspect.type='button';inspect.id='mkInspectBoard';inspect.className='text-btn';inspect.textContent='Prohlédnout dohranou desku';
 $('#mkResultStats').after(inspect);inspect.onclick=inspectBoard;
 const returnButton=document.createElement('button');returnButton.type='button';returnButton.id='mkReturnRating';returnButton.className='primary-btn hidden';returnButton.textContent='Zpět k hodnocení';
 $('#screen-game .game-actions').appendChild(returnButton);
 returnButton.onclick=()=>{inspecting=false;returnButton.classList.add('hidden');showModal('#mkResultModal')};
}
async function inspectBoard(){
 const row=stored(feedbackBoard);if(!row?.completed)return;
 const owner=scope(),experiment=ID;
 try{
  const response=active?.board_id===row.board_id&&active?.puzzle?{puzzle:active.puzzle}:await request(status.qa?`/board/${row.board_id}?qa=true`:`/open/${row.board_id}`,status.qa?{}:{method:'POST'});
  if(owner!==scope()||experiment!==ID||closed())return;
  active={...row,scope:scope(),puzzle:response.puzzle};inspecting=true;
  closeModal('#mkResultModal');
  await global.startGame(response.puzzle,'playtest',null);
  const g=global.currentGame;g.finished=true;global.stopTimer();global.releaseGameWakeLock();
  global.renderGameBoard();global.renderGameHUD();
  inspecting=true;$('#mkReturnRating').classList.remove('hidden');
 }catch(error){inspecting=false;global.showToast(error.message);showModal('#mkResultModal')}
}
function deadlineLabel(){
 const end=Date.parse(status?.closesAt);if(!Number.isFinite(end))return 'Čas uzávěrky není dostupný.';
 const options={timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
 const time=new Intl.DateTimeFormat('cs-CZ',options).format(end);
 const midnight=time==='00:00';
 const day=new Intl.DateTimeFormat('cs-CZ',{timeZone:'Europe/Prague',weekday:'short',day:'numeric',month:'numeric'}).format(end-(midnight?1:0));
 return `${status?.deadlineIsExample?'Ukázkový konec':'Konec'}: ${day} ve ${midnight?'24:00':time} · český čas`;
}
function stopCountdown(){clearTimeout(countdownTimer);countdownTimer=null}
function updateCountdown(){
 stopCountdown();
 if(document.hidden||!status?.eligible||statusScope!==scope())return;
 const end=Date.parse(status.closesAt);if(!Number.isFinite(end))return;
 // One lightweight local timer, only while a clock is actually on screen.
 // Recompute from absolute server-adjusted time; never decrement a counter.
 const clocks=['#mkInviteCountdown','#mkHubCountdown'].map($).filter(el=>el?.getClientRects?.().length);
 if(!clocks.length)return;
 const remaining=Math.max(0,Math.ceil((end-Date.now()-serverOffset)/1000));
 const parts={days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
 for(const el of clocks){
  el.classList.toggle('mk-clock-urgent',remaining>0&&remaining<3600);
  for(const [unit,value] of Object.entries(parts)){
   const node=el.querySelector(`[data-mk-time="${unit}"]`),text=String(value).padStart(2,'0');
   if(node&&node.textContent!==text)node.textContent=text;
  }
 }
 if(!remaining){if(!status.qa)expire();return}
 countdownTimer=setTimeout(updateCountdown,1000);
}
function render(){
 stopCountdown();
 const card=$('#mozkokalypsaInvite');if(!card)return;
 const visible=!!status?.eligible&&statusScope===scope();
 card.classList.toggle('hidden',!visible);if(!visible)return;
 if(closed()){expire();return}
 const rows=Object.values(read().attempts||{}),count=rows.filter(a=>a.completed).length;
 const reviewed=rows.filter(a=>a.completed&&rated(a)).length,missing=count-reviewed;
 const done=count===TOTAL,allReviewed=done&&!missing;
 $('#mkInviteTitle').textContent=allReviewed?'Druhé kolo pokořeno.':done?'Dvanáct desek za tebou.':'Mozkokalypsa se vrací.';
 $('#mkInviteCopy').textContent=allReviewed?'Všech dvanáct dohráno i ohodnoceno. Díky! Teď je řada na nás: projdeme výsledky a vybereme, co půjde dál.':done?
  'Ještě tvoje hodnocení a máme hotovo. V přehledu najdeš desky, kterým chybí poslední tečka.':
  'Dvanáct nových desek. Zahraj si je před ostatními a řekni nám, kde je výzva a kde už trápení.';
 $('#mkInviteButton').textContent=allReviewed?'Prohlédnout druhé kolo':done?'Doplnit hodnocení':rows.length?'Pokračovat ve druhém kole':'Jdu do druhého kola';
 if(round3()){
  $('#mkInviteTitle').textContent=allReviewed?'Třetí kolo rozpletené.':done?'Osmička je za tebou.':'Mozkokalypsa potřetí.';
  $('#mkInviteCopy').textContent=allReviewed?'Všech osm dohráno i ohodnoceno. Díky! Tvoje postřehy nám pomůžou vyladit další Proplety.':done?
   'Ještě pár hodnocení a máme hotovo. V přehledu najdeš desky, kterým chybí tvoje poslední slovo.':
   'Pestřejší česká slova. Víc propletené cesty. Osm nových desek, které prověří i zkušené hlavy. Zkus, kam jsme se posunuli.';
  $('#mkInviteButton').textContent=allReviewed?'Prohlédnout třetí kolo':done?'Doplnit hodnocení':rows.length?'Pokračovat ve třetím kole':'Jdu do třetího kola';
 }
 const deadline=deadlineLabel();$('#mkInviteDeadline').textContent=deadline;
 const hubDeadline=$('#mkHubDeadline');if(hubDeadline)hubDeadline.textContent=deadline;
 const progress=$('#mkInviteProgressText');if(progress)progress.textContent=`${count}/${TOTAL} dohráno · ${reviewed} ohodnoceno`;
 const marks=$('#mkInviteProgress')?.children||[];
 for(let i=0;i<marks.length;i++){
  const row=stored(status.order?.[i]);
  marks[i].classList.toggle('is-done',!!row?.completed&&rated(row));
  marks[i].classList.toggle('is-review',!!row?.completed&&!rated(row));
 }
 $('#mkInviteNote').textContent=status.qa?'Náhled: postup jen v tomto zařízení, bez skutečných XP.':pendingCount()?
  'Něco ještě čeká na odeslání. Připoj se před uzávěrkou, ať se hraní i hodnocení započítá.':missing?
  `Dohráno, ale ještě ne všechno ohodnoceno. Odměnu získáš až po odeslání obou hodnocení.`:
  allReviewed?'Díky za čas i upřímné hodnocení.':'Po každé desce ohodnoť náročnost a zábavnost. Pak je 200 XP tvých.';
 updateCountdown();
}
function showModal(id){modalReturn=document.activeElement;$(id).classList.remove('hidden');$(id).querySelector('button')?.focus();updateCountdown()}
function closeModal(id){$(id).classList.add('hidden');modalReturn?.focus?.();updateCountdown()}
async function hub(){
 await flush();await refresh();
 if(!status?.eligible){global.showToast('Playtest není dostupný pro tento účet.');return}
 const root=$('#mkBoardList');root.replaceChildren();
 status.order.forEach((id,i)=>{
  const row=stored(id),button=document.createElement('button');button.type='button';button.className='secondary-btn mk-board-link';
  button.textContent=`${i+1}. deska${row?.completed?(rated(row)?' · hotovo · +200 XP':' · doplnit hodnocení'):row?.progress?.elapsedMs?' · pokračovat':''}`;
  if(round3()&&row?.completed&&rated(row))button.textContent=`${i+1}. deska · ohodnoceno` ;
  button.disabled=!round3()&&!!row?.completed&&rated(row);button.onclick=()=>row?.conflict?resolveConflict(id):launch(id);
  if(row?.conflict)button.textContent=`${i+1}. deska · obnovit postup`;
  root.appendChild(button);
 });
 $('#mkHubNote').textContent=status.qa?'Náhled druhého kola. Hraní a hodnocení zůstávají jen v tomto zařízení; žádné skutečné XP se nepřipisují.':'Vyber si desku. Za dohrání a odeslané hodnocení náročnosti i zábavnosti dostaneš 200 XP. Všechno stihni před uzávěrkou. Denní série se nemění.';
 showModal('#mkHubModal');
}
async function resolveConflict(id){
 if(!global.confirm('Tahle deska se mezitím změnila na jiném zařízení. Načíst její poslední uložený postup? Místní kopii ponecháme v záloze.'))return;
 try{
  const owner=scope(),experiment=ID,response=await request(`/open/${id}`,{method:'POST'});
  if(owner!==scope()||experiment!==ID)return;
  const state=read();state.conflictBackups=state.conflictBackups||[];
  state.conflictBackups.push({...state.attempts[id],backedUpAt:Date.now()});
  state.attempts[id]={...response.attempt,pending:[],events:[]};
  if(!write(state))return;
  await hub();
 }catch(error){global.showToast(error.message)}
}
async function launch(id){
 if(closed()){expire();return}
 if(!status?.eligible||launching)return;
 const owner=scope(),experiment=ID,qa=!!status.qa;
 launching=true;
 try{
  await flush();
  if(owner!==scope()||experiment!==ID||!status?.eligible)return;
  const response=await request(qa?`/board/${id}?qa=true`:`/open/${id}`,qa?{}:{method:'POST'});
  if(owner!==scope()||experiment!==ID||statusScope!==owner)return;
  let row=stored(id),remote=response.attempt;
  if(!status.qa&&row?.pending?.length){
   if(row.conflict)throw new Error('Tato deska byla změněna na jiném zařízení. Místní postup je zachovaný; otevři ji na původním zařízení.');
   throw new Error('Nejprve odešli uložené tahy. Zkus to po obnovení připojení.');
  }
  if(status.qa){row=row||{id:uid(),board_id:id,revision:0,progress:{},completed:false,pending:[],events:[]}}
  else if(!row||remote.revision>row.revision)row={...remote,pending:[],events:row?.events||[]};
  if(row.completed){if(!put(row))return;active={...row,scope:scope(),puzzle:response.puzzle};closeModal('#mkHubModal');showResult(row);return}
  if(!put(row))return;inspecting=false;$('#mkReturnRating')?.classList.add('hidden');active={...row,scope:scope(),puzzle:response.puzzle};
  closeModal('#mkHubModal');closeModal('#mkResultModal');
  await global.startGame(response.puzzle,'playtest',null);
 }catch(error){global.showToast(error.message)}finally{launching=false}
}
async function prepare(puzzle){
 if(!active||active.scope!==scope()||active.board_id!==puzzle.id||!status?.eligible)throw new Error('Nejprve otevři pozvánku k testu.');
 const row=stored(puzzle.id),p=row.progress||{};
 return {fairPlay:false,restored:p.elapsedMs||p.found?.length?{...p,attemptId:row.id}:null};
}
function attach(g){
 if(!isGame(g)||!active)return;
 const p=stored(g.puzzle.id)?.progress||{};
 g.attemptId=active.id;g.mkFirstCorrectMs=p.firstCorrectMs??null;g.mkFirstHintMs=p.firstHintMs??null;
 g.mkLastCorrectMs=p.lastCorrectMs??null;g.mkResetCount=p.resetCount||0;g.mkResumeCount=p.resumeCount||0;
}
function renderSync(){
 const el=$('#mkResultSync');if(!el||!status)return;
 const row=stored(feedbackBoard);
 el.textContent=status.qa?'Náhled: tento výsledek je uložen jen na zařízení.':pendingCount()?'Uloženo na zařízení. Odeslání čeká na připojení; můžeš ho zkusit znovu.':rated(row)?'Hodnocení odesláno. 200 XP máš připsáno.':'Dohráno. Vyplň obtížnost i zábavnost a získej 200 XP.';
 if(round3()&&status.qa)el.textContent=rated(row)?'Hodnocení je uložené v tomto náhledu. Skutečné XP se nepřipisují.':'Hodnocení se uloží jen v tomto náhledu. Skutečné XP se nepřipisují.';
 $('#mkRetrySync')?.classList.toggle('hidden',!!status.qa||!pendingCount());
}
function showResult(row){
 feedbackBoard=row.board_id;inspecting=false;$('#mkReturnRating')?.classList.add('hidden');
 const p=row.progress||{};
 $('#mkResultStats').textContent=`${global.fmtTime(p.elapsedMs||0)} · ${p.moves||0} tahů · ${p.hints||0} nápověd`;
 $('#mkResultTitle').textContent=completeCount()===TOTAL?'Všech dvanáct. Respekt.':'Další deska je doma.';
 if(round3()){$('#mkResultTitle').textContent=completeCount()===TOTAL?'Celá osmička rozpletená.':'Další deska je doma.';$('#mkResultNext').textContent=completeCount()===TOTAL?'Uložit hodnocení':'Uložit a další deska'}
 $('#mkRatingDifficulty').value=row.feedback?.difficulty||'';$('#mkRatingFun').value=row.feedback?.fun||'';$('#mkRatingNote').value=row.feedback?.note||'';
 renderSync();showModal('#mkResultModal');
}
async function finish(g){
 g.elapsedMs=global.gameElapsed(g);g.baseElapsedMs=g.elapsedMs;g.start=performance.now();g.pausedAt=g.start;
 g.finished=true;g.finishing=false;global.stopTimer();global.releaseGameWakeLock();
 global.renderGameBoard();global.renderGameHUD();
 if(inspecting)return;
 record('finish',g);showResult(stored(g.puzzle.id));global.fx?.('win');
}
function feedback(){
 if(closed()){expire();return false}
 const difficulty=Number($('#mkRatingDifficulty').value)||null,fun=Number($('#mkRatingFun').value)||null,note=$('#mkRatingNote').value.trim();
 if(!difficulty||!fun){global.showToast?.(round3()?'Vyber náročnost i zábavnost, ať je hodnocení úplné.':'Vyber obtížnost i zábavnost. Pak ti připíšeme 200 XP.');return false}
 const row=stored(feedbackBoard);if(!row?.completed)return false;
 const value={difficulty,fun,note};
 if(JSON.stringify(row.feedback)===JSON.stringify(value)&&(rated(row)||row.pending?.some(e=>e.event_type==='feedback')))return true;
 const event={event_id:uid(),attempt_id:row.id,board_id:row.board_id,revision:row.revision+(row.pending?.length||0),
  event_type:'feedback',progress:row.progress,feedback:value};
 row.feedback=value;
 if(status.qa){row.events=row.events||[];row.events.push(event);row.revision++}
 else {row.pending=row.pending||[];row.pending.push(event)}
 if(!put(row))return false;flush();return true;
}
function leaveResult(){
 // Leaving without rating is allowed; the hub keeps a visible review action.
 const any=$('#mkRatingDifficulty').value||$('#mkRatingFun').value||$('#mkRatingNote').value.trim();
 if(any&&!feedback())return;
 closeModal('#mkResultModal');global.nav('daily',{replace:true});render();
}
function next(){
 if(!feedback())return;closeModal('#mkResultModal');
 const id=status?.order?.find(id=>!stored(id)?.completed);
 if(id)launch(id);else{global.nav('daily',{replace:true});hub()}
}
function install(){
 $('#mkInviteButton').onclick=hub;$('#mkHubClose').onclick=()=>closeModal('#mkHubModal');
 $('#mkResultNext').onclick=next;$('#mkResultMenu').onclick=leaveResult;$('#mkRetrySync').onclick=()=>flush();
 document.addEventListener('keydown',e=>{
  const modal=['#mkResultModal','#mkHubModal'].map(id=>$(id)).find(el=>!el.classList.contains('hidden'));
  if(e.key==='Tab'&&modal){
   const focusable=[...modal.querySelectorAll('button:not(:disabled),input,select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);
   const first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  }
  if(e.key==='Escape'&&inspecting){e.preventDefault();inspecting=false;$('#mkReturnRating').classList.add('hidden');showModal('#mkResultModal');return}
  if(e.key!=='Escape')return;
  if(!$('#mkResultModal').classList.contains('hidden')){e.preventDefault();leaveResult()}
  else if(!$('#mkHubModal').classList.contains('hidden')){e.preventDefault();closeModal('#mkHubModal')}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCountdown();else{expire();checkTransition();updateCountdown()}});
 global.addEventListener('pagehide',stopCountdown);
 global.addEventListener('pageshow',()=>{expire();checkTransition();updateCountdown()});
 document.addEventListener('proplet:ready',()=>refresh());
 document.addEventListener('proplet:profile-refreshed',()=>{if(statusScope!==scope()){status=null;active=null;feedbackBoard=null;for(const id of ['#mkResultModal','#mkHubModal'])$(id).classList.add('hidden')}refresh()});
 document.addEventListener('proplet:screen-changed',()=>{if(statusScope!==scope()){status=null;active=null;refresh()}render()});
 global.addEventListener('online',()=>refresh().then(()=>flush()));
 // Catch a readiness event fired before this additive script was installed.
 // The API/profile functions are installed by app.js; no dependency on a lexical window.puzzleDB.
 refresh();
}
global.PropletPlaytest={prepare,attach,persist,record,finish,render,hub,refresh,flush,isGame,
 label:()=>`Test ${(status?.order?.indexOf(active?.board_id)??0 )+1}/${TOTAL}`,
 labelMarkup:()=>`<img class="game-difficulty-icon" src="${ICON}" alt="" aria-hidden="true"><span>Test ${(status?.order?.indexOf(active?.board_id)??0 )+1}/${TOTAL}</span>`,
 restore:p=>stored(p.id)?.progress||null};
install();
})(window);

