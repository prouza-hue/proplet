"""Read-only content audit using the independent prefix/cover solver.

Reconstructs vocabulary and exposure from raw inputs. Never imports the
manufacturing acceptance function or changes the bank being audited.
"""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from copy import deepcopy
import hashlib
import gzip
import json
from pathlib import Path
import time
from types import SimpleNamespace

from tools.gen5.catalog import ROOT, digest, norm, tier_mix_ok
from tools.gen5.validation import Solver, validation_words, structural, geometry_errors
from tools.measure_gen4_ambiguity import board_metrics
from tools.daily_specials.independent import check as independent_check
from tools.daily_specials.core import transformed_hash

OUT = ROOT / 'content/gen6/free-expansion-600-20261102'
DIFFICULTIES = ('easy', 'medium', 'hard', 'hardcore', 'mozkomor', 'mozkokalypsa')
LEXICON_HASH = '7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277'
_dictionary = None


def read(path):
    return json.loads(Path(path).read_bytes())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def targets(board):
    return {norm(a['word']) for a in board['answers']}


def identity(board):
    return digest({'rows': board['rows'], 'cols': board['cols'],
        'letters': board['letters'], 'mask': sorted(board['mask']),
        'lengths': sorted(board['lengths']),
        'answers': sorted((norm(a['word']), a['path']) for a in board['answers'])})


def walk(value):
    if isinstance(value, dict):
        if all(k in value for k in ('id', 'answers', 'letters', 'rows', 'cols', 'mask')):
            yield value
        else:
            for v in value.values():
                yield from walk(v)
    elif isinstance(value, list):
        for v in value:
            yield from walk(v)


def initialize(words):
    global _dictionary
    _dictionary = words


def verify_one(board):
    started = time.monotonic()
    proof = independent_check(board, _dictionary, seconds=30, node_limit=2_000_000)
    return {'id': board['id'], 'contentHash': identity(board), 'proof': proof,
            'seconds': round(time.monotonic() - started, 4)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    started = time.monotonic()
    bank_path = OUT / 'bank.json'
    initial_sha = sha(bank_path)
    bank = read(bank_path)
    boards = bank['boards']
    assert len(boards) == 600
    assert Counter(b['difficulty'] for b in boards) == Counter({d: 100 for d in DIFFICULTIES})
    assert bank['contentHash'] == digest(boards)
    assert bank['runtimeGeneration'] == 4 and bank['generatorGeneration'] == 6

    lexicon_path = ROOT / 'content/gen6/daily-specials-36/inputs/lexicon-v3.json'
    assert hashlib.sha256(lexicon_path.read_bytes().replace(b'\r\n', b'\n')).hexdigest() == LEXICON_HASH
    entries = {norm(e['word']): e for e in read(lexicon_path)['entries']}
    assert len(entries) == 4290
    assert sum(e['source_cohort'] == 'approved-expansion-1143' for e in entries.values()) == 1143
    exclusions = {norm(w) for w in read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation']}
    exclusions |= {'červodíra', 'blockchain', 'pulsar', 'tensor'}
    variants = {}
    for w, e in entries.items():
        variants.setdefault(e.get('variant_unit') or w, set()).add(w)
    variant_words = {w: variants[e.get('variant_unit') or w] for w, e in entries.items()}
    profiles = read(ROOT / 'content/gen5/profiles.json')['profiles']

    # Approved manufacturing union, including the corrected MÁMA overlay.
    # The independent broad bonus spelling dictionary does not select solutions.
    dictionary = Solver(validation_words(SimpleNamespace(entries=entries)))
    manifest = read(OUT / 'recognition-manifest.json')
    assert dictionary.hash == bank['recognitionHash'] == manifest['dictionaryHash']
    assert len(dictionary.words) == manifest['dictionarySize'] == 103837
    assert dictionary.words == (OUT / 'recognition-words.txt').read_text(encoding='utf-8').splitlines()
    # Difficulty thresholds retain their calibrated 13,940-word scale. The
    # broader dictionary above is exclusively the correctness proof baseline.
    calibration_path = ROOT / 'content/gen5/recognition-before-daily-gen6.txt'
    assert hashlib.sha256(calibration_path.read_bytes().replace(b'\r\n', b'\n')).hexdigest() == 'c16dcb023676dd40da638edbd40d1ad48f62f4a63ad872cdc153e6049def2423'
    calibration_words = {norm(w) for w in calibration_path.read_text(encoding='utf-8').splitlines()}
    assert len(calibration_words) == 13940
    prefixes = Solver(calibration_words | set(entries)).prefixes

    history_manifest = read(OUT / 'history-manifest.json')
    old_ids, old_sets, old_shapes = set(), set(), set()
    for source in history_manifest['sources']:
        path = ROOT / source['path']
        assert sha(path) == source['sha256'], ('history changed', source['path'])
        for b in walk(read(path)):
            old_ids.add(b['id'])
            old_sets.add(digest(sorted(targets(b))))
            old_shapes.add(transformed_hash(b))
    archived_sources = []
    for path in sorted((ROOT / 'data/archive/v3.33.5').glob('*.json.gz')):
        archived = list(walk(json.loads(gzip.decompress(path.read_bytes()))))
        if not archived:
            continue
        archived_sources.append({'path': str(path.relative_to(ROOT)), 'sha256': sha(path), 'boards': len(archived)})
        for b in archived:
            old_ids.add(b['id'])
            old_sets.add(digest(sorted(targets(b))))
            old_shapes.add(transformed_hash(b))
    public = read(ROOT / 'public/puzzles.json')
    rolling = read(ROOT / 'data/rolling_content_v1.json')['puzzles']
    history = {d: sorted(public['free'][d] + rolling.get(d, []), key=lambda b: b['meta']['level']) for d in DIFFICULTIES}
    last = {d: max(b['meta']['level'] for b in bs) for d, bs in history.items()}
    recent = {d: [targets(b) for b in bs] for d, bs in history.items()}
    previous_mk = list(history['mozkokalypsa'])
    mk_catalog = SimpleNamespace(entries=entries, exclusions=exclusions, variants=variant_words,
        additions={w for w, e in entries.items() if e['source_cohort'] == 'approved-expansion-1143'})
    new = {d: Counter() for d in DIFFICULTIES}
    global_new = Counter()
    counts = Counter()
    records = []
    for board in boards:
        d = board['difficulty']
        counts[d] += 1
        n = counts[d]
        if d == 'mozkokalypsa':
            from .mk import profile
            p = profile(n)
        else:
            p = deepcopy(profiles[d])
            for variant in p.pop('variants', []):
                if n % variant['every'] == variant['remainder']:
                    p.update(variant['overrides'])
        ws = targets(board)
        assert board['id'] == f'g6-expansion-{d}-{n:03d}' and board['id'] not in old_ids
        assert board['meta']['level'] == last[d] + n
        assert board['meta']['contentGeneration'] == 4 and board['meta']['generatorGeneration'] == 6
        assert not geometry_errors(structural(board), p), board['id']
        assert all(w in entries and entries[w].get('target_eligible') and w not in exclusions
            and entries[w]['tier'] in p['policy']['allowed'] and p['min_len'] <= len(w) <= p['max_len']
            and entries[w].get('fun', 3) >= 3 for w in ws), board['id']
        assert tier_mix_ok(ws, entries, p['policy']), board['id']
        forbidden = set().union(*recent[d][-p['cooldown']:]) if p['cooldown'] else set()
        forbidden |= {w for w, uses in new[d].items() if uses >= p['new_word_cap']}
        forbidden |= {w for w, uses in global_new.items() if uses >= 5}
        for w in list(forbidden):
            forbidden |= variant_words.get(w, {w})
        assert not ws & forbidden, (board['id'], 'exposure', ws & forbidden)
        assert len({entries[w].get('capacity_topic') for w in ws}) >= min(3, len(ws))
        assert len({entries[w].get('family') or w for w in ws}) == len(ws)
        assert not any((ws - {w}) & variant_words[w] for w in ws)
        wordset = digest(sorted(ws))
        shape = transformed_hash(board)
        assert wordset not in old_sets and shape not in old_shapes, board['id']
        ambiguity = board_metrics(board, prefixes, 4)['localAmbiguityScore']
        if d != 'mozkokalypsa':
            assert p['ambiguity'][0] <= ambiguity <= p['ambiguity'][1], board['id']
        else:
            from . import mk
            mk.validate(board, previous_mk, mk_catalog)
            evidence = board['meta']['manufacture']['mk']
            options = evidence['candidateOptions']
            eligible_options = [o for o in options if not evidence['targetedEndgame'] or o['endgameFloor']]
            assert evidence['selectionScore'] == max(o['selectionScore'] for o in eligible_options)
            selected_hash = digest({k: board[k] for k in ('rows', 'cols', 'mask', 'letters', 'answers', 'lengths')})
            assert any(o['contentHash'] == selected_hash and o['selectionScore'] == evidence['selectionScore'] for o in eligible_options)
            pool_record = mk.pool()[evidence['selectedPlacement']['geometryPoolIndex']]
            assert pool_record['constructionProfile'] == mk.name(n)
            pool_board = {'answers': [{'path': path} for path in pool_record['paths']]}
            assert mk.canonical_tiling(board) == mk.canonical_tiling(pool_board)
            if evidence['targetedEndgame']:
                from .mk_inputs.mk100_endgame import endgame_metrics
                # Selection evaluated the concrete grid before ID/meta binding.
                # board_metrics includes those presentation labels in its report;
                # reproduce that input while checking every substantive metric.
                selection_board = {k: board[k] for k in
                    ('difficulty', 'rows', 'cols', 'mask', 'letters', 'answers', 'lengths')}
                ending = endgame_metrics(selection_board, dictionary.prefixes, mk.eligible(mk_catalog),
                    seed=2026110201 + n, random_orders=6)
                assert digest(ending) == digest(evidence['endgame']), board['id']
                assert mk.endgame_meets_floor(ending)
            previous_mk.append(board)
        for field in ('verification', 'independentVerification'):
            stored = board['meta']['manufacture'][field]
            assert stored['status'] == 'unique' and stored['targetPathsUnique']
            assert stored['dictionaryHash'] == dictionary.hash and stored['dictionarySize'] == len(dictionary.words)
        records.append({'id': board['id'], 'difficulty': d, 'contentHash': identity(board),
            'profile': p['geometry_profile'], 'geometry': structural(board),
            'ambiguity': ambiguity, 'tiers': dict(Counter(entries[w]['tier'] for w in ws))})
        old_ids.add(board['id']); old_sets.add(wordset); old_shapes.add(shape)
        recent[d].append(ws); new[d].update(ws); global_new.update(ws)

    with ProcessPoolExecutor(max_workers=args.workers, initializer=initialize, initargs=(dictionary.words,)) as pool:
        for record, result, board in zip(records, pool.map(verify_one, boards), boards):
            proof = result['proof']
            assert proof['status'] == 'unique' and proof['targetPathsUnique'] and proof['uniqueCoverMatchesTargets'], result
            assert proof['candidateCount'] == board['meta']['manufacture']['verification']['candidateCount'], result['id']
            record.update(independentProof=proof, verificationSeconds=result['seconds'])
            if len([r for r in records if 'independentProof' in r]) % 50 == 0:
                print(json.dumps({'independentlyVerified': sum('independentProof' in r for r in records)}), flush=True)
    assert initial_sha == sha(bank_path), 'Bank changed during independent audit'
    report = {'asOf': '2026-11-02', 'allPassed': True, 'contentHash': bank['contentHash'],
        'bankFileSha256': initial_sha, 'counts': dict(counts), 'lexiconSha256': LEXICON_HASH,
        'dictionaryHash': dictionary.hash, 'dictionarySize': len(dictionary.words),
        'historySourceCount': len(history_manifest['sources']), 'archivedSources': archived_sources,
        'checks': records,
        'difficultyCalibration': {'path': str(calibration_path.relative_to(ROOT)),
            'sha256': hashlib.sha256(calibration_path.read_bytes().replace(b'\r\n', b'\n')).hexdigest(),
            'baselineWords': len(calibration_words), 'unionWords': len(calibration_words | set(entries))},
        'uniqueTargetWords': len(global_new), 'maxUsesGlobally': max(global_new.values()),
        'maxUsesByDifficulty': {d: max(c.values()) for d, c in new.items()},
        'seconds': round(time.monotonic() - started, 3), 'auditScriptSha256': sha(Path(__file__)),
        'humanPlaytest': 'not performed; approved geometry calibration retained'}
    (OUT / 'independent-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'checks'}), flush=True)


if __name__ == '__main__':
    main()
