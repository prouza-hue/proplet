/* Isolated design study. Synthetic rankings, no payment or account writes. */
(()=>{
 'use strict';
 const q=new URLSearchParams(location.search),$=s=>document.querySelector(s);
 const state={view:q.get('view')==='result'?'result':'ranking',marked:q.get('marked')!=='0',theme:q.get('theme')==='dark'?'dark':'light',long:q.get('long')==='1',period:'all'};
 const heart='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 27S3 20 3 10.5C3 3.5 12 2 16 8c4-6 13-4.5 13 2.5C29 20 16 27 16 27Z" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="m9 17 4 4 9-10" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const people=[{name:'Klára',art:'02-sova.svg',xp:18240,time:68000,support:false},{name:'Matěj',art:'01-liska.svg',xp:17680,time:71000,support:true},{name:'Eliška',art:'14-kralik.svg',xp:16950,time:78000,support:false},{name:'Pavel',art:'23-brk-a-inkoust.svg',xp:15420,time:84000,support:true,mine:true},{name:'Zvídavá vydra',art:'16-klubko.svg',xp:14860,time:92000,support:true},{name:'Ondřej',art:'12-mourek.svg',xp:13980,time:96000,support:false}];
 let lastFocus,ready=false;
 const name=p=>state.long&&p.mine?'Nejzapletenější propletač Pavel':p.name;
 const active=p=>p.support&&(!p.mine||state.marked);
 const img=p=>`<img src="/assets/avatars/v3/${p.art}" alt="" width="44" height="44">`;
 const badge=p=>active(p)?`<button class="patron-label" type="button" data-patron="${p.name}" aria-label="${p.name}: Podporovatel Propletu. Zobrazit poděkování" aria-haspopup="dialog">${heart}<span>Podporovatel</span></button>`:'';
 const avatar=p=>`<span class="patron-avatar ${active(p)?'is-patron':''}">${img(p)}${active(p)?`<span class="patron-seal" aria-hidden="true">${heart}</span>`:''}</span>`;
 const rank=n=>typeof rankBadge==='function'?rankBadge(n):n+'.';
 function row(p,i,result=false){return `<div class="${result?'mini-leader-row result-player-row':'leader-row ranking-row'} patron-row ${p.mine?'me':''} ${active(p)?'has-patron':''}" data-person="${p.name}"><b class="${result?'result-player-rank':'leader-rank'}">${rank(i+1)}</b>${avatar(p)}<span class="${result?'result-player-copy':'leader-name'} patron-copy"><strong title="${name(p)}">${name(p)}${p.mine?'<span class="patron-you">Ty</span>':''}</strong>${badge(p)}<small>${result?'Čistě · 8 tahů':p.mine?'Slovotvůrce · Kupkovi':i<3?'Mistr slov':'Slovotvůrce'}</small></span><span class="${result?'result-player-time':'leader-score'} patron-score"><strong>${result?fmtTime(p.time):new Intl.NumberFormat('cs-CZ').format(state.period==='all'?p.xp:state.period==='week'?720-i*55:180-i*15)}</strong>${result?'':'<small>XP</small>'}</span></div>`}
 function url(){const p=new URLSearchParams({view:state.view,marked:state.marked?'1':'0',theme:state.theme});if(state.long)p.set('long','1');history.replaceState(null,'',location.pathname+'?'+p)}
 function controls(){
  let bar=$('#patronReview');if(!bar){bar=document.createElement('div');bar.id='patronReview';document.body.prepend(bar)}
  bar.innerHTML=`<div class="patron-review-main"><span>Náhled · modeloví hráči</span><nav aria-label="Ukázky podporovatele"><button data-view="result" aria-pressed="${state.view==='result'}">Po dohrání</button><button data-view="ranking" aria-pressed="${state.view==='ranking'}">Celkové pořadí</button></nav><button id="patronOptions" aria-expanded="false" aria-controls="patronOptionsPanel" aria-label="Nastavení náhledu">☷</button></div><div id="patronOptionsPanel" hidden><label><input type="checkbox" id="patronMarked" ${state.marked?'checked':''}>Moje veřejná značka</label><label><input type="checkbox" id="patronLong" ${state.long?'checked':''}>Dlouhé jméno</label><button id="patronTheme">${state.theme==='light'?'Tmavý vzhled':'Světlý vzhled'}</button><a href="/patron-gallery.html">Screenshoty a návrh</a></div>`;
  bar.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
  $('#patronOptions').onclick=()=>{const panel=$('#patronOptionsPanel');panel.hidden=!panel.hidden;$('#patronOptions').setAttribute('aria-expanded',String(!panel.hidden))};
  $('#patronMarked').onchange=e=>{state.marked=e.target.checked;render();url()};
  $('#patronLong').onchange=e=>{state.long=e.target.checked;render();url()};
  $('#patronTheme').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';document.documentElement.dataset.theme=state.theme;controls();url()};
 }
 function bind(){document.querySelectorAll('[data-patron]').forEach(b=>b.onclick=()=>detail(b.dataset.patron))}
 function render(){
  document.querySelectorAll('.ranking-period-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingPeriod===state.period));
  $('#xpLeaderboardList').innerHTML=people.map((p,i)=>row(p,i)).join('');
  $('#levelLeaderboardBox').classList.remove('hidden');$('#levelLeaderboardBox').innerHTML=`<div class="free-board-tabs" role="tablist" aria-label="Pořadí úrovně"><button class="free-board-tab active" role="tab" aria-selected="true">🌍 Globálně</button><button class="free-board-tab" id="patronTeam" role="tab" aria-selected="false">👥 Můj tým</button></div><div class="daily-world-summary"><div><strong>4.</strong><span>místo</span></div><p>Patříš mezi nejlepších<br><b>12 %</b> hráčů této úrovně.</p></div><div class="daily-world-neighbours">${people.slice(2,5).map((p,i)=>row(p,i+2,true)).join('')}</div><details class="ranking-expand patron-expand"><summary>Zobrazit celé pořadí · 34 hráčů</summary><p>Ukázka prvních šesti hráčů.</p><div class="ranking-expanded-rows">${people.map((p,i)=>row(p,i,true)).join('')}</div></details>`;
  $('#patronTeam').onclick=()=>{const box=$('#levelLeaderboardBox');box.querySelector('.daily-world-neighbours').innerHTML=[people[2],people[3],people[4]].map((p,i)=>row(p,i,true)).join('');box.querySelector('.daily-world-summary').innerHTML='<div><strong>2.</strong><span>místo</span></div><p>Tvoje pořadí v týmu Kupkovi.</p>';box.querySelector('.patron-expand').hidden=true;box.querySelectorAll('[role=tab]').forEach(b=>{b.classList.toggle('active',b.id==='patronTeam');b.setAttribute('aria-selected',String(b.id==='patronTeam'))});box.querySelector('[role=tab]:first-child').onclick=render;bind()};
  bind();
 }
 function show(view){
  state.view=view;document.body.dataset.patronView=view;
  if(typeof closeTransientModals==='function')closeTransientModals();
  document.body.classList.remove('sp-open');$('.app-shell').inert=false;$('.bottom-nav')?.removeAttribute('inert');
  if(view==='ranking'){
   if(typeof nav==='function')nav('leaderboard');
   $('#winModal').classList.add('hidden');
  }else{
   if(typeof nav==='function')nav('daily');
   const w=$('#winModal');w.classList.remove('hidden','starter-win');w.setAttribute('aria-label','Ukázkový výsledek úrovně');
   $('#winBadge').innerHTML='<img src="/difficulty/printshop/easy.webp" width="62" height="62" alt="">';
   $('#winTitle').textContent='Hezky propleteno.';$('#winPraise').classList.add('hidden');
   $('#winText').textContent='Snadná · úroveň 6 · 1:24';$('#winXp').textContent='+15 XP';$('#winClean').textContent='Čisté řešení';$('#winClean').classList.remove('hidden');
   $('#winPrimaryBtn').textContent='Hrát další úroveň';$('#winPrimaryBtn').onclick=()=>{$('#winModal').classList.add('hidden');if(typeof nav==='function')nav('free')};
   $('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Celkové pořadí';$('#winMenuBtn').onclick=()=>show('ranking');
   ['winDetails','winFeedback','winAccountBtn','newBadgeBox','winShareBtn','winReplayBtn'].forEach(id=>$('#'+id)?.classList.add('hidden'));
  }
  // The production renderer finishes its fixture response in the next microtask.
  queueMicrotask(()=>{render();setTimeout(render,80)});controls();url();scrollTo(0,0);
 }
 function detail(who){
  const p=people.find(x=>x.name===who)||people[3];lastFocus=document.activeElement;
  const d=$('#patronDialog');d.innerHTML=`<button class="patron-close" aria-label="Zavřít poděkování">×</button><div class="patron-honour">${avatar(p)}<span class="patron-honour-seal">${heart}</span></div><h2 id="patronDialogTitle">${name(p)} drží<br>Proplet ve hře.</h2><div class="patron-dialog-label">${heart} Podporovatel Propletu</div><p>Díky takovým hráčům vznikají další slova, nové úrovně a hra zůstává pro všechny zdarma.</p><div class="patron-sample"><span>Tvoje značka může vypadat takhle</span><div>${avatar({...people[3],support:true})}<span><strong>Pavel</strong><span class="patron-sample-badge">${heart} Podporovatel</span></span></div></div><button class="primary-btn" id="patronQr">Taky chci podpořit</button><p class="patron-dialog-fine">Dobrovolně přes QR. Bez herních výhod.<br>Částka zůstává soukromá.</p><button class="patron-dismiss">Zpátky do hry</button>`;
  d.querySelector('.patron-close').onclick=close;d.querySelector('.patron-dismiss').onclick=close;
  $('#patronQr').onclick=qr;d.showModal();d.querySelector('.patron-close').focus();
 }
 function close(){const d=$('#patronDialog');d.close();lastFocus?.focus({preventScroll:true})}
 function qr(){const d=$('#patronDialog');d.innerHTML=`<button class="patron-close" aria-label="Zavřít poděkování">×</button><div class="patron-qr-heart">${heart}</div><h2 id="patronDialogTitle">Pár korun.<br>Další příběh Propletu.</h2><p>Jednorázová podpora převodem.</p><div class="patron-amounts" role="group" aria-label="Ukázková částka"><button aria-pressed="true">99 Kč</button><button aria-pressed="false">199 Kč</button><button aria-pressed="false">299 Kč</button></div><div class="patron-qr-card"><img src="/support-demo-qr.png" width="168" height="168" alt="Neplatební ukázkový QR kód"><strong id="patronQrAmount">99 Kč · ukázka</strong><span>Demo QR · nelze zaplatit</span></div><p class="patron-qr-note">Značku získáš až po potvrzení přijatého příspěvku. Její veřejné zobrazení si zvolíš sám.</p><button class="secondary-btn patron-dismiss">Zpátky do pořadí</button>`;d.querySelector('.patron-close').onclick=close;d.querySelector('.patron-dismiss').onclick=close;d.querySelectorAll('.patron-amounts button').forEach(b=>b.onclick=()=>{d.querySelectorAll('.patron-amounts button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#patronQrAmount').textContent=b.textContent+' · ukázka'});d.querySelector('.patron-close').focus()}
 function boot(){if(ready||!$('#supportEntry'))return;ready=true;
  document.documentElement.classList.add('patron-study');document.documentElement.dataset.theme=state.theme;
  $('#xpRankingTitle').textContent='Celkové pořadí';
  document.querySelectorAll('.ranking-period-tab').forEach(b=>{b.classList.toggle('active',b.dataset.rankingPeriod==='all');b.addEventListener('click',()=>{state.period=b.dataset.rankingPeriod;setTimeout(render,100)})});
  const d=document.createElement('dialog');d.id='patronDialog';d.setAttribute('aria-labelledby','patronDialogTitle');document.body.append(d);d.addEventListener('close',()=>lastFocus?.focus({preventScroll:true}));d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-nav="leaderboard"]')){e.preventDefault();e.stopImmediatePropagation();show('ranking')}},true);
  show(state.view);document.body.dataset.patronReady='true';
 }
 window.addEventListener('load',()=>{const t=setInterval(()=>{boot();if(ready)clearInterval(t)},100)});
})();
