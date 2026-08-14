#!/usr/bin/env python3
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text()
assert 'version="3.22.4-cloud"' in server and '"version": "3.22.4"' in server
assert '"boardFit2DHotfix": True' in server
assert '"foldWebPwaLayoutUnified": True' in server
assert "const APP_VERSION='3.22.4'" in app and 'Proplet v3.22.4' in html and 'proplet-v3.22.4-unified-layout' in sw
assert 'cellByW=Math.max(4,(aw-colGap*(p.cols-1))/p.cols)' in app
assert 'cellByH=Math.max(4,(ah-rowGap*(p.rows-1))/p.rows)' in app
assert 'wrap.style.height=`${targetH}px`' in app
assert 'gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`' in app
assert '.board{position:relative;z-index:2;display:grid;gap:7px;width:100%;height:100%}' in css
assert '.cell,.void-cell{aspect-ratio:1;min-width:0;min-height:0}' in css
for token in ['landscapeGameBlocker','Otoč telefon na výšku','shouldBlockPhoneLandscape',"pauseGameClock('landscape')"]:
    assert token not in app+html+css, token
EXPECTED_PUZZLE='ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23'
EXPECTED_SQL='739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3'
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
if (ROOT/'data/puzzles.json').exists(): assert sha('data/puzzles.json')==EXPECTED_PUZZLE==sha('public/puzzles.json')
if (ROOT/'SUPABASE_MIGRATION_V3_21.sql').exists(): assert sha('SUPABASE_MIGRATION_V3_21.sql')==EXPECTED_SQL
assert not (ROOT/'SUPABASE_MIGRATION_V3_22_3.sql').exists()
print('PASS: v3.22.4 package keeps exact 2D fit and unifies Fold browser/PWA layout; content and SQL unchanged')
