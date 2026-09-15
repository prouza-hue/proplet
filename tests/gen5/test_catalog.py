"""Cheap allocator regressions, isolated from production content and generation."""
from collections import Counter
from copy import deepcopy
from itertools import combinations_with_replacement, product
import random
from types import SimpleNamespace
import unittest

from tools.gen5.catalog import Catalog, DIFFICULTIES, Exposure, assign_tiers, choose_words, digest, length_shapes


def board(difficulty, *words):
    return {'difficulty': difficulty, 'answers': [{'word': w} for w in words]}


def catalog():
    entries = {w: {'tier': 'A', 'fun': 3, 'theme': str(i)} for i, w in enumerate(
        ('mrak', 'slon', 'krok', 'jelen', 'kabát', 'banán', 'lesník'))}
    p = {'min_len': 4, 'max_len': 6, 'words': [2, 2], 'cells': [9, 10],
         'max_four_words': 1, 'cooldown': 1, 'new_word_cap': 2,
         'policy': {'allowed': ['A'], 'weights': {'A': 1}}}
    c = SimpleNamespace(entries=entries, profiles={d: deepcopy(p) for d in DIFFICULTIES},
                        history={d: [] for d in DIFFICULTIES}, counts={d: Counter() for d in DIFFICULTIES},
                        global_counts=Counter(), historical_words_hashes=set(), words=Catalog.words)
    c.eligible = lambda d: c.entries.copy()
    return c


class LengthShapeTests(unittest.TestCase):
    def test_shapes_match_exhaustive_feasibility(self):
        expected = {s for count in (2, 3) for s in combinations_with_replacement(range(4, 8), count)
                    if 10 <= sum(s) <= 17 and s.count(4) <= 1}
        actual = length_shapes(4, 7, 2, 3, 10, 17, 1)
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(set(actual)))

    def test_impossible_constraints_have_no_shapes(self):
        self.assertEqual(length_shapes(4, 4, 2, 2, 8, 8, 1), ())


class AllocationTests(unittest.TestCase):
    def test_seeded_choice_respects_lengths_and_historical_cooldown(self):
        c = catalog()
        c.history['easy'] = [board('easy', 'mrak', 'jelen')]
        e = Exposure(c)
        for seed in range(20):
            first = choose_words(c, e, 'easy', random.Random(seed))
            self.assertEqual(first, choose_words(c, e, 'easy', random.Random(seed)))
            self.assertEqual(len(first), len(set(first)))
            self.assertFalse({'mrak', 'jelen'} & set(first))
            self.assertLessEqual(sum(len(w) == 4 for w in first), 1)
            self.assertTrue(9 <= sum(map(len, first)) <= 10)

    def test_fun_score_no_longer_forces_or_weights_an_anchor(self):
        c = catalog()
        e = Exposure(c)
        expected = choose_words(c, e, 'easy', random.Random(9))
        c.entries['mrak']['fun'] = 5
        self.assertEqual(e.weight('easy', 'mrak'), e.weight('easy', 'slon'))
        self.assertEqual(expected, choose_words(c, e, 'easy', random.Random(9)))

    def test_new_word_cap_survives_cooldown_and_resume(self):
        c = catalog()
        accepted = [board('easy', 'mrak'), board('easy', 'slon'),
                    board('easy', 'mrak'), board('easy', 'krok')]
        live = Exposure(c)
        for b in accepted:
            live.add(b)
        resumed = Exposure(c, accepted)
        self.assertEqual(live.forbidden('easy'), {'mrak', 'krok'})
        self.assertEqual(live.forbidden('easy'), resumed.forbidden('easy'))
        self.assertEqual(live.global_new, resumed.global_new)
        self.assertEqual(choose_words(c, live, 'easy', random.Random(2)),
                         choose_words(c, resumed, 'easy', random.Random(2)))

    def test_other_difficulty_exposure_reduces_weight_without_local_ban(self):
        c = catalog()
        e = Exposure(c)
        before = e.weight('easy', 'mrak')
        e.add(board('hard', 'mrak'))
        self.assertLess(e.weight('easy', 'mrak'), before)
        self.assertNotIn('mrak', e.forbidden('easy'))
        c.counts['easy']['mrak'] = 10
        self.assertLess(e.weight('easy', 'mrak'), e.weight('easy', 'slon'))

    def test_exhausted_capacity_fails_without_reusing_forbidden_words(self):
        c = catalog()
        c.history['easy'] = [board('easy', *c.entries)]
        with self.assertRaisesRegex(ValueError, 'capacity'):
            choose_words(c, Exposure(c), 'easy', random.Random(1))

    def test_historical_target_set_and_unsatisfiable_tier_mix_rejected(self):
        c = catalog()
        c.entries = {w: e for w, e in c.entries.items() if w in ('mrak', 'jelen')}
        c.historical_words_hashes.add(digest(['jelen', 'mrak']))
        with self.assertRaises(ValueError):
            choose_words(c, Exposure(c), 'easy', random.Random(1))
        c.historical_words_hashes.clear()
        c.profiles['easy']['policy']['min_fraction'] = {'B': .5}
        with self.assertRaisesRegex(ValueError, 'tier mix'):
            choose_words(c, Exposure(c), 'easy', random.Random(1))


class TierAssignmentTests(unittest.TestCase):
    def test_feasibility_matches_exhaustive_assignment(self):
        rng = random.Random(38)
        shape = [4, 5, 4, 5]
        policy = {'weights': {'A': 1, 'B': 2, 'C': 1},
                  'min_fraction': {'A': .25, 'B': .25}, 'max_fraction': {'C': .25}}
        for case in range(50):
            capacity = {(n, t): rng.randrange(3) for n in (4, 5) for t in 'ABC'}
            entries = {}
            for (n, t), count in capacity.items():
                for _ in range(count):
                    entries[chr(97 + len(entries)) + 'a' * (n - 1)] = {'tier': t}
            valid = []
            for assignment in product('ABC', repeat=len(shape)):
                used = Counter(zip(shape, assignment))
                if (assignment.count('A') >= 1 and assignment.count('B') >= 1
                        and assignment.count('C') <= 1
                        and all(count <= capacity[pair] for pair, count in used.items())):
                    valid.append(assignment)
            with self.subTest(case=case):
                actual = assign_tiers(shape, entries, policy, random.Random(case))
                if valid:
                    self.assertIn(tuple(actual), valid)
                    self.assertEqual(actual, assign_tiers(shape, entries, policy, random.Random(case)))
                else:
                    self.assertIsNone(actual)

    def test_zero_cooldown_does_not_forbid_history(self):
        c = catalog()
        c.profiles['easy']['cooldown'] = 0
        c.history['easy'] = [board('easy', 'mrak')]
        self.assertEqual(Exposure(c).forbidden('easy'), set())


if __name__ == '__main__':
    unittest.main()
