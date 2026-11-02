"""Production adds exactly the approved package, preserving slots, rewards and scheduled content."""
import gzip
import hashlib
import json
import os
from datetime import date
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
os.environ['VERCEL_ENV']='production'
os.environ['VERCEL_GIT_COMMIT_REF']='main'
from backend.config import load_settings
from backend.content import released_free_bank, free_puzzle_info
from tools.build_gen5_preview import DIFFICULTIES, digest
import server

def read(name):
    return json.loads((ROOT/name).read_bytes())

package=json.loads(gzip.decompress((ROOT/'content/gen5/evidence/release-candidate-01/candidate.json.gz').read_bytes()))
data=read('data/puzzles.json'); public=read('public/puzzles.json'); rolling=read('data/rolling_content_v1.json')
assert not load_settings().gen5_candidate_preview
assert load_settings().puzzles_path.name=='puzzles.json'
assert hashlib.sha256((ROOT/'data/rolling_content_v1.json').read_bytes()).hexdigest()==package['manifest']['frozenInputs']['data/rolling_content_v1.json']
assert data['freeGeneration']==data['contentGeneration']==4
assert data['release']['productionApproved'] and not data['release']['previewOnly']
assert data['release']['totalNewLevels']==450
assert data['mozkomorUnlock']['requiresCurrentBaseLevels']==0
assert data['mozkomorUnlock']['levels']==len(data['free']['mozkomor'])==250
new_hardcore=[{'mode':'free','difficulty':'hardcore','puzzle_id':p['id']} for p in data['free']['hardcore'] if p['id'].startswith('g5-r1-')]
assert server.free_slot_summary(new_hardcore)['current']['hardcore']==100
assert server.free_slot_summary(new_hardcore)['baseCurrent']['hardcore']==0
assert server.mozkomor_unlocked_from_rows(new_hardcore)
assert server.mozkomor_unlocked_from_rows([])
old_hardcore=[{'mode':'free','difficulty':'hardcore','puzzle_id':p['id']} for p in data['free']['hardcore'][:200]]
assert server.mozkomor_unlocked_from_rows(old_hardcore)
for d in DIFFICULTIES:
    old=[p for p in data['free'][d] if not p['id'].startswith(('g5-r1-', 'g6-refresh-', 'g6-expansion-'))]
    additions=[p for p in data['free'][d] if p['id'].startswith('g5-r1-')]
    assert digest(old)==package['manifest']['boundaries'][d]['baseHash'],d
    assert digest(old+rolling['puzzles'].get(d,[]))==package['manifest']['boundaries'][d]['historyHash'],d
    assert additions==package['puzzles'][d],d
    assert public['free'][d]==data['free'][d]
    assert len(additions)==(50 if d=='mozkomor' else 100)
    for day in [date(2026,9,15),date(2026,9,21),date(2026,11,24)]:
        bank=released_free_bank(data,rolling,d,day); ids={p['id'] for p in bank}
        assert len(ids)==len(bank)
        assert all(p['id'] in ids for p in additions)
        for reserved in rolling['puzzles'].get(d,[]):
            assert (reserved['id'] in ids)==(reserved['meta']['availableFrom']<=day.isoformat())
    for p in additions:
        info=free_puzzle_info(data,rolling,p['id'],DIFFICULTIES,d)
        assert info['puzzle']==p and info['level']==p['meta']['level'] and info['generation']==4
print('PASS: 450 approved production boards; old payloads, slot numbers and rolling dates unchanged')

