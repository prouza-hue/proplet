/* Approved release UI. Native accounts, storage, networking and gameplay remain active. */
(function(global){'use strict';
  const manifest=global.PROPLET_SHARED_FREE_ORDER_MANIFEST;
  const labels={easy:'Snadná',medium:'Střední',hard:'Těžká',hardcore:'Mozkožrout',mozkomor:'Mozkomor',mozkokalypsa:'Mozkokalypsa'};
  const orderDifficulties=Object.keys(labels),difficulties=['easy','medium','hard'];
  let bank=[];
  const modeFor=diff=>freeOrder().record(diff).mode;
  const releaseDismissKey=()=> 'proplet:refresh300:box:'+ (getProfile()?.id||'guest');
  function completed(id,completions){return !!completions['free:'+id]}
  function newBoards(diff){return bank.filter(p=>p.difficulty===diff)}
  function completedNew(diff,completions){return newBoards(diff).filter(p=>completed(p.id,completions)).length}
  function openBoard(id) {
    const puzzle=Object.values(puzzleDB.free).flat().find(row=>row.id===id);
    if(!puzzle||typeof startGame!=='function')return false;
    if(!allowAccountGameStart())return false;
    if(typeof saveGameProgress==='function')saveGameProgress();
    startGame(puzzle,'free',null);
    return true;
  }
  function chooseGame(){
    if(typeof nav==='function')nav('free',{replace:true});
    document.getElementById('difficultyCards')?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function newEntry(id,completions){
    let root=document.getElementById(id);
    if(!root){root=document.createElement('aside');root.id=id;root.className='card refresh-entry';
      const anchor=document.getElementById('todayNewContentBanner');
      anchor?.before(root);
    }
    const done=bank.filter(p=>completed(p.id,completions)).length,left=300-done;
    root.hidden=global.PropletReferralPreview?.model.incoming===true||bank.length!==300||!left||localStorage.getItem(releaseDismissKey())==='1';
    root.innerHTML='<div class="refresh-entry-art" aria-hidden="true">'+
      '<img src="/difficulty/printshop/easy.webp" width="52" height="52" alt="">'+
      '<img src="/difficulty/printshop/medium.webp" width="52" height="52" alt="">'+
      '<img src="/difficulty/printshop/hard.webp" width="52" height="52" alt=""></div>'+
      '<div class="refresh-entry-copy"><h2>300 nových Propletů</h2><p>Čerstvá slova ve Snadné, Střední i Těžké.</p>'+
      '<button class="refresh-entry-link" type="button" data-refresh-choose>Vybrat hru <span aria-hidden="true">→</span></button></div>'+
      '<button class="refresh-entry-dismiss" type="button" data-refresh-dismiss aria-label="Skrýt pozvánku na nové desky">×</button>';
    root.querySelector('[data-refresh-choose]').onclick=chooseGame;
    root.querySelector('[data-refresh-dismiss]').onclick=()=>{localStorage.setItem(releaseDismissKey(),'1');root.hidden=true};
  }
  function decorateCards(completions){
    for(const diff of orderDifficulties){
      const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
      card.querySelector('.refresh-count')?.remove();
      if(bank.length===300&&difficulties.includes(diff)){
        const left=100-completedNew(diff,completions);
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
    const byId=new Map(sortedFreeBank(diff).map(p=>[p.id,p]));
    for(const id of byId.keys()){
      const p=byId.get(id),button=document.createElement('button');button.type='button';button.dataset.sharedBoard=id;
      button.textContent=String(p.meta.level);button.title=labels[diff]+' · úroveň '+p.meta.level;
      button.setAttribute('aria-label',labels[diff]+', úroveň '+p.meta.level);
      button.onclick=()=>{document.getElementById('playedLevelsModal')?.classList.add('hidden');openBoard(id)};grid.append(button);
    }
    details.append(grid);updateCatalogue();
  }
  function updateCatalogue(completions=getState().completed||{}){
    document.querySelectorAll('[data-refresh-board],[data-shared-board]').forEach(button=>{
      const done=completed(button.dataset.refreshBoard||button.dataset.sharedBoard,completions);button.classList.toggle('is-done',done);
      button.setAttribute('aria-description',done?'Dohráno. Opakování zůstává tréninkem.':'Dosud nedohráno.');
    });
  }

  function refresh(){
    bank=Object.values(puzzleDB.free||{}).flat().filter(p=>p.id.startsWith('g6-refresh-'));
    // Parse the account history once per render, not once for each of 600 board checks.
    const completions=getState().completed||{};
    decorateCards(completions);newEntry('freeRefreshToday',completions);updateOrderSettings();updateCatalogue(completions);
  }
  function install(){
    const originalFree=global.renderFree;
    global.renderFree=function(){originalFree();refresh()};
    const originalDaily=global.renderDaily;
    global.renderDaily=function(){originalDaily();refresh()};
    installOrderSettings();installHistoryCatalogue();refresh();
  }
  document.addEventListener('proplet:ready',install,{once:true});
  document.addEventListener('proplet:account-changed',()=>{if(document.getElementById('freeOrderSettings'))refresh()});
})(window);

