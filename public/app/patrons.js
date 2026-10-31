/* Shared patron UI. Entitlements and payment references are server-owned. */
(()=>{
 'use strict';
 const preview=window.PROPLET_PATRON_PREVIEW===true;
 const request=(path,options={})=>window.PropletPatronApi?.request?window.PropletPatronApi.request(path,options):api(path,options);
 let stateGeneration=0,accountEpoch=0,resultReady=false,started=false;
 const profile=()=>typeof getProfile==='function'?getProfile():null;
 const $=s=>document.querySelector(s),params=new URLSearchParams(location.search);
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.5 3 8.5C3 3 10 2.5 12 7c2-4.5 9-4 9 1.5C21 14.5 12 20 12 20Z" fill="currentColor"/></svg>';
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague'}).format(new Date());
 const model={frequency:'once',firstPaymentDate:today(),amount:99,paid:false,public:false,offersDisabled:false,enabled:false,authenticated:false,canOffer:false,step:'offer',returnFocus:null,selected:'99',intent:null,payment:null,pending:false,error:'',receiptId:null};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('cs-CZ').format(n)+' Kč';
 async function refresh(){const epoch=accountEpoch,generation=++stateGeneration;try{const value=await request('/api/patrons');if(epoch!==accountEpoch||generation!==stateGeneration)return;Object.assign(model,{enabled:value.enabled===true,authenticated:value.authenticated===true,paid:value.patron===true,public:value.publicBadge===true,offersDisabled:value.offersDisabled===true,canOffer:value.canOffer===true});decorate();window.PropletAnnouncements?.kick();}catch{if(epoch===accountEpoch){model.canOffer=false;model.error='Podporu se teď nepodařilo načíst. Hra funguje dál.';}}}
 async function preference(next){try{await request('/api/patrons/preferences',{method:'POST',body:JSON.stringify({publicBadge:model.public,offersDisabled:model.offersDisabled,...next})});await refresh();}catch{model.error='Změnu se nepodařilo uložit. Zkus to prosím znovu.';render();}}
 async function createIntent(){if(model.pending)return;if(!model.authenticated){close();if(typeof openProfileModal==='function')openProfileModal('login');return;}const epoch=accountEpoch;if(model.requestAmount!==[model.amount,model.frequency,model.frequency==='monthly'?model.firstPaymentDate:''].join(':')||!model.requestId){model.requestId=crypto.randomUUID();model.requestAmount=[model.amount,model.frequency,model.frequency==='monthly'?model.firstPaymentDate:''].join(':');}model.pending=true;model.error='';render();try{const value=await request('/api/patrons/intents',{method:'POST',body:JSON.stringify({requestId:model.requestId,amountCzk:model.amount,frequency:model.frequency,...(model.frequency==='monthly'?{firstPaymentDate:model.firstPaymentDate}:{})})});if(epoch!==accountEpoch)return;model.intent=value.intent;model.payment=value.payment;model.step='qr';model.canOffer=false;}catch{if(epoch===accountEpoch)model.error='QR se nepodařilo připravit. Zkus to znovu — nevznikne tím druhá platba.';}finally{if(epoch===accountEpoch){model.pending=false;render();$('#patronTitle')?.focus({preventScroll:true});}}}

 const art='<img class="patron-art" src="/assets/support/patron-letterpress-v1.webp" alt="" width="144" height="144">';
 const seal=(name='Podporovatel')=>`<button type="button" class="patron-label" aria-label="${name} Propletu — poděkování" data-patron-thanks>${heart}<span>${name}</span></button>`;
 function ensure(){
  if($('#patronDialog'))return;
  const el=document.createElement('dialog');el.id='patronDialog';el.setAttribute('aria-labelledby','patronTitle');document.body.append(el);
  el.addEventListener('click',e=>{if(e.target===el)close()});el.addEventListener('cancel',e=>{e.preventDefault();close()});
  const toggle=document.createElement('button');toggle.id='patronReviewToggle';toggle.type='button';toggle.textContent='Náhled patronství';toggle.onclick=()=>window.PropletPatronDemo?.review();if(preview)document.body.append(toggle);
  const reviewEl=document.createElement('dialog');reviewEl.id='patronReview';reviewEl.setAttribute('aria-label','Ovládání izolovaného náhledu');document.body.append(reviewEl);
  reviewEl.addEventListener('click',e=>{if(e.target===reviewEl)reviewEl.close()});
 }
 function close(){if(model.receiptId){void request('/api/patrons/offers/dismiss',{method:'POST',body:JSON.stringify({receiptId:model.receiptId,action:'ignored'})}).catch(()=>{});model.receiptId=null;}const el=$('#patronDialog');if(el?.open)el.close();model.returnFocus?.isConnected&&model.returnFocus.focus({preventScroll:true});}
 function open(step='offer',from=document.activeElement){if(!model.enabled)return;ensure();model.error='';model.returnFocus=from;model.step=step;render();if(!$('#patronDialog').open)$('#patronDialog').showModal();$('#patronTitle')?.focus({preventScroll:true});}
 function heading(title,copy){return `<header class="patron-intro">${art}<div><h2 id="patronTitle" tabindex="-1">${title}</h2>${copy?`<p>${copy}</p>`:''}</div></header>`;}
 function render(){
  const dialog=$('#patronDialog');if(!dialog)return;let content='';
  if(model.step==='offer'){
   content=heading('Držme Proplet ve hře.','Proplet tvořím já, Pavel, ve volném čase a vždy bude zdarma. Tvůj příspěvek mi pomůže s náklady na provoz a péčí o hru.')+

    '<form id="patronForm"><fieldset class="patron-frequency"><legend class="os-sr">Četnost podpory</legend><div>'+[['once','Jednorázově'],['monthly','Měsíčně']].map(([v,label])=>`<label><input type="radio" name="frequency" value="${v}" ${model.frequency===v?'checked':''}><span>${label}</span></label>`).join('')+'</div></fieldset><fieldset><legend>Výše příspěvku</legend><div class="patron-amounts">'+['99','199','custom'].map(v=>`<label class="patron-amount"><input type="radio" name="amount" value="${v}" ${model.selected===v?'checked':''}><span>${v==='custom'?'Jiná částka':money(Number(v))}</span></label>`).join('')+'</div></fieldset>'+
    `<label class="patron-custom" ${model.selected==='custom'?'':'hidden'}>Částka v Kč<input name="custom" id="patronCustom" inputmode="numeric" type="number" min="1" max="100000" step="1" value="${model.selected==='custom'?model.amount:99}"></label>`+
    (model.frequency==='monthly'?`<label class="patron-start">První platba<input name="firstPaymentDate" type="date" min="${today()}" value="${model.firstPaymentDate}" required></label><p class="patron-frequency-note">Trvalý příkaz potvrdíš a spravuješ ve své bance.</p>`:'')+
    '<div class="patron-keepsake patron-perk"><div class="patron-mini-person"><span class="patron-avatar-demo"><span class="patron-avatar-native" data-player-avatar="'+esc(profile()?.avatar||'🙂')+'">'+esc(profile()?.avatar||'🙂')+'</span><i>'+heart+'</i></span><span class="patron-label-static">Podporovatel</span></div><div><strong>Tvoje značka podpory</strong><p>Dobrovolně u jména, bez zveřejnění částky. Stejná pro každého, kdo přispěje.</p></div></div>'+
    `<button class="primary-btn patron-primary" type="submit" ${model.pending?'disabled':''}>${model.pending?'Připravuji QR…':model.authenticated?(model.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(model.amount)+' · QR':'Přihlásit se a připravit QR'} <span aria-hidden="true">→</span></button><p class="patron-preview-note">${preview?'Ukázka průchodu. V tomto náhledu nelze platit.':model.authenticated?'Zobrazení QR není platba. Převod zadáš ve své bance.':'Přihlášení bezpečně propojí příspěvek s tvým účtem.'}</p></form>`;
  }else if(model.step==='qr'){
   const intent=model.intent,payment=model.payment;if(!intent||!payment){model.step='offer';render();return;}
   const image=preview?'/patron-demo-qr.png':'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(payment.qrSvg)));
   content='<button class="text-btn patron-back" data-back>← Změnit částku</button>'+heading(intent.frequency==='monthly'?'Měsíční podpora přes QR':'Podpora přes QR',(intent.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(intent.amountCzk)+' bankovním převodem.')+
    `<div class="patron-qr"><img src="${image}" width="184" height="184" alt="${preview?'Ukázkový QR kód — neplaťte':'Platební QR na '+money(intent.amountCzk)}"><div><strong>${preview?'Ukázka — neplaťte':'Naskenuj QR ve své bance'}</strong><dl class="patron-bank-details"><dt>Účet</dt><dd>${esc(intent.account)}</dd><dt>Variabilní symbol</dt><dd>${esc(intent.reference)}</dd><dt>Zpráva</dt><dd>${esc(intent.message)}</dd></dl></div></div>`+
    `<div class="patron-qr-actions"><a class="secondary-btn" href="${image}" download="Proplet-${preview?'UKAZKA-NEPLATIT':'QR-platba'}.${preview?'png':'svg'}">Uložit ${preview?'ukázkové ':''}QR</a><button class="secondary-btn" data-copy>Kopírovat ${preview?'ukázkové ':''}údaje</button></div><p id="patronCopyStatus" role="status" class="patron-copy-status"></p>`+
    (intent.frequency==='monthly'?'<p class="patron-qr-hint">První platba '+esc(intent.firstPaymentDate)+'. Trvalý příkaz potvrdíš a zrušíš ve své bance. Pokud QR nepředvyplní opakování, nastav měsíční frekvenci se stejným variabilním symbolem.</p>':'')+
    '<p class="patron-qr-hint">Na stejném telefonu si QR uložíš a načteš v bankovní aplikaci, pokud to podporuje. Údaje můžeš také zkopírovat.</p>'+
    '<div class="patron-pending"><span class="patron-pending-dot"></span><p>QR je připravené, platba zatím není potvrzená. Značku přidáme až po ověření příchozího převodu. Hledáme ho podle variabilního symbolu, ne podle přezdívky.</p></div><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else if(model.step==='thanks'){
   content=heading('Díky, že držíš Proplet ve hře.','Tvoje podpora dává další práci na Propletu smysl. Moc si jí vážím. — Pavel')+
    '<div class="patron-own-preview"><span class="patron-avatar-demo"><span class="patron-avatar-native" data-player-avatar="'+esc(profile()?.avatar||'🙂')+'">'+esc(profile()?.avatar||'🙂')+'</span><i>'+heart+'</i></span><div><strong>'+esc(profile()?.name||'Podporovatel')+'</strong><span class="patron-label-static">'+heart+' Podporovatel</span></div></div>'+
    `<label class="patron-visibility"><input type="checkbox" id="patronPublic" ${model.public?'checked':''}><span>Ukazovat mou značku ostatním<small>Zaplacenou částku nikdy nezobrazujeme.</small></span></label>`+
    '<p class="patron-qr-hint">Případný trvalý příkaz můžeš změnit nebo zastavit ve své bance. Značka ti zůstává jako poděkování.</p><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else{
   content=heading(esc(model.personName||'Tenhle hráč')+' podporuje Proplet.','Příspěvek pomáhá s provozem a další péčí o hru. Tohle je naše poděkování.')+
    '<div class="patron-own-preview"><span class="patron-avatar-demo"><img src="'+esc(model.personArt||'/assets/avatars/v3/05-jelen.svg')+'" width="56" height="56" alt=""><i>'+heart+'</i></span><div><strong>'+esc(model.personName||'Podporovatel')+'</strong><span class="patron-label-static">'+heart+' Podporovatel</span></div></div><p class="patron-fair">Stejná značka pro každou částku. Herní výhody si za ni nekoupíš.</p>'+
    '<button class="primary-btn patron-primary" data-support>Chci také podpořit Proplet <span aria-hidden="true">→</span></button><button class="text-btn patron-dismiss" data-close>Zpátky do hry</button>';
  }
  dialog.innerHTML='<button class="patron-close" aria-label="Zavřít podporu">×</button>'+content+(model.error?'<p class="patron-error" role="alert">'+esc(model.error)+'</p>':'');
  dialog.querySelector('.patron-close').onclick=close;dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  dialog.querySelector('[data-back]')?.addEventListener('click',()=>{model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true})});dialog.querySelector('[data-support]')?.addEventListener('click',()=>{model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true})});
  const form=$('#patronForm');if(form){
   form.addEventListener('change',e=>{if(e.target.name==='frequency'){model.frequency=e.target.value;render();document.querySelector('#patronForm input[name=frequency]:checked')?.focus();return;}if(e.target.name==='firstPaymentDate'){model.firstPaymentDate=e.target.value;return;}if(e.target.name==='amount'){model.selected=e.target.value;if(model.selected!=='custom')model.amount=Number(model.selected);render();if(model.selected==='custom')$('#patronCustom').focus();else document.querySelector('#patronForm input:checked')?.focus()}});
   $('#patronCustom').addEventListener('input',e=>{const n=Number(e.target.value);model.amount=n;form.querySelector('button[type=submit]').textContent=Number.isInteger(n)&&n>0?(model.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(n)+' · QR →':'Zadej částku';});
   form.addEventListener('submit',e=>{e.preventDefault();if(!Number.isInteger(model.amount)||model.amount<1||model.amount>100000){$('#patronCustom').reportValidity();return}void createIntent();});
  }
  $('#patronPublic')?.addEventListener('change',e=>{void preference({publicBadge:e.target.checked})});
  dialog.querySelector('[data-copy]')?.addEventListener('click',async()=>{try{const i=model.intent;await navigator.clipboard.writeText((preview?'UKÁZKA — NEPLAŤTE\n':'')+'Účet: '+i.account+'\nČástka: '+money(i.amountCzk)+(i.frequency==='monthly'?'\nOpakování: měsíčně\nPrvní platba: '+i.firstPaymentDate:'')+'\nVS: '+i.reference+'\nZpráva: '+i.message);$('#patronCopyStatus').textContent='Údaje zkopírovány.';}catch{$('#patronCopyStatus').textContent='Kopírování není dostupné. Údaje jsou uvedené nad QR.';}});

 }
 function decorate(){
  if(!model.enabled)return;
  const card=$('#profileCard');if(card&&!$('#patronProfileEntry')){const entry=document.createElement('button');entry.type='button';entry.id='patronProfileEntry';entry.className='patron-profile-entry';card.after(entry);}
  const entry=$('#patronProfileEntry');if(entry){const html=`<span class="patron-entry-seal">${heart}</span><span><strong>${model.paid?'Díky, že jsi u toho.':'Baví tě Proplet?'}</strong><small>${model.paid?'Tvoje podpora a veřejná značka':'Podpoř jeho další příběh.'}</small></span><b aria-hidden="true">→</b>`;if(entry.innerHTML!==html)entry.innerHTML=html;}
  const footer=document.querySelector('.app-footer');if(footer&&!$('#patronTodayLink')){const link=document.createElement('button');link.type='button';link.id='patronTodayLink';link.className='text-btn patron-today-link';link.textContent='Podpořit Proplet';link.onclick=()=>open('offer',link);footer.before(link);}
  const todayLink=$('#patronTodayLink');if(todayLink)todayLink.hidden=typeof currentScreen==='string'&&currentScreen!=='daily';
  const settings=document.querySelector('#screen-profile #settingsHelpCard');
  if(settings&&!$('#patronOfferPreference')){const box=document.createElement('label');box.id='patronOfferPreference';box.className='card settings-card patron-visibility';box.innerHTML='<input type="checkbox"><span>Nenabízet mi podporu Propletu<small>Ruční odkaz na podporu zůstane dostupný.</small></span>';box.querySelector('input').onchange=e=>void preference({offersDisabled:e.target.checked});settings.after(box);}
  const opt=$('#patronOfferPreference input');if(opt)opt.checked=model.offersDisabled;
  for(const row of document.querySelectorAll('.ranking-row,.result-player-row')){
   const name=row.querySelector('.leader-name strong,.result-player-copy strong,.leader-name');if(!name)continue;
   const mine=row.classList.contains('me'),supported=mine?model.paid&&model.public:row.dataset.patron==='true';
   const copy=row.querySelector('.result-player-copy,.leader-name')||name.parentElement;
   const badge=row.querySelector('.patron-label');if(supported&&!badge){const holder=document.createElement('span');holder.innerHTML=seal();const button=holder.firstElementChild;button.onclick=e=>{e.stopPropagation();model.personName=name.textContent.replace(/\s*Ty\s*$/,'').trim();model.personArt=row.querySelector('.result-player-avatar img,.leader-name img')?.getAttribute('src');open(mine?'thanks':'other',button)};copy.append(button);}else if(!supported&&badge)badge.remove();
   row.classList.toggle('patron-supported',supported);
  }
 }
 let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;decorate()})};
 function boot(){if(started)return;started=true;ensure();if(typeof registerGameCompletionHook==='function')registerGameCompletionHook({id:'patron-result',priority:200,after:({game})=>{if(game?.finished&&['daily','daily_special','free','tajenka'].includes(game.mode)&&!game.postStarterWarmup&&!game.puzzle?.meta?.archiveExperience)resultCompleted();}});void refresh();new MutationObserver(schedule).observe(document.querySelector('.app-shell'),{childList:true,subtree:true});new MutationObserver(schedule).observe($('#winModal'),{childList:true,subtree:true});
  window.PropletAnnouncements?.register({id:'patron-support-v1',repeatable:true,priority:-20,eligible:()=>resultReady&&model.enabled&&model.authenticated&&model.canOffer&&!model.paid&&!model.offersDisabled&&profile()?.supportMode!=='younger',show:async({isCurrent})=>{if(!isCurrent()||document.querySelector('#rankSpotlight:not(.hidden)'))return false;const epoch=accountEpoch;const status=await request('/api/patrons/offers/claim',{method:'POST'});if(epoch!==accountEpoch||!status.displayGranted)return false;const current=isCurrent();model.canOffer=false;resultReady=false;model.receiptId=status.receiptId;if(!current)return false;offer();return true;},close:()=>$('#patronOffer')?.remove()});
 }
 function offer(){if($('#patronOffer'))return;const card=document.createElement('aside');card.id='patronOffer';card.className='patron-offer';card.innerHTML='<span class="patron-entry-seal">'+heart+'</span><div><strong>Baví tě Proplet?</strong><p>Můžeš přispět na jeho další příběh.</p></div><button class="primary-btn" data-support>Podpořit</button><button class="text-btn" data-dismiss>Teď ne</button>';document.querySelector('.app-footer')?.before(card);card.querySelector('[data-support]').onclick=()=>{if(model.receiptId)void request('/api/patrons/offers/dismiss',{method:'POST',body:JSON.stringify({receiptId:model.receiptId,action:'opened'})}).catch(()=>{});card.remove();open('offer');};card.querySelector('[data-dismiss]').onclick=()=>{if(model.receiptId)void request('/api/patrons/offers/dismiss',{method:'POST',body:JSON.stringify({receiptId:model.receiptId,action:'declined'})}).catch(()=>{});model.receiptId=null;card.remove();};}
 document.addEventListener('click',e=>{const entry=e.target.closest?.('#patronProfileEntry');if(entry)open(model.paid?'thanks':'offer',entry);});
 document.addEventListener('proplet:ready',boot,{once:true});if(window.__PROPLET_CURRENT_UI_READY)boot();
 document.addEventListener('proplet:screen-changed',()=>{decorate();if(typeof currentScreen==='string'&&!['daily','free'].includes(currentScreen)){if(model.receiptId)void request('/api/patrons/offers/dismiss',{method:'POST',body:JSON.stringify({receiptId:model.receiptId,action:'ignored'})}).catch(()=>{});model.receiptId=null;$('#patronOffer')?.remove();}});
 document.addEventListener('proplet:account-changed',()=>{accountEpoch++;close();resultReady=false;model.pending=false;model.requestId=null;model.requestAmount=null;model.intent=null;model.payment=null;model.paid=false;model.public=false;model.canOffer=false;$('#patronOffer')?.remove();void refresh();});
 window.addEventListener('storage',()=>{void refresh();});
 document.addEventListener('proplet:patron-updated',()=>{void refresh();});
 function resultCompleted(){resultReady=true;void refresh();}
 window.PropletPatrons={open,close,refresh,model,offer,preference,resultCompleted};
})();
