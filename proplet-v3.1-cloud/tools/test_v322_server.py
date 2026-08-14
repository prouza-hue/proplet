#!/usr/bin/env python3
from pathlib import Path
import sys
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server

def test_health_theme_and_preserved_starter():
    with patch.object(server,'supabase_ready',return_value=False): h=server.health()
    assert h['version']=='3.22.0'
    assert h['darkModeSprint']=='3.22'
    assert h['themeModes']==['auto','light','dark']
    assert h['themePreferenceScope']=='device'
    assert h['orientationBlocking'] is False and h['foldResponsiveReflow'] is True
    assert h['starterPuzzle'] is True and h['starterXp']==10 and h['starterHintOptional'] is True

def test_starter_reward_still_pays_once():
    rows=[]
    def select(table,**filters):
        if table=='results': return [r for r in rows if all(r.get(k)==v for k,v in filters.items())]
        return []
    def insert(table,row):
        if table=='results': rows.append(dict(row))
        return row
    payload=server.ResultCreate(puzzle_id='starter-v1',challenge_key='starter:starter-v1',mode='starter',difficulty='easy',elapsed_ms=12000,moves=4,hints_used=0,wrong_attempts=0,max_hint_level=0,clean_solve=True,completed_at='2026-08-14T05:30:00Z')
    with (patch.object(server,'auth_player',return_value={'id':'p1','name':'Test'}),patch.object(server,'db_select',side_effect=select),patch.object(server,'db_insert',side_effect=insert),patch.object(server,'record_puzzle_run',return_value=None),patch.object(server,'player_stats',return_value={'points':10})):
        first=server.result(payload,authorization='Bearer x');second=server.result(payload,authorization='Bearer x')
    assert first['firstCompletion'] is True and first['awardedPoints']==10
    assert second['firstCompletion'] is False and second['awardedPoints']==0

def test_product_event_version():
    inserted=[]
    with (patch.object(server,'telemetry_actor',return_value={'player_id':None,'anonymous_id':'anon'}),patch.object(server,'db_insert',side_effect=lambda table,row: inserted.append((table,row)) or row)):
        assert server.product_event(server.ProductEventCreate(event_type='app_open'),x_proplet_anon_id='anon')['ok']
    assert inserted[0][1]['app_version']=='3.22.0'

if __name__=='__main__':
    test_health_theme_and_preserved_starter();test_starter_reward_still_pays_once();test_product_event_version();print('PASS: v3.22 server health/version and starter reward regression')
