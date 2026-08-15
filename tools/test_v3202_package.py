#!/usr/bin/env python3
from pathlib import Path
import re, json, sys, hashlib
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
required=['server.py','public/app.js','public/index.html','public/styles.css','public/sw.js','UPDATE_V3_20_2_CZ.md','RELEASE_V3_20_2_CZ.md','QA_V3_20_2_CZ.md','data/puzzles.json','public/puzzles.json']
for f in required: assert (ROOT/f).is_file(), f
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text()
assert 'version="3.20.2-cloud"' in server and '"version": "3.20.2"' in server
assert "const APP_VERSION='3.20.2'" in app and 'Proplet v3.20.2' in html and 'proplet-v3.20.2-ux-hotfix' in sw
# Landscape guard: phone-only, active unfinished game only, with pause/resume.
assert 'id="landscapeGameBlocker"' in html and 'Otoč telefon na výšku' in html
assert 'function isPhoneLikeDevice()' in app and 'function shouldBlockPhoneLandscape(' in app and 'function updateLandscapeGameBlocker()' in app
assert "pauseGameClock('landscape')" in app and "currentGame?.pauseReason==='landscape'" in app and 'resumeGameClock()' in app
assert "window.addEventListener('orientationchange'" in app and "window.visualViewport?.addEventListener?.('resize'" in app
assert 'body.landscape-game-blocked .landscape-game-blocker{display:flex}' in css
assert 'body.landscape-game-blocked #screen-game{visibility:hidden;pointer-events:none}' in css
# v3.20.1 UX fixes remain present.
whole=re.search(r"\{title:'Propleť všechno',html:`(.*?)`\},",app,re.S); assert whole
letters=re.findall(r'<span style="--d:\d+;--c:[^"]+">([^<]+)</span>',whole.group(1)); assert letters==list('PESLESMOC'),letters
assert 'id="winAccountBtn"' in html and 'Uložit postup a zobrazit své místo' in html
assert 'ACCOUNT_NUDGE_THRESHOLDS=[1,4,10]' in app
# Bind/HTML contract.
assert html.rstrip().endswith('</html>') and '<script src="/app.js"></script>' in html
ids=set(re.findall(r'id=["\']([^"\']+)',html)); m=re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot",app,re.S); assert m
bound=set(re.findall(r"\$\('#([^']+)'\)",m.group(1))); assert not (bound-ids), sorted(bound-ids)
# Puzzle bank untouched.
assert (ROOT/'public/puzzles.json').read_bytes()==(ROOT/'data/puzzles.json').read_bytes()
puzzles=json.loads((ROOT/'data/puzzles.json').read_text()); assert puzzles.get('freeLevelsPerDifficulty')==200
h=hashlib.sha256((ROOT/'data/puzzles.json').read_bytes()).hexdigest(); assert h=='1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84',h
print('PASS: v3.20.2 package, phone landscape guard and untouched puzzle bank')
