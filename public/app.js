Warning: truncated output (original token count: 64318)
Total output lines: 1775

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
  const remaining=Math.max(1000,Math.round((rs.secondsRemaining??30)*1000));startGame(puzzle,'rescue',rs.missedDate,{limitMs:remaining,re…34318 tokens truncated…nboard-diff-icon')}${difficultyIconMarkup('hard','onboard-diff-icon')}${difficultyIconMarkup('hardcore','onboard-diff-icon')}</div><div><span class="eyebrow">VOLNÁ HRA</span><strong>Stovky dalších úrovní</strong><small>Čtyři obtížnosti. Hraj kdykoli a vlastním tempem.</small></div></div></div><p class="onboard-intro-note">Nejdřív si během chvilky ukážeme, jak na to.</p></div>`},
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
