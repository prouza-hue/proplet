"""Usage SQL acceptance and exact statistics parity in a disposable local DB."""
import argparse
import json
from pathlib import Path
import re
import sys
import uuid
from unittest.mock import patch
import psycopg
from psycopg.rows import dict_row, tuple_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
from backend import postgres_rpc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.database_report.read_text())
    assert source['host'] == '127.0.0.1' and source['syntheticOnly'] is True
    assert re.fullmatch(r'proplet_test_[a-z0-9_]{1,40}', source['database'])
    options = dict(host='127.0.0.1',port=55432,user='proplet_test_admin',
                   password=args.password_file.read_text().strip(),dbname=source['database'],
                   autocommit=True,row_factory=dict_row)
    with psycopg.connect(**options) as c:
        c.execute('begin')
        try:
            c.execute((ROOT/'supabase/tests/usage_optimization.sql').read_text())
            player = str(uuid.uuid4())
            c.execute("insert into players(id,name,family_code,token_hash) values(%s,'Synthetic usage parity',%s,%s)",
                      (player,'SOLO_'+player[:8].upper(),'synthetic-'+player))
            samples = [('free','easy','g4-e-001',15),('free','easy','g3-e-002',15),
                       ('free','hardcore','g4-x-001',100),('free','mozkomor','g4-z-001',150),
                       ('free','mozkokalypsa','mk100-v2-001',200),('starter','easy','starter-e',10),
                       ('tajenka','medium','synthetic-tajenka',200)]
            for index,(mode,difficulty,puzzle,points) in enumerate(samples):
                c.execute("""insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,clean_solve)
                             values(%s,%s,%s,%s,%s,%s,11000,10,%s,true)""",
                          (str(uuid.uuid4()),player,puzzle,'free:'+puzzle,mode,difficulty,points))
            for days in (1,3,4):
                c.execute("""insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,daily_date,best_elapsed_ms,best_moves,points,clean_solve)
                             values(%s,%s,%s,%s,'daily','easy',(statement_timestamp() at time zone 'Europe/Prague')::date-%s,12000,10,100,true)""",
                          (str(uuid.uuid4()),player,'synthetic-daily-'+str(days),'daily:synthetic-'+str(days),days))
            c.execute("""insert into streak_rescues(id,player_id,missed_date,puzzle_id,status)
                         values(%s,%s,(statement_timestamp() at time zone 'Europe/Prague')::date-2,'synthetic-rescue','passed')""",
                      (str(uuid.uuid4()),player))
            for key,points,word in [('account_creation_v1',500,None),('word_discovery_v1:čáp',10,'ČÁP'),('other',25,None)]:
                c.execute("""insert into account_rewards(id,player_id,reward_key,points,reward_word) values(%s,%s,%s,%s,%s)
                             on conflict(player_id,reward_key) do update set points=excluded.points,reward_word=excluded.reward_word""",
                          (str(uuid.uuid4()),player,key,points,word))
            rows = c.execute('select * from results where player_id=%s',(player,)).fetchall()
            rewards = c.execute('select * from account_rewards where player_id=%s',(player,)).fetchall()
            rescues = c.execute('select * from streak_rescues where player_id=%s',(player,)).fetchall()
            for row in rows:
                if row['daily_date'] is not None: row['daily_date']=row['daily_date'].isoformat()
            for row in rescues: row['missed_date']=row['missed_date'].isoformat()
            c.execute('set local role service_role')
            compact = c.execute('select public.proplet_player_stats_v1(%s) as value',(player,)).fetchone()['value']
            c.execute('reset role')
            with patch.object(server,'SUPABASE_URL',''), patch.object(server,'SUPABASE_SECRET_KEY',''):
                previous = server.player_stats(player,prefetched_results=rows,prefetched_rewards=rewards,prefetched_rescues=rescues)
            actual = server._stats_from_db_summary(compact)
            assert actual == previous, {key:(previous.get(key),actual.get(key)) for key in previous if previous.get(key)!=actual.get(key)}
            # Exercise the same typed SQL transport against real PostgreSQL,
            # including UUID arrays, JSONB, table/scalar/void results and defaults.
            c.row_factory = tuple_row
            c.execute("""create function public.proplet_synthetic_transport(p_id uuid,p_ids uuid[],p_payload jsonb)
                         returns jsonb language sql as $$select jsonb_build_object('id',p_id,'ids',p_ids,'payload',p_payload)$$""")
            c.execute("""create function public.proplet_synthetic_rows() returns table(value int)
                         language sql as $$values(1),(2)$$""")
            c.execute("""create function public.proplet_synthetic_void() returns void
                         language sql as $$select null::void$$""")
            c.execute('set local role service_role')
            def direct(name,body):
                signature = postgres_rpc._signature(c,name,body)
                assert signature is not None, name
                return postgres_rpc.execute_on_connection(c,name,body,signature)
            assert direct('proplet_player_stats_v1',{'p_player':player}) == compact
            ranking = direct('proplet_ranking_context_v1',{'p_player_ids':[player]})
            assert ranking['players'][0]['id'] == player
            echo = direct('proplet_synthetic_transport',{'p_id':player,'p_ids':[player], 'p_payload':{'text':'ČÁP','count':3}})
            assert echo == {'id':player,'ids':[player],'payload':{'text':'ČÁP','count':3}}
            assert direct('proplet_synthetic_rows',{}) == [{'value':1},{'value':2}]
            assert direct('proplet_synthetic_void',{}) is None
            guard = {'p_scope':'synthetic-direct','p_actor_hash':'synthetic','p_window_seconds':60,'p_limit':1}
            assert direct('proplet_request_guard_v1',guard)['allowed'] is True
            assert direct('proplet_request_guard_v1',guard)['allowed'] is False
            c.execute('reset role')
            print('PASS guard quotas, revocation, service-only grants, ranking privacy and all statistics fields')
        finally:
            c.execute('rollback')


if __name__=='__main__':
    main()

