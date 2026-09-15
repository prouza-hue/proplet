"""Exercise the real account routes; provider and persistence are synthetic."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
import account_auth_core as auth


class IdentityBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.owner = {"id": "owner", "name": "Synthetic", "email": "owner@example.invalid",
                      "email_verified_at": "2026-01-01T00:00:00Z", "family_code": "SOLO_TEST"}
        self.challenge = "c" * 32
        self.tables = {
            "players": [self.owner], "player_sessions": [],
            "account_auth_challenges": [{"id": "challenge", "player_id": "owner",
                "email": self.owner["email"], "purpose": "link_email",
                "token_hash": hashlib.sha256(self.challenge.encode()).hexdigest(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}],
        }
        self.writes = []
        self.sessions = []

        def select(table, **filters):
            return [row for row in self.tables[table] if all(row.get(k) == v for k, v in filters.items())]

        def update(table, filters, values):
            self.writes.append((table, filters, values))
            for row in select(table, **filters):
                row.update(values)

        def insert(table, row):
            self.writes.append((table, {}, row))
            self.tables[table].append(row)

        def session(player_id):
            self.sessions.append(player_id)
            return "synthetic-session"

        app = FastAPI()
        auth.install_account_auth(app, supabase_url="https://provider.invalid", supabase_key="synthetic",
            tz=timezone.utc, db_select=select, db_insert=insert, db_update=update,
            db_delete=lambda *a, **kw: self.writes.append(("delete", a, kw)),
            auth_player=lambda token: self.owner, new_session=session,
            hash_password=lambda p: "synthetic-hash", verify_password=lambda *a: False,
            enforce_rate_limit=lambda *a, **kw: None, player_stats=lambda *a: {"xp": 33887},
            public_family_code=lambda *a: None, league_name_for=lambda *a: None)
        self.client = TestClient(app)
        self.user = {"id": "auth-owner", "email": self.owner["email"],
            "email_confirmed_at": "2026-01-01T00:00:00Z",
            "identities": [{"provider": "google", "identity_data": {
                "email": self.owner["email"], "email_verified": True}}]}

    def complete(self, path="/api/auth/google/complete", **payload):
        provider = MagicMock()
        provider.__enter__.return_value = provider
        provider.request.return_value = httpx.Response(200, json=self.user)
        with patch.object(auth.httpx, "Client", return_value=provider):
            response = self.client.post(path, json={"accessToken": "x" * 50, **payload})
        provider.request.assert_called_once()
        return response

    def assert_denied_without_mutation(self, **kwargs):
        before = copy.deepcopy(self.tables)
        self.assertEqual(self.complete(**kwargs).status_code, 401)
        self.assertEqual(self.tables, before)
        self.assertEqual(self.writes, [])
        self.assertEqual(self.sessions, [])

    def test_unconfirmed_token_cannot_claim_existing_email(self):
        self.user["email_confirmed_at"] = None
        self.assert_denied_without_mutation()

    def test_password_identity_and_editable_google_claim_are_insufficient(self):
        self.user["identities"] = [{"provider": "email"}]
        self.user["user_metadata"] = {"provider": "google", "email_verified": True}
        self.assert_denied_without_mutation()

    def test_google_identity_requires_boolean_verification(self):
        for value in (False, None, "true"):
            with self.subTest(value=value):
                self.user["identities"][0]["identity_data"]["email_verified"] = value
                self.assert_denied_without_mutation()

    def test_verified_google_links_existing_player_and_preserves_stats(self):
        response = self.complete()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["profile"]["id"], "owner")
        self.assertEqual(response.json()["profile"]["stats"]["xp"], 33887)
        self.assertEqual(len(self.tables["players"]), 1)
        self.assertEqual(self.owner["auth_user_id"], "auth-owner")
        self.assertEqual(self.sessions, ["owner"])

    def test_stable_identity_mapping_survives_changed_email(self):
        self.owner["auth_user_id"] = "auth-owner"
        self.user["email"] = "changed@example.invalid"
        response = self.complete()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["id"], "owner")
        self.assertEqual(self.owner["email"], "owner@example.invalid")
        self.assertEqual(self.writes, [])

    def test_different_identity_cannot_replace_existing_mapping(self):
        self.owner["auth_user_id"] = "different-auth-id"
        self.assertEqual(self.complete().status_code, 409)
        self.assertEqual(self.writes, [])
        self.assertEqual(self.sessions, [])

    def test_email_verification_requires_provider_confirmation(self):
        self.user["email_confirmed_at"] = None
        self.assert_denied_without_mutation(path="/api/account/email/verify", challenge=self.challenge)

    def test_recovery_requires_provider_confirmation(self):
        self.user["email_confirmed_at"] = None
        self.tables["account_auth_challenges"][0]["purpose"] = "recover_password"
        self.assert_denied_without_mutation(path="/api/auth/recovery/check", challenge=self.challenge)
        self.assert_denied_without_mutation(path="/api/auth/recovery/reset", challenge=self.challenge,
                                            password="synthetic-password")


if __name__ == "__main__":
    unittest.main()
