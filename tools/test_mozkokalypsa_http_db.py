"""Authenticated HTTP -> real PostgreSQL release test, synthetic loopback DB only.
The PostgREST wire transport is replaced by a SQL adapter; session validation,
pilot HTTP handlers, validation, RPC, RLS and persistence are real.
"""
import argparse, hashlib, json, os, secrets, sys, uuid
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
from fastapi import FastAPI
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
from backend import mozkokalypsa as m

p=argparse.ArgumentParser()
p.add_argument('--database-report',type=Path,required=True)
p.add_argument('--password-file',type=Path,required=True)
args=p.parse_args()
report=json.loads(args.database_report.read_text())
assert report['host']=='127.0.0.1' and report['database'].startswith('proplet_test_')
options=dict(host='127.0.0.1',port=55432,user='proplet_test_admin',
 dbname=report['database'],password=args.password_file.read_text().strip())
def query(statement,values=()):
 with psycopg.connect(**options) as c:
  c.execute('set local role service_role')
  return c.execute(statement,values).fetchall()
def select(table,**filters):
 clauses=sql.SQL(' and ').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in filters) or sql.SQL('true')
 return [r[0] for r in query(sql.SQL('select to_jsonb(t) from {} t where {}').format(sql.Identifier(table),clauses),list(filters.values()))]
def insert(table,row):
 keys=list(row)
 return query(sql.SQL('insert into {} ({}) values ({}) returning to_jsonb({}.*)').format(
  sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,keys)),
  sql.SQL(',').join(sql.Placeholder() for _ in keys),sql.Identifier(table)),list(row.values()))[0][0]
def rpc(name,body):
 assert name in ('proplet_mozkokalypsa_open','proplet_mozkokalypsa_event')
 return query(sql.SQL('select {}({})').format(sql.Identifier(name),
  sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in body)),
  [Jsonb(v) if isinstance(v,dict) else v for v in body.values()])[0][0]
players=[str(uuid.uuid4()) for _ in range(2)]
for i,pid in enumerate(players):
 insert('players',dict(id=pid,name='Synthetic Mozkokalypsa '+str(i),
  family_code='SOLO_'+pid[:8].upper(),token_hash=hashlib.sha256(secrets.token_bytes(32)).hexdigest()))
insert('mozkokalypsa_invites',dict(experiment_id=m.EXPERIMENT,player_id=players[0],slot=0))
normal_tables=('results','puzzle_runs','puzzle_attempts','account_rewards','streak_rescues','free_slot_rewards')
def normal_snapshot():
 return {t:[select(t,player_id=pid) for pid in players] for t in normal_tables}
before=normal_snapshot()
with ExitStack() as stack:
 stack.enter_context(patch.dict(os.environ,{'VERCEL_ENV':'production','PROPLET_MOZKOKALYPSA_ENABLED':'true'}))
 for name,value in {'db_select':select,'db_insert':insert}.items():
  stack.enter_context(patch.object(server,name,value))
 stack.enter_context(patch.object(server.DB_HTTP_CLIENT,'request',side_effect=AssertionError('External I/O forbidden')))
 tokens=[server.new_session(pid) for pid in players]
 headers=[{'Authorization':'Bearer '+t} for t in tokens]
 app=FastAPI()
 m.install(app,auth_player=server.auth_player,db_select=select,db_request=None,
  db_rpc=rpc,enforce_rate_limit=lambda *a,**kw:None)
 with TestClient(app) as c:
  assert c.get('/api/mozkokalypsa/status').json()=={'eligible':False}
  assert c.post('/api/mozkokalypsa/open/mk26-03').status_code==401
  assert c.post('/api/mozkokalypsa/open/mk26-03',headers={'Authorization':'Bearer invalid'}).status_code==401
  assert c.get('/api/mozkokalypsa/status',headers=headers[1]).json()=={'eligible':False}
  assert c.post('/api/mozkokalypsa/open/mk26-03',headers=headers[1]).status_code==403
  assert c.get('/api/mozkokalypsa/status?qa=true',headers=headers[0]).status_code==403
  assert c.get('/api/mozkokalypsa/board/mk26-03?qa=true',headers=headers[0]).status_code==403
  opened=c.post('/api/mozkokalypsa/open/mk26-03',headers=headers[0])
  assert opened.status_code==200,opened.text
  board=opened.json()['puzzle']; attempt=opened.json()['attempt']
  assert c.post('/api/mozkokalypsa/open/mk26-03',headers=headers[0]).json()['attempt']['id']==attempt['id']
  rev=0
  progress={'elapsedMs':1000,'moves':1,'found':[{'answerIndex':0,**board['answers'][0]}],
   'firstCorrectMs':1000,'lastCorrectMs':1000}
  def event(kind,changes=None,feedback=None,revision=None):
   return dict(event_id=str(uuid.uuid4()),attempt_id=attempt['id'],board_id=board['id'],
    revision=rev if revision is None else revision,event_type=kind,
    progress={**progress,**(changes or {})},feedback=feedback or {})
  def post(body,status=200):
   r=c.post('/api/mozkokalypsa/event',json=body,headers=headers[0])
   assert r.status_code==status,r.text
   return r.json()
  first=event('correct');assert post(first)['revision']==1;rev=1
  assert post(first)['duplicate'] is True
  assert len(select('mozkokalypsa_events',attempt_id=attempt['id']))==1
  post(event('correct',revision=0),409)
  post(event('finish',{'found':[]}),422)
  post(event('correct',{'found':[{'answerIndex':0,'word':'FORGED','path':[]}]}),422)
  assert c.post('/api/mozkokalypsa/event',json=event('correct'),headers=headers[1]).status_code==403
  for kind,changes in [
   ('wrong',{'elapsedMs':2000,'moves':2,'wrongAttempts':1}),
   ('hint',{'elapsedMs':3000,'hints':1,'maxHintLevel':1,'firstHintMs':3000}),
   ('calm',{'elapsedMs':4000,'calmMode':True}),
   ('leave',{'elapsedMs':5000}),
   ('resume',{'elapsedMs':6000,'resumeCount':1})]:
   progress.update(changes)
   assert post(event(kind))['revision']==rev+1;rev+=1
  # A fresh authenticated read is the reload/cross-device recovery source.
  recovered=c.get('/api/mozkokalypsa/status',headers=headers[0]).json()['attempts'][0]
  assert recovered['revision']==rev and recovered['progress']['foundWords']==1
  assert recovered['progress']['elapsedMs']==6000 and recovered['progress']['calmMode']
  progress.update(elapsedMs=20000,moves=len(board['answers'])+1,lastCorrectMs=20000,
   found=[{'answerIndex':i,**a} for i,a in enumerate(board['answers'])])
  assert post(event('finish'))['revision']==rev+1;rev+=1
  post(event('correct'),409)
  assert post(event('feedback',feedback={'difficulty':5,'fun':4,'note':'Synthetic isolated QA'}))['revision']==rev+1;rev+=1
  persisted=select('mozkokalypsa_attempts',id=attempt['id'])[0]
  assert persisted['completed'] and persisted['completed_at'] and persisted['revision']==rev
  assert persisted['progress']['foundWords']==14 and persisted['progress']['hints']==1
  assert persisted['feedback']=={'difficulty':5,'fun':4,'note':'Synthetic isolated QA'}
  assert len(select('mozkokalypsa_events',attempt_id=attempt['id']))==rev
  query('update mozkokalypsa_invites set active=false where player_id=%s returning player_id',(players[0],))
  assert c.post('/api/mozkokalypsa/open/mk26-03',headers=headers[0]).status_code==403
  assert normal_snapshot()==before
print('PASS authenticated HTTP + PostgreSQL: real custom sessions, invite/anonymous/QA denial, durable metrics, retry, revision conflict, reload recovery, 14-word finish, feedback, revoke; normal XP/results unchanged')
print('LIMIT: loopback schema and SQL transport adapter; hosted PostgREST and production browser session are not covered by this test')
