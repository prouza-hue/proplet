"""Behavioral quality contracts: distinguish interlocking from mere bend count."""
import json
from copy import deepcopy
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from tools.gen6.interwoven import (DIRECTORY, InterwovenCatalog, weave_metrics,
    accept_geometry, lexical_plan, check_series, EXPERIMENT)
from tools.gen5.validation import Solver, structural
from tools.gen5.catalog import read_json
from tools.build_gen6_preview import verify_bank

class InterwovenChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bank=read_json(DIRECTORY/'bank.json')
        cls.old=read_json(ROOT/'content/gen6/round3-eight/bank.json')
        cls.catalog=InterwovenCatalog()

    def test_integration_is_not_just_more_turns(self):
        # Old valid, heavily bent boards still fail the new weave criterion.
        self.assertTrue(all(not accept_geometry(b) for b in self.old['boards']))
        for new,old in zip(self.bank['boards'],self.old['boards']):
            self.assertTrue(accept_geometry(new))
            self.assertGreater(weave_metrics(new)['crossContacts'],weave_metrics(old)['crossContacts'])
            self.assertGreater(weave_metrics(new)['axisReentries'],weave_metrics(old)['axisReentries'])

    def test_measurement_is_rotation_and_word_order_invariant(self):
        b=self.bank['boards'][0];rot=deepcopy(b)
        rot['answers'].reverse()
        for a in rot['answers']:a['path']=[(c%10)*10+9-c//10 for c in a['path']]
        for k,v in weave_metrics(b).items():
            if k!='seamCrossers':self.assertEqual(v,weave_metrics(rot)[k],k)

    def test_overlap_is_not_false_interweaving(self):
        b=deepcopy(self.bank['boards'][0]);b['answers'][1]['path'][0]=b['answers'][0]['path'][0]
        with self.assertRaises(ValueError):weave_metrics(b)
        with self.assertRaises(ValueError):structural(b)

    def test_approved_lexicon_and_identity_isolation(self):
        self.assertEqual(self.old['lexiconHash'],self.bank['lexiconHash'])
        self.assertNotEqual(self.old['contentHash'],self.bank['contentHash'])
        self.assertFalse({b['id'] for b in self.old['boards']}&{b['id'] for b in self.bank['boards']})
        self.assertFalse(self.bank['publicationAuthorized'])
        self.assertNotEqual(self.old['experimentId'],self.bank['experimentId'])
        self.assertEqual(self.old['validationDictionary'],self.bank['validationDictionary'])
        self.assertEqual(1143,len(self.catalog.additions))
        self.assertEqual(8,len(lexical_plan(self.catalog)[1]))

    def test_complete_fair_solution_and_rejected_corruption(self):
        proofs=check_series(self.bank['boards'],self.catalog,Solver(self.catalog.full_dictionary()))
        self.assertEqual(8,len(proofs))
        verify_bank(self.bank)
        corrupted=deepcopy(self.bank);corrupted['boards'][0]['letters'][0]='X'
        with self.assertRaises(ValueError):verify_bank(corrupted)
        corrupted=deepcopy(self.bank);corrupted['boards'][0]['meta']['experimentId']='old-round'
        with self.assertRaises(ValueError):check_series(corrupted['boards'],self.catalog,Solver(self.catalog.full_dictionary()))

    def test_runtime_sources_and_old_bank_not_rewritten(self):
        import hashlib
        record=read_json(DIRECTORY/'verification.json')
        for name in ('word_recognition_v3330.py','data/playtests/mozkokalypsa-v2.json',
                     'content/lexicon-v3/working/lexicon.json','content/gen6/round3-eight/bank.json'):
            self.assertEqual(record['frozenInputs'][name],hashlib.sha256((ROOT/name).read_bytes()).hexdigest())

if __name__=='__main__':unittest.main()
