(()=>{
  'use strict';
  if(window.__PROPLET_PRINTSHOP_RELEASE_POLISH_V2__)return;
  window.__PROPLET_PRINTSHOP_RELEASE_POLISH_V2__=true;

  const q=(s,r=document)=>r.querySelector(s);
  const TAJENKA_BOARD_URL='https://iopyhluayfszskyqqpuc.supabase.co/functions/v1/proplet-tajenka-leaderboard';
  const STYLE_ID='propletTajenkaPrintshopPolish';
  let freeObserver=null;
  let dailyObserver=null;
  let profileObserver=null;
  let modalObserver=null;
  let initialFreeRefreshDone=false;
  let polishQueued=false;

  function escHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function countCzech(n,one,few,many){return `${n} ${n===1?one:(n>=2&&n<=4?few:many)}`}
  function formatTime(ms){
    const total=Math.max(0,Math.floor(Number(ms||0)/1000));
    return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
  }

  function ensureTajenkaStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
html.tiskarna-ui #tajenkaPlayCard{margin-top:12px!important}
html.tiskarna-ui #tajenkaPlayCard .tajenka-entry-icon{background:transparent!important;box-shadow:none!important}
html.tiskarna-ui #tajenkaPlayCard .tajenka-entry-icon img{display:block;width:100%;height:100%;object-fit:contain}
html.tiskarna-ui #winModal.tajenka-result-mode .win-card{display:flex!important;flex-direction:column!important;text-align:center!important}
html.tiskarna-ui #winModal.tajenka-result-mode :is(#winBadge,#winTitle,#winPraise){display:none!important}
html.tiskarna-ui #winModal.tajenka-result-mode #tajenkaWinPhrase{order:1!important;display:block!important;margin:0 0 8px!important;padding:16px 10px 17px!important;border:0!important;border-bottom:1px solid var(--td-line)!important;border-radius:0!important;background:transparent!important}
html.tiskarna-ui #winModal.tajenka-result-mode #tajenkaWinPhrase strong{display:block!important;margin:0!important;color:var(--td-ink)!important;font-size:clamp(24px,6vw,34px)!important;line-height:1.15!important;letter-spacing:-.025em!important}
html.tiskarna-ui #winModal.tajenka-result-mode .win-summary{order:2!important;margin:0 0 5px!important;padding:9px 2px 10px!important;text-align:left!important;border-top:0!important;border-bottom:1px solid var(--td-line)!important}
html.tiskarna-ui #winModal.tajenka-result-mode .win-summary:before{content:'TVŮJ VÝSLEDEK';display:block;margin-bottom:4px;color:var(--td-muted);font-size:9px;font-weight:950;letter-spacing:.13em}
html.tiskarna-ui #winModal.tajenka-result-mode #winText{margin:0!important;color:var(--td-ink)!important;font-size:14px!important;font-weight:850!important;line-height:1.35!important}
html.tiskarna-ui #winModal.tajenka-result-mode .win-summary-chips{display:none!important}
html.tiskarna-ui #winModal.tajenka-result-mode #levelLeaderboardBox{order:3!important;display:block!important;margin:0 0 9px!important;padding:8px 0 0!important;border-top:0!important}
html.tiskarna-ui #winModal.tajenka-result-mode #winPrimaryBtn{order:4!important;margin-top:2px!important}
html.tiskarna-ui #winModal.tajenka-result-mode .win-secondary-actions{order:5!important}
html.tiskarna-ui #winModal.tajenka-result-mode #winAccountBtn{order:6!important}
html.tiskarna-ui #winModal.tajenka-result-mode #newBadgeBox{order:7!important}
html.tiskarna-ui #winModal.tajenka-result-mode #starterHardActions{order:8!important}
html.tiskarna-ui #winModal.tajenka-result-mode #winDetails{order:9!important}
html.tiskarna-ui #winModal.tajenka-result-mode #winFeedback{order:10!important}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:0 2px 7px;text-align:left}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-head strong{font-size:14px;color:var(--td-ink)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-head span{font-size:10px;font-weight:850;color:var(--td-muted)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-rows{display:grid;gap:5px}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:7px;align-items:center;padding:7px 8px;border:1px solid var(--td-line);border-radius:7px;background:var(--td-paper);text-align:left}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-row.me{background:var(--td-mint);border-color:color-mix(in srgb,#258878 34%,var(--td-line))}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-rank{font-size:14px;font-weight:950;text-align:center}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-name{min-width:0}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--td-ink)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-name small{display:block;margin-top:1px;font-size:9px;color:var(--td-muted)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-score{text-align:right}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-score strong{display:block;font-size:12px;color:var(--td-ink)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-score small{display:block;font-size:8.5px;color:var(--td-muted)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-summary{display:flex;align-items:center;gap:8px;margin:0 0 7px;padding:7px 8px;background:var(--td-mint);border:1px solid var(--td-line);border-radius:7px;text-align:left}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-summary strong{font-size:20px;line-height:1;color:var(--td-ink)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-summary span{font-size:10px;font-weight:800;color:var(--td-muted)}
html.tiskarna-ui #winModal.tajenka-result-mode .tajenka-board-note{display:block;margin:6px 2px 0;font-size:8.5px;line-height:1.3;color:var(--td-muted)}
@media(max-width:539px){
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column{grid-template-rows:auto auto auto minmax(0,1fr)!important;gap:3px!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.game-info{min-height:0!important;height:auto!important;margin:0!important;padding:3px 7px!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word{min-height:34px!important;height:auto!important;max-height:58px!important;margin:0!important;padding:3px 7px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;gap:1px 7px!important;align-items:center!important;align-self:start!important;overflow:hidden!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word>div{grid-column:1!important;grid-row:1!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word strong{min-height:0!important;margin:0!important;font-size:15px!important;line-height:1.05!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word .clean-status{grid-column:2!important;grid-row:1!important;margin:0!important;padding:3px 5px!important;font-size:8px!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word #gameMessage{grid-column:1/-1!important;grid-row:2!important;min-height:0!important;margin:0!important;padding:1px 0 0!important;font-size:9px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.current-word #gameMessage:empty{display:none!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.tajenka-phrase{min-height:0!important;margin:0!important;padding:4px 7px!important;gap:2px!important}
 html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.board-stage{min-height:0!important;height:100%!important;margin:0!important;padding:3px!important}
}
`;
    document.head.appendChild(style);
  }

  function hardcoreDoneForUnlock(){
    try{
      const progress=typeof freeProgress==='function'?freeProgress('hardcore'):null;
      return Math.max(0,Number(progress?.done)||0);
    }catch{return 0}
  }

  function installMozkomorUnlockPatch(){
    if(typeof mozkomorUnlockState!=='function'||mozkomorUnlockState.__printshopAllHardcoreDone)return;
    const base=mozkomorUnlockState;
    const wrapped=function(){
      const state=base.apply(this,arguments)||{};
      const required=Math.max(1,Number(state.required)||200);
      const done=Math.min(required,Math.max(Number(state.done)||0,hardcoreDoneForUnlock()));
      const unlocked=state.unlocked===true||done>=required;
      if(unlocked&&state.unlocked!==true){
        try{
          if(typeof scopedStorageKey==='function'&&typeof MOZKOMOR_UNLOCK_KEY!=='undefined')localStorage.setItem(scopedStorageKey(MOZKOMOR_UNLOCK_KEY),'1');
        }catch{}
      }
      return {...state,done,required,unlocked};
    };
    wrapped.__printshopAllHardcoreDone=true;
    mozkomorUnlockState=wrapped;
  }

  function tuneMozkomorCopy(){
    try{
      if(typeof DIFF!=='undefined'&&DIFF?.mozkomor)DIFF.mozkomor.desc='10×10 · endgame pro hráče, kteří porazili Mozkožrouta.';
    }catch{}
  }

  function positionWeeklyBanner(){
    const banner=q('#newContentBanner'),cards=q('#difficultyCards');
    if(!banner||!cards||!cards.parentElement)return;
    let done=false;
    try{done=typeof latestContentUnplayed==='function'&&latestContentUnplayed().length===0&&typeof latestContentPuzzles==='function'&&latestContentPuzzles().length>0}catch{}
    if(!done)done=(banner.querySelector('h2')?.textContent||'').trim()==='Týdenní várka dohraná';
    if(done){
      if(cards.nextElementSibling!==banner)cards.insertAdjacentElement('afterend',banner);
      const gridStyle=getComputedStyle(cards);
      banner.style.marginTop=gridStyle.rowGap&&gridStyle.rowGap!=='normal'?gridStyle.rowGap:(gridStyle.gap&&gridStyle.gap!=='normal'?gridStyle.gap:'16px');
    }else{
      banner.style.marginTop='';
      if(banner.nextElementSibling!==cards)cards.parentElement.insertBefore(banner,cards);
    }
  }

  function installWeeklyBannerIcon(){
    const spark=q('#newContentBanner .new-content-spark');
    if(!spark||spark.dataset.weeklyIconReady==='1')return;
    spark.textContent='';
    const img=document.createElement('img');
    img.src='/weekly-banner-icon-optimized.svg';
    img.alt='';
    img.setAttribute('aria-hidden','true');
    img.style.width='42px';
    img.style.height='42px';
    img.style.display='block';
    img.style.objectFit='contain';
    spark.appendChild(img);
    spark.dataset.weeklyIconReady='1';
  }

  function installTajenkaIcon(root=q('#tajenkaPreviewCard')){
    const slot=root?.querySelector('.tajenka-entry-icon');
    if(!slot)return;
    let img=slot.querySelector('img[data-tajenka-icon]');
    if(!img){
      slot.textContent='';
      img=document.createElement('img');
      img.src='/tajenka.svg';
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.dataset.tajenkaIcon='1';
      img.style.display='block';
      img.style.width='100%';
      img.style.height='100%';
      img.style.objectFit='contain';
      slot.appendChild(img);
    }
    slot.style.background='transparent';
    slot.style.boxShadow='none';
  }

  function syncTajenkaDailyPlacement(){
    const card=q('#tajenkaPreviewCard'),screen=q('#screen-daily'),hero=q('#screen-daily .daily-hero');
    if(!card||!screen)return;
    card.querySelector('.tajenka-entry-copy>.eyebrow')?.remove();
    if(card.classList.contains('hidden'))return;
    if(card.classList.contains('completed')){
      if(screen.lastElementChild!==card)screen.appendChild(card);
    }else if(hero&&hero.nextElementSibling!==card){
      hero.insertAdjacentElement('afterend',card);
    }
    installTajenkaIcon(card);
  }

  function tajenkaPlaySignature(source){
    const completed=source.classList.contains('completed');
    const copy=source.querySelector('.tajenka-entry-copy');
    return `${completed?'1':'0'}|${(copy?.textContent||'').replace(/\s+/g,' ').trim()}`;
  }

  function syncTajenkaPlayCard(){
    const source=q('#tajenkaPreviewCard'),screen=q('#screen-free');
    if(!screen)return;
    let card=q('#tajenkaPlayCard');
    if(!source||source.classList.contains('hidden')){card?.classList.add('hidden');return}
    if(!card){
      card=document.createElement('div');
      card.id='tajenkaPlayCard';
      card.className='card tajenka-preview-card tajenka-play-card hidden';
      screen.appendChild(card);
    }
    if(screen.lastElementChild!==card)screen.appendChild(card);
    const completed=source.classList.contains('completed'),signature=tajenkaPlaySignature(source);
    if(card.dataset.signature!==signature){
      const phrase=(source.querySelector('.tajenka-revealed-phrase')?.textContent||'').trim();
      const sourceCopy=(source.querySelector('.tajenka-entry-copy p')?.textContent||'').trim();
      const reward=(source.querySelector('.tajenka-entry-reward')?.textContent||'').trim();
      const label=completed?'Zobrazit výsledek':((source.querySelector('#tajenkaPreviewBtn')?.textContent||'Hrát').trim());
      card.classList.toggle('completed',completed);
      card.innerHTML=`<div class="tajenka-entry-icon" aria-hidden="true"></div><div class="tajenka-entry-copy"><h2>${completed?'Tajenka odhalena':'Tajenka'}</h2>${completed&&phrase?`<strong class="tajenka-revealed-phrase">${escHtml(phrase)}</strong>`:`<p>${escHtml(sourceCopy||'Najdi pět slov a odhal tajenku.')}</p>${reward?`<span class="tajenka-entry-reward">${escHtml(reward)}</span>`:''}`}</div><button type="button" class="${completed?'secondary-btn':'primary-btn'}" data-tajenka-play-action>${escHtml(label)}</button>`;
      card.dataset.signature=signature;
      card.querySelector('[data-tajenka-play-action]').onclick=()=>{
        if(completed)source.querySelector('[data-tajenka-recap]')?.click();
        else source.querySelector('#tajenkaPreviewBtn')?.click();
      };
    }
    card.classList.remove('hidden');
    installTajenkaIcon(card);
  }

  function polishFreeScreen(){
    q('#freeCalmQuick')?.remove();
    const note=q('#screen-free .mozkomor-lock-note');
    if(note&&note.textContent!=='🔒 Odemkne se po dokončení 200 Mozkožroutů')note.textContent='🔒 Odemkne se po dokončení 200 Mozkožroutů';
    positionWeeklyBanner();
    installWeeklyBannerIcon();
    syncTajenkaPlayCard();
  }

  function polishProfileCopy(){
    q('#screen-profile>.screen-title>.eyebrow')?.remove();
    const card=q('#profileCard');
    if(card&&!getProfile?.()?.token){
      const heading=card.querySelector('h2');
      const button=card.querySelector('#profileCreateBtn');
      if(heading?.textContent?.trim()==='Nepřijdi o své výsledky')heading.textContent='Nepřijď o své výsledky';
      if(button&&button.textContent!=='Uložit výsledky · +500 XP')button.textContent='Uložit výsledky · +500 XP';
    }
    const modalTitle=q('#profileModalTitle');
    if(modalTitle?.textContent?.trim()==='Nepřijdi o své výsledky')modalTitle.textContent='Nepřijď o své výsledky';
    const accountEyebrow=q('#accountNudgeEyebrow');
    if(accountEyebrow?.textContent?.includes('NEPŘIJDI'))accountEyebrow.textContent=accountEyebrow.textContent.replace('NEPŘIJDI','NEPŘIJĎ');
    const winButton=q('#winAccountBtn');
    if(winButton&&!winButton.classList.contains('hidden')&&winButton.textContent.includes('Uložit výsledky')&&winButton.textContent!=='Uložit výsledky · +500 XP')winButton.textContent='Uložit výsledky · +500 XP';
  }

  function resetTajenkaResultMode(){q('#winModal')?.classList.remove('tajenka-result-mode')}

  function playerResultLine(result){
    const elapsed=Number(result?.elapsedMs)||0,moves=Math.max(0,Number(result?.moves)||0),hints=Math.max(0,Number(result?.hints??result?.hintsUsed)||0);
    const hintText=hints===0?'bez nápovědy':countCzech(hints,'nápověda','nápovědy','nápověd');
    return `${formatTime(elapsed)} · ${countCzech(moves,'tah','tahy','tahů')} · ${hintText}`;
  }

  function prepareTajenkaResult(result,puzzleId){
    const modal=q('#winModal'),phrase=q('#tajenkaWinPhrase'),summary=q('.win-summary',modal),board=q('#levelLeaderboardBox',modal);
    if(!modal||!phrase||!summary||!board)return;
    modal.classList.add('tajenka-result-mode');
    const phraseText=(phrase.querySelector('strong')?.textContent||'').trim();
    phrase.replaceChildren();
    const strong=document.createElement('strong');strong.textContent=phraseText;phrase.appendChild(strong);phrase.classList.remove('hidden');
    q('#winText',modal).textContent=playerResultLine(result);
    board.classList.remove('hidden','daily-global-board','free-level-board');
    board.innerHTML='<div class="leaderboard-empty"><strong>Načítám pořadí Tajenky…</strong></div>';
    if(puzzleId)loadTajenkaLeaderboard(puzzleId,board);
  }

  function rankingQuality(row){
    if(row?.cleanSolve===true)return 'Čistě · bez nápovědy';
    const hints=Math.max(0,Number(row?.hintsUsed)||0);
    return hints?countCzech(hints,'nápověda','nápovědy','nápověd'):'Bez nápovědy';
  }

  function renderTajenkaLeaderboard(box,data){
    const total=Math.max(0,Number(data?.total)||0),rank=Number(data?.myRank)||0,rows=Array.isArray(data?.rows)?data.rows:[];
    const header=`<div class="tajenka-board-head"><strong>Pořadí Tajenky</strong><span>${countCzech(total,'hráč','hráči','hráčů')}</span></div>`;
    const summary=rank?`<div class="tajenka-board-summary"><strong>${rank}.</strong><span>${total===1?'První dokončený výsledek.':`Tvoje místo mezi ${total} hráči.`}</span></div>`:'';
    const rowHtml=rows.map(row=>`<div class="tajenka-board-row ${row.isMine?'me':''}"><div class="tajenka-board-rank">${Number(row.rank)||'—'}.</div><div class="tajenka-board-name"><strong>${escHtml(row.avatar||'🙂')} ${escHtml(row.name||'Hráč')}${row.isMine?' · Ty':''}</strong><small>${escHtml(rankingQuality(row))} · ${escHtml(countCzech(Number(row.moves)||0,'tah','tahy','tahů'))}</small></div><div class="tajenka-board-score"><strong>${formatTime(row.elapsedMs)}</strong><small>čas</small></div></div>`).join('');
    const profileToken=(()=>{try{return getProfile?.()?.token||null}catch{return null}})();
    const note=rank?'Do pořadí se počítá první dokončený pokus.':profileToken?'Tvůj synchronizovaný výsledek zatím v pořadí není.':'Přesné vlastní místo se zobrazí po uložení výsledku k účtu.';
    box.innerHTML=`${header}${summary}<div class="tajenka-board-rows">${rowHtml||'<div class="leaderboard-empty"><strong>Zatím tu nikdo není.</strong></div>'}</div><small class="tajenka-board-note">${escHtml(note)}</small>`;
  }

  async function loadTajenkaLeaderboard(puzzleId,box=q('#levelLeaderboardBox')){
    if(!box||!puzzleId)return;
    try{
      let token=null;
      try{token=getProfile?.()?.token||null}catch{}
      if(token&&typeof syncQueue==='function'){
        try{await syncQueue({announce:false})}catch{}
      }
      const headers={};if(token)headers.Authorization=`Bearer ${token}`;
      const response=await fetch(`${TAJENKA_BOARD_URL}?puzzle_id=${encodeURIComponent(puzzleId)}`,{method:'GET',headers,cache:'no-store',mode:'cors'});
      let data=null;try{data=await response.json()}catch{}
      if(!response.ok)throw new Error(data?.detail||`HTTP ${response.status}`);
      if(!q('#winModal')?.classList.contains('tajenka-result-mode'))return;
      renderTajenkaLeaderboard(box,data||{});
    }catch(error){
      if(!q('#winModal')?.classList.contains('tajenka-result-mode'))return;
      box.innerHTML=`<div class="leaderboard-empty"><strong>Pořadí se teď nepodařilo načíst.</strong><small>${escHtml(error?.message||'Zkus to prosím znovu.')}</small></div>`;
    }
  }

  function polishTajenkaFinish(g){
    const puzzleId=g?.puzzle?.id||null;
    prepareTajenkaResult({elapsedMs:g?.elapsedMs,moves:g?.moves,hints:g?.hints},puzzleId);
  }

  function polishTajenkaRecap(completion){
    prepareTajenkaResult(completion||{},completion?.puzzleId||null);
  }

  function polish(){
    ensureTajenkaStyles();
    installMozkomorUnlockPatch();
    tuneMozkomorCopy();
    syncTajenkaDailyPlacement();
    polishFreeScreen();
    installTajenkaIcon();
    polishProfileCopy();
  }

  function queuePolish(){
    if(polishQueued)return;
    polishQueued=true;
    queueMicrotask(()=>{polishQueued=false;polish()});
  }

  function wrapRender(name,after){
    const current=globalThis[name];
    if(typeof current!=='function'||current.__printshopReleasePolish)return;
    const wrapped=function(){const result=current.apply(this,arguments);try{after(...arguments)}catch{}return result};
    wrapped.__printshopReleasePolish=true;
    globalThis[name]=wrapped;
  }

  function wrapAsync(name,after){
    const current=globalThis[name];
    if(typeof current!=='function'||current.__printshopReleasePolish)return;
    const wrapped=async function(){const args=[...arguments],result=await current.apply(this,args);try{await after(...args)}catch(error){console.warn('Printshop Tajenka polish failed',error)}return result};
    wrapped.__printshopReleasePolish=true;
    globalThis[name]=wrapped;
  }

  function wrapBefore(name,before){
    const current=globalThis[name];
    if(typeof current!=='function'||current.__printshopBeforePolish)return;
    const wrapped=function(){try{before(...arguments)}catch{}return current.apply(this,arguments)};
    wrapped.__printshopBeforePolish=true;
    globalThis[name]=wrapped;
  }

  function install(){
    ensureTajenkaStyles();
    installMozkomorUnlockPatch();
    tuneMozkomorCopy();
    wrapRender('renderFree',()=>queuePolish());
    wrapRender('renderTajenkaEntry',()=>queuePolish());
    wrapRender('renderProfile',()=>queuePolish());
    wrapRender('setAccountMode',()=>queuePolish());
    wrapRender('updateWinAccountCta',()=>queuePolish());
    wrapBefore('finishGame',resetTajenkaResultMode);
    wrapAsync('finishTajenkaGame',polishTajenkaFinish);
    wrapRender('showTajenkaRecap',polishTajenkaRecap);
    if(!initialFreeRefreshDone&&typeof renderFree==='function'){
      initialFreeRefreshDone=true;
      try{renderFree()}catch{}
    }
    polish();
    const free=q('#screen-free');
    if(free&&!freeObserver){freeObserver=new MutationObserver(queuePolish);freeObserver.observe(free,{childList:true,subtree:true})}
    const daily=q('#screen-daily');
    if(daily&&!dailyObserver){dailyObserver=new MutationObserver(queuePolish);dailyObserver.observe(daily,{childList:true,subtree:true})}
    const profile=q('#screen-profile');
    if(profile&&!profileObserver){profileObserver=new MutationObserver(queuePolish);profileObserver.observe(profile,{childList:true,subtree:true})}
    const modal=q('#profileModal');
    if(modal&&!modalObserver){modalObserver=new MutationObserver(queuePolish);modalObserver.observe(modal,{childList:true,subtree:true,characterData:true})}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,300);
  setTimeout(install,1200);
})();
