"""Frozen content and invite boundary tests; no real player or DB is touched."""
import json,os,sys
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from backend import mozkokalypsa as m
from tools.gen5.catalog import Catalog,digest
from tools.gen5.validation import Solver,validation_words,structural

bank=m.bank();assert len(bank['boards'])==10
solver=Solver(validation_words(Catalog()));allwords=[]
for i,b in enumerate(bank['boards']):
 stats=structural(b);v=solver.verify(b)
 assert v['status']=='unique' and v['targetPathsUnique'],(b['id'],v)
 assert stats['cells']==100 if i>=2 else 70<=stats['cells']<=76
 assert stats['endpointStartPairs']==0
 allwords.extend(a['word'] for a in b['answers'])
assert len(allwords)==len(set(allwords))==133
for order in bank['orders']:assert set(order)=={b['id'] for b in bank['boards']} and len(order)==10
report=json.loads((m.ROOT/'docs/playtests/mozkokalypsa-verification.json').read_text())
assert report['bankHash']==digest(bank)
assert report['dictionary']['sha256']==solver.hash

calls=[];who={'id':'00000000-0000-4000-8000-000000000001'}
def auth(token):
 if token!='Bearer invited':raise HTTPException(401,'login required')
 return who

def select(table,**filters):
 calls.append((table,filters))
 if table=='mozkokalypsa_invites':return [{'slot':1}] if filters['player_id']==who['id'] else []
 if table=='mozkokalypsa_attempts':return []
 raise AssertionError(table)
def rpc(name,body):
 calls.append((name,body));return {'ok':True,'revision':body.get('p_revision',0)+1}
app=FastAPI();m.install(app,auth_player=auth,db_select=select,db_request=lambda *a,**kw:None,db_rpc=rpc,enforce_rate_limit=lambda *a,**kw:None)
with TestClient(app) as c:
 with patch.dict(os.environ,{'VERCEL_ENV':'production','PROPLET_PLAYTEST_LOCAL_QA':'true'},clear=True):
  assert c.get('/api/mozkokalypsa/status').json()=={'eligible':False}
  assert c.get('/api/mozkokalypsa/status?qa=true').status_code==403
  assert c.get('/api/mozkokalypsa/board/mk26-03?qa=true').status_code==403
  assert c.post('/api/mozkokalypsa/open/mk26-01').status_code==404
  assert not calls
 with patch.dict(os.environ,{'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':m.BRANCH},clear=True):
  assert c.get('/api/mozkokalypsa/status?qa=true').json()['qa']
  assert len(c.get('/api/mozkokalypsa/board/mk26-03?qa=true').json()['puzzle']['mask'])==100
  assert c.post('/api/mozkokalypsa/open/mk26-03').status_code==404
  assert not calls
 with patch.dict(os.environ,{'VERCEL_ENV':'production','PROPLET_MOZKOKALYPSA_ENABLED':'true'},clear=True):
  headers={'Authorization':'Bearer invited'}
  result=c.get('/api/mozkokalypsa/status',headers=headers).json()
  assert result['eligible'] and result['order']==bank['orders'][1]
  assert c.post('/api/mozkokalypsa/open/mk26-01').status_code==401
  assert c.get('/api/mozkokalypsa/board/mk26-01?qa=true',headers=headers).status_code==403
  assert c.post('/api/mozkokalypsa/open/nope',headers=headers).status_code==404
  b=bank['boards'][0]
  progress={'elapsedMs':20000,'moves':len(b['answers']),'found':[{'answerIndex':i,**a} for i,a in enumerate(b['answers'])]}
  event={'event_id':'00000000-0000-4000-8000-000000000011','attempt_id':'00000000-0000-4000-8000-000000000012','board_id':b['id'],'revision':0,'event_type':'finish','progress':progress}
  assert c.post('/api/mozkokalypsa/event',json=event,headers=headers).status_code==200
  assert calls[-1][1]['p_player']==who['id']
  for bad in [dict(progress,found=[]),dict(progress,elapsedMs=-1),dict(progress,found=[{'answerIndex':0,'word':'FORGED','path':[]}])]:
   assert c.post('/api/mozkokalypsa/event',json=dict(event,progress=bad),headers=headers).status_code==422
  assert c.post('/api/mozkokalypsa/event',json=dict(event,player_id='forged'),headers=headers).status_code==422
  assert c.post('/api/mozkokalypsa/event',json=dict(event,feedback={'fun':8}),headers=headers).status_code==422
assert all(name.startswith(('mozkokalypsa_','proplet_mozkokalypsa_')) for name,_ in calls)
print('PASS 10 unique boards, 133 words, frozen evidence, server-auth cohort, preview/production isolation, forged paths and payloads rejected')

# FastAPI root redirects must retain a preview/invitation query string.
import server
with TestClient(server.app) as client:
 response=client.get('/?mozkokalypsa=preview&open=free',follow_redirects=False)
 assert response.headers['location']=='/index.html?mozkokalypsa=preview&open=free'

full=bank['boards'][2]
progress=m.validate_progress({'moves':len(full['answers']),'found':[{'answerIndex':i,**a} for i,a in enumerate(full['answers'])]},full,'finish')
assert all(0<=a['colorIndex']<12 for a in progress['found'])
