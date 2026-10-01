"""One auth RPC per request without weakening expiry/revocation boundaries."""
import hashlib
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from fastapi import HTTPException
import server


class AuthUsageTests(unittest.TestCase):
    def setUp(self):
        self.player = {"id": "synthetic-player", "name": "Synthetic", "password_hash": "present"}
        self.rpc = patch.object(server, "db_rpc").start()
        self.addCleanup(patch.stopall)
        self.rpc.return_value = {"player": self.player, "expired": False}
        patch.object(server, "db_select", side_effect=AssertionError("auth must use one RPC")).start()
        patch.object(server, "db_update", side_effect=AssertionError("session touch belongs to RPC")).start()
        patch.object(server, "db_delete", side_effect=AssertionError("expiry cleanup belongs to RPC")).start()

    def assert_status(self, status, authorization="Bearer synthetic-token"):
        with self.assertRaises(HTTPException) as caught:
            server.auth_player(authorization)
        self.assertEqual(caught.exception.status_code, status)
        return caught.exception

    def test_one_rpc_sends_only_hashed_token_and_preserves_player(self):
        self.assertEqual(server.auth_player("Bearer synthetic-token"), self.player)
        self.rpc.assert_called_once_with("proplet_auth_player_v1", {
            "p_token_hash": hashlib.sha256(b"synthetic-token").hexdigest(),
        })

    def test_missing_or_wrong_scheme_does_not_query_database(self):
        for value in (None, "", "Basic synthetic", "bearer synthetic"):
            with self.subTest(value=value):
                self.assert_status(401, value)
        self.rpc.assert_not_called()

    def test_unknown_token_is_unauthorized(self):
        self.rpc.return_value = {"player": None, "expired": False}
        self.assert_status(401)

    def test_expired_session_is_unauthorized(self):
        self.rpc.return_value = {"player": None, "expired": True}
        self.assertIn("vypršelo", self.assert_status(401).detail)

    def test_no_cache_after_revocation(self):
        self.assertEqual(server.auth_player("Bearer synthetic-token"), self.player)
        self.rpc.return_value = {"player": None, "expired": False}
        self.assert_status(401)
        self.assertEqual(self.rpc.call_count, 2)

    def test_provider_failures_are_unavailable_not_bad_login(self):
        for status in (400, 401, 403, 503):
            with self.subTest(status=status):
                self.rpc.side_effect = HTTPException(status, "synthetic provider failure")
                self.assert_status(503)

    def test_malformed_provider_response_is_unavailable(self):
        for value in (None, [], {}, {"expired": False}, {"player": None},
                      {"player": None, "expired": "false"},
                      {"player": {}, "expired": False}):
            with self.subTest(value=value):
                self.rpc.return_value = value
                self.assert_status(503)


if __name__ == "__main__":
    unittest.main()
