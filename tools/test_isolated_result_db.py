"""Real PostgreSQL acceptance, restricted to loopback and a newly created DB.

Install psycopg[binary] in the test environment. The server must already run
locally. This never accepts a remote DSN, imports player data, or drops a DB.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import sys
import threading
from unittest.mock import patch

import psycopg
from psycopg.rows import dict_row
from psycopg import sql
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.contracts import ResultCreate
from backend.results import result_identity, build_command


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--password-file', type=Path, required=True)
    parser.add_argument('--port', type=int, default=55432)
    parser.add_argument('--user', default='proplet_test_admin')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    options = dict(host='127.0.0.1', port=args.port, user=args.user,
                   password=args.password_file.read_text().strip(), autocommit=True)
    name = 'proplet_test_' + secrets.token_hex(5)
    report = {'startedAt': datetime.now(timezone.utc).isoformat(), 'database': name,
              'host': '127.0.0.1', 'syntheticOnly': True, 'checks': [], 'schemaFiles': []}
    with psycopg.connect(dbname='postgres', **options) as c:
        for role in ('anon', 'authenticated', 'service_role'):
            if not c.execute('select 1 from pg_roles where rolname=%s', (role,)).fetchone():
                c.execute(sql.SQL('create role {} {}').format(sql.Identifier(role),
                    sql.SQL('bypassrls' if role == 'service_role' else '')))
        c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
    options['dbname'] = name

    def connect():
        return psycopg.connect(**options)

    with connect() as c:
        report['postgres'] = c.execute('select version()').fetchone()[0]
        # Hosted public-schema defaults verified read-only on 2026-09-15.
        # Without these, a plain PostgreSQL cluster would incorrectly deny
        # service_role access to account_rewards before exercising its RPC.
        for objects in ('tables', 'sequences', 'functions'):
            c.execute('alter default privileges in schema public grant all on '+objects+
                      ' to anon, authenticated, service_role')
        manifest = json.loads((ROOT/'supabase/migrations/manifest.json').read_text())
        files = [ROOT/f['path'] for f in sorted(manifest['files'], key=lambda f:f['order'])
                 if f['type'] != 'verify']
        files += sorted((ROOT/'supabase/migrations').glob('*.sql'))
        for path in files:
            c.execute(path.read_text(encoding='utf8'))
            report['schemaFiles'].append({'path': path.relative_to(ROOT).as_posix(),
                                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        c.execute((ROOT/'supabase/tests/s08b_atomic_result_acceptance.sql').read_text(encoding='utf8'))
        report['checks'].append('existing SQL acceptance: rollback, retry, conflict, grants')
        players = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
        for index, player in enumerate(players):
            c.execute('insert into public.players(id,name,family_code,token_hash) values(%s,%s,%s,%s)',
                      (player, 'Synthetic '+str(index), 'SOLO_TEST', 'synthetic-token-'+str(index)))

    def command(attempt, elapsed=42000, completed='2026-09-15T10:00:00+00:00', player=players[0]):
        payload = ResultCreate(puzzle_id='phase2-synthetic-board', challenge_key='free:phase2-synthetic-board',
            mode='free', difficulty='easy', elapsed_ms=elapsed, moves=12, attempt_id=attempt,
            completed_at=completed, clean_solve=True)
        return build_command(result_identity(player, payload), payload, completed_at=completed,
            points=15, content_generation=4, free_level=218, legacy_reward_slot=None,
            team_code_at_completion=None)

    def submit(command, barrier=None):
        with connect() as c:
            c.execute('set role service_role')
            if barrier: barrier.wait(timeout=15)
            return c.execute('select public.proplet_submit_result_v1(%s,%s,%s,%s,%s)', (
                command['playerId'], command['idempotencyKey'], command['requestDigest'],
                command['commandDigest'], Jsonb(command))).fetchone()[0]

    # Ten separate real connections collide on the exact same result command.
    first = command('phase2-concurrent-same')
    barrier = threading.Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        receipts = list(pool.map(lambda _: submit(first, barrier), range(10)))
    assert all(receipt == receipts[0] for receipt in receipts)
    with connect() as c:
        for table in ('result_commands', 'puzzle_runs', 'results'):
            assert c.execute(sql.SQL('select count(*) from public.{} where player_id=%s').format(
                sql.Identifier(table)), (players[0],)).fetchone()[0] == 1
        assert c.execute('select sum(points) from public.results where player_id=%s', (players[0],)).fetchone()[0] == 15
    report['checks'].append('10 simultaneous identical commands: 1 run, 1 receipt, 15 XP')

    # Simulate a lost response after commit: reconnect and replay the same bytes.
    assert submit(first) == receipts[0]
    report['checks'].append('lost response/reconnect: same durable receipt, no extra XP')
    try:
        submit(command('phase2-concurrent-same', elapsed=43000))
        raise AssertionError('conflicting payload accepted')
    except psycopg.errors.RaiseException as error:
        assert 'IDEMPOTENCY_CONFLICT' in str(error)
    report['checks'].append('same attempt with changed payload rejected')

    barrier = threading.Barrier(10)
    with ThreadPoolExecutor(max_workers=10) as pool:
        receipts2 = list(pool.map(lambda i: submit(command('phase2-another-tab-'+str(i), elapsed=30000), barrier), range(10)))
    assert all(r['awardedPoints'] == 0 for r in receipts2)
    with connect() as c:
        row = c.execute('select points,best_elapsed_ms from public.results where player_id=%s', (players[0],)).fetchone()
        assert row == (15,42000), row  # Existing rule: first finish is the official result.
    report['checks'].append('10 different attempts/same level: no duplicate XP, official first time retained')

    submit(command('phase2-earlier-offline', elapsed=55000, completed='2026-09-15T09:00:00+00:00'))
    with connect() as c:
        row = c.execute('select points,best_elapsed_ms from public.results where player_id=%s', (players[0],)).fetchone()
        assert row == (15,55000), row
        assert c.execute('select count(*) from public.results where player_id=%s',(players[1],)).fetchone()[0] == 0
        for role in ('anon','authenticated'):
            c.execute(sql.SQL('set role {}').format(sql.Identifier(role)))
            try:
                c.execute('select * from public.results')
                raise AssertionError(role+' read player results directly')
            except psycopg.errors.InsufficientPrivilege:
                pass
            finally:
                c.execute('reset role')
    report['checks'].append('earlier offline finish replaces official time, preserves XP and other player')
    report['checks'].append('anon/authenticated denied direct results access (not admin-only test)')

    def bonus(word, player=players[0]):
        with connect() as c:
            c.execute('set role service_role')
            return c.execute('select * from public.proplet_claim_word_discovery(%s,%s,%s)',
                             (player, 'phase2-synthetic-board', word)).fetchone()
    with ThreadPoolExecutor(max_workers=10) as pool:
        awards = list(pool.map(lambda _: bonus('syntheticword'), range(10)))
    assert sum(row[1] for row in awards) == 1
    with ThreadPoolExecutor(max_workers=10) as pool:
        awards = list(pool.map(lambda i: bonus('syntheticword'+str(i)), range(60)))
    assert sum(row[1] for row in awards) == 49
    assert bonus('anotherword')[2] == 'daily_limit'
    assert bonus('anotherword', players[1])[1] == 1
    with connect() as c:
        assert c.execute('select sum(points) from account_rewards where player_id=%s', (players[0],)).fetchone()[0] == 50
        for role in ('anon', 'authenticated'):
            c.execute(sql.SQL('set role {}').format(sql.Identifier(role)))
            assert c.execute('select count(*) from account_rewards').fetchone()[0] == 0
            try:
                c.execute('select * from public.proplet_claim_word_discovery(%s,%s,%s)',
                          (players[0], 'phase2-synthetic-board', 'forgedword'))
                raise AssertionError(role+' invoked the backend-only reward RPC')
            except psycopg.errors.InsufficientPrivilege:
                pass
            finally:
                c.execute('reset role')
    report['checks'].append('concurrent bonus claims: exact deduplication, 50 XP daily cap, no cross-player cap')
    report['checks'].append('rewards RLS hides synthetic rows from anon/authenticated; reward RPC denied')

    # Real HTTP result endpoint and real custom-token authentication. Only the
    # PostgREST transport is replaced with SQL; all data remains synthetic.
    from fastapi.testclient import TestClient
    import server
    tokens = ['phase2-player-a-token', 'phase2-player-b-token']
    with connect() as c:
        for player, token in zip(players, tokens):
            c.execute('update players set token_hash=%s where id=%s',
                      (hashlib.sha256(token.encode()).hexdigest(), player))

    def select(table, **filters):
        with psycopg.connect(**options, row_factory=dict_row) as c:
            c.execute('set role service_role')
            where = sql.SQL(' and ').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in filters)
            rows = c.execute(sql.SQL('select * from public.{} where {}').format(
                sql.Identifier(table), where), tuple(filters.values())).fetchall()
            # PostgREST represents UUIDs/timestamps as JSON strings.
            return json.loads(json.dumps(rows, default=str))

    def rpc(function, body):
        assert function == 'proplet_submit_result_v1'
        return submit(body['p_command'])

    board = server.load_puzzles()['free']['easy'][0]
    body = dict(puzzle_id=board['id'], challenge_key='free:'+board['id'], mode='free',
                difficulty='easy', elapsed_ms=42000, moves=len(board['answers']),
                attempt_id='phase2-real-http-shared-attempt', completed_at=datetime.now(timezone.utc).isoformat())
    with ExitStack() as stack:
        for attribute, value in {
            'ATOMIC_RESULT_V1_ENABLED': True, 'VERCEL_ENV': 'development',
            'enforce_rate_limit': lambda *a, **kw: None,
            'db_select': select, 'db_atomic_result_rpc': rpc,
            'rankings_v2_schema_ready': lambda: False,
            'player_stats': lambda player_id: {'playerId': player_id},
        }.items():
            stack.enter_context(patch.object(server, attribute, value))
        stack.enter_context(patch.object(server.backend_db.DEFAULT_HTTP_CLIENT, 'request',
                                       side_effect=AssertionError('Unexpected external database transport')))
        client = TestClient(server.app)
        assert client.post('/api/result', json=body).status_code == 401
        assert client.post('/api/result', json=body, headers={'Authorization':'Bearer invalid-token'}).status_code == 401
        response = client.post('/api/result', json=body, headers={'Authorization':'Bearer '+tokens[0]})
        assert response.status_code == 200, response.text
        assert response.json()['awardedPoints'] == 15
        # Result receipts are player-scoped. An ID collision must never change
        # A's attempt or replay A's receipt to B. Current offline compatibility
        # records B's own result while leaving the collided telemetry untouched.
        response_b = client.post('/api/result', json=body, headers={'Authorization':'Bearer '+tokens[1]})
        assert response_b.status_code == 200, response_b.text
        assert response_b.json()['stats']['playerId'] == players[1]
    with connect() as c:
        assert c.execute('select player_id::text from puzzle_attempts where id=%s', (body['attempt_id'],)).fetchone()[0] == players[0]
        assert c.execute('select count(*) from results where puzzle_id=%s', (board['id'],)).fetchone()[0] == 2
    report['checks'].append('HTTP/custom sessions: missing/invalid token rejected; ID collision preserves A attempt and separate B result')
    report['limitations'] = ['Local schema reconstructed from repository, not a production dump.',
        'Exercises real PostgreSQL/RPC and Python command adapter; does not emulate GoTrue or PostgREST.',
        'Player isolation tested through HTTP/custom token auth with a local SQL transport adapter.',
        'Result acceptance is not proof of human play; uncorroborated offline submissions remain accepted.']
    report['finishedAt'] = datetime.now(timezone.utc).isoformat()
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'database': name, 'passed': report['checks']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
