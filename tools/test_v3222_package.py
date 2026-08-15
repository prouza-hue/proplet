#!/usr/bin/env python3
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text()
assert 'version="3.22.2-cloud"' in server and '"version": "3.22.2"' in server
assert '"darkFoundTextHotfix": True' in server and '"darkFoundChipTextHotfix": True' in server
assert "const APP_VERSION='3.22.2'" in app and 'Proplet v3.22.2' in html and 'proplet-v3.22.2-found-chip-text' in sw
assert 'style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,var(--word-color) 58%,white)' in app
assert 'html[data-theme="dark"] .found-word-chip{background:color-mix(in srgb,var(--word-color,#72d9b7) 70%,#211f2c)!important;color:#0c0b10;' in css
assert 'html[data-theme="dark"] .cell.used{background:color-mix(in srgb,var(--word-color,#72d9b7) 70%,#211f2c);' in css
for token in ['landscapeGameBlocker','Otoč telefon na výšku','shouldBlockPhoneLandscape',"pauseGameClock('landscape')"]:
    assert token not in app+html+css, token
EXPECTED_PUZZLE='ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23'
EXPECTED_SQL='739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3'
def sha(rel): return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()
if (ROOT/'data/puzzles.json').exists(): assert sha('data/puzzles.json')==EXPECTED_PUZZLE==sha('public/puzzles.json')
if (ROOT/'SUPABASE_MIGRATION_V3_21.sql').exists(): assert sha('SUPABASE_MIGRATION_V3_21.sql')==EXPECTED_SQL
assert not (ROOT/'SUPABASE_MIGRATION_V3_22_2.sql').exists()
print('PASS: v3.22.2 package is a found-row dark-text micro-hotfix only')
