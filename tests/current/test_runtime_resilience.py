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


def test_supabase_read_jwt_timing_retry_is_specific_and_bounded():
    def request(client, method="GET"):
        return backend_db.db_request(
            method,
            "result_commands",
            supabase_url="https://example.supabase.co",
            supabase_secret_key="sb_secret_synthetic",
            http_client=client,
        )

    for code in ("PGRST301", "PGRST303"):
        timing_error = {"code": code, "message": "JWT issued at future"}
        client = FlakyReadClient([
            Response(401, timing_error),
            Response(200, [{"id": "synthetic-receipt"}]),
        ])
        with patch.object(backend_db.time, "sleep") as pause:
            assert request(client) == [{"id": "synthetic-receipt"}]
        assert client.calls == 2
        pause.assert_called_once_with(1.0)

        persistent = FlakyReadClient([
            Response(401, timing_error),
            Response(401, timing_error),
        ])
        with patch.object(backend_db.time, "sleep") as pause:
            try:
                request(persistent)
            except HTTPException as exc:
                assert exc.status_code == 400
            else:
                raise AssertionError("Persistent provider auth failures must remain failures")
        assert persistent.calls == 2
        pause.assert_called_once_with(1.0)

    unrelated_errors = (
        {"code": "PGRST301", "message": "JWT expired"},
        {"code": "PGRST303", "message": "JWT expired"},
        {"code": "OTHER", "message": "JWT issued at future"},
        {"message": "JWT issued at future"},
        {"code": [], "message": "JWT issued at future"},
        {"code": {}, "message": "JWT issued at future"},
        ["JWT issued at future"],
        None,
    )
    for payload in unrelated_errors:
        client = FlakyReadClient([Response(401, payload)])
        with patch.object(backend_db.time, "sleep") as pause:
            try:
                request(client)
            except HTTPException as exc:
                assert exc.status_code == 400
            else:
                raise AssertionError("Unrelated auth failures must not be retried")
        assert client.calls == 1
        pause.assert_not_called()

    invalid_json = Response(401, None)
    client = FlakyReadClient([invalid_json])
    with (
        patch.object(invalid_json, "json", side_effect=ValueError("invalid provider JSON")),
        patch.object(backend_db.time, "sleep") as pause,
    ):
        try:
            request(client)
        except HTTPException as exc:
            assert exc.status_code == 400
        else:
            raise AssertionError("Malformed provider JSON must remain an auth failure")
    assert client.calls == 1
    pause.assert_not_called()

    for method in ("POST", "PATCH", "DELETE"):
        client = FlakyReadClient([
            Response(401, {"code": "PGRST303", "message": "JWT issued at future"}),
        ])
        with patch.object(backend_db.time, "sleep") as pause:
            try:
                request(client, method)
            except HTTPException as exc:
                assert exc.status_code == 400
            else:
                raise AssertionError("Writes must not use the read JWT retry")
        assert client.calls == 1
        pause.assert_not_called()

    status_client = FlakyReadClient([
        Response(501, {"message": "temporary"}),
        Response(200, []),
    ])
    with patch.object(backend_db.time, "sleep") as pause:
        assert request(status_client) == []
    assert status_client.calls == 2
    pause.assert_not_called()


def test_supabase_read_retry_budget_is_shared_across_failure_kinds():
    timing_error = {"code": "PGRST303", "message": "JWT issued at future"}
    cases = (
        ([httpx.ConnectError("dropped read connection"), Response(401, timing_error)], 400),
        ([httpx.ConnectError("dropped read connection"), Response(503, {"message": "temporary"})], 503),
        ([Response(503, {"message": "temporary"}), Response(401, timing_error)], 400),
        ([Response(401, timing_error), Response(501, {"message": "temporary"})], 503),
    )
    for responses, expected_status in cases:
        client = FlakyReadClient(responses)
        with patch.object(backend_db.time, "sleep") as pause:
            try:
                backend_db.db_request(
                    "GET",
                    "result_commands",
                    supabase_url="https://example.supabase.co",
                    supabase_secret_key="sb_secret_synthetic",
                    http_client=client,
                )
            except HTTPException as exc:
                assert exc.status_code == expected_status
            else:
                raise AssertionError("A second failed attempt must not create a third request")
        assert client.calls == 2
        if isinstance(responses[0], Response) and responses[0].status_code == 401:
            pause.assert_called_once_with(1.0)
        else:
            pause.assert_not_called()


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
        assert server.product_event(server.ProductEventCreate(event_type="app_open"), __import__("types").SimpleNamespace(headers={})) == {"ok": True}
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
        payload = server.progress(__import__("types").SimpleNamespace(headers={}), authorization="Bearer test")
    assert payload["completed"][0]["challengeKey"] == "free:g4-e-001"
    assert payload["completed"][0]["level"] == 1


if __name__ == "__main__":
    test_idempotent_supabase_reads_retry_once()
    test_supabase_read_jwt_timing_retry_is_specific_and_bounded()
    test_supabase_read_retry_budget_is_shared_across_failure_kinds()
    test_product_event_smoke_works_without_public_registry_bundle()
    test_progress_endpoint_smoke_returns_completed_rows()
    print("PASS: runtime resilience for product-event, progress and Supabase reads")
