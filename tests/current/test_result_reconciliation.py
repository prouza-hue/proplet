"""Authenticated read-only recovery; POST conflict semantics remain strict."""
from pathlib import Path
import sys
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
import server

receipt = dict(firstCompletion=True, awardedPoints=150, dailyGenerationUpgrade=False, transferredSlot=False)
binding = dict(player_id='owner', puzzle_id='board', challenge_key='free:board', mode='free', difficulty='hard')
tables = {
    'result_commands': [dict(player_id='owner', idempotency_key='attempt:desktop-fold', receipt=receipt)],
    'puzzle_runs': [dict(**binding, attempt_id='desktop-fold')],
    'results': [dict(**binding, best_elapsed_ms=42000, best_moves=13, points=150, completed_at='2026-10-18T20:30:00Z')],
}
def select(table, **filters):
    return [row for row in tables[table] if all(row.get(k) == v for k, v in filters.items())]
def auth(token):
    if token == 'Bearer owner': return {'id': 'owner'}
    if token == 'Bearer foreign': return {'id': 'foreign'}
    raise HTTPException(401, 'Unauthorized')
params = dict(attempt_id='desktop-fold', **{k: v for k, v in binding.items() if k != 'player_id'})
with patch.object(server, 'auth_player', auth), patch.object(server, 'db_select', select), patch.object(server, 'enforce_rate_limit'), patch.object(server, 'free_puzzle_info', return_value=None), patch.object(server, 'db_rpc', side_effect=AssertionError('read must not write')), patch.object(server, 'db_update', side_effect=AssertionError('read must not write')):
    client = TestClient(server.app)
    assert client.get('/api/result-receipt', params=params).status_code == 401
    headers = {'Authorization': 'Bearer owner'}
    response = client.get('/api/result-receipt', params=params, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()['completed']['elapsedMs'] == 42000
    assert response.json()['committed'] is True
    for key in params:
        denied = client.get('/api/result-receipt', params={**params, key: 'foreign'}, headers=headers)
        assert denied.status_code == 200 and denied.json()['committed'] is False, (key, denied.text)
    assert client.get('/api/result-receipt', params=params, headers={'Authorization': 'Bearer foreign'}).json()['committed'] is False
    for table in ('result_commands', 'puzzle_runs', 'results'):
        rows = tables[table]; tables[table] = []
        assert client.get('/api/result-receipt', params=params, headers=headers).json()['committed'] is False
        tables[table] = rows
    tables['result_commands'][0]['receipt'] = None
    assert client.get('/api/result-receipt', params=params, headers=headers).status_code == 503
print('PASS receipt recovery: authenticated owned run, all bindings, missing/invalid proof, canonical result and read-only boundary')
