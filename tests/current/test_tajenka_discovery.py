"""Published Tajenka USER uses the existing authenticated, idempotent XP ledger."""
import sys
from pathlib import Path
from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import server
from word_recognition_v3330 import install_word_recognition, _discovery_reward_key
rows,calls=[],[]
def auth(token):
    if token!='Bearer synthetic':raise HTTPException(401)
    return {'id':'synthetic'}
def rpc(name,p):
    assert name=='proplet_claim_word_discovery'
    calls.append(p)
    key=_discovery_reward_key(p['p_puzzle_id'],p['p_word'])
    rows.append({'reward_key':key,'points':1,'granted_at':datetime.now(ZoneInfo('Europe/Prague')).isoformat()})
    return [{'newly_granted':True,'awarded_points':1,'reward_key':key,'reason':'granted'}]
app=FastAPI()
install_word_recognition(app,auth_player=auth,db_select=lambda *_a,**_kw:rows,db_rpc=rpc,
    puzzle_exists=server.puzzle_exists,resolved_puzzle=server.resolved_puzzle,tz=ZoneInfo('Europe/Prague'))
c=TestClient(app);headers={'Authorization':'Bearer synthetic'}
payload={'puzzle_id':'tajenka-v2-week-17','mode':'tajenka','difficulty':'medium','word':'USER','path':[15,9,3,2]}
with patch.object(server,'current_prague_date',return_value=date(2026,10,31)),patch.object(server,'TAJENKA_RELEASE_ENABLED',True):
    assert c.post('/api/word-discovery/claim',json=payload).status_code==401
    for changed in ({'path':[15,9,3,4]},{'path':[15]*4},{'difficulty':'hard'},{'puzzle_id':'not-a-board'},{'puzzle_id':'tajenka-v2-week-37'},{'mode':'starter'}):
        r=c.post('/api/word-discovery/claim',headers=headers,json={**payload,**changed});assert r.status_code==400,(changed,r.text)
    assert not calls
    r=c.post('/api/word-discovery/claim',headers=headers,json=payload);assert r.status_code==200,r.text
    assert r.json()['awardedPoints']==1 and r.json()['totalDiscoveryXp']==1
    r=c.post('/api/word-discovery/claim',headers=headers,json={**payload,'word':'user'});assert r.json()['awardedPoints']==0 and r.json()['limitReason']=='duplicate'
    assert len(calls)==1
    with patch.object(server,'TAJENKA_RELEASE_ENABLED',False):
        assert c.post('/api/word-discovery/claim',headers=headers,json=payload).status_code==400
    with patch.object(server,'current_prague_date',return_value=date(2026,8,1)):
        assert c.post('/api/word-discovery/claim',headers=headers,json=payload).status_code==400
    assert len(calls)==1
print('PASS Tajenka USER actual published bank/path, +1 ledger XP, duplicate, auth, disabled/future/unknown/invalid proof refusal')
