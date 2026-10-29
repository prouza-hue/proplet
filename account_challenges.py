"""Single, fail-closed authority for mailbox challenges.

All state transitions run in service-only SQL RPCs. In particular a successfully
sent HTTP request alone never activates a challenge; delivery must commit with
its audit event. There is deliberately no client-side/non-atomic fallback.
"""
from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from typing import Callable

from fastapi import HTTPException


def token_digest(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def mask_email(raw: str | None) -> str | None:
    if not raw or "@" not in str(raw):
        return None
    local, domain = str(raw).split("@", 1)
    return f"{local[:1] if len(local) <= 2 else local[:2]}***@{domain}"


def require_test_mail_recipient(email: str, supabase_url: str, *, vercel_env: str | None = None) -> None:
    """The isolated admin preview may deliver only to its authorized mailbox."""
    environment = vercel_env if vercel_env is not None else os.environ.get("VERCEL_ENV", "")
    if environment == "preview" and (vercel_env is not None or os.environ.get("PROPLET_ADMIN_PREVIEW_ENABLED") == "true"):
        permitted = os.environ.get("PROPLET_ADMIN_PREVIEW_EMAIL", "").strip().casefold()
        if (supabase_url.rstrip("/") != "https://eanzztstmwlamwfdskbf.supabase.co"
                or not permitted or email != permitted):
            raise HTTPException(403, "Testovací prostředí může odesílat pouze do vyhrazené testovací schránky")


class AtomicChallenges:
    def __init__(self, db_rpc: Callable | None):
        self.db_rpc = db_rpc

    def rpc(self, name: str, values: dict) -> dict:
        if not callable(self.db_rpc):
            raise HTTPException(503, "Bezpečná obnova účtu ještě není připravená")
        try:
            data = self.db_rpc(name, values)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(503, "Obnova účtu je momentálně nedostupná") from exc
        if not isinstance(data, dict) or type(data.get("ok")) is not bool:
            raise HTTPException(503, "Bezpečná obnova účtu ještě není připravená")
        if not data["ok"]:
            code = data.get("code")
            status, message = {
                "not_found": (404, "Hráč neexistuje"),
                "forbidden": (403, "Obnovu účtu může provést pouze vlastník Propletu"),
                "target_changed": (409, "Identita účtu se změnila. Načti nový náhled obnovy."),
                "email_conflict": (409, "Tento e-mail už používá jiný ověřený účet"),
                "target_verified": (409, "Účet už má ověřený jiný e-mail"),
                "invalid": (400, "Odkaz je neplatný, vypršel nebo už byl použit"),
                "not_ready": (409, "Odkaz zatím není připravený. Zkus to za chvíli."),
                "delivery_failed": (409, "Odeslání se nezdařilo. Připrav nový náhled obnovy."),
                "bad_email": (401, "Ověřovací e-mail nesedí"),
            }.get(code, (503, "Obnova účtu je momentálně nedostupná"))
            raise HTTPException(status, message)
        return data

    def issue(self, player_id: str, purpose: str, email: str, revision: int, *,
              raw: str | None = None, request_id: str | None = None,
              admin_id: str | None = None, reason: str | None = None) -> tuple[str, dict]:
        raw = raw or secrets.token_urlsafe(32)
        result = self.rpc("proplet_auth_challenge_issue_v1", {
            "p_player": player_id, "p_purpose": purpose, "p_email": email,
            "p_token_hash": token_digest(raw), "p_request": request_id or str(uuid.uuid4()),
            "p_expected_revision": revision, "p_admin": admin_id, "p_reason": reason,
        })
        return raw, result

    def delivery(self, raw: str, *, success: bool) -> dict:
        return self.rpc("proplet_auth_challenge_delivery_v1", {
            "p_token_hash": token_digest(raw), "p_success": success,
        })

    def check(self, raw: str, purpose: str, email: str) -> dict:
        return self.rpc("proplet_auth_challenge_check_v1", {
            "p_token_hash": token_digest(raw), "p_purpose": purpose, "p_email": email,
        })

    def consume(self, raw: str, purpose: str, user: dict, *, password_hash: str | None = None,
                session_token_hash: str | None = None) -> dict:
        return self.rpc("proplet_auth_challenge_consume_v1", {
            "p_token_hash": token_digest(raw), "p_purpose": purpose,
            "p_auth_user": str(user["id"]), "p_email": str(user["email"]).strip().casefold(),
            "p_password_hash": password_hash, "p_session_token_hash": session_token_hash,
        })
