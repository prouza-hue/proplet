(()=>{
  'use strict';
  // The main Pořadí page is owned by /app/rankings/rankings.js. This file keeps
  // only the visual polish shared by the rest of the app; ranking data must not
  // be rewritten through a global fetch or renderer monkey-patch.
  const transformRankingPayload=data=>window.PropletRankings?.transformRankingPayload?window.PropletRankings.transformRankingPayload(data):data;
  const winModal=document.getElementById('winModal');
  if(winModal&&!winModal.dataset.backdropClose){winModal.dataset.backdropClose='1';winModal.addEventListener('click',event=>{if(event.target!==winModal||currentGame?.mode==='starter')return;closeWinToMenu()})}
  window.__PROPLET_RANKING_POLISH__={femaleAdjectives:24,femaleAnimals:24,femaleCombinations:576,totalAliasCombinations:1056,transformRankingPayload};
})();
