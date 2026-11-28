"""Direct entry and reporting in the disposable PostgreSQL gate."""
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
ASSIGN = "select public.proplet_entry_assign_v1(%s,%s,%s,null,%s,'fixture','fixture','test',%s)"


def verify_direct_entry(connection):
    namespace = 'local'
    with connection.transaction(force_rollback=True), connection.cursor() as cursor:
        cursor.execute("select enabled, starts_at from proplet_experiment_internal.entry_direct_control "
                       "where environment='production'")
        assert cursor.fetchone() == (False, None)
        cursor.execute("insert into proplet_experiment_internal.entry_direct_control "
                       "(environment,enabled,starts_at) values "
                       "(%s,true,now()-interval '1 hour')", (namespace,))
        cursor.execute("set local role service_role")
        cursor.execute("select has_column_privilege(current_user, "
                       "'proplet_experiment_internal.entry_direct_control','enabled','UPDATE')")
        assert cursor.fetchone() == (False,)

        identities = [sha256(f'direct-entry-test-{i}'.encode()).hexdigest() for i in range(32)]
        for identity in identities:
            cursor.execute(ASSIGN, (namespace, True, identity, uuid4(), True))
            assigned = cursor.fetchone()[0]
            assert assigned['variant'] == 'B' and assigned['boardId'] == 'g4-e-009', assigned
            assert assigned['allocationPolicy'] == 'direct_entry_v1', assigned
            assert assigned['allocationOrdinal'] is None, assigned
            cursor.execute(ASSIGN, (namespace, True, identity, uuid4(), False))
            assert cursor.fetchone()[0] == assigned
        cursor.execute("select count(*) from public.product_events where environment=%s and is_test "
                       "and context->>'entry_allocation_policy'='direct_entry_v1'", (namespace,))
        assert cursor.fetchone() == (len(identities),)
        cursor.execute("reset role")
        cursor.execute("update proplet_experiment_internal.entry_direct_control "
                       "set enabled=false where environment=%s", (namespace,))
        cursor.execute(ASSIGN, (namespace, True, identities[0], uuid4(), True))
        assert cursor.fetchone()[0]['allocationPolicy'] == 'direct_entry_v1'
        # Stopping the rollout affects new assignments only.
        cursor.execute(ASSIGN, (namespace, True, '9'*64, uuid4(), True))
        assert cursor.fetchone()[0]['allocationPolicy'] == 'alternating_v1'

    query = (ROOT / 'docs/audits/DIRECT-ENTRY-READOUT.sql').read_text(encoding='utf8')
    with connection.transaction(force_rollback=True), connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute("update proplet_experiment_internal.entry_direct_control set "
                       "starts_at='2026-12-01 10:00Z' where environment='production'")
        cursor.execute("alter table proplet_experiment_internal.entry_assignments "
                       "disable trigger proplet_entry_allocate_v1")
        insert = """with inserted as (
                        insert into proplet_experiment_internal.entry_assignments
                            (environment,is_test,anonymous_id,first_steps_run_id,variant,assigned_at,allocation_policy)
                        values ('production',%s,%s,%s,%s,'2026-12-01 11:00Z',%s)
                        returning *
                    )
                    insert into public.product_events
                       (id,anonymous_id,event_type,created_at,environment,is_test,context)
                    select event_id,anonymous_id,'entry_experiment_assigned',assigned_at,environment,is_test,
                           jsonb_build_object('entry_experiment','new-player-entry-v1','entry_variant',variant,
                             'entry_allocation_policy',allocation_policy,'first_steps_run_id',first_steps_run_id)
                    from inserted"""
        a, b, silent = identities[:3]
        for i, is_test, policy in ((a, False, 'direct_entry_v1'), (b, False, 'direct_entry_v1'),
                                   (silent, False, 'direct_entry_v1'), ('d'*64, True, 'direct_entry_v1'),
                                   ('c'*64, False, 'hash50_v1')):
            cursor.execute(insert, (is_test, i, uuid4(), 'B', policy))
        for i, identity, puzzle, mode, completed, is_test in (
                (1, a, 'starter-v1', 'starter', '2026-12-01 12:00Z', False),
                (2, a, 'g4-e-009', 'free', '2026-12-02 11:00Z', False),
                (3, a, 'g4-e-009', 'free', '2026-12-01 12:00Z', True),
                (4, b, 'g4-e-009', 'free', '2026-12-01 12:00Z', False),
                (5, b, 'g4-e-010', 'free', '2026-12-01 13:00Z', False)):
            cursor.execute("""insert into public.puzzle_attempts
                           (id,anonymous_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at,environment,is_test)
                           values (%s,%s,%s,%s,%s,'easy','2026-12-01 11:05Z',%s,'production',%s)""",
                           (f'direct-entry-attempt-{i}', identity, puzzle, f'{mode}:{puzzle}', mode, completed, is_test))

        early = cursor.execute(query.replace('statement_timestamp()', "timestamptz '2026-12-02 10:59Z'")).fetchone()
        assert (early['assigned'], early['observed_24h'], early['completed_24h']) == (3, 0, 0), early
        report = cursor.execute(query.replace('statement_timestamp()', "timestamptz '2026-12-02 11:00Z'")).fetchone()
        assert (report['assigned'], report['observed_24h'], report['completed_24h']) == (3, 3, 1), report
        assert not report['investigate'], report
