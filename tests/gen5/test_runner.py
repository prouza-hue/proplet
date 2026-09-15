"""Safety boundaries for acceptance and offline output, without generating levels."""
from collections import Counter
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
import unittest

from tools.gen5.catalog import Catalog, DIFFICULTIES, ROOT
from tools.gen5.runner import safe_directory, validate_bank
from tools.gen5.validation import Solver


def fixture():
    p=deepcopy(Catalog().profiles['easy'])
    p.update(rows=2,cols=2,cells=[4,4],words=[1,1],min_len=4,max_len=4,
             min_bbox_rows=2,min_bbox_cols=2,max_mean_turns=3,max_path_turns=3,
             max_curl_run=2,max_curl_paths=1,max_mean_straight_share=1,ambiguity=[0,1000])
    c=SimpleNamespace(profiles={d:deepcopy(p) for d in DIFFICULTIES},
        history={d:[] for d in DIFFICULTIES},counts={d:Counter() for d in DIFFICULTIES},
        global_counts=Counter(),historical_ids=set(),historical_words_hashes=set(),
        entries={'abcd':{'tier':'A'}},words=Catalog.words)
    c.eligible=lambda d:c.entries
    b={'id':'g5-pilot-easy-001','difficulty':'easy','meta':{'level':1},'rows':2,'cols':2,
       'mask':[0,1,2,3],'letters':list('ABDC'),'lengths':[4],
       'answers':[{'word':'ABCD','path':[0,1,3,2]}]}
    return c,b


class RunnerTests(unittest.TestCase):
    def test_rejects_production_and_unnamed_lab_output(self):
        for path in (ROOT/'public',ROOT/'data/puzzles.json',ROOT/'lab-output/gen5',ROOT/'lab-output/gen5/../../public'):
            with self.subTest(path=path),self.assertRaises(ValueError):
                safe_directory(path)
        self.assertEqual(safe_directory(ROOT/'lab-output/gen5/named'),(ROOT/'lab-output/gen5/named').resolve())

    def test_valid_board_survives_independent_full_check(self):
        c,b=fixture()
        e=validate_bank(c,[b],Solver(['abcd']))
        self.assertEqual(e.new['easy']['abcd'],1)

    def test_gap_or_forged_level_cannot_be_accepted(self):
        for field in ('id','level'):
            c,b=fixture()
            if field=='id':b['id']='g5-pilot-easy-002'
            else:b['meta']['level']=2
            with self.assertRaisesRegex(ValueError,'order or level gap'):
                validate_bank(c,[b],Solver(['abcd']),full=False)

    def test_dimensions_recomputed_against_profile(self):
        c,b=fixture();c.profiles['easy']['rows']=3
        with self.assertRaisesRegex(ValueError,'dimensions'):
            validate_bank(c,[b],Solver(['abcd']),full=False)

    def test_full_check_rejects_alternative_dictionary_cover(self):
        c,b=fixture()
        with self.assertRaisesRegex(ValueError,'Independent solver rejection'):
            validate_bank(c,[b],Solver(['abcd','dcba']))


if __name__=='__main__':
    unittest.main()
