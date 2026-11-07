"""Real PostgreSQL and HTTP acceptance for the alternating entry allocator.

The caller owns a disposable, loopback proplet_test_* database with all migrations.
No external HTTP or production database is used by this helper.
"""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import timezone
import hashlib
import json
from pathlib import Path
import sys
import threading
from unittest.mock import patch
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def verify_entry_allocation(connect):
    import server
    from backend import entry_experiment, measurement
    from account_integrity_v33210 import install_account_integrity

    with connect() as connection:
        assert connection.info.host in ('127.0.0.1', 'localhost', '::1')
        assert connection.info.dbname.startswith('proplet_test_')
    tag = uuid.uuid4().hex
    checks = []

    def rpc_on(connection, name, params):
        statement = sql.SQL('select public.{}({})').format(
            sql.Identifier(name), sql.SQL(',').join(
                sql.SQL('{} => %s').format(sql.Identifier(key)) for key in params))
        return connection.execute(statement, list(params.values())).fetchone()[0]

    def rpc(name, params):
        with connect() as connection, connection.transaction():
            connection.execute('set local role service_role')
            return rpc_on(connection, name, params)

    def parameters(identity, environment='local', flow=None, player=None, enroll=True):
        return dict(p_environment=environment, p_is_test=environment != 'production',
                    p_anonymous_id=server.anonymous_hash(identity), p_player=player,
                    p_flow=flow or str(uuid.uuid4()), p_client_release='allocation-db-test',
                    p_release='allocation-db-test', p_app_version='test', p_enroll=enroll)

    def assign(identity, environment='local', barrier=None):
        with connect() as connection, connection.transaction():
            connection.execute('set local role service_role')
            if barrier:
                barrier.wait(timeout=20)
            return rpc_on(connection, 'proplet_entry_assign_v1', parameters(identity, environment))

    def ordinal(environment):
        with connect() as connection:
            row = connection.execute(
                'select last_ordinal from proplet_experiment_internal.entry_allocation_state '
                'where environment=%s and is_test=%s',
                (environment, environment != 'production')).fetchone()
            return row[0] if row else 0

    # Each worker owns a connection and reaches the barrier before invoking SQL.
    # Scheduling/submission order is deliberately not an assertion about allocation.
    before = ordinal('local')
    identities = [f'{tag}-distinct-{index}' for index in range(12)]
    barrier = threading.Barrier(len(identities))
    with ThreadPoolExecutor(max_workers=len(identities)) as executor:
        results = list(executor.map(lambda identity: assign(identity, barrier=barrier), identities))
    ordered = sorted(results, key=lambda row: row['allocationOrdinal'])
    assert [row['allocationOrdinal'] for row in ordered] == list(range(before + 1, before + 13))
    for row in ordered:
        assert row['variant'] == ('A' if row['allocationOrdinal'] % 2 else 'B'), row
        assert row['allocationPolicy'] == 'alternating_v1', row
        assert row['allocationSwitchedAt'], row
    assert len({row['firstStepsRunId'] for row in ordered}) == 12
    checks.append('12 concurrent distinct identities alternate in committed allocationOrdinal order')

    identity = tag + '-same-identity'
    before = ordinal('local')
    barrier = threading.Barrier(8)
    with ThreadPoolExecutor(max_workers=8) as executor:
        repeated = list(executor.map(lambda _: assign(identity, barrier=barrier), range(8)))
    assert all(row == repeated[0] for row in repeated)
    assert ordinal('local') == before + 1
    # New physical connections and new proposed flow IDs model page reload/reconnect.
    assert assign(identity) == repeated[0]
    assert rpc('proplet_entry_assign_v1', parameters(identity, enroll=False)) == repeated[0]
    with connect() as connection:
        count = connection.execute(
            'select count(*) from public.product_events where anonymous_id=%s '
            "and event_type='entry_experiment_assigned'",
            (server.anonymous_hash(identity),)).fetchone()[0]
        assert count == 1
    checks.append('8 concurrent same-identity retries, reconnect and disabled enrollment preserve one assignment/event')

    before = ordinal('local')
    rollback_identity = tag + '-rollback'
    with connect() as connection, connection.transaction(force_rollback=True):
        connection.execute('set local role service_role')
        rolled = rpc_on(connection, 'proplet_entry_assign_v1', parameters(rollback_identity))
        assert rolled['allocationOrdinal'] == before + 1
    assert ordinal('local') == before
    committed = assign(rollback_identity)
    assert committed['allocationOrdinal'] == rolled['allocationOrdinal']
    assert committed['variant'] == rolled['variant']
    assert committed['firstStepsRunId'] != rolled['firstStepsRunId']
    checks.append('rollback restores allocation counter and leaves no ordinal gap')

    # Execute the exact pre-cutover body, as if a request had started before DDL.
    # Its hash would choose the opposite arm. The new INSERT boundary must win.
    old_source = (ROOT / 'supabase/migrations/20261104120000_new_player_entry.sql').read_text()
    old_function = old_source[old_source.index('create function public.proplet_entry_assign_v1('):]
    old_function = old_function[:old_function.index('$$;') + 3]
    old_function = old_function.replace('public.proplet_entry_assign_v1(',
                                        'public.proplet_entry_before_cutover_test_v1(', 1)
    next_ordinal = ordinal('local') + 1
    expected = 'A' if next_ordinal % 2 else 'B'
    for index in range(1000):
        stale_identity = f'{tag}-stale-{index}'
        anonymous_hash = server.anonymous_hash(stale_identity)
        hash_variant = 'A' if hashlib.sha256(
            ('new-player-entry-v1:' + anonymous_hash).encode()).digest()[0] < 128 else 'B'
        if hash_variant != expected:
            break
    else:
        raise AssertionError('Could not construct opposite hash arm')
    with connect() as connection, connection.transaction(force_rollback=True):
        connection.execute(old_function)
        connection.execute('set local role service_role')
        stale = rpc_on(connection, 'proplet_entry_before_cutover_test_v1', parameters(stale_identity))
        assert stale['variant'] == expected, (stale, hash_variant)
        stored = connection.execute(
            'select a.variant,a.allocation_ordinal,e.context from '
            'proplet_experiment_internal.entry_assignments a '
            'join public.product_events e on e.id=a.event_id where a.anonymous_id=%s',
            (anonymous_hash,)).fetchone()
        assert stored[0] == expected and stored[1] == next_ordinal, stored
        assert stored[2]['entry_variant'] == expected, stored
    assert ordinal('local') == next_ordinal - 1
    checks.append('pre-cutover RPC body receives alternating arm and consistent event from new INSERT boundary')

    # Operate the production namespace only inside this disposable database.
    with connect() as connection:
        control = connection.execute('select enabled,starts_at,ends_at from '
            'proplet_experiment_internal.entry_control where singleton').fetchone()
        connection.execute('update proplet_experiment_internal.entry_control '
            "set enabled=true,starts_at=now()-interval '1 minute',"
            "ends_at=now()-interval '1 minute'+interval '14 days' where singleton")
        connection.commit()
    try:
        first = assign(tag + '-production-1', 'production')
        assign(tag + '-local-between', 'local')
        assign(tag + '-preview-between', 'preview')
        second = assign(tag + '-production-2', 'production')
        assert second['allocationOrdinal'] == first['allocationOrdinal'] + 1
        assert first['variant'] != second['variant']
        checks.append('local and preview QA allocations do not consume production ordinals')
    finally:
        with connect() as connection:
            connection.execute('update proplet_experiment_internal.entry_control '
                               'set enabled=%s,starts_at=%s,ends_at=%s where singleton', control)
            connection.commit()

    def query(statement, values=()):
        with connect() as connection, connection.transaction():
            connection.execute('set local role service_role')
            cursor = connection.execute(statement, values)
            return [row[0] for row in cursor.fetchall()] if cursor.description else []

    def where(filters):
        return sql.SQL(' and ').join(sql.SQL('{}=%s').format(sql.Identifier(key))
                                    for key in filters) or sql.SQL('true')

    def select(table, **filters):
        return query(sql.SQL('select to_jsonb(t) from public.{} t where {}').format(
            sql.Identifier(table), where(filters)), list(filters.values()))

    def bounded(table, *, filters, **_kwargs):
        clauses, values = [], []
        for key, expression in filters.items():
            operator, value = expression.split('.', 1)
            assert operator in ('eq', 'ilike')
            clauses.append(sql.SQL('{} {} %s').format(sql.Identifier(key),
                sql.SQL('=' if operator == 'eq' else 'ilike')))
            values.append(value)
        return query(sql.SQL('select to_jsonb(t) from public.{} t where {}').format(
            sql.Identifier(table), sql.SQL(' and ').join(clauses)), values)

    def insert(table, values):
        return query(sql.SQL('insert into public.{} ({}) values ({}) returning to_jsonb({}.*)').format(
            sql.Identifier(table), sql.SQL(',').join(map(sql.Identifier, values)),
            sql.SQL(',').join(sql.Placeholder() for _ in values), sql.Identifier(table)),
            [Jsonb(value) if isinstance(value, dict) else value for value in values.values()])

    def update(table, filters, values):
        return query(sql.SQL('update public.{} set {} where {}').format(sql.Identifier(table),
            sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(key)) for key in values),
            where(filters)), list(values.values()) + list(filters.values()))

    app = FastAPI()

    @app.middleware('http')
    async def provenance(request, call_next):
        token = measurement.context.set(measurement.request_context(request, 'local'))
        try:
            return await call_next(request)
        finally:
            measurement.context.reset(token)

    install_account_integrity(app, tz=timezone.utc, db_select=select,
        db_select_bounded=bounded, db_rpc=rpc, auth_player=server.auth_player,
        new_session=server.new_session, verify_password=server.verify_password,
        enforce_rate_limit=lambda *args, **kwargs: None, player_stats=lambda *_args: {},
        public_family_code=server.public_family_code, league_name_for=lambda *_args: None,
        norm_family=server.norm_family)
    app.add_api_route('/api/anonymous/claim', server.claim_anonymous, methods=['POST'])
    entry_experiment.install(app, telemetry_actor=server.telemetry_actor, db_rpc=rpc,
        enforce_rate_limit=lambda *args, **kwargs: None, environment='local', app_version='test')
    with ExitStack() as stack:
        for name, value in dict(db_rpc=rpc, db_select=select, db_select_bounded=bounded,
                db_insert=insert, db_update=update, player_stats=lambda *_args: {},
                play_session_config=lambda: {'enabled': False}, monthly_qa_enabled=lambda: False,
                enforce_rate_limit=lambda *args, **kwargs: None).items():
            stack.enter_context(patch.object(server, name, value))
        stack.enter_context(patch.object(server.DB_HTTP_CLIENT, 'request',
                                        side_effect=AssertionError('external HTTP forbidden')))
        stack.enter_context(patch.dict('os.environ', {'PROPLET_ENTRY_EXPERIMENT_ENABLED': '1'}))
        player_id = str(uuid.uuid4())
        player_name = 'Allocation ' + tag[:12]
        insert('players', dict(id=player_id, name=player_name, family_code='SOLO_' + tag[:12].upper(),
                              token_hash=hashlib.sha256(tag.encode()).hexdigest(),
                              password_hash=server.hash_password('synthetic-password')))
        headers = {'X-Proplet-Test': '1', 'X-Proplet-Anon-ID': tag + '-http'}
        with TestClient(app) as client:
            response = client.post('/api/entry-experiment/assignment', headers=headers,
                                   json={'first_steps_run_id': str(uuid.uuid4())})
            assert response.status_code == 200, response.text
            original = response.json()
            assert original['variant'] in ('A', 'B')
            response = client.post('/api/login-integrity', json={'name': player_name, 'password': 'synthetic-password'})
            assert response.status_code == 200, response.text
            account_headers = {'Authorization': 'Bearer ' + response.json()['token'], 'X-Proplet-Test': '1'}
            payload = {'first_steps_run_id': original['firstStepsRunId']}
            # Login alone must not acquire an anonymous assignment.
            assert client.post('/api/entry-experiment/assignment', headers=account_headers,
                               json=payload).json() == {'variant': None}
            claimed = client.post('/api/anonymous/claim', headers=account_headers,
                                  json={'anonymous_id': headers['X-Proplet-Anon-ID']})
            assert claimed.status_code == 200, claimed.text
            assert claimed.json()['claimed']['productEvents'] == 1
            assert client.post('/api/entry-experiment/assignment', headers=account_headers,
                               json=payload).json() == original
            assert client.post('/api/anonymous/claim', headers=account_headers,
                json={'anonymous_id': headers['X-Proplet-Anon-ID']}).json()['claimed']['productEvents'] == 0
            assert client.post('/api/entry-experiment/assignment', headers=account_headers,
                json={'first_steps_run_id': str(uuid.uuid4())}).json() == {'variant': None}
        # A new browser/session logs in again, with actual password and session RPCs.
        with TestClient(app) as client:
            response = client.post('/api/login-integrity', json={'name': player_name, 'password': 'synthetic-password'})
            assert response.status_code == 200, response.text
            account_headers['Authorization'] = 'Bearer ' + response.json()['token']
            assert client.post('/api/entry-experiment/assignment', headers=account_headers,
                               json=payload).json() == original
        checks.append('real HTTP login, password/session auth, anonymous claim and fresh-session lookup preserve assignment')
    return checks

