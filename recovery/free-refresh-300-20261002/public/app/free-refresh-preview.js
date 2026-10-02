/* Isolated static review of FREE_REFRESH; loaded before native application boot. */
(function(global){
  'use strict';
  const fixtures=global.PROPLET_FREE_REFRESH_FIXTURES;
  if(!fixtures||global.PROPLET_FREE_REFRESH_PREVIEW?.fixtureOnly===true)return;
  const productionHosts=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
  if(productionHosts.has(location.hostname))throw new Error('FREE_REFRESH preview cannot run on production.');
  const puzzles=fixtures.puzzles,bank=fixtures.refreshBoards;
  if(!Array.isArray(bank)||bank.length!==300||!Array.isArray(fixtures.recognitionWords))throw new Error('Complete isolated FREE_REFRESH fixtures are required.');
  global.PROPLET_FREE_REFRESH_INTEGRATED_PREVIEW=true;
  global.PROPLET_MK100_INTEGRATED_PREVIEW=true;
  global.PROPLET_RUNTIME_ENV='preview';
  global.PROPLET_RUNTIME_META=Object.freeze({...global.PROPLET_RUNTIME_META,canonicalOrigin:location.origin,freeRefreshIntegratedPreview:true,gen4CandidatePreview:false,gen5CandidatePreview:false});
  const params=new URLSearchParams(location.search);
  const bankHash=String(fixtures.build?.bankSha256||fixtures.build?.bankContentHash||'free-refresh');
  const storagePrefix='proplet-free-refresh-preview:'+bankHash.slice(0,16)+':hc0:'+(params.get('onboarding')==='1'?'onboarding:':'');
  const requests=[],recognized=new Set(fixtures.recognitionWords.map(normalize)),recognitionText=fixtures.recognitionWords.join('\n')+'\n';
  function normalize(word){return String(word||'').normalize('NFC').trim().toLocaleUpperCase('cs-CZ')}
  function response(value,status=200,type='application/json; charset=utf-8',head=false){return new Response(head?null:type.startsWith('application/json')?JSON.stringify(value):value,{status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Proplet-Preview':'fixture-only'}})}
  // No retained native fetch and no network fallback.
  global.fetch=async function(input,options={}){
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
    const method=String(options.method||input?.method||'GET').toUpperCase(),head=method==='HEAD';
    requests.push({path:url.pathname,method,external:url.origin!==location.origin});if(requests.length>200)requests.shift();
    if(url.origin!==location.origin)return response({error:'Externí služby jsou v náhledu vypnuté.'},403,undefined,head);
    if(method!=='GET'&&!head)return response({error:'Náhled ukládá hraní jen v tomto prohlížeči. Účty a odesílání jsou vypnuté.'},409);
    const path=url.pathname;
    if(path==='/puzzles.json')return response(puzzles,200,undefined,head);
    if(path==='/valid-words-v3328.txt')return response(recognitionText,200,'text/plain; charset=utf-8',head);
    if(path==='/api/word-recognition'){const word=normalize(url.searchParams.get('word'));return response({word,recognized:recognized.has(word),source:'frozen-free-refresh-preview'},200,undefined,head)}
    if(path==='/api/config')return response({...fixtures.config,environment:'preview',version:global.PROPLET_RUNTIME_META?.version,appVersion:global.PROPLET_RUNTIME_META?.version,freeRefreshIntegratedPreview:true,accountsEnabled:false,pushEnabled:false},200,undefined,head);
    if(path==='/api/free-order/config'||path==='/api/play-session/config')return response({enabled:false,isolatedPreview:false,environment:'preview'},200,undefined,head);
    if(path==='/api/rolling-content')return response({version:1,asOf:fixtures.build?.asOf,latestBatch:null,nextRelease:null,puzzles:{},meta:{},availableFreeCounts:Object.fromEntries(Object.entries(puzzles.free).map(([key,rows])=>[key,rows.length]))},200,undefined,head);
    if(path==='/api/tajenka'&&fixtures.tajenka)return response(fixtures.tajenka,200,undefined,head);
    if(path==='/api/mozkokalypsa/status')return response({eligible:false,invited:false,closed:true,enabled:false,qa:false,boards:[],attempts:[],completed:0},200,undefined,head);
    if(/^\/api\/[^/]*leaderboard$/.test(path)||/^\/api\/rankings(?:\/(?:xp|daily))?$/.test(path))return response({rows:[],players:[],teams:[],levels:[],total:0,myRank:null,topPercent:null,anonymous:true,hasMore:false,preview:true},200,undefined,head);
    if(path==='/api/push/config')return response({enabled:false,configured:false,publicKey:'',environment:'preview'},200,undefined,head);
    if(path==='/sw.js')return response('',200,'application/javascript; charset=utf-8',head);
    return response({error:'Tato služba není součástí místního náhledu.'},404,undefined,head);
  };
  if(typeof navigator.sendBeacon==='function')navigator.sendBeacon=()=>false;
  if(navigator.serviceWorker){
    navigator.serviceWorker.register=()=>Promise.reject(new Error('Service worker is disabled in the isolated preview.'));
    navigator.serviceWorker.getRegistrations().then(rows=>Promise.all(rows.map(row=>row.unregister()))).catch(()=>{});
  }
  function isolatedStorage(nativeStorage){
    const memory=new Map(),backend=nativeStorage||{get length(){return memory.size},key:i=>[...memory.keys()][i]??null,getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
    const keys=()=>Array.from({length:backend.length},(_,i)=>backend.key(i)).filter(key=>key?.startsWith(storagePrefix));
    return {get length(){return keys().length},key:i=>keys()[i]?.slice(storagePrefix.length)??null,getItem:key=>backend.getItem(storagePrefix+String(key)),setItem:(key,value)=>backend.setItem(storagePrefix+String(key),String(value)),removeItem:key=>backend.removeItem(storagePrefix+String(key)),clear:()=>keys().forEach(key=>backend.removeItem(key))};
  }
  for(const name of ['localStorage','sessionStorage']){let nativeStorage;try{nativeStorage=global[name]}catch{}Object.defineProperty(global,name,{configurable:true,value:isolatedStorage(nativeStorage)})}
  const storage=global.localStorage,stateKey='proplet-v2-state:guest';
  storage.removeItem('proplet-v2-profile');
  if(storage.getItem(stateKey)===null){storage.setItem(stateKey,JSON.stringify({completed:{},rescues:{},inProgress:{},dailyDates:[],statsVersion:5}));storage.setItem('proplet-v2-sync-queue:guest','[]')}
  const now=new Date().toISOString();
  const defaults={...(params.get('onboarding')==='1'?{}:{'proplet-v3-7-required-onboarding':'done','proplet-v3-16-2-helper-onboarding':'done'}),
    'proplet-marketing-consent-v1':JSON.stringify({value:'denied',at:Date.now()}),'proplet-v3-32-8-rule-principle-seen':'1','proplet-v3-16-2-helper-mode':'none',
    'proplet-v3-5-account-nudge':JSON.stringify({shown:[1,2,3],lastShownAt:now}),'proplet-v4-01-4-progress-guard':JSON.stringify({lastShownAt:now}),
    'proplet-v3-26-install-nudge':JSON.stringify({done:true}),'proplet:content-release:mk100-v2':'1'};
  for(const [key,value]of Object.entries(defaults))if(storage.getItem(key)===null)storage.setItem(key,value);
  function previewToast(){if(typeof showToast==='function')showToast('Náhled ukládá hraní jen tady. Účty a odesílání jsou vypnuté.')}
  document.addEventListener('click',event=>{
    const element=event.target.closest?.('a,button');if(!element)return;
    const href=element.getAttribute('href'),blockedLink=href&&(()=>{try{const url=new URL(href,location.href);return url.origin!==location.origin||url.pathname.startsWith('/api/')}catch{return true}})();
    if(blockedLink||['googleLoginBtn','linkGoogleBtn','firstStepsGoogle','progressGuardGoogleBtn'].includes(element.id)){event.preventDefault();event.stopImmediatePropagation();previewToast()}
  },true);
  document.addEventListener('submit',event=>{if(event.target.getAttribute?.('action')){event.preventDefault();event.stopImmediatePropagation();previewToast()}},true);
  const difficulties=['easy','medium','hard'],labels={easy:'Snadná',medium:'Střední',hard:'Těžká'},routeRecordsKey='shared-refresh-preview-choice';
  function choices(){try{return JSON.parse(storage.getItem(routeRecordsKey)||'{}')}catch{return {}}}
  function completed(id){return !!getState().completed?.['free:'+id]}
  function newBoards(diff){return bank.filter(p=>p.difficulty===diff)}
  function completedNew(diff){return newBoards(diff).filter(p=>completed(p.id)).length}
  function nextShared(diff,fallback){
    if(!difficulties.includes(diff)||choices()[diff]==='numeric')return fallback;
    const route=fixtures.routes?.[diff]||[],map=new Map((puzzles.free[diff]||[]).map(p=>[p.id,p]));
    return map.get(route.find(id=>map.has(id)&&!completed(id)))||null;
  }
  const controller={
    enabled:()=>true,ready:()=>true,configure:async()=>true,sync:async()=>{},next:nextShared,adopt:()=>{},newAccount:async()=>{},
    record:diff=>({mode:choices()[diff]||'varied',offered:true,plan:{version:fixtures.build.routeVersion,ids:fixtures.routes?.[diff]||[]}}),
    change:async(diff,mode)=>{if(!difficulties.includes(diff))return;storage.setItem(routeRecordsKey,JSON.stringify({...choices(),[diff]:mode}));if(typeof renderFree==='function')renderFree();if(typeof renderQuickPlay==='function')renderQuickPlay()}
  };
  function openBoard(id){const puzzle=bank.find(row=>row.id===id);if(!puzzle||typeof startGame!=='function')return false;if(typeof saveGameProgress==='function')saveGameProgress();startGame(puzzle,'free',null);return true}
  function chooseGame(){if(typeof nav==='function')nav('free',{replace:true});document.getElementById('difficultyCards')?.scrollIntoView({block:'start',behavior:'smooth'})}
  function newEntry(id){
    let root=document.getElementById(id);
    if(!root){root=document.createElement('aside');root.id=id;root.className='card refresh-entry';const anchor=id==='freeRefreshToday'?document.getElementById('todayNewContentBanner'):document.getElementById('newContentBanner');anchor?.before(root)}
    const done=bank.filter(p=>completed(p.id)).length,left=300-done;root.hidden=id==='freeRefreshToday'&&!left;
    root.innerHTML='<div class="refresh-entry-art" aria-hidden="true">'+
      '<img src="/difficulty/printshop/easy.webp" width="52" height="52" alt=""><img src="/difficulty/printshop/medium.webp" width="52" height="52" alt=""><img src="/difficulty/printshop/hard.webp" width="52" height="52" alt=""></div>'+
      '<div class="refresh-entry-copy"><h2>'+(left?'300 nových Propletů':'Nové desky dohrané')+'</h2><p>'+(done?left+' nových desek ještě čeká.':'100 nových desek v každé ze tří obtížností.')+'</p></div>'+
      '<button class="primary-btn" type="button">'+(left?'Vybrat hru':'Prohlédnout desky')+'</button>';
    root.querySelector('button').onclick=chooseGame;
  }
  function decorateCards(){
    for(const diff of difficulties){
      const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
      let counter=card.querySelector('.refresh-count');if(!counter){counter=document.createElement('p');counter.className='refresh-count';card.querySelector('.cp-track')?.after(counter)}counter.textContent='Nové desky: '+completedNew(diff)+' / 100';
      let hint=card.querySelector('.order-hint');if(!hint){hint=document.createElement('p');hint.className='order-hint';card.querySelector('.order-controls')?.append(hint)}hint.textContent='Společné pořadí pro všechny. Dohrané desky přeskakujeme.';
    }
    document.querySelector('#difficultyCards .cp-card[data-diff="hardcore"] .order-controls')?.remove();newEntry('freeRefreshHub');
  }
  function installCatalogue(){
    if(document.getElementById('refreshCatalogue'))return;
    const section=document.createElement('section');section.id='refreshCatalogue';section.className='card refresh-catalogue';section.innerHTML='<h2>Všech 300 nových desek</h2><p>Každou můžeš otevřít přímo. Číslování původních úrovní zůstává zachované.</p>';
    for(const diff of difficulties){
      const details=document.createElement('details');details.dataset.refreshCatalogue=diff;const summary=document.createElement('summary');summary.textContent=labels[diff]+' · 100 nových desek';details.append(summary);
      const grid=document.createElement('div');grid.className='refresh-catalogue-grid';
      for(const p of newBoards(diff)){const button=document.createElement('button');button.type='button';button.dataset.refreshBoard=p.id;const ordinal=Number(p.id.split('-').at(-1));button.textContent=String(ordinal);button.title=labels[diff]+' · Úroveň '+p.meta.level;button.setAttribute('aria-label',labels[diff]+', nová deska '+ordinal+', původní číslo úrovně '+p.meta.level);button.onclick=()=>openBoard(p.id);grid.append(button)}
      details.append(grid);section.append(details);
    }
    document.getElementById('screen-free')?.append(section);
  }
  function updateCatalogue(){document.querySelectorAll('[data-refresh-board]').forEach(button=>{const done=completed(button.dataset.refreshBoard);button.classList.toggle('is-done',done);button.setAttribute('aria-description',done?'Dohráno. Opakování zůstává tréninkem.':'Dosud nedohráno.')})}
  function showAnnouncement(){
    let modal=document.getElementById('freeRefreshAnnouncement');
    if(!modal){modal=document.createElement('div');modal.id='freeRefreshAnnouncement';modal.className='modal hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','freeRefreshAnnouncementTitle');
      modal.innerHTML='<section class="modal-card refresh-announcement"><button type="button" class="modal-close" data-refresh-close aria-label="Zavřít">×</button>'+
      '<div class="refresh-announcement-art" aria-hidden="true"><img src="/difficulty/printshop/easy.webp" alt=""><img src="/difficulty/printshop/medium.webp" alt=""><img src="/difficulty/printshop/hard.webp" alt=""></div>'+
      '<h2 id="freeRefreshAnnouncementTitle">300 nových Propletů</h2><p>Snadná, Střední a Těžká. V každé 100 nových desek s pestřejšími slovy.</p>'+
      '<button type="button" class="primary-btn big" data-refresh-play>Vybrat obtížnost</button><button type="button" class="text-btn" data-refresh-close>Teď ne</button></section>';
      document.body.append(modal);modal.querySelectorAll('[data-refresh-close]').forEach(button=>button.onclick=()=>modal.classList.add('hidden'));modal.querySelector('[data-refresh-play]').onclick=()=>{modal.classList.add('hidden');chooseGame()};modal.addEventListener('click',event=>{if(event.target===modal)modal.classList.add('hidden')});
    }
    modal.classList.remove('hidden');modal.querySelector('[data-refresh-play]').focus();
  }
  function installPreviewControls(){
    global.freeOrder=()=>controller;
    const originalFree=global.renderFree;global.renderFree=function(){originalFree();decorateCards();updateCatalogue()};
    const originalDaily=global.renderDaily;global.renderDaily=function(){originalDaily();newEntry('freeRefreshToday')};
    const notice=document.createElement('aside');notice.id='freeRefreshPreviewNotice';notice.className='refresh-preview-notice';notice.innerHTML='<p>Náhled 300 nových desek · hraní a návrh společné cesty jsou uložené jen v tomto prohlížeči.</p><nav aria-label="Prohlížení návrhu"><button type="button" data-review-announcement>Návrh oznámení</button><button type="button" data-review-catalogue>Všech 300 desek</button><a href="?onboarding=1">Původní onboarding</a></nav>';
    notice.querySelector('[data-review-announcement]').onclick=showAnnouncement;notice.querySelector('[data-review-catalogue]').onclick=()=>{chooseGame();document.getElementById('refreshCatalogue')?.scrollIntoView({block:'start',behavior:'smooth'})};document.querySelector('.app-footer')?.before(notice);
    installCatalogue();renderFree();renderDaily();renderQuickPlay();updateCatalogue();if(params.get('announcement')==='refresh')showAnnouncement();if(params.has('board'))openBoard(params.get('board'));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')document.getElementById('freeRefreshAnnouncement')?.classList.add('hidden')});
  }
  global.PROPLET_FREE_REFRESH_PREVIEW={fixtureOnly:true,storagePrefix,bankHash,requests,openBoard,nextShared,showAnnouncement,controller};
  document.addEventListener('proplet:ready',installPreviewControls,{once:true});
})(window);
