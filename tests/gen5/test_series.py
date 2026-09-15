"""Manufacturing orchestration safety, with no generation or released-bank writes."""
from contextlib import ExitStack
from collections import Counter
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import threading
import unittest
from unittest.mock import patch

from tools.gen5 import series
from tools.gen5.catalog import Catalog, DIFFICULTIES, digest, profile_for
from tools.gen5.runner import BankValidator
from tools.gen5.validation import Solver


def plan(**counts):
    return {'seriesId': 'g5-test', 'seed': 42,
            'counts': {d: counts.get(d, 0) for d in DIFFICULTIES},
            'secondsPerBoard': 1, 'attemptsPerInvocation': 2, 'workers': 3}


def board(p, d, ordinal):
    return {'id': series.board_id(p, d, ordinal), 'difficulty': d,
            'meta': {'level': ordinal}}


def checkpoint(p, boards=()):
    boards = list(boards)
    return {'kind': 'gen5-series', 'schemaVersion': 1, 'plan': p,
            'inputs': {'frozen': 'same'}, 'puzzles': boards,
            'contentHash': digest(boards), 'status': 'incomplete',
            'attempts': {}, 'diagnostics': []}


class PlanAndCheckpointTests(unittest.TestCase):
    def test_easy_variant_schedule_preserves_approved_workload(self):
        catalog = Catalog()
        original = deepcopy(catalog.profiles['easy'])
        profiles = [profile_for(catalog, 'easy', i) for i in range(1, 101)]
        self.assertEqual(Counter((p['rows'], p['cols']) for p in profiles),
                         Counter({(5,5): 75, (6,6): 25}))
        preserved = ('cells', 'words', 'min_len', 'max_len', 'min_mean_turns',
                     'max_mean_turns', 'min_path_turns', 'max_path_turns',
                     'ambiguity', 'policy', 'cooldown', 'new_word_cap')
        for i, p in enumerate(profiles, 1):
            self.assertEqual((p['rows'], p['cols']), (6,6) if i % 4 == 0 else (5,5))
            for key in preserved:
                self.assertEqual(p[key], original[key], (i, key))
        self.assertEqual(catalog.profiles['easy'], original)

    def test_schedule_is_round_robin_and_honors_unequal_counts(self):
        p = plan(easy=3, medium=2, mozkomor=1)
        self.assertEqual(series.schedule(p), [
            ('easy', 1), ('medium', 1), ('mozkomor', 1),
            ('easy', 2), ('medium', 2), ('easy', 3)])

    def test_plan_rejects_out_of_scope_counts_and_identifiers(self):
        for key, value in [('seriesId', '../public'), ('seed', True),
                           ('workers', 0), ('workers', 1.5),
                           ('counts', {d: 101 for d in DIFFICULTIES}),
                           ('counts', {d: 0 for d in DIFFICULTIES})]:
            p = plan(easy=1)
            p[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                series.validate_plan(p)

    def test_attempt_budget_requires_an_integer(self):
        for value in (True, 1.5):
            p = plan(easy=1)
            p['attemptsPerInvocation'] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                series.validate_plan(p)

    def test_checkpoint_rejects_reordered_or_skipped_board(self):
        p = plan(easy=2, medium=1)
        for boards in ([board(p, 'medium', 1)],
                       [board(p, 'easy', 1), board(p, 'easy', 2)]):
            state = checkpoint(p, boards)
            with self.subTest(boards=boards), self.assertRaisesRegex(ValueError, 'canonical prefix'):
                series.verify_checkpoint(state, p, state['inputs'], None, None)

    def test_checkpoint_rejects_content_corruption_even_for_valid_prefix(self):
        p = plan(easy=1)
        state = checkpoint(p, [board(p, 'easy', 1)])
        state['puzzles'][0]['meta']['level'] = 999
        with self.assertRaisesRegex(ValueError, 'content hash'):
            series.verify_checkpoint(state, p, state['inputs'], None, None)

    def test_checkpoint_rejects_changed_plan_or_fingerprint(self):
        p = plan(easy=1)
        state = checkpoint(p)
        changed = deepcopy(p)
        changed['seed'] += 1
        for p_arg, inputs in ((changed, state['inputs']), (p, {'frozen': 'changed'})):
            with self.subTest(plan=p_arg, inputs=inputs), self.assertRaisesRegex(ValueError, 'Frozen'):
                series.verify_checkpoint(state, p_arg, inputs, None, None)

    def test_checkpoint_runs_independent_full_bank_validation(self):
        p = plan(easy=1)
        state = checkpoint(p, [board(p, 'easy', 1)])
        with patch.object(series, 'validate_bank') as validate:
            series.verify_checkpoint(state, p, state['inputs'], 'catalog', 'solver')
        validate.assert_called_once_with('catalog', state['puzzles'], 'solver',
                                         full=True, series_id=p['seriesId'])

    def test_checkpoint_rejects_false_completion_and_invalid_attempts(self):
        p = plan(easy=1)
        for key, value in [('status', 'generated-verified-unpublished'),
                           ('status', 'published'), ('attempts', {'unknown': 1}),
                           ('attempts', {series.board_id(p, 'easy', 1): -1}),
                           ('attempts', {series.board_id(p, 'easy', 1): True})]:
            state = checkpoint(p)
            state[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                series.verify_checkpoint(state, p, state['inputs'], None, None)

    def test_writer_lock_excludes_other_writer_and_releases_normally(self):
        with TemporaryDirectory(prefix='gen5-series-lock-') as tmp:
            root = Path(tmp)
            with series.writer_lock(root):
                with self.assertRaisesRegex(ValueError, 'Another writer'):
                    with series.writer_lock(root):
                        self.fail('Second writer acquired the lock')
            with series.writer_lock(root):
                pass

    def test_rejected_board_does_not_consume_any_acceptance_ledger_entry(self):
        p = deepcopy(Catalog().profiles['easy'])
        p.update(rows=2, cols=2, cells=[4,4], words=[1,1], min_len=4, max_len=4,
                 min_bbox_rows=2, min_bbox_cols=2, max_mean_turns=3, max_path_turns=3,
                 max_curl_run=2, max_curl_paths=1, max_mean_straight_share=1,
                 ambiguity=[0,1000])
        c = SimpleNamespace(profiles={d:deepcopy(p) for d in DIFFICULTIES},
            history={d:[] for d in DIFFICULTIES}, historical_ids=set(),
            historical_words_hashes=set(), entries={'abcd':{'tier':'A'}},
            words=Catalog.words)
        c.eligible = lambda d: c.entries
        b = {'id':'g5-test-easy-001', 'difficulty':'easy', 'meta':{'level':1},
             'rows':2, 'cols':2, 'mask':[0,1,2,3], 'letters':list('ABDC'),
             'lengths':[4], 'answers':[{'word':'ABCD', 'path':[0,1,3,2]}]}
        validator = BankValidator(c, Solver(['abcd','dcba']), 'g5-test')
        malformed = deepcopy(b)
        malformed['letters'][0] = 'X'
        with self.assertRaises(ValueError):
            validator.add(malformed, full=False)
        self.assertEqual(validator.ids, set())
        self.assertEqual(validator.wordsets, set())
        self.assertEqual(validator.ordinals, Counter())
        self.assertEqual(validator.exposure.global_new, Counter())
        with self.assertRaisesRegex(ValueError, 'Independent solver rejection'):
            validator.add(b)
        self.assertEqual(validator.ids, set())
        self.assertEqual(validator.wordsets, set())
        self.assertEqual(validator.ordinals, Counter())
        self.assertEqual(validator.exposure.global_new, Counter())
        validator.solver = Solver(['abcd'])
        validator.add(b)
        self.assertEqual(validator.ordinals['easy'], 1)
        self.assertEqual(validator.exposure.new['easy']['abcd'], 1)


class ManufacturingTests(unittest.TestCase):
    """Mock only costly generation/validation; exercise the real writer and ledger."""
    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        tmp = self.stack.enter_context(TemporaryDirectory(prefix='gen5-series-tests-'))
        self.output = Path(tmp) / 'run'
        self.stack.enter_context(patch.object(series, 'safe_directory', side_effect=lambda p: Path(p)))
        self.stack.enter_context(patch.object(series, 'Catalog', return_value=object()))
        self.stack.enter_context(patch.object(series, 'validation_words', return_value=[]))
        self.stack.enter_context(patch.object(series, 'Solver', return_value=SimpleNamespace(words=[], hash='lexicon')))
        self.stack.enter_context(patch.object(series, 'input_fingerprint', return_value={'frozen': 'same'}))
        self.validation = self.stack.enter_context(patch.object(series, 'validate_bank'))
        self.incremental = self.stack.enter_context(patch.object(series, 'BankValidator')).return_value
        self.stack.enter_context(patch.object(series, 'report', return_value={}))
        self.packager = self.stack.enter_context(patch.object(series, 'package_candidate', return_value={}))
        self.calls = []
        self.calls_lock = threading.Lock()

    def generator(self, p, fail=None):
        def run(d, ordinal, seed, accepted, seconds, series_id):
            with self.calls_lock:
                self.calls.append((d, ordinal, seed, deepcopy(accepted)))
            if fail and fail(d, ordinal):
                return {'board': None, 'diagnostics': {'status': 'no_candidate_within_budget'}}
            return {'board': board(p, d, ordinal), 'diagnostics': {'status': 'test_generated'}}
        return run

    def test_all_workers_share_completed_round_snapshot(self):
        p = plan(easy=2, medium=2)
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            result = series.manufacture(self.output, p)
        self.assertEqual(result['status'], 'generated-verified-unpublished')
        self.assertEqual([b['id'] for b in result['puzzles']],
                         [series.board_id(p, d, i) for d, i in series.schedule(p)])
        for d, ordinal, seed, accepted in self.calls:
            expected = [] if ordinal == 1 else result['puzzles'][:2]
            self.assertEqual(accepted, expected, (d, ordinal))
        self.assertTrue(self.validation.call_args.kwargs['full'])

    def test_failed_job_stops_at_canonical_prefix_and_retry_seed_advances(self):
        p = plan(easy=2, medium=2, hard=1)
        with patch.object(series, 'run_job', side_effect=self.generator(p, lambda d, i: d == 'medium')):
            result = series.manufacture(self.output, p)
        self.assertEqual(result['status'], 'incomplete')
        self.assertEqual([b['id'] for b in result['puzzles']], [series.board_id(p, 'easy', 1)])
        attempts = [call for call in self.calls if call[0] == 'medium']
        self.assertEqual(len(attempts), 2)
        self.assertNotEqual(attempts[0][2], attempts[1][2])
        self.assertEqual(result['attempts'][series.board_id(p, 'medium', 1)], 2)
        self.assertTrue(all(call[1] == 1 for call in self.calls))

    def test_resume_partial_round_restores_snapshot_and_attempt_seed(self):
        p = plan(easy=2, medium=2)
        with patch.object(series, 'run_job', side_effect=self.generator(p, lambda d, i: d == 'medium')):
            initial = series.manufacture(self.output, p)
        self.calls.clear()
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            resumed = series.manufacture(self.output, p, resume=True)
        self.assertEqual(resumed['status'], 'generated-verified-unpublished')
        middle = next(c for c in self.calls if c[0:2] == ('medium', 1))
        self.assertEqual(middle[3], [])  # Completed easy-001 is NOT part of this round's snapshot.
        self.assertEqual(middle[2], int(digest([p['seed'], p['seriesId'], 'medium', 1, 2])[:16], 16))
        self.assertFalse(any(c[0:2] == ('easy', 1) for c in self.calls))
        self.assertEqual(resumed['puzzles'][0], initial['puzzles'][0])

    def test_clean_round_pause_then_resume_matches_uninterrupted_boards(self):
        p = plan(easy=2, medium=2)
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            paused = series.manufacture(self.output, p, max_rounds=1)
            self.assertEqual(len(paused['puzzles']), 2)
            self.assertEqual(paused['status'], 'incomplete')
            resumed = series.manufacture(self.output, p, resume=True)
            fresh = series.manufacture(self.output.parent / 'fresh', p)
        self.assertEqual(resumed['contentHash'], fresh['contentHash'])
        self.assertEqual(resumed['attempts'], fresh['attempts'])

    def test_acceptance_rejection_retries_without_advancing_ledger(self):
        p = plan(easy=1)
        rejected = False
        def validate(board, full=True):
            nonlocal rejected
            if not full and not rejected:
                rejected = True
                raise ValueError('Repeated word set')
        self.incremental.add.side_effect = validate
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            result = series.manufacture(self.output, p)
        self.assertEqual(len(result['puzzles']), 1)
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[0][3], self.calls[1][3])
        self.assertEqual(result['diagnostics'][0]['status'], 'acceptance_rejected')

    def test_wrong_job_result_is_rejected_before_checkpoint_write(self):
        p = plan(easy=1)
        wrong = {'board': board(p, 'medium', 1), 'diagnostics': {}}
        with patch.object(series, 'run_job', return_value=wrong):
            result = series.manufacture(self.output, p)
        self.assertEqual(result['puzzles'], [])
        self.assertEqual(result['status'], 'incomplete')
        self.incremental.add.assert_not_called()
        self.assertTrue(all(d['status'] == 'acceptance_rejected' for d in result['diagnostics']))

    def test_failed_final_validation_never_marks_checkpoint_verified(self):
        p = plan(easy=1)
        def validate(catalog, boards, solver, full=True, **kwargs):
            if full:
                raise ValueError('Independent solver rejection')
        self.validation.side_effect = validate
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            with self.assertRaisesRegex(ValueError, 'Independent solver'):
                series.manufacture(self.output, p)
        saved = series.read_json(self.output / 'series.json')
        self.assertEqual(saved['status'], 'incomplete')
        self.assertFalse((self.output / 'report.json').exists())

    def test_validate_only_does_not_generate_or_change_checkpoint(self):
        p = plan(easy=1)
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            series.manufacture(self.output, p)
        before = (self.output / 'series.json').read_bytes()
        with patch.object(series, 'run_job') as job:
            result = series.manufacture(self.output, p, validate_only=True)
        job.assert_not_called()
        self.assertEqual(result['status'], 'generated-verified-unpublished')
        self.assertEqual(before, (self.output / 'series.json').read_bytes())

    def test_second_fresh_run_cannot_overwrite_checkpoint(self):
        p = plan(easy=1)
        with patch.object(series, 'run_job', side_effect=self.generator(p)):
            series.manufacture(self.output, p)
        before = (self.output / 'series.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            series.manufacture(self.output, p)
        self.assertEqual(before, (self.output / 'series.json').read_bytes())


if __name__ == '__main__':
    unittest.main()
