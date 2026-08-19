(()=>{
  'use strict';
  if(window.__PROPLET_PUSH_RETENTION_V3329__)return;
  window.__PROPLET_PUSH_RETENTION_V3329__=true;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profile=()=>{try{return JSON.parse(localStorage.getItem('proplet-v2-profile')||'null')}catch{return null}};
  const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=()=>window.matchMedia?.('(display-mode: standalone)')?.matches===true||navigator.standalone===true;
  const authHeaders=()=>{const p=profile();return p?.token?{'Authorization':`Bearer ${p.token}`}:{}};
  const jsonFetch=async(url,options={})=>{const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...authHeaders(),...(options.headers||{})},cache:'no-store'});let body={};try{body=await r.json()}catch{}if(!r.ok)throw new Error(body.detail||body.message||`HTTP ${r.status}`);return body};
  const toast=msg=>{try{if(typeof showToast==='function')return showToast(msg)}catch{}console.info(msg)};

  async function currentSubscription(){
    if(!('serviceWorker'in navigator)||!('PushManager'in window))return null;
    try{const reg=await navigator.serviceWorker.ready;return await reg.pushManager.getSubscription()}catch{return null}
  }

  async function sendSelfTest(btn){
    const sub=await currentSubscription();
    if(!sub){toast('Na tomto zařízení zatím není aktivní upozornění.');return}
    btn.disabled=true;const old=btn.textContent;btn.textContent='Posílám…';
    try{
      const result=await jsonFetch('/api/push/test',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})});
      if(result.status==='removed'){
        try{await sub.unsubscribe()}catch{}
        toast(result.message||'Subscription vypršela. Zapni upozornění znovu.');
      }else toast('Test odeslán 🔔 Měl by dorazit během pár sekund.');
    }catch(e){toast(e.message||'Test se nepodařil.')}finally{btn.disabled=false;btn.textContent=old}
  }

  function installMainUi(){
    const pushCard=document.querySelector('.push-card');if(!pushCard)return false;
    if(!document.getElementById('pushSelfTestRow')){
      const row=document.createElement('div');row.id='pushSelfTestRow';row.className='push-self-test';
      row.innerHTML='<div class="push-self-test-copy"><strong>Otestovat toto zařízení</strong><small>Pošli si skutečné systémové upozornění a ověř, že cesta funguje až do telefonu.</small></div><button id="pushSelfTestBtn" class="secondary-btn" type="button">🔔 Otestovat</button>';
      pushCard.appendChild(row);row.querySelector('button').onclick=e=>sendSelfTest(e.currentTarget);
    }
    if(ios()&&!standalone()&&!document.getElementById('iosPwaPushCallout')){
      const callout=document.createElement('div');callout.id='iosPwaPushCallout';callout.className='ios-pwa-push-callout';
      callout.innerHTML='<span>📲</span><div><strong>Na iPhonu až z aplikace na ploše</strong><small>iOS dovolí Propletu posílat upozornění až po přidání na plochu. Pak je zapneš tady.</small></div><button class="secondary-btn" type="button">Přidat na plochu</button>';
      const copy=pushCard.querySelector('.push-copy');(copy||pushCard.querySelector('.section-head'))?.insertAdjacentElement('afterend',callout);
      callout.querySelector('button').onclick=()=>{try{if(typeof openInstallFromProfile==='function')openInstallFromProfile();else document.getElementById('installAppBtn')?.click()}catch{document.getElementById('installAppBtn')?.click()}};
    }
    const test=document.getElementById('pushSelfTestBtn');
    if(test&&ios()&&!standalone()){test.disabled=true;test.title='Na iPhonu nejdřív přidej Proplet na plochu.'}
    return true;
  }

  function fmtStamp(v){if(!v)return '—';try{return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}}
  function renderAdmin(data){
    const target=document.getElementById('pushDiagnosticsContent');if(!target)return;
    const latest=data.latestDaily;
    const s=data.subscriptions||{};
    const recent=(data.recentDaily||[]).slice(0,7);
    target.innerHTML=`<div class="push-diag-grid"><div class="push-diag-stat"><b>${latest?.eligible??'—'}</b><small>eligible naposledy</small></div><div class="push-diag-stat"><b>${latest?.sent??'—'}</b><small>odesláno</small></div><div class="push-diag-stat"><b>${latest?.failed??'—'}</b><small>selhalo</small></div><div class="push-diag-stat"><b>${s.dailyEnabled??0}/${s.total??0}</b><small>Daily subscription</small></div></div>${recent.length?`<table class="push-diag-table"><thead><tr><th>Běh</th><th>Eligible</th><th>Sent</th><th>Failed</th><th>Removed</th></tr></thead><tbody>${recent.map(r=>`<tr><td>${esc((r.eventKey||'').replace('daily:',''))}</td><td>${r.eligible||0}</td><td>${r.sent||0}</td><td>${r.failed||0}</td><td>${r.removed||0}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Ještě žádný auditovaný Daily běh. První vznikne při příštím ranním cronu.</p>'}<p class="push-diag-note">${esc(data.historicalNote||'')} · Testů celkem: ${data.tests?.total||0}</p><details><summary>Aktivní zařízení (${s.total||0})</summary><table class="push-diag-table"><thead><tr><th>Hráč</th><th>Zařízení</th><th>Daily</th><th>Push služba</th><th>Aktualizace</th></tr></thead><tbody>${(s.rows||[]).map(r=>`<tr><td>${esc(r.playerName)}</td><td>${esc(r.device)}</td><td>${r.dailyEnabled?'✓':'—'}</td><td>${esc(r.pushHost||'')}</td><td>${esc(fmtStamp(r.updatedAt||r.createdAt))}</td></tr>`).join('')}</tbody></table></details>`;
  }
  async function loadAdmin(){
    const target=document.getElementById('pushDiagnosticsContent');if(!target)return;
    target.textContent='Načítám push diagnostiku…';
    try{renderAdmin(await jsonFetch('/api/admin/push-diagnostics'))}catch(e){target.textContent=`Push diagnostika: ${e.message}`}
  }
  function installAdminUi(){
    const launch=document.getElementById('launchContent');if(!launch)return false;
    if(document.getElementById('pushDiagnosticsContent'))return true;
    const head=document.createElement('div');head.className='page-head push-diag-head';head.innerHTML='<div><p class="eyebrow">PUSH</p><h2>Doručení upozornění</h2><p class="muted">Per-device audit Daily pushů a testovacích upozornění.</p></div><button id="refreshPushDiagnosticsBtn" class="ghost-button">Obnovit</button>';
    const content=document.createElement('div');content.id='pushDiagnosticsContent';content.className='panel';content.textContent='Push diagnostika se načte po ověření administrátora.';
    launch.insertAdjacentElement('afterend',content);content.insertAdjacentElement('beforebegin',head);head.querySelector('button').onclick=loadAdmin;
    setTimeout(loadAdmin,500);return true;
  }

  let tries=0;
  const boot=()=>{
    const done=document.getElementById('adminGate')?installAdminUi():installMainUi();
    if(done||++tries>120)return;
    setTimeout(boot,100);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
