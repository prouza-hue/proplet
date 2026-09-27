/* QA only. These controls and memory fixtures are NOT shipped in public/. */
(() => {
  const q=new URLSearchParams(location.search);
  function result(){
    document.querySelectorAll('.modal:not(.hidden)').forEach(e=>e.classList.add('hidden'));
    window.currentGame={finished:true,mode:'daily',puzzle:{id:'qa-only',answers:[]},elapsedMs:124000,moves:5};
    document.querySelector('#winTitle').textContent='Výzva hotová!';
    document.querySelector('#winPraise').textContent='Každé slovo se počítá.';
    document.querySelector('#winText').textContent='2:04 · 5 tahů';
    document.querySelector('#winXp').textContent='+ 200 XP';
    document.querySelector('#winPrimaryBtn').textContent='Vybrat další hru';
    document.querySelector('#winPrimaryBtn').onclick=()=>{document.querySelector('#winModal').classList.add('hidden');nav('daily');};
    document.querySelector('#winModal').classList.remove('hidden');
    window.PropletTeamVictories.resultConfirmed({mode:'daily',puzzleId:'qa-only',completedAt:new Date().toISOString()},{awardedPoints:200},getProfile());
  }
  function ready(){
    const bar=document.createElement('aside');bar.style.cssText='position:fixed;z-index:90;bottom:77px;right:8px;padding:7px;background:var(--td-paper,#fff8e9);color:var(--td-ink,#222);border:1px solid #999;border-radius:9px;font:12px system-ui;display:flex;gap:7px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 16px)';
    bar.innerHTML='<b>SIMULACE / QA</b><a href="?state=intro">CTA</a><a href="?state=victory">Výhra</a><a href="?state=cabinet">Vitrína</a><a href="?state=cabinet&gold=50">50 zlat</a><button id="qaTheme">Téma</button><a href="?state=victory&motion=reduce">Bez pohybu</a>';
    document.body.append(bar);bar.querySelector('#qaTheme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';};
    const note=document.createElement('p');note.style.cssText='font:13px system-ui;color:var(--td-muted);margin:0 0 12px';note.textContent='Simulace · 5. 10. 2026 · žádná skutečná XP ani účty';document.querySelector('.app-header').after(note);
    if(q.get('state')==='intro')setTimeout(result,1300);
    if(q.get('state')==='cabinet')setTimeout(()=>PropletTeamVictories.openCabinet(),1300);
  }
  document.addEventListener('proplet:ready',ready,{once:true});
})();
