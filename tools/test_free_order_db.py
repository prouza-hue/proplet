"""Order RPC regression in the existing disposable loopback database fixture."""
import argparse,json,uuid
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
parser=argparse.ArgumentParser();parser.add_argument('--database-report',type=Path,required=True);parser.add_argument('--password-file',type=Path,required=True);args=parser.parse_args()
report=json.loads(args.database_report.read_text())
assert report['host']=='127.0.0.1' and report['database'].startswith('proplet_test_')
with psycopg.connect(host='127.0.0.1',port=55432,user='proplet_test_admin',dbname=report['database'],password=args.password_file.read_text().strip(),autocommit=True,row_factory=dict_row) as c:
 with c.transaction():
  c.execute('set local role service_role')
  player=str(uuid.uuid4())
  c.execute("insert into players(id,name,family_code,token_hash) values(%s,'Synthetic order',%s,%s)",(player,'SOLO_'+player[:8],player))
  def call(rev,mode,ids,request,guest=False):
   return c.execute('select proplet_free_order_v1(%s,%s,%s,%s,%s,%s,%s,%s) as r',(player,'easy',rev,mode,Jsonb(ids),request,guest,False)).fetchone()['r']
  first=call(0,'varied',['old-1','g5-1'],'synthetic-order-1')
  assert call(0,'varied',['old-1','g5-1'],'synthetic-order-1')==first
  second=call(1,'numeric',['g5-1','old-1','batch-2'],'synthetic-order-2')
  assert second['record']['ids']==['old-1','g5-1','batch-2']
  assert call(1,'varied',[],'synthetic-stale')['conflict']
  assert call(0,'varied',['guest'],'synthetic-guest',True)['record']==second['record']
  assert c.execute('select count(*) as n from results where player_id=%s',(player,)).fetchone()['n']==0
  for role in ('anon','authenticated'):
   assert not c.execute("select has_table_privilege(%s,'public.player_free_order','SELECT') as allowed",(role,)).fetchone()['allowed']
   assert not c.execute("select has_function_privilege(%s,'public.proplet_free_order_v1(uuid,text,bigint,text,jsonb,text,boolean,boolean)','execute') as allowed",(role,)).fetchone()['allowed']
 print('PASS order SQL: retry, CAS, immutable prefix, append, account wins guest import, no results, restricted grants')
