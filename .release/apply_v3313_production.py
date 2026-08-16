from pathlib import Path

root = Path(__file__).resolve().parents[1]
app_path = root / 'public' / 'app.js'
index_path = root / 'public' / 'index.html'
css_path = root / 'public' / 'styles.css'
sw_path = root / 'public' / 'sw.js'
server_path = root / 'server.py'

app = app_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
server = server_path.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {n}')
    return text.replace(old, new, 1)

# Production version bump.
app = replace_once(app, "const APP_VERSION='3.30.0';", "const APP_VERSION='3.31.3';", 'app version')
server = replace_once(server, 'APP_VERSION = "3.30.0"', 'APP_VERSION = "3.31.3"', 'server version')
sw = replace_once(sw, "const CACHE='proplet-v3.30.0-rolling-content';", "const CACHE='proplet-v3.31.3-onboarding-polish';", 'sw cache')

# 1) Remove the passive onboarding screen. The same rule is taught in the starter itself.
old_fill_step = " {title:'Propleť všechno',html:`<div class=\"onboard-content\"><span class=\"eyebrow\">CELÝ PRINCIP HRY</span><h2>Propleť úplně všechno</h2><div class=\"onboard-fill-demo\" aria-label=\"Tři správná slova PES, LES a MOC vyplňují celou plochu\"><span style=\"--d:0;--c:#ff9585\">P</span><span style=\"--d:1;--c:#ff9585\">E</span><span style=\"--d:2;--c:#ff9585\">S</span><span style=\"--d:3;--c:#68cfaa\">L</span><span style=\"--d:4;--c:#68cfaa\">E</span><span style=\"--d:5;--c:#68cfaa\">S</span><span style=\"--d:6;--c:#7ca8ff\">M</span><span style=\"--d:7;--c:#7ca8ff\">O</span><span style=\"--d:8;--c:#7ca8ff\">C</span></div><p class=\"muted\"><b>Každé políčko patří právě jednomu slovu.</b> Hotovo je, až nezůstane žádné volné.</p><div class=\"onboard-mini-rules\"><span>↕️ ↔️ Bez diagonál</span><span>🎨 Celá plocha</span></div></div>`},\n"
app = replace_once(app, old_fill_step, '', 'remove fill onboarding step')

# 2) Put starter guidance in a strong coach panel above the board.
old_start = "$('#timer').textContent=mode==='rescue'?fmtCountdown(remaining):fmtTime(baseElapsedMs);message(restored?'Pokračuješ přesně tam, kde jsi skončil.':mode==='starter'?'Začni slovem MRAK. Jemná stopa ti ukáže první tah.':'Propleť všechna políčka. Slova můžou zatáčet.');nav('game');renderGameBoard();renderGameHUD();updateGameFeel();if(mode==='starter'){trackProductEvent('starter_started');updateStarterGuidance()}"
new_start = "$('#timer').textContent=mode==='rescue'?fmtCountdown(remaining):fmtTime(baseElapsedMs);message(restored?'Pokračuješ přesně tam, kde jsi skončil.':mode==='starter'?'':'Propleť všechna políčka. Slova můžou zatáčet.');$('#starterCoach')?.classList.toggle('hidden',mode!=='starter');nav('game');renderGameBoard();renderGameHUD();updateGameFeel();if(mode==='starter'){trackProductEvent('starter_started');updateStarterGuidance()}"
app = replace_once(app, old_start, new_start, 'starter start message')

old_guidance = """function updateStarterGuidance(){
 const g=currentGame;if(!g||g.mode!=='starter')return;g.starterGuidePath=starterGuideFor(g);
 if(g.found.length===0)message('Začni slovem MRAK. Stopu můžeš jednoduše obtáhnout.');
 else if(g.found.length===1)message('Čísla nahoře jsou délky zbývajících slov. JABLKO má 6 a zahne za roh.','good');
 else if(g.found.length===2)message('Teď najdi ČOKOLÁDU. Kdybys chtěl malé postrčení, Nápověda je pořád po ruce.');
 else if(g.found.length===3){hideStarterHintNudge();message('Poslední je AUTOBUS. Zbylá políčka se stáčí do šneka 🐌','good');}
 renderGameBoard();renderGameHUD();updateGameFeel();
}
"""
new_guidance = """function renderStarterCoach(step,title,copy,hintFocus=false){
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
"""
app = replace_once(app, old_guidance, new_guidance, 'starter guidance')

board_marker = '          <div id="boardStage" class="board-stage card">\n'
coach_markup = '''          <div id="starterCoach" class="starter-coach hidden" role="status" aria-live="polite">
            <div id="starterCoachStep" class="starter-coach-step">1 / 4</div>
            <div class="starter-coach-copy"><strong id="starterCoachTitle">Začni slovem MRAK</strong><span id="starterCoachCopy">Táhni přes sousední písmena.</span></div>
          </div>

'''
index = replace_once(index, board_marker, coach_markup + board_marker, 'starter coach markup')

css_append = r'''

/* v3.31 — starter coach: instructions must win the visual hierarchy. */
.starter-mode .game-board-column{grid-template-rows:auto auto auto minmax(0,1fr)}
.starter-mode .game-board-column>.starter-coach{grid-row:3}
.starter-mode .game-board-column>.board-stage{grid-row:4}
.starter-coach{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:9px 11px;border:2px solid #9b8df2;border-radius:15px;background:linear-gradient(135deg,#f1edff,#f8f6ff);box-shadow:0 7px 18px rgba(79,62,153,.13);color:#3e376d}
.starter-coach.hidden{display:none!important}
.starter-coach:after{content:"";position:absolute;left:28px;bottom:-7px;width:11px;height:11px;background:#f5f2ff;border-right:2px solid #9b8df2;border-bottom:2px solid #9b8df2;transform:rotate(45deg)}
.starter-coach-step{min-width:46px;padding:6px 7px;border-radius:11px;background:#6c5ce7;color:white;text-align:center;font-size:11px;font-weight:1000;letter-spacing:.03em;box-shadow:0 4px 10px rgba(108,92,231,.22)}
.starter-coach-copy{min-width:0}.starter-coach-copy strong,.starter-coach-copy span{display:block}.starter-coach-copy strong{font-size:14px;line-height:1.15;color:#322b67}.starter-coach-copy span{margin-top:2px;font-size:12px;line-height:1.3;color:#665f7b;font-weight:700}
.starter-coach.hint-focus{border-color:#725fe4;box-shadow:0 0 0 4px rgba(108,92,231,.09),0 8px 20px rgba(79,62,153,.15)}
.starter-mode .game-control-column .game-actions .secondary-btn{min-height:42px;border-width:2px;font-size:12px;font-weight:950;box-shadow:0 4px 12px rgba(55,43,93,.08)}
.starter-mode #hintBtn{background:#eee9ff;border-color:#8b7bea;color:#4f40ba}
.starter-mode #resetBtn{background:#fff;border-color:#c9c1d8;color:#4f495d}
.starter-mode .game-control-column .game-message{font-size:11px;font-weight:800;color:#625b72}
@keyframes starterHintAttentionStrong{0%,100%{transform:translateY(0);box-shadow:0 0 0 3px rgba(108,92,231,.11),0 5px 13px rgba(73,56,150,.10)}50%{transform:translateY(-2px);box-shadow:0 0 0 7px rgba(108,92,231,.15),0 8px 18px rgba(73,56,150,.16)}}
.starter-mode #hintBtn.starter-attention{animation:starterHintAttentionStrong 1.15s ease-in-out infinite;background:#ddd5ff;border-color:#6856dc;color:#392aa9}
@media(max-height:650px){.starter-coach{padding:6px 8px;gap:7px;border-radius:12px}.starter-coach-step{min-width:40px;padding:5px;font-size:9px}.starter-coach-copy strong{font-size:12px}.starter-coach-copy span{font-size:10.5px;line-height:1.2}.starter-mode .game-board-column{gap:3px}.starter-mode .game-control-column .game-actions .secondary-btn{min-height:34px;font-size:11px}}
@media(prefers-reduced-motion:reduce){.starter-mode #hintBtn.starter-attention{animation:none!important}}
html[data-theme="dark"] .starter-coach{background:linear-gradient(135deg,#30294d,#28243c);border-color:#8f80ef;box-shadow:0 8px 20px rgba(0,0,0,.3);color:#eeeaff}
html[data-theme="dark"] .starter-coach:after{background:#2b2743;border-color:#8f80ef}
html[data-theme="dark"] .starter-coach-step{background:#8f80ef;color:#181522;box-shadow:0 4px 12px rgba(0,0,0,.28)}
html[data-theme="dark"] .starter-coach-copy strong{color:#f3f0ff}html[data-theme="dark"] .starter-coach-copy span{color:#d0c9df}
html[data-theme="dark"] .starter-coach.hint-focus{border-color:#aa9cff;box-shadow:0 0 0 4px rgba(155,140,255,.13),0 8px 22px rgba(0,0,0,.34)}
html[data-theme="dark"] .starter-mode #hintBtn{background:#40365f;border-color:#a092ef;color:#f0ecff}
html[data-theme="dark"] .starter-mode #resetBtn{background:#292630;border-color:#625b70;color:#e0dae7}
html[data-theme="dark"] .starter-mode #hintBtn.starter-attention{background:#54458a;border-color:#c2b7ff;color:white;box-shadow:0 0 0 5px rgba(170,156,255,.14)}
html[data-theme="dark"] .starter-mode .game-control-column .game-message{color:#cbc4d2}
'''
if 'v3.31 — starter coach' in css or 'v3.31 preview — starter coach' in css:
    raise SystemExit('starter coach css already present')
css += css_append

# 3) First SW claim must not reload a brand-new visitor. Reload only after explicit update click.
app = replace_once(app, "let pendingSW=null;", "let pendingSW=null;\nlet reloadOnServiceWorkerChange=false;", 'sw reload state')
old_register = "let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});"
new_register = "let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloadOnServiceWorkerChange||reloading)return;reloading=true;location.reload()});"
app = replace_once(app, old_register, new_register, 'controllerchange gate')
old_click = "$('#applyUpdateBtn').onclick=()=>pendingSW?.postMessage({type:'SKIP_WAITING'});"
new_click = "$('#applyUpdateBtn').onclick=()=>{if(!pendingSW)return;reloadOnServiceWorkerChange=true;pendingSW.postMessage({type:'SKIP_WAITING'})};"
app = replace_once(app, old_click, new_click, 'explicit update reload')
old_boot = "renderDaily();renderFree();renderProfile();renderInstallUI();refreshRollingContent().catch(()=>{});syncQueue({announce:false});refreshRescueStatus();setTimeout(()=>openOnboarding(false),260);\n registerServiceWorker();"
new_boot = "renderDaily();renderFree();renderProfile();renderInstallUI();const initialRollingContent=refreshRollingContent().catch(()=>null);syncQueue({announce:false});refreshRescueStatus();initialRollingContent.finally(()=>setTimeout(()=>openOnboarding(false),80));\n registerServiceWorker();"
app = replace_once(app, old_boot, new_boot, 'onboarding after content')

# 4) Starter CTA promises Daily, so enter the Daily board directly.
old_action = "if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}nav('daily',{replace:true});showStarterDailyNudge();return}"
new_action = "if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}startDaily();return}"
app = replace_once(app, old_action, new_action, 'starter primary action')

# 5) Difficulty icon is now an SVG path; never render that path as text in level detail.
old_title = "$('#levelDetailTitle').textContent=`${DIFF[diff].icon} ${DIFF[diff].label} ${puzzle.meta?.level||''}`;"
new_title = "$('#levelDetailTitle').textContent=`${DIFF[diff].label} ${puzzle.meta?.level||''}`.trim();"
app = replace_once(app, old_title, new_title, 'level detail title')

app_path.write_text(app, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('v3.31.3 production patch applied')
