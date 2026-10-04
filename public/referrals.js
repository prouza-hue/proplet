/* Native Proplet referral experience; fixture transport lives in a separate preview boundary. */
(() => {
 'use strict';
 const preview=window.PropletReferralPreview;if(!preview)return;
 const m=preview.model,$=s=>document.querySelector(s);
 const rule='Bonus patří do celkových XP a celkového pořadí. Do týdenních XP hráče ani týmu se nepočítá.';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="17" cy="15" r="6"/><path d="M5 36c0-8 5-12 12-12s12 4 12 12M31 10c6 0 9 8 4 12M33 26c6 1 10 4 10 10"/><path d="m29 40 5 5 9-10"/></svg>';
 const steps=n=>'<div class="ref-steps" role="img" aria-label="'+n+' z 5 desek">'+Array.from({length:5},(_,i)=>'<span class="'+(i<n?'done':'')+'">'+(i<n?'✓':i+1)+'</span>').join('')+'</div>';
 let originFocus=null,booted=false,lastReward=false,offerDismissed=false;
 function link(view){const u=new URL(location.origin+'/');if(view)u.searchParams.set('view',view);if(view==='new')u.searchParams.set('invite','KATKA');if(document.documentElement.dataset.theme==='dark')u.searchParams.set('theme','dark');return u.href}
 function inviteUrl(){return link('new')}
 function updateStats(){if(typeof getProfile==='function'&&getProfile())updateAccountProfile({stats:preview.stats()});}
 function incomingCopy(){
  if(!m.accepted)return '<h2>Katka tě zve do Propletu.</h2><p>Pět desek. Tisíc pro každého.</p><button class="primary-btn" data-ref-accept>Přijmout pozvánku</button><small>'+rule+'</small>';
  if(m.paid)return '<h2>Tisíc pro tebe. Tisíc pro Katku.</h2><p>Všech 5 desek je hotových. Oba jste získali <strong>+1 000 XP</strong>.</p>'+steps(5)+'<small>'+rule+'</small>';
  return '<h2>Ke společnému bonusu zbývá '+(5-m.count)+' '+(5-m.count===1?'deska':'desek')+'.</h2><p>Hraj cokoli: Dnešní výzvu, Tajenku nebo Volnou hru.</p>'+steps(m.count)+'<div class="ref-progress-caption"><strong>'+m.count+' / 5 desek</strong><span>+1 000 XP pro každého</span></div><button class="secondary-btn" data-ref-play>Pokračovat ve hře</button><small>'+rule+'</small>';
 }
 function renderHome(){
  let card=$('#referralHome');if(!card){card=document.createElement('aside');card.id='referralHome';card.className='card ref-home';$('#quickPlayCard')?.after(card)}
  if(!card)return;
  card.classList.toggle('ref-incoming',m.incoming);
  card.innerHTML=m.incoming?incomingCopy():'<div class="ref-home-symbol">'+icon+'</div><div><h2>Proplet je lepší ve dvou.</h2><p>Pozvi kamaráda. Po jeho pěti deskách máte oba <strong>+1 000 XP.</strong></p><button class="text-btn" data-ref-open>Pozvat kamaráda <span aria-hidden="true">↗</span></button><small>Do celkového pořadí · bez týdenních XP</small></div>';
  wire(card);
 }
 function renderProfile(){
  let card=$('#referralProfile');if(!card){card=document.createElement('section');card.id='referralProfile';card.className='card ref-profile';$('#profileCard')?.after(card)}
  if(!card)return;
  const rows=m.referrals.map(r=>'<div class="ref-person"><div class="ref-avatar">'+(r.name==='Eliška'?'🦊':r.name==='Honza'?'🐻':'🐱')+'</div><div><strong>'+r.name+'</strong><small>'+(r.paid?'Bonus připsán oběma':r.accepted?r.count+' / 5 desek':'Čeká na přijetí')+'</small></div><span class="ref-person-state">'+(r.paid?'+1 000 XP':r.accepted?r.count+'/5':'Čeká')+'</span></div>').join('');
  card.innerHTML=m.incoming?incomingCopy():'<div class="ref-profile-head"><div><h2>Pozvaní kamarádi</h2><p>Pět desek. Tisíc pro každého.</p></div><span class="ref-reward-stamp">+1 000<br><small>XP pro oba</small></span></div><button class="primary-btn" data-ref-open>Pozvat dalšího kamaráda</button><p class="ref-policy">'+rule+'</p><div class="ref-people">'+rows+'</div><details class="ref-rules"><summary>Jak se počítá pět desek?</summary><p>Kamarád přijme tvůj odkaz a vytvoří si nový účet. Potom dohraje 5 různých desek v libovolné kombinaci: Dnešní výzva, Tajenka i Volná hra. Není potřeba hrát pět dní.</p><p>Nápověda ani klidný režim bonusu nebrání. Opakování stejné desky a úvodní trénink se nepočítají. Bonus se přidělí oběma jednou.</p></details>';
  wire(card);
 }
 function offer(){
  let card=$('#referralWin');if(!card){card=document.createElement('aside');card.id='referralWin';card.className='ref-win';$('#winModal .win-secondary-actions')?.after(card)}
  if(!card)return;
  const g=window.currentGame;card.hidden=!g||!g.finished||g.mode==='starter'||g.mode==='rescue'||g.isReplay||offerDismissed;
  if(card.hidden)return;
  if(m.incoming){
   card.classList.toggle('ref-earned',lastReward);
   card.innerHTML=lastReward?'<div class="ref-earned-mark" aria-hidden="true">✦</div><h3>Pět desek je doma!</h3><p>Ty i Katka získáváte <strong>+1 000 XP.</strong></p><div class="ref-earned-xp">+1 000 XP</div><small>'+rule+'</small>':m.paid?'<h3>Společný bonus už máte.</h3><p>+1 000 XP pro tebe i Katku.</p><small>'+rule+'</small>':'<h3>Ke společnému bonusu o desku blíž.</h3>'+steps(m.count)+'<p><strong>'+m.count+' / 5 desek</strong> · +1 000 XP pro tebe i Katku</p><small>'+rule+'</small>';
  }else{
   card.innerHTML='<h3>Pošli tu radost dál.</h3><p>Kamarád dohraje 5 desek. Oba získáte <strong>+1 000 XP.</strong></p><button class="secondary-btn" data-ref-open>Pozvat kamaráda</button><button class="text-btn ref-later" data-ref-dismiss>Teď ne</button><small>'+rule+'</small>';
  }
  wire(card);
 }
 function wire(root){
  root.querySelectorAll('[data-ref-open]').forEach(b=>b.onclick=()=>open('invite'));
  root.querySelectorAll('[data-ref-accept]').forEach(b=>b.onclick=()=>open('accept'));
  root.querySelectorAll('[data-ref-play]').forEach(b=>b.onclick=()=>{close();if(typeof closeTransientModals==='function')closeTransientModals();nav('free')});
  root.querySelectorAll('[data-ref-dismiss]').forEach(b=>b.onclick=()=>{offerDismissed=true;root.hidden=true});
 }
 function open(kind){
  if(!$('#referralDialog')){
   const modal=document.createElement('div');modal.id='referralDialog';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','refDialogTitle');modal.innerHTML='<div class="modal-card left ref-sheet"></div>';document.body.append(modal);
   modal.addEventListener('click',e=>{if(e.target===modal)close()});
  }
  originFocus=document.activeElement;
  const accept=kind==='accept';
  $('#referralDialog .ref-sheet').innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít pozvánku">×</button><div class="ref-sheet-art">'+icon+'</div><h2 id="refDialogTitle" tabindex="-1">'+(accept?'Katka tě zve do Propletu.':'Pět desek.<br>Tisíc pro každého.')+'</h2><p class="ref-sheet-intro">'+(accept?'Propleť si hlavu spolu s Katkou. A získejte společný bonus.':'Pošli kamarádovi Proplet. Když se přidá, získáte oba víc než jen dalšího spoluhráče.')+'</p><ol class="ref-how"><li><span>1</span><div><strong>'+(accept?'Vytvoř si účet':'Pošli pozvánku')+'</strong><small>'+(accept?'Nový hráč přijme pozvánku při registraci.':'Odkaz je tvůj. Můžeš ho poslat více kamarádům.')+'</small></div></li><li><span>2</span><div><strong>'+(accept?'Dohraj 5 různých desek':'Kamarád dohraje 5 desek')+'</strong><small>Dnešní výzva, Tajenka i Volná hra. Klidně v jediný den.</small></div></li><li><span>3</span><div><strong>Oba dostanete +1 000 XP</strong><small>Odměna se připíše po páté dokončené desce.</small></div></li></ol><div class="ref-policy">'+rule+'</div>'+(accept?'<button id="refCreateAccount" class="primary-btn big">Vytvořit účet a přijmout</button><button class="text-btn" data-ref-close>Zatím si jen zahrát</button>':'<button id="refShare" class="primary-btn big">Sdílet pozvánku</button><div class="ref-link-row"><input id="refLink" aria-label="Odkaz na pozvánku" readonly value="'+esc(inviteUrl())+'"><button id="refCopy" class="secondary-btn">Kopírovat</button></div>')+'<p id="refStatus" class="ref-status" role="status"></p>';
  $('#referralDialog').classList.remove('hidden');
  $('#referralDialog').querySelectorAll('[data-ref-close]').forEach(b=>b.onclick=close);
  if(accept)$('#refCreateAccount').onclick=()=>{
   close();openProfileModal('create');
   $('#profileModalTitle').textContent='Přijmi pozvánku od Katky';
   $('#profileModalDesc').textContent='Po 5 deskách získáte oba +1 000 XP. Bonus je pouze do celkového pořadí, bez týdenních XP.';
   $('#saveProfileBtn').textContent='Vytvořit účet a přijmout';
   let note=$('#refTestAccount');if(!note){note=document.createElement('p');note.id='refTestAccount';note.className='ref-policy';$('#playerNameInput').closest('label').before(note)}
   note.textContent='Testovací účet pouze pro tento náhled. Použij smyšlené jméno a heslo.';
  };
  else{
   $('#refCopy').onclick=copy;
   $('#refShare').onclick=async()=>{
    const data={title:'Pojď si zahrát Proplet',text:'Pět desek. Tisíc pro každého. Přidej se přes mou pozvánku a oba získáme +1 000 XP do celkového pořadí.',url:inviteUrl()};
    if(navigator.share){try{await navigator.share(data);$('#refStatus').textContent='Pozvánka předána ke sdílení.'}catch(e){if(e.name!=='AbortError')await copy()}}else await copy();
   };
  }
  $('#refDialogTitle').focus();
 }
 async function copy(){
  try{await navigator.clipboard.writeText(inviteUrl());$('#refStatus').textContent='Odkaz zkopírován. Pošli ho kamarádovi.'}
  catch{$('#refLink').focus();$('#refLink').select();$('#refStatus').textContent='Označený odkaz zkopíruj ručně.'}
 }
 function close(){const modal=$('#referralDialog');if(!modal||modal.classList.contains('hidden'))return;modal.classList.add('hidden');originFocus?.focus({preventScroll:true})}
 function review(){
  const bar=document.createElement('details');bar.id='refPreviewControls';bar.className='ref-preview';
  bar.innerHTML='<summary><span>Testovací náhled · pozvánky</span><span class="ref-preview-label">Změnit pohled</span></summary><div class="ref-preview-options"><label>Pohled<select id="refPreviewView"><option value="inviter">Pozývající · Katka</option><option value="new">Pozvaný · nový účet</option><option value="four">Pozvaný · 4 z 5 desek</option><option value="reward">Pozvaný · bonus připsán</option></select></label><button id="refPreviewFifth" class="secondary-btn">Zahrát pátou desku</button><label>Vzhled<select id="refPreviewTheme"><option value="light">Světlý</option><option value="dark">Tmavý</option></select></label><p>Skutečná hra, ukázkové účty a pořadí. Údaje a XP platí jen do obnovení náhledu.</p></div>';
  $('.app-shell').before(bar);$('#refPreviewView').value=m.view;$('#refPreviewTheme').value=document.documentElement.dataset.theme||'light';
  $('#refPreviewView').onchange=e=>location.assign(link(e.target.value));
  $('#refPreviewFifth').onclick=()=>location.assign(link('four')+'&open=free');
  $('#refPreviewTheme').onchange=e=>{applyTheme(e.target.value);saveSettings({...getSettings(),theme:e.target.value})};
 }
 function refresh(){updateStats();renderHome();renderProfile();offer()}
 function boot(){
  if(booted)return;booted=true;review();refresh();
  registerGameCompletionHook({id:'referral-preview',priority:250,after:({game})=>{
   lastReward=preview.complete(game);updateStats();renderDaily();renderProfile();if(typeof window.renderProfile==='function')window.renderProfile();offer();
  }});
  document.addEventListener('proplet:screen-changed',refresh);
  document.addEventListener('proplet:account-changed',()=>{refresh();setTimeout(refresh,50)});
  document.addEventListener('proplet:profile-refreshed',refresh);
  new MutationObserver(offer).observe($('#winModal'),{attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',e=>{
   const modal=$('#referralDialog');if(!modal||modal.classList.contains('hidden'))return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}
   if(e.key==='Tab'){
    const controls=[...modal.querySelectorAll('button,input,[tabindex="0"]')].filter(el=>!el.disabled),first=controls[0],last=controls.at(-1);
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#refDialogTitle'))){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
   }
  },true);
 }
 document.addEventListener('proplet:ready',boot,{once:true});
 window.addEventListener('load',()=>{if(!booted)setTimeout(boot,800)},{once:true});
})();
