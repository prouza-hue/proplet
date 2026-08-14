#!/usr/bin/env python3
from pathlib import Path
import sys
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server


def test_starter_exists_and_health():
    assert server.puzzle_exists('starter-v1','starter','easy') is True
    assert server.puzzle_exists('starter-v1','free','easy') is False
    with patch.object(server,'supabase_ready',return_value=False):
        h=server.health()
    assert h['version']=='3.21.2' and h['gameFeelSprint']=='3.21' and h['starterPuzzle'] is True and h['starterXp']==10


def test_starter_result_pays_once():
    rows=[]
    def select(table,**filters):
        if table=='results':
            return [r for r in rows if all(r.get(k)==v for k,v in filters.items())]
        return []
    def insert(table,row):
        if table=='results': rows.append(dict(row))
        return row
    payload=server.ResultCreate(puzzle_id='starter-v1',challenge_key='starter:starter-v1',mode='starter',difficulty='easy',elapsed_ms=12000,moves=4,hints_used=0,wrong_attempts=0,max_hint_level=0,clean_solve=True,completed_at='2026-08-14T05:30:00Z')
    with (
        patch.object(server,'auth_player',return_value={'id':'p1','name':'Test'}),
        patch.object(server,'db_select',side_effect=select),
        patch.object(server,'db_insert',side_effect=insert),
        patch.object(server,'record_puzzle_run',return_value=None),
        patch.object(server,'player_stats',return_value={'points':10}),
    ):
        first=server.result(payload,authorization='Bearer x')
        second=server.result(payload,authorization='Bearer x')
    assert first['firstCompletion'] is True and first['awardedPoints']==10
    assert second['firstCompletion'] is False and second['awardedPoints']==0
    assert len(rows)==1 and rows[0]['mode']=='starter' and rows[0]['points']==10


def test_starter_xp_does_not_fake_game_counts():
    rows=[
        {'id':'s','mode':'starter','difficulty':'easy','points':10,'clean_solve':True,'completed_at':'2026-08-01T10:00:00Z'},
        {'id':'d','mode':'daily','difficulty':'easy','points':100,'clean_solve':True,'daily_date':'2026-08-14','best_elapsed_ms':20000,'completed_at':'2026-08-14T10:00:00Z'},
    ]
    def select(table,**filters):
        if table=='results': return rows
        if table=='streak_rescues': return []
        return []
    with patch.object(server,'db_select',side_effect=select):
        stats=server.player_stats('p1')
    assert stats['points']==110
    assert stats['totalCompleted']==1
    assert stats['cleanSolves']==1 and stats['dailyCompleted']==1


def test_starter_product_events_are_allowed():
    inserted=[]
    with (
        patch.object(server,'telemetry_actor',return_value={'player_id':None,'anonymous_id':'anon'}),
        patch.object(server,'db_insert',side_effect=lambda table,row: inserted.append((table,row)) or row),
    ):
        for event in ('starter_started','starter_hint_used','starter_completed'):
            assert server.product_event(server.ProductEventCreate(event_type=event),x_proplet_anon_id='anon')['ok']
    assert all(row['app_version']=='3.21.2' for _,row in inserted)

if __name__=='__main__':
    test_starter_exists_and_health();test_starter_result_pays_once();test_starter_xp_does_not_fake_game_counts();test_starter_product_events_are_allowed();print('PASS: v3.21 starter reward, stats isolation and analytics')
