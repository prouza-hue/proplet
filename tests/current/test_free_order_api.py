"""Order API ownership, validation and isolated environment gates, no network."""
import os,sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
from fastapi import HTTPException
from backend.config import load_settings
from backend.free_order import validate_ids
import server

for env,ref,url in [('production','feat/pestre-poradi-production','https://eanzztstmwlamwfdskbf.supabase.co'),('preview','feat/pestre-poradi-production','https://iopyhluayfszskyqqpuc.supabase.co')]:
 with patch.dict(os.environ,{'VERCEL_ENV':env,'VERCEL_GIT_COMMIT_REF':ref,'SUPABASE_URL':url}):
  try:load_settings();raise AssertionError('unsafe preview accepted')
  except RuntimeError:pass
with patch.dict(os.environ,{'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':'feat/pestre-poradi-production','SUPABASE_URL':'https://eanzztstmwlamwfdskbf.supabase.co'}):
 assert load_settings().supabase_url.endswith('eanzztstmwlamwfdskbf.supabase.co')
bank=[{'id':'released','meta':{'level':218}}]
for ids in [['future'],['released','released']]:
 try:validate_ids(ids,bank,[]);raise AssertionError('invalid ids accepted')
 except HTTPException as e:assert e.status_code==400
assert validate_ids(['tombstone','released'],bank,['tombstone'])==['tombstone','released']
client=TestClient(server.app)
with patch.object(server.DB_HTTP_CLIENT,'request',side_effect=AssertionError('external request')),patch.object(server,'enforce_rate_limit',lambda *a,**k:None):
 with patch.dict(os.environ,{'PROPLET_FREE_ORDER_ENABLED':'false'}):
  assert client.get('/api/free-order/config').json()['enabled'] is False
  assert client.get('/api/free-order').json()=={'enabled':False,'records':{}}
 with patch.dict(os.environ,{'PROPLET_FREE_ORDER_ENABLED':'true'}):
  assert client.get('/api/free-order').status_code==401
  body={'difficulty':'easy','mode':'varied','expected_revision':0,'request_id':'synthetic-request-123','ids':['released'],'player_id':'forged'}
  with patch.object(server,'auth_player',return_value={'id':'owner'}),patch.object(server,'db_select',return_value=[]),patch.object(server,'released_free_bank',return_value=bank),patch.object(server,'db_rpc',return_value={'record':{'difficulty':'easy','mode':'varied','revision':1,'newcomer':False,'ids':['released']}}) as rpc:
   result=client.post('/api/free-order',json=body);assert result.status_code==200,result.text
   assert rpc.call_args.args[1]['p_player']=='owner','actor must come from authentication'
   body['ids']=['future'];assert client.post('/api/free-order',json=body).status_code==400
   body['difficulty']='mozkomor';assert client.post('/api/free-order',json=body).status_code==422
  # Resume discovery is independent of which difficulties support varied ordering.
  # Both large-board modes must return their exact newest unfinished server board.
  sessions=[];puzzles={}
  for difficulty in server.FREE_DIFFICULTIES:
   for suffix,seen in [('new','2026-11-07T12:00:00Z'),('old','2026-11-06T12:00:00Z')]:
    puzzle_id=f'{difficulty}-{suffix}'
    sessions.append({'puzzle_id':puzzle_id,'last_seen':seen})
    puzzles[puzzle_id]={'difficulty':difficulty}
  sessions.append({'puzzle_id':'missing-board','last_seen':'2026-11-08T12:00:00Z'})
  def select_resume(table,**filters):
   assert filters.get('player_id')=='owner','resume lookup must remain account-scoped'
   if table=='player_free_order':return []
   assert table=='play_sessions' and filters=={'player_id':'owner','mode':'free','finished':False}
   return sessions
  with patch.object(server,'auth_player',return_value={'id':'owner'}),patch.object(server,'db_select',side_effect=select_resume),patch.object(server,'free_puzzle_info',side_effect=lambda puzzle_id:puzzles.get(puzzle_id)):
   result=client.get('/api/free-order');assert result.status_code==200,result.text
   assert result.json()['resumeIds']=={difficulty:f'{difficulty}-new' for difficulty in server.FREE_DIFFICULTIES},result.json()
   assert result.json()['records']=={},'resume discovery must not create ordering preferences'
print('PASS order API: identity, published IDs, tombstones, unsupported ordering difficulty, all-difficulty exact resume, feature off, preview database gates')
