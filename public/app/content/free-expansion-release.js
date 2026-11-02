/* The new finite bank has its own receipt; Patron and November timing stay server-owned. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document)root.PropletFreeExpansionRelease=api.install(root);
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const id='free-expansion-600-20261102';
  const series=[
    ['easy','Snadná','easy.webp'],['medium','Střední','medium.webp'],['hard','Těžká','hard.webp'],
    ['hardcore','Mozkožrout','hardcore.webp'],['mozkomor','Mozkomor','mozkomor.webp'],
    ['mozkokalypsa','Mozkokalypsa','mozkokalypsa-series-ochre.svg']
  ];
  function install(root){
    const doc=root.document;
    let ready=!!root.__PROPLET_CURRENT_UI_READY,registered=false,dialog=null,opener=null;
    const queue=()=>root.PropletAnnouncements;
    const bank=()=>{try{return typeof puzzleDB!=='undefined'?puzzleDB:root.puzzleDB}catch{return null}};
    const screen=()=>{try{return typeof currentScreen!=='undefined'?currentScreen:root.currentScreen}catch{return ''}};
    function available(){
      const release=bank()?.freeExpansionRelease;
      return release?.batchId===id&&release.totalNewLevels===600
        &&series.every(([difficulty])=>release.newLevelCounts?.[difficulty]===100);
    }
    function clearMoment(){
      return ready&&available()&&!doc.hidden&&!doc.body.classList.contains('playing')
        &&['daily','free'].includes(screen())
        &&!doc.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)');
    }
    function close(restore=true){
      if(dialog?.open)dialog.close();
      if(restore&&opener?.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});
      opener=null;
    }
    function mount(){
      if(dialog)return;
      dialog=doc.createElement('dialog');dialog.id='freeExpansionRelease';
      dialog.setAttribute('aria-labelledby','freeExpansionTitle');
      dialog.setAttribute('aria-describedby','freeExpansionCopy');
      dialog.innerHTML='<button type="button" class="expansion-close" data-expansion-close aria-label="Zavřít oznámení">×</button>'
        +'<h2 id="freeExpansionTitle" tabindex="-1">600 nových úrovní</h2>'
        +'<p id="freeExpansionCopy">Po 100 v každé obtížnosti.</p>'
        +'<ul class="expansion-series">'+series.map(([difficulty,label,image])=>
          '<li class="expansion-series-card '+difficulty+'"><img src="/difficulty/printshop/'+image+'" width="64" height="64" alt=""><strong>'+label+'</strong></li>').join('')+'</ul>'
        +'<button type="button" class="expansion-play" data-expansion-play>Vybrat si hru <span aria-hidden="true">→</span></button>'
        +'<button type="button" class="expansion-later" data-expansion-close>Teď ne</button>';
      doc.body.append(dialog);
      dialog.querySelectorAll('[data-expansion-close]').forEach(button=>button.addEventListener('click',()=>close()));
      dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
      dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
      dialog.querySelector('[data-expansion-play]').addEventListener('click',()=>{
        if(typeof root.nav!=='function')return;
        close(false);root.nav('free',{replace:true});
        doc.querySelector('#difficultyCards [data-play-free]')?.focus({preventScroll:true});
      });
    }
    function show(){
      if(!clearMoment()||typeof root.nav!=='function')return false;
      mount();opener=doc.activeElement===doc.body?null:doc.activeElement;
      dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});return true;
    }
    function register(){
      if(registered||!queue())return;
      registered=true;
      queue().register({id,priority:-30,eligible:()=>clearMoment(),
        show:async({isCurrent})=>{
          if(!isCurrent())return false;
          // Resolve the existing Patron state first. A newly pending thanks or
          // eligible support offer keeps its higher priority in the same queue.
          try{await root.PropletPatrons?.refresh?.()}catch{return false}
          return isCurrent()&&show();
        },close:()=>close(false)});
    }
    function refresh(){register();queue()?.kick()}
    doc.addEventListener('proplet:ready',()=>{ready=true;refresh()},{once:true});
    doc.addEventListener('proplet:content-ready',refresh);
    doc.addEventListener('proplet:account-changed',()=>{close(false);refresh()});
    doc.addEventListener('proplet:screen-changed',()=>{if(!['daily','free'].includes(screen()))close(false);refresh()});
    register();if(ready)refresh();
    return Object.freeze({id,open:()=>{register();if(!show())return false;queue()?.acknowledge(id);return true},close});
  }
  return {id,install};
});
