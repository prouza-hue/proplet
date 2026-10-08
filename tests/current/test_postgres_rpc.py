"""Transport boundaries: database targeting, failover and uncertain writes."""
from contextlib import contextmanager
from pathlib import Path
import os
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
from backend import db, postgres_rpc as rpc

URL = 'https://syntheticproject.supabase.co'
ENV = {'VERCEL_ENV':'production','PROPLET_DB_RPC_TRANSPORT':'postgres',
       'POSTGRES_URL':'postgresql://postgres.syntheticproject:synthetic@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=disable'}


class PostgresRpcTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.state = patch.multiple(rpc,_retry_after=0.0,_status='postgrest')
        self.state.start()
        self.addCleanup(self.state.stop)

    def test_only_matching_production_database_and_tls(self):
        dsn = rpc.configured_dsn(URL)
        self.assertIn('sslmode=require',dsn)
        self.assertNotIn('pgbouncer',dsn)
        for overrides in ({'VERCEL_ENV':'preview'}, {'PROPLET_DB_RPC_TRANSPORT':'postgrest'},
                          {'POSTGRES_URL':ENV['POSTGRES_URL'].replace('postgres.syntheticproject','postgres.wrong')},
                          {'POSTGRES_URL':ENV['POSTGRES_URL'].replace('pooler.supabase.com','attacker.example')}):
            with self.subTest(overrides=overrides), patch.dict(os.environ,overrides):
                self.assertIsNone(rpc.configured_dsn(URL))

    def test_connection_failure_falls_back_before_execution_and_opens_circuit(self):
        with patch.object(rpc,'_connection_pool',side_effect=RuntimeError('unreachable')) as get_pool, patch.object(rpc,'execute_on_connection') as execute:
            self.assertIs(rpc.try_execute('proplet_rate_limit',{},URL),rpc.UNAVAILABLE)
            self.assertIs(rpc.try_execute('proplet_rate_limit',{},URL),rpc.UNAVAILABLE)
        self.assertEqual(get_pool.call_count,1)
        execute.assert_not_called()
        self.assertEqual(rpc.transport_status(),'postgrest-fallback')

    def test_uncertain_commit_never_replays_business_function(self):
        connection = Mock()
        @contextmanager
        def transaction():
            yield
            raise RuntimeError('connection lost at commit')
        connection.transaction.side_effect = transaction
        pool = Mock()
        pool.connection.return_value.__enter__ = Mock(return_value=connection)
        pool.connection.return_value.__exit__ = Mock(return_value=False)
        http = Mock()
        with patch.object(rpc,'_connection_pool',return_value=pool), patch.object(rpc,'_signature',return_value=([],[],False,'jsonb')), patch.object(rpc,'execute_on_connection',return_value={'saved':True}) as execute:
            with self.assertRaises(HTTPException) as raised:
                db.db_rpc('proplet_submit_result_v1',{},supabase_url=URL,supabase_secret_key='synthetic',http_client=http)
        self.assertEqual(raised.exception.status_code,503)
        self.assertEqual(execute.call_count,1)
        http.post.assert_not_called()
        connection.execute.assert_any_call(rpc.TRANSACTION_SETUP)

    def test_domain_errors_and_json_result_preserve_rpc_contract(self):
        error = Mock(sqlstate='P0001',diag=Mock(message_primary='IDEMPOTENCY_CONFLICT',message_detail=None,message_hint=None))
        from backend.results import map_atomic_rpc_error
        from psycopg import errors
        with patch.object(rpc,'try_execute',side_effect=errors.UniqueViolation('synthetic')):
            with self.assertRaises(HTTPException):
                db.db_rpc('proplet_submit_result_v1',{},supabase_url=URL,supabase_secret_key='synthetic')
        self.assertEqual(map_atomic_rpc_error(*rpc.error_payload(error)).status_code,409)
        http = Mock()
        with patch.object(rpc,'try_execute',return_value={'allowed':False}):
            self.assertEqual(db.db_rpc('proplet_request_guard_v1',{},supabase_url=URL,supabase_secret_key='synthetic',http_client=http),{'allowed':False})
        http.post.assert_not_called()


if __name__=='__main__':
    unittest.main()
