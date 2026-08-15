#!/usr/bin/env python3
import asyncio, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
import server

# Framework docs are not publicly exposed.
assert server.app.docs_url is None and server.app.redoc_url is None and server.app.openapi_url is None
assert server.MAX_REQUEST_BYTES == 64*1024
assert server.SECONDARY_SESSION_DAYS == 180

# Actual body-size limit works even when framework route would otherwise parse it.
client=TestClient(server.app, raise_server_exceptions=False)
large='x'*(server.MAX_REQUEST_BYTES+100)
r=client.post('/api/player', content=large, headers={'content-type':'application/json','x-request-id':'bad id !! SAFE'})
assert r.status_code==413, r.text
j=r.json(); assert j['detail']=='Požadavek je příliš velký' and j.get('requestId')
assert ' ' not in j['requestId'] and '!' not in j['requestId']
assert r.headers.get('cache-control')=='no-store'

# Unexpected 500 handler is generic and request-correlated, never echoes exception text/type.
scope500={'type':'http','method':'GET','path':'/boom','headers':[], 'client':('127.0.0.1',1),'server':('test',80),'scheme':'https','query_string':b''}
req500=Request(scope500); req500.state.request_id='boom-123'
orig_record,orig_log_exception=server.record_operational_event,server.logger.exception
server.record_operational_event=lambda *a,**k: None
server.logger.exception=lambda *a,**k: None
try:
    r=asyncio.run(server.unexpected_error_handler(req500, RuntimeError('TOP_SECRET_DATABASE_PASSWORD')))
finally:
    server.record_operational_event=orig_record
    server.logger.exception=orig_log_exception
assert r.status_code==500
body=r.body.decode()
assert 'TOP_SECRET' not in body and 'RuntimeError' not in body
assert 'boom-123' in body

# Operational metadata strips high-risk fields.
captured=[]
orig_insert=server.db_insert
server.db_insert=lambda table,row: captured.append((table,row)) or row
try:
    server.record_operational_event('client_error', metadata={'token':'abc','password':'x','ip':'1.2.3.4','email':'x@y.cz','safe':'ok'})
finally:
    server.db_insert=orig_insert
assert captured and captured[0][1]['metadata']=={'safe':'ok'}

# Rate identity never equals raw network input and RPC failure fails closed.
scope={'type':'http','method':'GET','path':'/x','headers':[],'client':('203.0.113.42',1234),'server':('test',80),'scheme':'https','query_string':b''}
req=Request(scope)
h=server._client_network_id(req)
assert h!='203.0.113.42' and len(h)==64
orig_rpc=server.db_rpc
server.db_rpc=lambda *a,**k: (_ for _ in ()).throw(HTTPException(503,'down'))
try:
    try: server.enforce_rate_limit(req,'test',limit=1,window_seconds=60)
    except HTTPException as e: assert e.status_code==503
    else: raise AssertionError('rate limiter must fail closed')
finally: server.db_rpc=orig_rpc

# Result sanity blocks impossible moves and trivially forged speed, accepts plausible result.
data=server.load_puzzles(); puzzle=data['free']['easy'][0]
answers=puzzle['answers']; active=len(puzzle.get('mask') or [])
base=dict(puzzle_id=puzzle['id'],challenge_key=f"free:{puzzle['id']}",mode='free',difficulty='easy',elapsed_ms=max(2500,active*90)+100,moves=len(answers),hints_used=0,wrong_attempts=0,max_hint_level=0,clean_solve=True)
server.validate_result_sanity(server.ResultCreate(**base))
for patch in [
    {'moves':max(1,len(answers)-1)},
    {'elapsed_ms':max(1000,max(2500,active*90)-1)},
    {'hints_used':0,'max_hint_level':1},
]:
    bad={**base,**patch}
    try: server.validate_result_sanity(server.ResultCreate(**bad))
    except HTTPException as e: assert e.status_code==400
    else: raise AssertionError(f'sanity accepted {patch}')

# Existing attempt IDs are bound to one puzzle/challenge/mode/difficulty.
orig_select,orig_rate,orig_actor=server.db_select,server.enforce_rate_limit,server.telemetry_actor
server.enforce_rate_limit=lambda *a,**k:None
server.telemetry_actor=lambda *a,**k:{'player_id':'p1','anonymous_id':None,'player':{'id':'p1'}}
server.db_select=lambda table,**filters: ([{'puzzle_id':'other','challenge_key':'free:other','mode':'free','difficulty':'easy'}] if table=='puzzle_attempts' else [])
try:
    sample=server.AttemptStart(attempt_id='attempt-1234',puzzle_id=puzzle['id'],challenge_key=f"free:{puzzle['id']}",mode='free',difficulty='easy')
    try: server.attempt_start(sample,req,'Bearer t',None)
    except HTTPException as e: assert e.status_code==400
    else: raise AssertionError('attempt ID was reusable across puzzles')
finally:
    server.db_select,server.enforce_rate_limit,server.telemetry_actor=orig_select,orig_rate,orig_actor

# Team leaderboard PII cannot be fetched by a different/solo team.
orig_auth,orig_rate=server.auth_player,server.enforce_rate_limit
server.auth_player=lambda auth:{'id':'u','family_code':'OTHER','team_joined_at':'2026-01-01'}
server.enforce_rate_limit=lambda *a,**k:None
try:
    try: server.puzzle_leaderboard(req,'x-puzzle','TEAM','Bearer t')
    except HTTPException as e: assert e.status_code==403
    else: raise AssertionError('team leaderboard leaked cross-team')
    try: server.leaderboard(req,'TEAM',None,'Bearer t')
    except HTTPException as e: assert e.status_code==403
    else: raise AssertionError('team summary leaked cross-team')
finally: server.auth_player,server.enforce_rate_limit=orig_auth,orig_rate

# Public team discovery does not read player rows and does not expose member counts/PIN hashes.
orig_select,orig_rate=server.db_select,server.enforce_rate_limit
calls=[]
def fake_select(table, **filters):
    calls.append(table)
    if table=='leagues': return [{'code':'TEAM','name':'Team','pin_hash':'hash'}]
    raise AssertionError(f'unexpected public table read: {table}')
server.db_select=fake_select; server.enforce_rate_limit=lambda *a,**k:None
try:
    out=server.list_leagues(req)
finally:
    server.db_select=orig_select; server.enforce_rate_limit=orig_rate
assert calls==['leagues'] and out=={'leagues':[{'code':'TEAM','name':'Team','protected':True}]}

# Export contains no secret hashes/tokens even if DB rows do.
orig_auth,orig_select,orig_name,orig_rate=server.auth_player,server.db_select,server.league_name_for,server.enforce_rate_limit
server.auth_player=lambda auth:{'id':'p1','name':'P','avatar':'🙂','family_code':'SOLO_X','team_joined_at':None,'support_mode':'none','created_at':'x','password_hash':'SHOULD_NOT_EXPORT','token_hash':'TOKEN'}
server.enforce_rate_limit=lambda *a,**k:None
def exp_select(table, **filters):
    if table=='player_sessions': return [{'token_hash':'SECRET','created_at':'a','last_used_at':'b','expires_at':'c'}]
    if table=='push_subscriptions': return [{'endpoint':'https://push','p256dh':'KEY','auth':'SECRET_AUTH','user_agent':'UA','created_at':'a','updated_at':'b'}]
    return []
server.db_select=exp_select; server.league_name_for=lambda x:x
try: exp=server.account_export(req,'Bearer t')
finally: server.auth_player=orig_auth; server.db_select=orig_select; server.league_name_for=orig_name
serialized=str(exp)
assert 'SHOULD_NOT_EXPORT' not in serialized and "'token_hash'" not in serialized and 'SECRET_AUTH' not in serialized and "'p256dh'" not in serialized
assert exp['profile']['hasPassword'] is True



# Existing password cannot be silently replaced with only a bearer session.
orig_rate,orig_auth=server.enforce_rate_limit,server.auth_player
server.enforce_rate_limit=lambda *a,**k:None
server.auth_player=lambda auth:{'id':'p1','password_hash':'already-set'}
try:
    try: server.set_password(server.PasswordSet(password='new-password-123'),req,'Bearer t')
    except HTTPException as e: assert e.status_code==409
    else: raise AssertionError('existing password was replaceable without re-authentication')
finally: server.enforce_rate_limit,server.auth_player=orig_rate,orig_auth

# Secondary session expiry is enforced and expired session is removed.
orig_select,orig_delete=server.db_select,server.db_delete
expired=(server.datetime.now(server.TZ)-server.timedelta(days=1)).isoformat()
deleted=[]
def sess_select(table, **filters):
    if table=='players' and 'token_hash' in filters: return []
    if table=='player_sessions': return [{'id':'s1','player_id':'p1','expires_at':expired,'last_used_at':expired}]
    if table=='players' and filters.get('id')=='p1': return [{'id':'p1'}]
    return []
server.db_select=sess_select; server.db_delete=lambda table,**filters: deleted.append((table,filters)) or []
try:
    try: server.auth_player('Bearer expired-token')
    except HTTPException as e: assert e.status_code==401 and 'vypršelo' in e.detail
    else: raise AssertionError('expired session was accepted')
finally: server.db_select=orig_select; server.db_delete=orig_delete
assert deleted and deleted[0][0]=='player_sessions'

# Account deletion requires explicit confirmation/password and refuses active admin accounts.
orig_rate,orig_auth,orig_select,orig_delete,orig_verify=server.enforce_rate_limit,server.auth_player,server.db_select,server.db_delete,server.verify_password
server.enforce_rate_limit=lambda *a,**k:None
server.auth_player=lambda auth:{'id':'p1','password_hash':'HASH'}
server.verify_password=lambda pwd,enc: pwd=='right'
server.db_select=lambda table,**filters: ([{'active':True}] if table=='admin_accounts' else [])
try:
    try: server.delete_account(server.AccountDeleteConfirm(confirmation='SMAZAT',password='right'), req, 'Bearer t')
    except HTTPException as e: assert e.status_code==409
    else: raise AssertionError('active admin account deletion should be refused')
finally:
    server.enforce_rate_limit,server.auth_player,server.db_select,server.db_delete,server.verify_password=orig_rate,orig_auth,orig_select,orig_delete,orig_verify

orig_rate,orig_auth,orig_select,orig_delete,orig_verify=server.enforce_rate_limit,server.auth_player,server.db_select,server.db_delete,server.verify_password
deletions=[]
server.enforce_rate_limit=lambda *a,**k:None
server.auth_player=lambda auth:{'id':'p1','password_hash':'HASH'}
server.verify_password=lambda pwd,enc: pwd=='right'
server.db_select=lambda table,**filters: []
server.db_delete=lambda table,**filters: deletions.append((table,filters)) or []
try:
    try: server.delete_account(server.AccountDeleteConfirm(confirmation='SMAZAT',password='wrong'), req, 'Bearer t')
    except HTTPException as e: assert e.status_code==401
    else: raise AssertionError('wrong password accepted')
    out=server.delete_account(server.AccountDeleteConfirm(confirmation='SMAZAT',password='right'), req, 'Bearer t')
finally:
    server.enforce_rate_limit,server.auth_player,server.db_select,server.db_delete,server.verify_password=orig_rate,orig_auth,orig_select,orig_delete,orig_verify
assert out['deleted'] is True and deletions==[('players',{'id':'p1'})]

# SQL migration: idempotent structure, service-only access, bounded housekeeping, no gameplay deletion.
sql=Path('SUPABASE_MIGRATION_V3_23.sql').read_text().lower()
for token in ['add column if not exists expires_at','create table if not exists public.security_rate_limits','create or replace function public.proplet_rate_limit','enable row level security','revoke all on table public.security_rate_limits from anon, authenticated','grant execute on function public.proplet_rate_limit','create table if not exists public.operational_events','create table if not exists public.support_reports','alter column admin_player_id drop not null','on delete set null','create or replace function public.proplet_launch_housekeeping']:
    assert token in sql, token
for forbidden in ['delete from public.results','delete from public.players','delete from public.puzzle_runs','truncate','drop table']:
    assert forbidden not in sql, forbidden
assert "delete from public.security_rate_limits" in sql and "delete from public.operational_events" in sql and "delete from public.support_reports" in sql
setup=Path('SUPABASE_SETUP.sql').read_text().lower()
assert 'admin_player_id uuid references public.players(id) on delete set null' in setup
assert "where lower(trim(name)) = 'pavel'" not in setup

# Public result responses must not expose exception types/messages through stats warnings.
src=Path('server.py').read_text()
assert 'stats_warning = f"{type(exc).__name__}' not in src

# All launch-sensitive write/read scopes are present in server source.
for scope in ['account_create_ip','login_ip','login_account','account_delete','account_export','logout','me_read','progress_read','support_report','client_error','result_submit','team_discovery','family_league_read','team_puzzle_leaderboard_read','team_leaderboard_read','played_levels_read','result_status_read','rescue_status_read','free_global_read','daily_global_read','push_subscribe']:
    assert f'"{scope}"' in src, scope

print('PASS: v3.23 security/privacy abuse guards, generic failures, PII boundaries and migration safety')
