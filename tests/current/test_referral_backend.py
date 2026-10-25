"""Behavioral acceptance of signup context, preview boundary and auth attribution."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import referrals
from backend import db as backend_db
import account_auth_core


CODE = "valid_referral_code_20261012"


def rpc(name, body):
    if name == "proplet_referral_public_v1":
        return {"ok": body["p_code"] == CODE, "code": body["p_code"], "inviter": {"name": "Inviter", "avatar": "🦔"}}
    if name == "proplet_referral_status_v1":
        return {"ok": True, "incoming": None, "referrals": []}
    return {"ok": True}


class ReferralAcceptance(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"PROPLET_REFERRALS_ENABLED": "true", "VERCEL_ENV": "production", "SUPABASE_URL": "https://test.supabase.co"})
        self.env.start()
    def tearDown(self):
        self.env.stop()

    def test_request_context_reset_and_parallel_isolation(self):
        with referrals.signup_context(CODE, rpc):
            self.assertEqual(referrals.signup_invite.get(), CODE)
        self.assertIsNone(referrals.signup_invite.get())
        with self.assertRaises(RuntimeError):
            with referrals.signup_context(CODE, rpc):
                raise RuntimeError("registration failed")
        self.assertIsNone(referrals.signup_invite.get())
        def job(with_invite):
            with referrals.signup_context(CODE if with_invite else None, rpc):
                return referrals.signup_invite.get()
        with ThreadPoolExecutor(4) as pool:
            self.assertEqual(list(pool.map(job, [True, False, True, False])), [CODE, None, CODE, None])

    def test_invalid_invite_does_not_enter_signup(self):
        with self.assertRaises(HTTPException) as caught:
            with referrals.signup_context("missing_valid_code", rpc):
                self.fail("invalid signup should be rejected before player INSERT")
        self.assertEqual(caught.exception.status_code, 404)
        self.assertIsNone(referrals.signup_invite.get())

    def test_preview_production_guard_and_disabled_status(self):
        calls = []
        app = FastAPI()
        referrals.install(app, auth_player=lambda *_: {"id": "p"}, db_rpc=lambda *args: calls.append(args), enforce_rate_limit=lambda *a, **k: None)
        with patch.dict(os.environ, {"VERCEL_ENV": "preview", "SUPABASE_URL": "https://iopyhluayfszskyqqpuc.supabase.co"}):
            client = TestClient(app)
            self.assertFalse(client.get("/api/referrals").json()["enabled"])
            self.assertEqual(client.post("/api/referrals/invite").status_code, 503)
            self.assertEqual(client.post("/api/referrals/dismiss").status_code, 503)
            self.assertEqual(calls, [])
        with patch.dict(os.environ, {"VERCEL_ENV": "preview", "SUPABASE_URL": "https://eanzztstmwlamwfdskbf.supabase.co"}):
            self.assertTrue(referrals.enabled())

    def test_provenance_header_only_inside_validated_signup(self):
        import httpx
        class Client:
            def __init__(self): self.calls = []
            def request(self, *args, **kwargs):
                self.calls.append(kwargs["headers"])
                return httpx.Response(201, json=[{"id": "new"}], request=httpx.Request("POST", "https://test.supabase.co/rest/v1/players"))
        client = Client()
        with referrals.signup_context(CODE, rpc):
            backend_db.db_request("POST", "players", body={}, supabase_url="https://test.supabase.co", supabase_secret_key="server-secret", http_client=client)
        backend_db.db_request("POST", "players", body={}, supabase_url="https://test.supabase.co", supabase_secret_key="server-secret", http_client=client)
        self.assertEqual(client.calls[0].get("X-Proplet-Referral-Invite"), CODE)
        self.assertNotIn("X-Proplet-Referral-Invite", client.calls[1])

    def test_google_new_player_claim_and_existing_login_no_claim(self):
        from datetime import timezone
        players = []
        provenance = []
        def select(table, **filters):
            return [p for p in players if all(p.get(k) == v for k, v in filters.items())] if table == "players" else []
        def insert(table, row):
            provenance.append(referrals.signup_invite.get())
            players.append(dict(row))
        app = FastAPI()
        account_auth_core.install_account_auth(app, supabase_url="https://test.supabase.co", supabase_key="key", tz=timezone.utc,
            db_select=select, db_insert=insert, db_update=lambda *_: None, db_delete=lambda *_: None,
            auth_player=lambda *_: None, new_session=lambda *_: "session", hash_password=lambda *_: "hash",
            verify_password=lambda *_: True, enforce_rate_limit=lambda *a, **k: None, player_stats=lambda *_: {},
            public_family_code=lambda *_: None, league_name_for=lambda *_: None, db_rpc=rpc)
        response = {
            "id": "google-user", "email": "user@example.com", "email_confirmed_at": "2026-10-12T00:00:00Z",
            "identities": [{"provider": "google", "identity_data": {"email_verified": True}}],
            "user_metadata": {"name": "Google player"},
        }
        # auth_request uses the verified Auth API response, not client metadata.
        import httpx
        fake = httpx.Response(200, json=response, request=httpx.Request("GET", "https://test.supabase.co/auth/v1/user"))
        with patch.object(account_auth_core.httpx, "Client") as provider:
            provider.return_value.__enter__.return_value.request.return_value = fake
            from urllib.parse import urlparse, parse_qs
            client = TestClient(app, base_url="https://hrajproplet.cz", headers={"Origin": "https://hrajproplet.cz"})
            def complete(invite):
                start = client.get("/api/auth/google/start", follow_redirects=False)
                redirect = parse_qs(urlparse(start.headers["location"]).query)["redirect_to"][0]
                state = parse_qs(urlparse(redirect).query)["state"][0]
                provider.return_value.__enter__.return_value.request.side_effect = [httpx.Response(200, json={"access_token": "a"*60}), fake]
                return client.post("/api/auth/google/complete", json={"code": "synthetic-code", "state": state, "inviteCode": invite})
            first = complete(CODE)
            self.assertEqual(first.status_code, 200, first.text)
            self.assertTrue(first.json()["accountCreated"])
            self.assertEqual(provenance, [CODE])
            second = complete("missing_valid_code")
            self.assertEqual(second.status_code, 200, second.text)
            self.assertFalse(second.json()["accountCreated"])
            self.assertEqual(provenance, [CODE])
        self.assertIsNone(referrals.signup_invite.get())


if __name__ == "__main__":
    unittest.main()
