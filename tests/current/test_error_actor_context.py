"""Actual HTTP boundary with isolated reads/writer; no production access."""
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
from fastapi.testclient import TestClient
import server

player='b7c67e99-f7d9-458e-955b-d02b57d2215d'
attempt='0cc55b4d-d7c0-42fd-93b3-04c588aaef62'
starter='a73be190-2097-4a35-9e86-520fa64af7d3'
flow='ecaa8b71-335e-475a-88d7-d6f7c8b6f3ff'
anon='a'*64
stored=[]
def writer(method, table, **kwargs):
    assert method=='POST' and table=='operational_events'
    stored.append(kwargs['body']);return [kwargs['body']]
headers={'X-Proplet-Anon-ID':'synthetic-anonymous-value','X-Proplet-Test':'1',
         'X-Proplet-Run':attempt,'X-Proplet-Puzzle':'g4-e-009',
         'X-Proplet-Starter-Run':starter,'X-Proplet-First-Steps-Run':flow}
with patch.object(server,'VERCEL_ENV','production'), patch.object(server,'enforce_rate_limit'), \
     patch.object(server,'db_request',side_effect=writer):
    with TestClient(server.app) as client:
        for actor,owner in [({'player_id':player},'player_id'),({'anonymous_id':anon},'anonymous_id')]:
            def lookup(table, **filters):
                assert table=='puzzle_attempts' and filters[owner]==actor[owner]
                assert filters['environment']=='production' and filters['is_test'] is True
                assert filters['id']==attempt
                return [{'id':attempt,'puzzle_id':'g4-e-009'}]
            with patch.object(server,'telemetry_actor',return_value=actor), patch.object(server,'db_select',side_effect=lookup):
                stored.clear();res=client.post('/api/client-error',headers=headers,json={'code':'window_error','message':'legacy','actor_key':'spoof','attempt_id':'spoof'})
                assert res.status_code==200 and len(stored)==1
                row=stored[0];m=row['metadata']
                assert m['reporting_actor_key']==('p:'+player if owner=='player_id' else 'a:'+anon)
                assert m['reported_starter_run_id']==starter and m['reported_first_steps_run_id']==flow
                assert m['attempt_id']==attempt and m['attempt_link']=='owned' and m['context_at']=='report'
                assert row['client_release']=='legacy' and row['is_test'] is True
                assert 'spoof' not in str(row) and 'synthetic-anonymous-value' not in str(row)
        for result,link in [([], 'not_owned_or_missing'),([{'id':attempt,'puzzle_id':'other'}],'not_owned_or_missing'),(HTTPException(503,'lookup'),'lookup_unavailable')]:
            with patch.object(server,'telemetry_actor',return_value={'player_id':player}), patch.object(server,'db_select',**({'side_effect':result} if isinstance(result,Exception) else {'return_value':result})):
                stored.clear();res=client.post('/api/client-error',headers=headers,json={'code':'window_error'})
                assert res.status_code==200 and len(stored)==1
                assert stored[0]['metadata']['attempt_link']==link and 'attempt_id' not in stored[0]['metadata']
        with patch.object(server,'telemetry_actor',side_effect=HTTPException(401,'no actor')),patch.object(server,'db_select') as lookup:
            stored.clear();client.post('/api/client-error',headers=headers,json={'code':'window_error'})
            assert stored[0]['actor_kind']=='network' and 'reporting_actor_key' not in stored[0]['metadata']
            lookup.assert_not_called()
        with patch.object(server,'telemetry_actor',return_value={'anonymous_id':anon}),patch.object(server,'db_select') as lookup:
            stored.clear();client.post('/api/client-error',headers={**headers,'X-Proplet-Run':'not-a-uuid','X-Proplet-Starter-Run':'private?secret=1'},json={'code':'window_error'})
            assert 'reported_attempt_id' not in stored[0]['metadata'] and 'reported_starter_run_id' not in stored[0]['metadata']
            lookup.assert_not_called()
print('PASS error actor/context: resolved identities, owned/test-scoped attempt, missing/foreign/mismatched attempt, unavailable lookup, privacy and legacy release')
