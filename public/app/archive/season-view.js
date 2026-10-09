/* Preview-only presentation of the monthly competition. No network or storage writes. */
(()=>{
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number=value=>new Intl.NumberFormat('cs-CZ').format(value);
  const badgeNames=['Vládce listopadu','Stříbrný listopad','Bronzový listopad'];
  const previousBadgeNames=['Vládce října','Stříbrný říjen','Bronzový říjen'];
  const scenes=new Set(['normal','tie','first','pending']);
  let scenario='normal';
  const people={
    lukas:{name:'Lukáš',avatar:'🦊'},
    klara:{name:'Klára',avatar:'🌺'},
    matej:{name:'Matěj',avatar:'🐉'},
    alex:{name:'Alex',avatar:'🦌'},
    eliska:{name:'Eliška',avatar:'🦉'},
    anna:{name:'Anna Marie Novotná',avatar:'🌺'}
  };
  const currentRows=[
    {rank:1,person:people.lukas,points:1660},
    {rank:2,person:people.klara,points:1580},
    {rank:3,person:people.matej,points:1480},
    {rank:4,person:people.alex,points:1360,mine:true},
    {rank:5,person:people.eliska,points:1320}
  ];

  function medal(place=1,options={}){
    const rank=Number(place);
    if(![1,2,3].includes(rank))throw new RangeError('Medal place must be 1, 2 or 3.');
    const month=options.month||'XI',year=options.year||2026;
    const asset=['medaile','medal-2','medal-3'][rank-1];
    const palette=[['#fff0cb','#b89450','#62451e'],['#edf0ec','#96a19a','#384741'],['#f7dfc6','#ad7752','#69402b']][rank-1];
    const edition=options.edition!==false;
    const title=options.label||(edition?`${rank}. místo · ${month} ${year}`:`${rank}. místo`);
    // All edition geometry lives in the SVG viewBox. It therefore scales with
    // the original illustration at 44px, 100px or 220px without text overflow.
    return `<svg xmlns="http://www.w3.org/2000/svg" class="sv-medal medal" data-place="${rank}" viewBox="0 0 160 ${edition?'180':'160'}"${edition?'':' style="aspect-ratio:1"'} role="img" aria-label="${escape(title)}" focusable="false"><image href="/rewards/printshop/${asset}.svg" x="4" y="${edition?'0':'4'}" width="152" height="152" preserveAspectRatio="xMidYMid meet"/>${edition?`<rect x="23" y="139" width="114" height="29" rx="5" fill="${palette[0]}" stroke="${palette[1]}" stroke-width="1.5"/><path d="M29 143H131" stroke="#fff" stroke-opacity=".45"/><text x="80" y="158" text-anchor="middle" fill="${palette[2]}" style="font:700 15px Outfit,sans-serif;letter-spacing:.25px">${escape(month)} · ${escape(year)}</text>`:''}</svg>`;
  }

  const avatar=(person,className='')=>`<span class="sv-avatar ${className}" data-player-avatar="${escape(person.avatar)}" aria-hidden="true">${escape(person.avatar)}</span>`;
  function previousGroups(){
    if(scenario==='first')return [];
    if(scenario==='tie')return [
      {rank:1,points:2400,players:[people.lukas,people.anna]},
      {rank:3,points:2380,players:[people.matej]}
    ];
    return [
      {rank:1,points:2400,players:[people.klara]},
      {rank:2,points:2380,players:[people.matej]},
      {rank:3,points:2360,players:[people.lukas]}
    ];
  }

  function winner(group){
    const shared=group.players.length>1;
    const names=group.players.map(player=>player.name).join(', ');
    return `<button type="button" class="sv-winner sv-winner--${group.rank}${shared?' sv-winner--shared':''}" data-season-winners="${group.rank}" aria-label="${escape(`${group.rank}. místo za říjen: ${names}. ${number(group.points)} bodů. Zobrazit ocenění.`)}"><span class="sv-winner-portraits">${group.players.slice(0,2).map(person=>avatar(person)).join('')}</span><strong class="sv-winner-name">${shared?group.players.map(person=>escape(person.name)).join('<span class="sv-name-divider"> a </span>'):escape(group.players[0].name)}</strong><span class="sv-winner-score">${number(group.points)} bodů</span><span class="sv-plinth">${medal(group.rank,{month:'X',label:previousBadgeNames[group.rank-1]+' 2026'})}<span class="sv-place">${shared?'Sdílené ':''}${group.rank}. místo</span></span></button>`;
  }

  function prizeGrid(){
    return `<div class="ax-prize-grid sv-prize-grid">${[1,2,3].map(rank=>`<button type="button" data-archive-badge="${rank}" aria-label="${escape(badgeNames[rank-1])}, listopad 2026. Zobrazit odznak.">${medal(rank,{label:badgeNames[rank-1]+' 2026'})}<strong>${badgeNames[rank-1]}</strong><span>${rank}. místo</span></button>`).join('')}</div>`;
  }

  function podium(){
    if(scenario==='first')return `<section class="sv-honours sv-honours--first" aria-labelledby="svHonoursTitle"><div class="sv-honours-heading"><p class="sv-period">První měsíční soutěž</p><h2 id="svHonoursTitle">Odznaky za listopad</h2><p class="sv-preview-label">Ukázka odměn · 2026</p></div>${prizeGrid()}<p class="sv-first-note">První vítěze tu uvidíš po skončení měsíce.</p></section>`;
    const groups=previousGroups();
    const ordered=[2,1,3].map(rank=>groups.find(group=>group.rank===rank)).filter(Boolean);
    const pending=scenario==='pending';
    return `<section class="sv-honours${scenario==='tie'?' sv-honours--shared':''}" aria-labelledby="svHonoursTitle"><div class="sv-honours-heading"><p class="sv-period">${pending?'Předběžné výsledky':'Vítězové minulého měsíce'}</p><h2 id="svHonoursTitle">Říjen 2026</h2><p class="sv-preview-label">Ukázkové výsledky${pending?' · čekají na potvrzení':''}</p></div><div class="sv-podium${ordered.length===2?' sv-podium--two':''}">${ordered.map(winner).join('')}</div>${pending?'<p class="sv-pending-note">Pořadí potvrdíme do 48 hodin po konci měsíce.</p>':''}${scenario==='tie'?'<p class="sv-tie-note">Dvě první místa. Další hráč je třetí.</p>':''}</section>`;
  }

  function ranking(){
    return `<section class="sv-ranking" aria-labelledby="svRankingTitle"><div class="sv-section-heading"><h2 id="svRankingTitle">Pořadí za listopad</h2><span>2026</span></div><p class="sv-ranking-note">Počítá se tvých 20 nejlepších denních výsledků.</p><ol class="sv-rank-list">${currentRows.map(row=>`<li class="sv-rank-row${row.mine?' sv-rank-row--mine':''}"${row.mine?' aria-label="Tvoje umístění: 4. místo, 1 360 bodů"':''}><span class="sv-rank-position">${row.rank}.</span>${avatar(row.person)}<strong>${escape(row.person.name)}${row.mine?'<small class="sv-you">ty</small>':''}</strong><span class="sv-rank-score">${number(row.points)} <small>b.</small></span></li>`).join('')}</ol></section>`;
  }

  function markup(){
    return `<div class="sv-page" data-season-scenario="${scenario}"><div class="sv-page-nav"><button type="button" class="sv-back" data-archive-action="rankings"><span aria-hidden="true">←</span> Zpět do Pořadí</button><button type="button" class="sv-rules-link" data-archive-action="season-rules">Pravidla</button></div><h1 class="sv-page-title">Měsíční soutěž</h1>${podium()}<section class="sv-current" aria-labelledby="svCurrentTitle"><div class="sv-section-heading"><h2 id="svCurrentTitle">Listopad 2026</h2><span>Právě soutěžíš</span></div><dl class="sv-stats"><div><dt>Pořadí</dt><dd>4.<small> místo</small></dd></div><div><dt>Body</dt><dd>1 360<small> b.</small></dd></div><div><dt>Dny</dt><dd>12<small> / 20</small></dd></div></dl><button type="button" class="primary-btn sv-play" data-archive-action="daily">Hrát Denní výzvu <span aria-hidden="true">→</span></button></section>${ranking()}${scenario==='first'?'':`<section class="sv-prizes" aria-labelledby="svPrizesTitle"><div class="sv-section-heading"><h2 id="svPrizesTitle">Odznaky za listopad</h2><span>2026</span></div>${prizeGrid()}<p class="sv-prize-note">Získaný odznak ti zůstane v profilu.</p></section>`}<p class="sv-demo-note">Ukázkoví hráči a výsledky. Měsíční soutěž zatím nebyla spuštěna.</p></div>`;
  }

  function rules(){
    return `<div class="sv-rules"><h2 id="axModalTitle">Pravidla měsíční soutěže</h2><ol><li><strong>Počítá se Denní výzva.</strong><p>Dokonči ji v den zveřejnění. Archiv, Volná hra ani celkové XP měsíční pořadí neovlivní.</p></li><li><strong>100 bodů za dokončení, dalších 20 bez nápovědy.</strong><p>Počítá se první platné dokončení. Rychlost řešení skóre neovlivní.</p></li><li><strong>Započítáme tvých 20 nejlepších dnů.</strong><p>Další lepší výsledek nahradí nejslabší započtený den. Maximum je 2 400 bodů.</p></li><li><strong>Při shodě bodů se o místo podělíte.</strong><p>Když mají dva hráči stejné nejvyšší skóre, jsou oba první. Další hráč je třetí. Odznak dostanou všichni na 1., 2. a 3. místě, i když jich bude víc než tři.</p></li><li><strong>Každý kalendářní měsíc začínáme od nuly.</strong><p>Soutěž běží podle středoevropského času, v létě podle letního. Po konci měsíce je ještě 48 hodin na kontrolu výsledků a reklamace. Potom odznak zůstane ve tvém profilu.</p></li></ol><p class="sv-rules-note">Odznaky nepřidávají XP ani výhodu v další soutěži.</p></div><button type="button" class="primary-btn big" data-archive-action="close">Rozumím</button>`;
  }

  function winnerDetail(rank){
    const group=previousGroups().find(item=>item.rank===Number(rank));
    if(!group)return `<h2 id="axModalTitle">Zatím bez vítězů</h2><p>První ocenění hráči se tu objeví po skončení měsíce.</p><button type="button" class="primary-btn big" data-archive-action="close">Zpět do soutěže</button>`;
    const pending=scenario==='pending';
    return `<div class="sv-winner-detail">${medal(group.rank,{month:'X',label:previousBadgeNames[group.rank-1]+' 2026'})}<h2 id="axModalTitle">${escape(previousBadgeNames[group.rank-1])}</h2><p class="sv-detail-period">Říjen 2026 · ${group.rank}. místo${pending?' · předběžně':''}</p><ul class="sv-detail-players">${group.players.map(person=>`<li>${avatar(person)}<strong>${escape(person.name)}</strong><span>${number(group.points)} b.</span></li>`).join('')}</ul>${group.players.length>1?'<p class="sv-detail-note">Stejné skóre, stejné místo. Tento odznak získává každý z nich.</p>':''}<p class="sv-preview-label">Ukázkoví vítězové${pending?' · pořadí ještě čeká na potvrzení':''}</p></div><button type="button" class="primary-btn big" data-archive-action="close">Zpět do soutěže</button>`;
  }

  function setScenario(value){
    if(!scenes.has(value))throw new RangeError('Unknown monthly competition preview scenario.');
    scenario=value;
    return markup();
  }

  window.PropletSeasonView={markup,medal,rules,winnerDetail,setScenario};
})();
