const APP_VERSION=window.PROPLET_RUNTIME_META?.version||'0.0.0';
const RANK_RULES='Čisté vyřešení → méně nápověd → čas → tahy';
const COLORS=['#ff9585','#68cfaa','#7ca8ff','#ffd064','#b295ff','#f391c3','#62cbd8','#ffad63','#a6d86d','#76c3ee','#da87e4','#66bea0'];
const AVATARS=['🙂','😎','🤓','🥳','🦊','🐱','🐶','🐼','🐯','🦁','🐸','🐵','🦄','🐲','🦖','🐙','🦉','🐝','🦋','🐧','🚀','⚡','🔥','🌈','🍕','⚽','🎮','🧩','🤯','👑'];
const SUPPORT_MODES={
 beginner:{icon:'🐣',label:'Brzy',desc:'Nabídne pomoc po 45 s bez nového slova.',idleMs:45000,seconds:45},
 younger:{icon:'🧒',label:'Vyváženě',desc:'Nabídne pomoc po 70 s bez nového slova.',idleMs:70000,seconds:70},
 older:{icon:'🎒',label:'Dát mi čas',desc:'Nabídne pomoc po 100 s bez nového slova.',idleMs:100000,seconds:100},
 none:{icon:'🧠',label:'Nenabízet',desc:'Pomocník sám pomoc nenabídne.',idleMs:0,seconds:0}
};
const WIN_PRAISE={
 easy:['A je to!','Pěkně.','Hotovo!','Hezky propleteno.','To sedlo.','Další je doma.'],
 medium:['Pěkná práce.','Je to tam!','Hotovo!','Hezky!','Další je doma.','To se povedlo.'],
 hard:['Těžká? Pro tebe ne!','Tohle se počítá.','Pěkný výkon.','Těžká je doma.','Krásná práce.','Tak tohle jo.'],
 hardcore:['Tak kdo s koho?','Fíha. Respekt.','Klobouk dolů!','Je po něm!','Tohle nebyla sranda.','Tvůj mozek odolal.'],
 mozkomor:['Hlubina zdolána.','Tohle už je jiná liga.','Mozkomor padl.','Neurony přežily.','Klobouk hodně dolů.','Endgame? Vyřízeno.']
};
const DIFF={
  easy:{label:'Snadná',icon:'/difficulty/easy.svg',desc:'6×6 · menší plocha a přehlednější cesty.',xp:15},
  medium:{label:'Střední',icon:'/difficulty/medium.svg',desc:'Postupně větší plocha · od přehledných cest k prvním zákrutám.',xp:25},
  hard:{label:'Těžká',icon:'/difficulty/hard.svg',desc:'8×8 až 9×9 · delší slova a ostré zákruty.',xp:50},
  hardcore:{label:'Mozkožrout',icon:'/difficulty/hardcore.svg',desc:'10×10 · dlouhá slova, šneci a minimum krátkých slov.',xp:100},
  mozkomor:{label:'Mozkomor',icon:'/difficulty/mozkomor.svg',desc:'10×10 · endgame pro hráče, kteří dokončili všechny Mozkožrouty.',xp:150}
};
const MOZKOMOR_UNLOCK_KEY='proplet-v4-01-32-mozkomor-unlocked';
const MOZKOMOR_UNLOCK_BASE=200;
const MOZKOMOR_QA_PRODUCTION_HOSTS=new Set(['proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
const MOZKOMOR_QA_HOST=location.hostname.endsWith('.vercel.app')&&location.hostname.includes('-git-')&&!MOZKOMOR_QA_PRODUCTION_HOSTS.has(location.hostname);
const MOZKOMOR_QA_PARAM=MOZKOMOR_QA_HOST?new URLSearchParams(location.search).get('mozkomor'):'';
const MOZKOMOR_QA_PREVIEW=MOZKOMOR_QA_PARAM==='final';
const isMozkomorQaDifficulty=diff=>MOZKOMOR_QA_PREVIEW&&diff==='mozkomor';
function difficultyIconMarkup(diff,className='difficulty-icon-img'){
 const d=DIFF[diff];return d?`<img class="${className}" src="${d.icon}" alt="" aria-hidden="true" draggable="false">`:'';
}
const BADGES=[
 {days:1,icon:'🥉',name:'První zářez'},{days:3,icon:'❤️',name:'Srdcař'},{days:5,icon:'⭐',name:'Pětka'},
 {days:7,icon:'🔥',name:'Týden v plamenech'},{days:10,icon:'🏆',name:'Desítka'},{days:14,icon:'⚡',name:'Blesk'},
 {days:21,icon:'🦉',name:'Mistr slov'},{days:30,icon:'👑',name:'Koruna'},{days:50,icon:'💎',name:'Diamant'},{days:100,icon:'🚀',name:'Legenda'}
];
const LEVELS=[
 {xp:0,icon:'🌱',name:'Nováček'},
 {xp:100,icon:'🧩',name:'Písmenkář'},
 {xp:250,icon:'🔎',name:'Slovolovec'},
 {xp:400,icon:'🧵',name:'Hledač nití'},
 {xp:600,icon:'🪢',name:'Propletač'},
 {xp:850,icon:'↪️',name:'Kličkař'},
 {xp:1100,icon:'🧭',name:'Mistr cest'},
 {xp:1450,icon:'♟️',name:'Slovní taktik'},
 {xp:1800,icon:'✨',name:'Slovní mág'},
 {xp:2200,icon:'🧶',name:'Uzlovač'},
 {xp:2700,icon:'👑',name:'Legenda Propletu'},
 {xp:3250,icon:'🛤️',name:'Cestář'},
 {xp:3850,icon:'🐉',name:'Krotitel'},
 {xp:4500,icon:'🌀',name:'Mistr zákrut'},
 {xp:5200,icon:'🧱',name:'Labyrintník'},
 {xp:6000,icon:'💎',name:'Velmistr Propletu'},
 {xp:6800,icon:'🥷',name:'Propletový ninja'},
 {xp:7700,icon:'⚗️',name:'Slovní alchymista'},
 {xp:8700,icon:'🐌',name:'Mistr šneků'},
 {xp:9700,icon:'🔮',name:'Mřížkový mág'},
 {xp:11000,icon:'🌌',name:'Nadslovník'},
 {xp:12500,icon:'🤯',name:'Krotitel Mozkožroutů'},
 {xp:14000,icon:'🏰',name:'Král mřížky'},
 {xp:15800,icon:'🎓',name:'Arcimistr Propletu'},
 {xp:18300,icon:'🪄',name:'Slovočaroděj'},
 {xp:21500,icon:'🗿',name:'Propletový titán'},
 {xp:25000,icon:'♾️',name:'Mistr nekonečna'},
 {xp:30000,icon:'🌠',name:'Hvězdný propletač'},
 {xp:35000,icon:'🛰️',name:'Orbitální luštitel'},
 {xp:42000,icon:'🚀',name:'Galaktický slovolovec'},
 {xp:50500,icon:'🛡️',name:'Strážce všech cest'},
 {xp:61000,icon:'🏆',name:'Absolutní Propletač'},
 {xp:75000,icon:'🗝️',name:'Strážce tajných cest'},
 {xp:95000,icon:'🕸️',name:'Architekt labyrintu'},
 {xp:120000,icon:'🌌',name:'Legenda beze konce'}
];
const ACHIEVEMENT_GROUPS=[
 ['general','Celkový postup'],['easy','Snadná'],['medium','Střední'],['hard','Těžká'],['hardcore','Mozkožrout'],
 ['daily','Denní výzva'],['tajenka','Tajenka'],['mozkomor','Mozkomor'],['discovery','Objevená slova'],
 ['clean','Čistá řešení'],['cleanDaily','Čisté Daily'],['xp','XP'],['speed','Rychlost'],['rescue','Záchrana série']
];
const ACHIEVEMENTS=[
 {id:'all-1',group:'general',icon:'🧩',name:'První Proplet',desc:'Vyřeš první úlohu',value:s=>s.totalCompleted||0,target:1},
 {id:'all-5',group:'general',icon:'🖐️',name:'Pětka v kapse',desc:'Vyřeš 5 úloh',value:s=>s.totalCompleted||0,target:5},
 {id:'all-10',group:'general',icon:'🔟',name:'Rozjezd',desc:'Vyřeš 10 úloh',value:s=>s.totalCompleted||0,target:10},
 {id:'all-25',group:'general',icon:'🎯',name:'Čtvrtsto',desc:'Vyřeš 25 úloh',value:s=>s.totalCompleted||0,target:25},
 {id:'all-50',group:'general',icon:'🛤️',name:'Půl stovky',desc:'Vyřeš 50 úloh',value:s=>s.totalCompleted||0,target:50},
 {id:'all-100',group:'general',icon:'💯',name:'Stovka úloh',desc:'Vyřeš 100 úloh',value:s=>s.totalCompleted||0,target:100},
 {id:'all-250',group:'general',icon:'🚂',name:'Nezastavitelný',desc:'Vyřeš 250 úloh',value:s=>s.totalCompleted||0,target:250},
 {id:'all-400',group:'general',icon:'🏃',name:'Propletový maratonec',desc:'Vyřeš 400 úloh',value:s=>s.totalCompleted||0,target:400},
 {id:'all-800',group:'general',icon:'🌌',name:'Nekonečný propletač',desc:'Vyřeš 800 úloh',value:s=>s.totalCompleted||0,target:800},

 {id:'easy-1',group:'easy',icon:'🌱',name:'První klíček',desc:'Dokonči první Snadnou',value:s=>s.freeCompleted?.easy||0,target:1},
 {id:'easy-10',group:'easy',icon:'🌿',name:'Rozcvička',desc:'Dokonči 10 Snadných',value:s=>s.freeCompleted?.easy||0,target:10},
 {id:'easy-25',group:'easy',icon:'🍀',name:'Lehká váha',desc:'Dokonči 25 Snadných',value:s=>s.freeCompleted?.easy||0,target:25},
 {id:'easy-50',group:'easy',icon:'🌳',name:'Půlka zahrady',desc:'Dokonči 50 Snadných',value:s=>s.freeCompleted?.easy||0,target:50},
 {id:'easy-100',group:'easy',icon:'🏡',name:'Zelený velmistr',desc:'Dokonči 100 Snadných',value:s=>s.freeCompleted?.easy||0,target:100},
 {id:'easy-200',group:'easy',icon:'🌲',name:'Vládce zelené banky',desc:'Dokonči 200 Snadných',value:s=>s.freeCompleted?.easy||0,target:200},

 {id:'medium-1',group:'medium',icon:'🧠',name:'Hlavička',desc:'Dokonči první Střední',value:s=>s.freeCompleted?.medium||0,target:1},
 {id:'medium-10',group:'medium',icon:'🤔',name:'Mozkovna',desc:'Dokonči 10 Středních',value:s=>s.freeCompleted?.medium||0,target:10},
 {id:'medium-25',group:'medium',icon:'🧐',name:'Přemýšlivec',desc:'Dokonči 25 Středních',value:s=>s.freeCompleted?.medium||0,target:25},
 {id:'medium-50',group:'medium',icon:'🧬',name:'Šedá kůra',desc:'Dokonči 50 Středních',value:s=>s.freeCompleted?.medium||0,target:50},
 {id:'medium-100',group:'medium',icon:'🎓',name:'Mistr středu',desc:'Dokonči 100 Středních',value:s=>s.freeCompleted?.medium||0,target:100},
 {id:'medium-200',group:'medium',icon:'🧬',name:'Dvojitá mozkovna',desc:'Dokonči 200 Středních',value:s=>s.freeCompleted?.medium||0,target:200},

 {id:'hard-1',group:'hard',icon:'🧨',name:'Odvážlivec',desc:'Dokonči první Těžkou',value:s=>s.freeCompleted?.hard||0,target:1},
 {id:'hard-5',group:'hard',icon:'💥',name:'Rozbuška',desc:'Dokonči 5 Těžkých',value:s=>s.freeCompleted?.hard||0,target:5},
 {id:'hard-10',group:'hard',icon:'🦾',name:'Nebojácný',desc:'Dokonči 10 Těžkých',value:s=>s.freeCompleted?.hard||0,target:10},
 {id:'hard-25',group:'hard',icon:'⛏️',name:'Těžká práce',desc:'Dokonči 25 Těžkých',value:s=>s.freeCompleted?.hard||0,target:25},
 {id:'hard-50',group:'hard',icon:'🗿',name:'Ocelová hlava',desc:'Dokonči 50 Těžkých',value:s=>s.freeCompleted?.hard||0,target:50},
 {id:'hard-100',group:'hard',icon:'🏆',name:'Demoliční četa',desc:'Dokonči 100 Těžkých',value:s=>s.freeCompleted?.hard||0,target:100},
 {id:'hard-200',group:'hard',icon:'⚒️',name:'Nezničitelná hlava',desc:'Dokonči 200 Těžkých',value:s=>s.freeCompleted?.hard||0,target:200},

 {id:'hc-1',group:'hardcore',icon:'🤯',name:'Mozkožrout',desc:'Dokonči první Mozkožrout',value:s=>s.freeCompleted?.hardcore||0,target:1},
 {id:'hc-5',group:'hardcore',icon:'🍽️',name:'Nakrmil Mozkožrouta',desc:'Dokonči 5 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:5},
 {id:'hc-10',group:'hardcore',icon:'🔥',name:'Neurony v plamenech',desc:'Dokonči 10 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:10},
 {id:'hc-25',group:'hardcore',icon:'🐌',name:'Požírač šneků',desc:'Dokonči 25 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:25},
 {id:'hc-50',group:'hardcore',icon:'🧠',name:'Mozkový kulturista',desc:'Dokonči 50 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:50},
 {id:'hc-100',group:'hardcore',icon:'👑',name:'Mozkožroutí král',desc:'Dokonči 100 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:100},
 {id:'hc-200',group:'hardcore',icon:'🧠',name:'Mozkožroutí nesmrtelný',desc:'Dokonči 200 Mozkožroutů',value:s=>s.freeCompleted?.hardcore||0,target:200},

 {id:'daily-1',group:'daily',icon:'☀️',name:'Dnešní dávka',desc:'Dokonči první Denní výzvu',value:s=>s.dailyCompleted||0,target:1},
 {id:'daily-3',group:'daily',icon:'🌤️',name:'Tři slunce',desc:'Dokonči 3 Denní výzvy',value:s=>s.dailyCompleted||0,target:3},
 {id:'daily-7',group:'daily',icon:'📅',name:'Týdenní hráč',desc:'Dokonči 7 Denních výzev',value:s=>s.dailyCompleted||0,target:7},
 {id:'daily-14',group:'daily',icon:'🗓️',name:'Dva týdny',desc:'Dokonči 14 Denních výzev',value:s=>s.dailyCompleted||0,target:14},
 {id:'daily-30',group:'daily',icon:'🌞',name:'Měsíčník',desc:'Dokonči 30 Denních výzev',value:s=>s.dailyCompleted||0,target:30},
 {id:'daily-50',group:'daily',icon:'🌻',name:'Sluneční sběratel',desc:'Dokonči 50 Denních výzev',value:s=>s.dailyCompleted||0,target:50},
 {id:'daily-100',group:'daily',icon:'💯',name:'Stovka rán',desc:'Dokonči 100 Denních výzev',value:s=>s.dailyCompleted||0,target:100},
 {id:'daily-200',group:'daily',icon:'🧭',name:'Kalendářní démon',desc:'Dokonči 200 Denních výzev',value:s=>s.dailyCompleted||0,target:200},
 {id:'daily-365',group:'daily',icon:'🌍',name:'Celý rok',desc:'Dokonči 365 Denních výzev',value:s=>s.dailyCompleted||0,target:365},

 {id:'tajenka-1',group:'tajenka',icon:'✦',name:'První tajemství',desc:'Odhal první Tajenku',value:s=>s.tajenkaCompleted||0,target:1},
 {id:'tajenka-3',group:'tajenka',icon:'🗝️',name:'Čtenář mezi řádky',desc:'Odhal 3 Tajenky',value:s=>s.tajenkaCompleted||0,target:3},
 {id:'tajenka-5',group:'tajenka',icon:'💭',name:'Sběratel myšlenek',desc:'Odhal 5 Tajenek',value:s=>s.tajenkaCompleted||0,target:5},
 {id:'tajenka-10',group:'tajenka',icon:'📜',name:'Mistr skrytých vět',desc:'Odhal 10 Tajenek',value:s=>s.tajenkaCompleted||0,target:10},

 {id:'mozkomor-1',group:'mozkomor',icon:'🕳️',name:'Vstup do Hlubiny',desc:'Dokonči první Mozkomor',value:s=>s.mozkomorCompleted||0,target:1},
 {id:'mozkomor-5',group:'mozkomor',icon:'🧠',name:'Pětkrát bez milosti',desc:'Dokonči 5 Mozkomorů',value:s=>s.mozkomorCompleted||0,target:5},
 {id:'mozkomor-10',group:'mozkomor',icon:'🌀',name:'Krotitel chaosu',desc:'Dokonči 10 Mozkomorů',value:s=>s.mozkomorCompleted||0,target:10},
 {id:'mozkomor-25',group:'mozkomor',icon:'🕸️',name:'Pán zákrut',desc:'Dokonči 25 Mozkomorů',value:s=>s.mozkomorCompleted||0,target:25},
 {id:'mozkomor-50',group:'mozkomor',icon:'⚙️',name:'Neuron z ocele',desc:'Dokonči 50 Mozkomorů',value:s=>s.mozkomorCompleted||0,target:50},
 {id:'mozkomor-100',group:'mozkomor',icon:'👁️',name:'Mozkomorova Nemesis',desc:'Dokonči všech 100 Mozkomorů',value:s=>s.mozkomorCompleted||0,target:100},

 {id:'discovery-1',group:'discovery',icon:'👍',name:'Slovo navíc',desc:'Objev první platné vedlejší slovo',value:s=>s.discoveredWords||0,target:1},
 {id:'discovery-10',group:'discovery',icon:'🌿',name:'Boční stezka',desc:'Objev 10 různých vedlejších slov',value:s=>s.discoveredWords||0,target:10},
 {id:'discovery-50',group:'discovery',icon:'🔦',name:'Lovec skrytých slov',desc:'Objev 50 různých vedlejších slov',value:s=>s.discoveredWords||0,target:50},
 {id:'discovery-100',group:'discovery',icon:'🏺',name:'Slovní archeolog',desc:'Objev 100 různých vedlejších slov',value:s=>s.discoveredWords||0,target:100},

 {id:'clean-1',group:'clean',icon:'✨',name:'Bez berliček',desc:'Vyřeš první úlohu bez nápovědy',value:s=>s.cleanSolves||0,target:1},
 {id:'clean-5',group:'clean',icon:'🫧',name:'Čistá pětka',desc:'5 čistých řešení',value:s=>s.cleanSolves||0,target:5},
 {id:'clean-10',group:'clean',icon:'🧼',name:'Čistá desítka',desc:'10 čistých řešení',value:s=>s.cleanSolves||0,target:10},
 {id:'clean-25',group:'clean',icon:'💎',name:'Bez nápovědy',desc:'25 čistých řešení',value:s=>s.cleanSolves||0,target:25},
 {id:'clean-50',group:'clean',icon:'🦅',name:'Samostatný mozek',desc:'50 čistých řešení',value:s=>s.cleanSolves||0,target:50},
 {id:'clean-100',group:'clean',icon:'🪞',name:'Čistokrevný propletač',desc:'100 čistých řešení',value:s=>s.cleanSolves||0,target:100},
 {id:'clean-250',group:'clean',icon:'🧙',name:'Nápovědy jsou pro ostatní',desc:'250 čistých řešení',value:s=>s.cleanSolves||0,target:250},

 {id:'cd-1',group:'cleanDaily',icon:'🌅',name:'Čisté slunce',desc:'Denní výzva čistě',value:s=>s.cleanDaily||0,target:1},
 {id:'cd-7',group:'cleanDaily',icon:'🌈',name:'Sedm čistých rán',desc:'7 Denních výzev čistě',value:s=>s.cleanDaily||0,target:7},
 {id:'cd-30',group:'cleanDaily',icon:'☀️',name:'Čistý měsíc',desc:'30 Denních výzev čistě',value:s=>s.cleanDaily||0,target:30},
 {id:'cd-100',group:'cleanDaily',icon:'🌟',name:'Sluneční purista',desc:'100 Denních výzev čistě',value:s=>s.cleanDaily||0,target:100},

 {id:'xp-100',group:'xp',icon:'💯',name:'První stovka XP',desc:'Nasbírej 100 XP',value:s=>s.points||0,target:100},
 {id:'xp-500',group:'xp',icon:'🪙',name:'Sběrač XP',desc:'Nasbírej 500 XP',value:s=>s.points||0,target:500},
 {id:'xp-1000',group:'xp',icon:'💰',name:'Tisícovka',desc:'Nasbírej 1 000 XP',value:s=>s.points||0,target:1000},
 {id:'xp-2500',group:'xp',icon:'🎒',name:'Pokladnice',desc:'Nasbírej 2 500 XP',value:s=>s.points||0,target:2500},
 {id:'xp-5000',group:'xp',icon:'🏦',name:'Pět tisíc',desc:'Nasbírej 5 000 XP',value:s=>s.points||0,target:5000},
 {id:'xp-10000',group:'xp',icon:'🔢',name:'Pěticiferný',desc:'Nasbírej 10 000 XP',value:s=>s.points||0,target:10000},
 {id:'xp-25000',group:'xp',icon:'💸',name:'XP magnát',desc:'Nasbírej 25 000 XP',value:s=>s.points||0,target:25000},
 {id:'xp-40000',group:'xp',icon:'🛡️',name:'Čtyřicet tisíc cest',desc:'Nasbírej 40 000 XP',value:s=>s.points||0,target:40000},
 {id:'xp-50000',group:'xp',icon:'🚀',name:'Padesátitisícový let',desc:'Nasbírej 50 000 XP',value:s=>s.points||0,target:50000},
 {id:'xp-61000',group:'xp',icon:'🏆',name:'Absolutní sběratel',desc:'Nasbírej 61 000 XP',value:s=>s.points||0,target:61000},
 {id:'xp-75000',group:'xp',icon:'🗝️',name:'Klíč ke všem cestám',desc:'Nasbírej 75 000 XP',value:s=>s.points||0,target:75000},
 {id:'xp-95000',group:'xp',icon:'🕸️',name:'Architekt XP',desc:'Nasbírej 95 000 XP',value:s=>s.points||0,target:95000},
 {id:'xp-120000',group:'xp',icon:'🌌',name:'Za hranicí mřížky',desc:'Nasbírej 120 000 XP',value:s=>s.points||0,target:120000},

 {id:'speed-300',group:'speed',icon:'🏃',name:'Pohodový sprint',desc:'Denní výzva pod 5 minut',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<300000?1:0,target:1},
 {id:'speed-180',group:'speed',icon:'💨',name:'Svižník',desc:'Denní výzva pod 3 minuty',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<180000?1:0,target:1},
 {id:'speed-120',group:'speed',icon:'⚡',name:'Rychlík',desc:'Denní výzva pod 2 minuty',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<120000?1:0,target:1},
 {id:'speed-60',group:'speed',icon:'🚀',name:'Blesk',desc:'Denní výzva pod 1 minutu',value:s=>s.bestDailyMs!=null&&s.bestDailyMs<60000?1:0,target:1},

 {id:'rescue-1',group:'rescue',icon:'🛟',name:'Ne dnes, série!',desc:'Poprvé zachraň sérii',value:s=>s.rescuedDays||0,target:1},
 {id:'rescue-3',group:'rescue',icon:'🚒',name:'Záchranář',desc:'Zachraň sérii 3×',value:s=>s.rescuedDays||0,target:3},
 {id:'rescue-5',group:'rescue',icon:'🐈',name:'Devět životů',desc:'Zachraň sérii 5×',value:s=>s.rescuedDays||0,target:5},
 {id:'rescue-10',group:'rescue',icon:'🧯',name:'Hasící přístroj',desc:'Zachraň sérii 10×',value:s=>s.rescuedDays||0,target:10}
];
ACHIEVEMENTS.forEach(a=>a.test=s=>a.value(s)>=a.target);
function achievementCard(a,stats){const v=Math.max(0,a.value(stats)||0),pct=Math.min(100,Math.round(v/a.target*100)),done=a.test(stats);return `<div class="achievement ${done?'earned':''}"><span class="emoji">${a.icon}</span><strong>${a.name}</strong><small>${a.desc}</small><div class="achievement-progress"><span style="width:${pct}%"></span></div><em>${done?'Splněno ✓':`${Math.min(v,a.target)}/${a.target}`}</em></div>`}
function renderAchievements(stats){return ACHIEVEMENT_GROUPS.map(([id,label])=>{const list=ACHIEVEMENTS.filter(a=>a.group===id);if(!list.length)return '';const earned=list.filter(a=>a.test(stats)).length;return `<section class="achievement-group"><div class="achievement-group-head"><strong>${label}</strong><span>${earned}/${list.length}</span></div><div class="achievement-grid">${list.map(a=>achievementCard(a,stats)).join('')}</div></section>`}).join('')}
let profileAchievementsExpanded=false;
function achievementProgressState(a,stats){const value=Math.max(0,a.value(stats)||0),done=a.test(stats),pct=Math.min(100,Math.round(value/a.target*100));return {a,value,done,pct}}
function renderAchievementSummary(stats){
 const states=ACHIEVEMENTS.map(a=>achievementProgressState(a,stats)),earned=states.filter(x=>x.done),pending=states.filter(x=>!x.done).sort((a,b)=>b.pct-a.pct||a.a.target-b.a.target),earnedLimit=pending.length?Math.min(4,earned.length):Math.min(8,earned.length),preview=[...earned.slice(-earnedLimit),...pending.slice(0,8-earnedLimit)],pct=states.length?Math.round(earned.length/states.length*100):0,closest=pending[0];
 return `<div class="achievement-summary-copy"><div><strong>${earned.length} z ${states.length} splněno</strong><small>${closest?`Nejblíž: ${esc(closest.a.name)} · ${Math.min(closest.value,closest.a.target)}/${closest.a.target}`:'Všechny úspěchy jsou tvoje. Respekt!'}</small></div><span>${pct}%</span></div><div class="achievement-summary-progress"><span style="width:${pct}%"></span></div><div class="achievement-summary-icons">${preview.map(x=>`<span class="achievement-peek ${x.done?'earned':'next'}" title="${esc(x.a.name)}" aria-label="${esc(x.a.name)}${x.done?', splněno':''}"><b>${x.a.icon}</b>${x.done?'<i>✓</i>':''}</span>`).join('')}</div>`;
}
function syncAchievementDisclosure(){const button=$('#achievementToggleBtn'),details=$('#achievementDetails');if(!button||!details)return;details.hidden=!profileAchievementsExpanded;button.setAttribute('aria-expanded',String(profileAchievementsExpanded));button.innerHTML=profileAchievementsExpanded?'Sbalit <span>⌃</span>':'Zobrazit vše <span>⌄</span>'}
function focusProfileRoadmap(){requestAnimationFrame(()=>{const rail=$('#levelRoadmap'),current=rail?.querySelector('.current');if(!rail||!current)return;const max=Math.max(0,rail.scrollWidth-rail.clientWidth),target=current.offsetLeft-(rail.clientWidth-current.offsetWidth)/2;rail.scrollLeft=Math.max(0,Math.min(max,target))})}
const SHARE_URL=typeof location!=='undefined'?`${location.origin}/`:'https://proplet-nine.vercel.app/';
const STORE_KEY='proplet-v2-state';
const PROFILE_KEY='proplet-v2-profile';
const QUEUE_KEY='proplet-v2-sync-queue';
const REJECTED_QUEUE_KEY='proplet-v4-rejected-sync-queue';
const SETTINGS_KEY='proplet-v3-settings';
const ONBOARD_KEY='proplet-v3-7-required-onboarding';
const SUPPORT_MODE_KEY='proplet-v3-16-2-helper-mode';
const HELPER_ONBOARD_KEY='proplet-v3-16-2-helper-onboarding';
const ACCOUNT_NUDGE_KEY='proplet-v3-5-account-nudge';
const PROGRESS_GUARD_KEY='proplet-v4-01-4-progress-guard';
const ANALYTICS_SESSION_KEY='proplet-analytics-session-v1';
const PUSH_NUDGE_KEY='proplet-v3-8-2-push-nudge';
const INSTALL_NUDGE_KEY='proplet-v3-26-install-nudge';
const ANON_ID_KEY='proplet-v3-15-anonymous-id';
const RESCUE_OFFER_KEY='proplet-v3-19-2-rescue-offer';
const TAJENKA_STATE_KEY='proplet-tajenka-test-v1';
const TAJENKA_VIEW_KEY='proplet-tajenka-test-viewed-v1';
const TAJENKA_REWARD_XP=200;
const ACCOUNT_NUDGE_THRESHOLDS=[1,4,10];
const PROGRESS_GUARD_COOLDOWN_MS=14*24*60*60*1000;
const PROGRESS_GUARD_MOBILE_AWAY_MS=20*1000;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let puzzleDB=null;
let GEN4_CANDIDATE_PREVIEW=false;
let currentScreen='daily';
let runtimeUpdateRequired=false;
let currentGame=null;
let timerId=null;
let leaderTab='daily';
let leagueScope='family';
let globalWeekOffset=0;
let globalLeagueData=null;
let rankingXpScope='players';
let rankingXpPeriod='today';
let rankingDailyScope='players';
let winDailyGlobalData=null;
let audioCtx=null;
let toastTimer=null;
let syncState={status:'idle',error:null,lastAt:null};
let accountMode='login';
let rescueStatus=null;
let onboardingStep=0;
let tutorialState={dragging:false,path:[],done:false};
let onboardingTutorialTracked=false;
let onboardingSupportTracked=false;
let pendingSW=null;
let canonicalUpdateTarget=null;
let runtimeRecoveryBusy=false;
let releaseProbeBusy=false;
let lastReleaseProbeAt=0;
let reloadOnServiceWorkerChange=false;
let winFeedbackSent=false;
let pendingPostWinAction=null;
let pendingPushPostWinAction=null;
let pendingInstallPostWinAction=null;
let installModalManual=false;
let deferredInstallPrompt=null;
let postWinEngagementNudgeShown=false;
let profileModalFromNudge=false;
let profileModalFromWin=false;
let leagueCreateMode='join';
let leaguesCache=[];
let onboardingMandatory=false;
let onboardingFocusedHelper=false;
let onboardingSupportMode=null;
let supportModeDraft='none';
let accountNudgeStage=0;
let progressGuardHiddenAt=0;
let legacyTeamLogin=false;
let teamMembershipMode='join';
let levelDetailContext=null;
let pushUiBusy=false;
let gameWakeLock=null;

function blankState(){return {completed:{},rescues:{},inProgress:{},dailyDates:[],statsVersion:5};}
function getProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function getAnonymousId(){
 let id=localStorage.getItem(ANON_ID_KEY);if(id)return id;
 try{id=crypto.randomUUID()}catch{id=`anon-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}
 localStorage.setItem(ANON_ID_KEY,id);return id;
}
function rotateAnonymousId(){localStorage.removeItem(ANON_ID_KEY);return getAnonymousId()}
function playerScope(){return getProfile()?.id||'guest'}
function scopedStorageKey(base,scope=playerScope()){return `${base}:${scope}`}
function getState(){try{return {...blankState(),...JSON.parse(localStorage.getItem(scopedStorageKey(STORE_KEY))||'{}')}}catch{return blankState()}}
function saveState(s){localStorage.setItem(scopedStorageKey(STORE_KEY),JSON.stringify(s))}
function saveProfile(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));updateProfileChip()}
function validSupportMode(mode){return Object.prototype.hasOwnProperty.call(SUPPORT_MODES,mode)}
function localSupportMode(){try{const mode=localStorage.getItem(SUPPORT_MODE_KEY);return validSupportMode(mode)?mode:null}catch{return null}}
function rememberSupportMode(mode){if(validSupportMode(mode))try{localStorage.setItem(SUPPORT_MODE_KEY,mode)}catch{}}
function getQueue(){try{return JSON.parse(localStorage.getItem(scopedStorageKey(QUEUE_KEY))||'[]')}catch{return []}}
function saveQueue(q){localStorage.setItem(scopedStorageKey(QUEUE_KEY),JSON.stringify(q))}
function quarantineRejectedResult(row,reason){
 try{
  const key=scopedStorageKey(REJECTED_QUEUE_KEY),parsed=JSON.parse(localStorage.getItem(key)||'[]'),old=Array.isArray(parsed)?parsed:[],id=row?.attemptId||`${row?.challengeKey||''}:${row?.completedAt||''}`;
  if(!old.some(item=>(item?.attemptId||`${item?.challengeKey||''}:${item?.completedAt||''}`)===id))old.push({...row,rejectedAt:new Date().toISOString(),rejectedReason:reason||'Neznámá úloha',rejectedByVersion:APP_VERSION});
  localStorage.setItem(key,JSON.stringify(old.slice(-20)));
  return true;
 }catch{return false}
}
function obsoleteQueuedResultError(error){return Number(error?.status)===400&&error?.message==='Neznámá úloha'}
function migrateScopedStorage(){
 const marker='proplet-v3-9-scoped-storage';if(localStorage.getItem(marker))return;const scope=playerScope();
 const legacyState=localStorage.getItem(STORE_KEY),legacyQueue=localStorage.getItem(QUEUE_KEY);
 if(legacyState&&!localStorage.getItem(scopedStorageKey(STORE_KEY,scope)))localStorage.setItem(scopedStorageKey(STORE_KEY,scope),legacyState);
 if(legacyQueue&&!localStorage.getItem(scopedStorageKey(QUEUE_KEY,scope)))localStorage.setItem(scopedStorageKey(QUEUE_KEY,scope),legacyQueue);
 localStorage.setItem(marker,'1');
}
function adoptGuestData(profileId){
 const guestStateKey=scopedStorageKey(STORE_KEY,'guest'),guestQueueKey=scopedStorageKey(QUEUE_KEY,'guest'),playerStateKey=scopedStorageKey(STORE_KEY,profileId),playerQueueKey=scopedStorageKey(QUEUE_KEY,profileId);
 try{const guest={...blankState(),...JSON.parse(localStorage.getItem(guestStateKey)||'{}')},player={...blankState(),...JSON.parse(localStorage.getItem(playerStateKey)||'{}')};for(const [k,r] of Object.entries(guest.completed||{}))player.completed[k]=player.completed[k]?firstResult(player.completed[k],r):r;for(const [k,r] of Object.entries(guest.inProgress||{}))if(!player.completed[k]&&!player.inProgress[k])player.inProgress[k]=r;player.rescues={...(player.rescues||{}),...(guest.rescues||{})};localStorage.setItem(playerStateKey,JSON.stringify(player))}catch{}
 try{const gq=JSON.parse(localStorage.getItem(guestQueueKey)||'[]'),pq=JSON.parse(localStorage.getItem(playerQueueKey)||'[]');const ids=new Set(pq.map(r=>r.attemptId||`${r.challengeKey}:${r.completedAt}`));for(const r of gq){const id=r.attemptId||`${r.challengeKey}:${r.completedAt}`;if(!ids.has(id)){pq.push(r);ids.add(id)}}localStorage.setItem(playerQueueKey,JSON.stringify(pq))}catch{}
 localStorage.removeItem(guestStateKey);localStorage.removeItem(guestQueueKey);
}
const THEME_MODES=new Set(['auto','light','dark']);
const THEME_COLORS={light:'#6c5ce7',dark:'#111019'};
function normalizeThemeMode(mode){return THEME_MODES.has(mode)?mode:'auto'}
function getSettings(){try{const s={sound:true,haptics:true,wakeLock:true,magnifier:true,theme:'auto',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};s.theme=normalizeThemeMode(s.theme);s.magnifier=s.magnifier!==false;return s}catch{return {sound:true,haptics:true,wakeLock:true,magnifier:true,theme:'auto'}}}
function saveSettings(s){s.theme=normalizeThemeMode(s.theme);s.magnifier=s.magnifier!==false;localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
function resolvedTheme(mode=getSettings().theme){mode=normalizeThemeMode(mode);if(mode==='dark')return 'dark';if(mode==='light')return 'light';return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'}
function applyTheme(mode=getSettings().theme,{persist=false}={}){
 mode=normalizeThemeMode(mode);if(persist){const s=getSettings();s.theme=mode;saveSettings(s)}
 const resolved=resolvedTheme(mode),root=document.documentElement;root.dataset.theme=resolved;root.dataset.themePreference=mode;root.style.colorScheme=resolved;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',THEME_COLORS[resolved]);
 renderThemeSettings();return resolved;
}
function renderThemeSettings(){
 const s=getSettings(),resolved=resolvedTheme(s.theme);$$('[data-theme-mode]').forEach(b=>{const active=b.dataset.themeMode===s.theme;b.classList.toggle('active',active);b.setAttribute('aria-checked',active?'true':'false')});
 const note=$('#themeModeNote');if(note){const labels={light:'světlý',dark:'tmavý'};note.textContent=s.theme==='auto'?`Teď používáme ${labels[resolved]} režim podle nastavení zařízení.`:s.theme==='dark'?'Tmavý režim je zapnutý jen na tomto zařízení.':'Světlý režim je zapnutý jen na tomto zařízení.'}
}

function fmtTime(ms){if(ms==null)return '—';const sec=Math.floor(ms/1000),m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function czPlural(n,one,few,many){const a=Math.abs(Number(n)||0);return a===1?one:(a>=2&&a<=4?few:many)}
function countCz(n,one,few,many){return `${n} ${czPlural(n,one,few,many)}`}
function stableTextIndex(seed,size){let h=2166136261;for(const ch of String(seed||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return size?(h>>>0)%size:0}
function completionPraise(difficulty,rec={}){
 const pool=WIN_PRAISE[difficulty]||WIN_PRAISE.medium,seed=rec.attemptId||`${rec.puzzleId||''}:${rec.completedAt||''}:${rec.elapsedMs||0}:${rec.moves||0}`;
 return {title:pool[stableTextIndex(seed,pool.length)],line:''};
}
function renderCompletionPraise(difficulty,rec){const praise=completionPraise(difficulty,rec);$('#winTitle').textContent=praise.title;$('#winPraise').textContent='';$('#winPraise').classList.add('hidden')}
function configureWinReplay(mode,date,rec){const button=$('#winReplayBtn');if(!button)return;if(mode!=='daily'){button.classList.add('hidden');return}const active=dailyPuzzleFor(date),upgrade=!!rec?.puzzleId&&rec.puzzleId!==active.id;button.classList.remove('hidden');button.textContent=upgrade?'↻ Nová výzva':'↻ Znovu';button.dataset.dailyDate=date;button.dataset.dailyUpgrade=upgrade?'1':'0'}
function resultRankTuple(r){const elapsed=Number(r?.elapsedMs??1e15);return [r?.cleanSolve===true?0:1,Number(r?.hintsUsed??99),Math.floor(elapsed/1000),Number(r?.moves??1e9)]}
function betterResult(a,b){if(!a)return b;if(!b)return a;const x=resultRankTuple(a),y=resultRankTuple(b);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return y[i]<x[i]?b:a}return a}
function firstResult(a,b){
 if(!a)return b;if(!b)return a;
 const ta=Date.parse(a.completedAt||'')||Number.MAX_SAFE_INTEGER,tb=Date.parse(b.completedAt||'')||Number.MAX_SAFE_INTEGER;
 return tb<ta?b:a;
}
function sortedFreeBank(diff){return [...(puzzleDB?.free?.[diff]||[])].sort((a,b)=>(a.meta?.level||9999)-(b.meta?.level||9999)||(a.meta?.difficultyScore||0)-(b.meta?.difficultyScore||0))}
function freePuzzleSlot(puzzleId,diffHint=null){
 if(!puzzleId||!puzzleDB)return null;const diffs=diffHint&&DIFF[diffHint]?[diffHint]:Object.keys(DIFF);
 for(const diff of diffs){const active=puzzleDB.free?.[diff]||[];for(let i=0;i<active.length;i++){const p=active[i];if(p.id===puzzleId)return {difficulty:diff,level:Number(p.meta?.level)||i+1,generation:Number(p.meta?.contentGeneration)||Number(puzzleDB.freeGeneration)||1,legacy:false,puzzle:p}}}
 const indexed=puzzleDB.legacyFreeIndex?.[puzzleId];if(indexed&&(!diffHint||indexed.difficulty===diffHint))return {difficulty:indexed.difficulty,level:Number(indexed.level)||0,generation:Number(indexed.generation)||1,legacy:true,puzzle:null};
 for(const diff of diffs){const legacy=puzzleDB.legacyFree?.[diff]||[];for(let i=legacy.length-1;i>=0;i--){const p=legacy[i];if(p.id===puzzleId)return {difficulty:diff,level:Number(p.meta?.level)||i+1,generation:Number(p.meta?.contentGeneration)||1,legacy:true,puzzle:p}}}
 return null;
}
function localFreeSlotState(diff){
 const actual=new Set(),prior=new Set(),rows=Object.values(getState().completed||{}),activeGeneration=Number(puzzleDB?.freeGeneration)||1;
 const maxLevel=sortedFreeBank(diff).length;for(const r of rows){if(r?.mode!=='free'||r.difficulty!==diff)continue;const resolved=freePuzzleSlot(r.puzzleId,diff),info=(Number(r.level)&&Number(r.contentGeneration))?{level:Number(r.level),generation:Number(r.contentGeneration),legacy:resolved?.legacy===true}:resolved;if(!info||info.level<1||info.level>maxLevel)continue;(info.generation===activeGeneration&&!info.legacy?actual:prior).add(info.level)}
 const effective=new Set([...prior,...actual]),transferred=new Set([...prior].filter(level=>!actual.has(level)));
 return {actual,legacy:prior,prior,effective,transferred};
}
function reconcileLocalGen4Rewards(){
 const state=getState(),rows=Object.values(state.completed||{}),activeGeneration=Number(puzzleDB?.freeGeneration)||1;
 if(activeGeneration<4)return {repairedXp:0,returnBonusXp:0};
 let priorGenerationPlayed=false;const current=[];
 for(const row of rows){
  const diff=row?.difficulty;if(row?.mode!=='free'||!DIFF[diff])continue;
  const resolved=freePuzzleSlot(row.puzzleId,diff),info=(Number(row.level)&&Number(row.contentGeneration))?{generation:Number(row.contentGeneration),legacy:resolved?.legacy===true}:resolved;
  if(!info)continue;
  if(info.generation===activeGeneration&&!info.legacy)current.push({row,base:DIFF[diff].xp});else priorGenerationPlayed=true;
 }
 if(!current.length)return {repairedXp:0,returnBonusXp:0};
 const bonusAlready=current.some(({row,base})=>Number(row.points||0)>=base+500),earliest=[...current].sort((a,b)=>String(a.row.completedAt||'').localeCompare(String(b.row.completedAt||'')))[0];let repairedXp=0,missingBoardXp=false;
 for(const item of current){const oldPoints=Math.max(0,Number(item.row.points)||0);if(oldPoints<item.base)missingBoardXp=true;let target=Math.max(oldPoints,item.base);if(priorGenerationPlayed&&!bonusAlready&&item===earliest)target+=500;if(target!==oldPoints){item.row.points=target;repairedXp+=target-oldPoints}}
 if(missingBoardXp)state.gen4XpRepairNotice=true;
 if(repairedXp)saveState(state);
 return {repairedXp,returnBonusXp:priorGenerationPlayed?500:0};
}
function normalizeLeagueCode(v){return String(v||'').trim().toLocaleUpperCase('cs-CZ').replace(/\s+/g,'').replace(/[^0-9A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ_-]/g,'').slice(0,24)}
function selectedLeague(){return leaguesCache.find(l=>l.code===$('#leagueSelect')?.value)||null}
function togglePassword(inputIds,btn){const ids=Array.isArray(inputIds)?inputIds:[inputIds],show=ids.some(id=>$('#'+id)?.type==='password');ids.forEach(id=>{const el=$('#'+id);if(el)el.type=show?'text':'password'});if(btn)btn.textContent=show?'🙈 Skrýt heslo':'👁 Zobrazit heslo'}
function formatDateCZ(iso){const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Prague'}).format(new Date(Date.UTC(y,m-1,d,12)))}
function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function addDaysISO(iso,days){const [y,m,d]=iso.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d+days,12));return dt.toISOString().slice(0,10)}
function dayOffsetISO(iso,base){const [y,m,d]=iso.split('-').map(Number),[by,bm,bd]=base.split('-').map(Number);return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(by,bm-1,bd))/86400000)}
function dailyBankFor(iso){
 const gen4From=puzzleDB.dailyGeneration4From||puzzleDB.release?.dailyGeneration4From||null,active=puzzleDB.daily||[];
 if(gen4From){
  if(iso>=gen4From)return {bank:active.filter(p=>Number(p.meta?.contentGeneration||4)===4),base:puzzleDB.dailyRotationBaseDate||gen4From};
  const window=(puzzleDB.archive?.dailyWindows||[]).find(w=>(!w.activeFrom||iso>=w.activeFrom)&&(!w.activeUntil||iso<=w.activeUntil));
  if(window?.puzzleIds?.length){const base=window.rotationBaseDate||'2026-01-01',i=((dayOffsetISO(iso,base)%window.puzzleIds.length)+window.puzzleIds.length)%window.puzzleIds.length,id=window.puzzleIds[i],puzzle=active.find(p=>p.id===id);if(puzzle)return {bank:[puzzle],base:iso}}
 }
 const switchDate=puzzleDB.dailyGeneration3From||null,previous=puzzleDB.previousDaily;if(switchDate&&iso<switchDate&&previous?.puzzles?.length)return {bank:previous.puzzles,base:previous.rotationBaseDate||'2026-01-01'};return {bank:active,base:puzzleDB.dailyRotationBaseDate||switchDate||'2026-01-01'}
}
function dailyPuzzleFor(iso){const source=dailyBankFor(iso),n=source.bank.length;if(!n)throw new Error('Daily banka je prázdná');const i=((dayOffsetISO(iso,source.base)%n)+n)%n;return source.bank[i]}
function mondayWeekdayIndex(iso){const [y,m,d]=iso.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d,12)).getUTCDay();return (day+6)%7}
function renderDailyWeekRhythm(iso){const root=$('#dailyWeekRhythm');if(!root)return;const cadence=puzzleDB.dailyCadence||{},pattern=cadence.pattern||['easy','easy','medium','medium','medium','hard','hard'],labels=cadence.labels||['Po','Út','St','Čt','Pá','So','Ne'],activeFrom=cadence.activeFrom||puzzleDB.dailyGeneration3From||null,active=!activeFrom||iso>=activeFrom,today=active?mondayWeekdayIndex(iso):-1;root.classList.toggle('pending',!active);root.innerHTML=`<div class="daily-week-rhythm-head"><strong>${active?'Týdenní rytmus':'Od pondělí 17. 8.'}</strong><span>2 snadné · 3 střední · 2 těžké</span></div><div class="daily-week-days">${pattern.map((diff,i)=>`<span class="daily-week-day ${diff} ${i===today?'active':''}" title="${labels[i]} · ${DIFF[diff]?.label||diff}"><b>${labels[i]}</b><i>${difficultyIconMarkup(diff,'daily-week-icon')}</i></span>`).join('')}</div>`}
function dailyResultState(iso){const puzzle=dailyPuzzleFor(iso),stored=getState().completed[`daily:${iso}`]||null;return {puzzle,stored,active:stored?.puzzleId===puzzle.id?stored:null,legacy:stored&&stored.puzzleId!==puzzle.id?stored:null}}
function challengeKey(mode,puzzle,date){return mode==='daily'?`daily:${date}`:mode==='starter'?`starter:${puzzle.id}`:mode==='tajenka'?`tajenka:${puzzle.id}`:`free:${puzzle.id}`}
function pointsFor(mode,difficulty,puzzle=null){
 if(mode==='tajenka')return tajenkaCompletion(puzzle)?0:Number(puzzle?.meta?.rewardXp)||TAJENKA_REWARD_XP;if(mode==='daily')return 100;if(mode==='starter')return Number(puzzle?.meta?.rewardXp)||10;if(mode!=='free')return DIFF[difficulty].xp;
 const info=freePuzzleSlot(puzzle?.id,difficulty),slots=localFreeSlotState(difficulty);
 return info&&slots.actual.has(info.level)?0:DIFF[difficulty].xp;
}
function savedProgressFor(puzzle,mode,dailyDate){
 if(mode==='tajenka')return savedTajenkaProgress(puzzle);
 if(mode==='rescue'||mode==='starter')return null;const s=getState(),key=challengeKey(mode,puzzle,dailyDate),completed=s.completed?.[key];if(completed&&!(mode==='daily'&&completed.puzzleId!==puzzle.id))return null;const r=s.inProgress?.[key];
 if(!r||r.puzzleId!==puzzle.id||r.mode!==mode)return null;
 const seen=new Set(),found=[];
 for(const f of r.found||[]){const a=puzzle.answers?.[f.answerIndex];if(!a||seen.has(f.answerIndex)||a.word!==f.word||!samePath(a.path,f.path||[]))continue;seen.add(f.answerIndex);found.push({answerIndex:f.answerIndex,word:f.word,colorIndex:Number.isFinite(f.colorIndex)?f.colorIndex:found.length%COLORS.length,path:[...f.path]})}
 return {...r,found,moves:Math.max(0,Number(r.moves)||0),hints:Math.max(0,Number(r.hints)||0),wrongAttempts:Math.max(0,Number(r.wrongAttempts)||0),maxHintLevel:Math.max(0,Number(r.maxHintLevel)||0),elapsedMs:Math.max(0,Number(r.elapsedMs)||0)};
}
function gameElapsed(g=currentGame){if(!g)return 0;const end=g.pausedAt??performance.now();return Math.max(0,(g.baseElapsedMs||0)+(end-g.start))}
function saveRescueProgress(g=currentGame){if(!g||g.mode!=='rescue'||g.finished||!g.dailyDate)return;const s=getState();s.rescues=s.rescues||{};s.rescues[g.dailyDate]={...(s.rescues[g.dailyDate]||{}),status:'started',puzzleId:g.puzzle.id,elapsedMs:Math.round(gameElapsed(g))};saveState(s);g.lastAutosaveAt=Date.now()}
function pauseGameClock(reason='background'){
 const g=currentGame;if(!g||g.finished||g.pausedAt!=null||currentScreen!=='game')return false;const now=performance.now(),elapsed=gameElapsed(g);g.baseElapsedMs=elapsed;g.elapsedMs=elapsed;g.start=now;g.pausedAt=now;g.pauseReason=reason;g.dragging=false;g.lastPointer=null;g.path=[];stopTimer();updateActive();if(g.mode==='rescue'){g.rescueElapsedMs=elapsed;saveRescueProgress(g)}else saveGameProgress();return true;
}
function resumeGameClock(){
 const g=currentGame;if(!g||g.finished||g.pausedAt==null||currentScreen!=='game'||document.visibilityState==='hidden'||(typeof document.hasFocus==='function'&&!document.hasFocus()))return false;const now=performance.now();g.start=now;g.pausedAt=null;g.pauseReason=null;g.lastProgressAt=now;startTimer();return true;
}
async function acquireGameWakeLock(){
 if(!getSettings().wakeLock||currentScreen!=='game'||!currentGame||currentGame.finished||document.visibilityState!=='visible'||!navigator.wakeLock?.request)return false;
 if(gameWakeLock&&!gameWakeLock.released)return true;
 try{const lock=await navigator.wakeLock.request('screen');gameWakeLock=lock;lock.addEventListener('release',()=>{if(gameWakeLock===lock)gameWakeLock=null},{once:true});return true}catch{return false}
}
async function releaseGameWakeLock(){const lock=gameWakeLock;gameWakeLock=null;if(lock&&!lock.released)try{await lock.release()}catch{}}
function syncGameWakeLock(){if(getSettings().wakeLock&&currentScreen==='game'&&currentGame&&!currentGame.finished&&document.visibilityState==='visible')acquireGameWakeLock();else releaseGameWakeLock()}
function saveGameProgress(){
 const g=currentGame;if(!g||g.finished||g.mode==='rescue'||g.mode==='starter')return;if(g.mode==='tajenka')return saveTajenkaGameProgress(g);const key=challengeKey(g.mode,g.puzzle,g.dailyDate),s=getState();s.inProgress=s.inProgress||{},elapsed=gameElapsed(g);
 s.inProgress[key]={puzzleId:g.puzzle.id,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate||null,found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,cleanSolve:(g.hints||0)===0,elapsedMs:Math.round(elapsed),attemptId:g.attemptId||null,helperOffered:!!g.helperOffered,helperHintUsed:!!g.helperHintUsed,postStarterWarmup:!!g.postStarterWarmup,savedAt:Date.now()};saveState(s);g.lastAutosaveAt=Date.now();
}
function saveTajenkaGameProgress(g=currentGame){
 if(!g||g.mode!=='tajenka'||g.finished)return;
 const state=tajenkaState();state.version=1;state.inProgress={puzzleId:g.puzzle.id,mode:'tajenka',found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,elapsedMs:Math.round(gameElapsed(g)),savedAt:Date.now()};saveTajenkaState(state);g.lastAutosaveAt=Date.now();
}
function clearGameProgress(mode,puzzle,dailyDate){const s=getState(),key=challengeKey(mode,puzzle,dailyDate);if(s.inProgress?.[key]){delete s.inProgress[key];saveState(s)}}
function resumableFreePuzzle(diff,list){
 const s=getState(),rows=Object.values(s.inProgress||{}).filter(r=>r?.mode==='free'&&r.difficulty===diff&&!s.completed?.[`free:${r.puzzleId}`]).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));if(!rows.length)return null;
 return rows.map(row=>list.find(p=>p.id===row.puzzleId)).find(Boolean)||null;
}
async function archivedFreePuzzle(puzzleId){const payload=await api(`/api/free-archive?puzzle_id=${encodeURIComponent(puzzleId)}`);return payload?.puzzle||null}

function currentLocalStats(){
 const s=getState(),rows=Object.values(s.completed),dailyDates=[...new Set(rows.filter(r=>r.mode==='daily').map(r=>r.dailyDate).filter(Boolean))];
 const rescueDates=Object.entries(s.rescues||{}).filter(([,r])=>r?.status==='passed').map(([d])=>d),effectiveDates=[...new Set([...dailyDates,...rescueDates])];
 const streak=calcStreak(effectiveDates),longest=calcLongest(effectiveDates),dailyTimes=rows.filter(r=>r.mode==='daily').map(r=>r.elapsedMs);
 const free={easy:0,medium:0,hard:0,hardcore:0,mozkomor:0},freeTransferred={...free},freePlayedGen2={...free};for(const diff of Object.keys(free)){const slots=localFreeSlotState(diff);free[diff]=slots.effective.size;freeTransferred[diff]=slots.transferred.size;freePlayedGen2[diff]=slots.actual.size}
 const gameRows=rows.filter(r=>r.mode==='daily'||r.mode==='free'),cleanRows=gameRows.filter(r=>r.cleanSolve===true);
 const tajenkaCompleted=Object.keys(tajenkaState()?.completions||{}).length;
 return {points:rows.reduce((a,r)=>a+(r.points||0),0),totalCompleted:gameRows.length,dailyCompleted:dailyDates.length,freeCompleted:free,freeTransferred,freePlayedGen2,currentStreak:streak,longestStreak:longest,bestDailyMs:dailyTimes.length?Math.min(...dailyTimes):null,cleanSolves:cleanRows.length,cleanDaily:cleanRows.filter(r=>r.mode==='daily').length,rescuedDays:rescueDates.length,tajenkaCompleted,mozkomorCompleted:free.mozkomor,discoveredWords:0};
}
function effectiveStats(){
 const local=currentLocalStats(),remote=getProfile()?.stats;if(!remote)return local;
 const free={easy:0,medium:0,hard:0,hardcore:0,mozkomor:0},freeTransferred={...free},freePlayedGen2={...free};for(const k of Object.keys(free)){free[k]=Math.max(local.freeCompleted?.[k]||0,remote.freeCompleted?.[k]||0);freeTransferred[k]=Math.max(local.freeTransferred?.[k]||0,remote.freeTransferred?.[k]||0);freePlayedGen2[k]=Math.max(local.freePlayedGen2?.[k]||0,remote.freePlayedGen2?.[k]||0)}
 return {...remote,
  points:Math.max(local.points||0,remote.points||0),totalCompleted:Math.max(local.totalCompleted||0,remote.totalCompleted||0),
  dailyCompleted:Math.max(local.dailyCompleted||0,remote.dailyCompleted||0),freeCompleted:free,freeTransferred,freePlayedGen2,
  currentStreak:Math.max(local.currentStreak||0,remote.currentStreak||0),longestStreak:Math.max(local.longestStreak||0,remote.longestStreak||0),
  bestDailyMs:[local.bestDailyMs,remote.bestDailyMs].filter(v=>v!=null).sort((a,b)=>a-b)[0]??null,
  cleanSolves:Math.max(local.cleanSolves||0,remote.cleanSolves||0),cleanDaily:Math.max(local.cleanDaily||0,remote.cleanDaily||0),rescuedDays:Math.max(local.rescuedDays||0,remote.rescuedDays||0),
  tajenkaCompleted:Math.max(local.tajenkaCompleted||0,remote.tajenkaCompleted||0),mozkomorCompleted:Math.max(local.mozkomorCompleted||0,remote.mozkomorCompleted||0),discoveredWords:Math.max(local.discoveredWords||0,remote.discoveredWords||0)
 };
}
function isoShift(iso,days){const d=new Date(`${iso}T12:00:00Z`);return new Date(d.getTime()+days*86400000).toISOString().slice(0,10)}
function streakEndingOn(dateStrings,anchor){const set=new Set(dateStrings),start=typeof anchor==='string'?anchor:anchor.toISOString().slice(0,10);let n=0,d=start;while(set.has(d)){n++;d=isoShift(d,-1)}return n}
function localRescueStatus(){
 const st=getState(),today=pragueDateISO(),missed=isoShift(today,-1),before=isoShift(today,-2),daily=Object.values(st.completed).filter(r=>r.mode==='daily'&&r.dailyDate).map(r=>r.dailyDate),passed=Object.entries(st.rescues||{}).filter(([,r])=>r?.status==='passed').map(([d])=>d),effective=[...new Set([...daily,...passed])],existing=st.rescues?.[missed],prior=streakEndingOn(effective,before);
 if(existing?.status==='started'){const elapsed=Math.max(0,Number(existing.elapsedMs)||0);if(elapsed>=30000){st.rescues[missed]={...existing,status:'failed',elapsedMs:elapsed};saveState(st);return {eligible:false,state:'failed',missedDate:missed,priorStreak:prior}}return {eligible:true,state:'started',missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId,timeLimitMs:30000,secondsRemaining:Math.max(0,(30000-elapsed)/1000)}}
 if(existing)return {eligible:false,state:existing.status,missedDate:missed,priorStreak:prior,puzzleId:existing.puzzleId};
 const eligible=!effective.includes(missed)&&effective.includes(before)&&prior>0;return {eligible,state:eligible?'available':'none',missedDate:eligible?missed:null,priorStreak:eligible?prior:0};
}
function calcStreak(dateStrings){const set=new Set(dateStrings);if(!set.size)return 0;const today=pragueDateISO();const y=new Date(`${today}T12:00:00Z`);const prev=new Date(y.getTime()-86400000).toISOString().slice(0,10);let anchor=set.has(today)?today:(set.has(prev)?prev:null);if(!anchor)return 0;let n=0,d=new Date(`${anchor}T12:00:00Z`);while(set.has(d.toISOString().slice(0,10))){n++;d=new Date(d.getTime()-86400000)}return n}
function calcLongest(dateStrings){const arr=[...new Set(dateStrings)].sort();let best=0,cur=0,prev=null;for(const s of arr){const d=Date.parse(`${s}T12:00:00Z`);cur=prev!==null&&d-prev===86400000?cur+1:1;best=Math.max(best,cur);prev=d}return best}
function levelFor(points){let i=0;for(let n=0;n<LEVELS.length;n++)if(points>=LEVELS[n].xp)i=n;const current=LEVELS[i],next=LEVELS[i+1]||null;const pct=next?Math.max(0,Math.min(100,((points-current.xp)/(next.xp-current.xp))*100)):100;return {index:i+1,current,next,pct}}

const ROUTE_SCREENS=new Set(['daily','free','leaderboard','profile','game']);
// v3.21.3 — orientation is responsive-only; it never blocks or pauses play.
function applyScreen(screen){
 screen=ROUTE_SCREENS.has(screen)?screen:'daily';const prev=currentScreen;
 if(prev==='game'&&screen!=='game'){releaseGameWakeLock();pauseGameClock('menu');if(currentGame?.mode!=='rescue'){saveGameProgress();sendAttemptCheckpoint('leave')}trackTajenkaAbandon();stopTimer()}
 currentScreen=screen;$$('.screen').forEach(x=>x.classList.remove('active'));$(`#screen-${screen}`).classList.add('active');
 document.body.classList.toggle('playing',screen==='game');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===screen));$('.bottom-nav').classList.toggle('hidden',screen==='game');
 if(screen==='daily'){renderDaily();refreshRescueStatus()}if(screen==='free')renderFree();if(screen==='leaderboard')renderLeaderboard();if(screen==='profile')renderProfile({focusRoadmap:prev!=='profile'});if(screen==='game')requestAnimationFrame(fitGameBoard);else window.scrollTo({top:0,behavior:'instant'});
 if(screen!==prev&&screen!=='game')trackProductEvent(`screen_${screen}_viewed`);
}
function nav(screen,{replace=false,fromPop=false}={}){
 screen=ROUTE_SCREENS.has(screen)?screen:'daily';
 if(runtimeUpdateRequired&&screen!=='game'){recoverRuntimeUpdate();return}
 if(!fromPop&&screen!==currentScreen){const state={proplet:true,screen};if(replace)history.replaceState(state,'',location.href);else history.pushState(state,'',location.href)}
 applyScreen(screen);
}
function initNavigation(){
 const initial=ROUTE_SCREENS.has(history.state?.screen)&&history.state?.proplet?history.state.screen:'daily';
 history.replaceState({proplet:true,screen:initial},'',location.href);applyScreen(initial);
 window.addEventListener('popstate',async e=>{
  const modal=openTransientModal();
  if(modal){
   if(modal.id==='onboardingModal'&&onboardingMandatory){history.pushState({proplet:true,screen:currentScreen},'',location.href);return}
   if(modal.id==='winModal'&&shouldOfferAccountNudge())maybeOfferAccountNudge('menu');
   else if(modal.id==='winModal'&&await maybeOfferPushNudge('menu')){} 
   else if(modal.id==='winModal'&&maybeOfferInstallNudge('menu','daily')){}
   else if(modal.id==='accountNudgeModal')dismissAccountNudge();
   else if(modal.id==='progressGuardModal')dismissProgressGuard();
   else if(modal.id==='pushNudgeModal')dismissPushNudge();
   else if(modal.id==='installNudgeModal')dismissInstallNudge();
   else if(modal.id==='profileModal'&&profileModalFromWin){modal.classList.add('hidden');restoreWinAfterAccountModal()}
   else if(modal.id==='profileModal'&&profileModalFromNudge){modal.classList.add('hidden');resumeAfterAccountNudge()}
   else if(modal.id==='helperOfferModal')dismissHelperOffer();
   else modal.classList.add('hidden');
   history.pushState({proplet:true,screen:currentScreen},'',location.href);return
  }
  const screen=e.state?.proplet&&ROUTE_SCREENS.has(e.state.screen)?e.state.screen:'daily';nav(screen,{fromPop:true});
 });
}
function transientModals(){return ['winModal','accountNudgeModal','progressGuardModal','pushNudgeModal','installNudgeModal','profileModal','teamMembershipModal','passwordModal','hintModal','supportModeModal','helperOfferModal','rescueOfferModal','onboardingModal','wordReportModal','playedLevelsModal','levelDetailModal'].map(id=>document.getElementById(id)).filter(Boolean)}
function openTransientModal(){return transientModals().find(el=>!el.classList.contains('hidden'))||null}
function closeTransientModals(){transientModals().forEach(el=>el.classList.add('hidden'))}
function goBackFromGame(){
 if(currentScreen!=='game')return;
 if(currentGame?.mode!=='rescue')saveGameProgress();hideGameUndo();stopTimer();
 if(history.state?.proplet&&history.state.screen==='game'&&history.length>1)history.back();
 else nav(currentGame?.mode==='free'?'free':'daily',{replace:true});
}

function renderLevelCard(stats){
 const l=levelFor(stats.points||0),toNext=l.next?l.next.xp-(stats.points||0):0,risk=rescueStatus&&(rescueStatus.state==='available'||rescueStatus.state==='started'),shownStreak=risk?Math.max(stats.currentStreak||0,rescueStatus.priorStreak||0):stats.currentStreak,next=BADGES.find(b=>shownStreak<b.days);
 $('#levelCard').innerHTML=`<div class="daily-progress-rank"><span>${l.current.icon}</span><div><strong>${l.current.name}</strong><small>${stats.points||0} XP${l.next?` · ${toNext.toLocaleString('cs-CZ')} do ${esc(l.next.name)}`:''}</small></div></div><div class="daily-progress-track"><i><b style="width:${l.pct}%"></b></i></div><div class="daily-progress-streak ${risk?'at-risk':''}"><span>🔥</span><div><strong>${shownStreak||0}</strong><small>${risk?'zachraň sérii':next?`${countCz(next.days-shownStreak,'den','dny','dní')} do ${esc(next.name)}`:'legendární série'}</small></div></div>`;
}
function renderDaily(){
 const date=pragueDateISO(),daily=dailyResultState(date),p=daily.puzzle,stats=effectiveStats(),done=daily.active,upgrade=daily.legacy;
 $('#dailyDate').textContent=formatDateCZ(date);$('#dailyMeta').textContent=`${DIFF[p.difficulty].label} · ${countCz(p.meta.cells,'políčko','políčka','políček')} · ${countCz(p.answers.length,'slovo','slova','slov')}`;renderDailyWeekRhythm(date);
 $('#playDailyBtn').textContent=done?'Zobrazit dnešní výsledek':upgrade?'Zahrát novou dnešní výzvu':'Hrát dnešní výzvu';$('#shareDailyBtn').classList.toggle('hidden',!done);renderLevelCard(stats);
 const sync=$('#dailySyncStatus');if(!done&&!upgrade){sync.classList.add('hidden')}else{sync.classList.remove('hidden');const pfile=getProfile(),queued=getQueue().some(r=>r.challengeKey===`daily:${date}`);if(upgrade)sync.textContent='✨ Dnešní výzva má novou desku. Zahraj ji pro dnešní i týdenní pořadí; dalších 100 XP se nepřidá.';else if(!pfile?.token)sync.textContent='📱 Výsledek je uložený jen v tomto zařízení';else if(queued)sync.textContent=syncState.status==='error'?`⚠️ Čeká na synchronizaci: ${syncState.error||'zkus to znovu'}`:'☁️ Výsledek čeká na synchronizaci';else sync.textContent=pfile.familyCode?'✓ Výsledek je v cloudu i týmovém pořadí':'✓ Výsledek je bezpečně v cloudu';}
 renderRescueCard();renderQuickPlay();renderTajenkaEntry();
}

async function refreshRescueStatus(){
 const profile=getProfile();
 try{rescueStatus=profile?.token?await api('/api/rescue-status'):localRescueStatus()}catch(e){rescueStatus=localRescueStatus()}
 renderDaily();maybeOfferRescue();
 return rescueStatus;
}
function renderRescueCard(){
 const card=$('#rescueCard');if(!card)return;const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started')){card.classList.add('hidden');return}
 card.classList.remove('hidden');$('#rescueTitle').textContent=`Série ${countCz(rs.priorStreak,'den','dny','dní')} je v ohrožení`;
 $('#rescueText').textContent=rs.state==='started'?`Záchranný pokus už běží. Zbývá přibližně ${Math.ceil(rs.secondsRemaining||0)} s.`:`Včerejší Denní výzva ti utekla. Máš jeden pokus, jak navázat tam, kde jsi skončil.`;
 $('#rescueBtn').textContent=rs.state==='started'?`Pokračovat · ${Math.ceil(rs.secondsRemaining||0)} s`:'Zachránit sérii · 30 s';
}
function maybeOfferRescue(){
 const rs=rescueStatus;if(currentScreen!=='daily'||!rs||!['available','started'].includes(rs.state)||!rs.missedDate)return false;
 const offerId=`${rs.missedDate}:${rs.state}`,storageKey=scopedStorageKey(RESCUE_OFFER_KEY);
 try{if(localStorage.getItem(storageKey)===offerId)return false}catch{}
 setTimeout(()=>{
  const current=rescueStatus;if(currentScreen!=='daily'||!current||current.missedDate!==rs.missedDate||current.state!==rs.state||openTransientModal())return;
  try{if(localStorage.getItem(storageKey)===offerId)return;localStorage.setItem(storageKey,offerId)}catch{}
  openRescueOffer();
 },500);
 return true;
}
function openRescueOffer(){
 const rs=rescueStatus;if(!rs||(rs.state!=='available'&&rs.state!=='started'))return;
 $('#rescueOfferTitle').textContent=rs.state==='started'?'Záchrana už běží!':'Chceš zachránit sérii?';
 $('#rescueOfferText').textContent=rs.state==='started'?`Zbývá ti asi ${countCz(Math.ceil(rs.secondsRemaining||0),'sekunda','sekundy','sekund')}. Čas běží i mimo obrazovku.`:`Máš ${countCz(rs.priorStreak,'den','dny','dní')} v řadě. Když zvládneš rychlý Proplet do 30 sekund, série pokračuje. Když ne, předchozí série končí.`;
 $('#confirmRescueBtn').textContent=rs.state==='started'?'Pokračovat teď 🔥':'Ano, jdu do toho 🔥';$('#rescueOfferModal').classList.remove('hidden');
}
function rescuePuzzleById(id){return (puzzleDB.rescue||[]).find(p=>p.id===id)}
function localRescuePuzzleId(missed){const bank=puzzleDB.rescue||[];let h=0;for(const ch of missed)h=(h*31+ch.charCodeAt(0))>>>0;return bank.length?bank[h%bank.length].id:null}
async function beginRescue(){
 $('#rescueOfferModal').classList.add('hidden');let rs=rescueStatus||localRescueStatus();const profile=getProfile();
 try{
  if(rs.state!=='started'){
   if(profile?.token)rs=await api('/api/rescue/start',{method:'POST',body:'{}'});
   else{const st=getState(),id=localRescuePuzzleId(rs.missedDate);st.rescues=st.rescues||{};st.rescues[rs.missedDate]={status:'started',puzzleId:id,elapsedMs:0};saveState(st);rs={...rs,state:'started',puzzleId:id,timeLimitMs:30000,secondsRemaining:30}}
  }
  rescueStatus=rs;const puzzle=rescuePuzzleById(rs.puzzleId);if(!puzzle)throw new Error('Záchranná úloha se nenašla');
  const remaining=Math.max(1000,Math.round((rs.secondsRemaining??30)*1000));startGame(puzzle,'rescue',rs.missedDate,{limitMs:remaining,rescueTotalLimitMs:30000});
 }catch(e){showToast(`Záchrana nejde spustit: ${e.message}`);refreshRescueStatus()}
}
async function finishRescue(passed){
 const g=currentGame;if(!g||g.mode!=='rescue'||g.rescueFinished)return;g.rescueFinished=true;g.finished=true;stopTimer();releaseGameWakeLock();const elapsed=Math.max(0,Math.round(gameElapsed(g))),profile=getProfile();let ok=passed;
 try{
  if(profile?.token){const r=await api('/api/rescue/finish',{method:'POST',body:JSON.stringify({puzzle_id:g.puzzle.id,completed:!!passed,elapsed_ms:Math.min(120000,elapsed)})});ok=!!r.ok;if(r.stats)saveProfile({...profile,stats:r.stats})}
  else{const st=getState(),missed=g.dailyDate;st.rescues=st.rescues||{};st.rescues[missed]={...(st.rescues[missed]||{}),status:passed&&elapsed<=30000?'passed':'failed',puzzleId:g.puzzle.id,elapsedMs:elapsed,completedAt:new Date().toISOString()};saveState(st);ok=passed&&elapsed<=30000}
 }catch(e){ok=false;showToast(`Záchranu se nepodařilo potvrdit: ${e.message}`)}
 $('#tajenkaWinPhrase')?.classList.add('hidden');$('#winDetails')?.classList.remove('hidden');$('#winModal').classList.remove('hidden');$('#winAccountBtn')?.classList.add('hidden');$('#winBadge').textContent=ok?'🔥':'💨';$('#winTitle').textContent=ok?'Série zachráněna!':'Série tentokrát padla';$('#winPraise').textContent=ok?'Třicet sekund, žádné výmluvy. Série může dýchat dál.':'Nevadí. I série občas potřebuje nový začátek.';$('#winPraise').classList.remove('hidden');$('#winText').textContent=ok?`Hotovo za ${fmtTime(elapsed)}. Tvoje série pokračuje.`:'Pokus je vyčerpaný. Dnešní výzva může odstartovat novou sérii.';$('#winXp').textContent=ok?'Série pokračuje · bez XP':'Nový začátek';$('#winClean').classList.add('hidden');$('#winWords').innerHTML=ok?g.found.map(f=>`<span class="win-word" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join(''):'';$('#newBadgeBox').classList.add('hidden');$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').textContent='Zpět na dnešek';renderWinFeedback();if(ok){confetti();fx('win')}else fx('wrong');await refreshRescueStatus();renderProfile();
}
function failRescue(){finishRescue(false)}

function freeProgress(diff){
 const list=sortedFreeBank(diff),total=list.length,slots=localFreeSlotState(diff),done=slots.actual.size,resume=resumableFreePuzzle(diff,list),nextUnsolved=list.find(p=>!slots.actual.has(Number(p.meta?.level)))||null,pct=total?Math.round(done/total*100):0;
 return {list,total,done,actual:slots.actual.size,transferred:slots.transferred.size,resume,nextUnsolved,pct,slots};
}
function localMozkomorBaseDone(){
 const slots=localFreeSlotState('hardcore');
 return [...slots.actual].filter(level=>level>=1&&level<=MOZKOMOR_UNLOCK_BASE).length;
}
function mozkomorUnlockState(){
 const required=MOZKOMOR_UNLOCK_BASE,remote=getProfile()?.stats||{},localDone=localMozkomorBaseDone(),remoteDone=Number(remote.freeBasePlayedCurrent?.hardcore||0),done=Math.min(required,Math.max(localDone,remoteDone));
 const key=scopedStorageKey(MOZKOMOR_UNLOCK_KEY),remembered=(()=>{try{return localStorage.getItem(key)==='1'}catch{return false}})();
 const unlocked=MOZKOMOR_QA_PREVIEW||remembered||remote.mozkomorUnlocked===true||done>=required;
 if(unlocked&&!MOZKOMOR_QA_PREVIEW)try{localStorage.setItem(key,'1')}catch{}
 return {unlocked,done,required};
}
function renderQuickPlay(){
 const root=$('#quickPlayGrid');if(!root||!puzzleDB)return;
 root.innerHTML=Object.entries(DIFF).filter(([key])=>key!=='mozkomor').map(([key,d])=>{const q=freeProgress(key),nextLevel=Number((q.resume||q.nextUnsolved)?.meta?.level)||null,status=q.resume?`Pokračovat${nextLevel?` · úroveň ${nextLevel}`:''}`:q.done===q.total&&q.total?'Hotovo · hrát znovu':`Další · úroveň ${nextLevel||1}`;return `<button class="quick-game" data-quick-free="${key}" data-diff="${key}"><span class="quick-game-icon">${difficultyIconMarkup(key,'difficulty-icon-img')}</span><span class="quick-game-copy"><strong>${d.label}</strong><small>${status}</small><i><b style="width:${q.pct}%"></b></i></span><span class="quick-game-arrow">›</span></button>`}).join('');
 $$('[data-quick-free]').forEach(b=>b.onclick=()=>startFree(b.dataset.quickFree));
}


function latestContentBatch(){return puzzleDB?.contentStatus?.latestBatch||null}
function latestContentIsFresh(){const b=latestContentBatch(),today=CONTENT_PREVIEW_DATE||pragueDateISO();if(!b?.availableFrom)return false;return today>=b.availableFrom&&today<=addDaysISO(b.availableFrom,6)}
function latestContentPuzzles(){
 const batch=latestContentBatch();if(!batch||!latestContentIsFresh())return[];
 return (batch.levels||[]).map(row=>sortedFreeBank(row.difficulty).find(p=>p.id===row.id)).filter(Boolean);
}
function latestContentUnplayed(){const s=getState();return latestContentPuzzles().filter(p=>!s.completed?.[`free:${p.id}`])}
function newContentCount(diff){return latestContentUnplayed().filter(p=>p.difficulty===diff).length}
function startLatestContent(){const batch=latestContentBatch(),list=latestContentUnplayed(),all=latestContentPuzzles(),p=list[0]||all[0];if(p)startGame(p,'free',null,{contentBatchId:batch?.id||null})}
function continueLatestContent(){const batch=latestContentBatch(),p=latestContentUnplayed()[0];if(p&&currentGame?.contentBatchId===batch?.id)startGame(p,'free',null,{contentBatchId:batch.id});else nav('free',{replace:true})}
function renderNewContentBanner(){
 const root=$('#newContentBanner');if(!root)return;root.classList.add('hidden');root.innerHTML='';
 const batch=latestContentBatch();if(!batch||!latestContentIsFresh())return;
 const all=latestContentPuzzles(),left=latestContentUnplayed(),done=Math.max(0,all.length-left.length),count=Number(batch.count)||all.length||5;
 root.innerHTML=`<div class="new-content-main"><div class="new-content-spark">✨</div><div><span class="eyebrow">PONDĚLNÍ NOVINKY</span><h2>${left.length?`${count} nových Propletů je tady`:'Týdenní várka dohraná'}</h2><p>${left.length?`${done?`${done} hotovo · `:''}${left.length} ještě čeká.`:`Všech ${count} nových úrovní máš hotových.`}</p></div></div><div class="new-content-actions"><button id="playNewContentBtn" class="primary-btn">${left.length?'Hrát novinky':'Zahrát znovu'}</button></div>`;
 root.classList.remove('hidden');$('#playNewContentBtn').onclick=()=>{trackProductEvent('content_drop_cta_clicked');startLatestContent()};
}

function renderFree(){
 renderNewContentBanner();const unlock=mozkomorUnlockState();
 $('#difficultyCards').innerHTML=Object.entries(DIFF).map(([key,d])=>{
  if(key==='mozkomor'&&!unlock.unlocked){const pct=Math.round(unlock.done/unlock.required*100);return `<article class="difficulty-card card mozkomor-locked" data-diff="mozkomor"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${difficultyIconMarkup('mozkomor','difficulty-icon-img')}</span><div class="difficulty-heading-line"><h2>Mozkomor</h2></div></div><p class="muted">${d.desc}</p><span class="xp-chip">+150 XP za novou úroveň</span><div class="progress-line"><span style="width:${pct}%"></span></div><div class="mozkomor-lock-note">🔒 Odemkne se po dokončení všech 200 Mozkožroutů</div></div><div class="difficulty-progress locked-progress" aria-label="Mozkomor zamčený, ${unlock.done} z 200 Mozkožroutů dokončeno" style="--progress:${pct}%"><div><strong>${unlock.done}</strong><small>/200</small></div><span>🔒</span></div></article>`}
  const {total,done,actual,transferred,pct,resume,nextUnsolved}=freeProgress(key),nextLevel=Number((resume||nextUnsolved)?.meta?.level)||null,progressLabel=resume?`<span class="eyebrow">ROZEHRÁNO${nextLevel?` · ÚROVEŇ ${nextLevel}`:''}</span>`:'',xpLabel=`+${d.xp} XP za novou úroveň`;
  return `<article class="difficulty-card card ${key==='mozkomor'?'mozkomor-unlocked':''}" data-diff="${key}"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${difficultyIconMarkup(key,'difficulty-icon-img')}</span><div>${progressLabel}<div class="difficulty-heading-line"><h2>${d.label}</h2></div></div></div><p class="muted">${d.desc}</p><span class="xp-chip">${xpLabel}</span><div class="progress-line"><span style="width:${pct}%"></span></div><div class="difficulty-actions"><button class="secondary-btn play-next-btn" data-play-free="${key}">${resume?'Pokračovat':(done===total?'Hrát znovu':'Hrát další úroveň')}</button><button class="text-btn played-levels-btn" data-played-levels="${key}" ${done||transferred?'':'disabled'}>▦ Postup a úrovně${done?` · ${done} splněných`:''}</button></div></div><div class="difficulty-progress" data-play-free="${key}" role="button" tabindex="0" aria-label="${resume?'Pokračovat v rozehrané':'Hrát'} ${d.label}" style="--progress:${pct}%"><div><strong>${done}</strong><small>/${total}</small></div><span>›</span></div></article>`
 }).join('');
 $$('[data-play-free]').forEach(b=>{b.onclick=e=>{e.stopPropagation();startFree(b.dataset.playFree)};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();startFree(b.dataset.playFree)}}});
 $$('[data-played-levels]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(!b.disabled)openPlayedLevels(b.dataset.playedLevels)});
}
async function startFree(diff){
 if(diff==='mozkomor'&&!mozkomorUnlockState().unlocked){showToast('🔒 Mozkomor se odemkne po dokončení všech 200 Mozkožroutů.');return}
 const list=sortedFreeBank(diff),slots=localFreeSlotState(diff),resume=resumableFreePuzzle(diff,list),unplayed=list.filter(p=>!slots.actual.has(Number(p.meta?.level))),p=resume||(unplayed[0]||list[0]);if(p)startGame(p,'free',null);
}
function showStarterDailyNudge(){const n=$('#starterDailyNudge'),hero=$('.daily-hero');if(n)n.classList.remove('hidden');hero?.classList.add('starter-next');setTimeout(()=>hero?.classList.remove('starter-next'),2400)}
function startDaily(options={}){$('#starterDailyNudge')?.classList.add('hidden');$('.daily-hero')?.classList.remove('starter-next');const date=pragueDateISO(),daily=dailyResultState(date);if(daily.active){showDailyResult(date,daily.active);return}startGame(daily.puzzle,'daily',date,options);if(options.starterHardDirect)setTimeout(()=>showToast('🔥 Dnešní výzva je Těžká. Kdyby ses zasekl, Nápověda je dole po ruce.'),180)}
function startStarterWarmup(){const list=sortedFreeBank('easy'),slots=localFreeSlotState('easy'),p=list.find(x=>!slots.actual.has(Number(x.meta?.level)))||list[0];if(!p){nav('free',{replace:true});return}startGame(p,'free',null,{postStarterWarmup:true})}
function startTajenka(){if(!TAJENKA_AVAILABLE||!tajenkaPuzzle){showToast('Tajenka není na této verzi dostupná.');return}trackProductEvent('tajenka_started');startGame(tajenkaPuzzle,'tajenka',null)}

function newAttemptId(){try{return crypto.randomUUID()}catch{return `a-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}}
async function startAttemptTelemetry(g){if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW||isMozkomorQaDifficulty(g?.puzzle?.difficulty)||!g||g.mode==='rescue'||g.mode==='starter'||g.mode==='tajenka')return;try{await api('/api/attempt/start',{method:'POST',body:JSON.stringify({attempt_id:g.attemptId,puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),mode:g.mode,difficulty:g.puzzle.difficulty})})}catch{}}
async function sendAttemptCheckpoint(eventType){
 const g=currentGame;if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW||isMozkomorQaDifficulty(g?.puzzle?.difficulty)||!g||g.mode==='rescue'||g.mode==='starter'||g.mode==='tajenka'||g.finished)return;
 const foundWords=g.found.length;
 // The server still sees the first correct word immediately. Later correct-word
 // checkpoints are sampled; leave/hint/reset/resume and the final result stay exact.
 if(eventType==='correct'&&foundWords!==1&&(foundWords-1)%3!==0)return;
 if(eventType==='leave'){
  const now=Date.now(),key=`leave:${foundWords}`;
  if(g.lastCheckpointKey===key&&now-(g.lastCheckpointAt||0)<1500)return;
  g.lastCheckpointKey=key;g.lastCheckpointAt=now;
 }
 try{await api('/api/attempt/checkpoint',{method:'POST',body:JSON.stringify({attempt_id:g.attemptId,event_type:eventType,elapsed_ms:Math.max(0,Math.round(gameElapsed(g))),found_words:foundWords})})}catch{}
}
function startGame(puzzle,mode,dailyDate,options={}){
 hideTouchMagnifier();
 if(runtimeUpdateRequired){showToast('Nejdřív dokončím aktualizaci Propletu…');recoverRuntimeUpdate();return}
 stopTimer();hideGameUndo();
 // Když hráč otevře Free hru z rychlé nabídky na Daily, vytvoř v historii mezikrok Free menu.
 // Android/PWA tlačítko Zpět pak vrátí hra → výběr her, ne rovnou na Daily.
 if(mode==='free'&&currentScreen!=='free'&&currentScreen!=='game')history.pushState({proplet:true,screen:'free'},'',location.href);
 if(mode==='rescue'&&currentScreen!=='daily'&&currentScreen!=='game')history.pushState({proplet:true,screen:'daily'},'',location.href);
 const totalLimit=options.rescueTotalLimitMs||30000,remaining=options.limitMs||totalLimit,restored=mode==='rescue'||mode==='starter'?null:savedProgressFor(puzzle,mode,dailyDate),found=restored?.found||[],used=new Map();found.forEach(f=>f.path.forEach(i=>used.set(i,f.colorIndex)));
 let baseElapsedMs=mode==='rescue'?Math.max(0,totalLimit-remaining):(restored?.elapsedMs||0);
 currentGame={puzzle,mode,dailyDate,found,used,path:[],wrongPath:[],dragging:false,lastPointer:null,moves:restored?.moves||0,start:performance.now(),pausedAt:null,pauseReason:null,baseElapsedMs,elapsedMs:baseElapsedMs,finished:false,lastFound:[],hints:restored?.hints||0,wrongAttempts:restored?.wrongAttempts||0,maxHintLevel:restored?.maxHintLevel||0,cleanSolve:(restored?.hints||0)===0,attemptId:mode==='starter'||mode==='tajenka'?null:(restored?.attemptId||newAttemptId()),rescueFinished:false,rescueTotalLimitMs:totalLimit,rescueOffsetMs:baseElapsedMs,lastAutosaveAt:Date.now(),lastProgressAt:performance.now(),helperOffered:!!restored?.helperOffered,helperHintUsed:!!restored?.helperHintUsed,nextHintSource:'manual',isReplay:mode==='tajenka'?!!tajenkaCompletion(puzzle):!!getState().completed[challengeKey(mode,puzzle,dailyDate)],contentBatchId:options.contentBatchId||null,postStarterWarmup:!!(options.postStarterWarmup||restored?.postStarterWarmup),starterHardDirect:!!options.starterHardDirect,starterHintUsed:false,starterHintOfferShown:false,starterTrackedWordCount:0,starterGuidePath:[],undoSnapshot:null};
 $('#screen-game').classList.toggle('rescue-mode',mode==='rescue');$('#screen-game').classList.toggle('starter-mode',mode==='starter');$('#screen-game').classList.toggle('tajenka-mode',mode==='tajenka');$('#gameModeLabel').textContent=mode==='daily'?'Denní výzva':mode==='rescue'?'Záchrana série':mode==='starter'?'První Proplet':mode==='tajenka'?'Víkendový bonus':'Volná hra';const levelNo=Number(puzzle.meta?.level)||null;if(mode==='rescue'||mode==='starter')$('#gameDifficulty').textContent=mode==='rescue'?'🔥 6×6 · jeden pokus':'🎓 Trénink · 5×5';else if(mode==='tajenka')$('#gameDifficulty').innerHTML='<span class="tajenka-game-label">✦ Tajenka</span>';else $('#gameDifficulty').innerHTML=`${difficultyIconMarkup(puzzle.difficulty,'game-difficulty-icon')}<span>${esc(DIFF[puzzle.difficulty].label)}${mode==='free'&&levelNo?` ${levelNo}`:''}</span>`;
 $('#timer').textContent=mode==='rescue'?fmtCountdown(remaining):fmtTime(baseElapsedMs);message(restored?'Pokračuješ přesně tam, kde jsi skončil.':mode==='starter'?'':mode==='tajenka'?'Najdi pět slov. Některá písmena mohou zůstat volná.':'Propleť všechna políčka. Slova můžou zatáčet.');$('#starterCoach')?.classList.toggle('hidden',mode!=='starter');nav('game');renderGameBoard();renderGameHUD();updateGameFeel();syncGameWakeLock();if(mode==='starter'){trackProductEvent('starter_started');updateStarterGuidance()}if(mode==='tajenka')renderTajenkaPhrase(currentGame);startTimer();if(mode!=='rescue'&&mode!=='starter')saveGameProgress();startAttemptTelemetry(currentGame).then(()=>{if(restored)sendAttemptCheckpoint('resume')});
}
function startStarter(){const p=puzzleDB?.starter;if(!p){nav('daily');showToast('Tréninková úroveň se nepodařila načíst.');return}startGame(p,'starter',null,{starter:true})}
function starterGuideFor(g=currentGame){if(!g||g.mode!=='starter')return[];const n=g.found.length;if(n===0)return [...(g.puzzle.answers[0]?.path||[])];if(n===1)return (g.puzzle.answers[1]?.path||[]).slice(0,3);return[]}
function hideStarterHintNudge(){const n=$('#starterHintNudge');n?.classList.add('hidden');$('#hintBtn')?.classList.remove('starter-attention')}
function acceptStarterHintNudge(){hideStarterHintNudge();openHintModal()}
function dismissStarterHintNudge(){hideStarterHintNudge()}
function maybeOfferStarterHint(){
 const g=currentGame;if(!g||g.mode!=='starter'||g.finished||g.starterHintUsed||g.starterHintOfferShown||g.found.length<2||g.dragging||document.hidden||openTransientModal())return;
 const idle=performance.now()-(g.lastProgressAt||g.start);if(idle<10000)return;g.starterHintOfferShown=true;trackProductEvent('starter_hint_offer_shown');$('#starterHintNudge')?.classList.remove('hidden');$('#hintBtn')?.classList.add('starter-attention');
}
function renderStarterCoach(step,title,copy,hintFocus=false){
 const coach=$('#starterCoach');if(!coach)return;coach.classList.remove('hidden');coach.classList.toggle('hint-focus',hintFocus);$('#starterCoachStep').textContent=`${step} / 4`;$('#starterCoachTitle').textContent=title;$('#starterCoachCopy').textContent=copy;$('#hintBtn')?.classList.toggle('starter-attention',hintFocus);
}
function updateStarterGuidance(){
 const g=currentGame;if(!g||g.mode!=='starter')return;g.starterGuidePath=starterGuideFor(g);
 if(g.found.length===0)renderStarterCoach(1,'Začni slovem MRAK','Táhni přes sousední písmena. Fialová stopa ti ukáže první cestu.');
 else if(g.found.length===1)renderStarterCoach(2,'Teď najdi JABLKO','Čísla nahoře ukazují délky zbývajících slov. JABLKO má 6 a zahne za roh.');
 else if(g.found.length===2)renderStarterCoach(3,'Zkus ČOKOLÁDU','Zasekl ses? Tlačítko Nápověda dole ti dá malé postrčení.',true);
 else if(g.found.length===3){hideStarterHintNudge();renderStarterCoach(4,'Dokonči celou mřížku','Poslední je AUTOBUS. Hotovo je až bez jediného volného políčka.');}
 renderGameBoard();renderGameHUD();updateGameFeel();
}
function updateGameFeel(){
 const g=currentGame,stage=$('#boardStage');if(!g||!stage)return;const progress=g.puzzle.answers?.length?g.found.length/g.puzzle.answers.length:0;stage.style.setProperty('--solve-progress',String(progress));stage.style.setProperty('--board-glow',(0.025+progress*.12).toFixed(3));stage.style.setProperty('--board-mint',(0.02+Math.max(0,progress-.35)*.16).toFixed(3));stage.classList.toggle('near-complete',progress>=.72&&progress<1);stage.classList.toggle('board-complete',progress>=1);
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function hideGameUndo(){const el=$('#gameUndoToast');if(el)el.classList.add('hidden');if(currentGame)currentGame.undoSnapshot=null}
function showGameUndo(){const el=$('#gameUndoToast');if(!el)return;el.classList.remove('hidden');clearTimeout(showGameUndo._t);showGameUndo._t=setTimeout(hideGameUndo,4800)}
function undoReset(){const g=currentGame,snap=g?.undoSnapshot;if(!g||!snap||g.finished)return;g.found=snap.found.map(f=>({...f,path:[...f.path]}));g.used=new Map(snap.used);g.path=[];g.wrongPath=[];g.undoSnapshot=null;$('#gameUndoToast')?.classList.add('hidden');message('Plocha vrácena. Čas, tahy i nápovědy běží dál.','good');if(g.mode==='starter')updateStarterGuidance();else{renderGameBoard();renderGameHUD();updateGameFeel()}saveGameProgress()}
function flashWrongPath(path){const g=currentGame;if(!g||!path?.length)return;g.wrongPath=[...path];renderGameBoard();setTimeout(()=>{if(currentGame!==g)return;g.wrongPath=[];renderGameBoard();renderGameHUD();updateGameFeel()},210)}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function fmtCountdown(ms){const sec=Math.max(0,Math.ceil(ms/1000));return `00:${String(sec).padStart(2,'0')}`}
function startTimer(){stopTimer();if(!currentGame||currentGame.finished||currentGame.pausedAt!=null)return;timerId=setInterval(()=>{if(!currentGame||currentGame.finished||currentGame.pausedAt!=null)return;const elapsed=gameElapsed(currentGame);if(currentGame.mode==='rescue'){currentGame.rescueElapsedMs=elapsed;const rem=currentGame.rescueTotalLimitMs-elapsed;$('#timer').textContent=fmtCountdown(rem);if(Date.now()-(currentGame.lastAutosaveAt||0)>1000)saveRescueProgress(currentGame);if(rem<=0){stopTimer();finishRescue(false)}}else{currentGame.elapsedMs=elapsed;$('#timer').textContent=fmtTime(elapsed);if(Date.now()-(currentGame.lastAutosaveAt||0)>5000)saveGameProgress();if(currentGame.mode==='starter')maybeOfferStarterHint();else maybeOfferHelper()}},currentGame?.mode==='rescue'?100:250)}
function renderTajenkaPhrase(g=currentGame){
 const root=$('#tajenkaPhrase');if(!root)return;
 if(g?.mode!=='tajenka'){root.classList.add('hidden');root.innerHTML='';return}
 const words=tajenkaPhraseWords(g.puzzle),found=new Set(g.found.map(f=>f.answerIndex)),complete=words.length>0&&words.every((_,i)=>found.has(g.puzzle.tajenka.answerOrder[i]));
 const firstMove=(g.moves||0)===0&&g.found.length===0;
 root.classList.remove('hidden');root.innerHTML=`<div class="tajenka-phrase-head"><span class="stat-label">TAJENKA</span><div class="tajenka-progress" aria-label="${g.found.length} z ${words.length} slov">${words.map((_,i)=>`<i class="${i<g.found.length?'done':''}"></i>`).join('')}<strong>${g.found.length}/${words.length}</strong></div></div><div class="tajenka-slots">${words.map((answer,i)=>{const answerIndex=answerIndexForTajenka(g.puzzle,i),revealed=found.has(answerIndex),fresh=revealed&&g.lastTajenkaReveal===answerIndex;return `<span class="tajenka-slot ${revealed?'revealed':'pending'} ${fresh?'newly-revealed':''}" ${revealed?'':'aria-label="Skryté slovo"'}>${revealed?esc(answer.word):'·'.repeat(answer.word.length)}</span>`}).join('<b class="tajenka-space" aria-hidden="true">·</b>')}</div><div class="tajenka-rule-note ${firstMove?'is-first':''}"><b>${firstMove?'Jiná pravidla':'Volná písmena jsou v pořádku'}</b><span>${firstMove?`Najdi všech ${words.length} slov. Některá písmena na desce zůstanou nevyužitá.`:'Nemusíš vyplnit celou desku — cílem je odhalit tajenku.'}</span></div><small>${complete?'Tajenka je kompletní.':'Každé nalezené slovo odhalí další část fráze.'}</small>`;
}
function answerIndexForTajenka(puzzle,phraseIndex){return Number(puzzle?.tajenka?.answerOrder?.[phraseIndex]??phraseIndex)}
function renderGameHUD(){
 const g=currentGame,p=g.puzzle;$('#moves').textContent=countCz(g.moves,'tah','tahy','tahů');$('#gameProgress').textContent=`${g.found.length}/${p.answers.length}`;
 const remaining=p.answers.map((a,i)=>({len:a.word.length,i})).filter(x=>!g.found.some(f=>f.answerIndex===x.i)).sort((a,b)=>a.len-b.len||a.i-b.i);
 $('#lengths').innerHTML=remaining.length?remaining.map(x=>`<span class="length-pill ${g.mode==='starter'&&((g.found.length===0&&x.i===0)||(g.found.length===1&&x.i===1)||(g.found.length===2&&x.i===2)||(g.found.length===3&&x.i===3))?'starter-target':''}" title="${countCz(x.len,'písmeno','písmena','písmen')}">${x.len}</span>`).join(''):'<span class="all-found">✓ nic</span>';
 $('#foundWords').innerHTML=g.found.length?g.found.map(f=>`<span class="found-word-chip" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,var(--word-color) 58%,white)">${esc(f.word)}</span>`).join(''):'<span class="empty-found">zatím nic</span>';
 const clean=$('#cleanStatus');clean.textContent=g.mode==='rescue'?'':g.mode==='starter'?'🎓 Trénink':g.mode==='tajenka'?'🎁 Bonus bez hodnocení':(g.hints?'💡 S nápovědou':'✨ Čistě');clean.classList.toggle('lost',g.mode!=='starter'&&g.mode!=='tajenka'&&!!g.hints);$('#hintBtn').textContent=g.mode==='starter'?'💡 Nápověda':g.hints?`💡 ${g.hints}×`:'💡 Nápověda';renderTajenkaPhrase(g);renderMagnifierControls();updateGameFeel();
}
function fitGameBoard(){
 if(!currentGame||currentScreen!=='game')return;const stage=$('#boardStage'),wrap=$('#boardWrap'),board=$('#board');if(!stage||!wrap||!board)return;const p=currentGame.puzzle,cs=getComputedStyle(board),colGap=parseFloat(cs.columnGap)||0,rowGap=parseFloat(cs.rowGap)||colGap,ss=getComputedStyle(stage),padX=(parseFloat(ss.paddingLeft)||0)+(parseFloat(ss.paddingRight)||0),padY=(parseFloat(ss.paddingTop)||0)+(parseFloat(ss.paddingBottom)||0),aw=Math.max(80,stage.clientWidth-padX),ah=Math.max(80,stage.clientHeight-padY),cellByW=Math.max(4,(aw-colGap*(p.cols-1))/p.cols),cellByH=Math.max(4,(ah-rowGap*(p.rows-1))/p.rows),cell=Math.max(4,Math.min(cellByW,cellByH)),targetW=cell*p.cols+colGap*(p.cols-1),targetH=cell*p.rows+rowGap*(p.rows-1);wrap.style.width=`${targetW}px`;wrap.style.height=`${targetH}px`;board.style.setProperty('--cell-size',`${cell}px`);requestAnimationFrame(drawPaths)
}
function renderGameBoard(){
 const g=currentGame,p=g.puzzle,mask=new Set(p.mask),board=$('#board');board.style.gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`;board.classList.toggle('dense-board',p.cols>=9);board.classList.toggle('ultra-board',p.cols>=10);board.innerHTML='';
 for(let i=0;i<p.rows*p.cols;i++){if(!mask.has(i)){const v=document.createElement('div');v.className='void-cell';board.appendChild(v);continue}const c=document.createElement('div');c.className='cell';c.dataset.index=i;c.textContent=p.letters[i];const color=g.used.get(i);if(color!=null){c.classList.add('used');c.style.setProperty('--word-color',COLORS[color%COLORS.length])}if(g.mode==='tajenka'&&g.finished&&!g.used.has(i))c.classList.add('tajenka-unused');if(g.lastFound?.includes(i))c.classList.add('just-found');if(g.wrongPath?.includes(i))c.classList.add('wrong-flash');if(g.mode==='starter'&&g.starterGuidePath?.includes(i)&&!g.used.has(i)){c.classList.add('starter-guide');c.style.setProperty('--guide-order',String(g.starterGuidePath.indexOf(i)))}c.addEventListener('pointerdown',pointerDown);c.addEventListener('pointerenter',pointerEnter);board.appendChild(c)}requestAnimationFrame(()=>{fitGameBoard();drawPaths()});if(g.lastFound?.length)setTimeout(()=>{g.lastFound=[];$$('.just-found').forEach(c=>c.classList.remove('just-found'))},460)
}
function pNeighbours(i){const p=currentGame.puzzle,r=Math.floor(i/p.cols),c=i%p.cols,mask=new Set(p.mask),out=[];[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([rr,cc])=>{const j=rr*p.cols+cc;if(rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols&&mask.has(j))out.push(j)});return out}
function touchMagnifierDeviceSupported(){
 const coarse=window.matchMedia?.('(pointer: coarse)')?.matches===true,touchCapable=(navigator.maxTouchPoints||0)>0,shortSide=Math.min(window.visualViewport?.width||window.innerWidth||9999,window.visualViewport?.height||window.innerHeight||9999);
 return coarse&&touchCapable&&shortSide<=600;
}
function touchMagnifierAvailable(g=currentGame){return !!g&&!g.finished&&['hard','hardcore','mozkomor'].includes(g.puzzle?.difficulty)&&touchMagnifierDeviceSupported()}
function touchMagnifierEnabled(g=currentGame){return touchMagnifierAvailable(g)&&getSettings().magnifier!==false}
function renderMagnifierControls(){
 const s=getSettings(),available=touchMagnifierAvailable(),btn=$('#magnifierQuickBtn'),actions=btn?.closest('.game-actions');
 if(btn){btn.classList.toggle('hidden',!available);btn.classList.toggle('on',s.magnifier);btn.setAttribute('aria-pressed',s.magnifier?'true':'false');btn.setAttribute('aria-label',s.magnifier?'Vypnout lupu při tahu':'Zapnout lupu při tahu');btn.title=s.magnifier?'Lupa při tahu zapnutá':'Lupa při tahu vypnutá'}
 actions?.classList.toggle('magnifier-control-visible',available);
}
function setMagnifierPreference(enabled,{announce=true}={}){
 const s=getSettings();s.magnifier=!!enabled;saveSettings(s);if(!s.magnifier)hideTouchMagnifier();renderMagnifierControls();renderSettings();if(announce)showToast(s.magnifier?'Lupa při tahu zapnutá 🔍':'Lupa při tahu vypnutá');
}
function toggleMagnifierPreference(){setMagnifierPreference(getSettings().magnifier===false)}

function ensureTouchMagnifier(){
 let el=$('#touchMagnifier');if(el)return el;
 el=document.createElement('div');el.id='touchMagnifier';el.className='touch-magnifier hidden';el.setAttribute('aria-hidden','true');el.innerHTML='<div class="touch-magnifier-grid"></div>';document.body.appendChild(el);return el;
}
function renderTouchMagnifier(centerIndex){
 const g=currentGame;if(!g||centerIndex==null)return;const p=g.puzzle,mask=new Set(p.mask),row=Math.floor(centerIndex/p.cols),col=centerIndex%p.cols,grid=ensureTouchMagnifier().querySelector('.touch-magnifier-grid'),cells=[],backIndex=g.path.length>1?g.path.at(-2):null;
 for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
  if(Math.abs(dr)+Math.abs(dc)>1){cells.push('<span class="touch-mag-cell void"></span>');continue}
  const rr=row+dr,cc=col+dc,j=rr*p.cols+cc;
  if(rr<0||rr>=p.rows||cc<0||cc>=p.cols||!mask.has(j)){cells.push('<span class="touch-mag-cell void"></span>');continue}
  const cls=['touch-mag-cell'],isCenter=j===centerIndex,isBack=j===backIndex,isBlocked=!isCenter&&!isBack&&(g.used.has(j)||g.path.includes(j));
  if(isCenter)cls.push('focus','active');else if(isBack)cls.push('backtrack');else if(isBlocked)cls.push('blocked');else cls.push('candidate');
  const color=g.used.get(j),style=color!=null?` style="--word-color:${COLORS[color%COLORS.length]}"`:'';
  cells.push(`<span class="${cls.join(' ')}"${style}>${esc(p.letters[j])}</span>`)
 }
 grid.innerHTML=cells.join('');
}
function showTouchMagnifier(centerIndex){
 if(!touchMagnifierEnabled()){hideTouchMagnifier();return}
 const el=ensureTouchMagnifier(),board=$('#board'),boardTop=board?.getBoundingClientRect?.().top??220,magHeight=144,gap=12,top=Math.max(8,Math.floor(boardTop-magHeight-gap));
 el.style.setProperty('--magnifier-top',`${top}px`);renderTouchMagnifier(centerIndex);el.classList.remove('hidden');
}
function hideTouchMagnifier(){const el=$('#touchMagnifier');el?.classList.add('hidden')}
function pointerDown(e){e.preventDefault();ensureAudio();const g=currentGame,i=+e.currentTarget.dataset.index;if(!g||g.finished||g.used.has(i)||g.wrongPath?.length)return;if(g.undoSnapshot)hideGameUndo();g.dragging=true;g.path=[i];g.lastPointer={x:e.clientX,y:e.clientY};fx('tap');updateActive();showTouchMagnifier(i);try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
}
function pointerEnter(e){if(currentGame?.dragging)extendPath(+e.currentTarget.dataset.index)}
function samplePointer(x,y){const g=currentGame;if(!g?.dragging)return;const prev=g.lastPointer||{x,y},dx=x-prev.x,dy=y-prev.y,dist=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(dist/6));for(let n=1;n<=steps;n++){const px=prev.x+dx*n/steps,py=prev.y+dy*n/steps,el=document.elementFromPoint(px,py)?.closest?.('.cell');if(el)extendPath(+el.dataset.index)}g.lastPointer={x,y}}
function pointerMove(e){if(!currentGame?.dragging)return;const evs=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[e];for(const ev of evs)samplePointer(ev.clientX,ev.clientY)}
function extendPath(i){const g=currentGame,path=g.path,last=path.at(-1);if(i===last)return;if(path.length>1&&i===path.at(-2)){path.pop();updateActive();renderTouchMagnifier(path.at(-1));return}if(g.used.has(i)||path.includes(i)||!pNeighbours(last).includes(i))return;path.push(i);fx('step');updateActive();renderTouchMagnifier(i)}
function pointerUp(){hideTouchMagnifier();if(!currentGame?.dragging)return;currentGame.dragging=false;currentGame.lastPointer=null;submitPath()}
function currentWord(){return currentGame.path.map(i=>currentGame.puzzle.letters[i]).join('')}
function updateActive(){$$('.cell').forEach(c=>c.classList.toggle('active',currentGame.path.includes(+c.dataset.index)));$('#currentWord').textContent=currentGame.path.length?currentWord():'—';drawPaths()}
function samePath(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function submitPath(){
 const g=currentGame,word=currentWord(),path=[...g.path];if(!word){g.path=[];return updateActive()}if(word.length<4){g.path=[];message('Slova mají aspoň 4 písmena.');renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';return}
 g.moves++;
 const ai=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word&&samePath(a.path,g.path));
 const wordIndex=g.puzzle.answers.findIndex((a,i)=>!g.found.some(f=>f.answerIndex===i)&&a.word===word),alreadyFound=g.found.some(f=>f.word===word);
 let wrong=false;
 if(ai>=0){const colorIndex=g.found.length%COLORS.length;g.found.push({answerIndex:ai,word,colorIndex,path});path.forEach(i=>g.used.set(i,colorIndex));g.lastFound=path;g.lastProgressAt=performance.now();if(g.mode==='tajenka'){g.lastTajenkaReveal=ai;trackProductEvent('tajenka_word_found');setTimeout(()=>{if(currentGame===g&&g.lastTajenkaReveal===ai){g.lastTajenkaReveal=null;renderTajenkaPhrase(g)}},1100)}else sendAttemptCheckpoint('correct');message(`✓ ${word}`,'good');fx('correct')}
 else if(wordIndex>=0){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ je správné slovo, ale tahle cesta se do plochy nevejde.`,'bad');wrong=true;fx('wrong')}
 else if(alreadyFound){g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ už máš. Hledej dál.`,'bad');wrong=true;fx('wrong')}
 else{g.wrongAttempts=(g.wrongAttempts||0)+1;message(`„${word}“ do tohohle Propletu nezapadá.`,'bad');wrong=true;fx('wrong')}
 g.path=[];if(wrong)g.wrongPath=path;renderGameBoard();renderGameHUD();$('#currentWord').textContent='—';if(wrong){setTimeout(()=>{if(currentGame!==g)return;g.wrongPath=[];renderGameBoard();renderGameHUD();updateGameFeel()},210)}if(g.mode==='starter'&&ai>=0){const n=g.found.length;if(n<=3&&n>g.starterTrackedWordCount){g.starterTrackedWordCount=n;trackProductEvent(`starter_word_${n}_completed`)}updateStarterGuidance()}if(g.mode!=='rescue'&&g.mode!=='starter')saveGameProgress();if(g.found.length===g.puzzle.answers.length){if(g.mode==='rescue')finishRescue(true);else finishGame();}
}
function resetGame(){const g=currentGame;if(!g||g.mode==='rescue'||g.finished)return;if(!g.found.length){message('Plocha je už prázdná.');return}if(g.mode==='starter')trackProductEvent('starter_reset');const usedHints=g.hints||0,elapsed=gameElapsed(g),now=performance.now();g.undoSnapshot={found:g.found.map(f=>({...f,path:[...f.path]})),used:[...g.used.entries()]};g.found=[];g.used=new Map();g.path=[];g.wrongPath=[];g.baseElapsedMs=elapsed;g.start=now;if(g.pausedAt!=null)g.pausedAt=now;g.elapsedMs=elapsed;g.lastFound=[];sendAttemptCheckpoint('reset');g.hints=usedHints;g.cleanSolve=usedHints===0;message('Plocha vyčištěna. Čas, tahy i nápovědy běží dál.');if(g.mode==='starter')updateStarterGuidance();else{renderGameBoard();renderGameHUD();updateGameFeel()}saveGameProgress();showGameUndo()
}
function renderHintChoices(mode){const copy=mode==='tajenka'?[['Významová stopa','Napoví význam hledaného slova.'],['Kde začít','Ukáže první písmeno a délku.'],['Odhalit cestu','Ukáže celé slovo i jeho cestu.']]:[['Lehká','Ukáže začátek a délku vhodného slova.'],['Silnější','Ukáže první tři políčka cesty.'],['Odhalit','Na chvíli ukáže celé slovo i jeho cestu.']];$$('.hint-choice').forEach((button,i)=>{const row=copy[i];if(!row)return;button.querySelector('strong').textContent=row[0];button.querySelector('small').textContent=row[1]})}
function openHintModal(fromHelper=false){if(!currentGame||currentGame.mode==='rescue'||currentGame.finished)return;const g=currentGame;if(g.undoSnapshot)hideGameUndo();if(g.mode==='starter')hideStarterHintNudge();if(!fromHelper)g.nextHintSource='manual';const starter=g.mode==='starter',tajenka=g.mode==='tajenka';renderHintChoices(tajenka?'tajenka':'default');$('#hintModal').classList.toggle('starter-hint',starter);$('#hintEyebrow').textContent=starter?'TRÉNINKOVÁ NÁPOVĚDA':tajenka?'TAJENKA · NÁPOVĚDA':'CHYTRÁ NÁPOVĚDA';$('#hintTitle').textContent=starter?'Zkus malé postrčení':tajenka?'Jak moc napovědět?':'Kolik pomoci chceš?';$('#hintCopy').textContent=starter?'V běžné hře nápověda zruší ✨ Čistě. Tady si ji můžeš bezpečně vyzkoušet.':tajenka?'Začni významovou stopou. Silnější pomoc ukáže i cestu; odměnu 200 XP ani žebříček tím neztratíš.':'Jakákoli nápověda zruší ✨ čisté řešení této úrovně. Nápovědy zatím nejsou omezené.';$('#hintModal').classList.remove('hidden')
}
function pickHintTarget(){const g=currentGame;if(g?.mode==='starter'&&!g.found.some(f=>f.answerIndex===2))return {a:g.puzzle.answers[2],i:2};return g.puzzle.answers.map((a,i)=>({a,i})).filter(x=>!g.found.some(f=>f.answerIndex===x.i)).sort((x,y)=>(x.a.turns||0)-(y.a.turns||0)||x.a.word.length-y.a.word.length)[0]
}
function clearHintTrace(){$$('.cell.hint,.cell.hint-route,.cell.hint-full').forEach(c=>{c.classList.remove('hint','hint-route','hint-full');delete c.dataset.hintOrder})}
function applySmartHint(level){const g=currentGame,pick=pickHintTarget();$('#hintModal').classList.add('hidden');if(!pick)return;const starter=g.mode==='starter',tajenka=g.mode==='tajenka',source=g.nextHintSource||'manual',complimentary=!starter&&!tajenka&&!g.isReplay&&(supportMode()==='beginner'||supportMode()==='younger')&&(g.hints||0)===0&&level===1;g.nextHintSource='manual';if(starter){g.starterHintUsed=true;hideStarterHintNudge();trackProductEvent('starter_hint_used',{level})}else{g.hints=(g.hints||0)+1;if(source==='helper')g.helperHintUsed=true;if(!tajenka){sendHintEvent(level,source,complimentary);sendAttemptCheckpoint('hint');g.maxHintLevel=Math.max(g.maxHintLevel||0,level);g.cleanSolve=false}}clearHintTrace();const path=pick.a.path;if(tajenka&&level===1){message(`💭 ${pick.a.clue||`Hledáš slovo o ${pick.a.word.length} písmenech.`}`,'good')}else if(tajenka&&level===2){const c=$(`.cell[data-index="${path[0]}"]`);c?.classList.add('hint');message(`Začni na ${pick.a.word[0]}. Hledáš slovo o ${countCz(pick.a.word.length,'písmenu','písmenech','písmenech')}.`)}else if(level===1){const c=$(`.cell[data-index="${path[0]}"]`);c?.classList.add('hint');message(starter?`Tady začíná ${pick.a.word}. Teď už ho propleť sám.`:`Začni na ${pick.a.word[0]}. Hledáš slovo o ${countCz(pick.a.word.length,'písmenu','písmenech','písmenech')}.`)}else if(level===2){path.slice(0,Math.min(3,path.length)).forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}});message(starter?`První tři kroky slova ${pick.a.word} svítí. Zbytek je na tobě.`:`První tři kroky svítí. Slovo má ${countCz(pick.a.word.length,'písmeno','písmena','písmen')}.`)}else{path.forEach((i,n)=>{const c=$(`.cell[data-index="${i}"]`);if(c){c.classList.add('hint-full');if(n<3){c.classList.add('hint-route');c.dataset.hintOrder=String(n+1)}}});message(starter?`Takhle vypadá celá cesta slova ${pick.a.word}. V běžné hře by tím skončilo ✨ Čistě.`:`Je to „${pick.a.word}“. Cesta na chvíli svítí.`)}renderGameHUD();if(!starter)saveGameProgress();fx('hint');setTimeout(clearHintTrace,level===3?3600:2600)
}
function message(t,kind=''){$('#gameMessage').textContent=t;$('#gameMessage').className=`game-message ${kind}`}
function drawPaths(){
 if(!currentGame)return;const g=currentGame,board=$('#board'),svg=$('#pathLayer'),br=board.getBoundingClientRect();if(!br.width)return;svg.setAttribute('viewBox',`0 0 ${br.width} ${br.height}`);svg.innerHTML='';
 const paths=[...g.found.map(f=>({path:f.path,color:COLORS[f.colorIndex%COLORS.length],kind:'found'}))];if(g.starterGuidePath?.length>1)paths.push({path:g.starterGuidePath,color:'#8c80ee',kind:'guide'});if(g.path.length>1)paths.push({path:g.path,color:'#7d6fe7',kind:'active'});if(g.wrongPath?.length>1)paths.push({path:g.wrongPath,color:'#d8665d',kind:'wrong'});
 paths.forEach(({path,color,kind})=>{if(path.length<2)return;const pts=path.map(i=>{const c=$(`.cell[data-index="${i}"]`),r=c?.getBoundingClientRect();return r?`${r.left-br.left+r.width/2},${r.top-br.top+r.height/2}`:null}).filter(Boolean).join(' ');if(!pts)return;const pl=document.createElementNS('http://www.w3.org/2000/svg','polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',color);pl.setAttribute('stroke-width',kind==='guide'?'7':'9');pl.setAttribute('stroke-linecap','round');pl.setAttribute('stroke-linejoin','round');pl.setAttribute('opacity',kind==='guide'?'.28':kind==='wrong'?'.78':'.52');pl.classList.add(`path-${kind}`);svg.appendChild(pl)});
}
async function finishAttemptTelemetry(rec){
 if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW||isMozkomorQaDifficulty(rec?.difficulty)||!rec?.attemptId||rec.mode==='rescue'||rec.mode==='starter')return;
 try{await api('/api/attempt/finish',{method:'POST',body:JSON.stringify({attempt_id:rec.attemptId,puzzle_id:rec.puzzleId,challenge_key:rec.challengeKey,mode:rec.mode,difficulty:rec.difficulty,elapsed_ms:rec.elapsedMs,moves:rec.moves,hints_used:rec.hintsUsed||0,wrong_attempts:rec.wrongAttempts||0,max_hint_level:rec.maxHintLevel||0,clean_solve:rec.cleanSolve===true,completed_at:rec.completedAt})})}catch{}
}

async function finishStarterGame(g){
 $('#tajenkaWinPhrase')?.classList.add('hidden');$('#winDetails')?.classList.remove('hidden');g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();releaseGameWakeLock();g.starterGuidePath=[];hideStarterHintNudge();renderGameBoard();renderGameHUD();updateGameFeel();
 const starterDaily=dailyPuzzleFor(pragueDateISO()),hardNext=starterDaily?.difficulty==='hard';g.starterNextHard=hardNext;if(hardNext)trackProductEvent('starter_hard_choice_shown');
 await sleep(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?220:520);
 const key=challengeKey('starter',g.puzzle,null),state=getState(),old=state.completed[key],rec={puzzleId:g.puzzle.id,challengeKey:key,mode:'starter',difficulty:'easy',dailyDate:null,level:null,contentGeneration:null,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:old?0:pointsFor('starter','easy',g.puzzle),hintsUsed:0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:0,attemptId:null,cleanSolve:true,completedAt:new Date().toISOString()};
 if(!old)state.completed[key]=rec;saveState(state);if(!old)queueResult(rec);trackProductEvent('starter_completed');
 const winBoard=$('#levelLeaderboardBox');winBoard?.classList.add('hidden');$('#winBadge').textContent='🎓';$('#winTitle').textContent='První Proplet je doma!';$('#winPraise').textContent=g.starterHintUsed?'Rovná cesta, zatáčka, nápověda i šnek. Teď už znáš všechno důležité.':'Rovná cesta, zatáčka i šnek. Nápověda zůstala po ruce — a nebyla potřeba.';$('#winPraise').classList.remove('hidden');$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')} · první výhra`;$('#winXp').textContent=old?'🎓 Trénink dokončen':'+10 XP · první odměna';const wc=$('#winClean');wc.classList.remove('hidden','hinted');wc.textContent='🎓 Zaškoleno';$('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join('');$('#newBadgeBox').classList.add('hidden');$('#newBadgeBox').innerHTML='';const hardActions=$('#starterHardActions');hardActions?.classList.toggle('hidden',!hardNext);
 $('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.toggle('hidden',hardNext);if(!hardNext)$('#winMenuBtn').textContent='Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').classList.toggle('hidden',hardNext);if(!hardNext)$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️';$('#winModal').classList.add('starter-win');$('#winModal').classList.remove('hidden');confetti();fx('win');renderDaily();renderFree();renderProfile();
 if(getProfile()?.token&&!old)syncQueue({announce:false}).catch(()=>{});
}
async function finishTajenkaGame(g){
 if(!g||g.mode!=='tajenka'||g.finished)return;
 g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();releaseGameWakeLock();renderGameBoard();renderGameHUD();updateGameFeel();
 const state=tajenkaState(),old=tajenkaCompletion(g.puzzle,state),rewardXp=old?0:Number(g.puzzle.meta?.rewardXp)||TAJENKA_REWARD_XP,completion={puzzleId:g.puzzle.id,found:g.found.map(f=>({answerIndex:f.answerIndex,word:f.word,colorIndex:f.colorIndex,path:[...f.path]})),moves:g.moves||0,hints:g.hints||0,elapsedMs:Math.round(g.elapsedMs),completedAt:new Date().toISOString(),rewarded:true,rewardXp};state.version=2;state.completions=state.completions||{};state.completions[g.puzzle.id]=completion;state.completed=completion;delete state.inProgress;saveTajenkaState(state);
 if(TAJENKA_RELEASE_ENABLED&&!old){const rec={puzzleId:g.puzzle.id,challengeKey:challengeKey('tajenka',g.puzzle,null),mode:'tajenka',difficulty:g.puzzle.difficulty||'medium',dailyDate:null,level:null,contentGeneration:null,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:rewardXp,hintsUsed:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,attemptId:null,cleanSolve:(g.hints||0)===0,completedAt:completion.completedAt};queueResult(rec);if(getProfile()?.token)syncQueue({announce:false}).catch(()=>{})}
 trackProductEvent('tajenka_completed');
 await sleep(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?220:520);
 $('#screen-game').classList.add('tajenka-mode');$('#winModal').classList.remove('starter-win','hidden');$('#levelLeaderboardBox')?.classList.add('hidden');$('#winAccountBtn')?.classList.add('hidden');$('#newBadgeBox')?.classList.add('hidden');$('#newBadgeBox').innerHTML='';$('#winFeedback')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winBadge').textContent='✦';$('#winTitle').textContent='Tajenka odhalena!';$('#winPraise').textContent='Pět slov, jedna společná myšlenka.';$('#winPraise').classList.remove('hidden');$('#winText').textContent=`${fmtTime(g.elapsedMs)} · ${countCz(g.moves,'tah','tahy','tahů')} · víkendový bonus`;$('#winXp').textContent=rewardXp?`+${rewardXp} XP · jednou za tuto Tajenku`:'Znovu · bez dalších XP';$('#winClean').classList.remove('hidden','hinted');$('#winClean').textContent='Bonus bez žebříčku';const phrase=$('#tajenkaWinPhrase'),words=tajenkaPhraseWords(g.puzzle);if(phrase){phrase.classList.remove('hidden');phrase.innerHTML=`<span class="stat-label">TAJENKA</span><strong>${esc(g.puzzle.tajenka.phrase)}</strong><small>${countCz(words.length,'nalezené slovo','nalezená slova','nalezených slov')}</small>`}$('#winWords').innerHTML='';$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winPrimaryBtn').classList.remove('hidden');$('#winPrimaryBtn').textContent='Zpět na Dnes';confetti();fx('win');renderTajenkaEntry();
}
async function finishGame(){
 const g=currentGame;if(g?.mode==='starter')return finishStarterGame(g);if(g?.mode==='tajenka')return finishTajenkaGame(g);postWinEngagementNudgeShown=false;g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();releaseGameWakeLock();g.starterGuidePath=[];$('#tajenkaWinPhrase')?.classList.add('hidden');$('#winDetails')?.classList.remove('hidden');renderGameBoard();renderGameHUD();updateGameFeel();await sleep(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?220:520);const key=challengeKey(g.mode,g.puzzle,g.dailyDate),statsBefore=effectiveStats(),state=getState(),old=state.completed[key];
 const dailyGenerationUpgrade=g.mode==='daily'&&!!old&&old.puzzleId!==g.puzzle.id;
 const dailyReplay=g.mode==='daily'&&!!old&&!dailyGenerationUpgrade;
 const rec={puzzleId:g.puzzle.id,challengeKey:key,mode:g.mode,difficulty:g.puzzle.difficulty,dailyDate:g.dailyDate,level:g.mode==='free'?Number(g.puzzle.meta?.level)||null:null,contentGeneration:g.mode==='free'?Number(g.puzzle.meta?.contentGeneration)||Number(puzzleDB.freeGeneration)||2:null,elapsedMs:Math.max(1000,Math.round(g.elapsedMs)),moves:Math.max(1,g.moves),points:pointsFor(g.mode,g.puzzle.difficulty,g.puzzle),hintsUsed:g.hints||0,wrongAttempts:g.wrongAttempts||0,maxHintLevel:g.maxHintLevel||0,attemptId:g.attemptId||null,cleanSolve:(g.hints||0)===0,completedAt:new Date().toISOString()};
 if(dailyGenerationUpgrade)rec.points=old.points??rec.points;if(!old||dailyGenerationUpgrade)state.completed[key]=rec;if(state.inProgress?.[key])delete state.inProgress[key];saveState(state);queueResult(rec);g.finishTelemetryPromise=finishAttemptTelemetry(rec);
 $('#winModal').classList.remove('starter-win');$('#starterHardActions')?.classList.add('hidden');$('#winPrimaryBtn').classList.remove('hidden');$('#winDetails')?.classList.remove('hidden');$('#winFeedback')?.classList.remove('hidden');winDailyGlobalData=null;const winBoard=$('#levelLeaderboardBox');if(winBoard){winBoard.classList.remove('daily-global-board','free-level-board');if(g.mode==='free'&&!g.postStarterWarmup){winBoard.classList.remove('hidden');winBoard.innerHTML='<div class="leaderboard-empty"><strong>Aktualizuji pořadí…</strong><small>Započítávám právě dohraný výsledek.</small></div>'}else if(g.postStarterWarmup){winBoard.classList.add('hidden')}else if(g.mode==='daily'){winBoard.classList.remove('hidden');winBoard.classList.add('daily-global-board');winBoard.innerHTML='<div class="leaderboard-empty"><strong>Hledám tvoje místo ve světě…</strong><small>Nejdřív bezpečně ukládám výsledek.</small></div>'}else winBoard.classList.add('hidden')}
 const beforeLongest=calcLongest(Object.values(getState().completed).filter(r=>r.mode==='daily'&&r.challengeKey!==key).map(r=>r.dailyDate));const stats=effectiveStats(),newBadge=(!old&&g.mode==='daily')?BADGES.find(b=>b.days>beforeLongest&&b.days<=stats.longestStreak):null,newAchievements=ACHIEVEMENTS.filter(a=>!a.test(statsBefore)&&a.test(stats));
 $('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';renderCompletionPraise(g.puzzle.difficulty,rec);if(g.postStarterWarmup){trackProductEvent('starter_easy_warmup_completed');$('#winTitle').textContent='Paráda. Teď už jsi rozehřátý.';}const levelSuffix=g.mode==='free'&&g.puzzle.meta?.level?` ${g.puzzle.meta.level}`:'';$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')} · ${DIFF[g.puzzle.difficulty].label}${levelSuffix}`;
 $('#winXp').textContent=dailyGenerationUpgrade?'✓ Nová Daily započítaná · 100 XP už máš':dailyReplay?'Tréninkový pokus · 100 XP už máš':old&&g.mode==='free'?'Tréninkový pokus · do pořadí platí první výsledek':g.mode==='free'&&rec.points===0?'Tréninkový pokus · XP už máš':`+${rec.points} XP`;const wc=$('#winClean');wc.classList.remove('hidden','hinted');wc.textContent=rec.cleanSolve?'✨ Čistě · bez nápovědy':(g.helperHintUsed?`💛 S Pomocníkem · ${countCz(rec.hintsUsed,'nápověda','nápovědy','nápověd')}`:`💡 ${countCz(rec.hintsUsed,'nápověda','nápovědy','nápověd')}`);if(!rec.cleanSolve)wc.classList.add('hinted');$('#winWords').innerHTML=g.found.map(f=>`<span class="win-word" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,${COLORS[f.colorIndex%COLORS.length]} 55%,white)">${f.word}</span>`).join('');
 const celebrations=[];if(!g.postStarterWarmup&&newBadge)celebrations.push(`<div class="unlock-row"><span class="emoji">${newBadge.icon}</span><div><strong>Nový odznak · ${newBadge.name}</strong><small>${countCz(newBadge.days,'den','dny','dní')} v řadě</small></div></div>`);if(!g.postStarterWarmup&&newAchievements.length){celebrations.push(`<div class="unlock-title">🏆 ${newAchievements.length===1?'Nový úspěch!':`Nové úspěchy · ${newAchievements.length}`}</div>`+newAchievements.map(a=>`<div class="unlock-row achievement-unlock"><span class="emoji">${a.icon}</span><div><strong>${a.name}</strong><small>${a.desc}</small></div></div>`).join(''))}$('#newBadgeBox').classList.toggle('hidden',!celebrations.length);$('#newBadgeBox').innerHTML=celebrations.join('');
 configureWinReplay(g.mode,g.dailyDate,rec);$('#winShareBtn').classList.toggle('hidden',!!g.postStarterWarmup);$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=g.postStarterWarmup?'Zůstat ve Volné hře':g.mode==='daily'?'← Dnes':'← Menu';$('#winPrimaryBtn').textContent=g.postStarterWarmup?'☀️ Jdu na dnešní výzvu':g.mode==='daily'?'Vybrat další hru':g.mode==='free'&&g.contentBatchId?(latestContentUnplayed().length?'Hrát další nový':'Zpět k Volné hře'):'Hrát další úroveň';$('#winModal').classList.remove('hidden');updateWinAccountCta();renderWinFeedback();confetti();fx('win');renderDaily();renderFree();renderProfile();
 if(g.mode==='free'&&!g.postStarterWarmup){
 if(getProfile()?.token){syncQueue({announce:false}).then(r=>{if(r.ok||!r.failedKeys?.includes(rec.challengeKey))return loadWinLevelLeaderboard(g.puzzle,rec);const box=$('#levelLeaderboardBox');if(box)box.innerHTML='<div class="leaderboard-empty"><strong>Výsledek čeká na synchronizaci.</strong><small>Pořadí ukážeme, jakmile ho server potvrdí.</small></div>'}).catch(()=>{});}
  else loadWinLevelLeaderboard(g.puzzle,rec);
 }else if(g.mode==='daily'){
  if(getProfile()?.token){syncQueue({announce:false}).then(r=>{if(r.ok||!r.failedKeys?.includes(rec.challengeKey))return loadWinDailyGlobalLeaderboard(g.dailyDate,rec);const box=$('#levelLeaderboardBox');if(box)box.innerHTML='<div class="leaderboard-empty"><strong>Výsledek čeká na synchronizaci.</strong><small>Globální místo ukážeme, jakmile ho server potvrdí.</small></div>'}).catch(()=>{});}
  else loadWinDailyGlobalLeaderboard(g.dailyDate,rec);
 }else $('#levelLeaderboardBox').classList.add('hidden')
}
function accountNudgeState(){
 try{const raw=localStorage.getItem(ACCOUNT_NUDGE_KEY);if(!raw)return {shown:[]};const parsed=JSON.parse(raw);if(Array.isArray(parsed?.shown))return parsed;if(parsed?.shownAt)return {shown:[1],legacy:true};return {shown:[]}}catch{return {shown:[]}}
}
function saveAccountNudgeState(state){try{localStorage.setItem(ACCOUNT_NUDGE_KEY,JSON.stringify(state))}catch{}}
function completedGameCount(){return Object.values(getState().completed||{}).filter(r=>r&&(r.mode==='daily'||r.mode==='free')).length}
function dueAccountNudgeStage(){
 const count=completedGameCount(),shown=new Set(accountNudgeState().shown||[]);return ACCOUNT_NUDGE_THRESHOLDS.findIndex((threshold,i)=>count>=threshold&&!shown.has(i+1))+1||0;
}
function shouldOfferAccountNudge(){
 if(getProfile()?.token||currentGame?.mode==='rescue'||currentGame?.mode==='starter'||currentGame?.postStarterWarmup||currentGame?.justCompleted!==true)return 0;
 const guardShownAt=Date.parse(progressGuardState().lastShownAt||'');if(Number.isFinite(guardShownAt)&&Date.now()-guardShownAt<PROGRESS_GUARD_COOLDOWN_MS)return 0;
 return dueAccountNudgeStage();
}
function renderAccountNudge(stage){
 const count=completedGameCount(),copy=stage===1?['PRVNÍ PROPLET JE DOMA','Uložit postup?','Bez účtu zůstává postup jen na tomhle zařízení. Účet zabere pár sekund a tým můžeš řešit až někdy potom.']:stage===2?['UŽ SE TO PLETE','Uložit si tenhle postup?',`Máš hotové už ${countCz(count,'Proplet','Proplety','Propletů')}. S účtem o ně nepřijdeš a můžeš pokračovat na jiném zařízení.`]:['POSLEDNÍ PŘIPOMENUTÍ','Tenhle postup už stojí za účet',`Tohle je poslední automatická nabídka. Ulož si ${countCz(count,'dokončenou hru','dokončené hry','dokončených her')} do cloudu a zapoj se do pořadí.`];
 $('#accountNudgeEyebrow').textContent=copy[0];$('#accountNudgeTitle').textContent=copy[1].trim();$('#accountNudgeCopy').textContent=copy[2];
}
function performPostWinAction(action){
 const mode=currentGame?.mode,diff=currentGame?.puzzle?.difficulty;
 if(mode==='tajenka'){nav('daily',{replace:true});return}
 if(mode==='starter'){
  if(currentGame?.starterNextHard){if(action==='menu'){trackProductEvent('starter_hard_direct_selected');startDaily({starterHardDirect:true});return}trackProductEvent('starter_easy_warmup_selected');startStarterWarmup();return}
  if(action==='menu'){nav('free',{replace:true});return}startDaily();return
 }
 if(mode==='free'&&currentGame?.postStarterWarmup){if(action==='continue'){startDaily();return}nav('free',{replace:true});return}
 if(action==='continue'){if(mode==='free'&&currentGame?.contentBatchId){continueLatestContent();return}if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}
 nav(mode==='daily'||mode==='rescue'?'daily':'free',{replace:currentScreen==='game'});
}
function maybeOfferAccountNudge(action){
 const stage=shouldOfferAccountNudge();if(!stage)return false;accountNudgeStage=stage;const state=accountNudgeState(),shown=new Set(state.shown||[]);shown.add(stage);saveAccountNudgeState({...state,shown:[...shown].sort(),lastShownAt:new Date().toISOString()});trackProductEvent('account_nudge_shown');trackProductEvent(`account_nudge_${stage}_shown`);renderAccountNudge(stage);
 postWinEngagementNudgeShown=true;pendingPostWinAction=action;$('#winModal').classList.add('hidden');$('#accountNudgeModal').classList.remove('hidden');return true;
}
async function resumeAfterAccountNudge(){
 const action=pendingPostWinAction;pendingPostWinAction=null;profileModalFromNudge=false;accountNudgeStage=0;
 if(action){if(await maybeOfferPushNudge(action))return;performPostWinAction(action)}
}
function openAccountFromNudge(mode){
 trackProductEvent(mode==='create'?'account_nudge_create':'account_nudge_login');if(accountNudgeStage)trackProductEvent(`account_nudge_${accountNudgeStage}_${mode==='create'?'create':'login'}`);$('#accountNudgeModal').classList.add('hidden');profileModalFromNudge=true;openProfileModal(mode);
}
function dismissAccountNudge(){trackProductEvent('account_nudge_dismissed');if(accountNudgeStage)trackProductEvent(`account_nudge_${accountNudgeStage}_dismissed`);$('#accountNudgeModal').classList.add('hidden');resumeAfterAccountNudge()}
function progressGuardState(){try{return JSON.parse(localStorage.getItem(PROGRESS_GUARD_KEY)||'{}')||{}}catch{return {}}}
function saveProgressGuardState(state){try{localStorage.setItem(PROGRESS_GUARD_KEY,JSON.stringify(state))}catch{}}
function progressGuardHasCoarsePointer(){return !!window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches}
function progressGuardLastPromptAt(){
 const times=[progressGuardState().lastShownAt,accountNudgeState().lastShownAt].map(value=>Date.parse(value||'')).filter(Number.isFinite);return times.length?Math.max(...times):0;
}
function canOfferProgressGuard(source){
 if(getProfile()?.token||completedGameCount()<1||currentScreen==='game'||openTransientModal())return false;
 if(source==='desktop'&&progressGuardHasCoarsePointer())return false;
 if(source==='mobile'&&!progressGuardHasCoarsePointer())return false;
 const last=progressGuardLastPromptAt();return !last||Date.now()-last>=PROGRESS_GUARD_COOLDOWN_MS;
}
function renderProgressGuard(source){
 const stats=currentLocalStats(),count=stats.totalCompleted||completedGameCount();
 $('#progressGuardEyebrow').textContent=source==='mobile'?'VÍTEJ ZPÁTKY':'NEŽ ODEJDEŠ';
 $('#progressGuardCopy').textContent=source==='mobile'?'Postup zůstává jen v tomto zařízení. Ulož si ho, než se zase vydáš hrát.':'Bez účtu zůstává postup jen v tomto zařízení. Ulož si ho dřív, než zavřeš Proplet.';
 $('#progressGuardGames').textContent=String(count);
 $('#progressGuardGames').nextElementSibling.textContent=czPlural(count,'hotová hra','hotové hry','hotových her');
 $('#progressGuardXp').textContent=`${Number(stats.points||0).toLocaleString('cs-CZ')} XP`;
}
function maybeOfferProgressGuard(source){
 if(!canOfferProgressGuard(source))return false;
 renderProgressGuard(source);saveProgressGuardState({...progressGuardState(),lastShownAt:new Date().toISOString(),lastSource:source});trackProductEvent(`progress_guard_${source}_shown`);$('#progressGuardModal').classList.remove('hidden');return true;
}
function dismissProgressGuard(){trackProductEvent('progress_guard_dismissed');$('#progressGuardModal').classList.add('hidden')}
function openProgressGuardGoogle(){trackProductEvent('progress_guard_google_selected');location.href='/api/auth/google/start'}
function openProgressGuardAccount(){trackProductEvent('progress_guard_other_account_selected');$('#progressGuardModal').classList.add('hidden');openProfileModal('create')}
function rememberProgressGuardDeparture(){
 if(!progressGuardHasCoarsePointer())return;progressGuardHiddenAt=Date.now();saveProgressGuardState({...progressGuardState(),lastHiddenAt:new Date(progressGuardHiddenAt).toISOString()});
}
function consumeProgressGuardAwayTime(){
 const state=progressGuardState(),persisted=Date.parse(state.lastHiddenAt||''),started=progressGuardHiddenAt||(Number.isFinite(persisted)?persisted:0),away=started?Date.now()-started:0;progressGuardHiddenAt=0;if(state.lastHiddenAt)saveProgressGuardState({...state,lastHiddenAt:null});return away;
}
function bindProgressGuard(){
 document.addEventListener('mouseout',e=>{if(e.relatedTarget||e.clientY>4||performance.now()<15000)return;maybeOfferProgressGuard('desktop')});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){rememberProgressGuardDeparture();return}const away=consumeProgressGuardAwayTime();if(away>=PROGRESS_GUARD_MOBILE_AWAY_MS)setTimeout(()=>maybeOfferProgressGuard('mobile'),500)});
 if(document.visibilityState==='visible'&&progressGuardHasCoarsePointer()){const away=consumeProgressGuardAwayTime();if(away>=PROGRESS_GUARD_MOBILE_AWAY_MS)setTimeout(()=>maybeOfferProgressGuard('mobile'),900)}
}
function updateWinAccountCta(){const button=$('#winAccountBtn'),show=!!button&&!getProfile()?.token&&!!currentGame?.finished&&currentGame.mode!=='rescue'&&currentGame.mode!=='starter'&&!currentGame?.postStarterWarmup;button?.classList.toggle('hidden',!show);if(show&&!button.dataset.impression){button.dataset.impression='1';trackProductEvent('win_account_cta_shown')}else if(!show&&button)delete button.dataset.impression}
function restoreWinAfterAccountModal(){profileModalFromWin=false;if(!currentGame?.finished)return;$('#winModal').classList.remove('hidden');updateWinAccountCta()}
function openAccountFromWin(){if(getProfile()?.token)return;trackProductEvent('win_account_cta_create');profileModalFromWin=true;$('#winModal').classList.add('hidden');openProfileModal('create')}
async function refreshWinLeaderboardAfterAuth(){if(!currentGame?.finished)return;updateWinAccountCta();if(currentGame.mode==='daily')await loadWinDailyGlobalLeaderboard(currentGame.dailyDate||pragueDateISO(),getState().completed[`daily:${currentGame.dailyDate||pragueDateISO()}`]||currentGame);else if(currentGame.mode==='free')await loadWinLevelLeaderboard(currentGame.puzzle,getState().completed[`free:${currentGame.puzzle.id}`]||currentGame)}
async function closeWinAndContinue(){if(maybeOfferAccountNudge('continue'))return;if(await maybeOfferPushNudge('continue'))return;if(maybeOfferInstallNudge('continue','daily'))return;$('#winModal').classList.add('hidden');performPostWinAction('continue')}
async function closeWinToMenu(){if(maybeOfferAccountNudge('menu'))return;if(await maybeOfferPushNudge('menu'))return;if(maybeOfferInstallNudge('menu','daily'))return;$('#winModal').classList.add('hidden');performPostWinAction('menu')}
function showDailyResult(date,rec){
 const p=dailyPuzzleFor(date);stopTimer();winDailyGlobalData=null;currentGame={puzzle:p,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};
 $('#winBadge').textContent='☀️';renderCompletionPraise(p.difficulty,rec);$('#winText').textContent=`${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')} · ${DIFF[p.difficulty].label}`;$('#winXp').textContent='+100 XP';const wc=$('#winClean');const knownClean=rec.cleanSolve===true;const hints=rec.hintsUsed||0;wc.classList.remove('hidden','hinted');wc.textContent=knownClean?'✨ Čistě · bez nápovědy':(hints?`💡 ${countCz(hints,'nápověda','nápovědy','nápověd')}`:'Výsledek z předchozího postupu');if(!knownClean)wc.classList.add('hinted');
 $('#winWords').innerHTML=p.answers.map((a,i)=>`<span class="win-word" style="--word-color:${COLORS[i%COLORS.length]};background:color-mix(in srgb,${COLORS[i%COLORS.length]} 55%,white)">${a.word}</span>`).join('');
 $('#newBadgeBox').classList.add('hidden');configureWinReplay('daily',date,rec);$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='← Dnes';$('#winPrimaryBtn').textContent='Vybrat další hru';$('#winModal').classList.remove('hidden');updateWinAccountCta();renderWinFeedback();loadWinDailyGlobalLeaderboard(date,rec);
}
function shareText(){
 const g=currentGame;if(!g?.puzzle)return `Proplet 🧩

Zahraj si taky: ${SHARE_URL}`;const key=challengeKey(g.mode,g.puzzle,g.dailyDate),rec=getState().completed[key]||g,clean=rec?.cleanSolve===true?'✨ Čistě':(rec?.hintsUsed?`💡 ${countCz(rec.hintsUsed,'nápověda','nápovědy','nápověd')}`:'');
 if(g.mode==='daily'){const stats=effectiveStats(),date=g.dailyDate||pragueDateISO(),world=winDailyGlobalData?.date===date&&winDailyGlobalData.myRank?` · 🌍 ${winDailyGlobalData.myRank}. z ${winDailyGlobalData.total}`:'';return `Proplet · ${formatDateCZ(date)}
${DIFF[g.puzzle.difficulty].label} · ⏱ ${fmtTime(rec.elapsedMs)} · 🔥 ${countCz(stats.currentStreak,'den','dny','dní')}${world}${clean?`
${clean}`:''}

Zahraj si taky: ${SHARE_URL}`}
 const level=g.puzzle.meta?.level||'?';const rank=levelDetailContext?.puzzleId===g.puzzle.id&&levelDetailContext?.globalRank?` · 🌍 ${levelDetailContext.globalRank}. globálně`:levelDetailContext?.puzzleId===g.puzzle.id&&levelDetailContext?.teamRank?` · ${levelDetailContext.teamRank}. místo v týmu`:'';
 return `Proplet · ${DIFF[g.puzzle.difficulty].label} · úroveň ${level}${rank}
⏱ ${fmtTime(rec.elapsedMs)} · ${countCz(rec.moves,'tah','tahy','tahů')}${clean?` · ${clean}`:''}

Zahraj si taky: ${SHARE_URL}`;
}
async function shareProplet(text){try{if(navigator.share){const body=text.split('\n\nZahraj si taky:')[0];await navigator.share({title:'Proplet – česká slovní hra',text:body,url:SHARE_URL})}else{await navigator.clipboard.writeText(text);showToast('Výsledek i odkaz jsou ve schránce ✓')}}catch(e){if(e?.name!=='AbortError')showToast('Sdílení se nepovedlo. Zkus to znovu.')}}
async function shareDaily(){await shareProplet(shareText())}
function replayDailyFromWin(){const date=$('#winReplayBtn')?.dataset.dailyDate||currentGame?.dailyDate||pragueDateISO(),puzzle=dailyPuzzleFor(date);$('#winModal').classList.add('hidden');startGame(puzzle,'daily',date)}

function queueResult(rec){
 if(GEN4_CANDIDATE_PREVIEW||isMozkomorQaDifficulty(rec?.difficulty))return;
 if(CONTENT_PREVIEW_DATE&&rec?.mode==='free'&&Number(rec?.level||0)>200)return;
 const q=getQueue();if(rec.mode==='daily'){const i=q.findIndex(x=>x.challengeKey===rec.challengeKey);if(i<0)q.push(rec);else if(q[i].puzzleId!==rec.puzzleId)q[i]=rec}else{const id=rec.attemptId||`${rec.challengeKey}:${rec.completedAt}`;if(!q.some(x=>(x.attemptId||`${x.challengeKey}:${x.completedAt}`)===id))q.push(rec)}saveQueue(q);renderDaily();
}
async function api(path,opts={}){
 const p=getProfile(),headers={'Content-Type':'application/json','X-Proplet-Version':APP_VERSION,...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;else headers['X-Proplet-Anon-ID']=getAnonymousId();if(CONTENT_PREVIEW_DATE)headers['X-Proplet-Preview-As-Of']=CONTENT_PREVIEW_DATE;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let r;
 try{r=await fetch(path,{...opts,headers,signal:controller.signal,cache:'no-store'})}catch(e){clearTimeout(timeout);if(e.name==='AbortError')throw new Error('Server se neozval včas');throw new Error(navigator.onLine?'Spojení se serverem selhalo':'Telefon je offline')}
 clearTimeout(timeout);if(!r.ok){let msg=`Server vrátil chybu ${r.status}`,requestId='';try{const body=await r.json();msg=body.detail||body.message||msg;requestId=String(body.requestId||'').replace(/[^A-Za-z0-9_.:-]/g,'').slice(0,24)}catch{}if(requestId)msg+=` · kód ${requestId}`;const error=new Error(msg);error.status=r.status;throw error}return r.json();
}
function trackProductEvent(eventType){if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW)return;api('/api/product-event',{method:'POST',body:JSON.stringify({event_type:eventType})}).catch(()=>{})}
function trackInboundCampaign(){
 try{const u=new URL(location.href),via=u.searchParams.get('via'),event={"push-daily":"push_daily_opened","push-weekly":"push_weekly_opened","push-content":"push_content_opened","push-return":"push_return_opened","push-tajenka":"push_tajenka_opened"}[via];if(!event)return;trackProductEvent(event);u.searchParams.delete('via');history.replaceState(history.state,'',`${u.pathname}${u.search}${u.hash}`)}catch{}
}
function trackAppSession(){
 try{if(sessionStorage.getItem(ANALYTICS_SESSION_KEY)==='1')return;sessionStorage.setItem(ANALYTICS_SESSION_KEY,'1')}catch{}
 trackProductEvent('app_session_started');
 if(currentScreen!=='game')trackProductEvent(`screen_${currentScreen}_viewed`);
}

async function syncQueue({announce=false}={}){
 if(GEN4_CANDIDATE_PREVIEW){syncState={status:'local',error:null,lastAt:null};renderDaily();renderProfile();return {ok:true,left:0,preview:true}}
 const p=getProfile();if(!p?.token){syncState={status:'local',error:null,lastAt:null};if(announce)showToast('Nejdřív si ulož hráčský účet.');renderDaily();renderProfile();return {ok:false,left:getQueue().length,error:'Bez hráče'}}
 const q=getQueue();syncState={status:'syncing',error:null,lastAt:syncState.lastAt};renderProfile();renderDaily();
 if(!q.length){try{await refreshRemoteProfile({throwOnError:true});syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast('Všechno je synchronizované ✓');renderProfile();renderDaily();if(currentScreen==='leaderboard')renderLeaderboard();return {ok:true,left:0}}catch(e){syncState={status:'error',error:e.message,lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace: ${e.message}`);renderProfile();renderDaily();return {ok:false,left:0,error:e.message}}}
 const left=[];let firstError=null,sent=0,quarantined=0;
 for(const r of q){try{await api('/api/result',{method:'POST',body:JSON.stringify({puzzle_id:r.puzzleId,challenge_key:r.challengeKey,mode:r.mode,difficulty:r.difficulty,elapsed_ms:Math.max(1000,Math.round(r.elapsedMs)),moves:Math.max(1,r.moves),daily_date:r.dailyDate,hints_used:Math.max(0,r.hintsUsed||0),wrong_attempts:Math.max(0,r.wrongAttempts||0),max_hint_level:Math.max(0,r.maxHintLevel||0),attempt_id:r.attemptId||null,clean_solve:r.cleanSolve===true,completed_at:r.completedAt||null})});sent++}catch(e){if(obsoleteQueuedResultError(e)&&quarantineRejectedResult(r,e.message)){quarantined++;continue}left.push(r);if(!firstError)firstError=e.message}}
 saveQueue(left);
 try{await refreshRemoteProfile({throwOnError:left.length===0})}catch(e){if(!firstError)firstError=e.message}
 if(left.length){syncState={status:'error',error:firstError||'Některé výsledky zůstaly ve frontě',lastAt:syncState.lastAt};if(announce)showToast(`Synchronizace selhala: ${syncState.error}`)}else{syncState={status:'success',error:null,lastAt:new Date().toISOString()};if(announce)showToast(quarantined?`Synchronizace opravena · ${countCz(quarantined,'zastaralý záznam','zastaralé záznamy','zastaralých záznamů')} bezpečně odložen ✓`:sent?`Synchronizováno ${countCz(sent,'výsledek','výsledky','výsledků')} ✓`:'Všechno je synchronizované ✓')}
 renderProfile();renderDaily();if(currentScreen==='leaderboard'&&!left.length)renderLeaderboard();return {ok:!left.length,left:left.length,error:firstError,failedKeys:[...new Set(left.map(r=>r.challengeKey))]};
}
function mergeRemoteProgress(rows){
 const state=getState();
 for(const r of rows||[]){
  if(!r?.challengeKey)continue;
  const old=state.completed[r.challengeKey];
  if(!old){state.completed[r.challengeKey]=r;if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];continue}
  // Aktivní Daily nesmí přepsat opožděná synchronizace archivované desky.
  if(r.mode==='daily'&&r.dailyDate){const activeId=dailyPuzzleFor(r.dailyDate).id;if(old.puzzleId===activeId&&r.puzzleId!==activeId)continue}
  // Server drží první oficiální dokončení pro Daily i volné úrovně.
  state.completed[r.challengeKey]={...old,...r};
  if(state.inProgress?.[r.challengeKey])delete state.inProgress[r.challengeKey];
 }
 saveState(state);
}
async function refreshRemoteProfile({throwOnError=false}={}){
 const p=getProfile();if(!p?.token)return null;
 try{
  const [me,progress]=await Promise.all([api('/api/me'),api('/api/progress')]);
  mergeRemoteProgress(progress.completed||[]);
  const remoteMode=validSupportMode(me.supportMode)?me.supportMode:(validSupportMode(p.supportMode)?p.supportMode:'none');rememberSupportMode(remoteMode);
  const repairedBoardXp=Number(me.stats?.gen4RewardRepairXp||0)-Number(me.stats?.gen4ReturnBonusAwardedNow||0);if(repairedBoardXp>0){const state=getState();state.gen4XpRepairNotice=true;saveState(state);document.dispatchEvent(new CustomEvent('proplet:gen4-xp-repair'))}
  saveProfile({...p,name:me.name,familyCode:me.familyCode,leagueName:me.leagueName,avatar:me.avatar||p.avatar||'🙂',googleLinked:!!me.googleLinked,googleAvatarUrl:me.googleAvatarUrl||null,useGoogleAvatar:!!me.useGoogleAvatar,supportMode:remoteMode,hasPassword:!!me.hasPassword,stats:me.stats});
  document.dispatchEvent(new CustomEvent('proplet:profile-refreshed'));
  return me;
 }catch(e){if(throwOnError)throw e;return null}
}


function renderPrivacyActions(){
 const p=getProfile();$('#exportDataBtn')?.classList.toggle('hidden',!p?.token);$('#deleteAccountBtn')?.classList.toggle('hidden',!p?.token);
}
function openSupportReport(){
 $('#supportReportCategory').value='bug';$('#supportReportMessage').value='';$('#supportReportReply').value='';$('#supportReportError').textContent='';$('#supportReportModal').classList.remove('hidden');setTimeout(()=>$('#supportReportMessage')?.focus(),0);
}
async function saveSupportReport(){
 const category=$('#supportReportCategory').value,message=$('#supportReportMessage').value.trim(),reply_to=$('#supportReportReply').value.trim(),button=$('#saveSupportReportBtn');$('#supportReportError').textContent='';
 if(message.length<3){$('#supportReportError').textContent='Napiš prosím aspoň krátce, co se stalo.';return}
 button.disabled=true;button.textContent='Odesílám…';
 try{await api('/api/support-report',{method:'POST',body:JSON.stringify({category,message,reply_to:reply_to||null,page:`${location.pathname}${location.search}`.slice(0,120)})});$('#supportReportModal').classList.add('hidden');showToast('Hlášení dorazilo. Díky, podívám se na něj ✓')}catch(e){$('#supportReportError').textContent=e.message}finally{button.disabled=false;button.textContent='Odeslat hlášení'}
}
async function exportAccountData(){
 const p=getProfile();if(!p?.token){openProfileModal('login');return}
 const button=$('#exportDataBtn');button.disabled=true;button.textContent='Připravuji export…';
 try{const data=await api('/api/account/export'),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`proplet-data-${pragueDateISO()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Export dat je připravený ✓')}catch(e){showToast(e.message)}finally{button.disabled=false;button.textContent='⬇ Export mých dat'}
}
function openDeleteAccount(){
 const p=getProfile();if(!p?.token){openProfileModal('login');return}$('#deleteAccountConfirm').value='';$('#deleteAccountPassword').value='';$('#deleteAccountError').textContent='';$('#deleteAccountPasswordLabel').classList.toggle('hidden',!p.hasPassword);$('#deleteAccountModal').classList.remove('hidden');setTimeout(()=>$('#deleteAccountConfirm')?.focus(),0);
}
async function deleteAccount(){
 const p=getProfile();if(!p?.token)return;const confirmation=$('#deleteAccountConfirm').value.trim(),password=$('#deleteAccountPassword').value,button=$('#confirmDeleteAccountBtn');$('#deleteAccountError').textContent='';
 if(confirmation.toLocaleUpperCase('cs-CZ')!=='SMAZAT'){ $('#deleteAccountError').textContent='Pro potvrzení napiš přesně SMAZAT.';return }
 if(p.hasPassword&&!password){$('#deleteAccountError').textContent='Zadej také své heslo.';return}
 button.disabled=true;button.textContent='Mažu účet…';const deletedId=p.id;
 try{
  await api('/api/account',{method:'DELETE',body:JSON.stringify({confirmation:'SMAZAT',password:p.hasPassword?password:null})});
  try{const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe()}catch{}
  try{const reg=await navigator.serviceWorker?.ready,sub=await reg?.pushManager?.getSubscription?.();if(sub)await sub.unsubscribe()}catch{}
  localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(scopedStorageKey(STORE_KEY,deletedId));localStorage.removeItem(scopedStorageKey(QUEUE_KEY,deletedId));localStorage.removeItem(scopedStorageKey(REJECTED_QUEUE_KEY,deletedId));localStorage.removeItem(scopedStorageKey(RESCUE_OFFER_KEY,deletedId));localStorage.removeItem(ACCOUNT_NUDGE_KEY);localStorage.removeItem(PROGRESS_GUARD_KEY);localStorage.removeItem(PUSH_NUDGE_KEY);localStorage.removeItem(SUPPORT_MODE_KEY);rotateAnonymousId();syncState={status:'idle',error:null,lastAt:null};currentGame=null;stopTimer();$('#deleteAccountModal').classList.add('hidden');updateProfileChip();renderProfile();renderDaily();renderFree();nav('daily',{replace:true});showToast('Účet a serverová data jsou smazaná.');
 }catch(e){$('#deleteAccountError').textContent=e.message}finally{button.disabled=false;button.textContent='Trvale smazat účet'}
}
let reportingClientError=false;
function reportClientError(code,message){
 if(reportingClientError||!navigator.onLine)return;reportingClientError=true;const p=getProfile(),headers={'Content-Type':'application/json'};if(p?.token)headers.Authorization=`Bearer ${p.token}`;else headers['X-Proplet-Anon-ID']=getAnonymousId();
 fetch('/api/client-error',{method:'POST',headers,body:JSON.stringify({code:String(code||'client_error').slice(0,80),message:String(message||'').slice(0,200),route:`${location.pathname}${location.search}`.slice(0,120)}),keepalive:true,cache:'no-store'}).catch(()=>{}).finally(()=>{reportingClientError=false});
}
function bindClientErrorReporting(){
 window.addEventListener('error',e=>reportClientError('window_error',e?.message||'JavaScript error'));window.addEventListener('unhandledrejection',e=>{const r=e?.reason;reportClientError('unhandled_rejection',r?.message||String(r||'Promise rejection'))});
}

function safeGoogleAvatarUrl(value){try{const u=new URL(String(value||'')),host=u.hostname.toLowerCase();return u.protocol==='https:'&&(host==='googleusercontent.com'||host.endsWith('.googleusercontent.com'))?u.href:''}catch{return ''}}
function profileAvatarMarkup(p,css=''){const url=p?.useGoogleAvatar?safeGoogleAvatarUrl(p.googleAvatarUrl):'';return url?`<img class="google-profile-avatar ${esc(css)}" src="${esc(url)}" alt="" referrerpolicy="no-referrer">`:esc(p?.avatar||'🙂')}
function updateProfileChip(){const p=getProfile(),chip=$('#profileChip');$('#profileChipText').textContent=p?.name||'Uložit';const a=$('#profileChipAvatar');if(a)a.innerHTML=p?profileAvatarMarkup(p):'☁️';if(chip)chip.setAttribute('aria-label',p?`Profil hráče ${p.name}`:'Uložit postup do účtu')}

function setLeagueCreateMode(mode){leagueCreateMode=mode}
function renderLeaguePinField(){if($('#leaguePinLabel'))$('#leaguePinLabel').classList.add('hidden');if($('#teamPinHelp'))$('#teamPinHelp').classList.add('hidden')}
async function loadLeagues(){
 try{const d=await api('/api/teams');leaguesCache=d.leagues||[]}catch{leaguesCache=[]}const sel=$('#leagueSelect');if(sel){const prev=sel.value,p=getProfile();sel.innerHTML=['<option value="">Vyber tým…</option>',...leaguesCache.map(l=>`<option value="${esc(l.code)}">${esc(l.name)}${l.members?` · ${countCz(l.members,'hráč','hráči','hráčů')}`:''}</option>`)].join('');if(prev&&leaguesCache.some(l=>l.code===prev))sel.value=prev;else if(p?.familyCode&&leaguesCache.some(l=>l.code===p.familyCode))sel.value=p.familyCode}return leaguesCache;
}
function setAccountMode(mode){
 accountMode=mode;const create=mode==='create';legacyTeamLogin=false;$('#profileModeLogin').classList.toggle('active',!create);$('#profileModeCreate').classList.toggle('active',create);$('#profileModalTitle').textContent=create?'Ulož si postup':'Přihlásit se';$('#profileModalDesc').textContent=create?'Jméno a heslo stačí. Postup uložíme do cloudu; tým je volitelný a můžeš ho přidat později.':'Stačí jméno a osobní heslo. Tým vybírej jen u staršího účtu, pokud máš v Propletu jmenovce.';$('#saveProfileBtn').textContent=create?'Uložit můj postup':'Přihlásit se';$('#playerPasswordInput').setAttribute('autocomplete',create?'new-password':'current-password');$('#legacyTeamLoginToggle').classList.toggle('hidden',create);$('#leagueChooser').classList.add('hidden');$('#profileFormError').textContent='';
}
async function openProfileModal(mode='login'){
 setAccountMode(mode);$('#profileModal').classList.remove('hidden');const p=getProfile();if(p)$('#playerNameInput').value=p.name||'';$('#playerPasswordInput').value='';$('#playerPasswordInput').type='password';$('#profilePasswordToggle').textContent='👁 Zobrazit heslo';if(mode==='login')loadLeagues();
}
async function saveNewProfile(){
 const authAction=accountMode,offerInstallAfterCreate=authAction==='create'&&!profileModalFromNudge&&!profileModalFromWin;
 const name=$('#playerNameInput').value.trim(),password=$('#playerPasswordInput').value;$('#profileFormError').textContent='';if(!name||!password){$('#profileFormError').textContent='Vyplň jméno a heslo.';return}if(password.length<8){$('#profileFormError').textContent='Heslo musí mít alespoň 8 znaků.';return}
 try{
  const endpoint=accountMode==='create'?'/api/player':'/api/login',family_code=accountMode==='login'&&legacyTeamLogin?normalizeLeagueCode($('#leagueSelect').value):null,body=accountMode==='create'?{name,password}:{name,password,family_code},selectedBeforeAuth=localSupportMode(),anonId=getAnonymousId(),profile=await api(endpoint,{method:'POST',body:JSON.stringify(body)});
  try{await currentGame?.finishTelemetryPromise}catch{}
  const hadNoProfile=!getProfile();if(hadNoProfile)adoptGuestData(profile.id);const serverMode=validSupportMode(profile.supportMode)?profile.supportMode:'none';saveProfile({id:profile.id,name:profile.name,familyCode:profile.familyCode||null,leagueName:profile.leagueName||null,avatar:profile.avatar||'🙂',googleLinked:!!profile.googleLinked,googleAvatarUrl:profile.googleAvatarUrl||null,useGoogleAvatar:!!profile.useGoogleAvatar,supportMode:serverMode,token:profile.token,hasPassword:!!profile.hasPassword,stats:profile.stats});rememberSupportMode(serverMode);
  if(accountMode==='create'&&selectedBeforeAuth)try{await persistSupportMode(selectedBeforeAuth)}catch{}
  try{await api('/api/anonymous/claim',{method:'POST',body:JSON.stringify({anonymous_id:anonId})});rotateAnonymousId()}catch{}
  trackProductEvent('account_authenticated');trackProductEvent(authAction==='create'?'account_created':'account_logged_in');if(profileModalFromNudge&&accountNudgeStage)trackProductEvent(`account_nudge_${accountNudgeStage}_authenticated`);if(profileModalFromWin)trackProductEvent('win_account_cta_authenticated');$('#profileModal').classList.add('hidden');await syncQueue({announce:true});updateProfileChip();renderProfile();renderDaily();renderFree();renderLeaderboard();if(profileModalFromWin){profileModalFromWin=false;$('#winModal').classList.remove('hidden');await refreshWinLeaderboardAfterAuth()}else if(profileModalFromNudge)resumeAfterAccountNudge();else if(offerInstallAfterCreate)setTimeout(()=>maybeOfferInstallNudge(null,'account'),320);
 }catch(e){$('#profileFormError').textContent=e.message}
}
function toggleLegacyTeamLogin(){legacyTeamLogin=!legacyTeamLogin;$('#leagueChooser').classList.toggle('hidden',!legacyTeamLogin);$('#legacyTeamLoginToggle').textContent=legacyTeamLogin?'Skrýt výběr týmu':'Mám starší účet v týmu';if(legacyTeamLogin)loadLeagues()}
function setTeamMembershipMode(mode){teamMembershipMode=mode;const join=mode==='join';$('#teamMembershipJoinTab').classList.toggle('active',join);$('#teamMembershipNewTab').classList.toggle('active',!join);$('#teamMembershipJoinFields').classList.toggle('hidden',!join);$('#teamMembershipNewFields').classList.toggle('hidden',join);$('#saveTeamMembershipBtn').textContent=join?'Přidat se k týmu':'Založit tým'}
async function openTeamMembershipModal(){const p=getProfile();if(!p?.token){openProfileModal('create');return}if(p.familyCode){showToast('Už jsi v týmu.');return}$('#teamMembershipError').textContent='';$('#teamMembershipJoinPin').value='';$('#teamMembershipNewPin').value='';$('#teamMembershipName').value='';setTeamMembershipMode('join');$('#teamMembershipModal').classList.remove('hidden');try{await loadLeagues();const sel=$('#teamMembershipSelect');sel.innerHTML=['<option value="">Vyber tým…</option>',...leaguesCache.map(l=>`<option value="${esc(l.code)}">${esc(l.name)}${l.members?` · ${countCz(l.members,'hráč','hráči','hráčů')}`:''}</option>`)].join('')}catch{}}
async function saveTeamMembership(){
 $('#teamMembershipError').textContent='';const join=teamMembershipMode==='join',family_code=join?normalizeLeagueCode($('#teamMembershipSelect').value):null,league_name=join?null:$('#teamMembershipName').value.trim(),league_pin=join?$('#teamMembershipJoinPin').value:$('#teamMembershipNewPin').value;if(join&&!family_code){$('#teamMembershipError').textContent='Vyber tým.';return}if(!join&&!league_name){$('#teamMembershipError').textContent='Pojmenuj nový tým.';return}if((league_pin||'').length<4){$('#teamMembershipError').textContent='PIN musí mít alespoň 4 znaky.';return}
 try{const r=await api('/api/team-membership',{method:'POST',body:JSON.stringify({mode:join?'join':'new',family_code,league_name,league_pin})}),p=getProfile();saveProfile({...p,familyCode:r.familyCode,leagueName:r.leagueName});$('#teamMembershipModal').classList.add('hidden');showToast(join?'Jsi v týmu ✓':'Tým založen ✓');renderProfile();renderLeaderboard();renderDaily()}catch(e){$('#teamMembershipError').textContent=e.message}
}
function openPasswordModal(){
 $('#passwordFormError').textContent='';$('#setPasswordInput').value='';$('#setPasswordConfirmInput').value='';$('#setPasswordInput').type='password';$('#setPasswordConfirmInput').type='password';$('#setPasswordToggle').textContent='👁 Zobrazit heslo';$('#passwordModal').classList.remove('hidden');
}
async function savePassword(){
 const password=$('#setPasswordInput').value,confirm=$('#setPasswordConfirmInput').value;$('#passwordFormError').textContent='';
 if(password.length<8){$('#passwordFormError').textContent='Heslo musí mít alespoň 8 znaků.';return}
 if(password!==confirm){$('#passwordFormError').textContent='Hesla se neshodují.';return}
 try{
  await api('/api/password',{method:'POST',body:JSON.stringify({password})});
  const p=getProfile();saveProfile({...p,hasPassword:true});$('#passwordModal').classList.add('hidden');showToast('Heslo nastaveno. Teď se můžeš přihlásit i na jiném zařízení ✓');renderProfile();
 }catch(e){$('#passwordFormError').textContent=e.message}
}

const adminAccessCache=new Map();
let adminEntryPromise=null,adminEntryPromiseProfile=null;
function renderAdminEntryAccess(allowed){$('#adminEntryBtn')?.classList.toggle('hidden',!allowed)}
async function refreshAdminEntry(){
 const p=getProfile();
 if(currentScreen!=='profile'||!p?.token){renderAdminEntryAccess(false);return}
 if(adminAccessCache.has(p.id)){renderAdminEntryAccess(adminAccessCache.get(p.id));return}
 if(adminEntryPromise&&adminEntryPromiseProfile===p.id){await adminEntryPromise;renderAdminEntryAccess(!!adminAccessCache.get(p.id));return}
 adminEntryPromiseProfile=p.id;
 adminEntryPromise=api('/api/admin/me').then(()=>true).catch(()=>false).then(allowed=>{adminAccessCache.set(p.id,allowed);return allowed}).finally(()=>{adminEntryPromise=null;adminEntryPromiseProfile=null});
 const allowed=await adminEntryPromise;if(getProfile()?.id===p.id)renderAdminEntryAccess(allowed);
}

function renderProfile({focusRoadmap=false}={}){
 renderInstallUI();
 const p=getProfile(),local=currentLocalStats(),stats=effectiveStats(),level=levelFor(stats.points||0),q=getQueue();
 if(!p){
  $('#profileCard').innerHTML=`<h2>Postup je zatím jen tady</h2><p class="muted">Na tomhle zařízení o nic nepřijdeš. Účet navíc uloží XP, výsledky a sérii do cloudu a pustí tě do pořadí.</p><div class="account-actions"><button id="profileCreateBtn" class="primary-btn">☁️ Uložit postup</button><button id="profileLoginBtn" class="secondary-btn">Už účet mám</button></div>`;
  setTimeout(()=>{$('#profileLoginBtn')&&($('#profileLoginBtn').onclick=()=>openProfileModal('login'));$('#profileCreateBtn')&&($('#profileCreateBtn').onclick=()=>openProfileModal('create'))},0);
 }else{
  const inTeam=!!p.familyCode,status=syncState.status==='syncing'?['Synchronizuji…','']:syncState.status==='error'?['Synchronizace čeká',syncState.error||'Neznámá chyba']:q.length?[[countCz(q.length,'výsledek','výsledky','výsledků'),'čeká'].join(' '),'Připoj internet a zkus synchronizovat']:['Vše synchronizováno',inTeam?'Cloud i týmové pořadí jsou aktuální':'Postup je bezpečně v cloudu'];
  const cls=syncState.status==='error'?'error':(!q.length&&syncState.status!=='syncing'?'success':'');
  const account=p.hasPassword?`<div class="account-banner account-ok"><strong>☁️ Účet je v cloudu</strong><span>Na dalším zařízení se přihlas jako <b>${esc(p.name)}</b> svým heslem. Tým k přihlášení nepotřebuješ.</span></div>`:`<div class="account-banner"><strong>💻 Zapni hraní na více zařízeních</strong><span>Nastav osobní heslo. Výsledky a XP zůstanou přesně tam, kde jsou.</span><button id="setPasswordBtn" class="secondary-btn">Nastavit heslo</button></div>`;
  const avatars=AVATARS.map(a=>`<button class="avatar-choice ${a===(p.avatar||'🙂')?'selected':''}" data-avatar="${a}" aria-label="Avatar ${a}">${a}</button>`).join('');
  const teamAccess=inTeam?`<div class="team-access-card"><div><strong>👥 ${esc(p.leagueName||p.familyCode)}</strong><span>Týmové pořadí je aktivní. PIN slouží jen jako pozvánka pro další hráče.</span></div><button id="teamPinBtn" class="secondary-btn">Nastavit PIN</button></div>`:`<div class="team-access-card team-empty"><div><strong>👥 Tým je volitelný</strong><span>Účet funguje i bez něj. Přidej rodinu nebo partu, až budeš chtít společné pořadí.</span></div><button id="joinTeamBtn" class="secondary-btn">Přidat tým</button></div>`;
  $('#profileCard').innerHTML=`<div class="profile-summary"><div class="profile-identity"><div class="profile-avatar-big">${esc(p.avatar||'🙂')}</div><div><div class="profile-name">${esc(p.name)}</div><div class="profile-family">${inTeam?`Tým: ${esc(p.leagueName||p.familyCode)}`:'Bez týmu · účet je uložený'}</div></div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>${stats.currentStreak||0}</strong><small>${czPlural(stats.currentStreak||0,'den','dny','dní')}</small></div></div><div class="avatar-picker"><span class="stat-label">TVŮJ AVATAR</span><div class="avatar-grid">${avatars}</div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">XP</span><strong>${stats.points??local.points}</strong></div><div class="profile-stat profile-rank-stat"><span class="stat-label">Hodnost</span><div class="profile-rank-value"><span class="profile-rank-icon">${level.current.icon}</span><strong>${level.index} · ${esc(level.current.name)}</strong></div></div><div class="profile-stat profile-stat-wide"><span class="stat-label">Hotovo</span><div class="profile-completion-grid"><span><b>${stats.freeCompleted?.easy??local.freeCompleted?.easy??0}</b><small>🌱 Snadná</small></span><span><b>${stats.freeCompleted?.medium??local.freeCompleted?.medium??0}</b><small>🧠 Střední</small></span><span><b>${stats.freeCompleted?.hard??local.freeCompleted?.hard??0}</b><small>🔥 Těžká</small></span><span><b>${stats.freeCompleted?.hardcore??local.freeCompleted?.hardcore??0}</b><small>🤯 Mozkožrout</small></span></div></div><div class="profile-stat profile-stat-wide profile-daily-highlights"><span><small>Denní výzvy</small><b>${stats.dailyCompleted??local.dailyCompleted}</b></span><span><small>Nejdelší série</small><b>${stats.longestStreak??local.longestStreak}</b></span><span><small>Nejlepší Daily</small><b>${fmtTime(stats.bestDailyMs??local.bestDailyMs)}</b></span></div></div>${account}<div class="support-mode-card"><div><span class="stat-label">POMOCNÍK</span><strong>${SUPPORT_MODES[p.supportMode||'none']?.icon||'🧠'} ${esc(SUPPORT_MODES[p.supportMode||'none']?.label||'Nenabízet')}</strong><small>${esc(SUPPORT_MODES[p.supportMode||'none']?.desc||'')}</small></div><button id="supportModeBtn" class="secondary-btn">Nastavit</button></div>${teamAccess}<a id="adminEntryBtn" class="admin-entry hidden" href="/admin"><span>🛠</span><div><strong>Proplet Admin</strong><small>Quality, hlášení a uživatelé</small></div><b>→</b></a><div class="sync-panel"><div class="sync-status ${cls}"><div><strong>${esc(status[0])}</strong><div>${esc(status[1])}</div></div><span>${syncState.status==='syncing'?'↻':q.length?'☁️':'✓'}</span></div><button id="syncBtn" class="secondary-btn" ${syncState.status==='syncing'?'disabled':''}>${syncState.status==='syncing'?'Synchronizuji…':`Synchronizovat${q.length?` (${q.length})`:''}`}</button></div><button id="logoutBtn" class="logout-btn">Odhlásit hráče z tohoto zařízení</button>`;
  const mainAvatar=$('#profileCard .profile-avatar-big');if(mainAvatar)mainAvatar.innerHTML=profileAvatarMarkup(p);
  setTimeout(()=>{$('#syncBtn')&&($('#syncBtn').onclick=()=>syncQueue({announce:true}));$('#setPasswordBtn')&&($('#setPasswordBtn').onclick=openPasswordModal);$('#supportModeBtn')&&($('#supportModeBtn').onclick=openSupportModeModal);$('#teamPinBtn')&&($('#teamPinBtn').onclick=openTeamPinModal);$('#joinTeamBtn')&&($('#joinTeamBtn').onclick=openTeamMembershipModal);$('#logoutBtn')&&($('#logoutBtn').onclick=logoutPlayer);$$('.avatar-choice').forEach(b=>b.onclick=()=>saveAvatar(b.dataset.avatar));refreshAdminEntry()},0);
 }
 const points=stats.points||0,longest=stats.longestStreak??local.longestStreak;$('#levelRoadmap').innerHTML=LEVELS.map((l,i)=>`<div class="level-step ${points>=l.xp?'earned':''} ${i===level.index-1?'current':''}"><span class="level-num">${i+1}</span><span class="level-step-icon">${l.icon}</span><strong>${l.name}</strong><small>${l.xp.toLocaleString('cs-CZ')} XP</small></div>`).join('');$('#profileBadges').innerHTML=BADGES.map(b=>`<div class="profile-badge ${longest>=b.days?'earned':''}"><span class="emoji">${b.icon}</span><strong>${b.name}</strong><small>${countCz(b.days,'den','dny','dní')} v řadě</small></div>`).join('');updatePushUI();const achievementSummary=$('#achievementSummary'),achievementGrid=$('#achievementGrid');if(achievementSummary)achievementSummary.innerHTML=renderAchievementSummary(stats);if(achievementGrid)achievementGrid.innerHTML=renderAchievements(stats);syncAchievementDisclosure();const achievementToggle=$('#achievementToggleBtn');if(achievementToggle)achievementToggle.onclick=()=>{profileAchievementsExpanded=!profileAchievementsExpanded;syncAchievementDisclosure()};if(focusRoadmap)focusProfileRoadmap();renderSettings();renderPrivacyActions();
}

function supportOutcomeHtml(mode,compact=false){const cfg=SUPPORT_MODES[mode]||SUPPORT_MODES.none;if(compact){if(!cfg.seconds)return '<strong>Pomocník nic sám nenabídne.</strong>Nápověda zůstane vždy po ruce.';return `<strong>Po ${cfg.seconds} s bez nového slova nabídne pomoc.</strong>Bez souhlasu nic neukáže.`}if(!cfg.seconds)return '<strong>Pomocník ti pomoc sám nenabídne.</strong>Tlačítko Nápověda zůstane během hry kdykoli dostupné.';return `<strong>Po ${cfg.seconds} sekundách bez nového slova nabídne malé postrčení.</strong>Když souhlasíš, ukáže startovní políčko, první písmeno a délku jednoho slova. Bez souhlasu neukáže nic.`}
function supportChoicesHtml(context='onboard'){const compact=context==='onboard';return Object.entries(SUPPORT_MODES).map(([mode,cfg])=>`<button class="support-choice" data-${context}-support="${mode}"><span>${cfg.icon}</span><div><strong>${cfg.label}${compact&&cfg.seconds?` · ${cfg.seconds} s`:''}</strong>${compact?'':`<small>${cfg.seconds?`po ${cfg.seconds} sekundách`:'sám se neozve'}</small>`}</div></button>`).join('')}
function renderSupportChoice(rootSelector,mode,outcomeSelector,compact=false){$(`${rootSelector}`)?.querySelectorAll('.support-choice').forEach(b=>b.classList.toggle('selected',(b.dataset.supportMode||b.dataset.onboardSupport)===mode));const outcome=$(outcomeSelector);if(outcome)outcome.innerHTML=supportOutcomeHtml(mode,compact)}
async function persistSupportMode(mode){
 if(!validSupportMode(mode))throw new Error('Neplatné nastavení Pomocníka');rememberSupportMode(mode);const p=getProfile();if(!p?.token)return mode;const previous=validSupportMode(p.supportMode)?p.supportMode:'none';saveProfile({...p,supportMode:mode});
 try{const r=await api('/api/support-mode',{method:'POST',body:JSON.stringify({support_mode:mode})});const saved=validSupportMode(r.supportMode)?r.supportMode:mode;rememberSupportMode(saved);saveProfile({...getProfile(),supportMode:saved});return saved}catch(e){rememberSupportMode(previous);saveProfile({...getProfile(),supportMode:previous});throw e}
}
function selectSupportModeDraft(mode){if(!validSupportMode(mode))return;supportModeDraft=mode;renderSupportChoice('#supportModeModal',mode,'#supportModeOutcome')}
function openSupportModeModal(){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}supportModeDraft=supportMode();renderSupportChoice('#supportModeModal',supportModeDraft,'#supportModeOutcome');$('#supportModeModal').classList.remove('hidden');
}
async function saveSupportMode(){try{const mode=await persistSupportMode(supportModeDraft);$('#supportModeModal').classList.add('hidden');renderProfile();showToast(`Pomocník: ${SUPPORT_MODES[mode].label} ✓`)}catch(e){showToast(e.message)}}
function supportMode(){const local=localSupportMode(),profile=getProfile()?.supportMode;return local||validSupportMode(profile)&&profile||'none'}
function helperThreshold(){return SUPPORT_MODES[supportMode()]?.idleMs||0}
async function sendHelperEvent(eventType){
 const g=currentGame;if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW||!g||g.mode==='rescue'||g.mode==='starter')return;
 const elapsed=Math.max(0,Math.round(gameElapsed(g))),idle=Math.max(0,Math.round(performance.now()-(g.lastProgressAt||g.start)));
 try{await api('/api/helper-event',{method:'POST',body:JSON.stringify({attempt_id:g.attemptId,puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),event_type:eventType,support_mode:supportMode(),elapsed_ms:elapsed,idle_ms:idle,found_words:g.found.length,total_words:g.puzzle.answers.length})})}catch{}
}
async function sendHintEvent(level,source='manual',complimentary=false){
 const g=currentGame;if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW||!g||g.mode==='rescue'||g.mode==='starter')return;
 try{await api('/api/hint-event',{method:'POST',body:JSON.stringify({attempt_id:g.attemptId,puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),hint_level:level,source,support_mode:supportMode(),complimentary:!!complimentary,elapsed_ms:Math.max(0,Math.round(gameElapsed(g))),found_words:g.found.length,total_words:g.puzzle.answers.length})})}catch{}
}
function maybeOfferHelper(){
 const g=currentGame,threshold=helperThreshold();
 if(!g||g.finished||g.mode==='rescue'||g.mode==='starter'||!threshold||g.helperOffered||g.dragging||document.hidden||openTransientModal())return;
 const idle=performance.now()-(g.lastProgressAt||g.start);
 if(idle<threshold)return;
 g.helperOffered=true;saveGameProgress();sendHelperEvent('offered');$('#helperOfferText').textContent=`Už ${Math.max(1,Math.round(idle/1000))} sekund se nic nového nezamklo. Můžu ukázat začátek jednoho slova. Počítá se to jako nápověda, takže ✨ čisté řešení tím končí.`;$('#helperOfferModal').classList.remove('hidden');
}
function acceptHelperOffer(){
 const g=currentGame;if(!g)return;$('#helperOfferModal').classList.add('hidden');g.nextHintSource='helper';sendHelperEvent('accepted');applySmartHint(1);
}
function dismissHelperOffer(){
 const g=currentGame;if(!g)return;$('#helperOfferModal').classList.add('hidden');sendHelperEvent('dismissed');g.lastProgressAt=performance.now(); // znovu už v tomto pokusu nenabízíme
}

async function saveAvatar(avatar){
 const p=getProfile();if(!p?.token)return;try{const r=await api('/api/avatar',{method:'POST',body:JSON.stringify({avatar,use_google_avatar:false})});saveProfile({...p,avatar:r.avatar,useGoogleAvatar:false,googleAvatarUrl:r.googleAvatarUrl||p.googleAvatarUrl||null});updateProfileChip();renderProfile();if(currentScreen==='leaderboard')renderLeaderboard();showToast(`Avatar ${avatar} uložen ✓`)}catch(e){showToast(e.message)}
}
async function saveGoogleAvatar(){const p=getProfile();if(!p?.token||!safeGoogleAvatarUrl(p.googleAvatarUrl))return;try{const r=await api('/api/avatar',{method:'POST',body:JSON.stringify({use_google_avatar:true})});saveProfile({...p,useGoogleAvatar:true,googleAvatarUrl:r.googleAvatarUrl||p.googleAvatarUrl});updateProfileChip();renderProfile();showToast('Google fotka je teď tvůj avatar ✓')}catch(e){showToast(e.message)}}
function openTeamPinModal(){const p=getProfile();if(!p?.token){openProfileModal('login');return}$('#teamPinInput').value='';$('#teamPinInput').type='password';$('#teamPinToggle').textContent='👁 Zobrazit PIN';$('#teamPinError').textContent='';$('#teamPinModal').classList.remove('hidden')}
async function saveTeamPin(){const pin=$('#teamPinInput').value;$('#teamPinError').textContent='';if(pin.length<4){$('#teamPinError').textContent='PIN týmu musí mít alespoň 4 znaky.';return}try{await api('/api/team-pin',{method:'POST',body:JSON.stringify({pin})});$('#teamPinModal').classList.add('hidden');showToast('PIN týmu uložen ✓');await loadLeagues()}catch(e){$('#teamPinError').textContent=e.message}}
async function logoutPlayer(){
 const p=getProfile();if(!p)return;const q=getQueue();if(q.length&&navigator.onLine)await syncQueue({announce:false});if(getQueue().length&&!confirm('Některé výsledky ještě čekají na synchronizaci. Opravdu se chceš odhlásit?'))return;
 // Web Push je subscription zařízení. Při střídání hráčů ji odpojíme od starého profilu,
 // aby nový hráč nedostával připomínky podle cizí Denní výzvy.
 try{const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();if(sub){try{await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}await sub.unsubscribe()}}catch{}
 try{await api('/api/logout',{method:'POST'})}catch{}
 localStorage.removeItem(PROFILE_KEY);rotateAnonymousId();localStorage.removeItem(ACCOUNT_NUDGE_KEY);localStorage.removeItem(PROGRESS_GUARD_KEY);localStorage.removeItem(PUSH_NUDGE_KEY);localStorage.removeItem(SUPPORT_MODE_KEY);localStorage.removeItem(scopedStorageKey(STORE_KEY,'guest'));localStorage.removeItem(scopedStorageKey(QUEUE_KEY,'guest'));syncState={status:'idle',error:null,lastAt:null};currentGame=null;stopTimer();updateProfileChip();renderProfile();renderDaily();renderFree();showToast(`${p.name} je odhlášený. Teď může hrát někdo další.`);nav('daily',{replace:true});
}

function renderSettings(){const s=getSettings(),supported=typeof navigator.vibrate==='function',wakeSupported=!!navigator.wakeLock?.request;renderThemeSettings();$('#soundToggle').textContent=`${s.sound?'🔊':'🔇'} Zvuk ${s.sound?'zapnutý':'vypnutý'}`;$('#soundToggle').classList.toggle('on',s.sound);$('#hapticToggle').textContent=supported?`${s.haptics?'📳':'📴'} Vibrace ${s.haptics?'zapnuté':'vypnuté'}`:'📴 Vibrace nepodporovány';$('#hapticToggle').classList.toggle('on',s.haptics&&supported);$('#hapticToggle').disabled=!supported;const magWrap=$('#magnifierSettingWrap'),mag=$('#magnifierSettingToggle'),magSupported=touchMagnifierDeviceSupported();magWrap?.classList.toggle('hidden',!magSupported);if(mag){mag.textContent=s.magnifier?'🔍 Lupa při tahu zapnutá':'🔍 Lupa při tahu vypnutá';mag.classList.toggle('on',s.magnifier);mag.setAttribute('aria-pressed',s.magnifier?'true':'false')}const wake=$('#wakeLockToggle'),note=$('#wakeLockNote');if(wake){wake.textContent=wakeSupported?`${s.wakeLock?'☀️':'🌙'} Displej během hry ${s.wakeLock?'zůstane zapnutý':'může zhasnout'}`:'🌙 Prohlížeč neumí udržet displej';wake.classList.toggle('on',s.wakeLock&&wakeSupported);wake.disabled=!wakeSupported}if(note&&!wakeSupported)note.textContent='Tento prohlížeč funkci nepodporuje; použije se běžný limit zařízení.';const test=$('#hapticTestBtn');if(test){test.disabled=!supported||!s.haptics;test.textContent=supported?'📳 Otestovat vibrace':'📴 Prohlížeč vibrace nepodporuje'}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

async function ensureRankingProfileState(){
 const p=getProfile();if(!p?.token)return p;
 if(Object.prototype.hasOwnProperty.call(p,'publicRankings'))return p;
 try{const fresh=await api('/api/me');saveProfile({...p,...fresh,token:p.token});return getProfile()}catch{return p}
}
function renderRankingPrivacyNote(){
 const box=$('#rankingPrivacyNote'),p=getProfile();if(!box)return;
 if(!p?.token){box.innerHTML='<span class="ranking-privacy-icon">👀</span><div><strong>Kompletní pořadí, soukromí zůstává</strong><small>Výsledky jsou vždy vidět. Kdo nezveřejní profil, dostane místo jména hravou anonymní přezdívku.</small></div>';return}
 const state=p.publicRankings;
 const title=state===true?'Jsi ve veřejném pořadí':state===false?'V pořadí jsi anonymně':'Vyber si, jestli chceš být vidět';
 const copy=state===true?'Ostatní vidí jen avatar, herní jméno a případně veřejný tým.':state===false?'Tvoje výsledky v pořadí zůstávají, ale ostatní u nich vidí jen anonymní přezdívku.':'Dokud volbu nepotvrdíš, tvoje výsledky se ukazují anonymně.';
 const action=state===true?'Skrýt mě':state===false?'Zobrazit mě':'Nastavit';
 box.innerHTML=`<span class="ranking-privacy-icon">👀</span><div><strong>${title}</strong><small>${copy}</small></div><button id="rankingPrivacyActionBtn" class="text-btn">${action}</button>`;
 setTimeout(()=>{const b=$('#rankingPrivacyActionBtn');if(b)b.onclick=()=>state===true?saveRankingVisibility(false):state===false?saveRankingVisibility(true):openRankingPrivacyModal()},0)
}
function openRankingPrivacyModal(){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}
 $('#rankingPrivacyPreviewAvatar').textContent=p.avatar||'🙂';$('#rankingPrivacyPreviewName').textContent=p.name||'Hráč';$('#rankingPrivacyModal').classList.remove('hidden')
}
async function saveRankingVisibility(enabled){
 try{const result=await api('/api/rankings/visibility',{method:'POST',body:JSON.stringify({enabled})}),p=getProfile();saveProfile({...p,publicRankings:result.publicRankings});$('#rankingPrivacyModal').classList.add('hidden');renderRankingPrivacyNote();showToast(enabled?'Jsi ve společném pořadí 🏆':'V pořadí jsi anonymně 🎭');await renderLeaderboard()}catch(e){showToast(e.message)}
}
function maybeShowRankingPrivacyNotice(){const p=getProfile();if(p?.token&&p.publicRankings==null)openRankingPrivacyModal()}

async function renderLeaderboard(){
 const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');
 if(!xpList||!dailyList)return;
 await ensureRankingProfileState();
 renderRankingPrivacyNote();
 maybeShowRankingPrivacyNotice();
 $$('.ranking-scope-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingXpScope===rankingXpScope));
 $$('.ranking-period-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingPeriod===rankingXpPeriod));
 $$('.ranking-daily-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingDailyScope===rankingDailyScope));
 $('#dailyTeamMethod')?.classList.toggle('hidden',rankingDailyScope!=='teams');
 renderRankingTeamCard();
 xpList.innerHTML='<div class="ranking-loading">Načítám XP pořadí…</div>';
 dailyList.innerHTML='<div class="ranking-loading">Načítám dnešní pořadí…</div>';
 const [xpResult,dailyResult]=await Promise.allSettled([
   api(`/api/rankings/xp?period=${rankingXpPeriod}`),
   api(`/api/rankings/daily?daily_date=${pragueDateISO()}`)
  ]);
 if(xpResult.status==='fulfilled'){
  renderXpRanking(xpResult.value);
  const privacy=$('#rankingPrivacyNote');
  if(privacy&&xpResult.value.visibilityReady===true)privacy.dataset.visibilityReady='true';
 }else xpList.innerHTML=`<div class="ranking-empty"><strong>XP pořadí se teď nepodařilo načíst.</strong><small>${esc(xpResult.reason?.message||'Zkus to prosím znovu.')}</small></div>`;
 if(dailyResult.status==='fulfilled')renderDailyRanking(dailyResult.value);
 else dailyList.innerHTML=`<div class="ranking-empty"><strong>Dnešní pořadí se teď nepodařilo načíst.</strong><small>${esc(dailyResult.reason?.message||'Zkus to prosím znovu.')}</small></div>`;
}
function rankingRows(data,scope){return scope==='teams'?(data?.teams||[]):(data?.players||[])}
function rankingRankBadge(rank){return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}.`}
function renderXpRanking(data){
 const list=$('#xpLeaderboardList'),rows=rankingRows(data,rankingXpScope);
 if(!rows.length){list.innerHTML=`<div class="ranking-empty"><strong>${rankingXpScope==='teams'?'Týmy':'Hráči'} zatím nemají XP v tomto období.</strong><small>První body tu udělají pořádek velmi rychle. 😄</small></div>`;return}
 list.innerHTML=rows.map(r=>{
  if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`;
  const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
  return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${r.badgeCount?` · 🏅 ${r.badgeCount}`:''}${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`
 }).join('')
}
function renderDailyRanking(data){
 const list=$('#dailyLeaderboardList'),rows=rankingRows(data,rankingDailyScope);
 if(!rows.length){list.innerHTML='<div class="ranking-empty"><strong>Dnešní startovní rošt je zatím prázdný.</strong><small>Stačí dokončit Denní výzvu.</small></div>';return}
 list.innerHTML=rows.map(r=>{
  if(rankingDailyScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.players||0,'výkon','výkony','výkonů')} v dnešním skóre · ${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.score||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})}</strong><small>/ 100</small></div></div>`;
  const quality=r.cleanSolve===true?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Bez nápovědy',team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
  return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small>${quality} · ${countCz(r.moves||0,'tah','tahy','tahů')}${team}</small></div><div class="leader-score"><strong>${fmtTime(r.elapsedMs)}</strong><small>dnešní výzva</small></div></div>`
 }).join('')
}
function renderRankingTeamCard(){
 const box=$('#rankingTeamCard'),p=getProfile();if(!box)return;
 if(!p?.token){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Chceš soutěžit i za partu?</strong><small>Pořadí můžeš sledovat bez účtu. Pro vlastní tým si nejdřív ulož postup.</small></div><button id="rankingAccountBtn" class="secondary-btn">☁️ Uložit postup</button>';setTimeout(()=>$('#rankingAccountBtn')&&($('#rankingAccountBtn').onclick=()=>openProfileModal('create')),0);return}
 if(!p.familyCode){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Jsi zatím bez týmu</strong><small>Účet funguje samostatně. Tým můžeš přidat kdykoli, bez vlivu na předchozí XP.</small></div><button id="rankingJoinTeamBtn" class="secondary-btn">Přidat / založit tým</button>';setTimeout(()=>$('#rankingJoinTeamBtn')&&($('#rankingJoinTeamBtn').onclick=openTeamMembershipModal),0);return}
 box.innerHTML=`<div><span class="eyebrow">👥 TVŮJ TÝM</span><strong>${esc(p.leagueName||p.familyCode)}</strong><small>Do týmových XP se počítají jen XP získané během členství.</small></div><button id="rankingTeamSettingsBtn" class="secondary-btn">Nastavení týmu</button>`;
 setTimeout(()=>$('#rankingTeamSettingsBtn')&&($('#rankingTeamSettingsBtn').onclick=openFamilyLeagueModal),0)
}

async function renderGlobalLeague(){
 const list=$('#globalLeagueList'),status=$('#globalLeagueStatus');list.innerHTML='<div class="gate card">Načítám Ligu týmů…</div>';status.innerHTML='';
 try{
  const data=await api(`/api/family-league?week_offset=${globalWeekOffset}`);globalLeagueData=data;
  $('#globalLeagueWeekMeta').textContent=`${formatDateCZ(data.weekStart)} – ${formatDateCZ(data.weekEnd)}`;
  const my=data.myFamily,p=getProfile();
  if(my){
   if(my.enabled){status.innerHTML=`<div class="card my-family-world"><div><span class="eyebrow">TVŮJ TÝM</span><strong>${esc(my.publicName)}</strong><small>${my.eligible?(my.rank?`${my.rank}. místo · ${Math.round(my.score)} / 700 bodů`:'Tento týden zatím bez bodů'):'Tým je připravený hrát Ligu týmů.'}</small></div><button id="editFamilyWorldBtn" class="secondary-btn">Upravit</button></div>`}
   else{status.innerHTML=`<div class="card global-optin-card"><div><span class="eyebrow">VÁŠ TÝM JE ZATÍM V HLEDIŠTI</span><strong>Pošlete ${esc(my.leagueName)} do Ligy týmů?</strong><small>Veřejně bude vidět jen zvolený název týmu a společné skóre.</small></div><button id="joinFamilyWorldBtn" class="primary-btn">Zapojit tým 🌍</button></div>`}
  }else if(p?.token&&!p?.familyCode){status.innerHTML='<div class="card global-optin-card"><div><strong>Účet máš. Chybí jen tým.</strong><small>Přidej rodinu nebo partu, pokud chcete soutěžit společně.</small></div><button id="globalTeamBtn" class="secondary-btn">Přidat tým</button></div>'}else if(!p?.token){status.innerHTML='<div class="card global-optin-card"><div><strong>Chceš zapojit vlastní rodinu?</strong><small>Ulož si účet. Samotné pořadí si můžeš prohlížet i bez něj.</small></div><button id="globalLoginBtn" class="secondary-btn">Uložit postup</button></div>'}
  const rows=data.standings||[];
  if(!rows.length){list.innerHTML='<div class="gate card"><strong>Startovní rošt je zatím prázdný.</strong><p class="muted">První rodina, která se přihlásí, bere dočasně zlato. 😄</p></div>'}
  else list.innerHTML=rows.map(r=>`<div class="leader-row family-world-row ${r.isMine?'me':''}"><div class="leader-rank">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank+'.'}</div><div class="leader-name"><strong>${esc(r.name)}</strong><small>${countCz(r.memberCount,'člen','členové','členů')} · hráno ${r.daysPlayed}/7 dní</small></div><div class="leader-score"><strong>${Math.round(r.score)}</strong><small>/ 700</small></div></div>`).join('');
  setTimeout(()=>{if($('#editFamilyWorldBtn'))$('#editFamilyWorldBtn').onclick=openFamilyLeagueModal;if($('#joinFamilyWorldBtn'))$('#joinFamilyWorldBtn').onclick=openFamilyLeagueModal;if($('#globalTeamBtn'))$('#globalTeamBtn').onclick=openTeamMembershipModal;if($('#globalLoginBtn'))$('#globalLoginBtn').onclick=()=>openProfileModal('create')},0);
 }catch(e){list.innerHTML=`<div class="gate card"><strong>Liga týmů je zrovna mimo hřiště.</strong><p class="muted">${esc(e.message)}</p></div>`}
}
async function openFamilyLeagueModal(){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}if(!p.familyCode){openTeamMembershipModal();return}
 try{const data=await api('/api/team-settings');if(!data.hasTeam){openTeamMembershipModal();return}$('#teamSettingsTitle').textContent=data.leagueName||'Tvůj tým';$('#familyLeaguePublicName').value=data.publicName||data.leagueName||'';$('#familyLeagueModalError').textContent='';$('#enableFamilyLeagueBtn').textContent=data.publicEnabled?'Uložit veřejný název':'Zobrazit tým v pořadí';$('#disableFamilyLeagueBtn').classList.toggle('hidden',!data.publicEnabled);$('#familyLeagueModal').classList.remove('hidden')}catch(e){showToast(e.message)}
}
async function saveFamilyLeagueSettings(enabled){
 const name=$('#familyLeaguePublicName').value.trim();$('#familyLeagueModalError').textContent='';if(enabled&&name.length<2){$('#familyLeagueModalError').textContent='Pojmenuj veřejný tým.';return}
 try{await api('/api/family-league/settings',{method:'POST',body:JSON.stringify({enabled,public_name:name||null})});$('#familyLeagueModal').classList.add('hidden');showToast(enabled?'Tým je ve veřejném pořadí 👥':'Tým je z veřejného pořadí skrytý');await renderLeaderboard()}catch(e){$('#familyLeagueModalError').textContent=e.message}
}
async function leaveCurrentTeam(){
 const p=getProfile();if(!p?.familyCode)return;if(!confirm(`Opravdu opustit tým ${p.leagueName||p.familyCode}? Dříve získané týmové XP zůstanou týmu.`))return;
 try{await api('/api/team-membership/leave',{method:'POST',body:'{}'});saveProfile({...p,familyCode:null,leagueName:null});$('#familyLeagueModal').classList.add('hidden');showToast('Tým jsi opustil. Historické XP zůstaly na místě.');renderProfile();await renderLeaderboard()}catch(e){$('#familyLeagueModalError').textContent=e.message}
}

async function sendPuzzleFeedback(kind,{rating=null,word=null,note=null}={}){
 const g=currentGame;if(!g?.puzzle||g.mode==='rescue')throw new Error('Tuhle úlohu teď nejde hodnotit.');if(CONTENT_PREVIEW_DATE||GEN4_CANDIDATE_PREVIEW)throw new Error('V read-only preview hodnocení neodesíláme.');
 return api('/api/feedback',{method:'POST',body:JSON.stringify({puzzle_id:g.puzzle.id,challenge_key:challengeKey(g.mode,g.puzzle,g.dailyDate),kind,rating,word,note})});
}
async function rateDifficulty(rating,btn){
 try{await sendPuzzleFeedback('difficulty',{rating});$$('[data-difficulty-rating]').forEach(b=>b.classList.toggle('selected',b===btn));winFeedbackSent=true;showToast('Díky — pomáháš kalibrovat obtížnost ✓')}catch(e){showToast(e.message)}
}
function openWordReport(){
 const g=currentGame;if(!g?.puzzle)return;const select=$('#reportWordSelect');select.innerHTML=g.puzzle.answers.map(a=>`<option value="${esc(a.word)}">${esc(a.word)}</option>`).join('');$('#reportWordNote').value='';$('#wordReportError').textContent='';$('#wordReportModal').classList.remove('hidden');
}
async function saveWordReport(){
 const word=$('#reportWordSelect').value,note=$('#reportWordNote').value.trim();$('#wordReportError').textContent='';try{await sendPuzzleFeedback('word',{word,note});$('#wordReportModal').classList.add('hidden');showToast('Díky. Slovo je nahlášené ✓')}catch(e){$('#wordReportError').textContent=e.message}
}
function renderWinFeedback(){
 const g=currentGame,show=!!g?.finished&&g.mode!=='rescue'&&!g.postStarterWarmup;$('#winDifficultyFeedback')?.classList.toggle('hidden',!show);$('#reportWordBtn')?.classList.toggle('hidden',!show);$$('[data-difficulty-rating]').forEach(b=>b.classList.remove('selected'));winFeedbackSent=false;
}
function qaFlagLabel(flag){return flag==='too_hard'?'🔴 příliš těžká':flag==='too_easy'?'🟠 příliš lehká':flag==='watch'?'🟡 sledovat':'🟢 OK'}
function qaFmtPct(v){return v==null?'—':`${Math.round(Number(v)*100)} %`}
async function maybeOpenQaDashboard(){
 if(new URLSearchParams(location.search).get('qa')!=='1')return;
 location.replace('/admin');return;
 let root=document.getElementById('qaDashboard');if(!root){root=document.createElement('div');root.id='qaDashboard';root.className='qa-dashboard';document.body.appendChild(root)}
 const p=getProfile();if(!p?.token){root.innerHTML=`<div class="qa-shell"><div class="qa-head"><div><span class="eyebrow">INTERNÍ QA</span><h1>Proplet Quality</h1></div><button id="qaClose">×</button></div><div class="card qa-gate"><strong>Nejdřív se přihlas.</strong><p class="muted">Dashboard používá jen agregovaná data, ale není veřejný.</p><button id="qaLogin" class="primary-btn">Přihlásit hráče</button></div></div>`;document.getElementById('qaClose').onclick=()=>root.remove();document.getElementById('qaLogin').onclick=()=>openProfileModal('login');return}
 root.innerHTML=`<div class="qa-shell"><div class="qa-head"><div><span class="eyebrow">INTERNÍ QA · v2</span><h1>Proplet Quality</h1><p>Načítám první pokusy, nápovědy a Pomocníka…</p></div><button id="qaClose">×</button></div><div class="qa-loading card">Počítám data…</div></div>`;document.getElementById('qaClose').onclick=()=>root.remove();
 try{
  const [r,h]=await Promise.all([api('/api/quality-report'),api('/api/quality-history').catch(()=>({snapshots:[]}))]);const s=r.summary||{},hs=r.hints||{},helper=r.helper||{},funnel=r.funnel||{},dist=hs.firstAttemptDistribution||{},rows=r.rows||[],prior=r.priorities||[];
  const top=rows.filter(x=>x.starts>=5).slice().sort((a,b)=>Math.abs(b.difficultyIndex||0)-Math.abs(a.difficultyIndex||0)).slice(0,18);
  const modes=helper.bySupportMode||{};
  root.querySelector('.qa-shell').innerHTML=`<div class="qa-head"><div><span class="eyebrow">INTERNÍ QA · v2</span><h1>Proplet Quality</h1><p>${r.firstAttempts||0} prvních pokusů · ${r.registeredFirstAttempts||0} hráči + ${r.anonymousFirstAttempts||0} anonymní · ${r.puzzlesMeasured||0} puzzle</p></div><button id="qaClose">×</button></div>
  <div class="qa-kpis"><div class="card"><b>${s.tooHard||0}</b><span>příliš těžké</span></div><div class="card"><b>${s.tooEasy||0}</b><span>příliš lehké</span></div><div class="card"><b>${s.watch||0}</b><span>watchlist</span></div><div class="card"><b>${s.reliable||0}</b><span>20+ pokusů</span></div></div>
  <section class="card qa-section"><span class="eyebrow">ANONYMNÍ FUNNEL</span><h2>První kontakt s Propletem</h2><div class="qa-mini"><span><b>${funnel.app_open||0}</b><small>otevřelo appku</small></span><span><b>${funnel.onboarding_started||0}</b><small>začalo tutorial</small></span><span><b>${funnel.onboarding_completed||0}</b><small>dokončilo tutorial</small></span><span><b>${funnel.starter_completed||0}</b><small>dokončilo první hru</small></span><span><b>${funnel.account_authenticated||0}</b><small>přihlásilo účet</small></span></div><p class="muted compact">Účet celkem: nabídka ${funnel.account_nudge_shown||0} · autentizace ${funnel.account_authenticated||0}<br>1. nabídka ${funnel.account_nudge_1_shown||0} → ${funnel.account_nudge_1_authenticated||0} účtů · 2. ${funnel.account_nudge_2_shown||0} → ${funnel.account_nudge_2_authenticated||0} · 3. ${funnel.account_nudge_3_shown||0} → ${funnel.account_nudge_3_authenticated||0}</p></section>
  <div class="qa-grid"><section class="card qa-section"><div class="section-head"><div><span class="eyebrow">NÁPOVĚDY</span><h2>Jak se používají</h2></div></div><div class="qa-mini"><span><b>${hs.events||0}</b><small>událostí</small></span><span><b>${qaFmtPct(hs.firstAttemptHintRate)}</b><small>1. pokus s hintem</small></span><span><b>${hs.medianFirstHintMs?fmtTime(hs.medianFirstHintMs):'—'}</b><small>medián 1. hintu</small></span><span><b>${hs.complimentary||0}</b><small>bonusových</small></span></div><p class="muted compact">Bez hintu ${dist['0']||0} · 1 hint ${dist['1']||0} · 2 hinty ${dist['2']||0} · 3+ ${dist['3plus']||0}</p><p class="muted compact">Úroveň 1: ${hs.byLevel?.['1']||0} · 2: ${hs.byLevel?.['2']||0} · 3: ${hs.byLevel?.['3']||0}</p></section>
  <section class="card qa-section"><div class="section-head"><div><span class="eyebrow">POMOCNÍK</span><h2>Reakce hráčů</h2></div></div><div class="qa-mini"><span><b>${helper.offers||0}</b><small>nabídek</small></span><span><b>${helper.accepted||0}</b><small>přijato</small></span><span><b>${qaFmtPct(helper.acceptRate)}</b><small>accept rate</small></span><span><b>${helper.medianOfferIdleMs?fmtTime(helper.medianOfferIdleMs):'—'}</b><small>čas zaseknutí</small></span></div><p class="muted compact">🐣 ${modes.beginner?.offers||0}/${modes.beginner?.accepted||0} · 🧒 ${modes.younger?.offers||0}/${modes.younger?.accepted||0} · 🎒 ${modes.older?.offers||0}/${modes.older?.accepted||0}</p></section></div>
  <section class="card qa-section"><div class="section-head"><div><span class="eyebrow">OUTLIERY</span><h2>Co stojí za kontrolu</h2></div><button id="qaCopy" class="secondary-btn">📋 Kopírovat shrnutí</button></div><div class="qa-table">${top.length?top.map(x=>`<div class="qa-row"><div><strong>${esc(x.puzzleId)}</strong><small>${esc(DIFF[x.difficulty]?.label||x.difficulty)} · ${x.starts} prvních pokusů</small></div><b class="qa-index ${x.flag||''}">${x.difficultyIndex==null?'—':Number(x.difficultyIndex).toFixed(2)}</b><span>${qaFlagLabel(x.flag)}</span><small>${x.medianMs?fmtTime(x.medianMs):'—'} · dokončeno ${qaFmtPct(x.completionRate)} · nápovědy ${x.avgHints??'—'} · čistě ${qaFmtPct(x.cleanRate)} · hodnocení ${x.difficultyRating??'—'}</small></div>`).join(''):'<div class="qa-empty">Zatím málo dat. To je v playtestu normální.</div>'}</div></section>
  <section class="card qa-section"><span class="eyebrow">HISTORIE</span><h2>Týdenní snapshoty</h2><p class="muted">${(h.snapshots||[]).length?`${h.snapshots.length} uložených týdnů. Nejnovější: ${esc(h.snapshots[0].week_start||'')}`:'První snapshot se uloží automaticky v pondělí.'}</p></section>`;
  root.querySelector('#qaClose').onclick=()=>root.remove();root.querySelector('#qaCopy').onclick=async()=>{const lines=[`Proplet QA v2 — ${r.firstAttempts||0} prvních pokusů (${r.registeredFirstAttempts||0} přihlášených + ${r.anonymousFirstAttempts||0} anonymních)`,`Funnel: open ${funnel.app_open||0}, tutorial ${funnel.onboarding_completed||0}, účet ${funnel.account_authenticated||0}`,`Alerty: těžké ${s.tooHard||0}, lehké ${s.tooEasy||0}, watch ${s.watch||0}`,`Hint rate: ${qaFmtPct(hs.firstAttemptHintRate)}, medián prvního hintu ${hs.medianFirstHintMs?fmtTime(hs.medianFirstHintMs):'—'}`,`Pomocník: ${helper.offers||0} nabídek, ${helper.accepted||0} přijato (${qaFmtPct(helper.acceptRate)})`,...prior.slice(0,12).map(x=>`${x.puzzleId} ${x.difficultyIndex}: ${x.flag} · n=${x.starts}`)];try{await navigator.clipboard.writeText(lines.join('\n'));showToast('QA shrnutí je ve schránce ✓')}catch{}};
 }catch(e){root.querySelector('.qa-loading').innerHTML=`<strong>QA dashboard se nenačetl.</strong><p class="muted">${esc(e.message)}</p>`}
}

function showUpdateBanner(worker,message='✨ Je připravená nová verze Propletu.',action='Aktualizovat'){
 if(worker)pendingSW=worker;
 const banner=$('#updateBanner'),label=banner?.querySelector('span'),button=$('#applyUpdateBtn');
 if(label)label.textContent=message;if(button){button.disabled=false;button.textContent=action}banner?.classList.remove('hidden');
}
async function recoverRuntimeUpdate({automatic=false,targetVersion=''}={}){
 if(runtimeRecoveryBusy)return;runtimeRecoveryBusy=true;
 const button=$('#applyUpdateBtn');if(button){button.disabled=true;button.textContent='Aktualizuji…'}
 const automaticKey=targetVersion?`proplet-auto-update-${targetVersion}`:'';
 if(automatic&&automaticKey){try{if(sessionStorage.getItem(automaticKey)==='1'){runtimeRecoveryBusy=false;if(button){button.disabled=false;button.textContent='Aktualizovat'}return}sessionStorage.setItem(automaticKey,'1')}catch{}}
 trackProductEvent('pwa_update_applied');
 try{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('proplet-')&&!key.startsWith('proplet-data-')).map(key=>caches.delete(key)));
 }catch{}
 try{
  const reg=await navigator.serviceWorker?.getRegistration?.();
  await reg?.update?.();
  if(reg?.waiting){pendingSW=reg.waiting;reloadOnServiceWorkerChange=true;reg.waiting.postMessage({type:'SKIP_WAITING'});setTimeout(()=>location.reload(),1800);return}
 }catch{}
 location.reload();
}
function applyPendingUpdate(){
 if(canonicalUpdateTarget){trackProductEvent('legacy_origin_update_opened');location.assign(canonicalUpdateTarget);return}
 recoverRuntimeUpdate();
}
async function probeCanonicalRelease(force=false){
 const now=Date.now();if(releaseProbeBusy||(!force&&now-lastReleaseProbeAt<60000))return;releaseProbeBusy=true;lastReleaseProbeAt=now;
 try{
  const local=await fetch(`/api/config?release_probe=${now}`,{cache:'no-store'}).then(r=>r.ok?r.json():null);
  if(!local||local.environment==='preview')return;
  const canonicalOrigin=window.PROPLET_RUNTIME_META?.canonicalOrigin||'https://hrajproplet.cz';
  const source=await fetch(`${canonicalOrigin}/runtime-meta.js?release_probe=${now}`,{cache:'no-store',mode:'cors'}).then(r=>r.ok?r.text():'');
  const canonicalVersion=source.match(/version:\s*['\"]([^'\"]+)['\"]/)?.[1];if(!canonicalVersion)return;
  if(location.origin!==canonicalOrigin){
   canonicalUpdateTarget=`${canonicalOrigin}${location.pathname}${location.search}${location.hash}`;
   showUpdateBanner(null,'Proplet běží na starší adrese. Otevři aktuální verzi.','Otevřít aktuální');
   try{if(sessionStorage.getItem('proplet-legacy-origin-shown')!=='1'){sessionStorage.setItem('proplet-legacy-origin-shown','1');trackProductEvent('legacy_origin_update_shown')}}catch{}
   return;
  }
  if(canonicalVersion!==APP_VERSION){
   runtimeUpdateRequired=true;
   showUpdateBanner(pendingSW);
   try{const key=`proplet-update-detected-${canonicalVersion}`;if(sessionStorage.getItem(key)!=='1'){sessionStorage.setItem(key,'1');trackProductEvent('pwa_update_detected')}}catch{}
   if(currentScreen!=='game'&&document.visibilityState==='visible')setTimeout(()=>recoverRuntimeUpdate({automatic:true,targetVersion:canonicalVersion}),1200);
  }
 }catch{}finally{releaseProbeBusy=false}
}
function registerServiceWorker(){
 if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
  if(reg.waiting)showUpdateBanner(reg.waiting);
  reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner(w)})});
  const checkForUpdate=()=>Promise.allSettled([reg.update(),probeCanonicalRelease()]),checkWhenVisible=()=>{if(document.visibilityState==='visible')checkForUpdate()};
  checkForUpdate();
  document.addEventListener('visibilitychange',checkWhenVisible);
  window.addEventListener('pageshow',()=>{probeCanonicalRelease(true);checkForUpdate()});
  window.addEventListener('online',()=>{probeCanonicalRelease(true);checkForUpdate()});
  setInterval(checkForUpdate,5*60*1000);
 }).catch(()=>{});
 let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloadOnServiceWorkerChange||reloading)return;reloading=true;location.reload()});
}

function ensureAudio(){if(!getSettings().sound)return;try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}catch{}}
function tone(freq,duration=0.06,volume=0.025,delay=0){if(!getSettings().sound)return;ensureAudio();if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(0.0001,t+duration);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+duration+.02)}
function vibrate(pattern){if(!getSettings().haptics||typeof navigator.vibrate!=='function')return false;try{return navigator.vibrate(pattern)}catch{return false}}
function fx(type){if(type==='tap'){tone(300,.035,.012);vibrate(24)}else if(type==='step'){tone(360,.028,.009);vibrate(20)}else if(type==='correct'){tone(520,.07,.025);tone(700,.09,.022,.055);vibrate(52)}else if(type==='wrong'){tone(180,.09,.018);vibrate([42,32,42])}else if(type==='hint'){tone(620,.08,.018);vibrate(34)}else if(type==='win'){tone(520,.09,.028);tone(660,.1,.026,.08);tone(820,.15,.025,.16);vibrate([50,35,70,40,95])}}
function testHaptics(){const s=getSettings();if(!s.haptics){showToast('Nejdřív zapni vibrace.');return}if(typeof navigator.vibrate!=='function'){showToast('Tento prohlížeč vibrace nepodporuje.');return}const ok=vibrate([65,45,105]);showToast(ok===false?'Telefon nebo prohlížeč vibraci odmítl. Zkontroluj systémové vibrace.':'Testovací pulz odeslán 📳 Pokud nic necítíš, zkontroluj systémové vibrace.') }
function confetti(){const layer=$('#confettiLayer');layer.innerHTML='';const cs=['#6c5ce7','#55cfa7','#ff816f','#ffd66b','#73a7ff','#f391c3'];for(let i=0;i<28;i++){const el=document.createElement('i');el.className='confetti';el.style.setProperty('--x',`${(Math.random()-.5)*260}px`);el.style.setProperty('--drift',`${(Math.random()-.5)*140}px`);el.style.setProperty('--rot',`${Math.random()*180}deg`);el.style.setProperty('--dur',`${1.2+Math.random()*.9}s`);el.style.setProperty('--c',cs[i%cs.length]);el.style.animationDelay=`${Math.random()*.18}s`;layer.appendChild(el)}setTimeout(()=>layer.innerHTML='',2400)}
function showToast(text){const t=$('#toast');clearTimeout(toastTimer);t.textContent=text;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),3300)}



const ONBOARD_STEPS=[
 {title:'Co je Proplet',intro:true,cta:'Jak hrát',html:()=>`<div class="onboard-content onboard-game-intro"><h2>Spojuj písmena do slov</h2><p class="muted">Hledej cesty přes sousední políčka a poskládej slova tak, aby nakonec zaplnila celou mřížku.</p><div class="onboard-game-modes"><div class="onboard-mode-card daily"><div class="onboard-mode-mark daily-mark" aria-hidden="true">☀</div><div><span class="eyebrow">DENNÍ VÝZVA</span><strong>Každý den nový Proplet</strong><small>Jedna nová úroveň pro všechny hráče.</small></div></div><div class="onboard-mode-card free"><div class="onboard-free-icons" aria-hidden="true">${difficultyIconMarkup('easy','onboard-diff-icon')}${difficultyIconMarkup('medium','onboard-diff-icon')}${difficultyIconMarkup('hard','onboard-diff-icon')}${difficultyIconMarkup('hardcore','onboard-diff-icon')}</div><div><span class="eyebrow">VOLNÁ HRA</span><strong>Stovky dalších úrovní</strong><small>Čtyři obtížnosti. Hraj kdykoli a vlastním tempem.</small></div></div></div><p class="onboard-intro-note">Nejdřív si během chvilky ukážeme, jak na to.</p></div>`},
 {title:'Najdi PES',interactive:true,html:`<div class="onboard-content"><span class="eyebrow">ZAČNI ROVNOU HRÁT</span><h2>Najdi PES</h2><p class="muted">Táhni přes <b>P → E → S</b>. Jen přes políčka vedle sebe.</p><div class="tutorial-wrap"><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">L</div><div class="tutorial-cell" data-tidx="3">A</div><div class="tutorial-cell" data-tidx="4">S</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`},
 {title:'Pomocník',support:true,html:()=>`<div class="onboard-content"><span class="eyebrow">POMOC, KDYŽ JI CHCEŠ</span><h2>Kdy ti má Pomocník nabídnout nápovědu?</h2><p class="muted">Když se chvíli nic nového nepodaří, jen nabídne malé postrčení. <b>Bez tvého souhlasu nic neodhalí.</b></p><div class="support-choice-grid onboard-support-grid" aria-label="Čas nabídky Pomocníka">${supportChoicesHtml('onboard')}</div><div id="onboardSupportOutcome" class="support-outcome" aria-live="polite">Vyber si tempo.</div></div>`}
];

function openOnboarding(force=false){
 let seen=false,helperSeen=false;try{seen=!!localStorage.getItem(ONBOARD_KEY);helperSeen=!!localStorage.getItem(HELPER_ONBOARD_KEY)}catch{}if(!force&&seen&&helperSeen)return;onboardingFocusedHelper=!force&&seen&&!helperSeen;onboardingMandatory=!force&&!seen;onboardingStep=onboardingFocusedHelper?ONBOARD_STEPS.length-1:0;tutorialState={dragging:false,path:[],done:false};onboardingTutorialTracked=false;onboardingSupportTracked=false;const stored=localSupportMode(),profileMode=getProfile()?.supportMode;onboardingSupportMode=stored||(validSupportMode(profileMode)?profileMode:null);if(onboardingMandatory&&!stored)onboardingSupportMode=null;$('#skipOnboardingBtn').classList.toggle('hidden',onboardingMandatory);$('#onboardingModal').classList.remove('hidden');if(!force)trackProductEvent(onboardingFocusedHelper?'helper_onboarding_started':'onboarding_started');renderOnboarding();
}
function closeOnboarding(forceClose=false){if(onboardingMandatory&&!forceClose)return;try{localStorage.setItem(ONBOARD_KEY,'done');localStorage.setItem(HELPER_ONBOARD_KEY,'done')}catch{}$('#onboardingModal').classList.add('hidden');tutorialState={dragging:false,path:[],done:false};onboardingMandatory=false;onboardingFocusedHelper=false}
function renderOnboarding(){
 const step=ONBOARD_STEPS[onboardingStep],modal=$('.onboarding-card');
 $('#onboardDots').innerHTML=onboardingFocusedHelper?'<i class="active"></i>':ONBOARD_STEPS.map((_,i)=>`<i class="${i===onboardingStep?'active':''}"></i>`).join('');
 $('#onboardContent').innerHTML=typeof step.html==='function'?step.html():step.html;const waitingTutorial=!!step.interactive&&!tutorialState.done,waitingSupport=!!step.support&&!onboardingSupportMode;modal.classList.toggle('waiting-interaction',waitingTutorial||waitingSupport);modal.classList.toggle('support-step',!!step.support);
 $('#onboardNextBtn').textContent=step.support?(onboardingSupportMode?(onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩'):'Nejdřív vyber možnost'):(waitingTutorial?'Nejdřív najdi PES':(step.cta||'Pokračovat'));
 if(step.interactive)setTimeout(bindTutorial,0);
 if(step.support)setTimeout(bindOnboardingSupport,0);
}
function onboardingNext(){
 const step=ONBOARD_STEPS[onboardingStep];if(step?.interactive&&!tutorialState.done||step?.support&&!onboardingSupportMode)return;
 if(onboardingStep<ONBOARD_STEPS.length-1){onboardingStep++;renderOnboarding()}else{const launchStarter=onboardingMandatory;if(launchStarter&&!onboardingSupportTracked){onboardingSupportTracked=true;trackProductEvent('onboarding_support_selected');trackProductEvent(`onboarding_support_selected_${onboardingSupportMode}`)}onboardingMandatory=false;trackProductEvent('onboarding_completed');closeOnboarding(true);if(launchStarter)startStarter();else nav('daily')}
}
function bindOnboardingSupport(){
 const root=$('#onboardContent');if(!root)return;renderSupportChoice('#onboardContent',onboardingSupportMode,'#onboardSupportOutcome',true);root.querySelectorAll('[data-onboard-support]').forEach(b=>b.onclick=()=>{const mode=b.dataset.onboardSupport;if(!validSupportMode(mode))return;onboardingSupportMode=mode;rememberSupportMode(mode);renderSupportChoice('#onboardContent',mode,'#onboardSupportOutcome');$('.onboarding-card').classList.remove('waiting-interaction');$('#onboardNextBtn').textContent=onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩';persistSupportMode(mode).catch(e=>showToast(`Nastavení zatím zůstává v telefonu: ${e.message}`))})
}
function tutorialAdj(a,b){const ar=Math.floor(a/3),ac=a%3,br=Math.floor(b/3),bc=b%3;return Math.abs(ar-br)+Math.abs(ac-bc)===1}
function renderTutorialPath(){
 $$('.tutorial-cell').forEach(c=>{const i=+c.dataset.tidx;c.classList.toggle('active',tutorialState.path.includes(i));if(tutorialState.done&&[0,1,4].includes(i)){c.classList.remove('active');c.classList.add('done')}});
}
function bindTutorial(){
 const board=$('#tutorialBoard');if(!board)return;
 const add=i=>{const p=tutorialState.path,last=p.at(-1);if(i===last)return;if(p.length>1&&i===p.at(-2)){p.pop();renderTutorialPath();return}if(p.includes(i)||last==null||!tutorialAdj(last,i))return;p.push(i);renderTutorialPath()};
 $$('.tutorial-cell').forEach(c=>c.onpointerdown=e=>{e.preventDefault();tutorialState.dragging=true;tutorialState.path=[+c.dataset.tidx];renderTutorialPath();try{c.setPointerCapture(e.pointerId)}catch{}});
 board.onpointermove=e=>{if(!tutorialState.dragging)return;const c=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.tutorial-cell');if(c)add(+c.dataset.tidx)};
 const finish=()=>{if(!tutorialState.dragging)return;tutorialState.dragging=false;const ok=tutorialState.path.join(',')==='0,1,4';if(ok){tutorialState.done=true;if(onboardingMandatory&&!onboardingTutorialTracked){onboardingTutorialTracked=true;trackProductEvent('onboarding_tutorial_completed')}$('#tutorialSuccess').textContent='Jo! 🐶 Slovo může i zatáčet.';fx('correct');renderTutorialPath();$('.onboarding-card').classList.remove('waiting-interaction');$('#onboardNextBtn').textContent='Jo, chápu'}else{$('#tutorialSuccess').textContent='Skoro. Zkus P → E a pak dolů na S.';fx('wrong');tutorialState.path=[];renderTutorialPath()}};
 board.onpointerup=finish;board.onpointercancel=finish;
}


async function openPlayedLevels(diff){
 const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').textContent=`${d.label} · tvoje úrovně`;$('#playedLevelsMeta').textContent='Načítám tvůj postup…';$('#playedLevelsList').innerHTML='';modal.classList.remove('hidden');const p=getProfile();let levels=[],legacyLevels=[],summary=null;
 try{if(p?.token){const data=await api(`/api/played-levels?difficulty=${encodeURIComponent(diff)}`);levels=data.levels||[];legacyLevels=data.legacyLevels||[];summary=data}else{const state=getState(),slots=localFreeSlotState(diff),rows=Object.values(state.completed||{}),total=sortedFreeBank(diff).length;levels=sortedFreeBank(diff).map(x=>{const level=Number(x.meta?.level),r=state.completed[`free:${x.id}`];return r?{puzzleId:x.id,level,elapsedMs:r.elapsedMs,moves:r.moves,hintsUsed:r.hintsUsed||0,cleanSolve:r.cleanSolve===true,attempts:1,transferred:false}:slots.transferred.has(level)?{puzzleId:x.id,level,transferred:true,attempts:0}:null}).filter(Boolean);legacyLevels=rows.map(r=>{if(r?.mode!=='free'||r.difficulty!==diff)return null;const info=(Number(r.level)&&Number(r.contentGeneration))?{level:Number(r.level),generation:Number(r.contentGeneration)}:freePuzzleSlot(r.puzzleId,diff);return info&&info.generation<2?{...r,level:info.level,contentGeneration:info.generation}:null}).filter(Boolean).sort((a,b)=>a.level-b.level);summary={actual:slots.actual.size,transferred:slots.transferred.size,total}}}catch(e){$('#playedLevelsMeta').textContent=e.message;return}
 const actual=summary?.actual??levels.filter(r=>!r.transferred).length,transferred=summary?.transferred??levels.filter(r=>r.transferred).length,total=summary?.total??sortedFreeBank(diff).length;$('#playedLevelsMeta').textContent=actual?`Nový postup ${actual}/${total}`:transferred?'Nový postup začíná od jedničky.':'Zatím tu nic není. Nejdřív něco propleť.';
 const currentHtml=levels.length?levels.map(r=>`<button class="played-level-row ${r.transferred?'transferred':''}" data-level-puzzle="${esc(r.puzzleId)}" data-level-diff="${diff}"><span class="level-index">${r.transferred?'✦':`${r.level}.`}</span><span class="level-history-main">${r.transferred?`<strong>Nová deska · úroveň ${r.level}</strong><small>Dřívější verzi máš splněnou.</small>`:`<strong>${fmtTime(r.elapsedMs)}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}${r.attempts>1?` · hráno ${r.attempts}×`:''}</small>`}</span><span class="played-arrow">›</span></button>`).join(''):'<div class="empty-history">Tady zatím fouká vítr. 🌬️</div>';$('#playedLevelsList').innerHTML=currentHtml;
 $$('[data-level-puzzle]').forEach(b=>b.onclick=()=>openLevelDetail(b.dataset.levelDiff,b.dataset.levelPuzzle));
}
function localLevelResult(puzzleId){return getState().completed[`free:${puzzleId}`]||null}
async function fetchPuzzleLeaderboard(puzzleId){const p=getProfile();if(!p?.familyCode)return {rows:[],anonymous:true};return api(`/api/puzzle-leaderboard?puzzle_id=${encodeURIComponent(puzzleId)}&family_code=${encodeURIComponent(p.familyCode)}`)}
async function fetchFreeLevelLeaderboards(puzzleId){
 const p=getProfile(),worldPromise=api(`/api/free-global-leaderboard?puzzle_id=${encodeURIComponent(puzzleId)}`),teamPromise=p?.familyCode?fetchPuzzleLeaderboard(puzzleId):Promise.resolve({rows:[],anonymous:true});
 const [worldResult,teamResult]=await Promise.allSettled([worldPromise,teamPromise]);
 return {world:worldResult.status==='fulfilled'?worldResult.value:null,worldError:worldResult.status==='rejected'?worldResult.reason?.message||'Globální pořadí se nepodařilo načíst.':null,team:teamResult.status==='fulfilled'?teamResult.value:null,teamError:teamResult.status==='rejected'?teamResult.reason?.message||'Týmové pořadí se nepodařilo načíst.':null};
}
function rankBadge(rank){
 const value=Number(rank)||0,medals={1:['🥇','Zlatá medaile'],2:['🥈','Stříbrná medaile'],3:['🥉','Bronzová medaile']},medal=medals[value];
 return medal?`<span class="result-medal result-medal-${value}" role="img" aria-label="${medal[1]}">${medal[0]}</span>`:`<span class="result-rank-number">${value}.</span>`;
}
function renderFreeWorldBoard(data,error){
 if(error)return `<div class="leaderboard-empty"><strong>Světový radar teď mlčí.</strong><small>${esc(error)} Výsledek tím není ohrožený.</small></div>`;
 const total=Number(data?.total||0),rank=Number(data?.myRank||0),rows=data?.rows||[],minimum=Number(data?.percentileMinimum||10);
 if(!rank){return `<div class="daily-world-head"><strong>🌍 Globální pořadí</strong><span>${countCz(total,'hráč','hráči','hráčů')}</span></div><div class="leaderboard-empty"><strong>${total?'Svět už tuhle úroveň proplétá.':'Zatím čekáš na prvního soupeře.'}</strong><small>${getProfile()?.token?'Tvůj první výsledek zatím není v globálním pořadí.':'Ulož si postup a po synchronizaci uvidíš své přesné místo.'}</small></div>${rows.length?`<div class="daily-world-neighbours">${rows.map(r=>`<div class="mini-leader-row"><b>${rankBadge(r.rank)}</b><span><strong>${esc(r.avatar||'🎭')} ${esc(r.name||'Anonymní propletač')}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}</small></span><em>${fmtTime(r.elapsedMs)}</em></div>`).join('')}</div>`:''}<small class="daily-world-privacy">Jméno se ukáže jen po souhlasu · ostatní mají anonymní přezdívku.</small>`}
 const topLine=total===1?'První hráč téhle úrovně. Trůn je zatím celý tvůj.':total>=minimum?`Patříš mezi nejlepších ${data.topPercent} % hráčů této úrovně.`:`Jsi ${rank}. z ${total}. Procenta ukážeme od ${minimum} hráčů.`;
 return `<div class="daily-world-head"><strong>🌍 Globální pořadí</strong><span>${countCz(total,'hráč','hráči','hráčů')}</span></div><div class="daily-world-summary"><div><strong>${rank}.</strong><span>místo</span></div><p>${topLine}<small>${RANK_RULES}</small></p></div><div class="daily-world-neighbours">${rows.map(r=>`<div class="mini-leader-row ${r.isMine?'me':''}"><b>${rankBadge(r.rank)}</b><span><strong>${esc(r.avatar||'🎭')} ${r.isMine?'Ty':esc(r.name||'Anonymní propletač')}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}</small></span><em>${fmtTime(r.elapsedMs)}</em></div>`).join('')}</div><small class="daily-world-privacy">Jméno se ukáže jen po souhlasu · ostatní mají anonymní přezdívku · počítá se první dokončený pokus.</small>`;
}
function renderFreeTeamBoard(data,error,myId){
 if(error)return `<div class="leaderboard-empty"><strong>Týmová tribuna se nenačetla.</strong><small>${esc(error)}</small></div>`;
 if(data?.anonymous)return '<div class="leaderboard-empty"><strong>Ulož si postup a pak se můžeš přidat k týmu.</strong><small>Týmový žebříček srovnává přesně tuhle úroveň.</small></div>';
 const rows=data?.rows||[],my=rows.find(r=>r.id===myId);if(!rows.length)return '<div class="leaderboard-empty">Zatím jsi tady první. To je docela slušný začátek. 👑</div>';
 return `<div class="level-board-head"><strong>👥 Pořadí v týmu</strong>${my?`<span>Ty: ${my.rank}. místo</span>`:''}<small>${RANK_RULES} · počítá se první dokončený pokus.</small></div>`+rows.slice(0,5).map(r=>`<div class="mini-leader-row ${r.id===myId?'me':''}"><b>${rankBadge(r.rank)}</b><span><strong>${esc(r.name)}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}</small></span><em>${fmtTime(r.elapsedMs)}</em></div>`).join('');
}
function renderFreeLeaderboardPanel(container,data,myId,initialTab='world'){
 const globalRank=Number(data?.world?.myRank||0)||null,teamRank=(data?.team?.rows||[]).find(r=>r.id===myId)?.rank||null;
 const render=tab=>{const active=tab==='team'?'team':'world';container.classList.add('free-level-board');container.classList.remove('daily-global-board','hidden');container.innerHTML=`<div class="free-board-tabs" role="tablist" aria-label="Rozsah pořadí"><button type="button" class="free-board-tab ${active==='world'?'active':''}" data-free-board-tab="world" role="tab" aria-selected="${active==='world'}">🌍 Globálně</button><button type="button" class="free-board-tab ${active==='team'?'active':''}" data-free-board-tab="team" role="tab" aria-selected="${active==='team'}">👥 Můj tým</button></div><div class="free-board-content">${active==='world'?renderFreeWorldBoard(data?.world,data?.worldError):renderFreeTeamBoard(data?.team,data?.teamError,myId)}</div>`;container.querySelectorAll('[data-free-board-tab]').forEach(button=>button.onclick=()=>render(button.dataset.freeBoardTab))};
 render(initialTab);return {globalRank,teamRank};
}
async function loadWinLevelLeaderboard(puzzle,rec){const box=$('#levelLeaderboardBox');if(!box||currentGame?.mode!=='free'||isMozkomorQaDifficulty(puzzle?.difficulty)){box?.classList.add('hidden');return}box.classList.remove('hidden');box.innerHTML='<div class="leaderboard-empty">Načítám globální i týmové pořadí…</div>';try{const data=await fetchFreeLevelLeaderboards(puzzle.id),ranks=renderFreeLeaderboardPanel(box,data,getProfile()?.id);levelDetailContext={puzzleId:puzzle.id,difficulty:puzzle.difficulty,level:puzzle.meta?.level,globalRank:ranks.globalRank,teamRank:ranks.teamRank,result:rec}}catch(e){box.innerHTML=`<div class="leaderboard-empty">Pořadí se teď nepodařilo načíst. <small>${esc(e.message)}</small></div>`}}
function renderDailyGlobalLeaderboardBox(container,data){
 const total=Number(data?.total||0),rank=Number(data?.myRank||0),rows=data?.rows||[];container.classList.remove('free-level-board');container.classList.add('daily-global-board');container.classList.remove('hidden');
 if(!rank){const message=getProfile()?.token?'Tvůj výsledek zatím není v aktivním globálním pořadí.':'Ulož si postup a po synchronizaci uvidíš své přesné místo.';container.innerHTML=`<div class="daily-world-head"><strong>🌍 Dnešní globální pořadí</strong><span>${countCz(total,'hráč','hráči','hráčů')}</span></div><div class="leaderboard-empty"><strong>${total?'Svět už proplétá.':'Zatím čekáš na prvního soupeře.'}</strong><small>${message}</small></div>`;return}
 const topLine=total===1?'První hráč dne. Království je zatím celé tvoje.':`Patříš mezi nejlepších ${data.topPercent} % dnešních hráčů.`;
 container.innerHTML=`<div class="daily-world-head"><strong>🌍 Dnešní globální pořadí</strong><span>${countCz(total,'hráč','hráči','hráčů')}</span></div><div class="daily-world-summary"><div><strong>${rank}.</strong><span>místo</span></div><p>${topLine}<small>${RANK_RULES}</small></p></div><div class="daily-world-neighbours">${rows.map(r=>`<div class="mini-leader-row ${r.isMine?'me':''}"><b>${rankBadge(r.rank)}</b><span><strong>${esc(r.avatar||'🎭')} ${r.isMine?'Ty':esc(r.name||'Anonymní propletač')}</strong><small>${r.cleanSolve?'✨ Čistě':`💡 ${r.hintsUsed||0}×`} · ${countCz(r.moves,'tah','tahy','tahů')}</small></span><em>${fmtTime(r.elapsedMs)}</em></div>`).join('')}</div><small class="daily-world-privacy">Jméno se ukáže jen po souhlasu · ostatní mají anonymní přezdívku.</small>`;
}
async function loadWinDailyGlobalLeaderboard(date,rec){const box=$('#levelLeaderboardBox');if(!box||currentGame?.mode!=='daily'){return}box.classList.remove('hidden');box.classList.add('daily-global-board');box.innerHTML='<div class="leaderboard-empty">Načítám globální pořadí…</div>';try{const data=await api(`/api/daily-global-leaderboard?daily_date=${encodeURIComponent(date)}`);winDailyGlobalData=data;renderDailyGlobalLeaderboardBox(box,data)}catch(e){box.innerHTML=`<div class="leaderboard-empty"><strong>Světový radar teď mlčí.</strong><small>${esc(e.message)}. Výsledek tím není ohrožený.</small></div>`}}
async function openLevelDetail(diff,puzzleId){
 const puzzle=sortedFreeBank(diff).find(p=>p.id===puzzleId);if(!puzzle)return;const rec=localLevelResult(puzzleId),transferred=!rec&&localFreeSlotState(diff).transferred.has(Number(puzzle.meta?.level)),result=$('#levelDetailResult'),actions=$('.level-detail-actions');levelDetailContext={puzzleId,difficulty:diff,level:puzzle.meta?.level,globalRank:null,teamRank:null,result:rec};$('#levelDetailEyebrow').textContent=`${DIFF[diff].label.toUpperCase()} · ÚROVEŇ ${puzzle.meta?.level||'?'}`;$('#levelDetailTitle').textContent=`${DIFF[diff].label} ${puzzle.meta?.level||''}`.trim();result.classList.toggle('new-board',transferred);result.innerHTML=rec?`<strong>${fmtTime(rec.elapsedMs)}</strong><span>${rec.cleanSolve?'✨ Čistě':`💡 ${countCz(rec.hintsUsed||0,'nápověda','nápovědy','nápověd')}`} · ${countCz(rec.moves,'tah','tahy','tahů')}</span><small>Do pořadí se počítá první dokončený pokus.</small>`:transferred?`<div class="new-board-visual" aria-hidden="true"><span>✓</span><i>→</i><span>✦</span></div><div class="new-board-copy"><strong>Nová deska čeká</strong><span>Dřívější verzi máš splněnou. Tahle je nová.</span><small>+${DIFF[diff].xp} XP za novou desku</small></div>`:'<span>Výsledek není na tomto zařízení uložený.</span>';$('#levelDetailReplayBtn').textContent=transferred?'Hrát novou desku':rec?'Zahrát znovu · trénink':'Zahrát úroveň';$('#levelDetailShareBtn').classList.toggle('hidden',!rec);actions.classList.toggle('solo',!rec);$('#levelDetailLeaderboard').innerHTML='<div class="leaderboard-empty">Načítám globální i týmové pořadí…</div>';$('#levelDetailModal').classList.remove('hidden');try{const data=await fetchFreeLevelLeaderboards(puzzleId),ranks=renderFreeLeaderboardPanel($('#levelDetailLeaderboard'),data,getProfile()?.id);levelDetailContext.globalRank=ranks.globalRank;levelDetailContext.teamRank=ranks.teamRank}catch(e){$('#levelDetailLeaderboard').innerHTML=`<div class="leaderboard-empty">${esc(e.message)}</div>`}
}
async function shareLevelDetail(){const c=levelDetailContext;if(!c)return;const p=sortedFreeBank(c.difficulty).find(x=>x.id===c.puzzleId),rec=localLevelResult(c.puzzleId)||c.result;if(!p||!rec)return;const clean=rec.cleanSolve?'✨ Čistě':`💡 ${rec.hintsUsed||0}×`,rank=c.globalRank?` · 🌍 ${c.globalRank}. globálně`:c.teamRank?` · ${c.teamRank}. místo v týmu`:'';const text=`Proplet · ${DIFF[c.difficulty].label} · úroveň ${c.level}${rank}\n⏱ ${fmtTime(rec.elapsedMs)} · ${clean} · ${countCz(rec.moves,'tah','tahy','tahů')}\n\nZahraj si taky: ${SHARE_URL}`;await shareProplet(text)
}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function getPushRegistration(){if(!('serviceWorker' in navigator))throw new Error('Tento prohlížeč neumí oznámení PWA.');return navigator.serviceWorker.ready}
function getInstallNudgeState(){try{return JSON.parse(localStorage.getItem(INSTALL_NUDGE_KEY)||'{}')}catch{return {}}}
function saveInstallNudgeState(v){localStorage.setItem(INSTALL_NUDGE_KEY,JSON.stringify(v))}
function isIosDevice(){if(typeof navigator==='undefined')return false;return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function isStandaloneApp(){if(typeof window==='undefined')return false;return window.matchMedia?.('(display-mode: standalone)')?.matches===true||window.navigator?.standalone===true}
function installNudgeDue(){const st=getInstallNudgeState();if(st.installed||st.done)return false;const next=Number(st.nextOfferAt||0);return !next||Date.now()>=next}
function installOfferAvailable(){return !isStandaloneApp()&&(!!deferredInstallPrompt||isIosDevice())}
function renderInstallUI(){
 const card=$('#installAppCard'),btn=$('#installAppBtn'),status=$('#installAppStatus');if(!card||!btn||!status)return;
 if(isStandaloneApp()||getInstallNudgeState().installed){card.classList.add('hidden');return}
 const ios=isIosDevice(),available=!!deferredInstallPrompt||ios;card.classList.toggle('hidden',!available);if(!available)return;
 btn.disabled=false;
 if(ios&&!getProfile()?.token){btn.textContent='☁️ Nejdřív uložit postup';status.textContent='Na iPhonu je bezpečnější přidat Proplet na plochu až po uložení postupu do účtu.';return}
 btn.textContent=ios?'📲 Přidat Proplet na plochu':'📲 Nainstalovat Proplet';
 status.textContent=ios?'Otevře se pak jako samostatná aplikace. Kdyby se po prvním spuštění zeptal, přihlas se stejným účtem.':'Otevře se jako běžná aplikace bez adresního řádku a zůstane po ruce na ploše.';
}
function renderInstallModal(source='daily'){
 const ios=isIosDevice(),title=$('#installNudgeTitle'),copy=$('#installNudgeCopy'),steps=$('#installIosSteps'),note=$('#installNudgeNote'),primary=$('#installNudgePrimary');
 if(ios){
  title.textContent='Přidej si Proplet na plochu';copy.textContent='Bude pak po ruce stejně jako ostatní aplikace.';steps.classList.remove('hidden');note.classList.remove('hidden');note.textContent='Kdyby se Proplet po prvním otevření z plochy zeptal, přihlas se stejným jménem a heslem.';primary.textContent='Rozumím';
 }else{
  title.textContent=source==='account'?'Účet uložen. A Proplet do kapsy?':'Měj Proplet vždy po ruce';copy.textContent='Přidej si ho na plochu. Otevírá se pak jako běžná aplikace a k Denní výzvě se dostaneš jedním klepnutím.';steps.classList.add('hidden');note.classList.add('hidden');note.textContent='';primary.textContent='Nainstalovat Proplet';
 }
 primary.disabled=false;
}
function shouldOfferInstallNudge(source='daily'){
 if(!installOfferAvailable()||!installNudgeDue())return false;
 if(source==='daily'){
  const g=currentGame;if(g?.mode!=='daily'||g?.justCompleted!==true||postWinEngagementNudgeShown)return false;
 }
 if(isIosDevice()&&!getProfile()?.token)return false;
 return true;
}
function maybeOfferInstallNudge(action=null,source='daily'){
 if(!shouldOfferInstallNudge(source))return false;installModalManual=false;pendingInstallPostWinAction=action;const st=getInstallNudgeState();saveInstallNudgeState({...st,shown:(st.shown||0)+1,lastShownAt:new Date().toISOString(),lastSource:source});trackProductEvent('pwa_install_nudge_shown');renderInstallModal(source);$('#winModal')?.classList.add('hidden');$('#installNudgeModal').classList.remove('hidden');return true;
}
function finishInstallNudgeFlow(){
 const action=pendingInstallPostWinAction;pendingInstallPostWinAction=null;installModalManual=false;$('#installNudgeModal').classList.add('hidden');renderInstallUI();if(action)performPostWinAction(action);
}
function dismissInstallNudge(){
 if(installModalManual){trackProductEvent('pwa_install_profile_closed');finishInstallNudgeFlow();return}
 const st=getInstallNudgeState(),declines=(st.declines||0)+1;saveInstallNudgeState({...st,declines,done:declines>=2,nextOfferAt:declines>=2?null:Date.now()+7*24*60*60*1000,lastDeclinedAt:new Date().toISOString()});trackProductEvent('pwa_install_nudge_dismissed');finishInstallNudgeFlow();
}
async function acceptInstallNudge(){
 if(isIosDevice()){
  saveInstallNudgeState({...getInstallNudgeState(),done:true,iosHintSeen:true,iosHintAcceptedAt:new Date().toISOString()});trackProductEvent('pwa_install_ios_hint_ack');finishInstallNudgeFlow();return;
 }
 const prompt=deferredInstallPrompt;if(!prompt){showToast('Instalaci teď prohlížeč nenabízí. Zkus to znovu později.');renderInstallUI();return}
 deferredInstallPrompt=null;const btn=$('#installNudgePrimary');btn.disabled=true;
 try{
  await prompt.prompt();const choice=await prompt.userChoice;
  if(choice.outcome==='accepted'){saveInstallNudgeState({...getInstallNudgeState(),accepted:true,done:true,acceptedAt:new Date().toISOString()});trackProductEvent('pwa_install_native_accepted')}
  else{const st=getInstallNudgeState(),declines=(st.declines||0)+1;saveInstallNudgeState({...st,declines,done:declines>=2,nextOfferAt:declines>=2?null:Date.now()+7*24*60*60*1000,lastDeclinedAt:new Date().toISOString()});trackProductEvent('pwa_install_native_dismissed')}
 }catch(e){showToast('Instalaci se nepodařilo otevřít. Zkus ji později z profilu.')}finally{btn.disabled=false;finishInstallNudgeFlow()}
}
function openInstallFromProfile(){
 if(isStandaloneApp())return;
 if(isIosDevice()&&!getProfile()?.token){openProfileModal('create');return}
 if(!installOfferAvailable()){showToast('Instalaci teď tento prohlížeč nenabízí.');return}
 installModalManual=true;pendingInstallPostWinAction=null;trackProductEvent('pwa_install_profile_opened');renderInstallModal('profile');$('#installNudgeModal').classList.remove('hidden');
}
if(typeof window!=='undefined'){
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;renderInstallUI()});
 window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;saveInstallNudgeState({...getInstallNudgeState(),installed:true,done:true,installedAt:new Date().toISOString()});trackProductEvent('pwa_installed');renderInstallUI()});
}


function getPushNudgeState(){try{return JSON.parse(localStorage.getItem(PUSH_NUDGE_KEY)||'{}')}catch{return {}}}
function savePushNudgeState(v){localStorage.setItem(PUSH_NUDGE_KEY,JSON.stringify(v))}
let pushConfigPromise=null;
async function loadPushConfig(){
 if(pushConfigPromise)return pushConfigPromise;
 pushConfigPromise=(async()=>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let r;
  try{r=await fetch('/api/push/config',{headers:{Accept:'application/json'},signal:controller.signal})}catch(e){if(e.name==='AbortError')throw new Error('Server se neozval včas');throw new Error(navigator.onLine?'Spojení se serverem selhalo':'Telefon je offline')}finally{clearTimeout(timeout)}
  if(!r.ok)throw new Error(`Server vrátil chybu ${r.status}`);return r.json();
 })().catch(e=>{pushConfigPromise=null;throw e});
 return pushConfigPromise;
}
function pushNudgeDue(){
 const st=getPushNudgeState();if(st.accepted||st.done||st.disabledByUser||st.systemDenied)return false;
 if(!st.nextOfferDate)return true;return pragueDateISO()>=st.nextOfferDate;
}
async function browserPushState(){
 const p=getProfile();
 if(!('Notification' in window)||!('PushManager' in window))return {account:true,unsupported:true,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:false};
 const cfg=await loadPushConfig();if(!cfg.available)return {account:true,unavailable:true,config:cfg,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:!!cfg.preferencesReady};
 const reg=await getPushRegistration();let sub=await reg.pushManager.getSubscription(),intent=getPushNudgeState(),deliberatelyOff=!!intent.disabledByUser;
 if(p?.token&&!sub&&Notification.permission==='granted'&&!deliberatelyOff){
  try{const prior=await api('/api/push/account-state');if(prior.enabled){await persistPushEnabled(true);savePushNudgeState({...intent,accepted:true,repairNeeded:false,repairedAt:new Date().toISOString()});trackProductEvent('push_notifications_auto_repaired');sub=await reg.pushManager.getSubscription()}}catch{}
 }
 if(!sub)return {account:true,config:cfg,sub:null,enabled:false,dailyEnabled:false,contentEnabled:false,migrationReady:!!cfg.preferencesReady};
 try{
  let pref=await api(`/api/push/preferences?endpoint=${encodeURIComponent(sub.endpoint)}`);
  if(!pref.subscribed&&Notification.permission==='granted'&&!deliberatelyOff){await sub.unsubscribe();await persistPushEnabled(true);savePushNudgeState({...intent,accepted:true,repairNeeded:false,repairedAt:new Date().toISOString()});trackProductEvent('push_notifications_auto_repaired');sub=await reg.pushManager.getSubscription();pref=await api(`/api/push/preferences?endpoint=${encodeURIComponent(sub.endpoint)}`)}
  const enabled=!!(pref.dailyEnabled||pref.contentEnabled);if(enabled&&(!pref.dailyEnabled||!pref.contentEnabled)){await persistPushEnabled(true);pref={...pref,dailyEnabled:true,contentEnabled:true}}
  return {account:true,config:cfg,sub,enabled,dailyEnabled:!!pref.dailyEnabled,contentEnabled:!!pref.contentEnabled,migrationReady:!!pref.migrationReady}
 }catch{return {account:true,config:cfg,sub,enabled:true,dailyEnabled:true,contentEnabled:true,migrationReady:false}}
}
async function persistPushEnabled(enabled){
 const cfg=await loadPushConfig();if(!cfg.available)throw new Error('Push ještě není nakonfigurovaný na serveru.');if(!cfg.preferencesReady)throw new Error('Nové nastavení upozornění čeká na databázovou migraci.');
 const reg=await getPushRegistration();let sub=await reg.pushManager.getSubscription();
 if(!enabled){if(sub){try{await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}await sub.unsubscribe()}return {enabled:false,dailyEnabled:false,contentEnabled:false}}
 if(!sub){const permission=await Notification.requestPermission();if(permission!=='granted'){savePushNudgeState({...getPushNudgeState(),done:true,systemDenied:true,deniedAt:new Date().toISOString()});throw new Error('Oznámení nejsou povolená. Později je můžeš zapnout v nastavení webu/prohlížeče.')}sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.publicKey)})}
 const j=sub.toJSON();await api('/api/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth:j.keys?.auth,user_agent:navigator.userAgent.slice(0,240),daily_enabled:true,content_enabled:true})});return {enabled:true,dailyEnabled:true,contentEnabled:true}
}
async function shouldOfferPushNudge(){
 const g=currentGame;if(!['daily','free'].includes(g?.mode)||g?.justCompleted!==true||!pushNudgeDue())return false;if(!('Notification' in window)||!('PushManager' in window)||Notification.permission==='denied')return false;
 try{const state=await browserPushState();if(state.enabled){savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return false}return !!state.config?.available}catch{return false}
}
async function maybeOfferPushNudge(action){if(!(await shouldOfferPushNudge()))return false;postWinEngagementNudgeShown=true;pendingPushPostWinAction=action;trackProductEvent('push_nudge_shown');$('#winModal').classList.add('hidden');$('#pushNudgeModal').classList.remove('hidden');return true}
function finishPushNudgeFlow(){const action=pendingPushPostWinAction;pendingPushPostWinAction=null;$('#pushNudgeModal').classList.add('hidden');if(action)performPostWinAction(action)}
function dismissPushNudge(){const st=getPushNudgeState(),declines=(st.declines||0)+1,today=pragueDateISO();trackProductEvent('push_nudge_dismissed');if(declines>=3)savePushNudgeState({...st,declines,done:true,lastDeclinedAt:new Date().toISOString()});else savePushNudgeState({...st,declines,nextOfferDate:addDaysISO(today,declines===1?1:7),lastDeclinedAt:new Date().toISOString()});finishPushNudgeFlow()}
async function enablePushReminder(){const result=await persistPushEnabled(true);savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return result}
async function acceptPushNudge(){if(pushUiBusy)return;pushUiBusy=true;$('#pushNudgeEnableBtn').disabled=true;try{await enablePushReminder();trackProductEvent('push_nudge_accepted');trackProductEvent('push_notifications_enabled');showToast('Upozornění zapnutá 🔔');finishPushNudgeFlow()}catch(e){if(typeof Notification!=='undefined'&&Notification.permission==='denied')trackProductEvent('push_permission_denied');showToast(e.message)}finally{pushUiBusy=false;$('#pushNudgeEnableBtn').disabled=false;updatePushUI()}}
async function updatePushUI(){
 const btn=$('#pushToggleBtn'),status=$('#pushStatusText');if(!btn||pushUiBusy)return;
 if(!('Notification' in window)||!('PushManager' in window)){btn.disabled=true;btn.textContent='🔕 Nepodporováno';status.textContent='Na tomto zařízení/prohlížeči Web Push není dostupný.';return}
 try{const state=await browserPushState();if(state.unavailable){btn.disabled=true;btn.textContent='🔔 Push čeká na server';status.textContent='Hraní funguje normálně. Push není nakonfigurovaný.';return}
  btn.disabled=false;btn.textContent=state.enabled?'Vypnout':'Zapnout';status.textContent=state.enabled?'Zapnuto · Daily i pondělní novinky.':Notification.permission==='denied'?'Oznámení jsou v prohlížeči zablokovaná.':'Vypnuto.';
 }catch(e){btn.disabled=true;status.textContent=e.message}
}
async function togglePushReminder(){
 if(pushUiBusy)return;pushUiBusy=true;const btn=$('#pushToggleBtn');btn.disabled=true;
 try{const state=await browserPushState();if(!state.migrationReady)throw new Error('Nastavení upozornění čeká na databázovou migraci.');const enabled=!state.enabled;await persistPushEnabled(enabled);trackProductEvent(`push_notifications_${enabled?'enabled':'disabled'}`);if(enabled)savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});else savePushNudgeState({...getPushNudgeState(),accepted:false,done:true,disabledByUser:true,disabledAt:new Date().toISOString()});showToast(enabled?'Upozornění zapnutá 🔔':'Upozornění vypnutá.')}catch(e){if(typeof Notification!=='undefined'&&Notification.permission==='denied')trackProductEvent('push_permission_denied');showToast(e.message)}finally{pushUiBusy=false;updatePushUI()}
}


function bind(){
 $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$('#playDailyBtn').onclick=startDaily;$('#shareDailyBtn').onclick=()=>{const date=pragueDateISO(),daily=dailyResultState(date),rec=daily.active;if(!rec)return;currentGame={puzzle:daily.puzzle,mode:'daily',dailyDate:date,elapsedMs:rec.elapsedMs,moves:rec.moves,finished:true};shareDaily()};
 $('#backFromGame').onclick=goBackFromGame;$('#hintBtn').onclick=openHintModal;$('#starterHintNudgeBtn').onclick=acceptStarterHintNudge;$('#starterHintNudgeDismiss').onclick=dismissStarterHintNudge;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winAccountBtn').onclick=openAccountFromWin;$('#winReplayBtn').onclick=replayDailyFromWin;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;$('#starterWarmupBtn').onclick=()=>{trackProductEvent('starter_easy_warmup_selected');startStarterWarmup()};$('#starterHardDailyBtn').onclick=()=>{trackProductEvent('starter_hard_direct_selected');startDaily({starterHardDirect:true})};
 $('#closeProfileModal').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromWin)restoreWinAfterAccountModal();else if(profileModalFromNudge)resumeAfterAccountNudge() };$('#skipProfileBtn').onclick=()=>{ $('#profileModal').classList.add('hidden');if(profileModalFromWin)restoreWinAfterAccountModal();else if(profileModalFromNudge)resumeAfterAccountNudge() };$('#saveProfileBtn').onclick=saveNewProfile;$('#profileModeLogin').onclick=()=>setAccountMode('login');$('#profileModeCreate').onclick=()=>setAccountMode('create');$('#legacyTeamLoginToggle').onclick=toggleLegacyTeamLogin;$('#joinLeagueModeBtn').onclick=()=>setLeagueCreateMode('join');$('#newLeagueModeBtn').onclick=()=>setLeagueCreateMode('new');$('#leagueSelect').onchange=renderLeaguePinField;$('#profilePasswordToggle').onclick=()=>togglePassword('playerPasswordInput',$('#profilePasswordToggle'));
 $('#nudgeCreateBtn').onclick=()=>openAccountFromNudge('create');$('#nudgeLoginBtn').onclick=()=>openAccountFromNudge('login');$('#nudgeSkipBtn').onclick=dismissAccountNudge;
 $('#progressGuardGoogleBtn').onclick=openProgressGuardGoogle;$('#progressGuardCreateBtn').onclick=openProgressGuardAccount;$('#progressGuardDismissBtn').onclick=dismissProgressGuard;$('#closeProgressGuardModal').onclick=dismissProgressGuard;$('#progressGuardModal').onclick=e=>{if(e.target===$('#progressGuardModal'))dismissProgressGuard()};bindProgressGuard();
 $('#closePasswordModal').onclick=()=>$('#passwordModal').classList.add('hidden');$('#savePasswordBtn').onclick=savePassword;$('#setPasswordToggle').onclick=()=>togglePassword(['setPasswordInput','setPasswordConfirmInput'],$('#setPasswordToggle'));
 $('#closeTeamPinModal').onclick=()=>$('#teamPinModal').classList.add('hidden');$('#saveTeamPinBtn').onclick=saveTeamPin;$('#teamPinToggle').onclick=()=>togglePassword('teamPinInput',$('#teamPinToggle'));$('#closeTeamMembershipModal').onclick=()=>$('#teamMembershipModal').classList.add('hidden');$('#teamMembershipJoinTab').onclick=()=>setTeamMembershipMode('join');$('#teamMembershipNewTab').onclick=()=>setTeamMembershipMode('new');$('#saveTeamMembershipBtn').onclick=saveTeamMembership;
 $('#closeHintModal').onclick=()=>{$('#hintModal').classList.add('hidden');if(currentGame)currentGame.nextHintSource='manual'};$$('[data-hint-level]').forEach(b=>b.onclick=()=>applySmartHint(+b.dataset.hintLevel));$('#closeSupportModeModal').onclick=()=>$('#supportModeModal').classList.add('hidden');$('#supportModeModal').querySelectorAll('[data-support-mode]').forEach(b=>b.onclick=()=>selectSupportModeDraft(b.dataset.supportMode));$('#saveSupportModeBtn').onclick=saveSupportMode;$('#helperAcceptBtn').onclick=acceptHelperOffer;$('#helperDismissBtn').onclick=dismissHelperOffer;
 $('#rescueBtn').onclick=openRescueOffer;$('#confirmRescueBtn').onclick=beginRescue;$('#cancelRescueBtn').onclick=()=>$('#rescueOfferModal').classList.add('hidden');
 $('#skipOnboardingBtn').onclick=()=>closeOnboarding(false);$('#onboardNextBtn').onclick=onboardingNext;
 $$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});
 $$('.ranking-scope-tab').forEach(b=>b.onclick=()=>{rankingXpScope=b.dataset.rankingXpScope;renderLeaderboard()});$$('.ranking-period-tab').forEach(b=>b.onclick=()=>{rankingXpPeriod=b.dataset.rankingPeriod;renderLeaderboard()});$$('.ranking-daily-tab').forEach(b=>b.onclick=()=>{rankingDailyScope=b.dataset.rankingDailyScope;renderLeaderboard()});
 $$('.league-scope-tab').forEach(b=>b.onclick=()=>{leagueScope=b.dataset.leagueScope;renderLeaderboard()});$$('.global-week-tab').forEach(b=>b.onclick=()=>{globalWeekOffset=Number(b.dataset.weekOffset||0);$$('.global-week-tab').forEach(x=>x.classList.toggle('active',x===b));renderGlobalLeague()});$('#familyLeagueSettingsBtn').onclick=openFamilyLeagueModal;$('#closeFamilyLeagueModal').onclick=()=>$('#familyLeagueModal').classList.add('hidden');$('#enableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(true);$('#disableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(false);$('#leaveTeamBtn').onclick=leaveCurrentTeam;$('#closeRankingPrivacyModal').onclick=()=>$('#rankingPrivacyModal').classList.add('hidden');$('#acceptRankingPrivacyBtn').onclick=()=>saveRankingVisibility(true);$('#hideRankingPrivacyBtn').onclick=()=>saveRankingVisibility(false);
 $('#openAllGamesBtn').onclick=()=>nav('free');$('#pushToggleBtn').onclick=togglePushReminder;$('#pushNudgeEnableBtn').onclick=acceptPushNudge;$('#pushNudgeLaterBtn').onclick=dismissPushNudge;$('#installAppBtn').onclick=openInstallFromProfile;$('#installNudgePrimary').onclick=acceptInstallNudge;$('#installNudgeLater').onclick=dismissInstallNudge;$('#closePlayedLevelsModal').onclick=()=>$('#playedLevelsModal').classList.add('hidden');$('#closeLevelDetailModal').onclick=()=>$('#levelDetailModal').classList.add('hidden');$('#levelDetailReplayBtn').onclick=()=>{const c=levelDetailContext;if(!c)return;const p=sortedFreeBank(c.difficulty).find(x=>x.id===c.puzzleId);if(!p)return;$('#levelDetailModal').classList.add('hidden');$('#playedLevelsModal').classList.add('hidden');startGame(p,'free')};$('#levelDetailShareBtn').onclick=shareLevelDetail;
 $$('[data-difficulty-rating]').forEach(b=>b.onclick=()=>rateDifficulty(+b.dataset.difficultyRating,b));$('#reportWordBtn').onclick=openWordReport;$('#closeWordReportModal').onclick=()=>$('#wordReportModal').classList.add('hidden');$('#saveWordReportBtn').onclick=saveWordReport;$('#applyUpdateBtn').onclick=applyPendingUpdate;
 $('#reportIssueBtn').onclick=openSupportReport;$('#closeSupportReportModal').onclick=()=>$('#supportReportModal').classList.add('hidden');$('#saveSupportReportBtn').onclick=saveSupportReport;$('#supportReportModal').onclick=e=>{if(e.target===$('#supportReportModal'))$('#supportReportModal').classList.add('hidden')};$('#exportDataBtn').onclick=exportAccountData;$('#deleteAccountBtn').onclick=openDeleteAccount;$('#closeDeleteAccountModal').onclick=()=>$('#deleteAccountModal').classList.add('hidden');$('#cancelDeleteAccountBtn').onclick=()=>$('#deleteAccountModal').classList.add('hidden');$('#confirmDeleteAccountBtn').onclick=deleteAccount;$('#deleteAccountModal').onclick=e=>{if(e.target===$('#deleteAccountModal'))$('#deleteAccountModal').classList.add('hidden')};
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const guard=$('#progressGuardModal'),support=$('#supportReportModal'),deletion=$('#deleteAccountModal');if(guard&&!guard.classList.contains('hidden')){dismissProgressGuard();return}if(support&&!support.classList.contains('hidden')){support.classList.add('hidden');return}if(deletion&&!deletion.classList.contains('hidden'))deletion.classList.add('hidden')});
 $$('[data-theme-mode]').forEach(b=>b.onclick=()=>applyTheme(b.dataset.themeMode,{persist:true}));
 $('#soundToggle').onclick=()=>{const s=getSettings();s.sound=!s.sound;saveSettings(s);renderSettings();if(s.sound){ensureAudio();tone(620,.08,.02)}};$('#hapticToggle').onclick=()=>{const s=getSettings();s.haptics=!s.haptics;saveSettings(s);renderSettings();if(s.haptics)vibrate(45)};$('#magnifierQuickBtn').onclick=toggleMagnifierPreference;$('#magnifierSettingToggle').onclick=toggleMagnifierPreference;$('#wakeLockToggle').onclick=()=>{const s=getSettings();s.wakeLock=!s.wakeLock;saveSettings(s);syncGameWakeLock();renderSettings()};$('#hapticTestBtn').onclick=testHaptics;$('#replayIntroBtn').onclick=()=>openOnboarding(true);
 $('#board').addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',hideTouchMagnifier);
 const handleViewportChange=()=>{fitGameBoard();drawPaths()};
 const settleViewportChange=()=>{handleViewportChange();[60,180,420].forEach(ms=>setTimeout(handleViewportChange,ms))};
 window.addEventListener('resize',settleViewportChange);window.addEventListener('orientationchange',settleViewportChange);window.visualViewport?.addEventListener?.('resize',settleViewportChange);navigator.devicePosture?.addEventListener?.('change',settleViewportChange);
 const colorSchemeQuery=window.matchMedia?.('(prefers-color-scheme: dark)');const handleSystemThemeChange=()=>{if(getSettings().theme==='auto')applyTheme('auto')};colorSchemeQuery?.addEventListener?.('change',handleSystemThemeChange);
 window.addEventListener('storage',e=>{if(e.key===SETTINGS_KEY){applyTheme(getSettings().theme);renderSettings();renderMagnifierControls();if(getSettings().magnifier===false)hideTouchMagnifier()}});
 if(typeof ResizeObserver!=='undefined'){const stage=$('#boardStage');if(stage){const ro=new ResizeObserver(()=>{if(currentScreen==='game')requestAnimationFrame(()=>{fitGameBoard();drawPaths()})});ro.observe(stage);window.__propletBoardResizeObserver=ro}}
 window.addEventListener('online',()=>{syncQueue({announce:false});refreshRollingContent().catch(()=>{})});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){releaseGameWakeLock();pauseGameClock('hidden');sendAttemptCheckpoint('leave')}else{resumeGameClock();syncGameWakeLock();if(getQueue().length)syncQueue({announce:false})}});window.addEventListener('blur',()=>{releaseGameWakeLock();pauseGameClock('blur')});window.addEventListener('focus',()=>{resumeGameClock();syncGameWakeLock()});window.addEventListener('pagehide',()=>{releaseGameWakeLock();pauseGameClock('pagehide');trackTajenkaAbandon();sendAttemptCheckpoint('leave')});
}

const EXPECTED_PUZZLE_DB_VERSION=11;
const COMPATIBLE_PUZZLE_DB_VERSIONS=new Set([9,10,EXPECTED_PUZZLE_DB_VERSION]);
function compatiblePuzzleDatabase(data){return COMPATIBLE_PUZZLE_DB_VERSIONS.has(Number(data?.version||0))&&Number(data?.contentGeneration||0)===4&&Number(data?.dailyGeneration||0)===4}
const requestedContentPreview=new URLSearchParams(location.search).get('content_preview')||'';
const CONTENT_PREVIEW_DATE=location.hostname.endsWith('.vercel.app')&&/^\d{4}-\d{2}-\d{2}$/.test(requestedContentPreview)?requestedContentPreview:'';
const TAJENKA_PRODUCTION_HOSTS=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
const TAJENKA_PREVIEW_ORIGIN=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname.endsWith('.vercel.app');
const TAJENKA_PREVIEW=new URLSearchParams(location.search).get('tajenka')==='1'&&TAJENKA_PREVIEW_ORIGIN&&!TAJENKA_PRODUCTION_HOSTS.has(location.hostname);
const TAJENKA_RELEASE_ENABLED=window.PROPLET_RUNTIME_META?.capabilities?.tajenkaReleaseEnabled===true;
const requestedTajenkaWeek=Math.min(10,Math.max(1,Number.parseInt(new URLSearchParams(location.search).get('tajenka_week')||'1',10)||1));
const TAJENKA_FIRST_SATURDAY=window.PROPLET_RUNTIME_META?.capabilities?.tajenkaFirstSaturday||'2026-08-29';
const TAJENKA_PREPARED_WEEKS=10;
let activeTajenkaWeek=null;
let TAJENKA_AVAILABLE=false;
let tajenkaPuzzle=null;

function refreshTajenkaAvailability(iso=pragueDateISO()){
 const offset=dayOffsetISO(iso,TAJENKA_FIRST_SATURDAY),week=offset>=0?Math.floor(offset/7)+1:null,weekend=mondayWeekdayIndex(iso)>=5;
 activeTajenkaWeek=TAJENKA_PREVIEW?requestedTajenkaWeek:(week>=1&&week<=TAJENKA_PREPARED_WEEKS?week:null);
 TAJENKA_AVAILABLE=TAJENKA_PREVIEW||Boolean(TAJENKA_RELEASE_ENABLED&&weekend&&activeTajenkaWeek);
 return TAJENKA_AVAILABLE;
}
refreshTajenkaAvailability();

function tajenkaFixtureValid(data){
 if(!data||data.version!==1||!/^tajenka-v2-week-\d{2}$/.test(data.id)||data.kind!=='weekend_bonus'||data.meta?.previewOnly!==true||Number(data.meta?.rewardXp)!==TAJENKA_REWARD_XP)return false;
 if(!Number.isInteger(data.rows)||!Number.isInteger(data.cols)||!Array.isArray(data.mask)||!Array.isArray(data.letters)||!Array.isArray(data.answers))return false;
 if(data.letters.length!==data.rows*data.cols||data.mask.length!==Number(data.meta?.cells)||data.answers.length<1)return false;
 const mask=new Set(data.mask);if(mask.size!==data.mask.length||data.mask.some(i=>!Number.isInteger(i)||i<0||i>=data.letters.length))return false;
 for(const answer of data.answers){if(!answer?.word||!Array.isArray(answer.path)||answer.path.length!==answer.word.length)return false;const seen=new Set();for(let i=0;i<answer.path.length;i++){const cell=answer.path[i];if(!mask.has(cell)||seen.has(cell)||i>0&&!adjacentPuzzleCells(answer.path[i-1],cell,data.cols))return false;seen.add(cell)}if(answer.path.map(i=>data.letters[i]).join('')!==answer.word)return false}
 const order=data.tajenka?.answerOrder;return Array.isArray(order)&&order.length===data.answers.length&&new Set(order).size===order.length&&order.every(i=>Number.isInteger(i)&&i>=0&&i<data.answers.length);
}
function adjacentPuzzleCells(a,b,cols){return Math.abs(a-b)===1&&Math.floor(a/cols)===Math.floor(b/cols)||Math.abs(a-b)===cols}
function tajenkaState(){try{const raw=JSON.parse(localStorage.getItem(TAJENKA_STATE_KEY)||'{}');return raw&&typeof raw==='object'?raw:{}}catch{return {}}}
function saveTajenkaState(state){try{localStorage.setItem(TAJENKA_STATE_KEY,JSON.stringify(state))}catch{}}
function tajenkaCompletion(puzzle=tajenkaPuzzle,state=tajenkaState()){if(!puzzle)return null;return state.completions?.[puzzle.id]||(state.completed?.puzzleId===puzzle.id?state.completed:null)}
function tajenkaFoundFromState(puzzle,row){
 if(!row||row.puzzleId!==puzzle.id)return [];
 const found=[];const seen=new Set();
 for(const f of row.found||[]){const a=puzzle.answers?.[f.answerIndex];if(!a||seen.has(f.answerIndex)||a.word!==f.word||!samePath(a.path,f.path||[]))continue;seen.add(f.answerIndex);found.push({answerIndex:f.answerIndex,word:f.word,colorIndex:Number.isFinite(f.colorIndex)?f.colorIndex:found.length%COLORS.length,path:[...f.path]})}
 return found;
}
function savedTajenkaProgress(puzzle){const row=tajenkaState().inProgress;const found=tajenkaFoundFromState(puzzle,row);if(!row||row.puzzleId!==puzzle.id)return null;return {...row,found,moves:Math.max(0,Number(row.moves)||0),hints:Math.max(0,Number(row.hints)||0),wrongAttempts:Math.max(0,Number(row.wrongAttempts)||0),maxHintLevel:Math.max(0,Number(row.maxHintLevel)||0),elapsedMs:Math.max(0,Number(row.elapsedMs)||0)} }
function tajenkaPhraseWords(puzzle=tajenkaPuzzle){return (puzzle?.tajenka?.answerOrder||[]).map(i=>puzzle.answers[i]).filter(Boolean)}
function trackTajenkaAbandon(g=currentGame){if(!TAJENKA_AVAILABLE||!g||g.mode!=='tajenka'||g.finished||g.tajenkaAbandonTracked)return;g.tajenkaAbandonTracked=true;trackProductEvent('tajenka_abandoned')}
function trackTajenkaView(){if(!TAJENKA_AVAILABLE)return;try{const key=`${TAJENKA_VIEW_KEY}:${tajenkaPuzzle?.id||'unknown'}`;if(sessionStorage.getItem(key)==='1')return;sessionStorage.setItem(key,'1')}catch{}trackProductEvent('tajenka_viewed')}
function renderTajenkaEntry(){
 const root=$('#tajenkaPreviewCard');if(!root)return;
 if(!TAJENKA_AVAILABLE||!tajenkaPuzzle){root.classList.add('hidden');root.innerHTML='';return}
 const state=tajenkaState(),inProgress=state.inProgress?.puzzleId===tajenkaPuzzle.id,completed=!!tajenkaCompletion(tajenkaPuzzle,state);
 root.innerHTML=`<div class="tajenka-entry-icon" aria-hidden="true">✦</div><div class="tajenka-entry-copy"><span class="eyebrow"><b>NOVINKA</b> · VÍKENDOVÝ BONUS</span><h2>Tajenka</h2><p>${inProgress?'Pokračuj v hledání slov a odhal skrytou frázi.':'Najdi pět propletených slov a odhal společnou myšlenku.'}</p><span class="tajenka-entry-availability">🗓️ Každý víkend nová</span><span class="tajenka-entry-reward">+${Number(tajenkaPuzzle.meta?.rewardXp)||TAJENKA_REWARD_XP} XP</span>${completed?'<small class="tajenka-entry-done">✓ Tajenku už máš odhalenou · můžeš si ji zahrát znovu</small>':''}</div><button id="tajenkaPreviewBtn" class="primary-btn">${inProgress?'Pokračovat':completed?'Zahrát znovu':'Hrát tajenku'}</button>`;
 root.classList.remove('hidden');root.querySelector('#tajenkaPreviewBtn').onclick=startTajenka;trackTajenkaView();
}
async function loadTajenkaFixture(){
 if(!refreshTajenkaAvailability()){tajenkaPuzzle=null;return null}
 try{const url=TAJENKA_PREVIEW?`/api/tajenka?week=${activeTajenkaWeek}`:'/api/tajenka',response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('tajenka-fixture');const puzzle=await response.json();if(!tajenkaFixtureValid(puzzle)||Number(puzzle.week)!==Number(activeTajenkaWeek))throw new Error('tajenka-fixture-invalid');tajenkaPuzzle=puzzle;return tajenkaPuzzle}catch(error){console.warn('Tajenka fixture unavailable',error);tajenkaPuzzle=null;return null}
}
function contentWeekKey(iso=CONTENT_PREVIEW_DATE||pragueDateISO()){return addDaysISO(iso,-mondayWeekdayIndex(iso))}
function rollingContentUrl(){const asOf=CONTENT_PREVIEW_DATE||pragueDateISO(),week=contentWeekKey(asOf),q=new URLSearchParams({week});if(CONTENT_PREVIEW_DATE)q.set('preview_as_of',CONTENT_PREVIEW_DATE);return `/api/rolling-content?${q.toString()}`}
function showPuzzleBootLoading(){
 const dailyMeta=$('#dailyMeta');if(dailyMeta&&!dailyMeta.textContent)dailyMeta.textContent='Načítám dnešní výzvu…';
 const grid=$('#difficultyCards');if(grid&&!grid.children.length)grid.innerHTML='<div class="card" style="grid-column:1/-1;padding:24px"><strong>Načítám úrovně…</strong><p class="muted" style="margin:6px 0 0">Připravuju herní banku.</p></div>';
}
async function loadPuzzleDatabase(){
 let url='/puzzles.json';
 GEN4_CANDIDATE_PREVIEW=window.PROPLET_RUNTIME_META?.gen4CandidatePreview===true;
 if(GEN4_CANDIDATE_PREVIEW)url='/api/puzzle-database';
 if(GEN4_CANDIDATE_PREVIEW){
  const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('gen4-preview-db');const data=await r.json();if(!compatiblePuzzleDatabase(data)||Number(data?.contentGeneration)!==4)throw new Error('gen4-preview-db-version');return data;
 }
 if('caches' in window){
  try{const cached=await caches.match(url,{ignoreSearch:true});if(cached){const data=await cached.clone().json();if(compatiblePuzzleDatabase(data)){fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(fresh=>{if(compatiblePuzzleDatabase(fresh)){const content=puzzleDB?.contentStatus,rolling=puzzleDB?.rollingContent,extras=Object.fromEntries(Object.keys(DIFF).map(d=>[d,(puzzleDB?.free?.[d]||[]).filter(p=>p.meta?.rollingContent)]));puzzleDB=fresh;for(const d of Object.keys(DIFF)){const seen=new Set((puzzleDB.free?.[d]||[]).map(p=>p.id));for(const p of extras[d]||[])if(!seen.has(p.id)){puzzleDB.free[d].push(p);seen.add(p.id)}}if(rolling)puzzleDB.rollingContent=rolling;if(content)puzzleDB.contentStatus=content;renderDaily();renderFree()}}).catch(()=>{});return data}}}catch{}
 }
 const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('puzzle-db');const data=await r.json();if(!compatiblePuzzleDatabase(data))throw new Error('puzzle-db-version');return data;
}
function mergeRollingContent(delta){
 if(!puzzleDB||![1,2].includes(Number(delta?.version||0)))return false;
 for(const diff of Object.keys(DIFF)){
  const base=puzzleDB.free?.[diff]||[],incoming=delta.puzzles?.[diff]||[],seen=new Set(base.map(p=>p.id));
  for(const p of incoming)if(!seen.has(p.id)){base.push(p);seen.add(p.id)}
  base.sort((a,b)=>(Number(a.meta?.level)||9999)-(Number(b.meta?.level)||9999));puzzleDB.free[diff]=base;
 }
 puzzleDB.rollingContent={...(puzzleDB.rollingContent||{}),...(delta.meta||{})};
 puzzleDB.contentStatus={asOf:delta.asOf,latestBatch:delta.latestBatch||null,nextRelease:delta.nextRelease||null,availableFreeCounts:delta.availableFreeCounts||{}};
 return true;
}
function renderAfterRollingContent(){renderDaily();renderFree();renderProfile()}
async function refreshRollingContent(){
 const url=rollingContentUrl(),headers=CONTENT_PREVIEW_DATE?{'X-Proplet-Preview-As-Of':CONTENT_PREVIEW_DATE}:{};
 if('caches' in window){
  try{
   const exact=await caches.match(url);
   if(exact){const data=await exact.clone().json();if(mergeRollingContent(data))renderAfterRollingContent()}
   else if(!CONTENT_PREVIEW_DATE){
    const previous=await caches.match('/api/rolling-content',{ignoreSearch:true});
    if(previous){const data=await previous.clone().json(),safeAsOf=data?.asOf;if((!safeAsOf||safeAsOf<=pragueDateISO())&&mergeRollingContent(data))renderAfterRollingContent()}
   }
  }catch{}
 }
 try{const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error('rolling-content');const fresh=await r.json();if(mergeRollingContent(fresh))renderAfterRollingContent();return fresh}catch{return null}
}

async function boot(){
 applyTheme(getSettings().theme);showPuzzleBootLoading();
 try{puzzleDB=await loadPuzzleDatabase()}catch{$('body').innerHTML='<main style="padding:30px;font-family:system-ui"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Zkontroluj připojení a zkus stránku obnovit.</p></main>';return}
 await loadTajenkaFixture();
 document.body.classList.remove('landscape-game-blocked');migrateScopedStorage();reconcileLocalGen4Rewards();bind();bindClientErrorReporting();initNavigation();const requestedOpen=new URLSearchParams(location.search).get('open');if(requestedOpen==='free')nav('free',{replace:true});updateProfileChip();const footerVersion=$('#appVersionFooter');if(footerVersion)footerVersion.textContent=`Proplet v${APP_VERSION}`;trackProductEvent('app_open');trackInboundCampaign();trackAppSession();renderDaily();renderFree();renderProfile();renderInstallUI();if(requestedOpen==='tajenka'&&TAJENKA_AVAILABLE)setTimeout(startTajenka,0);const initialRollingContent=refreshRollingContent().catch(()=>null);syncQueue({announce:false});refreshRescueStatus();initialRollingContent.finally(()=>setTimeout(()=>openOnboarding(false),80));
 registerServiceWorker();setTimeout(updatePushUI,700);setTimeout(maybeOpenQaDashboard,900);
 let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily();refreshRollingContent().catch(()=>{});loadTajenkaFixture().finally(renderTajenkaEntry)}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);
}
if(typeof window!=='undefined'&&typeof document!=='undefined')boot();
if(typeof module!=='undefined'&&module.exports)module.exports={WIN_PRAISE,stableTextIndex,completionPraise};
