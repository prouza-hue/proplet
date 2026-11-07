"""Protect legacy consumers and avoid randomization inference from alternating cohorts."""
import contextlib
import io
import json
import unittest
from unittest.mock import patch
from tools import entry_experiment_readout as report


def cohort(assigned, completed=None, **extra):
    return dict(assigned=assigned, completed_24h=completed, investigate=0,
                assigned_last_hour=0, load_failures_last_hour=0, **extra)


def split_rows(hash_a, hash_b, alt_a, alt_b):
    rows = {}
    for variant, old, new in [('A', hash_a, alt_a), ('B', hash_b, alt_b)]:
        total = cohort(old['assigned'] + new['assigned'])
        total['policy_metrics'] = {'hash50_v1': old, 'alternating_v1': new}
        rows[variant] = total
    return rows


def output(rows, intact=True):
    text = io.StringIO()
    with contextlib.redirect_stdout(text):
        report.readout(rows, intact)
    return text.getvalue()


class ReadoutPolicyTests(unittest.TestCase):
    def test_legacy_hash_csv_keeps_inference(self):
        text = output({'A': cohort(200, 70), 'B': cohort(200, 100)})
        self.assertIn('95% interval', text)
        self.assertIn('Výsledek podporuje větev B.', text)

    def test_mixed_cohorts_never_pool_or_apply_srm_to_alternation(self):
        rows = split_rows(cohort(20, 4), cohort(11, 3), cohort(1000, 0), cohort(1, 1))
        # CSV JSON and direct database JSON are both supported.
        rows['A']['policy_metrics'] = json.dumps(rows['A']['policy_metrics'])
        with patch.object(report, 'binomial_p', wraps=report.binomial_p) as binomial:
            text = output(rows)
        binomial.assert_called_once_with(20, 11)
        self.assertIn('Dokončilo A 4/20, B 3/11.', text)
        self.assertIn('Dokončilo A 0/1000, B 1/1. Popisný rozdíl', text)
        self.assertNotIn('Výsledek podporuje větev', text)
        self.assertEqual(text.count('95% interval'), 1)

    def test_mature_alternation_requests_review_without_causal_winner(self):
        rows = split_rows(cohort(0, 0), cohort(0, 0), cohort(1000, 300), cohort(1000, 500))
        text = output(rows).split('Střídání alternating_v1.')[1]
        self.assertIn('vyžadují posouzení časového a akvizičního složení', text)
        self.assertNotIn('zatím není přesvědčivý', text)
        self.assertNotIn('95% interval', text)
        self.assertNotIn('Výsledek podporuje větev', text)

    def test_catchup_is_descriptive_and_preserves_hash_inference(self):
        rows = split_rows(cohort(20, 4), cohort(11, 3), cohort(1, 0), cohort(1, 1))
        rows['A']['policy_metrics']['catchup_v1'] = cohort(0, 0)
        rows['B']['policy_metrics']['catchup_v1'] = cohort(10, 7)
        rows['B']['assigned'] += 10
        with patch.object(report, 'binomial_p', wraps=report.binomial_p) as binomial:
            text = output(rows)
        binomial.assert_called_once_with(20, 11)
        catchup = text.split('Dorovnání catchup_v1.')[1]
        self.assertIn('Dokončilo A 0/0, B 7/10.', catchup)
        self.assertNotIn('95% interval', catchup)
        self.assertNotIn('Výsledek podporuje větev', catchup)

    def test_catchup_must_exist_in_both_row_breakdowns(self):
        rows = split_rows(cohort(1), cohort(1), cohort(1), cohort(1))
        rows['A']['policy_metrics']['catchup_v1'] = cohort(0)
        with self.assertRaises(ValueError):
            output(rows)

    def test_no_interim_outcomes(self):
        text = output(split_rows(cohort(20), cohort(11), cohort(4), cohort(4)))
        self.assertNotIn('Dokončilo', text)
        self.assertNotIn('95% interval', text)

    def test_total_operational_alarm_survives_policy_split(self):
        rows = split_rows(cohort(15), cohort(15), cohort(15), cohort(15))
        rows['A'].update(assigned_last_hour=30, load_failures_last_hour=5)
        self.assertIn('Zastavit nábor.', output(rows))

    def test_incomplete_policy_breakdown_fails_closed(self):
        rows = split_rows(cohort(1), cohort(1), cohort(1), cohort(1))
        del rows['B']['policy_metrics']['alternating_v1']
        with self.assertRaises(ValueError):
            output(rows)
        rows = split_rows(cohort(1), cohort(1), cohort(1), cohort(1))
        rows['A']['assigned'] += 1
        with self.assertRaises(ValueError):
            output(rows)


if __name__ == '__main__':
    unittest.main()
