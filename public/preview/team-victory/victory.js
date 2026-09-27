(() => {
  'use strict';
  const asset = name => `/preview/team-victory/assets/${name}.webp`;
  const medal = '/preview/team-victory/assets/daily-gold.svg';
  const milestones=[['first-imprint','První otisk',1],['golden-party','Zlatá parta',5],['workshop-masters','Mistři dílny',15],['proplet-legend','Legenda Propletu',30]];
  const params=new URLSearchParams(location.search);
  let countTimer,dialog,returnFocus,earned=true;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function close(){clearTimeout(countTimer);dialog.close();document.body.classList.remove('tv-modal-open');returnFocus?.focus();}
  function open(kind){
    clearTimeout(countTimer);returnFocus=document.activeElement;
    if(dialog.open)dialog.close();
    document.querySelectorAll('.modal:not(.hidden)').forEach(el=>el.classList.add('hidden'));
    if(typeof nav==='function')nav('daily');
    dialog.innerHTML=kind==='cabinet'?cabinet():celebration();
    dialog.setAttribute('aria-labelledby',kind==='cabinet'?'tvCabinetTitle':'tvTitle');
    dialog.querySelector('[data-tv-close]').onclick=close;
    dialog.querySelectorAll('[data-tv-action]').forEach(b=>b.onclick=()=>action(b.dataset.tvAction));
    dialog.showModal();dialog.querySelector('[data-tv-close]').focus({preventScroll:true});
    if(kind==='celebration'){
      dialog.querySelector('.tv-celebration').classList.toggle('tv-animating',!reduced());
      const counter=dialog.querySelector('.tv-number');counter.textContent=reduced()?'1':'0';
      if(!reduced())countTimer=setTimeout(()=>{if(dialog.open&&dialog.querySelector('.tv-number')){counter.textContent='1';counter.classList.add('tv-count-in');dialog.querySelector('#tvCountStatus').textContent='1 zlato ve společné vitríně.';}},850);
    }
  }
  function action(which){if(which==='cabinet')open('cabinet');else if(which==='replay'){earned=true;setReminder(true);open('celebration')}else close()}
  function celebration(){return `<section class="tv-celebration"><button class="tv-close" data-tv-close aria-label="Zavřít oslavu">×</button><div class="tv-kicker"><img src="${medal}" alt="">1. místo v týmových XP</div><h1 id="tvTitle">Kupkovi,<br>včera to bylo vaše!</h1><div class="tv-stage"><img class="tv-badge-hero" src="${asset('first-imprint')}" alt="První otisk — nový týmový odznak" width="184" height="184"></div><h2 class="tv-award-name">První otisk</h2><p class="tv-subline">První zlato do vaší vitríny.</p><div class="tv-score"><img src="${medal}" alt=""><span class="tv-number" aria-hidden="true">1</span><span class="tv-score-label">zlato ve společné vitríně</span><span id="tvCountStatus" class="sr-only" role="status" aria-live="polite">${reduced()?'1 zlato ve společné vitríně.':''}</span></div><div class="tv-goal"><img src="${asset('golden-party')}" alt=""><div class="tv-goal-body"><p>Ještě <strong>4 vítězství</strong> do trofeje<br><strong>Zlatá parta.</strong></p><div class="tv-progress" role="progressbar" aria-label="Zlatá parta" aria-valuemin="0" aria-valuemax="5" aria-valuenow="1"><span></span></div></div></div><div class="tv-actions"><button class="tv-primary" data-tv-action="continue">Jdeme pro další</button><button class="tv-secondary" data-tv-action="cabinet">Vitrína týmu</button></div><p class="tv-simulation">Simulace · vítězství 27. 9. 2026</p></section>`}
  function cabinet(){return `<section class="tv-cabinet"><button class="tv-close" data-tv-close aria-label="Zavřít vitrínu">×</button><h2 id="tvCabinetTitle">Vitrína týmu</h2><p class="tv-subline">Kupkovi</p><div class="tv-cabinet-total"><img src="${medal}" alt="Denní týmové zlato"><div><strong>1 zlato</strong><small>Za vítězství v denních týmových XP</small></div></div><ol class="tv-milestones">${milestones.map(([key,name,target],i)=>`<li class="tv-milestone"><img src="${asset(key)}" class="${i?'tv-locked':''}" alt="${name}${i?', zamčeno':''}"><div><strong>${name}</strong>${i?`<small>${target} týmových vítězství</small><div class="tv-progress"><span style="width:${100/target}%"></span></div>`:'<small class="tv-earned">Získáno · 27. 9. 2026</small>'}</div><span>${i?`1 / ${target}<br><span class="tv-lock" aria-label="Zamčeno"></span>`:'✓'}</span></li>`).join('')}</ol><button class="tv-primary" data-tv-action="continue" style="width:100%">Zpátky do hry</button><p class="tv-simulation">Simulace · pracovní názvy a milníky</p><div class="tv-preview-only"><small>Nástroj preview</small><button data-tv-action="replay">↻ Přehrát oslavu znovu</button></div></section>`}
  function setReminder(show){const button=document.getElementById('tvReminder');if(button)button.hidden=!show;}
  function setup(){
    if(document.getElementById('tvRewardDialog'))return;
    const daily=document.getElementById('screen-daily');if(!daily)return;
    dialog=document.createElement('dialog');dialog.id='tvRewardDialog';dialog.className='tv-dialog';document.body.append(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
    dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)close()}});
    const reminder=document.createElement('button');reminder.id='tvReminder';reminder.className='tv-reminder';reminder.innerHTML=`<img src="${asset('first-imprint')}" alt=""><span>Včerejší vítězové · Kupkovi</span><span aria-hidden="true">›</span>`;reminder.onclick=()=>open('cabinet');daily.prepend(reminder);
    const note=document.createElement('p');note.className='tv-demo-note';note.textContent='Simulace · pondělí 28. 9. 2026';document.querySelector('.app-header').insertAdjacentElement('afterend',note);
    const bar=document.createElement('aside');bar.className='tv-preview-bar';bar.setAttribute('aria-label','Nástroje preview');bar.innerHTML='<span>PREVIEW</span><button data-tv-action="replay" aria-label="Přehrát oslavu znovu">↻ Přehrát znovu</button><a href="/preview/team-victory/gallery.html">Odznaky</a>';bar.querySelector('button').onclick=()=>action('replay');document.body.append(bar);
    window.addEventListener('message',e=>{if(e.origin!==location.origin||!e.data?.propletPreview)return;const a=e.data.action;if(a==='baseline'){closeIfOpen();earned=false;setReminder(false);}else if(a==='after'){closeIfOpen();earned=true;setReminder(true)}else action(a);});
    function closeIfOpen(){if(dialog.open)close();if(typeof nav==='function')nav('daily');}
    if(params.get('baseline')==='1'){earned=false;setReminder(false)}
    else if(params.get('state')==='cabinet')setTimeout(()=>open('cabinet'),1100);
    else if(params.get('state')!=='after')setTimeout(()=>open('celebration'),1100);
    document.documentElement.dataset.victoryPreviewReady='true';
  }
  document.addEventListener('proplet:ready',setup,{once:true});
  // No polling, no persistent animation, and no write when a dialog is replayed.
})();
