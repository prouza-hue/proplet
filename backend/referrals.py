"""Server-owned referral transport and signup provenance.

Bonus eligibility is recorded by database triggers, never by browser counters.
Disabling acquisition stops new invitations; existing promises may still finish.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
import os
import re
import secrets
from typing import Optional

from fastapi import Header, HTTPException, Request
from backend.config import live_player_preview_enabled

PRODUCTION_PROJECT = "iopyhluayfszskyqqpuc"
CODE_RE = re.compile(r"^[A-Za-z0-9_-]{8,80}$")
signup_invite: ContextVar[Optional[str]] = ContextVar("proplet_signup_invite", default=None)
REWARD_XP = 1000
REQUIRED_BOARDS = 5


def enabled() -> bool:
    if os.getenv("PROPLET_REFERRALS_ENABLED", "false").lower() != "true":
        return False
    # Ordinary Vercel previews historically share the production database.
    return not (
        os.getenv("VERCEL_ENV", "").lower() == "preview"
        and PRODUCTION_PROJECT in os.getenv("SUPABASE_URL", "")
        and not live_player_preview_enabled()
    )


def normalize_code(code: str) -> str:
    value = str(code or "").strip()
    if not CODE_RE.fullmatch(value):
        raise HTTPException(400, "Pozvánka nemá platný kód")
    return value


def require_enabled() -> None:
    if not enabled():
        raise HTTPException(503, "Pozvánky s bonusem zatím nejsou dostupné")


def rpc_object(rpc, name: str, body: dict) -> dict:
    value = rpc(name, body)
    if isinstance(value, list) and len(value) == 1:
        value = value[0]
    if not isinstance(value, dict):
        raise HTTPException(503, "Pozvánky jsou momentálně nedostupné")
    return value


def public_invite(code: str, rpc) -> dict:
    require_enabled()
    code = normalize_code(code)
    value = rpc_object(rpc, "proplet_referral_public_v1", {"p_code": code})
    if not value.get("ok"):
        raise HTTPException(404, "Tahle pozvánka už není dostupná")
    return value


@contextmanager
def signup_context(code: Optional[str], rpc=None):
    """Only a genuine players INSERT can claim this request's validated invite.

    Context-local state cannot leak into another parallel registration. The DB
    trigger creates attribution in the same transaction as the new player.
    """
    value = None
    if code:
        if rpc is None:
            raise HTTPException(503, "Pozvánku nyní nejde ověřit")
        value = public_invite(code, rpc)["code"]
    token = signup_invite.set(value)
    try:
        yield
    finally:
        signup_invite.reset(token)


def install(app, *, auth_player, db_rpc, enforce_rate_limit):
    @app.get("/api/referrals")
    def status(request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "referral_status", limit=120, window_seconds=3600)
        player = auth_player(authorization)
        # Prevent even state-changing RPCs on a preview connected to production.
        if not enabled():
            return {"ok": True, "enabled": False, "invite": None, "incoming": None, "referrals": []}
        data = rpc_object(db_rpc, "proplet_referral_status_v1", {"p_player": player["id"]})
        data["enabled"] = True
        return data

    @app.post("/api/referrals/invite")
    def create(request: Request, authorization: Optional[str] = Header(default=None)):
        require_enabled()
        enforce_rate_limit(request, "referral_create", limit=30, window_seconds=3600)
        player = auth_player(authorization)
        code = secrets.token_urlsafe(24)
        data = rpc_object(db_rpc, "proplet_referral_create_v1", {"p_player": player["id"], "p_code": code})
        return data

    @app.get("/api/referrals/invite/{code}")
    def inspect(code: str, request: Request):
        enforce_rate_limit(request, "referral_public", limit=120, window_seconds=3600)
        return public_invite(code, db_rpc)

    @app.post("/api/referrals/dismiss")
    def dismiss(request: Request, authorization: Optional[str] = Header(default=None)):
        require_enabled()
        enforce_rate_limit(request, "referral_dismiss", limit=60, window_seconds=3600)
        player = auth_player(authorization)
        return rpc_object(db_rpc, "proplet_referral_dismiss_v1", {"p_player": player["id"]})

    return app
