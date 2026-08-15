from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: {label}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def append_once(path, marker, block):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if marker in text:
        raise SystemExit(f"{path}: marker already present: {marker}")
    p.write_text(text.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")


replace_once("server.py", 'APP_VERSION = "3.26.2"', 'APP_VERSION = "3.27.0"', "server version")
replace_once("public/app.js", "const APP_VERSION='3.26.2';", "const APP_VERSION='3.27.0';", "client version")

replace_once(
    "public/app.js",
    """const DIFF={
  easy:{label:'Snadná',icon:'🌱',desc:'6×6 · menší plocha a přehlednější cesty.',xp:15},
  medium:{label:'Střední',icon:'🧠',desc:'7×8 · větší plocha a víc možných cest.',xp:25},
  hard:{label:'Těžká',icon:'🧨',desc:'8×8 až 9×9 · delší slova a ostré zákruty.',xp:50},
  hardcore:{label:'Mozkožrout',icon:'🤯',desc:'10×10 · dlouhá slova, šneci a minimum krátkých slov.',xp:100}
};""",
    """const DIFF={
  easy:{label:'Snadná',icon:'/difficulty/easy.svg',desc:'6×6 · menší plocha a přehlednější cesty.',xp:15},
  medium:{label:'Střední',icon:'/difficulty/medium.svg',desc:'7×8 · větší plocha a víc možných cest.',xp:25},
  hard:{label:'Těžká',icon:'/difficulty/hard.svg',desc:'8×8 až 9×9 · delší slova a ostré zákruty.',xp:50},
  hardcore:{label:'Mozkožrout',icon:'/difficulty/hardcore.svg',desc:'10×10 · dlouhá slova, šneci a minimum krátkých slov.',xp:100}
};
function difficultyIconMarkup(diff,className='difficulty-icon-img'){
 const d=DIFF[diff];return d?`<img class="${className}" src="${d.icon}" alt="" aria-hidden="true" draggable="false">`:'';
}""",
    "difficulty asset registry",
)

old_week = """function renderDailyWeekRhythm(iso){const root=$('#dailyWeekRhythm');if(!root)return;const cadence=puzzleDB.dailyCadence||{},pattern=cadence.pattern||['easy','easy','medium','medium','medium','hard','hard'],labels=cadence.labels||['Po','Út','St','Čt','Pá','So','Ne'],activeFrom=cadence.activeFrom||puzzleDB.dailyGeneration3From||null,active=!activeFrom||iso>=activeFrom,today=active?mondayWeekdayIndex(iso):-1;root.classList.toggle('pending',!active);root.innerHTML=`<div class="daily-week-rhythm-head"><strong>${active?'Týdenní rytmus':'Od pondělí 17. 8.'}</strong><span>2 snadné · 3 střední · 2 těžké</span></div><div class="daily-week-days">${pattern.map((diff,i)=>`<span class="daily-week-day ${diff} ${i===today?'active':''}" title="${labels[i]} · ${DIFF[diff]?.label||diff}"><b>${labels[i]}</b><i>${DIFF[diff]?.icon||'•'}</i></span>`).join('')}</div>`}"""
new_week = """function renderDailyWeekRhythm(iso){const root=$('#dailyWeekRhythm');if(!root)return;const cadence=puzzleDB.dailyCadence||{},pattern=cadence.pattern||['easy','easy','medium','medium','medium','hard','hard'],labels=cadence.labels||['Po','Út','St','Čt','Pá','So','Ne'],activeFrom=cadence.activeFrom||puzzleDB.dailyGeneration3From||null,active=!activeFrom||iso>=activeFrom,today=active?mondayWeekdayIndex(iso):-1;root.classList.toggle('pending',!active);root.innerHTML=`<div class="daily-week-rhythm-head"><strong>${active?'Týdenní rytmus':'Od pondělí 17. 8.'}</strong><span>2 snadné · 3 střední · 2 těžké</span></div><div class="daily-week-days">${pattern.map((diff,i)=>`<span class="daily-week-day ${diff} ${i===today?'active':''}" title="${labels[i]} · ${DIFF[diff]?.label||diff}"><b>${labels[i]}</b><i>${difficultyIconMarkup(diff,'daily-week-icon')}</i></span>`).join('')}</div>`}"""
replace_once("public/app.js", old_week, new_week, "weekly rhythm icons")

replace_once(
    "public/app.js",
    """root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),nextLevel=Number((q.resume||q.nextUnsolved)?.meta?.level)||null,status=q.resume?`Pokračovat${nextLevel?` · úroveň ${nextLevel}`:''}`:q.done===q.total&&q.total?'Hotovo · hrát znovu':`${q.transferred?`Převedeno ${q.transferred} · `:''}další ${nextLevel||1}`;return `<button class="quick-game" data-quick-free="${key}" data-diff="${key}"><span class="quick-game-icon">${d.icon}</span><span class="quick-game-copy"><strong>${d.label}</strong><small>${status}</small><i><b style="width:${q.pct}%"></b></i></span><span class="quick-game-arrow">›</span></button>`}).join('');""",
    """root.innerHTML=Object.entries(DIFF).map(([key,d])=>{const q=freeProgress(key),nextLevel=Number((q.resume||q.nextUnsolved)?.meta?.level)||null,status=q.resume?`Pokračovat${nextLevel?` · úroveň ${nextLevel}`:''}`:q.done===q.total&&q.total?'Hotovo · hrát znovu':`${q.transferred?`Převedeno ${q.transferred} · `:''}další ${nextLevel||1}`;return `<button class="quick-game" data-quick-free="${key}" data-diff="${key}"><span class="quick-game-icon">${difficultyIconMarkup(key,'difficulty-icon-img')}</span><span class="quick-game-copy"><strong>${d.label}</strong><small>${status}</small><i><b style="width:${q.pct}%"></b></i></span><span class="quick-game-arrow">›</span></button>`}).join('');""",
    "quick play icons",
)

replace_once(
    "public/app.js",
    """return `<article class="difficulty-card card" data-diff="${key}"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${d.icon}</span><div><span class="eyebrow">${progressLabel}</span><h2>${d.label}</h2></div></div><p class="muted">${d.desc}</p><span class="xp-chip">+${d.xp} XP za novou úroveň</span><div class="progress-line"><span style="width:${pct}%"></span></div><div class="difficulty-actions"><button class="secondary-btn play-next-btn" data-play-free="${key}">${resume?'Pokračovat':(done===total?'Hrát znovu':'Hraj další úroveň')}</button><button class="text-btn played-levels-btn" data-played-levels="${key}" ${done?'':'disabled'}>▦ Postup a úrovně${done?` · ${actual} hraných${transferred?` + ${transferred} převedených`:''}`:''}</button></div></div><div class="difficulty-progress" data-play-free="${key}" role="button" tabindex="0" aria-label="${resume?'Pokračovat v rozehrané':'Hrát'} ${d.label}" style="--progress:${pct}%"><div><strong>${done}</strong><small>/${total}</small></div><span>›</span></div></article>`""",
    """return `<article class="difficulty-card card" data-diff="${key}"><div class="difficulty-copy"><div class="difficulty-title"><span class="difficulty-left-icon">${difficultyIconMarkup(key,'difficulty-icon-img')}</span><div><span class="eyebrow">${progressLabel}</span><h2>${d.label}</h2></div></div><p class="muted">${d.desc}</p><span class="xp-chip">+${d.xp} XP za novou úroveň</span><div class="progress-line"><span style="width:${pct}%"></span></div><div class="difficulty-actions"><button class="secondary-btn play-next-btn" data-play-free="${key}">${resume?'Pokračovat':(done===total?'Hrát znovu':'Hraj další úroveň')}</button><button class="text-btn played-levels-btn" data-played-levels="${key}" ${done?'':'disabled'}>▦ Postup a úrovně${done?` · ${actual} hraných${transferred?` + ${transferred} převedených`:''}`:''}</button></div></div><div class="difficulty-progress" data-play-free="${key}" role="button" tabindex="0" aria-label="${resume?'Pokračovat v rozehrané':'Hrát'} ${d.label}" style="--progress:${pct}%"><div><strong>${done}</strong><small>/${total}</small></div><span>›</span></div></article>`""",
    "free difficulty icons",
)

replace_once(
    "public/app.js",
    """const levelNo=Number(puzzle.meta?.level)||null;$('#gameDifficulty').textContent=mode==='rescue'?'🔥 6×6 · jeden pokus':mode==='starter'?'🎓 Trénink · 5×5':mode==='free'?`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}${levelNo?` ${levelNo}`:''}`:`${DIFF[puzzle.difficulty].icon} ${DIFF[puzzle.difficulty].label}`;""",
    """const levelNo=Number(puzzle.meta?.level)||null;if(mode==='rescue'||mode==='starter')$('#gameDifficulty').textContent=mode==='rescue'?'🔥 6×6 · jeden pokus':'🎓 Trénink · 5×5';else $('#gameDifficulty').innerHTML=`${difficultyIconMarkup(puzzle.difficulty,'game-difficulty-icon')}<span>${esc(DIFF[puzzle.difficulty].label)}${mode==='free'&&levelNo?` ${levelNo}`:''}</span>`;""",
    "game header icon",
)

replace_once(
    "public/app.js",
    """${DIFF[g.puzzle.difficulty].icon} ${DIFF[g.puzzle.difficulty].label} · ⏱ ${fmtTime(rec.elapsedMs)} · 🔥 ${countCz(stats.currentStreak,'den','dny','dní')}${world}${clean?`\n${clean}`:''}""",
    """${DIFF[g.puzzle.difficulty].label} · ⏱ ${fmtTime(rec.elapsedMs)} · 🔥 ${countCz(stats.currentStreak,'den','dny','dní')}${world}${clean?`\n${clean}`:''}""",
    "share text removes legacy difficulty emoji",
)

replace_once(
    "public/home-layout.js",
    """return `<button class="home-diff-tile" type="button" data-home-free="${key}" data-diff="${key}" aria-label="${htmlEsc(info.label)}, ${q.done} z ${q.total} hotovo"><span class="home-diff-top"><span>${info.icon}</span><strong>${htmlEsc(info.label)}</strong></span><small>${q.done} / ${q.total}</small><i class="home-diff-progress"><b style="width:${pct}%"></b></i></button>`;""",
    """return `<button class="home-diff-tile" type="button" data-home-free="${key}" data-diff="${key}" aria-label="${htmlEsc(info.label)}, ${q.done} z ${q.total} hotovo"><span class="home-diff-top"><span>${difficultyIconMarkup(key,'home-diff-icon')}</span><strong>${htmlEsc(info.label)}</strong></span><small>${q.done} / ${q.total}</small><i class="home-diff-progress"><b style="width:${pct}%"></b></i></button>`;""",
    "home difficulty tiles",
)
replace_once(
    "public/home-layout.js",
    """root.innerHTML=`<button class="home-continue" type="button" data-home-continue="${targetDiff}" data-diff="${targetDiff}"><span class="home-continue-icon">${d.icon}</span><span class="home-continue-copy"><strong>${htmlEsc(d.label)} ${level}</strong><small>${htmlEsc(detail)}</small></span><span class="home-continue-cta">${action}</span></button><div class="home-alt-label">Jiná obtížnost</div><div class="home-diff-grid">${tiles}</div>`;""",
    """root.innerHTML=`<button class="home-continue" type="button" data-home-continue="${targetDiff}" data-diff="${targetDiff}"><span class="home-continue-icon">${difficultyIconMarkup(targetDiff,'home-continue-difficulty-icon')}</span><span class="home-continue-copy"><strong>${htmlEsc(d.label)} ${level}</strong><small>${htmlEsc(detail)}</small></span><span class="home-continue-cta">${action}</span></button><div class="home-alt-label">Jiná obtížnost</div><div class="home-diff-grid">${tiles}</div>`;""",
    "home continue icon",
)

replace_once(
    "public/sw.js",
    """const CACHE='proplet-v3.26.2-celebration-copy';
const CORE=['/','/index.html','/styles.css','/app.js','/theme-init.js','/home-layout.css','/home-layout.js','/puzzles.json','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/favicon.svg','/favicon-32.png','/share-card.png','/privacy.html','/terms.html','/legal.css'];""",
    """const CACHE='proplet-v3.27.0-difficulty-icons';
const CORE=['/','/index.html','/styles.css','/app.js','/theme-init.js','/home-layout.css','/home-layout.js','/puzzles.json','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/favicon.svg','/favicon-32.png','/share-card.png','/difficulty/easy.svg','/difficulty/medium.svg','/difficulty/hard.svg','/difficulty/hardcore.svg','/privacy.html','/terms.html','/legal.css'];""",
    "service worker cache",
)

append_once(
    "public/styles.css",
    "/* v3.27 — bespoke difficulty icon system */",
    r"""
/* v3.27 — bespoke difficulty icon system */
.difficulty-icon-img,.daily-week-icon,.game-difficulty-icon{display:block;object-fit:contain}
.difficulty-title{display:flex;align-items:center;gap:12px}
.difficulty-left-icon{position:relative;z-index:2;width:48px;height:48px;flex:0 0 48px;display:grid;place-items:center;border-radius:15px;background:var(--diff-soft)}
.difficulty-left-icon .difficulty-icon-img{width:40px;height:40px}
.quick-game-icon .difficulty-icon-img{width:30px;height:30px}
.game-title #gameDifficulty{display:flex;align-items:center;justify-content:center;gap:6px}
.game-difficulty-icon{width:20px;height:20px;flex:0 0 20px}
.daily-week-day i{display:grid;place-items:center}
.daily-week-icon{width:15px;height:15px}
.difficulty-card[data-diff="easy"]{--diff:#45b98e;--diff-soft:#dff5ec}
.difficulty-card[data-diff="medium"]{--diff:#f08a32;--diff-soft:#fff0dc}
.difficulty-card[data-diff="hard"]{--diff:#4e83d5;--diff-soft:#e5efff}
.difficulty-card[data-diff="hardcore"]{--diff:#8b5ddd;--diff-soft:#efe7ff}
html[data-theme="dark"] .difficulty-card[data-diff="easy"]{--diff:#70d9b3;--diff-soft:#203a34}
html[data-theme="dark"] .difficulty-card[data-diff="medium"]{--diff:#ffad5b;--diff-soft:#443025}
html[data-theme="dark"] .difficulty-card[data-diff="hard"]{--diff:#87b5ff;--diff-soft:#25364f}
html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]{--diff:#bd92ff;--diff-soft:#372b4d}
""",
)

append_once(
    "public/home-layout.css",
    "/* v3.27 — custom difficulty assets */",
    r"""
/* v3.27 — custom difficulty assets */
.home-continue[data-diff="medium"],.home-diff-tile[data-diff="medium"]{--q:#f08a32;--qs:#fff0dc}
.home-continue[data-diff="hard"],.home-diff-tile[data-diff="hard"]{--q:#4e83d5;--qs:#e5efff}
.home-continue-icon .home-continue-difficulty-icon{width:30px;height:30px;display:block}
.home-diff-top>span .home-diff-icon{width:22px;height:22px;display:block}
html[data-theme="dark"] .home-continue[data-diff="medium"],html[data-theme="dark"] .home-diff-tile[data-diff="medium"]{--q:#ffad5b;--qs:#443025}
html[data-theme="dark"] .home-continue[data-diff="hard"],html[data-theme="dark"] .home-diff-tile[data-diff="hard"]{--q:#87b5ff;--qs:#25364f}
""",
)
