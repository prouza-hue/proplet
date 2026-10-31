/* Isolated scenario controls; the player flow lives in app/patrons.js. */
(()=>{'use strict';
 if(!window.PROPLET_PATRON_PREVIEW)throw Error('Preview isolation required');
 const $=s=>document.querySelector(s),ui=()=>window.PropletPatrons;
 function ensureReview(){
  if(!$('#patronReview')){const el=document.createElement('dialog');el.id='patronReview';el.setAttribute('aria-label','Ovládání izolovaného náhledu');document.body.append(el);}
  if(!$('#patronReviewToggle')){const b=document.createElement('button');b.type='button';b.id='patronReviewToggle';b.textContent='Náhled patronství';b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:10000;padding:8px 12px;border-radius:10px;background:var(--paper,#fdfbf7);color:var(--ink,#29241f);border:1px solid currentColor;font:inherit';b.onclick=review;document.body.append(b);}
 }
 function warnPreview(){
  const d=$('#patronDialog');if(!d||!d.open||d.querySelector('.patron-test-note'))return;
  const p=document.createElement('aside');p.className='patron-test-note';p.setAttribute('role','note');
  p.style.cssText='padding:8px 10px;margin:0 0 12px;border-left:3px solid #b47829;background:#b4782915;font-size:12px';
  const text=document.createElement('span');text.textContent='TESTOVACÍ NÁHLED — platbu neodesílej. Reference a potvrzení jsou modelové.';
  const b=document.createElement('button');b.type='button';b.className='text-btn';b.textContent='Náhled patronství';b.style.cssText='display:block;padding:4px 0;font-size:12px';b.onclick=review;
  p.append(text,b);const intro=d.querySelector('.patron-intro');if(intro)intro.after(p);else d.prepend(p);
 }

 async function scene(value){await ui().refresh();ui().close?.();window.PropletArchiveExperience?.closeModal();document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));if(value==='today')nav('daily');else if(value==='profile')nav('profile');else if(value==='ranking'){nav('leaderboard');rankingsOrchestration().openView('xp');}else if(value==='result'){nav('daily');const date=pragueDateISO(),p=dailyPuzzleFor(date);await showDailyResult(date,{puzzleId:p.id,mode:'daily',dailyDate:date,elapsedMs:84000,moves:8,hintsUsed:0,cleanSolve:true,points:100,timingVerified:true,completedAt:new Date().toISOString()});ui().resultCompleted();}else if(value==='qr'){ui().open('offer');document.querySelector('#patronForm').requestSubmit();}else ui().open(value);}
 function review(){ensureReview();const el=$('#patronReview');el.innerHTML='<button class="patron-close" aria-label="Zavřít ovládání náhledu">×</button><h2>Náhled patronství</h2><p>Modeloví hráči a ukázkové převody. Platby v tomto náhledu neodesílej.</p><div class="patron-review-grid">'+[['today','Dnes'],['profile','Profil'],['result','Po dohrání'],['ranking','Pořadí'],['offer','Nabídka podpory'],['qr','Ukázkové QR']].map(([s,t])=>`<button class="secondary-btn" data-scene="${s}">${t}</button>`).join('')+'</div><div class="patron-review-states"><a class="secondary-btn" href="/patron-admin-preview.html?state='+encodeURIComponent(window.PropletStudioFixture.fixtureState)+'" target="_blank" rel="noopener">Otevřít modelovou administraci</a><button class="text-btn" data-reset>Vrátit stav bez podpory</button><button class="text-btn" data-later>Posunout modelový čas o 31 dní</button><button class="text-btn" data-first-visit>První návštěva nového rozhraní</button><button class="text-btn" data-news>Novinky právě zobrazené</button><button class="text-btn" data-48h>Posunout o 48 hodin</button><button class="text-btn" data-board>Přidat dohranou desku</button><p data-policy-status></p><button class="text-btn" data-theme>Přepnout světlý / tmavý</button></div>';el.querySelector('.patron-close').onclick=()=>el.close();el.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{el.close();scene(b.dataset.scene)});el.querySelector('[data-reset]').onclick=async()=>{window.PropletPatronApi.reset();sessionStorage.removeItem('proplet:announcements:session:v1');await ui().refresh();el.close();ui().close();};el.querySelector('[data-later]').onclick=async()=>{window.PropletPatronApi.advance(31);sessionStorage.removeItem('proplet:announcements:session:v1');await ui().refresh();el.close();};el.querySelector('[data-first-visit]').onclick=async()=>{window.PropletPatronApi.scenario('first_visit');await ui().refresh();reviewPolicy()};el.querySelector('[data-news]').onclick=async()=>{window.PropletPatronApi.newsReceipt();await ui().refresh();reviewPolicy()};el.querySelector('[data-48h]').onclick=async()=>{window.PropletPatronApi.advance(2);await ui().refresh();reviewPolicy()};el.querySelector('[data-board]').onclick=async()=>{window.PropletPatronApi.completeBoard();await ui().refresh();reviewPolicy()};const reviewPolicy=async()=>{const state=await window.PropletPatronApi.request('/api/patrons');const reasons={patron:'Účet už podporuje Proplet.',disabled:'Automatické nabídky jsou vypnuté.',release_wait:'Čekáme 48 hodin od '+(state.offerAnchorSource==='release_news'?'zobrazení novinek.':'první návštěvy nového rozhraní.'),post_news_boards:'Po novinkách je potřeba dohrát dvě nové běžné desky.',playing_history:'Je potřeba alespoň pět desek ve třech aktivních dnech.',offer_limit:'Dvě nabídky za 90 dní už byly zobrazené.',cooldown:'Od poslední nabídky musí uplynout 30 dní.',authentication:'Modelový účet není přihlášený.'};el.querySelector('[data-policy-status]').textContent=(state.canOffer?'Automatická nabídka je dostupná.':reasons[state.offerWaitReason]||'Nabídka zatím čeká.')+(state.offerAnchorSource==='release_news'?' Nové desky po novinkách: '+state.postAnchorBoards+'/2.':'')};void reviewPolicy();el.querySelector('[data-theme]').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:false});if(!el.open)el.showModal();}
 let started=false,initialSceneShown=false;
 async function initialScene(){
  // The native app may dispatch proplet:ready before this last script loads.
  // A populated profile card is also evidence that its first render completed.
  if(initialSceneShown||!ui()||!$('#profileCard')?.childElementCount)return;
  initialSceneShown=true;const value=new URLSearchParams(location.search).get('view');
  if(value)await scene(value);
 }
 function boot(){
  if(started)return;started=true;ensureReview();
  new MutationObserver(()=>{warnPreview();void initialScene();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  warnPreview();void initialScene();
 }

 window.PropletPatronDemo={scene,review};window.PropletPatronPreview={scene,review,get model(){return ui().model},open:(...a)=>ui().open(...a)};
 document.addEventListener('proplet:ready',()=>{boot();void initialScene();},{once:true});
 if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
