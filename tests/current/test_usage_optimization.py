"""HTTP request isolation and compact usage contracts."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, Request, HTTPException
from fastapi.testclient import TestClient
import server
from backend import rankings


class UsageOptimizationTests(unittest.TestCase):
    def app(self, twice=False):
        app = FastAPI()
        app.middleware("http")(server.launch_safety_middleware)
        @app.get("/api/synthetic")
        def endpoint(request: Request):
            server.enforce_rate_limit(request, "synthetic", limit=10, window_seconds=60)
            if twice:
                server.enforce_rate_limit(request, "synthetic-second", limit=10, window_seconds=60)
            return server.auth_player(request.headers.get("authorization"))
        return app

    def test_one_guard_per_request_and_revocation_is_immediate(self):
        calls = []
        revoked = False
        def rpc(name, body):
            calls.append((name, body))
            self.assertEqual(name, "proplet_request_guard_v1")
            return {"allowed": True, "auth": {"player": None if revoked else {"id": body["p_token_hash"]}, "expired": False}}
        with patch.object(server, "db_rpc", side_effect=rpc):
            client = TestClient(self.app())
            headers = {"Authorization": "Bearer synthetic"}
            self.assertEqual(client.get("/api/synthetic", headers=headers).status_code, 200)
            revoked = True
            self.assertEqual(client.get("/api/synthetic", headers=headers).status_code, 401)
        self.assertEqual(len(calls), 2)
        self.assertIsNone(server.request_guard_context.get())
        self.assertEqual(calls[0][1]["p_token_hash"], hashlib.sha256(b"synthetic").hexdigest())

    def test_concurrent_requests_cannot_exchange_identity(self):
        def rpc(name, body):
            return {"allowed": True, "auth": {"player": {"id": body["p_token_hash"]}, "expired": False}}
        with patch.object(server, "db_rpc", side_effect=rpc), TestClient(self.app()) as client:
            def read(value):
                response = client.get("/api/synthetic", headers={"Authorization": "Bearer " + value})
                self.assertEqual(response.status_code, 200)
                return response.json()["id"]
            with ThreadPoolExecutor(max_workers=4) as pool:
                identities = list(pool.map(read, ["one", "two", "three", "four"]))
        self.assertEqual(identities, [hashlib.sha256(x.encode()).hexdigest() for x in ["one", "two", "three", "four"]])

    def test_second_quota_check_does_not_repeat_auth(self):
        calls = []
        def rpc(name, body):
            calls.append(body)
            return {"allowed": True, "auth": {"player": {"id": "synthetic"}, "expired": False} if body["p_token_hash"] else None}
        with patch.object(server, "db_rpc", side_effect=rpc):
            response = TestClient(self.app(twice=True)).get("/api/synthetic", headers={"Authorization": "Bearer synthetic"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(calls), 2)
        self.assertIsNone(calls[1]["p_token_hash"])

    def test_quota_and_provider_failures_stay_closed(self):
        for row, status in [({"allowed": False},429), ({},503), (None,503),
                            ({"allowed": True, "auth": {}},503),
                            ({"allowed": True, "auth": {"expired": True, "player": None}},401)]:
            with self.subTest(row=row), patch.object(server, "db_rpc", return_value=row):
                response = TestClient(self.app()).get("/api/synthetic", headers={"Authorization": "Bearer synthetic"})
                self.assertEqual(response.status_code, status)

    def test_policy_uses_same_request_and_never_survives_it(self):
        token = server.request_guard_context.set({"fair_play_policy": {"enabled": True, "daily_from": "2026-10-01"}})
        try:
            with patch.object(server, "db_select", side_effect=AssertionError("no extra DB read")):
                self.assertTrue(server._fair_play_policy()["enabled"])
        finally:
            server.request_guard_context.reset(token)
        self.assertIsNone(server.request_guard_context.get())

    def test_ranking_ids_use_one_post_body_and_do_not_fallback(self):
        calls = []
        def rpc(name, body):
            calls.append((name, body))
            return {"players": [{"id": "synthetic"}], "leagues": []}
        rows, leagues = rankings.entity_context(lambda *a, **k: self.fail("GET fallback"), ["synthetic"], rpc=rpc)
        self.assertEqual(rows[0]["id"], "synthetic")
        self.assertEqual(calls[0][1]["p_player_ids"], ["synthetic"])
        with self.assertRaises(HTTPException):
            rankings.entity_context(lambda *a, **k: [], ["synthetic"], rpc=lambda *a: {})

    def test_malformed_compact_summary_is_unavailable(self):
        for value in (None, {}, {"currentStreak": 0, "longestStreak": 0, "freeResults": [["bad"]]},
                      {"currentStreak": 0, "longestStreak": 0, "freeResults": [[None, "easy"]]}):
            with self.assertRaises(HTTPException) as error:
                server._stats_from_db_summary(value)
            self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()

