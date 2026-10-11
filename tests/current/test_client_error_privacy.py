"""Exercise production endpoint/writer bodies with a fake DB and no network."""
from __future__ import annotations
import ast
import re
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

source = ast.parse((Path(__file__).resolve().parents[2] / 'server.py').read_text(encoding='utf-8'))
functions = {node.name: node for node in source.body if isinstance(node, ast.FunctionDef)}
stored = []

class HTTPException(Exception):
    pass

ns = dict(re=re, uuid=uuid, datetime=datetime, TZ=timezone.utc, APP_VERSION='synthetic', VERCEL_ENV='production',
          measurement=SimpleNamespace(context=ContextVar('test-measurement',default=None),request_context=lambda *args: {'client_release':'legacy','is_test':False}),
          urlsplit=urlsplit, HTTPException=HTTPException,
          Header=lambda default=None, **kwargs: default,
          enforce_rate_limit=lambda *args, **kwargs: None,
          telemetry_actor=lambda *args: {'anonymous_id': 'synthetic-hash'},
          db_insert=lambda table, row: stored.append((table, row)))
for name in ['sanitized_operational_route', 'record_operational_event', 'client_app_version', 'client_error']:
    if name not in functions:
        continue  # Before the fix, characterize the real unsanitized endpoint.
    node = functions[name]
    node.decorator_list = []
    exec(compile(ast.Module([node], []), '<production diagnostic>', 'exec'), ns)

request = SimpleNamespace(headers={},state=SimpleNamespace(request_id='synthetic-request'),
                          url=SimpleNamespace(path='/api/client-error'))
cases = [
    ('/?utm_source=instagram&fbclid=click-secret#access_token=oauth-secret', '/'),
    ('/privacy.html?auth=google&challenge=challenge-secret', '/privacy.html'),
    ('https://hrajproplet.cz/index.html?code=oauth-secret#access_token=oauth-secret', '/index.html'),
    ('https://[invalid]/?fbclid=click-secret', '/api/client-error'),
    ('javascript:oauth-secret', '/api/client-error'),
    (None, '/api/client-error'),
]
for route, expected in cases:
    stored.clear()
    result = ns['client_error'](SimpleNamespace(code='puzzle_boot_failed', message='both-attempts-failed', route=route), request)
    assert result == {'ok': True}
    assert len(stored) == 1 and stored[0][0] == 'operational_events'
    row = stored[0][1]
    assert row['route'] == expected, f'Diagnostic route must be pathname: {row["route"]!r}'
    assert row['code'] == 'puzzle_boot_failed' and row['actor_kind'] == 'anonymous'
    assert row['metadata'] == {'message': 'both-attempts-failed', 'client_provenance':'unreported','server_version':'synthetic'}
    assert row['app_version']=='legacy-unknown','unknown clients must not inherit the server version'
    for secret in ['click-secret', 'challenge-secret', 'oauth-secret', 'fbclid', 'access_token']:
        assert secret not in str(row), f'URL secret reached diagnostic storage: {secret}'

# The writer is a second boundary for older clients and other diagnostic callers.
stored.clear()
ns['record_operational_event']('client_error', route='/?fbclid=click-secret#access_token=oauth-secret')
assert stored[0][1]['route'] == '/'
print('PASS endpoint and operational writer strip query/fragment/host without losing diagnostic codes')
