"""Isolated real HTTP/session SQL fixture; never connects outside loopback."""
import argparse
from contextlib import ExitStack
import json
from pathlib import Path
import sys
from unittest.mock import patch
import uuid
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import server
parser=argparse.ArgumentParser();parser.add_argument('--database-report',type=Path,required=True);parser.add_argument('--password-file',type=Path,required=True);parser.add_argument('--serve',type=int)
args=parser.parse_args();report=json.loads(args.database_report.read_text())
assert report['host']=='127.0.0.1' and report['database'].startswith('proplet_test_')
options=dict(host='127.0.0.1',port=55432,user='proplet_test_admin',dbname=report['database'],password=args.password_file.read_text().strip())
def query(statement,values=()):
 with psycopg.connect(**options) as c:
  c.execute('set local role service_role');return c.execute(statement,values).fetchall()
player=str(uuid.uuid4());query("insert into players(id,name,family_code,token_hash) values(%s,'Synthetic session',%s,%s) returning id",(player,'SOLO_'+player[:8].upper(),player))
query("update fair_play_policy set enabled=true,daily_from='2026-09-15' returning singleton")
def select(table,columns="*",**filters):
 clauses=sql.SQL(' and ').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in filters) or sql.SQL('true')
 return [r[0] for r in query(sql.SQL('select to_jsonb(t) from {} t where {}').format(sql.Identifier(table),clauses),list(filters.values()))]
def rpc(name,body):
 return query(sql.SQL('select {}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.SQL('{} => %s').format(sql.Identifier(k)) for k in body)),[Jsonb(v) if isinstance(v,dict) else v for v in body.values()])[0][0]
def actor(authorization,anonymous):
 if authorization=='Bearer synthetic-session':return {'player_id':player,'anonymous_id':None}
 if authorization:raise HTTPException(401,'Invalid synthetic token')
 if anonymous:return {'player_id':None,'anonymous_id':'synthetic-'+anonymous}
 raise HTTPException(401,'Missing identity')
app=FastAPI()
app.add_api_route('/api/play-session/config',server.play_session_config,methods=['GET'])
app.add_api_route('/api/play-session',server.play_session_command,methods=['POST'])
@app.get('/api/config')
def config():return json.loads((ROOT/'tests/fixtures/browser/config.json').read_text())
@app.get('/api/tajenka')
def tajenka():return json.loads((ROOT/'tests/fixtures/browser/tajenka.json').read_text())
@app.get('/api/progress')
def progress():return {'completed':[]}
@app.get('/api/me')
def me():return {'id':player,'name':'Synthetic session','stats':{}}
@app.get('/__fixture')
def fixture():return {'player':player,'isolated':True}
app.mount('/',StaticFiles(directory=ROOT/'public',html=True))
with ExitStack() as stack:
 for name,value in {'db_select':select,'db_rpc':rpc,'telemetry_actor':actor,'enforce_rate_limit':lambda *a,**kw:None}.items():stack.enter_context(patch.object(server,name,value))
 stack.enter_context(patch.object(server.DB_HTTP_CLIENT,'request',side_effect=AssertionError('External I/O forbidden')))
 if args.serve:
  import uvicorn;uvicorn.run(app,host='127.0.0.1',port=args.serve,access_log=False)
 else:
  client=TestClient(app);puzzle=server.load_puzzles()['free']['easy'][0]
  payload={'action':'open','puzzle_id':puzzle['id'],'challenge_key':'free:'+puzzle['id'],'mode':'free','difficulty':'easy','attempt_id':'synthetic-http-attempt','owner_id':str(uuid.uuid4()),'sequence':1,'progress':{}}
  assert client.post('/api/play-session',json=payload).status_code==401
  headers={'Authorization':'Bearer synthetic-session'}
  response=client.post('/api/play-session',json=payload,headers=headers);assert response.status_code==200,response.text
  assert response.json()['verified'] is True
  bad={**payload,'action':'pulse','sequence':2,'progress':{'found':[{'answerIndex':0,'path':[-1]}]}}
  assert client.post('/api/play-session',json=bad,headers=headers).status_code==400
  assert client.post('/api/play-session',json={**payload,'action':'finish','sequence':3},headers=headers).status_code==400
  wrong={**payload,'challenge_key':'free:another'};assert client.post('/api/play-session',json=wrong,headers=headers).status_code==400
  wrong={**payload,'owner_id':str(uuid.uuid4())};assert client.post('/api/play-session',json=wrong,headers=headers).status_code==409
  print('PASS HTTP/SQL identity, valid open, conflicting device, forged word/path, incomplete finish, challenge binding')
