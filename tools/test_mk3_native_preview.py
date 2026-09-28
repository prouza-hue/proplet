"""Native preview boundaries and immutable approved bank; no external services."""
import hashlib,json,os,subprocess,sys
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend import mozkokalypsa as m, mozkokalypsa_preview as p
from backend.config import load_settings

def forbidden(*a,**kw):raise AssertionError('Preview attempted a production data call')
app=FastAPI();m.install(app,auth_player=forbidden,db_select=forbidden,db_request=forbidden,db_rpc=forbidden,enforce_rate_limit=forbidden)
with patch.dict(os.environ,{'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':p.BRANCH,'SUPABASE_URL':'https://production.invalid','SUPABASE_SECRET_KEY':'not-a-real-key','VAPID_PRIVATE_KEY':'not-a-real-key','CRON_SECRET':'not-a-real-key'},clear=True):
 config=load_settings();assert not any((config.supabase_url,config.supabase_secret_key,config.vapid_private_key,config.cron_secret))
 with TestClient(app) as c:
  s=c.get('/api/mozkokalypsa/status?qa=true').json()
  assert s['previewRound']==3 and s['qa'] and s['deadlineIsExample'] and s['rewardsAreExample']
  assert s['order']==[f'mk3w2-{i:02d}' for i in range(1,9)]
  for board in p.bank()['boards']:
   assert c.get('/api/mozkokalypsa/board/'+board['id']+'?qa=true').json()['puzzle']==board
  assert c.get('/api/mozkokalypsa/board/mk2-01?qa=true').status_code==404
  assert c.get('/api/mozkokalypsa/status').json()=={'eligible':False}
  assert c.post('/api/mozkokalypsa/open/mk3w2-01').status_code==404
 for env in ['production','','development']:
  with patch.dict(os.environ,{'VERCEL_ENV':env}):
   try:load_settings();raise AssertionError('Unsafe environment accepted')
   except RuntimeError:pass
with patch.dict(os.environ,{'VERCEL_ENV':'production','VERCEL_GIT_COMMIT_REF':'main'},clear=True),TestClient(app) as c:
 assert c.get('/api/mozkokalypsa/status?qa=true').status_code==403
 assert c.get('/api/mozkokalypsa/board/mk3w2-01?qa=true').status_code==403
assert hashlib.sha256((ROOT/'data/playtests/mozkokalypsa-v3-preview.json').read_bytes()).hexdigest()==p.BANK_SHA256
# Real application guard, ahead of account bridges. Synthetic environment only.
env={**os.environ,'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':p.BRANCH,'SUPABASE_URL':'https://production.invalid','SUPABASE_SECRET_KEY':'synthetic'}
subprocess.run([sys.executable,'-c',"""
from fastapi.testclient import TestClient
import server
assert not server.SUPABASE_URL and not server.SUPABASE_SECRET_KEY
with TestClient(server.app) as c:
 for path in ['/api/result','/api/mozkokalypsa/event','/api/mozkokalypsa/open/mk3w2-01','/api/auth/register','/api/word-discovery/claim','/api/product-event']:
  assert c.post(path,json={}).status_code==403,path
 assert c.get('/api/cron/daily-push-v2').status_code==403
 assert c.get('/api/mozkokalypsa/status?qa=true').json()['previewRound']==3
"""],cwd=ROOT,env=env,check=True)
print('PASS: approved bank byte identity, all eight native routes, local-only status, production denial, inherited credentials cleared, all writes blocked before account middleware')
