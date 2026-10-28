"""Monthly HTTP activation, identity and environment boundary; no remote I/O."""
import os
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi.testclient import TestClient
from backend.config import load_settings
import server

client = TestClient(server.app)
with patch.dict(os.environ, {"PROPLET_MONTHLY_ENABLED": "false"}), patch.object(server, "db_rpc", side_effect=AssertionError("disabled DB access")):
    response = client.get("/api/competition/monthly?month=2026-11")
    assert response.status_code == 200 and response.json()["enabled"] is False
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/api/cron/monthly-competition").status_code == 404
assert client.get("/api/competition/monthly?month=2026-13").status_code == 422
with patch.object(server, "VERCEL_ENV", "production"):
    assert client.get("/api/competition/monthly?scenario=over20").status_code == 404
with patch.object(server, "VERCEL_ENV", "preview"), \
     patch.object(server, "VERCEL_GIT_COMMIT_REF", "codex/monthly-competition-202611"), \
     patch.object(server, "SUPABASE_URL", "https://eanzztstmwlamwfdskbf.supabase.co"), \
     patch.object(server, "db_rpc", side_effect=AssertionError("scenario DB access")):
    response = client.get("/api/competition/monthly?scenario=over20")
    assert response.status_code == 200
    assert response.json()["isolatedScenario"] == "over20" and response.json()["onlineBackend"] is False
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/api/competition/monthly?scenario=unknown").status_code == 422

preview = {"VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/monthly-competition-202611",
           "SUPABASE_URL": "https://eanzztstmwlamwfdskbf.supabase.co", "SUPABASE_SECRET_KEY": "inherited-production",
           "PROPLET_MONTHLY_TEST_KEY": "isolated-only"}
with patch.dict(os.environ, preview):
    assert load_settings().supabase_secret_key == "isolated-only"
    with patch.dict(os.environ, {"PROPLET_MONTHLY_TEST_KEY": ""}):
        assert load_settings().supabase_secret_key == ""
    with patch.dict(os.environ, {"SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co"}):
        try:
            load_settings()
        except RuntimeError:
            pass
        else:
            raise AssertionError("monthly preview accepted production database")

viewer = {"id": "00000000-0000-4000-8000-000000000001"}
with patch.object(server, "monthly_competition_available", return_value=True), \
     patch.object(server, "enforce_rate_limit"), \
     patch.object(server, "_ranking_viewer", return_value=viewer), \
     patch.object(server.monthly_competition, "state", return_value={"enabled": True, "status": "open"}) as state:
    response = client.get("/api/competition/monthly?month=2026-11")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert state.call_args.kwargs["month"] == "2026-11-01"
    assert state.call_args.kwargs["player_id"] == viewer["id"]
    with patch.object(server, "CRON_SECRET", "isolated-cron"), patch.object(server.monthly_competition, "finalize", return_value={"finalized": 0}) as finalize:
        assert client.get("/api/cron/monthly-competition").status_code == 403
        finalize.assert_not_called()
        assert client.get("/api/cron/monthly-competition", headers={"Authorization": "Bearer isolated-cron"}).json() == {"finalized": 0}
        finalize.assert_called_once()
print("PASS monthly HTTP: disabled no I/O, month validation, no-store, authenticated viewer, cron auth, preview credential isolation")
