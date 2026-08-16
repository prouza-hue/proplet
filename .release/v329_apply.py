from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

app_path = Path('public/app.js')
styles_path = Path('public/styles.css')
sw_path = Path('public/sw.js')
server_path = Path('server.py')

app = app_path.read_text()
styles = styles_path.read_text()
sw = sw_path.read_text()
server = server_path.read_text()

# Release version.
app = replace_once(app, "const APP_VERSION='3.28.3';", "const APP_VERSION='3.29.0';", 'app version')
server = replace_once(server, 'APP_VERSION = "3.28.3"', 'APP_VERSION = "3.29.0"', 'server version')
sw = replace_once(sw, "const CACHE='proplet-v3.28.3-fast-puzzle-boot';", "const CACHE='proplet-v3.29.0-onboarding-fast-boot';", 'service worker cache')

# Starter completion: explicitly offer Daily and Free.
old_finish = " $('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.add('hidden');$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent='Teď na dnešní výzvu ☀️';$('#winModal').classList.add('starter-win');$('#winModal').classList.remove('hidden');confetti();fx('win');renderDaily();renderFree();renderProfile();"
new_finish = " $('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent='Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️';$('#winModal').classList.add('starter-win');$('#winModal').classList.remove('hidden');confetti();fx('win');renderDaily();renderFree();renderProfile();"
app = replace_once(app, old_finish, new_finish, 'starter completion actions')

old_action = " if(mode==='starter'){nav('daily',{replace:true});showStarterDailyNudge();return}"
new_action = " if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}nav('daily',{replace:true});showStarterDailyNudge();return}"
app = replace_once(app, old_action, new_action, 'starter post-win routing')

# First onboarding screen: approved preview copy.
marker = "const ONBOARD_STEPS=[\n"
intro = " {title:'Co je Proplet',intro:true,cta:'Jak hrát',html:()=>`<div class=\"onboard-content onboard-game-intro\"><h2>Spojuj písmena do slov</h2><p class=\"muted\">Hledej cesty přes sousední políčka a poskládej slova tak, aby nakonec zaplnila celou mřížku.</p><div class=\"onboard-game-modes\"><div class=\"onboard-mode-card daily\"><div class=\"onboard-mode-mark daily-mark\" aria-hidden=\"true\">☀</div><div><span class=\"eyebrow\">DENNÍ VÝZVA</span><strong>Každý den nový Proplet</strong><small>Jedna nová úroveň pro všechny hráče.</small></div></div><div class=\"onboard-mode-card free\"><div class=\"onboard-free-icons\" aria-hidden=\"true\">${difficultyIconMarkup('easy','onboard-diff-icon')}${difficultyIconMarkup('medium','onboard-diff-icon')}${difficultyIconMarkup('hard','onboard-diff-icon')}${difficultyIconMarkup('hardcore','onboard-diff-icon')}</div><div><span class=\"eyebrow\">VOLNÁ HRA</span><strong>Stovky dalších úrovní</strong><small>Čtyři obtížnosti. Hraj kdykoli a vlastním tempem.</small></div></div></div><p class=\"onboard-intro-note\">Nejdřív si během chvilky ukážeme, jak na to.</p></div>`},\n"
app = replace_once(app, marker, marker + intro, 'onboarding intro insertion')

old_cta = " $('#onboardNextBtn').textContent=step.support?(onboardingSupportMode?(onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩'):'Nejdřív vyber možnost'):(waitingTutorial?'Nejdřív najdi PES':'Pokračovat');"
new_cta = " $('#onboardNextBtn').textContent=step.support?(onboardingSupportMode?(onboardingFocusedHelper?'Uložit a pokračovat':'Jdu na první Proplet 🧩'):'Nejdřív vyber možnost'):(waitingTutorial?'Nejdřív najdi PES':(step.cta||'Pokračovat'));"
app = replace_once(app, old_cta, new_cta, 'onboarding CTA')

css_marker = "/* v3.29 — onboarding explains Daily and Free before teaching controls. */"
if css_marker in styles:
    raise SystemExit('onboarding CSS unexpectedly already present')
styles += """

/* v3.29 — onboarding explains Daily and Free before teaching controls. */
.onboard-game-intro>p.muted{max-width:370px;margin-bottom:13px}
.onboard-game-modes{display:grid;gap:8px;margin:12px 0 10px;text-align:left}
.onboard-mode-card{display:grid;grid-template-columns:54px minmax(0,1fr);gap:11px;align-items:center;padding:11px 12px;border:1px solid #e5deed;border-radius:16px;background:#f8f6fb}
.onboard-mode-card.daily{background:linear-gradient(145deg,#f2efff,#f7f4ff);border-color:#ddd5f5}
.onboard-mode-card.free{background:linear-gradient(145deg,#f5fbf8,#f8f6fb);border-color:#d9ebe4}
.onboard-mode-card strong,.onboard-mode-card small{display:block}.onboard-mode-card strong{margin-top:2px;font-size:13px;line-height:1.2}.onboard-mode-card small{margin-top:3px;color:var(--muted);font-size:11px;line-height:1.3}
.onboard-mode-mark{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:25px;font-weight:800;background:#ebe5ff;color:#6959df;box-shadow:inset 0 0 0 1px #ddd4ff}
.onboard-free-icons{width:50px;display:grid;grid-template-columns:repeat(2,23px);gap:2px;place-content:center}
.onboard-diff-icon{display:block;width:23px;height:23px;object-fit:contain}
.onboard-intro-note{margin:8px 0 0;text-align:center;color:var(--muted);font-size:11px;font-weight:700}
html[data-theme="dark"] .onboard-mode-card{background:#292631;border-color:#403a49}
html[data-theme="dark"] .onboard-mode-card.daily{background:linear-gradient(145deg,#28243b,#2c2935);border-color:#473f62}
html[data-theme="dark"] .onboard-mode-card.free{background:linear-gradient(145deg,#24322e,#292631);border-color:#365047}
html[data-theme="dark"] .onboard-mode-mark{background:#39324f;color:#b8abff;box-shadow:inset 0 0 0 1px #4b4267}
@media(max-width:390px){.onboard-mode-card{grid-template-columns:48px minmax(0,1fr);padding:10px}.onboard-mode-mark{width:42px;height:42px}.onboard-free-icons{width:44px;grid-template-columns:repeat(2,21px)}.onboard-diff-icon{width:21px;height:21px}}
"""

app_path.write_text(app)
styles_path.write_text(styles)
sw_path.write_text(sw)
server_path.write_text(server)
