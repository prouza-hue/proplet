/* Isolated patron design study. Every payment state is local fiction. */
(()=>{
 'use strict';
 if(!window.PROPLET_STUDIO_PREVIEW)throw Error('Patron preview requires isolated fixtures');
 const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.5 3 8.5C3 3 10 2.5 12 7c2-4.5 9-4 9 1.5C21 14.5 12 20 12 20Z" fill="currentColor"/></svg>';
 const key='patron-preview-only-v2';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
 const model={amount:99,paid:!!saved.paid,public:saved.public===true,step:'offer',returnFocus:null,selected:'99',review:false};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('cs-CZ').format(n)+' Kč';
 function persist(){localStorage.setItem(key,JSON.stringify({paid:model.paid,public:model.public}));decorate();}
 const art='<img class="patron-art" src="/assets/support/patron-letterpress-v1.webp" alt="" width="144" height="144">';
 const seal=(name='Podporovatel')=>`<button type="button" class="patron-label" aria-label="${name} Propletu — poděkování" data-patron-thanks>${heart}<span>${name}</span></button>`;
 function ensure(){
  if($('#patronDialog'))return;
  const el=document.createElement('dialog');el.id='patronDialog';el.setAttribute('aria-labelledby','patronTitle');document.body.append(el);
  el.addEventListener('click',e=>{if(e.target===el)close()});el.addEventListener('cancel',e=>{e.preventDefault();close()});
  const toggle=document.createElement('button');toggle.id='patronReviewToggle';toggle.type='button';toggle.textContent='Náhled patronství';toggle.onclick=()=>review();document.body.append(toggle);
  const reviewEl=document.createElement('dialog');reviewEl.id='patronReview';reviewEl.setAttribute('aria-label','Ovládání izolovaného náhledu');document.body.append(reviewEl);
  reviewEl.addEventListener('click',e=>{if(e.target===reviewEl)reviewEl.close()});
 }
 function close(){const el=$('#patronDialog');if(el.open)el.close();model.returnFocus?.isConnected&&model.returnFocus.focus({preventScroll:true});}
 function open(step='offer',from=document.activeElement){ensure();model.returnFocus=from;model.step=step;render();if(!$('#patronDialog').open)$('#patronDialog').showModal();$('#patronTitle')?.focus({preventScroll:true});}
 function heading(title,copy){return `<header class="patron-intro">${art}<div><h2 id="patronTitle" tabindex="-1">${title}</h2>${copy?`<p>${copy}</p>`:''}</div></header>`;}
 function render(){
  const dialog=$('#patronDialog');let content='';
  if(model.step==='offer'){
   content=heading('Držme Proplet ve hře.','Proplet tvořím já, Pavel. Tvůj příspěvek pomůže s provozem a další péčí o hru.')+
    '<p class="patron-fair">Hraní zůstává zdarma. Podpora nepřidává herní výhody.</p>'+
    '<form id="patronForm"><fieldset><legend>Kolik chceš jednorázově přispět?</legend><div class="patron-amounts">'+['99','199','custom'].map(v=>`<label class="patron-amount"><input type="radio" name="amount" value="${v}" ${model.selected===v?'checked':''}><span>${v==='custom'?'Jiná částka':money(Number(v))}</span></label>`).join('')+'</div></fieldset>'+
    `<label class="patron-custom" ${model.selected==='custom'?'':'hidden'}>Částka v Kč<input name="custom" id="patronCustom" inputmode="numeric" type="number" min="1" max="100000" step="1" value="${model.selected==='custom'?model.amount:99}"></label>`+
    '<div class="patron-keepsake patron-perk"><div class="patron-mini-person"><span class="patron-avatar-demo"><img src="/assets/avatars/v3/05-jelen.svg" width="56" height="56" alt="Ukázka tvé značky"><i>'+heart+'</i></span><span class="patron-label-static">Podporovatel</span></div><div><strong>Tvoje značka podpory</strong><p>Dobrovolně u jména, bez zveřejnění částky. Stejná pro každého, kdo přispěje.</p></div></div>'+
    `<button class="primary-btn patron-primary" type="submit">Zobrazit QR na ${money(model.amount)} <span aria-hidden="true">→</span></button><p class="patron-preview-note">Ukázka průchodu. V tomto náhledu nelze platit.</p></form>`;
  }else if(model.step==='qr'){
   content='<button class="text-btn patron-back" data-back>← Změnit částku</button>'+heading('Podpora přes QR','Jednorázově '+money(model.amount)+' bankovním převodem.')+
    '<div class="patron-qr"><img src="/patron-demo-qr.png" width="184" height="184" alt="Ukázkový QR kód. Nelze použít k platbě."><div><strong>Ukázka — nelze zaplatit</strong><p>Ostrá verze zde zobrazí platební QR a údaje účtu.</p><p class="patron-qr-hint">Na stejném telefonu si QR uložíš a načteš v bankovní aplikaci, pokud to podporuje.</p></div></div>'+
    '<div class="patron-qr-actions"><a class="secondary-btn" href="/patron-demo-qr.png" download="Proplet-UKAZKA-NEPLATIT.png">Uložit ukázkové QR</a><button class="secondary-btn" data-copy>Kopírovat ukázkové údaje</button></div><p id="patronCopyStatus" role="status" class="patron-copy-status"></p>'+
    '<div class="patron-pending"><span class="patron-pending-dot"></span><p>Příspěvek potvrdíme až po přijetí platby. Teprve potom se objeví tvoje značka podporovatele.</p></div><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else if(model.step==='thanks'){
   content=heading('Díky, že držíš Proplet ve hře.','Tvoje podpora dává další práci na Propletu smysl. Moc si jí vážím. — Pavel')+
    '<div class="patron-own-preview"><span class="patron-avatar-demo"><img src="/assets/avatars/v3/05-jelen.svg" width="56" height="56" alt="Ukázkový avatar"><i>'+heart+'</i></span><div><strong>Ukázkový hráč</strong><span class="patron-label-static">'+heart+' Podporovatel</span></div></div>'+
    `<label class="patron-visibility"><input type="checkbox" id="patronPublic" ${model.public?'checked':''}><span>Ukazovat mou značku ostatním<small>Zaplacenou částku nikdy nezobrazujeme.</small></span></label>`+
    '<button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else{
   content=heading(esc(model.personName||'Tenhle hráč')+' podporuje Proplet.','Příspěvek pomáhá s provozem a další péčí o hru. Tohle je naše poděkování.')+
    '<div class="patron-own-preview"><span class="patron-avatar-demo"><img src="'+esc(model.personArt||'/assets/avatars/v3/05-jelen.svg')+'" width="56" height="56" alt=""><i>'+heart+'</i></span><div><strong>'+esc(model.personName||'Podporovatel')+'</strong><span class="patron-label-static">'+heart+' Podporovatel</span></div></div><p class="patron-fair">Stejná značka pro každou částku. Herní výhody si za ni nekoupíš.</p>'+
    '<button class="primary-btn patron-primary" data-support>Chci také podpořit Proplet <span aria-hidden="true">→</span></button><button class="text-btn patron-dismiss" data-close>Zpátky do hry</button>';
  }
  dialog.innerHTML='<button class="patron-close" aria-label="Zavřít podporu">×</button>'+content;
  dialog.querySelector('.patron-close').onclick=close;dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  dialog.querySelector('[data-back]')?.addEventListener('click',()=>{model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true})});dialog.querySelector('[data-support]')?.addEventListener('click',()=>{model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true})});
  const form=$('#patronForm');if(form){
   form.addEventListener('change',e=>{if(e.target.name==='amount'){model.selected=e.target.value;if(model.selected!=='custom')model.amount=Number(model.selected);render();if(model.selected==='custom')$('#patronCustom').focus();else document.querySelector('#patronForm input:checked')?.focus()}});
   $('#patronCustom').addEventListener('input',e=>{const n=Number(e.target.value);model.amount=n;form.querySelector('button[type=submit]').textContent=Number.isInteger(n)&&n>0?'Zobrazit QR na '+money(n)+' →':'Zadej částku';});
   form.addEventListener('submit',e=>{e.preventDefault();if(!Number.isInteger(model.amount)||model.amount<1||model.amount>100000){$('#patronCustom').reportValidity();return}model.step='qr';render();$('#patronTitle')?.focus({preventScroll:true});});
  }
  $('#patronPublic')?.addEventListener('change',e=>{model.public=e.target.checked;persist()});
  dialog.querySelector('[data-copy]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('PROPLET-PREVIEW-NEPLATIT\nUkázková částka: '+money(model.amount)+'\nÚčet: ukázkové údaje, nelze zaplatit');$('#patronCopyStatus').textContent='Ukázkové údaje zkopírovány.'}catch{$('#patronCopyStatus').textContent='Kopírování není dostupné. Toto je pouze neplatební ukázka.'}});
 }
 function review(){ensure();const el=$('#patronReview');el.innerHTML='<button class="patron-close" aria-label="Zavřít ovládání náhledu">×</button><h2>Náhled patronství</h2><p>Modeloví hráči a ukázkové platby. Nic se neodesílá.</p><div class="patron-review-grid">'+[['today','Dnes'],['profile','Profil'],['result','Po dohrání'],['ranking','Pořadí'],['offer','Nabídka podpory'],['qr','Ukázkové QR']].map(([s,t])=>`<button class="secondary-btn" data-scene="${s}">${t}</button>`).join('')+'</div><div class="patron-review-states"><button class="secondary-btn" data-confirm>Simulovat přijetí příspěvku</button><button class="text-btn" data-reset>Vrátit stav bez podpory</button><button class="text-btn" data-theme>Přepnout světlý / tmavý</button></div>';el.querySelector('.patron-close').onclick=()=>el.close();el.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{el.close();scene(b.dataset.scene)});el.querySelector('[data-confirm]').onclick=()=>{model.paid=true;persist();el.close();open('thanks')};el.querySelector('[data-reset]').onclick=()=>{model.paid=false;model.public=false;persist();el.close();close();};el.querySelector('[data-theme]').onclick=()=>{applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',{persist:false})};el.showModal();}
 function decorate(){
  const card=$('#profileCard');if(card&&!$('#patronProfileEntry')){const entry=document.createElement('button');entry.type='button';entry.id='patronProfileEntry';entry.className='patron-profile-entry';entry.onclick=()=>open(model.paid?'thanks':'offer',entry);card.after(entry);}
  const entry=$('#patronProfileEntry');if(entry){const html=`<span class="patron-entry-seal">${heart}</span><span><strong>${model.paid?'Díky, že jsi u toho.':'Baví tě Proplet?'}</strong><small>${model.paid?'Tvoje podpora a veřejná značka':'Podpoř jeho další příběh.'}</small></span><b aria-hidden="true">→</b>`;if(entry.innerHTML!==html)entry.innerHTML=html;}
  for(const row of document.querySelectorAll('.ranking-row,.result-player-row')){
   const name=row.querySelector('.leader-name strong,.result-player-copy strong,.leader-name');if(!name)continue;
   const mine=row.classList.contains('me'),supported=mine?model.paid&&model.public:/Klára|Matěj/.test(name.textContent);
   const copy=row.querySelector('.result-player-copy,.leader-name')||name.parentElement;
   const badge=row.querySelector('.patron-label');if(supported&&!badge){const holder=document.createElement('span');holder.innerHTML=seal();const button=holder.firstElementChild;button.onclick=e=>{e.stopPropagation();model.personName=name.textContent.replace(/\s*Ty\s*$/,'').trim();model.personArt=row.querySelector('.result-player-avatar img,.leader-name img')?.getAttribute('src');open(mine?'thanks':'other',button)};copy.append(button);}else if(!supported&&badge)badge.remove();
   row.classList.toggle('patron-supported',supported);
  }
 }
 async function scene(value){close();document.querySelectorAll('.modal').forEach(e=>e.classList.add('hidden'));if(value==='today')nav('daily');else if(value==='profile')nav('profile');else if(value==='ranking'){nav('leaderboard');rankingsOrchestration().openView('xp');}else if(value==='result'){
   nav('daily');const date=pragueDateISO(),p=dailyPuzzleFor(date),rec={puzzleId:p.id,mode:'daily',dailyDate:date,elapsedMs:84000,moves:8,hintsUsed:0,cleanSolve:true,points:100,timingVerified:true,completedAt:new Date().toISOString()};await showDailyResult(date,rec);
  }else open(value);decorate();}
 let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;decorate()})};
 function boot(){ensure();decorate();new MutationObserver(schedule).observe(document.querySelector('.app-shell'),{childList:true,subtree:true});new MutationObserver(schedule).observe($('#winModal'),{childList:true,subtree:true});const view=params.get('view');if(view)setTimeout(()=>scene(view),400);}
 document.addEventListener('proplet:ready',boot,{once:true});if(window.__PROPLET_CURRENT_UI_READY)boot();
 window.PropletPatronPreview={open,scene,review,model};
})();

