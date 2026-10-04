
(function(){
'use strict';
const $=id=>document.getElementById(id), query=new URLSearchParams(location.search);
const diffs=[
 {key:'easy',label:'Snadná',xp:15,color:'#238c7b',image:'easy.webp',done:212,total:300},
 {key:'medium',label:'Střední',xp:25,color:'#204fab',image:'medium.webp',done:157,total:300},
 {key:'hard',label:'Těžká',xp:50,color:'#bf4a31',image:'hard.webp',done:49,total:300},
 {key:'hardcore',label:'Mozkožrout',xp:100,color:'#854b90',image:'hardcore.webp',done:32,total:200},
 {key:'mozkomor',label:'Mozkomor',xp:150,color:'#57745b',image:'mozkomor.webp',done:15,total:200},
 {key:'mozkokalypsa',label:'Mozkokalypsa',xp:200,color:'#9b762d',image:'mozkokalypsa-series-ochre.svg',done:4,total:100}
];
const themes={
 november:{month:'listopad',genitive:'listopadu',adjective:'Listopadová',plural:'Listopadové',cap:'Listopad',date:'1.–30. listopadu 2026',main:'#72546f',bg:'#f0e6ea',ink:'#473343',border:'#c8b4c0',motif:'leaf'},
 january:{month:'leden',genitive:'ledna',adjective:'Lednová',plural:'Lednové',cap:'Leden',date:'1.–31. ledna 2027',main:'#4d6f92',bg:'#e3ecf2',ink:'#294866',border:'#b4c9d8',motif:'snow'},
 may:{month:'květen',genitive:'května',adjective:'Květnová',plural:'Květnové',cap:'Květen',date:'1.–31. května 2027',main:'#a9607b',bg:'#f5e4e9',ink:'#6b3a51',border:'#dcb9c6',motif:'flower'}
};
const dark=query.get('theme')==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
let theme=themes.november, tone='november', screen='daily', archiveDiff='hardcore', filter='all', page=1, competitionName=false, selectedBoard=0;
const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-'+name+'"/></svg>';
function medal(rank){
 const gold=rank===1,silver=rank===2,main=gold?'#c49a38':silver?'#82988e':'#b2825e',light=gold?'#f4d87c':silver?'#d0ded6':'#e8bea0',dark=gold?'#8b6823':silver?'#557266':'#895e41';
 const year=tone==='november'?'2026':'2027';
 let motif='';
 if(theme.motif==='snow') motif='<g stroke="'+theme.main+'" fill="none" stroke-width="1.6" stroke-linecap="round"><path d="M60 28v34M45.3 36.5l29.4 17M45.3 53.5l29.4-17m-18.2-5 3.5 3.5 3.5-3.5m-7 27 3.5-3.5 3.5 3.5m-16-19.5 4.8-.6-1.7-4.5m19.8 21.2-4.8.6 1.7 4.5m-20.2-6.2 1.7-4.5-4.8-.6m25-7-1.7 4.5 4.8.6"/></g>';
 else if(theme.motif==='flower') motif='<g fill="'+theme.bg+'" stroke="'+theme.main+'" stroke-width="1.4"><path d="M60 45C40 25 62 18 64 37c16-14 25 3 6 11 18 7 5 24-7 9-2 19-21 11-12-5-19-3-13-22 4-13Z"/><circle cx="60" cy="47" r="6" fill="'+light+'"/></g>';
 else motif='<g stroke="'+theme.main+'" fill="'+theme.bg+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m60 28 6 9 8-1-1 10 7 6-14 7-6 10-6-10-14-7 7-6-1-10 8 1 6-9Z"/><path d="M60 40v23m-11-17 11 9 11-9"/></g>';
 let leaves='';
 for(let i=0;i<5;i++){
 const y=63+i*6,x=32-i*2;leaves+='<ellipse cx="'+x+'" cy="'+y+'" rx="3.7" ry="7" transform="rotate(-44 '+x+' '+y+')" fill="'+main+'"/><ellipse cx="'+(120-x)+'" cy="'+y+'" rx="3.7" ry="7" transform="rotate(44 '+(120-x)+' '+y+')" fill="'+main+'"/>';
 }
 return '<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="m42 86-8 43 20-10 8 14 8-42Z" fill="'+theme.main+'" stroke="'+theme.ink+'" stroke-width="1.7"/><path d="m71 88 16 41-20-7-9 14-2-45Z" fill="'+theme.bg+'" stroke="'+theme.main+'" stroke-width="1.7"/><path d="M59 14c7 0 12 5 18 6s13 2 16 8 3 12 7 17 6 11 3 17-8 10-10 16-6 11-12 12-12 2-17 6-13 5-18 1-11-4-17-7-8-9-9-15-5-12-6-18 3-13 7-17 4-12 8-16 11-5 17-6 6-4 13-4Z" fill="'+light+'" stroke="'+dark+'" stroke-width="2.2"/><circle cx="60" cy="55" r="34" fill="#fff8e8" stroke="'+main+'" stroke-width="1.4"/><circle cx="60" cy="55" r="30" fill="none" stroke="'+main+'" stroke-width=".8" stroke-dasharray="1 4"/>'+motif+'<g fill="none" stroke="'+main+'" stroke-width="1.3" stroke-linecap="round"><path d="M32 63c-9 22 7 34 25 32m31-32c9 22-7 34-25 32"/></g>'+leaves+'<path d="m50 85 10-3 10 3-2 11-8 5-8-5Z" fill="'+main+'" stroke="'+dark+'" stroke-width="1.2"/><text x="60" y="95" text-anchor="middle" fill="#fff9e7" font-family="Fraunces,Georgia,serif" font-size="12" font-weight="700">'+rank+'</text><path d="M46 106h28" stroke="'+theme.ink+'" stroke-width="1" opacity=".5"/><text x="60" y="117" text-anchor="middle" fill="'+theme.ink+'" font-family="Outfit,sans-serif" font-size="8" font-weight="600">'+year+'</text></svg>';
}
function applyTone(next){
 tone=themes[next]?next:'november';theme=themes[tone];$('tone').value=tone;
 const darkTone={november:['#c99ebd','#443446','#f0dce9','#72566e'],january:['#94b8d6','#2c4153','#daebf8','#526d83'],may:['#db9bb3','#4a3440','#fbe0e9','#7d5668']}[tone];const colors=dark?darkTone:[theme.main,theme.bg,theme.ink,theme.border];const style=document.documentElement.style;['--month','--month-bg','--month-ink','--month-border'].forEach((key,i)=>style.setProperty(key,colors[i]));
 document.querySelectorAll('[data-demo-month-label]').forEach(n=>n.textContent='Modelový '+theme.month+' '+(tone==='november'?'2026':'2027')+'. Všechna jména, výsledky a stavy desek jsou smyšlené.');
 document.querySelector('.daily-date').textContent=tone==='january'?'Pátek 15. ledna · Střední':tone==='may'?'Sobota 15. května · Těžká':'Neděle 15. listopadu · Těžká';
 document.querySelectorAll('.week span').forEach((n,i)=>n.classList.toggle('current',i===(tone==='january'?4:tone==='may'?5:6)));
 document.querySelector('.month-top p').innerHTML='Do konce měsíce zbývá '+(tone==='november'?15:16)+' dní.<br>Na stupně vítězů ti chybí 120 bodů.';
 document.querySelectorAll('[data-month-title]').forEach(n=>n.textContent=theme.cap+' je rozehraný.');
 document.querySelectorAll('[data-month-accusative]').forEach(n=>n.textContent=theme.month);
 document.querySelectorAll('[data-season-heading]').forEach(n=>n.textContent=theme.adjective+' soutěž');
 document.querySelectorAll('[data-prizes-heading]').forEach(n=>n.textContent=theme.plural+' odznaky');
 document.querySelectorAll('[data-season-date]').forEach(n=>n.innerHTML=theme.date+'<br>Nový měsíc, nové pořadí.');
 document.querySelectorAll('[data-medal]').forEach(n=>n.innerHTML=medal(Number(n.dataset.medal)));
 document.querySelectorAll('[data-podium]').forEach(n=>n.innerHTML=[1,2,3].map(rank=>'<div class="podium-card '+(rank===2?'silver':rank===3?'bronze':'')+'">'+medal(rank)+'<strong>'+(rank===1?'Vládce':rank===2?'Stříbro':'Bronz')+'<br>'+theme.genitive+'</strong><small>'+(tone==='november'?'2026':'2027')+' · '+rank+'. místo</small></div>').join(''));
}
function nav(next){
 next=({today:'daily',play:'free'})[next]||next;screen=['daily','free','archive','season','profile'].includes(next)?next:'daily';
 document.querySelectorAll('.view').forEach(n=>n.hidden=n.id!=='view-'+screen);
 document.querySelectorAll('#bottomNav button').forEach(n=>n.classList.toggle('active',n.dataset.nav===(screen==='archive'?'free':screen)));
 document.querySelectorAll('[data-demo-nav]').forEach(n=>n.classList.toggle('is-current',n.dataset.demoNav===screen));
 window.scrollTo({top:0,behavior:'instant'});
}
function setName(value){
 competitionName=value;document.querySelectorAll('[data-nav-label]').forEach(n=>n.textContent=value?'Soutěže':'Dnes');$('navVariant').textContent='Název: '+(value?'Soutěže':'Dnes');$('navVariant').setAttribute('aria-pressed',String(value));
 document.querySelector('.brand').setAttribute('aria-label','Proplet – '+(value?'Soutěže':'Dnes'));
}
function info(title,copy){$('infoTitle').textContent=title;$('infoContent').innerHTML=copy;$('infoDialog').showModal();}
function xpStatus(n){
 // Explicitly synthetic account status for design review.
 const alreadyPaid=archiveDiff==='hardcore'?n<=86:n%5!==0;
 const played=alreadyPaid&&(n%6===0||n%11===0);
 return {alreadyPaid,played};
}
function renderBoards(){
 const diff=diffs.find(x=>x.key===archiveDiff),search=$('boardSearch').value.trim();
 let candidates=Array.from({length:200},(_,i)=>i+1);
 candidates=candidates.filter(n=>{const s=xpStatus(n);return(filter!=='earn'||!s.alreadyPaid)&&(filter!=='unplayed'||!s.played)&&(!search||String(n).includes(search));});
 const shown=candidates.slice(0,page*40),remaining=200-Array.from({length:200},(_,i)=>xpStatus(i+1)).filter(s=>s.alreadyPaid).length;
 $('archiveCount').textContent='200 desek · '+remaining+' odměn zbývá';
 $('archivePageLabel').textContent=search||filter!=='all'?candidates.length+' odpovídajících desek':'Zobrazeno 1–'+shown.length;
 $('boardGrid').innerHTML=shown.map(n=>{
 const s=xpStatus(n);
 return '<button type="button" class="board '+(!s.alreadyPaid?'to-earn ':'')+(s.played?'is-played':'')+'" data-testid="archive-level-'+n+'" data-board="'+n+'" aria-label="'+diff.label+', deska '+n+', '+(s.played?'hraná':'nehraná')+', '+(s.alreadyPaid?'historická XP už získána':'odměna '+diff.xp+' XP')+'"><strong>'+n+'</strong><span>'+(s.played?'Hraná':'Nehraná')+'</span><span>'+(s.alreadyPaid?'XP už získány':'+'+diff.xp+' XP')+'</span></button>';
 }).join('');
 $('moreBoards').hidden=shown.length>=candidates.length;
}
function selectDifficulty(key){
 archiveDiff=diffs.slice(0,4).some(d=>d.key===key)?key:'hardcore';page=1;$('boardSearch').value='';
 document.querySelectorAll('[data-archive-diff]').forEach(n=>{const yes=n.dataset.archiveDiff===archiveDiff;n.classList.toggle('active',yes);n.setAttribute('aria-selected',String(yes));});
 renderBoards();
}
function selectBoard(n){
 selectedBoard=n;const d=diffs.find(x=>x.key===archiveDiff),s=xpStatus(n);
 $('boardDialogTitle').textContent=d.label+' · deska '+n;
 $('boardDialogDescription').textContent='Původní archivní vydání Propletu. '+(s.played?'Tu už máš zahranou. Můžeš si ji zopakovat.':'Tuhle konkrétní desku jsi ještě nehrál.');
 $('boardStatus').innerHTML='<span class="chip">'+(s.played?'Hraná':'Nehraná')+'</span><span class="chip '+(!s.alreadyPaid?'green':'')+'">'+(s.alreadyPaid?'Historická XP už získána':'Odměna +'+d.xp+' XP')+'</span>';
 $('playArchiveBoard').innerHTML=(s.played?'Zahrát znovu':'Hrát tuhle desku')+' '+icon('arrow');
 $('boardDialog').showModal();
}
$('diffGrid').innerHTML=diffs.map(d=>'<article class="diff-card" style="--d:'+d.color+'"><div class="diff-top"><img src="../difficulty/printshop/'+d.image+'" width="54" height="54" alt=""><div><h2>'+d.label+'</h2><p>+'+d.xp+' XP · '+d.done+'/'+d.total+' hotovo</p></div></div><div class="progress"><span style="width:'+Math.round(d.done/d.total*100)+'%"></span></div><button class="btn" type="button" data-free-demo="'+d.key+'">Hrát '+icon('arrow')+'</button></article>').join('');
$('archiveDifficulty').innerHTML=diffs.slice(0,4).map(d=>'<button type="button" role="tab" aria-selected="'+String(d.key===archiveDiff)+'" class="'+(d.key===archiveDiff?'active':'')+'" data-archive-diff="'+d.key+'"><img src="../difficulty/printshop/'+d.image+'" width="24" height="24" alt="">'+d.label+'</button>').join('');
const ranking=[{p:1,n:'Slovomilka',a:'SM',points:1660,time:'12:43'},{p:2,n:'Káva a slova',a:'KS',points:1580,time:'13:08'},{p:3,n:'Tichý lovec',a:'TL',points:1480,time:'13:52'},{p:4,n:'Papírový drak',a:'PD',points:1440,time:'14:21'},{p:7,n:'Klára',a:'KL',points:1380,time:'14:39'},{p:8,n:'Nora',a:'NP',points:1360,time:'15:07'}];
$('monthRanking').innerHTML=ranking.map(r=>'<div class="month-row '+(r.p===8?'is-you':'')+'"><strong>'+r.p+'.</strong><span class="avatar">'+r.a+'</span><span><b>'+r.n+(r.p===8?' · ty':'')+'</b><small>'+r.time+' · součet započtených časů</small></span><span class="points">'+r.points.toLocaleString('cs-CZ')+'<small>bodů</small></span></div>').join('');
document.addEventListener('click',function(e){
 const navButton=e.target.closest('[data-nav]');if(navButton){nav(navButton.dataset.nav);return;}
 const demoButton=e.target.closest('[data-demo-nav]');if(demoButton){nav(demoButton.dataset.demoNav);return;}
 if(e.target.closest('[data-open-season]')){$('seasonDialog').showModal();return;}
 const closeButton=e.target.closest('[data-close-dialog]');if(closeButton){closeButton.closest('dialog').close();return;}
 const diffButton=e.target.closest('[data-archive-diff]');if(diffButton){selectDifficulty(diffButton.dataset.archiveDiff);return;}
 const filterButton=e.target.closest('[data-filter]');if(filterButton){
  filter=filterButton.dataset.filter;page=1;document.querySelectorAll('[data-filter]').forEach(n=>{const selected=n===filterButton;n.classList.toggle('active',selected);n.setAttribute('aria-pressed',String(selected));});renderBoards();return;
 }
 const boardButton=e.target.closest('[data-board]');if(boardButton){selectBoard(Number(boardButton.dataset.board));return;}
 if(e.target.closest('[data-open-archive-rules]')){info('Jak fungují historická XP?','<p>Každá původní úroveň má jednu historickou odměnu. Staré podoby stejné úrovně ji sdílejí: v Archivu ji získáš jednou.</p><p>Například starý Mozkožrout 88 může stále nabídnout +100 XP, i když už máš hotovou současnou úroveň 88. Zároveň se nic nepřičte podruhé, pokud jsi odměnu za starou úroveň 88 získal v některém dřívějším vydání.</p><p>Stav „Nehraná“ se vztahuje k této konkrétní desce. Může proto stát vedle „XP už získány“.</p>');return;}
 if(e.target.closest('[data-demo-daily]')){info('Tady začíná Denní výzva.','<p>V nasazené hře by tlačítko otevřelo dnešní oficiální desku. Měsíční soutěž by se počítala automaticky z tohoto pokusu.</p><p>Tento návrh žádnou hru nespouští a neodesílá výsledky.</p>');return;}
 if(e.target.closest('[data-demo-tajenka]')){info('Tajenka zůstává na očích.','<p>Tahle karta otevírá aktuální Tajenku. Na přehledu zabírá jedno čitelné místo a po dohrání ukáže hotový stav.</p>');return;}
 if(e.target.closest('[data-demo-team]')){info('Týdenní soutěž týmu','<p>Karta otevírá současné týmové pořadí a jeho pravidla. Měsíční soutěž jednotlivců má vlastní body i vlastní odznaky.</p>');return;}
 const free=e.target.closest('[data-free-demo]');if(free){const d=diffs.find(x=>x.key===free.dataset.freeDemo);info(d.label,'<p>Tady pokračuje současná volná hra podle uloženého postupu. Archiv nabízí samostatný výběr libovolné starší desky.</p>');return;}
});
$('moreBoards').addEventListener('click',()=>{page++;renderBoards();});
$('boardSearch').addEventListener('input',()=>{page=1;renderBoards();});
$('tone').addEventListener('change',()=>applyTone($('tone').value));
$('navVariant').addEventListener('click',()=>setName(!competitionName));
$('seasonPrimary').addEventListener('click',()=>{$('seasonDialog').close();nav('daily');$('view-daily').querySelector('[data-demo-daily]').focus();});
$('playArchiveBoard').addEventListener('click',()=>{$('boardDialog').close();info('Deska '+selectedBoard+' je vybraná.','<p>Tohle potvrzuje přímý výběr archivní desky. V nasazené hře se otevře její mřížka, bez podmínky dohrát předchozí čísla.</p>');});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const box=d.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)d.close();}}));
applyTone(query.get('tone'));setName(['competition','souteze'].includes(query.get('navLabel')||query.get('nav')));selectDifficulty(query.get('difficulty'));nav(query.get('view'));
if(['announcement','modal'].includes(query.get('view'))||query.get('modal')==='season')$('seasonDialog').showModal();
if(query.get('modal')==='rules'){$('seasonDetails').open=true;$('seasonDialog').showModal();}
if(query.get('modal')==='board')selectBoard(Number(query.get('board'))||88);
document.documentElement.dataset.previewReady='true';
window.PropletArchiveSeasonPreview=Object.freeze({nav,applyTone,selectDifficulty,selectBoard,openSeason:()=>$('seasonDialog').showModal()});
})();
