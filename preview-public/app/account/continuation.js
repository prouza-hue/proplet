/* Infinite continuation of the existing rank. Read-only derivation from confirmed account XP. */
(()=>{
'use strict';
const START=120000,STEP=5000,FIRST=150000,GAP=50000,fmt=n=>n.toLocaleString('cs-CZ'),q=s=>document.querySelector(s);
const ART={150000:['xp-compass','Vlastní směr','Tolik cest už znáš. A pořád tě láká ta další.'],200000:['xp-astrolabe','Mezi hvězdami','Kdysi pár písmen. Dneska už celé souhvězdí.'],250000:['xp-lighthouse','Světlo v dálce','Čtvrt milionu. Na takovou cestu už je vidět z dálky.']};
function state(points){const p=Math.max(0,Math.floor(Number(points)||0)),chapter=p>=START?Math.floor((p-START)/STEP)+1:null;return {points:p,chapter,start:chapter?START+(chapter-1)*STEP:null,next:chapter?START+chapter*STEP:START,count:p<FIRST?0:Math.floor((p-FIRST)/GAP)+1};}
function milestone(target){return {target,...Object.fromEntries(['asset','title','copy'].map((k,i)=>[k,(ART[target]||['xp-gateway','Další obzor','Tohle není poslední brána. Jen další, kterou jsi otevřel.'])[i]]))};}
function book(n){return `<div class="pc-book"><img src="/rewards/continuation/chapter-chronicle.webp" alt=""><span class="pc-seal">${fmt(n)}</span></div>`;}
function image(a){return `<img src="/rewards/continuation/${a.asset}.webp" alt="" loading="lazy" width="160" height="160">`;}
function tiles(s,first,count=3){return `<div class="pc-milestones">${Array.from({length:count},(_,i)=>milestone(FIRST+(first+i)*GAP)).map(a=>`<button type="button" class="pc-milestone ${s.points>=a.target?'earned':''}" data-pc-milestone="${a.target}" aria-label="${fmt(a.target)} XP, ${a.title}, ${s.points>=a.target?'splněno':'zatím nezískáno'}">${image(a)}<strong>${fmt(a.target)} XP</strong><span>${a.title}</span><small>${s.points>=a.target?'Splněno ✓':'Chybí '+fmt(a.target-s.points)+' XP'}</small></button>`).join('')}</div>`;}
let scope=null,snapshot=state(0),dialog,opener,collectionPage=0;
function close(){if(dialog?.open)dialog.close();}
function open(kind,target,from){
 if(!scope)return;opener=from||document.activeElement;
 if(!dialog){dialog=document.createElement('dialog');dialog.className='pc-dialog';dialog.id='continuationDetail';dialog.setAttribute('aria-labelledby','pcDetailTitle');document.body.append(dialog);dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;});dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close();}});}
 const s=snapshot;let html='';
 if(kind==='milestone'){const a=milestone(target);html=`${image(a)}<h2 id="pcDetailTitle">${a.title}</h2><p>${a.copy}</p><strong class="pc-status">${fmt(a.target)} XP · ${s.points>=a.target?'Patří do tvé sbírky.':'Zbývá '+fmt(a.target-s.points)+' XP.'}</strong><p class="pc-note">Počítají se celoživotní XP. Úspěch další XP nepřidává.</p>`;}
 else if(kind==='collection'){const total=s.count+2,pages=Math.ceil(total/12);collectionPage=Math.max(0,Math.min(collectionPage,pages-1));html=`<h2 id="pcDetailTitle">Další obzory</h2><p>${fmt(s.count)} získaných XP úspěchů. Cesta pokračuje.</p>${tiles(s,collectionPage*12,Math.min(12,total-collectionPage*12))}<div class="pc-pages"><button type="button" data-pc-page="-1" ${collectionPage?'':'disabled'} aria-label="Předchozí úspěchy">←</button><span>${collectionPage+1} / ${pages}</span><button type="button" data-pc-page="1" ${collectionPage+1<pages?'':'disabled'} aria-label="Další úspěchy">→</button></div>`;}
 else{html=`${book(s.chapter)}<h2 id="pcDetailTitle">Kapitola ${fmt(s.chapter)}${kind==='celebration'?' otevřena.':''}</h2><p>${kind==='celebration'?'Dalších pět tisíc. Další stránka, která patří tobě.':'Titul Legenda bez konce ti zůstává. Každých dalších 5 000 XP otevírá další kapitolu.'}</p><strong class="pc-status">${fmt(s.points)} XP · Legenda bez konce</strong><p class="pc-note">Všechny dosavadní XP se počítají. K další kapitole zbývá ${fmt(s.next-s.points)} XP.</p>`;}
 dialog.innerHTML=`<form method="dialog"><button class="pc-close" aria-label="Zavřít detail">×</button></form>${html}<form method="dialog"><button class="primary-btn pc-done">Rozumím</button></form>`;
 dialog.classList.toggle('pc-celebration',kind==='celebration');dialog.classList.toggle('pc-collection-dialog',kind==='collection');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
}
function renderProfile(profile,stats){
 let root=q('#profileContinuation');if(!root){root=document.createElement('section');root.id='profileContinuation';root.className='card pc-profile';q('#profileCard')?.after(root);}
 const id=profile?.id||null;if(scope!==id){close();scope=id;collectionPage=0;q('#continuationWin')?.remove();}
 // Same server-issued lifetime points as the account; optimistic offline results cannot unlock a chapter.
 const confirmed=profile?.stats?.points,ready=profile?.token&&Number.isFinite(Number(confirmed));
 snapshot=state(ready?confirmed:0);const s=snapshot;
 root.hidden=!ready||s.chapter===null;
 if(!q('#winModal:not(.hidden)'))q('#continuationWin')?.remove();
 if(!ready){q('.pc-future')?.remove();return;}
 let prior=null;const key='proplet:continuation-confirmed-v1:'+id;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.version===1&&Number.isFinite(saved.points))prior=state(saved.points);localStorage.setItem(key,JSON.stringify({version:1,points:s.points}));}catch{}
 if(s.chapter){const first=Math.max(1,s.chapter-1);root.innerHTML=`<div class="pc-hero">${book(s.chapter)}<h2>Legenda bez konce</h2><button type="button" class="pc-chapter" data-pc-chapter>Kapitola ${fmt(s.chapter)} <span class="pc-info" aria-hidden="true">i</span></button></div><div class="pc-trail">${[first,first+1,first+2].map(n=>`<div class="${n===s.chapter?'current':''}"><span>${fmt(n)}</span><small>${n<s.chapter?'Uzavřena':n===s.chapter?'Právě píšeš':'Příští'}</small></div>`).join('')}</div><div class="pc-progress-label"><strong>Tahle kapitola</strong><span>${fmt(s.points-s.start)} / 5 000 XP</span></div><progress max="5000" value="${s.points-s.start}" aria-label="Postup v kapitole"></progress><p class="pc-next">Kapitola ${fmt(s.chapter+1)} za ${fmt(s.next-s.points)} XP</p><div class="pc-heading"><h3>Další obzory</h3><span>${fmt(s.count)} získáno</span></div>${tiles(s,Math.max(0,s.count-1))}<button type="button" class="pc-all" data-pc-collection>Celá sbírka XP úspěchů →</button>`;}
 // Before the last rank, future milestones live in the explicitly expanded achievement list.
 q('.pc-future')?.remove();
 const grid=q('#achievementGrid');if(grid&&s.chapter===null){const section=document.createElement('section');section.className='achievement-group pc-future';section.innerHTML='<div class="pc-heading"><h3>Další obzory</h3></div>'+tiles(s,0);grid.append(section);}
 if(prior&&s.chapter&&(s.chapter>Number(prior.chapter)||s.count>prior.count)&&q('#winModal:not(.hidden)')){
  let win=q('#continuationWin');if(!win){win=document.createElement('div');win.id='continuationWin';q('#winPrimaryBtn')?.before(win);}
  win.innerHTML=`<button type="button" class="pc-win" data-pc-celebration>${book(s.chapter)}<span><strong>Kapitola ${fmt(s.chapter)} otevřena.</strong><small>${s.count>prior.count?'Nový XP úspěch patří do tvé sbírky.':'Další stránka, která patří tobě.'}</small></span></button>`;
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pc-chapter],[data-pc-milestone],[data-pc-collection],[data-pc-celebration],[data-pc-page]');if(!b)return;if(b.hasAttribute('data-pc-page')){collectionPage+=Number(b.dataset.pcPage);open('collection',null,opener);}else if(b.hasAttribute('data-pc-milestone'))open('milestone',Number(b.dataset.pcMilestone),dialog?.open?opener:b);else if(b.hasAttribute('data-pc-collection')){collectionPage=0;open('collection',null,b);}else open(b.hasAttribute('data-pc-celebration')?'celebration':'chapter',null,b);});
document.addEventListener('proplet:account-changed',()=>{scope=null;close();q('#profileContinuation')?.remove();q('#continuationWin')?.remove();});
document.addEventListener('proplet:screen-changed',()=>{close();q('#continuationWin')?.remove();});
window.PropletContinuation=Object.freeze({state,milestone,renderProfile,close});
})();
