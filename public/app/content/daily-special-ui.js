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
    let selected='base',explicitSelection=false,day=null,scope=null,previousCompletion=null,dialog=null,dialogReturn=null;
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
        intro.innerHTML=`<section class="modal-card"><button type="button" class="modal-close" data-extra-close aria-label="Zavřít vysvětlení">×</button><div class="daily-extra-intro-art" aria-hidden="true"><img src="${icon('hardcore')}" width="52" height="52" alt=""><img src="${icon('mozkomor')}" width="52" height="52" alt=""><img src="${icon('mozkokalypsa')}" width="52" height="52" alt=""></div><h2 id="dailyExtraIntroTitle">Dnes je tu i Extra</h2><p id="dailyExtraIntroCopy">Ve středu, v pátek a v neděli přibude těžší deska. Najdeš ji na stránce <strong>Dnes</strong>.</p><p>Je dobrovolná a za první dokončení získáš <strong>200 XP</strong>. Sérii dál udržuje základní Denní výzva.</p><button type="button" class="primary-btn" data-extra-show>Ukázat Extra</button><button type="button" class="text-btn" data-extra-later>Teď ne</button></section>`;
        document.body.append(intro);
        intro.querySelector('[data-extra-close]').onclick=()=>closeIntro();
        intro.querySelector('[data-extra-later]').onclick=()=>closeIntro();
        intro.querySelector('[data-extra-show]').onclick=()=>{closeIntro(false);select('special');$('#playDailyBtn')?.focus({preventScroll:true})};
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
    function refreshScope(){
      const today=deps.pragueDateISO(),identity=deps.getProfile?.()?.id||'anonymous';
      if(today!==day||identity!==scope){selected='base';explicitSelection=false;previousCompletion=null;day=today;scope=identity}
    }
    function select(kind){
      refreshScope();
      const special=current();
      selected=kind==='special'&&special.descriptor&&special.puzzle?'special':'base';
      explicitSelection=true;
      deps.renderBase?.();
      render();
    }
    function start(){
      refreshScope();
      if(selected==='special')return deps.startSpecial?.();
      let base=null;try{base=deps.dailyResultState?.(day)}catch{}
      const special=current();
      if(!explicitSelection&&base?.active&&(!special.descriptor||!special.puzzle||special.active)&&deps.openFree)return deps.openFree();
      return deps.startDaily?.();
    }
    function heading(hero,title,control){
      title.dataset.dailySpecialTitle='1';
      const button=control.querySelector('[data-daily-kind="special"]');
      if(button)button.onclick=()=>select(selected==='special'?'base':'special');
      return button;
    }
    function resultCopy(record){
      const parts=[];
      if(Number.isFinite(record?.elapsedMs)&&record.elapsedMs>=0){
        const seconds=Math.floor(record.elapsedMs/1000);
        parts.push(Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
      }
      if(Number.isInteger(record?.moves)&&record.moves>=0)parts.push(record.moves+' '+(record.moves===1?'tah':record.moves>=2&&record.moves<=4?'tahy':'tahů'));
      return parts.join(' · ');
    }
    function renderStudioEntries(base,special,available){
      const root=$('#screen-daily');if(!root)return;
      let extra=$('#studioExtraCard');
      if(available&&selected==='base'){
        if(!extra){
          extra=document.createElement('section');extra.id='studioExtraCard';extra.className='studio-secondary-game';
          extra.innerHTML='<div class="studio-extra-copy"><h2>Extra</h2><p></p></div><img width="92" height="104" alt=""><button type="button" class="text-btn"></button>';
          root.append(extra);
        }
        extra.hidden=false;
        extra.querySelector('p').textContent=(deps.DIFF?.[special.puzzle.difficulty]?.label||'Extra')+' · '+(special.active?'Dokončeno':special.descriptor.rewardEligible===false?'Trénink':'+200 XP');
        extra.querySelector('img').src=icon(special.puzzle.difficulty);
        const action=extra.querySelector('button');
        action.textContent=special.active?'Zobrazit výsledek':special.progress?'Pokračovat v Extra':'Hrát Extra';
        action.onclick=()=>{select('special');start()};
      }else if(extra)extra.hidden=true;
      let result=$('#studioDailyResult');
      if(base?.active){
        if(!result){
          result=document.createElement('section');result.id='studioDailyResult';result.className='studio-daily-result';
          result.innerHTML='<div><strong>Denní výzva splněna</strong><p class="studio-result-metrics"></p><p class="studio-result-sync" role="status"></p></div><button type="button" class="text-btn">Výsledek</button>';
          root.append(result);
        }
        result.hidden=false;result.querySelector('.studio-result-metrics').textContent=resultCopy(base.active);
        const queued=(deps.getQueue?.()||[]).some(row=>row.challengeKey==='daily:'+day),sync=deps.getSyncState?.()||{},status=result.querySelector('.studio-result-sync');
        status.textContent=queued?(sync.status==='error'?'Výsledek čeká na synchronizaci: '+(sync.error||'zkus to znovu'):'Výsledek čeká na synchronizaci'):!deps.getProfile?.()?.token?'Výsledek je uložený v tomto zařízení':'';
        status.hidden=!status.textContent;result.classList.toggle('studio-sync-error',queued&&sync.status==='error');
        result.querySelector('button').onclick=()=>deps.startDaily?.();
      }else if(result)result.hidden=true;
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
        dialog.innerHTML='<div class="modal-card"><h2 id="dailyWeekDialogTitle">Tento týden</h2><div class="daily-week-dialog-list"></div><p class="daily-week-dialog-copy">Základní výzva každý den udržuje sérii. Ve středu, v pátek a v neděli si můžeš přidat ještě jednu — dobrovolně a za 200 XP.</p><button type="button" class="primary-btn" data-close-daily-week>Zpět ke hře</button></div>';
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
      refreshScope();
      const special=current(),available=!!special.descriptor&&!!special.puzzle;
      let base=null;try{base=deps.dailyResultState?.(day)||null}catch{}
      const completion={base:!!base?.active,special:!!special.active};
      if(previousCompletion&&((!previousCompletion.base&&completion.base)||(!previousCompletion.special&&completion.special)))explicitSelection=false;
      previousCompletion=completion;
      if(!explicitSelection)selected=base?.active&&available&&!special.active?'special':'base';
      if(!available)selected='base';
      const button=heading(hero,title,control);
      control.classList.toggle('hidden',!available||selected==='base'||!!base?.active);hero.classList.toggle('has-daily-special',available);hero.classList.toggle('daily-special-selected',selected==='special');
      hero.dataset.studioState=base?.active?(available&&!special.active?'done':'complete'):'before';
      title.textContent=selected==='special'?(deps.DIFF?.[special.puzzle.difficulty]?.label||'Extra'):'Denní výzva';
      const art=$('#studioDailyArt');if(art)art.src=selected==='special'?icon(special.puzzle.difficulty):'/rewards/printshop/symbol-daily.svg';
      if(selected==='base'&&base?.puzzle){
        $('#dailyMeta').textContent=(deps.DIFF?.[base.puzzle.difficulty]?.label||'')+(base.legacy?'':base.active?' · Dokončeno':' · +100 XP');
        if(base.active&&!explicitSelection&&(!available||special.active)&&deps.openFree){
          title.textContent=available?'Dnešní výzvy splněny':'Denní výzva splněna';
          $('#playDailyBtn').textContent='Vybrat volnou hru';
        }
      }
      $('#playDailyBtn')?.classList.remove('daily-special-action');
      if(button){
        button.removeAttribute('aria-pressed');
        button.setAttribute('aria-label','Zpět na základní Denní výzvu');
        button.textContent='Denní výzva';
      }
      renderStudioEntries(base,special,available);
      markWeek();
      scheduleIntro();
      if(selected!=='special')return {selected};
      const puzzle=special.puzzle,descriptor=special.descriptor,key=descriptor.officialChallengeKey||descriptor.challengeKey;
      $('#dailyMeta').textContent='Extra · dobrovolná'+(descriptor.rewardEligible===false?' · trénink':' · +200 XP');
      const action=$('#playDailyBtn'),done=!!special.active,progress=!!special.progress;
      if(action){
        action.classList.add('daily-special-action');
        const verb=done?'Zobrazit výsledek speciálu':progress?'Pokračovat ve speciálu':'Hrát '+(puzzle.difficulty==='hardcore'?'Mozkožrouta':puzzle.difficulty==='mozkomor'?'Mozkomora':'Mozkokalypsu');
        action.innerHTML=`<span>${escape(verb)}</span>`;
      }
      // The completed base keeps its own summary and sync status when Extra is promoted.
      $('#shareDailyBtn')?.classList.add('hidden');
      const sync=$('#dailySyncStatus');
      if(sync){
        sync.classList.add('hidden');
        if(done){
          const profile=deps.getProfile?.(),queued=(deps.getQueue?.()||[]).some(r=>r.challengeKey===key),state=deps.getSyncState?.()||{};
          sync.textContent=!profile?.token?'📱 Výsledek je uložený jen v tomto zařízení':queued?(state.status==='error'?'⚠️ Výsledek čeká na synchronizaci':'☁️ Výsledek čeká na synchronizaci'):'✓ Výsledek speciálu je v cloudu';
          sync.classList.toggle('home-sync-benign',!queued);
          sync.classList.toggle('hidden',!queued);
        }
      }
      return {selected};
    }
    return {render,select,start,getState:()=>({selected}),openWeek,closeWeek,introPending,closeIntro};
  }
  return {create};
});
