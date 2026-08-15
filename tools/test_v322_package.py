#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
required=['server.py','public/app.js','public/index.html','public/styles.css','public/admin.html','public/admin.css','public/sw.js','public/manifest.webmanifest','data/puzzles.json','public/puzzles.json','SUPABASE_MIGRATION_V3_21.sql']
for f in required: assert (ROOT/f).exists(), f
server=(ROOT/'server.py').read_text();app=(ROOT/'public/app.js').read_text();html=(ROOT/'public/index.html').read_text();css=(ROOT/'public/styles.css').read_text();admin_html=(ROOT/'public/admin.html').read_text();admin_css=(ROOT/'public/admin.css').read_text();sw=(ROOT/'public/sw.js').read_text();manifest=json.loads((ROOT/'public/manifest.webmanifest').read_text())
assert 'version="3.22.0-cloud"' in server and '"version": "3.22.0"' in server
assert "const APP_VERSION='3.22.0'" in app and 'Proplet v3.22.0' in html and 'proplet-v3.22.0-night-mode' in sw
for token in ['darkModeSprint','themeModes','themePreferenceScope']:
    assert token in server, token
assert manifest['background_color']=='#17151f'
# Theme control and no-flash initialization.
for mode in ('auto','light','dark'):
    assert f'data-theme-mode="{mode}"' in html
for token in ["proplet-v3-settings","prefers-color-scheme: dark","meta[name=\"theme-color\"]","data-theme=\"dark\""]:
    assert token in html+app+css, token
for token in ['normalizeThemeMode','resolvedTheme','applyTheme','renderThemeSettings','THEME_COLORS','themeModeNote']:
    assert token in app+html, token
assert "window.addEventListener('storage'" in app
assert "colorSchemeQuery?.addEventListener?.('change'" in app
assert 'preference je lokální' not in html  # UI explains naturally, implementation wording stays out.
# Dark mode has bespoke game surfaces, not a blanket filter/invert.
assert 'filter:invert' not in css.replace(' ','').lower()
for token in ['--surface:#1b1926','.cell.used','.board-stage.near-complete','.cell.wrong-flash','.win-clean','.support-choice','.bottom-nav','.daily-hero','.theme-segment']:
    assert token in css, token
assert 'onboardFillDark' in css and 'pulseDark' in css
# Admin follows the same device preference.
assert 'proplet-v3-settings' in admin_html and 'data-theme="dark"' in admin_css
# DOM bind contract.
ids=set(re.findall(r'id=["\']([^"\']+)',html));m=re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot",app,re.S);assert m
bound=set(re.findall(r"\$\('#([^']+)'\)",m.group(1)));assert not (bound-ids),sorted(bound-ids)
# Preserve all v3.21 game-feel and Fold safety behavior.
for token in ["mode==='starter'",'maybeOfferStarterHint','starterHintNudge','wrongPath','word.length<4','undoSnapshot','board-complete','ResizeObserver','orientationchange','visualViewport']:
    assert token in app+css, token
for token in ['landscapeGameBlocker','Otoč telefon na výšku','shouldBlockPhoneLandscape',"pauseGameClock('landscape')"]:
    assert token not in app+html+css, token
assert '"orientationBlocking": False' in server and '"foldResponsiveReflow": True' in server
# Puzzle content and v3.21 migration are byte-identical to v3.21.3.
EXPECTED_PUZZLE='ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23'
EXPECTED_SQL='739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3'
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
assert sha('data/puzzles.json')==EXPECTED_PUZZLE
assert sha('public/puzzles.json')==EXPECTED_PUZZLE
assert sha('SUPABASE_MIGRATION_V3_21.sql')==EXPECTED_SQL
# No new SQL migration exists for visual-only v3.22.
assert not (ROOT/'SUPABASE_MIGRATION_V3_22.sql').exists()
print('PASS: v3.22 package, theme system, dark game surfaces, admin theme, Fold safety and immutable puzzle content')
