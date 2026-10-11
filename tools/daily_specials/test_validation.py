"""Negative fixtures: broad-word alternatives, duplicate paths, budget fail-closed."""
import unittest
from copy import deepcopy
from tools.gen5.validation import Solver, structural
from .independent import check

class ValidationTests(unittest.TestCase):
    def fixture(self):
        return {'difficulty':'mozkokalypsa','rows':2,'cols':2,'mask':[0,1,2,3],
                'letters':['A','B','D','C'],'lengths':[4],'answers':[{'word':'ABCD','path':[0,1,3,2]}]}
    def both(self,board,dictionary,status):
        a=Solver(dictionary).verify(board);b=check(board,dictionary)
        self.assertEqual(a['status'],status);self.assertEqual(b['status'],status)
        return a,b
    def test_unique(self):
        a,b=self.both(self.fixture(),['abcd'],'unique')
        self.assertTrue(a['targetPathsUnique']);self.assertTrue(b['uniqueCoverMatchesTargets'])
    def test_non_target_dictionary_word_breaks_uniqueness(self):
        self.both(self.fixture(),['abcd','adcb'],'multiple')
    def test_multiple_paths_of_the_same_target_are_rejected(self):
        p=self.fixture();p['letters']=['A','B','A','B'];p['answers'][0]['word']='ABBA'
        a,b=self.both(p,['abba'],'multiple')
        self.assertFalse(a['targetPathsUnique']);self.assertFalse(b['targetPathsUnique'])
    def test_target_missing_from_recognizer(self):
        self.both(self.fixture(),['zzzz'],'none')
    def test_timeout_is_never_unique(self):
        p=self.fixture();self.assertEqual(Solver(['abcd']).verify(p,seconds=0)['status'],'unknown_budget')
        self.assertEqual(check(p,['abcd'],seconds=0)['status'],'unknown_budget')
    def test_diagonal_path_rejected(self):
        p=self.fixture();p['answers'][0]['path']=[0,3,1,2]
        with self.assertRaises(ValueError):structural(p)
    def test_wrong_spelling_rejected(self):
        p=self.fixture();p['letters'][0]='Z'
        with self.assertRaises(ValueError):structural(p)
    def test_uncovered_cell_rejected(self):
        p=self.fixture();p['rows']=3;p['letters']+=['E',''];p['mask'].append(4)
        with self.assertRaises(ValueError):structural(p)
if __name__=='__main__':unittest.main()
