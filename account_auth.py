from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailStart(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class RecoveryStart(BaseModel):
    email: str = Field(min_length=5, max_length=254)


class DisplayNameUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=24)


class AuthCallback(BaseModel):
    challenge: Optional[str] = Field(default=None, min_length=24, max_length=160)
    accessToken: str = Field(min_length=40, max_length=8192)


class RecoveryReset(AuthCallback):
    challenge: str = Field(min_length=24, max_length=160)
    password: str = Field(min_length=8, max_length=128)


def install_account_auth(
    app,
    *,
    supabase_url: str,
    supabase_key: str,
    tz,
    db_select,
    db_insert,
    db_update,
    db_delete,
    auth_player,
    new_session,
    hash_password,
    verify_password,
    enforce_rate_limit,
    player_stats,
    public_family_code,
    league_name_for,
):
    """Install the additive v3.31.8 identity bridge.

    Proplet's player row and custom session remain canonical. Supabase Auth is used
    only to prove control of an email / Google identity. This deliberately avoids
    a risky one-shot migration of existing scrypt passwords.
    """

    def norm_email(value: str) -> str:
        email = str(value or "").strip().casefold()
        if len(email) > 254 or not _EMAIL_RE.match(email):
            raise HTTPException(400, "Zadej platnou e-mailovou adresu")
        return email

    def public_origin(request: Request) -> str:
        # Vercel supplies the public host; never trust arbitrary forwarded schemes.
        host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
        if not host:
            raise HTTPException(400, "Neplatná adresa aplikace")
        allowed = (
            host in {"hrajproplet.cz", "www.hrajproplet.cz", "proplet-nine.vercel.app"}
            or host.endswith("-pavel-prouzas-projects.vercel.app")
        )
        if not allowed and host not in {"localhost", "127.0.0.1:8000", "localhost:8000"}:
            raise HTTPException(400, "Neplatná adresa aplikace")
        scheme = "http" if host.startswith("localhost") or host.startswith("127.0.0.1") else "https"
        return f"{scheme}://{host}"

    def auth_headers(access_token: Optional[str] = None) -> dict:
        if not supabase_url or not supabase_key:
            raise HTTPException(503, "Ověření účtu ještě není nakonfigurované")
        headers = {"apikey": supabase_key, "Content-Type": "application/json", "Accept": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    def auth_request(method: str, path: str, *, body=None, params=None, access_token: Optional[str] = None, generic_error: str = "Ověření účtu se nepodařilo"):
        try:
            with httpx.Client(timeout=12.0, follow_redirects=False) as client:
                response = client.request(method, f"{supabase_url}{path}", headers=auth_headers(access_token), json=body, params=params)
        except httpx.HTTPError as exc:
            raise HTTPException(503, "Ověřovací služba je momentálně nedostupná") from exc
        if response.status_code >= 400:
            # Never forward provider internals/tokens to the public client.
            raise HTTPException(400 if response.status_code < 500 else 503, generic_error)
        if not response.content:
            return {}
        try:
            return response.json()
        except Exception:
            return {}

    def auth_user(access_token: str) -> dict:
        user = auth_request("GET", "/auth/v1/user", access_token=access_token)
        uid = str(user.get("id") or "")
        email = str(user.get("email") or "").strip().casefold()
        if not uid or not email:
            raise HTTPException(401, "Ověření identity vypršelo. Zkus odkaz znovu.")
        return user

    def player_payload(player: dict, token: Optional[str] = None) -> dict:
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        payload = {
            "id": player["id"],
            "name": player.get("name") or "Hráč",
            "familyCode": family,
            "leagueName": league_name_for(player.get("family_code") or "") if family else None,
            "hasPassword": bool(player.get("password_hash")),
            "avatar": player.get("avatar") or "🙂",
            "supportMode": player.get("support_mode") or "none",
            "publicRankings": player.get("public_rankings"),
            "stats": player_stats(player["id"]),
            "email": player.get("email") if player.get("email_verified_at") else None,
            "emailVerified": bool(player.get("email_verified_at")),
            "googleLinked": bool(player.get("auth_user_id")),
        }
        if token:
            payload["token"] = token
        return payload

    def challenge_row(raw_token: str, purpose: Optional[str] = None) -> dict:
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        rows = db_select("account_auth_challenges", token_hash=token_hash)
        if not rows:
            raise HTTPException(400, "Odkaz je neplatný nebo už byl použit")
        row = rows[0]
        if purpose and row.get("purpose") != purpose:
            raise HTTPException(400, "Odkaz nepatří k této akci")
        if row.get("used_at"):
            raise HTTPException(400, "Odkaz už byl použit")
        try:
            expiry = datetime.fromisoformat(str(row.get("expires_at") or "").replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(400, "Odkaz vypršel")
        now = datetime.now(tz)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=tz)
        if expiry <= now:
            raise HTTPException(400, "Odkaz vypršel. Vyžádej si nový.")
        return row

    def create_challenge(player_id: str, purpose: str, email: str, minutes: int = 30) -> str:
        raw = secrets.token_urlsafe(32)
        now = datetime.now(tz)
        # Supersede older unfinished challenges of the same kind for this player.
        for old in db_select("account_auth_challenges", player_id=player_id):
            if old.get("purpose") == purpose and not old.get("used_at"):
                try:
                    db_update("account_auth_challenges", {"id": old["id"]}, {"used_at": now.isoformat()})
                except HTTPException:
                    pass
        db_insert("account_auth_challenges", {
            "id": str(uuid.uuid4()),
            "player_id": player_id,
            "purpose": purpose,
            "email": email,
            "token_hash": hashlib.sha256(raw.encode()).hexdigest(),
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=minutes)).isoformat(),
        })
        return raw

    def send_magic_link(email: str, redirect_to: str, *, create_user: bool) -> None:
        # Supabase's signInWithOtp endpoint sends a one-time Magic Link when the
        # Magic Link template contains ConfirmationURL (the hosted default).
        auth_request(
            "POST",
            "/auth/v1/otp",
            body={"email": email, "create_user": bool(create_user)},
            params={"redirect_to": redirect_to},
            generic_error="Ověřovací e-mail se nepodařilo odeslat",
        )

    def send_recovery_link(email: str, redirect_to: str) -> None:
        # Use GoTrue's dedicated recovery endpoint so the password-recovery
        # template and recovery-specific rate limits are used instead of a
        # generic Magic Link email.
        auth_request(
            "POST",
            "/auth/v1/recover",
            body={"email": email},
            params={"redirect_to": redirect_to},
            generic_error="Obnovovací e-mail se nepodařilo odeslat",
        )

    def verified_email_owner(email: str, exclude_player: Optional[str] = None) -> Optional[dict]:
        for candidate in db_select("players"):
            if exclude_player and candidate.get("id") == exclude_player:
                continue
            if candidate.get("email_verified_at") and str(candidate.get("email") or "").casefold() == email:
                return candidate
        return None

    @app.get("/api/account/auth-status")
    def account_auth_status(request: Request, authorization: Optional[str] = Header(default=None)):
        player = auth_player(authorization)
        google_available = False
        try:
            settings = auth_request("GET", "/auth/v1/settings")
            google_available = bool((settings.get("external") or {}).get("google"))
        except HTTPException:
            pass
        return {
            "email": player.get("email") if player.get("email_verified_at") else None,
            "emailVerified": bool(player.get("email_verified_at")),
            "googleLinked": bool(player.get("auth_user_id")),
            "googleAvailable": google_available,
            "recoveryReady": bool(player.get("email") and player.get("email_verified_at")),
        }

    @app.post("/api/account/display-name")
    def account_display_name(payload: DisplayNameUpdate, request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "display_name_update", limit=20, window_seconds=3600)
        player = auth_player(authorization)
        name = " ".join(payload.name.strip().split())
        if not name:
            raise HTTPException(400, "Napiš, jak ti má Proplet říkat")
        family = player.get("family_code")
        if family:
            for candidate in db_select("players", family_code=family):
                if candidate.get("id") != player.get("id") and str(candidate.get("name") or "").casefold() == name.casefold():
                    raise HTTPException(409, "V tomto týmu už hráč s touto přezdívkou existuje")
        db_update("players", {"id": player["id"]}, {"name": name})
        return {"ok": True, "name": name}


    @app.post("/api/account/email/start")
    def account_email_start(payload: EmailStart, request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "account_email_link", limit=5, window_seconds=3600)
        player = auth_player(authorization)
        email = norm_email(payload.email)
        owner = verified_email_owner(email, exclude_player=player["id"])
        if owner:
            raise HTTPException(409, "Tento e-mail už používá jiný účet")
        challenge = create_challenge(player["id"], "link_email", email)
        redirect_to = f"{public_origin(request)}/?auth=email-link&challenge={challenge}"
        try:
            send_magic_link(email, redirect_to, create_user=True)
        except HTTPException:
            # Do not leave a live challenge when delivery failed.
            row = challenge_row(challenge, "link_email")
            db_update("account_auth_challenges", {"id": row["id"]}, {"used_at": datetime.now(tz).isoformat()})
            raise
        return {"ok": True, "message": "Poslali jsme ověřovací odkaz. Otevři ho ve svém e-mailu."}

    @app.post("/api/account/email/verify")
    def account_email_verify(payload: AuthCallback, request: Request):
        enforce_rate_limit(request, "account_email_verify", limit=12, window_seconds=3600)
        if not payload.challenge:
            raise HTTPException(400, "Chybí ověřovací odkaz")
        row = challenge_row(payload.challenge, "link_email")
        user = auth_user(payload.accessToken)
        email = str(user.get("email") or "").casefold()
        if email != str(row.get("email") or "").casefold():
            raise HTTPException(401, "Ověřovací e-mail nesedí")
        owner = verified_email_owner(email, exclude_player=row["player_id"])
        if owner:
            raise HTTPException(409, "Tento e-mail už používá jiný účet")
        now = datetime.now(tz).isoformat()
        db_update("players", {"id": row["player_id"]}, {"email": email, "email_verified_at": now})
        db_update("account_auth_challenges", {"id": row["id"]}, {"used_at": now, "verified_auth_user_id": user.get("id")})
        player = db_select("players", id=row["player_id"])[0]
        return {"ok": True, "profile": player_payload(player, new_session(player["id"])), "message": "E-mail je ověřený. Účet už lze obnovit."}

    @app.post("/api/auth/recovery/start")
    def recovery_start(payload: RecoveryStart, request: Request):
        enforce_rate_limit(request, "password_recovery_ip", limit=8, window_seconds=3600)
        email = norm_email(payload.email)
        # Deliberately generic response: never disclose whether an email is registered.
        owner = verified_email_owner(email)
        if not owner:
            return {"ok": True, "message": "Pokud je e-mail propojený s účtem, poslali jsme odkaz pro obnovení."}
        challenge = create_challenge(owner["id"], "recover_password", email)
        redirect_to = f"{public_origin(request)}/?auth=recover&challenge={challenge}"
        try:
            send_recovery_link(email, redirect_to)
        except HTTPException:
            # Keep the public response generic even when the provider refuses the address.
            try:
                row = challenge_row(challenge, "recover_password")
                db_update("account_auth_challenges", {"id": row["id"]}, {"used_at": datetime.now(tz).isoformat()})
            except HTTPException:
                pass
        return {"ok": True, "message": "Pokud je e-mail propojený s účtem, poslali jsme odkaz pro obnovení."}

    @app.post("/api/auth/recovery/check")
    def recovery_check(payload: AuthCallback, request: Request):
        enforce_rate_limit(request, "password_recovery_check", limit=15, window_seconds=3600)
        if not payload.challenge:
            raise HTTPException(400, "Chybí obnovovací odkaz")
        row = challenge_row(payload.challenge, "recover_password")
        user = auth_user(payload.accessToken)
        if str(user.get("email") or "").casefold() != str(row.get("email") or "").casefold():
            raise HTTPException(401, "Obnovovací odkaz nesedí")
        return {"ok": True, "resetReady": True}

    @app.post("/api/auth/recovery/reset")
    def recovery_reset(payload: RecoveryReset, request: Request):
        enforce_rate_limit(request, "password_recovery_reset", limit=8, window_seconds=3600)
        row = challenge_row(payload.challenge, "recover_password")
        user = auth_user(payload.accessToken)
        email = str(user.get("email") or "").casefold()
        if email != str(row.get("email") or "").casefold():
            raise HTTPException(401, "Obnovovací odkaz nesedí")
        players = db_select("players", id=row["player_id"])
        if not players or not players[0].get("email_verified_at") or str(players[0].get("email") or "").casefold() != email:
            raise HTTPException(401, "Účet už k tomuto e-mailu není připojený")
        player = players[0]
        now = datetime.now(tz).isoformat()
        # Reset is also a session-security event: invalidate original + additional sessions.
        db_update("players", {"id": player["id"]}, {
            "password_hash": hash_password(payload.password),
            "token_hash": hashlib.sha256(secrets.token_urlsafe(32).encode()).hexdigest(),
        })
        for session in db_select("player_sessions", player_id=player["id"]):
            try:
                db_delete("player_sessions", id=session["id"])
            except HTTPException:
                pass
        db_update("account_auth_challenges", {"id": row["id"]}, {"used_at": now, "verified_auth_user_id": user.get("id")})
        player = db_select("players", id=player["id"])[0]
        return {"ok": True, "profile": player_payload(player, new_session(player["id"])), "message": "Heslo je změněné a ostatní přihlášení byla odpojena."}

    @app.get("/api/auth/google/start")
    def google_start(request: Request):
        enforce_rate_limit(request, "google_auth_start", limit=30, window_seconds=3600)
        if not supabase_url:
            raise HTTPException(503, "Google přihlášení ještě není nakonfigurované")
        redirect_to = f"{public_origin(request)}/?auth=google"
        query = urlencode({"provider": "google", "redirect_to": redirect_to})
        return RedirectResponse(f"{supabase_url}/auth/v1/authorize?{query}", status_code=302)

    @app.post("/api/auth/google/complete")
    def google_complete(payload: AuthCallback, request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "google_auth_complete", limit=20, window_seconds=3600)
        user = auth_user(payload.accessToken)
        uid = str(user.get("id"))
        email = norm_email(str(user.get("email") or ""))
        meta = user.get("user_metadata") or {}

        current = None
        if authorization:
            try:
                current = auth_player(authorization)
            except HTTPException:
                current = None

        mapped = db_select("players", auth_user_id=uid)
        if mapped:
            if current and current["id"] != mapped[0]["id"]:
                raise HTTPException(409, "Tento Google účet už je propojený s jiným hráčem")
            player = mapped[0]
        elif current:
            if current.get("auth_user_id") and str(current.get("auth_user_id")) != uid:
                raise HTTPException(409, "Tento hráč už má propojený jiný Google účet")
            updates = {"auth_user_id": uid}
            if not current.get("email_verified_at"):
                owner = verified_email_owner(email, exclude_player=current["id"])
                if not owner:
                    updates.update({"email": email, "email_verified_at": datetime.now(tz).isoformat()})
            db_update("players", {"id": current["id"]}, updates)
            player = db_select("players", id=current["id"])[0]
        else:
            # Secure auto-link only by an already verified email; never by display name.
            owner = verified_email_owner(email)
            if owner:
                if owner.get("auth_user_id") and str(owner.get("auth_user_id")) != uid:
                    raise HTTPException(409, "Tento e-mail už je propojený s jiným přihlášením")
                db_update("players", {"id": owner["id"]}, {"auth_user_id": uid})
                player = db_select("players", id=owner["id"])[0]
            else:
                raw_name = str(meta.get("given_name") or meta.get("full_name") or meta.get("name") or "Hráč").strip()
                name = " ".join(raw_name.split())[:24] or "Hráč"
                player_id = str(uuid.uuid4())
                now = datetime.now(tz).isoformat()
                db_insert("players", {
                    "id": player_id,
                    "name": name,
                    "family_code": f"SOLO_{secrets.token_hex(6).upper()}",
                    "avatar": "🙂",
                    "support_mode": "none",
                    # Primary legacy token is intentionally unreachable; OAuth uses player_sessions.
                    "token_hash": hashlib.sha256(secrets.token_urlsafe(32).encode()).hexdigest(),
                    "created_at": now,
                    "email": email,
                    "email_verified_at": now,
                    "auth_user_id": uid,
                })
                player = db_select("players", id=player_id)[0]

        token = new_session(player["id"])
        return {"ok": True, "profile": player_payload(player, token), "linked": bool(current), "provider": "google"}

    return app
