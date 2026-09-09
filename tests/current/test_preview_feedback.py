"""Exercise the real endpoint bodies without network or heavyweight server imports."""
import ast
import hashlib
import math
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend import content as domain_content

source = ast.parse((Path(__file__).resolve().parents[2] / 'server.py').read_text())
functions = {n.name: n for n in source.body if isinstance(n, ast.FunctionDef)}
names = ['free_global_leaderboard', 'daily_global_leaderboard', 'current_tajenka',
         'ranking_elapsed_ms', 'displayed_elapsed_seconds', 'competition_ranks', 'run_rank_tuple', 'first_run_key', 'completion_time',
         '_ranking_display_identity', '_ranking_anonymous_identity', '_ranking_player_visible']
ns = dict(domain_content=domain_content, Optional=Optional, Request=object, Query=lambda default=None, **kw: default,
          Header=lambda default=None: default, math=math, date=date, datetime=datetime, TZ=timezone.utc, hashlib=hashlib)
for node in source.body:
    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id.startswith('_RANKING_ANON_') for t in node.targets):
        exec(compile(ast.Module([node], []), '<constants>', 'exec'), ns)
for name in names:
    node = functions[name]; node.decorator_list = []
    exec(compile(ast.Module([node], []), '<endpoint>', 'exec'), ns)
# First attempts only, ties, self far below the first page, anonymous identity.
runs = [dict(player_id=f'p{i:03}', puzzle_id='puzzle', mode='daily',
             elapsed_ms=1000 + (i//2)*1000, moves=5, hints_used=0, clean_solve=True,
             completed_at=f'2026-09-09T10:00:{i%60:02}Z') for i in range(105)]
players = [dict(id=r['player_id'], name='PRIVATE NAME', public_rankings=False) for r in runs]
ns.update(enforce_rate_limit=lambda *a, **k: None,
          free_puzzle_info=lambda p: dict(difficulty='easy', level=1),
          ranking_queries=SimpleNamespace(ranking_runs=lambda *a, **k: (runs, 'test'),
                                          entity_context=lambda *a, **k: (players, [])),
          db_rpc=None, db_select_bounded=None, competitive_row=lambda r: True,
          auth_player=lambda a: {'id': 'p077'},
          daily_leaderboard_puzzle_id=lambda *a: 'puzzle',
          expected_daily_puzzle_id=lambda *a: 'puzzle',
          daily_run_date=lambda r: '2026-09-09', current_prague_date=lambda: date(2026,9,9))
# Existing ranking helpers have stable dependencies supplied by the server normally.
ns['parse_timestamp'] = lambda s: s
for fn, kwargs in [(ns['free_global_leaderboard'], {'puzzle_id':'puzzle'}),
                   (ns['daily_global_leaderboard'], {'daily_date':'2026-09-09'})]:
    compact = fn(None, authorization='test', **kwargs)
    pages = [fn(None, authorization='test', offset=i, **kwargs) for i in (0,50,100)]
    all_rows = sum([p['rows'] for p in pages], [])
    assert len(compact['rows']) == 3
    assert [len(p['rows']) for p in pages] == [50,50,5]
    assert [p['nextOffset'] for p in pages] == [50,100,None]
    assert len(all_rows) == compact['total'] == 105
    assert sum(r['isMine'] for r in all_rows) == 1
    assert compact['myRank'] == next(r['rank'] for r in all_rows if r['isMine'])
    assert compact['rows'] == all_rows[76:79]
    assert all(r['name'] != 'PRIVATE NAME' for r in all_rows if not r['isMine'])
    assert all('player_id' not in r for r in all_rows)
    assert fn(None, offset=200, **kwargs)['rows'] == []
    assert fn(None, **kwargs)['myRank'] is None
ns.update(VERCEL_ENV='preview', tajenka_week_for=lambda d: 2,
          tajenka_puzzle_for_week=lambda w: {'week':w},
          JSONResponse=lambda content, **kw: content)
assert ns['current_tajenka']()['week'] == 2
assert ns['current_tajenka'](week=1)['week'] == 1
print('PASS: compact/paginated standings, ties, viewer position, privacy and current preview Tajenka')
