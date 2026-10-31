"""Real-player preview is narrowly enabled; all persistence here is mocked."""
import asyncio
import json
import os
from datetime import date
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import JSONResponse
from backend import config, referrals, team_victories
import server

LIVE = {
    "PROPLET_LIVE_PLAYER_PREVIEW_ENABLED": "true",
    "VERCEL_ENV": "preview",
    "VERCEL_GIT_COMMIT_REF": "codex/studio-edition",
    "SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co",
}
LIVE_BRANCHES = ("codex/studio-edition", "codex/today-one-screen")


class LivePreview(unittest.TestCase):
    def setUp(self):
        # A test accidentally reaching the transport is a failure, never a DB write.
        self.network = patch("httpx.HTTPTransport.handle_request", side_effect=AssertionError("Unexpected network"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def test_exact_opt_in_and_configuration(self):
        for branch in LIVE_BRANCHES:
            with self.subTest(branch=branch), patch.dict(os.environ, {**LIVE, "VERCEL_GIT_COMMIT_REF": branch}, clear=True):
                self.assertTrue(config.live_player_preview_enabled())
                settings = config.load_settings()
                self.assertTrue(settings.live_player_preview)
                self.assertTrue(settings.tajenka_release_enabled)
                self.assertEqual(settings.vercel_env, "preview")
                for field, values in {
                    "PROPLET_LIVE_PLAYER_PREVIEW_ENABLED": ("", "false", "0"),
                    "VERCEL_ENV": ("production", "development", ""),
                    "VERCEL_GIT_COMMIT_REF": ("main", "preview/studio-edition", "codex/studio-edition-other",
                                               "preview/today-one-screen", "codex/today-one-screen-other",
                                               "codex/today-one-screen/child", "codex/Today-one-screen"),
                    "SUPABASE_URL": ("", "https://eanzztstmwlamwfdskbf.supabase.co", LIVE["SUPABASE_URL"] + ".invalid"),
                }.items():
                    for value in values:
                        with self.subTest(field=field, value=value), patch.dict(os.environ, {field: value}):
                            self.assertFalse(config.live_player_preview_enabled())
                with patch.dict(os.environ, {"PROPLET_TAJENKA_RELEASE_ENABLED": "false"}):
                    self.assertFalse(config.load_settings().tajenka_release_enabled)

    def test_real_paths_pass_guard_but_test_results_do_not(self):
        async def exercise(live, path, test=False):
            called = []
            async def next_handler(request):
                called.append(request.scope["path"])
                return JSONResponse({"canonical": True})
            headers = [(b"x-proplet-test", b"1")] if test else []
            request = Request({"type": "http", "method": "POST", "path": path,
                               "headers": headers + [(b"content-length", b"0")],
                               "query_string": b""})
            with patch.object(server, "VERCEL_ENV", "preview"), \
                 patch.object(server, "LIVE_PLAYER_PREVIEW", live), \
                 patch.object(server, "isolated_fair_play_preview", return_value=False), \
                 patch.object(server, "GEN4_CANDIDATE_PREVIEW", False):
                response = await server.launch_safety_middleware(request, next_handler)
            return response, called
        for path in ("/api/play-session", "/api/result", "/api/anonymous/claim", "/api/product-events", "/api/attempt/start", "/api/attempt/finish", "/api/hint-event", "/api/feedback"):
            with self.subTest(path=path):
                response, called = asyncio.run(exercise(True, path))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(called, [path])
                response, called = asyncio.run(exercise(False, path))
                self.assertEqual(called, [])
                self.assertEqual(response.status_code, 409 if path in {"/api/result", "/api/play-session"} else 200)
        response, called = asyncio.run(exercise(True, "/api/result", test=True))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(called, [])

    def test_sessions_use_canonical_policy_without_claiming_isolation(self):
        with patch.object(server, "VERCEL_ENV", "preview"), \
             patch.object(server, "LIVE_PLAYER_PREVIEW", True), \
             patch.object(server, "isolated_fair_play_preview", return_value=False), \
             patch.object(server, "_fair_play_policy", return_value={"enabled": True, "daily_from": "2026-10-01"}) as policy:
            result = server.play_session_config()
            self.assertTrue(result["enabled"])
            self.assertFalse(result["isolatedPreview"])
            policy.assert_called_once()
        with patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "LIVE_PLAYER_PREVIEW", False), \
             patch.object(server, "isolated_fair_play_preview", return_value=False), patch.object(server, "_fair_play_policy") as policy:
            self.assertFalse(server.play_session_config()["enabled"])
            policy.assert_not_called()

    def test_live_capability_preserves_preview_identity_and_validation(self):
        puzzles = {"dictionarySize": 1, "dailyRotationSize": 1, "rescue": []}
        with patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "LIVE_PLAYER_PREVIEW", True), \
             patch.object(server, "load_puzzles", return_value=puzzles), \
             patch.object(server, "isolated_fair_play_preview", return_value=False):
            value = server.config()
            self.assertEqual(value["environment"], "preview")
            self.assertTrue(value["livePlayerPreview"])
            client = TestClient(server.app)
            for path in ("/api/play-session", "/api/result"):
                self.assertEqual(client.post(path, json={}).status_code, 422)
            self.assertEqual(client.post("/api/result", json={}, headers={"X-Proplet-Test": "1"}).status_code, 409)
            with patch.object(server, "require_admin"), patch.object(server, "save_quality_snapshot_if_monday") as snapshot:
                with self.assertRaises(HTTPException) as error:
                    server.repair_quality_snapshot(None)
                self.assertEqual(error.exception.status_code, 409)
                snapshot.assert_not_called()

    def test_live_content_cannot_time_travel(self):
        today = date(2026, 10, 25)
        with patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "LIVE_PLAYER_PREVIEW", True), \
             patch.object(server, "current_prague_date", return_value=today), \
             patch.object(server, "tajenka_is_live", return_value=True), \
             patch.object(server, "tajenka_week_for", return_value=15), \
             patch.object(server, "tajenka_puzzle_for_week", return_value={"week": 15}) as puzzle:
            self.assertEqual(server.effective_content_date(requested="2027-01-01"), today)
            self.assertEqual(json.loads(server.current_tajenka(week=37).body)["week"], 15)
            puzzle.assert_called_once_with(15)
            with patch.object(server, "tajenka_is_live", return_value=False):
                with self.assertRaises(HTTPException) as error:
                    server.current_tajenka(week=37)
                self.assertEqual(error.exception.status_code, 404)

    def test_referrals_and_trophies_use_real_authenticated_handlers(self):
        calls = []
        app = FastAPI()
        def rpc(name, payload):
            calls.append((name, payload))
            return {"enabled": True, "team": None, "incoming": None, "referrals": []}
        auth = Mock(return_value={"id": "fixture-player"})
        referrals.install(app, auth_player=auth, db_rpc=rpc, enforce_rate_limit=lambda *a, **kw: None)
        team_victories.install(app, auth_player=auth, db_rpc=rpc, enforce_rate_limit=lambda *a, **kw: None)
        client = TestClient(app)
        for branch in LIVE_BRANCHES:
            calls.clear()
            auth.reset_mock()
            with self.subTest(branch=branch), patch.dict(os.environ, {
                **LIVE, "VERCEL_GIT_COMMIT_REF": branch, "PROPLET_REFERRALS_ENABLED": "true"
            }, clear=True):
                self.assertTrue(client.get("/api/referrals").json()["enabled"])
                self.assertTrue(client.get("/api/team-victories").json()["enabled"])
                self.assertEqual([name for name, _ in calls], ["proplet_referral_status_v1", "proplet_team_victories_state_v1"])
                self.assertEqual(auth.call_count, 2)
                calls.clear()
                with patch.dict(os.environ, {"VERCEL_GIT_COMMIT_REF": "other-preview"}):
                    self.assertFalse(client.get("/api/referrals").json()["enabled"])
                    self.assertFalse(client.get("/api/team-victories").json()["enabled"])
                    self.assertEqual(calls, [])

    def test_welcome_and_team_mutations_reach_existing_validators(self):
        with patch.object(server, "VERCEL_ENV", "preview"), patch.object(server, "LIVE_PLAYER_PREVIEW", True), \
             patch.object(server, "auth_player", return_value={"id": "fixture-player"}), \
             patch.object(server, "enforce_rate_limit"), patch.object(server, "db_request", return_value=[{"id": "fixture-player"}]) as db:
            self.assertEqual(server.claim_printshop_welcome(Mock(), None), {"show": True})
            self.assertEqual(db.call_args.args[:2], ("PATCH", "players"))
            with patch.object(server, "is_solo_player", return_value=True):
                with self.assertRaises(HTTPException) as error:
                    server.family_league_settings(Mock(), Mock(), None)
                self.assertEqual(error.exception.status_code, 400)
            # Current leave handler uses the atomic RPC, even for an already-solo
            # account. The fixture must never fall through to a real transport.
            with patch.object(server, "db_rpc", return_value={"ok": True, "changed": False}) as leave:
                db.reset_mock()
                self.assertEqual(server.leave_team(Mock(), None)["familyCode"], None)
                self.assertEqual(leave.call_args.args[0], "proplet_team_leave_v1")
                self.assertEqual(leave.call_args.args[1]["p_player"], "fixture-player")
                self.assertIsNone(leave.call_args.args[1]["p_expected_family"])
                db.assert_not_called()


if __name__ == "__main__":
    unittest.main()
