#!/usr/bin/env python3
from pathlib import Path
import sys
from datetime import datetime, timedelta
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from fastapi import Request
import server

# One-member teams must be fully eligible for the public team league.
today=server.current_prague_date()
week_start=today-timedelta(days=today.weekday())
member={
    'id':'solo-team-player','name':'Bratr','family_code':'BRACHUVTYM',
    'created_at':(datetime.now(server.TZ)-timedelta(days=60)).isoformat(),
    'team_joined_at':(datetime.now(server.TZ)-timedelta(days=30)).isoformat(),
}
league={
    'code':'BRACHUVTYM','name':'Bráchův tým','public_name':'Bráchův tým',
    'public_opt_in':True,
    'public_enabled_at':(datetime.now(server.TZ)-timedelta(days=14)).isoformat(),
}
result={
    'id':'r1','player_id':member['id'],'mode':'daily','daily_date':today.isoformat(),
    'puzzle_id':server.expected_daily_puzzle_id(today.isoformat()),
    'best_elapsed_ms':120000,'hints_used':0,'clean_solve':True,
}
orig_select=server.db_select
def fake_select(table, **filters):
    if table=='leagues': return [league]
    if table=='players': return [member]
    if table=='results': return [result] if filters.get('mode')=='daily' else []
    return []
server.db_select=fake_select
try:
    data=server._family_league_week(0)
finally:
    server.db_select=orig_select
assert len(data['standings'])==1, data
row=data['standings'][0]
assert row['name']=='Bráchův tým'
assert row['memberCount']==1
assert row['daysPlayed']==1
assert row['score']>0, row
assert any(d['date']==today.isoformat() and d['score']>0 and d['players']==1 for d in row['daily'])

# Authenticated member sees the same team as eligible; public payload never leaks family code.
scope={'type':'http','method':'GET','path':'/api/family-league','headers':[], 'client':('127.0.0.1',1),'server':('test',80),'scheme':'https','query_string':b''}
req=Request(scope)
orig_select,orig_auth,orig_rate=server.db_select,server.auth_player,server.enforce_rate_limit
server.db_select=fake_select
server.auth_player=lambda auth: member
server.enforce_rate_limit=lambda *a,**k:None
try:
    out=server.family_league(req,0,'Bearer test')
finally:
    server.db_select,server.auth_player,server.enforce_rate_limit=orig_select,orig_auth,orig_rate
assert out['myFamily']['memberCount']==1
assert out['myFamily']['eligible'] is True
assert out['myFamily']['rank']==1
assert out['standings'][0]['isMine'] is True
assert 'familyCode' not in out['myFamily'] and 'familyCode' not in out['standings'][0]

# Guard against accidentally reintroducing the old two-member rule.
source=(ROOT/'server.py').read_text(encoding='utf-8')
app=(ROOT/'public/app.js').read_text(encoding='utf-8')
family_fn=source[source.index('def _family_league_week'):source.index('@app.post("/api/family-league/settings")')]
assert 'member_count >= 2' not in family_fn
assert 'len(day_members) >= 2' not in family_fn
assert 'len(members) >= 2' not in family_fn
assert 'potřebuje alespoň dva hráče' not in app
print('PASS: one-member teams are eligible, score normally and remain privacy-safe')
