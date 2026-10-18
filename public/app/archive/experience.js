/* Archive embedded in the canonical Proplet runtime. */
(()=>{
'use strict';
const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
// Resolve names from the live game's single difficulty registry.
const labels=Object.fromEntries(['easy','medium','hard','hardcore'].map(key=>[key,'']));
const rewards={easy:15,medium:25,hard:50,hardcore:100};
const EDITION='free-gen3-v1',REVISION='g3-reviewed-covers-20261008-r3';
const glyph={arrow:'M5 12h14m-5-5 5 5-5 5',back:'M19 12H5m5-5-5 5 5 5',check:'m5 12 4 4L19 6',archive:'M4 8h16v12H4zM3 4h18v4H3zm6 8h6',trophy:'M8 3h8v6c0 7-8 7-8 0V3Zm0 2H4v3c0 3 2 4 5 4m7-7h4v3c0 3-2 4-5 4m-3 2v6m-4 0h8',team:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9v-2c0-6 12-6 12 0v2m0-15a3 3 0 0 1 0 6m3 3c3 0 4 2 4 4v2',grid:'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v1',close:'m6 6 12 12M18 6 6 18'};
const ico=n=>'<svg class="ax-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+glyph[n]+'"/></svg>';
function archiveArt(){return '<img class="archive-art" src="/assets/archive/archive-letterpress-v2.webp" width="512" height="512" alt="" decoding="async">';}

let configuration=null,installed=false,bank=null,loading=null,archiveState={diff:'easy',filter:'all',query:'',page:0},modalFocus=null;
const STORE='proplet:archive-progress:v2',entries=new Map();
let claimsState={identity:'',status:'unknown',claims:{},completed:new Set()},claimsFlight=null;
const identity=()=>{const p=getProfile();return p?.id&&p?.token?p.id+':'+p.token:'guest';};
function read(scope=playerScope()){try{return {progress:{},...JSON.parse(localStorage.getItem(STORE+':'+scope)||'{}')}}catch{return {progress:{}}}}
function write(s,scope=playerScope()){localStorage.setItem(STORE+':'+scope,JSON.stringify(s))}
const puzzleId=p=>typeof p==='string'?p:p.puzzleId||p.id||p.puzzle?.id;
const row=p=>entries.get(puzzleId(p))||bank?.boards.find(b=>b.puzzleId===puzzleId(p));
const slot=p=>row(p)?.rewardSlotKey;
const completion=(p,state=getState(),claims=currentClaims())=>state.completed['free:'+puzzleId(p)]||(claims.completed.has(puzzleId(p))?{}:null);
function currentClaims(){const id=identity();if(claimsState.identity!==id)claimsState={identity:id,status:id==='guest'?'guest':'unknown',claims:{},completed:new Set()};return claimsState;}
const paid=p=>{const state=currentClaims();return state.status==='ready'?!!state.claims[slot(p)]:null;};
// No speculative XP enters local statistics. Only a server result receipt credits it.
function reward(){return 0;}
function freshPuzzle(entry){
 const p=structuredClone(entry.puzzle);p.meta={...p.meta,level:entry.level,contentGeneration:3,archiveExperience:true};
 return p;
}
async function offlineRead(method,...args){
 try{return await window.PropletOffline?.[method]?.(...args)||null;}catch{return null;}
}
function validateBank(data){
 if(data?.editionId!==EDITION||data?.solutionPolicyRevision!==REVISION||data?.completeCovers!==879||!Array.isArray(data.boards)||data.boards.length!==800)throw Error('Archiv se nepodařilo ověřit.');
 const ids=new Set(),slots=new Set(),counts={easy:0,medium:0,hard:0,hardcore:0};
 for(const r of data.boards){
  if(!r||typeof r.puzzleId!=='string'||!r.puzzleId||!Object.hasOwn(rewards,r.difficulty)||!Number.isInteger(r.level)||r.level<1||r.level>200||r.rewardXp!==rewards[r.difficulty]||r.rewardSlotKey!=='legacy-free:'+r.difficulty+':'+r.level||ids.has(r.puzzleId)||slots.has(r.rewardSlotKey))throw Error('Archiv se nepodařilo ověřit.');
  ids.add(r.puzzleId);slots.add(r.rewardSlotKey);counts[r.difficulty]++;
 }
 if(Object.values(counts).some(count=>count!==200))throw Error('Archiv není úplný.');
 return data;
}
function validateEntry(data,id){
 const expected=bank.boards.find(r=>r.puzzleId===id),p=data?.puzzle,s=data?.solutions;
 if(!expected||data?.editionId!==bank.editionId||p?.id!==id||p?.difficulty!==expected.difficulty||p?.meta?.contentGeneration!==3||p?.meta?.level!==expected.level||data.level!==expected.level||data.difficulty!==expected.difficulty||data.rewardXp!==expected.rewardXp||data.rewardSlotKey!==expected.rewardSlotKey||s?.puzzleId!==id||s?.gameplayScope!=='archive'||s?.solutionPolicyRevision!==bank.solutionPolicyRevision)throw Error('Archivní desku se nepodařilo ověřit.');
 window.PropletArchiveSolutions.create(p,s);return data;
}
async function loadBank(){
 if(bank)return bank;
 if(!loading)loading=(async()=>{
  let data;
  try{data=validateBank(await offlineRead('getArchiveCatalogue'));}catch{}
  if(!data&&window.navigator?.onLine!==false)data=validateBank(await api('/api/archive'));
  if(!data)throw Error('Archiv zatím není stažený. Připoj se k internetu a zkus to znovu.');
  bank=data;return data;
 })().catch(e=>{loading=null;throw e});
 return loading;
}
async function loadEntry(id){
 await loadBank();if(entries.has(id))return entries.get(id);
 let data;
 try{data=validateEntry(await offlineRead('getArchiveEntry',id),id);}catch{}
 if(!data&&window.navigator?.onLine!==false)data=validateEntry(await api('/api/archive/puzzle?puzzle_id='+encodeURIComponent(id)),id);
 if(!data)throw Error('Tato archivní deska zatím není stažená. Připoj se k internetu a zkus to znovu.');
 entries.set(id,data);return data;
}
async function refreshClaims({force=false}={}){
 const owner=getProfile(),id=identity(),state=currentClaims();
 if(!owner?.id||!owner?.token)return state;
 if(window.navigator?.onLine===false){state.status='unavailable';return state;}
 if(claimsFlight?.identity===id)return claimsFlight.promise;
 if(!force&&state.status==='ready')return state;
 state.status='loading';
 const flight={identity:id,promise:null};claimsFlight=flight;
 flight.promise=api('/api/archive/claims',{authProfile:owner}).then(data=>{
  if(identity()!==id)return currentClaims();
  if(data?.editionId!==(bank?.editionId||'free-gen3-v1')||!data?.claims||!Array.isArray(data.completedPuzzleIds))throw Error('Neúplný přehled odměn');
  claimsState={identity:id,status:'ready',claims:data.claims,completed:new Set(data.completedPuzzleIds)};return claimsState;
 }).catch(()=>{if(identity()===id)claimsState={identity:id,status:'unavailable',claims:{},completed:new Set()};return currentClaims();})
 .finally(()=>{if(claimsFlight===flight)claimsFlight=null;if(installed&&currentScreen==='archive')renderGrid();});
 return flight.promise;
}
function adoptGuest(scope){
 const guest=read('guest'),target=read(scope);target.progress={...guest.progress,...target.progress};write(target,scope);localStorage.removeItem(STORE+':guest');
 if(currentGame?.puzzle?.meta?.archiveExperience&&currentGame.archiveScope==='guest')currentGame.archiveScope=scope;
}
function renderResult(g){
 if(!g?.puzzle?.meta?.archiveExperience){q('#axResultStatus')?.remove();return false;}
 const confirmed=Number.isInteger(g.archiveAward);
 if(confirmed)setWinXpDisplay(g.archiveAward?'+'+g.archiveAward+' XP':'0 XP',g.archiveAward?'Připsáno':'Už získáno');
 else setWinXpDisplay('XP',getProfile()?.token?'Ověřujeme':'S účtem');
 let note=q('#axResultStatus');
 if(confirmed)note?.remove();
 else{
  if(!note){const anchor=q('#winTitle')?.closest('.win-result-heading')||q('#winTitle');if(anchor){note=document.createElement('p');note.id='axResultStatus';note.className='ax-result-status';note.setAttribute('role','status');anchor.after(note);}}
  if(note)note.textContent=getProfile()?.token?'Výsledek je uložen. Odměnu ověříme po spojení se serverem.':'Výsledek je uložen v tomto zařízení. Pro ověření XP si ulož hráčský účet.';
 }
 return true;
}
function configure(){
 return configuration||(configuration=(async()=>{
  if(window.navigator?.onLine!==false){
   try{const config=await api('/api/config',{timeoutMs:2000});if(typeof config?.archiveEnabled==='boolean')return config;}catch{}
  }
  // Only a previously successful public configuration can open the Archive.
  // Cached content alone does not grant a release gate, and claims stay private.
  const config=await offlineRead('getPublicConfig');
  return typeof config?.archiveEnabled==='boolean'?config:null;
 })());
}

function resultConfirmed(rec,receipt,owner){
 if(!rec?.archiveSolution)return;
 if(!owner?.id||!Number.isInteger(receipt?.awardedPoints)||receipt.awardedPoints<0||typeof receipt.firstCompletion!=='boolean')throw Error('Server zatím nepotvrdil archivní odměnu.');
 const state=getState(owner.id),saved=state.completed[rec.challengeKey];
 if(saved){saved.points=Math.max(Number(saved.points)||0,receipt.awardedPoints);saved.archiveConfirmed=true;saveState(state,owner.id);}
 if(!accountProfileMatches(owner))return;
 const claims=currentClaims(),rewardSlot='legacy-free:'+rec.difficulty+':'+rec.level;
 claims.claims[rewardSlot]={sourcePuzzleId:rec.puzzleId,points:receipt.awardedPoints};claims.completed.add(rec.puzzleId);
 // A single confirmed result cannot establish the rest of an unavailable claims ledger.
 const g=currentGame;
 if(g?.puzzle?.id===rec.puzzleId&&g?.resultRecord?.attemptId===rec.attemptId&&g.archiveScope===owner.id){g.archiveAward=receipt.awardedPoints;renderResult(g);}
 if(installed&&currentScreen==='archive')renderGrid();
 refreshClaims({force:true}).catch(()=>{});
}
// One structure for every discovery destination. The action is an actual button;
// the surrounding article is never a second, ambiguous hit target.
function destination({id='',kind,title,description,art,action,label,interactiveArt=false}){
 return '<article '+(id?'id="'+id+'" ':'')+'class="ax-destination ax-'+kind+'-entry"><div class="ax-entry-copy"><h2>'+title+'</h2><p class="ax-entry-description">'+description+'</p></div><div class="ax-entry-art"'+(interactiveArt?'':' aria-hidden="true"')+'>'+art+'</div><button type="button" class="ax-card-action ax-browse-action" data-archive-action="'+action+'">'+label+' '+ico('arrow')+'</button></article>';
}
function archiveEntry(){return destination({kind:'archive',title:'Archiv Propletu',description:'800 původních desek',art:archiveArt(),action:'open',label:'Vybrat archivní desku'});}
function home(){
 if(!installed)return;
 const root=q('#screen-daily');if(!root)return;
 let games=q('#axHomeGames');if(!games){games=document.createElement('div');games.id='axHomeGames';games.innerHTML='<div id="axHomeArchive">'+archiveEntry()+'</div>';root.append(games);}
 if(!q('#axHomeFree')){root.insertAdjacentHTML('beforeend',destination({id:'axHomeFree',kind:'free',title:'Volná hra',description:'Všechny obtížnosti a úrovně',art:'<div class="ax-free-art">'+Object.keys(DIFF).map(diff=>'<button type="button" class="ax-free-start" data-home-free="'+diff+'" aria-label="Hrát '+esc(DIFF[diff].label)+'" title="'+esc(DIFF[diff].label)+'">'+difficultyIconMarkup(diff,'ax-free-difficulty')+'</button>').join('')+'</div>',action:'free',label:'Vybrat hru',interactiveArt:true}));}
 let competition=q('#axHomeCompetitions');if(!competition){competition=document.createElement('section');competition.id='axHomeCompetitions';competition.className='ax-competitions';competition.setAttribute('aria-label','Soutěže');competition.innerHTML='<div class="ax-competition-grid">'+destination({kind:'team',title:'Týdenní soutěž',description:'Hraj s týmem o zlatou trofej',art:'<img src="/rewards/team-victories/first-imprint.webp" alt="">',action:'team',label:'Otevřít soutěž'})+'</div>';root.append(competition);}
 const latest=Object.values(getState().inProgress||{}).filter(r=>r.mode==='free').sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];
 const archiveResume=latest&&read().progress[latest.puzzleId];let resume=q('#axArchiveResume');
 if(archiveResume){if(!resume){resume=document.createElement('button');resume.id='axArchiveResume';resume.className='home-resume-card';root.prepend(resume);}
 const level=Number(latest.puzzleId.split('-').pop());resume.dataset.archiveStart=latest.puzzleId;const copy='<span class="home-resume-icon">'+difficultyIconMarkup(latest.difficulty,'home-resume-difficulty-icon')+'</span><span class="home-resume-copy"><span>Archiv · rozehráno</span><strong>'+labels[latest.difficulty]+' · deska '+level+'</strong></span><b>Pokračovat <i>→</i></b>';if(resume.innerHTML!==copy)resume.innerHTML=copy;q('#homeResumeCard')?.classList.add('hidden');
 }else{resume?.remove();q('#homeResumeCard')?.classList.remove('hidden');}
 // Keep canonical Daily / Tajenka / release state and handlers. Only reorder stable nodes.
 const referral=q('#referralHome');
 const tajenka=q('#tajenkaPreviewCard'),tajenkaSolved=tajenka?.classList.contains('completed');
 const progress=q('#homeCompetitionCard');
 const ordered=[q('#axArchiveResume'),q('#homeResumeCard'),root.querySelector('.daily-hero'),referral,q('#referralInviteHome'),q('#rescueCard'),q('#todayNewContentBanner'),tajenkaSolved?null:tajenka,q('#axHomeFree'),competition,games,q('#levelCard')].filter(Boolean);
 let prev=null;for(const el of ordered){if(prev){if(prev.nextElementSibling!==el)prev.after(el);}else if(root.firstElementChild!==el)root.prepend(el);prev=el;}
 // Tail nodes have one owner and are never also moved within the ordered prefix.
 if(progress&&root.lastElementChild!==progress)root.append(progress);
 if(tajenkaSolved){
  if(progress){if(tajenka.nextElementSibling!==progress)progress.before(tajenka);}
  else if(root.lastElementChild!==tajenka)root.append(tajenka);
 }
}
function placePlayExtra(card){
 const archive=q('#axPlayArchive');if(!archive)return false;
 if(card.nextElementSibling!==archive)archive.before(card);
 return true;
}
function free(){
 if(!installed)return;
 const root=q('#screen-free');if(!root)return;
 // Order is intentional: fresh content, current difficulties, Tajenka, Archive.
 if(!q('#axPlayArchive')){const el=document.createElement('div');el.id='axPlayArchive';el.innerHTML=archiveEntry();root.append(el);}
 all('#difficultyCards .cp-action-row').forEach(row=>{const play=row.querySelector('.cp-play');if(play)row.replaceWith(play);});
}
function seed(){
 if(!window.PROPLET_ARCHIVE_PREVIEW)return;
 const state=getState();if(localStorage.getItem('ax-seeded'))return;
 localStorage.setItem('ax-seeded','1');
 for(const [diff,count] of Object.entries({easy:27,medium:18,hard:11,hardcore:6,mozkomor:2,mozkokalypsa:1})){
  for(const p of (puzzleDB.free?.[diff]||[]).slice(0,count)){
   const key='free:'+p.id;state.completed[key]={challengeKey:key,puzzleId:p.id,mode:'free',difficulty:diff,level:p.meta?.level,contentGeneration:p.meta?.contentGeneration||4,points:DIFF[diff].xp,moves:p.answers?.length||8,elapsedMs:180000,hintsUsed:0,cleanSolve:true,completedAt:'2026-10-06T16:00:00Z'};
  }
 }
 saveState(state);
 localStorage.setItem('proplet-v3-5-account-nudge',JSON.stringify({shown:[1,2,3]}));
}
async function install(){
 if(installed)return true;
 const config=await configure();
 if(config?.archiveEnabled!==true)return false;
 installed=true;ROUTE_SCREENS.add('archive');document.documentElement.dataset.archiveEnabled='1';for(const key of Object.keys(labels))labels[key]=DIFF[key].label;document.body.classList.add('archive-experience');
 if(!q('#screen-free'))throw Error('Archive mount: canonical free screen missing');
 for(const id of ['archive']){const section=document.createElement('section');section.id='screen-'+id;section.className='screen ax-screen';q('#screen-free').after(section);}
 const modal=document.createElement('div');modal.id='archiveExperienceModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','axModalTitle');document.body.append(modal);
 seed();home();free();
 registerGameSessionHook({id:'archive-experience',priority:40,afterStart:({game:g})=>{
  if(!g?.puzzle?.meta?.archiveExperience)return;
  const saved=read().progress[g.puzzle.id];g.archiveHints=saved?.revealed||[];g.archiveScope=playerScope();
  q('#gameModeLabel').textContent='Archiv Propletu';
  q('#gameDifficulty').insertAdjacentHTML('beforeend','<span class="ax-game-origin">Původní deska</span>');
 },afterPersist:({game:g,saved})=>{
  if(!saved||!g?.puzzle?.meta?.archiveExperience)return;
  const s=read();g.archiveHints??=s.progress[g.puzzle.id]?.revealed||[];s.progress[g.puzzle.id]=snapshot(g);write(s);
 }});
 registerGameCompletionHook({id:'archive-experience',priority:200,after:({game:g})=>{
  if(!g?.puzzle?.meta?.archiveExperience)return;
  const s=read(g.archiveScope);delete s.progress[g.puzzle.id];write(s,g.archiveScope);
  q('#winMenuBtn').textContent='Zpět do Archivu';q('#winPrimaryBtn').textContent='Vybrat jinou desku';
  q('#winText').textContent=labels[g.puzzle.difficulty]+' · archivní deska '+g.puzzle.meta.level+' · '+fmtTime(g.elapsedMs);
  q('#levelLeaderboardBox').classList.add('hidden');
  renderResult(g);
  q('#winModal').classList.add('ax-archive-result');
 }});
 document.addEventListener('click',onClick);
 document.addEventListener('proplet:account-changed',()=>{
  currentClaims();closeModal();
  if(currentGame?.puzzle?.meta?.archiveExperience&&currentGame.archiveScope!==playerScope()){
   stopTimer();currentGame=null;q('#winModal')?.classList.add('hidden');q('#axResultStatus')?.remove();
   if(currentScreen==='game')nav('archive',{replace:true});
  }
  refreshClaims({force:true});home();if(currentScreen==='archive')renderArchive();
 });
 window.addEventListener('online',()=>{refreshClaims({force:true});});
 refreshClaims();
 document.addEventListener('input',e=>{if(e.target.id==='axSearch'){archiveState.query=e.target.value.replace(/[^0-9]/g,'');archiveState.page=0;renderGrid();}});
 document.addEventListener('keydown',e=>{if(q('#archiveExperienceModal').classList.contains('hidden'))return;if(e.key==='Escape'){e.stopImmediatePropagation();closeModal();}if(e.key==='Tab'){const nodes=all('#archiveExperienceModal button,#archiveExperienceModal select,#archiveExperienceModal input');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}},true);
 document.addEventListener('proplet:ready',()=>{home();free();window.__PROPLET_REVEAL_CURRENT_UI?.();document.documentElement.dataset.archiveReady='1';const open=new URLSearchParams(location.search).get('review');if(['archive','free','daily'].includes(open))nav(open);else if(open==='announcement')announcement();},{once:true});
 return true;
}
function screen(name,previous){if(installed&&name==='archive'){if(previous!=='archive')refreshClaims({force:true});renderArchive();}}
async function renderArchive(){
 const root=q('#screen-archive');
 if(!bank){root.innerHTML='<div class="ax-loading">Otevírám Archiv…</div>';try{await loadBank()}catch(e){root.innerHTML='<h1>Archiv počká.</h1><p>Nepodařilo se načíst desky. Tvůj postup zůstává uložený.</p><button class="primary-btn" data-archive-action="retry">Zkusit znovu</button>';return;}}
 refreshClaims();
 const d=archiveState.diff;
 root.innerHTML='<div class="ax-catalogue-nav"><button class="ax-back" data-archive-action="free">'+ico('back')+' Hrát</button><button class="ax-help" data-archive-action="rewards" aria-label="Jak fungují odměny v Archivu">'+ico('info')+'</button></div><header class="ax-catalogue-heading"><div><h1>Archiv</h1><p>800 původních desek. Vyber si kteroukoli.</p></div>'+archiveArt()+'</header><div class="ax-difficulty-tabs" aria-label="Obtížnost">'+Object.keys(labels).map(diff=>'<button data-archive-diff="'+diff+'" aria-pressed="'+(diff===d)+'">'+difficultyIconMarkup(diff,'ax-difficulty-art')+'<strong>'+labels[diff]+'</strong></button>').join('')+'</div><div class="ax-filter-row"><div class="ax-filters" aria-label="Zobrazené desky">'+[['all','Všechny'],['unplayed','Nehrané'],['reward','S XP']].map(([v,l])=>'<button data-archive-filter="'+v+'" aria-pressed="'+(archiveState.filter===v)+'">'+l+'</button>').join('')+'</div><label class="ax-search">'+ico('search')+'<input id="axSearch" aria-label="Číslo archivní desky" type="search" inputmode="numeric" placeholder="Číslo" maxlength="3" value="'+archiveState.query+'"></label></div><div id="axBoardResults"></div>';

 renderGrid();
}
function renderGrid(){
 if(!q('#axBoardResults')||!bank)return;
 const claims=currentClaims(),localState=getState(),{diff,filter,query}=archiveState;
 const rewardFilter=q('[data-archive-filter="reward"]');if(rewardFilter){rewardFilter.disabled=claims.status!=='ready';rewardFilter.title=claims.status==='ready'?'':'Dostupnost odměn ověříme po připojení k účtu.';}
 const list=bank.boards.filter(r=>r.difficulty===diff&&(!query||String(r.level).includes(query))).filter(r=>filter==='unplayed'?!completion(r,localState,claims):filter==='reward'?paid(r)===false:true);
 const pages=Math.max(1,Math.ceil(list.length/40));archiveState.page=Math.min(archiveState.page,pages-1);const offset=archiveState.page*40;
 const notice=claims.status==='ready'?'':claims.status==='guest'?'Hraj i bez účtu. XP ověříme po přihlášení.':claims.status==='loading'?'Ověřuji historické odměny…':'Odměny teď nelze ověřit. Hrát můžeš dál; XP potvrdí server po připojení.';
 q('#axBoardResults').innerHTML=(notice?'<p class="ax-legend" role="status">'+notice+'</p>':'')+'<div class="ax-board-grid">'+list.slice(offset,offset+40).map(r=>{const done=!!completion(r,localState,claims),claimed=paid(r),progress=localState.inProgress['free:'+r.puzzleId],xp=claimed===true?'Získáno':claimed===false?'+'+r.rewardXp+' XP':claims.status==='guest'?'Hrát':'XP neověřeny';return '<button class="ax-board '+(claimed===true?'ax-paid':'')+'" data-archive-board="'+r.puzzleId+'" aria-label="'+labels[diff]+' deska '+r.level+', '+(done?'odehráno':progress?'rozehráno':'nehráno')+', '+xp+'">'+(done?'<i>'+ico('check')+'</i>':progress?'<i class="ax-progress-dot"></i>':'')+'<strong>'+r.level+'</strong><span>'+(progress?'Rozehráno':xp)+'</span></button>';}).join('')+(list.length?'':'<p class="ax-empty">'+(filter==='reward'&&claims.status!=='ready'?'Odměny nejdřív potřebujeme ověřit. Vyber zatím filtr Všechny.':'Zkus jiné číslo nebo filtr.')+'</p>')+'</div><div class="ax-grid-foot"><span>'+(list.length?(offset+1)+'–'+Math.min(offset+40,list.length)+' z '+list.length:'Žádné desky')+'</span><div><button data-archive-page="-1" aria-label="Předchozí desky" '+(archiveState.page===0?'disabled':'')+'>'+ico('back')+'</button><span>'+(archiveState.page+1)+' / '+pages+'</span><button data-archive-page="1" aria-label="Další desky" '+(archiveState.page===pages-1?'disabled':'')+'>'+ico('arrow')+'</button></div></div>';
}
function modal(html,kind=''){
 const m=q('#archiveExperienceModal');if(m.classList.contains('hidden')){modalFocus=document.activeElement;document.body.dataset.axOldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
 m.innerHTML='<div class="modal-card ax-modal '+kind+'"><button class="modal-close" data-archive-action="close" aria-label="Zavřít">'+ico('close')+'</button>'+html+'</div>';m.classList.remove('hidden');q('.app-shell').inert=true;q('.bottom-nav').inert=true;
 m.querySelector('.modal-close').focus({preventScroll:true});
}
function closeModal(){const active=q('#archiveExperienceModal');if(!active||active.classList.contains('hidden'))return;active.classList.add('hidden');q('.app-shell').inert=false;q('.bottom-nav').inert=false;if(document.body.dataset.axOldOverflow!==undefined){document.body.style.overflow=document.body.dataset.axOldOverflow;delete document.body.dataset.axOldOverflow;}if(modalFocus?.isConnected)modalFocus.focus({preventScroll:true});}
function detail(id){
 const r=row(id);if(!r)return;const done=completion(r),progress=getState().inProgress['free:'+id],earned=paid(r),guest=!getProfile()?.token;
 const heading=earned===true?'Odměna už je tvoje':earned===false?'Čeká na tebe '+r.rewardXp+' XP':guest?'Zahraj si i bez účtu':'Odměna zatím není ověřená';
 const copy=earned===true?'Historickou odměnu za tuto úroveň už máš získanou. Desku si přesto můžeš zahrát kdykoli.':earned===false?'Tohle je dosud nezískaná historická odměna. Dokončené novější desky ji neblokují.':guest?'Výsledek uložíme v tomto zařízení. Dostupnost historické odměny ověříme po přihlášení.':'Přehled odměn se nepodařilo načíst. Hrát můžeš; XP potvrdí server po připojení.';
 modal('<div class="ax-detail-heading">'+difficultyIconMarkup(r.difficulty,'ax-detail-art')+'<div><h2 id="axModalTitle">Deska '+r.level+'</h2><p>'+labels[r.difficulty]+' · Archiv</p></div></div><div class="ax-detail-reward"><strong>'+heading+'</strong><p>'+copy+'</p></div><p class="ax-detail-state">'+(progress?'Rozehráno · '+progress.found.length+' slov nalezeno':done?'Tuto desku už máš odehranou.':'Tuto desku jsi ještě nehrál.')+'</p><button class="primary-btn big" data-archive-start="'+id+'">'+(progress?'Pokračovat':done?'Zahrát znovu':'Hrát desku '+r.level)+' →</button>','ax-detail');
}
function snapshot(g){const r=row(g.puzzle);return {solutionPolicyRevision:r.solutions.solutionPolicyRevision,found:g.found.map(f=>({word:f.word,path:[...f.path]})),revealed:g.archiveHints||[]};}
function contract(g){return window.PropletArchiveSolutions.create(row(g.puzzle).puzzle,row(g.puzzle).solutions);}
function choose(g,solutionId){g.puzzle.answers=structuredClone(row(g.puzzle).solutions.solutionSets[solutionId]);g.found.forEach(f=>{f.answerIndex=g.puzzle.answers.findIndex(a=>a.word===f.word&&samePath(a.path,f.path))});}
function beforeSubmit(g,word,path){if(!g?.puzzle?.meta?.archiveExperience)return;const out=contract(g).submit(snapshot(g),word,path);if(out.accepted)choose(g,out.solutionIds[0]);}
function hintUsed(g,pick,level){if(!g?.puzzle?.meta?.archiveExperience)return;g.archiveHints||=[];const hint={level,targetLength:pick.a.word.length,shownPath:pick.a.path.slice(0,level===1?1:level===2?3:pick.a.path.length)};if(level===3)hint.shownWord=pick.a.word;g.archiveHints.push(hint);}
async function start(id){
 const owner=identity(),r=await loadEntry(id);if(owner!==identity())return;const p=freshPuzzle(r),saved=read().progress[id];
 if(saved){const c=window.PropletArchiveSolutions.create(r.puzzle,r.solutions),status=c.restore(saved);if(status.ok){p.answers=structuredClone(r.solutions.solutionSets[status.solutionIds[0]]);const state=getState(),progress=state.inProgress['free:'+id];if(progress){progress.found.forEach(f=>{f.answerIndex=p.answers.findIndex(a=>a.word===f.word&&samePath(a.path,f.path))});saveState(state);}}}
 closeModal();await startGame(p,'free',null,{archive:true});
}
function prepareCompletion(g){const result=contract(g).evaluate(snapshot(g));if(!result.ok||!result.completed)throw Error('Archive solution is not a complete approved cover');g.archiveSolution={editionId:bank.editionId,solutionPolicyRevision:bank.solutionPolicyRevision,found:result.state.found};}
function postWin(){q('#winModal').classList.add('hidden');q('#winModal').classList.remove('ax-archive-result');nav('archive',{replace:true});}
function isTarget(g,word){return !!g?.puzzle?.meta?.archiveExperience&&contract(g).isSolutionWord(word);}
function announcement({includeExtra=true}={}){
 if(!installed)return false;
 const archive='<section class="ax-release-archive"><div class="ax-release-heading"><div><h3>Dobré desky nestárnou.</h3><p><strong>800 původních desek</strong>, všechny znovu k hraní.</p></div><div class="ax-release-archive-art">'+archiveArt()+'</div></div><div class="ax-release-mini-art" aria-hidden="true">'+Object.keys(labels).map(d=>difficultyIconMarkup(d,'ax-release-mini-icon')).join('')+'</div><button class="primary-btn big ax-cta-primary" data-archive-action="enter">Prozkoumat Archiv '+ico('arrow')+'</button></section>';
 const extra=includeExtra?'<section class="ax-release-extra"><div class="ax-release-extra-heading"><h3>A k tomu Extra.</h3><span class="ax-extra-reward">100 XP</span></div><div class="ax-extra-week">'+[['hardcore','Středa'],['mozkomor','Pátek'],['mozkokalypsa','Neděle']].map(([d,day])=>'<div>'+difficultyIconMarkup(d,'ax-extra-week-art')+'<strong>'+day+'</strong></div>').join('')+'</div><p>Třikrát týdně těžší výzva navíc.<br>Sérii dál udržuje základní výzva.</p><button class="primary-btn big ax-extra-primary" data-archive-action="extra">Ukázat Extra '+ico('arrow')+'</button></section>':'';
 modal('<h2 id="axModalTitle">Ještě víc Propletu.</h2><div class="ax-release-pair">'+archive+extra+'</div><button class="text-btn ax-cta-secondary" data-archive-action="close">Teď si chci jen zahrát</button>','ax-announcement ax-release');
 window.PropletAnnouncements?.acknowledge('archive-extra-v1');
 return true;
}
function rewardRules(){modal('<h2 id="axModalTitle">Staré desky.<br>Férové odměny.</h2><ol class="ax-rules"><li><b>Odměna patří k historické úrovni.</b> Starší verze stejného čísla a obtížnosti sdílejí jednu odměnu.</li><li><b>Novější desky ji neblokují.</b> Pokud jsi starou odměnu nezískal, v Archivu na tebe pořád čeká.</li><li><b>Už připsané XP dostaneš jen jednou.</b> Fajfka u čísla zvlášť označuje, že jsi hrál právě tuto desku.</li></ol><button class="primary-btn big" data-archive-action="close">Rozumím</button>');}
function review(){
 modal('<h2 id="axModalTitle">Náhled Archivu</h2><p class="muted">Proplet 4.07.3 s Archivem. Hraní i ukázkové odměny zůstávají pouze v tomto náhledu.</p><div class="ax-review-buttons"><button class="secondary-btn" data-archive-action="announcement">Úvodní CTA Archivu</button><button class="secondary-btn" data-archive-action="theme">Světlý / tmavý vzhled</button><button class="secondary-btn" data-archive-action="demo-resume">Ukázat rozehranou hru</button><button class="secondary-btn" data-archive-action="demo-clear-resume">Skrýt rozehrané ukázky</button><button class="secondary-btn" data-review-extra="hardcore">Extra: středa · Mozkožrout</button><button class="secondary-btn" data-review-extra="mozkomor">Extra: pátek · Mozkomor</button><button class="secondary-btn" data-review-extra="mozkokalypsa">Extra: neděle · Mozkokalypsa</button><button class="secondary-btn" data-review-referral="invite">Pozvánky: pozvat kamaráda</button><button class="secondary-btn" data-review-referral="progress">Pozvánky: postup pozvaného</button><button class="secondary-btn" data-review-referral="earned">Pozvánky: získaný bonus</button><button class="secondary-btn" data-archive-action="review-reset">Vrátit dnešní datum a výchozí stav</button></div><p class="ax-review-caption">Extra a pozvánkové scénáře používají modelová data. Budoucí soutěž není součástí tohoto vydání.</p>');
}
async function onClick(e){
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.homeFree&&Object.hasOwn(DIFF,b.dataset.homeFree)){e.preventDefault();startFree(b.dataset.homeFree);return;}
 if(b.dataset.reviewExtra){window.PropletArchiveReview.setScenario({extra:b.dataset.reviewExtra});return;}
 if(b.dataset.reviewReferral){window.PropletArchiveReview.setScenario({referral:b.dataset.reviewReferral});return;}
 if(b.dataset.archiveDiff){archiveState.diff=b.dataset.archiveDiff;archiveState.page=0;renderArchive();return;}
 if(b.dataset.archiveFilter){archiveState.filter=b.dataset.archiveFilter;archiveState.page=0;all('[data-archive-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderGrid();return;}
 if(b.dataset.archivePage){archiveState.page+=Number(b.dataset.archivePage);renderGrid();return;}
 if(b.dataset.archiveBoard){detail(b.dataset.archiveBoard);return;}
 if(b.dataset.archiveStart){start(b.dataset.archiveStart).catch(e=>showToast(e.message));return;}
 const action=b.dataset.archiveAction;if(!action)return;e.preventDefault();
 if(action==='review-reset'){window.PropletArchiveReview.setScenario({reset:true});return}
 if(action==='close'){closeModal();return}
 if(action==='announcement'){announcement();return}if(action==='rewards'){rewardRules();return}if(action==='review'){review();return}
 if(action==='theme'){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:true});return}
 if(action==='demo-resume'){await window.__PROPLET_ENSURE_FULL_PUZZLE_DB?.();const state=getState(),p=puzzleDB.free.medium.find(p=>p.answers?.length&&p.meta.level>18);if(p){state.inProgress['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:'medium',found:[],moves:0,hints:0,elapsedMs:18000,savedAt:Date.now()};saveState(state);renderDaily();renderFree();}closeModal();nav('daily');return}
 if(action==='demo-clear-resume'){const state=getState();state.inProgress={};saveState(state);closeModal();renderDaily();renderFree();return}
 closeModal();
 if(action==='open'||action==='enter'||action==='retry'){nav('archive');return}
 if(action==='extra'){nav('daily');const ui=dailySpecialUI();ui?.select('special');if(ui?.getState().selected==='special'){q('#dailyChallengeSwitch')?.scrollIntoView({block:'center',behavior:'smooth'});q('#dailyChallengeSwitch [data-daily-kind="special"]')?.focus({preventScroll:true});}else ui?.openWeek(q('#dailyHeroTitle [data-daily-kind="base"]'));return}
 if(action==='free'){nav('free');return}if(action==='daily'){nav('daily');return}
 if(action==='rankings'){nav('leaderboard');return}
 if(action==='team'){if(window.PropletWeeklyCompetition){window.PropletWeeklyCompetition.open();return;}nav('leaderboard');await rankingsOrchestration().openWeeklyTeams();q('#xpRankingTitle')?.scrollIntoView({block:'start',behavior:'smooth'});}
}
window.PropletArchiveExperience={configure,isEnabled:()=>installed,announcement,refreshClaims,resultConfirmed,renderResult,adoptGuest,install,home,free,placePlayExtra,screen,reward,beforeSubmit,hintUsed,prepareCompletion,postWin,isTarget,loadBank,start,renderArchive,closeModal};
})();



