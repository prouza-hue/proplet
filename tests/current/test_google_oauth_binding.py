"""Real HTTP routes against an isolated, atomic PKCE provider model.

No live accounts, credentials or database writes. Provider redemption semantics
are external; these tests verify that the app cannot bypass that boundary.
"""
import copy
import hashlib
import secrets
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
import test_account_identity_boundary as fixture
from backend import google_oauth


class Provider:
    def __init__(self, user):
        self.user = user
        self.codes = {}
        self.lock = threading.Lock()
        self.redemptions = 0
        self.calls = []

    def authorize(self, url):
        query = parse_qs(urlparse(url).query)
        assert query["code_challenge_method"] == ["s256"]
        code = secrets.token_urlsafe(32)
        self.codes[code] = query["code_challenge"][0]
        state = parse_qs(urlparse(query["redirect_to"][0]).query)["state"][0]
        return {"code": code, "state": state}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def request(self, method, url, **kwargs):
        self.calls.append((method, url))
        if url.endswith("/auth/v1/token"):
            assert kwargs["params"] == {"grant_type": "pkce"}
            body = kwargs["json"]
            actual = google_oauth.b64(hashlib.sha256(body["code_verifier"].encode()).digest())
            with self.lock:
                expected = self.codes.get(body["auth_code"])
                if not expected or actual != expected:
                    return httpx.Response(400, json={"error": "Invalid or consumed code"})
                del self.codes[body["auth_code"]]
                self.redemptions += 1
            return httpx.Response(200, json={"access_token": "provider-token"})
        assert method == "GET" and url.endswith("/auth/v1/user")
        assert kwargs["headers"]["Authorization"] == "Bearer provider-token"
        return httpx.Response(200, json=self.user)


class GoogleBindingTests(unittest.TestCase):
    def setUp(self):
        self.h = fixture.IdentityBoundaryTests()
        self.h.setUp()
        self.client = self.h.client
        self.provider = Provider(self.h.user)
        self.mock = patch.object(fixture.auth.httpx, "Client", return_value=self.provider)
        self.mock.start()
        self.addCleanup(self.mock.stop)

    def start(self, link=False, client=None):
        client = client or self.client
        if link:
            response = client.post("/api/auth/google/link/start", json={"password": "correct-password"},
                                   headers={"Authorization": "Bearer owner"})
            self.assertEqual(response.status_code, 200, response.text)
            url = response.json()["url"]
        else:
            response = client.get("/api/auth/google/start", follow_redirects=False)
            self.assertEqual(response.status_code, 302)
            url = response.headers["location"]
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertIn("Secure", response.headers["set-cookie"])
        self.assertIn("SameSite=lax", response.headers["set-cookie"])
        self.assertNotIn("Domain=", response.headers["set-cookie"])
        self.assertEqual(response.headers["cache-control"], "no-store")
        return self.provider.authorize(url)

    def complete(self, payload, bearer=None, client=None):
        return (client or self.client).post("/api/auth/google/complete", json=payload,
            headers={"Authorization": bearer} if bearer else {})

    def assert_unchanged(self):
        self.assertNotIn("auth_user_id", self.h.owner)
        self.assertEqual(self.h.writes, [])
        self.assertEqual(self.h.sessions, [])

    def test_original_attacker_token_attack_is_rejected(self):
        self.h.user.update(id="attacker", email="attacker@example.invalid")
        payload = {"accessToken": "attacker-token" * 8}
        self.assertEqual(self.complete(payload, "Bearer owner").status_code, 422)
        self.assertEqual(self.complete(payload).status_code, 422)
        self.assert_unchanged()
        self.assertEqual(self.provider.calls, [])

    def test_missing_wrong_tampered_expired_and_foreign_state(self):
        payload = self.start()
        cookie = self.client.cookies.get(google_oauth.COOKIE)
        cases = [None, cookie[:-1] + ("0" if cookie[-1] != "0" else "1")]
        for value in cases:
            self.client.cookies.clear()
            if value:
                self.client.cookies.set(google_oauth.COOKIE, value)
            self.assertEqual(self.complete(payload).status_code, 400)
        self.client.cookies.clear()
        self.client.cookies.set(google_oauth.COOKIE, cookie)
        self.assertEqual(self.complete({**payload, "state": "x" * 43}).status_code, 400)
        with patch.object(google_oauth.time, "time", return_value=10**12):
            self.assertEqual(self.complete(payload).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/google/complete", json=payload,
            headers={"Origin": "https://evil.invalid"}).status_code, 403)
        # A valid signed transaction cannot be moved to another allowed origin.
        self.assertEqual(self.client.post("/api/auth/google/complete", json=payload,
            headers={"Origin": "https://www.hrajproplet.cz", "X-Forwarded-Host": "www.hrajproplet.cz"}).status_code, 400)
        self.assertEqual(self.provider.calls, [])
        self.assert_unchanged()

    def test_login_never_links_incidental_player(self):
        self.h.user.update(id="attacker", email="attacker@example.invalid")
        response = self.complete(self.start(), "Bearer owner")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["linked"])
        self.assertNotEqual(response.json()["profile"]["id"], "owner")
        self.assertNotIn("auth_user_id", self.h.owner)
        self.assertNotIn("owner", self.h.sessions)

    def test_link_requires_password_and_same_origin(self):
        for password, bearer, origin, expected in [
            ("wrong-password", "Bearer owner", "https://hrajproplet.cz", 401),
            ("correct-password", "Bearer invalid", "https://hrajproplet.cz", 401),
            ("correct-password", "Bearer owner", "https://evil.invalid", 403),
        ]:
            response = self.client.post("/api/auth/google/link/start", json={"password": password},
                headers={"Authorization": bearer, "Origin": origin})
            self.assertEqual(response.status_code, expected)
            self.assertNotIn("set-cookie", response.headers)
        self.assert_unchanged()

    def test_link_bound_to_exact_player_and_session(self):
        payload = self.start(link=True)
        for bearer in [None, "Bearer other", "Bearer owner-second", "Bearer invalid"]:
            self.assertEqual(self.complete(payload, bearer).status_code, 401)
        self.assertEqual(self.provider.calls, [])
        self.assert_unchanged()
        response = self.complete(payload, "Bearer owner")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()["linked"])
        self.assertEqual(self.h.owner["auth_user_id"], "auth-owner")
        self.assertEqual(self.h.sessions, ["owner"])

    def test_code_substitution_and_overlapping_flows_fail_closed(self):
        first = self.start(link=True)
        second = self.start(link=True)
        self.assertNotEqual(first["state"], second["state"])
        self.assertEqual(self.complete(first, "Bearer owner").status_code, 400)
        self.assertEqual(self.complete({**second, "code": first["code"]}, "Bearer owner").status_code, 400)
        self.assert_unchanged()
        self.assertEqual(self.complete(second, "Bearer owner").status_code, 200)

    def test_replay_even_with_restored_cookie_is_rejected(self):
        payload = self.start()
        cookie = self.client.cookies.get(google_oauth.COOKIE)
        self.assertEqual(self.complete(payload).status_code, 200)
        self.assertIsNone(self.client.cookies.get(google_oauth.COOKIE))
        before = copy.deepcopy(self.h.tables)
        self.assertEqual(self.complete(payload).status_code, 400)
        self.client.cookies.set(google_oauth.COOKIE, cookie)
        self.assertEqual(self.complete(payload).status_code, 400)
        self.assertEqual(self.h.tables, before)
        self.assertEqual(self.h.sessions, ["owner"])
        self.assertEqual(self.provider.redemptions, 1)

    def test_concurrent_completion_across_app_instances_issues_one_session(self):
        payload = self.start()
        cookie = self.client.cookies.get(google_oauth.COOKIE)
        # A separately installed app has no shared Python state. The provider
        # must still be consulted before any mapping or session is issued.
        other = fixture.IdentityBoundaryTests()
        other.setUp()
        other.client.cookies.set(google_oauth.COOKIE, cookie)
        with ThreadPoolExecutor(2) as pool:
            responses = list(pool.map(lambda client: self.complete(payload, client=client), [self.client, other.client]))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 400])
        self.assertEqual(len(self.h.sessions) + len(other.sessions), 1)
        self.assertEqual(self.provider.redemptions, 1)


if __name__ == "__main__":
    unittest.main()
