(()=>{
'use strict';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim());
let recoveryContext=null;

function profile(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
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
  if(typeof saveProfile==='function')saveProfile({id:p.id,name:p.name,familyCode:p.familyCode||null,leagueName:p.leagueName||null,avatar:p.avatar||'🙂',supportMode:p.supportMode||'none',token:p.token,hasPassword:!!p.hasPassword,stats:p.stats});
  if(typeof updateProfileChip==='function')updateProfileChip();
  if(typeof renderProfile==='function')renderProfile();
  if(typeof renderDaily==='function')renderDaily();
  if(typeof renderFree==='function')renderFree();
  if(typeof renderLeaderboard==='function')renderLeaderboard();
  if(typeof syncQueue==='function')syncQueue({announce:true}).catch(()=>{});
 }catch{}
 setTimeout(refreshSecurityCard,80);
}
function supabaseFragment(){
 const p=new URLSearchParams(location.hash.replace(/^#/,''));
 return {accessToken:p.get('access_token')||'',error:p.get('error_description')||p.get('error')||''};
}

function ensureModals(){
 if($('#forgotPasswordModal'))return;
 document.body.insertAdjacentHTML('beforeend',`
  <div id="forgotPasswordModal" class="modal-backdrop hidden"><div class="modal-card account-recovery-modal">
   <div class="modal-head"><div><span class="eyebrow">ZÁCHRANA ÚČTU</span><h2>Zapomenuté heslo</h2></div><button id="closeForgotPassword" class="icon-btn" aria-label="Zavřít">×</button></div>
   <p class="muted">Zadej <b>ověřený e-mail</b> propojený s Propletem. Pošleme ti jednorázový odkaz pro nastavení nového hesla.</p>
   <label class="field-label">E-mail<input id="forgotEmailInput" class="field-input" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.cz"></label>
   <div id="forgotPasswordMessage" class="account-auth-message"></div>
   <button id="sendRecoveryBtn" class="primary-btn big">Poslat odkaz</button>
  </div></div>
  <div id="resetPasswordModal" class="modal-backdrop hidden"><div class="modal-card account-recovery-modal">
   <div class="modal-head"><div><span class="eyebrow">NOVÉ HESLO</span><h2>Účet je ověřený</h2></div></div>
   <p class="muted">Teď už jen nastav nové heslo. Ostatní aktivní přihlášení pro jistotu odpojíme.</p>
   <label class="field-label">Nové heslo<input id="recoveryPassword" class="field-input" type="password" autocomplete="new-password" minlength="8"></label>
   <label class="field-label">Znovu<input id="recoveryPassword2" class="field-input" type="password" autocomplete="new-password" minlength="8"></label>
   <div id="resetPasswordMessage" class="account-auth-message"></div>
   <button id="completeRecoveryBtn" class="primary-btn big">Nastavit nové heslo</button>
  </div></div>`);
 $('#closeForgotPassword').onclick=()=>$('#forgotPasswordModal').classList.add('hidden');
 $('#forgotPasswordModal').onclick=e=>{if(e.target===$('#forgotPasswordModal'))$('#forgotPasswordModal').classList.add('hidden')};
 $('#sendRecoveryBtn').onclick=sendRecovery;
 $('#completeRecoveryBtn').onclick=completeRecovery;
}

function ensureLoginEnhancements(){
 const modal=$('#profileModal'),save=$('#saveProfileBtn');if(!modal||!save||$('#accountAuthExtras'))return;
 const nameLabel=$('#playerNameInput')?.closest('label');
 if(nameLabel)nameLabel.dataset.baseLabel='Jméno';
 save.insertAdjacentHTML('beforebegin',`
  <div id="accountAuthExtras" class="account-auth-extras">
   <div id="recoveryEmailField" class="account-email-create hidden">
    <label class="field-label">E-mail pro záchranu účtu <span class="optional-tag">nepovinný</span><input id="recoveryEmailInput" class="field-input" type="email" autocomplete="email" inputmode="email" placeholder="ty@example.cz"></label>
    <div class="account-email-warning"><span>🛟</span><div><strong>Doporučujeme ho přidat.</strong><small>Bez ověřeného e-mailu účet funguje normálně, ale zapomenuté heslo nepůjde obnovit.</small></div></div>
   </div>
   <button id="forgotPasswordBtn" type="button" class="account-forgot-btn">Zapomněl jsem heslo</button>
   <div class="account-auth-divider"><span>nebo</span></div>
   <button id="googleLoginBtn" type="button" class="google-auth-btn"><img class="google-g" src="/google-g.svg" alt="" aria-hidden="true"><strong>Pokračovat přes Google</strong></button>
  </div>`);
 const original=save.onclick;
 save.onclick=async function(e){
  const create=$('#profileModeCreate')?.classList.contains('active');
  const email=$('#recoveryEmailInput')?.value.trim()||'';
  if(create&&email&&!validEmail(email)){const err=$('#profileFormError');if(err)err.textContent='Zkontroluj prosím e-mailovou adresu.';return}
  const before=profile()?.id||null;
  const result=original?.call(this,e);if(result&&typeof result.then==='function')await result;
  const after=profile();
  if(create&&email&&after?.id&&after.id!==before){
   try{await call('/api/account/email/start',{method:'POST',body:{email}});toast('📬 Účet je uložený. Teď ještě potvrď e-mail v doručené poště.')}catch(err){toast(`Účet je uložený, ale e-mail zatím ne: ${err.message}`)}
  }
 };
 $('#forgotPasswordBtn').onclick=()=>{ensureModals();$('#profileModal').classList.add('hidden');$('#forgotPasswordModal').classList.remove('hidden');$('#forgotPasswordMessage').textContent='';setTimeout(()=>$('#forgotEmailInput')?.focus(),80)};
 $('#googleLoginBtn').onclick=()=>{location.href='/api/auth/google/start'};
 syncLoginMode();
 new MutationObserver(syncLoginMode).observe($('#profileModeCreate'),{attributes:true,attributeFilter:['class']});
}
function syncLoginMode(){
 const create=$('#profileModeCreate')?.classList.contains('active');
 $('#recoveryEmailField')?.classList.toggle('hidden',!create);
 $('#forgotPasswordBtn')?.classList.toggle('hidden',!!create);
 const inp=$('#playerNameInput');if(inp){inp.placeholder=create?'Tvoje herní jméno':'Jméno nebo ověřený e-mail';inp.setAttribute('autocomplete',create?'nickname':'username')}
 const label=inp?.closest('label');if(label){for(const n of [...label.childNodes])if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim()){n.textContent=create?'Jméno':'Jméno nebo e-mail';break}}
 const desc=$('#profileModalDesc');if(desc)desc.textContent=create?'Heslo je povinné. E-mail je nepovinný, ale bez něj nepůjde obnovit zapomenuté heslo.':'Přihlas se herním jménem nebo ověřeným e-mailem. Případně použij Google.';
}

async function sendRecovery(){
 const email=$('#forgotEmailInput').value.trim(),msg=$('#forgotPasswordMessage'),btn=$('#sendRecoveryBtn');msg.textContent='';
 if(!validEmail(email)){msg.textContent='Zadej platný e-mail.';return}
 btn.disabled=true;try{const d=await call('/api/auth/recovery/start',{method:'POST',body:{email},auth:false});msg.textContent=d.message||'Pokud účet existuje, odkaz je na cestě.'}catch(e){msg.textContent=e.message}finally{btn.disabled=false}
}
async function completeRecovery(){
 const p1=$('#recoveryPassword').value,p2=$('#recoveryPassword2').value,msg=$('#resetPasswordMessage'),btn=$('#completeRecoveryBtn');msg.textContent='';
 if(p1.length<8){msg.textContent='Heslo musí mít alespoň 8 znaků.';return}if(p1!==p2){msg.textContent='Hesla se neshodují.';return}if(!recoveryContext){msg.textContent='Obnovovací odkaz už není aktivní.';return}
 btn.disabled=true;try{const d=await call('/api/auth/recovery/reset',{method:'POST',body:{challenge:recoveryContext.challenge,accessToken:recoveryContext.accessToken,password:p1},auth:false});acceptProfile(d.profile);recoveryContext=null;sessionStorage.removeItem('proplet-recovery-context');$('#resetPasswordModal').classList.add('hidden');cleanAuthUrl();toast('🔐 Heslo je změněné. Jsi znovu přihlášený.')}catch(e){msg.textContent=e.message}finally{btn.disabled=false}
}

function ensureSecurityCard(){
 const screen=$('#screen-profile');if(!screen||$('#accountSecurityCard'))return;
 const anchor=screen.querySelector('.appearance-card')||screen.querySelector('.settings-card');
 const html=`<div id="accountSecurityCard" class="card settings-card account-security-card"><div class="section-head"><div><span class="eyebrow">ÚČET A ZABEZPEČENÍ</span><h2>Ať se k Propletu vždycky vrátíš</h2></div><span class="security-shield">🛟</span></div><div id="accountSecurityBody" class="account-security-body"><div class="account-security-loading">Kontroluju účet…</div></div></div>`;
 if(anchor)anchor.insertAdjacentHTML('beforebegin',html);else screen.insertAdjacentHTML('beforeend',html);
}
async function refreshSecurityCard(){
 ensureSecurityCard();const body=$('#accountSecurityBody');if(!body)return;
 const p=profile();if(!p){body.innerHTML='<p class="muted">Zabezpečení účtu se ukáže po přihlášení.</p>';return}
 try{
  const d=await call('/api/account/auth-status');
  body.innerHTML=`
   <div class="security-status-row ${d.recoveryReady?'ok':'warn'}"><span>${d.recoveryReady?'✅':'⚠️'}</span><div><strong>${d.recoveryReady?'Obnova hesla je připravená':'Bez záchranného e-mailu'}</strong><small>${d.recoveryReady?esc(d.email):'Když zapomeneš heslo, bez e-mailu účet nepůjde obnovit.'}</small></div>${d.recoveryReady?'':`<button id="addRecoveryEmailBtn" class="secondary-btn">Přidat e-mail</button>`}</div>
   <div class="security-status-row ${d.googleLinked?'ok':'neutral'}"><span>${d.googleLinked?'✅':'<img class="google-g google-g-small" src="/google-g.svg" alt="" aria-hidden="true">'}</span><div><strong>${d.googleLinked?'Google je propojený':'Přihlášení přes Google'}</strong><small>${d.googleLinked?'Můžeš se přihlásit jedním klepnutím.':d.googleAvailable?'Propoj účet a příště neřeš heslo.':'Připravujeme propojení s Googlem.'}</small></div>${d.googleLinked?'':`<button id="linkGoogleBtn" class="secondary-btn" ${d.googleAvailable?'':'disabled'}>Propojit</button>`}</div>`;
  $('#addRecoveryEmailBtn')?.addEventListener('click',openAddEmailPrompt);
  $('#linkGoogleBtn')?.addEventListener('click',()=>{location.href='/api/auth/google/start'});
 }catch(e){body.innerHTML=`<p class="account-auth-error">${esc(e.message)}</p>`}
}
function openAddEmailPrompt(){
 const email=prompt('E-mail pro obnovu hesla:');if(!email)return;if(!validEmail(email)){toast('Zkontroluj e-mailovou adresu.');return}
 call('/api/account/email/start',{method:'POST',body:{email}}).then(()=>toast('📬 Ověřovací odkaz je na cestě.')).catch(e=>toast(e.message));
}

async function handleAuthReturn(){
 const qs=new URLSearchParams(location.search),kind=qs.get('auth');if(!kind)return;
 ensureModals();const frag=supabaseFragment();
 if(frag.error){toast(`Přihlášení se nepodařilo: ${frag.error}`);cleanAuthUrl();return}
 if(!frag.accessToken)return;
 try{
  if(kind==='google'){
   const d=await call('/api/auth/google/complete',{method:'POST',body:{accessToken:frag.accessToken}});acceptProfile(d.profile);cleanAuthUrl();toast(d.linked?'✅ Google je propojený s tvým Propletem.':'🎉 Přihlášeno přes Google.');return;
  }
  const challenge=qs.get('challenge')||'';
  if(kind==='email-link'){
   const d=await call('/api/account/email/verify',{method:'POST',body:{challenge,accessToken:frag.accessToken},auth:false});acceptProfile(d.profile);cleanAuthUrl();toast('✅ E-mail je ověřený. Zapomenuté heslo už umíme zachránit.');return;
  }
  if(kind==='recover'){
   await call('/api/auth/recovery/check',{method:'POST',body:{challenge,accessToken:frag.accessToken},auth:false});recoveryContext={challenge,accessToken:frag.accessToken};sessionStorage.setItem('proplet-recovery-context',JSON.stringify(recoveryContext));$('#resetPasswordModal').classList.remove('hidden');return;
  }
 }catch(e){toast(e.message);cleanAuthUrl()}
}

function init(){
 ensureModals();ensureLoginEnhancements();ensureSecurityCard();
 document.querySelectorAll('[data-nav="profile"]').forEach(el=>el.addEventListener('click',()=>setTimeout(refreshSecurityCard,120)));
 const stored=sessionStorage.getItem('proplet-recovery-context');if(stored)try{recoveryContext=JSON.parse(stored)}catch{}
 handleAuthReturn();setTimeout(refreshSecurityCard,160);
 window.__PROPLET_ACCOUNT_AUTH__={refreshSecurityCard,handleAuthReturn};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
