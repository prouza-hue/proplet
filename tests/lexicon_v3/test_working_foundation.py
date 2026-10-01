"""Offline gates for the complete approved inventory and immutable live inputs."""
from copy import deepcopy
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.build_lexicon_v3_working import (
    DIRECTORY, OUTPUTS, build, original_inventory, read, sha, validated_reviews,
)


class WorkingFoundation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reviews = read(DIRECTORY / 'editorial-reviews.json')['records']
        cls.lexicon = read(DIRECTORY / 'lexicon.json')
        cls.capacity = read(DIRECTORY / 'capacity.json')

    def test_complete_inventory_and_preserved_finished_reviews(self):
        actual = validated_reviews(self.reviews)
        self.assertEqual(1143, len(actual))
        self.assertEqual({r['candidate_id'] for r in original_inventory()}, {r['candidate_id'] for r in actual})
        for records in (self.reviews[:-1], self.reviews + [self.reviews[0]]):
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                validated_reviews(records)
        old = next(r for r in actual if r['review_cohort'] == 'preserved-first-155')
        tampered = deepcopy(actual)
        next(r for r in tampered if r['candidate_id'] == old['candidate_id'])['meaning_cs'] = 'Changed historical decision'
        with self.assertRaisesRegex(ValueError, 'Frozen first-batch'):
            validated_reviews(tampered)

    def test_inventory_approval_does_not_authorize_runtime(self):
        self.assertFalse(self.lexicon['runtime_approved'])
        self.assertTrue(all(r['user_approval']['status'] == 'approved-inventory' for r in self.reviews))
        altered = deepcopy(self.reviews)
        altered[0]['runtime_approved'] = True
        with self.assertRaisesRegex(ValueError, 'separate'):
            validated_reviews(altered)
        altered = deepcopy(self.reviews)
        altered[-1]['editorial_status'] = 'pending'
        with self.assertRaisesRegex(ValueError, 'Unresolved'):
            validated_reviews(altered)

    def test_tier_is_one_explicit_editorial_class(self):
        for invalid in ('', 'AB', 'BC', 'ABCD', None):
            altered = deepcopy(self.reviews)
            next(r for r in altered if r['original_word'] == 'šlehač')['tier'] = invalid
            with self.subTest(tier=invalid), self.assertRaisesRegex(ValueError, 'classification'):
                validated_reviews(altered)

    def test_correction_source_limits_and_no_silent_exclusions(self):
        changes = [r for r in self.reviews if r['editorial_status'] != 'accepted']
        self.assertEqual([('zákruta', 'ZÁKRUT', 'corrected')],
                         [(r['original_word'], r['word'], r['editorial_status']) for r in changes])
        self.assertTrue(all(r['candidate_generation_allowed'] for r in self.reviews))
        gap = [r for r in self.reviews if not r['evidence']]
        self.assertEqual(['ZÁŠEVEK'], [r['word'] for r in gap])
        self.assertEqual('editorial-judgment-no-independent-reference', gap[0]['evidence_depth'])
        altered = deepcopy(self.reviews)
        next(r for r in altered if r['word'] == 'ZÁŠEVEK')['reference_limitation'] = ''
        with self.assertRaisesRegex(ValueError, 'explicit individual'):
            validated_reviews(altered)

    def test_legacy_fields_and_explicit_exclusions_survive(self):
        entries = {e['word']: e for e in self.lexicon['entries']}
        self.assertEqual(4290, len(entries))
        for old in read(ROOT / 'data/lexicon_v2.json')['entries']:
            self.assertEqual(old, {k: entries[old['word']][k] for k in old})
        excluded = set(read(ROOT / 'data/target_generation_exclusions_v334.json')['remove_from_target_generation'])
        self.assertEqual(42, len(excluded))
        self.assertEqual(excluded, {w for w,e in entries.items() if not e['target_eligible']})
        self.assertTrue(all(w in entries for w in excluded))
        self.assertTrue(all(len(w) >= 4 for w in entries))

    def test_profile_capacity_is_transparently_reproducible(self):
        expected_counts = {'easy': 805, 'medium': 1970, 'hard': 3835, 'hardcore': 4248, 'mozkomor': 3772}
        profiles = read(ROOT / 'content/gen5/profiles.json')['profiles']
        for name,p in profiles.items():
            got = self.capacity['profiles'][name]
            self.assertEqual(p, got['reference_profile'])
            expected = {e['word'] for e in self.lexicon['entries'] if e['target_eligible']
                        and p['min_len'] <= len(e['word']) <= p['max_len'] and e['tier'] in p['policy']['allowed']}
            self.assertEqual(expected, set(got['admissible_words']))
            self.assertEqual(expected_counts[name], len(expected))
            self.assertEqual(len(expected), sum(got['lexically_admissible']['breakdown']['source_cohort'].values()))

    def test_expanded_recognition_invalidates_inherited_proof_assumption(self):
        before = set((ROOT / 'content/gen6/recognition-words.txt').read_text().splitlines())
        after = set((DIRECTORY / 'recognition-words.txt').read_text().splitlines())
        self.assertTrue(before < after)
        self.assertEqual(703, len(after - before))
        self.assertTrue({e['word'] for e in self.lexicon['entries']} <= after)
        self.assertTrue(self.capacity['mozkokalypsa_iii_foundation']['prototype_requires_revalidation_against_full_recognition'])
        self.assertEqual(0, self.capacity['mozkokalypsa_iii_foundation']['new_boards_generated'])

    def test_build_is_reproducible_and_does_not_write_protected_inputs(self):
        manifest = read(DIRECTORY / 'manifest.json')
        protected = {ROOT / p: sha(ROOT / p) for p in manifest['provenance']['input_sha256'] if (ROOT / p).exists()}
        # A second build in place must be byte-identical. All inputs, runtime
        # banks, prototype bank and player-facing application files stay unchanged.
        paths = list(protected) + [ROOT / p for p in (
            'server.py', 'vercel.json', 'content/gen6/mozkokalypsa-v3-preview.json',
            'content/gen6/verification.json', 'content/gen6/replay.json')]
        protected = {p: sha(p) for p in paths}
        before = {p: (DIRECTORY / p).read_bytes() for p in (*OUTPUTS, 'manifest.json')}
        build()
        self.assertEqual(before, {p: (DIRECTORY / p).read_bytes() for p in before})
        self.assertEqual(protected, {p: sha(p) for p in protected})
        self.assertEqual(manifest['outputs_sha256'], {p: sha(DIRECTORY / p) for p in OUTPUTS})


if __name__ == '__main__':
    unittest.main()
