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

    function rankingRows(data,scope){return scope==='teams'?(data?.teams||[]):(data?.players||[])}
    function rankingRankBadge(rank){return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}.`}

    function periodLabel(){return rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}

    function rankingDataWithBonus(data){
      try{return d.adjustAccountRankingData?.(data)||data}
      catch{return data}
    }

    function totalXpSlice(rows,limit=10){
      if(rankingXpPeriod!=='all'||rows.length<=limit)return {top:rows,mine:null,hidden:0};
      const top=rows.slice(0,limit),mine=rows.find(row=>row.isMine),showMine=!!mine&&!top.includes(mine);
      return {top,mine:showMine?mine:null,hidden:Math.max(0,rows.length-top.length-(showMine?1:0))};
    }
    function moreRankingHtml(hidden,scope){
      if(!hidden)return '';
      const label=scope==='teams'?countCz(hidden,'tým','týmy','týmů'):countCz(hidden,'hráč','hráči','hráčů');
      return `<div class="ranking-more"><span>🧗</span><div>A dalších <strong>${label}</strong> si proplétá cestu na vrchol.</div></div>`;
    }
    function ownRankingDivider(){return '<div class="ranking-own-divider"><span>Tvoje pozice</span></div>'}

    function renderXpRanking(input){
      const list=$('#xpLeaderboardList'),data=transformRankingPayload(rankingDataWithBonus(input)),rows=rankingRows(data,rankingXpScope);
      if(!list)return;
      if(!rows.length){list.innerHTML=`<div class="ranking-empty"><strong>${rankingXpScope==='teams'?'Týmy':'Hráči'} zatím nemají XP v tomto období.</strong><small>První body tu udělají pořádek velmi rychle. 😄</small></div>`;return}
      const rowHtml=r=>{
        if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${periodLabel()}</small></div></div>`;
        const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
        return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${r.badgeCount?` · 🏅 ${r.badgeCount}`:''}${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${periodLabel()}</small></div></div>`;
      };
      const sliced=totalXpSlice(rows);
      list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'')+moreRankingHtml(sliced.hidden,rankingXpScope);
    }

    function renderDailyRanking(input){
      const list=$('#dailyLeaderboardList'),rows=rankingRows(transformRankingPayload(input),rankingDailyScope);
      if(!list)return;
      if(!rows.length){list.innerHTML='<div class="ranking-empty"><strong>Dnešní startovní rošt je zatím prázdný.</strong><small>Stačí dokončit Denní výzvu.</small></div>';return}
      list.innerHTML=rows.map(r=>{
        if(rankingDailyScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.players||0,'výkon','výkony','výkonů')} v dnešním skóre · ${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.score||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})}</strong><small>/ 100</small></div></div>`;
        const quality=r.cleanSolve===true?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Bez nápovědy',team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
        return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small>${quality} · ${countCz(r.moves||0,'tah','tahy','tahů')}${team}</small></div><div class="leader-score"><strong>${fmtTime(r.elapsedMs)}</strong><small>dnešní výzva</small></div></div>`;
      }).join('');
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
    function maybeShowRankingPrivacyNotice(){const p=getProfile();if(p?.token&&p.publicRankings==null)openRankingPrivacyModal()}
    function renderRankingTeamCard(){
      const box=$('#rankingTeamCard'),p=getProfile();if(!box)return;
      if(!p?.token){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Chceš soutěžit i za partu?</strong><small>Pořadí můžeš sledovat bez účtu. Pro vlastní tým si nejdřív ulož postup.</small></div><button id="rankingAccountBtn" class="secondary-btn">☁️ Uložit postup</button>';const button=$('#rankingAccountBtn');if(button)button.onclick=()=>d.openProfileModal?.('create');return}
      if(!p.familyCode){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Jsi zatím bez týmu</strong><small>Účet funguje samostatně. Tým můžeš přidat kdykoli, bez vlivu na předchozí XP.</small></div><button id="rankingJoinTeamBtn" class="secondary-btn">Přidat / založit tým</button>';const button=$('#rankingJoinTeamBtn');if(button)button.onclick=()=>d.openTeamMembershipModal?.();return}
      box.innerHTML=`<div><span class="eyebrow">👥 TVŮJ TÝM</span><strong>${esc(p.leagueName||p.familyCode)}</strong><small>Do týmových XP se počítají jen XP získané během členství.</small></div><button id="rankingTeamSettingsBtn" class="secondary-btn">Nastavení týmu</button>`;const button=$('#rankingTeamSettingsBtn');if(button)button.onclick=()=>d.openFamilyLeagueModal?.();
    }

    async function renderLeaderboard(){
      const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');if(!xpList||!dailyList)return;
      await ensureProfile();renderRankingPrivacyNote();maybeShowRankingPrivacyNotice();
      $$('.ranking-scope-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingXpScope===rankingXpScope));
      $$('.ranking-period-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingPeriod===rankingXpPeriod));
      $$('.ranking-daily-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingDailyScope===rankingDailyScope));
      $('#dailyTeamMethod')?.classList.toggle('hidden',rankingDailyScope!=='teams');renderRankingTeamCard();
      xpList.innerHTML='<div class="ranking-loading">Načítám XP pořadí…</div>';dailyList.innerHTML='<div class="ranking-loading">Načítám dnešní pořadí…</div>';
      const [xpResult,dailyResult]=await Promise.allSettled([d.api(`/api/rankings/xp?period=${rankingXpPeriod}`),d.api(`/api/rankings/daily?daily_date=${d.pragueDateISO?.()||''}`)]);
      if(xpResult.status==='fulfilled'){renderXpRanking(xpResult.value);const privacy=$('#rankingPrivacyNote');if(privacy&&xpResult.value.visibilityReady===true)privacy.dataset.visibilityReady='true'}else xpList.innerHTML=`<div class="ranking-empty"><strong>XP pořadí se teď nepodařilo načíst.</strong><small>${esc(xpResult.reason?.message||'Zkus to prosím znovu.')}</small></div>`;
      if(dailyResult.status==='fulfilled')renderDailyRanking(dailyResult.value);else dailyList.innerHTML=`<div class="ranking-empty"><strong>Dnešní pořadí se teď nepodařilo načíst.</strong><small>${esc(dailyResult.reason?.message||'Zkus to prosím znovu.')}</small></div>`;
    }

    function install(){
      if(installed)return false;
      installed=true;
      $$('.ranking-scope-tab').forEach(button=>button.addEventListener('click',()=>{rankingXpScope=button.dataset.rankingXpScope;renderLeaderboard()}));
      $$('.ranking-period-tab').forEach(button=>button.addEventListener('click',()=>{rankingXpPeriod=button.dataset.rankingPeriod;renderLeaderboard()}));
      $$('.ranking-daily-tab').forEach(button=>button.addEventListener('click',()=>{rankingDailyScope=button.dataset.rankingDailyScope;renderLeaderboard()}));
      return true;
    }
    return {install,renderLeaderboard,renderXpRanking,renderDailyRanking,renderRankingPrivacyNote,renderRankingTeamCard,openRankingPrivacyModal,saveRankingVisibility,maybeShowRankingPrivacyNotice,rankingRows,rankingRankBadge,transformRankingPayload,getState:()=>({rankingXpScope,rankingXpPeriod,rankingDailyScope})};
  }

  return {create,transformRankingPayload};
});
