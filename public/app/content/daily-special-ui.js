(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletDailySpecialUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const specials={2:'hardcore',4:'mozkomor',6:'mozkokalypsa'};
  const weekdayLabels=['Po','Út','St','Čt','Pá','So','Ne'];
  const baseDifficulties=['easy','easy','medium','medium','medium','hard','hard'];
  const icons={hardcore:'hardcore.webp',mozkomor:'mozkomor.webp',mozkokalypsa:'mozkokalypsa-series-ochre.svg'};
  const icon=diff=>'/difficulty/printshop/'+(icons[diff]||diff+'.webp');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function create(deps={}){
    const $=deps.$||((selector)=>document.querySelector(selector));
    let selected='base',day=null,scope=null,dialog=null,dialogReturn=null;
    const introVersion='proplet:daily-extra-intro:v1';
    const introReceipts=new Set();
    let intro=null,introKey=null,introReturn=null,introBackground=[],introOverflow='';
    function current(){try{return deps.dailySpecialResultState?.(deps.pragueDateISO())||{}}catch{return {}}}
    function receiptKey(){const profile=deps.getProfile?.();return introVersion+':'+(profile?.token&&profile?.id?'account:'+profile.id:'guest:'+deps.getAnonymousId?.())}
    function introPending(){
      const special=current(),key=receiptKey();
      if(!special.descriptor||!special.puzzle||special.descriptor.dailyDate!==deps.pragueDateISO()||special.descriptor.rewardEligible===false)return false;
      if(introReceipts.has(key))return false;
      try{return localStorage.getItem(key)!=='1'}catch{return true}
    }
    function closeIntro(restoreFocus=true,remember=true){
      if(!intro||intro.classList.contains('hidden'))return;
      intro.classList.add('hidden');
      if(remember&&introKey){introReceipts.add(introKey);try{localStorage.setItem(introKey,'1')}catch{}}
      for(const [element,inert] of introBackground)element.inert=inert;
      introBackground=[];document.body.style.overflow=introOverflow;
      if(restoreFocus&&introReturn?.isConnected)introReturn.focus({preventScroll:true});
      introKey=null;
    }
    function showIntro({isCurrent}){
      if(!isCurrent()||document.hidden||!deps.canShowIntro?.()||!introPending())return false;
      if(document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)'))return;
      if(!intro){
        intro=document.createElement('div');intro.id='dailyExtraIntro';intro.className='modal daily-extra-intro hidden';
        intro.setAttribute('role','dialog');intro.setAttribute('aria-modal','true');intro.setAttribute('aria-labelledby','dailyExtraIntroTitle');intro.setAttribute('aria-describedby','dailyExtraIntroCopy');
        intro.innerHTML=`<section class="modal-card"><button type="button" class="modal-close" data-extra-close aria-label="Zavřít vysvětlení">×</button><div class="daily-extra-intro-art" aria-hidden="true"><img src="${icon('hardcore')}" width="52" height="52" alt=""><img src="${icon('mozkomor')}" width="52" height="52" alt=""><img src="${icon('mozkokalypsa')}" width="52" height="52" alt=""></div><h2 id="dailyExtraIntroTitle">Dnes je tu i Extra</h2><p id="dailyExtraIntroCopy">Ve středu, v pátek a v neděli přibude těžší deska. Najdeš ji pod tlačítkem <strong>Extra</strong>.</p><p>Je dobrovolná a za první dokončení získáš <strong>100 XP</strong>. Sérii dál udržuje základní Denní výzva.</p><button type="button" class="primary-btn" data-extra-show>Ukázat Extra</button><button type="button" class="text-btn" data-extra-later>Teď ne</button></section>`;
        document.body.append(intro);
        intro.querySelector('[data-extra-close]').onclick=()=>closeIntro();
        intro.querySelector('[data-extra-later]').onclick=()=>closeIntro();
        intro.querySelector('[data-extra-show]').onclick=()=>{closeIntro(false);select('special');$('#dailyChallengeSwitch button')?.focus({preventScroll:true})};
        intro.onclick=e=>{if(e.target===intro)closeIntro()};
        document.addEventListener('keydown',e=>{
          if(intro.classList.contains('hidden'))return;
          if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeIntro();return}
          if(e.key!=='Tab')return;
          const buttons=Array.from(intro.querySelectorAll('button:not([disabled])')),first=buttons[0],last=buttons[buttons.length-1];
          if(e.shiftKey&&(document.activeElement===first||!intro.contains(document.activeElement))){e.preventDefault();last.focus()}
          else if(!e.shiftKey&&(document.activeElement===last||!intro.contains(document.activeElement))){e.preventDefault();first.focus()}
        },true);
      }
      introKey=receiptKey();introReturn=document.activeElement;introOverflow=document.body.style.overflow;
      introBackground=Array.from(document.body.children).filter(el=>el!==intro&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
      for(const [element] of introBackground)element.inert=true;
      document.body.style.overflow='hidden';intro.classList.remove('hidden');
      introReceipts.add(introKey);try{localStorage.setItem(introKey,'1')}catch{}
      intro.querySelector('[data-extra-show]').focus({preventScroll:true});
      return true;
    }
    const announcements=globalThis.PropletAnnouncements;
    announcements?.register({
      id:'daily-extra-v1',priority:80,
      eligible:()=>!globalThis.PropletArchiveExperience?.isEnabled?.()&&!!deps.canShowIntro?.()&&introPending(),
      show:showIntro,close:()=>closeIntro(false,false)
    });
    function scheduleIntro(){announcements?.kick()}
    function select(kind){
      const special=current();
      selected=kind==='special'&&special.descriptor&&special.puzzle?'special':'base';
      deps.renderBase?.();
      render();
    }
    function start(){return selected==='special'?deps.startSpecial?.():deps.startDaily?.()}
    function heading(hero,title,control){
      let row=title.parentElement;
      if(!row.classList.contains('daily-title-choice-row')){
        row=document.createElement('div');row.className='daily-title-choice-row';row.setAttribute('role','group');row.setAttribute('aria-label','Dnešní výzvy');
        title.before(row);row.append(title,control);
      }
      title.dataset.dailySpecialTitle='1';
      let base=title.querySelector('[data-daily-kind="base"]');
      if(!base){base=document.createElement('button');base.type='button';base.className='daily-base-title';base.dataset.dailyKind='base';base.textContent='Denní výzva';title.replaceChildren(base)}
      base.onclick=()=>select('base');base.setAttribute('aria-pressed',String(selected==='base'));
      const button=control.querySelector('[data-daily-kind="special"]');
      if(button)button.onclick=()=>select(selected==='special'?'base':'special');
      return button;
    }
    function markWeek(){
      const rows=deps.getSchedule?.()||[];
      const enabled=Array.isArray(rows)&&rows.length>0;
      const root=$('#dailyWeekRhythm');if(!root)return;
      root.querySelectorAll('.daily-week-day').forEach((cell,index)=>{
        const diff=enabled?specials[index]:null;
        cell.querySelector('.daily-week-special-mark')?.remove();
        cell.classList.toggle('has-daily-special',!!diff);
        if(!diff){cell.removeAttribute('role');cell.removeAttribute('tabindex');cell.onclick=null;cell.onkeydown=null;return}
        const name=deps.DIFF?.[diff]?.label||diff;
        const mark=document.createElement('img');mark.src=icon(diff);mark.className='daily-week-special-mark';mark.alt='';mark.setAttribute('aria-hidden','true');cell.append(mark);
        cell.title=`${weekdayLabels[index]} · ${deps.DIFF?.[baseDifficulties[index]]?.label||''} + ${name}`;
        cell.setAttribute('aria-label',cell.title+' · přehled týdne');cell.setAttribute('role','button');cell.tabIndex=0;
        cell.onclick=()=>openWeek(cell);cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openWeek(cell)}};
      });
    }
    function openWeek(from){
      if(!dialog){
        dialog=document.createElement('div');dialog.id='dailyWeekDialog';dialog.className='modal daily-week-dialog hidden';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','dailyWeekDialogTitle');
        dialog.innerHTML='<div class="modal-card"><h2 id="dailyWeekDialogTitle">Tento týden</h2><div class="daily-week-dialog-list"></div><p class="daily-week-dialog-copy">Základní výzva každý den udržuje sérii. Ve středu, v pátek a v neděli si můžeš přidat ještě jednu — dobrovolně a za 100 XP.</p><button type="button" class="primary-btn" data-close-daily-week>Zpět ke hře</button></div>';
        document.body.append(dialog);dialog.querySelector('[data-close-daily-week]').onclick=closeWeek;
        dialog.onclick=e=>{if(e.target===dialog)closeWeek()};
        dialog.addEventListener('keydown',e=>{
          if(e.key==='Escape'){e.preventDefault();closeWeek()}
          if(e.key==='Tab'){e.preventDefault();dialog.querySelector('[data-close-daily-week]').focus()}
        });
      }
      const date=deps.pragueDateISO(),d=new Date(date+'T12:00:00Z'),active=(d.getUTCDay()+6)%7;
      dialog.querySelector('.daily-week-dialog-list').innerHTML=weekdayLabels.map((label,i)=>{
        const base=baseDifficulties[i],special=specials[i];
        return `<div class="daily-week-dialog-day ${i===active?'today':''}"><b>${label}</b><span><img src="${icon(base)}" alt="">${escape(deps.DIFF?.[base]?.label||base)}</span><span class="${special?'':'daily-week-none'}">${special?`<img src="${icon(special)}" alt="">${escape(deps.DIFF?.[special]?.label||special)}`:'—'}</span></div>`;
      }).join('');
      dialogReturn=from;dialog.classList.remove('hidden');dialog.querySelector('[data-close-daily-week]').focus();
    }
    function closeWeek(){dialog?.classList.add('hidden');dialogReturn?.focus();dialogReturn=null}
    function render(){
      const hero=$('#screen-daily .daily-hero'),title=$('#dailyHeroTitle'),control=$('#dailyChallengeSwitch');
      if(!hero||!title||!control)return {selected};
      const today=deps.pragueDateISO(),identity=deps.getProfile?.()?.id||'anonymous';
      if(today!==day||identity!==scope){selected='base';day=today;scope=identity}
      const special=current(),available=!!special.descriptor&&!!special.puzzle;
      if(!available)selected='base';
      const button=heading(hero,title,control);
      control.classList.toggle('hidden',!available);hero.classList.toggle('has-daily-special',available);hero.classList.toggle('daily-special-selected',selected==='special');
      $('#playDailyBtn')?.classList.remove('daily-special-action');
      if(button){
        button.setAttribute('aria-pressed',String(selected==='special'));
        const name=deps.DIFF?.[special.puzzle?.difficulty]?.label||'Speciál';
        button.setAttribute('aria-label',`${selected==='special'?'Přepnout na základní výzvu':'Přepnout na '+name} · dobrovolně, sérii neovlivní`);
        const image=$('#dailySpecialTabIcon');if(image&&available)image.src=icon(special.puzzle.difficulty);
        const status=$('#dailySpecialTabStatus');if(status)status.textContent=special.active?'✓':special.progress?'•':'';
      }
      markWeek();
      scheduleIntro();
      if(selected!=='special')return {selected};
      const puzzle=special.puzzle,descriptor=special.descriptor,key=descriptor.officialChallengeKey||descriptor.challengeKey;
      $('#dailyMeta').textContent=deps.DIFF?.[puzzle.difficulty]?.label||'Speciál';
      const action=$('#playDailyBtn'),done=!!special.active,progress=!!special.progress;
      if(action){
        action.classList.add('daily-special-action');
        const verb=done?'Zobrazit výsledek speciálu':progress?'Pokračovat ve speciálu':'Hrát '+(puzzle.difficulty==='hardcore'?'Mozkožrouta':puzzle.difficulty==='mozkomor'?'Mozkomora':'Mozkokalypsu');
        action.innerHTML=`<span>${escape(verb)}</span><small>Sérii neovlivní</small>`;
      }
      // Sharing and sync details stay in the result dialog. The optional entry
      // uses precisely the same compact hero rows even after it is completed.
      $('#shareDailyBtn')?.classList.add('hidden');
      const sync=$('#dailySyncStatus');
      if(sync){
        sync.classList.add('hidden');
        if(done){
          const profile=deps.getProfile?.(),queued=(deps.getQueue?.()||[]).some(r=>r.challengeKey===key),state=deps.getSyncState?.()||{};
          sync.textContent=!profile?.token?'📱 Výsledek je uložený jen v tomto zařízení':queued?(state.status==='error'?'⚠️ Výsledek čeká na synchronizaci':'☁️ Výsledek čeká na synchronizaci'):'✓ Výsledek speciálu je v cloudu';
          sync.classList.toggle('home-sync-benign',!queued);
        }
      }
      return {selected};
    }
    return {render,select,start,getState:()=>({selected}),openWeek,closeWeek,introPending,closeIntro};
  }
  return {create};
});
