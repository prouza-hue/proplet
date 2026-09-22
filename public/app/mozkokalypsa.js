/* Native-game pilot adapter. No polling, no normal XP or progression storage. */
(function(global){
'use strict';
const ID='mozkokalypsa-20260922-v1', query=new URLSearchParams(location.search);
const wantQa=query.get('mozkokalypsa')==='preview';
let status=null,statusScope='',flight=null,active=null,flushing=null,modalReturn=null,launching=false;
const $=s=>document.querySelector(s),scope=()=>wantQa?'qa':(global.getProfile?.()?.id||'guest');
const key=()=>`proplet-playtest:${ID}:${scope()}`;
const read=()=>{try{return JSON.parse(localStorage.getItem(key())||'{}')}catch{return {}}};
function write(value){try{localStorage.setItem(key(),JSON.stringify(value));return true}catch{global.showToast?.('Testovací postup se nepodařilo uložit na zařízení.');return false}}
const uid=()=>crypto.randomUUID();
const isGame=g=>g?.mode==='playtest';
const completeCount=()=>Object.values(read().attempts||{}).filter(a=>a.completed).length;
function pendingCount(){return Object.values(read().attempts||{}).reduce((n,a)=>n+(a.pending?.length||0),0)}
const request=(path,opts={})=>global.api('/api/mozkokalypsa'+path,opts);
const ICON='/difficulty/printshop/mozkokalypsa.svg?v=1';
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
 if(!isGame(g)||!active||active.board_id!==g.puzzle.id||active.scope!==scope())return false;
 const row=stored(g.puzzle.id);if(!row)return false;
 row.progress=snapshot(g);if(!put(row))return false;g.lastAutosaveAt=Date.now();return true;
}
function record(kind,g=global.currentGame,feedback={}){
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
 if(status?.qa||!status?.eligible||!navigator.onLine)return;
 if(flushing)return flushing;
 const owner=scope(),profile=global.getProfile?.();
 flushing=(async()=>{
  for(const cached of Object.values(read().attempts||{})){
   while(owner===scope()){
    const row=stored(cached.board_id),event=row?.pending?.[0];if(!event)break;
    if(row.conflict)break;
    try{
     const reply=await request('/event',{method:'POST',body:JSON.stringify(event),authProfile:profile});
     if(owner!==scope())return;
     const fresh=stored(cached.board_id);if(fresh?.pending?.[0]?.event_id!==event.event_id)return;
     fresh.pending.shift();fresh.revision=reply.revision;fresh.syncError='';put(fresh);
    }catch(error){
     if(owner!==scope())return;
     const fresh=stored(cached.board_id);fresh.syncError=error.message;
     if(error.status===409)fresh.conflict=true;
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
  if(!wantQa&&owner==='guest'){status=null;render();return}
  try{
   const result=await request('/status'+(wantQa?'?qa=true':''));
   if(owner!==scope())return;
   status=result;
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
function render(){
 const card=$('#mozkokalypsaInvite');if(!card)return;
 const count=completeCount();
 card.classList.toggle('hidden',!status?.eligible||statusScope!==scope());
 if(!status?.eligible)return;
 $('#mkInviteTitle').textContent=count===10?'Mozkokalypsa má první přeživší.':'Psst… Mozkomor ti nestačí?';
 $('#mkInviteCopy').textContent=count===10?'Díky za všech deset desek. Tvoje hraní nám pomůže doladit novou obtížnost.':
  'Tobě hlavu jen tak něco nezaplete. Zkus 10 exkluzivních desek a pomoz nám vyladit Mozkokalypsu.';
 $('#mkInviteButton').textContent=count===10?'Zobrazit playtest':Object.keys(read().attempts||{}).length?`Pokračovat v testu · ${count}/10`:'Troufám si';
 $('#mkInviteNote').textContent=status.qa?'Náhled: výsledky zůstávají jen v tomto zařízení.':pendingCount()?'Výsledky čekají na odeslání.':'Dobrovolný playtest · bez změny XP a série';
}
function showModal(id){modalReturn=document.activeElement;$(id).classList.remove('hidden');$(id).querySelector('button')?.focus()}
function closeModal(id){$(id).classList.add('hidden');modalReturn?.focus?.()}
async function hub(){
 await flush();await refresh();
 if(!status?.eligible){global.showToast('Playtest není dostupný pro tento účet.');return}
 const root=$('#mkBoardList');root.replaceChildren();
 status.order.forEach((id,i)=>{
  const row=stored(id),button=document.createElement('button');button.type='button';button.className='secondary-btn mk-board-link';
  button.textContent=`${i+1}. deska${row?.completed?' · hotovo':row?.progress?.elapsedMs?' · pokračovat':''}`;
  button.disabled=!!row?.completed;button.onclick=()=>row?.conflict?resolveConflict(id):launch(id);
  if(row?.conflict)button.textContent=`${i+1}. deska · obnovit postup`;
  root.appendChild(button);
 });
 $('#mkHubNote').textContent=status.qa?'Náhled bez zápisů na server. Skutečné hráče zatím nezveme.':'Hraj v libovolném tempu. Po každé desce můžeš dát krátké hodnocení. Čas, tahy a nápovědy se ukládají pouze pro tento test.';
 showModal('#mkHubModal');
}
async function resolveConflict(id){
 if(!global.confirm('Tahle deska se mezitím změnila na jiném zařízení. Načíst její poslední uložený postup? Místní kopii ponecháme v záloze.'))return;
 try{
  const owner=scope(),response=await request(`/open/${id}`,{method:'POST'});
  if(owner!==scope())return;
  const state=read();state.conflictBackups=state.conflictBackups||[];
  state.conflictBackups.push({...state.attempts[id],backedUpAt:Date.now()});
  state.attempts[id]={...response.attempt,pending:[],events:[]};
  if(!write(state))return;
  await hub();
 }catch(error){global.showToast(error.message)}
}
async function launch(id){
 if(!status?.eligible||launching)return;
 launching=true;
 try{
  await flush();
  const response=await request(status.qa?`/board/${id}?qa=true`:`/open/${id}`,status.qa?{}:{method:'POST'});
  let row=stored(id),remote=response.attempt;
  if(!status.qa&&row?.pending?.length){
   if(row.conflict)throw new Error('Tato deska byla změněna na jiném zařízení. Místní postup je zachovaný; otevři ji na původním zařízení.');
   throw new Error('Nejprve odešli uložené tahy. Zkus to po obnovení připojení.');
  }
  if(status.qa){row=row||{id:uid(),board_id:id,revision:0,progress:{},completed:false,pending:[],events:[]}}
  else if(!row||remote.revision>row.revision)row={...remote,pending:[],events:row?.events||[]};
  if(row.completed){global.showToast('Tuto desku už máš hotovou.');return}
  if(!put(row))return;active={...row,scope:scope(),puzzle:response.puzzle};
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
 el.textContent=status.qa?'Náhled: tento výsledek je uložen jen na zařízení.':pendingCount()?'Uloženo na zařízení. Odeslání čeká na připojení; můžeš ho zkusit znovu.':'Výsledek je bezpečně odeslaný.';
 $('#mkRetrySync')?.classList.toggle('hidden',!!status.qa||!pendingCount());
}
async function finish(g){
 g.elapsedMs=global.gameElapsed(g);g.baseElapsedMs=g.elapsedMs;g.start=performance.now();g.pausedAt=g.start;
 g.finished=true;g.finishing=false;global.stopTimer();global.releaseGameWakeLock();
 global.renderGameBoard();global.renderGameHUD();
 record('finish',g);
 $('#mkResultStats').textContent=`${global.fmtTime(g.elapsedMs)} · ${g.moves} tahů · ${g.hints||0} nápověd`;
 $('#mkResultTitle').textContent=completeCount()===10?'Všech deset. Respekt.':'Další deska je doma.';
 $('#mkRatingDifficulty').value='';$('#mkRatingFun').value='';$('#mkRatingNote').value='';
 renderSync();showModal('#mkResultModal');global.fx?.('win');
}
function feedback(){
 const difficulty=Number($('#mkRatingDifficulty').value)||null,fun=Number($('#mkRatingFun').value)||null,note=$('#mkRatingNote').value.trim();
 if(difficulty||fun||note)record('feedback',global.currentGame,{difficulty,fun,note});
}
function leaveResult(){feedback();closeModal('#mkResultModal');global.nav('daily',{replace:true})}
function next(){
 feedback();closeModal('#mkResultModal');
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
  if(e.key!=='Escape')return;
  if(!$('#mkResultModal').classList.contains('hidden')){e.preventDefault();leaveResult()}
  else if(!$('#mkHubModal').classList.contains('hidden')){e.preventDefault();closeModal('#mkHubModal')}
 });
 document.addEventListener('proplet:ready',()=>refresh());
 document.addEventListener('proplet:profile-refreshed',()=>{if(statusScope!==scope())status=null;refresh()});
 document.addEventListener('proplet:screen-changed',()=>{if(statusScope!==scope()){status=null;active=null;refresh()}render()});
 global.addEventListener('online',()=>flush());
 // Catch a readiness event fired before this additive script was installed.
 // The API/profile functions are installed by app.js; no dependency on a lexical window.puzzleDB.
 refresh();
}
global.PropletPlaytest={prepare,attach,persist,record,finish,render,hub,refresh,flush,isGame,
 label:()=>`Test ${(status?.order?.indexOf(active?.board_id)??0)+1}/10`,
 labelMarkup:()=>`<img class="game-difficulty-icon" src="${ICON}" alt="" aria-hidden="true"><span>Test ${(status?.order?.indexOf(active?.board_id)??0)+1}/10</span>`,
 restore:p=>stored(p.id)?.progress||null};
install();
})(window);
