(()=>{
'use strict';
if(window.__PROPLET_ACCOUNT_TEAM_V33210__)return;
window.__PROPLET_ACCOUNT_TEAM_V33210__=true;

const PROFILE_KEY='proplet-v2-profile';
const profile=()=>{try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}};
const authHeaders=()=>profile()?.token?{'Authorization':`Bearer ${profile().token}`}:{ };
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* New clients use the dedupe-aware login endpoint. The historical /api/login stays available
   for cached clients, while the server-side create-race guard protects both generations. */
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  try{
    const raw=typeof input==='string'?input:input?.url;
    const url=new URL(raw,location.href);
    if(url.origin===location.origin&&url.pathname==='/api/login'){
      url.pathname='/api/login-integrity';
      input=typeof input==='string'?url.pathname+url.search:new Request(url.href,input);
    }
  }catch{}
  return nativeFetch(input,init);
};

function wrapAccountSubmit(){
  const btn=document.getElementById('saveProfileBtn');
  if(!btn||btn.dataset.integrityWrapped==='1'||typeof btn.onclick!=='function')return false;
  const original=btn.onclick;
  btn.dataset.integrityWrapped='1';
  btn.onclick=async function(event){
    if(btn.dataset.integrityPending==='1')return;
    btn.dataset.integrityPending='1';
    const old=btn.textContent;
    const creating=document.getElementById('profileModeCreate')?.classList.contains('active');
    btn.disabled=true;btn.textContent=creating?'Ukládám…':'Přihlašuji…';
    try{return await original.call(this,event)}
    finally{btn.dataset.integrityPending='0';btn.disabled=false;btn.textContent=old}
  };
  return true;
}

function applyTeamOptOutCopy(){
  const modal=document.getElementById('familyLeagueModal');
  if(modal){
    const intro=modal.querySelector('.modal-card>p.muted');
    if(intro)intro.textContent='Tým je automaticky součástí Ligy týmů. Veřejně se ukazuje jen zvolený název a společné skóre; interní kód, PIN ani účty hráčů ne.';
    const enable=document.getElementById('enableFamilyLeagueBtn');
    if(enable&&enable.textContent.trim()==='Zobrazit tým v pořadí')enable.textContent='Vrátit tým do Ligy týmů';
    const disable=document.getElementById('disableFamilyLeagueBtn');
    if(disable)disable.textContent='Skrýt tým z Ligy týmů';
  }
  const optin=document.querySelector('.global-optin-card');
  if(optin&&document.getElementById('joinFamilyWorldBtn')){
    const eye=optin.querySelector('.eyebrow'),strong=optin.querySelector('strong'),small=optin.querySelector('small'),button=document.getElementById('joinFamilyWorldBtn');
    if(eye)eye.textContent='VÁŠ TÝM JE SKRYTÝ';
    if(strong)strong.textContent='Vrátit tým do Ligy týmů?';
    if(small)small.textContent='Týmy jsou v lize standardně. Tohle nastavení znamená, že jste se dříve rozhodli tým skrýt.';
    if(button)button.textContent='Vrátit tým do ligy 🌍';
  }
}

async function adminApi(path){
  const r=await nativeFetch(path,{headers:{'Accept':'application/json',...authHeaders()},cache:'no-store'});
  let body={};try{body=await r.json()}catch{}
  if(!r.ok)throw new Error(body.detail||`HTTP ${r.status}`);
  return body;
}
let integrity=null;
function renderIntegrityCard(){
  const launch=document.getElementById('launchContent');if(!launch||!integrity)return;
  let card=document.getElementById('accountIntegrityPanel');
  if(!card){card=document.createElement('div');card.id='accountIntegrityPanel';card.className='panel';launch.insertAdjacentElement('afterend',card)}
  card.innerHTML=`<p class="eyebrow">ACCOUNT INTEGRITY</p><h2>Kolik účtů skutečně máme?</h2><div class="launch-metrics"><div class="launch-metric-line"><span>Kanonické účty</span><b>${integrity.canonicalPlayers}</b><small>po odfiltrování double-submit duplicit</small></div><div class="launch-metric-line"><span>Technické player řádky</span><b>${integrity.rawPlayers}</b></div><div class="launch-metric-line"><span>Pravděpodobné duplicity</span><b>${integrity.likelyDuplicateRows}</b><small>${integrity.duplicateClusters} creation burstů</small></div></div><details><summary>Ukázat detekované dvojice</summary><div>${(integrity.rows||[]).map(r=>`<div class="launch-metric-line"><span>${esc(r.name)}</span><b>${r.rows}×</b><small>${r.seconds}s · kanonický účet ${r.canonicalResults} výsledků${r.googleLinked?' · Google':''}</small></div>`).join('')}</div></details><p class="muted compact">${esc(integrity.definition||'')}</p>`;
}
function correctOverviewCount(){
  if(!integrity)return;
  try{
    if(typeof state!=='undefined'&&state.overview?.players&&Number(state.overview.players.total)!==integrity.canonicalPlayers){
      state.overview.players.total=integrity.canonicalPlayers;
      if(typeof renderOverview==='function'&&document.getElementById('overviewContent')&&!document.getElementById('overviewContent').classList.contains('loading-panel'))renderOverview();
    }
  }catch{}
}
async function loadIntegrity(){
  if(!document.getElementById('adminGate'))return;
  try{integrity=await adminApi('/api/admin/account-integrity');renderIntegrityCard();correctOverviewCount()}catch{}
}

let tries=0;
const boot=()=>{
  wrapAccountSubmit();applyTeamOptOutCopy();
  if(document.getElementById('adminGate'))loadIntegrity();
  const observer=new MutationObserver(()=>{wrapAccountSubmit();applyTeamOptOutCopy();if(integrity){renderIntegrityCard();correctOverviewCount()}});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  if(++tries<2)setTimeout(()=>{wrapAccountSubmit();applyTeamOptOutCopy()},250);
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
