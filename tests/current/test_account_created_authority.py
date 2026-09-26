"""Signup transport forwards only bounded server provenance, never browser PII."""
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import patch
import httpx

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from backend import db

calls=[]
def transport(request):
    calls.append(request)
    return httpx.Response(201,json=[])
with httpx.Client(transport=httpx.MockTransport(transport)) as client, \
     patch.object(db,'settings',SimpleNamespace(vercel_env='preview',app_version='4.02.2',supabase_url='https://database.invalid')):
    db.db_request('POST','players',body={'name':'private@example.invalid'},
        supabase_url='https://database.invalid',supabase_secret_key='synthetic',http_client=client)
    assert calls[0].headers['x-proplet-signup-environment']=='preview'
    assert calls[0].headers['x-proplet-signup-version']=='4.02.2'
    assert 'private@example.invalid' not in str(calls[0].headers)
print('PASS server-owned signup event and bounded server provenance')


from backend import measurement
from uuid import uuid4
run=str(uuid4())
ctx=measurement.request_context(SimpleNamespace(headers={'x-proplet-first-steps-run':run,'x-proplet-creation-source':'first_steps_v1','x-proplet-onboarding':'board-v3-short','x-proplet-test':'1'}),'production')
token=measurement.context.set(ctx)
try:
    with httpx.Client(transport=httpx.MockTransport(transport)) as client:
        db.db_request('POST','players',body={'name':'synthetic'},supabase_url='https://database.invalid',supabase_secret_key='synthetic',http_client=client)
    h=calls[-1].headers
    assert h['x-proplet-signup-run']==run and h['x-proplet-signup-source']=='first_steps_v1'
    assert h['x-proplet-signup-test']=='1' and h['x-proplet-signup-onboarding']=='board-v3-short'
finally:measurement.context.reset(token)
print('PASS validated HTTP context reaches atomic signup trigger headers')
