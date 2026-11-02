"""Actual product-event boundary persists finite diagnostics only, never DOM content."""
from pathlib import Path
import sys
from unittest.mock import patch
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import server

stored = []
def writer(method, table, **kwargs):
    assert method == 'POST' and table == 'product_events'
    stored.append(kwargs['body'])
    return [kwargs['body']]

headers = {'X-Proplet-Test':'1','X-Proplet-Client-Release':'proplet-v4.10.12-completion-presentation1',
 'X-Proplet-Onboarding':'board-v3-short','X-Proplet-Starter-Run':'c239c99e-bd7e-4eae-9bd1-dd5c32d190f0',
 'X-Proplet-Starter-Reason':'obscured','X-Proplet-Starter-Stage':'initial',
 'X-Proplet-Starter-Obscurer':'profileModal','X-Proplet-Starter-Obscurer-Tag':'SPAN',
 'X-Proplet-Starter-Viewport-Width':'390','X-Proplet-Starter-Viewport-Height':'844'}
with patch.object(server,'enforce_rate_limit'),patch.object(server,'telemetry_actor',return_value={'anonymous_id':'a'*64}),patch.object(server,'db_request',side_effect=writer):
    with TestClient(server.app) as client:
        for event in ('starter_v1_presentation_checked','starter_v1_idle'):
            response=client.post('/api/product-event',headers=headers,json={'event_type':event})
            assert response.status_code==200,response.text
            row=stored[-1];context=row['context']
            assert context['starter_obscurer']=='profileModal' and context['starter_presentation_stage']=='initial'
            assert context['starter_viewport_width']==390 and context['starter_viewport_height']==844
            assert context['starter_run_id']==headers['X-Proplet-Starter-Run'] and row['is_test'] is True
        client.post('/api/product-event',headers=headers,json={'event_type':'starter_v1_completed'})
        assert 'starter_obscurer' not in stored[-1]['context'],'canonical phase cannot inherit presentation data'
        bad={**headers,'X-Proplet-Starter-Obscurer':'private-email@example.test','X-Proplet-Starter-Obscurer-Tag':'private',
             'X-Proplet-Starter-Stage':'private','X-Proplet-Starter-Viewport-Width':'9'*6000,'X-Proplet-Starter-Viewport-Height':'8193'}
        assert client.post('/api/product-event',headers=bad,json={'event_type':'starter_v1_idle'}).status_code==200
        assert not any(k.startswith('starter_obscurer') or k.startswith('starter_viewport') or k=='starter_presentation_stage' for k in stored[-1]['context'])
        missing={**headers,'X-Proplet-Starter-Run':'not-a-run'}
        client.post('/api/product-event',headers=missing,json={'event_type':'starter_v1_idle'})
        assert 'starter_obscurer' not in stored[-1]['context'],'no diagnostics without validated run'
print('PASS product HTTP presentation: exact finite fields, canonical isolation, malicious header rejection, UUID and test provenance')
