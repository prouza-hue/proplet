/* Native Proplet referral experience; fixture transport lives in a separate preview boundary. */
(() => {
 'use strict';
 const preview=window.PropletReferralPreview;if(!preview)return;
 window.PropletReferralUiRevision=8;
 const m=preview.model,$=s=>document.querySelector(s);
 const rule='Bonus patří do celkových XP a celkového pořadí. Do týdenních XP hráče ani týmu se nepočítá.';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const artwork='<div class="ref-art" aria-hidden="true"><div class="ref-art-card ref-art-katka"><img src="/assets/avatars/v3/02-sova.svg" width="76" height="76" alt=""></div><div class="ref-art-card ref-art-friend"><img src="/assets/avatars/v3/01-liska.svg" width="76" height="76" alt=""></div><span class="ref-art-spark">✦</span><span class="ref-art-thread"></span><span class="ref-art-word"><i>S</i><i>P</i><i>O</i><i>L</i><i>U</i></span></div>';
 const inviterAccusative='Katku';
 const reward='<div class="ref-reward"><span class="xp-sticker">+1 000 XP</span><small>pro každého</small></div>';
 const heading=(title,copy)=>'<div class="ref-story"><div class="ref-story-copy"><h2>'+title+'</h2><p>'+copy+'</p></div>'+ '<div class="ref-visual">'+artwork+reward+'</div></div>';
 const dismissReward='<button class="ref-card-close" type="button" data-ref-reward-close aria-label="Skrýt připsaný bonus">×</button>';
 const rewardKey=()=> 'proplet:referral-reward-dismissed:'+preview.profile().id+':KATKA';
 const rewardHidden=()=>m.paid&&localStorage.getItem(rewardKey())==='1';
 const steps=n=>'<div class="ref-steps" role="img" aria-label="Dokončeno '+n+' z 5 desek">'+Array.from({length:5},(_,i)=>'<span class="ref-step ref-step-'+i+(i<n?' done':i===n?' next':'')+'"><b>'+(i<n?'✓':i+1)+'</b></span>').join('')+'</div>';
 let originFocus=null,booted=false,lastReward=false,offerDismissed=false,forwardingShare=false;
 function link(view){const u=new URL(location.origin+'/');if(view)u.searchParams.set('view',view);if(view==='new')u.searchParams.set('invite','KATKA');if(document.documentElement.dataset.theme==='dark')u.searchParams.set('theme','dark');return u.href}
 function inviteUrl(){return link('new')}
 function updateStats(){if(typeof getProfile==='function'&&getProfile())updateAccountProfile({stats:preview.stats()});}
 function incomingCopy(){
  if(!m.accepted)return heading(esc(m.inviterName)+' tě zve do Propletu.','Pět desek. Tisíc pro každého.')+'<div class="ref-action-row">'+'<button class="secondary-btn ref-wide" data-ref-accept>Přijmout pozvánku</button></div><small class="ref-rule">'+rule+'</small>';
  if(m.paid)return heading('Tisíc pro tebe.<br>Tisíc pro '+esc(inviterAccusative)+'.','Všech pět desek je hotových. Bonus už máte oba.')+steps(5)+'<div class="ref-action-row">'+'<span class="ref-paid-note">✓ Připsáno do celkových XP</span></div><small class="ref-rule">'+rule+'</small>';
  const left=5-m.count,title=m.count===0?'Pět desek ke společnému bonusu.':left===1?'Ještě jedna.<br>A tisíc pro každého.':'Ještě '+left+' desky.<br>A tisíc pro každého.';
  return heading(title,'Denní výzva, Tajenka i volná hra. Každá různá dohraná deska se počítá.')+steps(m.count)+'<div class="ref-progress-caption"><strong>'+m.count+' / 5 desek hotovo</strong><span>Hraj vlastním tempem</span></div><div class="ref-action-row">'+'<button class="secondary-btn ref-wide" data-ref-play>Vybrat další hru <span aria-hidden="true">→</span></button></div><small class="ref-rule">'+rule+'</small>';
 }
 function renderHome(){
  let card=$('#referralHome');
  if(!card){card=document.createElement('aside');card.id='referralHome';card.className='card ref-home'}
  const anchor=m.incoming?$('#screen-daily .daily-hero'):($('#tajenkaPreviewCard')||$('#quickPlayCard'));
  if(!anchor)return;
  if(anchor.nextElementSibling!==card)anchor.after(card);
  card.classList.toggle('ref-incoming',m.incoming);card.classList.toggle('ref-paid',m.paid);
  card.hidden=m.incoming?rewardHidden():sessionStorage.getItem('ref:announcement-hidden')==='1';
  card.innerHTML=m.incoming?(m.paid?dismissReward:'')+incomingCopy():'<button class="ref-card-close" data-ref-home-close aria-label="Skrýt nabídku pozvání">×</button>'+heading('Pozvi někoho<br>do Propletu.','Sdílejte radost z hraní. Za prvních pět desek kamaráda získáte oba bonus.')+'<button class="secondary-btn ref-wide" data-ref-open>Pozvat kamaráda <span aria-hidden="true">→</span></button>';
  wire(card);
 }
 function renderProfile(){
  let card=$('#referralProfile');if(!card){card=document.createElement('section');card.id='referralProfile';card.className='card ref-profile';$('#profileCard')?.after(card)}
  if(!card)return;
  const rows=m.referrals.map(r=>'<div class="ref-person"><div class="ref-avatar">'+(r.name==='Eliška'?'🦊':r.name==='Honza'?'🐻':'🐱')+'</div><div><strong>'+r.name+'</strong><small>'+(r.paid?'Bonus připsán oběma':r.accepted?r.count+' / 5 desek':'Čeká na přijetí')+'</small></div><span class="ref-person-state">'+(r.paid?'+1 000 XP':r.accepted?r.count+'/5':'Čeká')+'</span></div>').join('');
  card.classList.toggle('ref-incoming',m.incoming);card.classList.toggle('ref-paid',m.paid);
  card.innerHTML=m.incoming?incomingCopy():'<div class="ref-profile-head"><div><h2>Pozvaní kamarádi</h2><p>Pět desek. Tisíc pro každého.</p></div><span class="xp-sticker">+1 000 XP</span></div><button class="primary-btn" data-ref-open>Pozvat dalšího kamaráda</button><p class="ref-policy">'+rule+'</p><div class="ref-people">'+rows+'</div><details class="ref-rules"><summary>Jak se počítá pět desek?</summary><p>Kamarád přijme tvůj odkaz a vytvoří si nový účet. Potom dohraje 5 různých desek v libovolné kombinaci: Dnešní výzva, Tajenka i Volná hra. Není potřeba hrát pět dní.</p><p>Nápověda ani klidný režim bonusu nebrání. Opakování stejné desky a úvodní trénink se nepočítají. Bonus se přidělí oběma jednou.</p></details>';
  wire(card);
 }
 function offer(){
  const secondary=$('#winModal .win-secondary-actions');if(!secondary)return;
  let card=$('#referralWin');
  if(!card){card=document.createElement('aside');card.id='referralWin';card.className='ref-win';secondary.before(card)}
  const g=window.currentGame;
  card.hidden=!m.incoming||!g||!g.finished||['starter','rescue'].includes(g.mode)||g.isReplay||offerDismissed||(m.paid&&(!lastReward||rewardHidden()));
  if(card.hidden)return;
  card.classList.toggle('ref-earned',lastReward);
  card.innerHTML=lastReward?dismissReward+'<h3>Pět desek je doma!</h3><p>Tisíc pro tebe. Tisíc pro '+esc(inviterAccusative)+'.</p>'+reward:'<div class="ref-result-progress"><strong>'+m.count+' / 5 desek k bonusu</strong>'+reward+'</div>'+steps(m.count);
  wire(card);
 }
 function wire(root){
  root.querySelectorAll('[data-ref-home-close]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('ref:announcement-hidden','1');renderHome()});
  root.querySelectorAll('[data-ref-open]').forEach(b=>b.onclick=()=>open('invite'));
  root.querySelectorAll('[data-ref-accept]').forEach(b=>b.onclick=()=>open('accept'));
  root.querySelectorAll('[data-ref-play]').forEach(b=>b.onclick=()=>{close();if(typeof closeTransientModals==='function')closeTransientModals();nav('free')});
  root.querySelectorAll('[data-ref-reward-close]').forEach(b=>b.onclick=()=>{localStorage.setItem(rewardKey(),'1');renderHome();offer()});
  root.querySelectorAll('[data-ref-dismiss]').forEach(b=>b.onclick=()=>{offerDismissed=true;root.hidden=true});
 }
 function open(kind){
  if(!$('#referralDialog')){
   const modal=document.createElement('div');modal.id='referralDialog';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','refDialogTitle');modal.innerHTML='<div class="modal-card left ref-sheet"></div>';document.body.append(modal);
   modal.addEventListener('click',e=>{if(e.target===modal)close()});
  }
  if($('#referralDialog').classList.contains('hidden'))originFocus=document.activeElement;
  if(kind==='choice'){
   $('#referralDialog .ref-sheet').innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít pozvánku">×</button><h2 id="refDialogTitle" tabindex="-1">Pozvi kamaráda</h2><div class="ref-choice"><button class="primary-btn" id="refShareBoard">Poslat tuhle desku</button><p>Kamarád si zahraje stejnou desku a porovnáte výsledky.</p><div class="ref-choice-bonus">'+artwork+reward+'</div><button class="primary-btn" data-ref-open>Pozvat nového hráče</button><p>Po jeho prvních pěti deskách získáte oba bonus.</p></div>';
   $('#referralDialog').classList.remove('hidden');wire($('#referralDialog'));
   $('#referralDialog [data-ref-close]').onclick=close;
   $('#refShareBoard').onclick=()=>{close();forwardingShare=true;try{$('#winShareBtn').click()}finally{forwardingShare=false}};
   $('#refDialogTitle').focus();return;
  }
  const accept=kind==='accept';
  $('#referralDialog .ref-sheet').innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít pozvánku">×</button><div class="ref-sheet-art">'+artwork+'</div><h2 id="refDialogTitle" tabindex="-1">'+(accept?'Katka tě zve do Propletu.':'Pozvi kamaráda.<br>Tisíc XP pro každého.')+'</h2><p class="ref-sheet-intro">'+(accept?'Propleť si hlavu spolu s Katkou. A získejte společný bonus.':'Kamarád si založí účet, dohraje pět desek a oba získáte tisíc XP.')+'</p><ol class="ref-how"><li><span>1</span><div><strong>'+(accept?'Vytvoř si účet':'Pošli pozvánku')+'</strong><small>'+(accept?'Nový hráč přijme pozvánku při registraci.':'Odkaz je tvůj. Můžeš ho poslat více kamarádům.')+'</small></div></li><li><span>2</span><div><strong>'+(accept?'Dohraj 5 různých desek':'Kamarád dohraje 5 desek')+'</strong><small>Dnešní výzva, Tajenka i Volná hra. Klidně v jediný den.</small></div></li><li><span>3</span><div><strong>Oba dostanete +1 000 XP</strong><small>Odměna se připíše po páté dokončené desce.</small></div></li></ol><div class="ref-policy">'+rule+'</div>'+(accept?'<button id="refCreateAccount" class="primary-btn big">Vytvořit účet a přijmout</button><button class="text-btn" data-ref-close>Zatím si jen zahrát</button>':'<button id="refShare" class="primary-btn big">Pojď si zahrát Proplet · poslat pozvánku</button><div class="ref-link-row"><input id="refLink" aria-label="Odkaz na pozvánku" readonly value="'+esc(inviteUrl())+'"><button id="refCopy" class="secondary-btn">Kopírovat</button></div>')+'<p id="refStatus" class="ref-status" role="status"></p>';
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
  $('.app-header').before(bar);$('#refPreviewView').value=m.view;$('#refPreviewTheme').value=document.documentElement.dataset.theme||'light';
  $('#refPreviewView').onchange=e=>location.assign(link(e.target.value));
  $('#refPreviewFifth').onclick=()=>location.assign(link('four')+'&open=free');
  $('#refPreviewTheme').onchange=e=>{applyTheme(e.target.value);saveSettings({...getSettings(),theme:e.target.value})};
 }
 function refresh(){updateStats();renderHome();renderProfile();offer()}
 function boot(){
  if(booted)return;booted=true;review();refresh();$('#winShareBtn').addEventListener('click',e=>{if(!forwardingShare&&!m.incoming&&$('#winShareBtn').classList.contains('challenge-share-cta')){e.preventDefault();e.stopImmediatePropagation();open('choice')}},true);if(new URLSearchParams(location.search).get('intro')==='1')open('invite');
  registerGameCompletionHook({id:'referral-preview',priority:250,after:({game})=>{
   lastReward=preview.complete(game);updateStats();renderDaily();renderHome();renderProfile();if(typeof window.renderProfile==='function')window.renderProfile();offer();
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

