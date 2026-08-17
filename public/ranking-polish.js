(()=>{
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
    // Zhruba polovina anonymních identit zůstane v mužském setu,
    // druhá polovina dostane stabilní ženskou variantu.
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

  // Keep aliases consistent across the full Pořadí page and compact result boards.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    try{
      const raw=typeof input==='string'?input:input?.url||'';
      const url=new URL(raw,location.href);
      const rankingEndpoint=[
        '/api/rankings/xp','/api/rankings/daily',
        '/api/daily-global-leaderboard','/api/free-global-leaderboard'
      ].includes(url.pathname);
      if(!rankingEndpoint||!response.ok)return response;
      const data=transformRankingPayload(await response.clone().json());
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{
        status:response.status,statusText:response.statusText,headers
      });
    }catch{return response}
  };

  function czCount(n,one,few,many){
    n=Math.max(0,Number(n)||0);
    return `${n} ${n===1?one:(n>=2&&n<=4?few:many)}`;
  }

  function totalXpSlice(rows,limit=10){
    if(rankingXpPeriod!=='all'||rows.length<=limit)return {top:rows,mine:null,hidden:0};
    const top=rows.slice(0,limit);
    const mine=rows.find(row=>row.isMine);
    const showMine=!!mine&&!top.includes(mine);
    return {
      top,
      mine:showMine?mine:null,
      hidden:Math.max(0,rows.length-top.length-(showMine?1:0)),
    };
  }

  function moreRankingHtml(hidden,scope){
    if(!hidden)return '';
    const label=scope==='teams'
      ?czCount(hidden,'tým','týmy','týmů')
      :czCount(hidden,'hráč','hráči','hráčů');
    return `<div class="ranking-more"><span>🧗</span><div>A dalších <strong>${label}</strong> si proplétá cestu na vrchol.</div></div>`;
  }

  function ownRankingDivider(){
    return '<div class="ranking-own-divider"><span>Tvoje pozice</span></div>';
  }

  const baseRenderXpRanking=renderXpRanking;
  renderXpRanking=function(data){
    if(rankingXpPeriod!=='all')return baseRenderXpRanking(data);
    const rows=rankingRows(data,rankingXpScope);
    const list=document.getElementById('xpLeaderboardList');
    if(!list||rows.length<=10)return baseRenderXpRanking(data);
    const sliced=totalXpSlice(rows);
    const rowHtml=r=>{
      if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>celkem</small></div></div>`;
      const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
      return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${r.badgeCount?` · 🏅 ${r.badgeCount}`:''}${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>celkem</small></div></div>`;
    };
    list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'')+moreRankingHtml(sliced.hidden,rankingXpScope);
  };

  const winModal=document.getElementById('winModal');
  if(winModal&&!winModal.dataset.backdropClose){
    winModal.dataset.backdropClose='1';
    winModal.addEventListener('click',event=>{
      if(event.target!==winModal||currentGame?.mode==='starter')return;
      closeWinToMenu();
    });
  }

  window.__PROPLET_RANKING_POLISH__={
    femaleAdjectives:FEMALE_ADJECTIVES.length,
    femaleAnimals:FEMALE_ANIMALS.length,
    femaleCombinations:FEMALE_ADJECTIVES.length*FEMALE_ANIMALS.length,
    totalAliasCombinations:480+FEMALE_ADJECTIVES.length*FEMALE_ANIMALS.length,
    transformRankingPayload
  };

  try{if(currentScreen==='leaderboard')renderLeaderboard()}catch{}
})();
