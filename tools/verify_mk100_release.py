"""Independent, local release audit for the unpublished Mk100 candidate bank.

No manufacturing acceptance result is trusted as a substitute for recomputation.
The current Gen5 exact-cover Solver sees the complete frozen recognition corpus.
Budget exhaustion fails this audit. Every selected board is independently rebuilt
from the recorded new geometry pool and deterministic letter-placement seed.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import random
import subprocess
import time

from tools.gen5.catalog import ROOT, digest, norm, read_json
from tools.gen5.validation import Budget, BudgetExceeded, Solver, structural, geometry_errors
from tools.gen6.catalog import board_hash
from tools.gen6.eight import profile_for
from tools.gen6.mk100_catalog import Mk100Catalog, LEXICON_SHA256, VERIFIED_MAIN_SHA
from tools.mozkokalypsa_lab import board_from_paths

DIRECTORY = ROOT / 'content/gen6/mozkokalypsa-100'
SHAPE = Counter({5: 1, 6: 3, 7: 4, 8: 5, 9: 1})
FULL_COUNTS = {'relief': 20, 'main': 60, 'challenge': 15, 'summit': 5}
REP_COUNTS = {'relief': 3, 'main': 6, 'challenge': 2, 'summit': 1}


def candidate_profile(catalog, name):
    """Independently enforce the declared v2 design floors; runtime is unchanged."""
    settings = {
        'relief': (1, 3.0, .75),
        'main': (1, 3.7, .67),
        'challenge': (2, 4.3, .60),
        'summit': (2, 4.7, .55),
    }
    require(name in settings, 'Unknown v2 construction profile')
    minimum, mean, straight = settings[name]
    result = profile_for(catalog)
    result.update(min_path_turns=minimum, min_mean_turns=mean,
                  max_path_straight_share=straight,
                  geometry_profile='mk100-morphology-v2-' + name)
    return result


class VerificationFailure(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise VerificationFailure(message)


def bytes_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def json_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def verify_recognition(catalog, words, manifest, raw=None):
    require(words == sorted(set(words)), 'Recognition corpus is not sorted and unique')
    actual_raw = raw if raw is not None else ('\n'.join(words) + '\n').encode('utf-8')
    require(hashlib.sha256(actual_raw).hexdigest() == manifest['sha256'], 'Recognition byte hash differs')
    require(len(words) == manifest['acceptedEntries'], 'Recognition count differs')
    expected = catalog.full_dictionary()
    require(words == expected, 'Recognition corpus omits or changes current accepted words')
    require(set(catalog.entries) <= set(words), 'Recognition corpus omits working-v3 target words')
    require(manifest['immutableWorkingLexiconSha256'] == LEXICON_SHA256, 'Recognition lexicon identity differs')
    require(manifest['currentMainShaAtSnapshot'] == VERIFIED_MAIN_SHA, 'Recognition current main source differs')
    for path, expected_hash in manifest['sourceSha256'].items():
        require(bytes_hash(ROOT / path) == expected_hash, 'Recognition source changed: ' + path)
    require(manifest['historicalV3InputDeltas'] == [], 'Historical immutable v3 inputs changed')
    require(manifest['wordfreq']['version'] == '3.1.1', 'Recognition wordfreq is not pinned3.1.1')
    require(manifest['wordfreq']['nonSingleTokenAlphabeticEntries'] == [], 'Recognition tokenizer assumption failed')
    return {'entries': len(words), 'byteSha256': manifest['sha256'], 'solverDictionaryHash': digest(words),
            'allCurrentRecognizedFormsIncluded': True, 'workingV3TargetsIncluded': len(catalog.entries),
            'blocklistIncluded': False}


def require_unique(proof, solver, board_id):
    require(proof.get('status') == 'unique', board_id + ': no completed unique proof: ' + str(proof.get('status')))
    require(proof.get('targetPathsUnique') is True, board_id + ': target path ambiguity')
    require(type(proof.get('solutionsLowerBound')) is int and proof['solutionsLowerBound'] == 1,
            board_id + ': exact-cover solution count differs')
    require(proof.get('dictionaryHash') == solver.hash and proof.get('dictionarySize') == len(solver.words),
            board_id + ': incomplete or different solver dictionary')


def validate_board(board, catalog, expected_ordinal):
    require(board['rows'] == 10 and board['cols'] == 10, board['id'] + ': expected10×10')
    require(board['mask'] == list(range(100)), board['id'] + ': expected complete100-cell mask')
    require(len(board['answers']) == 14, board['id'] + ': expected14 target words')
    require(Counter(board['lengths']) == SHAPE, board['id'] + ': expected verified length profile')
    # Run structural() before identity checks so path corruption cannot hide
    # behind a recomputed content hash in the rejection regression below.
    geometry = structural(board)
    require(not geometry_errors(geometry, candidate_profile(catalog, board['meta']['profile'])),
            board['id'] + ': declared v2 geometry quality floor')
    require(board['id'] == f'mk100-v2-{expected_ordinal:03d}', 'Unexpected stable candidate ID')
    require(board['meta']['profileVersion'] == 'mk100-morphology-v2', 'Construction version differs')
    require(board['id'] not in catalog.historical_ids, board['id'] + ': historical identity collision')
    content_hash = board_hash(board)
    require(content_hash == board['meta']['contentHash'], board['id'] + ': corrupt content hash')
    require(content_hash not in catalog.historical_board_hashes, board['id'] + ': historical board substituted')
    require(board['difficulty'] == 'mozkomor', board['id'] + ': candidate runtime difficulty differs')
    require(board['meta']['level'] == expected_ordinal, board['id'] + ': wrong ordinal')
    require(board['meta']['wave'] == (expected_ordinal - 1) // 20 + 1, board['id'] + ': wrong wave')
    require(board['meta']['lexiconHash'] == catalog.lexicon_hash == LEXICON_SHA256,
            board['id'] + ': lexicon provenance differs')
    require(board['meta']['generatorGeneration'] == 6, board['id'] + ': generator version differs')
    require(board['meta']['contentGeneration'] == catalog.free_generation, board['id'] + ': runtime generation changed')
    require(board['meta']['candidateOnly'] is True and board['meta']['playtestOnly'] is True,
            board['id'] + ': candidate isolation flags missing')
    require(catalog.words(board) <= set(catalog.available_for_mk100()), board['id'] + ': unapproved target')
    import word_recognition_v3330 as runtime
    # This helper deliberately rejects solution words as bonus discoveries.
    # Exercise its actual trace invariants without that bonus-only exclusion;
    # no endpoint, XP handler or discovery record is invoked.
    trace_geometry = {**board, 'answers': []}
    for answer in board['answers']:
        require(runtime._valid_discovery_trace(trace_geometry, norm(answer['word']), answer['path']),
                board['id'] + ': answer path violates current runtime trace rules')
    return geometry


def verify_series_editorial(boards, plan, catalog):
    """Bind every actual target set to its archived individual language review."""
    reviews = []
    for name in ('editorial-review-001-050.json', 'editorial-review-051-100.json'):
        payload = read_json(DIRECTORY / name)
        reviews.extend(payload.get('records', payload.get('boards', [])))
    require(len(reviews) == 100 and len({r['ordinal'] for r in reviews}) == 100,
            'Individual lexical reviews do not cover exactly100 ordinals')
    by_ordinal = {r['ordinal']: r for r in reviews}
    entries = plan['entries']
    positions, family_positions = defaultdict(list), defaultdict(list)
    caps = {'relief': 0, 'main': 1, 'challenge': 2, 'summit': 2}
    for board in boards:
        ordinal = board['meta']['level']
        review = by_ordinal[ordinal]
        words = sorted(catalog.words(board))
        require(review['wordsetHash'] == digest(words)
                and sorted(review.get('reviewedWords', review.get('words', []))) == words
                and review['profile'] == board['meta']['profile'],
                board['id'] + ': actual targets differ from individual lexical review')
        require(review['verdict'] in ('accept', 'accepted', 'accepted-with-notes')
                and bool(review['whyIncluded']), board['id'] + ': no accepted editorial rationale')
        require(len(review['polarizingWords']) <= caps[board['meta']['profile']],
                board['id'] + ': unresolved polarizing-word accumulation')
        for word in words:
            positions[word].append(ordinal)
            family = entries[word].get('family')
            if family:
                family_positions[family].append((ordinal, word))
    if len(boards) == 100:
        require(max(map(len, positions.values())) <= 2, 'Exact repetition exceeds2')
        require(all(b - a >= 20 for rows in positions.values() for a, b in zip(rows, rows[1:])),
                'Exact-repeat spacing below20')
        require(all(b[0] - a[0] >= 8 for rows in family_positions.values()
                    for a, b in zip(rows, rows[1:])), 'Semantic-family spacing below8')
        require(sum(b['meta']['targetedEndgame'] for b in boards) == 20,
                'Expected20 explicit endgame design candidates')
        require(set(positions) & catalog.playtest_words == {'lahodný'},
                'Undocumented playtest vocabulary repeat')
    return {'individuallyBoundReviews': len(boards), 'sourceReviewCount': 100,
            'editorialType': 'AI model assessment, not player measurement or new dictionary certification',
            'targetOccurrences': sum(map(len, positions.values())), 'uniqueWords': len(positions)}


def reconstruct(board, record, plan, geometry_pool, global_seed):
    provenance = record['provenance']
    ordinal = plan['ordinal']
    attempt = provenance['attempt']
    require(type(attempt) is int and 0 <= attempt < record['poolAttempts'],
            board['id'] + ': selected attempt outside recorded search')
    placement_seed = int(digest([global_seed, 'letters', ordinal, attempt])[:16], 16)
    require(placement_seed == provenance['placementSeed'] == board['meta']['seed'], board['id'] + ': unreproducible seed')
    ordering_rng = random.Random(digest([global_seed, 'placement', ordinal]))
    indexes = [i for i, source in enumerate(geometry_pool)
               if source['constructionProfile'] == plan['profile']]
    require(len(indexes) >= (32 if plan['profile'] == 'summit' else 64),
            'Missing complete profile-specific geometry pool')
    ordering_rng.shuffle(indexes)
    variant = None
    for _ in range(attempt + 1):
        variant = ordering_rng.randrange(8)
    require(indexes[attempt % len(indexes)] == provenance['geometryPoolIndex'], board['id'] + ': pool index not seed-derived')
    require(variant == provenance['transform'], board['id'] + ': transform not seed-derived')
    source = geometry_pool[provenance['geometryPoolIndex']]
    require(source['constructionProfile'] == plan['profile'], board['id'] + ': construction profile differs')
    require(source.get('seed') == provenance['geometrySeed'] and source.get('step') == provenance['geometryStep'],
            board['id'] + ': geometry provenance differs')
    # Independently express the eight square symmetries. Do not call the
    # manufacture module's transform function or selected-option loader.
    paths = []
    for original in source['paths']:
        transformed = []
        for cell in original:
            row, col = divmod(cell, 10)
            if variant & 4:
                row, col = col, row
            if variant & 2:
                row = 9 - row
            if variant & 1:
                col = 9 - col
            transformed.append(row * 10 + col)
        paths.append(transformed)
    rng = random.Random(placement_seed)
    if rng.randrange(2):
        paths = [p[::-1] for p in paths]
    replayed = board_from_paths(paths, plan['words'], rng)
    require(board_hash(replayed) == board_hash(board), board['id'] + ': deterministic reconstruction differs')
    for key in ('difficulty', 'rows', 'cols', 'mask', 'letters', 'answers', 'lengths'):
        require(replayed[key] == board[key], board['id'] + ': reconstructed ' + key + ' differs')
    return {'placementSeed': placement_seed, 'geometryPoolIndex': provenance['geometryPoolIndex'],
            'transform': variant, 'attempt': attempt, 'exactStructuralBytesReproduced': True}


def discovery_inventory(board, solver, seconds=15, node_limit=2000000):
    """Retain valid bonus traces across the complete4..24 recognition scope.

    Exact-cover uniqueness uses visible target lengths5..9. Bonus recognition has
    the wider4..24 runtime rule, so enumerate it separately instead of silently
    dropping short/long accepted words. No game/API/reward calls are made.
    """
    import word_recognition_v3330 as runtime
    bonus_board = deepcopy(board)
    bonus_board['lengths'] = list(range(4, 25))
    budget = Budget(time.monotonic() + seconds, node_limit=node_limit)
    try:
        all_paths = solver.enumerate(bonus_board, budget)
    except BudgetExceeded as exc:
        raise VerificationFailure(board['id'] + ': bonus inventory unknown_budget') from exc
    targets = {norm(a['word']) for a in board['answers']}
    by_word = defaultdict(list)
    for word, path, _bits in all_paths:
        if word not in targets:
            require(runtime._valid_discovery_trace(board, word, list(path)), board['id'] + ': bonus path violates current runtime')
            by_word[word].append(path)
    rows = []
    for word in sorted(by_word):
        source = runtime._recognize_source(word)
        rows.append({'word': word.upper(), 'pathCount': len(by_word[word]),
                     'samplePath': list(by_word[word][0]), 'currentRuntimeRecognized': source is not None,
                     'currentRuntimeSource': source,
                     'candidateLexiconOnly': source is None})
    return {'status': 'complete', 'scopeLengths': [4, 24], 'enumerationNodes': budget.nodes,
            'distinctBonusWords': len(rows), 'bonusPaths': sum(r['pathCount'] for r in rows),
            'currentRuntimeBonusWords': sum(r['currentRuntimeRecognized'] for r in rows),
            'candidateOnlyBonusWords': sum(r['candidateLexiconOnly'] for r in rows),
            'words': rows}


def negative_checks(catalog, solver, sample, words, recognition_manifest):
    checks = []
    def rejects(label, action):
        try:
            action()
        except (ValueError, KeyError, TypeError) as error:
            checks.append({'case': label, 'status': 'rejected', 'reason': str(error)})
            return
        raise VerificationFailure('Verifier regression unexpectedly accepted: ' + label)

    damaged = deepcopy(sample)
    damaged['answers'][0]['path'][1] = damaged['answers'][0]['path'][0]
    damaged['meta']['contentHash'] = board_hash(damaged)
    rejects('corrupt_path_even_with_recomputed_content_hash',
            lambda: validate_board(damaged, catalog, sample['meta']['level']))
    damaged_hash = deepcopy(sample)
    damaged_hash['meta']['contentHash'] = '0' * 64
    rejects('corrupt_content_hash', lambda: validate_board(damaged_hash, catalog, sample['meta']['level']))
    omitted = next(w for w in words if w not in catalog.words(sample))
    truncated = [w for w in words if w != omitted]
    forged_manifest = deepcopy(recognition_manifest)
    forged_manifest['acceptedEntries'] = len(truncated)
    forged_manifest['sha256'] = hashlib.sha256(('\n'.join(truncated) + '\n').encode('utf-8')).hexdigest()
    rejects('missing_recognition_word_even_with_recomputed_count_and_hash',
            lambda: verify_recognition(catalog, truncated, forged_manifest))
    timeout = solver.verify(sample, seconds=0, node_limit=0)
    require(timeout['status'] == 'unknown_budget', 'Zero-budget solver regression did not time out')
    rejects('actual_solver_budget_exhaustion', lambda: require_unique(timeout, solver, sample['id']))
    forged_proof = deepcopy(sample['meta']['validation'])
    forged_proof['dictionarySize'] = len(solver.words) - 1
    rejects('proof_with_truncated_dictionary', lambda: require_unique(forged_proof, solver, sample['id']))
    return checks


def verify(stage='full', output=DIRECTORY / 'independent-verification.json', seconds=15, node_limit=2000000):
    started = time.monotonic()
    catalog = Mk100Catalog()
    corpus_path = DIRECTORY / 'recognition-words.txt'
    raw = corpus_path.read_bytes()
    words = raw.decode('utf-8').splitlines()
    recognition_manifest = read_json(DIRECTORY / 'recognition-manifest.json')
    recognition = verify_recognition(catalog, words, recognition_manifest, raw)
    solver = Solver(words)
    bank_name = 'bank.json' if stage == 'full' else 'representative-bank-v2.json'
    bank = read_json(DIRECTORY / bank_name)
    evidence_name = 'full-verification.json' if stage == 'full' else 'representative-v2-verification.json'
    evidence = read_json(DIRECTORY / evidence_name)
    plan_name = 'lexical-plan.json'
    plan = read_json(DIRECTORY / plan_name)
    plans = {row['ordinal']: row for row in plan['boards']}
    selected_records = {row['id']: row for row in evidence['boards']}
    geometry_path = DIRECTORY / 'geometry-pool-v2.jsonl'
    geometry_pool = [json.loads(line) for line in geometry_path.read_text(encoding='utf-8').splitlines()]
    require(len(geometry_pool) == 224, 'Missing complete newly manufactured v2 geometry pool')
    require(dict(Counter(row['constructionProfile'] for row in geometry_pool))
            == {'relief':64, 'main':64, 'challenge':64, 'summit':32}, 'Incomplete v2 profile pools')
    count = 100 if stage == 'full' else 12
    expected_ordinals = list(range(1, 101)) if stage == 'full' else sorted(plan['representativeOrdinals'])
    expected_counts = FULL_COUNTS if stage == 'full' else REP_COUNTS
    boards = bank['boards']
    require(len(boards) == count, 'Wrong number of boards in ' + bank_name)
    require([b['meta']['level'] for b in boards] == expected_ordinals, 'Bank order differs')
    require(dict(Counter(b['meta']['profile'] for b in boards)) == expected_counts, 'Wrong profile mix')
    require(len({b['id'] for b in boards}) == count, 'Duplicate board IDs')
    require(len({board_hash(b) for b in boards}) == count, 'Duplicate board content hashes')
    require(bank['contentHash'] == evidence['bankContentHash'] == digest(boards), 'Bank hash differs from independently computed content')
    require(bank['lexiconHash'] == catalog.lexicon_hash, 'Bank lexicon identity differs')
    require(bank['publicationAuthorized'] is False and bank['playtestActivationAuthorized'] is False,
            'Bank publication/playtest flags are unsafe')
    require(bank['runtimeFreeGeneration'] == catalog.free_generation, 'Bank resets runtime generation')
    require(bank['validationDictionary']['sha256'] == solver.hash
            and bank['validationDictionary']['size'] == len(words), 'Bank solver dictionary differs')
    lexical_review = verify_series_editorial(boards, plan, catalog)
    frozen = evidence['frozenInputs']
    for path, expected_hash in frozen.items():
        require(bytes_hash(ROOT / path) == expected_hash, 'Manufacturing frozen input changed: ' + path)
    require(geometry_path.relative_to(ROOT).as_posix() in frozen,
            'Tracked geometry pool is absent from frozen inputs')
    if stage == 'full':
        manifest = read_json(DIRECTORY / 'manifest.json')
        require(manifest['bankContentHash'] == bank['contentHash'], 'Manifest bank hash differs')
        require(manifest['lexiconHash'] == catalog.lexicon_hash, 'Manifest lexicon differs')
        require(manifest['recognitionHash'] == solver.hash, 'Manifest recognizer differs')
        require(manifest['publicationAuthorized'] is False, 'Manifest publication flag unsafe')
        require([r['ordinal'] for r in manifest['boards']] == expected_ordinals, 'Manifest has wrong ordinals')
        for row, board in zip(manifest['boards'], boards):
            require(row['id'] == board['id'] and row['contentHash'] == board_hash(board)
                    and row['profile'] == board['meta']['profile'] and row['seed'] == board['meta']['seed'],
                    board['id'] + ': manifest row differs')
        representative = read_json(DIRECTORY / 'representative-bank-v2.json')
        require(len(representative['boards']) == 12
                and dict(Counter(b['meta']['profile'] for b in representative['boards'])) == REP_COUNTS,
                'Prepared representative bank is not3/6/2/1')
        require([b['meta']['level'] for b in representative['boards']] == sorted(manifest['representativeOrdinals']),
                'Representative order differs from manifest')
        require(digest(representative['boards']) == representative['contentHash'],
                'Representative bank hash differs')
        full_by_id = {board['id']: board for board in boards}
        for original in representative['boards']:
            require(original['id'] in full_by_id
                    and board_hash(original) == board_hash(full_by_id[original['id']]),
                    original['id'] + ': internally verified representative content was changed')
    records = []
    report = {'schemaVersion': 1, 'stage': stage, 'status': 'in-progress',
              'startedAt': datetime.now(timezone.utc).isoformat(),
              'verifier': 'tools/verify_mk100_release.py', 'verifierSha256': bytes_hash(Path(__file__)),
              'checkoutSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'verifiedMainSha': VERIFIED_MAIN_SHA, 'lexiconHash': catalog.lexicon_hash,
              'bankContentHash': bank['contentHash'], 'recognition': recognition,
              'individualLexicalReviewBindings': lexical_review,
              'profileCounts': expected_counts, 'geometryPoolSha256': bytes_hash(geometry_path),
              'independence': 'No manufacture module imported. All selected paths/seeds/hash identities recomputed; current Gen5 solver rerun against complete snapshot.',
              'solverLimits': {'secondsPerBoard': seconds, 'nodeLimitPerBoard': node_limit,
                               'budgetExhaustionPolicy': 'FAIL'}, 'boards': records,
              'productionDatabaseAccess': False, 'productionMutations': False,
              'limitations': ['Local geometric/recognition/exact-cover validation; this does not measure human difficulty or enjoyment.',
                              'Bonus inventory uses complete4..24 offline recognition and separately labels forms absent from current production recognition.',
                              'Geometry and letter placement are reproduced from retained complete pool; C++ stochastic geometry search itself is evidenced by retained provenance, not rerun here.']}
    json_write(output, report)
    for board, ordinal in zip(boards, expected_ordinals):
        geometry = validate_board(board, catalog, ordinal)
        row = selected_records[board['id']]
        require(set(norm(a['word']) for a in board['answers']) == set(plans[ordinal]['words']),
                board['id'] + ': words differ from selected lexical plan')
        require(board['meta']['profile'] == plans[ordinal]['profile'], board['id'] + ': profile differs from lexical plan')
        require(dict(Counter(catalog.entries[norm(a['word'])]['tier'] for a in board['answers']))
                == plans[ordinal]['tierCounts'], board['id'] + ': tier labels differ from lexical plan')
        require_unique(board['meta']['validation'], solver, board['id'])
        require_unique(row['proof'], solver, board['id'])
        require_unique(row['finalProof'], solver, board['id'])
        replay = reconstruct(board, row, plans[ordinal], geometry_pool, plan['seed'])
        independent_proof = solver.verify(board, seconds=seconds, node_limit=node_limit)
        require_unique(independent_proof, solver, board['id'])
        discoveries = discovery_inventory(board, solver, seconds=seconds, node_limit=node_limit)
        records.append({'id': board['id'], 'ordinal': ordinal, 'contentHash': board_hash(board),
                        'geometry': geometry, 'deterministicReplay': replay,
                        'exactCoverProof': independent_proof, 'bonusRecognition': discoveries})
        json_write(output, report)
        print('INDEPENDENT_PASS', board['id'], 'bonus', discoveries['distinctBonusWords'], flush=True)
    report['negativeChecks'] = negative_checks(catalog, solver, boards[0], words, recognition_manifest)
    for path, expected_hash in frozen.items():
        require(bytes_hash(ROOT / path) == expected_hash, 'Input changed during independent audit: ' + path)
    require(bytes_hash(corpus_path) == recognition_manifest['sha256'], 'Recognition corpus changed during audit')
    report.update(status='PASS', completedAt=datetime.now(timezone.utc).isoformat(),
                  seconds=round(time.monotonic() - started, 3), boardCount=len(records),
                  allTargetPathsUnique=True, allExactCoversUnique=True, allDeterministicReplaysExact=True,
                  immutableLexiconAndRuntimeSourcesVerified=True, historicalIdentityCollisions=0,
                  completeBonusWordInventory=True)
    json_write(output, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=['representative', 'full'], default='full')
    parser.add_argument('--output', type=Path, default=DIRECTORY / 'independent-verification.json')
    parser.add_argument('--seconds', type=float, default=15)
    parser.add_argument('--node-limit', type=int, default=2000000)
    args = parser.parse_args()
    try:
        result = verify(args.stage, args.output, args.seconds, args.node_limit)
        print(json.dumps({'status': result['status'], 'stage': args.stage, 'boardCount': result['boardCount'],
                          'bankContentHash': result['bankContentHash'], 'seconds': result['seconds']}), flush=True)
    except (ValueError, KeyError, TypeError) as error:
        print('INDEPENDENT_FAIL', str(error), flush=True)
        raise SystemExit(1) from error


if __name__ == '__main__':
    main()
