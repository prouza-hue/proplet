"""Deterministic boundary tests; all identities and transports are synthetic."""
import os,sys,unittest
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from backend import mozkokalypsa as old
from backend import mozkokalypsa_round3 as m

class Release(unittest.TestCase):
 def setUp(self):
  self.calls=[];self.app=FastAPI()
  def auth(token):
   if token not in ('Bearer invited','Bearer outsider'):raise HTTPException(401,'login')
   return {'id':'00000000-0000-4000-8000-000000000001' if token=='Bearer invited' else '00000000-0000-4000-8000-000000000002'}
  def select(table,**filters):
   self.calls.append((table,filters))
   if table=='mozkokalypsa_experiments':return [{'active':True,'opens_at':m.OPENS_AT,'closes_at':m.CLOSES_AT,'reward_xp':200}]
   if table=='mozkokalypsa_invites':return [{'slot':1}] if filters['player_id'].endswith('1') else []
   return []
  def rpc(name,body):self.calls.append((name,body));return {'ok':True,'revision':body.get('p_revision',0)+1}
  old.install(self.app,auth_player=auth,db_select=select,db_request=lambda *a,**k:None,db_rpc=rpc,enforce_rate_limit=lambda *a,**k:None)
  self.c=TestClient(self.app);self.h={'Authorization':'Bearer invited'}
  self.env=patch.dict(os.environ,{'VERCEL_ENV':'production','PROPLET_MOZKOKALYPSA_ENABLED':'true'},clear=True);self.env.start();self.addCleanup(self.env.stop)
 def test_exact_48_hour_switch_and_expiry(self):
  self.assertEqual(m.CLOSES-m.OPENS,timedelta(hours=48))
  with patch.object(m,'utc_now',return_value=m.OPENS-timedelta(microseconds=1)),patch.object(old,'is_closed',return_value=False):
   r=self.c.get('/api/mozkokalypsa/status',headers=self.h).json()
   self.assertEqual(r['experimentId'],old.EXPERIMENT);self.assertEqual(r['nextTransitionAt'],m.OPENS_AT)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01',headers=self.h).status_code,410)
  with patch.object(m,'utc_now',return_value=m.OPENS):
   r=self.c.get('/api/mozkokalypsa/status',headers=self.h).json();self.assertEqual(r['experimentId'],m.EXPERIMENT);self.assertEqual(len(r['order']),8)
  with patch.object(m,'utc_now',return_value=m.CLOSES-timedelta(microseconds=1)):
   self.assertTrue(self.c.get('/api/mozkokalypsa/status',headers=self.h).json()['eligible'])
  with patch.object(m,'utc_now',return_value=m.CLOSES):
   self.assertEqual(self.c.get('/api/mozkokalypsa/status',headers=self.h).json(),{'eligible':False})
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01',headers=self.h).status_code,410)
 def test_auth_preview_and_board_boundaries(self):
  with patch.object(m,'utc_now',return_value=m.OPENS):
   self.assertEqual(self.c.get('/api/mozkokalypsa/status?qa=true').status_code,403)
   self.assertEqual(self.c.get('/api/mozkokalypsa3/board/mk3w2-01?qa=true',headers=self.h).status_code,403)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01').status_code,401)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01',headers={'Authorization':'Bearer outsider'}).status_code,403)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk2-01',headers=self.h).status_code,404)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01',headers=self.h).status_code,200)
   self.assertEqual(self.calls[-1][0],'proplet_mozkokalypsa3_open')
  with patch.dict(os.environ,{'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':m.BRANCH}):
   n=len(self.calls);self.assertEqual(len(self.c.get('/api/mozkokalypsa/status?qa=true').json()['order']),8)
   self.assertEqual(self.c.post('/api/mozkokalypsa3/open/mk3w2-01',headers=self.h).status_code,404)
   self.assertEqual(len(self.calls),n)
 def test_forged_progress_is_rejected_before_rpc(self):
  b=m.bank()['boards'][0]
  good={'event_id':'00000000-0000-4000-8000-000000000021','attempt_id':'00000000-0000-4000-8000-000000000022','board_id':b['id'],'revision':0,'event_type':'finish','progress':{'elapsedMs':5000,'moves':14,'found':[{'answerIndex':i,**a} for i,a in enumerate(b['answers'])]}}
  with patch.object(m,'utc_now',return_value=m.OPENS):
   self.assertEqual(self.c.post('/api/mozkokalypsa3/event',headers=self.h,json=good).status_code,200)
   self.assertEqual(self.calls[-1][0],'proplet_mozkokalypsa3_event')
   self.assertEqual(self.calls[-1][1]['p_experiment'],m.EXPERIMENT)
   for bad in [dict(good,player_id='forged'),dict(good,board_id='mk2-01'),dict(good,progress={'moves':14,'found':[]}),dict(good,event_type='feedback',feedback={'fun':5})]:
    self.assertEqual(self.c.post('/api/mozkokalypsa3/event',headers=self.h,json=bad).status_code,422)

if __name__=='__main__':unittest.main()
