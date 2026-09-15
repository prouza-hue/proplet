"""Independent validator must distinguish invalid, ambiguous and unproven boards."""
from copy import deepcopy
import unittest

from tools.gen5.validation import Budget, Solver, structural


def square():
    # A B / D C: ABCD follows the perimeter, with each cell used once.
    return {'rows': 2, 'cols': 2, 'mask': [0, 1, 2, 3], 'letters': list('ABDC'),
            'answers': [{'word': 'ABCD', 'path': [0, 1, 3, 2]}], 'lengths': [4]}


class StructuralTests(unittest.TestCase):
    def test_recomputes_metrics_instead_of_trusting_metadata(self):
        b = square()
        b['meta'] = {'meanTurns': 0, 'unique': True, 'coversMask': False}
        m = structural(b)
        self.assertEqual(m['meanTurns'], 2)
        self.assertEqual(m['cells'], 4)

    def test_invalid_paths_and_spelling_are_rejected(self):
        cases = [('non_orthogonal_path', {'word': 'ADBC', 'path': [0, 2, 1, 3]}),
                 ('path_overlap', {'word': 'ABAB', 'path': [0, 1, 0, 1]}),
                 ('spelling', {'word': 'ABCE', 'path': [0, 1, 3, 2]}),
                 ('target_path', {'word': 'ABCD', 'path': [False, 1, 3, 2]})]
        for error, answer in cases:
            with self.subTest(error=error):
                b = square()
                b['answers'] = [answer]
                with self.assertRaisesRegex(ValueError, error):
                    structural(b)

    def test_duplicate_target_and_overlapping_answers_are_rejected(self):
        b = square()
        b['answers'].append(deepcopy(b['answers'][0]))
        with self.assertRaisesRegex(ValueError, 'target_word'):
            structural(b)
        b['answers'][1] = {'word': 'DCBA', 'path': [2, 3, 1, 0]}
        with self.assertRaisesRegex(ValueError, 'path_overlap'):
            structural(b)

    def test_uncovered_active_cell_and_wrong_hud_lengths_rejected(self):
        b = {'rows': 2, 'cols': 3, 'mask': [0, 1, 2, 3, 4],
             'letters': ['A', 'B', 'X', 'D', 'C', ''],
             'answers': [{'word': 'ABCD', 'path': [0, 1, 4, 3]}], 'lengths': [4]}
        with self.assertRaisesRegex(ValueError, 'coverage_or_lengths'):
            structural(b)
        b = square()
        b['lengths'] = [5]
        with self.assertRaisesRegex(ValueError, 'coverage_or_lengths'):
            structural(b)

    def test_disconnected_active_islands_rejected(self):
        b = {'rows': 2, 'cols': 5, 'mask': [0, 1, 3, 4, 5, 6, 8, 9],
             'letters': ['A', 'B', '', 'E', 'F', 'D', 'C', '', 'H', 'G'],
             'answers': [{'word': 'ABCD', 'path': [0, 1, 6, 5]},
                         {'word': 'EFGH', 'path': [3, 4, 9, 8]}], 'lengths': [4, 4]}
        with self.assertRaisesRegex(ValueError, 'disconnected_board'):
            structural(b)


class ExactCoverTests(unittest.TestCase):
    def test_unique_cover_and_unique_target_path(self):
        result = Solver(['abcd']).verify(square())
        self.assertEqual(result['status'], 'unique')
        self.assertEqual(result['solutionsLowerBound'], 1)
        self.assertTrue(result['targetPathsUnique'])

    def test_non_target_dictionary_word_can_make_cover_ambiguous(self):
        result = Solver(['abcd', 'adcb']).verify(square())
        self.assertEqual(result['status'], 'multiple')
        self.assertEqual(result['solutionsLowerBound'], 2)
        self.assertTrue(result['targetPathsUnique'])

    def test_no_cover_is_distinct_from_timeout(self):
        result = Solver(['zzzz']).verify(square())
        self.assertEqual(result['status'], 'none')
        self.assertEqual(result['solutionsLowerBound'], 0)

    def test_enumeration_budget_exhaustion_never_claims_ambiguity(self):
        result = Solver(['abcd']).verify(square(), node_limit=0)
        self.assertEqual(result['status'], 'unknown_budget')
        self.assertEqual(result['solutionsLowerBound'], 0)
        self.assertFalse(result['targetPathsUnique'])

    def test_exact_cover_budget_exhaustion_never_claims_unique(self):
        solver = Solver(['abcd'])
        budget = Budget(float('inf'))
        solver.enumerate(square(), budget)
        result = solver.verify(square(), node_limit=budget.nodes)
        self.assertEqual(result['status'], 'unknown_budget')
        self.assertEqual(result['candidateCount'], 1)
        self.assertTrue(result['targetPathsUnique'])

    def test_multiple_paths_for_same_target_are_detected(self):
        b = square()
        b['letters'] = list('AAAA')
        b['answers'][0]['word'] = 'AAAA'
        structural(b)
        result = Solver(['aaaa']).verify(b)
        self.assertEqual(result['status'], 'multiple')
        self.assertFalse(result['targetPathsUnique'])

    def test_one_solution_before_timeout_is_not_proof_of_uniqueness(self):
        solver = Solver(['abcd', 'adcb'])
        budget = Budget(float('inf'))
        solver.enumerate(square(), budget)
        result = solver.verify(square(), node_limit=budget.nodes + 2)
        self.assertEqual(result['status'], 'unknown_budget')
        self.assertEqual(result['solutionsLowerBound'], 1)


if __name__ == '__main__':
    unittest.main()
