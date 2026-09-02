#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import sys
from unittest.mock import patch

import httpx
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import server  # noqa: E402
from backend import analytics as product_analytics  # noqa: E402
from backend import db as backend_db  # noqa: E402


class Response:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload
        self.content = b"[]" if payload is not None else b""

    def json(self):
        return self._payload


class FlakyReadClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def request(self, *_args, **_kwargs):
        self.calls += 1
        next_value = self.responses.pop(0)
        if isinstance(next_value, Exception):
            raise next_value
        return next_value


def test_idempotent_supabase_reads_retry_once():
    transport_error = httpx.ConnectError("dropped read connection")
    client = FlakyReadClient([transport_error, Response(200, [{"id": "ok"}])])
    rows = backend_db.db_request(
        "GET",
        "results",
        supabase_url="https://example.supabase.co",
        supabase_secret_key="secret",
        http_client=client,
    )
    assert rows == [{"id": "ok"}]
    assert client.calls == 2

    status_client = FlakyReadClient([Response(503, {"message": "temporary"}), Response(200, [])])
    assert backend_db.db_request(
        "GET",
        "results",
        supabase_url="https://example.supabase.co",
        supabase_secret_key="secret",
        http_client=status_client,
    ) == []
    assert status_client.calls == 2

    write_client = FlakyReadClient([httpx.ConnectError("write connection lost")])
    try:
        backend_db.db_request(
            "POST",
            "product_events",
            body={"event_type": "app_open"},
            supabase_url="https://example.supabase.co",
            supabase_secret_key="secret",
            http_client=write_client,
        )
    except HTTPException as exc:
        assert exc.status_code == 503
    else:
        raise AssertionError("Writes must not be retried after an ambiguous transport failure")
    assert write_client.calls == 1


def test_product_event_smoke_works_without_public_registry_bundle():
    inserted = []
    product_analytics.load_registry.cache_clear()
    product_analytics.allowed_event_names.cache_clear()
    with (
        patch.object(product_analytics, "REGISTRY_PATH", ROOT / "public" / "missing-registry.json"),
        patch.object(server, "enforce_rate_limit", lambda *_a, **_k: None),
        patch.object(server, "telemetry_actor", return_value={"player_id": None, "anonymous_id": "anon"}),
        patch.object(server, "client_app_version", return_value="4.02.1"),
        patch.object(server, "db_insert", side_effect=lambda table, row: inserted.append((table, row)) or row),
    ):
        assert server.product_event(server.ProductEventCreate(event_type="app_open"), object()) == {"ok": True}
    product_analytics.load_registry.cache_clear()
    product_analytics.allowed_event_names.cache_clear()
    assert inserted[0][0] == "product_events"
    assert inserted[0][1]["event_type"] == "app_open"


def test_progress_endpoint_smoke_returns_completed_rows():
    result = {
        "puzzle_id": "g4-e-001",
        "challenge_key": "free:g4-e-001",
        "mode": "free",
        "difficulty": "easy",
        "best_elapsed_ms": 1234,
        "best_moves": 9,
        "points": 15,
        "completed_at": "2026-09-02T08:00:00Z",
    }
    with (
        patch.object(server, "enforce_rate_limit", lambda *_a, **_k: None),
        patch.object(server, "auth_player", return_value={"id": "player-1"}),
        patch.object(server, "db_select", return_value=[result]),
        patch.object(server, "free_puzzle_info", return_value={"level": 1, "generation": 4, "legacy": False}),
    ):
        payload = server.progress(object(), authorization="Bearer test")
    assert payload["completed"][0]["challengeKey"] == "free:g4-e-001"
    assert payload["completed"][0]["level"] == 1


if __name__ == "__main__":
    test_idempotent_supabase_reads_retry_once()
    test_product_event_smoke_works_without_public_registry_bundle()
    test_progress_endpoint_smoke_returns_completed_rows()
    print("PASS: runtime resilience for product-event, progress and Supabase reads")
