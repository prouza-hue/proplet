from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Callable, Optional

import httpx
from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse


# Proplet administration is intentionally personal, not delegable by adding a
# row to admin_accounts. Changing the deployed owner therefore requires a
# reviewed code change as well as a database grant.
ADMIN_OWNER_PLAYER_ID = "e1740794-d196-48da-a59a-2741eadb8e44"
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AdminRecoveryEmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


def _norm_email(raw: str) -> str:
    email = str(raw or "").strip().casefold()
    if not _EMAIL_RE.fullmatch(email):
        raise HTTPException(400, "Zadej platnou e-mailovou adresu")
    return email


def _mask_email(raw: Optional[str]) -> Optional[str]:
    if not raw or "@" not in str(raw):
        return None
    local, domain = str(raw).split("@", 1)
    visible = local[:1] if len(local) <= 2 else local[:2]
    return f"{visible}***@{domain}"


def install_admin_recovery(
    app,
    *,
    supabase_url: str,
    supabase_key: str,
    tz,
    db_select: Callable,
    db_insert: Callable,
    db_update: Callable,
    auth_player: Callable,
    enforce_rate_limit: Callable,
    canonical_origin: str = "https://hrajproplet.cz",
    strict_owner_lock: bool = True,
    httpx_client_factory: Callable = httpx.Client,
) -> None:
    """Install a non-delegable admin gate and support-assisted email recovery.

    The admin never marks an email as verified. It can only issue a link_email
    challenge for a stable player_id. The existing public account callback then
    verifies control of the mailbox through Supabase Auth before linking it.

    ``strict_owner_lock`` is enabled for Vercel preview/production. Local test
    harnesses may disable it so their synthetic admin IDs keep working.
    """

    origin = str(canonical_origin or "https://hrajproplet.cz").rstrip("/")

    def active_grant(player_id: str) -> Optional[dict]:
        return next(
            (row for row in db_select("admin_accounts", player_id=player_id) if row.get("active") is True),
            None,
        )

    def require_admin_actor(authorization: Optional[str], *, owner_only: bool = False) -> dict:
        player = auth_player(authorization)
        player_id = str(player.get("id") or "")
        if strict_owner_lock and player_id != ADMIN_OWNER_PLAYER_ID:
            raise HTTPException(403, "Administrace je dostupná pouze vlastníkovi Propletu")
        grant = active_grant(player_id)
        if not grant:
            raise HTTPException(403, "Tento hráč nemá přístup do administrace")
        role = str(grant.get("role") or "viewer")
        if strict_owner_lock and role != "owner":
            raise HTTPException(403, "Vlastnické oprávnění administrace není aktivní")
        if owner_only and role != "owner":
            raise HTTPException(403, "Obnovu účtu může provést pouze vlastník Propletu")
        return {"player": player, "account": grant, "role": role}

    @app.middleware("http")
    async def proplet_owner_only_admin(request: Request, call_next):
        # Keep the static /admin shell loadable; every deployed admin API read or
        # write is additionally pinned to the single immutable owner player_id.
        if strict_owner_lock and request.url.path.startswith("/api/admin/") and request.method != "OPTIONS":
            try:
                request.state.proplet_admin_owner = require_admin_actor(request.headers.get("authorization"))
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return await call_next(request)

    def request_owner(request: Request, authorization: Optional[str]) -> dict:
        cached = getattr(request.state, "proplet_admin_owner", None)
        if cached and cached.get("role") == "owner":
            return cached
        return require_admin_actor(authorization, owner_only=True)

    def target_player(player_id: str) -> dict:
        rows = db_select("players", id=player_id)
        if not rows:
            raise HTTPException(404, "Hráč neexistuje")
        return rows[0]

    def verified_email_owner(email: str, *, exclude_player: Optional[str] = None) -> Optional[dict]:
        for candidate in db_select("players", email=email):
            if exclude_player and candidate.get("id") == exclude_player:
                continue
            if candidate.get("email_verified_at") and str(candidate.get("email") or "").casefold() == email:
                return candidate
        return None

    def live_pending_challenge(player_id: str) -> Optional[dict]:
        now = datetime.now(tz)
        candidates = []
        for row in db_select("account_auth_challenges", player_id=player_id):
            if row.get("purpose") != "link_email" or row.get("used_at"):
                continue
            try:
                expiry = datetime.fromisoformat(str(row.get("expires_at") or "").replace("Z", "+00:00"))
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=tz)
            except Exception:
                continue
            if expiry > now:
                candidates.append(row)
        if not candidates:
            return None
        return max(candidates, key=lambda row: str(row.get("created_at") or ""))

    def audit(admin: dict, action: str, target_id: str, details: Optional[dict] = None) -> None:
        db_insert(
            "admin_audit_log",
            {
                "id": str(uuid.uuid4()),
                "admin_player_id": admin["player"]["id"],
                "action": action,
                "target_type": "player",
                "target_id": target_id,
                "details": details or {},
                "created_at": datetime.now(tz).isoformat(),
            },
        )

    def create_challenge(player_id: str, email: str) -> tuple[str, dict]:
        raw = secrets.token_urlsafe(32)
        now = datetime.now(tz)
        # A new support action supersedes every unfinished link-email attempt for
        # this account. This prevents an older address from winning a race.
        for old in db_select("account_auth_challenges", player_id=player_id):
            if old.get("purpose") == "link_email" and not old.get("used_at"):
                try:
                    db_update(
                        "account_auth_challenges",
                        {"id": old["id"]},
                        {"used_at": now.isoformat()},
                    )
                except HTTPException:
                    pass
        row = {
            "id": str(uuid.uuid4()),
            "player_id": player_id,
            "purpose": "link_email",
            "email": email,
            "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=30)).isoformat(),
        }
        db_insert("account_auth_challenges", row)
        return raw, row

    def send_magic_link(email: str, redirect_to: str) -> None:
        if not supabase_url or not supabase_key:
            raise HTTPException(503, "Ověření účtu ještě není nakonfigurované")
        try:
            with httpx_client_factory(timeout=10.0) as client:
                response = client.request(
                    "POST",
                    f"{supabase_url.rstrip('/')}/auth/v1/otp",
                    headers={
                        "apikey": supabase_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    params={"redirect_to": redirect_to},
                    json={"email": email, "create_user": True},
                )
        except Exception as exc:
            raise HTTPException(502, "Ověřovací e-mail se nepodařilo odeslat") from exc
        if response.status_code >= 400:
            raise HTTPException(502, "Ověřovací e-mail se nepodařilo odeslat")

    @app.get("/api/admin/users/{player_id}/recovery-email")
    def admin_recovery_email_status(
        player_id: str,
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        request_owner(request, authorization)
        player = target_player(player_id)
        verified = bool(player.get("email_verified_at") and player.get("email"))
        pending = None if verified else live_pending_challenge(player_id)
        return {
            "playerId": player_id,
            "playerName": player.get("name"),
            "verified": verified,
            "emailMasked": _mask_email(player.get("email")) if verified else None,
            "pending": bool(pending),
            "pendingEmailMasked": _mask_email(pending.get("email")) if pending else None,
            "pendingExpiresAt": pending.get("expires_at") if pending else None,
        }

    @app.post("/api/admin/users/{player_id}/recovery-email")
    def admin_recovery_email_start(
        player_id: str,
        payload: AdminRecoveryEmailRequest,
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        admin = request_owner(request, authorization)
        enforce_rate_limit(
            request,
            "admin_legacy_recovery_email",
            limit=12,
            window_seconds=3600,
            discriminator=player_id,
        )
        player = target_player(player_id)
        email = _norm_email(payload.email)
        current_verified = bool(player.get("email_verified_at") and player.get("email"))
        current_email = str(player.get("email") or "").casefold()
        if current_verified:
            if current_email == email:
                return {
                    "ok": True,
                    "alreadyVerified": True,
                    "emailMasked": _mask_email(email),
                    "message": "Tento e-mail už je u účtu ověřený. Běžná obnova hesla funguje.",
                }
            raise HTTPException(409, "Účet už má ověřený jiný e-mail")
        if verified_email_owner(email, exclude_player=player_id):
            raise HTTPException(409, "Tento e-mail už používá jiný ověřený účet")

        raw, challenge = create_challenge(player_id, email)
        masked = _mask_email(email)
        audit(
            admin,
            "legacy_recovery_email_requested",
            player_id,
            {"emailMasked": masked, "playerName": str(player.get("name") or "")[:80]},
        )
        redirect_to = f"{origin}/?auth=email-link&challenge={raw}"
        try:
            send_magic_link(email, redirect_to)
        except HTTPException:
            now = datetime.now(tz).isoformat()
            try:
                db_update("account_auth_challenges", {"id": challenge["id"]}, {"used_at": now})
            finally:
                try:
                    audit(
                        admin,
                        "legacy_recovery_email_delivery_failed",
                        player_id,
                        {"emailMasked": masked},
                    )
                except Exception:
                    pass
            raise
        return {
            "ok": True,
            "verified": False,
            "pending": True,
            "emailMasked": masked,
            "expiresAt": challenge["expires_at"],
            "message": "Ověřovací odkaz byl odeslaný. E-mail se k účtu připojí až po kliknutí.",
        }
