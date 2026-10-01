"""Exercise auth RPC in the disposable loopback PostgreSQL fixture only.

First run test_isolated_result_db.py with the current migrations. All fixtures,
bookkeeping writes and temporary failure triggers are rolled back together.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import uuid

import psycopg
from psycopg import sql


PLAYER_FIELDS = {
    'id', 'name', 'family_code', 'token_hash', 'created_at', 'password_hash',
    'avatar', 'support_mode', 'team_joined_at', 'public_rankings', 'email',
    'email_verified_at', 'auth_user_id', 'google_avatar_url', 'use_google_avatar',
    'printshop_welcome_seen_at',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    source = json.loads(args.database_report.read_text())
    assert source['host'] == '127.0.0.1' and source['syntheticOnly'] is True
    assert re.fullmatch(r'proplet_test_[a-z0-9_]{1,40}', source['database'])
    options = dict(host='127.0.0.1', port=55432, user='proplet_test_admin',
                   password=args.password_file.read_text().strip(),
                   dbname=source['database'], autocommit=True)
    checks = []

    def token_hash(label):
        return hashlib.sha256(('usage-auth-synthetic-' + label + str(uuid.uuid4())).encode()).hexdigest()

    with psycopg.connect(**options) as connection:
        with connection.transaction():
            c = connection
            assert c.execute("select to_regprocedure('public.proplet_auth_player_v1(text)') is not null").fetchone()[0], 'Run current fixture migrations first'
            player_a, player_b = str(uuid.uuid4()), str(uuid.uuid4())
            legacy_a, legacy_b = token_hash('legacy-a'), token_hash('legacy-b')
            for player, digest in ((player_a, legacy_a), (player_b, legacy_b)):
                c.execute('insert into public.players(id,name,family_code,token_hash) values(%s,%s,%s,%s)',
                          (player, 'Synthetic auth ' + player[:8], 'SOLO_' + player[:8].upper(), digest))

            def session(digest, player=player_b, expiry='1 day', last_used='1 hour'):
                session_id = str(uuid.uuid4())
                c.execute('''insert into public.player_sessions(id,player_id,token_hash,created_at,expires_at,last_used_at)
                             values(%s,%s,%s,statement_timestamp(),
                                    case when %s::text is null then null else statement_timestamp()+%s::interval end,
                                    case when %s::text is null then null else statement_timestamp()-%s::interval end)''',
                          (session_id, player, digest, expiry, expiry, last_used, last_used))
                return session_id

            def auth(digest):
                c.execute('set local role service_role')
                try:
                    return c.execute('select public.proplet_auth_player_v1(%s)', (digest,)).fetchone()[0]
                finally:
                    c.execute('reset role')

            def last_used(session_id):
                return c.execute('select last_used_at from public.player_sessions where id=%s', (session_id,)).fetchone()[0]

            collision = session(legacy_a, expiry='-1 day')
            result = auth(legacy_a)
            assert result['expired'] is False and result['player']['id'] == player_a
            assert set(result['player']) == PLAYER_FIELDS
            assert c.execute('select count(*) from public.player_sessions where id=%s', (collision,)).fetchone()[0] == 1
            checks.append('legacy priority, no legacy expiry, explicit player fields')

            secondary_digest = token_hash('secondary')
            secondary = session(secondary_digest)
            recent_time = last_used(secondary)
            result = auth(secondary_digest)
            assert result['player']['id'] == player_b and result['expired'] is False
            assert result['player']['token_hash'] == legacy_b
            assert last_used(secondary) == recent_time
            checks.append('secondary device identity, recent last_used unchanged')

            assert auth(token_hash('invalid')) == {'player': None, 'expired': False}
            assert auth(None) == {'player': None, 'expired': False}
            checks.append('invalid and NULL token rejected')

            expired_digest = token_hash('expired')
            expired = session(expired_digest, expiry='-1 second')
            assert auth(expired_digest) == {'player': None, 'expired': True}
            assert c.execute('select count(*) from public.player_sessions where id=%s', (expired,)).fetchone()[0] == 0
            checks.append('expired token rejected and cleaned up')

            indefinite_digest = token_hash('indefinite')
            indefinite = session(indefinite_digest, expiry=None, last_used=None)
            assert auth(indefinite_digest)['player']['id'] == player_b
            assert last_used(indefinite) is not None
            checks.append('NULL expiry stays valid, NULL last_used refreshed')

            old_digest = token_hash('old')
            old_session = session(old_digest, last_used='25 hours')
            old_time = last_used(old_session)
            assert auth(old_digest)['player']['id'] == player_b
            refreshed = last_used(old_session)
            assert refreshed > old_time
            assert auth(old_digest)['player']['id'] == player_b
            assert last_used(old_session) == refreshed
            checks.append('last_used refresh once per 24 hours')

            c.execute('delete from public.player_sessions where id=%s', (secondary,))
            assert auth(secondary_digest) == {'player': None, 'expired': False}
            c.execute('update public.players set token_hash=%s where id=%s', (token_hash('rotated'), player_a))
            c.execute('delete from public.player_sessions where id=%s', (collision,))
            assert auth(legacy_a) == {'player': None, 'expired': False}
            checks.append('session revocation and legacy rotation effective immediately')

            # A bookkeeping write failure must preserve valid authentication,
            # while a cleanup failure must never authorize an expired session.
            failing_digest = token_hash('write-failure')
            failing = session(failing_digest, last_used='25 hours')
            failure_time = last_used(failing)
            c.execute("""create function pg_temp.reject_usage_auth_fixture_write()
                         returns trigger language plpgsql as $$
                         begin raise exception 'Synthetic optional bookkeeping failure'; end;
                         $$""")
            c.execute(sql.SQL('''create trigger usage_auth_fixture_write_failure
                                before update or delete on public.player_sessions
                                for each row when (old.id = {}::uuid)
                                execute function pg_temp.reject_usage_auth_fixture_write()''').format(sql.Literal(failing)))
            assert auth(failing_digest)['player']['id'] == player_b
            assert last_used(failing) == failure_time
            c.execute('drop trigger usage_auth_fixture_write_failure on public.player_sessions')
            c.execute("update public.player_sessions set expires_at=statement_timestamp()-interval '1 second' where id=%s", (failing,))
            c.execute(sql.SQL('''create trigger usage_auth_fixture_write_failure
                                before delete on public.player_sessions
                                for each row when (old.id = {}::uuid)
                                execute function pg_temp.reject_usage_auth_fixture_write()''').format(sql.Literal(failing)))
            assert auth(failing_digest) == {'player': None, 'expired': True}
            assert c.execute('select count(*) from public.player_sessions where id=%s', (failing,)).fetchone()[0] == 1
            checks.append('optional writes may fail, expired sessions still denied')

            assert not c.execute("select prosecdef from pg_proc where oid='public.proplet_auth_player_v1(text)'::regprocedure").fetchone()[0]
            assert c.execute("select has_function_privilege('service_role','public.proplet_auth_player_v1(text)','execute')").fetchone()[0]
            for role in ('anon', 'authenticated'):
                assert not c.execute("select has_function_privilege(%s,'public.proplet_auth_player_v1(text)','execute')", (role,)).fetchone()[0]
                try:
                    with c.transaction():
                        c.execute(sql.SQL('set local role {}').format(sql.Identifier(role)))
                        c.execute('select public.proplet_auth_player_v1(%s)', (legacy_b,))
                    raise AssertionError(role + ' executed private auth RPC')
                except psycopg.errors.InsufficientPrivilege:
                    pass
            checks.append('SECURITY INVOKER, service role granted, anon/authenticated execution denied')
            raise psycopg.Rollback()

    report = {'syntheticOnly': True, 'database': source['database'],
              'finishedAt': datetime.now(timezone.utc).isoformat(), 'checks': checks,
              'rolledBack': True}
    if args.output:
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
