(()=>{
  'use strict';
  const key='proplet:content-release:g5-r1';
  let ready=false,shown=false,dialog=null;
  const preview=()=>window.PROPLET_RUNTIME_META?.gen5CandidatePreview===true;
  const forced=()=>preview()&&new URLSearchParams(location.search).get('releasePreview')==='1';
  const storage=()=>preview()?sessionStorage:localStorage;
  function available(){
    // Announce only content actually loaded by this client, never just a new shell.
    try{return ['easy','medium','hard','hardcore','mozkomor'].every(d=>
      (puzzleDB.free?.[d]||[]).filter(p=>p.id?.startsWith(`g5-r1-${d}-`)).length===(d==='mozkomor'?50:100));
    }catch{return false}
  }
  function seen(){try{return storage().getItem(key)==='1'}catch{return false}}
  function dismiss(){if(dialog?.open)dialog.close()}
  function mountPreviewPicker(){
    if(!preview()||!available()||document.getElementById('gen5PreviewPicker'))return;
    const cards=document.getElementById('difficultyCards');if(!cards)return;
    const section=document.createElement('section');section.id='gen5PreviewPicker';section.className='gen5-preview-picker';
    section.innerHTML='<h2>Zkoušení nových desek</h2><p>Jen na preview. Výsledky se neposílají do žebříčků.</p><form><label>Obtížnost<select name="difficulty"><option value="easy">Snadná</option><option value="medium">Střední</option><option value="hard">Těžká</option><option value="hardcore">Mozkožrout</option><option value="mozkomor">Mozkomor</option></select></label><label>Nová deska<select name="board"></select></label><button type="submit">Vyzkoušet</button></form><button type="button" class="gen5-preview-reopen">Ukázat oznámení znovu</button>';
    cards.before(section);
    const form=section.querySelector('form'),difficulty=form.elements.difficulty,board=form.elements.board;
    const populate=()=>{board.replaceChildren();const count=difficulty.value==='mozkomor'?50:100;for(let i=1;i<=count;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i} z ${count}`;board.append(option)}};
    difficulty.addEventListener('change',populate);populate();
    form.addEventListener('submit',event=>{event.preventDefault();const id=`g5-r1-${difficulty.value}-${board.value.padStart(3,'0')}`,puzzle=puzzleDB.free[difficulty.value].find(p=>p.id===id);if(puzzle)startGame(puzzle,'free',null)});
    section.querySelector('.gen5-preview-reopen').addEventListener('click',()=>{if(openTransientModal())return;mount();document.documentElement.classList.add('content-release-open');dialog.showModal()});
  }
  function mount(){
    if(dialog)return;
    dialog=document.createElement('dialog');
    dialog.id='contentReleaseModal';dialog.className='content-release';
    dialog.setAttribute('aria-labelledby','contentReleaseTitle');
    dialog.setAttribute('aria-describedby','contentReleaseSummary');
    dialog.innerHTML=`<button type="button" class="content-release-close" aria-label="Zavřít novinky">×</button>
      <h2 id="contentReleaseTitle" tabindex="-1" autofocus>Tolik slov.<br>Tolik nových výzev.</h2>
      <div class="content-release-hero">
        <div class="content-release-board" aria-hidden="true">
          <span class="release-tile release-found release-right">N</span><span class="release-tile release-found release-down">O</span><span class="release-tile release-unused">A</span>
          <span class="release-tile release-unused">R</span><span class="release-tile release-found release-right">V</span><span class="release-tile release-found">É</span>
        </div>
        <p class="content-release-total"><strong>400</strong><span>nových desek<br>pro všechny</span></p>
      </div>
      <p id="contentReleaseSummary" class="content-release-summary">Od pohodového luštění<br>po pořádné lámání hlavy.</p>
      <div class="content-release-extra">
        <img src="/difficulty/printshop/mozkomor.webp" width="72" height="72" alt="" aria-hidden="true">
        <div><h3><strong>+50</strong> Mozkomorů</h3><p>Pro ty nejlepší propletače.<br><b>Troufneš si?</b></p></div>
      </div>
      <button type="button" class="content-release-play">Jdu hrát <span aria-hidden="true">→</span></button>`;
    document.body.append(dialog);
    dialog.querySelector('.content-release-close').addEventListener('click',dismiss);
    dialog.querySelector('.content-release-play').addEventListener('click',()=>{dismiss();nav('free')});
    dialog.addEventListener('close',()=>{
      document.documentElement.classList.remove('content-release-open');
      try{storage().setItem(key,'1')}catch{}
    });
  }
  function maybeShow(){
    if(!ready||shown||document.hidden||!available()||(!forced()&&seen()))return;
    if(!['daily','free'].includes(currentScreen)||openTransientModal()||document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)'))return;
    mount();shown=true;document.documentElement.classList.add('content-release-open');dialog.showModal();
  }
  window.PropletContentRelease=Object.freeze({close:dismiss});
  document.addEventListener('proplet:ready',()=>{ready=true;mountPreviewPicker();maybeShow()});
  document.addEventListener('proplet:screen-changed',()=>{if(ready)setTimeout(maybeShow,0)});
  document.addEventListener('visibilitychange',maybeShow);
})();
