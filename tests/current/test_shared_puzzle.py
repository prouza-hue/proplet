"""Exact released-board lookup rejects future and mismatched invitations."""
import json
import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import server
from fastapi.testclient import TestClient

with patch.object(server, 'current_prague_date', return_value=date(2026, 9, 12)), patch.object(server, 'TAJENKA_RELEASE_ENABLED', True), patch.object(server, 'enforce_rate_limit'):
    client = TestClient(server.app)
    selected = '2026-09-10'
    puzzle_id = server.expected_daily_puzzle_id(selected)
    response = client.get('/api/shared-puzzle', params={'kind':'daily','daily_date':selected,'puzzle_id':puzzle_id})
    assert response.status_code == 200, response.text
    assert response.json()['puzzle']['id'] == puzzle_id
    assert 'no-store' in response.headers['cache-control']
    for day, ident, status in [('2026-09-13',puzzle_id,404),('broken',puzzle_id,400),(selected,'missing-board',404)]:
        assert client.get('/api/shared-puzzle',params={'kind':'daily','daily_date':day,'puzzle_id':ident}).status_code == status
    old = server.tajenka_puzzle_for_week(1)
    future = server.tajenka_puzzle_for_week(4)
    response = client.get('/api/shared-puzzle',params={'kind':'tajenka','puzzle_id':old['id']})
    assert response.status_code == 200 and response.json()['puzzle']['id'] == old['id']
    assert client.get('/api/shared-puzzle',params={'kind':'tajenka','puzzle_id':future['id']}).status_code == 404
    assert client.get('/api/shared-puzzle',params={'kind':'other','puzzle_id':old['id']}).status_code == 422
print('PASS: exact historical Daily/Tajenka and future/unavailable/malformed invitation handling')
