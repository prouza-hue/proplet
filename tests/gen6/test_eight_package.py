"""Regressions specific to the complete eight-board, full-v3 package."""
from copy import deepcopy
import unittest
from unittest.mock import patch

from tools.gen5.catalog import ROOT, digest, read_json
from tools.gen5.validation import Solver
from tools.gen6.full_catalog import FullCatalog
from tools.gen6.eight import allocate, check_series
from tools.build_gen6_preview import verify_bank


class EightPackage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = FullCatalog()
        cls.bank = read_json(ROOT/'content/gen6/round3-eight/bank.json')
        cls.report = read_json(ROOT/'content/gen6/round3-eight/verification.json')
        cls.solver = Solver(cls.catalog.full_dictionary())

    def test_real_solver_full_v3_and_runtime_fallback(self):
        self.assertEqual(1143, len(self.catalog.additions))
        self.assertEqual(4290, len(self.catalog.entries))
        self.assertEqual(self.bank['validationDictionary']['sha256'], self.solver.hash)
        self.assertEqual(103836, len(self.solver.words))
        proofs = check_series(self.bank['boards'], self.catalog, self.solver)
        self.assertEqual(8, len(proofs))
        self.assertTrue(all(p['status']=='unique' and p['targetPathsUnique'] for p in proofs))

    def test_full_lexical_plan_replays_without_relabeling(self):
        sets, restart = allocate(self.catalog, self.report['settings']['seed'])
        self.assertEqual([sorted(self.catalog.words(b)) for b in self.bank['boards']], sets)
        self.assertEqual(self.report['settings']['lexicalRestart'], restart)
        tiers = {e['word']:e['tier'] for e in read_json(ROOT/'content/lexicon-v3/working/lexicon.json')['entries']}
        self.assertTrue(all(e['tier']==tiers[w] for w,e in self.catalog.entries.items()))

    def test_no_partial_package_or_prototype_ids(self):
        verify_bank(self.bank)
        for mutate in ('partial','prototype'):
            b=deepcopy(self.bank)
            if mutate=='partial': b['boards'].pop()
            else: b['boards'][0]['id']='mk3-01'
            b['contentHash']=digest(b['boards'])
            with self.subTest(mutate=mutate), self.assertRaises(ValueError): verify_bank(b)

    def test_unknown_solver_result_does_not_pass(self):
        with patch.object(self.solver, 'verify', return_value={'status':'unknown_budget','targetPathsUnique':True}):
            with self.assertRaisesRegex(ValueError,'No complete exact proof'):
                check_series(self.bank['boards'],self.catalog,self.solver)

    def test_weakened_geometry_and_wrong_lexicon_rejected(self):
        b=deepcopy(self.bank['boards'])
        b[0]['meta']['lexiconHash']='0'*64
        with self.assertRaisesRegex(ValueError,'provenance'):
            check_series(b,self.catalog,self.solver,verify=False)
        b=deepcopy(self.bank['boards'])
        b[0]['answers'][0]['path'][0]=b[0]['answers'][0]['path'][1]
        with self.assertRaises(ValueError):check_series(b,self.catalog,self.solver,verify=False)


if __name__=='__main__':unittest.main()
