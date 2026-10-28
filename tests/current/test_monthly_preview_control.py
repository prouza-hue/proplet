"""QA controller cannot cross preview/database/auth boundaries or forward its secret."""
import os
import sys
from pathlib import Path
from unittest.mock import patch, Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import httpx
from fastapi.testclient import TestClient
from backend.config import load_settings
from backend import db
import server

client = TestClient(server.app)
env = {"VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/monthly-competition-202611",
       "SUPABASE_URL": "https://eanzztstmwlamwfdskbf.supabase.co", "PROPLET_MONTHLY_QA_ENABLED": "true",
       "PROPLET_MONTHLY_QA_SECRET": "isolated-controller-test-secret-12345678"}
with patch.object(server, "monthly_qa_enabled", return_value=False), patch.object(server, "db_rpc", side_effect=AssertionError("disabled control DB access")):
    assert client.post("/api/qa/monthly-control", json={"action": "status"}).status_code == 404
with patch.dict(os.environ, env):
    assert load_settings().supabase_url == env["SUPABASE_URL"]
    assert load_settings().tajenka_release_enabled, "isolated monthly QA must verify genuine non-scoring Tajenka"
    for change in ({"VERCEL_ENV": "production"}, {"VERCEL_GIT_COMMIT_REF": "codex/today-one-screen"},
                   {"SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co"}, {"PROPLET_MONTHLY_QA_SECRET": ""}):
        with patch.dict(os.environ, change):
            try:
                load_settings()
            except RuntimeError:
                pass
            else:
                raise AssertionError("QA configuration accepted unsafe target")
    with patch.object(server, "monthly_qa_enabled", return_value=True), patch.object(server, "db_rpc", return_value={"qaNow": "2026-11-01T12:00:00Z"}) as rpc:
        for auth in ({}, {"Authorization": "Bearer wrong"}):
            assert client.post("/api/qa/monthly-control", json={"action": "status"}, headers=auth).status_code == 403
        rpc.assert_not_called()
        headers = {"Authorization": "Bearer " + env["PROPLET_MONTHLY_QA_SECRET"]}
        for payload in ({"action": "clock"}, {"action": "clock", "now": "2026-11-01T12:00:00"},
                        {"action": "clock", "now": "2030-01-01T12:00:00Z"}, {"action": "reset"},
                        {"action": "finalize", "points": 2400}):
            assert client.post("/api/qa/monthly-control", json=payload, headers=headers).status_code == 422
        rpc.assert_not_called()
        response = client.post("/api/qa/monthly-control", json={"action": "clock", "now": "2026-11-01T00:00:00+01:00"}, headers=headers)
        assert response.status_code == 200 and response.json()["isolated"] is True
        assert response.headers["cache-control"] == "no-store"
        assert env["PROPLET_MONTHLY_QA_SECRET"] not in response.text
        assert rpc.call_args.args[0] == "proplet_monthly_preview_control_v1"
    seen = []
    transport = httpx.MockTransport(lambda request: (seen.append(request) or httpx.Response(200, json={})))
    with httpx.Client(transport=transport) as http:
        for url, expected in ((env["SUPABASE_URL"], True), ("https://iopyhluayfszskyqqpuc.supabase.co", False)):
            db.db_request("GET", "players", supabase_url=url, supabase_secret_key="fake-service-key", http_client=http)
            assert ("x-proplet-monthly-preview" in seen[-1].headers) is expected
            assert env["PROPLET_MONTHLY_QA_SECRET"] not in str(seen[-1].headers)
    with patch.object(server, "monthly_qa_enabled", return_value=True), patch.object(server, "db_rpc", return_value="2026-11-02T12:00:00Z") as rpc:
        token = server.request_guard_context.set({})
        try:
            assert server.current_prague_date().isoformat() == "2026-11-02"
            assert server.current_prague_datetime().day == 2
            assert rpc.call_count == 1
            assert server.payload_completed_at("2026-11-01T10:00:00Z").startswith("2026-11-01"), "offline completion must not become sync day"
        finally:
            server.request_guard_context.reset(token)
print("PASS isolated QA: startup scope, auth, bounded clock, no arbitrary actions, trusted marker, private secret, request-local clock, original offline timestamp")
