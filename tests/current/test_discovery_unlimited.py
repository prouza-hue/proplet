"""Real HTTP admission beyond 50 XP; malformed/duplicate claims still rejected."""
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from word_recognition_v3330 import install_word_recognition

TZ = ZoneInfo('Europe/Prague')
rows = [{'reward_key': f'word_discovery_v1:old-board:word{i}', 'points': 1,
         'granted_at': datetime.now(TZ).isoformat(), 'reward_type': 'word_discovery'} for i in range(65)]
puzzle = {'rows': 3, 'cols': 3, 'mask': list(range(9)),
          'letters': ['S','T','Á','A','U','J','X','T','O'],
          'answers': [{'word': 'AUTO', 'path': [3,4,7,8]}]}
calls = []
def auth(token):
    if token != 'Bearer synthetic':
        raise HTTPException(401, 'invalid test token')
    return {'id': 'synthetic'}
def rpc(name, params):
    calls.append((name, params))
    key = 'word_discovery_v1:board-a:stáj'
    rows.append({'reward_key': key, 'points': 1, 'granted_at': datetime.now(TZ).isoformat(), 'reward_type': 'word_discovery'})
    return [{'newly_granted': True, 'awarded_points': 1, 'reason': 'granted', 'reward_key': key}]
app = FastAPI()
install_word_recognition(app,db_select=lambda *a,**k:rows,db_rpc=rpc,auth_player=auth,tz=TZ,
                         resolved_puzzle=lambda *a:puzzle,puzzle_exists=lambda *a:True)
client = TestClient(app)
headers = {'Authorization':'Bearer synthetic'}
payload = {'puzzle_id':'board-a','word':'STÁJ','mode':'free','difficulty':'easy','path':[0,1,2,5]}
status = client.get('/api/word-discovery/status',headers=headers).json()
assert status['dailyDiscoveryXp'] == 65 and status['dailyXpLimit'] is None and status['dailyRemainingXp'] is None
assert client.post('/api/word-discovery/claim',json=payload).status_code == 401
for invalid in ({**payload,'path':[0,4,2,5]}, {**payload,'word':'AUTO','path':[3,4,7,8]}, {**payload,'mode':'playtest'}):
    assert client.post('/api/word-discovery/claim',headers=headers,json=invalid).status_code in (400,422)
assert not calls
response = client.post('/api/word-discovery/claim',headers=headers,json=payload)
assert response.status_code == 200, response.text
assert response.json()['awardedPoints'] == 1 and response.json()['dailyDiscoveryXp'] == 66
repeat = client.post('/api/word-discovery/claim',headers=headers,json=payload).json()
assert repeat['newlyGranted'] is False and repeat['limitReason'] == 'duplicate' and len(calls) == 1
print('PASS real API: 66th XP accepted; no auth, invalid path, target word and duplicates protected')
