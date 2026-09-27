"""HTTP trust-boundary tests; real SQL scenarios live in the PG integration suite."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend import team_victories

PLAYER = '00000000-0000-0000-0000-000000000001'
AWARD = '00000000-0000-0000-0000-000000000002'


class TeamVictoriesHTTPTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.auth_calls = []
        self.rpc_result = {'enabled': True, 'team': {'name': 'Kupkovi', 'totalGold': 1}}
        app = FastAPI()
        def auth(token):
            self.auth_calls.append(token)
            if token != 'Bearer valid':
                raise HTTPException(401, 'Unauthorized')
            return {'id': PLAYER}
        def rpc(name, body):
            self.calls.append((name, body))
            return self.rpc_result
        team_victories.install(app, auth_player=auth, db_rpc=rpc, enforce_rate_limit=lambda *a, **k: None)
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {'VERCEL_ENV': 'production'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.headers = {'Authorization': 'Bearer valid'}

    def test_auth_required_no_rpc_for_missing_or_invalid_token(self):
        for headers in ({}, {'Authorization': 'Bearer forged'}):
            self.assertEqual(self.client.get('/api/team-victories', headers=headers).status_code, 401)
            self.assertEqual(self.client.post('/api/team-victories/seen', json={'kind':'intro'}, headers=headers).status_code, 401)
        self.assertEqual(self.calls, [])

    def test_preview_does_not_authenticate_or_call_database(self):
        with patch.dict(os.environ, {'VERCEL_ENV': 'preview'}):
            self.assertFalse(self.client.get('/api/team-victories', headers=self.headers).json()['enabled'])
            self.assertEqual(self.client.post('/api/team-victories/seen', json={'kind':'intro'}, headers=self.headers).status_code, 409)
        self.assertEqual(self.auth_calls, [])
        self.assertEqual(self.calls, [])

    def test_unset_environment_is_disabled(self):
        with patch.dict(os.environ, {'VERCEL_ENV': ''}):
            self.assertFalse(self.client.get('/api/team-victories').json()['enabled'])
        self.assertEqual(self.calls, [])

    def test_server_identity_and_get_is_read_only(self):
        data = self.client.get('/api/team-victories', headers=self.headers).json()
        self.assertEqual(self.calls, [('proplet_team_victories_state_v1', {'p_player_id': PLAYER})])
        self.assertEqual(data['team']['nextMilestone']['threshold'], 3)
        self.assertEqual(data['team']['milestones'][0]['achieved'], True)

    def test_forged_player_id_is_rejected(self):
        result = self.client.post('/api/team-victories/seen', headers=self.headers,
                                  json={'kind':'intro','player_id':AWARD})
        self.assertEqual(result.status_code, 422)
        self.assertEqual(self.calls, [])

    def test_foreign_award_is_denied(self):
        self.rpc_result = {'ok':False}
        result = self.client.post('/api/team-victories/seen', headers=self.headers,
                                  json={'kind':'award','awardId':AWARD})
        self.assertEqual(result.status_code, 403)
        self.assertEqual(self.calls[0][1]['p_player_id'], PLAYER)

    def test_intro_claim_forwards_atomic_outcome(self):
        for first in (True, False):
            self.rpc_result = {'ok':True,'firstSeen':first}
            response = self.client.post('/api/team-victories/seen', headers=self.headers,json={'kind':'intro'})
            self.assertEqual(response.json()['firstSeen'], first)

    def test_malformed_ack_does_not_call_rpc(self):
        for body in ({'kind':'award'}, {'kind':'intro','awardId':AWARD}, {'kind':'award','awardId':'bad'}, {'kind':'anything'}):
            self.assertEqual(self.client.post('/api/team-victories/seen',headers=self.headers,json=body).status_code,422)
        self.assertEqual(self.calls, [])

    def test_milestones_never_stop(self):
        for gold, next_at, level in [(0,1,0),(1,3,0),(3,10,0),(10,25,0),(25,50,1),(50,75,2),(125,150,5)]:
            data = team_victories.enrich_state({'team':{'totalGold':gold}})['team']
            self.assertEqual(data['nextMilestone']['threshold'], next_at)
            self.assertEqual(data['legendLevel'], level)


if __name__ == '__main__':
    unittest.main()
