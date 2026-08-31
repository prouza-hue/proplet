#!/usr/bin/env python3
"""Characterize the existing account/session/team server contract for Sprint 12A."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
SERVER = (ROOT / "server.py").read_text(encoding="utf-8")
AUTH = (ROOT / "account_auth_core.py").read_text(encoding="utf-8")
INTEGRITY = (ROOT / "account_integrity_v33210.py").read_text(encoding="utf-8")


def require(source: str, pattern: str, label: str) -> None:
    assert re.search(pattern, source, re.S), label


# Routes and payload boundaries must not move or change as part of the frontend seam.
for source, route in (
    (SERVER, "/api/player"),
    (SERVER, "/api/login"),
    (INTEGRITY, "/api/login-integrity"),
    (SERVER, "/api/anonymous/claim"),
    (SERVER, "/api/logout"),
    (SERVER, "/api/me"),
    (SERVER, "/api/progress"),
    (SERVER, "/api/team-membership"),
    (SERVER, "/api/team-membership/leave"),
    (SERVER, "/api/team-pin"),
    (SERVER, "/api/team-settings"),
    (AUTH, "/api/account/auth-status"),
    (AUTH, "/api/account/display-name"),
    (AUTH, "/api/account/email/verify"),
    (AUTH, "/api/auth/recovery/reset"),
    (AUTH, "/api/auth/google/complete"),
):
    assert route in source, f"missing account contract route {route}"

# Custom sessions expire after 180 days; auth rejects and deletes an expired row.
require(SERVER, r"SECONDARY_SESSION_DAYS\s*=\s*180", "180-day session lifetime changed")
require(SERVER, r"timedelta\(days=SECONDARY_SESSION_DAYS\)", "session expiry calculation changed")
require(SERVER, r"Přihlášení vypršelo", "expired-session user message changed")
require(SERVER, r"player_sessions.*delete", "expired/logout session deletion missing")

# Recovery resets every prior session and returns one new token.
require(AUTH, r"player_sessions.*delete", "recovery no longer invalidates prior sessions")
require(AUTH, r"new_session", "recovery no longer issues a fresh session")

# Team leave keeps historical scoring attribution while ending current membership.
require(SERVER, r"left_at", "team leave membership history missing")
require(SERVER, r"team_joined_at", "team join/leave attribution timestamp missing")
require(
    SERVER,
    r'db_update\("team_memberships".*?\{"left_at": now\}\).*?'
    r'db_update\("players".*?\{"family_code": new_solo, "team_joined_at": None\}',
    "team leave no longer closes membership before moving the player to solo scope",
)

print("PASS: Sprint 12A account/session/team backend surface characterized")
