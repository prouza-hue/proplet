#!/usr/bin/env python3
import sys
from pathlib import Path
from datetime import datetime, timedelta
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
import server

now=datetime.now(server.TZ)
def ts(delta): return (now+delta).isoformat()
product=[
 {'player_id':'p1','anonymous_id':None,'event_type':'app_open','created_at':ts(timedelta(hours=-2))},
 {'player_id':'p1','anonymous_id':None,'event_type':'onboarding_completed','created_at':ts(timedelta(hours=-2))},
 {'player_id':'p1','anonymous_id':None,'event_type':'starter_completed','created_at':ts(timedelta(hours=-1,minutes=-50))},
 {'player_id':'p1','anonymous_id':None,'event_type':'account_authenticated','created_at':ts(timedelta(hours=-1))},
 {'anonymous_id':'anon2','player_id':None,'event_type':'app_open','created_at':ts(timedelta(hours=-3))},
 {'anonymous_id':'anon2','player_id':None,'event_type':'onboarding_completed','created_at':ts(timedelta(hours=-3))},
]
attempts=[
 {'player_id':'p1','anonymous_id':None,'mode':'daily','created_at':ts(timedelta(hours=-1)),'started_at':ts(timedelta(hours=-1)),'completed_at':ts(timedelta(minutes=-45)),'app_version':'3.23.0'},
 {'anonymous_id':'anon2','player_id':None,'mode':'daily','created_at':ts(timedelta(hours=-2)),'started_at':ts(timedelta(hours=-2)),'completed_at':None,'app_version':'3.23.0'},
]
players=[{'id':'p1','created_at':ts(timedelta(hours=-1))}]
ops=[
 {'event_type':'client_error','created_at':ts(timedelta(minutes=-20))},
 {'event_type':'rate_limit','created_at':ts(timedelta(minutes=-10))},
]
support=[{'status':'new','created_at':ts(timedelta(minutes=-15))}]

orig_req,orig_all=server.require_admin,server.db_select_all
server.require_admin=lambda auth,*a,**k:{'player':{'id':'admin'},'role':'owner'}
def fake_all(table,**filters):
    return {'product_events':product,'puzzle_attempts':attempts,'players':players,'operational_events':ops,'support_reports':support}.get(table,[])
server.db_select_all=fake_all
try:
    out=server.admin_launch('Bearer admin')
finally:
    server.require_admin=orig_req; server.db_select_all=orig_all
assert out['active']['last24h']==2, out
assert out['newAccounts24h']==1
assert out['funnel24h']['appOpen']==2
assert out['funnel24h']['onboardingCompleted']==2
assert out['funnel24h']['starterCompleted']==1
assert out['funnel24h']['dailyStarted']==2
assert out['funnel24h']['dailyCompleted']==1
assert out['funnel24h']['accountAuthenticated']==1
assert out['starterToAccount7d']['converted']==1 and out['starterToAccount7d']['rate']==1.0
assert out['reliability']=={'errors24h':1,'errors7d':1,'rateLimits24h':1,'openSupportReports':1}
assert out['appVersions7d'][0]=={'version':'3.23.0','attempts':2}
# No actor IDs are exposed in the aggregate launch response.
text=str(out)
assert 'anon2' not in text and "'p1'" not in text
print('PASS: v3.23 launch radar aggregates anonymous/account data without exposing actor identifiers')
