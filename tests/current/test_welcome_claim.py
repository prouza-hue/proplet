from unittest.mock import patch
from fastapi.testclient import TestClient
import server
client=TestClient(server.app)
with patch.object(server,'auth_player',return_value={'id':'player-a'}), patch.object(server,'enforce_rate_limit'), patch.object(server,'VERCEL_ENV','production'), patch.object(server,'db_request',side_effect=[[{'id':'player-a'}],[]]) as db:
    assert client.post('/api/account/welcome').json()=={'show':True}
    assert client.post('/api/account/welcome').json()=={'show':False}
    assert db.call_args.kwargs['params']['id']=='eq.player-a'
    assert db.call_args.kwargs['params']['printshop_welcome_seen_at']=='is.null'
with patch.object(server,'auth_player',return_value={'id':'player-a'}), patch.object(server,'VERCEL_ENV','preview'), patch.object(server,'db_request') as db:
    assert client.post('/api/account/welcome').json()=={'show':False}
    db.assert_not_called()
print('PASS welcome account claim and preview isolation')
