"""Public archived standings: privacy, exact medals, bounded reads and validation."""
import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import team_victories


class CompetitionHistoryTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.auth_calls = []
        self.rows = {
            'team_victory_settings': [{'enabled': True, 'launch_date': '2026-09-28'}],
            'team_victory_rounds': [
                {'week_start': '2026-10-05', 'week_end': '2026-10-12'},
                {'week_start': '2026-09-28', 'week_end': '2026-10-05'}],
            'leagues': [{'code': 'A', 'name': 'New A', 'public_name': 'Public A'},
                        {'code': 'B', 'name': 'B team', 'public_name': None}],
            'team_victory_awards': [
                {'id': '1', 'week_start': '2026-09-28', 'team_code': 'A'},
                {'id': '2', 'week_start': '2026-09-28', 'team_code': 'B'},
                {'id': '3', 'week_start': '2026-10-05', 'team_code': 'PRIVATE'},
                {'id': '4', 'week_start': '2099-01-05', 'team_code': 'A'}],
        }
        self.snapshot = [{'standings': [
            {'team_code': 'A', 'team_name': 'Historic A', 'xp': 100, 'rank': 1},
            {'team_code': 'B', 'team_name': 'B team', 'xp': 100, 'rank': 1},
            {'team_code': 'PRIVATE', 'team_name': 'Secret', 'xp': 50, 'rank': 3}]}]

        def select(table, **kwargs):
            self.calls.append((table, kwargs))
            if table == 'team_victory_rounds' and kwargs['columns'] == 'standings':
                return self.snapshot
            if table == 'team_victory_rounds' and kwargs['columns'] == 'week_start,week_end,standings':
                week = kwargs['filters']['week_start'].removeprefix('eq.')
                selected = next((row for row in self.rows[table] if row['week_start'] == week), None)
                return [{**selected, **self.snapshot[0]}] if selected and self.snapshot else []
            return self.rows[table]

        def auth(token):
            self.auth_calls.append(token)
            if token != 'Bearer valid':
                raise HTTPException(401)
            return {'id': 'viewer', 'family_code': 'A'}

        self.select = select
        self.app = FastAPI()
        team_victories.install(self.app, auth_player=auth,
            db_rpc=lambda *a: self.fail('History GET must not invoke RPCs'),
            enforce_rate_limit=lambda *a, **kw: None, db_select_bounded=select)
        self.client = TestClient(self.app)
        self.env = patch.dict(os.environ, {'VERCEL_ENV': 'production'})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_guest_metadata_and_shared_gold_are_exact_and_public(self):
        result = self.client.get('/api/team-victories/competition')
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertIsNone(data['selectedWeek'])
        self.assertEqual(data['teams'], [])
        self.assertEqual(len(data['weeks']), 2)
        self.assertEqual(data['goldTeams'], [
            {'name': 'B team', 'gold': 1, 'rank': 1, 'isMine': False},
            {'name': 'Public A', 'gold': 1, 'rank': 1, 'isMine': False}])
        self.assertEqual(self.auth_calls, [])
        self.assertNotIn('PRIVATE', result.text)
        self.assertNotIn('team_code', result.text)
        self.assertTrue(all(0 < args['max_rows'] <= 20000 for _, args in self.calls))

    def test_archive_preserves_frozen_names_ties_and_validated_identity(self):
        result = self.client.get('/api/team-victories/competition?week=2026-09-28',
                                 headers={'Authorization': 'Bearer valid'})
        data = result.json()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(data['selectedWeek'], {'start': '2026-09-28', 'end': '2026-10-05'})
        self.assertEqual(data['teams'], [
            {'name': 'Historic A', 'xp': 100, 'rank': 1, 'isMine': True},
            {'name': 'B team', 'xp': 100, 'rank': 1, 'isMine': False}])
        self.assertTrue(next(row for row in data['goldTeams'] if row['name'] == 'Public A')['isMine'])
        self.assertNotIn('Secret', result.text)
        read = next(args for table, args in self.calls if args['columns'] == 'standings')
        self.assertEqual(read['filters'], {'week_start': 'eq.2026-09-28'})

    def test_narrow_snapshot_omits_all_history_awards_and_unrelated_leagues(self):
        result = self.client.get('/api/team-victories/competition?week=2026-09-28&includeSummary=false',
                                 headers={'Authorization': 'Bearer valid'})
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(set(data), {'enabled', 'selectedWeek', 'teams'})
        self.assertEqual(data['teams'][0], {'name': 'Historic A', 'xp': 100, 'rank': 1, 'isMine': True})
        self.assertEqual([table for table, _ in self.calls], ['team_victory_settings', 'team_victory_rounds', 'leagues'])
        self.assertEqual(self.calls[1][1]['columns'], 'week_start,week_end,standings')
        self.assertEqual(self.calls[1][1]['filters']['week_start'], 'eq.2026-09-28')
        self.assertIn('week_end', self.calls[1][1]['filters'])
        self.assertEqual(self.calls[2][1]['filters'], {'public_opt_in': 'eq.true', 'code': 'in.(A,B,PRIVATE)'})
        self.assertNotIn('Secret', result.text)
        self.assertNotIn('team_code', result.text)

    def test_narrow_snapshot_rechecks_visibility_and_auth_on_each_request(self):
        url = '/api/team-victories/competition?week=2026-09-28&includeSummary=false'
        first = self.client.get(url, headers={'Authorization': 'Bearer valid'})
        self.assertTrue(first.json()['teams'][0]['isMine'])
        self.rows['leagues'] = [self.rows['leagues'][1]]
        second = self.client.get(url)
        self.assertEqual(second.json()['teams'], [{'name': 'B team', 'xp': 100, 'rank': 1, 'isMine': False}])
        self.assertNotIn('Historic A', second.text)
        before = len(self.calls)
        self.assertEqual(self.client.get(url, headers={'Authorization': 'Bearer bad'}).status_code, 401)
        self.assertEqual(len(self.calls), before)

    def test_narrow_snapshot_requires_real_finalized_week_and_valid_data(self):
        self.assertEqual(self.client.get('/api/team-victories/competition?includeSummary=false').status_code, 422)
        self.assertEqual(self.calls, [])
        for week in ['2026-09-21', '2099-01-05', '2026-10-12']:
            self.assertEqual(self.client.get('/api/team-victories/competition?includeSummary=false&week=' + week).status_code, 404)
        self.snapshot = [{'standings': None}]
        self.assertEqual(self.client.get('/api/team-victories/competition?includeSummary=false&week=2026-09-28').status_code, 503)
        self.snapshot = [{'standings': []}]
        self.calls.clear()
        result = self.client.get('/api/team-victories/competition?includeSummary=false&week=2026-09-28')
        self.assertEqual(result.json()['teams'], [])
        self.assertEqual([table for table, _ in self.calls], ['team_victory_settings', 'team_victory_rounds'])

    def test_invalid_unknown_and_future_weeks_never_fabricate_results(self):
        for week in ['nonsense', '2026-09-29', '2026-13-01']:
            self.assertEqual(self.client.get('/api/team-victories/competition?week=' + week).status_code, 422)
        self.assertEqual(self.calls, [])
        for week in ['2026-09-21', '2099-01-05']:
            self.assertEqual(self.client.get('/api/team-victories/competition?week=' + week).status_code, 404)

    def test_invalid_token_does_not_read_database(self):
        response = self.client.get('/api/team-victories/competition', headers={'Authorization': 'Bearer bad'})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.calls, [])

    def test_preview_and_feature_disabled_are_closed(self):
        with patch.dict(os.environ, {'VERCEL_ENV': 'preview'}):
            self.assertFalse(self.client.get('/api/team-victories/competition').json()['enabled'])
        self.assertEqual(self.calls, [])
        self.rows['team_victory_settings'][0]['enabled'] = False
        self.assertFalse(self.client.get('/api/team-victories/competition').json()['enabled'])
        self.assertEqual(len(self.calls), 1)

    def test_missing_snapshot_is_failure_not_empty_success(self):
        self.snapshot = []
        self.assertEqual(self.client.get('/api/team-victories/competition?week=2026-09-28').status_code, 503)

    def test_bounded_read_failure_is_not_partial_medal_ranking(self):
        # Real db_select_bounded raises on overflow, never returns truncated rows.
        def fail(table, **kwargs):
            if table == 'team_victory_awards':
                raise HTTPException(503, 'Datový dotaz překročil bezpečný limit')
            return self.select(table, **kwargs)
        app = FastAPI()
        team_victories.install(app, auth_player=lambda token: None, db_rpc=lambda *a: None,
            enforce_rate_limit=lambda *a, **kw: None, db_select_bounded=fail)
        self.assertEqual(TestClient(app).get('/api/team-victories/competition').status_code, 503)


if __name__ == '__main__':
    unittest.main()
