"""Run new session SQL only in an existing disposable loopback fixture DB."""
import argparse
import json
from pathlib import Path
import uuid
import sys
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

parser=argparse.ArgumentParser()
parser.add_argument('--database-report',type=Path,required=True)
parser.add_argument('--password-file',type=Path,required=True)
args=parser.parse_args()
report=json.loads(args.database_report.read_text())
assert report['host']=='127.0.0.1' and report['database'].startswith('proplet_test_')
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from backend.contracts import ResultCreate
from backend.results import build_command, result_identity
with psycopg.connect(host='127.0.0.1',port=55432,user='proplet_test_admin',dbname=report['database'],password=args.password_file.read_text().strip(),autocommit=True,row_factory=dict_row) as c:
 assert c.execute("select to_regclass('public.play_sessions') as table_name").fetchone()['table_name'], 'Run the base fixture with current migrations first'
 with c.transaction():
  c.execute('set local role service_role')
  player=str(uuid.uuid4()); owner=str(uuid.uuid4()); other=str(uuid.uuid4())
  c.execute("insert into players(id,name,family_code,token_hash) values(%s,'Synthetic fair play',%s,%s)",(player,'SOLO_'+player[:8].upper(),player))
  def call(action,seq,who=owner,actor='a:synthetic-guest',progress=None):
   return c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) as r',(actor,player if actor.startswith('p:') else None,'daily:2026-09-17','synthetic-puzzle','daily','synthetic-attempt',who,seq,action,Jsonb(progress or {}))).fetchone()['r']
  a=call('open',1);assert a['verified'] and a['elapsed_ms']==0
  assert call('open',1,other)['error']=='busy'
  c.execute("update play_sessions set last_seen=clock_timestamp()-interval '2 seconds' where actor_key='a:synthetic-guest'")
  p={'found':[{'answerIndex':0,'word':'TEST','path':[0,1,2,3]}],'moves':1,'elapsedMs':2000}
  b=call('pause',2,progress=p);assert b['elapsed_ms']>=2000 and not b['active']
  duplicate=call('pause',2,progress=p);assert duplicate['elapsed_ms']==b['elapsed_ms'] and duplicate['pause_count']==1
  c.execute("update play_sessions set last_seen=clock_timestamp()-interval '1 hour' where actor_key='a:synthetic-guest'")
  resumed=call('open',3,other);assert resumed['verified'] and resumed['elapsed_ms']==b['elapsed_ms'] and len(resumed['progress']['found'])==1
  assert call('pulse',4,owner)['error']=='ownership'
  c.execute('select proplet_claim_play_sessions_v1(%s,%s)',('a:synthetic-guest',player))
  assert c.execute("select count(*) as n from play_sessions where actor_key='a:synthetic-guest'").fetchone()['n']==0
  row=call('pause',4,other,'p:'+player);assert row['verified']
  # An expired active lease cannot silently produce a verified fast result.
  call('open',5,other,'p:'+player)
  c.execute('update play_sessions set last_seen=clock_timestamp()-interval \'60 seconds\' where player_id=%s',(player,))
  expired=call('open',6,owner,'p:'+player);assert not expired['verified'] and expired['elapsed_ms']>=45000
  finished=call('finish',7,owner,'p:'+player,{'elapsedMs':1000});assert finished['finished'] and finished['elapsed_ms']>=45000
  assert call('finish',8,owner,'p:'+player)['elapsed_ms']==finished['elapsed_ms']
  c.execute("update fair_play_policy set enabled=true,daily_from='2026-09-17'")
  c.execute("insert into puzzle_runs(id,attempt_id,player_id,puzzle_id,challenge_key,mode,difficulty,elapsed_ms,moves) values(%s,'synthetic-attempt',%s,'synthetic-puzzle','daily:2026-09-17','daily','easy',2500,1)",(str(uuid.uuid4()),player))
  saved=c.execute('select timing_verified,elapsed_ms from puzzle_runs where player_id=%s',(player,)).fetchone();assert saved['timing_verified'] is False and saved['elapsed_ms']>=45000
  assert c.execute("select count(*) as n from proplet_ranking_runs_v1('daily','synthetic-puzzle','2026-09-17')").fetchone()['n']==0
  # Both kinds of finish keep XP; only corroborated time is eligible. Retry is exact.
  for verified in (False,True):
   key='daily:2026-09-'+('18' if verified else '19');puzzle='synthetic-'+str(verified);attempt='result-'+str(uuid.uuid4())
   if verified:
    for action,seq in [('open',1),('finish',2)]:
     c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',('p:'+player,player,key,puzzle,'daily',attempt,owner,seq,action,Jsonb({})))
   completed=key[6:]+'T10:00:00+00:00'
   payload=ResultCreate(puzzle_id=puzzle,challenge_key=key,mode='daily',difficulty='easy',daily_date=key[6:],elapsed_ms=20000,moves=12,attempt_id=attempt,completed_at=completed)
   command=build_command(result_identity(player,payload),payload,completed_at=completed,points=100,content_generation=None,free_level=None,legacy_reward_slot=None,team_code_at_completion=None)
   def submit():
    return c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s) as r',(command['playerId'],command['idempotencyKey'],command['requestDigest'],command['commandDigest'],Jsonb(command))).fetchone()['r']
   receipt=submit();assert receipt['awardedPoints']==100;assert submit()==receipt
   result=c.execute('select points,timing_verified from results where player_id=%s and challenge_key=%s',(player,key)).fetchone()
   assert result['points']==100 and result['timing_verified'] is verified,result
   assert c.execute("select count(*) as n from proplet_ranking_runs_v1('daily',%s,%s)",(puzzle,key[6:])).fetchone()['n']==int(verified)
  # No access through the public API roles, regardless of forged actor arguments.
  for role in ('anon','authenticated'):
   assert not c.execute("select has_function_privilege(%s,'public.proplet_play_session_v1(text,uuid,text,text,text,text,uuid,bigint,text,jsonb)','execute') as allowed",(role,)).fetchone()['allowed']
   assert not c.execute("select has_table_privilege(%s,'public.play_sessions','SELECT') as allowed",(role,)).fetchone()['allowed']
 print('PASS fair-play SQL: pause/resume, device ownership, stale sequence, guest claim, lease expiry, immutable finish, ranking exclusion, grants')
