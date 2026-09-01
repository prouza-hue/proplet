#!/usr/bin/env python3
"""Characterize account identity semantics before bounded lookup changes."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI, HTTPException
from starlette.requests import Request

import account_auth_core
from account_auth_core import EmailStart, RecoveryStart, install_account_auth
from account_integrity_v33210 import IntegrityLogin, install_account_integrity


TZ = timezone.utc


def request(path: str) -> Request:
    return Request({"type": "http", "method": "POST", "path": path, "headers": [(b"host", b"hrajproplet.cz")], "scheme": "https", "server": ("hrajproplet.cz", 443)})


def route(app: FastAPI, path: str):
    return next(item.endpoint for item in app.routes if item.path == path)


def player(pid, name, family, password="password", *, email=None, verified=False, created="2026-01-01T00:00:00+00:00"):
    return {
        "id": pid,
        "name": name,
        "family_code": family,
        "password_hash": password,
        "email": email,
        "email_verified_at": created if verified else None,
        "created_at": created,
        "team_joined_at": created,
        "support_mode": "none",
    }


players = [
    player("p1", "Pavel", "PROUZA", "password1", email="pavel@example.com", verified=True),
    player("p2", "Pavel", "OTHER", "password2", created="2026-02-01T00:00:00+00:00"),
    player("p3", "Case Name", "SOLO_A", "casepass"),
    player("p4", "Unverified", "SOLO_B", "hiddenpass", email="hidden@example.com", verified=False),
]


def select_rows(table, **filters):
    if table != "players":
        return []
    rows = list(players)
    for key, value in filters.items():
        rows = [row for row in rows if row.get(key) == value]
    return rows


def bounded_select(table, *, filters=None, columns="*", order=None, max_rows=5000):
    assert table == "players"
    rows = list(players)
    for key, condition in (filters or {}).items():
        if condition.startswith("eq."):
            expected = condition[3:]
            rows = [row for row in rows if str(row.get(key) or "") == expected]
        elif condition.startswith("ilike."):
            expected = condition[6:].casefold()
            rows = [row for row in rows if str(row.get(key) or "").casefold() == expected]
        else:
            raise AssertionError(f"unexpected filter: {key}={condition}")
    assert len(rows) <= max_rows
    return rows


app = FastAPI()
install_account_integrity(
    app,
    tz=TZ,
    db_select=select_rows,
    db_select_bounded=bounded_select,
    auth_player=lambda _auth: players[0],
    new_session=lambda pid: f"token:{pid}",
    verify_password=lambda supplied, stored: supplied == stored,
    enforce_rate_limit=lambda *args, **kwargs: None,
    player_stats=lambda _pid: {},
    public_family_code=lambda family, _joined: family,
    league_name_for=lambda family: family,
    norm_family=lambda family: family.strip().upper(),
)
login = route(app, "/api/login-integrity")

# Name login is case-insensitive.
result = login(IntegrityLogin(name="case name", password="casepass"), request("/api/login-integrity"))
assert result["id"] == "p3"

# Duplicate names without family remain ambiguous when both passwords match.
try:
    login(IntegrityLogin(name="PAVEL", password="password1"), request("/api/login-integrity"))
except HTTPException as exc:
    # Only p1 matches this password, so this is deliberately not ambiguous.
    assert exc.status_code != 409
else:
    pass

duplicate_players = [
    player("d1", "Dup", "A", "samepass", created="2026-01-01T00:00:00+00:00"),
    player("d2", "Dup", "B", "samepass", created="2026-03-01T00:00:00+00:00"),
]
old_players = list(players)
players[:] = duplicate_players
try:
    try:
        login(IntegrityLogin(name="dup", password="samepass"), request("/api/login-integrity"))
        raise AssertionError("duplicate name without family must require disambiguation")
    except HTTPException as exc:
        assert exc.status_code == 409
    result = login(IntegrityLogin(name="DUP", family_code="b", password="samepass"), request("/api/login-integrity"))
    assert result["id"] == "d2"
finally:
    players[:] = old_players

# Verified email is a login identifier; an unverified email is not.
result = login(IntegrityLogin(name="PAVEL@EXAMPLE.COM", password="password1"), request("/api/login-integrity"))
assert result["id"] == "p1"
try:
    login(IntegrityLogin(name="hidden@example.com", password="hiddenpass"), request("/api/login-integrity"))
    raise AssertionError("unverified email must not be a login identifier")
except HTTPException as exc:
    assert exc.status_code == 401


# Characterize verified-email ownership used by linking and recovery.
class FakeClient:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return SimpleNamespace(status_code=200, content=b"{}", json=lambda: {})


core_players = [
    player("self", "Self", "SOLO_SELF", "selfpass"),
    player("owner", "Owner", "SOLO_OWNER", "ownerpass", email="owned@example.com", verified=True),
    player("unverified", "Unverified", "SOLO_U", "unverifiedpass", email="free@example.com", verified=False),
]
inserted = []


def core_select(table, **filters):
    if table == "players":
        rows = list(core_players)
    elif table == "account_auth_challenges":
        rows = list(inserted)
    else:
        rows = []
    for key, value in filters.items():
        rows = [row for row in rows if row.get(key) == value]
    return rows


def core_bounded_select(table, *, filters=None, columns="*", order=None, max_rows=5000):
    assert table == "players"
    rows = list(core_players)
    for key, condition in (filters or {}).items():
        assert condition.startswith("eq.")
        expected = condition[3:]
        rows = [row for row in rows if str(row.get(key) or "") == expected]
    assert len(rows) <= max_rows
    return rows


def core_insert(table, row):
    if table == "account_auth_challenges":
        inserted.append(dict(row))
    return row


core_app = FastAPI()
original_client = account_auth_core.httpx.Client
account_auth_core.httpx.Client = FakeClient
try:
    install_account_auth(
        core_app,
        supabase_url="https://example.supabase.co",
        supabase_key="secret",
        tz=TZ,
        db_select=core_select,
        db_select_bounded=core_bounded_select,
        db_insert=core_insert,
        db_update=lambda *args, **kwargs: None,
        db_delete=lambda *args, **kwargs: None,
        auth_player=lambda _auth: core_players[0],
        new_session=lambda pid: f"token:{pid}",
        hash_password=lambda value: value,
        verify_password=lambda a, b: a == b,
        enforce_rate_limit=lambda *args, **kwargs: None,
        player_stats=lambda _pid: {},
        public_family_code=lambda family, _joined: family,
        league_name_for=lambda family: family,
    )
    email_start = route(core_app, "/api/account/email/start")
    recovery_start = route(core_app, "/api/auth/recovery/start")

    try:
        email_start(EmailStart(email="OWNED@example.com"), request("/api/account/email/start"), None)
        raise AssertionError("verified email owner must block account linking")
    except HTTPException as exc:
        assert exc.status_code == 409

    # Same email on an unverified row does not claim ownership.
    linked = email_start(EmailStart(email="FREE@example.com"), request("/api/account/email/start"), None)
    assert linked["ok"] is True

    calls_before = len(FakeClient.calls)
    generic = recovery_start(RecoveryStart(email="hidden@example.com"), request("/api/auth/recovery/start"))
    assert generic["ok"] is True
    assert len(FakeClient.calls) == calls_before, "unverified email must not trigger recovery delivery"

    recovery_start(RecoveryStart(email="owned@example.com"), request("/api/auth/recovery/start"))
    assert len(FakeClient.calls) == calls_before + 1, "verified owner must trigger recovery delivery"
finally:
    account_auth_core.httpx.Client = original_client

print("PASS: final-debt account identity semantics characterized")
