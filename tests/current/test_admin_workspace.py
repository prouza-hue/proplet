"""Behavior at admin boundaries; no production data or network calls."""
from datetime import datetime, timedelta
from pathlib import Path
import os
import sys
import unittest
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
from backend import admin_workspace as a

PID = "71000000-0000-4000-8000-000000000001"
CASE = "72000000-0000-4000-8000-000000000001"
TZ = ZoneInfo("Europe/Prague")


class AdminWorkspaceTests(unittest.TestCase):
    def test_player_page_one_rpc_true_total_and_no_private_identity(self):
        rpc = Mock(return_value={"total": 251, "users": [{"id": PID, "name": "Same name", "points": 1350,
            "result_xp": 100, "account_bonus_xp": 1000, "word_discovery_xp": 250,
            "email": "fixture@example.test", "password_hash": "DO-NOT-EXPOSE", "google_linked": True}]})
        data = a.users({"db_rpc": rpc}, q=PID, limit=30, offset=210, sort="xp")
        self.assertEqual(data["total"], 251)
        self.assertEqual(data["offset"], 210)
        self.assertEqual(data["users"][0]["points"], 1350)
        self.assertEqual(data["users"][0]["identity"]["emailMasked"], "f***@example.test")
        self.assertNotIn("DO-NOT-EXPOSE", str(data))
        self.assertNotIn("fixture@example.test", str(data))
        rpc.assert_called_once_with("proplet_admin_users_page_v1", {"p_query": PID,
            "p_offset": 210, "p_limit": 30, "p_sort": "xp", "p_team": None})

    def test_empty_late_page_preserves_total(self):
        data = a.users({"db_rpc": lambda *_: {"total": 205, "users": []}}, offset=300)
        self.assertEqual(data["total"], 205)
        self.assertEqual(data["meta"]["status"], "ready")

    def test_invalid_sort_offset_and_status_rejected_before_db(self):
        rpc = Mock()
        for kwargs in ({"sort": "points desc;drop table players"}, {"offset": -1}, {"limit": 201}):
            with self.subTest(kwargs=kwargs), self.assertRaises(HTTPException):
                a.users({"db_rpc": rpc}, **kwargs)
        with self.assertRaises(HTTPException):
            a.cases({"db_rpc": rpc}, "support", status="invented")
        rpc.assert_not_called()

    def test_case_archive_and_links_survive_resolved_status(self):
        rpc = Mock(return_value={"total": 12, "rows": [{"id": CASE, "status": "resolved",
            "player": {"id": PID, "name": "Fixture"}, "category": "account", "message": "Cannot log in"}]})
        data = a.cases({"db_rpc": rpc}, "support", status="all", case_id=CASE, player_id=PID, offset=2, limit=5)
        self.assertEqual(data["reports"][0]["reportedBy"]["id"], PID)
        self.assertEqual(data["reports"][0]["status"], "resolved")
        self.assertEqual(data["total"], 12)
        self.assertEqual(rpc.call_args.args[1]["p_id"], CASE)
        self.assertEqual(rpc.call_args.args[1]["p_status"], "all")

    def test_database_malformed_payload_never_becomes_zero(self):
        with self.assertRaises(HTTPException):
            a.users({"db_rpc": lambda *_: []})
        with self.assertRaises(HTTPException):
            a.cases({"db_rpc": lambda *_: {"total": None, "rows": []}}, "support")

    def test_partial_workspace_keeps_successful_cases(self):
        def rpc(name, body):
            if name == "proplet_admin_cases_v1" and body["p_kind"] == "support":
                return {"total": 1, "rows": [{"id": CASE, "category": "account", "player": {"id": PID}}]}
            raise HTTPException(503, "synthetic unavailable")
        ns = {"db_rpc": rpc, "current_prague_date": lambda: datetime.now(TZ).date(),
            "expected_daily_puzzle_id": lambda _: "fixture", "ranking_queries": Mock(),
            "APP_VERSION": "4.10.0", "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/admin-modernization"}
        ns["ranking_queries"].admin_overview.side_effect = HTTPException(503, "synthetic")
        data = a.workspace(ns)
        self.assertEqual(data["meta"]["status"], "partial")
        self.assertEqual(data["data"]["caseCounts"], {"support_reports": 1, "word_reports": None})
        self.assertEqual(data["data"]["queue"][0]["unit"], "cases")
        self.assertIsNone(data["data"]["activity"])
        self.assertEqual(data["data"]["runtime"]["databaseLabel"], "Izolovaná testovací data")

    def test_operation_counts_are_events_and_unknown_players_are_not_zero(self):
        ns = {"db_rpc": lambda *_: {"errors": [{"eventType": "client_error", "count": 19}], "recent": []},
              "APP_VERSION": "4.10.0", "VERCEL_ENV": "preview", "VERCEL_GIT_COMMIT_REF": "codex/admin-modernization"}
        with patch.dict(os.environ, {"VERCEL_GIT_COMMIT_SHA": "not-a-sha", "SECRET": "never-return"}):
            result = a.operations(ns)
        self.assertIsNone(result["data"]["runtime"]["sha"])
        self.assertEqual(result["meta"]["unit"], "events")
        self.assertFalse(result["meta"]["affectedPlayersAvailable"])
        self.assertNotIn("never-return", str(result))

    def test_analytics_immature_cohorts_and_unsupported_steps(self):
        now = datetime.now(TZ)
        mature = (now - timedelta(days=9)).replace(hour=8).isoformat()
        young = (now - timedelta(days=2)).replace(hour=8).isoformat()
        def event(flow, name, stamp):
            return {"flow": flow, "event": name, "at": stamp, "actor": "a:fixture-" + flow}
        raw = {"events": [event("mature", "first_board_experiment_assigned", mature),
                          event("mature", "first_board_experiment_started", mature),
                          event("young", "first_board_experiment_assigned", young)],
               "activity": [{"actor": "a:fixture-mature", "day": (now-timedelta(days=2)).date().isoformat()}]}
        result = a.analytics({"db_rpc": lambda *_: raw})
        retention = result["data"]["retention"]
        self.assertEqual(retention["d7"], {"eligible": 1, "retained": 1, "pending": 1, "rate": 1.0,
            "status": "ready", "unit": "flows", "definition": retention["d7"]["definition"]})
        self.assertIsNone(result["data"]["steps"][0]["count"])
        self.assertEqual(result["data"]["steps"][0]["status"], "unavailable")
        self.assertEqual(result["data"]["steps"][2]["count"], 1)
        self.assertEqual(result["data"]["steps"][2]["denominator"], 2)

    def test_only_historical_or_missing_events_produce_unavailable_current_flow(self):
        result = a.analytics({"db_rpc": lambda *_: {"events": [], "activity": []}})
        self.assertEqual(result["meta"]["status"], "unavailable")
        self.assertIsNone(result["data"]["steps"][1]["count"])
        self.assertIsNone(result["data"]["retention"]["d7"]["rate"])

    def test_out_of_order_funnel_events_do_not_inflate_conversion(self):
        raw = {"events": [
            {"flow": "a", "event": "first_board_experiment_assigned", "at": "2026-10-20T12:00:00+02:00", "actor": "a:a"},
            {"flow": "a", "event": "first_board_experiment_started", "at": "2026-10-20T11:00:00+02:00", "actor": "a:a"},
            {"flow": "unlinked", "event": "first_steps_v1_saved", "at": "2026-10-20T11:00:00+02:00", "actor": "p:b"}], "activity": []}
        result = a.analytics({"db_rpc": lambda *_: raw})
        self.assertEqual(result["data"]["steps"][2]["count"], 0)
        self.assertEqual(result["data"]["populations"][0]["count"], 1)

    def test_audit_period_and_sensitive_details(self):
        rpc = Mock(return_value={"total": 1, "rows": [{"id": CASE, "details": {
            "email": "fixture@example.test", "token": "never-return", "result": "pending"}}]})
        result = a.audit({"db_rpc": rpc}, from_date="2026-10-24", to_date="2026-10-25")
        self.assertEqual(rpc.call_args.args[1]["p_until"], "2026-10-26")
        self.assertNotIn("never-return", str(result))
        self.assertNotIn("fixture@example.test", str(result))
        with self.assertRaises(HTTPException):
            a.audit({"db_rpc": rpc}, from_date="yesterday")

    def test_legacy_quality_aliases_reject_second_owner_before_private_reads(self):
        from fastapi.testclient import TestClient
        import server
        from admin_recovery import ADMIN_OWNER_PLAYER_ID
        client = TestClient(server.app)
        with patch.object(server, "VERCEL_ENV", "production"), patch.object(server, "auth_player", return_value={"id": PID}), \
             patch.object(server, "db_select", return_value=[{"active": True, "role": "owner"}]) as select, \
             patch.object(server, "build_quality_report") as quality, patch.object(server, "db_request") as request:
            for path in ("/api/quality-report", "/api/quality-history", "/api/admin/quality", "/api/admin/quality-history"):
                self.assertEqual(client.get(path, headers={"Authorization": "Bearer fixture"}).status_code, 403)
            select.assert_not_called()
            quality.assert_not_called()
            request.assert_not_called()
        with patch.object(server, "VERCEL_ENV", "production"), patch.object(server, "auth_player", return_value={"id": ADMIN_OWNER_PLAYER_ID}), \
             patch.object(server, "db_select", return_value=[{"active": True, "role": "viewer"}]):
            with self.assertRaises(HTTPException) as denied:
                server.require_admin("Bearer fixture", write=True)
            self.assertEqual(denied.exception.status_code, 403)

    def test_funnel_orders_timestamps_as_instants_across_prague_dst(self):
        raw = {"events": [
            {"flow": "dst", "event": "first_board_experiment_assigned", "at": "2026-10-25T02:45:00+02:00", "actor": "a:dst"},
            {"flow": "dst", "event": "first_board_experiment_started", "at": "2026-10-25T02:15:00+01:00", "actor": "a:dst"}], "activity": []}
        result = a.analytics({"db_rpc": lambda *_: raw})
        self.assertEqual(result["data"]["steps"][2]["count"], 1)

    def test_case_update_uses_one_atomic_command_and_fails_closed(self):
        admin = {"player": {"id": PID}}
        rpc = Mock(return_value={"ok": True, "id": CASE, "status": "resolved", "changed": True})
        result = a.update_case({"db_rpc": rpc}, admin, "support", CASE, "resolved", "Retained note")
        self.assertTrue(result["ok"])
        rpc.assert_called_once_with("proplet_admin_case_update_v1", {"p_admin": PID, "p_kind": "support",
            "p_id": CASE, "p_status": "resolved", "p_note": "Retained note"})
        for payload, code in (({"ok": False, "code": "forbidden"}, 403), ({"ok": False, "code": "not_found"}, 404), ([], 503)):
            with self.subTest(payload=payload), self.assertRaises(HTTPException) as failure:
                a.update_case({"db_rpc": lambda *_: payload}, admin, "words", CASE, "resolved")
            self.assertEqual(failure.exception.status_code, code)

    def test_content_uses_published_runtime_and_does_not_expose_geometry(self):
        ns = {"current_prague_date": lambda: datetime.now(TZ).date(), "expected_daily_puzzle_id": lambda _: "published",
              "puzzle_info": lambda _: {"difficulty": "easy", "puzzle": {"answers": ["PRIVATE"], "letters": ["X"]}},
              "tajenka_week_for": lambda _: 1, "tajenka_puzzle_for_week": lambda _: {"id": "tajenka-id"},
              "tajenka_is_live": lambda _: False, "FREE_DIFFICULTIES": ["easy"],
              "released_free_bank": lambda *_: [{"id": "base"}, {"id": "rolling-released"}],
              "load_tajenka_bank": lambda: {"puzzles": [{"id": "prepared"}]}}
        with patch.dict(os.environ, {"PROPLET_DAILY_SPECIALS_ENABLED": "false"}):
            result = a.content(ns, 2)
        self.assertEqual(result["data"]["banks"][0]["count"], 2)
        self.assertEqual(result["data"]["calendar"][0]["daily"]["puzzleId"], "published")
        self.assertNotIn("PRIVATE", str(result))
        self.assertNotIn("letters", str(result))

    def test_public_config_exposes_preview_boolean_without_private_configuration(self):
        import server
        with patch.object(server.backend_config, "admin_preview_enabled", return_value=True), \
             patch.object(server, "load_puzzles", return_value={"dictionarySize": 0, "dailyRotationSize": 0}), \
             patch.object(server, "push_ready", return_value=False):
            result = server.config()
        self.assertIs(result["adminPreview"], True)
        self.assertNotIn("supabase", str(result).lower())


if __name__ == "__main__":
    unittest.main()
