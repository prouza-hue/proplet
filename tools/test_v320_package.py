#!/usr/bin/env python3
from pathlib import Path
import re, json, sys
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
for f in ['server.py','public/app.js','public/index.html','public/styles.css','public/sw.js','SUPABASE_MIGRATION_V3_20.sql','UPDATE_V3_20_CZ.md','RELEASE_V3_20_CZ.md','data/puzzles.json','public/puzzles.json']:
    assert (ROOT/f).is_file(),f
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text()
assert 'version="3.20.0-cloud"' in server and '"version": "3.20.0"' in server
assert "const APP_VERSION='3.20.0'" in app and 'Proplet v3.20' in html and 'proplet-v3.20-ux-clarity' in sw
assert 'ACCOUNT_NUDGE_THRESHOLDS=[1,4,10]' in app
assert 'uxMigration' in server and 'team_joined_at' in (ROOT/'SUPABASE_MIGRATION_V3_20.sql').read_text()
assert "family_code: Optional[str]" in server and '/api/team-membership' in server
assert app.count("title:'Najdi PES'")==1 and "title:'Propleť všechno'" in app and "title:'Pomocník'" in app
assert 'onboard-fill-demo' in css and 'daily-progress-strip' in css and 'win-summary' in css
# complete boot shell and bind contract
assert html.rstrip().endswith('</html>') and '<script src="/app.js"></script>' in html and len(html.encode())>25000
ids=set(re.findall(r'id=["\']([^"\']+)',html)); m=re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot",app,re.S); assert m
bound=set(re.findall(r"\$\('#([^']+)'\)",m.group(1))); assert not (bound-ids),sorted(bound-ids)
# Puzzle/content bank must be untouched by UX sprint.
assert (ROOT/'public/puzzles.json').read_bytes()==(ROOT/'data/puzzles.json').read_bytes()
puzzles=json.loads((ROOT/'data/puzzles.json').read_text()); assert puzzles.get('freeLevelsPerDifficulty')==200
print('PASS: v3.20 package, boot contract and untouched puzzle bank')
