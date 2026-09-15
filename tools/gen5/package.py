"""Pure private packaging: preserve runtime progression and expose editorial review.

This produces additions and a manifest, never a rewritten production bank. The
caller must fully verify the completed series before calling this function.
"""
from collections import Counter, defaultdict
from copy import deepcopy
import re

from .catalog import DIFFICULTIES, digest


def package_candidate(state, catalog):
    """Return an unpublished envelope from a completed, verified series snapshot.

    ``catalog.free_generation`` is the frozen public bank's freeGeneration. It
    deliberately differs from the generator algorithm version (5): the runtime
    interprets a changed contentGeneration as replacement content/progression.
    No file reads, writes or mutations of either argument occur here.
    """
    if (state.get('kind') != 'gen5-series' or state.get('schemaVersion') != 1
            or state.get('status') != 'generated-verified-unpublished'):
        raise ValueError('Only a completed verified series can be packaged')
    plan = state['plan']
    counts = plan.get('counts', {})
    series_id = plan.get('seriesId', '')
    if (set(counts) != set(DIFFICULTIES)
            or any(type(n) is not int or not 0 <= n <= 100 for n in counts.values())
            or not sum(counts.values())
            or not re.fullmatch(r'g5-[a-z0-9-]{1,32}', series_id)):
        raise ValueError('Invalid completed series plan')
    boards = state['puzzles']
    expected = [(d, i) for i in range(1, max(counts.values()) + 1)
                for d in DIFFICULTIES if i <= counts[d]]
    if (len(boards) != len(expected)
            or [b['id'] for b in boards] != [f'{series_id}-{d}-{i:03d}' for d, i in expected]):
        raise ValueError('Series is incomplete or out of canonical order')
    if state.get('contentHash') != digest(boards):
        raise ValueError('Series content hash mismatch')
    runtime_generation = catalog.free_generation
    if type(runtime_generation) is not int or runtime_generation < 1:
        raise ValueError('Frozen runtime freeGeneration is required')

    boundaries, all_existing_ids = {}, set()
    for d in DIFFICULTIES:
        base, history = catalog.base[d], catalog.history[d]
        if [digest(b) for b in history[:len(base)]] != [digest(b) for b in base]:
            raise ValueError('Reserved history must preserve the base prefix: ' + d)
        if [b['meta']['level'] for b in history] != list(range(1, len(history) + 1)):
            raise ValueError('Frozen historical level gap or order mismatch: ' + d)
        rows = []
        for index, board in enumerate(history):
            if board['difficulty'] != d or board['id'] in all_existing_ids:
                raise ValueError('Conflicting frozen history: ' + board['id'])
            all_existing_ids.add(board['id'])
            rows.append({'id': board['id'], 'level': board['meta']['level'],
                         'sha256': digest(board),
                         'source': 'base' if index < len(base) else 'reserved'})
        boundaries[d] = {'baseCount': len(base), 'reservedCount': len(history) - len(base),
                         'frozenCount': len(history), 'frozenBoards': rows,
                         'baseHash': digest(base), 'historyHash': digest(history),
                         'nextLevel': len(history) + 1, 'additionCount': counts[d],
                         'lastNewLevel': len(history) + counts[d] if counts[d] else None}
    all_existing_ids |= catalog.historical_ids

    grouped = {d: [] for d in DIFFICULTIES}
    uses, difficulties = Counter(), defaultdict(Counter)
    for board, (d, ordinal) in zip(boards, expected):
        if (board['difficulty'] != d or board['id'] in all_existing_ids
                or board['meta']['level'] != boundaries[d]['nextLevel'] + ordinal - 1):
            raise ValueError('Addition collides with frozen history or leaves a level gap')
        if board['meta'].get('contentGeneration') != 5:
            raise ValueError('Expected a Gen5 manufacturing candidate')
        words = catalog.words(board)
        if not words <= set(catalog.entries):
            raise ValueError('Unknown target vocabulary')
        uses.update(words)
        for word in words:
            difficulties[word][d] += 1
        addition = deepcopy(board)
        addition['meta']['contentGeneration'] = runtime_generation
        addition['meta']['generatorGeneration'] = 5
        grouped[d].append(addition)

    audit = []
    for word in sorted(uses):
        entry = catalog.entries[word]
        origin = entry.get('origin', 'unknown')
        prior = catalog.global_counts[word]
        reasons = []
        if origin == 'wikidata_frequency_candidate':
            reasons.append('automatic-origin')
        if prior == 0:
            reasons.append('never-used-in-frozen-history')
        if entry['tier'] == 'D':
            reasons.append('tier-D')
        audit.append({'word': word, 'tier': entry['tier'], 'origin': origin,
                      'uses': uses[word], 'difficulties': sorted(difficulties[word]),
                      'usesByDifficulty': dict(sorted(difficulties[word].items())),
                      'priorGlobalUses': prior, 'priorityReasons': reasons,
                      'priority': 'high' if reasons else 'normal',
                      'reviewStatus': 'pending'})
    return {'schemaVersion': 1, 'kind': 'gen5-unpublished-package', 'status': 'unpublished',
            'runtimeFreeGeneration': runtime_generation, 'generatorGeneration': 5,
            'puzzles': grouped, 'lexicalAudit': audit,
            'manifest': {'seriesId': series_id, 'plannedCounts': deepcopy(counts),
                         'manufacturedContentHash': state['contentHash'],
                         'packagedContentHash': digest(grouped),
                         'frozenInputs': deepcopy(state['inputs']),
                         'boundaries': boundaries, 'existingBoardsModified': False,
                         'publicationStatus': 'not-authorized-by-package',
                         'lexicalReviewStatus': 'pending',
                         'availabilityPolicy': 'unresolved-preserve-reserved-order'}}
