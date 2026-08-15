#!/usr/bin/env python3
"""Static launch gate: every API route has an explicit trust boundary."""
import ast
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
src=(ROOT/'server.py').read_text()
tree=ast.parse(src)
routes=[]
for node in tree.body:
    if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
        continue
    for deco in node.decorator_list:
        if not (isinstance(deco,ast.Call) and isinstance(deco.func,ast.Attribute) and isinstance(deco.func.value,ast.Name) and deco.func.value.id=='app'):
            continue
        method=deco.func.attr.upper()
        if method not in {'GET','POST','PATCH','DELETE','PUT'} or not deco.args or not isinstance(deco.args[0],ast.Constant):
            continue
        path=deco.args[0].value
        if isinstance(path,str) and path.startswith('/api/'):
            body=ast.get_source_segment(src,node) or ''
            routes.append((method,path,node.name,body))

route_keys={(m,p) for m,p,_,_ in routes}
# This is deliberately exhaustive: adding a route requires deciding its launch trust boundary.
expected={
('GET','/api/health'),('GET','/api/config'),('GET','/api/teams'),('GET','/api/leagues'),
('POST','/api/player'),('POST','/api/login'),('POST','/api/anonymous/claim'),('POST','/api/password'),
('POST','/api/avatar'),('POST','/api/support-mode'),('POST','/api/helper-event'),('POST','/api/hint-event'),
('POST','/api/product-event'),('POST','/api/team-pin'),('POST','/api/team-membership'),('POST','/api/logout'),
('GET','/api/me'),('GET','/api/progress'),('GET','/api/account/export'),('DELETE','/api/account'),
('POST','/api/support-report'),('POST','/api/client-error'),('POST','/api/attempt/start'),
('POST','/api/attempt/checkpoint'),('POST','/api/attempt/finish'),('POST','/api/feedback'),
('GET','/api/admin/me'),('GET','/api/admin/launch'),('GET','/api/admin/support'),('PATCH','/api/admin/support/{report_id}'),
('GET','/api/admin/overview'),('GET','/api/admin/users'),('GET','/api/admin/users/{player_id}'),
('GET','/api/admin/reports'),('PATCH','/api/admin/reports/{report_id}'),('GET','/api/admin/audit'),
('GET','/api/admin/quality'),('GET','/api/quality-report'),('GET','/api/admin/quality-history'),('GET','/api/quality-history'),
('POST','/api/result'),('GET','/api/result-status'),('GET','/api/rescue-status'),('POST','/api/rescue/start'),
('POST','/api/rescue/finish'),('GET','/api/family-league'),('POST','/api/family-league/settings'),
('GET','/api/puzzle-leaderboard'),('GET','/api/free-global-leaderboard'),('GET','/api/daily-global-leaderboard'),
('GET','/api/played-levels'),('GET','/api/push/config'),('POST','/api/push/subscribe'),('POST','/api/push/unsubscribe'),
('GET','/api/cron/daily-push'),('GET','/api/leaderboard'),
}
assert route_keys==expected, f'API inventory drift. added={sorted(route_keys-expected)} removed={sorted(expected-route_keys)}'

public_plain={('GET','/api/health'),('GET','/api/config'),('GET','/api/push/config')}
public_rate={('GET','/api/teams'),('GET','/api/leagues'),('GET','/api/family-league'),('GET','/api/free-global-leaderboard'),('GET','/api/daily-global-leaderboard')}
telemetry_actor={
('POST','/api/helper-event'),('POST','/api/hint-event'),('POST','/api/product-event'),('POST','/api/support-report'),
('POST','/api/attempt/start'),('POST','/api/attempt/checkpoint'),('POST','/api/attempt/finish'),('POST','/api/feedback'),
}
network_error={('POST','/api/client-error')}
bootstrap_rate={('POST','/api/player'),('POST','/api/login')}
manual_bearer={('POST','/api/logout')}
cron={('GET','/api/cron/daily-push')}
admin_paths={(m,p) for m,p,_,_ in routes if p.startswith('/api/admin/')}|{('GET','/api/quality-report'),('GET','/api/quality-history')}

for method,path,name,body in routes:
    key=(method,path)
    if key in public_plain:
        continue
    if key in public_rate:
        assert 'enforce_rate_limit' in body, key
        continue
    if key in telemetry_actor:
        assert 'telemetry_actor' in body and 'enforce_rate_limit' in body, key
        continue
    if key in network_error:
        assert 'enforce_rate_limit' in body, key
        continue
    if key in bootstrap_rate:
        assert 'enforce_rate_limit' in body, key
        continue
    if key in manual_bearer:
        assert 'enforce_rate_limit' in body and 'bearer ' in body.lower(), key
        continue
    if key in cron:
        assert 'CRON_SECRET' in body and 'bearer ' in body.lower(), key
        continue
    if key in admin_paths:
        assert 'require_admin' in body, key
        continue
    # Remaining player-specific endpoints must authenticate a player. Mutations and expensive reads are rate-limited.
    assert 'auth_player' in body, key
    if method in {'POST','PATCH','DELETE','PUT'} or key in {
        ('GET','/api/me'),('GET','/api/progress'),('GET','/api/account/export'),('GET','/api/result-status'),
        ('GET','/api/rescue-status'),('GET','/api/puzzle-leaderboard'),('GET','/api/played-levels'),('GET','/api/leaderboard'),
    }:
        assert 'enforce_rate_limit' in body, key

# Public discovery/global boards must not return player identity fields.
for func_name in ['list_leagues','free_global_leaderboard','daily_global_leaderboard']:
    fn=next(body for _,_,name,body in routes if name==func_name)
    if func_name=='list_leagues':
        assert 'db_select("players"' not in fn and 'memberCount' not in fn and 'pin_hash' not in fn.split('return',1)[-1]
    else:
        # Auth may be used only to mark the current row/rank; response stays performance-only.
        assert '"name"' not in fn and '"avatar"' not in fn and '"familyCode"' not in fn

print(f'PASS: v3.23 inventories all {len(route_keys)} API routes and enforces explicit public/player/admin/cron trust boundaries')
