"""Capture-time diagnostics: bounded, immutable, no auth or PII authority."""
from types import SimpleNamespace
from backend.measurement import request_context, enrich, context
from backend.analytics import load_registry, EMBEDDED_EVENT_NAMES

def capture(headers):
    return request_context(SimpleNamespace(headers=headers),'preview')

safe={'x-proplet-starter-run':'b7c67e99-f7d9-458e-955b-d02b57d2215d','x-proplet-starter-ms':'1245','x-proplet-starter-reason':'data','x-proplet-auth-at-event':'anonymous'}
p=capture(safe)
assert p['_event_context']=={'starter_run_id':safe['x-proplet-starter-run'],'starter_ms':1245,'starter_reason':'data','reason':'data','auth_at_event':'anonymous'}
token=context.set(p)
try:
    # A claimed account's server identity must not rewrite the capture context.
    row=enrich('product_events',{'player_id':'later-claimed-account','event_type':'starter_v1_failed'})
    assert row['context']['auth_at_event']=='anonymous'
    assert row['player_id']=='later-claimed-account'
    assert row['environment']=='preview'
finally:context.reset(token)
assert capture({})['_event_context']=={}, 'old queued events must remain unknown'
experiment=capture({'x-proplet-experiment':'first-board-v1','x-proplet-experiment-variant':'challenger_e009','x-proplet-experiment-bucket':'58'})['_event_context']
assert experiment=={'experiment_key':'first-board-v1','experiment_variant':'challenger_e009','experiment_bucket':58}
for bad in [
    {'x-proplet-experiment':'other','x-proplet-experiment-variant':'challenger_e009','x-proplet-experiment-bucket':'58'},
    {'x-proplet-experiment':'first-board-v1','x-proplet-experiment-variant':'unknown','x-proplet-experiment-bucket':'58'},
    {'x-proplet-experiment':'first-board-v1','x-proplet-experiment-variant':'control_e001','x-proplet-experiment-bucket':'100'},
]: assert capture(bad)['_event_context']=={}
for bad in ['person@example.com','https://example.com/private','a'*10000,'-1','86400001']:
    assert capture({key:bad for key in safe})['_event_context']=={}
assert set(load_registry()['events'])==set(EMBEDDED_EVENT_NAMES)
assert len(EMBEDDED_EVENT_NAMES)==len(set(EMBEDDED_EVENT_NAMES))
print('PASS starter and experiment context: bounded values, unknown legacy auth, claim preservation, registry parity')

