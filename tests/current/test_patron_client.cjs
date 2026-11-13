// Exercise native patron UI gates, durable claim coordination and kill switch.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const nodes=new Map(),events=new Map(),entries=new Map();let mounted=0,calls=[],removed=[];
const offerRequests=[],autoQrRequests=[];let anchorTop=90,cardBottom=240,afterPaint;
const welcomeButton={addEventListener(_event,fn){this.confirm=fn}};
function element(){const controls=new Map();return {style:{setProperty(){}},attrs:{},isConnected:true,setAttribute(k,v){this.attrs[k]=v},addEventListener(){},append(){},remove(){this.isConnected=false;removed.push(this.id);nodes.delete('#'+this.id)},getBoundingClientRect(){return {left:8,right:312,top:90,bottom:cardBottom,width:304,height:150}},contains(node){return node===this},querySelector(s){if(s==='[data-confirm-visibility]'&&this.innerHTML.includes('data-confirm-visibility'))return welcomeButton;if(!controls.has(s))controls.set(s,{onclick:null,addEventListener(){},replaceChildren(...children){this.children=children}});return controls.get(s)},querySelectorAll:()=>[],classList:{contains:()=>false,remove(){}},innerHTML:'',textContent:'',showModal(){this.open=true},close(){this.open=false},focus(){}};}
const anchor={getBoundingClientRect:()=>({top:anchorTop,width:304}),before(node){mounted++;node.parentElement={contains:other=>other===anchor};nodes.set('#'+node.id,node)}};
const footer={before(node){nodes.set('#'+node.id,node)}};
const document={createElement:element,elementFromPoint:()=>nodes.get('#patronOffer'),body:{append(node){nodes.set('#'+node.id,node)}},querySelector(s){if(s==='.app-footer')return footer;if(s==='#oneScreenToday .os-main')return anchor;return nodes.get(s)||null},querySelectorAll(s){return s.startsWith('#patronProfileEntry')?s.split(',').flatMap(key=>nodes.get(key)?[nodes.get(key)]:[]):[]},addEventListener(name,fn){events.set(name,fn)},dispatchEvent(e){events.get(e.type)?.(e)}};
const status={enabled:true,authenticated:true,patron:false,publicBadge:false,offersDisabled:false,canOffer:true};
const visibilityWrites=[];
const request=async (path,options)=>{
 calls.push(path);
 if(path==='/api/patrons/thanks/claim?visibility=true'){
  status.thanksPending=false;return {displayGranted:true,defaultPublicBadge:true};
 }
 if(path==='/api/patrons/preferences'){
  const choice=JSON.parse(options.body);visibilityWrites.push(choice);
  status.publicBadge=choice.publicBadge;return status;
 }
 if(path==='/api/patrons/offers/qr'){autoQrRequests.push(JSON.parse(options.body));return {intent:{id:'automatic',amountCzk:129,frequency:'once',source:'automatic_offer'},payment:{qrSvg:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>',spd:'TEST ONLY'}};}
 if(path.startsWith('/api/patrons/offers/')){
  offerRequests.push(JSON.parse(options.body));
  return {displayGranted:true,receiptId:'receipt'};
 }
 return status;
};
const window={innerWidth:320,innerHeight:570,PropletAnnouncements:{register(e){entries.set(e.id,e)},kick(){}},addEventListener(){}};
const context={Event,btoa:s=>Buffer.from(s,'binary').toString('base64'),window,document,setTimeout,clearTimeout,api:request,Intl,crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}},requestAnimationFrame(fn){queueMicrotask(()=>{afterPaint?.();fn()})},getProfile:()=>({id:'a',token:'token',supportMode:'younger'}),currentScreen:'daily'};
vm.runInNewContext(fs.readFileSync('public/app/patrons.js','utf8'),context);
async function avatarInfoLifecycle(){
 const map=new Map(),listeners=new Map(),windowListeners=new Map(),rows=[],requests=[];let focus=null,deferNextStatus=null;
 class Node{
  constructor(tag='span'){this.style={setProperty(){}};this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this.children=[];this.events=new Map();this.className='';this.isConnected=true;this.controls=new Map();this.textContent='';this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:c=>{if(!this.classList.contains(c))this.className+=' '+c},remove:c=>{this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' ')},toggle:(c,on)=>{if(on)this.classList.add(c);else this.classList.remove(c)}};}
  get childNodes(){return this.children}get firstElementChild(){if(!this.children.length&&this._html?.startsWith('<button')){const child=new Node('button');child.className='patron-label';this.append(child)}return this.children[0]}
  set innerHTML(value){this._html=value;this.controls.clear();if(value.includes('<input'))this.controls.set('input',new Node('input'));if(this.tagName==='DIALOG'){for(const match of value.matchAll(/id="([^"]+)"/g))this.controls.set('#'+match[1],new Node(match[1]==='patronForm'?'form':'span'));for(const [selector,found]of [['.patron-close',true],['.patron-person-avatar',value.includes('patron-person-avatar')],['[data-close]',value.includes('data-close')],['[data-support]',value.includes('data-support')]])if(found)this.controls.set(selector,new Node('button'));}}
  cloneNode(deep){const copy=new Node(this.tagName);copy.className=this.className;copy.attrs={...this.attrs};copy.dataset={...this.dataset};copy.textContent=this.textContent;if(deep)copy.append(...this.children.map(n=>n.cloneNode(true)));return copy}
  get innerHTML(){return this._html||''}setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}addEventListener(k,f){this.events.set(k,f)}focus(){focus=this}showModal(){this.open=true}close(){this.open=false}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parentElement=this}}replaceWith(next){const parent=this.parentElement;if(parent.avatar===this)parent.avatar=next;else parent.children[parent.children.indexOf(this)]=next;next.parentElement=parent;this.isConnected=false}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.isConnected=false;if(this.id)map.delete('#'+this.id)}
  after(node){map.set('#'+node.id,node)}
  querySelector(s){return s==='.patron-avatar-card'?this.children.find(n=>n.classList.contains('patron-avatar-card'))||null:this.controls.get(s)||null}querySelectorAll(s){return s==='[data-close]'&&this.controls.has(s)?[this.controls.get(s)]:[]}
 }
 function resultRow(name,supported,mine=false){const row=new Node('div');row.className='result-player-row'+(mine?' me':'');row.dataset.patron=String(supported);row.name=new Node('strong');row.name.textContent=name;row.copy=new Node('span');row.avatar=new Node();row.avatar.className='result-player-avatar organic-avatar-host';row.avatar.dataset={playerAvatar:'🦊',organicAvatarKey:'🦊'};const image=new Node('img');image.setAttribute('src','/assets/avatars/v3/01-liska.svg');row.avatar.append(image);row.avatar.parentElement=row;row.copy.parentElement=row;row.querySelectorAll=s=>s==='.result-player-avatar,.ranking-avatar,.home-ranking-avatar,.leader-avatar,.leaderboard-avatar'?[row.avatar]:[];row.querySelector=s=>s==='.leader-name strong,.result-player-copy strong'?row.name:s==='.result-player-copy,.leader-name'?row.copy:['.result-player-avatar','.result-player-avatar,.ranking-avatar'].includes(s)?row.avatar:s==='.patron-label'?row.copy.children.find(n=>n.classList.contains('patron-label'))||null:s==='.result-player-avatar img,.leader-name img'?row.avatar.children[0]:null;rows.push(row);return row;}
 const supported=resultRow('Pavel <autor>',true),plain=resultRow('Jiný hráč',false),own=resultRow('Ty',false,true),hydrated=supported.avatar.children[0];
 const header=new Node();header.id='profileChipAvatar';const settings=new Node();settings.id='settingsHelpCard';map.set('#screen-profile #settingsHelpCard',settings);
 const doc={activeElement:null,visibilityState:'visible',createElement:tag=>new Node(tag),body:{append:n=>map.set('#'+n.id,n)},querySelector:s=>map.get(s)||map.get('#patronDialog')?.controls.get(s)||null,querySelectorAll:s=>s==='#profileChipAvatar,.profile-avatar-big'?[header]:s==='.patron-avatar-marked'?[header,...rows.map(r=>r.avatar)].filter(a=>a.classList.contains('patron-avatar-marked')):s==='.ranking-row,.result-player-row'?rows:s==='.patron-supported'?rows.filter(r=>r.classList.contains('patron-supported')):s==='.result-player-avatar.patron-avatar-info'?rows.map(r=>r.avatar).filter(a=>a.classList.contains('patron-avatar-info')):s.startsWith('#patronProfileEntry')?s.split(',').flatMap(key=>map.get(key)?[map.get(key)]:[]):[],addEventListener:(k,f)=>listeners.set(k,f),dispatchEvent(e){listeners.get(e.type)?.(e)}};
 const server={enabled:true,authenticated:true,patron:false,publicBadge:false,canOffer:false,offersDisabled:true};const win={addEventListener:(k,f)=>windowListeners.set(k,f),PropletAnnouncements:{register(){},kick(){}}};
 const ctx={Event,setTimeout,clearTimeout,Date,window:win,document:doc,api:async(path)=>{requests.push(path);if(path==='/api/patrons?visibility=true'&&deferNextStatus){const pending=deferNextStatus;deferNextStatus=null;return pending;}return server},Intl,crypto:require('node:crypto').webcrypto,MutationObserver:class{observe(){}},requestAnimationFrame:()=>1,getProfile:()=>({id:'me',token:'fixture',name:'Pavel',avatar:'🦊'}),currentScreen:'daily'};
 vm.runInNewContext(fs.readFileSync('public/app/patrons.js','utf8'),ctx);listeners.get('proplet:ready')();await win.PropletPatrons.refresh();
 const button=supported.avatar;assert.equal(button.querySelector('.patron-avatar-card')?.getAttribute('aria-hidden'),'true');assert.equal(plain.avatar.querySelector('.patron-avatar-card'),null,'private other player is never marked');assert.equal(header.querySelector('.patron-avatar-card'),null);assert.equal(button.tagName,'BUTTON');assert.equal(button.children[0],hydrated,'avatar hydration is preserved');assert.equal(plain.avatar.tagName,'SPAN');assert.equal(own.avatar.tagName,'SPAN','private/non-patron own avatar stays static');assert.equal(button.getAttribute('aria-haspopup'),'dialog');assert(button.getAttribute('aria-label').includes('Pavel <autor>'));
 const before=requests.length;button.onclick({stopPropagation(){}});const dialog=map.get('#patronDialog');assert.equal(dialog.open,true);assert.equal(dialog.getAttribute('data-patron-step'),'other');assert(dialog.innerHTML.includes('Pavel &lt;autor&gt;'));assert(dialog.innerHTML.includes('Podporuje provoz a další rozvoj Propletu. Podpoř Proplet a získej vlastní značku podporovatele.'));assert(dialog.innerHTML.includes('Podpořit Proplet'));assert(!dialog.innerHTML.includes('patron-art'),'person information stays compact');assert.equal(dialog.querySelector('.patron-person-avatar').children[0].getAttribute('src'),hydrated.getAttribute('src'),'modal forwards the clicked rendered avatar, not viewer or emoji fallback');assert.equal(dialog.querySelector('.patron-person-avatar').children.length,1,'detail clones only the identity, without duplicating the card');assert.equal(requests.length,before,'public information does not create any payment or server write');
 await win.PropletPatrons.refresh();assert.equal(supported.avatar,button,'repeated decoration keeps the focused button');assert.equal(button.children[0],hydrated);assert.equal(button.children.filter(n=>n.classList.contains('patron-avatar-card')).length,1,'decoration is idempotent');dialog.querySelector('[data-support]').events.get('click')();assert.equal(dialog.getAttribute('data-patron-step'),'offer');assert(dialog.innerHTML.includes('patronForm'));assert.equal(requests.length,before+1,'CTA only opens the existing offer');win.PropletPatrons.close();assert.equal(focus,button,'closing the offer restores the original result avatar');
 Object.assign(server,{patron:true,publicBadge:true});await win.PropletPatrons.refresh();assert.equal(own.avatar.tagName,'BUTTON');own.avatar.onclick({stopPropagation(){}});assert.equal(win.PropletPatrons.model.personName,'Pavel','own result says the profile name, not Ty');assert(dialog.innerHTML.includes('>Pavel</h2>'));
 // A selected monthly offer and a monthly history entry cannot create a recurring entitlement.
 win.PropletPatrons.open('offer');assert.equal(win.PropletPatrons.model.frequency,'once','fresh manual offer defaults to one-off support');doc.querySelector('#patronForm').events.get('change')({target:{name:'frequency',value:'monthly'}});
 assert(dialog.innerHTML.includes('Červené srdíčko získáš po první potvrzené měsíční platbě.'));
 assert(dialog.innerHTML.includes('Měsíční opakování nastavíš ve své bance. QR ho nemusí předvyplnit.'));
 assert(!dialog.innerHTML.includes('patron-recurring-warning'),'full bank instructions belong to QR step; exercised by compact browser suite');
 assert.equal(win.PropletPatrons.model.badgeType,'supporter');assert(!header.classList.contains('patron-recurring'),'QR selection does not activate regular badge');
 Object.assign(server,{contributions:[{frequency:'monthly',amountCzk:99,confirmedAt:'2026-11-01'}]});await win.PropletPatrons.refresh();
 assert(!header.classList.contains('patron-recurring'),'client never derives regular status from payment history or a selected frequency');
 // First actual confirmed monthly payment, renewals, grace, expiry and reinstatement come from the server.
 Object.assign(server,{badgeType:'recurring',recurringStatus:{state:'current',paidThrough:'2026-12-01',graceUntil:'2026-12-08'}});await win.PropletPatrons.refresh();
 assert(header.classList.contains('patron-recurring'));assert(own.avatar.classList.contains('patron-recurring'));assert.equal(own.avatar.children.filter(n=>n.classList.contains('patron-avatar-card')).length,1);
 assert.equal(own.copy.querySelector('.patron-avatar-card'),null);assert.equal(own.querySelector('.patron-label').getAttribute('aria-label'),'Pravidelný podporovatel Propletu — poděkování');
 win.PropletPatrons.open('thanks');assert(dialog.innerHTML.includes('Pravidelný podporovatel'));assert(dialog.innerHTML.includes('Díky za pravidelnou podporu.'));
 Object.assign(server.recurringStatus,{paidThrough:'2027-01-01',graceUntil:'2027-01-08'});await win.PropletPatrons.refresh();assert.equal(win.PropletPatrons.model.recurringStatus.paidThrough,'2027-01-01');assert.equal(header.children.length,1,'renewal retains one card');
 Object.assign(server.recurringStatus,{state:'grace'});await win.PropletPatrons.refresh();assert(header.classList.contains('patron-recurring'));assert(dialog.innerHTML.includes('Čekáme na další měsíční převod.'));
 Object.assign(server,{badgeType:'supporter',recurringStatus:{state:'expired',paidThrough:'2026-12-01',graceUntil:'2026-12-08'}});await win.PropletPatrons.refresh();
 assert.equal(win.PropletPatrons.model.paid,true,'missed monthly payment never removes permanent patron status');assert(!header.classList.contains('patron-recurring'));assert(header.querySelector('.patron-avatar-card'));assert(!own.avatar.classList.contains('patron-recurring'));assert.equal(own.querySelector('.patron-label').getAttribute('aria-label'),'Podporovatel Propletu — poděkování');assert(dialog.innerHTML.includes('Modrá značka ti zůstává jako trvalé poděkování.'));
 Object.assign(server,{badgeType:'recurring',recurringStatus:{state:'current',paidThrough:'2027-02-01',graceUntil:'2027-02-08'}});await win.PropletPatrons.refresh();assert(header.classList.contains('patron-recurring'),'next confirmed monthly payment reinstates regular badge');assert(map.get('#patronBadgePreference').innerHTML.includes('Pravidelný podporovatel'),'settings preview shows the current actual badge');
 supported.dataset.patronBadge='recurring';await win.PropletPatrons.refresh();button.onclick({stopPropagation(){}});assert(dialog.innerHTML.includes('Pravidelně podporuje provoz a další rozvoj Propletu.'));assert(!dialog.innerHTML.includes('2027-02-01'),'public detail never reveals payment dates');assert(!dialog.innerHTML.includes('99 Kč'),'public detail never reveals contribution history');
 // Long-open tabs revalidate expiry after returning, without one fetch per browser event.
 Object.assign(server,{badgeType:'supporter',recurringStatus:{state:'expired',paidThrough:'2026-11-30',nextDue:'2026-12-01',graceUntil:'2026-12-08'}});
 const beforeReturn=requests.length;windowListeners.get('focus')();windowListeners.get('pageshow')();listeners.get('visibilitychange')();
 await new Promise(resolve=>setTimeout(resolve,110));assert.equal(requests.length,beforeReturn+1,'focus/pageshow/visible return coalesce to one request');assert(!header.classList.contains('patron-recurring'),'return to the app applies server expiry');assert(header.querySelector('.patron-avatar-card'),'return expiry preserves permanent blue thanks');
 windowListeners.get('focus')();await new Promise(resolve=>setTimeout(resolve,100));assert.equal(requests.length,beforeReturn+1,'duplicate focus within a second does not refetch');
 doc.visibilityState='hidden';windowListeners.get('focus')();assert.equal(requests.length,beforeReturn+1,'hidden tabs do not refetch');doc.visibilityState='visible';
 Object.assign(server,{badgeType:'recurring',recurringStatus:{state:'current',paidThrough:'2027-01-31',nextDue:'2027-02-01',graceUntil:'2027-02-08'}});await win.PropletPatrons.refresh();
 supported.dataset.patron='false';await win.PropletPatrons.refresh();assert(!supported.avatar.classList.contains('patron-recurring'));assert.equal(supported.avatar.querySelector('.patron-avatar-card'),null,'public recurring type alone cannot bypass hidden patron boolean');supported.dataset.patron='true';
 Object.assign(server,{publicBadge:false});await win.PropletPatrons.refresh();assert.equal(own.avatar.tagName,'SPAN','hiding the public badge removes the button');assert.equal(own.avatar.querySelector('.patron-avatar-card'),null,'private own result remains private');assert(header.querySelector('.patron-avatar-card'),'own header retains personal entitlement without exposing it to others');assert.equal(header.children.length,1,'header adds only the decorative card, never a text label');assert(map.get('#patronBadgePreference').innerHTML.includes('Pravidelný podporovatel'),'private owner can still preview regular badge in settings');assert(!map.get('#patronBadgePreference').innerHTML.includes('checked'),'settings public checkbox reflects actual privacy');
 let resolveOld;deferNextStatus=new Promise(resolve=>{resolveOld=resolve});const oldResponse=win.PropletPatrons.refresh();
 Object.assign(server,{patron:false,publicBadge:false,badgeType:null,recurringStatus:null});listeners.get('proplet:account-changed')();assert.equal(header.querySelector('.patron-avatar-card'),null,'account switch clears previous own entitlement immediately');assert.equal(win.PropletPatrons.model.badgeType,null);assert.equal(win.PropletPatrons.model.recurringStatus,null);assert(!map.has('#patronBadgePreference'),'account switch clears previous privacy preview immediately');await win.PropletPatrons.refresh();
 resolveOld({enabled:true,authenticated:true,patron:true,publicBadge:true,badgeType:'recurring',recurringStatus:{state:'current'}});await oldResponse;assert.equal(win.PropletPatrons.model.badgeType,null,'late status response from previous account cannot reinstate regular badge');assert.equal(header.querySelector('.patron-avatar-card'),null,'non-patron account cannot inherit the previous mark');Object.assign(server,{enabled:false});const writes=requests.length;await win.PropletPatrons.refresh();assert.equal(supported.avatar.tagName,'SPAN');assert.equal(supported.avatar.children[0],hydrated);assert.equal(dialog.open,false);assert.deepEqual(requests.slice(writes),['/api/patrons?visibility=true']);
}
(async()=>{
 events.get('proplet:ready')();await window.PropletPatrons.refresh();
 const entry=entries.get('patron-support-v1'),thanks=entries.get('patron-thanks-v1');
 const signedInStatus={...status};Object.assign(status,{authenticated:false,canOffer:false,offersDisabled:true});
 const guestRead=calls.length;await window.PropletPatrons.refresh();const guestLink=nodes.get('#patronTodayLink');
 assert(guestLink,'enabled guest has the native manual Today support link');assert.equal(guestLink.attrs['aria-label'],'Podpořit Proplet');assert(guestLink.innerHTML.includes('>Podpořit Proplet</span>'));assert.equal(guestLink.hidden,false);
 assert.equal(entry.eligible(),false,'guest page never creates an automatic support offer');assert.deepEqual(calls.slice(guestRead),['/api/patrons?visibility=true'],'guest decoration only reads status');
 Object.assign(status,signedInStatus);await window.PropletPatrons.refresh();
 const show=()=>entry.show({isCurrent:()=>entry.eligible()});
 anchorTop=550;
 assert.equal(await show(),false,'offscreen slot does not even reserve a receipt');assert.deepEqual(offerRequests,[]);
 anchorTop=90;context.currentScreen='game';
 assert.equal(await show(),false,'playing does not trigger automatic support');assert.deepEqual(offerRequests,[]);
 context.currentScreen='daily';afterPaint=()=>{document.hidden=true;};
 assert.equal(await show(),false,'backgrounding before paint does not confirm the reservation');
 assert.equal(nodes.has('#patronOffer'),false);assert.deepEqual(offerRequests,[{}]);assert.deepEqual(autoQrRequests,[],'invisible reservation never prepares QR');
 document.hidden=false;afterPaint=null;
 assert.equal(await show(),true,'returning to Today can show an eligible card');
 assert.equal(mounted,2);assert.deepEqual(autoQrRequests,[{receiptId:'receipt'}],'QR is prepared automatically only after visible confirmation');assert.equal(entry.eligible(),false);assert.deepEqual(offerRequests,[{},{},{receiptId:'receipt'}]);
 context.currentScreen='free';events.get('proplet:screen-changed')();
 assert.equal(nodes.has('#patronOffer'),false);assert.equal(offerRequests.length,3,'navigation away is not a dismissal');
 context.currentScreen='daily';await window.PropletPatrons.refresh();assert.equal(await show(),true);
 await nodes.get('#patronOffer').querySelector('[data-dismiss]').onclick();
 assert.deepEqual(offerRequests.at(-1),{receiptId:'receipt',action:'declined'});
 await window.PropletPatrons.refresh();assert.equal(await show(),true);
 await nodes.get('#patronOffer').querySelector('[data-support]').onclick();
 assert.deepEqual(offerRequests.at(-1),{receiptId:'receipt',action:'opened'});
 assert.equal(nodes.get('#patronDialog').attrs['data-patron-step'],'offer');window.PropletPatrons.close();
 Object.assign(status,{patron:true,thanksPending:true,canOffer:false,contributions:[{id:'payment',amountCzk:99,frequency:'monthly',confirmedAt:'2026-10-31T12:00:00Z'}]});
 await window.PropletPatrons.refresh();assert.equal(thanks.eligible(),true);assert.equal(entry.eligible(),false);
 assert.equal(await thanks.show({isCurrent:()=>thanks.eligible()}),true);
 assert.equal(nodes.get('#patronDialog').open,true);assert.equal(thanks.eligible(),false);
 assert.equal(nodes.get('#patronDialog').attrs['data-patron-step'],'welcome','automatic first confirmation opens the celebration');
 assert.doesNotMatch(nodes.get('#patronDialog').innerHTML,/Tvoje potvrzené příspěvky|Přispět znovu|patronPublic/,'celebration has no payment management');
 assert.match(nodes.get('#patronDialog').innerHTML,/id="patronWelcomePublic" checked/);
 assert.deepEqual(visibilityWrites,[],'opening the prompt never publishes the badge');
 nodes.set('#patronWelcomePublic',{checked:false});
 await welcomeButton.confirm({currentTarget:welcomeButton});
 assert.deepEqual(visibilityWrites,[{publicBadge:false}],'confirming an unchecked box saves the opt-out');
 assert.equal(nodes.get('#patronDialog').open,false);
 window.PropletPatrons.open('thanks');
 assert.match(nodes.get('#patronDialog').innerHTML,/Tvoje potvrzené příspěvky/);assert.match(nodes.get('#patronDialog').innerHTML,/Přispět znovu/,'manual support management remains available');
 assert.equal(calls.filter(p=>p==='/api/patrons/thanks/claim?visibility=true').length,1);
 window.PropletPatrons.model.requestId='prior-confirmed-intent';window.PropletPatrons.open('offer');assert.equal(window.PropletPatrons.model.requestId,null,'manual support from an existing patron starts a new contribution');
 // Personal letter is eligible only from the server-addressed state, once per session.
 const gift=entries.get('patron-personal-gift-v1');assert.equal(gift.eligible(),false);
 Object.assign(status,{personalGift:{pending:true,paragraphs:['Zdeňku, Vaše zpráva mě opravdu dojala.','Co by Vám udělalo radost?']}});
 await window.PropletPatrons.refresh();assert.equal(gift.eligible(),true);
 assert.equal(await gift.show({isCurrent:()=>false}),false);
 assert.equal(await gift.show({isCurrent:()=>true}),true);
 assert.match(nodes.get('#patronDialog').innerHTML,/Vaše zpráva/);
 assert.match(nodes.get('#patronDialog').innerHTML,/Promyslím si to/);
 assert.equal(gift.eligible(),false,'closing cannot immediately repeat the personal letter');
 window.PropletPatrons.close();
 const delivery=entries.get('patron-personal-avatar-v1');assert.equal(delivery.eligible(),false);
 Object.assign(status,{exclusiveAvatars:['datel-zdenek'],personalGift:{pending:false,delivery:{pending:true,avatar:'datel-zdenek',paragraphs:['Ahoj Zdenku,','datel je připravený.']}}});
 await window.PropletPatrons.refresh();assert.equal(delivery.eligible(),true);
 assert.equal(await delivery.show({isCurrent:()=>false}),false);
 assert.equal(await delivery.show({isCurrent:()=>true}),true);
 assert.match(nodes.get('#patronDialog').innerHTML,/Nasadit datla/);
 assert.match(nodes.get('#patronDialog').innerHTML,/datel-zdenek.webp/);
 assert.equal(delivery.eligible(),false);
 window.PropletPatrons.close();
 // Live disable must remove previously rendered support and bank details with no write.
 for(const id of ['patronProfileEntry','patronTodayLink','patronOfferPreference','patronOffer']){const node=element();node.id=id;nodes.set('#'+id,node);}
 window.PropletPatrons.model.intent={id:'bound'};window.PropletPatrons.model.payment={spd:'bound'};
 status.enabled=false;const before=calls.length;await window.PropletPatrons.refresh();
 assert.equal(nodes.get('#patronDialog').open,false);assert.equal(window.PropletPatrons.model.intent,null);assert.equal(window.PropletPatrons.model.payment,null);
 for(const id of ['patronProfileEntry','patronTodayLink','patronOfferPreference','patronOffer'])assert.ok(removed.includes(id));
 assert.deepEqual(calls.slice(before),['/api/patrons?visibility=true'],'kill switch does not dismiss/claim/write');
 assert.equal(entry.eligible(),false);assert.equal(thanks.eligible(),false);assert.equal(await show(),false);
 await avatarInfoLifecycle();
 console.log('PASS patron client: server gates; first/renewed/grace/expired/reinstated badges; pending QR and history never grant; private/public details and settings; stale account response; live OFF');
})().catch(e=>{console.error(e);process.exit(1)});
