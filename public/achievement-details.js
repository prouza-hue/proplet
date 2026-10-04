/* On-demand reward detail: native modal focus/inert handling, no observer or polling. */
(function(global){
 'use strict';
 const streakStories=Object.freeze({
  "První zářez": "Dnes první zářez. Zítra bude na co navázat.",
  "Srdcař": "Třetí den. Tady už to nebude jen ze zvědavosti.",
  "Pětka": "Pět dní v řadě. Tahle pětka se doma ukazuje.",
  "Týden v plamenech": "Celý týden. Ani jeden den nevyhasl.",
  "Desítka": "Deset dní, deset návratů. Už znáš cestu.",
  "Půlměsíc": "Dva týdny po chvilkách. Pěkný kus času pro sebe.",
  "Mistr slov": "Tři týdny schůzek s písmeny. Už si tykáte.",
  "Koruna": "Každý den kousek. Až z toho byla koruna.",
  "Diamant": "Padesát dní. Tenhle kousek má vybroušenou každou hranu.",
  "Legenda": "Sto dní v řadě. Tohle se jedním šťastným tahem neuhraje."
});
 let dialog,opener,previousOverflow='';
 function restore(){if(!opener)return;document.body.style.overflow=previousOverflow;if(opener.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});opener=null;}
 function close(){if(dialog?.open){dialog.close();restore()}}
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='achievementDetail';
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');
  dialog.setAttribute('aria-describedby','achievementDetailStory achievementDetailCondition achievementDetailStatus');
  dialog.innerHTML=`<section class="achievement-detail-card">
   <button type="button" class="achievement-detail-x" data-achievement-close aria-label="Zavřít detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
   <div id="achievementDetailArt" aria-hidden="true"></div>
   <h2 id="achievementDetailTitle"></h2><p id="achievementDetailStory"></p>
   <div class="achievement-detail-progress"><p id="achievementDetailCondition"></p><progress id="achievementDetailProgress" aria-label="Postup k získání úspěchu"></progress><p id="achievementDetailStatus"></p></div>
   <button type="button" class="achievement-detail-done" data-achievement-close>Zavřít detail</button>
  </section>`;
  document.body.append(dialog);
  dialog.querySelectorAll('[data-achievement-close]').forEach(b=>b.addEventListener('click',close));
  // Require both ends of a tap on the backdrop, so a drag out of the card does not dismiss it.
  let backdropDown=false;
  dialog.addEventListener('pointerdown',e=>{backdropDown=e.target===dialog});
  dialog.addEventListener('click',e=>{if(backdropDown&&e.target===dialog)close();backdropDown=false});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  dialog.addEventListener('close',()=>{if(!dialog.open)restore()});
 }
 function open(id,source){
  const achievement=ACHIEVEMENTS.find(a=>a.id===id);if(!achievement)return;
  mount();dialog.dataset.loyalty='false';
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');dialog.removeAttribute('aria-label');
  dialog.setAttribute('aria-describedby','achievementDetailStory achievementDetailCondition achievementDetailStatus');
  // One stats snapshot per explicit open, never per icon or scroll event.
  const stats=effectiveStats(),value=Math.max(0,Number(achievement.value(stats))||0),earned=achievement.test(stats);
  dialog.querySelector('#achievementDetailTitle').textContent=achievement.name;
  dialog.querySelector('#achievementDetailStory').textContent=global.PropletAchievementStories[id];
  dialog.querySelector('#achievementDetailCondition').textContent=achievement.desc;
  const progress=dialog.querySelector('progress');progress.max=achievement.target;progress.value=Math.min(value,achievement.target);progress.hidden=achievement.group==='speed';
  const count=new Intl.NumberFormat('cs-CZ');
  dialog.querySelector('#achievementDetailStatus').textContent=earned?'Získáno':achievement.group==='speed'?'Zatím nezískáno':`${count.format(Math.min(value,achievement.target))} / ${count.format(achievement.target)} · Zatím nezískáno`;
  dialog.dataset.earned=String(earned);dialog.dataset.achievementId=id;
  // Detail deliberately reveals the full-colour drawing even for a locked achievement.
  const art=global.PropletRibbonArt?.art(achievement.name,{category:'achievement',size:192});
  const slot=dialog.querySelector('#achievementDetailArt');slot.replaceChildren();
  if(art){art.removeAttribute('role');art.removeAttribute('aria-label');const img=art.querySelector('img');if(img){img.loading='eager';img.decoding='async'}slot.append(art)}else slot.textContent=achievement.icon;
  if(!dialog.open){opener=source||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal()}
  dialog.scrollTop=0;dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
 }

 function openStreak(name,source){
  const art=global.PropletRibbonArt?.art(name,{category:'streak',size:240});if(!art)return;
  mount();dialog.dataset.loyalty='true';delete dialog.dataset.achievementId;delete dialog.dataset.earned;
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');dialog.removeAttribute('aria-label');
  dialog.setAttribute('aria-describedby','achievementDetailStory');
  dialog.querySelector('#achievementDetailTitle').textContent=name;
  dialog.querySelector('#achievementDetailStory').textContent=streakStories[name]||'';
  art.removeAttribute('role');art.removeAttribute('aria-label');
  const img=art.querySelector('img');if(img){img.loading='eager';img.decoding='async'}
  dialog.querySelector('#achievementDetailArt').replaceChildren(art);
  if(!dialog.open){opener=source||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal()}
  dialog.scrollTop=0;dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
 }
 function activate(trigger){
  if(trigger.hasAttribute('data-streak-detail'))openStreak(trigger.dataset.streakDetail,trigger);
  else open(trigger.dataset.achievementDetail,trigger);
 }
 document.addEventListener('click',event=>{const trigger=event.target.closest('[data-achievement-detail],[data-streak-detail]');if(trigger)activate(trigger)});
 document.addEventListener('keydown',event=>{
  if(dialog?.open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
  if(dialog?.open&&event.key==='Tab'){
   const buttons=dialog.querySelectorAll('button'),first=buttons[0],last=buttons[buttons.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   return;
  }
  const trigger=event.target.closest('[data-achievement-detail],[data-streak-detail]');if(trigger&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!event.repeat)activate(trigger)}
 },true);
 document.addEventListener('proplet:account-changed',close);
 document.addEventListener('proplet:screen-changed',close);
 global.PropletAchievementDetails=Object.freeze({open,openStreak,close});
})(window);
