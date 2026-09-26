"""Risk-oriented offline gates: approval, history, recognition and no-repeat capacity."""
from copy import deepcopy
from datetime import date
from pathlib import Path
import random
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from tools.gen6.catalog import CandidateCatalog, additions_from, classify, frozen_validation_words
from tools.gen6.round3 import RefreshedExposure, choose_refreshed_words
from tools.gen5.validation import Solver
from tools.gen5.catalog import digest


class CandidateGates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=CandidateCatalog(ROOT/'content/lexicon-v3/candidate-lexicon.json','2026-09-26')

    def test_provenance_flags_and_individual_source_evidence_are_required(self):
        entry=deepcopy(next(iter(self.catalog.additions.values())))
        for change in ({'runtime_approved':True}, {'evidence':[{'verified':False}]},
                       {'editorial_status':'pending'},{'reviewer':None}):
            with self.subTest(change=change),self.assertRaises(ValueError):
                additions_from({'entries':[{**entry,**change}]},{},set())
        self.assertEqual({},additions_from({'entries':[{**entry,'candidate_generation_allowed':False}]},{},set()))

    def test_explicit_exclusion_cannot_be_overridden_by_approval(self):
        entry=deepcopy(next(iter(self.catalog.additions.values())))
        with self.assertRaisesRegex(ValueError,'excluded'):
            additions_from({'entries':[{**entry,'word':'LUNOCHOD'}]},{},set())

    def test_all_new_words_and_browser_static_words_enter_solver_union(self):
        words=set(frozen_validation_words(self.catalog))
        self.assertTrue(set(self.catalog.additions)<=words)
        self.assertNotIn('negr',words)
        self.assertGreater(len(words),len(self.catalog.entries))

    def test_larger_dictionary_exposes_hidden_alternative_solution(self):
        board={'rows':2,'cols':4,'mask':list(range(8)),'letters':list('ABCDEFGH'),
               'lengths':[4,4],'answers':[{'word':'ABCD','path':[0,1,2,3]},
                                         {'word':'EFGH','path':[4,5,6,7]}]}
        self.assertEqual('unique',Solver(['abcd','efgh']).verify(board)['status'])
        self.assertEqual('multiple',Solver(['abcd','efgh','abfe','cdhg']).verify(board)['status'])
        self.assertEqual('unknown_budget',Solver(['abcd','efgh']).verify(board,node_limit=1)['status'])

    def test_twelve_board_allocation_is_possible_without_any_repeat(self):
        exposure=RefreshedExposure(self.catalog);all_words=[]
        for ordinal in range(12):
            seed=int(digest([2026092603,'round3',ordinal+1])[:16],16)
            words=choose_refreshed_words(self.catalog,exposure,random.Random(seed))
            self.assertEqual(14,len(words));self.assertEqual(100,sum(map(len,words)))
            self.assertFalse(set(words)&self.catalog.playtest_words)
            all_words.extend(words)
            exposure.add({'difficulty':'mozkomor','answers':[{'word':w} for w in words]})
        self.assertEqual(168,len(set(all_words)))

    def test_history_records_tajenka_future_and_never_infers_personal_exposure(self):
        current=self.catalog.inventory['tajenka-v2-week-07']['sources'][0]
        future=self.catalog.inventory['tajenka-v2-week-08']['sources'][0]
        self.assertEqual('2026-09-26',current['availableFrom'])
        self.assertEqual('released-or-available',current['availabilityStatus'])
        self.assertEqual('reserved-future',future['availabilityStatus'])
        self.assertTrue(all(s['personalExposure']=='unknown-not-inferred'
                            for r in self.catalog.inventory.values() for s in r['sources']))
        compatibility=self.catalog.inventory['g3-d-007']['sources']
        self.assertTrue(all(s['availabilityStatus']=='retired-snapshot-not-personal-exposure' for s in compatibility))


if __name__=='__main__':unittest.main()
