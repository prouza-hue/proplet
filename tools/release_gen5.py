"""Publish the approved 450-board package without changing old or scheduled boards."""
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def release():
    package = json.loads(gzip.decompress((ROOT / 'content/gen5/evidence/release-candidate-01/candidate.json.gz').read_bytes()))
    manifest = package['manifest']
    def digest(value):
        return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert manifest['seriesId'] == 'g5-r1'
    assert digest(package['puzzles']) == manifest['packagedContentHash']
    assert sum(map(len, package['puzzles'].values())) == 450
    # Fail closed if the released baseline has changed since manufacturing.
    for name in ('data/puzzles.json', 'public/puzzles.json', 'data/rolling_content_v1.json'):
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == manifest['frozenInputs'][name], name
    preview = json.loads((ROOT / 'data/gen5_preview_puzzles.json').read_bytes())
    release_meta = deepcopy(preview['release'])
    release_meta.update(status='released', previewOnly=False, productionApproved=True,
                        baselineLevelCounts={d:len([p for p in preview['free'][d] if not p['id'].startswith('g5-r1-') and not p.get('meta',{}).get('rollingContent')]) for d in package['puzzles']})
    outputs = {}
    for name in ('data/puzzles.json', 'public/puzzles.json'):
        source = json.loads((ROOT / name).read_bytes())
        for difficulty, additions in package['puzzles'].items():
            assert digest(source['free'][difficulty]) == manifest['boundaries'][difficulty]['baseHash']
            assert additions == [p for p in preview['free'][difficulty] if p['id'].startswith('g5-r1-')]
            # Reserve retains its original release dates in rolling_content_v1.json.
            # Level numbers were allocated after those reserved slots and never change.
            source['free'][difficulty].extend(deepcopy(additions))
        source['release'] = release_meta
        source['freeLevelCounts'] = {d:len(bank) for d,bank in source['free'].items()}
        source['freeLevelsPerDifficulty'] = 300
        source['mozkomorUnlock']['levels'] = len(source['free']['mozkomor'])
        outputs[name] = (json.dumps(source, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
    for name,payload in outputs.items():
        (ROOT / name).write_bytes(payload)
    print('Published 400 regular boards + 50 Mozkomors; old boards and rolling schedule unchanged.')


if __name__ == '__main__':
    release()
