"""Concurrent catch-up acceptance against a migrated disposable loopback database."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
import hashlib
from pathlib import Path
import sys
import threading
from unittest.mock import patch
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg import sql

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def verify_entry_catchup(connect):
    import server
    from backend import entry_experiment, measurement

    with connect() as connection:
        assert connection.info.host in ('127.0.0.1', 'localhost', '::1')
        assert connection.info.dbname.startswith('proplet_test_')
    tag = uuid.uuid4().hex
    checks = []

    def rpc_on(connection, name, parameters, schema='public'):
        statement = sql.SQL('select {}.{}({})').format(sql.Identifier(schema),
            sql.Identifier(name), sql.SQL(',').join(
                sql.SQL('{} => %s').format(sql.Identifier(key)) for key in parameters))
        return connection.execute(statement, list(parameters.values())).fetchone()[0]

    def rpc(name, parameters):
        with connect() as connection, connection.transaction():
            connection.execute('set local role service_role')
            return rpc_on(connection, name, parameters)

    def assignment_parameters(identity, environment='production', flow=None):
        return dict(p_environment=environment, p_is_test=environment != 'production',
                    p_anonymous_id=server.anonymous_hash(identity), p_player=None,
                    p_flow=flow or str(uuid.uuid4()), p_enroll=True,
                    p_client_release='catchup-db-test', p_release='catchup-db-test', p_app_version='test')

    def assign(identity, environment='production', barrier=None):
        with connect() as connection, connection.transaction():
            connection.execute('set local role service_role')
            if barrier:
                barrier.wait(timeout=20)
            return rpc_on(connection, 'proplet_entry_assign_v1', assignment_parameters(identity, environment))

    def activate(environment='production', barrier=None):
        with connect() as connection, connection.transaction():
            if barrier:
                barrier.wait(timeout=20)
            return rpc_on(connection, 'activate_entry_catchup_v1',
                dict(p_environment=environment, p_is_test=environment != 'production'),
                'proplet_experiment_internal')

    def state(environment='production'):
        with connect() as connection:
            return connection.execute(
                'select to_jsonb(s) from proplet_experiment_internal.entry_catchup_state s '
                'where environment=%s and is_test=%s', (environment, environment != 'production')).fetchone()[0]

    def alternating_ordinal(environment='production'):
        with connect() as connection:
            return connection.execute(
                'select last_ordinal from proplet_experiment_internal.entry_allocation_state '
                'where environment=%s and is_test=%s', (environment, environment != 'production')).fetchone()[0]

    def counts(environment='production'):
        with connect() as connection:
            rows = connection.execute(
                'select variant,count(*) from proplet_experiment_internal.entry_assignments '
                'where environment=%s and is_test=%s group by variant',
                (environment, environment != 'production')).fetchall()
            return dict(rows)

    # The CI caller gives us a fresh DB. Refuse to overwrite a previous activation.
    with connect() as connection:
        assert connection.execute('select count(*) from '
            'proplet_experiment_internal.entry_catchup_state').fetchone()[0] == 0
        old_control = connection.execute('select enabled,starts_at,ends_at from '
            'proplet_experiment_internal.entry_control where singleton').fetchone()
        connection.execute('update proplet_experiment_internal.entry_control '
            "set enabled=true,starts_at=now()-interval '1 day',"
            "ends_at=now()-interval '1 day'+interval '14 days' where singleton")
        connection.commit()
    try:
        # Synthetic pre-phase rows reproduce an imbalance without consuming the
        # existing alternating counter. Trigger bypass is owner-only fixture setup.
        before_counts = counts()
        desired_difference = 7
        difference = before_counts.get('A', 0) - before_counts.get('B', 0)
        add_variant = 'A' if difference <= desired_difference else 'B'
        with connect() as connection, connection.transaction():
            connection.execute('alter table proplet_experiment_internal.entry_assignments '
                               'disable trigger proplet_entry_allocate_v1')
            for index in range(abs(desired_difference - difference)):
                connection.execute('insert into proplet_experiment_internal.entry_assignments '
                    '(environment,is_test,anonymous_id,first_steps_run_id,variant,allocation_policy) '
                    "values('production',false,%s,%s,%s,'hash50_v1')",
                    (server.anonymous_hash(f'{tag}-legacy-{index}'), str(uuid.uuid4()), add_variant))
            connection.execute('alter table proplet_experiment_internal.entry_assignments '
                               'enable trigger proplet_entry_allocate_v1')
        original_counts = counts()
        assert original_counts['A'] - original_counts.get('B', 0) == desired_difference
        saved_ordinal = alternating_ordinal()
        barrier = threading.Barrier(8)
        with ThreadPoolExecutor(max_workers=8) as executor:
            activations = list(executor.map(lambda _: activate(barrier=barrier), range(8)))
        activation = activations[0]
        assert all(row == activation for row in activations), activations
        assert activation['snapshot_a'] == original_counts['A']
        assert activation['snapshot_b'] == original_counts.get('B', 0)
        assert activation['quota'] == 7 and activation['allocated'] == 0
        assert activation['target_variant'] == 'B'
        checks.append('8 genuinely concurrent activations store one immutable snapshot and fixed quota')

        # A role used by HTTP requests must never authorize a new correction.
        with connect() as connection, connection.transaction(force_rollback=True):
            connection.execute('set local role service_role')
            try:
                rpc_on(connection, 'activate_entry_catchup_v1',
                    dict(p_environment='production', p_is_test=False), 'proplet_experiment_internal')
            except Exception as error:
                assert getattr(error, 'sqlstate', None) == '42501', error
            else:
                raise AssertionError('service_role activated operator-owned catchup')

        # Neither QA namespace may move the production correction or saved counter.
        production_before_qa = state()
        assign(tag + '-local-qa', 'local')
        assign(tag + '-preview-qa', 'preview')
        assert state() == production_before_qa
        assert alternating_ordinal() == saved_ordinal
        checks.append('local/preview QA allocations cannot consume production catchup quota')

        # Race a namespace activation against a real allocation, rather than
        # assuming the worker submitted first acquires the database lock first.
        qa_before = counts('local')
        qa_saved_ordinal = alternating_ordinal('local')
        race = threading.Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as executor:
            activation_future = executor.submit(activate, 'local', race)
            allocation_future = executor.submit(assign, tag + '-activation-race', 'local', race)
            qa_activation, qa_entry = activation_future.result(), allocation_future.result()
        observed = {'A': qa_before.get('A', 0), 'B': qa_before.get('B', 0)}
        if qa_entry['allocationPolicy'] == 'alternating_v1':
            # If correction is nonzero and no catchup row was used, enrollment
            # committed first and must belong to the activation snapshot.
            observed[qa_entry['variant']] += 1
            snapshot = (qa_activation['snapshot_a'], qa_activation['snapshot_b'])
            if qa_activation['quota'] == 0:
                assert snapshot in [(observed['A'], observed['B']),
                                    (qa_before.get('A', 0), qa_before.get('B', 0))], snapshot
            else:
                assert snapshot == (observed['A'], observed['B']), snapshot
            assert qa_entry['allocationOrdinal'] == qa_saved_ordinal + 1
        else:
            assert qa_entry['allocationPolicy'] == 'catchup_v1'
            assert qa_entry['allocationOrdinal'] == 1
            assert qa_activation['snapshot_a'] == observed['A']
            assert qa_activation['snapshot_b'] == observed['B']
            assert qa_entry['variant'] == qa_activation['target_variant']
            assert alternating_ordinal('local') == qa_saved_ordinal
        assert qa_activation['quota'] == abs(qa_activation['snapshot_a'] - qa_activation['snapshot_b'])
        assert state() == production_before_qa
        checks.append('activation racing enrollment uses one consistent namespace snapshot without deadlock')

        rollback_identity = tag + '-rolled-back'
        with connect() as connection, connection.transaction(force_rollback=True):
            connection.execute('set local role service_role')
            rolled = rpc_on(connection, 'proplet_entry_assign_v1', assignment_parameters(rollback_identity))
            assert rolled['allocationPolicy'] == 'catchup_v1' and rolled['allocationOrdinal'] == 1
        assert state()['allocated'] == 0 and alternating_ordinal() == saved_ordinal
        with connect() as connection:
            assert connection.execute('select count(*) from public.product_events '
                "where anonymous_id=%s and event_type='entry_experiment_assigned'",
                (server.anonymous_hash(rollback_identity),)).fetchone()[0] == 0
        checks.append('rolled-back assignment and receipt restore correction quota without a gap')

        # Pin one correction assignment before the concurrent burst, then make
        # eight retries collide with twelve genuinely new identities.
        stable_identity = tag + '-repeated'
        stable = assign(stable_identity)
        assert stable['allocationPolicy'] == 'catchup_v1' and stable['variant'] == 'B'
        identities = [tag + '-new-' + str(index) for index in range(12)] + [stable_identity] * 8
        barrier = threading.Barrier(len(identities))
        with ThreadPoolExecutor(max_workers=len(identities)) as executor:
            results = list(executor.map(lambda identity: assign(identity, barrier=barrier), identities))
        assert all(row == stable for row in results[12:]), results[12:]
        all_new = [stable] + results[:12]
        correction = [row for row in all_new if row['allocationPolicy'] == 'catchup_v1']
        resumed = [row for row in all_new if row['allocationPolicy'] == 'alternating_v1']
        assert len(correction) == 7 and all(row['variant'] == 'B' for row in correction)
        assert sorted(row['allocationOrdinal'] for row in correction) == list(range(1, 8))
        assert len(resumed) == 6
        assert sorted(row['allocationOrdinal'] for row in resumed) == list(range(saved_ordinal + 1, saved_ordinal + 7))
        assert all(row['variant'] == ('A' if row['allocationOrdinal'] % 2 else 'B') for row in resumed)
        assert state()['allocated'] == state()['quota'] == 7
        assert alternating_ordinal() == saved_ordinal + 6
        final_counts = counts()
        assert final_counts['A'] == final_counts['B'], final_counts
        with connect() as connection:
            rows = connection.execute('select a.variant,a.allocation_policy,a.allocation_ordinal,e.context '
                'from proplet_experiment_internal.entry_assignments a join public.product_events e on e.id=a.event_id '
                'where a.first_steps_run_id=any(%s::uuid[])',
                ([row['firstStepsRunId'] for row in all_new],)).fetchall()
            assert len(rows) == 13
            for variant, policy, ordinal, context in rows:
                assert context['entry_variant'] == variant
                assert context['entry_allocation_policy'] == policy
                assert context['entry_allocation_ordinal'] == ordinal
        assert activate()['quota'] == 7 and state()['allocated'] == 7
        assert assign(stable_identity) == stable
        checks.append('20 concurrent new/retry requests exhaust exactly 7 corrections and resume saved alternating ordinal')

        # Exercise the actual claim handler and actual token lookup RPC. Only the
        # local SQL adapter replaces production transport, not claim/auth behavior.
        def query(statement, parameters=()):
            with connect() as connection, connection.transaction():
                connection.execute('set local role service_role')
                cursor = connection.execute(statement, parameters)
                return [row[0] for row in cursor.fetchall()] if cursor.description else []

        def where(filters):
            return sql.SQL(' and ').join(sql.SQL('{}=%s').format(sql.Identifier(key)) for key in filters)

        def select(table, **filters):
            return query(sql.SQL('select to_jsonb(t) from public.{} t where {}').format(
                sql.Identifier(table), where(filters)), list(filters.values()))

        def update(table, filters, values):
            return query(sql.SQL('update public.{} set {} where {}').format(sql.Identifier(table),
                sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(key)) for key in values),
                where(filters)), list(values.values()) + list(filters.values()))

        token = 'synthetic-catchup-' + tag
        player = str(uuid.uuid4())
        with connect() as connection:
            connection.execute('insert into public.players(id,name,family_code,token_hash) values(%s,%s,%s,%s)',
                (player, 'Catchup ' + tag[:8], 'SOLO_' + tag[:12].upper(), hashlib.sha256(token.encode()).hexdigest()))
            connection.commit()
        app = FastAPI()

        @app.middleware('http')
        async def provenance(request, call_next):
            context_token = measurement.context.set(measurement.request_context(request, 'production'))
            try:
                return await call_next(request)
            finally:
                measurement.context.reset(context_token)

        app.add_api_route('/api/anonymous/claim', server.claim_anonymous, methods=['POST'])
        entry_experiment.install(app, telemetry_actor=server.telemetry_actor, db_rpc=rpc,
            enforce_rate_limit=lambda *args, **kwargs: None, environment='production', app_version='test')
        with ExitStack() as stack:
            for name, value in dict(db_rpc=rpc, db_select=select, db_update=update,
                    play_session_config=lambda: {'enabled': False}, monthly_qa_enabled=lambda: False,
                    enforce_rate_limit=lambda *args, **kwargs: None).items():
                stack.enter_context(patch.object(server, name, value))
            stack.enter_context(patch.object(server.DB_HTTP_CLIENT, 'request',
                                            side_effect=AssertionError('external HTTP forbidden')))
            stack.enter_context(patch.dict('os.environ', {'PROPLET_ENTRY_EXPERIMENT_ENABLED': '1'}))
            with TestClient(app) as client:
                headers = {'Authorization': 'Bearer ' + token}
                payload = {'first_steps_run_id': stable['firstStepsRunId']}
                assert client.post('/api/entry-experiment/assignment', headers=headers,
                                   json=payload).json() == {'variant': None}
                claimed = client.post('/api/anonymous/claim', headers=headers,
                                      json={'anonymous_id': stable_identity})
                assert claimed.status_code == 200, claimed.text
                assert claimed.json()['claimed']['productEvents'] == 1
                response = client.post('/api/entry-experiment/assignment', headers=headers, json=payload)
                assert response.status_code == 200, response.text
                assert response.json() == stable
                assert client.post('/api/entry-experiment/assignment', headers=headers,
                    json={'first_steps_run_id': str(uuid.uuid4())}).json() == {'variant': None}
            with TestClient(app) as client:
                assert client.post('/api/entry-experiment/assignment', headers=headers, json=payload).json() == stable
        assert state()['allocated'] == 7 and alternating_ordinal() == saved_ordinal + 6
        checks.append('real HTTP auth and anonymous claim retain catchup assignment across fresh account session')
    finally:
        with connect() as connection:
            connection.execute('update proplet_experiment_internal.entry_control '
                               'set enabled=%s,starts_at=%s,ends_at=%s where singleton', old_control)
            connection.commit()
    return checks
