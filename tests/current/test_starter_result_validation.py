#!/usr/bin/env python3
"""HTTP regression for shipped three-word starter and legacy queued results."""
import hashlib
import sys
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import server

TOKEN = 'starter-result-synthetic-token'
PLAYER = '00000000-0000-4000-8000-000000000099'
rows = {'players': [{'id': PLAYER, 'name': 'Synthetic starter', 'family_code': 'SOLO_TEST',
                    'token_hash': hashlib.sha256(TOKEN.encode()).hexdigest()}]}
def select(table, columns="*", **filters):
    return [dict(row) for row in rows.get(table, []) if all(row.get(k) == v for k, v in filters.items())]
def insert(table, values):
    rows.setdefault(table, []).append(dict(values))
    return [values]
def update(table, filters, values):
    for row in rows.get(table, []):
        if all(row.get(k) == v for k, v in filters.items()): row.update(values)
    return []

def auth_rpc(function, body):
    assert function == 'proplet_auth_player_v1'
    players = select('players', token_hash=body['p_token_hash'])
    return {'player': players[0] if players else None, 'expired': False}

body = dict(puzzle_id='starter-v1', challenge_key='starter:starter-v1', mode='starter',
            difficulty='easy', elapsed_ms=12000, moves=3, wrong_attempts=0,
            completed_at='2026-09-28T07:00:00+00:00')
headers = {'Authorization': 'Bearer '+TOKEN}
with ExitStack() as stack:
    for attr, value in {'ATOMIC_RESULT_V1_ENABLED': False, 'VERCEL_ENV': 'development',
        'enforce_rate_limit': lambda *a, **kw: None, 'db_select': select, 'db_rpc': auth_rpc,
        'db_insert': insert, 'db_update': update, 'rankings_v2_schema_ready': lambda: False,
        'player_stats': lambda _: {'xp': sum(r['points'] for r in rows.get('results', []))}}.items():
        stack.enter_context(patch.object(server, attr, value))
    stack.enter_context(patch.object(server.backend_db.DEFAULT_HTTP_CLIENT, 'request',
                                    side_effect=AssertionError('Unexpected external DB transport')))
    client = TestClient(server.app)
    def post(**changes): return client.post('/api/result', json={**body, **changes}, headers=headers)
    for changes in ({'moves': 2}, {'moves': 3, 'wrong_attempts': 1}, {'elapsed_ms': 2499},
                    {'puzzle_id': 'starter-fake'}, {'challenge_key': 'starter:fake'},
                    {'difficulty': 'hard'}):
        response = post(**changes)
        assert response.status_code == 400, (changes, response.text)
    response = post()
    assert response.status_code == 200, response.text
    assert response.json()['awardedPoints'] == server.STARTER_XP
    for changes in ({}, {'moves': 4}, {'moves': 4, 'wrong_attempts': 1}):
        response = post(**changes)
        assert response.status_code == 200, response.text
        assert response.json()['awardedPoints'] == 0
    remote = client.get('/api/progress', headers=headers)
    assert remote.status_code == 200, remote.text
    saved = remote.json()['completed']
    assert len(saved) == 1 and saved[0]['challengeKey'] == 'starter:starter-v1'
    assert saved[0]['moves'] == 3 and saved[0]['points'] == server.STARTER_XP
    # Regular modes keep the full board thresholds, including four-word boards.
    bank = server.load_puzzles()
    for mode, puzzle in [('free', bank['free']['easy'][0]), ('daily', bank['daily'][0])]:
        count = len(puzzle['answers'])
        response = post(puzzle_id=puzzle['id'], challenge_key=f'{mode}:{puzzle["id"]}',
                        mode=mode, difficulty=puzzle['difficulty'], moves=count-1)
        assert response.status_code == 400 and 'počet tahů' in response.text, response.text
        response = post(puzzle_id=puzzle['id'], challenge_key=f'{mode}:{puzzle["id"]}',
                        mode=mode, difficulty=puzzle['difficulty'], moves=count, elapsed_ms=2499)
        assert response.status_code == 400 and 'bezpečný rozsah' in response.text, response.text
print('PASS: real HTTP starter persistence, legacy compatibility, retry XP, progress and strict regular modes')
