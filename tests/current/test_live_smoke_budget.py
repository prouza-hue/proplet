"""Smoke budgeting is verified with injected responses, never a live request."""
import io
import json
import runpy
from pathlib import Path

api = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'tools/check_live_release.py'))
urls = api['plan']('https://hrajproplet.cz', True, True)
assert len(urls) == 4
assert len(api['plan']('https://hrajproplet.cz', True, week='2026-10-26')) == 4
try:
    api['plan']('https://hrajproplet.cz', True, True, '2026-10-26')
except ValueError:
    pass
else:
    raise AssertionError('Expanded live-smoke plan exceeded its request budget')
calls = []
def opener(request, timeout):
    calls.append(request)
    assert request.method == 'GET' and not request.data
    assert not any(k.lower() in {'authorization', 'cookie', 'apikey'} for k in request.headers)
    return io.BytesIO(json.dumps({'ok': True, 'database': True, 'enabled': True, 'version': '99.1.0'}).encode())
api['run'](urls, '99.1.0', opener)
assert len(calls) == 4
for bad in ['https://hrajproplet.cz/api/admin', 'https://user:password@hrajproplet.cz', 'https://hrajproplet.cz?token=secret', 'https://example.com', 'http://hrajproplet.cz']:
    try:
        api['plan'](bad)
    except ValueError:
        pass
    else:
        raise AssertionError(bad)
try:
    api['run'](urls + urls, opener=opener)
except ValueError:
    pass
else:
    raise AssertionError('Unbounded request batch allowed')
assert len(calls) == 4
print('PASS bounded live smoke: GET-only, no credentials, exact origin and request budget')
