"""HTTP admin contract: exact bounded aggregates, fail closed, no raw history."""
from datetime import timezone
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from account_integrity_v33210 import install_account_integrity

players = [dict(id='a', name='Duplicate', created_at='2026-10-19T10:00:00Z'),
           dict(id='b', name='Duplicate', created_at='2026-10-19T10:00:01Z'),
           dict(id='c', name='Other', created_at='2026-10-19T10:00:02Z')]
authorized = True
authenticated = True
calls = []
answer = [dict(player_id='a', results=20001, sessions=2, pushes=3),
          dict(player_id='b', results=0, sessions=2, pushes=3)]

def select(table, **filters):
    assert table == 'admin_accounts', 'must not read result/session/push history'
    return [{'active': authorized}]

def bounded(table, **kwargs):
    assert table == 'players' and kwargs['max_rows'] == 5000
    return players

def rpc(name, body):
    calls.append((name, body))
    return answer

def auth(_):
    if not authenticated:
        raise HTTPException(401)
    return {'id': 'admin'}

app = FastAPI()
install_account_integrity(app, tz=timezone.utc, db_select=select,
    db_select_bounded=bounded, db_rpc=rpc, auth_player=auth,
    new_session=lambda _: '', verify_password=lambda *_: False,
    enforce_rate_limit=lambda *a, **k: None, player_stats=lambda _: {},
    public_family_code=lambda *_: '', league_name_for=lambda _: '')
client = TestClient(app)
response = client.get('/api/admin/account-integrity')
assert response.status_code == 200, response.text
value = response.json()
assert (value['rawPlayers'], value['likelyDuplicateRows'], value['canonicalPlayers']) == (3, 1, 2)
assert value['rows'][0]['canonicalId'] == 'a'
assert value['rows'][0]['canonicalResults'] == 20001, 'must not truncate counts above raw history cap'
assert calls == [('proplet_account_integrity_counts', {'p_players': ['a', 'b']})]
assert set(value) == {'rawPlayers','likelyDuplicateRows','canonicalPlayers','duplicateClusters','rows','definition','prevention','meta'}
assert value['meta']['source'] == 'players+proplet_account_integrity_counts'
assert value['meta']['status'] == 'ready' and value['meta']['unit'] == 'accounts'
assert 'not all accounts belonging to a person' in value['meta']['coverage']
assert value['meta']['generatedAt'] and value['meta']['period']['timeZone'] == 'Europe/Prague'
for malformed in (None, answer[:1], [answer[0], answer[0]],
                  [answer[0], dict(answer[1], results=-1)],
                  [answer[0], dict(answer[1], sessions='2')],
                  [answer[0], dict(answer[1], player_id='foreign')]):
    original = answer
    answer = malformed
    assert client.get('/api/admin/account-integrity').status_code == 503
    answer = original
calls.clear()
authorized = False
assert client.get('/api/admin/account-integrity').status_code == 403
authenticated = False
assert client.get('/api/admin/account-integrity').status_code == 401
assert calls == [], 'authorization must precede all activity reads'
authorized = authenticated = True
players[:] = players[2:]
assert client.get('/api/admin/account-integrity').json()['rows'] == []
assert calls == [], 'no candidates means no activity query'
print('PASS admin counts: >20k exact result, bounded candidates, unchanged response, 401/403, malformed RPC fails closed')
