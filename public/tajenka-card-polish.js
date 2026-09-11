(()=>{
  'use strict';
  if(window.__PROPLET_TAJENKA_CARD_POLISH__)return;
  window.__PROPLET_TAJENKA_CARD_POLISH__=true;

  const q=(selector,root=document)=>root?.querySelector?.(selector)||null;
  let queued=false;

  function sentenceCase(value){
    const raw=String(value??'').trim().replace(/^[„“"]+|[„“"]+$/g,'').trim();
    if(!raw)return '';
    const letters=raw.replace(/[^\p{L}]/gu,'');
    if(!letters||letters!==letters.toLocaleUpperCase('cs-CZ'))return raw;
    const lower=raw.toLocaleLowerCase('cs-CZ');
    return lower.replace(/\p{L}/u,ch=>ch.toLocaleUpperCase('cs-CZ'));
  }

  function quotePhrase(value){
    const phrase=sentenceCase(value);
    return phrase?`„${phrase}“`:'';
  }

  function polishShareButton(button){
    if(!button||button.dataset.tajenkaCardPolished==='1')return;
    button.dataset.tajenkaCardPolished='1';
    button.classList.add('tajenka-share-cta','painted-action-control');
    button.setAttribute('aria-label','Pošli tajenku');
    const icon=document.createElement('img');
    icon.src='/rewards/printshop/challenge.svg?v=icons1';
    icon.className='painted-action-icon';
    icon.alt='';
    icon.width=24;
    icon.height=24;
    icon.setAttribute('aria-hidden','true');
    button.replaceChildren(icon,document.createTextNode(' Pošli tajenku'));
  }

  function polishCard(card){
    if(!card?.classList.contains('completed'))return;
    const copy=q('.tajenka-entry-copy',card);
    q('h2',copy)?.remove();
    const phrase=q('.tajenka-revealed-phrase',copy);
    if(phrase){
      const quoted=quotePhrase(phrase.textContent);
      if(quoted&&phrase.textContent!==quoted)phrase.textContent=quoted;
    }
    polishShareButton(q('[data-tajenka-share]',card));
  }

  function polishResult(){
    const modal=q('#winModal');
    if(!modal?.classList.contains('tajenka-daily-result'))return;
    const title=q('#winTitle',modal);
    if(title){
      const quoted=quotePhrase(title.textContent);
      if(quoted&&title.textContent!==quoted)title.textContent=quoted;
    }
  }

  function polishWeeklyBanner(){
    q('#newContentBanner .eyebrow')?.remove();
  }

  function polishHintBanner(){
    const banner=q('#tajenkaHintBanner');
    if(!banner)return;
    banner.classList.add('tajenka-hint-banner-polished');
    const raw=String(banner.textContent||'').trim();
    if(!raw)return;
    const cleaned=raw.replace(/^[💭💡]\s*/u,'').trim();
    const desired=`💡 ${cleaned}`;
    if(banner.textContent!==desired)banner.textContent=desired;
  }

  /*
   * Tajenka mobile/Fold stability guard.
   *
   * The first semantic-hint implementation added a fifth CSS-grid row with an
   * `auto` track. CSS Grid stretches auto tracks by default, so on a narrow Fold
   * that row could consume most of the available board height and look like a
   * giant empty panel. Keep the hint as a dedicated row, but make the row
   * max-content so it can never reserve more space than the clue itself.
   *
   * Samsung Fold can also report a transient viewport while moving from the
   * unfolded tablet state back to the cover display. The canonical game-layout
   * listener gets the immediate resize; the settled passes below deliberately
   * re-run that listener after the viewport has stabilised and then refit the
   * board on the following frames. No game state or board geometry is changed.
   */
  function installMobileLayoutGuard(){
    if(window.__PROPLET_TAJENKA_MOBILE_LAYOUT_GUARD__)return;
    window.__PROPLET_TAJENKA_MOBILE_LAYOUT_GUARD__=true;

    const style=document.createElement('style');
    style.id='tajenkaMobileLayoutGuardStyle';
    style.textContent=`
      /* Calm is a run state, not a persistent action button. Tablet/wide-layout
         rules must never resurrect the action after the run has become calm. */
      body.calm-run-v334 #calmRunBtn{
        display:none!important;
      }

      @media(max-width:600px){
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column,
        html.tiskarna-ui .tajenka-mode .game-board-column{
          grid-template-rows:auto auto auto max-content minmax(0,1fr)!important;
        }
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.tajenka-hint-banner:not(.hidden),
        html.tiskarna-ui .tajenka-mode .game-board-column>.tajenka-hint-banner:not(.hidden){
          grid-row:4!important;
          display:block!important;
          align-self:start!important;
          justify-self:stretch!important;
          min-width:0!important;
          min-height:0!important;
          height:auto!important;
          max-height:none!important;
          margin:0!important;
          padding:7px 9px!important;
          white-space:normal!important;
          overflow:visible!important;
        }
        html.tiskarna-ui .tajenka-mode .tajenka-hint-banner-polished:not(.hidden){
          color:#397f69!important;
          font-size:15px!important;
          line-height:1.35!important;
          font-weight:850!important;
          letter-spacing:0!important;
          background:color-mix(in srgb,#55cfa7 10%,var(--paper))!important;
          border:1px solid color-mix(in srgb,#55cfa7 38%,var(--line))!important;
          border-radius:9px!important;
        }
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.board-stage,
        html.tiskarna-ui .tajenka-mode .game-board-column>.board-stage{
          grid-row:5!important;
          min-height:0!important;
        }
      }
    `;
    document.head.appendChild(style);

    let syntheticResize=false;
    let settleTimers=[];

    const refit=()=>{
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        try{if(typeof fitGameBoard==='function')fitGameBoard()}catch{}
        try{if(typeof drawPaths==='function')drawPaths()}catch{}
      }));
    };

    const settledPass=()=>{
      if(!document.body.classList.contains('playing'))return;
      syntheticResize=true;
      try{window.dispatchEvent(new Event('resize'))}finally{syntheticResize=false}
      refit();
    };

    const scheduleSettledPasses=()=>{
      if(syntheticResize)return;
      settleTimers.forEach(clearTimeout);
      settleTimers=[120,480].map(ms=>setTimeout(settledPass,ms));
    };

    window.addEventListener('resize',scheduleSettledPasses,{passive:true});
    window.addEventListener('orientationchange',scheduleSettledPasses,{passive:true});
    window.visualViewport?.addEventListener?.('resize',scheduleSettledPasses,{passive:true});
    screen.orientation?.addEventListener?.('change',scheduleSettledPasses);
    navigator.devicePosture?.addEventListener?.('change',scheduleSettledPasses);
  }

  function run(){
    queued=false;
    polishWeeklyBanner();
    polishCard(q('#tajenkaPreviewCard'));
    polishCard(q('#tajenkaPlayCard'));
    polishResult();
    polishHintBanner();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(run);
  }

  function install(){
    installMobileLayoutGuard();
    run();
    const daily=q('#screen-daily');
    const free=q('#screen-free');
    const modal=q('#winModal');
    const game=q('#screen-game');
    const observer=new MutationObserver(queue);
    if(daily)observer.observe(daily,{childList:true,subtree:true});
    if(free)observer.observe(free,{childList:true,subtree:true});
    if(modal)observer.observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    if(game)observer.observe(game,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();