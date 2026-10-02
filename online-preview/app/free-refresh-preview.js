/* Loaded only by the separate static FREE_REFRESH preview builder, before application boot. */
(function (global) {
  'use strict';
  const fixtures = global.PROPLET_FREE_REFRESH_FIXTURES;
  if (!fixtures) return;
  if (global.PROPLET_FREE_REFRESH_PREVIEW?.fixtureOnly === true) return;
  const productionHosts = new Set(['hrajproplet.cz', 'www.hrajproplet.cz', 'proplet-nine.vercel.app',
    'proplet-pavel-prouzas-projects.vercel.app', 'proplet-git-main-pavel-prouzas-projects.vercel.app']);
  if (productionHosts.has(location.hostname)) throw new Error('FREE_REFRESH preview cannot run on production.');
  const puzzles = fixtures.puzzles;
  const bank = fixtures.refreshBoards;
  if (!Array.isArray(bank) || bank.length !== 300 || !Array.isArray(fixtures.recognitionWords)) {
    throw new Error('Complete isolated FREE_REFRESH fixtures are required.');
  }

  global.PROPLET_FREE_REFRESH_INTEGRATED_PREVIEW = true;
  global.PROPLET_MK100_INTEGRATED_PREVIEW = true; // Reuse the native local-only completion/SW boundary.
  global.PROPLET_RUNTIME_ENV = 'preview';
  global.PROPLET_RUNTIME_META = Object.freeze({...global.PROPLET_RUNTIME_META,
    canonicalOrigin: location.origin, freeRefreshIntegratedPreview: true, gen4CandidatePreview: false, gen5CandidatePreview: false});
  const params = new URLSearchParams(location.search);
  const requestedCount = 0;
  const initialHardcoreCount = Number.isInteger(requestedCount) && requestedCount >= 0 && requestedCount <= 200 ? requestedCount : 0;
  const bankHash = String(fixtures.build?.bankSha256 || fixtures.build?.bankContentHash || 'free-refresh');
  const storagePrefix = `proplet-free-refresh-preview:${bankHash.slice(0, 16)}:hc${initialHardcoreCount}:${params.get('onboarding')==='1'?'onboarding:':''}`;
  const requests = [];
  const recognized = new Set(fixtures.recognitionWords.map(normalize));
  const recognitionText = fixtures.recognitionWords.join('\n') + '\n';

  function normalize(word) { return String(word || '').normalize('NFC').trim().toLocaleUpperCase('cs-CZ'); }
  function response(value, status = 200, type = 'application/json; charset=utf-8', head = false) {
    return new Response(head ? null : type.startsWith('application/json') ? JSON.stringify(value) : value,
      {status, headers: {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Proplet-Preview': 'fixture-only'}});
  }
  // There is deliberately no retained native fetch or network fallback.
  global.fetch = async function (input, options = {}) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const method = String(options.method || input?.method || 'GET').toUpperCase();
    requests.push({path: url.pathname, method, external: url.origin !== location.origin});
    if (requests.length > 200) requests.shift();
    const head = method === 'HEAD';
    if (url.origin !== location.origin) return response({error: 'Externí služby jsou v náhledu vypnuté.'}, 403, undefined, head);
    if (method !== 'GET' && !head) return response({error: 'Náhled ukládá hraní jen v tomto prohlížeči. Účty a odesílání jsou vypnuté.'}, 409);
    const path = url.pathname;
    if (path === '/puzzles.json') return response(puzzles, 200, undefined, head);
    if (path === '/valid-words-v3328.txt') return response(recognitionText, 200, 'text/plain; charset=utf-8', head);
    if (path === '/api/word-recognition') {
      const word = normalize(url.searchParams.get('word'));
      return response({word, recognized: recognized.has(word), source: 'frozen-free-refresh-preview'}, 200, undefined, head);
    }
    if (path === '/api/config') return response({...fixtures.config, environment: 'preview',
      version: global.PROPLET_RUNTIME_META?.version, appVersion: global.PROPLET_RUNTIME_META?.version,
      freeRefreshIntegratedPreview: true, accountsEnabled: false, pushEnabled: false}, 200, undefined, head);
    if (path === '/api/free-order/config' || path === '/api/play-session/config') {
      return response({enabled: false, isolatedPreview: false, environment: 'preview'}, 200, undefined, head);
    }
    if (path === '/api/rolling-content') return response({version: 1, asOf: fixtures.build?.asOf,
      latestBatch: null, nextRelease: null, puzzles: {}, meta: {},
      availableFreeCounts: Object.fromEntries(Object.entries(puzzles.free).map(([key, rows]) => [key, rows.length]))}, 200, undefined, head);
    if (path === '/api/tajenka' && fixtures.tajenka) return response(fixtures.tajenka, 200, undefined, head);
    if (path === '/api/mozkokalypsa/status') return response({eligible: false, invited: false, closed: true,
      enabled: false, qa: false, boards: [], attempts: [], completed: 0}, 200, undefined, head);
    if (/^\/api\/[^/]*leaderboard$/.test(path) || /^\/api\/rankings(?:\/(?:xp|daily))?$/.test(path)) return response({rows: [], players: [], teams: [],
      levels: [], total: 0, myRank: null, topPercent: null, anonymous: true, hasMore: false, preview: true}, 200, undefined, head);
    if (path === '/api/push/config') return response({enabled: false, configured: false, publicKey: '', environment: 'preview'}, 200, undefined, head);
    if (path === '/sw.js') return response('', 200, 'application/javascript; charset=utf-8', head);
    return response({error: 'Tato služba není součástí místního náhledu.'}, 404, undefined, head);
  };
  if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon = () => false;
  if (navigator.serviceWorker) {
    // The app also checks the explicit preview flag before registration.
    navigator.serviceWorker.register = () => Promise.reject(new Error('Service worker is disabled in the isolated preview.'));
    navigator.serviceWorker.getRegistrations().then(rows => Promise.all(rows.map(row => row.unregister()))).catch(() => {});
  }

  function isolatedStorage(nativeStorage) {
    const memory = new Map();
    const backend = nativeStorage || {get length() { return memory.size; }, key: i => [...memory.keys()][i] ?? null,
      getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)), removeItem: key => memory.delete(key)};
    const keys = () => Array.from({length: backend.length}, (_, i) => backend.key(i)).filter(key => key?.startsWith(storagePrefix));
    return {get length() { return keys().length; }, key: i => keys()[i]?.slice(storagePrefix.length) ?? null,
      getItem: key => backend.getItem(storagePrefix + String(key)),
      setItem: (key, value) => backend.setItem(storagePrefix + String(key), String(value)),
      removeItem: key => backend.removeItem(storagePrefix + String(key)),
      clear: () => keys().forEach(key => backend.removeItem(key))};
  }
  for (const name of ['localStorage', 'sessionStorage']) {
    let nativeStorage;
    try { nativeStorage = global[name]; } catch {}
    Object.defineProperty(global, name, {configurable: true, value: isolatedStorage(nativeStorage)});
  }
  const storage = global.localStorage;
  const stateKey = 'proplet-v2-state:guest';
  // Never manufacture an authenticated profile. Progress belongs to this preview's anonymous guest.
  storage.removeItem('proplet-v2-profile');
  if (storage.getItem(stateKey) === null) {
    const state = {completed: {}, rescues: {}, inProgress: {}, dailyDates: [], statsVersion: 5};
    const hardcore = [...(puzzles.free.hardcore || [])].sort((a, b) => Number(a.meta?.level) - Number(b.meta?.level));
    if (hardcore.length < initialHardcoreCount) throw new Error('Current hardcore fixtures are incomplete.');
    for (const puzzle of hardcore.slice(0, initialHardcoreCount)) {
      const challengeKey = `free:${puzzle.id}`;
      state.completed[challengeKey] = {puzzleId: puzzle.id, challengeKey, mode: 'free', difficulty: 'hardcore',
        level: Number(puzzle.meta?.level), contentGeneration: Number(puzzle.meta?.contentGeneration) || Number(puzzles.freeGeneration),
        elapsedMs: 60000, moves: puzzle.answers.length, points: 100, hintsUsed: 0, wrongAttempts: 0,
        maxHintLevel: 0, attemptId: null, cleanSolve: true, completedAt: '2026-10-01T08:00:00.000Z', previewSynthetic: true};
    }
    storage.setItem(stateKey, JSON.stringify(state));
    storage.setItem('proplet-v2-sync-queue:guest', '[]');
  }
  const now = new Date().toISOString();
  const defaults = {...(params.get('onboarding')==='1'?{}:{'proplet-v3-7-required-onboarding': 'done', 'proplet-v3-16-2-helper-onboarding': 'done'}),
    'proplet-marketing-consent-v1': JSON.stringify({value: 'denied', at: Date.now()}),
    'proplet-v3-32-8-rule-principle-seen': '1', 'proplet-v3-16-2-helper-mode': 'none',
    'proplet-v3-5-account-nudge': JSON.stringify({shown: [1, 2, 3], lastShownAt: now}),
    'proplet-v4-01-4-progress-guard': JSON.stringify({lastShownAt: now}),
    'proplet-v3-26-install-nudge': JSON.stringify({done: true}),
    'proplet:content-release:mk100-v2': '1'};
  for (const [key, value] of Object.entries(defaults)) if (storage.getItem(key) === null) storage.setItem(key, value);

  function previewToast() {
    if (typeof showToast === 'function') showToast('Náhled ukládá hraní jen tady. Účty a odesílání jsou vypnuté.');
  }
  // OAuth navigates rather than using fetch; stop that separate transport as well.
  document.addEventListener('click', event => {
    const element = event.target.closest?.('a,button');
    if (!element) return;
    const href = element.getAttribute('href');
    const blockedLink = href && (() => { try { const url = new URL(href, location.href); return url.origin !== location.origin || url.pathname.startsWith('/api/'); } catch { return true; } })();
    if (blockedLink || ['googleLoginBtn', 'linkGoogleBtn', 'firstStepsGoogle', 'progressGuardGoogleBtn'].includes(element.id)) {
      event.preventDefault(); event.stopImmediatePropagation(); previewToast();
    }
  }, true);
  document.addEventListener('submit', event => {
    const action = event.target.getAttribute?.('action');
    if (action) { event.preventDefault(); event.stopImmediatePropagation(); previewToast(); }
  }, true);


  const difficulties = ['easy','medium','hard'];
  const orderDifficulties = Object.keys(puzzles.free);
  const labels = {easy:'Snadná',medium:'Střední',hard:'Těžká',hardcore:'Mozkožrout',mozkomor:'Mozkomor',mozkokalypsa:'Mozkokalypsa'};
  const manifest = global.PROPLET_SHARED_FREE_ORDER_MANIFEST;
  if (manifest?.bankContentHash !== fixtures.build?.bankContentHash) throw new Error('Shared route uses a different refresh bank.');
  const sharedOrder = global.PropletSharedFreeOrder.create(manifest, puzzles.free);
  const newIds = new Set(bank.map(p=>p.id));
  const routeRecordsKey = 'shared-refresh-preview-choice';
  const releaseDismissKey = 'free-refresh-300-dismissed';
  const reviewMode = params.get('review') === '1';
  function choices(){try{return JSON.parse(storage.getItem(routeRecordsKey)||'{}')}catch{return {}}}
  function modeFor(diff){
    if(!sharedOrder.supports(diff))return 'numeric';
    const explicit=choices()[diff];if(['varied','numeric'].includes(explicit))return explicit;
    // Keep deliberate opt-outs, but do not mistake the old numeric default for a choice.
    // Never rewrite the old plan, revision or pending request.
    try{const old=JSON.parse(storage.getItem('proplet-free-order-v1:guest')||'{}')[diff];
      if(old?.mode==='varied'||(old?.mode==='numeric'&&(old.offered===true||old.revision>0||old.pending)))return old.mode;
    }catch{}
    return 'varied';
  }
  function completed(id){return !!getState().completed?.['free:'+id]}
  function newBoards(diff){return bank.filter(p=>p.difficulty===diff)}
  function completedNew(diff){return newBoards(diff).filter(p=>completed(p.id)).length}
  function nextShared(diff,fallback){
    if(!sharedOrder.supports(diff)||modeFor(diff)==='numeric')return fallback;
    const state=getState(),completedIds=Object.keys(state.completed||{}).filter(key=>key.startsWith('free:')).map(key=>key.slice(5));
    const resume=Object.values(state.inProgress||{}).filter(row=>row?.mode==='free'&&row.difficulty===diff&&!completed(row.puzzleId)).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0)).find(row=>(puzzles.free[diff]||[]).some(p=>p.id===row.puzzleId));
    return sharedOrder.next(diff,{completedIds,resumeId:resume?.puzzleId});
  }
  const controller = {
    enabled:()=>true,ready:()=>true,configure:async()=>true,sync:async()=>{},
    supports:sharedOrder.supports,
    next:nextShared,adopt:()=>{},newAccount:async()=>{},
    record:diff=>({mode:modeFor(diff),offered:true,plan:{version:sharedOrder.version,ids:sharedOrder.ids(diff)}}),
    change:async(diff,mode)=>{
      if(!sharedOrder.supports(diff)||!['varied','numeric'].includes(mode))return;
      storage.setItem(routeRecordsKey,JSON.stringify({...choices(),[diff]:mode}));
      if(typeof renderFree==='function')renderFree();
      if(typeof renderQuickPlay==='function')renderQuickPlay();
      updateOrderSettings();
    }
  };
  function openBoard(id) {
    const puzzle=Object.values(puzzles.free).flat().find(row=>row.id===id);
    if(!puzzle||typeof startGame!=='function')return false;
    if(typeof saveGameProgress==='function')saveGameProgress();
    startGame(puzzle,'free',null);
    return true;
  }
  function chooseGame(){
    if(typeof nav==='function')nav('free',{replace:true});
    document.getElementById('difficultyCards')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function newEntry(id){
    let root=document.getElementById(id);
    if(!root){root=document.createElement('aside');root.id=id;root.className='card refresh-entry';
      const anchor=document.getElementById('todayNewContentBanner');
      anchor?.before(root);
    }
    const done=bank.filter(p=>completed(p.id)).length,left=300-done;
    root.hidden=!left||storage.getItem(releaseDismissKey)==='1';
    root.innerHTML='<div class="refresh-entry-art" aria-hidden="true">'+
      '<img src="/difficulty/printshop/easy.webp" width="52" height="52" alt="">'+
      '<img src="/difficulty/printshop/medium.webp" width="52" height="52" alt="">'+
      '<img src="/difficulty/printshop/hard.webp" width="52" height="52" alt=""></div>'+
      '<div class="refresh-entry-copy"><h2>300 nových Propletů</h2><p>Čerstvá slova ve Snadné, Střední i Těžké.</p>'+
      '<button class="refresh-entry-link" type="button" data-refresh-choose>Vybrat hru <span aria-hidden="true">→</span></button></div>'+
      '<button class="refresh-entry-dismiss" type="button" data-refresh-dismiss aria-label="Skrýt pozvánku na nové desky">×</button>';
    root.querySelector('[data-refresh-choose]').onclick=chooseGame;
    root.querySelector('[data-refresh-dismiss]').onclick=()=>{storage.setItem(releaseDismissKey,'1');root.hidden=true};
  }
  function decorateCards(){
    for(const diff of orderDifficulties){
      const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
      if(difficulties.includes(diff)){
        const left=100-completedNew(diff);
        if(left){const counter=document.createElement('span');counter.className='refresh-count';counter.textContent=left+' nových';card.querySelector('.cp-xp')?.append(counter)}
      }
    }
  }
  function updateOrderSettings(){
    const root=document.getElementById('freeOrderSettings');if(!root)return;
    const allVaried=manifest.variedDifficulties.every(diff=>modeFor(diff)==='varied');
    const status=root.querySelector('[data-order-status]'),text=allVaried?'Pestrá hra':'Vlastní volba';
    if(status.textContent!==text)status.textContent=text;
    for(const select of root.querySelectorAll('[data-order-setting]'))select.value=modeFor(select.dataset.orderSetting);
  }
  function installOrderSettings(){
    if(document.getElementById('freeOrderSettings'))return;
    const root=document.createElement('section');root.id='freeOrderSettings';root.className='card settings-card free-order-settings';
    root.innerHTML='<details><summary><span>Pořadí desek</span><span data-order-status></span></summary>'+
      '<p>Pestrá hra střídá různé desky a ty z novějších sérií nabízí dřív. Rozehranou hru vždy nejdřív dokončíš.</p>'+
      '<p class="order-settings-note">Pokud chceš postupovat od nejnižšího čísla, změň pořadí u vybrané obtížnosti. Tvůj postup zůstane zachovaný.</p>'+
      manifest.variedDifficulties.map(diff=>'<label class="order-setting-row" for="freeOrder-'+diff+'"><span>'+labels[diff]+'</span>'+
        '<select id="freeOrder-'+diff+'" data-order-setting="'+diff+'"><option value="varied">Pestře</option><option value="numeric">Podle čísel</option></select></label>').join('')+'</details>';
    for(const select of root.querySelectorAll('select'))select.onchange=()=>global.changeFreeOrder(select.dataset.orderSetting,select.value);
    document.getElementById('screen-profile')?.append(root);updateOrderSettings();
  }
  function installHistoryCatalogue(){
    const original=global.openPlayedLevels;
    global.openPlayedLevels=async function(diff){
      document.getElementById('historyNumericCatalogue')?.remove();
      await original(diff);
      const list=document.getElementById('playedLevelsList');
      if(!list||document.getElementById('playedLevelsModal').classList.contains('hidden'))return;
      const details=document.createElement('details');details.id='historyNumericCatalogue';details.className='history-numeric-catalogue';details.dataset.sharedCatalogue=diff;
      const summary=document.createElement('summary');summary.textContent='Všechny úrovně podle čísel';details.append(summary);
      details.addEventListener('toggle',()=>{if(details.open)populateNumericCatalogue(details,diff)});
      list.after(details);
    };
  }
  function populateNumericCatalogue(details,diff){
    if(details.querySelector('.refresh-catalogue-grid'))return;
    const grid=document.createElement('div');grid.className='refresh-catalogue-grid';
    const byId=new Map((puzzles.free[diff]||[]).map(p=>[p.id,p]));
    for(const id of sharedOrder.ids(diff,'numeric')){
      const p=byId.get(id),button=document.createElement('button');button.type='button';button.dataset.sharedBoard=id;
      button.textContent=String(p.meta.level);button.title=labels[diff]+' · úroveň '+p.meta.level;
      button.setAttribute('aria-label',labels[diff]+', úroveň '+p.meta.level);
      button.onclick=()=>{document.getElementById('playedLevelsModal')?.classList.add('hidden');openBoard(id)};grid.append(button);
    }
    details.append(grid);updateCatalogue();
  }
  function installNumericCatalogue(){
    if(document.getElementById('sharedOrderCatalogue'))return;
    const section=document.createElement('section');section.id='sharedOrderCatalogue';section.className='card refresh-catalogue';
    section.innerHTML='<h2>Úrovně podle čísel</h2><p>Celý dostupný katalog. Čísla desek i tvůj postup zůstávají stejné; každou desku můžeš otevřít přímo.</p>';
    for(const diff of orderDifficulties){
      const details=document.createElement('details');details.dataset.sharedCatalogue=diff;
      const summary=document.createElement('summary');summary.textContent=labels[diff]+' · '+sharedOrder.ids(diff).length+' desek';details.append(summary);
      details.addEventListener('toggle',()=>{if(details.open)populateNumericCatalogue(details,diff)});section.append(details);
    }
    document.getElementById('screen-free')?.append(section);
  }
  function installCatalogue(){
    const root=document.getElementById('refreshCatalogue');if(root)return;
    const section=document.createElement('section');section.id='refreshCatalogue';section.className='card refresh-catalogue';
    section.innerHTML='<h2>Všech 300 nových desek</h2><p>Každou můžeš otevřít přímo. Číslování původních úrovní zůstává zachované.</p>';
    for(const diff of difficulties){
      const details=document.createElement('details');details.dataset.refreshCatalogue=diff;
      const summary=document.createElement('summary');summary.textContent=labels[diff]+' · 100 nových desek';details.append(summary);
      const grid=document.createElement('div');grid.className='refresh-catalogue-grid';
      for(const p of newBoards(diff)){
        const button=document.createElement('button');button.type='button';button.dataset.refreshBoard=p.id;
        const ordinal=Number(p.id.split('-').at(-1));
        button.textContent=String(ordinal);button.title=labels[diff]+' · úroveň '+p.meta.level;
        button.setAttribute('aria-label',labels[diff]+', nová deska '+ordinal+', původní číslo úrovně '+p.meta.level);
        button.onclick=()=>openBoard(p.id);grid.append(button);
      }
      details.append(grid);section.append(details);
    }
    document.getElementById('screen-free')?.append(section);
  }
  function updateCatalogue(){
    document.querySelectorAll('[data-refresh-board],[data-shared-board]').forEach(button=>{
      const done=completed(button.dataset.refreshBoard||button.dataset.sharedBoard);button.classList.toggle('is-done',done);
      button.setAttribute('aria-description',done?'Dohráno. Opakování zůstává tréninkem.':'Dosud nedohráno.');
    });
  }
  function showAnnouncement(){
    let modal=document.getElementById('freeRefreshAnnouncement');
    if(!modal){modal=document.createElement('div');modal.id='freeRefreshAnnouncement';modal.className='modal hidden';
      modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','freeRefreshAnnouncementTitle');
      modal.innerHTML='<section class="modal-card refresh-announcement"><button type="button" class="modal-close" data-refresh-close aria-label="Zavřít">×</button>'+
        '<div class="refresh-announcement-art" aria-hidden="true"><img src="/difficulty/printshop/easy.webp" alt=""><img src="/difficulty/printshop/medium.webp" alt=""><img src="/difficulty/printshop/hard.webp" alt=""></div>'+
        '<h2 id="freeRefreshAnnouncementTitle">300 nových Propletů</h2><p>Snadná, Střední a Těžká. V každé 100 nových desek s pestřejšími slovy.</p>'+
        '<button type="button" class="primary-btn big" data-refresh-play>Vybrat obtížnost</button>'+
        '<button type="button" class="text-btn" data-refresh-close>Teď ne</button></section>';
      document.body.append(modal);
      modal.querySelectorAll('[data-refresh-close]').forEach(button=>button.onclick=()=>modal.classList.add('hidden'));
      modal.querySelector('[data-refresh-play]').onclick=()=>{modal.classList.add('hidden');chooseGame()};
      modal.addEventListener('click',event=>{if(event.target===modal)modal.classList.add('hidden')});
    }
    modal.classList.remove('hidden');modal.querySelector('[data-refresh-play]').focus();
  }
  function installPreviewControls(){
    global.freeOrder=()=>controller;
    const originalFree=global.renderFree;
    global.renderFree=function(){originalFree();decorateCards();updateCatalogue()};
    const originalDaily=global.renderDaily;
    global.renderDaily=function(){originalDaily();newEntry('freeRefreshToday')};
    const notice=document.createElement('aside');notice.id='freeRefreshPreviewNotice';notice.className='refresh-preview-notice';
    notice.innerHTML='<p>Preview · postup se ukládá jen v tomto prohlížeči.</p>'+(reviewMode?
      '<nav aria-label="Prohlížení návrhu"><button type="button" data-review-announcement>Návrh oznámení</button>'+
      '<button type="button" data-review-catalogue>Všech 300 desek</button><a href="?onboarding=1">Původní onboarding</a></nav>':'');
    if(reviewMode){notice.querySelector('[data-review-announcement]').onclick=showAnnouncement;
      notice.querySelector('[data-review-catalogue]').onclick=()=>{chooseGame();document.getElementById('refreshCatalogue')?.scrollIntoView({block:'start',behavior:'smooth'})};
      installCatalogue();installNumericCatalogue();
    }
    document.querySelector('.app-footer')?.before(notice);
    installOrderSettings();installHistoryCatalogue();renderFree();renderDaily();renderQuickPlay();updateCatalogue();
    if(params.get('announcement')==='refresh')showAnnouncement();
    if(params.has('board'))openBoard(params.get('board'));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('freeRefreshAnnouncement')?.classList.add('hidden')});
  }
  global.PROPLET_FREE_REFRESH_PREVIEW={fixtureOnly:true,storagePrefix,bankHash,requests,openBoard,nextShared,showAnnouncement,controller,sharedOrder,manifest};
  document.addEventListener('proplet:ready',installPreviewControls,{once:true});
})(window);
