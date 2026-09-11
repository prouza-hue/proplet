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
    if(!button)return;
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

  function run(){
    queued=false;
    polishCard(q('#tajenkaPreviewCard'));
    polishCard(q('#tajenkaPlayCard'));
    polishResult();
  }

  function queue(){
    if(queued)return;
    queued=true;
    queueMicrotask(run);
  }

  function install(){
    run();
    const daily=q('#screen-daily');
    const free=q('#screen-free');
    const modal=q('#winModal');
    const observer=new MutationObserver(queue);
    if(daily)observer.observe(daily,{childList:true,subtree:true,characterData:true});
    if(free)observer.observe(free,{childList:true,subtree:true,characterData:true});
    if(modal)observer.observe(modal,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
