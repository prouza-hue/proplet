"""Build a separate preview bank; never rewrite released banks or rolling dates."""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIFFICULTIES = ('easy', 'medium', 'hard', 'hardcore', 'mozkomor')


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def compose_preview(source, rolling, package):
    if package.get('kind') != 'gen5-unpublished-package' or package.get('status') != 'unpublished':
        raise ValueError('Expected an unpublished candidate package')
    manifest = package['manifest']
    additions = package['puzzles']
    if digest(additions) != manifest['packagedContentHash']:
        raise ValueError('Candidate content hash mismatch')
    if source['freeGeneration'] != package['runtimeFreeGeneration'] or source['freeGeneration'] != 4:
        raise ValueError('Existing progression generation must stay 4')
    preview = deepcopy(source)
    old_ids = set()
    for d in DIFFICULTIES:
        history = source['free'][d] + rolling.get('puzzles', {}).get(d, [])
        boundary = manifest['boundaries'][d]
        if digest(history) != boundary['historyHash'] or digest(source['free'][d]) != boundary['baseHash']:
            raise ValueError('Frozen existing/reserved content changed: ' + d)
        if [b['meta']['level'] for b in history] != list(range(1, len(history) + 1)):
            raise ValueError('Historical level gap: ' + d)
        for b in history:
            if b['id'] in old_ids:
                raise ValueError('Existing ID collision')
            old_ids.add(b['id'])
        if len(additions[d]) != manifest['plannedCounts'][d]:
            raise ValueError('Candidate count mismatch: ' + d)
        for offset, b in enumerate(additions[d], 1):
            if (b['difficulty'] != d or b['id'] in old_ids
                    or b['meta']['level'] != len(history) + offset
                    or b['meta']['contentGeneration'] != 4
                    or b['meta']['generatorGeneration'] != 5):
                raise ValueError('Invalid appended candidate: ' + b['id'])
            old_ids.add(b['id'])
        # Exact object payloads, including reserve availableFrom dates, are retained.
        # Preview intentionally exposes the whole ordered sequence in the base bank.
        preview['free'][d] = deepcopy(history + additions[d])
    release = deepcopy(source.get('release', {}))
    release.update(seriesId=manifest['seriesId'], status='preview-only', previewOnly=True,
                   generatorGeneration=5, newLevelCounts=manifest['plannedCounts'],
                   totalNewLevels=sum(manifest['plannedCounts'].values()),
                   firstNewLevels={d:manifest['boundaries'][d]['nextLevel'] for d in DIFFICULTIES},
                   packagedContentHash=manifest['packagedContentHash'])
    preview['release'] = release
    preview['freeLevelCounts'] = {d:len(preview['free'][d]) for d in DIFFICULTIES}
    preview['freeLevelsPerDifficulty'] = min(preview['freeLevelCounts'][d] for d in DIFFICULTIES[:-1])
    # Reserve is already included above. A separate empty preview delta prevents
    # duplicate appends/counts while the real dated rolling file remains untouched.
    delta = {'version': 2, 'releaseEnabled': False, 'previewOnly': True,
             'contentGeneration': 4, 'batches': [],
             'puzzles': {d:[] for d in DIFFICULTIES},
             'seriesId': manifest['seriesId']}
    return preview, delta


def build(candidate_path):
    def read(path):
        return json.loads(path.read_text(encoding='utf-8'))
    package = read(candidate_path)
    protected = ('data/puzzles.json', 'public/puzzles.json', 'data/rolling_content_v1.json')
    before = {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in protected}
    if any(value != package['manifest']['frozenInputs'][name] for name,value in before.items()):
        raise ValueError('Released bank fingerprint differs from manufactured package')
    preview, delta = compose_preview(read(ROOT/protected[0]), read(ROOT/protected[2]), package)
    for name, payload in (('gen5_preview_puzzles.json', preview), ('gen5_preview_rolling.json', delta)):
        (ROOT/'data'/name).write_bytes((json.dumps(payload, ensure_ascii=False, separators=(',', ':'))+'\n').encode())
    assert before == {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in protected}
    return preview


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.candidate)
    print('Preview ready:', result['freeLevelCounts'], '; released files unchanged')
