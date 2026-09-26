"""HTTP → middleware → real event writer → exact DB payload; no external database."""
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4
from datetime import datetime, timezone
from backend.measurement import request_context

for value, expected in [('board-v2','board-v2'),('board-v3-short','board-v3-short'),(None,'legacy'),('','legacy'),('board-v3-short ','legacy'),('BOARD-V3-SHORT','legacy'),('person@example.com','legacy'),('a'*10000,'legacy')]:
    h={} if value is None else {'x-proplet-onboarding':value}
    assert request_context(SimpleNamespace(headers=h),'production')['onboarding_version']==expected

from fastapi.testclient import TestClient
import server
rows=[]
def database(method, table, **kwargs):
    assert method=='POST' and table=='product_events', (method,table)
    rows.append(deepcopy(kwargs['body']))
    return [rows[-1]]
def select(table, **filters):
    return [deepcopy(r) for r in rows if r.get('anonymous_id')==filters.get('anonymous_id')] if table=='product_events' else []
def update(table, filters, values):
    assert table=='product_events'
    assert values=={'player_id':'synthetic-account','anonymous_id':None}, 'claim must only change actor ownership'
    for r in rows:
        if r.get('anonymous_id')==filters['anonymous_id']:r.update(values)
    return rows
headers={'X-Proplet-Onboarding':'board-v3-short','X-Proplet-Analytics':'2','X-Proplet-Client-Release':'contract-fixture','X-Proplet-Test':'1','X-Proplet-Auth-At-Event':'anonymous','X-Proplet-Starter-Run':str(uuid4()),'X-Proplet-First-Steps-Run':str(uuid4()),'X-Proplet-Starter-Ms':'15','X-Proplet-Starter-Reason':'visibility','X-Proplet-Event-ID':str(uuid4()),'X-Proplet-Event-Time':datetime.now(timezone.utc).isoformat()}
with patch.object(server,'VERCEL_ENV','production'), patch.object(server,'enforce_rate_limit'), patch.object(server,'telemetry_actor',return_value={'anonymous_id':'synthetic-guest-identity'}), patch.object(server,'db_request',side_effect=database), patch.object(server,'db_select',side_effect=select), patch.object(server,'db_update',side_effect=update), patch.object(server,'auth_player',return_value={'id':'synthetic-account'}), patch.object(server,'anonymous_hash',return_value='synthetic-guest-identity'), patch.object(server,'play_session_config',return_value={'enabled':False}):
    client=TestClient(server.app)
    response=client.post('/api/product-event',headers=headers,json={'event_type':'starter_v1_interaction'})
    assert response.status_code==200,response.text
    assert len(rows)==1
    row=rows[0]
    assert row['onboarding_version']=='board-v3-short'
    assert row['environment']=='production' and row['is_test'] is True
    assert row['measurement_version']==2 and row['client_release']=='contract-fixture'
    assert row['context']=={'auth_at_event':'anonymous','starter_run_id':headers['X-Proplet-Starter-Run'],'starter_ms':15,'starter_reason':'visibility','reason':'visibility','first_steps_run_id':headers['X-Proplet-First-Steps-Run']}
    before=deepcopy(row)
    response=client.post('/api/anonymous/claim',headers={'X-Proplet-Onboarding':'board-v2','X-Proplet-Test':'1'},json={'anonymous_id':'synthetic-guest-identity'})
    assert response.status_code==200,response.text
    assert response.json()['claimed']['productEvents']==1
    assert row=={**before,'player_id':'synthetic-account','anonymous_id':None}, 'capture provenance survives actual claim handler'
    with patch.object(server,'VERCEL_ENV','preview'):
        response=client.post('/api/product-event',headers=headers,json={'event_type':'starter_v1_interaction'})
        assert response.status_code==200 and response.json()['ignored']
        assert len(rows)==1,'preview middleware must not write'
for environment in ['production','preview','local']:
    for test_headers in [{},{'x-proplet-test':'1'},{'x-proplet-preview-as-of':'2026-09-25'}]:
        p=request_context(SimpleNamespace(headers={'x-proplet-onboarding':'board-v3-short',**test_headers}),environment)
        assert p['environment']==environment and p['is_test']==bool(test_headers)
print('PASS onboarding allowlist, exact HTTP DB payload, capture provenance after claim, test/preview isolation')


for bad in ['not-a-uuid','x'*1000,'person@example.invalid']:
    p=request_context(SimpleNamespace(headers={'x-proplet-first-steps-run':bad,'x-proplet-creation-source':'first_steps_v1','x-proplet-first-steps-reason':bad}),'production')
    assert 'first_steps_run_id' not in p['_event_context'] and 'creation_source' not in p['_event_context']
print('PASS first-steps UUID validation and claim context preservation')
