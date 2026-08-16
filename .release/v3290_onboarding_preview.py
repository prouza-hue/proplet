from pathlib import Path
import re

APP = Path('public/app.js')
CSS = Path('public/styles.css')
SW = Path('public/sw.js')
SERVER = Path('server.py')

app = APP.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')
server = SERVER.read_text(encoding='utf-8')

# Preview version only. Production stays untouched until approval.
app, n = re.subn(r"const APP_VERSION='3\.28\.2';", "const APP_VERSION='3.29.0-preview.1';", app, count=1)
assert n == 1, 'APP_VERSION client anchor missing'
server, n = re.subn(r'APP_VERSION = "3\.28\.2"', 'APP_VERSION = "3.29.0-preview.1"', server, count=1)
assert n == 1, 'APP_VERSION server anchor missing'
sw, n = re.subn(r"const CACHE='proplet-v3\.28\.2-played-title-text-only';", "const CACHE='proplet-v3.29.0-preview.1-onboarding-modes';", sw, count=1)
assert n == 1, 'service worker cache anchor missing'

start = app.index('const ONBOARD_STEPS=[')
end = app.index('\n];\n\nfunction openOnboarding', start) + len('\n];')
new_steps = r'''const ONBOARD_STEPS=[
 {title:'Co je Proplet',intro:true,cta:'Ukázat mi, jak se hraje',html:()=>`<div class="onboard-content onboard-game-intro"><span class="eyebrow">VÍTEJ V PROPLETU</span><h2>Spojuj písmena do slov</h2><p class="muted">Hledej cesty přes sousední políčka a poskládej slova tak, aby nakonec zaplnila celou mřížku.</p><div class="onboard-game-modes"><div class="onboard-mode-card daily"><div class="onboard-mode-mark daily-mark" aria-hidden="true">☀</div><div><span class="eyebrow">DENNÍ VÝZVA</span><strong>Každý den nový Proplet</strong><small>Jedna nová úroveň pro všechny hráče.</small></div></div><div class="onboard-mode-card free"><div class="onboard-free-icons" aria-hidden="true">${difficultyIconMarkup('easy','onboard-diff-icon')}${difficultyIconMarkup('medium','onboard-diff-icon')}${difficultyIconMarkup('hard','onboard-diff-icon')}${difficultyIconMarkup('hardcore','onboard-diff-icon')}</div><div><span class="eyebrow">VOLNÁ HRA</span><strong>Stovky dalších úrovní</strong><small>Čtyři obtížnosti. Hraj kdykoli a vlastním tempem.</small></div></div></div><p class="onboard-intro-note">Nejdřív si během chvilky ukážeme, jak na to.</p></div>`},
 {title:'Najdi PES',interactive:true,html:`<div class="onboard-content"><span class="eyebrow">ZAČNI ROVNOU HRÁT</span><h2>Najdi PES</h2><p class="muted">Táhni přes <b>P → E → S</b>. Jen přes políčka vedle sebe.</p><div class="tutorial-wrap"><div id="tutorialBoard" class="tutorial-board"><div class="tutorial-cell" data-tidx="0">P</div><div class="tutorial-cell" data-tidx="1">E</div><div class="tutorial-cell" data-tidx="2">L</div><div class="tutorial-cell" data-tidx="3">A</div><div class="tutorial-cell" data-tidx="4">S</div><div class="tutorial-cell" data-tidx="5">K</div><div class="tutorial-cell" data-tidx="6">M</div><div class="tutorial-cell" data-tidx="7">O</div><div class="tutorial-cell" data-tidx="8">C</div></div><div id="tutorialSuccess" class="tutorial-success"></div></div></div>`},
 {title:'Propleť všechno',html:`<div class="onboard-content"><span class="eyebrow">CELÝ PRINCIP HRY</span><h2>Propleť úplně všechno</h2><div class="onboard-fill-demo" aria-label="Tři správná slova PES, LES a MOC vyplňují celou plochu"><span style="--d:0;--c:#ff9585">P</span><span style="--d:1;--c:#ff9585">E</span><span style="--d:2;--c:#ff9585">S</span><span style="--d:3;--c:#68cfaa">L</span><span style="--d:4;--c:#68cfaa">E</span><span style="--d:5;--c:#68cfaa">S</span><span style="--d:6;--c:#7ca8ff">M</span><span style="--d:7;--c:#7ca8ff">O</span><span style="--d:8;--c:#7ca8ff">C</span></div><p class="muted"><b>Každé políčko patří právě jednomu slovu.</b> Hotovo je, až nezůstane žádné volné.</p><div class="onboard-mini-rules"><span>↕️ ↔️ Bez diagonál</span><span>🎨 Celá plocha</span></div></div>`},
 {title:'Pomocník',support:true,html:()=>`<div class="onboard-content"><span class="eyebrow">POMOC, KDYŽ JI CHCEŠ</span><h2>Kdy ti má Pomocník nabídnout nápovědu?</h2><p class="muted">Když se chvíli nic nového nepodaří, jen nabídne malé postrčení. <b>Bez tvého souhlasu nic neodhalí.</b></p><div class="support-choice-grid onboard-support-grid" aria-label="Čas nabídky Pomocníka">${supportChoicesHtml('onboard')}</div><div id="onboardSupportOutcome" class="support-outcome" aria-live="polite">Vyber si tempo.</div></div>`}
];'''
app = app[:start] + new_steps + app[end:]

old_button = "$('#onboardNextBtn').textContent=step.support?(onboardingSupportMode?(onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩'):'Nejdřív vyber možnost'):(waitingTutorial?'Nejdřív najdi PES':'Pokračovat');"
new_button = "$('#onboardNextBtn').textContent=step.support?(onboardingSupportMode?(onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩'):'Nejdřív vyber možnost'):(waitingTutorial?'Nejdřív najdi PES':(step.cta||'Pokračovat'));"
assert old_button in app, 'onboarding CTA anchor missing'
app = app.replace(old_button, new_button, 1)

old_action = "if(mode==='starter'){nav('daily',{replace:true});showStarterDailyNudge();return}"
new_action = "if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}nav('daily',{replace:true});showStarterDailyNudge();return}"
assert old_action in app, 'starter post-win action anchor missing'
app = app.replace(old_action, new_action, 1)

old_finish = "$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent='Teď na dnešní výzvu ☀️';"
new_finish = "$('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️';"
assert old_finish in app, 'starter win actions anchor missing'
app = app.replace(old_finish, new_finish, 1)

css_add = r'''

/* v3.29 preview — onboarding explains the two ways to play before teaching controls. */
.onboard-game-intro>p.muted{max-width:370px;margin-bottom:13px}
.onboard-game-modes{display:grid;gap:8px;margin:12px 0 10px;text-align:left}
.onboard-mode-card{display:grid;grid-template-columns:54px minmax(0,1fr);gap:11px;align-items:center;padding:11px 12px;border:1px solid #e5deed;border-radius:16px;background:#f8f6fb}
.onboard-mode-card.daily{background:linear-gradient(145deg,#f2efff,#f7f4ff);border-color:#ddd5f5}
.onboard-mode-card.free{background:linear-gradient(145deg,#f5fbf8,#f8f6fb);border-color:#d9ebe4}
.onboard-mode-card strong,.onboard-mode-card small{display:block}.onboard-mode-card strong{margin-top:2px;font-size:13px;line-height:1.2}.onboard-mode-card small{margin-top:3px;color:var(--muted);font-size:11px;line-height:1.3}
.onboard-mode-mark{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:#e9e3ff;color:#6557d1;font-size:26px;font-weight:900}
.onboard-free-icons{width:50px;height:50px;position:relative}
.onboard-diff-icon{position:absolute;width:27px;height:27px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(42,34,72,.08))}.onboard-diff-icon:nth-child(1){left:0;top:0}.onboard-diff-icon:nth-child(2){right:0;top:0}.onboard-diff-icon:nth-child(3){left:0;bottom:0}.onboard-diff-icon:nth-child(4){right:0;bottom:0}
.onboard-intro-note{margin:4px auto 14px!important;color:#615b72!important;font-size:11px!important;font-weight:850}
#winModal.starter-win #winMenuBtn{display:block;margin-top:7px}
html[data-theme="dark"] .onboard-mode-card{background:#24212f;border-color:#403a4d}html[data-theme="dark"] .onboard-mode-card.daily{background:linear-gradient(145deg,#29243e,#24212f);border-color:#453d61}html[data-theme="dark"] .onboard-mode-card.free{background:linear-gradient(145deg,#1e332d,#24212f);border-color:#365247}html[data-theme="dark"] .onboard-mode-mark{background:#302a52;color:#c8c0ff}html[data-theme="dark"] .onboard-intro-note{color:#b9b1c5!important}
@media(max-width:340px){.onboard-mode-card{grid-template-columns:46px minmax(0,1fr);gap:8px;padding:9px 10px}.onboard-mode-mark{width:40px;height:40px;font-size:23px}.onboard-free-icons{width:43px;height:43px}.onboard-diff-icon{width:24px;height:24px}.onboard-mode-card strong{font-size:12px}.onboard-mode-card small{font-size:10px}}
'''
assert 'v3.29 preview — onboarding explains the two ways to play' not in css
css += css_add

APP.write_text(app, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
SW.write_text(sw, encoding='utf-8')
SERVER.write_text(server, encoding='utf-8')

# Static invariants for the preview.
assert "title:'Co je Proplet'" in app
assert 'Každý den nový Proplet' in app
assert 'Stovky dalších úrovní' in app
assert 'VOLNÁ HRA' in app
assert "step.cta||'Pokračovat'" in app
assert "action==='menu'" in app and "nav('free',{replace:true})" in app
assert "$('#winMenuBtn').classList.remove('hidden')" in app
assert "$('#winMenuBtn').textContent='Vybrat volnou hru'" in app
assert "$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️'" in app
assert "3.29.0-preview.1" in app and "3.29.0-preview.1" in server
assert 'proplet-v3.29.0-preview.1-onboarding-modes' in sw
print('v3.29.0-preview.1 onboarding patch applied')
