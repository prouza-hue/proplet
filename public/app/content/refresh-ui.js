/* Approved release UI. Native accounts, storage, networking and gameplay remain active. */
(function(global){'use strict';
  const manifest=global.PROPLET_SHARED_FREE_ORDER_MANIFEST;
  const labels={easy:'Snadná',medium:'Střední',hard:'Těžká',hardcore:'Mozkožrout',mozkomor:'Mozkomor',mozkokalypsa:'Mozkokalypsa'};
  const orderDifficulties=Object.keys(labels);
  const modeFor=diff=>freeOrder().record(diff).mode;
  function completed(id,completions){return !!completions['free:'+id]}
  function openBoard(id) {
    const puzzle=Object.values(puzzleDB.free).flat().find(row=>row.id===id);
    if(!puzzle||typeof startGame!=='function')return false;
    if(!allowAccountGameStart())return false;
    if(typeof saveGameProgress==='function')saveGameProgress();
    startGame(puzzle,'free',null);
    return true;
  }
  function decorateCards(){
    for(const diff of orderDifficulties){
      const card=document.querySelector('#difficultyCards .cp-card[data-diff="'+diff+'"]');if(!card)continue;
      card.querySelector('.refresh-count')?.remove();
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
    // Parse the account history once per render, not once for each of 600 board checks.
    const completions=getState().completed||{};
    decorateCards();updateOrderSettings();updateCatalogue(completions);
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

