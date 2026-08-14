#!/usr/bin/env python3
from pathlib import Path
import sys
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server

def test_health():
    with patch.object(server,'supabase_ready',return_value=False): h=server.health()
    assert h['version']=='3.22.4'
    assert h['darkModeSprint']=='3.22' and h['boardFit2DHotfix'] is True and h['foldWebPwaLayoutUnified'] is True
    assert h['orientationBlocking'] is False and h['foldResponsiveReflow'] is True

def test_product_event_version():
    inserted=[]
    with (patch.object(server,'telemetry_actor',return_value={'player_id':None,'anonymous_id':'anon'}),patch.object(server,'db_insert',side_effect=lambda table,row: inserted.append((table,row)) or row)):
        assert server.product_event(server.ProductEventCreate(event_type='app_open'),x_proplet_anon_id='anon')['ok']
    assert inserted[0][1]['app_version']=='3.22.4'

if __name__=='__main__':
    test_health(); test_product_event_version(); print('PASS: v3.22.4 server health/version + layout flag')
