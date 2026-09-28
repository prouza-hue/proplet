"""Authenticated HTTP -> real PostgreSQL release test, synthetic loopback DB only.
Session validation, pilot HTTP handlers, PostgREST HTTP transport, JWT role,
RPC, RLS and persistence are real. Only Supabase gateway routing is local.
"""
import argparse, base64, hashlib, hmac, json, os, secrets, sys, uuid, subprocess, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import httpx
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
from backend import mozkokalypsa_round3 as m
from backend import mozkokalypsa as legacy

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
 assert name in ('proplet_mozkokalypsa3_open','proplet_mozkokalypsa3_event')
 return query(sql.SQL('select {}({})').format(sql.Identifier(name),
  sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in body)),
  [Jsonb(v) if isinstance(v,dict) else v for v in body.values()])[0][0]
window=query("update mozkokalypsa_experiments set active=true,opens_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour' where id=%s returning opens_at,closes_at",(m.EXPERIMENT,))[0]
players=[str(uuid.uuid4()) for _ in range(4)]
for i,pid in enumerate(players):
 insert('players',dict(id=pid,name='Synthetic Mozkokalypsa '+str(i),
  family_code='SOLO_'+pid[:8].upper(),token_hash=hashlib.sha256(secrets.token_bytes(32)).hexdigest()))
# Run the full write flow as an observer sharing a frozen order with a primary tester.
insert('mozkokalypsa_invites',dict(experiment_id=m.EXPERIMENT,player_id=players[2],slot=0))
insert('mozkokalypsa_invites',dict(experiment_id=m.EXPERIMENT,player_id=players[0],slot=0,participant_role='observer'))
insert('mozkokalypsa_invites',dict(experiment_id=m.EXPERIMENT,player_id=players[3],slot=0))
for role in ('observer',):
 try:
  insert('mozkokalypsa_invites',dict(experiment_id=m.EXPERIMENT,player_id=players[1],slot=0,participant_role=role))
 except psycopg.errors.UniqueViolation:
  pass
 else:
  raise AssertionError('Second observer allowed')
normal_tables=('results','puzzle_runs','puzzle_attempts','account_rewards','streak_rescues','free_slot_rewards')
def normal_snapshot():
 return {t:[select(t,player_id=pid) for pid in players] for t in normal_tables}
before=normal_snapshot()
# Dedicated loopback PostgREST with a disposable JWT key and schema.
jwt_secret=secrets.token_urlsafe(40)
def b64(value):return base64.urlsafe_b64encode(value).rstrip(b'=').decode()
unsigned=b64(b'{"alg":"HS256","typ":"JWT"}')+'.'+b64(json.dumps({'role':'service_role','exp':int(time.time())+1800}).encode())
jwt=unsigned+'.'+b64(hmac.new(jwt_secret.encode(),unsigned.encode(),hashlib.sha256).digest())
container='mk-rest-'+secrets.token_hex(4)
subprocess.run(['docker','run','--rm','-d','--name',container,'--network','host',
 '-e','PGRST_DB_URI=postgres://proplet_test_admin:local-test-only@127.0.0.1:55432/'+report['database'],
 '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon',
 '-e','PGRST_SERVER_HOST=127.0.0.1','-e','PGRST_SERVER_PORT=55433',
 '-e','PGRST_JWT_SECRET='+jwt_secret,'postgrest/postgrest:v12.2.3'],check=True,stdout=subprocess.DEVNULL)
class Gateway(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def relay(self):
  assert self.path.startswith('/rest/v1/')
  body=self.rfile.read(int(self.headers.get('Content-Length','0')))
  r=httpx.request(self.command,'http://127.0.0.1:55433/'+self.path[len('/rest/v1/'):],
   content=body,headers={k:v for k,v in self.headers.items() if k.lower() not in ('host','content-length')},timeout=15)
  self.send_response(r.status_code)
  self.send_header('Content-Type',r.headers.get('Content-Type','application/json'))
  self.send_header('Content-Length',str(len(r.content)));self.end_headers();self.wfile.write(r.content)
 do_GET=do_POST=do_PATCH=do_DELETE=relay
gateway=ThreadingHTTPServer(('127.0.0.1',0),Gateway)
threading.Thread(target=gateway.serve_forever,daemon=True).start()
with ExitStack() as stack:
 stack.callback(lambda:subprocess.run(['docker','stop',container],stdout=subprocess.DEVNULL))
 stack.callback(gateway.server_close)
 stack.callback(gateway.shutdown)
 for _ in range(30):
  try:
   if httpx.get('http://127.0.0.1:55433/',headers={'Authorization':'Bearer '+jwt}).status_code==200:break
  except httpx.HTTPError:pass
  time.sleep(1)
 else:raise AssertionError('Local PostgREST did not start')
 stack.enter_context(patch.object(m,'OPENS',window[0]))
 stack.enter_context(patch.object(m,'CLOSES',window[1]))
 stack.enter_context(patch.dict(os.environ,{'VERCEL_ENV':'production','PROPLET_MOZKOKALYPSA_ENABLED':'true'}))
 stack.enter_context(patch.object(server,'SUPABASE_URL',f'http://127.0.0.1:{gateway.server_port}'))
 stack.enter_context(patch.object(server,'SUPABASE_SECRET_KEY',jwt))
 tokens=[server.new_session(pid) for pid in players]
 headers=[{'Authorization':'Bearer '+t} for t in tokens]
 app=FastAPI()
 m.install(app,auth_player=server.auth_player,db_select=server.db_select,db_rpc=server.db_rpc,enforce_rate_limit=server.enforce_rate_limit,
  validate_progress=legacy.validate_progress,validate_feedback=legacy.validate_feedback)
 with TestClient(app) as c:
  assert c.get('/api/mozkokalypsa3/status').json()=={'eligible':False}
  assert c.post('/api/mozkokalypsa3/open/mk3w2-03').status_code==401
  assert c.post('/api/mozkokalypsa3/open/mk3w2-03',headers={'Authorization':'Bearer invalid'}).status_code==401
  assert c.get('/api/mozkokalypsa3/status',headers=headers[1]).json()=={'eligible':False}
  assert c.post('/api/mozkokalypsa3/open/mk3w2-03',headers=headers[1]).status_code==403
  assert c.get('/api/mozkokalypsa3/status?qa=true',headers=headers[0]).status_code==403
  assert c.get('/api/mozkokalypsa3/board/mk3w2-03?qa=true',headers=headers[0]).status_code==403
  for idx in (0,2,3):
   status=c.get('/api/mozkokalypsa3/status',headers=headers[idx]).json()
   assert status['eligible'] and status['order']==[b['id'] for b in m.bank()['boards']]
  opened=c.post('/api/mozkokalypsa3/open/mk3w2-03',headers=headers[0])
  assert opened.status_code==200,opened.text
  board=opened.json()['puzzle']; attempt=opened.json()['attempt']
  assert c.post('/api/mozkokalypsa3/open/mk3w2-03',headers=headers[0]).json()['attempt']['id']==attempt['id']
  rev=0
  progress={'elapsedMs':1000,'moves':1,'found':[{'answerIndex':0,**board['answers'][0]}],
   'firstCorrectMs':1000,'lastCorrectMs':1000}
  def event(kind,changes=None,feedback=None,revision=None):
   return dict(event_id=str(uuid.uuid4()),attempt_id=attempt['id'],board_id=board['id'],
    revision=rev if revision is None else revision,event_type=kind,
    progress={**progress,**(changes or {})},feedback=feedback or {})
  def post(body,status=200):
   r=c.post('/api/mozkokalypsa3/event',json=body,headers=headers[0])
   assert r.status_code==status,r.text
   return r.json()
  post(event('feedback',feedback={'difficulty':5,'fun':4}),422)
  first=event('correct');assert post(first)['revision']==1;rev=1
  assert post(first)['duplicate'] is True
  assert len(select('mozkokalypsa_events',attempt_id=attempt['id']))==1
  post(event('correct',revision=0),409)
  post(event('finish',{'found':[]}),422)
  post(event('correct',{'found':[{'answerIndex':0,'word':'FORGED','path':[]}]}),422)
  assert c.post('/api/mozkokalypsa3/event',json=event('correct'),headers=headers[1]).status_code==403
  for kind,changes in [
   ('wrong',{'elapsedMs':2000,'moves':2,'wrongAttempts':1}),
   ('hint',{'elapsedMs':3000,'hints':1,'maxHintLevel':1,'firstHintMs':3000}),
   ('calm',{'elapsedMs':4000,'calmMode':True}),
   ('leave',{'elapsedMs':5000}),
   ('resume',{'elapsedMs':6000,'resumeCount':1})]:
   progress.update(changes)
   assert post(event(kind))['revision']==rev+1;rev+=1
  # A fresh authenticated read is the reload/cross-device recovery source.
  recovered=c.get('/api/mozkokalypsa3/status',headers=headers[0]).json()['attempts'][0]
  assert recovered['revision']==rev and recovered['progress']['foundWords']==1
  assert recovered['progress']['elapsedMs']==6000 and recovered['progress']['calmMode']
  progress.update(elapsedMs=20000,moves=len(board['answers'])+1,lastCorrectMs=20000,
   found=[{'answerIndex':i,**a} for i,a in enumerate(board['answers'])])
  assert post(event('finish'))['revision']==rev+1;rev+=1
  post(event('correct'),409)
  assert select('account_rewards',player_id=players[0])==[],'finish alone paid XP'
  post(event('feedback',feedback={'fun':4}),422)
  rating=event('feedback',feedback={'difficulty':5,'fun':4,'note':'Synthetic isolated QA'})
  paid=post(rating);assert paid['revision']==rev+1 and paid['rewardGranted'];rev+=1
  assert post(rating)['duplicate']
  assert len(select('account_rewards',player_id=players[0]))==1
  paid_again=post(event('feedback',feedback=rating['feedback']));assert not paid_again['rewardGranted'];rev+=1
  reward=select('account_rewards',player_id=players[0]);assert len(reward)==1 and reward[0]['points']==200

  persisted=select('mozkokalypsa_attempts',id=attempt['id'])[0]
  assert persisted['completed'] and persisted['completed_at'] and persisted['revision']==rev
  assert persisted['progress']['foundWords']==14 and persisted['progress']['hints']==1
  assert persisted['feedback']=={'difficulty':5,'fun':4,'note':'Synthetic isolated QA'}
  assert len(select('mozkokalypsa_events',attempt_id=attempt['id']))==rev
  query('update mozkokalypsa_invites set active=false where player_id=%s returning player_id',(players[0],))
  assert c.post('/api/mozkokalypsa3/open/mk3w2-03',headers=headers[0]).status_code==403
  after=normal_snapshot()
  assert all(after[t]==before[t] for t in normal_tables if t!='account_rewards')
  assert all(after['account_rewards'][i]==before['account_rewards'][i] for i in (1,2,3))
  # Deadline is enforced by the database even with backend wall-clock bypassed.
  closed=query("update mozkokalypsa_experiments set closes_at=clock_timestamp()-interval '1 second' where id=%s returning closes_at",(m.EXPERIMENT,))[0][0]
  # Simulate a server clock just before the same configured deadline while SQL
  # is already past it: the database error must propagate as HTTP 410, not 400.
  from datetime import timedelta
  with patch.object(m,'CLOSES',closed),patch.object(m,'utc_now',return_value=closed-timedelta(seconds=1)):
   r=c.post('/api/mozkokalypsa3/open/mk3w2-03',headers=headers[2])
   assert r.status_code==410,r.text
  try:
   rpc('proplet_mozkokalypsa3_event',dict(p_experiment=m.EXPERIMENT,p_player=players[0],p_board=board['id'],
    p_attempt=attempt['id'],p_event=str(uuid.uuid4()),p_revision=rev,p_kind='feedback',p_progress=progress,p_feedback=rating['feedback']))
  except psycopg.Error as error:assert error.sqlstate=='PT410'
  else:raise AssertionError('late database write accepted')
  assert select('account_rewards',player_id=players[0])==reward

print('PASS authenticated HTTP + real PostgREST + PostgreSQL: real custom sessions, invite/anonymous/QA denial, durable metrics, retry, revision conflict, reload recovery, 14-word finish, feedback, revoke; completion + two ratings pays exactly 200 XP once; all ordinary results/progress/streaks unchanged; DB deadline enforced')
print('LIMIT: synthetic loopback schema, local gateway routing; hosted production browser session is not covered')
