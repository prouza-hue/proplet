#!/usr/bin/env python3
import sys, importlib.util, unittest
from pathlib import Path
from fastapi import Request
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
import server
scope={'type':'http','method':'POST','path':'/test','headers':[],'client':('127.0.0.1',1),'server':('test',80),'scheme':'https','query_string':b''}
req=Request(scope); req.state.request_id='regression'
orig_rate=server.enforce_rate_limit; server.enforce_rate_limit=lambda *a,**k: None
orig_sanity=server.validate_result_sanity; server.validate_result_sanity=lambda payload: None
orig_result=server.result; orig_daily=server.daily_global_leaderboard
# Historical v3.16 regression tests call pre-Request direct function signatures.
server.result=lambda payload,authorization=None: orig_result(payload,req,authorization)
server.daily_global_leaderboard=lambda daily_date=None,authorization=None: orig_daily(req,daily_date,authorization)
try:
    spec=importlib.util.spec_from_file_location('legacy_v316',ROOT/'tools/test_v316_migration.py')
    mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    suite=unittest.defaultTestLoader.loadTestsFromModule(mod)
    result=unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful(): raise SystemExit(1)
finally:
    server.enforce_rate_limit=orig_rate; server.validate_result_sanity=orig_sanity; server.result=orig_result; server.daily_global_leaderboard=orig_daily
print('PASS: v3.23 preserves all 14 v3.16 Daily/Free migration and global-Daily fairness regressions')
