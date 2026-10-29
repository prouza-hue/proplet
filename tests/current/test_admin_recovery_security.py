"""HTTP/confirmation boundaries; SQL rollback/concurrency has a real DB suite."""
from __future__ import annotations

import copy
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timezone
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import admin_recovery as recovery
from account_challenges import AtomicChallenges, require_test_mail_recipient
import account_auth_core

OWNER = recovery.ADMIN_OWNER_PLAYER_ID
OTHER = "00000000-0000-4000-8000-000000000002"
TARGET = "00000000-0000-4000-8000-000000000003"
SECOND = "00000000-0000-4000-8000-000000000004"
EMAIL = "synthetic@example.invalid"
REASON = "Hráč požádal o obnovení přístupu"
PATH = f"/api/admin/users/{TARGET}/recovery-email"


class RecoverySecurityTests(unittest.TestCase):
    def setUp(self):
        self.players = {pid: {"id": pid, "name": "Stejné jméno", "auth_identity_revision": 0}
                        for pid in (OWNER, OTHER, TARGET, SECOND)}
        self.grants = [{"player_id": pid, "role": "owner", "active": True} for pid in (OWNER, OTHER)]
        self.requests, self.provider_calls, self.rpc_calls, self.limits = {}, [], [], []
        self.lock = threading.Lock()
        self.provider_status = 200
        self.rpc_fail = None

        def select(table, **filters):
            rows = list(self.players.values()) if table == "players" else self.grants
            return [copy.deepcopy(row) for row in rows if all(row.get(key) == value for key, value in filters.items())]

        self.select = select

        def auth(authorization):
            if authorization not in {"Bearer owner", "Bearer other"}:
                raise HTTPException(401, "Invalid session")
            return self.players[OWNER if authorization == "Bearer owner" else OTHER]

        def rpc(name, args):
            with self.lock:
                self.rpc_calls.append((name, copy.deepcopy(args)))
                if name == self.rpc_fail:
                    raise HTTPException(503, "Synthetic transaction rollback")
                if name.endswith("issue_v1"):
                    if args["p_expected_revision"] != self.players[args["p_player"]]["auth_identity_revision"]:
                        return {"ok": False, "code": "target_changed"}
                    first = args["p_request"] not in self.requests
                    self.requests.setdefault(args["p_request"], {"hash": args["p_token_hash"], "status": "sending"})
                    return {"ok": True, "shouldSend": first, "status": self.requests[args["p_request"]]["status"],
                            "expiresAt": "2099-01-01T00:00:00Z"}
                if name.endswith("delivery_v1"):
                    item = next(item for item in self.requests.values() if item["hash"] == args["p_token_hash"])
                    item["status"] = "pending" if args["p_success"] else "failed"
                    return {"ok": True, "status": item["status"], "expiresAt": "2099-01-01T00:00:00Z"}
                if name.endswith("status_v1"):
                    return {"ok": True, "playerId": args["p_player"], "verified": False, "pending": False, "status": "none"}
                raise AssertionError(name)

        self.rpc = rpc
        fixture = self

        class Provider:
            def __init__(self, **kwargs):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def request(self, method, url, **kwargs):
                fixture.provider_calls.append((method, url, kwargs))
                return httpx.Response(fixture.provider_status, json={})

        self.app = FastAPI()
        recovery.install_admin_recovery(self.app, supabase_url="https://provider.invalid", supabase_key="synthetic-server-secret",
            tz=timezone.utc, db_select=select, auth_player=auth, db_rpc=rpc,
            enforce_rate_limit=lambda *a, **kw: self.limits.append((a, kw)), httpx_client_factory=Provider)
        # An independently installed route added afterwards is still protected.
        @self.app.get("/api/admin/push-diagnostics")
        @self.app.get("/api/quality-report")
        @self.app.get("/api/quality-history")
        def independent_route():
            return {"private": True}
        self.client = TestClient(self.app, base_url="https://hrajproplet.cz", headers={"Authorization": "Bearer owner"})

    def preview(self, path=PATH, **values):
        return self.client.post(path + "/preview", json={"email": EMAIL, "reason": REASON, **values})

    def send(self, token, path=PATH, **values):
        return self.client.post(path, json={"email": EMAIL, "reason": REASON, "confirmationToken": token, **values})

    def test_pinned_owner_protects_independent_routes_and_reads(self):
        for path in ("/api/admin/push-diagnostics", "/api/quality-report", "/api/quality-history", PATH):
            for bearer, expected in (("Bearer other", 403), ("Bearer invalid", 401)):
                self.assertEqual(self.client.get(path, headers={"Authorization": bearer}).status_code, expected)
        self.assertEqual(self.rpc_calls, [])
        self.grants[0]["active"] = False
        self.assertEqual(self.client.get(PATH).status_code, 403)

    def test_preview_is_nonmutating_and_confirmation_binds_all_inputs(self):
        shown = self.preview().json()
        self.assertEqual(shown["playerId"], TARGET)
        self.assertEqual(shown["emailMasked"], "sy***@example.invalid")
        self.assertNotIn(EMAIL, json.dumps(shown))
        self.assertEqual(self.provider_calls, [])
        self.assertEqual(self.rpc_calls, [])
        token = shown["confirmationToken"]
        for path, values in ((PATH, {"email": "changed@example.invalid"}), (PATH, {"reason": "Jiný důvod obnovy"}),
                             (PATH.replace(TARGET, SECOND), {})):
            self.assertEqual(self.send(token, path, **values).status_code, 409)
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        self.assertEqual(self.send(tampered).status_code, 409)
        self.players[TARGET]["auth_identity_revision"] = 1
        self.assertEqual(self.send(token).status_code, 409)
        self.assertEqual(self.provider_calls, [])
        self.assertEqual(self.rpc_calls, [])

    def test_expired_preview_and_foreign_origin_do_not_issue(self):
        token = self.preview().json()["confirmationToken"]
        with patch.object(recovery.time, "time", return_value=10**12):
            self.assertEqual(self.send(token).status_code, 409)
        self.assertEqual(self.client.post(PATH + "/preview", headers={"Origin": "https://evil.invalid"},
            json={"email": EMAIL, "reason": REASON}).status_code, 403)
        self.assertEqual(self.rpc_calls, [])

    def test_verified_target_and_other_verified_owner_are_not_overridden(self):
        for pid in (TARGET, SECOND):
            self.players[pid].update(email=EMAIL, email_verified_at="2026-01-01T00:00:00Z")
            response = self.preview(email="different@example.invalid" if pid == TARGET else EMAIL)
            self.assertEqual(response.status_code, 409)
            self.players[pid].pop("email")
            self.players[pid].pop("email_verified_at")
        self.players[TARGET].update(email=EMAIL, email_verified_at="2026-01-01T00:00:00Z")
        response = self.preview().json()
        self.assertTrue(response["alreadyVerified"])
        self.assertIsNone(response["confirmationToken"])
        self.assertEqual(self.provider_calls, [])

    def test_delivery_uses_hashed_uuid_bound_challenge_and_masked_output(self):
        token = self.preview(reason="Podpora pro synthetic@example.invalid").json()["confirmationToken"]
        sent = self.send(token, reason="Podpora pro synthetic@example.invalid")
        self.assertEqual(sent.status_code, 200, sent.text)
        self.assertEqual(sent.json()["status"], "pending")
        self.assertFalse(sent.json()["verified"])
        self.assertNotIn(EMAIL, sent.text)
        issue = self.rpc_calls[0][1]
        self.assertEqual(issue["p_player"], TARGET)
        self.assertEqual(issue["p_admin"], OWNER)
        self.assertNotIn(EMAIL, issue["p_reason"])
        method, url, call = self.provider_calls[0]
        self.assertEqual(method, "POST")
        self.assertTrue(url.endswith("/auth/v1/otp"))
        raw = parse_qs(urlparse(call["params"]["redirect_to"]).query)["challenge"][0]
        self.assertEqual(hashlib.sha256(raw.encode()).hexdigest(), issue["p_token_hash"])
        self.assertNotEqual(raw, issue["p_token_hash"])
        self.assertEqual(self.rpc_calls[1][1]["p_success"], True)

    def test_concurrent_same_confirmation_sends_at_most_once(self):
        token = self.preview().json()["confirmationToken"]
        with ThreadPoolExecutor(max_workers=5) as pool:
            responses = list(pool.map(lambda _: self.send(token), range(5)))
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertEqual(len(self.provider_calls), 1)
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(len({args["p_request"] for name, args in self.rpc_calls if name.endswith("issue_v1")}), 1)

    def test_issue_audit_or_revocation_failure_prevents_mail(self):
        self.rpc_fail = "proplet_auth_challenge_issue_v1"
        response = self.send(self.preview().json()["confirmationToken"])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.provider_calls, [])

    def test_delivery_failure_stays_inactive_even_if_cleanup_rolls_back(self):
        self.provider_status = 500
        response = self.send(self.preview().json()["confirmationToken"])
        self.assertEqual(response.status_code, 502)
        self.assertEqual(next(iter(self.requests.values()))["status"], "failed")
        self.rpc_fail = "proplet_auth_challenge_delivery_v1"
        response = self.send(self.preview().json()["confirmationToken"])
        self.assertEqual(response.status_code, 503)
        self.assertIn("sending", [item["status"] for item in self.requests.values()])

    def test_missing_rpc_fails_closed_and_preview_recipient_is_allowlisted(self):
        with self.assertRaises(HTTPException) as exc:
            AtomicChallenges(None).issue(TARGET, "link_email", EMAIL, 0)
        self.assertEqual(exc.exception.status_code, 503)
        with patch.dict("os.environ", {"PROPLET_ADMIN_PREVIEW_EMAIL": EMAIL}):
            require_test_mail_recipient(EMAIL, recovery.TEST_DATABASE, vercel_env="preview")
            with self.assertRaises(HTTPException):
                require_test_mail_recipient("elsewhere@example.invalid", recovery.TEST_DATABASE, vercel_env="preview")
            with self.assertRaises(HTTPException):
                require_test_mail_recipient(EMAIL, "https://production.invalid", vercel_env="preview")

    def test_shared_auth_callback_cannot_cross_deployment_environments(self):
        def client(environment, canonical, database):
            app = FastAPI()
            account_auth_core.install_account_auth(app, supabase_url=database, supabase_key="synthetic-secret",
                canonical_origin=canonical, vercel_env=environment, tz=timezone.utc,
                db_select=self.select, db_rpc=self.rpc, db_insert=lambda *a, **k: self.fail("unexpected insert"),
                db_update=lambda *a, **k: self.fail("unexpected update"), db_delete=lambda *a, **k: self.fail("unexpected delete"),
                auth_player=lambda _: self.players[TARGET], new_session=lambda _: "synthetic-token",
                hash_password=lambda _: "synthetic-hash", verify_password=lambda *a: True,
                enforce_rate_limit=lambda *a, **k: None, player_stats=lambda _: {},
                public_family_code=lambda *a: None, league_name_for=lambda *a: None)
            return TestClient(app, base_url=canonical)
        production = client("production", "https://hrajproplet.cz", "https://production.invalid")
        foreign = "proplet-foreign-pavel-prouzas-projects.vercel.app"
        self.assertEqual(production.post("/api/auth/recovery/start", json={"email": EMAIL},
            headers={"X-Forwarded-Host": foreign}).status_code, 400)
        self.assertEqual(production.get("/api/auth/google/start", headers={"X-Forwarded-Host": foreign}).status_code, 400)
        self.assertEqual(production.get("/api/auth/google/start", follow_redirects=False).status_code, 302)
        canonical = "https://proplet-exact-pavel-prouzas-projects.vercel.app"
        preview = client("preview", canonical, recovery.TEST_DATABASE)
        with patch.dict("os.environ", {"PROPLET_ADMIN_PREVIEW_ENABLED": "true"}):
            self.assertEqual(preview.post("/api/auth/recovery/start", json={"email": EMAIL},
                headers={"X-Forwarded-Host": "hrajproplet.cz"}).status_code, 400)
            started = preview.get("/api/auth/google/start", follow_redirects=False)
            self.assertEqual(started.status_code, 302)
            self.assertTrue(parse_qs(urlparse(started.headers["location"]).query)["redirect_to"][0].startswith(canonical + "/?"))
        self.assertEqual(self.rpc_calls, [])
        self.assertEqual(self.provider_calls, [])


if __name__ == "__main__":
    unittest.main()
