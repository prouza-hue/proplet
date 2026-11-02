"""Branch-only Gen5 content integration, immutable old levels and local-only play."""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ['VERCEL_ENV'] = 'preview'
os.environ['VERCEL_GIT_COMMIT_REF'] = 'feat/gen5-lab'

from fastapi.testclient import TestClient
from backend.config import load_settings
import server
from tools.build_gen5_preview import DIFFICULTIES, compose_preview, digest


def read(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8'))


class Gen5PreviewTests(unittest.TestCase):
    def test_only_explicit_preview_branch_selects_candidate(self):
        for env,branch,active in [('preview','feat/gen5-lab',True),
                                 ('production','feat/gen5-lab',False),
                                 ('preview','main',False), ('','feat/gen5-lab',False)]:
            with self.subTest(env=env,branch=branch), patch.dict(os.environ, VERCEL_ENV=env, VERCEL_GIT_COMMIT_REF=branch):
                config=load_settings()
                self.assertEqual(config.gen5_candidate_preview,active)
                self.assertEqual(config.puzzles_path.name,'gen5_preview_puzzles.json' if active else 'puzzles.json')

    def test_existing_files_and_all_reserve_payloads_stay_unchanged(self):
        expected={'data/rolling_content_v1.json':'6e956ee5dfe26ee90e23e9c76ff86ec89b7361895c87f2dd9177ea5ea41a1a4c'}
        for name,value in expected.items():
            self.assertEqual(hashlib.sha256((ROOT/name).read_bytes()).hexdigest(),value,name)
        source=read('data/puzzles.json'); rolling=read('data/rolling_content_v1.json')
        preview=server.load_puzzles()
        for d in DIFFICULTIES:
            history=[p for p in source['free'][d] if not p['id'].startswith(('g5-r1-', 'g6-refresh-', 'g6-expansion-'))]+rolling['puzzles'].get(d,[])
            self.assertEqual(preview['free'][d][:len(history)],history,d)
        for key in source.keys()-{'free','freeLevelsPerDifficulty','freeLevelCounts','release','mozkokalypsaRelease','mozkomorUnlock','freeRefreshRelease','freeExpansionRelease'}:
            self.assertEqual(preview[key],source[key],key)

    def test_all_450_new_boards_are_ordered_and_keep_progress_generation(self):
        preview=server.load_puzzles()
        self.assertEqual(preview['freeGeneration'],4)
        self.assertEqual(preview['release']['seriesId'],'g5-r1')
        self.assertEqual(preview['release']['totalNewLevels'],450)
        total=0
        for d in DIFFICULTIES:
            bank=preview['free'][d]
            additions=[b for b in bank if b['id'].startswith('g5-r1-'+d+'-')]
            self.assertEqual(len(additions),50 if d=='mozkomor' else 100)
            self.assertEqual([b['meta']['level'] for b in bank],list(range(1,len(bank)+1)))
            self.assertTrue(all(b['meta']['contentGeneration']==4 and b['meta']['generatorGeneration']==5 for b in additions))
            total+=len(additions)
        self.assertEqual(total,450)

    def test_preview_api_returns_full_bank_without_duplicate_rolling(self):
        with patch.object(server,'db_request',side_effect=AssertionError('Preview must not write/read DB for bank')):
            client=TestClient(server.app)
            response=client.get('/api/puzzle-database')
            delta=client.get('/api/rolling-content')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers['cache-control'],'no-store')
        data=response.json()
        self.assertEqual({d:len(bs) for d,bs in data['free'].items()},
                         {'easy':317,'medium':316,'hard':316,'hardcore':316,'mozkomor':150,'mozkokalypsa':0})
        self.assertEqual(len({b['id'] for bs in data['free'].values() for b in bs}),1415)
        self.assertEqual(delta.status_code,200)
        self.assertTrue(all(not bs for bs in delta.json()['puzzles'].values()))
        self.assertEqual(data['contentStatus']['availableFreeCounts'],{**data['freeLevelCounts'],'mozkokalypsa':0})

    def test_preview_results_and_other_mutations_never_reach_database(self):
        with patch.object(server,'db_request',side_effect=AssertionError('Preview reached DB')):
            client=TestClient(server.app)
            for path in ('/api/result','/api/account-bonus/claim','/api/player','/api/auth/google/complete'):
                with self.subTest(path=path):
                    self.assertEqual(client.post(path,json={}).status_code,409)
            response=client.post('/api/attempt/start',json={})
            self.assertEqual(response.status_code,409)

    def test_composer_rejects_tampering_and_preserves_inputs(self):
        source={'freeGeneration':4,'free':{d:[{'id':d+'-old','difficulty':d,'meta':{'level':1}}] for d in DIFFICULTIES}}
        rolling={'puzzles':{d:[] for d in DIFFICULTIES}}
        package={'kind':'gen5-unpublished-package','status':'unpublished','runtimeFreeGeneration':4,
                 'puzzles':{d:[{'id':'g5-r1-'+d+'-001','difficulty':d,'meta':{'level':2,'contentGeneration':4,'generatorGeneration':5}}] for d in DIFFICULTIES},
                 'manifest':{'seriesId':'g5-r1','plannedCounts':{d:1 for d in DIFFICULTIES},
                     'boundaries':{d:{'historyHash':digest(source['free'][d]),'baseHash':digest(source['free'][d]),'nextLevel':2} for d in DIFFICULTIES}}}
        package['manifest']['packagedContentHash']=digest(package['puzzles'])
        before=deepcopy((source,rolling,package))
        compose_preview(source,rolling,package)
        self.assertEqual((source,rolling,package),before)
        broken=deepcopy(package);broken['puzzles']['easy'][0]['meta']['level']=3
        with self.assertRaisesRegex(ValueError,'hash mismatch'):
            compose_preview(source,rolling,broken)
        broken['manifest']['packagedContentHash']=digest(broken['puzzles'])
        with self.assertRaisesRegex(ValueError,'Invalid appended'):
            compose_preview(source,rolling,broken)


if __name__=='__main__':
    unittest.main()

