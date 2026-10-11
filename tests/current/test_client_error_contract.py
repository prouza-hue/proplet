"""Real route, Pydantic and middleware provenance with an isolated DB writer."""
from pathlib import Path
import sys
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
import server

stored=[]
def db_request(method,table,**kwargs):
    assert method=='POST' and table=='operational_events'
    stored.append(kwargs['body'])
    return [kwargs['body']]

release='proplet-v4.05.4-clienterrors2'
body={'code':'verification_diagnostic_contract','message':'synthetic','route':'/?code=secret#access_token=secret',
      'client_release':release,'client_version':'4.05.4','is_test':True,
      'source_file':'/app.js','source_line':123,'source_column':7}
with patch.object(server,'VERCEL_ENV','production'),patch.object(server,'db_request',side_effect=db_request), \
     patch.object(server,'enforce_rate_limit'),patch.object(server,'telemetry_actor',return_value={'anonymous_id':'synthetic'}):
    with TestClient(server.app) as client:
        for headers,expected in [({'X-Proplet-Client-Release':release,'X-Proplet-Analytics':'2','X-Proplet-Test':'1'},'header'),({},'body')]:
            stored.clear();res=client.post('/api/client-error',json=body,headers=headers)
            assert res.status_code==200 and len(stored)==1
            r=stored[0]
            assert r['client_release']==release and r['app_version']=='4.05.4' and r['is_test'] is True
            assert r['environment']=='production' and r['measurement_version']==2 and r['route']=='/'
            assert r['metadata']['client_provenance']==expected and r['metadata']['source_file']=='/app.js'
            assert r['metadata']['source_line']==123 and r['metadata']['source_column']==7
            assert 'secret' not in str(r)
        stored.clear();res=client.post('/api/client-error',json={'code':'window_error','message':'old client','route':'/'})
        assert res.status_code==200 and stored[0]['client_release']=='legacy'
        assert stored[0]['app_version']=='legacy-unknown' and stored[0]['metadata']['client_provenance']=='unreported'
        stored.clear();client.post('/api/client-error',json=body,headers={'X-Proplet-Client-Release':'proplet-v4.05.3-firstgame-telemetry1','X-Proplet-Test':'1'})
        assert stored[0]['client_release']=='proplet-v4.05.3-firstgame-telemetry1'
        assert stored[0]['metadata']['client_provenance_conflict'] is True
        for field,value in [('source_file','/app.js?access_token=secret'),('source_file','https://evil.test/app.js'),('source_line',0),('source_column',1000001)]:
            stored.clear();res=client.post('/api/client-error',json={**body,field:value})
            assert res.status_code==422 and not stored
print('PASS route/model/middleware: header and body provenance, test exclusion, safe source coordinates and explicit unknown cached client')
