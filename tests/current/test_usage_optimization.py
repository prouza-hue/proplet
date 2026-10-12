"""HTTP request isolation and compact usage contracts."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
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

    def test_scoped_xp_context_preserves_complete_public_response(self):
        """Exercise rendering against full and SQL-equivalent scoped contexts.

        The baseline deliberately supplies every historical account. The scoped
        adapter models the existing context RPC, including inactive teammates
        and its ID ordering; it does not choose the requested player IDs itself.
        """
        def player(suffix, name, team=None, public=True):
            return {"id": f"00000000-0000-4000-8000-{suffix:012d}",
                    "name": name, "avatar": "A", "family_code": team or f"SOLO_{suffix}",
                    "team_joined_at": "2026-10-01T00:00:00Z" if team else None,
                    "public_rankings": public}

        players = [
            player(1, "Historical solo"),
            player(10, "Hidden A", public=False),
            player(20, "Hidden B", public=None),
            player(30, "Public scorer", "PUBLIC"),
            player(40, "Zero-score viewer", "PRIVATE", False),
            player(50, "Inactive public teammate", "PUBLIC"),
            player(60, "Moved scorer", "NEW"),
            player(70, "Private scorer", "PRIVATE", False),
            player(80, "Inactive former teammate", "OLD"),
            player(90, "Inactive private teammate", "PRIVATE"),
        ]
        by_id = {row["id"]: row for row in players}
        ids = {int(row["id"].rsplit("-", 1)[1]): row["id"] for row in players}
        leagues = [{"code": code, "name": f"Internal {code}",
                    "public_name": f"Published {code}", "public_opt_in": code != "PRIVATE",
                    "public_enabled_at": "2026-10-01T00:00:00Z"}
                   for code in ("PUBLIC", "PRIVATE", "OLD", "NEW")]
        lifetime = {row["id"]: 1000 + index for index, row in enumerate(players)}
        badges = {row["id"]: index for index, row in enumerate(players)}
        period_xp = {row["id"]: 0 for row in players}
        period_xp.update({ids[10]: 100, ids[20]: 100, ids[30]: 90, ids[60]: 60, ids[70]: 25})
        team_xp = {"PUBLIC": 90, "OLD": 60, "PRIVATE": 25}
        original_context = server._ranking_context
        original_hash = hashlib.sha256
        fixed_now = datetime(2026, 10, 12, 12, tzinfo=timezone.utc)

        def hash_with_alias_collision(value=b""):
            # Two hidden players collide at nonce zero, then use the real
            # collision resolution. An ordering regression changes their names.
            if any(value.endswith(f":{ids[index]}:0".encode()) for index in (10, 20)):
                return SimpleNamespace(digest=lambda: bytes(32))
            return original_hash(value)

        for period in ("today", "week", "all"):
            points = lifetime if period == "all" else period_xp
            for viewer_id in (None, ids[40], ids[10], ids[60]):
                with self.subTest(period=period, viewer=viewer_id):
                    context_calls = []

                    def context_rpc(function, body):
                        self.assertEqual(function, "proplet_ranking_context_v1")
                        context_calls.append(body)
                        requested = set(body["p_player_ids"])
                        codes = set(body["p_team_codes"])
                        codes.update(row["family_code"] for row in players
                                     if row["id"] in requested and not row["family_code"].startswith("SOLO_"))
                        selected = [row for row in players if row["id"] in requested or
                                    (body["p_include_team_members"] and row["family_code"] in codes)]
                        return {"players": sorted(selected, key=lambda row: row["id"]),
                                "leagues": sorted([row for row in leagues if row["code"] in codes],
                                                  key=lambda row: row["code"])}

                    def full_context(requested, codes):
                        return original_context(set(by_id), codes)

                    with patch.object(server, "enforce_rate_limit"), \
                         patch.object(server, "_ranking_viewer", return_value=by_id.get(viewer_id)), \
                         patch.object(server, "_ranking_xp_aggregates", return_value=(points, lifetime, badges, team_xp)), \
                         patch.object(server, "current_prague_datetime", return_value=fixed_now), \
                         patch.object(server, "current_prague_date", return_value=fixed_now.date()), \
                         patch.object(server, "SUPABASE_URL", "https://synthetic.supabase.co"), \
                         patch.object(server, "SUPABASE_SECRET_KEY", "synthetic-server-only"), \
                         patch.object(server, "db_rpc", side_effect=context_rpc), \
                         patch.object(server.hashlib, "sha256", side_effect=hash_with_alias_collision):
                        with patch.object(server, "_ranking_context", side_effect=full_context):
                            baseline = server.rankings_xp(SimpleNamespace(headers={}), period, None)
                        optimized = server.rankings_xp(SimpleNamespace(headers={}), period, None)

                    self.assertEqual(optimized, baseline)
                    self.assertEqual(len(context_calls), 2)
                    self.assertTrue(context_calls[-1]["p_include_team_members"])
                    if viewer_id:
                        self.assertIn(viewer_id, context_calls[-1]["p_player_ids"])
                    if period != "all":
                        self.assertNotIn(ids[1], context_calls[-1]["p_player_ids"])
                        self.assertLess(len(context_calls[-1]["p_player_ids"]), len(by_id))
                    public_team = next(row for row in optimized["teams"] if row["name"] == "Published PUBLIC")
                    self.assertEqual(public_team["memberCount"], 2)
                    old_team = next(row for row in optimized["teams"] if row["name"] == "Published OLD")
                    self.assertEqual((old_team["xp"], old_team["memberCount"]), (60, 1))
                    private_teams = [row for row in optimized["teams"] if row["name"] == "Internal PRIVATE"]
                    self.assertEqual(len(private_teams), int(viewer_id == ids[40]))
                    if viewer_id == ids[40] and period != "all":
                        mine = next(row for row in optimized["players"] if row["isMine"])
                        self.assertEqual((mine["xp"], mine["lifetimePoints"], mine["badgeCount"]),
                                         (0, lifetime[viewer_id], badges[viewer_id]))


if __name__ == "__main__":
    unittest.main()

