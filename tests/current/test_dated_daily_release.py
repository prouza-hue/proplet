"""Real ASGI cutover and exact-ID history contracts; synthetic transport only."""
import os
import sys
from pathlib import Path
from datetime import datetime, date, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ['PROPLET_DATED_DAILY_ENABLED'] = 'true'
os.environ['PROPLET_ATOMIC_RESULT_V1_ENABLED'] = 'true'
import server
from backend import daily_runtime
from backend.dated_daily import DatedDaily, next_midnight
from fastapi.testclient import TestClient

TZ = ZoneInfo('Europe/Prague')
class Clock(datetime):
    instant = datetime(2026, 10, 7, 23, 59, tzinfo=TZ)
    @classmethod
    def now(cls, tz=None):
        return cls.instant.astimezone(tz) if tz else cls.instant.replace(tzinfo=None)

pack = DatedDaily.load(server.ROOT / 'data/daily_gen6_private.json')
with patch.object(server, 'datetime', Clock), patch.object(daily_runtime, 'datetime', Clock), patch.object(server, 'enforce_rate_limit', lambda *a, **k: None):
    client = TestClient(server.app)
    old_ids = server.valid_daily_puzzle_ids('2026-10-07')
    old_body = server.resolved_puzzle('g4-d-045', 'daily', 'medium')
    before = client.get('/api/daily')
    assert before.status_code == 200 and before.json()['puzzleId'] == 'g4-d-045'
    assert before.json()['puzzle'] == old_body
    assert client.get('/api/daily?daily_date=2026-10-08').status_code == 404
    Clock.instant = datetime(2026, 10, 8, 0, 0, tzinfo=TZ)
    row = client.get('/api/daily').json()
    assert row['puzzleId'] == 'g6-d-20261008' and row['challengeKey'] == 'daily:2026-10-08'
    assert server.valid_daily_puzzle_ids('2026-10-08') == {'g6-d-20261008'}
    assert not server.daily_puzzle_matches_date('g4-d-046', '2026-10-08')
    assert server.valid_daily_puzzle_ids('2026-10-07') == old_ids
    assert client.get('/api/daily?daily_date=2026-10-07&puzzle_id=g4-d-045').json()['puzzle'] == old_body
    assert client.get('/api/daily?daily_date=2026-10-08&puzzle_id=g4-d-046').status_code == 404
    assert server.puzzle_info('g6-d-20261008')['generation'] == 6
    for query in ('list=1', 'as_of=2027-01-14', 'daily_date=2026-10-09', 'daily_date=bad'):
        assert client.get('/api/daily?' + query).status_code in (400, 404)
    for path in ('/data/daily_gen6_private.json', '/candidate-daily-gen6/bank.json', '/release-evidence/release-bank.json'):
        assert client.get(path).status_code == 404
    for i in range(99):
        day = date(2026, 10, 8) + timedelta(days=i)
        Clock.instant = datetime.combine(day, datetime.min.time(), TZ)
        r = client.get('/api/daily')
        assert r.status_code == 200 and r.json()['puzzleId'] == 'g6-d-' + day.strftime('%Y%m%d')
        assert 'no-store' in r.headers['cache-control']
        assert len(server.valid_daily_puzzle_ids(day.isoformat())) == 1
        assert client.get('/api/daily?daily_date=' + (day + timedelta(days=1)).isoformat()).status_code == 404
    Clock.instant = datetime(2027, 1, 15, tzinfo=TZ)
    assert client.get('/api/daily').status_code == 404
    assert server.valid_daily_puzzle_ids('2027-01-15') == set()
    assert client.get('/api/daily?daily_date=2027-01-14').status_code == 200

fall = datetime(2026, 10, 25, tzinfo=TZ)
assert (next_midnight(fall).timestamp() - fall.timestamp()) == 25 * 3600
print('PASS: 99 real ASGI date bindings, midnight/DST/end, preserved history, future/private rejection')
