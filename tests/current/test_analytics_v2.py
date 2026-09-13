from datetime import datetime, timedelta
from unittest.mock import patch
from types import SimpleNamespace
from fastapi.testclient import TestClient
from backend.launch_report import build_launch_report, TZ
from backend.measurement import pages, request_context, enrich, context
import server

NOW=datetime(2026,9,13,12,tzinfo=TZ)
def actor(key, day, skip=False):
    start=NOW.replace(day=day,hour=9)
    events={'app_open':[start.isoformat()],'onboarding_started':[start.isoformat()]}
    names=['onboarding_skipped_known_player'] if skip else ['starter_started','starter_word_1_completed','starter_word_2_completed','starter_word_3_completed','starter_completed','onboarding_completed']
    for i,name in enumerate(names,1):events[name]=[(start+timedelta(seconds=i)).isoformat()]
    attempt={'started_at':(start+timedelta(minutes=2)).isoformat(),'completed_at':(start+timedelta(minutes=3)).isoformat(),'last_activity_at':None,'mode':'free','difficulty':'easy','app_version':'4.02.2'}
    return {'key':key,'first_seen':start.isoformat(),'onboarding':start.isoformat(),'events':events,'attempts':[attempt]}

a=actor('trained',5);a['events']['app_open'].append(NOW.replace(day=12,hour=9).isoformat())
b=actor('skip',6,True);b['events']['app_open'].append(NOW.replace(day=7,hour=9).isoformat())
c=actor('returning',10);c['first_seen']=NOW.replace(month=8,day=1).isoformat()
d=actor('pending',12)
data={'actors':[a,b,c,d],'reliability':{'available':True,'errors7d':53,'rateLimits7d':10698,'lastSnapshot':'2026-08-31T07:00:00Z'}}
report=build_launch_report(data,NOW);w=report['windows']['30d']
assert w['newcomers']==3
assert w['firstRealGameCompleted']==3, 'Skipping training must not prevent activation'
assert w['starter']['completed']==2
assert w['branches']['skippedActivated']==1
assert w['retentionD7']=={'eligible':1,'retained':1,'rate':1.0,'closedDaysOnly':True}
assert w['retentionD1']['eligible']==2, 'Today is not a closed return day'
assert w['retentionD1']['retained']==1
assert w['playingD7']['retained']==0, 'An app open is not a game'
assert report['reliability']['rateLimits7d']==10698
assert report['reliability']['snapshotStale']
# An event emitted before the previous step is not a completed ordered funnel.
bad=actor('out-of-order',5);bad['events']['starter_word_2_completed']=[NOW.replace(day=5,hour=8).isoformat()]
assert build_launch_report({**data,'actors':[bad]},NOW)['windows']['30d']['starter']['completed']==0

rows=[{'id':f'{i:06}'} for i in range(53222)]
def request(method,table,params):
    start=int(params['id'][3:])+1 if 'id' in params else 0
    return rows[start:start+1000]
assert len(pages(request,'events',filters={'created_at':'lte.fixed-cutoff'}))==53222

# Event retries preserve the supplied id and capture only server-owned provenance.
received={}
def insert(method,table,body,prefer):
    received.setdefault(body['id'],body)
    return [received[body['id']]]
req=SimpleNamespace(headers={'x-proplet-event-id':'af96a622-e647-4702-b4f4-f30a780cf518','x-proplet-event-time':NOW.isoformat(),'x-proplet-analytics':'2','x-proplet-onboarding':'board-v2'})
token=context.set(request_context(req,'production'))
with patch.object(server,'enforce_rate_limit'),patch.object(server,'telemetry_actor',return_value={'anonymous_id':'fixture'}),patch.object(server,'client_app_version',return_value='4.02.2'),patch.object(server,'db_request',side_effect=insert):
    for _ in range(2):server.product_event(server.ProductEventCreate(event_type='app_open'),req)
context.reset(token)
assert len(received)==1
assert next(iter(received.values()))['environment']=='production'

with patch.object(server,'VERCEL_ENV','preview'),patch.object(server,'db_insert',side_effect=AssertionError('Preview must not write analytics')):
    with TestClient(server.app) as client:
        assert client.post('/api/product-event',json={'event_type':'app_open'}).json()['ignored']
        assert client.post('/api/result',json={}).status_code==409
print('PASS analytics v2: ordered onboarding, skip activation, closed D1/D7, 53k pages, idempotency, preview isolation')
