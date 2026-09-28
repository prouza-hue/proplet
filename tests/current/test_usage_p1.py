"""P1 usage controls batch writes and cache/read amplification."""
from pathlib import Path
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from fastapi.testclient import TestClient

from backend import db as backend_db
import server


captured = []


def requester(method, table, *, params=None, **_kwargs):
    captured.append((method, table, params))
    return []


backend_db.db_select("results", requester, columns="id,points", player_id="player")
assert captured == [("GET", "results", {"select": "id,points", "player_id": "eq.player", "order": "id.asc", "limit": "1000"})]


server._ranking_xp_aggregate_rows.cache_clear()
ranking_calls = []
with patch.object(server, "db_rpc", side_effect=lambda name, body: ranking_calls.append((name, body)) or [
    {"row_kind": "player", "entity_id": "p1", "period_xp": 10, "lifetime_xp": 20, "badge_count": 1}
]), patch.object(server.time, "time", return_value=90.0):
    first = server._ranking_xp_aggregates(None)
    second = server._ranking_xp_aggregates(None)
assert first == second == ({"p1": 10}, {"p1": 20}, {"p1": 1}, {})
assert len(ranking_calls) == 1


actor = {"player": None, "player_id": None, "anonymous_id": "hashed", "actor_key": "a:hashed"}
batch_writes = []
event_time = datetime.now(timezone.utc).isoformat()
with patch.object(server, "enforce_rate_limit"), \
     patch.object(server, "telemetry_actor", return_value=actor), \
     patch.object(server, "db_request", side_effect=lambda *args, **kwargs: batch_writes.append((args, kwargs)) or []):
    response = TestClient(server.app).post(
        "/api/product-events",
        json={"events": [
            {"id": "00000000-0000-4000-8000-000000000001", "event_type": "app_open", "created_at": event_time},
            {"id": "00000000-0000-4000-8000-000000000002", "event_type": "app_session_started", "created_at": event_time},
        ]},
        headers={"X-Proplet-Anon-ID": "00000000-0000-4000-8000-000000000099"},
    )
assert response.status_code == 200, response.text
assert response.json()["accepted"] == 2
assert len(batch_writes) == 1
assert batch_writes[0][0] == ("POST", "product_events")
assert [row["id"] for row in batch_writes[0][1]["body"]] == [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
]
assert batch_writes[0][1]["prefer"] == "resolution=ignore-duplicates,return=minimal"


checkpoint_calls = []
with patch.object(server, "enforce_rate_limit"), \
     patch.object(server, "telemetry_actor", return_value=actor), \
     patch.object(server, "db_rpc", side_effect=lambda name, body: checkpoint_calls.append((name, body)) or True), \
     patch.object(server, "db_select", side_effect=AssertionError("checkpoint must not read first")), \
     patch.object(server, "db_update", side_effect=AssertionError("checkpoint must use RPC")):
    result = server.attempt_checkpoint(
        server.AttemptCheckpoint(attempt_id="00000000-0000-4000-8000-000000000003", event_type="correct", elapsed_ms=1234, found_words=1),
        SimpleNamespace(headers={}),
        x_proplet_anon_id="anonymous-installation-id",
    )
assert result == {"ok": True}
assert checkpoint_calls[0][0] == "proplet_attempt_checkpoint_v1"
assert checkpoint_calls[0][1]["p_anonymous_id"] == "hashed"


migration = (Path(__file__).resolve().parents[2] / "supabase/migrations/20260928233000_usage_p1_batch_checkpoint.sql").read_text(encoding="utf-8")
assert "security invoker" in migration
assert "player_id is null and anonymous_id = p_anonymous_id" in migration
assert "grant execute on function public.proplet_attempt_checkpoint_v1" in migration
assert "(foundWords-1)%5" in (Path(__file__).resolve().parents[2] / "public/app.js").read_text(encoding="utf-8")
print("PASS P1 aggregate cache, explicit projections, batch analytics and atomic checkpoint")
