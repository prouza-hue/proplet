/* Shared patron UI. Entitlements and payment references are server-owned. */
(()=>{
 'use strict';
 const request=(path,options={})=>api(path,options);
 let stateGeneration=0,accountEpoch=0,started=false,qrDownloadUrl=null;
 let welcomePublic=false,welcomeSaving=false,messageExpanded=false,giftShown=false,giftSaving=false,giftDraft='';
 function clearQrDownload(){if(qrDownloadUrl){URL.revokeObjectURL(qrDownloadUrl);qrDownloadUrl=null;}}
 async function saveQr(svg,maySave=()=>true){
  const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));await image.decode();
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=768;
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG export failed')),'image/png'));
  if(!maySave())return false;
  clearQrDownload();qrDownloadUrl=URL.createObjectURL(png);
  const link=document.createElement('a');link.href=qrDownloadUrl;link.download='Proplet-QR-platba.png';document.body.append(link);link.click();link.remove();return true;
 }
 const profile=()=>typeof getProfile==='function'?getProfile():null;
 const $=s=>document.querySelector(s);
 const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20S3 14.5 3 8.5C3 3 10 2.5 12 7c2-4.5 9-4 9 1.5C21 14.5 12 20 12 20Z" fill="currentColor"/></svg>';
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague'}).format(new Date());
 const recommendedAmount='129';
 const model={frequency:'once',amount:Number(recommendedAmount),paid:false,badgeType:null,recurringStatus:null,thanksPending:false,personalGift:null,contributions:[],monthFunding:null,public:false,offersDisabled:false,enabled:false,authenticated:false,canOffer:false,step:'offer',returnFocus:null,selected:recommendedAmount,intent:null,payment:null,pending:false,error:''};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('cs-CZ').format(n)+' Kč';
 function fundingProgress(){
  const value=model.monthFunding;
  if(!value||value.month!==today().slice(0,7)||!Number.isSafeInteger(value.raisedCzk)||value.raisedCzk<0||!Number.isSafeInteger(value.goalCzk)||value.goalCzk<=0)return '';
  const remaining=Math.max(0,value.goalCzk-value.raisedCzk);
  return `<div class="patron-funding"><div><span>Podpora tento měsíc</span><strong>${esc(money(value.raisedCzk))} / ${esc(money(value.goalCzk))}</strong></div><progress max="${value.goalCzk}" value="${Math.min(value.raisedCzk,value.goalCzk)}" aria-label="Potvrzená podpora tento měsíc: ${esc(money(value.raisedCzk))} z cíle ${esc(money(value.goalCzk))}"></progress><span class="patron-funding-remaining">${remaining?'Zbývá '+esc(money(remaining)):'Základní provoz pokrytý'}</span></div>`;
 }
 const paidDate=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'Datum není dostupné':new Intl.DateTimeFormat('cs-CZ',{timeZone:'Europe/Prague',dateStyle:'medium'}).format(d);};
 async function refresh(){const epoch=accountEpoch,generation=++stateGeneration;try{const value=await request('/api/patrons?visibility=true');if(epoch!==accountEpoch||generation!==stateGeneration)return;Object.assign(model,{enabled:value.enabled===true,authenticated:value.authenticated===true,paid:value.patron===true,badgeType:value.patron===true?(value.badgeType==='recurring'?'recurring':'supporter'):null,recurringStatus:value.patron===true&&value.recurringStatus&&typeof value.recurringStatus==='object'?value.recurringStatus:null,thanksPending:value.thanksPending===true,personalGift:value.personalGift||null,contributions:Array.isArray(value.contributions)?value.contributions:[],public:value.publicBadge===true,offersDisabled:value.offersDisabled===true,canOffer:value.canOffer===true,monthFunding:value.monthFunding||null});decorate();if($('#patronDialog')?.open&&model.step==='thanks')render();window.PropletAnnouncements?.kick();}catch{if(epoch===accountEpoch){model.canOffer=false;model.error='Podporu se teď nepodařilo načíst. Hra funguje dál.';}}}
 async function preference(next){try{await request('/api/patrons/preferences',{method:'POST',body:JSON.stringify(next)});await refresh();}catch{model.error='Změnu se nepodařilo uložit. Zkus to prosím znovu.';render();}}
 async function createIntent(){if(model.pending)return;if(!model.authenticated){close();if(typeof openProfileModal==='function')openProfileModal('login');return;}const epoch=accountEpoch,firstPaymentDate=model.frequency==='monthly'?today():'';if(model.requestAmount!==[model.amount,model.frequency,firstPaymentDate].join(':')||!model.requestId){model.requestId=crypto.randomUUID();model.requestAmount=[model.amount,model.frequency,firstPaymentDate].join(':');}model.pending=true;model.error='';render();try{const value=await request('/api/patrons/intents',{method:'POST',body:JSON.stringify({requestId:model.requestId,amountCzk:model.amount,frequency:model.frequency,...(model.frequency==='monthly'?{firstPaymentDate}:{})})});if(epoch!==accountEpoch||!model.enabled)return;model.intent=value.intent;model.payment=value.payment;model.step='qr';model.canOffer=false;}catch(error){console.error('Patron QR preparation failed',error);if(epoch===accountEpoch)model.error='QR se nepodařilo připravit. Zkus to znovu — nevznikne tím druhá platba.';}finally{if(epoch===accountEpoch){model.pending=false;render();$('#patronTitle')?.focus({preventScroll:true});}}}

 const art='<img class="patron-art" src="/assets/support/patron-letterpress-v1.webp" alt="" width="144" height="144">';
 const badgeName=type=>type==='recurring'?'Pravidelný podporovatel':'Podporovatel';
 const badgeClass=type=>type==='recurring'?' patron-recurring':'';
 const badgeLabel=type=>`<span class="patron-label-full">${badgeName(type)}</span>${type==='recurring'?'<span class="patron-label-compact" aria-hidden="true">Pravidelně</span>':''}`;
 const seal=type=>`<button type="button" class="patron-label${badgeClass(type)}" aria-label="${badgeName(type)} Propletu — poděkování" data-patron-thanks>${badgeLabel(type)}</button>`;
 const avatarDemo=(avatar,type)=>'<span class="patron-avatar-demo'+badgeClass(type)+'"><span class="patron-avatar-native" data-player-avatar="'+esc(avatar||'🙂')+'">'+esc(avatar||'🙂')+'</span><i>'+heart+'</i></span>';
 function ownStatus(){
  if(model.badgeType==='recurring'){
   const status=model.recurringStatus;
   return status?.state==='grace'?'<p class="patron-status">Čekáme na další měsíční převod. Pravidelná značka zatím zůstává'+(status.graceUntil?' do '+esc(paidDate(status.graceUntil)):'')+'. Pokud platba nepřijde, vystřídá ji modrá značka jako trvalé poděkování.</p>':'<p class="patron-status">Díky za pravidelnou podporu. Značku obnovuje každý další potvrzený měsíční převod. Když podpora skončí, zůstane ti modrá značka jako trvalé poděkování.</p>';
  }
  return '<p class="patron-status">'+(model.recurringStatus?.state==='expired'?'Další měsíční příspěvek zatím nemáme potvrzený. Modrá značka ti zůstává jako trvalé poděkování. Další potvrzený měsíční převod pravidelnou značku obnoví.':'Modrá značka ti zůstává jako trvalé poděkování. Měsíční podporou můžeš získat krémovou značku s červeným srdcem už po prvním potvrzeném převodu.')+'</p>';
 }

 function ensure(){
  if($('#patronDialog'))return;
  const el=document.createElement('dialog');el.id='patronDialog';el.setAttribute('aria-labelledby','patronTitle');document.body.append(el);
  const fitViewport=()=>{el.style.setProperty('--patron-viewport-height',(window.visualViewport?.height||window.innerHeight)+'px');el.style.setProperty('--patron-viewport-top',(window.visualViewport?.offsetTop||0)+'px');};
  fitViewport();window.addEventListener('resize',fitViewport);
  window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);
  el.addEventListener('click',e=>{if(e.target===el)close()});el.addEventListener('cancel',e=>{e.preventDefault();close()});

 }
 function close(){clearQrDownload();const el=$('#patronDialog');if(el?.open)el.close();model.returnFocus?.isConnected&&model.returnFocus.focus({preventScroll:true});}
 function open(step='offer',from=document.activeElement){if(!model.enabled)return;$('#patronOffer')?.remove();if(step==='offer'&&model.paid){model.requestId=null;model.requestAmount=null;model.intent=null;model.payment=null;}if(step==='offer'){messageExpanded=false;if(!model.requestId&&!model.intent&&!model.pending){model.frequency='once';model.selected=recommendedAmount;model.amount=Number(recommendedAmount);}}ensure();model.error='';model.returnFocus=from;model.step=step;render();if(!$('#patronDialog').open)$('#patronDialog').showModal();$('#patronTitle')?.focus({preventScroll:true});}
 const recurringWarning=()=>'<aside class="patron-recurring-warning" role="note"><strong>Zkontroluj měsíční opakování</strong><p>Některé banky načtou QR jen jako jednorázovou platbu. Pokud se opakování nenastaví, založ ve své bance trvalý příkaz <b>každý měsíc</b>. Zachovej stejný účet, částku a variabilní symbol.</p><details class="patron-bank-help"><summary>Jak je to u mé banky?</summary><p><b>KB:</b> banka uvádí založení trvalého příkazu z QR. Před potvrzením ověř měsíční opakování. <a href="https://www.kb.cz/cs/o-bance/spokojenost-klientu" target="_blank" rel="noopener noreferrer">Informace KB</a></p><p><b>Raiffeisenbank:</b> banka tuto možnost uvádí, při našem vyzkoušení na Androidu se ale opakování nepředvyplnilo. Počítej i s ručním nastavením. <a href="https://www.rb.cz/osobni/ucty/sluzby-k-uctum/mobilni-bankovnictvi" target="_blank" rel="noopener noreferrer">Informace Raiffeisenbank</a></p><p><b>Partners:</b> při vyzkoušení na Androidu se načetla jednorázová platba. Měsíční opakování nastav ručně.</p><p>U ostatních aplikací nemáme automatické nastavení ověřené. Podpora se může lišit podle verze aplikace. Aktualizováno 1. 11. 2026.</p><p>Pokud už první platba odešla, nastav trvalý příkaz až od dalšího měsíce, ať neposíláš příspěvek dvakrát.</p></details></aside>';
 function heading(title,copy){return `<header class="patron-intro">${art}<div><h2 id="patronTitle" tabindex="-1">${title}</h2>${copy?`<p>${copy}</p>`:''}</div></header>`;}
 function render(){
  const dialog=$('#patronDialog');if(!dialog)return;clearQrDownload();let content='';
  if(model.step==='offer'){
   content='<form id="patronForm"><div class="patron-offer-scroll">'+heading('Pomoz Propletu zůstat ve hře.')+
    (messageExpanded?`<div class="patron-offer-copy" id="patronMessage">
      <p>Proplet je zdarma a moc bych si přál, aby to tak zůstalo.</p>
      <p>Jenže ani hra zdarma se neobejde bez nákladů. Za její provoz a nástroje, které používám při vývoji, platím přes 2 000 Kč měsíčně. Zatím jde většina z mojí kapsy.</p>
      <p>Pokud tě Proplet baví, budu rád, když mi pomůžeš udržet ho v chodu a dál ho vylepšovat. Třeba i malým měsíčním příspěvkem. Každá podpora se počítá.</p>
      <p>Díky, že hraješ. A pokud se rozhodneš přispět, díky o to víc!</p>
      <p>— Pavel</p>
    </div>`:`<div class="patron-offer-copy" id="patronMessage">
      <p>Proplet je zdarma a rád bych, aby to tak zůstalo. Jeho provoz a vývoj mě ale stojí přes 2 000 Kč měsíčně, které zatím platím převážně sám.</p>
      <p>Pokud tě Proplet baví, budu rád, když mi s tím pomůžeš. Díky!</p>
      <p>— Pavel</p>
    </div>`)+
    `<button type="button" class="patron-message-toggle" aria-expanded="${messageExpanded}" aria-controls="patronMessage">${messageExpanded?'Zkrátit vzkaz':'Pár slov ode mě'} <span aria-hidden="true">${messageExpanded?'⌃':'⌄'}</span></button>`+
    fundingProgress()+
    '<fieldset class="patron-frequency"><legend class="os-sr">Četnost podpory</legend><div>'+[['once','Jednorázově'],['monthly','Měsíčně']].map(([v,label])=>`<label><input type="radio" name="frequency" value="${v}" ${model.frequency===v?'checked':''}><span>${label}</span></label>`).join('')+'</div></fieldset><fieldset><legend>Výše příspěvku</legend><div class="patron-amounts">'+['79',recommendedAmount,'199','custom'].map(v=>`<label class="patron-amount"><input type="radio" name="amount" value="${v}" ${model.selected===v?'checked':''}><span>${v==='custom'?'Jiná částka':money(Number(v))}${v===recommendedAmount?'<small>Doporučeno</small>':''}</span></label>`).join('')+'</div></fieldset>'+
    `<label class="patron-custom" ${model.selected==='custom'?'':'hidden'}>Částka v Kč<input name="custom" id="patronCustom" inputmode="numeric" type="number" min="1" max="100000" step="1" value="${model.selected==='custom'?model.amount:recommendedAmount}"></label>`+
    '<details class="patron-perk-details"><summary aria-label="Ukázka tvé značky podpory — podrobnosti"><span class="patron-offer-avatar">'+avatarDemo(profile()?.avatar,model.frequency==='monthly'?'recurring':'supporter')+'</span><span class="patron-offer-identity"><strong>'+esc(profile()?.name||'Ty')+'</strong><span class="patron-label-static'+badgeClass(model.frequency==='monthly'?'recurring':'supporter')+'">'+heart+badgeName(model.frequency==='monthly'?'recurring':'supporter')+'</span></span><span aria-hidden="true">⌄</span></summary><p>'+(model.frequency==='monthly'?'Červené srdíčko získáš po první potvrzené měsíční platbě. Další platby ho obnovují. Při ukončení podpory ti zůstane modrá značka.':'Modrá značka ti zůstane jako trvalé poděkování po potvrzení příspěvku.')+' Zobrazení u jména je dobrovolné a můžeš ho kdykoli změnit v nastavení. Částka se nezveřejňuje.</p></details>'+
    (model.frequency==='monthly'?'<p class="patron-frequency-note">Měsíční opakování nastavíš ve své bance. QR ho nemusí předvyplnit.</p>':'')+
    '</div><div class="patron-offer-footer">'+
    `<button class="primary-btn patron-primary" type="submit" ${model.pending?'disabled':''}>${model.pending?'Připravuji QR…':model.authenticated?(model.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(model.amount)+' · QR':'Přihlásit se a připravit QR'} <span aria-hidden="true">→</span></button><p class="patron-payment-note">${model.authenticated?'Zobrazení QR není platba. Převod zadáš ve své bance.':'Přihlášení bezpečně propojí příspěvek s tvým účtem.'}</p></div></form>`;
  }else if(model.step==='qr'){
   const intent=model.intent,payment=model.payment;if(!intent||!payment){model.step='offer';render();return;}
   const image='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(payment.qrSvg)));
   content='<button class="text-btn patron-back" data-back>← Změnit částku</button>'+heading(intent.frequency==='monthly'?'Měsíční podpora přes QR':'Podpora přes QR',(intent.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(intent.amountCzk)+' bankovním převodem.')+
    (intent.frequency==='monthly'?recurringWarning():'')+
    `<div class="patron-qr"><img src="${image}" width="256" height="256" alt="Platební QR na ${money(intent.amountCzk)}"><div><strong>Naskenuj QR ve své bance</strong><dl class="patron-bank-details"><dt>Účet</dt><dd>${esc(intent.account)}</dd><dt>Variabilní symbol</dt><dd>${esc(intent.reference)}</dd><dt>Zpráva</dt><dd>${esc(intent.message)}</dd></dl></div></div>`+
    `<div class="patron-qr-actions"><button class="secondary-btn" data-save>Uložit QR · PNG</button><button class="secondary-btn" data-copy>Kopírovat údaje</button></div><p id="patronCopyStatus" role="status" class="patron-copy-status"></p>`+
    (intent.frequency==='monthly'?'<p class="patron-qr-hint">Trvalý příkaz můžeš později změnit nebo zrušit ve své bance.</p>':'')+
    '<p class="patron-qr-hint">Na stejném telefonu si QR uložíš a načteš v bankovní aplikaci, pokud to podporuje. Údaje můžeš také zkopírovat.</p>'+
    '<div class="patron-pending"><span class="patron-pending-dot"></span><p>'+'QR je připravené, platba zatím není potvrzená. Značku přidáme až po ověření příchozího převodu. Hledáme ho podle variabilního symbolu, ne podle přezdívky.'+'</p></div><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else if(model.step==='gift'){
   content='<h2 id="patronTitle" tabindex="-1">Osobní poděkování od Pavla</h2><div class="patron-gift-letter">'+(model.personalGift?.paragraphs||[]).map(p=>'<p>'+esc(p)+'</p>').join('')+'<p>— Pavel</p></div>'+
    '<form id="patronGiftForm"><label for="patronGiftMotif">Jaký motiv by Vám udělal radost?</label><textarea id="patronGiftMotif" maxlength="1000" rows="3" required placeholder="Třeba rys, hory nebo něco úplně jiného…">'+esc(giftDraft)+'</textarea><p class="patron-gift-private">Odpověď se nezveřejní; přijde mi do správy Propletu.</p><button type="submit" class="primary-btn patron-primary" '+(giftSaving?'disabled':'')+'>Odeslat přání</button></form><button class="text-btn patron-dismiss" data-gift-later>Promyslím si to</button><button class="text-btn patron-dismiss" data-gift-decline>Děkuji, odznak nechci</button>';
  }else if(model.step==='gift-sent'){
   content='<h2 id="patronTitle" tabindex="-1">Přání je uložené.</h2><p>Děkuju! Podívám se na něj a pustíme se do Vašeho odznaku. — Pavel</p><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else if(model.step==='welcome'){
   content='<div class="patron-welcome-art">'+art+'</div><h2 id="patronTitle" tabindex="-1">Díky, že držíš<br>Proplet ve hře.</h2>'+
    '<p class="patron-welcome-copy">Moc si tvé podpory vážím.<br>— Pavel</p>'+
    '<div class="patron-welcome-badge'+badgeClass(model.badgeType)+'">'+heart+'<span>Odznak podporovatele je tvůj</span></div>'+
    `<label class="patron-visibility"><input type="checkbox" id="patronWelcomePublic" ${welcomePublic?'checked':''}><span>Ukazovat můj odznak v žebříčcích<small>Kdykoli to můžeš změnit v nastavení. Částku nezveřejňujeme.</small></span></label>`+
    '<button class="primary-btn patron-primary" data-confirm-visibility>Zpátky do hry</button>';
  }else if(model.step==='thanks'){
   content=heading('Díky, že držíš Proplet ve hře.','Tvoje podpora dává další práci na Propletu smysl. Moc si jí vážím. — Pavel')+
    '<div class="patron-own-badge'+badgeClass(model.badgeType)+'">'+avatarDemo(profile()?.avatar,model.badgeType)+'<div><strong>'+esc(profile()?.name||'Podporovatel')+'</strong><span class="patron-label-static'+badgeClass(model.badgeType)+'">'+heart+badgeName(model.badgeType)+'</span></div></div>'+ownStatus()+
    `<label class="patron-visibility"><input type="checkbox" id="patronPublic" ${model.public?'checked':''}><span>Ukazovat mou značku ostatním<small>Zaplacenou částku nikdy nezobrazujeme.</small></span></label>`+
    (model.contributions.length?'<details class="patron-history"><summary>Tvoje potvrzené příspěvky</summary><ul>'+model.contributions.map(p=>'<li><span>'+esc(paidDate(p.confirmedAt))+' · '+(p.frequency==='monthly'?'Měsíční převod':'Jednorázově')+'</span><strong>'+esc(money(p.amountCzk))+'</strong></li>').join('')+'</ul><p>Posledních nejvýše 50 ověřených převodů. Platby čekající na ověření tu ještě nejsou.</p></details>':'')+
    '<p class="patron-qr-hint">Případný trvalý příkaz můžeš změnit nebo zastavit ve své bance. Proplet platby sám nestrhává.</p><button class="secondary-btn patron-primary" data-contribute-again>Přispět znovu</button><button class="primary-btn patron-primary" data-close>Zpátky do hry</button>';
  }else{
   const avatar=model.personAvatarNodes?.length?'<span class="patron-person-avatar"></span>':model.personAvatar?'<span class="patron-avatar-native" data-player-avatar="'+esc(model.personAvatar)+'">'+esc(model.personAvatar)+'</span>':model.personArt?'<img src="'+esc(model.personArt)+'" width="56" height="56" alt="">':'<span class="patron-avatar-native" data-player-avatar="🙂">🙂</span>';
   content='<header class="patron-person-intro"><span class="patron-avatar-demo'+badgeClass(model.personBadgeType)+'">'+avatar+'<i>'+heart+'</i></span><div><h2 id="patronTitle" tabindex="-1">'+esc(model.personName||'Podporovatel')+'</h2><span class="patron-label-static'+badgeClass(model.personBadgeType)+'">'+heart+badgeName(model.personBadgeType)+'</span></div></header><p class="patron-person-copy">'+(model.personBadgeType==='recurring'?'Pravidelně podporuje provoz a další rozvoj Propletu. Krémová značka s červeným srdcem patří aktuální měsíční podpoře. Vlastní značku získáš už po prvním potvrzeném měsíčním převodu.':'Podporuje provoz a další rozvoj Propletu. Podpoř Proplet a získej vlastní značku podporovatele.')+'</p>'+
    '<button class="primary-btn patron-primary" data-support>Podpořit Proplet <span aria-hidden="true">→</span></button><button class="text-btn patron-dismiss" data-close>Zpátky do hry</button>';
  }
  dialog.setAttribute('data-patron-step',model.step);
  const error=model.error?'<p class="patron-error" role="alert">'+esc(model.error)+'</p>':'';
  if(model.step==='offer')content=content.replace('</div></form>',error+'</div></form>');
  dialog.innerHTML='<button class="patron-close" aria-label="Zavřít podporu">×</button>'+content+(model.step==='offer'?'':error);
  const personAvatar=dialog.querySelector('.patron-person-avatar');if(model.step==='other'&&personAvatar&&model.personAvatarNodes?.length)personAvatar.append(...model.personAvatarNodes.map(node=>node.cloneNode(true)));
  dialog.querySelector('.patron-close').onclick=close;dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  dialog.querySelector('[data-back]')?.addEventListener('click',()=>{model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true})});dialog.querySelector('[data-support]')?.addEventListener('click',()=>open('offer',model.returnFocus));
  dialog.querySelector('.patron-message-toggle')?.addEventListener('click',()=>{messageExpanded=!messageExpanded;render();dialog.querySelector('.patron-message-toggle')?.focus({preventScroll:true});});
  const giftForm=model.step==='gift'?dialog.querySelector('#patronGiftForm'):null;
  (model.step==='gift'?dialog.querySelector('#patronGiftMotif'):null)?.addEventListener('input',e=>{giftDraft=e.target.value;});
  giftForm?.addEventListener('submit',e=>{e.preventDefault();if(giftForm.reportValidity())void respondGift('answer');});
  dialog.querySelector('[data-gift-later]')?.addEventListener('click',()=>void respondGift('later'));
  dialog.querySelector('[data-gift-decline]')?.addEventListener('click',()=>void respondGift('decline'));
  const form=$('#patronForm');if(form){
   if(model.pending)form.querySelectorAll('input').forEach(input=>{input.disabled=true;});
   form.addEventListener('change',e=>{if(e.target.name==='frequency'){model.frequency=e.target.value;render();document.querySelector('#patronForm input[name=frequency]:checked')?.focus();return;}if(e.target.name==='amount'){model.selected=e.target.value;if(model.selected!=='custom')model.amount=Number(model.selected);render();if(model.selected==='custom')$('#patronCustom').focus();else document.querySelector('#patronForm input[name=amount]:checked')?.focus()}});
   $('#patronCustom').addEventListener('input',e=>{const n=Number(e.target.value);model.amount=n;form.querySelector('button[type=submit]').textContent=Number.isInteger(n)&&n>0?(model.frequency==='monthly'?'Měsíčně ':'Jednorázově ')+money(n)+' · QR →':'Zadej částku';});
   form.addEventListener('submit',e=>{e.preventDefault();if(!Number.isInteger(model.amount)||model.amount<1||model.amount>100000){$('#patronCustom').reportValidity();return}void createIntent();});
  }
  dialog.querySelector('[data-contribute-again]')?.addEventListener('click',()=>{model.requestId=null;model.requestAmount=null;model.intent=null;model.payment=null;model.step='offer';render();$('#patronTitle')?.focus({preventScroll:true});});
  dialog.querySelector('[data-confirm-visibility]')?.addEventListener('click',async e=>{
   if(welcomeSaving)return;
   const epoch=accountEpoch,button=e.currentTarget,input=$('#patronWelcomePublic');
   welcomePublic=input.checked;welcomeSaving=true;
   button.disabled=input.disabled=true;
   try{
    await request('/api/patrons/preferences',{method:'POST',body:JSON.stringify({publicBadge:welcomePublic})});
    if(epoch!==accountEpoch)return;
    if(dialog.open&&model.step==='welcome')close();
    await refresh();
   }catch{
    if(epoch===accountEpoch&&dialog.open&&model.step==='welcome'){
     model.error='Změnu se nepodařilo uložit. Zkus to prosím znovu.';render();
    }
   }finally{welcomeSaving=false;}
  });
  $('#patronPublic')?.addEventListener('change',e=>{void preference({publicBadge:e.target.checked})});
  dialog.querySelector('[data-save]')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await saveQr(model.payment.qrSvg);$('#patronCopyStatus').textContent='QR je připravené ke stažení jako PNG.';}catch{$('#patronCopyStatus').textContent='QR se nepodařilo uložit. Zkus to znovu nebo zkopíruj údaje.';}finally{button.disabled=false;}});
  dialog.querySelector('[data-copy]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(model.payment.spd);$('#patronCopyStatus').textContent='Zkopírovány přesné platební údaje z QR (SPAYD).';}catch{$('#patronCopyStatus').textContent='Kopírování není dostupné. Údaje jsou uvedené nad QR.';}});

 }
 function personName(row,name){return row.classList.contains('me')?profile()?.name||'Podporovatel':name.textContent.replace(/\s*Ty\s*$/,'').trim()||'Podporovatel';}
 async function respondGift(action){
  if(giftSaving||!model.personalGift)return;
  if(action==='answer'&&!giftDraft.trim())return;
  const epoch=accountEpoch;giftSaving=true;model.error='';render();
  try{
   const value=await request('/api/patrons/gift',{method:'POST',body:JSON.stringify({action,...(action==='answer'?{answer:giftDraft.trim()}:{})})});
   if(epoch!==accountEpoch)return;
   model.personalGift=value.gift;giftDraft='';
   if(action==='answer'&&value.gift?.status==='answered'){model.step='gift-sent';render();$('#patronTitle')?.focus({preventScroll:true});}else close();
  }catch{if(epoch===accountEpoch){model.error='Přání se nepodařilo uložit. Zkuste to prosím znovu.';render();}}
  finally{if(epoch===accountEpoch){giftSaving=false;if($('#patronDialog')?.open&&model.step==='gift')render();}}
 }
 function showPerson(row,name,from){if(!model.enabled||!row.classList.contains('patron-supported'))return;model.personBadgeType=row.classList.contains('patron-recurring')?'recurring':'supporter';model.personName=personName(row,name);model.personAvatarNodes=Array.from(row.querySelector('.result-player-avatar,.ranking-avatar')?.childNodes||[]).filter(node=>!node.classList?.contains('patron-avatar-card')).map(node=>node.cloneNode(true));model.personAvatar=row.querySelector('.result-player-avatar,.ranking-avatar')?.dataset.playerAvatar||null;model.personArt=row.querySelector('.result-player-avatar img,.leader-name img')?.getAttribute('src');open('other',from);}
 function resultAvatarControl(avatar,supported){
  if(!avatar)return null;const wasButton=avatar.tagName==='BUTTON';if(wasButton===supported)return avatar;
  const next=document.createElement(supported?'button':'span');next.className=avatar.className.replace(/\s*patron-avatar-info/g,'');next.dataset.playerAvatar=avatar.dataset.playerAvatar||'';
  if(avatar.dataset.organicAvatarKey)next.dataset.organicAvatarKey=avatar.dataset.organicAvatarKey;
  next.append(...avatar.childNodes);avatar.replaceWith(next);
  if(supported){next.type='button';next.classList.add('patron-avatar-info');}
  return next;
 }
 function decorateAvatar(avatar,supported,type){
  if(!avatar)return;
  avatar.classList.toggle('patron-avatar-marked',supported);avatar.classList.toggle('patron-recurring',supported&&type==='recurring');
  const card=avatar.querySelector('.patron-avatar-card');
  if(!supported){card?.remove();return;}
  if(!card){const mark=document.createElement('i');mark.className='patron-avatar-card';mark.setAttribute('aria-hidden','true');mark.innerHTML=heart;avatar.append(mark);}
 }
 function decorate(){
  if(!model.enabled){
   close();model.thanksPending=false;model.badgeType=null;model.recurringStatus=null;model.contributions=[];model.intent=null;model.payment=null;model.pending=false;model.requestId=null;model.requestAmount=null;
   for(const node of document.querySelectorAll('#patronProfileEntry,#patronTodayLink,#patronOfferPreference,#patronBadgePreference,#patronOffer,.patron-label'))node.remove();
   for(const avatar of document.querySelectorAll('.patron-avatar-marked'))decorateAvatar(avatar,false);
   for(const row of document.querySelectorAll('.patron-supported')){row.classList.remove('patron-supported');row.classList.remove('patron-recurring');}
   for(const avatar of document.querySelectorAll('.result-player-avatar.patron-avatar-info'))resultAvatarControl(avatar,false);
   return;
  }
  if(!model.authenticated||model.paid||model.offersDisabled||model.pending)$('#patronOffer')?.remove();
  for(const avatar of document.querySelectorAll('#profileChipAvatar,.profile-avatar-big'))decorateAvatar(avatar,model.authenticated&&model.paid,model.badgeType);
  const card=$('#profileCard');if(card&&!$('#patronProfileEntry')){const entry=document.createElement('button');entry.type='button';entry.id='patronProfileEntry';entry.className='patron-profile-entry';card.after(entry);}
  const entry=$('#patronProfileEntry');if(entry){const html=`<span class="patron-entry-seal">${heart}</span><span><strong>${model.paid?'Díky, že jsi u toho.':'Baví tě Proplet?'}</strong><small>${model.paid?'Tvoje podpora a veřejná značka':'Podpoř jeho další příběh.'}</small></span><b aria-hidden="true">→</b>`;if(entry.innerHTML!==html)entry.innerHTML=html;}
  const footer=document.querySelector('.app-footer');if(footer&&!$('#patronTodayLink')){const link=document.createElement('button');link.type='button';link.id='patronTodayLink';link.className='text-btn patron-today-link';link.setAttribute('aria-label','Podpořit Proplet');link.innerHTML='<span class="patron-support-stamps" aria-hidden="true"><i>'+heart+'</i><i class="patron-support-recurring">'+heart+'</i></span><span class="patron-support-title">Podpořit Proplet</span><span class="patron-support-arrow play-tile-action" aria-hidden="true"><span>→</span></span>';link.onclick=()=>open('offer',link);footer.before(link);}
  const todayLink=$('#patronTodayLink');if(todayLink)todayLink.hidden=typeof currentScreen==='string'&&currentScreen!=='daily';
  const settings=document.querySelector('#screen-profile #settingsHelpCard');
  if(settings&&!$('#patronOfferPreference')){const box=document.createElement('label');box.id='patronOfferPreference';box.className='card settings-card patron-visibility';box.innerHTML='<input type="checkbox"><span>Nenabízet mi podporu Propletu<small>Ruční odkaz na podporu zůstane dostupný.</small></span>';box.querySelector('input').onchange=e=>void preference({offersDisabled:e.target.checked});settings.after(box);}
  const opt=$('#patronOfferPreference input');if(opt)opt.checked=model.offersDisabled;
  let visibility=$('#patronBadgePreference');
  if(!model.paid){visibility?.remove();}else if(settings){
   if(!visibility){visibility=document.createElement('label');visibility.id='patronBadgePreference';visibility.className='card settings-card patron-visibility';settings.after(visibility);}
   const preview='<input type="checkbox" '+(model.public?'checked':'')+'><span>Ukazovat mou značku ostatním<small class="patron-settings-preview'+badgeClass(model.badgeType)+'"><i aria-hidden="true">'+heart+'</i>'+badgeName(model.badgeType)+'</small><small>Částku ani platební historii ostatním neukazujeme.</small></span>';
   if(visibility.innerHTML!==preview){visibility.innerHTML=preview;visibility.querySelector('input').onchange=e=>void preference({publicBadge:e.target.checked});}
  }

  for(const row of document.querySelectorAll('.ranking-row,.result-player-row')){
   const name=row.querySelector('.ranking-player-name')||row.querySelector('.leader-name strong,.result-player-copy strong')||row.querySelector('.leader-name');if(!name)continue;
   const mine=row.classList.contains('me'),supported=mine?model.paid&&model.public:row.dataset.patron==='true',type=supported&&(mine?model.badgeType:row.dataset.patronBadge)==='recurring'?'recurring':'supporter';
   const copy=row.querySelector('.ranking-player-identity')||row.querySelector('.result-player-copy,.leader-name')||name.parentElement;
   let badge=row.querySelector('.patron-label');if(supported&&!badge){const holder=document.createElement('span');holder.innerHTML=seal(type);const button=holder.firstElementChild;button.onclick=e=>{e.stopPropagation();if(mine)open('thanks',button);else showPerson(row,name,button)};copy.append(button);badge=button;}else if(!supported&&badge)badge.remove();if(supported&&badge){const label=badgeLabel(type);if(badge.innerHTML!==label)badge.innerHTML=label;badge.classList.toggle('patron-recurring',type==='recurring');badge.setAttribute('aria-label',badgeName(type)+' Propletu — poděkování');if(badge.parentElement!==copy)copy.append(badge);}
   row.classList.toggle('patron-supported',supported);row.classList.toggle('patron-recurring',supported&&type==='recurring');if(supported)name.setAttribute('title',personName(row,name));
   for(const avatar of row.querySelectorAll('.result-player-avatar,.ranking-avatar,.home-ranking-avatar,.leader-avatar,.leaderboard-avatar'))decorateAvatar(avatar,supported,type);
   if(row.classList.contains('result-player-row')){const avatar=resultAvatarControl(row.querySelector('.result-player-avatar'),supported);if(supported&&avatar){avatar.setAttribute('aria-label',badgeName(type)+' '+personName(row,name)+' — o podpoře Propletu');avatar.setAttribute('aria-haspopup','dialog');avatar.onclick=e=>{e.stopPropagation();showPerson(row,name,avatar)};}}
  }
 }
 let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;decorate()})};
 function boot(){if(started)return;started=true;ensure();if(typeof registerGameCompletionHook==='function')registerGameCompletionHook({id:'patron-result',priority:200,after:({game})=>{if(game?.finished&&['daily','daily_special','free','tajenka'].includes(game.mode)&&!game.postStarterWarmup&&!game.puzzle?.meta?.archiveExperience)resultCompleted();}});void refresh();new MutationObserver(schedule).observe(document.querySelector('.app-shell'),{childList:true,subtree:true});new MutationObserver(schedule).observe($('#winModal'),{childList:true,subtree:true});
  window.PropletAnnouncements?.register({id:'patron-personal-gift-v1',repeatable:true,priority:20,eligible:()=>model.enabled&&model.authenticated&&model.personalGift?.pending===true&&!giftShown,show:async({isCurrent})=>{if(!isCurrent())return false;giftShown=true;open('gift');return true;},close});
  window.PropletAnnouncements?.register({id:'patron-thanks-v1',repeatable:true,priority:-10,eligible:()=>model.enabled&&model.authenticated&&model.paid&&model.thanksPending,show:async({isCurrent})=>{if(!isCurrent()||document.querySelector('#rankSpotlight:not(.hidden)'))return false;const epoch=accountEpoch;const status=await request('/api/patrons/thanks/claim?visibility=true',{method:'POST'});if(epoch!==accountEpoch||!model.enabled||!status.displayGranted)return false;const current=isCurrent();model.thanksPending=false;if(!current)return false;welcomePublic=status.defaultPublicBadge===true;open('welcome');return true;},close});
  window.PropletAnnouncements?.register({id:'patron-support-v1',repeatable:true,nonModal:true,afterFirstSteps:true,priority:-20,eligible:offerEligible,show:showOffer,close:()=>$('#patronOffer')?.remove()});
 }
 const offerScreen=()=>typeof currentScreen==='string'&&['daily','free'].includes(currentScreen);
 const offerAnchor=()=>typeof currentScreen==='string'&&currentScreen==='free'?$('#difficultyCards'):$('#oneScreenToday .os-main')||$('#screen-daily .daily-hero');
 function offerEligible(){
  if(!offerScreen()||!model.enabled||!model.authenticated
   ||!model.canOffer||model.paid||model.offersDisabled||model.pending||document.hidden
   ||$('#rankSpotlight:not(.hidden)'))return false;
  if($('#patronOffer'))return true;
  const anchor=offerAnchor()?.getBoundingClientRect();
  return !!anchor&&anchor.width>0&&anchor.top>=0&&anchor.top+150<=window.innerHeight;
 }
 function cardInView(card){
  const {left,right,top,bottom,width,height}=card.getBoundingClientRect();
  if(document.hidden||!card.isConnected||!width||!height||left<0||right>window.innerWidth||top<0||bottom>window.innerHeight)return false;
  const x=(left+right)/2;
  return [top+4,bottom-4].every(y=>card.contains(document.elementFromPoint(x,y)));
 }
 // Keep the existing announcement queue in charge until the card has painted.
 function paintedInView(card,isCurrent){
  return new Promise(resolve=>{
   const timeout=setTimeout(()=>resolve(false),1000);
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    clearTimeout(timeout);resolve(isCurrent()&&cardInView(card));
   }));
  });
 }
 const displayOffer=body=>request('/api/patrons/offers/display',{method:'POST',body:JSON.stringify(body)});
 async function showOffer({isCurrent}){
  if(!isCurrent()||$('#patronOffer'))return false;
  const epoch=accountEpoch;
  const {displayGranted,receiptId}=await displayOffer({});
  if(epoch!==accountEpoch)return false;
  if(!displayGranted||!receiptId){model.canOffer=false;return false;}
  if(!isCurrent())return false;
  const card=document.createElement('aside');
  card.id='patronOffer';card.className='patron-offer';card.setAttribute('aria-label','Podpora Propletu');
  card.innerHTML='<div class="patron-offer-heading"><span class="patron-entry-seal" aria-hidden="true">'+heart+'</span><div><strong>Baví tě Proplet?</strong><p>Pomoz mi ho udržet zdarma. — Pavel</p></div><button type="button" class="text-btn" data-dismiss aria-label="Teď ne — zavřít nabídku podpory">×</button></div>'+fundingProgress()+'<div class="patron-inline-payment"><div class="patron-inline-qr" data-inline-qr><span>Připravuji QR…</span></div><div class="patron-inline-copy"><strong>Jednorázově<br>129 Kč</strong><p>QR není platba.<br>Převod potvrdíš ve své bance.</p><button type="button" class="text-btn" data-inline-copy disabled>Kopírovat údaje</button><button type="button" class="text-btn" data-inline-retry hidden>Zkusit znovu</button></div></div><p class="patron-inline-status" role="status"></p><div class="patron-offer-actions"><button type="button" class="primary-btn" data-inline-save disabled>Uložit QR do telefonu</button><button type="button" class="text-btn" data-support>Jiná částka</button><button type="button" class="text-btn" data-monthly-support>Podporovat měsíčně</button></div>';
  const support=card.querySelector('[data-support]'),monthly=card.querySelector('[data-monthly-support]'),dismiss=card.querySelector('[data-dismiss]'),save=card.querySelector('[data-inline-save]'),copy=card.querySelector('[data-inline-copy]'),retry=card.querySelector('[data-inline-retry]'),status=card.querySelector('.patron-inline-status'),qr=card.querySelector('[data-inline-qr]');
  support.disabled=monthly.disabled=dismiss.disabled=true;
  offerAnchor().before(card);
  if(!cardInView(card)||!await paintedInView(card,isCurrent)){card.remove();return false;}
  const confirmed=await displayOffer({receiptId}).catch(()=>null);
  if(epoch!==accountEpoch||!confirmed?.displayGranted||!card.isConnected){card.remove();return false;}
  model.canOffer=false;
  const current=()=>epoch===accountEpoch&&model.enabled&&model.authenticated&&card.isConnected&&offerScreen()&&card.parentElement?.contains(offerAnchor());
  let prepared=null,preparing=false,acting=false;
  function reportAction(action){
   if(!current())return;
   void request('/api/patrons/offers/dismiss',{method:'POST',body:JSON.stringify({receiptId,action})}).catch(()=>{});
  }
  function customize(frequency){
   if(!current())return;
   reportAction('opened');card.remove();open('offer');model.frequency=frequency;model.amount=Number(recommendedAmount);model.selected=recommendedAmount;render();$('#patronTitle')?.focus({preventScroll:true});
  }
  async function prepare(){
   if(!current()||preparing||prepared)return;
   if(!cardInView(card)){qr.textContent='Načti QR pro podporu';retry.hidden=false;retry.textContent='Načíst QR';return;}
   preparing=true;retry.hidden=true;status.textContent='';qr.textContent='Připravuji QR…';
   try{
    const value=await request('/api/patrons/offers/qr',{method:'POST',body:JSON.stringify({receiptId})});
    if(!current())return;
    if(!value.intent?.id||!value.payment?.qrSvg||!value.payment?.spd)throw Error('Missing automatic QR');
    prepared=value;
    const image=document.createElement('img');image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(value.payment.qrSvg)));image.alt='QR pro jednorázovou podporu 129 Kč';image.width=image.height=144;qr.replaceChildren(image);
    save.disabled=copy.disabled=false;
   }catch{
    if(current()){qr.textContent='QR se nepodařilo načíst.';retry.hidden=false;retry.textContent='Zkusit znovu';}
   }finally{preparing=false;}
  }
  async function usePayment(action){
   if(!current()||!prepared||acting)return;
   acting=true;save.disabled=copy.disabled=true;status.textContent='';
   try{
    if(action==='saved')await saveQr(prepared.payment.qrSvg,current);else await navigator.clipboard.writeText(prepared.payment.spd);
    if(!current())return;
    status.textContent=action==='saved'?'QR je připravené ke stažení.':'Platební údaje jsou zkopírované.';
    // Preparation is not interest. Only a successful explicit use is reported.
    void request('/api/patrons/offers/engage',{method:'POST',body:JSON.stringify({intentId:prepared.intent.id,action})}).catch(()=>{});
   }catch{
    if(current())status.textContent=action==='saved'?'QR se nepodařilo uložit. Zkus to znovu.':'Kopírování není dostupné. Zkus uložit QR.';
   }finally{acting=false;if(current())save.disabled=copy.disabled=false;}
  }
  support.onclick=()=>customize('once');monthly.onclick=()=>customize('monthly');
  dismiss.onclick=()=>{reportAction('declined');card.remove();};
  save.onclick=()=>void usePayment('saved');copy.onclick=()=>void usePayment('copied');retry.onclick=()=>void prepare();
  support.disabled=monthly.disabled=dismiss.disabled=false;
  void prepare();
  return true;
 }
 document.addEventListener('click',e=>{const entry=e.target.closest?.('#patronProfileEntry');if(entry)open(model.paid?'thanks':'offer',entry);});
 document.addEventListener('proplet:ready',boot,{once:true});if(window.__PROPLET_CURRENT_UI_READY)boot();
 document.addEventListener('proplet:screen-changed',()=>{decorate();const card=$('#patronOffer');if(card&&(!offerScreen()||!card.parentElement?.contains(offerAnchor())))card.remove();});
 document.addEventListener('proplet:account-changed',()=>{accountEpoch++;giftShown=false;giftSaving=false;giftDraft='';model.personalGift=null;close();model.pending=false;model.requestId=null;model.requestAmount=null;model.intent=null;model.payment=null;model.paid=false;model.badgeType=null;model.recurringStatus=null;model.personBadgeType=null;model.thanksPending=false;model.contributions=[];model.monthFunding=null;model.public=false;model.canOffer=false;model.enabled=false;model.authenticated=false;decorate();void refresh();});
 // Returning to a long-open tab revalidates time-limited thanks on the server.
 // Browsers often deliver pageshow, visibility and focus together; fetch once.
 let returnRefreshTimer=0,lastReturnRefresh=0;
 function refreshOnReturn(){if(!started||document.visibilityState==='hidden'||returnRefreshTimer||Date.now()-lastReturnRefresh<1000)return;returnRefreshTimer=setTimeout(()=>{returnRefreshTimer=0;if(document.visibilityState==='hidden')return;lastReturnRefresh=Date.now();void refresh();},80);}
 window.addEventListener('focus',refreshOnReturn);window.addEventListener('pageshow',refreshOnReturn);
 for(const event of ['scroll','resize'])window.addEventListener(event,()=>{if(offerEligible())window.PropletAnnouncements?.kick();},{passive:true,capture:event==='scroll'});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshOnReturn();});
 window.addEventListener('storage',()=>{void refresh();});
 document.addEventListener('proplet:patron-updated',()=>{void refresh();});
 function resultCompleted(){void refresh();}
 window.PropletPatrons={open,close,refresh,model,preference,resultCompleted};
})();
