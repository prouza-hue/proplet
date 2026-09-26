"""Exercise exact mixed-run repair twice against the existing disposable CI DB."""
import argparse,json,uuid
from pathlib import Path
import psycopg
from psycopg.types.json import Jsonb
p=argparse.ArgumentParser();p.add_argument('--database-report',type=Path,required=True);p.add_argument('--password-file',type=Path,required=True);a=p.parse_args()
d=json.loads(a.database_report.read_text());assert d['host']=='127.0.0.1' and d['syntheticOnly'] and d['database'].startswith('proplet_test_')
with psycopg.connect(host='127.0.0.1',port=55432,user='proplet_test_admin',password=a.password_file.read_text().strip(),dbname=d['database'],autocommit=True) as c:
    ids=[]
    for initial,later,test in [('board-v3-short','board-v2',False),('board-v2','board-v2',False),('board-v2','board-v3-short',False),('board-v3-short','board-v2',True)]:
        run=str(uuid.uuid4());pair=[]
        for i,version in enumerate([initial,later]):
            eid=str(uuid.uuid4());pair.append(eid)
            c.execute("insert into product_events(id,anonymous_id,event_type,app_version,environment,is_test,onboarding_version,client_release,context,created_at) values (%s,'funnel-synthetic',%s,'test','production',%s,%s,'test',%s,%s)",(eid,['starter_v1_requested','starter_v1_completed'][i],test,version,Jsonb({'starter_run_id':run}),['2026-09-26T10:00:00Z','2026-09-26T10:01:00Z'][i]))
        ids.append(pair)
    script=Path('docs/audits/FUNNEL-MIXED-RUNS-BACKFILL.sql').read_text().replace('ROLLBACK;','COMMIT;')
    for _ in range(2):
        c.execute(script)
        for n,pair in enumerate(ids):
            vals=[c.execute('select onboarding_version from product_events where id=%s',(eid,)).fetchone()[0] for eid in pair]
            assert vals==[['board-v3-short','board-v3-short'],['board-v2','board-v2'],['board-v2','board-v3-short'],['board-v3-short','board-v2']][n],vals
    assert c.execute("select count(*) from product_events where anonymous_id='funnel-synthetic' and environment='production' and not is_test").fetchone()[0]==6
print('PASS real SQL: exact mixed run, uniform v2 unchanged, ambiguous run unchanged, is_test excluded, idempotent rerun')
