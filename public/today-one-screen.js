/* A separate presentation experiment. Every action delegates to its canonical
   Proplet control; this module never starts sessions or changes player data. */
(()=>{
 'use strict';
 const q=s=>document.querySelector(s),visible=e=>!!e&&!e.hidden&&!e.classList.contains('hidden');
 const text=e=>(e?.textContent||'').replace(/\s+/g,' ').trim();
 const separatedText=e=>e?.children.length?[...e.children].map(text).filter(Boolean).join(' '):text(e);
 const icon=e=>e?.querySelector('img')?.getAttribute('src')||'';
 const make=(tag,cls,copy)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(copy)e.textContent=copy;return e;};
 const unavailable=(control,needsProgress=false)=>!control||!!control.disabled||!!control.closest('[inert],[aria-busy="true"]')||(needsProgress&&document.body.classList.contains('account-progress-pending'));
 const run=(selector,needsProgress=false)=>{const control=q(selector);if(!unavailable(control,needsProgress))control.click();};
 let ready=false,raf=0,root=null,featureSlot,weekSlot,grid,notices;
 const buttons=new Map();
 function mount(){
  const screen=q('#screen-daily');if(!screen)return false;
  if(root?.isConnected)return true;
  root=make('div','os-today');root.id='oneScreenToday';
  root.append(make('h1','os-sr','Dnes'));
  const main=make('div','os-main');featureSlot=make('div','os-feature-slot');weekSlot=make('div','os-week-slot');
  main.append(featureSlot,weekSlot);grid=make('div','os-grid');grid.setAttribute('aria-label','Další hry');notices=make('div','os-notices');
  const recovery=q('#tajenkaRecoveryNotice');if(recovery)root.append(recovery);
  root.append(main,grid,notices);screen.append(root);return true;
 }
 function reward(e){return text(e?.querySelector('.studio-xp,.tajenka-entry-reward'));}
 function read(){
  const hero=q('#screen-daily .daily-hero'),play=q('#playDailyBtn');if(!hero||!play)return null;
  const complete=hero.dataset.studioState==='complete'&&!hero.classList.contains('daily-special-selected');
  const daily=q('#studioDailyResult'),hasDaily=visible(daily),special=hero.classList.contains('daily-special-selected');
  const mainAction=complete&&hasDaily?'#studioDailyResult button':'#playDailyBtn';
  const target=q(mainAction),style=getComputedStyle(hero);
  const shortAction=complete||/výsledek/i.test(text(play))?'Výsledek':/pokračovat/i.test(text(play))?'Pokračovat':/načíst|zkusit/i.test(text(play))?'Zkusit znovu':'Hrát';
  const metrics=text(daily?.querySelector('.studio-result-metrics'));
  const meta=q('#dailyMeta'),metaDetails=meta?.children.length?[...meta.children].filter(e=>!e.classList.contains('studio-xp')).map(text).join(' · '):text(meta);
  const feature={key:'feature',title:text(q('#dailyHeroTitle'))||'Denní výzva',art:q('#studioDailyArt')?.getAttribute('src'),
   detail:complete?'✓ Hotovo':metaDetails,metrics:complete?metrics:'',
   reward:complete?'':reward(q('#dailyMeta')),action:shortAction,target:mainAction,disabled:!target||!!target.disabled,
   label:complete?'Denní výzva. Zobrazit výsledek. '+metrics:text(play),complete,special,
   colors:['--feature','--feature-ink','--feature-muted','--feature-action'].map(k=>style.getPropertyValue(k).trim())};
  feature.label=[feature.title,feature.detail,feature.metrics,feature.reward,complete?'Zobrazit výsledek':text(play)].filter(Boolean).join('. ');
  const tiles=[];
  if(special&&hasDaily)tiles.push({key:'daily-result',title:'Denní',detail:'✓ '+(metrics.split(' · ')[0]||'Hotovo'),art:'/rewards/printshop/symbol-daily.svg',target:'#studioDailyResult button',label:'Zobrazit výsledek Denní výzvy. '+metrics,kind:'daily-done'});
  else if(special)tiles.push({key:'daily-base',title:'Denní',detail:'Základní výzva',art:'/rewards/printshop/symbol-daily.svg',target:'#playDailyBtn',label:'Otevřít základní Denní výzvu',kind:'daily-choice'});
  const extra=q('#studioExtraCard'),tajenka=q('#tajenkaPreviewCard');
  if(visible(extra)){const detail=reward(extra)?'':text(extra.querySelector('p')?.lastElementChild);tiles.push({key:'extra',title:'Extra',detail:/^(?:✓\s*)?(?:Hotovo|Dokončeno)$/i.test(detail)?'✓ Hotovo':detail,reward:reward(extra),art:icon(extra),target:'#studioExtraCard>button',label:'Extra. '+separatedText(extra.querySelector('p'))+'. '+text(extra.querySelector('button')),kind:'extra'});}
  if(visible(tajenka)){
   const done=tajenka.classList.contains('completed');
   const target=done?'#tajenkaPreviewCard [data-tajenka-recap]':'#tajenkaPreviewBtn';
   tiles.push({key:'tajenka',title:'Tajenka',detail:done?'✓ Hotovo':/pokračovat/i.test(text(q(target)))?'Rozehráno':'',reward:done?'':reward(tajenka),art:icon(tajenka)||'/tajenka.svg',target,label:'Tajenka. '+text(q(target)),kind:'tajenka'});
  }
  const archiveResume=q('#axArchiveResume'),freeResume=q('#homeResumeCard');
  const resume=visible(archiveResume)?archiveResume:visible(freeResume)?freeResume:null;
  const difficultyCount=document.querySelectorAll('#difficultyCards [data-play-free]').length;
  const free={key:'free',title:resume?'Rozehráno':'Volná hra',detail:resume?text(resume.querySelector('strong')).replace(/^Rozehráno:\s*/,'').replace(/^Rozehráno v Archivu\s*·?\s*/,'Archiv · '):difficultyCount?difficultyCount+' obtížností':'',art:resume?icon(resume):'/difficulty/printshop/easy.webp',target:resume?'#'+resume.id:q('#axHomeFree .ax-card-action')?'#axHomeFree .ax-card-action':'.bottom-nav [data-nav="free"]',label:resume?text(resume):'Volná hra. Vybrat obtížnost.',kind:complete?'free next':'free'};
  complete?tiles.unshift(free):tiles.push(free);
  tiles.push({key:'team',title:'Soutěže',detail:'Týdenní · měsíční',art:'/assets/navigation/competitions-v1.webp',target:'.bottom-nav [data-nav="leaderboard"]',label:'Otevřít soutěže. Týdenní a měsíční soutěž.',kind:'team'});
  if(tiles.length<4&&q('#axPlayArchive [data-archive-action="open"]'))tiles.push({key:'archive',title:'Archiv',detail:'800 desek',art:'/assets/archive/archive-letterpress-v2.webp',target:'#axPlayArchive [data-archive-action="open"]',label:'Archiv Propletu. Vybrat z 800 desek.',kind:'archive'});
  const week=[...document.querySelectorAll('#dailyWeekRhythm .daily-week-day')].map(e=>({day:text(e.querySelector('b')),art:e.querySelector('.daily-week-icon')?.getAttribute('src'),extra:e.querySelector('.daily-week-special-mark')?.getAttribute('src'),active:e.classList.contains('active')}));
  const pending=[];
  for(const s of ['#dailySyncStatus','#studioDailyResult .studio-result-sync']){
   const e=q(s);if(visible(e)&&!e.classList.contains('home-sync-benign')&&text(e)&&!/bezpečně v cloudu|je v cloudu/.test(text(e)))pending.push({key:'sync-'+s,text:text(e)});
  }
  const referral=q('#referralHome');
  if(visible(referral)){
   const progress=text(referral.querySelector('.ref-progress-caption strong'));
   const accept=referral.querySelector('[data-ref-accept]');
   pending.push({key:'referral',title:referral.classList.contains('ref-paid')?'Bonus +1 000 XP':progress?'Pozvánka · '+progress:text(referral.querySelector('h2')),target:accept?'#referralHome [data-ref-accept]':referral.querySelector('[data-ref-play]')?'#referralHome [data-ref-play]':'.bottom-nav [data-nav="profile"]'});
  }
  if(visible(q('#rescueCard')))pending.push({key:'rescue',title:text(q('#rescueTitle'))||'Zachránit sérii',target:'#rescueBtn'});
  if(visible(q('#mozkokalypsaInvite')))pending.push({key:'playtest',title:text(q('#mkInviteTitle')),target:'#mkInviteButton'});
  // Keep the canonical recovery notice and its retry/login listeners. Hydration
  // readiness is separate from whether a game button itself has disabled set.
  return {feature,tiles,week,pending,accountNotice:q('#screen-daily .account-progress-status')};
 }
 function image(src,cls){const img=make('img',cls);img.src=src;img.alt='';img.draggable=false;img.width=72;img.height=72;return img;}
 function button(model,cls){
  const needsProgress=['feature','extra','tajenka','daily-result','daily-base'].includes(model.key)||(model.key==='free'&&/^#(?:homeResumeCard|axArchiveResume)$/.test(model.target));
  model={...model,disabled:!!model.disabled||unavailable(q(model.target),needsProgress)};
  let e=buttons.get(model.key);if(!e){e=make('button');e.type='button';e.dataset.osKey=model.key;buttons.set(model.key,e);}
  const signature=JSON.stringify(model);
  if(e.dataset.signature!==signature){
   e.className=cls+(model.kind?' os-'+model.kind.replace(/ /g,' os-'):'');e.disabled=!!model.disabled;
   let label=model.label||model.title;for(const detail of [model.detail,model.reward])if(detail&&!label.includes(detail))label+='. '+detail;
   e.setAttribute('aria-label',label);e.onclick=()=>{if(unavailable(q(model.target),needsProgress))return;if(model.key==='daily-base'){const ui=typeof dailySpecialUI==='function'?dailySpecialUI():null;if(!ui)return;ui.select('base');}run(model.target,needsProgress);};
   const copy=make('span','os-copy');copy.append(make('strong','os-title',model.title));
   if(model.detail)copy.append(make('span','os-detail',model.detail));
   if(model.reward)copy.append(make('span','os-reward',model.reward));
   const children=[copy];if(model.art)children.push(image(model.art,'os-art'));
   const arrow=make('span','os-arrow',model.action?model.action+' →':'→');arrow.setAttribute('aria-hidden','true');
   if(model.complete){const result=make('span','os-completion-row');if(model.metrics)result.append(make('span','os-metrics',model.metrics));result.append(arrow);children.push(result);}else children.push(arrow);
   e.replaceChildren(...children);
   if(model.colors)model.colors.forEach((v,i)=>e.style.setProperty(['--os-feature','--os-ink','--os-muted','--os-action'][i],v));
   e.classList.toggle('os-complete',!!model.complete);e.classList.toggle('os-special',!!model.special);e.dataset.signature=signature;
  }
  return e;
 }
 function reconcile(parent,items){
  for(const child of [...parent.children])if(!items.includes(child))child.remove();
  items.forEach((child,index)=>{if(parent.children[index]!==child)parent.insertBefore(child,parent.children[index]||null);});
 }
 let weekSignature='';
 function update(){
  raf=0;if(!ready)return;
  const model=read();if(!model||!mount())return;
  reconcile(featureSlot,[button(model.feature,'os-feature')]);
  reconcile(grid,model.tiles.map(t=>button(t,'os-tile')));
  const ws=JSON.stringify(model.week);
  if(ws!==weekSignature){
   weekSignature=ws;weekSlot.replaceChildren();
   if(model.week.length){const week=make('button','os-week');week.type='button';week.setAttribute('aria-label','Týdenní rozvrh výzev. Otevřít přehled.');week.onclick=()=>{if(unavailable(q('#dailyWeekRhythm [role="button"]')))return;const ui=typeof dailySpecialUI==='function'?dailySpecialUI():null;if(ui?.openWeek)ui.openWeek(week);else run('#dailyWeekRhythm [role="button"]');};week.disabled=!q('#dailyWeekRhythm [role="button"]');
    for(const d of model.week){const day=make('span','os-day'+(d.active?' current':''));if(d.active)day.setAttribute('aria-current','date');day.append(make('b','',d.day));const icons=make('span','os-day-icons');if(d.art)icons.append(image(d.art,''));if(d.extra)icons.append(image(d.extra,''));day.append(icons);week.append(day);}const active=model.week.find(d=>d.active);if(active)week.setAttribute('aria-label','Týdenní rozvrh výzev. Dnes '+active.day+'. Otevřít přehled.');weekSlot.append(week);
   }
  }
  const weekButton=weekSlot.querySelector('button');if(weekButton)weekButton.disabled=unavailable(q('#dailyWeekRhythm [role="button"]'));
  const alerts=model.pending.map(n=>{if(n.target)return button(n,'os-notice');let e=buttons.get(n.key);if(!e){e=make('p','os-sync');e.setAttribute('role','status');buttons.set(n.key,e);}if(e.textContent!==n.text)e.textContent=n.text;return e;});
  if(model.accountNotice){if(model.accountNotice.style.getPropertyValue('display'))model.accountNotice.style.removeProperty('display');alerts.unshift(model.accountNotice);}
  reconcile(notices,alerts);notices.hidden=!alerts.some(visible);
  // Keep the native nodes and listeners available as canonical action targets.
  // Availability is still owned by their hidden attributes and .hidden classes.
  for(const el of q('#screen-daily').children){if(el!==root&&(el.style.getPropertyValue('display')!=='none'||el.style.getPropertyPriority('display')!=='important'))el.style.setProperty('display','none','important');}
  if(!document.body.classList.contains('one-screen-ready'))document.body.classList.add('one-screen-ready');
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(update);}
 function start(){ready=true;schedule();}
 const observed=new MutationObserver(records=>{if(records.some(r=>{const e=r.target.nodeType===3?r.target.parentElement:r.target;return !e.closest?.('#oneScreenToday')||!!e.closest?.('.account-progress-status');}))schedule();});
 const screen=q('#screen-daily');if(screen)observed.observe(screen,{subtree:true,childList:true,attributes:true,characterData:true});
 new MutationObserver(()=>{if(document.documentElement.dataset.archiveReady==='1')ready=true;schedule();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-archive-ready']});
 const stateObserver=new MutationObserver(schedule);
 stateObserver.observe(document.body,{attributes:true,attributeFilter:['class','inert','aria-busy']});
 if(q('.app-shell'))stateObserver.observe(q('.app-shell'),{attributes:true,attributeFilter:['inert','aria-busy']});
 document.addEventListener('proplet:ready',start,{once:true});
 window.addEventListener('proplet-ui-ready',start,{once:true});
 document.addEventListener('proplet:screen-changed',schedule);
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('load',()=>{if(!ready&&typeof q('#playDailyBtn')?.onclick==='function')start();},{once:true});
 if(window.__PROPLET_CURRENT_UI_READY||document.documentElement.dataset.archiveReady==='1'||(document.readyState==='complete'&&typeof q('#playDailyBtn')?.onclick==='function'))start();
})();
