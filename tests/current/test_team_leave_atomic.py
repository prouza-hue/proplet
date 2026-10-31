"""Exercise the actual leave HTTP handler without production imports or writes."""
import ast
from pathlib import Path
import secrets
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

root = Path(__file__).resolve().parents[2]
source = ast.parse((root / 'server.py').read_text(encoding='utf-8'))
handler = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'leave_team')
app = FastAPI()
calls = []
player = dict(id='11111111-1111-4111-8111-111111111111', family_code='TEAM', team_joined_at='2026-10-28T10:00:00Z')
answer = {'ok': True, 'changed': True}
authenticated = True

def auth(_):
    if not authenticated:
        raise HTTPException(401)
    return player

def rpc(name, body):
    calls.append((name, body))
    if isinstance(answer, Exception):
        raise answer
    return answer

def forbidden(*a, **k):
    raise AssertionError('independent REST writes/reads are forbidden for leave')

namespace = dict(app=app, Request=Request, Optional=Optional, Header=__import__('fastapi').Header,
    HTTPException=HTTPException, secrets=secrets, VERCEL_ENV='production', LIVE_PLAYER_PREVIEW=False, auth_player=auth,
    enforce_rate_limit=lambda *a, **k: None, db_rpc=rpc, db_select=forbidden, db_update=forbidden)
exec(compile(ast.Module(body=[handler], type_ignores=[]), 'actual_leave_handler', 'exec'), namespace)
client = TestClient(app)
response = client.post('/api/team-membership/leave', headers={'Authorization': 'Bearer fixture-only'})
assert response.status_code == 200 and response.json() == {'ok': True, 'familyCode': None, 'leagueName': None}
assert len(calls) == 1 and calls[0][0] == 'proplet_team_leave_v1'
payload = calls[0][1]
assert payload['p_player'] == player['id'] and payload['p_expected_family'] == 'TEAM'
assert payload['p_expected_joined_at'] == player['team_joined_at']
assert __import__('re').fullmatch(r'SOLO_[0-9A-F]{12}', payload['p_new_solo'])

for answer, status in [({'ok': True, 'changed': False}, 200),
                       ({'ok': False, 'code': 'conflict'}, 409),
                       (HTTPException(400, 'RPC missing'), 503),
                       (HTTPException(503, 'connection lost after commit'), 503),
                       (None, 503), ([], 503), ({'ok': 'true'}, 503), ({'ok': False}, 503)]:
    before = len(calls)
    assert client.post('/api/team-membership/leave').status_code == status
    assert len(calls) == before + 1, 'never retry mutation or fall back to REST'
before = len(calls)
namespace['VERCEL_ENV'] = 'preview'
assert client.post('/api/team-membership/leave').status_code == 409
namespace['VERCEL_ENV'] = 'production'
authenticated = False
assert client.post('/api/team-membership/leave').status_code == 401
assert len(calls) == before
authenticated = True
original = secrets.token_hex
try:
    secrets.token_hex = lambda *_: (_ for _ in ()).throw(RuntimeError('generator failed'))
    safe_client = TestClient(app, raise_server_exceptions=False)
    assert safe_client.post('/api/team-membership/leave').status_code == 500
    assert len(calls) == before, 'generator failure must precede every mutation'
finally:
    secrets.token_hex = original
print('PASS leave HTTP: one authenticated atomic command, success/retry, conflict, unavailable/malformed, preview/auth and generator failure')
