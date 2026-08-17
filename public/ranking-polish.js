(()=>{
  function sliceRankingRows(rows,limit=10){
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
    const label=countCz(hidden,scope==='teams'?'tým':'hráč',scope==='teams'?'týmy':'hráči',scope==='teams'?'týmů':'hráčů');
    return `<div class="ranking-more">A dalších <strong>${label}</strong> si proplétá cestu na vrchol.</div>`;
  }

  function ownRankingDivider(){
    return '<div class="ranking-own-divider"><span>Tvoje pozice</span></div>';
  }

  renderXpRanking=function(data){
    const list=$('#xpLeaderboardList'),rows=rankingRows(data,rankingXpScope);
    if(!rows.length){
      list.innerHTML=`<div class="ranking-empty"><strong>${rankingXpScope==='teams'?'Týmy':'Hráči'} zatím nemají XP v tomto období.</strong><small>První body tu udělají pořádek velmi rychle. 😄</small></div>`;
      return;
    }
    const sliced=sliceRankingRows(rows);
    const rowHtml=r=>{
      if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`;
      const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
      return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${r.badgeCount?` · 🏅 ${r.badgeCount}`:''}${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`;
    };
    list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'')+moreRankingHtml(sliced.hidden,rankingXpScope);
  };

  renderDailyRanking=function(data){
    const list=$('#dailyLeaderboardList'),rows=rankingRows(data,rankingDailyScope);
    if(!rows.length){
      list.innerHTML='<div class="ranking-empty"><strong>Dnešní startovní rošt je zatím prázdný.</strong><small>Stačí dokončit Denní výzvu.</small></div>';
      return;
    }
    const sliced=sliceRankingRows(rows);
    const rowHtml=r=>{
      if(rankingDailyScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.players||0,'výkon','výkony','výkonů')} v dnešním skóre · ${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.score||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})}</strong><small>/ 100</small></div></div>`;
      const quality=r.cleanSolve===true?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Bez nápovědy',team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
      return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small>${quality} · ${countCz(r.moves||0,'tah','tahy','tahů')}${team}</small></div><div class="leader-score"><strong>${fmtTime(r.elapsedMs)}</strong><small>dnešní výzva</small></div></div>`;
    };
    list.innerHTML=sliced.top.map(rowHtml).join('')+(sliced.mine?`${ownRankingDivider()}${rowHtml(sliced.mine)}`:'')+moreRankingHtml(sliced.hidden,rankingDailyScope);
  };

  const winModal=document.getElementById('winModal');
  if(winModal&&!winModal.dataset.backdropClose){
    winModal.dataset.backdropClose='1';
    winModal.addEventListener('click',event=>{
      if(event.target!==winModal||currentGame?.mode==='starter')return;
      closeWinToMenu();
    });
  }

  try{if(currentScreen==='leaderboard')renderLeaderboard()}catch{}
})();
