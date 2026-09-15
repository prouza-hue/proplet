#!/usr/bin/env python3
"""Regression test for the branch-scoped, read-only Generation 4 preview."""
from __future__ import annotations

import os
import asyncio
import json
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["VERCEL_ENV"] = "preview"
os.environ["VERCEL_GIT_COMMIT_REF"] = "agent/v3340-medium-calibration-v3"

from fastapi.testclient import TestClient
from starlette.requests import Request
import server


async def verify_write_boundary() -> None:
    # These telemetry calls intentionally succeed without invoking the endpoint.
    # A 200 alone is not evidence of a write: require the explicit ignored receipt
    # AND prove that no downstream handler was called.
    ignored_posts = (
        "/api/product-event", "/api/attempt/start", "/api/attempt/checkpoint",
        "/api/attempt/finish", "/api/hint-event", "/api/helper-event",
        "/api/feedback", "/api/anonymous/claim",
    )
    protected_paths = (
        "/api/result", "/api/login", "/api/player", "/api/auth/google/complete",
        "/api/account/email/start", "/api/auth/recovery/start",
        "/api/account-bonus/claim", "/api/future-write-endpoint",
    )
    downstream = AsyncMock(side_effect=AssertionError("preview write reached a handler"))
    for method in ("POST", "PUT", "PATCH", "DELETE"):
        for path in (*ignored_posts, *protected_paths):
            request = Request({"type": "http", "method": method, "path": path,
                               "headers": [], "query_string": b""})
            response = await server.launch_safety_middleware(request, downstream)
            body = json.loads(response.body)
            if method == "POST" and path in ignored_posts:
                assert response.status_code == 200, (method, path)
                assert body == {"ok": True, "ignored": True, "preview": True}
            else:
                assert response.status_code == 409, (method, path, body)
                assert body.get("detail"), (method, path)
                if not (method == "POST" and path == "/api/result"):
                    assert "pouze pro čtení" in body["detail"]
                    assert response.headers["cache-control"] == "no-store"
    downstream.assert_not_called()


def main() -> None:
    assert server.GEN4_CANDIDATE_PREVIEW is True
    assert server.PUZZLES_PATH.name == "puzzles_gen4_candidate_v334.json"
    assert server.ROLLING_CONTENT_PATH.name == "rolling_content_gen4_candidate_v334.json"

    puzzles = server.load_puzzles()
    rolling = server.load_rolling_content()
    assert puzzles.get("contentGeneration") == 4
    assert (puzzles.get("release") or {}).get("status") == "candidate-paused"
    assert rolling.get("contentGeneration") == 4
    assert rolling.get("releaseEnabled") is False

    client = TestClient(server.app)
    database = client.get("/api/puzzle-database")
    assert database.status_code == 200
    assert database.headers.get("cache-control") == "no-store"
    assert database.json().get("contentGeneration") == 4

    asyncio.run(verify_write_boundary())

    # Exercise the assembled app too: its outer preview_auth_v334 middleware
    # deliberately exempts account QA from the inner generic write blocker.
    def synthetic_rate_limit(name, params):
        assert name == "proplet_rate_limit", name
        return {"allowed": True}

    with patch.object(server, "db_request", side_effect=AssertionError("unexpected database access")), \
         patch.object(server, "db_rpc", side_effect=synthetic_rate_limit):
        ignored = client.post("/api/product-event", json={"event_type": "preview_probe"})
        assert ignored.status_code == 200
        assert ignored.json() == {"ok": True, "ignored": True, "preview": True}
        blocked = client.post("/api/result", json={})
        assert blocked.status_code == 409
        for path in ("/api/login", "/api/player",
                     "/api/auth/google/complete", "/api/account/email/start",
                     "/api/auth/recovery/start", "/api/account-bonus/claim"):
            response = client.post(path, json={})
            assert response.status_code in (401, 422), (path, response.status_code, response.text)

    legacy_id = next(iter(puzzles.get("legacyFreeIndex") or {}))
    server.enforce_rate_limit = lambda *args, **kwargs: None
    archived = client.get("/api/free-archive", params={"puzzle_id": legacy_id})
    assert archived.status_code == 410
    assert archived.json().get("archived") is True
    print("Gen4 preview verified: candidate reads, telemetry ignored without handlers, "
          "gameplay writes blocked, canonical auth QA validation intact, legacy tombstone intact.")


if __name__ == "__main__":
    main()
