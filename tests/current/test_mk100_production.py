"""Release boundaries and normal six-difficulty runtime; no player playtest."""
import hashlib
import json
from pathlib import Path
import server

ROOT = Path(__file__).resolve().parents[2]
read = lambda name: json.loads((ROOT/name).read_bytes())
frozen = read('content/gen6/mozkokalypsa-100/bank.json')
data = read('data/puzzles.json')
baseline = read('content/gen6/mozkokalypsa-100/production-boundaries.json')
digest = lambda value: hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
assert data['freeGeneration'] == 4
for difficulty, expected in baseline['free'].items():
    assert digest([p for p in data['free'][difficulty] if not p['id'].startswith('g6-refresh-')]) == expected, difficulty
for key,expected in baseline['preserved'].items():
    assert digest(data.get(key)) == expected, key
boards = data['free']['mozkokalypsa']
assert len(boards) == 100 and read('public/puzzles.json')['free'] == data['free']
for index,(source,board) in enumerate(zip(frozen['boards'],boards),1):
    for key in ('id','letters','answers','mask','rows','cols'):
        assert source[key] == board[key], (index,key)
    assert board['difficulty'] == 'mozkokalypsa'
    assert board['meta']['level'] == index and board['meta']['contentGeneration'] == 4
    assert not board['meta']['playtestOnly'] and not board['meta']['candidateOnly']
    info = server.free_puzzle_info(board['id'],'mozkokalypsa')
    assert info['generation'] == 4 and info['level'] == index and not info['legacy']
assert len({a['word'] for b in boards for a in b['answers']}) == 1008
assert server.POINTS['mozkokalypsa'] == 200
assert len(server.FREE_DIFFICULTIES) == 6
assert hashlib.sha256((ROOT/'public/difficulty/printshop/mozkokalypsa-series-ochre.svg').read_bytes()).hexdigest() == '6db1291690c7add519a578b6c614a5841097580273621e27db2b0f8acf02d07c'
html=(ROOT/'public/index.html').read_text()
assert 'mk100-integrated-preview.js' not in html and '/app/mozkokalypsa-launch.js?v=' in html
assert 'build_mk100_integrated_preview' not in (ROOT/'vercel.json').read_text()
print('PASS: frozen hundred, unchanged old banks/slots, verified CTA counts, ochre artwork and normal production integration')

