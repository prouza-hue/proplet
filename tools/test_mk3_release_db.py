"""48h gates, cloned cohort, concurrent rewards and isolation in a disposable DB."""
import argparse,json,secrets,sys,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from backend import mozkokalypsa_round3 as m
from backend.mozkokalypsa import validate_progress
p=argparse.ArgumentParser();p.add_argument('--database-report',type=Path,required=True);p.add_argument('--password-file',type=Path,required=True);a=p.parse_args()
r=json.loads(a.database_report.read_text());assert r['host']=='127.0.0.1' and r['database'].startswith('proplet_test_')
opts=dict(host='127.0.0.1',port=55432,user='proplet_test_admin',password=a.password_file.read_text().strip(),dbname=r['database'],autocommit=True)
def q(s,v=(),role=None):
 with psycopg.connect(**opts) as c:
  if role:c.execute('set role service_role')
  return c.execute(s,v).fetchall()
player=str(uuid.uuid4());outsider=str(uuid.uuid4())
for pid in (player,outsider):q('insert into players(id,name,family_code,token_hash) values(%s,%s,%s,%s) returning id',(pid,'Synthetic round III','SOLO_'+pid[:8],secrets.token_hex(32)))
q("insert into mozkokalypsa_invites(experiment_id,player_id,slot) values('mozkokalypsa-round2-20260925',%s,1) returning player_id",(player,))
with psycopg.connect(**opts) as c:c.execute((ROOT/'docs/playtests/MOZKOKALYPSA3-ACTIVATE.sql').read_text())
old=q("select player_id,slot,active,participant_role from mozkokalypsa_invites where experiment_id='mozkokalypsa-round2-20260925' and active order by player_id")
new=q('select player_id,slot,active,participant_role from mozkokalypsa_invites where experiment_id=%s order by player_id',(m.EXPERIMENT,));assert new==old and new
with psycopg.connect(**opts) as c:c.execute((ROOT/'docs/playtests/MOZKOKALYPSA3-ACTIVATE.sql').read_text())
assert q('select player_id,slot,active,participant_role from mozkokalypsa_invites where experiment_id=%s order by player_id',(m.EXPERIMENT,))==new
assert q('select extract(epoch from closes_at-opens_at)::int from mozkokalypsa_experiments where id=%s',(m.EXPERIMENT,))[0][0]==48*3600
before=q("select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'')) from mozkokalypsa_attempts a where experiment_id<>'mozkokalypsa-round3-interwoven-v2'")
normal={t:q(sql.SQL('select count(*) from {} where player_id=%s').format(sql.Identifier(t)),(player,)) for t in ('results','puzzle_runs','puzzle_attempts','streak_rescues','free_slot_rewards')}
for role in ('anon','authenticated'):
 for func in ('proplet_mozkokalypsa3_open(text,uuid,text)','proplet_mozkokalypsa3_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb)'):
  assert not q('select has_function_privilege(%s,%s,\'execute\')',(role,func))[0][0]

def open_(board,pid=player,rpc='proplet_mozkokalypsa3_open'):
 return q(sql.SQL('select {}(%s,%s,%s)').format(sql.Identifier(rpc)),(m.EXPERIMENT,pid,board),True)[0][0]
def event(attempt,kind,progress,feedback=None,eventid=None,revision=None):
 return q('select proplet_mozkokalypsa3_event(%s,%s,%s,%s,%s,%s,%s,%s,%s)',(m.EXPERIMENT,player,attempt['board_id'],attempt['id'],eventid or str(uuid.uuid4()),attempt['revision'] if revision is None else revision,kind,Jsonb(progress),Jsonb(feedback or {})),True)[0][0]
def rejected(f,code):
 try:f()
 except psycopg.Error as e:assert e.sqlstate==code,(code,e.sqlstate,str(e))
 else:raise AssertionError('Forbidden SQL operation succeeded')
q("update mozkokalypsa_experiments set opens_at=clock_timestamp()+interval '30 seconds',closes_at=clock_timestamp()+interval '1 hour' where id=%s returning id",(m.EXPERIMENT,))
rejected(lambda:open_('mk3w2-01'),'PT410')
rejected(lambda:open_('mk3w2-01',rpc='proplet_mozkokalypsa_open'),'PT410')
q("update mozkokalypsa_experiments set opens_at=clock_timestamp()-interval '1 hour' where id=%s returning id",(m.EXPERIMENT,))
rejected(lambda:open_('mk3w2-01',outsider),'42501')
rejected(lambda:open_('mk2-01'),'22023')
for index,b in enumerate(m.bank()['boards']):
 attempt=open_(b['id']);assert open_(b['id'])['id']==attempt['id']
 good=validate_progress({'moves':14,'elapsedMs':240000,'found':[{'answerIndex':i,**x} for i,x in enumerate(b['answers'])]},b,'finish')
 rejected(lambda:event(attempt,'feedback',good,{'difficulty':4,'fun':5}),'PT422')
 rejected(lambda:event(attempt,'finish',dict(good,found=[])),'22023')
 assert event(attempt,'finish',good)['revision']==1;attempt['revision']=1
 assert q('select count(*) from account_rewards where player_id=%s',(player,))[0][0]==index
 eid=str(uuid.uuid4());rate={'difficulty':4,'fun':5,'note':'Synthetic, never production'}
 with ThreadPoolExecutor(max_workers=4) as pool:
  replies=list(pool.map(lambda _:event(attempt,'feedback',good,rate,eid),range(4)))
 assert sum(bool(x.get('rewardGranted')) for x in replies)==1,replies
 assert sum(bool(x.get('duplicate')) for x in replies)==3
 assert event(attempt,'feedback',good,rate)['conflict']
 attempt['revision']=2
 assert event(attempt,'feedback',good,dict(rate,note='Edited note'))['rewardGranted'] is False
 attempt['revision']=3
assert q('select count(*),sum(points) from account_rewards where player_id=%s and reward_key like \'mozkokalypsa_v3:%%\'',(player,))==[(8,1600)]
for t,x in normal.items():assert q(sql.SQL('select count(*) from {} where player_id=%s').format(sql.Identifier(t)),(player,))==x,t
assert q("select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'')) from mozkokalypsa_attempts a where experiment_id<>'mozkokalypsa-round3-interwoven-v2'")==before
q("update mozkokalypsa_experiments set closes_at=clock_timestamp()-interval '1 second' where id=%s returning id",(m.EXPERIMENT,))
rejected(lambda:open_('mk3w2-01'),'PT410')
rejected(lambda:event(attempt,'feedback',good,rate),'PT410')
assert q('select sum(points) from account_rewards where player_id=%s',(player,))[0][0]==1600
print('PASS real DB: exact cloned cohort, 48h, pre-open/closed deny incl legacy internal entry, no forged finish, four concurrent retries pay once, 8*200 XP, zero ordinary/team scoring writes, earlier attempts unchanged')
