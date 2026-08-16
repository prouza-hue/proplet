const PROFILE_KEY='proplet-v2-profile';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={admin:null,launch:null,support:null,overview:null,quality:null,reports:null,users:null,audit:null,activeTab:'launch',launchWindow:'7d'};
const DIFF={easy:'🌱 Snadná',medium:'🧠 Střední',hard:'🧨 Těžká',hardcore:'🤯 Mozkožrout'};
const SUPPORT={none:'Nenabízet',beginner:'Brzy · 45 s',younger:'Vyváženě · 70 s',older:'Dát čas · 100 s'};
const STATUS={new:'Nové',reviewing:'Prověřuji',resolved:'Vyřešeno',dismissed:'Zamítnuto'};

function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function esc(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
function fmtNumber(value){return Number(value||0).toLocaleString('cs-CZ')}
function fmtPct(value){return value==null?'—':`${Math.round(Number(value)*100)} %`}
function fmtTime(ms){if(ms==null)return '—';const sec=Math.round(Number(ms)/1000),min=Math.floor(sec/60);return `${String(min).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function fmtDate(value,withTime=true){if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return esc(value);return new Intl.DateTimeFormat('cs-CZ',withTime?{day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short',year:'numeric'}).format(date)}
function plural(n,one,few,many){return n===1?one:n>=2&&n<=4?few:many}
function toast(message){const el=$('#adminToast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),3000)}

async function api(path,options={}){
 const p=profile(),headers={'Content-Type':'application/json',...(options.headers||{})};
 if(p?.token)headers.Authorization=`Bearer ${p.token}`;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(path,{...options,headers,signal:controller.signal,cache:'no-store'});
  let body={};try{body=await response.json()}catch{}
  if(!response.ok){let message=body.detail||`Server vrátil chybu ${response.status}`;const requestId=String(body.requestId||'').replace(/[^A-Za-z0-9_.:-]/g,'').slice(0,24);if(requestId)message+=` · kód ${requestId}`;throw new Error(message)};
  return body;
 }catch(error){if(error.name==='AbortError')throw new Error('Server se neozval včas');throw error}
 finally{clearTimeout(timer)}
}

function showGate(title,text,action=true){
 $('#adminGate h1').textContent=title;$('#gateText').textContent=text;$('#gateAction').classList.toggle('hidden',!action);$('#adminGate').classList.remove('hidden');$('#adminApp').classList.add('hidden');
}
function kpi(value,label,note=''){return `<div class="kpi panel"><b>${esc(value)}</b><span>${esc(label)}</span>${note?`<em>${esc(note)}</em>`:''}</div>`}
function barLine(label,value,total,color=''){const width=total?Math.max(2,Math.round(value/total*100)):0;return `<div class="rating-line"><span>${esc(label)}</span><div class="bar"><i style="width:${width}%${color?`;background:${color}`:''}"></i></div><b>${fmtNumber(value)}</b></div>`}


function newcomerFunnelRows(rows=[]){
 return rows.map(row=>`<div class="newcomer-funnel-row"><span><b>${esc(row.label)}</b><small>${row.previousCount==null?'nováčci v cohortě':`${fmtPct(row.conversionFromPrevious)} z předchozího kroku`}</small></span><strong>${fmtNumber(row.count)}</strong><em>${row.dropOffCount==null?'':`−${fmtNumber(row.dropOffCount)} · ${fmtPct(row.dropOff)}`}</em></div>`).join('')||'<p class="muted">První data z 3.31.5 se teprve začnou sbírat.</p>';
}
function metricLine(label,value,note=''){return `<div class="launch-metric-line"><span>${esc(label)}</span><b>${esc(value)}</b>${note?`<small>${esc(note)}</small>`:''}</div>`}
function launchWindowButtons(){return `<div class="launch-window-tabs">${[['24h','24 h'],['7d','7 dní'],['30d','30 dní']].map(([key,label])=>`<button data-launch-window="${key}" class="${state.launchWindow===key?'active':''}">${label}</button>`).join('')}</div>`}
async function loadLaunch(force=false){
 const root=$('#launchContent');if(state.launch&&!force){renderLaunch();return}root.className='loading-panel panel';root.textContent='Načítám launch radar…';
 try{state.launch=await api('/api/admin/launch');renderLaunch();await loadSupport(force)}catch(error){root.innerHTML=`<strong>Launch radar se nenačetl.</strong><p>${esc(error.message)}</p>`}
}
function renderLaunch(){
 const d=state.launch||{},r=d.reliability||{},windowData=d.windows?.[state.launchWindow]||{},ret=windowData.retentionD1||{},starter=windowData.starter||{},hard=windowData.hardDaily||{},versions=d.appVersions7d||[],root=$('#launchContent');root.className='';const alertCount=Number(r.errors24h||0)+Number(r.openSupportReports||0);$('#launchAlertBadge').textContent=alertCount;$('#launchAlertBadge').classList.toggle('hidden',!alertCount);
 const support=starter.supportDistribution||{};
 root.innerHTML=`${launchWindowButtons()}<div class="kpi-grid launch-kpis">${kpi(windowData.visitors||0,'návštěvníků',`${windowData.returningVisitors||0} vracejících se`)}${kpi(windowData.newcomers||0,'nových hráčů','cohorta od v3.31.5')}${kpi(windowData.firstRealGameCompleted||0,'aktivovaných','dokončili první skutečnou hru')}${kpi(ret.rate==null?'—':fmtPct(ret.rate),'D1 návrat',`${ret.retained||0}/${ret.eligible||0} způsobilých`)}</div>
 <div class="launch-grid launch-newcomer-grid"><section class="section-panel panel newcomer-funnel-panel"><p class="eyebrow">NOVÝ HRÁČ</p><h2>Onboarding → první skutečná hra → účet</h2><div class="newcomer-funnel">${newcomerFunnelRows(windowData.funnel)}</div></section><section class="section-panel panel"><p class="eyebrow">PRVNÍ DAILY JE TĚŽKÁ</p><h2>Rozcvička vs. rovnou Těžká</h2><div class="launch-metrics">${metricLine('Volba zobrazena',hard.choiceShown||0)}${metricLine('🌱 Snadná',hard.easySelected||0,hard.easySelectionRate==null?'—':fmtPct(hard.easySelectionRate))}${metricLine('🔥 Rovnou Těžká',hard.directSelected||0,hard.directSelectionRate==null?'—':fmtPct(hard.directSelectionRate))}${metricLine('Rozcvička dokončena',hard.warmupCompleted||0,hard.warmupCompletionRate==null?'—':fmtPct(hard.warmupCompletionRate))}${metricLine('Rozcvička → Daily',hard.warmupToDailyStarted||0,hard.warmupToDailyRate==null?'—':fmtPct(hard.warmupToDailyRate))}${metricLine('Těžká spuštěna',hard.hardDailyStarted||0)}${metricLine('Těžká dokončena',hard.hardDailyCompleted||0,hard.hardDailyCompletionRate==null?'—':fmtPct(hard.hardDailyCompletionRate))}</div></section></div>
 <div class="launch-grid launch-bottom"><section class="section-panel panel"><p class="eyebrow">STARTER</p><h2>Chování v první úloze</h2><div class="launch-metrics">${metricLine('Dokončení',starter.completed||0,starter.completionRate==null?'—':fmtPct(starter.completionRate))}${metricLine('Medián času',fmtTime(starter.medianCompletionMs))}${metricLine('Nabídka nápovědy',starter.hintOfferShown||0)}${metricLine('Použitá nápověda',starter.hintUsed||0,starter.hintUseRate==null?'—':fmtPct(starter.hintUseRate))}${metricLine('Resetovalo',starter.resetActors||0)}${metricLine('Odpadlo >30 min',starter.abandoned||0)}</div><div class="support-distribution"><small>Pomocník</small>${Object.entries(SUPPORT).map(([key,label])=>`<span>${esc(label)} <b>${fmtNumber(support[key]?.count||0)}</b></span>`).join('')}</div></section><section class="section-panel panel"><p class="eyebrow">SPOLEHLIVOST</p><h2>Produkční signály</h2><div class="launch-health ${r.errors24h?'warn':'ok'}"><b>${r.errors24h?'Pozor na chyby':'Bez čerstvých chyb ✓'}</b><span>${r.errors7d||0} chyb za 7 dní · ${r.openSupportReports||0} otevřených hlášení · ${r.rateLimits24h||0} rate-limit zásahů</span></div><h3 class="launch-subhead">Verze hráčů · 7 dní</h3><div class="version-list">${versions.map(v=>barLine(`v${v.version}`,v.attempts,Math.max(...versions.map(x=>x.attempts),1))).join('')||'<p class="muted">Zatím bez pokusů.</p>'}</div></section></div>`;
 $$('[data-launch-window]').forEach(button=>button.onclick=()=>{state.launchWindow=button.dataset.launchWindow;renderLaunch()});
}
async function loadSupport(force=false){
 const root=$('#launchSupportContent');if(state.support&&!force){renderSupport();return}root.className='loading-panel panel';root.textContent='Načítám hlášení…';try{state.support=await api('/api/admin/support?status=open');renderSupport()}catch(error){root.innerHTML=`<strong>Support se nenačetl.</strong><p>${esc(error.message)}</p>`}
}
function renderSupport(){
 const rows=state.support?.reports||[],root=$('#launchSupportContent');root.className='';if(!rows.length){root.innerHTML='<div class="empty-state panel"><span>🛟</span><strong>Žádné otevřené hlášení.</strong>Pro launch ideální stav.</div>';return}
 root.innerHTML=`<div class="report-list">${rows.map(row=>`<article class="report-card panel" data-support-id="${esc(row.id)}"><div class="report-top"><div><div class="report-word"><strong>${esc(row.category||'support')}</strong><span class="status-pill status-${esc(row.status)}">${esc(STATUS[row.status]||row.status)}</span></div><div class="report-meta">${fmtDate(row.createdAt)} · ${row.reportedBy?`${esc(row.reportedBy.avatar)} ${esc(row.reportedBy.name)}`:'Anonym'}${row.appVersion?` · v${esc(row.appVersion)}`:''}${row.page?` · ${esc(row.page)}`:''}</div></div>${row.replyTo?`<div class="report-meta">Kontakt: ${esc(row.replyTo)}</div>`:''}</div><div class="report-note">${esc(row.message)}</div><div class="report-actions"><select data-support-status><option value="new" ${row.status==='new'?'selected':''}>Nové</option><option value="reviewing" ${row.status==='reviewing'?'selected':''}>Prověřuji</option><option value="resolved">Vyřešeno</option><option value="dismissed">Zamítnuto</option></select><textarea data-support-resolution placeholder="Interní poznámka…">${esc(row.resolutionNote||'')}</textarea><button class="save-report save-support">Uložit</button></div></article>`).join('')}</div>`;$$('.save-support').forEach(b=>b.onclick=()=>saveSupport(b.closest('[data-support-id]')));
}
async function saveSupport(card){
 const id=card.dataset.supportId,status=card.querySelector('[data-support-status]').value,resolution_note=card.querySelector('[data-support-resolution]').value.trim(),button=card.querySelector('.save-support');button.disabled=true;button.textContent='Ukládám…';try{await api(`/api/admin/support/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,resolution_note})});toast('Support uložen ✓');state.launch=null;state.support=null;state.audit=null;await loadLaunch(true)}catch(error){toast(error.message);button.disabled=false;button.textContent='Uložit'}
}

async function loadOverview(force=false){
 const root=$('#overviewContent');if(state.overview&&!force){renderOverview();return}root.className='loading-panel panel';root.textContent='Načítám Proplet pod rentgenem…';
 try{state.overview=await api('/api/admin/overview');renderOverview()}catch(error){root.innerHTML=`<strong>Přehled se nenačetl.</strong><p>${esc(error.message)}</p>`}
}
function renderOverview(){
 const data=state.overview,feedback=data.feedback||{},votes=feedback.votes||{},voteTotal=feedback.ratingsTotal||0,versions=data.appVersions||[];
 $('#reportBadge').textContent=feedback.openWordReports||0;$('#reportBadge').classList.toggle('hidden',!feedback.openWordReports);
 $('#overviewContent').className='';$('#overviewContent').innerHTML=`
  <div class="kpi-grid">${kpi(data.players?.active7||0,'aktivních hráčů · 7 dní',`${data.players?.total||0} účtů celkem`)}${kpi(data.games?.today||0,'dokončených her dnes',`${data.games?.last7Days||0} za 7 dní`)}${kpi(data.daily?.todayPlayers||0,'hráčů dnešní Daily',data.daily?.puzzleId||'')}${kpi(feedback.openWordReports||0,'otevřených hlášení',`${feedback.wordReportsTotal||0} celkem`)}</div>
  <div class="overview-grid">
   <section class="section-panel panel"><p class="eyebrow">POCIT Z OBTÍŽNOSTI</p><h2>${fmtNumber(voteTotal)} odpovědí hráčů</h2><div class="rating-bars">${barLine('Lehčí',votes['-1']||0,voteTotal)}${barLine('Akorát',votes['0']||0,voteTotal)}${barLine('Těžší',votes['1']||0,voteTotal)}</div></section>
   <section class="section-panel panel"><p class="eyebrow">VERZE ZA 30 DNÍ</p><h2>Co hráči skutečně používají</h2><div class="version-list">${versions.length?versions.map(row=>`<div class="version-line"><span>v${esc(row.version)}</span><div class="bar"><i style="width:${Math.max(3,Math.round(row.attempts/versions[0].attempts*100))}%"></i></div><b>${fmtNumber(row.attempts)}</b></div>`).join(''):'<p class="muted">Zatím bez dat.</p>'}</div></section>
  </div>`;
}

async function loadQuality(force=false){
 const root=$('#qualityContent');if(state.quality&&!force){renderQuality();return}root.className='loading-panel panel';root.textContent='Počítám první pokusy a outliery…';
 try{state.quality=await api('/api/admin/quality');renderQuality()}catch(error){root.innerHTML=`<strong>Quality se nenačetla.</strong><p>${esc(error.message)}</p>`}
}
function qualityFlag(row){const flag=row.flag||'ok';return `<span class="flag ${flag}">${flag==='too_hard'?'Příliš těžká':flag==='too_easy'?'Příliš lehká':flag==='watch'?'Sledovat':'OK'}</span>`}
function renderQuality(){
 const data=state.quality||{},diff=$('#qualityDifficulty').value,flag=$('#qualityFlag').value,needle=$('#qualitySearch').value.trim().toLowerCase();
 let rows=data.rows||[];if(diff!=='all')rows=rows.filter(row=>row.difficulty===diff);if(flag!=='all')rows=rows.filter(row=>(row.flag||'ok')===flag);if(needle)rows=rows.filter(row=>String(row.puzzleId).toLowerCase().includes(needle));
 rows.sort((a,b)=>(Math.abs(b.difficultyIndex||0)-Math.abs(a.difficultyIndex||0))||(b.starts-a.starts));const s=data.summary||{};
 $('#qualityContent').className='';$('#qualityContent').innerHTML=`<div class="kpi-grid">${kpi(data.firstAttempts||0,'prvních pokusů',`${data.registeredFirstAttempts||0} účtů · ${data.anonymousFirstAttempts||0} anonymně`)}${kpi(s.tooHard||0,'příliš těžkých')}${kpi(s.tooEasy||0,'příliš lehkých')}${kpi(s.watch||0,'na sledování')}</div><div class="table-panel panel"><table class="data-table"><thead><tr><th>Úloha</th><th>Vzorek</th><th>Dokončení</th><th>Medián</th><th>Nápovědy</th><th>Čistě</th><th>Hodnocení</th><th>Index</th><th>Stav</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${esc(row.puzzleId)}</strong><small>${esc(DIFF[row.difficulty]||row.difficulty)} · ${row.words||'—'} slov · ${row.wordReports||0} hlášení</small></td><td>${row.starts}</td><td>${fmtPct(row.completionRate)}</td><td>${fmtTime(row.medianMs)}</td><td>${row.avgHints??'—'}</td><td>${fmtPct(row.cleanRate)}</td><td>${row.difficultyRating??'—'}<small>${row.ratings||0} hlasů</small></td><td><strong class="${Math.abs(row.difficultyIndex||0)>=1.25?'metric-bad':''}">${row.difficultyIndex==null?'—':Number(row.difficultyIndex).toFixed(2)}</strong></td><td>${qualityFlag(row)}</td></tr>`).join('')||'<tr><td colspan="9"><div class="empty-state">Filtru nic neodpovídá.</div></td></tr>'}</tbody></table></div>`;
}

async function loadReports(force=false){
 const status=$('#reportStatus').value,q=$('#reportSearch').value.trim(),root=$('#reportsContent');root.className='loading-panel panel';root.textContent='Načítám hlášení…';
 try{state.reports=await api(`/api/admin/reports?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);renderReports()}catch(error){root.innerHTML=`<strong>Hlášení se nenačetla.</strong><p>${esc(error.message)}</p>`}
}
function renderReports(){
 const rows=state.reports?.reports||[],root=$('#reportsContent');root.className='';
 if(!rows.length){root.innerHTML='<div class="empty-state panel"><span>🫧</span><strong>Tady je čisto.</strong>Tomuto filtru žádné hlášení neodpovídá.</div>';return}
 root.innerHTML=`<div class="report-list">${rows.map(row=>`<article class="report-card panel" data-report-id="${esc(row.id)}"><div class="report-top"><div><div class="report-word"><strong>${esc(row.word||'—')}</strong><span class="status-pill status-${esc(row.status)}">${esc(STATUS[row.status]||row.status)}</span></div><div class="report-meta">${esc(DIFF[row.difficulty]||row.difficulty||'Neznámá úloha')}${row.level?` · úroveň ${row.level}`:''} · <b>${esc(row.puzzleId)}</b> · ${fmtDate(row.createdAt)}</div></div><div class="report-meta">${esc(row.reportedBy?.name||'Anonym')} ${row.reportedBy?.team?`· ${esc(row.reportedBy.team)}`:''}</div></div>${row.note?`<div class="report-note">„${esc(row.note)}“</div>`:'<div class="report-note muted">Bez doplňující poznámky.</div>'}<div class="report-actions"><select data-report-status><option value="new" ${row.status==='new'?'selected':''}>Nové</option><option value="reviewing" ${row.status==='reviewing'?'selected':''}>Prověřuji</option><option value="resolved" ${row.status==='resolved'?'selected':''}>Vyřešeno</option><option value="dismissed" ${row.status==='dismissed'?'selected':''}>Zamítnuto</option></select><textarea data-resolution-note placeholder="Interní poznámka k vyřízení…">${esc(row.resolutionNote||'')}</textarea><button class="save-report">Uložit</button></div></article>`).join('')}</div>`;
 $$('.save-report').forEach(button=>button.onclick=()=>saveReport(button.closest('[data-report-id]')));
}
async function saveReport(card){
 const id=card.dataset.reportId,status=card.querySelector('[data-report-status]').value,resolution_note=card.querySelector('[data-resolution-note]').value.trim(),button=card.querySelector('.save-report');button.disabled=true;button.textContent='Ukládám…';
 try{await api(`/api/admin/reports/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,resolution_note})});toast('Hlášení uloženo ✓');state.overview=null;state.audit=null;await loadReports(true)}catch(error){toast(error.message);button.disabled=false;button.textContent='Uložit'}
}

async function loadUsers(force=false){
 const q=$('#userSearch').value.trim(),root=$('#usersContent');root.className='loading-panel panel';root.textContent='Hledám hráče…';
 try{state.users=await api(`/api/admin/users?q=${encodeURIComponent(q)}`);renderUsers()}catch(error){root.innerHTML=`<strong>Uživatelé se nenačetli.</strong><p>${esc(error.message)}</p>`}
}
function renderUsers(){
 const rows=state.users?.users||[],root=$('#usersContent');root.className='table-panel panel';root.innerHTML=`<table class="data-table"><thead><tr><th>Hráč</th><th>Tým</th><th>XP</th><th>Hotovo</th><th>Daily</th><th>Pomocník</th><th>Verze</th><th>Naposledy</th><th>Hlášení</th></tr></thead><tbody>${rows.map(row=>`<tr class="clickable" data-user-id="${esc(row.id)}"><td><div class="user-cell"><span class="user-avatar">${esc(row.avatar)}</span><div><strong>${esc(row.name)}</strong><small>${row.hasPassword?'heslo aktivní':'bez hesla'}</small></div></div></td><td>${esc(row.team||row.familyCode)}</td><td>${fmtNumber(row.points)}</td><td>${fmtNumber(row.completed)}</td><td>${fmtNumber(row.dailyCompleted)}</td><td><span class="support-tag">${esc(SUPPORT[row.supportMode]||row.supportMode)}</span></td><td>${row.appVersion?`v${esc(row.appVersion)}`:'—'}</td><td>${fmtDate(row.lastActiveAt)}</td><td>${row.openWordReports?`<b class="metric-bad">${row.openWordReports}</b>`:'0'}</td></tr>`).join('')||'<tr><td colspan="9"><div class="empty-state">Nikdo nenalezen.</div></td></tr>'}</tbody></table>`;$$('[data-user-id]').forEach(row=>row.onclick=()=>openUser(row.dataset.userId));
}
async function openUser(id){
 $('#userModal').classList.remove('hidden');$('#userDetailContent').className='loading-panel';$('#userDetailContent').textContent='Načítám hráče…';
 try{const data=await api(`/api/admin/users/${encodeURIComponent(id)}`);renderUserDetail(data)}catch(error){$('#userDetailContent').innerHTML=`<strong>Hráč se nenačetl.</strong><p>${esc(error.message)}</p>`}
}
function renderUserDetail(data){
 const user=data.user,stats=data.stats||{},results=data.recentResults||[];$('#userDetailContent').className='';$('#userDetailContent').innerHTML=`<div class="user-detail-head"><span class="user-avatar">${esc(user.avatar)}</span><div><h2>${esc(user.name)}</h2><p>${esc(user.team)} · účet od ${fmtDate(user.createdAt,false)} · ${user.hasPassword?'heslo aktivní':'bez hesla'}</p></div></div><div class="detail-kpis"><div><b>${fmtNumber(stats.points)}</b><small>XP</small></div><div><b>${fmtNumber(stats.totalCompleted)}</b><small>výsledků</small></div><div><b>${fmtNumber(stats.currentStreak)}</b><small>aktuální série</small></div><div><b>${fmtNumber(stats.cleanSolves)}</b><small>čistě</small></div></div><div class="detail-section"><h3>Nastavení a zařízení</h3><p class="muted">Pomocník: <b>${esc(SUPPORT[user.supportMode]||user.supportMode)}</b> · poslední verze: <b>${data.latestAppVersion?`v${esc(data.latestAppVersion)}`:'—'}</b> · další relace: <b>${user.additionalSessions}</b> · push zařízení: <b>${user.pushSubscriptions}</b> · otevřená hlášení: <b>${data.wordReports?.open||0}</b></p><h3>Poslední výsledky</h3><div>${results.map(row=>`<div class="result-row"><span><b>${esc(row.puzzleId)}</b><small>${esc(DIFF[row.difficulty]||row.difficulty)}${row.dailyDate?` · ${esc(row.dailyDate)}`:''}</small></span><span>${fmtTime(row.elapsedMs)} · ${row.moves} tahů</span><span>${row.cleanSolve?'✨ Čistě':`${row.hintsUsed||0}× nápověda`} · ${row.points||0} XP</span></div>`).join('')||'<p class="muted">Zatím bez výsledků.</p>'}</div></div>`;
}

async function loadAudit(force=false){
 const root=$('#auditContent');root.className='loading-panel panel';root.textContent='Načítám historii…';
 try{state.audit=await api('/api/admin/audit');renderAudit()}catch(error){root.innerHTML=`<strong>Historie se nenačetla.</strong><p>${esc(error.message)}</p>`}
}
function renderAudit(){
 const rows=state.audit?.entries||[],root=$('#auditContent');root.className='panel';if(!rows.length){root.innerHTML='<div class="empty-state"><span>🧾</span><strong>Zatím bez zásahů.</strong>A to je v tuhle chvíli vlastně dobrá zpráva.</div>';return}
 root.innerHTML=`<div class="audit-list">${rows.map(row=>{const d=row.details||{};return `<div class="audit-row"><small>${fmtDate(row.createdAt)}<br>${esc(row.admin)}</small><b>${row.action==='word_report_status'?'Vyřízení hlášení':esc(row.action)}</b><div class="audit-detail"><b>${esc(d.word||row.targetId||'')}</b>${d.puzzleId?`${esc(d.puzzleId)} · `:''}${d.from&&d.to?`${esc(STATUS[d.from]||d.from)} → ${esc(STATUS[d.to]||d.to)}`:''}${d.resolutionNote?`<small> · ${esc(d.resolutionNote)}</small>`:''}</div></div>`}).join('')}</div>`;
}

async function switchTab(tab){
 state.activeTab=tab;$$('.admin-nav button').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));$$('.admin-tab').forEach(section=>section.classList.toggle('active',section.id===`tab-${tab}`));
 if(tab==='launch')await loadLaunch();if(tab==='overview')await loadOverview();if(tab==='quality')await loadQuality();if(tab==='reports')await loadReports();if(tab==='users')await loadUsers();if(tab==='audit')await loadAudit();
}
function debounce(fn,delay=300){let timer;return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),delay)}}
function bind(){
 $$('.admin-nav button').forEach(button=>button.onclick=()=>switchTab(button.dataset.tab));$$('[data-refresh]').forEach(button=>button.onclick=()=>({launch:loadLaunch,overview:loadOverview,quality:loadQuality,reports:loadReports,users:loadUsers,audit:loadAudit}[button.dataset.refresh]||(()=>{}))(true));
 $('#qualityDifficulty').onchange=renderQuality;$('#qualityFlag').onchange=renderQuality;$('#qualitySearch').oninput=debounce(renderQuality,180);$('#reportStatus').onchange=()=>loadReports(true);$('#reportSearch').oninput=debounce(()=>loadReports(true),300);$('#userSearch').oninput=debounce(()=>loadUsers(true),300);$('#refreshSupportBtn').onclick=()=>{state.support=null;loadSupport(true)};$('#closeUserModal').onclick=()=>$('#userModal').classList.add('hidden');$('#userModal').onclick=event=>{if(event.target===$('#userModal'))$('#userModal').classList.add('hidden')};
}
async function boot(){
 bind();const p=profile();if(!p?.token){showGate('Nejdřív se přihlas jako Pavel.','Otevři Proplet, přihlas hráče Pavel v týmu Prouza a pak se sem vrať. Oprávnění se ověřuje na serveru.');return}
 try{state.admin=await api('/api/admin/me');$('#adminGate').classList.add('hidden');$('#adminApp').classList.remove('hidden');$('#adminIdentity').classList.remove('hidden');$('#adminIdentity').innerHTML=`<span>${esc(state.admin.avatar)}</span><span class="identity-copy">${esc(state.admin.name)}<small>${esc(state.admin.team)}</small></span><b class="role-pill">${esc(state.admin.role)}</b>`;await loadLaunch()}catch(error){showGate('Sem tě server nepustil.',error.message,true)}
}
boot();
