"""Re-solve the published Daily correction using the full finite vocabulary."""
import hashlib
import json
from pathlib import Path

from tools.gen5.catalog import Catalog, norm
from tools.gen5.validation import Solver, structural, validation_words

ROOT = Path(__file__).resolve().parents[2]
source = json.loads((ROOT / 'data/puzzles.json').read_text())
public = json.loads((ROOT / 'public/puzzles.json').read_text())
board = next(p for p in source['daily'] if p['id'] == 'g4-d-042')
assert board == next(p for p in public['daily'] if p['id'] == board['id'])
preview = json.loads((ROOT / 'data/gen5_preview_puzzles.json').read_text())
assert board == next(p for p in preview['daily'] if p['id'] == board['id'])
assert 'MÁMA' in {a['word'] for a in board['answers']}
assert 'MAMÁ' not in {a['word'] for a in board['answers']}
correction = json.loads((ROOT / 'content/editorial-corrections/g4-d-042-20261019.json').read_text())
assert hashlib.sha256(json.dumps(board,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest() == correction['afterHash']
assert [(i, a, b) for i, (a, b) in enumerate(zip(correction['before']['letters'], board['letters'])) if a != b] == [(38, 'A', 'Á'), (48, 'Á', 'A')]
assert [a['path'] for a in board['answers']] == [a['path'] for a in correction['before']['answers']]
structural(board)  # orthogonal spelling, complete coverage, no overlaps
catalog = Catalog()
assert 'mamá' in catalog.exclusions
words = set(validation_words(catalog))
words.update(norm(a['word']) for a in board['answers'])
words.add('mamá')  # retain the old spelling as a possible competing word
assert len(words) >= 100_000
result = Solver(words).verify(board, seconds=30, node_limit=1_000_000)
assert result['status'] == 'unique', result
assert result['targetPathsUnique'], result
assert result['solutionsLowerBound'] == 1, result
print('PASS: corrected Daily has one complete cover and unique target paths', result)
