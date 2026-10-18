(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletRankings=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const FEMALE_ADJECTIVES=[
    'Sebejistá','Tajemná','Zvídavá','Hbitá','Bystrá','Odvážná',
    'Klidná','Trpělivá','Rozvážná','Kosmická','Noční','Hravá',
    'Nečekaná','Potulná','Záhadná','Propletená','Šifrovaná','Nenápadná',
    'Elegantní','Veselá','Čiperná','Vynalézavá','Neústupná','Zářivá'
  ];
  const FEMALE_ANIMALS=[
    ['volavka','🐦'],['vydra','🦦'],['liška','🦊'],['sova','🦉'],
    ['laň','🦌'],['gazela','🦌'],['puma','🐆'],['rysice','🐈'],
    ['vlaštovka','🐦'],['želva','🐢'],['kuna','🐾'],['veverka','🐿️'],
    ['surikata','🐾'],['žirafa','🦒'],['lama','🦙'],['kosatka','🐋'],
    ['velryba','🐋'],['srna','🦌'],['antilopa','🦌'],['zebra','🦓'],
    ['vlčice','🐺'],['tygřice','🐯'],['lvice','🦁'],['chobotnice','🐙']
  ];

  function hash32(value){
    let h=2166136261;
    for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    return h>>>0;
  }

  function mixedAnonymousIdentity(row){
    if(!row||row.anonymous!==true)return row;
    const seed=String(row.name||'Anonymní propletač');
    const h=hash32(`proplet-anon-gender-v1:${seed}`);
    if((h&1)===0)return row;
    const adjective=FEMALE_ADJECTIVES[(h>>>1)%FEMALE_ADJECTIVES.length];
    const [animal,avatar]=FEMALE_ANIMALS[(h>>>9)%FEMALE_ANIMALS.length];
    return {...row,name:`${adjective} ${animal}`,avatar,aliasGender:'f'};
  }

  function transformRankingPayload(data){
    if(!data||typeof data!=='object')return data;
    const out=Array.isArray(data)?data.map(transformRankingPayload):{...data};
    if(Array.isArray(out.players))out.players=out.players.map(mixedAnonymousIdentity);
    if(Array.isArray(out.rows))out.rows=out.rows.map(mixedAnonymousIdentity);
    return out;
  }

  function create(deps={}){
    const d=deps;
    const $=d.$||(()=>null), $$=d.$$||(()=>[]);
    const getProfile=d.getProfile||(()=>null);
    const countCz=d.countCz||((n,one,few,many)=>`${n} ${n===1?one:(n>=2&&n<=4?few:many)}`);
    const esc=d.esc||(value=>String(value??''));
    const fmtTime=d.fmtTime||(()=> '0:00');
    const levelFor=d.levelFor||(()=>({current:{icon:'',name:''}}));
    let rankingXpScope='players';
    let rankingXpPeriod='today';
    let rankingDailyScope='players';
    let installed=false;
    const compactLimit=5,cacheLifetimeMs=30000;
    const sections=new Map(),expandedViews=new Set(),cache=new Map(),inflight=new Map();
    const requestVersions={xp:0,daily:0};
    let interactionVersion=0,viewportTail=null,activeAnchor=null,pointerAnchor=null,lastAnchorInvalidation=null,layoutObserver=null;
    const page=()=>globalThis.window||globalThis;
    const accountKey=()=>{const p=getProfile();return `${p?.id||''}:${p?.token||''}`};
    const viewKey=kind=>kind==='xp'?`xp:${rankingXpScope}:${rankingXpPeriod}`:`daily:${rankingDailyScope}`;

    // Keep the actual controls in place. Loading never tears down an unrelated
    // section, and the browser's automatic scroll anchor is disabled for this
    // page so it cannot fight this explicit, interaction-scoped anchor.
    function captureAnchor(element){
      if(!element?.getBoundingClientRect||!element.isConnected)return null;
      const rect=element.getBoundingClientRect(),top=rect.top;
      if(rect.bottom<=0||top>=Number(page().innerHeight||0))return null;
      return {element,top,interaction:interactionVersion,identity:accountKey()};
    }
    function observeAnchorLayout(){
      layoutObserver?.disconnect();
      if(!activeAnchor||typeof page().ResizeObserver!=='function')return;
      layoutObserver||=new (page().ResizeObserver)(()=>restoreAnchor(activeAnchor));
      // Observe content, never the compensating tail. Scroll corrections cannot
      // resize these boxes, so the observer has no feedback loop.
      for(const {section} of sections.values())layoutObserver.observe(section);
    }
    function rememberAnchor(element){
      // Pointer focus can scroll between pointerdown and click. Use the position
      // from the start of that interaction rather than blessing the moved view.
      const target=controlsFor(element)||element;
      const anchor=pointerAnchor?.element===target&&pointerAnchor.interaction===interactionVersion&&pointerAnchor.identity===accountKey()?pointerAnchor:captureAnchor(target);
      pointerAnchor=null;activeAnchor=anchor;observeAnchorLayout();restoreAnchor(anchor);return anchor;
    }
    function liveAnchor(){return activeAnchor?.interaction===interactionVersion&&activeAnchor.identity===accountKey()&&activeAnchor.element.isConnected?activeAnchor:null}
    function controlsFor(element){return [...sections.values()].find(section=>section.controls?.contains(element))?.controls||null}
    function visibleAnchor(){
      const candidates=[...sections.values()].map(section=>section.controls||section.head);
      const active=globalThis.document?.activeElement;
      return (candidates.some(element=>element?.contains?.(active))?captureAnchor(controlsFor(active)):null)||candidates.map(captureAnchor).find(Boolean)||null;
    }
    function restoreAnchor(anchor){
      if(!anchor||anchor.interaction!==interactionVersion||!anchor.element.isConnected)return;
      if(anchor.identity!==accountKey()){activeAnchor=null;layoutObserver?.disconnect();return}
      const win=page(),doc=globalThis.document;
      if(!win.scrollBy||!doc?.documentElement)return;
      const delta=anchor.element.getBoundingClientRect().top-anchor.top;
      if(Math.abs(delta)<.5)return;
      // A shorter last section can clamp scrollY before the controls reach
      // their previous position. Reserve only the missing viewport space.
      const scrolling=doc.scrollingElement||doc.documentElement;
      const missing=Number(win.scrollY||0)+delta-Math.max(0,scrolling.scrollHeight-Number(win.innerHeight||0));
      if(missing>0&&viewportTail)viewportTail.style.height=`${viewportTail.offsetHeight+Math.ceil(missing)}px`;
      win.scrollBy({top:delta,left:0,behavior:'instant'});
    }
    function anchored(anchor,change){
      // A second control click renews the shared context. A Daily response that
      // started earlier must still keep the currently used XP controls in view.
      anchor=activeAnchor?.interaction===interactionVersion?activeAnchor:anchor;
      change();
      const restore=()=>restoreAnchor(anchor);
      restore();
      // The bounded passes cover immediate layout. Delayed native decoration,
      // image or font layout is covered by the section ResizeObserver until the
      // next user input, account change or navigation invalidates this anchor.
      page().requestAnimationFrame?.(()=>{restore();page().requestAnimationFrame?.(restore)});
    }
    function setBusy(kind,busy){
      const list=$(kind==='xp'?'#xpLeaderboardList':'#dailyLeaderboardList');
      list?.setAttribute?.('aria-busy',String(busy));
    }
    function sectionSlice(rows,kind){
      if(expandedViews.has(viewKey(kind))||rows.length<=compactLimit)return {top:rows,mine:null,hidden:0};
      const top=rows.slice(0,compactLimit),mine=rows.find(row=>row.isMine),showMine=!!mine&&!top.includes(mine);
      return {top,mine:showMine?mine:null,hidden:Math.max(0,rows.length-top.length-(showMine?1:0))};
    }
    function updateSection(kind,rows){
      const section=sections.get(kind);if(!section)return;
      section.rows=rows;
      const expanded=expandedViews.has(viewKey(kind)),hasMore=rows.length>compactLimit;
      section.more.hidden=!hasMore;
      section.more.textContent=expanded?'Zkrátit na přehled':`Zobrazit celé pořadí (${rows.length})`;
      section.more.setAttribute('aria-expanded',String(expanded));
      section.back.hidden=!hasMore||!expanded;
      const scope=kind==='xp'?rankingXpScope:rankingDailyScope;
      section.summary.textContent=rows.length?(scope==='teams'?countCz(rows.length,'tým','týmy','týmů'):countCz(rows.length,'hráč','hráči','hráčů')):'';
    }
    function installSections(){
      const doc=globalThis.document;if(!doc?.createElement)return;
      for(const kind of ['daily','xp']){
        const list=$(kind==='xp'?'#xpLeaderboardList':'#dailyLeaderboardList'),section=list?.closest?.('.ranking-section'),head=section?.querySelector('.ranking-section-head');
        if(!section||!head||sections.has(kind))continue;
        section.querySelectorAll('[role="tablist"]').forEach(group=>group.setAttribute('role','group'));
        const title=section.querySelector('h2'),label=kind==='xp'?'Nasbírané XP':'Dnešní výzva';
        section.classList.add('ranking-navigation-section');
        list.setAttribute('role','region');list.setAttribute('aria-labelledby',title.id);
        const collapse=doc.createElement('button');collapse.type='button';collapse.className='ranking-collapse-toggle';
        collapse.setAttribute('aria-controls',list.id);collapse.setAttribute('aria-expanded','true');collapse.setAttribute('aria-label',`Sbalit: ${label}`);
        collapse.innerHTML='<span aria-hidden="true">⌃</span>';
        const summary=doc.createElement('small');summary.className='ranking-section-summary';summary.hidden=true;
        head.querySelector('div')?.append(summary);head.append(collapse);
        const more=doc.createElement('button');more.type='button';more.className='ranking-expand-list text-btn';more.hidden=true;more.setAttribute('aria-controls',list.id);
        list.before(more);
        const back=doc.createElement('button');back.type='button';back.className='ranking-back-summary text-btn';back.hidden=true;back.textContent='Zpět na přehled ↑';list.after(back);
        const controls=section.querySelector(kind==='xp'?'.ranking-control-row':'.ranking-daily-segment');
        sections.set(kind,{section,head,controls,list,collapse,summary,more,back,rows:[]});
        collapse.addEventListener('click',()=>{
          const anchor=rememberAnchor(collapse),collapsed=collapse.getAttribute('aria-expanded')==='true';
          anchored(anchor,()=>{section.classList.toggle('ranking-navigation-collapsed',collapsed);collapse.setAttribute('aria-expanded',String(!collapsed));collapse.setAttribute('aria-label',`${collapsed?'Rozbalit':'Sbalit'}: ${label}`);summary.hidden=!collapsed;});
        });
        const toggle=()=>{
          const anchor=rememberAnchor(more);
          if(expandedViews.has(viewKey(kind)))expandedViews.delete(viewKey(kind));else expandedViews.add(viewKey(kind));
          anchored(anchor,()=>{const state=sections.get(kind);if(state.payload)(kind==='xp'?renderXpRanking:renderDailyRanking)(state.payload)});
        };
        more.addEventListener('click',toggle);
        back.addEventListener('click',()=>{
          expandedViews.delete(viewKey(kind));const state=sections.get(kind);if(state.payload)(kind==='xp'?renderXpRanking:renderDailyRanking)(state.payload);
          more.focus({preventScroll:true});head.scrollIntoView({block:'start',behavior:'instant'});rememberAnchor(more);
        });
      }
      const screen=$('#screen-leaderboard');
      if(screen&&!viewportTail){viewportTail=doc.createElement('div');viewportTail.className='ranking-viewport-tail';viewportTail.setAttribute('aria-hidden','true');screen.append(viewportTail);}
    }
    function syncControls(){
      const groups=[['.ranking-scope-tab','rankingXpScope',rankingXpScope],['.ranking-period-tab','rankingPeriod',rankingXpPeriod],['.ranking-daily-tab','rankingDailyScope',rankingDailyScope]];
      for(const [selector,key,value] of groups)for(const button of $$(selector)){
        const selected=button.dataset[key]===value;button.classList.toggle('active',selected);button.setAttribute?.('aria-pressed',String(selected));
      }
      $('#dailyTeamMethod')?.classList.toggle('hidden',rankingDailyScope!=='teams');
    }
    function readRanking(url,key){
      if(inflight.has(key))return inflight.get(key);
      const pending=Promise.resolve().then(()=>d.api(url)).then(data=>{cache.set(key,{data,at:Date.now()});return data}).finally(()=>{if(inflight.get(key)===pending)inflight.delete(key)});
      inflight.set(key,pending);return pending;
    }
    async function loadRanking(kind,{anchor=null,refresh=false}={}){
      const version=++requestVersions[kind],identity=accountKey(),period=rankingXpPeriod,date=d.pragueDateISO?.()||'';
      const url=kind==='xp'?`/api/rankings/xp?period=${period}`:`/api/rankings/daily?daily_date=${date}`;
      const key=`${identity}:${url}`,cached=cache.get(key),list=$(kind==='xp'?'#xpLeaderboardList':'#dailyLeaderboardList');
      if(!list)return;
      const current=()=>version===requestVersions[kind]&&identity===accountKey()&&(kind!=='xp'||period===rankingXpPeriod)&&(kind!=='daily'||date===(d.pragueDateISO?.()||''));
      const render=data=>anchored(anchor,()=>{(kind==='xp'?renderXpRanking:renderDailyRanking)(data);if(kind==='xp'&&data.visibilityReady===true){const privacy=$('#rankingPrivacyNote');if(privacy)privacy.dataset.visibilityReady='true'}});
      if(cached){render(cached.data);if(!refresh&&Date.now()-cached.at<cacheLifetimeMs){setBusy(kind,false);return}}
      else if(!sections.get(kind)?.payload||sections.get(kind)?.identity!==identity)anchored(anchor,()=>{list.innerHTML=`<div class="ranking-loading" role="status">Načítám ${kind==='xp'?'XP':'dnešní'} pořadí…</div>`});
      setBusy(kind,true);
      try{const data=await readRanking(url,key);if(current())render(data)}
      catch(error){if(current())anchored(anchor,()=>{list.innerHTML=`<div class="ranking-empty" role="status"><strong>${kind==='xp'?'XP':'Dnešní'} pořadí se teď nepodařilo načíst.</strong><small>${esc(error?.message||'Zkus to prosím znovu.')}</small><button type="button" class="ranking-retry text-btn">Zkusit znovu</button></div>`;const retry=list.querySelector?.('.ranking-retry');retry?.addEventListener('click',()=>{const state=sections.get(kind),control=state?.controls?.querySelector(kind==='xp'?'.ranking-period-tab.active':'.ranking-daily-tab.active');control?.focus({preventScroll:true});loadRanking(kind,{anchor:rememberAnchor(control||state?.controls),refresh:true})});const state=sections.get(kind);if(state){state.more.hidden=true;state.back.hidden=true;state.payload=null}})}
      finally{if(current())setBusy(kind,false)}
    }


    function rankingRows(data,scope){return scope==='teams'?(data?.teams||[]):(data?.players||[])}
    function rankingRankBadge(rank){return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}.`}

    function periodLabel(){return rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}

    function rankingDataWithBonus(data){
      try{return d.adjustAccountRankingData?.(data)||data}
      catch{return data}
    }

    function ownRankingDivider(){return '<div class="ranking-own-divider"><span>Tvoje pozice</span></div>'}

    function renderXpRanking(input){
      const list=$('#xpLeaderboardList'),data=transformRankingPayload(rankingDataWithBonus(input)),rows=rankingRows(data,rankingXpScope);
      if(!list)return;
      const section=sections.get('xp');if(section){section.payload=input;section.identity=accountKey()}updateSection('xp',rows);
      if(!rows.length){list.innerHTML=`<div class="ranking-empty"><strong>${rankingXpScope==='teams'?'Týmy':'Hráči'} zatím nemají XP v tomto období.</strong><small>První body tu udělají pořádek velmi rychle. 😄</small></div>`;return}
      const rowHtml=r=>{
        if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${periodLabel()}</small></div></div>`;
        const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
        return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${periodLabel()}</small></div></div>`;
      };
      const sliced=sectionSlice(rows,'xp');
      list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'');
    }

    function renderDailyRanking(input){
      const list=$('#dailyLeaderboardList'),rows=rankingRows(transformRankingPayload(input),rankingDailyScope);
      if(!list)return;
      const section=sections.get('daily');if(section){section.payload=input;section.identity=accountKey()}updateSection('daily',rows);
      if(!rows.length){list.innerHTML='<div class="ranking-empty"><strong>Dnešní startovní rošt je zatím prázdný.</strong><small>Stačí dokončit Denní výzvu.</small></div>';return}
      const rowHtml=r=>{
        if(rankingDailyScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.players||0,'výkon','výkony','výkonů')} v dnešním skóre · ${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.score||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})}</strong><small>/ 100</small></div></div>`;
        const quality=r.cleanSolve===true?'Čistě':r.hintsUsed?countCz(r.hintsUsed,'nápověda','nápovědy','nápověd'):'Bez nápovědy',team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
        return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small>${quality} · ${countCz(r.moves||0,'tah','tahy','tahů')}${team}</small></div><div class="leader-score"><strong>${fmtTime(r.elapsedMs)}</strong><small>dnešní výzva</small></div></div>`;
      };
      const sliced=sectionSlice(rows,'daily');
      list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'');
    }

    function renderRankingPrivacyNote(){
      const box=$('#rankingPrivacyNote'),p=getProfile();if(!box)return;
      if(!p?.token){box.innerHTML='<span class="ranking-privacy-icon">👀</span><div><strong>Kompletní pořadí, soukromí zůstává</strong><small>Výsledky jsou vždy vidět. Kdo nezveřejní profil, dostane místo jména hravou anonymní přezdívku.</small></div>';return}
      const state=p.publicRankings,title=state===true?'Jsi ve veřejném pořadí':state===false?'V pořadí jsi anonymně':'Vyber si, jestli chceš být vidět',copy=state===true?'Ostatní vidí jen avatar, herní jméno a případně veřejný tým.':state===false?'Tvoje výsledky v pořadí zůstávají, ale ostatní u nich vidí jen anonymní přezdívku.':'Dokud volbu nepotvrdíš, tvoje výsledky se ukazují anonymně.',action=state===true?'Skrýt mě':state===false?'Zobrazit mě':'Nastavit';
      box.innerHTML=`<span class="ranking-privacy-icon">👀</span><div><strong>${title}</strong><small>${copy}</small></div><button id="rankingPrivacyActionBtn" class="text-btn">${action}</button>`;
      const button=$('#rankingPrivacyActionBtn');if(button)button.onclick=()=>state===true?saveRankingVisibility(false):state===false?saveRankingVisibility(true):openRankingPrivacyModal();
    }
    async function ensureProfile(){return d.ensureRankingProfileState?d.ensureRankingProfileState():getProfile()}
    function openRankingPrivacyModal(){if(!getProfile()?.token){d.openProfileModal?.('create');return}const p=getProfile();$('#rankingPrivacyPreviewAvatar').textContent=p.avatar||'🙂';$('#rankingPrivacyPreviewName').textContent=p.name||'Hráč';$('#rankingPrivacyModal').classList.remove('hidden')}
    async function saveRankingVisibility(enabled){
      try{const result=await d.api('/api/rankings/visibility',{method:'POST',body:JSON.stringify({enabled})});d.updateAccountProfile?.({publicRankings:result.publicRankings});$('#rankingPrivacyModal')?.classList.add('hidden');renderRankingPrivacyNote();d.showToast?.(enabled?'Jsi ve společném pořadí 🏆':'V pořadí jsi anonymně 🎭');await renderLeaderboard()}catch(error){d.showToast?.(error.message)}
    }
    let privacyNoticeShown=false;
    function maybeShowRankingPrivacyNotice(){const p=getProfile();if(!privacyNoticeShown&&p?.token&&p.publicRankings==null&&d.canShowRankingPrivacyNotice?.()){privacyNoticeShown=true;openRankingPrivacyModal()}}
    function renderRankingTeamCard(){
      const box=$('#rankingTeamCard'),p=getProfile();if(!box)return;
      if(!p?.token){box.innerHTML='<div><strong>Chceš soutěžit i za partu?</strong><small>Pořadí můžeš sledovat bez účtu. Pro vlastní tým si nejdřív ulož postup.</small></div><button id="rankingAccountBtn" class="secondary-btn">☁️ Uložit postup</button>';const button=$('#rankingAccountBtn');if(button)button.onclick=()=>d.openProfileModal?.('create');return}
      if(!p.familyCode){box.innerHTML='<div><strong>Jsi zatím bez týmu</strong><small>Účet funguje samostatně. Tým můžeš přidat kdykoli, bez vlivu na předchozí XP.</small></div><button id="rankingJoinTeamBtn" class="secondary-btn">Přidat / založit tým</button>';const button=$('#rankingJoinTeamBtn');if(button)button.onclick=()=>d.openTeamMembershipModal?.();return}
      box.innerHTML=`<div><strong>${esc(p.leagueName||p.familyCode)}</strong><small>Do týmových XP se počítají jen XP získané během členství.</small></div><div class="tv-team-actions"><button id="rankingTeamVictoriesBtn" class="secondary-btn">Týdenní zlato · vitrína</button><button id="rankingTeamSettingsBtn" class="text-btn">Nastavení týmu</button></div>`;const button=$('#rankingTeamSettingsBtn');if(button)button.onclick=()=>d.openFamilyLeagueModal?.();const victories=$('#rankingTeamVictoriesBtn');if(victories)victories.onclick=()=>globalThis.PropletTeamVictories?.openCabinet();
    }

    let renderVersion=0;
    async function renderLeaderboard(){
      const version=++renderVersion,anchor=liveAnchor()||visibleAnchor();if(anchor){activeAnchor=anchor;observeAnchorLayout()}
      const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');if(!xpList||!dailyList)return;
      await ensureProfile();if(version!==renderVersion)return;
      installSections();anchored(anchor,()=>{renderRankingPrivacyNote();syncControls();renderRankingTeamCard()});maybeShowRankingPrivacyNotice();
      await Promise.allSettled([loadRanking('xp',{anchor,refresh:true}),loadRanking('daily',{anchor,refresh:true})]);
    }

    function install(){
      if(installed)return false;
      installed=true;
      installSections();
      const invalidateAnchor=event=>{interactionVersion++;activeAnchor=null;pointerAnchor=null;layoutObserver?.disconnect();lastAnchorInvalidation=event?.type||'navigation'};
      for(const type of ['wheel','touchmove'])globalThis.document?.addEventListener(type,invalidateAnchor,{passive:true});
      globalThis.document?.addEventListener('pointerdown',event=>{
        const previous=liveAnchor(),button=event.target.closest?.('.ranking-scope-tab,.ranking-period-tab,.ranking-daily-tab');
        invalidateAnchor(event);
        if(!button)return;
        const controls=controlsFor(button),anchor=captureAnchor(controls||button);if(!anchor)return;
        // Continue an unchanged control group's established viewport position.
        // A preceding real scroll already invalidated previous, so it always
        // starts a fresh interaction at the user's chosen position instead.
        if(previous&&controls&&previous.element===controls)anchor.top=previous.top;
        pointerAnchor=anchor;
      },{capture:true,passive:true});
      globalThis.document?.addEventListener('keydown',invalidateAnchor);
      globalThis.document?.addEventListener('proplet:account-changed',invalidateAnchor);
      globalThis.document?.addEventListener('proplet:screen-changed',event=>{invalidateAnchor(event);if(viewportTail)viewportTail.style.height='0px';maybeShowRankingPrivacyNotice()});
      $$('.ranking-scope-tab').forEach(button=>button.addEventListener('click',()=>{const anchor=rememberAnchor(button);rankingXpScope=button.dataset.rankingXpScope;syncControls();loadRanking('xp',{anchor})}));
      $$('.ranking-period-tab').forEach(button=>button.addEventListener('click',()=>{const anchor=rememberAnchor(button);rankingXpPeriod=button.dataset.rankingPeriod;syncControls();loadRanking('xp',{anchor})}));
      $$('.ranking-daily-tab').forEach(button=>button.addEventListener('click',()=>{const anchor=rememberAnchor(button);rankingDailyScope=button.dataset.rankingDailyScope;anchored(anchor,syncControls);loadRanking('daily',{anchor})}));
      return true;
    }
    function openWeeklyTeams({render=true}={}){rankingXpScope='teams';rankingXpPeriod='week';if(render)return renderLeaderboard()}
    return {install,openWeeklyTeams,renderLeaderboard,renderXpRanking,renderDailyRanking,renderRankingPrivacyNote,renderRankingTeamCard,openRankingPrivacyModal,saveRankingVisibility,maybeShowRankingPrivacyNotice,rankingRows,rankingRankBadge,transformRankingPayload,getState:()=>({rankingXpScope,rankingXpPeriod,rankingDailyScope,viewportAnchor:activeAnchor?{top:activeAnchor.top,interaction:activeAnchor.interaction,element:activeAnchor.element.className}:null,interactionVersion,lastAnchorInvalidation})};
  }

  return {create,transformRankingPayload};
});

