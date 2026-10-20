"""Admin HTTP -> typed SQL RPC -> >20k synthetic rows, loopback DB only."""
import argparse
from datetime import timezone
import json
from pathlib import Path
import re
import sys
import uuid
import psycopg
from psycopg.rows import dict_row, tuple_row
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from account_integrity_v33210 import install_account_integrity
from backend import postgres_rpc

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.database_report.read_text())
    assert source['host'] == '127.0.0.1' and source['syntheticOnly'] is True
    assert re.fullmatch(r'proplet_test_[a-z0-9_]{1,40}', source['database'])
    with psycopg.connect(host='127.0.0.1', port=55432, user='proplet_test_admin',
                         password=args.password_file.read_text().strip(),
                         dbname=source['database'], autocommit=True) as c:
        c.execute('begin')
        try:
            ids = [str(uuid.uuid4()), str(uuid.uuid4())]
            for i, pid in enumerate(ids):
                c.execute("insert into players(id,name,family_code,token_hash,created_at) values(%s,'Synthetic duplicate',%s,%s,'2026-10-19T10:00:00Z'::timestamptz+%s*interval '1 second')",
                          (pid,'SOLO_'+pid[:8].upper(),pid,i))
            c.execute("""insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,clean_solve)
                         select gen_random_uuid(),%s,'synthetic-'||i,'free:synthetic-'||i,'free','easy',10000,10,15,true from generate_series(1,20001) i""",(ids[0],))
            c.execute('set local role service_role')
            rpc_calls = []
            def rpc(name, body):
                rpc_calls.append((name,body))
                c.row_factory = tuple_row
                signature = postgres_rpc._signature(c,name,body)
                assert signature is not None
                return postgres_rpc.execute_on_connection(c,name,body,signature)
            def bounded(table, **kwargs):
                assert table == 'players' and kwargs['max_rows'] == 5000
                c.row_factory = dict_row
                return json.loads(json.dumps(c.execute('select * from public.players where id=any(%s::uuid[])',(ids,)).fetchall(),default=str))
            app = FastAPI()
            install_account_integrity(app,tz=timezone.utc,db_select=lambda table,**kw: [{'active':True}] if table=='admin_accounts' else [],
                db_select_bounded=bounded,db_rpc=rpc,auth_player=lambda _: {'id':'synthetic-admin'},new_session=lambda _: '',
                verify_password=lambda *_: False,enforce_rate_limit=lambda *a,**kw: None,player_stats=lambda _: {},
                public_family_code=lambda *_:'',league_name_for=lambda _:'')
            response = TestClient(app).get('/api/admin/account-integrity',headers={'Authorization':'Bearer synthetic-local-only'})
            assert response.status_code == 200,response.text
            row = response.json()['rows'][0]
            assert row['canonicalId'] == ids[0] and row['canonicalResults'] == 20001,row
            assert len(rpc_calls)==1 and sorted(rpc_calls[0][1]['p_players'])==sorted(ids)
            assert response.json()['likelyDuplicateRows']==1
        finally:
            c.execute('rollback')
    print('PASS real admin HTTP -> typed invoker RPC -> exact 20001 results; unchanged ranking, rollback, loopback only')

if __name__ == '__main__':
    main()
