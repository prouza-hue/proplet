/* Native Proplet referral experience backed by authenticated server state. */
(() => {
 'use strict';
 const transport=window.PropletReferrals;if(!transport)return;
 window.PropletReferralUiRevision=16;
 const m=transport.model,$=s=>document.querySelector(s);
 const rule='Bonus patří do celkových XP a celkového pořadí. Do týdenních XP hráče ani týmu se nepočítá.';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const artwork='<div class="ref-art" aria-hidden="true"><div class="ref-art-card ref-art-katka"><img src="/assets/avatars/referral-jezek.webp" width="76" height="76" alt=""></div><div class="ref-art-card ref-art-friend"><img src="/assets/avatars/referral-liska.webp" width="76" height="76" alt=""></div><span class="ref-art-thread"></span><span class="ref-art-word"><i>S</i><i>P</i><i>O</i><i>L</i><i>U</i></span></div>';

 const earnedReward='<div class="ref-reward"><span class="xp-sticker">+1 000 XP</span></div>';
 const reward='<div class="ref-reward"><span class="xp-sticker">+1 000 XP</span><small>pro každého</small></div>';
 const heading=(title,copy)=>'<div class="ref-story"><div class="ref-story-copy"><h2>'+title+'</h2><p>'+copy+'</p></div>'+ '<div class="ref-visual">'+artwork+reward+'</div></div>';
 const dismissReward='<button class="ref-card-close" type="button" data-ref-reward-close aria-label="Skrýt připsaný bonus">×</button>';
 const rewardKey=()=> 'proplet:referral-reward-dismissed:'+(transport.profile()?.id||'guest')+':'+m.inviterCode;
 const preferences=transport.preferences||localStorage;
 const rewardHidden=()=>m.paid&&(m.rewardDismissed||preferences.getItem(rewardKey())==='1');
 const canInvite=()=>m.ready&&!!transport.profile()?.id&&(!m.incoming||m.paid);
 const offerKey=()=> 'proplet:referral-offer-hidden:v1:'+(transport.profile()?.id||'guest');
 const announcementKey=()=> 'proplet:referral-announcement-seen:v1:'+transport.profile().id;
 const steps=n=>'<div class="ref-steps" role="img" aria-label="Dokončeno '+n+' z 5 desek">'+Array.from({length:5},(_,i)=>'<span class="ref-step ref-step-'+i+(i<n?' done':i===n?' next':'')+'"><b>'+(i<n?'✓':i+1)+'</b></span>').join('')+'</div>';
 let originFocus=null,booted=false,lastReward=false,offerDismissed=false,forwardingShare=false,announcementTimer=null;
 const entrySources=new Set(['daily','tajenka','win','home','profile','announcement']);
 function sourceFor(element){
  if(element?.closest('#referralDialog'))return $('#referralDialog').dataset.entrySource;
  if(element?.closest('#referralProfile'))return 'profile';
  if(element?.id==='winShareBtn')return 'win';
  if(element?.id==='shareDailyBtn')return 'daily';
  if(element?.matches('[data-tajenka-share]'))return 'tajenka';
  return 'home';
 }
 function track(event,entrySource,copyMethod){
  if(typeof trackProductEvent!=='function')return;
  try{trackProductEvent(event,{entry_source:entrySources.has(entrySource)?entrySource:'home',...(copyMethod?{copy_method:copyMethod}:{})})}catch{}
 }
 function inviteUrl(){return m.inviteUrl||''}
 const incomingHeading=(title,copy,n)=>'<div class="ref-incoming-layout"><div class="ref-incoming-main"><h2>'+title+'</h2>'+(copy?'<p>'+copy+'</p>':'')+(n===null?'':steps(n)+'<div class="ref-progress-caption"><strong>'+n+' / 5 desek hotovo</strong></div>')+'</div><div class="ref-visual">'+artwork+(m.paid?earnedReward:reward)+'</div></div>';
 function incomingCopy(){
  if(!m.accepted)return incomingHeading(esc(m.inviterName)+' tě zve do Propletu.','Dohraj 5 desek a získejte bonus oba.',null)+'<div class="ref-action-row">'+'<button class="secondary-btn ref-wide" data-ref-accept>Přijmout pozvánku</button></div><small class="ref-rule">'+rule+'</small>';
  if(m.paid)return incomingHeading('Bonus máš ty i '+esc(m.inviterName)+'.','',5)+'<div class="ref-action-row"><span class="ref-paid-note">✓ Připsáno do celkových XP</span></div><small class="ref-rule">'+rule+'</small>';
  const left=5-m.count,title='Ještě '+left+' '+(left===1?'deska':left<5?'desky':'desek')+'.';
  return incomingHeading(title,'Bonus získáte oba: ty i '+esc(m.inviterName)+'.',m.count)+'<div class="ref-action-row">'+'<button class="secondary-btn ref-wide" data-ref-play>Vybrat další hru <span aria-hidden="true">→</span></button></div><small class="ref-rule">'+rule+'</small>';
 }
 const invitationOffer=()=>'<button class="ref-card-close" data-ref-home-close aria-label="Skrýt nabídku pozvání">×</button>'+heading('Pozvi někoho<br>do Propletu.','Sdílejte radost z hraní. Za prvních 5 desek kamaráda získáte oba bonus.')+'<button class="secondary-btn ref-wide" data-ref-open>Pozvi kamaráda <span aria-hidden="true">→</span></button>';
 function renderHome(){
  if(!m.ready){$('#referralHome')?.remove();$('#referralInviteHome')?.remove();return}
  let card=$('#referralHome');
  if(!card){card=document.createElement('aside');card.id='referralHome';card.className='card ref-home'}
  const showIncoming=m.incoming&&(!m.paid||!rewardHidden());
  const anchor=showIncoming?$('#screen-daily .daily-hero'):($('#tajenkaPreviewCard')||$('#quickPlayCard'));
  if(!anchor)return;
  if(anchor.nextElementSibling!==card)anchor.after(card);
  card.classList.toggle('ref-incoming',showIncoming);card.classList.toggle('ref-paid',showIncoming&&m.paid);
  card.hidden=!showIncoming&&sessionStorage.getItem(offerKey())==='1';
  card.innerHTML=showIncoming?(m.paid?dismissReward:'')+incomingCopy():invitationOffer();
  wire(card);
  let own=$('#referralInviteHome');
  if(showIncoming&&canInvite()){
   if(!own){own=document.createElement('aside');own.id='referralInviteHome';own.className='card ref-home ref-own-invite'}
   ($('#tajenkaPreviewCard')||$('#quickPlayCard')).after(own);
   own.hidden=sessionStorage.getItem(offerKey())==='1';own.innerHTML=invitationOffer();wire(own);
  }else own?.remove();
 }
 function renderProfile(){
  if(!m.ready||!transport.profile()?.id){$('#referralProfile')?.remove();$('#referralProfileReward')?.remove();return}
  let card=$('#referralProfile');if(!card){card=document.createElement('section');card.id='referralProfile';card.className='card ref-profile';$('#profileCard')?.after(card)}
  if(!card)return;
  const rows=m.referrals.map(r=>'<div class="ref-person"><div class="ref-avatar">'+esc(r.avatar||'🙂')+'</div><div><strong>'+esc(r.name)+'</strong><small>'+(r.paid?'Bonus připsán oběma':r.accepted?r.count+' / 5 desek':'Čeká na přijetí')+'</small></div><span class="ref-person-state">'+(r.paid?'+1 000 XP':r.accepted?r.count+'/5':'Čeká')+'</span></div>').join('');
  card.classList.toggle('ref-incoming',m.incoming);card.classList.toggle('ref-paid',m.paid);
  let earned=$('#referralProfileReward');
  if(m.incoming&&m.paid&&!rewardHidden()){
   if(!earned){earned=document.createElement('section');earned.id='referralProfileReward';earned.className='card ref-profile ref-incoming ref-paid'}
   card.before(earned);earned.innerHTML=dismissReward+incomingCopy();wire(earned);
  }else earned?.remove();
  card.classList.toggle('ref-incoming',m.incoming&&!m.paid);card.classList.remove('ref-paid');
  card.innerHTML=m.incoming&&!m.paid?incomingCopy():'<div class="ref-profile-head"><div><h2>Pozvaní kamarádi</h2><p>Pět desek. Tisíc pro každého.</p></div><span class="xp-sticker">+1 000 XP</span></div><button class="primary-btn" data-ref-open>Pozvat dalšího kamaráda</button><p class="ref-policy">'+rule+'</p><div class="ref-people">'+rows+'</div><details class="ref-rules"><summary>Jak se počítá pět desek?</summary><p>Kamarád přijme tvůj odkaz a vytvoří si nový účet. Potom dohraje 5 různých desek v libovolné kombinaci: Dnešní výzva, Tajenka i Volná hra. Není potřeba hrát pět dní.</p><p>Nápověda ani klidný režim bonusu nebrání. Opakování stejné desky a úvodní trénink se nepočítají. Bonus se přidělí oběma jednou.</p></details>';
  wire(card);
 }
 function offer(){
  const secondary=$('#winModal .win-secondary-actions');if(!secondary)return;
  let card=$('#referralWin');
  if(!card){card=document.createElement('aside');card.id='referralWin';card.className='ref-win';secondary.before(card)}
  const g=typeof currentGame!=='undefined'?currentGame:null;
  card.hidden=!m.ready||!m.incoming||!g||!g.finished||['starter','rescue'].includes(g.mode)||g.isReplay||offerDismissed||(m.paid&&(!lastReward||rewardHidden()));
  if(card.hidden)return;
  card.classList.toggle('ref-earned',lastReward);
  card.innerHTML=lastReward?dismissReward+'<h3>Bonus máš ty i '+esc(m.inviterName)+'.</h3>'+earnedReward:'<div class="ref-result-progress"><strong>'+m.count+' / 5 desek k bonusu</strong>'+reward+'</div>'+steps(m.count);
  wire(card);
 }
 function wire(root){
  root.querySelectorAll('[data-ref-home-close]').forEach(b=>b.onclick=()=>{sessionStorage.setItem(offerKey(),'1');renderHome()});
  root.querySelectorAll('[data-ref-open]').forEach(b=>b.onclick=()=>open('invite',null,sourceFor(b)));
  root.querySelectorAll('[data-ref-accept]').forEach(b=>b.onclick=()=>open('accept'));
  root.querySelectorAll('[data-ref-play]').forEach(b=>b.onclick=()=>{close();if(typeof closeTransientModals==='function')closeTransientModals();nav('free')});
  root.querySelectorAll('[data-ref-reward-close]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await transport.dismiss();preferences.setItem(rewardKey(),'1');refresh()}catch(e){b.disabled=false;if(typeof showToast==='function')showToast(e.message)}});
  root.querySelectorAll('[data-ref-dismiss]').forEach(b=>b.onclick=()=>{offerDismissed=true;root.hidden=true});
 }
 async function open(kind,shareSource=null,entrySource=shareSource?sourceFor(shareSource):'home'){
  if(kind==='invite'&&!transport.profile()?.id){close();openProfileModal('create');return}
  if(kind==='invite'){try{await transport.ensureInvite()}catch(e){if(typeof showToast==='function')showToast(e.message);return}}
  if(kind==='announcement'){
   const account=transport.profile()?.id;if(!await artworkReady())return;
   if(announcementBlocked()||account!==transport.profile()?.id||!canInvite()||preferences.getItem(announcementKey())==='1'||!$('#screen-daily')?.classList.contains('active')||document.querySelector('.modal:not(.hidden)')||document.body.classList.contains('playing'))return;
  }
  if(!$('#referralDialog')){
   const modal=document.createElement('div');modal.id='referralDialog';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','refDialogTitle');modal.innerHTML='<div class="modal-card left ref-sheet"></div>';document.body.append(modal);
   modal.addEventListener('click',e=>{if(e.target===modal)close()});
  }
  if($('#referralDialog').classList.contains('hidden'))originFocus=document.activeElement;
  $('#referralDialog').dataset.entrySource=kind==='announcement'?'announcement':entrySource;
  if(kind==='announcement'){
   const sheet=$('#referralDialog .ref-sheet');sheet.classList.add('ref-announcement');
   sheet.innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít nabídku pozvání">×</button>'+heading('Pozvi někoho<br>do Propletu.','Za prvních 5 desek kamaráda získáte oba bonus.')+'<button class="primary-btn" data-ref-open>Pozvi kamaráda do Propletu</button>';
   sheet.querySelector('h2').id='refDialogTitle';sheet.querySelector('h2').tabIndex=-1;
   $('#referralDialog').classList.remove('hidden');wire(sheet);sheet.querySelector('[data-ref-close]').onclick=close;
   preferences.setItem(announcementKey(),'1');$('#refDialogTitle').focus();return;
  }
  $('#referralDialog .ref-sheet').classList.remove('ref-announcement');
  if(kind==='choice'){
   $('#referralDialog .ref-sheet').innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít pozvánku">×</button><h2 id="refDialogTitle" tabindex="-1">Pozvi kamaráda</h2><div class="ref-choice"><button class="primary-btn" id="refShareBoard">Poslat tuhle desku</button><p>Kamarád si zahraje stejnou desku a porovnáte výsledky.</p><div class="ref-choice-bonus">'+artwork+reward+'</div><button class="primary-btn" data-ref-open>Pozvat nového hráče</button><p>Po jeho prvních pěti deskách získáte oba bonus.</p></div>';
   $('#referralDialog').classList.remove('hidden');wire($('#referralDialog'));
   $('#referralDialog [data-ref-close]').onclick=close;
   $('#refShareBoard').onclick=()=>{close();forwardingShare=true;try{shareSource?.click()}finally{forwardingShare=false}};
   $('#refDialogTitle').focus();return;
  }
  const accept=kind==='accept';
  $('#referralDialog .ref-sheet').innerHTML='<button class="modal-close" data-ref-close aria-label="Zavřít pozvánku">×</button><div class="ref-sheet-art">'+artwork+'</div><h2 id="refDialogTitle" tabindex="-1">'+(accept?esc(m.inviterName)+' tě zve do Propletu.':'Pozvi kamaráda.<br>Tisíc XP pro každého.')+'</h2><ol class="ref-how"><li><span>1</span><div><strong>'+(accept?'Vytvoř si účet':'Pošli pozvánku')+'</strong><small>'+(accept?'Nový hráč přijme pozvánku při registraci.':'Odkaz je tvůj. Můžeš ho poslat více kamarádům.')+'</small></div></li><li><span>2</span><div><strong>'+(accept?'Dohraj 5 různých desek':'Kamarád dohraje 5 desek')+'</strong><small>Dnešní výzva, Tajenka i Volná hra. Klidně v jediný den.</small></div></li><li><span>3</span><div><strong>Oba dostanete +1 000 XP</strong><small>Odměna se připíše po páté dokončené desce.</small></div></li></ol><div class="ref-policy">'+rule+'</div>'+(accept?'<button id="refCreateAccount" class="primary-btn big">Vytvořit účet a přijmout</button><button class="text-btn" data-ref-close>Zatím si jen zahrát</button>':'<button id="refShare" class="primary-btn big">Pozvi kamaráda do Propletu</button><div class="ref-link-row"><input id="refLink" aria-label="Odkaz na pozvánku" readonly value="'+esc(inviteUrl())+'"><button id="refCopy" class="secondary-btn">Kopírovat</button></div>')+'<p id="refStatus" class="ref-status" role="status"></p>';
  $('#referralDialog').classList.remove('hidden');
  $('#referralDialog').querySelectorAll('[data-ref-close]').forEach(b=>b.onclick=close);
  if(accept)$('#refCreateAccount').onclick=()=>{
   close();openProfileModal('create');
   $('#profileModalTitle').textContent='Pozvánka: '+m.inviterName;
   $('#profileModalDesc').textContent='Po 5 deskách získáte oba +1 000 XP. Bonus je pouze do celkového pořadí, bez týdenních XP.';
   $('#saveProfileBtn').textContent='Vytvořit účet a přijmout';
  };
  else{
   track('referral_invite_dialog_opened',entrySource);
   const actor=transport.profile()?.id,status=$('#refStatus'),input=$('#refLink');
   let pending=false;
   const current=()=>transport.profile()?.id===actor;
   const emit=(event,method)=>{if(current())track(event,entrySource,method)};
   const copy=async method=>{
    try{await navigator.clipboard.writeText(input.value);emit('referral_copy_succeeded',method);if(current())status.textContent='Odkaz zkopírován. Pošli ho kamarádovi.'}
    catch{emit('referral_copy_failed',method);if(current()){input.focus();input.select();status.textContent='Označený odkaz zkopíruj ručně.'}}
   };
   const perform=async action=>{
    if(pending)return;pending=true;
    try{await action()}finally{pending=false}
   };
   $('#refCopy').onclick=()=>perform(()=>copy('copy_button'));
   $('#refShare').onclick=()=>perform(async()=>{
    emit('referral_share_requested');
    const data={title:'Pojď si zahrát Proplet',text:'Pět desek. Tisíc pro každého. Přidej se přes mou pozvánku a oba získáme +1 000 XP do celkového pořadí.',url:input.value};
    if(navigator.share){
     try{await navigator.share(data);emit('referral_share_native_resolved');if(current())status.textContent='Pozvánka předána ke sdílení.'}
     catch(e){if(e.name==='AbortError')emit('referral_share_native_cancelled');else{emit('referral_share_native_failed');if(current())await copy('share_fallback')}}
    }else await copy('no_native');
   });
  }
  $('#refDialogTitle').focus();
 }
 function close(){const modal=$('#referralDialog');if(!modal||modal.classList.contains('hidden'))return;modal.classList.add('hidden');originFocus?.focus({preventScroll:true})}
 let artworkPromise;
 function artworkReady(){
  if(!artworkPromise)artworkPromise=Promise.all(['/assets/avatars/referral-jezek.webp','/assets/avatars/referral-liska.webp'].map(src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=src}))).then(results=>{const ok=results.every(Boolean);if(!ok)artworkPromise=null;return ok});
  return artworkPromise;
 }
 function announcementBlocked(){return (typeof onboardingMandatory!=='undefined'&&onboardingMandatory)||(typeof dailyExtraIntroPending==='function'&&dailyExtraIntroPending())||!!window.PropletFirstSteps?.quiet()}
 function scheduleAnnouncement(){
  clearTimeout(announcementTimer);
  if(announcementBlocked()||!m.ready||!canInvite()||preferences.getItem(announcementKey())==='1'||(m.incoming&&!rewardHidden()))return;
  announcementTimer=setTimeout(()=>{
   if(!canInvite()||preferences.getItem(announcementKey())==='1'||!$('#screen-daily')?.classList.contains('active')||document.querySelector('.modal:not(.hidden)')||document.body.classList.contains('playing'))return;
   open('announcement');
  },1200);
 }
 function refresh(){document.body.classList.toggle('referral-incoming',m.ready&&m.incoming);renderHome();renderProfile();offer();scheduleAnnouncement()}
 async function reload(force=false){await transport.load(force);refresh()}
 function boot(){
  if(booted)return;booted=true;reload(true);artworkReady();document.addEventListener('click',e=>{const source=e.target.closest?.('#winShareBtn.challenge-share-cta, #shareDailyBtn, #screen-daily [data-tajenka-share]');if(source&&!source.disabled&&!forwardingShare&&canInvite()){e.preventDefault();e.stopImmediatePropagation();open('choice',source)}},true);
  registerGameCompletionHook({id:'referrals',priority:250,after:async({game})=>{
   if(!transport.profile()?.id||!game||['starter','rescue'].includes(game.mode)||game.isReplay)return;
   offerDismissed=false;const wasPaid=m.paid;
   if(typeof syncQueue==='function')await syncQueue({announce:false});
   await transport.load(true);lastReward=!wasPaid&&m.paid;refresh();
  }});
  document.addEventListener('proplet:screen-changed',()=>reload());
  document.addEventListener('proplet:account-changed',()=>{close();m.ready=false;lastReward=false;refresh();reload(true)});
  document.addEventListener('proplet:profile-refreshed',()=>reload(true));
  window.addEventListener('online',()=>reload(true));
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

