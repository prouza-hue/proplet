from pathlib import Path

root = Path(__file__).resolve().parents[1]
app_path = root / 'public' / 'app.js'
css_path = root / 'public' / 'styles.css'
sw_path = root / 'public' / 'sw.js'
server_path = root / 'server.py'

app = app_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
server = server_path.read_text(encoding='utf-8')

def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

# Preview identity + fixed Saturday simulation so the risky onboarding branch is immediately testable.
app = one(app, "const APP_VERSION='3.31.3';", "const APP_VERSION='3.31.4-preview.1';\nconst PREVIEW_NOW_DATE='2026-08-22';", 'app version')
server = one(server, 'APP_VERSION = "3.31.3"', 'APP_VERSION = "3.31.4-preview.1"', 'server version')
sw = one(sw, "const CACHE='proplet-v3.31.3-onboarding-polish';", "const CACHE='proplet-v3.31.4-preview.1-hard-daily-onboarding';", 'sw cache')
app = one(app, "const CONTENT_PREVIEW_DATE='';", "const CONTENT_PREVIEW_DATE=PREVIEW_NOW_DATE;", 'content preview date')
app = one(app,
"function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}",
"function pragueDateISO(){if(PREVIEW_NOW_DATE)return PREVIEW_NOW_DATE;return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}",
'preview date clock')

# Preview must not write gameplay results or flush an existing local queue to production.
app = one(app,
"function queueResult(rec){\n if(CONTENT_PREVIEW_DATE&&rec?.mode==='free'&&Number(rec?.level||0)>200)return;",
"function queueResult(rec){\n if(CONTENT_PREVIEW_DATE)return;",
'preview queue guard')
app = one(app,
"async function syncQueue({announce=false}={}){\n const p=getProfile();",
"async function syncQueue({announce=false}={}){\n if(CONTENT_PREVIEW_DATE)return {ok:true,left:getQueue().length,preview:true};\n const p=getProfile();",
'preview sync guard')

# Persist the special one-off warm-up flag if the player backgrounds the app.
app = one(app,
"contentBatchId:options.contentBatchId||null,starterHintUsed:false,starterHintOfferShown:false,starterGuidePath:[],undoSnapshot:null};",
"contentBatchId:options.contentBatchId||null,postStarterWarmup:!!(options.postStarterWarmup||restored?.postStarterWarmup),starterHardDirect:!!options.starterHardDirect,starterHintUsed:false,starterHintOfferShown:false,starterGuidePath:[],undoSnapshot:null};",
'game onboarding flags')
app = one(app,
"helperHintUsed:!!g.helperHintUsed,savedAt:Date.now()};saveState(s);g.lastAutosaveAt=Date.now();",
"helperHintUsed:!!g.helperHintUsed,postStarterWarmup:!!g.postStarterWarmup,savedAt:Date.now()};saveState(s);g.lastAutosaveAt=Date.now();",
'warmup progress persistence')

old_daily = """function showStarterDailyNudge(){const n=$('#starterDailyNudge'),hero=$('.daily-hero');if(n)n.classList.remove('hidden');hero?.classList.add('starter-next');setTimeout(()=>hero?.classList.remove('starter-next'),2400)}
function startDaily(){$('#starterDailyNudge')?.classList.add('hidden');$('.daily-hero')?.classList.remove('starter-next');const date=pragueDateISO(),daily=dailyResultState(date);if(daily.active){showDailyResult(date,daily.active);return}startGame(daily.puzzle,'daily',date)}
"""
new_daily = """function showStarterDailyNudge(){const n=$('#starterDailyNudge'),hero=$('.daily-hero');if(n)n.classList.remove('hidden');hero?.classList.add('starter-next');setTimeout(()=>hero?.classList.remove('starter-next'),2400)}
function startDaily(options={}){$('#starterDailyNudge')?.classList.add('hidden');$('.daily-hero')?.classList.remove('starter-next');const date=pragueDateISO(),daily=dailyResultState(date);if(daily.active){showDailyResult(date,daily.active);return}startGame(daily.puzzle,'daily',date,options);if(options.starterHardDirect)setTimeout(()=>showToast('🔥 Dnešní výzva je Těžká. Kdyby ses zasekl, Nápověda je dole po ruce.'),180)}
function startStarterWarmup(){const list=sortedFreeBank('easy'),slots=localFreeSlotState('easy'),p=list.find(x=>!slots.effective.has(Number(x.meta?.level)))||list[0];if(!p){nav('free',{replace:true});return}startGame(p,'free',null,{postStarterWarmup:true})}
"""
app = one(app, old_daily, new_daily, 'starter transition helpers')

# Starter completion: Easy/Medium remains one-tap Daily; Hard becomes an explicit choice before entering the board.
app = one(app,
"async function finishStarterGame(g){\n g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();g.starterGuidePath=[];hideStarterHintNudge();renderGameBoard();renderGameHUD();updateGameFeel();",
"async function finishStarterGame(g){\n g.finished=true;g.justCompleted=true;g.elapsedMs=gameElapsed(g);stopTimer();g.starterGuidePath=[];hideStarterHintNudge();renderGameBoard();renderGameHUD();updateGameFeel();\n const starterDaily=dailyPuzzleFor(pragueDateISO()),hardNext=starterDaily?.difficulty==='hard';g.starterNextHard=hardNext;if(hardNext)trackProductEvent('starter_hard_choice_shown');",
'starter hard detection')
app = one(app,
"$('#newBadgeBox').innerHTML=`<div class=\"unlock-row starter-reward\"><span class=\"emoji\">🧩</span><div><strong>První propletení</strong><small>${starterRewardCopy}</small></div></div>`;",
"$('#newBadgeBox').innerHTML=`<div class=\"unlock-row starter-reward\"><span class=\"emoji\">🧩</span><div><strong>První propletení</strong><small>${starterRewardCopy}</small></div></div>${hardNext?'<div class=\"unlock-row starter-hard-choice\"><span class=\"emoji\">🔥</span><div><strong>Dnešní výzva je Těžká</strong><small>Dneska se zrovna nešetří. Můžeš do ní rovnou — nebo si dát jednu Snadnou na rozjezd.</small></div></div>':''}`;",
'hard choice card')
app = one(app,
"$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️';",
"$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=hardNext?'🔥 Jdu rovnou na dnešní Těžkou':'Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent=hardNext?'🌱 Nejdřív Snadná':'Hrát dnešní výzvu ☀️';",
'starter choice buttons')

# The warm-up is part of onboarding, so don't interrupt it with account CTAs, ranking or feedback.
app = one(app,
"if(getProfile()?.token||currentGame?.mode==='rescue'||currentGame?.mode==='starter'||currentGame?.justCompleted!==true)return 0;",
"if(getProfile()?.token||currentGame?.mode==='rescue'||currentGame?.mode==='starter'||currentGame?.postStarterWarmup||currentGame?.justCompleted!==true)return 0;",
'account nudge warmup suppression')
app = one(app,
"function updateWinAccountCta(){const button=$('#winAccountBtn'),show=!!button&&!getProfile()?.token&&!!currentGame?.finished&&currentGame.mode!=='rescue'&&currentGame.mode!=='starter';",
"function updateWinAccountCta(){const button=$('#winAccountBtn'),show=!!button&&!getProfile()?.token&&!!currentGame?.finished&&currentGame.mode!=='rescue'&&currentGame.mode!=='starter'&&!currentGame?.postStarterWarmup;",
'win account CTA warmup suppression')
app = one(app,
"function renderWinFeedback(){\n const g=currentGame,show=!!g?.finished&&g.mode!=='rescue';",
"function renderWinFeedback(){\n const g=currentGame,show=!!g?.finished&&g.mode!=='rescue'&&!g.postStarterWarmup;",
'warmup feedback suppression')

old_action = """function performPostWinAction(action){
 const mode=currentGame?.mode,diff=currentGame?.puzzle?.difficulty;
 if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}startDaily();return}
 if(action==='continue'){if(mode==='free'&&currentGame?.contentBatchId){continueLatestContent();return}if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}
 nav(mode==='daily'||mode==='rescue'?'daily':'free',{replace:currentScreen==='game'});
}
"""
new_action = """function performPostWinAction(action){
 const mode=currentGame?.mode,diff=currentGame?.puzzle?.difficulty;
 if(mode==='starter'){
  if(currentGame?.starterNextHard){if(action==='menu'){trackProductEvent('starter_hard_direct_selected');startDaily({starterHardDirect:true});return}trackProductEvent('starter_easy_warmup_selected');startStarterWarmup();return}
  if(action==='menu'){nav('free',{replace:true});return}startDaily();return
 }
 if(mode==='free'&&currentGame?.postStarterWarmup){if(action==='continue'){startDaily();return}nav('free',{replace:true});return}
 if(action==='continue'){if(mode==='free'&&currentGame?.contentBatchId){continueLatestContent();return}if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}
 nav(mode==='daily'||mode==='rescue'?'daily':'free',{replace:currentScreen==='game'});
}
"""
app = one(app, old_action, new_action, 'post-win onboarding routing')

# Warm-up completion gets a focused hand-off to Daily instead of the normal Free-game loop.
app = one(app,
"$('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';renderCompletionPraise(g.puzzle.difficulty,rec);const levelSuffix=",
"$('#winBadge').textContent=g.mode==='daily'?(newBadge?.icon||'☀️'):'✦';renderCompletionPraise(g.puzzle.difficulty,rec);if(g.postStarterWarmup){trackProductEvent('starter_easy_warmup_completed');$('#winTitle').textContent='Paráda. Teď už jsi rozehřátý.';}const levelSuffix=",
'warmup completion title')
app = one(app,
"configureWinReplay(g.mode,g.dailyDate,rec);$('#winShareBtn').classList.remove('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=g.mode==='daily'?'← Dnes':'← Menu';$('#winPrimaryBtn').textContent=g.mode==='daily'?'Vybrat další hru':g.mode==='free'&&g.contentBatchId?(latestContentUnplayed().length?'Hrát další nový':'Zpět k Volné hře'):'Hraj další úroveň';",
"configureWinReplay(g.mode,g.dailyDate,rec);$('#winShareBtn').classList.toggle('hidden',!!g.postStarterWarmup);$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=g.postStarterWarmup?'Zůstat ve Volné hře':g.mode==='daily'?'← Dnes':'← Menu';$('#winPrimaryBtn').textContent=g.postStarterWarmup?'☀️ Jdu na dnešní výzvu':g.mode==='daily'?'Vybrat další hru':g.mode==='free'&&g.contentBatchId?(latestContentUnplayed().length?'Hrát další nový':'Zpět k Volné hře'):'Hraj další úroveň';",
'warmup completion buttons')
app = one(app,
"if(g.mode==='free'){\n if(getProfile()?.token){syncQueue({announce:false}).then(r=>{if(r.ok)return loadWinLevelLeaderboard(g.puzzle,rec);",
"if(g.mode==='free'&&!g.postStarterWarmup){\n if(getProfile()?.token){syncQueue({announce:false}).then(r=>{if(r.ok)return loadWinLevelLeaderboard(g.puzzle,rec);",
'warmup leaderboard suppression')

css_marker = '/* v3.31.4 preview — protect first real session when Daily is Hard. */'
if css_marker in css:
    raise SystemExit('preview CSS already present')
css += r'''

/* v3.31.4 preview — protect first real session when Daily is Hard. */
.starter-win .starter-hard-choice{margin-top:8px;border:1px solid #efd6c9;background:linear-gradient(135deg,#fff8f3,#fff4ed)}
.starter-win .starter-hard-choice>.emoji{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#ffe4d7;font-size:21px}
.starter-win .starter-hard-choice strong{color:#873f2d}.starter-win .starter-hard-choice small{line-height:1.35}
html[data-theme="dark"] .starter-win .starter-hard-choice{border-color:#65483e;background:linear-gradient(135deg,#342925,#302521)}
html[data-theme="dark"] .starter-win .starter-hard-choice>.emoji{background:#51352b}html[data-theme="dark"] .starter-win .starter-hard-choice strong{color:#ffc7b4}
'''

app_path.write_text(app, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('v3.31.4 preview patch applied')
