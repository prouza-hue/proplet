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
    /* Runtime polish owns level-1 hint presentation. Never flatten its SVG
       markup and never reserve permanent board space for a hint. */
    if(window.__PROPLET_TAJENKA_RUNTIME_POLISH__)return;
    const banner=q('#tajenkaHintBanner');
    if(banner)banner.classList.add('hidden');
  }

  /* Fold stability guard only. Tajenka's canonical board column stays four rows:
     remaining words, current word, progressive Tajenka, board. Semantic hints do
     not get a fifth permanent row; phone uses a transient toast instead. */
  function installMobileLayoutGuard(){
    if(window.__PROPLET_TAJENKA_MOBILE_LAYOUT_GUARD__)return;
    window.__PROPLET_TAJENKA_MOBILE_LAYOUT_GUARD__=true;

    const style=document.createElement('style');
    style.id='tajenkaMobileLayoutGuardStyle';
    style.textContent=`
      @media(max-width:600px){
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column,
        html.tiskarna-ui .tajenka-mode .game-board-column{
          grid-template-rows:auto auto auto minmax(0,1fr)!important;
        }
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.tajenka-phrase,
        html.tiskarna-ui .tajenka-mode .game-board-column>.tajenka-phrase{
          grid-row:3!important;
        }
        html.tiskarna-ui #screen-game.tajenka-mode .game-board-column>.board-stage,
        html.tiskarna-ui .tajenka-mode .game-board-column>.board-stage{
          grid-row:4!important;
          min-height:0!important;
        }
        html.tiskarna-ui #screen-game.tajenka-mode #tajenkaHintBanner{
          display:none!important;
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