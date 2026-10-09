/* Archive and monthly competition embedded in the canonical Proplet runtime. */
(()=>{
'use strict';
if(!window.PROPLET_ARCHIVE_PREVIEW)return;
const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
// Resolve names from the live game's single difficulty registry.
const labels=Object.fromEntries(['easy','medium','hard','hardcore'].map(key=>[key,'']));
const rewards={easy:15,medium:25,hard:50,hardcore:100};
const glyph={arrow:'M5 12h14m-5-5 5 5-5 5',back:'M19 12H5m5-5-5 5 5 5',check:'m5 12 4 4L19 6',archive:'M4 8h16v12H4zM3 4h18v4H3zm6 8h6',trophy:'M8 3h8v6c0 7-8 7-8 0V3Zm0 2H4v3c0 3 2 4 5 4m7-7h4v3c0 3-2 4-5 4m-3 2v6m-4 0h8',team:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9v-2c0-6 12-6 12 0v2m0-15a3 3 0 0 1 0 6m3 3c3 0 4 2 4 4v2',grid:'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v1',close:'m6 6 12 12M18 6 6 18'};
const ico=n=>'<svg class="ax-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="'+glyph[n]+'"/></svg>';
function archiveArt(){return '<svg class="archive-art" viewBox="0 0 360 260" aria-hidden="true">'+
'<ellipse cx="183" cy="232" rx="137" ry="11" fill="#7d5736" opacity=".08"/>'+
'<g transform="translate(54 40) rotate(-12 95 90)"><rect x="0" y="8" width="184" height="176" rx="10" fill="#b89469"/><rect width="184" height="176" rx="10" fill="#d7c5a2" stroke="#866c4c" stroke-width="2"/><path d="M15 16h154M15 158h154" stroke="#9f8865"/><text x="20" y="45" font-family="Fraunces,Georgia,serif" font-size="17" font-weight="600" fill="#6c5639">Proplet</text><path d="M20 62h118m-118 8h86" stroke="#a18b66" stroke-width="2"/><rect x="20" y="88" width="141" height="49" rx="3" fill="#bdba91" stroke="#969468"/><path d="M44 88v49m24-49v49m24-49v49m24-49v49m24-49v49M20 112h141" stroke="#969468"/></g>'+
'<g transform="translate(135 29) rotate(9 83 90)"><rect x="1" y="7" width="167" height="190" rx="9" fill="#b69974"/><rect width="167" height="190" rx="9" fill="#fff5dc" stroke="#a68660" stroke-width="2"/><path d="M15 21h137" stroke="#cbbb9d"/><text x="83" y="49" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="22" font-weight="750" fill="#8c4a2c">Staré dobré</text><text x="83" y="72" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-size="22" font-weight="750" fill="#8c4a2c">rozplétání.</text><g transform="translate(25 87)"><rect width="117" height="78" rx="5" fill="#e9e5cb" stroke="#afa88a"/><path d="M39 0v78m39-78v78M0 39h117" stroke="#afa88a"/><path d="M20 19h77v40H20" fill="none" stroke="#a4b29a" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><g font-family="Outfit,sans-serif" font-size="20" font-weight="600" fill="#405943" text-anchor="middle"><text x="20" y="27">A</text><text x="59" y="27">R</text><text x="98" y="27">C</text><text x="20" y="66">V</text><text x="59" y="66">I</text><text x="98" y="66">H</text></g></g><path d="M39 178h89" stroke="#c7b997"/></g>'+
'<g transform="translate(46 158) rotate(-9 41 34)"><path d="m43-6 7 7 10-3 4 10 11 1v10l9 6-5 9 5 10-10 5v11l-11 1-4 10-10-3-7 7-7-7-10 3-4-10-11-1V50l-10-5 5-10-5-9 9-6V9l11-1 4-10 10 3Z" fill="#ac4e32" stroke="#7b3824" stroke-width="1.5"/><circle cx="43" cy="33" r="29" fill="none" stroke="#e4b48b" stroke-width="1.2"/><text x="43" y="34" text-anchor="middle" fill="#fff0d2" font-family="Fraunces,Georgia,serif" font-size="27" font-weight="750">800</text><text x="43" y="49" text-anchor="middle" fill="#fff0d2" font-family="Outfit,sans-serif" font-size="9" letter-spacing="1">DESEK</text></g>'+
'<path d="m285 55 7-9m2 20 13-1m-2 115 9 5M36 119l-10-4" stroke="#ad7d51" stroke-width="2" stroke-linecap="round"/>'+
'</svg>';}

// Use the production Printshop illustrations, including their original texture,
// material, lighting and outlines. Month/year is a typeset edition mark.
function medal(place=1,options={}){return window.PropletSeasonView.medal(place,options);}

let installed=false,bank=null,loading=null,archiveState={diff:'easy',filter:'all',query:'',page:0},modalFocus=null;
const STORE='archive-experience-v1';
function read(){try{return {claims:{},progress:{},...JSON.parse(localStorage.getItem(STORE)||'{}')}}catch{return {claims:{},progress:{}}}}
function write(s){localStorage.setItem(STORE,JSON.stringify(s))}
const slot=p=>'legacy-free:'+p.difficulty+':'+p.meta.level;
const row=p=>bank?.boards.find(b=>b.puzzle.id===(typeof p==='string'?p:p.id));
const completion=p=>getState().completed['free:'+p.id];
const paid=p=>!!read().claims[slot(p)];
function reward(p){if(currentGame?.puzzle?.id===p.id&&Number.isFinite(currentGame.archiveAward))return currentGame.archiveAward;return paid(p)?0:rewards[p.difficulty]}
function freshPuzzle(entry){
 const p=structuredClone(entry.puzzle);p.meta={...p.meta,level:entry.level,contentGeneration:3,archiveExperience:true};
 return p;
}
async function loadBank(){
 if(bank)return bank;
 if(!loading)loading=fetch('/app/archive/boards.json').then(r=>{if(!r.ok)throw Error('Archiv se nepodařilo načíst.');return r.json()}).then(data=>{bank=data;return data}).catch(e=>{loading=null;throw e});
 return loading;
}
// One structure for every discovery destination. The action is an actual button;
// the surrounding article is never a second, ambiguous hit target.
function destination({id='',kind,title,description,art,action,label}){
 return '<article '+(id?'id="'+id+'" ':'')+'class="ax-destination ax-'+kind+'-entry"><div class="ax-entry-copy"><h2>'+title+'</h2><p class="ax-entry-description">'+description+'</p></div><div class="ax-entry-art" aria-hidden="true">'+art+'</div><button type="button" class="ax-card-action ax-browse-action" data-archive-action="'+action+'">'+label+' '+ico('arrow')+'</button></article>';
}
function archiveEntry(){return destination({kind:'archive',title:'Archiv Propletu',description:'800 původních desek',art:archiveArt(),action:'open',label:'Vybrat archivní desku'});}
function home(){
 if(!installed)return;
 const root=q('#screen-daily');if(!root)return;
 let games=q('#axHomeGames');if(!games){games=document.createElement('div');games.id='axHomeGames';games.innerHTML='<div id="axHomeArchive">'+archiveEntry()+'</div>';root.append(games);}
 if(!q('#axHomeFree')){root.insertAdjacentHTML('beforeend',destination({id:'axHomeFree',kind:'free',title:'Volná hra',description:'Všechny obtížnosti a úrovně',art:'<div class="ax-free-art">'+Object.keys(labels).map(diff=>difficultyIconMarkup(diff,'ax-free-difficulty')).join('')+'</div>',action:'free',label:'Vybrat hru'}));}
 let competition=q('#axHomeCompetitions');if(!competition){competition=document.createElement('section');competition.id='axHomeCompetitions';competition.className='ax-competitions';competition.setAttribute('aria-label','Soutěže');competition.innerHTML='<div class="ax-competition-grid">'+destination({kind:'team',title:'Týdenní soutěž',description:'Týmy · společné skóre',art:'<img src="/rewards/team-victories/first-imprint.webp" alt="">',action:'team',label:'Zobrazit pořadí týmů'})+destination({kind:'month',title:'Měsíční soutěž',description:'Jednotlivci · denní výsledky',art:medal(1,{edition:false}),action:'season',label:'Otevřít soutěž'})+'</div>';root.append(competition);}
 const latest=Object.values(getState().inProgress||{}).filter(r=>r.mode==='free').sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];
 const archiveResume=latest&&read().progress[latest.puzzleId];let resume=q('#axArchiveResume');
 if(archiveResume){if(!resume){resume=document.createElement('button');resume.id='axArchiveResume';resume.className='home-resume-card';root.prepend(resume);}
 const level=Number(latest.puzzleId.split('-').pop());resume.dataset.archiveStart=latest.puzzleId;const copy='<span class="home-resume-icon">'+difficultyIconMarkup(latest.difficulty,'home-resume-difficulty-icon')+'</span><span class="home-resume-copy"><span>ROZEHRANÝ ARCHIV</span><strong>'+labels[latest.difficulty]+' · deska '+level+'</strong></span><b>Pokračovat <i>→</i></b>';if(resume.innerHTML!==copy)resume.innerHTML=copy;q('#homeResumeCard')?.classList.add('hidden');
 }else{resume?.remove();q('#homeResumeCard')?.classList.remove('hidden');}
 // Keep canonical Daily / Tajenka / release state and handlers. Only reorder stable nodes.
 const ordered=[q('#axArchiveResume'),q('#homeResumeCard'),root.querySelector('.daily-hero'),q('#rescueCard'),q('#todayNewContentBanner'),q('#tajenkaPreviewCard'),games,competition,q('#axHomeFree'),q('#levelCard')].filter(Boolean);
 let prev=null;for(const el of ordered){if(prev){if(prev.nextElementSibling!==el)prev.after(el);}else if(root.firstElementChild!==el)root.prepend(el);prev=el;}
}
function free(){
 if(!installed)return;
 const root=q('#screen-free');if(!root)return;
 // Order is intentional: fresh content, current difficulties, Tajenka, Archive.
 if(!q('#axPlayArchive')){const el=document.createElement('div');el.id='axPlayArchive';el.innerHTML=archiveEntry();root.append(el);}
 all('#difficultyCards .cp-action-row').forEach(row=>{const play=row.querySelector('.cp-play');if(play)row.replaceWith(play);});
}
function seed(){
 const state=getState();if(localStorage.getItem('ax-seeded'))return;
 localStorage.setItem('ax-seeded','1');
 for(const [diff,count] of Object.entries({easy:27,medium:18,hard:11,hardcore:6,mozkomor:2,mozkokalypsa:1})){
  for(const p of (puzzleDB.free?.[diff]||[]).slice(0,count)){
   const key='free:'+p.id;state.completed[key]={challengeKey:key,puzzleId:p.id,mode:'free',difficulty:diff,level:p.meta?.level,contentGeneration:p.meta?.contentGeneration||4,points:DIFF[diff].xp,moves:p.answers?.length||8,elapsedMs:180000,hintsUsed:0,cleanSolve:true,completedAt:'2026-10-06T16:00:00Z'};
  }
 }
 saveState(state);
 const s=read();for(const diff of Object.keys(labels))for(let i=1;i<=14;i++)s.claims['legacy-free:'+diff+':'+i]={source:'historical-example',xp:rewards[diff]};write(s);
 localStorage.setItem('proplet-v3-5-account-nudge',JSON.stringify({shown:[1,2,3]}));
}
function install(){
 if(installed)return;installed=true;for(const key of Object.keys(labels))labels[key]=DIFF[key].label;document.body.classList.add('archive-experience');
 if(!q('#screen-free'))throw Error('Archive mount: canonical free screen missing');
 for(const id of ['archive','season']){const section=document.createElement('section');section.id='screen-'+id;section.className='screen ax-screen';q('#screen-free').after(section);}
 const modal=document.createElement('div');modal.id='archiveExperienceModal';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','axModalTitle');document.body.append(modal);
 seed();home();free();
 registerGameSessionHook({id:'archive-experience',priority:40,afterStart:({game:g})=>{
  if(!g?.puzzle?.meta?.archiveExperience)return;
  const saved=read().progress[g.puzzle.id];g.archiveHints=saved?.revealed||[];
  q('#gameModeLabel').textContent='Archiv Propletu';
  q('#gameDifficulty').insertAdjacentHTML('beforeend','<span class="ax-game-origin">Původní deska</span>');
 },afterPersist:({game:g,saved})=>{
  if(!saved||!g?.puzzle?.meta?.archiveExperience)return;
  const s=read();g.archiveHints??=s.progress[g.puzzle.id]?.revealed||[];s.progress[g.puzzle.id]=snapshot(g);write(s);
 }});
 registerGameCompletionHook({id:'archive-experience',priority:200,after:({game:g})=>{
  if(!g?.puzzle?.meta?.archiveExperience)return;
  const s=read();s.claims[slot(g.puzzle)]||={source:g.puzzle.id,xp:g.archiveAward};delete s.progress[g.puzzle.id];write(s);
  q('#winMenuBtn').textContent='Zpět do Archivu';q('#winPrimaryBtn').textContent='Vybrat jinou desku';
  q('#winText').textContent=labels[g.puzzle.difficulty]+' · archivní deska '+g.puzzle.meta.level+' · '+fmtTime(g.elapsedMs);
  q('#levelLeaderboardBox').classList.add('hidden');
  setWinXpDisplay(g.archiveAward?('+'+g.archiveAward+' XP'):'Historická odměna už získána',g.archiveAward?'Dosud nezískaná historická odměna':'');
  q('#winModal').classList.add('ax-archive-result');
 }});
 document.addEventListener('click',onClick);
 document.addEventListener('input',e=>{if(e.target.id==='axSearch'){archiveState.query=e.target.value.replace(/[^0-9]/g,'');archiveState.page=0;renderGrid();}});
 document.addEventListener('keydown',e=>{if(q('#archiveExperienceModal').classList.contains('hidden'))return;if(e.key==='Escape'){e.stopImmediatePropagation();closeModal();}if(e.key==='Tab'){const nodes=all('#archiveExperienceModal button,#archiveExperienceModal select,#archiveExperienceModal input');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}},true);
 document.addEventListener('proplet:ready',()=>{home();free();window.__PROPLET_REVEAL_CURRENT_UI?.();document.documentElement.dataset.archiveReady='1';const open=new URLSearchParams(location.search).get('review');if(open==='archive')nav('archive');else if(open==='season')nav('season');else if(open==='free')nav('free');else if(open==='announcement')announcement();else if(open==='season-announcement')seasonAnnouncement();},{once:true});
}
function screen(name){
 if(!installed)return;
 if(name==='archive')renderArchive();if(name==='season')renderSeason();
 if(name==='leaderboard'&&!q('#axRankingSeason')){const root=q('#screen-leaderboard'),entry=document.createElement('button');entry.id='axRankingSeason';entry.className='ax-ranking-season';entry.dataset.archiveAction='season';entry.innerHTML=medal(1)+'<span><strong>Měsíční soutěž</strong><small>Nový začátek každý měsíc · 20 nejlepších denních her</small></span>'+ico('arrow');const head=root.querySelector('.screen-title');if(head)head.after(entry);else root.prepend(entry);}
}
async function renderArchive(){
 const root=q('#screen-archive');
 if(!bank){root.innerHTML='<div class="ax-loading">Otevírám Archiv…</div>';try{await loadBank()}catch(e){root.innerHTML='<h1>Archiv počká.</h1><p>Nepodařilo se načíst desky. Tvůj postup zůstává uložený.</p><button class="primary-btn" data-archive-action="retry">Zkusit znovu</button>';return;}}
 const d=archiveState.diff;
 root.innerHTML='<button class="ax-back" data-archive-action="free">'+ico('back')+' Zpět na Hrát</button><div class="ax-archive-heading"><div><h1>Archiv Propletu</h1><p>Původní desky z prvních verzí hry. Vyber si kteroukoli.</p><span>800 desek · čtyři obtížnosti · vlastní pořadí</span></div>'+archiveArt()+'</div><div class="ax-archive-note"><p>Za historické odměny, které jsi ještě nezískal, na tebe pořád čekají XP.</p><button data-archive-action="rewards">Jak to funguje '+ico('info')+'</button></div><div class="ax-difficulty-tabs">'+Object.keys(labels).map(diff=>'<button data-archive-diff="'+diff+'" aria-pressed="'+(diff===d)+'">'+difficultyIconMarkup(diff,'ax-difficulty-art')+'<span><strong>'+labels[diff]+'</strong><small>200 desek · '+rewards[diff]+' XP</small></span></button>').join('')+'</div><div class="ax-collection-title"><h2>'+({easy:'Snadné desky',medium:'Středně těžké desky',hard:'Těžké desky',hardcore:labels.hardcore}[d])+'</h2><span>Vyber si kteroukoli.</span></div><div class="ax-filter-row"><div class="ax-filters">'+[['all','Všechny'],['unplayed','Nehrané'],['reward','S odměnou XP']].map(([v,l])=>'<button data-archive-filter="'+v+'" aria-pressed="'+(archiveState.filter===v)+'">'+l+'</button>').join('')+'</div><label class="ax-search">'+ico('search')+'<input id="axSearch" aria-label="Číslo archivní desky" type="search" inputmode="numeric" placeholder="Číslo desky" maxlength="3" value="'+archiveState.query+'"></label></div><div id="axBoardResults"></div><div class="ax-history-note"><h3>Malý výlet do historie</h3><p>Některá slova i obtížnost jsou trochu po svém. Původní desky jsme zachovali a prověřili jejich řešení. Žádné odemykání, žádné povinné pořadí.</p></div>';
 renderGrid();
}
function renderGrid(){
 if(!q('#axBoardResults')||!bank)return;
 const {diff,filter,query}=archiveState,list=bank.boards.filter(r=>r.difficulty===diff&&(!query||String(r.level).includes(query))).filter(r=>{const p=freshPuzzle(r);return filter==='unplayed'?!completion(p):filter==='reward'?!paid(p):true;});
 const pages=Math.max(1,Math.ceil(list.length/40));archiveState.page=Math.min(archiveState.page,pages-1);const offset=archiveState.page*40;
 q('#axBoardResults').innerHTML='<div class="ax-board-grid">'+list.slice(offset,offset+40).map(r=>{const p=freshPuzzle(r),done=!!completion(p),claimed=paid(p),progress=getState().inProgress['free:'+p.id];return '<button class="ax-board '+(claimed?'ax-paid':'')+'" data-archive-board="'+p.id+'" aria-label="'+labels[diff]+' deska '+r.level+', '+(done?'odehráno':progress?'rozehráno':'nehráno')+', '+(claimed?'odměna už získána':rewards[diff]+' XP k získání')+'">'+(done?'<i>'+ico('check')+'</i>':progress?'<i class="ax-progress-dot"></i>':'')+'<strong>'+r.level+'</strong><span>'+(progress?'Rozehráno':claimed?'XP získány':'+'+rewards[diff]+' XP')+'</span></button>';}).join('')+(list.length?'':'<p class="ax-empty">Zkus jiné číslo nebo filtr.</p>')+'</div><div class="ax-grid-foot"><span>'+(list.length?(offset+1)+'–'+Math.min(offset+40,list.length)+' z '+list.length:'Žádné desky')+'</span><div><button data-archive-page="-1" aria-label="Předchozí desky" '+(archiveState.page===0?'disabled':'')+'>'+ico('back')+'</button><span>'+(archiveState.page+1)+' / '+pages+'</span><button data-archive-page="1" aria-label="Další desky" '+(archiveState.page===pages-1?'disabled':'')+'>'+ico('arrow')+'</button></div></div><p class="ax-legend">✓ Odehraná deska <span>·</span> XP získány = jednou připsaná historická odměna</p>';
}
function modal(html,kind=''){
 const m=q('#archiveExperienceModal');if(m.classList.contains('hidden')){modalFocus=document.activeElement;document.body.dataset.axOldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
 m.innerHTML='<div class="modal-card ax-modal '+kind+'"><button class="modal-close" data-archive-action="close" aria-label="Zavřít">'+ico('close')+'</button>'+html+'</div>';m.classList.remove('hidden');q('.app-shell').inert=true;q('.bottom-nav').inert=true;
 m.querySelector('.modal-close').focus({preventScroll:true});
}
function closeModal(){q('#archiveExperienceModal').classList.add('hidden');q('.app-shell').inert=false;q('.bottom-nav').inert=false;if(document.body.dataset.axOldOverflow!==undefined){document.body.style.overflow=document.body.dataset.axOldOverflow;delete document.body.dataset.axOldOverflow;}if(modalFocus?.isConnected)modalFocus.focus({preventScroll:true});}
function detail(id){
 const r=row(id);if(!r)return;const p=freshPuzzle(r),done=completion(p),progress=getState().inProgress['free:'+id],earned=paid(p);
 modal('<div class="ax-detail-heading">'+difficultyIconMarkup(r.difficulty,'ax-detail-art')+'<div><h2 id="axModalTitle">Deska '+r.level+'</h2><p>'+labels[r.difficulty]+' · Archiv</p></div></div><div class="ax-detail-reward"><strong>'+(earned?'Odměna už je tvoje':'Čeká na tebe '+r.rewardXp+' XP')+'</strong><p>'+(earned?'Historickou odměnu za tuto úroveň už máš získanou. Desku si přesto můžeš zahrát kdykoli.':'Tohle je dosud nezískaná historická odměna. Dokončené novější desky ji neblokují.')+'</p></div><p class="ax-detail-state">'+(progress?'Rozehráno · '+progress.found.length+' / '+p.answers.length+' slov':done?'Tuto desku už máš odehranou.':'Tuto desku jsi ještě nehrál.')+'</p><button class="primary-btn big" data-archive-start="'+id+'">'+(progress?'Pokračovat':done?'Zahrát znovu':'Hrát desku '+r.level)+' →</button>','ax-detail');
}
function snapshot(g){const r=row(g.puzzle);return {solutionPolicyRevision:r.solutions.solutionPolicyRevision,found:g.found.map(f=>({word:f.word,path:[...f.path]})),revealed:g.archiveHints||[]};}
function contract(g){return window.PropletArchiveSolutions.create(row(g.puzzle).puzzle,row(g.puzzle).solutions);}
function choose(g,solutionId){g.puzzle.answers=structuredClone(row(g.puzzle).solutions.solutionSets[solutionId]);g.found.forEach(f=>{f.answerIndex=g.puzzle.answers.findIndex(a=>a.word===f.word&&samePath(a.path,f.path))});}
function beforeSubmit(g,word,path){if(!g?.puzzle?.meta?.archiveExperience)return;const out=contract(g).submit(snapshot(g),word,path);if(out.accepted)choose(g,out.solutionIds[0]);}
function hintUsed(g,pick,level){if(!g?.puzzle?.meta?.archiveExperience)return;g.archiveHints||=[];const hint={level,targetLength:pick.a.word.length,shownPath:pick.a.path.slice(0,level===1?1:level===2?3:pick.a.path.length)};if(level===3)hint.shownWord=pick.a.word;g.archiveHints.push(hint);}
async function start(id){
 await loadBank();const r=row(id);if(!r)return;const p=freshPuzzle(r),saved=read().progress[id];
 if(saved){const c=window.PropletArchiveSolutions.create(r.puzzle,r.solutions),status=c.restore(saved);if(status.ok){p.answers=structuredClone(r.solutions.solutionSets[status.solutionIds[0]]);const state=getState(),progress=state.inProgress['free:'+id];if(progress){progress.found.forEach(f=>{f.answerIndex=p.answers.findIndex(a=>a.word===f.word&&samePath(a.path,f.path))});saveState(state);}}}
 closeModal();await startGame(p,'free',null,{archive:true});
}
function prepareCompletion(g){const result=contract(g).evaluate(snapshot(g));if(!result.ok||!result.completed)throw Error('Archive solution is not a complete approved cover');g.archiveAward=paid(g.puzzle)?0:rewards[g.puzzle.difficulty];}
function postWin(){q('#winModal').classList.add('hidden');q('#winModal').classList.remove('ax-archive-result');nav('archive',{replace:true});}
function isTarget(g,word){return !!g?.puzzle?.meta?.archiveExperience&&contract(g).isSolutionWord(word);}
function announcement(){
 modal('<h2 id="axModalTitle">Dobré desky<br>nestárnou.</h2><p class="ax-cta-copy"><strong>800 původních desek</strong> se vrací do hry.<br>Vyber si kteroukoli. Pořadí je na tobě.</p><div class="ax-cta-difficulties">'+Object.keys(labels).map(d=>'<div>'+difficultyIconMarkup(d,'ax-cta-art')+'<strong>'+labels[d]+'</strong><span>200 desek</span></div>').join('')+'</div><p class="ax-cta-note">Je to výlet do začátků Propletu.<br>Některá slova i obtížnost jsou trochu po svém.</p><button class="primary-btn big ax-cta-primary" data-archive-action="enter">Prozkoumat Archiv →</button><button class="text-btn ax-cta-secondary" data-archive-action="close">Nechám si na později</button>','ax-announcement');
}
function rewardRules(){modal('<h2 id="axModalTitle">Staré desky.<br>Férové odměny.</h2><ol class="ax-rules"><li><b>Odměna patří k historické úrovni.</b> Starší verze stejného čísla a obtížnosti sdílejí jednu odměnu.</li><li><b>Novější desky ji neblokují.</b> Pokud jsi starou odměnu nezískal, v Archivu na tebe pořád čeká.</li><li><b>Už připsané XP dostaneš jen jednou.</b> Fajfka u čísla zvlášť označuje, že jsi hrál právě tuto desku.</li></ol><button class="primary-btn big" data-archive-action="close">Rozumím</button>');}
function seasonAnnouncement(){modal('<h2 id="axModalTitle">Nový měsíc.<br>Nová šance.</h2><p class="ax-cta-copy">V měsíční soutěži <strong>začínáme od nuly.</strong><br>Tvůj měsíc může přijít právě teď.</p><div class="ax-medal-trio">'+medal(2)+medal(1)+medal(3)+'</div><div class="ax-cta-facts"><span><b>20</b>nejlepších denních her</span><span><b>3</b>vítězné příčky</span><span><b>1</b>nový začátek každý měsíc</span></div><p class="ax-cta-note">100 bodů za Denní výzvu, dalších 20 bez nápovědy.<br>Rozhodují body, ne rychlost.</p><button class="primary-btn big ax-cta-primary" data-archive-action="season">Prohlédnout soutěž →</button><button class="text-btn ax-cta-secondary" data-archive-action="season-rules">Nejdřív si přečtu pravidla</button>','ax-announcement ax-season-announcement');}
function renderSeason(){q('#screen-season').innerHTML=window.PropletSeasonView.markup();}
function seasonRules(){modal(window.PropletSeasonView.rules(),'sv-rules-modal');}
function review(){modal('<h2 id="axModalTitle">Vyzkoušej celý Proplet.</h2><p class="muted">Tohle je skutečná aplikace z main s integrovaným návrhem. Hraní i pokračování fungují. Postup a výsledky zůstávají v tomto testovacím zařízení.</p><div class="ax-review-buttons"><button class="secondary-btn" data-archive-action="announcement">Úvodní CTA Archivu</button><button class="secondary-btn" data-archive-action="season-announcement">Úvodní CTA soutěže</button><button class="secondary-btn" data-archive-action="theme">Světlý / tmavý vzhled</button><button class="secondary-btn" data-archive-action="demo-resume">Ukázat rozehranou hru</button><button class="secondary-btn" data-archive-action="demo-clear-resume">Skrýt rozehrané ukázky</button><button class="secondary-btn" data-season-scenario="normal">Pódium: běžný měsíc</button><button class="secondary-btn" data-season-scenario="tie">Pódium: společné první místo</button><button class="secondary-btn" data-season-scenario="first">Pódium: první sezóna</button><button class="secondary-btn" data-season-scenario="pending">Pódium: kontrola výsledků</button></div><p class="ax-review-caption">Archiv: 800 původních desek. Soutěž: modelový listopad, bez určeného termínu spuštění.</p>');}
async function onClick(e){
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.archiveDiff){archiveState.diff=b.dataset.archiveDiff;archiveState.page=0;renderArchive();return;}
 if(b.dataset.archiveFilter){archiveState.filter=b.dataset.archiveFilter;archiveState.page=0;all('[data-archive-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderGrid();return;}
 if(b.dataset.archivePage){archiveState.page+=Number(b.dataset.archivePage);renderGrid();return;}
 if(b.dataset.archiveBoard){detail(b.dataset.archiveBoard);return;}
 if(b.dataset.archiveStart){start(b.dataset.archiveStart).catch(e=>showToast(e.message));return;}
 if(b.dataset.seasonWinners){modal(window.PropletSeasonView.winnerDetail(Number(b.dataset.seasonWinners)),'sv-winners-modal');return;}
 if(b.dataset.seasonScenario){window.PropletSeasonView.setScenario(b.dataset.seasonScenario);closeModal();nav('season');renderSeason();return;}
 if(b.dataset.archiveBadge){const p=Number(b.dataset.archiveBadge);modal('<div class="ax-badge-detail">'+medal(p)+'<h2 id="axModalTitle">'+['Vládce listopadu','Stříbrný listopad','Bronzový listopad'][p-1]+'</h2><p>Listopad 2026 · '+p+'. příčka</p><p class="muted">Trvalý odznak za umístění v měsíční soutěži.</p></div><button class="primary-btn big" data-archive-action="close">Zpět do soutěže</button>');return;}
 const action=b.dataset.archiveAction;if(!action)return;e.preventDefault();
 if(action==='close'){closeModal();return}
 if(action==='announcement'){announcement();return}if(action==='season-announcement'){seasonAnnouncement();return}if(action==='rewards'){rewardRules();return}if(action==='season-rules'){seasonRules();return}if(action==='review'){review();return}
 if(action==='theme'){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:true});return}
 if(action==='demo-resume'){await window.__PROPLET_ENSURE_FULL_PUZZLE_DB?.();const state=getState(),p=puzzleDB.free.medium.find(p=>p.answers?.length&&p.meta.level>18);if(p){state.inProgress['free:'+p.id]={puzzleId:p.id,mode:'free',difficulty:'medium',found:[],moves:0,hints:0,elapsedMs:18000,savedAt:Date.now()};saveState(state);renderDaily();renderFree();}closeModal();nav('daily');return}
 if(action==='demo-clear-resume'){const state=getState();state.inProgress={};saveState(state);closeModal();renderDaily();renderFree();return}
 closeModal();
 if(action==='open'||action==='enter'||action==='retry'){nav('archive');return}
 if(action==='free'){nav('free');return}if(action==='season'){nav('season');return}if(action==='daily'){nav('daily');return}
 if(action==='rankings'){nav('leaderboard');return}
 if(action==='team'){nav('leaderboard');await rankingsOrchestration().openWeeklyTeams();q('#xpRankingTitle')?.scrollIntoView({block:'start',behavior:'smooth'});}
}
window.PropletArchiveExperience={install,home,free,screen,reward,beforeSubmit,hintUsed,prepareCompletion,postWin,isTarget,loadBank,start,renderArchive,closeModal};
})();

