#!/usr/bin/env python3
from pathlib import Path
import re, json, sys, hashlib
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
required=['server.py','public/app.js','public/index.html','public/styles.css','public/sw.js','UPDATE_V3_20_1_CZ.md','RELEASE_V3_20_1_CZ.md','QA_V3_20_1_CZ.md','data/puzzles.json','public/puzzles.json']
for f in required: assert (ROOT/f).is_file(), f
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text()
assert 'version="3.20.1-cloud"' in server and '"version": "3.20.1"' in server
assert "const APP_VERSION='3.20.1'" in app and 'Proplet v3.20.1' in html and 'proplet-v3.20.1-ux-hotfix' in sw
# Onboarding: whole-board example is composed only of three actual words PES / LES / MOC.
whole=re.search(r"\{title:'Propleť všechno',html:`(.*?)`\},",app,re.S); assert whole
letters=re.findall(r'<span style="--d:\d+;--c:[^"]+">([^<]+)</span>',whole.group(1))
assert letters==list('PESLESMOC'), letters
assert 'LKC' not in ''.join(letters) and 'AMO' not in ''.join(letters)
assert 'onboard-mini-rules{margin-bottom:18px}' in css
assert 'onboarding-card.support-step' in css and 'onboard-support-grid{grid-template-columns:repeat(2' in css
# Result: anonymous account CTA is next to ranking and all utility actions remain available compactly.
assert 'id="winAccountBtn"' in html and 'Uložit postup a zobrazit své místo' in html
assert 'function openAccountFromWin()' in app and 'profileModalFromWin' in app and 'win_account_cta_authenticated' in app
assert all(x in html for x in ['id="winShareBtn" class="win-utility-btn','id="winReplayBtn" class="win-utility-btn','id="winMenuBtn" class="win-utility-btn'])
assert '<summary>Detaily výsledku</summary>' in html
# account nudge cadence unchanged
assert 'ACCOUNT_NUDGE_THRESHOLDS=[1,4,10]' in app
# complete boot shell and bind contract
assert html.rstrip().endswith('</html>') and '<script src="/app.js"></script>' in html
ids=set(re.findall(r'id=["\']([^"\']+)',html)); m=re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot",app,re.S); assert m
bound=set(re.findall(r"\$\('#([^']+)'\)",m.group(1))); assert not (bound-ids), sorted(bound-ids)
# Puzzle bank remains byte-identical internally.
assert (ROOT/'public/puzzles.json').read_bytes()==(ROOT/'data/puzzles.json').read_bytes()
puzzles=json.loads((ROOT/'data/puzzles.json').read_text()); assert puzzles.get('freeLevelsPerDifficulty')==200
h=hashlib.sha256((ROOT/'data/puzzles.json').read_bytes()).hexdigest(); assert h=='1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84',h
print('PASS: v3.20.1 package, onboarding/result hotfix, boot contract and untouched puzzle bank')
