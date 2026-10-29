"""Owner-only, UUID-bound support recovery; no direct identity overrides."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx
from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from account_challenges import AtomicChallenges, mask_email, require_test_mail_recipient


ADMIN_OWNER_PLAYER_ID = "e1740794-d196-48da-a59a-2741eadb8e44"
TEST_DATABASE = "https://eanzztstmwlamwfdskbf.supabase.co"
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
EMAIL_IN_TEXT = re.compile(r"[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+")


class AdminRecoveryPreview(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    reason: str = Field(min_length=8, max_length=500)


class AdminRecoveryEmailRequest(AdminRecoveryPreview):
    confirmationToken: str = Field(min_length=40, max_length=2048)


def _email(value: str) -> str:
    result = value.strip().casefold()
    if len(result) > 254 or not EMAIL_RE.fullmatch(result):
        raise HTTPException(400, "Zadej platnou e-mailovou adresu")
    return result


def _reason(value: str) -> str:
    result = " ".join(value.split())
    if len(result) < 8:
        raise HTTPException(400, "Doplň stručný důvod obnovy alespoň osmi znaky")
    return result


def _safe_reason(value: str) -> str:
    return EMAIL_IN_TEXT.sub(lambda match: mask_email(match.group()) or "[e-mail]", value)


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def install_admin_recovery(app, *, supabase_url: str, supabase_key: str, tz,
                           db_select: Callable, auth_player: Callable,
                           enforce_rate_limit: Callable, db_rpc: Callable | None,
                           canonical_origin: str = "https://hrajproplet.cz",
                           vercel_env: str = "production", strict_owner_lock: bool = True,
                           httpx_client_factory: Callable | None = None) -> None:
    challenges = AtomicChallenges(db_rpc)

    def actor(authorization: Optional[str]) -> dict:
        player = auth_player(authorization)
        player_id = str(player.get("id") or "")
        if strict_owner_lock and player_id != ADMIN_OWNER_PLAYER_ID:
            raise HTTPException(403, "Administrace je dostupná pouze vlastníkovi Propletu")
        grants = db_select("admin_accounts", player_id=player_id)
        grant = next((row for row in grants if row.get("active") is True and row.get("role") == "owner"), None)
        if not grant:
            raise HTTPException(403, "Vlastnické oprávnění administrace není aktivní")
        return {"player": player, "account": grant, "role": "owner"}

    @app.middleware("http")
    async def proplet_owner_only_admin(request: Request, call_next):
        path = request.url.path
        protected = (path == "/api/admin" or path.startswith("/api/admin/")
                     or path in {"/api/quality-report", "/api/quality-history"})
        if strict_owner_lock and protected and request.method != "OPTIONS":
            try:
                request.state.proplet_admin_owner = actor(request.headers.get("authorization"))
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail},
                                    headers={"Cache-Control": "no-store"})
        response = await call_next(request)
        if protected:
            response.headers["Cache-Control"] = "no-store"
        return response

    def owner(request: Request, authorization: Optional[str]) -> dict:
        return getattr(request.state, "proplet_admin_owner", None) or actor(authorization)

    def target(player_id: str) -> dict:
        try:
            parsed_id = str(uuid.UUID(player_id))
        except ValueError as exc:
            raise HTTPException(400, "Neplatné ID hráče") from exc
        if parsed_id != player_id:
            raise HTTPException(400, "Použij celé kanonické ID hráče")
        players = db_select("players", id=player_id)
        if not players:
            raise HTTPException(404, "Hráč neexistuje")
        return players[0]

    def origin(request: Request) -> str:
        value = str(canonical_origin or "").rstrip("/")
        parsed = urlparse(value)
        valid = (parsed.scheme == "https" and not parsed.username and not parsed.password
                 and not parsed.port and parsed.path == "" and not parsed.query and not parsed.fragment)
        if vercel_env == "production":
            valid = valid and value == "https://hrajproplet.cz"
        elif vercel_env == "preview":
            valid = (valid and supabase_url.rstrip("/") == TEST_DATABASE
                     and bool(parsed.hostname) and parsed.hostname.endswith("-pavel-prouzas-projects.vercel.app"))
        else:
            valid = False
        if not valid or not supabase_key:
            raise HTTPException(503, "Bezpečná adresa obnovy pro toto prostředí není připravená")
        supplied_origin = request.headers.get("origin")
        if supplied_origin and supplied_origin != value:
            raise HTTPException(403, "Obnovu zahaj přímo v této administraci")
        return value

    def signature(body: str) -> str:
        return _b64(hmac.new(supabase_key.encode(), ("proplet-admin-recovery-confirm-v1:" + body).encode(), hashlib.sha256).digest())

    def issue_confirmation(player: dict, admin: dict, email: str, reason: str, callback: str) -> tuple[str, int]:
        expiry = int(time.time()) + 300
        payload = {"v": 1, "player": player["id"], "actor": admin["player"]["id"],
                   "revision": int(player.get("auth_identity_revision") or 0),
                   "email": hashlib.sha256(email.encode()).hexdigest(),
                   "reason": hashlib.sha256(reason.encode()).hexdigest(),
                   "origin": callback, "request": str(uuid.uuid4()), "exp": expiry}
        body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
        return body + "." + signature(body), expiry

    def read_confirmation(raw: str, player: dict, admin: dict, email: str, reason: str, callback: str) -> dict:
        try:
            body, supplied = raw.split(".")
            if not hmac.compare_digest(signature(body), supplied):
                raise ValueError("signature")
            payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
            expected = {"v": 1, "player": player["id"], "actor": admin["player"]["id"],
                        "revision": int(player.get("auth_identity_revision") or 0), "origin": callback,
                        "email": hashlib.sha256(email.encode()).hexdigest(),
                        "reason": hashlib.sha256(reason.encode()).hexdigest()}
            if (any(payload.get(key) != value for key, value in expected.items())
                    or not isinstance(payload.get("exp"), int) or payload["exp"] <= time.time()
                    or payload["exp"] > time.time() + 301):
                raise ValueError("stale")
            uuid.UUID(payload["request"])
            return payload
        except (ValueError, KeyError, TypeError, UnicodeError) as exc:
            raise HTTPException(409, "Náhled obnovy vypršel nebo se změnil. Připrav nový.") from exc

    def validate_email(player: dict, email: str) -> bool:
        require_test_mail_recipient(email, supabase_url, vercel_env=vercel_env)
        verified = bool(player.get("email") and player.get("email_verified_at"))
        if verified and str(player["email"]).casefold() != email:
            raise HTTPException(409, "Účet už má ověřený jiný e-mail")
        for candidate in db_select("players", email=email):
            if candidate.get("id") != player["id"] and candidate.get("email_verified_at"):
                raise HTTPException(409, "Tento e-mail už používá jiný ověřený účet")
        return verified

    @app.get("/api/admin/users/{player_id}/recovery-email")
    def recovery_status(player_id: str, request: Request, authorization: Optional[str] = Header(default=None)):
        admin = owner(request, authorization)
        target(player_id)
        return challenges.rpc("proplet_auth_challenge_status_v1", {
            "p_player": player_id, "p_admin": admin["player"]["id"],
        })

    @app.post("/api/admin/users/{player_id}/recovery-email/preview")
    def recovery_preview(player_id: str, payload: AdminRecoveryPreview, request: Request,
                         authorization: Optional[str] = Header(default=None)):
        admin = owner(request, authorization)
        enforce_rate_limit(request, "admin_recovery_preview", limit=60, window_seconds=3600)
        callback = origin(request)
        player = target(player_id)
        email, reason = _email(payload.email), _reason(payload.reason)
        already = validate_email(player, email)
        confirmation, expiry = (None, None) if already else issue_confirmation(player, admin, email, reason, callback)
        return {"ok": True, "playerId": player_id, "playerName": player.get("name"),
                "emailMasked": mask_email(email), "reason": _safe_reason(reason), "alreadyVerified": already,
                "confirmationToken": confirmation,
                "confirmationExpiresAt": datetime.fromtimestamp(expiry, timezone.utc).isoformat() if expiry else None}

    @app.post("/api/admin/users/{player_id}/recovery-email")
    def recovery_send(player_id: str, payload: AdminRecoveryEmailRequest, request: Request,
                      authorization: Optional[str] = Header(default=None)):
        admin = owner(request, authorization)
        callback = origin(request)
        player = target(player_id)
        email, reason = _email(payload.email), _reason(payload.reason)
        confirmation = read_confirmation(payload.confirmationToken, player, admin, email, reason, callback)
        if validate_email(player, email):
            return {"ok": True, "playerId": player_id, "status": "verified", "alreadyVerified": True,
                    "verified": True, "pending": False, "emailMasked": mask_email(email),
                    "message": "Tento e-mail už je ověřený. Běžná obnova hesla funguje."}
        enforce_rate_limit(request, "admin_legacy_recovery_email", limit=12, window_seconds=3600, discriminator=player_id)
        # A confirmation is also the idempotency key; no plaintext token is stored
        # and retries cannot create or send another link with the same key.
        raw = _b64(hmac.new(supabase_key.encode(), ("proplet-admin-mail-v1:" + payload.confirmationToken).encode(), hashlib.sha256).digest())
        raw, issued = challenges.issue(player_id, "link_email", email, confirmation["revision"],
                                       raw=raw, request_id=confirmation["request"],
                                       admin_id=admin["player"]["id"], reason=_safe_reason(reason))
        if issued.get("alreadyVerified"):
            return {"ok": True, "playerId": player_id, "status": "verified", "alreadyVerified": True,
                    "verified": True, "pending": False, "emailMasked": mask_email(email),
                    "message": "Tento e-mail už je ověřený. Běžná obnova hesla funguje."}
        if issued.get("shouldSend"):
            try:
                factory = httpx_client_factory or httpx.Client
                with factory(timeout=12.0, follow_redirects=False) as client:
                    response = client.request("POST", f"{supabase_url.rstrip('/')}/auth/v1/otp",
                        headers={"apikey": supabase_key, "Content-Type": "application/json", "Accept": "application/json"},
                        params={"redirect_to": f"{callback}/?auth=email-link&challenge={raw}"},
                        json={"email": email, "create_user": True})
                if response.status_code >= 400:
                    raise HTTPException(502, "Ověřovací e-mail se nepodařilo odeslat")
            except (httpx.HTTPError, HTTPException) as exc:
                # Even if cleanup cannot commit, 'sending' is inactive forever
                # until a successful audited delivery transition is committed.
                challenges.delivery(raw, success=False)
                raise HTTPException(502, "Ověřovací e-mail se nepodařilo odeslat") from exc
            issued = challenges.delivery(raw, success=True)
        status = issued.get("status", "pending")
        return {"ok": True, "playerId": player_id, "status": status,
                "pending": status in {"pending", "sending"}, "verified": False,
                "emailMasked": mask_email(email), "expiresAt": issued.get("expiresAt"),
                "message": ("Ověřovací odkaz byl odeslaný. E-mail se připojí až po kliknutí."
                            if status == "pending" else "Odeslání se zpracovává. Obnov stav účtu.")}
