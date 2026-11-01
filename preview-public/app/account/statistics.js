(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PropletProfileStatistics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const difficulties=[
    ['easy','Snadná','easy.webp','#168577'],
    ['medium','Střední','medium.webp','#315eaf'],
    ['hard','Těžká','hard.webp','#c8563e'],
    ['hardcore','Mozkožrout','hardcore.webp','#885788'],
    ['mozkomor','Mozkomor','mozkomor.webp','#536488'],
    ['mozkokalypsa','Mozkokalypsa','mozkokalypsa-series-ochre.svg','#a77827']
  ];
  const ids=new Set(difficulties.map(d=>d[0]));
  const empty=()=>Object.fromEntries(difficulties.map(([id])=>[id,{completed:0,fastestMs:null}]));
  // One pass over the existing account snapshot. No requests, polling, writes or slot migration.
  function calculate(completed={}){
    const output={free:empty(),daily:empty()},unique=new Map();
    for(const row of Object.values(completed)){
      if(!row||!['free','daily','daily_special'].includes(row.mode)||!ids.has(row.difficulty)||!row.puzzleId)continue;
      if(row.mode==='daily_special'&&(row.rewardEligible===false||row.official===false
        ||row.challengeKey!==`daily-special:${row.dailyDate}:${row.difficulty}`))continue;
      const identity=row.mode==='daily'?(row.dailyDate||row.challengeKey):row.mode==='daily_special'?row.challengeKey:row.puzzleId;
      if(!identity)continue;
      const key=`${row.mode}:${identity}`,old=unique.get(key);
      // A Daily replacement for the same date is still one completed daily challenge.
      if(!old||(row.mode==='daily'
        ? String(row.completedAt||'')>String(old.completedAt||'')
        : String(row.completedAt||'')<String(old.completedAt||'')))unique.set(key,row);
    }
    for(const row of unique.values()){
      const stat=output[row.mode==='daily_special'?'daily':row.mode][row.difficulty];stat.completed++;
      const ms=row.elapsedMs;
      if(typeof ms!=='number'||!Number.isFinite(ms)||ms<1000||row.timingVerified===false||row.mergedAttempts===true||(row.timingUnverified===true&&row.timingVerified!==true))continue;
      if(stat.fastestMs===null||ms<stat.fastestMs)stat.fastestMs=ms;
    }
    return output;
  }
  const formatTime=ms=>{
    if(ms===null)return '—';
    const seconds=Math.floor(ms/1000),minutes=Math.floor(seconds/60);
    return `${minutes}:${String(seconds%60).padStart(2,'0')}`;
  };
  const number=n=>n.toLocaleString('cs-CZ');
  const plural=(n,one,few,many)=>n===1?one:n>=2&&n<=4?few:many;
  const clock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5V2m0 7v5l3 2"/></svg>';
  function panel(data,mode,ready){
    const rows=data[mode],total=Object.values(rows).reduce((sum,r)=>sum+r.completed,0);
    return `<div class="profile-ledger-total"><strong>${ready?number(total):'—'}</strong><span>${mode==='daily'?plural(total,'dokončená výzva','dokončené výzvy','dokončených výzev'):plural(total,'dohraná úroveň','dohrané úrovně','dohraných úrovní')}</span></div><div class="profile-ledger-grid">${difficulties.map(([id,label,icon,color])=>{
      const row=rows[id],time=ready?formatTime(row.fastestMs):'—';
      return `<div class="profile-ledger-tile" style="--difficulty-color:${color}"><img src="/difficulty/printshop/${icon}" width="48" height="48" alt="${label}" title="${label}"><strong class="profile-ledger-count" aria-label="Dokončeno: ${ready?number(row.completed):'načítá se'}">${ready?number(row.completed):'—'}</strong><span class="profile-ledger-time" aria-label="Nejrychleji: ${time}" title="${row.fastestMs===null?'Zatím bez zaznamenaného času':'Nejrychlejší první dokončení'}">${clock}<b>${time}</b></span></div>`;
    }).join('')}</div><p class="profile-ledger-key">${ready?`${clock} Nejrychlejší čas v každé obtížnosti`:'Načítám uložené výsledky…'}</p>`;
  }
  function markup({data,mode='free',ready=true,dailyCompleted=0,dailyChallengeCompleted=null,longestStreak=0,expanded=false}){
    const challenges=dailyChallengeCompleted??(data?.daily?Object.values(data.daily).reduce((sum,row)=>sum+row.completed,0):dailyCompleted);
    const free=Object.values(data?.free||{}).reduce((sum,row)=>sum+row.completed,0);
    const value=n=>ready?number(n):'—';
    return `<section class="profile-ledger" aria-label="Herní statistiky"><div class="profile-stat-summary"><div><strong>${value(free)}</strong><span>volných desek</span></div><div><strong>${value(challenges)}</strong><span>denních výzev</span></div><div><strong>${value(longestStreak)}</strong><span>nejdelší série · dní</span></div></div><details class="profile-stats-details"${expanded?' open':''}><summary>Podrobné statistiky</summary><div class="profile-ledger-head"><div class="profile-ledger-switch" role="group" aria-label="Typ hry"><button type="button" data-stat-mode="free" aria-pressed="${mode==='free'}">Volná hra</button><button type="button" data-stat-mode="daily" aria-pressed="${mode==='daily'}">Denní a Extra</button></div><details class="profile-ledger-help"><summary aria-label="Jak se počítají statistiky">?</summary><p>Každá dohraná deska se počítá jednou, včetně starších desek. Převod postupu ani opakované hraní počet nezvyšuje. Denní výzvy zahrnují i Extra. Sérii udržuje jen základní výzva.<br><br>Čas je nejrychlejší z uložených prvních dokončení, včetně hry s nápovědou a klidného režimu. Neplatné a výslovně neověřené časy vynecháváme. Pomlčka znamená, že čas zatím nemáme.</p></details></div><div class="profile-ledger-panel" aria-live="polite" aria-atomic="true">${panel(data,mode,ready)}</div></details></section>`;
  }
  function bind(element,options,onModeChange){
    if(!element)return;
    element.querySelectorAll('[data-stat-mode]').forEach(button=>button.addEventListener('click',()=>{
      const mode=button.dataset.statMode;if(!['free','daily'].includes(mode))return;
      element.querySelectorAll('[data-stat-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      element.querySelector('.profile-ledger-panel').innerHTML=panel(options.data,mode,options.ready);
      onModeChange?.(mode);
    }));
  }
  return {calculate,markup,bind,difficulties,formatTime};
});
