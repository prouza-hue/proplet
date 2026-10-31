#!/usr/bin/env python3
"""Characterize the existing account/session/team server contract for Sprint 12A."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
SERVER = (ROOT / "server.py").read_text(encoding="utf-8")
AUTH = (ROOT / "account_auth_core.py").read_text(encoding="utf-8")
INTEGRITY = (ROOT / "account_integrity_v33210.py").read_text(encoding="utf-8")
CHALLENGES = (ROOT / "supabase/migrations/20261028235549_admin_atomic_recovery.sql").read_text(encoding="utf-8")


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
require(AUTH, r'challenges.consume\(payload.challenge, "recover_password"', "recovery must use the atomic consume boundary")
require(CHALLENGES, r"delete from public.player_sessions where player_id=v_ch.player_id", "atomic recovery no longer invalidates prior sessions")
require(AUTH, r"new_session", "recovery no longer issues a fresh session")

# Team leave keeps historical scoring attribution while ending current membership.
require(SERVER, r"left_at", "team leave membership history missing")
require(SERVER, r"team_joined_at", "team join/leave attribution timestamp missing")
LEAVE = (ROOT / "supabase/migrations/20261030230000_team_leave_atomic.sql").read_text(encoding="utf-8")
require(SERVER, r'db_rpc\("proplet_team_leave_v1"', "team leave must use the atomic SQL boundary")
require(LEAVE, r'update public.team_memberships set left_at=v_now.*?update public.players set family_code=p_new_solo,team_joined_at=null',
        "team leave must retain historical attribution while moving the player to solo atomically")

print("PASS: Sprint 12A account/session/team backend surface characterized")
