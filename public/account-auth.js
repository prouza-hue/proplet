(()=>{
'use strict';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim());
let recoveryContext=null;
let knownAvatars=[];
let enhanceScheduled=false;
let securityRefreshPromise=null;

function profile(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
function profileScreenActive(){return !!$('#screen-profile')?.classList.contains('active')}
function authHeaders(){const p=profile();return p?.token?{'Authorization':`Bearer ${p.token}`}:{}}
async function call(path,{method='GET',body,auth=true}={}){
 const headers={'Accept':'application/json',...(body?{'Content-Type':'application/json'}:{}),...(auth?authHeaders():{})};
 const r=await fetch(path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let d={};try{d=await r.json()}catch{}
 if(!r.ok)throw new Error(d.detail||'Něco se nepodařilo. Zkus to znovu.');
 return d;
}
function toast(text){try{if(typeof showToast==='function')return showToast(text)}catch{} alert(text)}
function cleanAuthUrl(){
 try{history.replaceState(history.state,'',location.pathname+location.search.replace(/([?&])auth=[^&]*/,'$1').replace(/([?&])challenge=[^&]*/,'$1').replace(/[?&]$/,''));if(location.hash)history.replaceState(history.state,'',location.pathname+location.search)}catch{}
}
function acceptProfile(p){
 if(!p?.id||!p?.token)return;
 try{
  const had=!profile();if(had&&typeof adoptGuestData==='function')adoptGuestData(p.id);
  if(typeof saveProfile==='function')saveProfile({id:p.id,name:p.name,familyCode:p.familyCode||null,leagueName:p.leagueName||null,avatar:p.avatar||'🙂',googleAvatarUrl:p.googleAvatarUrl||null,useGoogleAvatar:!!p.useGoogleAvatar,supportMode:p.supportMode||'none',token:p.token,hasPassword:!!p.hasPassword,publicRankings:p.publicRankings,stats:p.stats,email:p.email||null,emailVerified:!!p.emailVerified,googleLinked:!!p.googleLinked});
  if(typeof updateProfileChip==='function')updateProfileChip();
  if(typeof renderProfile==='function')renderProfile();
  if(typeof renderDaily==='function')renderDaily();
  if(typeof renderFree==='function')renderFree();
  if(typeof renderLeaderboard==='function')renderLeaderboard();
  if(typeof syncQueue==='function')syncQueue({announce:true}).catch(()=>{});
 }catch{}
 setTimeout(enhanceProfileArchitecture,90);
}
function supabaseFragment(){
 const p=new URLSearchParams(location.hash.replace(/^#/,''));
 return {accessToken:p.get('access_token')||'',error:p.get('error_description')||p.get('error')||''};
}
function closeModal(id){$(id)?.classList.add('hidden')}
function openModal(id){$(id)?.classList.remove('hidden')}

function ensureModals(){
 if($('#forgotPasswordModal'))return;
 document.body.insertAdjacentHTML('beforeend',`
  <div id="forgotPasswordModal" class="modal hidden" role="dialog" aria-modal="true"><div class="modal-card left account-recovery-modal">
   <button id="closeForgotPassword" class="modal-close" aria-label="Zavřít">×</button><span class="eyebrow">ZÁCHRANA ÚČTU</span><h2>Zapomenuté heslo</h2>
   <p class="muted">Zadej <b>ověřený e-mail</b> propojený s Propletem. Pošleme ti jednorázový odkaz pro nastavení nového hesla.</p>
   <label>E-mail<input id="forgotEmailInput" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.cz"></label>
   <div id="forgotPasswordMessage" class="account-auth-message"></div><button id="sendRecoveryBtn" class="primary-btn big">Poslat odkaz</button>
  </div></div>
  <div id="resetPasswordModal" class="modal hidden" role="dialog" aria-modal="true"><div class="modal-card left account-recovery-modal">
   <span class="eyebrow">NOVÉ HESLO</span><h2>Účet je ověřený</h2><p class="muted">Teď už jen nastav nové heslo. Ostatní aktivní přihlášení pro jistotu odpojíme.</p>
   <label>Nové heslo<input id="recoveryPassword" type="password" autocomplete="new-password" minlength="8"></label><label>Znovu<input id="recoveryPassword2" type="password" autocomplete="new-password" minlength="8"></label>
   <div id="resetPasswordMessage" class="account-auth-message"></div><button id="completeRecoveryBtn" class="primary-btn big">Nastavit nové heslo</button>
  </div></div>
  <div id="profileEditModal" class="modal hidden" role="dialog" aria-modal="true"><div class="modal-card left profile-edit-modal-card">
   <button id="closeProfileEdit" class="modal-close" aria-label="Zavřít">×</button><span class="eyebrow">TVŮJ PROFIL</span><h2>Jak ti má Proplet říkat?</h2>
   <p class="muted">Přezdívka je jen tvoje jméno ve hře. Nemusí odpovídat jménu na Google účtu a můžeš ji kdykoli změnit.</p>
   <label>Přezdívka<input id="displayNameInput" maxlength="24" autocomplete="nickname" placeholder="např. Pavel nebo Slovožrout"></label>
   <div id="displayNameMessage" class="account-auth-message"></div><button id="saveDisplayNameBtn" class="primary-btn big">Uložit přezdívku</button>
   <div class="profile-edit-avatar-block"><span class="stat-label">AVATAR</span><div id="profileEditGoogleAvatar"></div><div id="profileEditAvatarGrid" class="avatar-grid profile-edit-avatar-grid"></div><small class="field-note">Google fotka je soukromá pro tvoji hlavičku. Ve veřejném pořadí dál používáme zvolené emoji.</small></div>
  </div></div>
  <div id="recoveryEmailModal" class="modal hidden" role="dialog" aria-modal="true"><div class="modal-card left account-recovery-modal">
   <button id="closeRecoveryEmail" class="modal-close" aria-label="Zavřít">×</button><span class="eyebrow">ZÁCHRANA ÚČTU</span><h2>Přidat e-mail</h2>
   <p class="muted">E-mail použijeme pro obnovu zapomenutého hesla a můžeš se jím také přihlašovat. Nejprve ho ověříš kliknutím na odkaz.</p>
   <label>E-mail<input id="recoveryEmailAddInput" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.cz"></label>
   <div id="recoveryEmailAddMessage" class="account-auth-message"></div><button id="saveRecoveryEmailBtn" class="primary-btn big">Poslat ověřovací odkaz</button>
  </div></div>`);
 $('#closeForgotPassword').onclick=()=>closeModal('#forgotPasswordModal');
 $('#closeProfileEdit').onclick=()=>closeModal('#profileEditModal');
 $('#closeRecoveryEmail').onclick=()=>closeModal('#recoveryEmailModal');
 $('#sendRecoveryBtn').onclick=sendRecovery;
 $('#completeRecoveryBtn').onclick=completeRecovery;
 $('#saveDisplayNameBtn').onclick=saveDisplayName;
 $('#saveRecoveryEmailBtn').onclick=saveRecoveryEmail;
 ['#forgotPasswordModal','#profileEditModal','#recoveryEmailModal'].forEach(sel=>{$(sel).onclick=e=>{if(e.target===$(sel))closeModal(sel)}});
}

function ensureLoginEnhancements(){
 const modal=$('#profileModal'),save=$('#saveProfileBtn');if(!modal||!save||$('#accountAuthExtras'))return;
 save.insertAdjacentHTML('beforebegin',`
  <div id="accountAuthExtras" class="account-auth-extras">
   <div id="recoveryEmailField" class="account-email-create hidden"><label>E-mail pro záchranu účtu <span class="optional-tag">nepovinný</span><input id="recoveryEmailInput" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.cz"></label><div class="account-email-warning"><span>🛟</span><div><strong>Doporučujeme ho přidat.</strong><small>Bez ověřeného e-mailu účet funguje normálně, ale zapomenuté heslo nepůjde obnovit.</small></div></div></div>
   <button id="forgotPasswordBtn" type="button" class="account-forgot-btn">Zapomněl jsem heslo</button><div class="account-auth-divider"><span>nebo</span></div>
   <button id="googleLoginBtn" type="button" class="google-auth-btn"><img class="google-g" src="/google-g.svg" alt="" aria-hidden="true"><strong>Pokračovat přes Google</strong></button>
  </div>`);
 const original=save.onclick;
 save.onclick=async function(e){
  const create=$('#profileModeCreate')?.classList.contains('active'),email=$('#recoveryEmailInput')?.value.trim()||'';
  if(create&&email&&!validEmail(email)){const err=$('#profileFormError');if(err)err.textContent='Zkontroluj prosím e-mailovou adresu.';return}
  const before=profile()?.id||null,result=original?.call(this,e);if(result&&typeof result.then==='function')await result;const after=profile();
  if(create&&email&&after?.id&&after.id!==before){try{await call('/api/account/email/start',{method:'POST',body:{email}});toast('📬 Účet je uložený. Teď ještě potvrď e-mail v doručené poště.')}catch(err){toast(`Účet je uložený, ale e-mail zatím ne: ${err.message}`)}}
 };
 $('#forgotPasswordBtn').onclick=()=>{closeModal('#profileModal');openModal('#forgotPasswordModal');$('#forgotPasswordMessage').textContent='';setTimeout(()=>$('#forgotEmailInput')?.focus(),80)};
 $('#googleLoginBtn').onclick=()=>{location.href='/api/auth/google/start'};
 syncLoginMode();new MutationObserver(syncLoginMode).observe($('#profileModeCreate'),{attributes:true,attributeFilter:['class']});
}
function syncLoginMode(){
 const create=$('#profileModeCreate')?.classList.contains('active');$('#recoveryEmailField')?.classList.toggle('hidden',!create);$('#forgotPasswordBtn')?.classList.toggle('hidden',!!create);
 const inp=$('#playerNameInput');if(inp){inp.placeholder=create?'Jak ti má Proplet říkat?':'Jméno nebo ověřený e-mail';inp.setAttribute('autocomplete',create?'nickname':'username')}
 const label=inp?.closest('label');if(label){for(const n of [...label.childNodes])if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim()){n.textContent=create?'Přezdívka':'Jméno nebo e-mail';break}}
 const desc=$('#profileModalDesc');if(desc)desc.textContent=create?'Přezdívku můžeš kdykoli změnit. Heslo je povinné; e-mail nepovinný, ale bez něj nepůjde obnovit zapomenuté heslo.':'Přihlas se herním jménem nebo ověřeným e-mailem. Případně použij Google.';
}

function captureAvatars(card){const found=[...card.querySelectorAll('.avatar-choice')].map(b=>b.dataset.avatar).filter(Boolean);if(found.length)knownAvatars=[...new Set(found)]}
function settingsCard(label){return $$('#screen-profile .settings-card').find(c=>(c.querySelector('.eyebrow')?.textContent||'').trim().includes(label))||null}
function ensureTeamSection(team){
 let wrap=$('#profileTeamSettingsCard');if(!wrap){wrap=document.createElement('div');wrap.id='profileTeamSettingsCard';wrap.className='card settings-card profile-team-settings';wrap.innerHTML='<div class="section-head"><div><span class="eyebrow">TÝM</span><h2>Tým a společné pořadí</h2></div><span class="profile-section-icon">👥</span></div><div class="profile-team-body"></div>';$('#profileCard')?.insertAdjacentElement('afterend',wrap)}
 const body=wrap.querySelector('.profile-team-body');body.replaceChildren(team);
}
function moveSupportSetting(support){
 const card=settingsCard('POCIT ZE HRY');if(!card)return;let slot=card.querySelector('.profile-support-slot');if(!slot){slot=document.createElement('div');slot.className='profile-support-slot';const row=card.querySelector('.settings-row');row?row.insertAdjacentElement('beforebegin',slot):card.appendChild(slot)}slot.replaceChildren(support);
}
function moveAdminEntry(admin){
 const trust=settingsCard('ÚČET A SOUKROMÍ');if(!trust)return;let slot=$('#profileAdminSlot');if(!slot){slot=document.createElement('div');slot.id='profileAdminSlot';slot.className='profile-admin-slot';trust.insertAdjacentElement('afterend',slot)}slot.replaceChildren(admin);
}
function ensureAccountHub(){
 const card=$('#profileCard'),p=profile();if(!card||!p)return null;let hub=card.querySelector('#profileAccountHub');if(!hub){hub=document.createElement('section');hub.id='profileAccountHub';hub.className='profile-account-hub';hub.innerHTML='<div class="profile-account-head"><div><span class="stat-label">ÚČET</span><strong>Přihlášení a záchrana</strong></div><span id="profileAccountBadge" class="profile-account-badge">Kontroluju…</span></div><div id="accountSecurityBody" class="profile-account-body"><div class="account-security-loading">Kontroluju účet…</div></div><div id="profileSyncSlot"></div><div id="profileAccountActions" class="profile-account-actions"></div>';const grid=card.querySelector('.profile-grid');grid?grid.insertAdjacentElement('afterend',hub):card.appendChild(hub)}return hub;
}
function enhanceProfileArchitecture(){
 const card=$('#profileCard'),p=profile();if(!card||!p)return;captureAvatars(card);
 card.querySelectorAll('.account-banner,.avatar-picker').forEach(n=>n.remove());
 const family=card.querySelector('.profile-family');if(family&&!p.familyCode)family.textContent='Bez týmu';
 const name=card.querySelector('.profile-name');if(name&&!card.querySelector('#editProfileInlineBtn')){const b=document.createElement('button');b.id='editProfileInlineBtn';b.className='profile-edit-inline';b.type='button';b.innerHTML='✎ <span>Upravit profil</span>';b.onclick=openProfileEditor;name.insertAdjacentElement('afterend',b)}
 const team=card.querySelector('.team-access-card');if(team)ensureTeamSection(team);
 const support=card.querySelector('.support-mode-card');if(support)moveSupportSetting(support);
 const admin=card.querySelector('#adminEntryBtn');if(admin)moveAdminEntry(admin);
 const hub=ensureAccountHub();if(hub){const sync=card.querySelector(':scope > .sync-panel');if(sync){sync.classList.toggle('profile-sync-ok',!!sync.querySelector('.sync-status.success'));hub.querySelector('#profileSyncSlot').replaceChildren(sync)}const logout=card.querySelector(':scope > #logoutBtn');if(logout)hub.querySelector('#profileAccountActions').replaceChildren(logout)}
 refreshSecurityCard();
}
function scheduleEnhance(){if(enhanceScheduled)return;enhanceScheduled=true;setTimeout(()=>{enhanceScheduled=false;enhanceProfileArchitecture()},0)}

async function refreshSecurityCard(){
 if(!profileScreenActive())return;
 if(securityRefreshPromise)return securityRefreshPromise;
 securityRefreshPromise=(async()=>{
  const p=profile();if(!p)return;const hub=ensureAccountHub(),body=hub?.querySelector('#accountSecurityBody');if(!body)return;
  try{
   const d=await call('/api/account/auth-status'),badge=hub.querySelector('#profileAccountBadge');if(badge){const strong=!!(d.recoveryReady||d.googleLinked);badge.textContent=strong?'Zabezpečeno':'Doplnit';badge.classList.toggle('ok',strong)}
   body.innerHTML=`<div class="account-hub-row ${d.recoveryReady?'ok':'warn'}"><span>${d.recoveryReady?'✉️':'⚠️'}</span><div><strong>${d.recoveryReady?'E-mail pro obnovu':'Chybí záchranný e-mail'}</strong><small>${d.recoveryReady?esc(d.email):'Bez něj zapomenuté heslo neobnovíš.'}</small></div>${d.recoveryReady?'':`<button id="addRecoveryEmailBtn" class="secondary-btn">Přidat</button>`}</div><div class="account-hub-row ${d.googleLinked?'ok':'neutral'}"><span>${d.googleLinked?'✅':'<img class="google-g google-g-small" src="/google-g.svg" alt="" aria-hidden="true">'}</span><div><strong>${d.googleLinked?'Google propojený':'Přihlášení přes Google'}</strong><small>${d.googleLinked?'Příště se přihlásíš jedním klepnutím.':d.googleAvailable?'Propoj účet a nemusíš řešit heslo.':'Google přihlášení teď není dostupné.'}</small></div>${d.googleLinked?'':`<button id="linkGoogleBtn" class="secondary-btn" ${d.googleAvailable?'':'disabled'}>Propojit</button>`}</div>${p.hasPassword?'':`<div class="account-hub-row neutral"><span>🔑</span><div><strong>Heslo je volitelné</strong><small>Google stačí. Heslo můžeš přidat jako další možnost přihlášení.</small></div><button id="setPasswordFromHub" class="secondary-btn">Nastavit</button></div>`}`;
   $('#addRecoveryEmailBtn')?.addEventListener('click',openRecoveryEmailModal);$('#linkGoogleBtn')?.addEventListener('click',()=>{location.href='/api/auth/google/start'});$('#setPasswordFromHub')?.addEventListener('click',()=>{if(typeof openPasswordModal==='function')openPasswordModal()});
  }catch(e){body.innerHTML=`<p class="account-auth-error">${esc(e.message)}</p>`}
 })().finally(()=>{securityRefreshPromise=null});
 return securityRefreshPromise;
}

function openProfileEditor(){
 const p=profile();if(!p)return;ensureModals();$('#displayNameInput').value=p.name||'';$('#displayNameMessage').textContent='';const avatars=knownAvatars.length?knownAvatars:[p.avatar||'🙂'];const google=$('#profileEditGoogleAvatar'),safeUrl=typeof safeGoogleAvatarUrl==='function'?safeGoogleAvatarUrl(p.googleAvatarUrl):'';google.innerHTML=safeUrl?`<button type="button" id="useGoogleAvatarBtn" class="google-avatar-choice ${p.useGoogleAvatar?'selected':''}"><img src="${esc(safeUrl)}" alt="" referrerpolicy="no-referrer"><span><strong>Fotka z Googlu</strong><small>${p.useGoogleAvatar?'Používáš v Propletu':'Použít jako avatar'}</small></span></button>`:(p.googleLinked?'<div class="google-avatar-unavailable"><strong>Fotku z Googlu načteme při příštím přihlášení přes Google.</strong></div>':'');$('#useGoogleAvatarBtn')?.addEventListener('click',async()=>{if(typeof saveGoogleAvatar==='function'){await saveGoogleAvatar();openProfileEditor()}});const grid=$('#profileEditAvatarGrid');grid.innerHTML=avatars.map(a=>`<button type="button" class="avatar-choice ${!p.useGoogleAvatar&&a===(p.avatar||'🙂')?'selected':''}" data-edit-avatar="${esc(a)}">${esc(a)}</button>`).join('');grid.querySelectorAll('[data-edit-avatar]').forEach(b=>b.onclick=async()=>{if(typeof saveAvatar==='function'){await saveAvatar(b.dataset.editAvatar);openProfileEditor()}});openModal('#profileEditModal');setTimeout(()=>$('#displayNameInput')?.focus(),60);
}
async function saveDisplayName(){
 const input=$('#displayNameInput'),msg=$('#displayNameMessage'),btn=$('#saveDisplayNameBtn'),name=String(input.value||'').trim().replace(/\s+/g,' ');msg.textContent='';if(!name){msg.textContent='Napiš, jak ti má Proplet říkat.';return}if(name.length>24){msg.textContent='Přezdívka může mít nejvýš 24 znaků.';return}btn.disabled=true;
 try{const d=await call('/api/account/display-name',{method:'POST',body:{name}}),p=profile();if(typeof saveProfile==='function')saveProfile({...p,name:d.name});if(typeof updateProfileChip==='function')updateProfileChip();if(typeof renderProfile==='function')renderProfile();if(typeof renderLeaderboard==='function')renderLeaderboard();closeModal('#profileEditModal');toast(`✎ Teď ti říkáme ${d.name}.`)}catch(e){msg.textContent=e.message}finally{btn.disabled=false}
}
function openRecoveryEmailModal(){ensureModals();$('#recoveryEmailAddInput').value='';$('#recoveryEmailAddMessage').textContent='';openModal('#recoveryEmailModal');setTimeout(()=>$('#recoveryEmailAddInput')?.focus(),60)}
async function saveRecoveryEmail(){const email=$('#recoveryEmailAddInput').value.trim(),msg=$('#recoveryEmailAddMessage'),btn=$('#saveRecoveryEmailBtn');msg.textContent='';if(!validEmail(email)){msg.textContent='Zkontroluj e-mailovou adresu.';return}btn.disabled=true;try{const d=await call('/api/account/email/start',{method:'POST',body:{email}});msg.textContent=d.message||'Odkaz je na cestě.'}catch(e){msg.textContent=e.message}finally{btn.disabled=false}}
async function sendRecovery(){const email=$('#forgotEmailInput').value.trim(),msg=$('#forgotPasswordMessage'),btn=$('#sendRecoveryBtn');msg.textContent='';if(!validEmail(email)){msg.textContent='Zadej platný e-mail.';return}btn.disabled=true;try{const d=await call('/api/auth/recovery/start',{method:'POST',body:{email},auth:false});msg.textContent=d.message||'Pokud účet existuje, odkaz je na cestě.'}catch(e){msg.textContent=e.message}finally{btn.disabled=false}}
async function completeRecovery(){const p1=$('#recoveryPassword').value,p2=$('#recoveryPassword2').value,msg=$('#resetPasswordMessage'),btn=$('#completeRecoveryBtn');msg.textContent='';if(p1.length<8){msg.textContent='Heslo musí mít alespoň 8 znaků.';return}if(p1!==p2){msg.textContent='Hesla se neshodují.';return}if(!recoveryContext){msg.textContent='Obnovovací odkaz už není aktivní.';return}btn.disabled=true;try{const d=await call('/api/auth/recovery/reset',{method:'POST',body:{challenge:recoveryContext.challenge,accessToken:recoveryContext.accessToken,password:p1},auth:false});acceptProfile(d.profile);recoveryContext=null;sessionStorage.removeItem('proplet-recovery-context');closeModal('#resetPasswordModal');cleanAuthUrl();toast('🔐 Heslo je změněné. Jsi znovu přihlášený.')}catch(e){msg.textContent=e.message}finally{btn.disabled=false}}

async function handleAuthReturn(){
 const qs=new URLSearchParams(location.search),kind=qs.get('auth');if(!kind)return;ensureModals();const frag=supabaseFragment();if(frag.error){toast(`Přihlášení se nepodařilo: ${frag.error}`);cleanAuthUrl();return}if(!frag.accessToken)return;
 try{if(kind==='google'){const d=await call('/api/auth/google/complete',{method:'POST',body:{accessToken:frag.accessToken}});acceptProfile(d.profile);cleanAuthUrl();toast(d.linked?'✅ Google je propojený s tvým Propletem.':'🎉 Přihlášeno přes Google.');return}const challenge=qs.get('challenge')||'';if(kind==='email-link'){const d=await call('/api/account/email/verify',{method:'POST',body:{challenge,accessToken:frag.accessToken},auth:false});acceptProfile(d.profile);cleanAuthUrl();toast('✅ E-mail je ověřený. Zapomenuté heslo už umíme zachránit.');return}if(kind==='recover'){await call('/api/auth/recovery/check',{method:'POST',body:{challenge,accessToken:frag.accessToken},auth:false});recoveryContext={challenge,accessToken:frag.accessToken};sessionStorage.setItem('proplet-recovery-context',JSON.stringify(recoveryContext));openModal('#resetPasswordModal');return}}catch(e){toast(e.message);cleanAuthUrl()}
}

function init(){
 ensureModals();ensureLoginEnhancements();
 const card=$('#profileCard');if(card)new MutationObserver(scheduleEnhance).observe(card,{childList:true});
 document.querySelectorAll('[data-nav="profile"]').forEach(el=>el.addEventListener('click',()=>setTimeout(enhanceProfileArchitecture,100)));
 const stored=sessionStorage.getItem('proplet-recovery-context');if(stored)try{recoveryContext=JSON.parse(stored)}catch{}
 handleAuthReturn();setTimeout(enhanceProfileArchitecture,160);window.__PROPLET_ACCOUNT_AUTH__={refreshSecurityCard,handleAuthReturn,openProfileEditor};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
