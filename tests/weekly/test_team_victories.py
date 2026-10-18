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
        self.reads = []
        self.rows = []
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
        def select(table, **kwargs):
            self.reads.append((table, kwargs))
            return self.rows
        team_victories.install(app, auth_player=auth, db_rpc=rpc,
            enforce_rate_limit=lambda *a, **k: None, db_select_bounded=select)
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
        self.assertEqual(self.client.get('/api/team-victories/personal').status_code, 401)
        self.assertEqual(self.reads, [])

    def test_preview_does_not_authenticate_or_call_database(self):
        with patch.dict(os.environ, {'VERCEL_ENV': 'preview'}):
            self.assertFalse(self.client.get('/api/team-victories', headers=self.headers).json()['enabled'])
            self.assertEqual(self.client.post('/api/team-victories/seen', json={'kind':'intro'}, headers=self.headers).status_code, 409)
        with patch.dict(os.environ, {'VERCEL_ENV': 'preview'}):
            self.assertFalse(self.client.get('/api/team-victories/personal', headers=self.headers).json()['enabled'])
        self.assertEqual(self.reads, [])
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

    def test_personal_history_survives_team_change_and_is_scoped_to_authenticated_player(self):
        self.rpc_result = {'enabled': True, 'team': None}
        self.rows = [{'award_id': AWARD, 'team_victory_awards': {
            'id': AWARD, 'week_start': '2026-10-05', 'team_name': 'Bývalá parta',
            'xp': 27155, 'shared_first': True}}]
        data = self.client.get('/api/team-victories/personal?player_id=forged', headers=self.headers).json()
        self.assertEqual(data['totalGold'], 1)
        self.assertEqual(data['history'][0]['teamName'], 'Bývalá parta')
        self.assertEqual(data['history'][0]['weekEnd'], '2026-10-12')
        self.assertTrue(data['history'][0]['sharedFirst'])
        table, query = self.reads[0]
        self.assertEqual(table, 'team_victory_recipients')
        self.assertEqual(query['filters'], {'player_id': f'eq.{PLAYER}'})
        self.assertNotIn('seen_at', query['filters'])
        self.assertNotIn('family_code', query['filters'])
        self.assertEqual(query['order'], 'award_id.asc')
        self.assertIn('team_victory_awards!inner', query['columns'])

    def test_disabled_rewards_do_not_read_personal_history(self):
        self.rpc_result = {'enabled': False}
        data = self.client.get('/api/team-victories/personal', headers=self.headers).json()
        self.assertFalse(data['enabled'])
        self.assertEqual(self.reads, [])

    def test_newcomer_has_no_inherited_gold(self):
        self.rpc_result = {'enabled': True, 'team': {'totalGold': 25}}
        data = self.client.get('/api/team-victories/personal', headers=self.headers).json()
        self.assertEqual(data, {'enabled': True, 'totalGold': 0, 'history': []})

    def test_history_is_newest_first_and_count_is_not_capped_with_visible_history(self):
        rows = [{'team_victory_awards': {'id': str(n), 'week_start': '2026-10-05',
            'team_name': 'Tým', 'xp': 100, 'shared_first': False}} for n in range(125)]
        data = team_victories.personal_state(rows)
        self.assertEqual(data['totalGold'], 125)
        self.assertEqual(len(data['history']), 100)
        rows[0]['team_victory_awards']['week_start'] = '2026-10-12'
        self.assertEqual(team_victories.personal_state(rows)['history'][0]['id'], '0')

    def test_milestones_never_stop(self):
        for gold, next_at, level in [(0,1,0),(1,3,0),(3,10,0),(10,25,0),(25,50,1),(50,75,2),(125,150,5)]:
            data = team_victories.enrich_state({'team':{'totalGold':gold}})['team']
            self.assertEqual(data['nextMilestone']['threshold'], next_at)
            self.assertEqual(data['legendLevel'], level)


if __name__ == '__main__':
    unittest.main()

