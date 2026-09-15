"""Private release envelope regressions; no generation or production writes."""
from collections import Counter
from copy import deepcopy
from types import SimpleNamespace
import unittest

from tools.gen5.catalog import Catalog, DIFFICULTIES, digest
from tools.gen5.package import package_candidate


def fixture():
    base, history = {}, {}
    for d in DIFFICULTIES:
        old = {'id': 'old-' + d, 'difficulty': d,
               'answers': [{'word': 'mrak'}], 'meta': {'level': 1, 'contentGeneration': 4}}
        reserved = {'id': 'reserved-' + d, 'difficulty': d,
                    'answers': [{'word': 'slon'}], 'meta': {'level': 2, 'contentGeneration': 4}}
        base[d] = [old]
        history[d] = [old, reserved]
    catalog = SimpleNamespace(base=base, history=history, free_generation=4,
                              historical_ids={b['id'] for bs in history.values() for b in bs},
                              global_counts=Counter({'mrak': 5}), words=Catalog.words,
                              entries={'mrak': {'tier': 'A', 'origin': 'v1_curated'},
                                       'atom': {'tier': 'D', 'origin': 'wikidata_frequency_candidate'}})
    boards = [{'id': 'g5-test-' + d + '-001', 'difficulty': d,
               'answers': [{'word': 'MRAK'}, {'word': 'ATOM'}],
               'meta': {'level': 3, 'contentGeneration': 5, 'releaseCandidate': True}}
              for d in DIFFICULTIES]
    state = {'kind': 'gen5-series', 'schemaVersion': 1,
             'status': 'generated-verified-unpublished', 'puzzles': boards,
             'plan': {'seriesId': 'g5-test', 'counts': {d: 1 for d in DIFFICULTIES}},
             'inputs': {'public/puzzles.json': 'frozen-sha'}, 'contentHash': digest(boards)}
    return state, catalog


class PackageTests(unittest.TestCase):
    def test_preserves_runtime_generation_and_does_not_mutate_inputs(self):
        state, catalog = fixture()
        before_state, before_history = deepcopy(state), deepcopy(catalog.history)
        result = package_candidate(state, catalog)
        self.assertEqual(result['runtimeFreeGeneration'], 4)
        self.assertEqual(result['status'], 'unpublished')
        for boards in result['puzzles'].values():
            self.assertEqual(boards[0]['meta']['contentGeneration'], 4)
            self.assertEqual(boards[0]['meta']['generatorGeneration'], 5)
        result['puzzles']['easy'][0]['answers'][0]['word'] = 'changed'
        self.assertEqual(state, before_state)
        self.assertEqual(catalog.history, before_history)

    def test_manifest_fingerprints_every_base_and_reserved_board(self):
        state, catalog = fixture()
        result = package_candidate(state, catalog)
        boundary = result['manifest']['boundaries']['easy']
        self.assertEqual((boundary['baseCount'], boundary['reservedCount'], boundary['nextLevel']), (1, 1, 3))
        self.assertEqual([r['sha256'] for r in boundary['frozenBoards']],
                         [digest(b) for b in catalog.history['easy']])
        self.assertEqual([r['source'] for r in boundary['frozenBoards']], ['base', 'reserved'])
        self.assertEqual(result['manifest']['frozenInputs'], state['inputs'])

    def test_audits_all_unique_words_without_automatic_bans(self):
        state, catalog = fixture()
        rows = {r['word']: r for r in package_candidate(state, catalog)['lexicalAudit']}
        self.assertEqual(set(rows), {'atom', 'mrak'})
        self.assertEqual(rows['atom']['uses'], 5)
        self.assertEqual(set(rows['atom']['priorityReasons']),
                         {'automatic-origin', 'never-used-in-frozen-history', 'tier-D'})
        self.assertEqual(rows['mrak']['priorGlobalUses'], 5)
        self.assertEqual(rows['mrak']['priority'], 'normal')
        self.assertTrue(all(r['reviewStatus'] == 'pending' for r in rows.values()))

    def test_rejects_incomplete_status_or_count(self):
        state, catalog = fixture()
        state['status'] = 'incomplete'
        with self.assertRaises(ValueError):
            package_candidate(state, catalog)
        state['status'] = 'generated-verified-unpublished'
        state['puzzles'].pop()
        state['contentHash'] = digest(state['puzzles'])
        with self.assertRaises(ValueError):
            package_candidate(state, catalog)

    def test_rejects_noncanonical_order_or_new_level_gap(self):
        for change in ('order', 'level'):
            with self.subTest(change=change):
                state, catalog = fixture()
                if change == 'order':
                    state['puzzles'][0], state['puzzles'][1] = state['puzzles'][1], state['puzzles'][0]
                else:
                    state['puzzles'][0]['meta']['level'] = 4
                state['contentHash'] = digest(state['puzzles'])
                with self.assertRaises(ValueError):
                    package_candidate(state, catalog)

    def test_rejects_changed_hash_or_frozen_history_gap(self):
        state, catalog = fixture()
        state['puzzles'][0]['answers'][0]['word'] = 'ATOM'
        with self.assertRaises(ValueError):
            package_candidate(state, catalog)
        state, catalog = fixture()
        catalog.history['easy'][1]['meta']['level'] = 4
        with self.assertRaises(ValueError):
            package_candidate(state, catalog)


if __name__ == '__main__':
    unittest.main()
