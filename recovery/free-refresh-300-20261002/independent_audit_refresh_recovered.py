"""Recovered independent audit for the unpublished lower-difficulty refresh.

Rebuilt after the local executor disconnected; this is a new audit implementation,
not a recovered copy of the original audit or its report. It uses original Gen5
validation/ambiguity tools and raw frozen source documents. It never imports the
refresh manufacturing adapter, its selector, acceptance code or exposure ledger.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import unicodedata

ROOT = Path(__file__).resolve().parent
if not (ROOT / 'content').exists() and (ROOT.parent / 'content').exists():
    ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))
from tools.gen5.validation import Solver, structural, geometry_errors
from tools import measure_gen4_ambiguity as ambiguity

DIFFICULTIES = ('easy', 'medium', 'hard')
EXPECTED_CONTENT_HASH = '7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e'
HISTORICAL_BANK_SHA256 = '55cae68a3cbf12d2b9813ba62d22c70dedd15471869a6aa2646910922a55147f'
EXPECTED_LEXICON_SHA256 = '7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277'
EXPECTED_DICTIONARY_HASH = 'eaf808cd425024e1f84df62498abb8f7de9a39257b70dc0d069ac6f4d0cd05c1'
EXPECTED_RECOGNITION_SHA256 = '5d747a525609f648296297850223f3b01a8e628f75e1ca6ec9e1da9d919002f7'
HISTORY_FILES = (
    'public/puzzles.json', 'data/puzzles.json', 'data/rolling_content_v1.json',
    'data/tajenka_weekend_v1.json', 'data/tajenka_weekend_v2.json',
    'data/tajenka_v2_approved.json', 'data/tajenka_v2_board_candidates.json',
    'data/playtests/mozkokalypsa-v1.json', 'data/playtests/mozkokalypsa-v2.json',
    'data/playtests/mozkokalypsa-v3.json', 'data/legacy_daily_gen1.json',
    'data/legacy_daily_gen2.json', 'content/gen6/mozkokalypsa-100/bank.json',
)
ALPHABET = re.compile(r'[a-záčďéěíňóřšťúůýž]+')
CONTENT = ROOT / 'content/gen6/free-refresh-300'


def norm(word):
    return unicodedata.normalize('NFC', str(word)).strip().casefold()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def words(board):
    return {norm(answer['word']) for answer in board['answers']}


def identity(board):
    """No difficulty labels, metadata or order in geometry identity.

    Historical Tajenka boards may lack an explicit lengths list; derive it from
    their immutable target words. Their decoy cells remain part of the mask.
    """
    return digest({
        'rows': board['rows'], 'cols': board['cols'],
        'letters': board['letters'], 'mask': sorted(board['mask']),
        'lengths': sorted(board.get('lengths') or [len(norm(a['word'])) for a in board['answers']]),
        'answers': sorted((norm(a['word']), a['path']) for a in board['answers']),
    })


def walk_boards(node):
    if isinstance(node, dict):
        if all(key in node for key in ('id', 'answers', 'letters', 'mask', 'rows', 'cols')):
            yield node
        else:
            for value in node.values():
                yield from walk_boards(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk_boards(value)


def verify_sources(guard_path):
    guard = read(guard_path)
    records = guard['files']
    if len(records) != 46 or len({r['path'] for r in records}) != 46:
        raise ValueError('Expected 46 distinct frozen source records')
    checked = {}
    for record in records + guard.get('additionalOriginalV3GuardFiles', []):
        path = record['path']
        data = (ROOT / path).read_bytes()
        if (len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']
                or git_blob_sha(data) != record.get('gitSha1', record['blobSha'])):
            raise ValueError('Frozen source mismatch: ' + path)
        checked[path] = record['sha256']
    manifest = read(ROOT / 'content/lexicon-v3/working/manifest.json')
    permitted = {
        'data/puzzles.json': '1b21a4ed8b32603c9b93b6bf1eac2ac271144a838fa3bf1dccbc866d693b2937',
        'public/puzzles.json': '40b26607df1a236fbc9090edf5e34c1294693ab2887e02483cdef3e21b49827e',
    }
    deltas = []
    for path, original in manifest['provenance']['input_sha256'].items():
        actual = sha(ROOT / path)
        if actual != original:
            if actual != permitted.get(path):
                raise ValueError('Unexpected original v3 guard delta: ' + path)
            deltas.append({'path': path, 'originalSha256': original, 'actualSha256': actual})
    if {d['path'] for d in deltas} != set(permitted):
        raise ValueError('The exact two acknowledged production MK100 deltas are required')
    immutable = []
    for name, expected in manifest['outputs_sha256'].items():
        path = ROOT / 'content/lexicon-v3/working' / name
        if sha(path) != expected:
            raise ValueError('Immutable v3 output changed: ' + name)
        immutable.append({'path': str(path.relative_to(ROOT)).replace('\\', '/'), 'sha256': expected})
    if len(immutable) != 6:
        raise ValueError('Expected six immutable outputs')
    if sha(ROOT / 'content/lexicon-v3/working/lexicon.json') != EXPECTED_LEXICON_SHA256:
        raise ValueError('Wrong complete v3 lexicon')
    return {'sourceFilesVerified': 46, 'v3GuardPathsVerified': 28,
            'immutableV3OutputsVerified': 6, 'explicitInputDeltas': deltas,
            'guardFileSha256': sha(guard_path)}


class Units:
    """Only explicit lexicon and reviewed groups; no inferred stemming."""
    def __init__(self):
        self.parents = {}

    def find(self, word):
        word = norm(word)
        self.parents.setdefault(word, word)
        if self.parents[word] != word:
            self.parents[word] = self.find(self.parents[word])
        return self.parents[word]

    def union(self, members):
        normalized = [norm(w) for w in members if str(w).strip()]
        if not normalized:
            return
        roots = sorted({self.find(w) for w in normalized})
        root = roots[0]
        for member in roots:
            self.parents[member] = root


def lexical_units(entries):
    variants, families = Units(), Units()
    for word, entry in entries.items():
        variants.find(word)
        families.find(word)
        for key in ('variant_unit', 'variant_group'):
            value = entry.get(key)
            if value:
                variants.union([word] + re.split(r'[|/]', str(value)))
        value = entry.get('family')
        if value:
            families.union([word] + re.split(r'[|/]', str(value)))
    groups = read(ROOT / 'content/lexicon-v3/working/variant-groups.json')
    for group in groups['groups']:
        variants.union(group['members'])
    return variants, families


def history():
    identities, wordsets, ids, records = set(), set(), set(), {}
    for path in HISTORY_FILES:
        for board in walk_boards(read(ROOT / path)):
            raw_id, signature = str(board['id']), identity(board)
            # Preserve explicit historical re-use without hiding active conflicts.
            if path.endswith('tajenka_weekend_v1.json'):
                key = 'retired-tajenka-v1:' + raw_id
            elif path.endswith('tajenka_v2_board_candidates.json'):
                key = 'unreleased-tajenka-v2-candidate:' + raw_id
            elif 'legacy_daily_gen' in path:
                key = path + ':' + raw_id
            else:
                key = raw_id
            if key in records and records[key]['geometryHash'] != signature:
                raise ValueError('Conflicting raw historical identity: ' + key)
            records.setdefault(key, {'geometryHash': signature, 'words': sorted(words(board)), 'sources': []})
            records[key]['sources'].append(path)
            identities.add(signature)
            wordsets.add(digest(sorted(words(board))))
            ids.add(raw_id)
    public = read(ROOT / 'public/puzzles.json')
    rolling = read(ROOT / 'data/rolling_content_v1.json')['puzzles']
    recent, maximum_levels = {}, {}
    for diff in DIFFICULTIES:
        boards = list(public['free'][diff]) + list(rolling.get(diff, []))
        boards.sort(key=lambda b: (int(b.get('meta', {}).get('level', 0)), b['id']))
        # Sorting is confined to this offline audit, never mutates the playable bank.
        recent[diff] = [words(b) for b in boards]
        maximum_levels[diff] = max(int(b['meta']['level']) for b in boards)
    return {'geometryHashes': identities, 'wordsetHashes': wordsets, 'ids': ids,
            'records': records, 'recent': recent, 'maximumLevels': maximum_levels,
            'freeGeneration': public['freeGeneration']}


def profile_for(profiles, diff, ordinal):
    profile = deepcopy(profiles[diff])
    for variant in profile.pop('variants', []):
        if ordinal % variant['every'] == variant['remainder']:
            profile.update(variant['overrides'])
    return profile


def tier_mix(targets, entries, policy):
    counts = Counter(entries[word]['tier'] for word in targets)
    count = len(targets)
    return (all(counts[tier] + 1e-9 >= count * fraction
                for tier, fraction in policy.get('min_fraction', {}).items())
            and all(counts[tier] <= count * fraction + 1e-9
                    for tier, fraction in policy.get('max_fraction', {}).items()))


def proof_metadata(board):
    meta = board.get('meta') or {}
    # Current refresh places its independent correctness proof under validation.
    # Accept only the original Gen5 proof location as an explicitly named legacy
    # schema alternative, never a missing proof.
    proof = meta.get('validation') or (meta.get('gen5') or {}).get('verification')
    if not isinstance(proof, dict):
        raise ValueError('Missing stored correctness proof')
    if (proof.get('status') != 'unique' or proof.get('targetPathsUnique') is not True
            or proof.get('dictionaryHash') != EXPECTED_DICTIONARY_HASH
            or proof.get('dictionarySize') != 103836):
        raise ValueError('Invalid stored proof or dictionary binding')
    return proof


def audit(args):
    started = time.monotonic()
    sources = verify_sources(args.source_guard)
    bank = read(args.bank)
    boards = bank['boards']
    if len(boards) != 300 or Counter(b['difficulty'] for b in boards) != Counter({d: 100 for d in DIFFICULTIES}):
        raise ValueError('Exactly 100 Easy + 100 Medium + 100 Hard required')
    actual_hash = digest(boards)
    if bank.get('contentHash') != actual_hash or actual_hash != args.expected_content_hash:
        raise ValueError('Final board content hash differs from required original bank')
    lexicon = read(ROOT / 'content/lexicon-v3/working/lexicon.json')
    entries = {norm(entry['word']): entry for entry in lexicon['entries']}
    if len(entries) != 4290 or len(entries) != len(lexicon['entries']):
        raise ValueError('Complete 4290-word lexicon required without duplicate words')
    exclusions = {norm(w) for w in read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation']}
    exclusions |= {'červodíra', 'blockchain', 'pulsar', 'tensor'}
    profiles = read(ROOT / 'content/gen5/profiles.json')['profiles']
    variants, families = lexical_units(entries)
    historical = history()
    recognition = args.recognition
    if sha(recognition) != EXPECTED_RECOGNITION_SHA256:
        raise ValueError('Frozen full recognition plaintext changed')
    dictionary = sorted({norm(line) for line in recognition.read_text(encoding='utf8').splitlines() if line.strip()})
    if len(dictionary) != 103836 or digest(dictionary) != EXPECTED_DICTIONARY_HASH:
        raise ValueError('Exact frozen 103836-word correctness dictionary required')
    solver = Solver(dictionary)
    # Preserve original difficulty calibration prefixes; the broad solver union
    # is solely for correctness, never a change to the calibrated ambiguity band.
    baseline_words = {norm(w) for w in (ROOT / 'data/words.txt').read_text(encoding='utf8').splitlines()}
    prefixes = Solver(baseline_words | set(entries)).prefixes
    new_counts = {diff: Counter() for diff in DIFFICULTIES}
    global_new = Counter()
    ordinals, geometries, wordsets, ids = Counter(), set(), set(), set()
    checks, issues = [], []
    for index, board in enumerate(boards, 1):
        diff = board['difficulty']
        ordinal = ordinals[diff] + 1
        board_issues = []
        metrics = None
        verified = None
        target = words(board)
        signature = identity(board)
        wordset = digest(sorted(target))
        expected_id = f'g6-refresh-{diff}-{ordinal:03d}'
        if board['id'] != expected_id or board['id'] in ids or board['id'] in historical['ids']:
            board_issues.append('ID/order collision')
        expected_level = historical['maximumLevels'][diff] + ordinal
        meta = board.get('meta') or {}
        if int(meta.get('level', 0)) != expected_level:
            board_issues.append('level must follow the previous maximum, preserving reserved slots')
        if meta.get('contentGeneration') != 4 or meta.get('generatorGeneration') != 6:
            board_issues.append('runtime/generator generation mismatch')
        if signature in historical['geometryHashes'] or signature in geometries:
            board_issues.append('historical/new geometry duplicate')
        if wordset in historical['wordsetHashes'] or wordset in wordsets:
            board_issues.append('historical/new answer-set duplicate')
        profile = profile_for(profiles, diff, ordinal)
        eligible = {word for word, entry in entries.items()
                    if entry.get('target_eligible') is True and word not in exclusions
                    and entry['tier'] in profile['policy']['allowed']
                    and profile['min_len'] <= len(word) <= profile['max_len']
                    and entry.get('fun', 3) >= 3 and ALPHABET.fullmatch(word)}
        if not target <= eligible:
            board_issues.append('target outside approved v3/profile eligibility')
        if target <= set(entries) and not tier_mix(target, entries, profile['policy']):
            board_issues.append('tier composition')
        topic_count = len({entries[word].get('capacity_topic') or entries[word].get('topic') or entries[word].get('theme')
                           for word in target if word in entries})
        if topic_count < 3:
            board_issues.append('fewer than three explicit topics')
        if len({variants.find(w) for w in target}) != len(target):
            board_issues.append('duplicate reviewed variant unit inside board')
        if len({families.find(w) for w in target}) != len(target):
            board_issues.append('duplicate explicit lexical family inside board')
        cooldown = profile['cooldown']
        recent = historical['recent'][diff][-cooldown:] if cooldown else []
        recent_words = set().union(*recent) if recent else set()
        recent_units = {variants.find(w) for w in recent_words}
        if any(variants.find(w) in recent_units for w in target):
            board_issues.append('explicit variant/word cooldown')
        if any(new_counts[diff][w] >= profile['new_word_cap'] for w in target):
            board_issues.append('per-difficulty new-word cap')
        if any(global_new[w] >= 3 for w in target):
            board_issues.append('global new-word cap 3')
        try:
            metrics = structural(board)
            board_issues += ['geometry:' + error for error in geometry_errors(metrics, profile)]
            score = ambiguity.board_metrics(board, prefixes, 4)['localAmbiguityScore']
            if not profile['ambiguity'][0] <= score <= profile['ambiguity'][1]:
                board_issues.append('calibrated ambiguity band')
            proof_metadata(board)
            verified = solver.verify(board, seconds=15, node_limit=2_000_000)
            if verified['status'] != 'unique' or not verified['targetPathsUnique']:
                board_issues.append('broad dictionary proof:' + verified['status'])
        except (ValueError, KeyError, TypeError) as error:
            board_issues.append('validation exception:' + str(error))
            score = None
        checks.append({
            'id': board['id'], 'difficulty': diff, 'ordinal': ordinal,
            'runtimeLevel': meta.get('level'), 'geometryHash': signature,
            'geometry': metrics, 'ambiguityScore': score, 'topics': topic_count,
            'solver': verified, 'allPassed': not board_issues, 'issues': board_issues,
        })
        issues += [{'id': board['id'], 'reason': reason} for reason in board_issues]
        # Advance the independently reconstructed ledger even after a failure so
        # the report can diagnose every final board in its actual serialized order.
        ids.add(board['id'])
        geometries.add(signature)
        wordsets.add(wordset)
        ordinals[diff] += 1
        historical['recent'][diff].append(target)
        new_counts[diff].update(target)
        global_new.update(target)
        if index % 25 == 0:
            print(f'Independent recovered audit: {index}/300; issues={len(issues)}', flush=True)
    report = {
        'schemaVersion': 1, 'kind': 'reconstructed-independent-lower-refresh-audit',
        'asOf': '2026-10-02', 'scope': 'All 300 final boards, original tools and raw source ledger',
        'originalAuditImplementationRecovered': False,
        'originalAuditReportRecovered': False,
        'contentSourceMain': '5fc234e8e481950a68a25bf77f0103fab936532f',
        'currentUiMain': '202899e93c8298207a9d33cce1d9cee442a3009e',
        'bankFileSha256': sha(args.bank), 'contentHash': actual_hash,
        'requiredOriginalContentHash': args.expected_content_hash,
        'historicalOriginalBankFileSha256': HISTORICAL_BANK_SHA256,
        'historicalOriginalBankFileBytesMatch': sha(args.bank) == HISTORICAL_BANK_SHA256,
        'counts': dict(ordinals), 'lexiconSha256': EXPECTED_LEXICON_SHA256,
        'dictionarySize': len(dictionary), 'dictionaryHash': solver.hash,
        'recognitionPlaintextSha256': sha(recognition),
        'historySources': list(HISTORY_FILES), 'historyInventoryRecords': len(historical['records']),
        'lastOriginalLevels': historical['maximumLevels'],
        'maxNewWordUsesByDifficulty': {d: max(c.values(), default=0) for d, c in new_counts.items()},
        'maxNewGlobalWordUses': max(global_new.values(), default=0),
        'verifierSha256': sha(Path(__file__)), 'allPassed': not issues,
        'issues': issues, 'checks': checks, 'seconds': round(time.monotonic() - started, 3),
        'productionWrites': False, 'publicationAuthorized': False, **sources,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'allPassed': report['allPassed'], 'issues': len(issues),
                      'contentHash': actual_hash, 'output': str(args.output)}, ensure_ascii=False))
    return not issues


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-guard', type=Path, default=ROOT / 'SOURCE_INPUTS_RECOVERED.json')
    parser.add_argument('--bank', type=Path, default=CONTENT / 'bank.json')
    parser.add_argument('--recognition', type=Path, default=CONTENT / 'recognition-words.txt')
    parser.add_argument('--output', type=Path, default=CONTENT / 'independent-recovered-verification.json')
    parser.add_argument('--expected-content-hash', default=EXPECTED_CONTENT_HASH)
    raise SystemExit(0 if audit(parser.parse_args()) else 1)
