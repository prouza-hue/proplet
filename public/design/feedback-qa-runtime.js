(()=>{
// Disposable fixture page only. Storage is in memory; API writes never leave the frame.
for(const key of ['localStorage','sessionStorage']){const map=new Map();Object.defineProperty(window,key,{value:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),clear:()=>map.clear(),key:i=>[...map.keys()][i],get length(){return map.size}}})}
const params=new URLSearchParams(parent.location.search),view=params.get('view')||'hardcore';
if(Number(params.get('width')||390)<1000){const base=window.matchMedia.bind(window);window.matchMedia=q=>{const m=base(q);if(!/pointer/.test(q))return m;return new Proxy(m,{get:(o,k)=>k==='matches'?q.includes('coarse'):typeof o[k]==='function'?o[k].bind(o):o[k]})};Object.defineProperty(navigator,'maxTouchPoints',{value:1})}
const total=params.has('big')?120:7,mine=params.has('big')?75:5;
const rows=Array.from({length:total},(_,i)=>({rank:i+1,isMine:i===mine-1,name:i===mine-1?'Ty':`VelmiDlouháPřezdívkaPropletače ${i+1}`,avatar:'🐱',elapsedMs:50000+i*5000,moves:7+i,hintsUsed:0,cleanSolve:true}));
Object.defineProperty(screen,'width',{get:()=>innerWidth});Object.defineProperty(screen,'height',{get:()=>innerHeight});
Object.defineProperty(screen.orientation,'type',{get:()=>innerWidth>innerHeight?'landscape-primary':'portrait-primary'});
const baseFetch=window.fetch.bind(window);window.fetch=(url,opts={})=>{
 const u=new URL(typeof url==='string'?url:url.url,parent.location.origin);
 if(u.pathname.startsWith('/api/')&&u.pathname!=='/api/tajenka'){
  let data={};
  if(u.pathname.includes('global-leaderboard'))data={total,myRank:mine,topPercent:72,puzzleId:'g4-x-001',...(view==='daily'?{date:'2026-09-09'}:{}),rows:u.searchParams.has('offset')?rows.slice(Number(u.searchParams.get('offset')),Number(u.searchParams.get('offset'))+50):rows.slice(mine-2,mine+1),nextOffset:Number(u.searchParams.get('offset'))+50<total?Number(u.searchParams.get('offset'))+50:null};
  if(u.pathname==='/api/rankings/xp')data={players:rows.slice(0,3).map(r=>({...r,xp:3000-r.rank*100}))};
  return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));
 }
 return baseFetch(url,opts);
};
navigator.sendBeacon=()=>true;
window.addEventListener('load',()=>{
 const ready=async()=>{
  if(typeof puzzleDB==='undefined'||!puzzleDB?.free?.hardcore){setTimeout(ready,100);return}
  document.querySelectorAll('.modal').forEach(el=>el.classList.add('hidden'));
  if(view==='home'){
   const priorStats=effectiveStats;effectiveStats=()=>({...priorStats(),points:123456789,currentStreak:1234});
   const state=tajenkaState();state.completions=state.completions||{};state.completions[tajenkaPuzzle.id]={puzzleId:tajenkaPuzzle.id,moves:7,elapsedMs:64000,found:[],rewarded:true};saveTajenkaState(state);renderDaily();renderTajenkaEntry();nav('daily');
  }else{
   const puzzle=puzzleDB.free.hardcore[0];startGame(puzzle,view==='daily'?'daily':'free',view==='daily'?'2026-09-09':null);stopTimer();currentGame.pausedAt=performance.now();
   if(view==='free'||view==='daily'){
    currentGame.found=puzzle.answers.map((a,i)=>({answerIndex:i,word:a.word,path:[...a.path],colorIndex:i%COLORS.length}));
    currentGame.found.forEach(f=>f.path.forEach(i=>currentGame.used.set(i,f.colorIndex)));
    currentGame.elapsedMs=96000;currentGame.moves=10;await finishGame();
    const data={total,myRank:mine,topPercent:72,puzzleId:puzzle.id,rows:rows.slice(mine-2,mine+1),...(view==='daily'?{date:'2026-09-09'}:{})};
    if(view==='free')renderFreeLeaderboardPanel(document.querySelector('#levelLeaderboardBox'),{world:data,team:{rows:rows.map((r,i)=>({...r,id:String(i)}))}},'4');
    else renderDailyGlobalLeaderboardBox(document.querySelector('#levelLeaderboardBox'),data);
    }else {
    setTimeout(()=>{
     const answer=[...puzzle.answers].sort((a,b)=>b.path.length-a.path.length)[0];
     const route=answer.path.slice(0,params.get('short')?3:answer.path.length);
     const cell=document.querySelector(`.cell[data-index="${route[0]}"]`),rect=cell.getBoundingClientRect();
     pointerDown({preventDefault(){},currentTarget:cell,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,pointerId:7,pointerType:'touch'});
     route.slice(1).forEach(i=>pointerEnter({currentTarget:document.querySelector(`.cell[data-index="${i}"]`)}));
     if(params.has('long'))document.querySelector('#currentWord').textContent='NEJNEOBHOSPODAŘOVÁVATELNĚJŠÍ';
     message('Tohle slovo do Propletu nepatří. Zkus poskládat jiné slovo.','bad');

    },700);
   }
  }
  setTimeout(()=>{document.querySelector('#onboardingModal')?.classList.add('hidden');document.querySelectorAll('.onboarding-modal').forEach(el=>el.classList.add('hidden'));fitGameBoard();drawPaths()},300);
 };setTimeout(ready,1000);
},{once:true});
})();
