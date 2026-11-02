"""Real SQL/atomic-result/concurrency acceptance in a disposable loopback database."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
import threading
import uuid
import psycopg
from psycopg.types.json import Jsonb
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.contracts import ResultCreate
from backend.results import result_identity,build_command

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report',type=Path,required=True)
    parser.add_argument('--password-file',type=Path,required=True)
    parser.add_argument('--port',type=int,default=55432)
    parser.add_argument('--user',default='proplet_test_admin')
    args=parser.parse_args()
    report=json.loads(args.database_report.read_text(encoding='utf-8'))
    if report.get('host')!='127.0.0.1' or not re.fullmatch(r'proplet_test_[a-z0-9_]{1,50}',report.get('database','')):
        parser.error('Only a known disposable loopback database is allowed')
    options=dict(host='127.0.0.1',port=args.port,user=args.user,dbname=report['database'],password=args.password_file.read_text().strip())
    original=datetime(2026,10,31,22,59,59,tzinfo=timezone.utc)
    with psycopg.connect(**options,autocommit=True) as c:
        c.execute((ROOT/'supabase/tests/attempt_completion_provenance.sql').read_text(encoding='utf-8'))
    # Actual current atomic RPC, not a test replacement; transaction rolls back.
    with psycopg.connect(**options) as c:
        player=str(uuid.uuid4()); attempt=str(uuid.uuid4()); offline=str(uuid.uuid4())
        c.execute("insert into players(id,name,family_code,token_hash)values(%s,'Atomic completion QA','SOLO_ATOMIC_QA',%s)",(player,player))
        c.execute("insert into puzzle_attempts(id,anonymous_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at)values(%s,%s,'qa-time-owned','free:qa-time-owned','free','easy',%s,%s)",(attempt,'b'*64,original-timedelta(minutes=1),original))
        received=c.execute('select completion_received_at from puzzle_attempts where id=%s',(attempt,)).fetchone()[0]
        c.execute('update puzzle_attempts set player_id=%s where id=%s',(player,attempt))
        for aid,puzzle,level in ((attempt,'qa-time-owned',218),(offline,'qa-time-offline',219)):
            payload=ResultCreate(puzzle_id=puzzle,challenge_key='free:'+puzzle,mode='free',difficulty='easy',elapsed_ms=42000,moves=12,attempt_id=aid,completed_at=original.isoformat(),clean_solve=True)
            command=build_command(result_identity(player,payload),payload,completed_at=original.isoformat(),points=15,content_generation=4,free_level=level,legacy_reward_slot=None,team_code_at_completion=None)
            params=(player,command['idempotencyKey'],command['requestDigest'],command['commandDigest'],Jsonb(command))
            receipt=c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',params).fetchone()[0]
            assert receipt['firstCompletion'] is True
            assert c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',params).fetchone()[0]==receipt
            row=c.execute('select completed_at,completion_received_at from puzzle_attempts where id=%s',(aid,)).fetchone()
            assert row[0]==original and row[1] is not None
            if aid==attempt: assert row[1]==received
            assert c.execute('select points,completed_at from results where player_id=%s and challenge_key=%s',(player,'free:'+puzzle)).fetchone()==(15,original)
        assert c.execute('select count(*) from results where player_id=%s',(player,)).fetchone()[0]==2
        c.rollback()
    # Two separate connections race on one uncompleted row; first commit wins.
    player=str(uuid.uuid4()); attempt=str(uuid.uuid4())
    with psycopg.connect(**options) as c:
        c.execute("insert into players(id,name,family_code,token_hash)values(%s,'Concurrent finish QA','SOLO_CONCURRENT_QA',%s)",(player,player))
        c.execute("insert into puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty)values(%s,%s,'qa-race','free:qa-race','free','easy')",(attempt,player))
    barrier=threading.Barrier(2)
    def finish(offset):
        with psycopg.connect(**options) as c:
            barrier.wait(timeout=15)
            return c.execute('update puzzle_attempts set completed_at=%s where id=%s returning completed_at,completion_received_at',(original+timedelta(days=offset),attempt)).fetchone()
    try:
        with ThreadPoolExecutor(max_workers=2) as pool: rows=list(pool.map(finish,(0,1)))
        assert rows[0]==rows[1] and rows[0][1] is not None,'concurrent completion changed immutable boundary'
    finally:
        with psycopg.connect(**options) as c: c.execute('delete from players where id=%s',(player,))
    print('PASS completion SQL: immutable first finish/receipt, historical NULL, 80-row replay, guest claim, actual atomic RPC/offline insertion, unchanged rewards/receipts and two-connection race')

if __name__=='__main__':main()
