from __future__ import annotations

import hashlib
import math
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from content_archive import archived_puzzle_info, daily_window_id, daily_window_puzzle_id, load_catalog
from backend import content as domain_content
from backend import db as backend_db
from backend.config import (
    APP_VERSION,
    CONTENT_CATALOG_PATH,
    CRON_SECRET,
    GEN4_CANDIDATE_PREVIEW,
    GEN4_PREVIEW_BRANCH,
    PUZZLES_PATH,
    PHONE_LANDSCAPE_BLOCKING,
    ROOT,
    ROLLING_CONTENT_PATH,
    SUPABASE_SECRET_KEY,
    SUPABASE_URL,
    TAJENKA_BANK_PATH,
    TAJENKA_RELEASE_ENABLED,
    TABLET_LANDSCAPE_BREAKPOINT_PX,
    TZ,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
    VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF,
)
from backend.contracts import (
    AccountDeleteConfirm,
    AdminReportUpdate,
    AnonymousClaim,
    AttemptCheckpoint,
    AttemptFinishTelemetry,
    AttemptStart,
    AvatarSet,
    ClientErrorCreate,
    FamilyLeagueSettings,
    FeedbackCreate,
    HelperEventCreate,
    HintEventCreate,
    PasswordSet,
    PlayerCreate,
    PlayerLogin,
    ProductEventCreate,
    PublicRankingsSet,
    PushSubscriptionCreate,
    PushUnsubscribe,
    RescueFinish,
    ResultCreate,
    SupportModeSet,
    SupportReportCreate,
    SupportReportUpdate,
    TeamMembershipSet,
    TeamPinSet,
)
from backend.progress import calculate_stats, reward_stats_from_rows

try:
    from pywebpush import webpush, WebPushException
except Exception:  # Push remains optional until dependencies/env are configured.
    webpush = None
    WebPushException = Exception

DB_HTTP_CLIENT = backend_db.DEFAULT_HTTP_CLIENT

BADGES = [
    {"days": 1, "icon": "🥉", "name": "První zářez"},
    {"days": 3, "icon": "❤️", "name": "Srdcař"},
    {"days": 5, "icon": "⭐", "name": "Pětka"},
    {"days": 7, "icon": "🔥", "name": "Týden v plamenech"},
    {"days": 10, "icon": "🏆", "name": "Desítka"},
    {"days": 14, "icon": "⚡", "name": "Blesk"},
    {"days": 21, "icon": "🦉", "name": "Mistr slov"},
    {"days": 30, "icon": "👑", "name": "Koruna"},
    {"days": 50, "icon": "💎", "name": "Diamant"},
    {"days": 100, "icon": "🚀", "name": "Legenda"},
]

FREE_DIFFICULTIES = ("easy", "medium", "hard", "hardcore", "mozkomor")
ROLLING_DIFFICULTIES = ("easy", "medium", "hard", "hardcore")
POINTS = {"daily": 100, "easy": 15, "medium": 25, "hard": 50, "hardcore": 100, "mozkomor": 150}
MOZKOMOR_UNLOCK_BASE_LEVELS = 200
STARTER_XP = 10
TAJENKA_REWARD_XP = 200
TAJENKA_FIRST_SATURDAY = date(2026, 8, 29)
GEN4_RETURNING_BONUS_XP = 500
MAX_REQUEST_BYTES = 64 * 1024
SECONDARY_SESSION_DAYS = 180

app = FastAPI(
    title="Proplet API",
    version=f"{APP_VERSION}-cloud",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
logger = logging.getLogger("proplet")


@app.middleware("http")
async def launch_safety_middleware(request: Request, call_next):
    incoming_id = request.headers.get("x-request-id") or ""
    request_id = re.sub(r"[^A-Za-z0-9_.:-]", "", incoming_id)[:80] or secrets.token_hex(8)
    request.state.request_id = request_id
    if GEN4_CANDIDATE_PREVIEW and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        return JSONResponse(
            status_code=409,
            content={"detail": "Generation 4 preview je pouze pro čtení", "requestId": request_id},
            headers={"X-Request-ID": request_id, "Cache-Control": "no-store"},
        )
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        try:
            content_length = int(request.headers.get("content-length") or 0)
        except ValueError:
            content_length = 0
        too_large = content_length > MAX_REQUEST_BYTES
        if not too_large:
            # Do not trust Content-Length alone: proxies/clients may omit it. Starlette caches
            # request.body(), so downstream FastAPI/Pydantic can safely parse the same bytes.
            try:
                too_large = len(await request.body()) > MAX_REQUEST_BYTES
            except Exception:
                too_large = False
        if too_large:
            return JSONResponse(
                status_code=413,
                content={"detail": "Požadavek je příliš velký", "requestId": request_id},
                headers={"X-Request-ID": request_id, "Cache-Control": "no-store"},
            )
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Proplet-Version"] = APP_VERSION
    if response.status_code >= 500:
        # Vercel's pre-aggregated runtime error view only sees uncaught exceptions.
        # HTTPException/JSONResponse 5xx responses are therefore logged explicitly.
        logger.error(
            "proplet_http_5xx status=%s method=%s route=%s request_id=%s version=%s",
            response.status_code,
            request.method,
            request.url.path,
            request_id,
            APP_VERSION,
        )
        # Do not synchronously write this alarm back to Supabase: Supabase may be
        # the failed dependency, and a second DB attempt would delay the response.
    if request.url.path == "/api/rolling-content" and not GEN4_CANDIDATE_PREVIEW:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400"
    elif request.url.path == "/api/push/config":
        # This endpoint contains only public capability flags and the public VAPID key.
        # Let browsers reuse it briefly and let Vercel's CDN absorb repeat app opens.
        response.headers["Cache-Control"] = (
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        )
    elif request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    # Public launch: never send exception types/messages or infrastructure details to the browser.
    request_id = getattr(request.state, "request_id", None) or secrets.token_hex(8)
    logger.exception("Unhandled Proplet error request_id=%s route=%s", request_id, request.url.path)
    try:
        record_operational_event(
            "server_error",
            severity="error",
            request_id=request_id,
            route=request.url.path,
            actor_kind="network",
            code=type(exc).__name__,
        )
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Interní chyba serveru. Zkus to prosím znovu.", "requestId": request_id},
        headers={"X-Request-ID": request_id},
    )


def supabase_ready() -> bool:
    return backend_db.supabase_ready(SUPABASE_URL, SUPABASE_SECRET_KEY)


def _supabase_headers() -> dict[str, str]:
    return backend_db.supabase_headers(SUPABASE_SECRET_KEY)


def db_request(method: str, table: str, *, params=None, body=None, prefer=None):
    return backend_db.db_request(
        method,
        table,
        params=params,
        body=body,
        prefer=prefer,
        supabase_url=SUPABASE_URL,
        supabase_secret_key=SUPABASE_SECRET_KEY,
        http_client=DB_HTTP_CLIENT,
    )


def db_select(table: str, **filters):
    return backend_db.db_select(table, db_request, **filters)


def db_select_all(table: str, **filters):
    return backend_db.db_select_all(table, db_request, **filters)


def db_insert(table: str, row: dict):
    return backend_db.db_insert(table, row, db_request)


def db_upsert_push_subscription(row: dict):
    return backend_db.db_upsert_push_subscription(row, db_rpc)


def db_update(table: str, filters: dict, values: dict):
    return backend_db.db_update(table, filters, values, db_request)


def db_delete(table: str, **filters):
    return backend_db.db_delete(table, db_request, **filters)


def xp_economy_migrated() -> bool:
    targets = {key: value for key, value in POINTS.items() if key != "daily"}
    return backend_db.xp_economy_migrated(
        targets,
        GEN4_RETURNING_BONUS_XP,
        db_request,
    )


def db_rpc(function: str, body: Optional[dict] = None):
    return backend_db.db_rpc(
        function,
        body,
        supabase_url=SUPABASE_URL,
        supabase_secret_key=SUPABASE_SECRET_KEY,
        http_client=DB_HTTP_CLIENT,
        httpx_client_factory=httpx.Client,
    )


def _client_network_id(request: Request) -> str:
    # Vercel supplies proxy headers; only a keyed digest ever leaves this process.
    raw = (request.headers.get("x-vercel-forwarded-for") or request.headers.get("x-real-ip") or "").strip()
    if not raw:
        raw = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not raw:
        raw = getattr(getattr(request, "client", None), "host", None) or "unknown"
    key = (SUPABASE_SECRET_KEY or CRON_SECRET or "proplet-rate-limit").encode("utf-8")
    return hmac.new(key, raw.encode("utf-8"), hashlib.sha256).hexdigest()


def _rate_actor_hash(request: Request, discriminator: Optional[str] = None) -> str:
    network = _client_network_id(request)
    material = f"{network}|{str(discriminator or '').casefold().strip()}"
    key = (SUPABASE_SECRET_KEY or CRON_SECRET or "proplet-rate-limit").encode("utf-8")
    return hmac.new(key, material.encode("utf-8"), hashlib.sha256).hexdigest()


def record_operational_event(
    event_type: str,
    *,
    severity: str = "warning",
    request_id: Optional[str] = None,
    route: Optional[str] = None,
    actor_kind: Optional[str] = None,
    code: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    safe_metadata = {}
    for key, value in (metadata or {}).items():
        if key in {"token", "authorization", "password", "secret", "ip", "email"}:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe_metadata[str(key)[:40]] = str(value)[:160] if isinstance(value, str) else value
    db_insert("operational_events", {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "severity": severity,
        "request_id": str(request_id or "")[:80] or None,
        "route": str(route or "")[:120] or None,
        "app_version": APP_VERSION,
        "actor_kind": actor_kind,
        "code": str(code or "")[:80] or None,
        "metadata": safe_metadata,
        "created_at": datetime.now(TZ).isoformat(),
    })


def client_app_version(request: Request) -> str:
    """Return measured client runtime version; never confuse it with server version."""
    raw = str(request.headers.get("x-proplet-version") or "").strip()
    if re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?", raw):
        return raw[:40]
    return "legacy-unknown"


def enforce_rate_limit(
    request: Request,
    scope: str,
    *,
    limit: int,
    window_seconds: int,
    discriminator: Optional[str] = None,
) -> None:
    actor_hash = _rate_actor_hash(request, discriminator)
    try:
        result = db_rpc("proplet_rate_limit", {
            "p_scope": scope,
            "p_actor_hash": actor_hash,
            "p_window_seconds": int(window_seconds),
            "p_limit": int(limit),
        })
    except HTTPException:
        # Auth/abuse-sensitive endpoints should not silently lose their launch protection.
        raise HTTPException(503, "Bezpečnostní ochrana serveru není připravená. Zkus to za chvíli.")
    row = result[0] if isinstance(result, list) and result else (result or {})
    if not bool(row.get("allowed")):
        request_id = getattr(request.state, "request_id", None)
        try:
            record_operational_event("rate_limit", request_id=request_id, route=request.url.path, actor_kind="network", code=scope)
        except Exception:
            pass
        raise HTTPException(429, "Příliš mnoho pokusů. Chvíli počkej a zkus to znovu.")


def norm_family(code: str) -> str:
    code = "".join(ch for ch in str(code or "").upper().strip() if ch.isalnum() or ch in "-_ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ")
    return code[:24]


SOLO_FAMILY_PREFIX = "SOLO_"


def is_solo_family(code: Optional[str], team_joined_at: Optional[str] = None) -> bool:
    # Prefix marks our internal compatibility namespace; team_joined_at protects
    # any pre-existing real team that could coincidentally have a similar code.
    return not team_joined_at and norm_family(str(code or "")).startswith(SOLO_FAMILY_PREFIX)


def is_solo_player(player: dict) -> bool:
    return is_solo_family(player.get("family_code"), player.get("team_joined_at"))


def public_family_code(code: Optional[str], team_joined_at: Optional[str] = None) -> Optional[str]:
    normalized = norm_family(str(code or ""))
    return None if not normalized or is_solo_family(normalized, team_joined_at) else normalized


def public_team_name(code: Optional[str], team_joined_at: Optional[str] = None) -> Optional[str]:
    family = public_family_code(code, team_joined_at)
    return league_name_for(family) if family else None


def league_name_for(code: str) -> str:
    normalized = norm_family(code)
    try:
        rows = db_select("leagues", code=normalized)
        return rows[0].get("name") or normalized if rows else normalized
    except HTTPException:
        return normalized

def push_ready() -> bool:
    return bool(webpush and VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 5
SCRYPT_MAXMEM = 32 * 1024 * 1024


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
        maxmem=SCRYPT_MAXMEM, dklen=32,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: Optional[str]) -> bool:
    if not encoded:
        return False
    try:
        scheme, n, r, p_cost, salt_hex, digest_hex = encoded.split("$", 5)
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
            n=int(n), r=int(r), p=int(p_cost), maxmem=SCRYPT_MAXMEM, dklen=len(bytes.fromhex(digest_hex)),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def new_session(player_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(TZ)
    db_insert("player_sessions", {
        "id": str(uuid.uuid4()),
        "player_id": player_id,
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "created_at": now.isoformat(),
        "last_used_at": now.isoformat(),
        "expires_at": (now + timedelta(days=SECONDARY_SESSION_DAYS)).isoformat(),
    })
    return token


def auth_player(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Chybí přihlášení hráče")
    token = authorization[7:].strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Legacy/main-device token stays valid forever, so the v3.3 migration does not log anyone out.
    rows = db_select("players", token_hash=token_hash)
    if rows:
        return rows[0]

    # Additional devices get independent session tokens. A database outage must not
    # masquerade as a bad password/session and accidentally log the user out.
    sessions = db_select("player_sessions", token_hash=token_hash)
    if sessions:
        session = sessions[0]
        now = datetime.now(TZ)
        expiry = parse_timestamp(session.get("expires_at"))
        if expiry and expiry <= now:
            try:
                db_delete("player_sessions", id=session["id"])
            except HTTPException:
                pass
            raise HTTPException(401, "Přihlášení vypršelo. Přihlas se znovu.")
        last_used = parse_timestamp(session.get("last_used_at"))
        if not last_used or last_used < now - timedelta(hours=24):
            try:
                db_update("player_sessions", {"id": session["id"]}, {"last_used_at": now.isoformat()})
            except HTTPException:
                pass
        players = db_select("players", id=session["player_id"])
        if players:
            return players[0]
    raise HTTPException(401, "Neplatné přihlášení hráče")


def require_admin(authorization: Optional[str], *, write: bool = False) -> dict:
    """Authenticate a player and then require an independent admin grant.

    Admin rights deliberately live outside the player row. Team membership, a
    guessed URL or an ordinary authenticated session can never grant access by
    itself. The first owner is created by the v3.17 migration.
    """
    player = auth_player(authorization)
    try:
        rows = db_select("admin_accounts", player_id=player["id"])
    except HTTPException as exc:
        raise HTTPException(403, "Administrace ještě není aktivovaná. Spusť migraci v3.17.") from exc
    rows = [row for row in rows if row.get("active") is True]
    if not rows:
        raise HTTPException(403, "Tento hráč nemá přístup do administrace")
    account = rows[0]
    role = str(account.get("role") or "viewer")
    if write and role not in ("owner", "editor"):
        raise HTTPException(403, "Toto administrátorské oprávnění je pouze pro čtení")
    return {"player": player, "account": account, "role": role}


def record_admin_audit(admin: dict, action: str, target_type: str, target_id: Optional[str], details: Optional[dict] = None) -> None:
    db_insert("admin_audit_log", {
        "id": str(uuid.uuid4()),
        "admin_player_id": admin["player"]["id"],
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "created_at": datetime.now(TZ).isoformat(),
    })


def anonymous_hash(raw: Optional[str]) -> Optional[str]:
    """Return a non-reversible installation identifier for anonymous telemetry.

    The browser keeps a random UUID; the database only sees this SHA-256 digest.
    It is not derived from IP, device model, user agent or any other fingerprint.
    """
    if not raw:
        return None
    value = raw.strip()
    if len(value) < 16 or len(value) > 100:
        raise HTTPException(400, "Neplatné anonymní ID")
    return hashlib.sha256(("proplet-anon-v1:" + value).encode("utf-8")).hexdigest()


def telemetry_actor(authorization: Optional[str], anonymous_id: Optional[str]) -> dict:
    if authorization and authorization.startswith("Bearer "):
        player = auth_player(authorization)
        return {"player": player, "player_id": player["id"], "anonymous_id": None, "actor_key": f"p:{player['id']}"}
    anon = anonymous_hash(anonymous_id)
    if anon:
        return {"player": None, "player_id": None, "anonymous_id": anon, "actor_key": f"a:{anon}"}
    raise HTTPException(401, "Chybí identita telemetry")


def actor_filters(actor: dict) -> dict:
    return {"player_id": actor["player_id"]} if actor.get("player_id") else {"anonymous_id": actor["anonymous_id"]}


def current_prague_date() -> date:
    return datetime.now(TZ).date()


def streaks(dates: list[str]) -> tuple[int, int]:
    return domain_content.streaks(dates, current_prague_date())


def streak_ending_on(date_strings: list[str] | set[str], anchor: date) -> int:
    return domain_content.streak_ending_on(date_strings, anchor)


def rescue_rows(player_id: str) -> list[dict]:
    return db_select("streak_rescues", player_id=player_id)


def player_reward_stats(player_id: str) -> dict:
    """One server-owned breakdown for every non-result XP source."""
    try:
        rewards = db_select("account_rewards", player_id=player_id)
        included = True
    except HTTPException:
        # Rolling-deploy compatibility only. Clients may temporarily retain their legacy
        # bonus adapters until the additive account_rewards migration is available.
        rewards = []
        included = False

    return reward_stats_from_rows(rewards, account_rewards_included=included)


def player_stats(player_id: str) -> dict:
    """Statistiky včetně ochráněných streak dnů a clean solve metrik."""
    # Public stats keys remain owned by the core: "xpAuthoritative",
    # "resultXp", "accountBonusXp", "wordDiscoveryXp", "discoveredWords".
    # Serialization aliases remain: "freeBasePlayedCurrent": free_slots["baseCurrent"].
    rows = db_select("results", player_id=player_id)
    # This intentionally remains the first operation after result loading:
    # reconciliation can write and mutates rows before XP is calculated.
    gen4_rewards = reconcile_gen4_free_rewards(player_id, rows)
    daily_dates: list[str] = []
    daily_times: list[int] = []
    clean_daily = 0
    # The core is deliberately logger-free.  Keep the two historical warning
    # seams in this adapter while passing the validated values down to it.
    for row in rows:
        if row.get("mode") != "daily" or not row.get("daily_date"):
            continue
        raw_date = str(row.get("daily_date"))[:10]
        try:
            date.fromisoformat(raw_date)
            daily_dates.append(raw_date)
            if row.get("clean_solve") is True:
                clean_daily += 1
        except ValueError:
            logger.warning("Ignoring malformed daily_date for result %s: %r", row.get("id"), row.get("daily_date"))
        try:
            daily_times.append(int(row.get("best_elapsed_ms")))
        except (TypeError, ValueError):
            logger.warning("Ignoring malformed elapsed time for result %s", row.get("id"))

    free_slots = free_slot_summary(rows)
    reward_stats = player_reward_stats(player_id)

    rescue_data: list[dict] = []
    try:
        for rr in rescue_rows(player_id):
            rescue_data.append(rr)
    except HTTPException:
        # During a rolling deploy before the v3.4 migration, normal gameplay remains readable.
        rescue_data = []
    # Preserve the historical derivation order: streak date is captured before
    # the unlock projection that used to be evaluated while serializing.
    today = current_prague_date()
    mozkomor_unlocked = mozkomor_unlocked_from_rows(rows, free_slots)
    return calculate_stats(
        rows,
        today=today,
        rescue_rows=rescue_data,
        free_slots=free_slots,
        reward_stats=reward_stats,
        gen4_rewards=gen4_rewards,
        mozkomor_unlocked=mozkomor_unlocked,
        badges=BADGES,
        free_difficulties=FREE_DIFFICULTIES,
        daily_dates=daily_dates,
        daily_times=daily_times,
        clean_daily=clean_daily,
    )


def rescue_status_for(player_id: str) -> dict:
    today = current_prague_date()
    missed = today - timedelta(days=1)
    before = missed - timedelta(days=1)
    rows = db_select("results", player_id=player_id)
    daily_dates = {str(r.get("daily_date"))[:10] for r in rows if r.get("mode") == "daily" and r.get("daily_date")}
    rescues = rescue_rows(player_id)
    passed = {str(r.get("missed_date"))[:10] for r in rescues if r.get("status") == "passed" and r.get("missed_date")}
    effective = daily_dates | passed
    target = missed.isoformat()
    existing = next((r for r in rescues if str(r.get("missed_date"))[:10] == target), None)
    prior_streak = streak_ending_on(effective, before)

    if existing:
        status = existing.get("status")
        if status == "started":
            # Since v3.19 the rescue clock measures active play, not wall time.
            # Leaving the PWA therefore cannot silently consume the attempt.
            elapsed_ms = max(0, int(existing.get("elapsed_ms") or 0))
            return {
                "eligible": True, "state": "started", "missedDate": target,
                "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
                "timeLimitMs": 30000, "secondsRemaining": max(0, round((30000 - elapsed_ms) / 1000, 1)),
            }
        return {
            "eligible": False, "state": status or "failed", "missedDate": target,
            "priorStreak": prior_streak, "puzzleId": existing.get("puzzle_id"),
        }

    eligible = target not in effective and before.isoformat() in effective and prior_streak > 0
    return {
        "eligible": eligible, "state": "available" if eligible else "none",
        "missedDate": target if eligible else None, "priorStreak": prior_streak if eligible else 0,
    }

@lru_cache(maxsize=1)
def load_puzzles() -> dict:
    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_tajenka_bank() -> dict:
    if not TAJENKA_BANK_PATH.exists():
        return {"version": 1, "kind": "weekend_bonus_bank", "weeks": 0, "rewardXp": TAJENKA_REWARD_XP, "puzzles": []}
    return json.loads(TAJENKA_BANK_PATH.read_text(encoding="utf-8"))


def tajenka_week_for(day: date) -> Optional[int]:
    """Return the finite release week for a date; never cycle future content."""
    offset = (day - TAJENKA_FIRST_SATURDAY).days
    if offset < 0:
        return None
    week = offset // 7 + 1
    prepared = int(load_tajenka_bank().get("weeks") or 0)
    return week if 1 <= week <= prepared else None


def tajenka_puzzle_for_week(week: int) -> Optional[dict]:
    return next(
        (puzzle for puzzle in load_tajenka_bank().get("puzzles", []) if int(puzzle.get("week") or 0) == week),
        None,
    )


def tajenka_is_live(day: date) -> bool:
    """Return whether the puzzle released for this week is currently playable."""
    return TAJENKA_RELEASE_ENABLED and tajenka_week_for(day) is not None


@lru_cache(maxsize=1)
def load_rolling_content() -> dict:
    if not ROLLING_CONTENT_PATH.exists():
        return {"version": 1, "releaseEnabled": False, "batches": [], "puzzles": {d: [] for d in ROLLING_DIFFICULTIES}}
    return json.loads(ROLLING_CONTENT_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_content_catalog() -> dict:
    return load_catalog(str(CONTENT_CATALOG_PATH))


def rolling_content_release_enabled() -> bool:
    """Fail closed when a reserved bank is paused during a content-generation migration."""
    return load_rolling_content().get("releaseEnabled", True) is not False


def _parse_content_date(value: Optional[str]) -> Optional[date]:
    return domain_content.parse_content_date(value)


def effective_content_date(request: Optional[Request] = None, requested: Optional[str] = None) -> date:
    """Production always uses Prague today; preview deployments may simulate a release date."""
    actual = current_prague_date()
    if VERCEL_ENV == "production":
        return actual
    candidate = requested
    if not candidate and request is not None:
        candidate = request.headers.get("x-proplet-preview-as-of")
    return _parse_content_date(candidate) or actual


def puzzle_release_date(puzzle: dict) -> Optional[date]:
    return domain_content.parse_content_date((puzzle.get("meta") or {}).get("availableFrom"))


def is_puzzle_released(puzzle: dict, as_of: Optional[date] = None) -> bool:
    return domain_content.is_puzzle_released(puzzle, as_of or current_prague_date())


def released_free_bank(difficulty: str, as_of: Optional[date] = None) -> list[dict]:
    return domain_content.released_free_bank(
        load_puzzles(), load_rolling_content(), difficulty, as_of or current_prague_date(),
    )


def _released_batches(as_of: date) -> tuple[list[dict], Optional[str]]:
    rolling = load_rolling_content()
    if not rolling_content_release_enabled():
        return [], None
    batches = list(rolling.get("batches") or [])
    released = [b for b in batches if (_parse_content_date(b.get("availableFrom")) or date.max) <= as_of]
    future = [b for b in batches if (_parse_content_date(b.get("availableFrom")) or date.min) > as_of]
    released.sort(key=lambda b: str(b.get("availableFrom") or ""))
    future.sort(key=lambda b: str(b.get("availableFrom") or ""))
    return released, (future[0].get("availableFrom") if future else None)


def released_puzzle_payload(as_of: date) -> dict:
    source = load_puzzles()
    payload = {k: v for k, v in source.items() if k != "free"}
    payload["free"] = {d: released_free_bank(d, as_of) for d in FREE_DIFFICULTIES}
    rolling = dict(load_rolling_content())
    rolling.pop("batches", None); rolling.pop("puzzles", None)
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    payload["rollingContent"] = rolling
    payload["contentStatus"] = {
        "asOf": as_of.isoformat(), "latestBatch": latest, "nextRelease": next_release,
        "availableFreeCounts": {d: len(payload["free"][d]) for d in FREE_DIFFICULTIES},
    }
    return payload


def released_rolling_payload(as_of: date) -> dict:
    """Only release-gated additions; the large v9 base bank remains a static CDN asset."""
    source = load_rolling_content()
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    additions = {
        d: (
            [p for p in source.get("puzzles", {}).get(d, []) if is_puzzle_released(p, as_of)]
            if rolling_content_release_enabled()
            else []
        )
        for d in ROLLING_DIFFICULTIES
    }
    meta = {k: v for k, v in source.items() if k not in {"batches", "puzzles"}}
    base = load_puzzles().get("free", {})
    return {
        "version": int(source.get("version") or 0), "asOf": as_of.isoformat(),
        "latestBatch": latest, "nextRelease": next_release, "puzzles": additions,
        "availableFreeCounts": {d: len(base.get(d, [])) + len(additions[d]) for d in additions},
        "meta": meta,
    }


def push_preferences_schema_ready() -> bool:
    if not supabase_ready():
        return False
    try:
        db_request("GET", "push_subscriptions", params={"select": "id,daily_enabled,content_enabled,anonymous_id", "limit": "1"})
        db_request("GET", "push_delivery_log", params={"select": "id,anonymous_id", "limit": "1"})
        return True
    except HTTPException:
        return False


def push_open_tracking_schema_ready() -> bool:
    if not supabase_ready():
        return False
    try:
        db_request("GET", "push_delivery_log", params={"select": "id,opened_at", "limit": "1"})
        return True
    except HTTPException:
        return False



def free_puzzle_info(puzzle_id: str, difficulty: Optional[str] = None) -> Optional[dict]:
    """Resolve a Free puzzle to its generation and stable difficulty/level slot."""
    return domain_content.free_puzzle_info(
        load_puzzles(), load_rolling_content(), puzzle_id, FREE_DIFFICULTIES, difficulty,
    )


def free_slot_summary(rows: list[dict]) -> dict[str, dict[str, int]]:
    """Summarise stable difficulty+level slots without exposing content generations to players."""
    difficulties = FREE_DIFFICULTIES
    puzzle_data = load_puzzles(); reserve = load_rolling_content()
    active_generation = int(puzzle_data.get("freeGeneration") or 1)
    base_levels = {key: len(puzzle_data.get("free", {}).get(key, [])) for key in difficulties}
    maximum_levels = {key: base_levels[key] + len(reserve.get("puzzles", {}).get(key, [])) for key in difficulties}
    prior_slots = {key: set() for key in difficulties}
    current_slots = {key: set() for key in difficulties}
    base_current_slots = {key: set() for key in difficulties}
    for row in rows:
        if row.get("mode") != "free" or row.get("difficulty") not in prior_slots:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), str(row.get("difficulty") or ""))
        if not info or not 1 <= int(info["level"]) <= maximum_levels.get(info["difficulty"], 0):
            continue
        is_current = int(info["generation"]) == active_generation and info.get("legacy") is not True
        target = current_slots if is_current else prior_slots
        target[info["difficulty"]].add(int(info["level"]))
        if is_current and info.get("rolling") is not True and int(info["level"]) <= base_levels.get(info["difficulty"], 0):
            base_current_slots[info["difficulty"]].add(int(info["level"]))
    effective = {key: len(prior_slots[key] | current_slots[key]) for key in difficulties}
    transferred = {key: len(prior_slots[key] - current_slots[key]) for key in difficulties}
    current = {key: len(current_slots[key]) for key in difficulties}
    base_current = {key: len(base_current_slots[key]) for key in difficulties}
    return {"effective": effective, "transferred": transferred, "current": current, "baseCurrent": base_current, "gen2": current}


def mozkomor_unlocked_from_rows(rows: list[dict], slots: Optional[dict] = None) -> bool:
    """Unlock after all 200 base Gen4 Mozkožrout slots; rolling levels never count."""
    if any(row.get("mode") == "free" and row.get("difficulty") == "mozkomor" for row in rows):
        return True
    summary = slots or free_slot_summary(rows)
    return domain_content.mozkomor_unlocked_from_rows(rows, summary, MOZKOMOR_UNLOCK_BASE_LEVELS)


def enforce_mozkomor_unlock(rows: list[dict], slots: Optional[dict] = None) -> None:
    if not mozkomor_unlocked_from_rows(rows, slots):
        raise HTTPException(403, "Mozkomor se odemkne po dokončení všech 200 Mozkožroutů")


def free_slot_already_rewarded(player_id: str, difficulty: str, level: int) -> bool:
    for row in db_select("results", player_id=player_id):
        if row.get("mode") != "free" or row.get("difficulty") != difficulty or int(row.get("points") or 0) <= 0:
            continue
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if info and int(info["level"]) == int(level):
            return True
    return False


def reconcile_gen4_free_rewards(player_id: str, rows: list[dict]) -> dict:
    """Repair already-finished Gen4 boards and grant one returning-player bonus.

    The bonus is stored on the player's earliest Gen4 result. A points value of
    at least that board's base reward plus the bonus is the persistent claim
    marker, so retries and concurrent profile reads cannot award it twice.
    """
    puzzle_data = load_puzzles()
    active_generation = int(puzzle_data.get("freeGeneration") or 1)
    empty = {"repairedXp": 0, "returnBonusXp": 0, "bonusAwardedNow": 0}
    if active_generation < 4:
        return empty

    active_ids = {
        difficulty: {
            str(puzzle.get("id") or "")
            for puzzle in (
                list(puzzle_data.get("free", {}).get(difficulty, []))
                + list(load_rolling_content().get("puzzles", {}).get(difficulty, []))
            )
        }
        for difficulty in FREE_DIFFICULTIES
    }
    prior_generation_played = False
    current_results: list[tuple[dict, int]] = []
    for row in rows:
        difficulty = str(row.get("difficulty") or "")
        if row.get("mode") != "free" or difficulty not in POINTS:
            continue
        if str(row.get("puzzle_id") or "") in active_ids[difficulty]:
            current_results.append((row, int(POINTS[difficulty])))
        else:
            prior_generation_played = True

    if not current_results:
        return empty

    bonus_already_awarded = any(
        int(row.get("points") or 0) >= base_points + GEN4_RETURNING_BONUS_XP
        for row, base_points in current_results
    )
    earliest_row = min(
        current_results,
        key=lambda item: (str(item[0].get("completed_at") or ""), str(item[0].get("id") or "")),
    )[0]
    repaired_xp = 0
    bonus_awarded_now = 0
    for row, base_points in current_results:
        old_points = max(0, int(row.get("points") or 0))
        target_points = max(old_points, base_points)
        if prior_generation_played and not bonus_already_awarded and row is earliest_row:
            target_points += GEN4_RETURNING_BONUS_XP
            bonus_awarded_now = GEN4_RETURNING_BONUS_XP
        if target_points == old_points:
            continue
        db_update("results", {"id": row["id"], "player_id": player_id}, {"points": target_points})
        row["points"] = target_points
        repaired_xp += target_points - old_points

    return {
        "repairedXp": repaired_xp,
        "returnBonusXp": GEN4_RETURNING_BONUS_XP if prior_generation_played else 0,
        "bonusAwardedNow": bonus_awarded_now,
    }


def claim_free_slot_points(player_id: str, info: dict, points: int, puzzle_id: str) -> tuple[int, bool]:
    """Award Gen4 once per concrete board; preserve the legacy slot policy before Gen4.

    The v3.16 table supplies a concurrency-safe unique constraint. During a
    rolling deployment without that migration, result-history lookup remains a
    safe compatibility fallback (apart from a very narrow simultaneous race).
    """
    difficulty, level = info["difficulty"], int(info["level"])
    active_generation = int(load_puzzles().get("freeGeneration") or 1)
    is_current = int(info.get("generation") or 1) == active_generation and info.get("legacy") is not True
    if active_generation >= 4 and is_current:
        # Result.challenge_key (free:<puzzle id>) is the concurrency-safe claim.
        # The result endpoint awards this value only when that row is first inserted.
        return int(points), False
    historical_reward = free_slot_already_rewarded(player_id, difficulty, level)
    try:
        claimed = db_select("free_slot_rewards", player_id=player_id, difficulty=difficulty, level=level)
        if claimed:
            return 0, True
        db_insert("free_slot_rewards", {
            "id": str(uuid.uuid4()), "player_id": player_id, "difficulty": difficulty,
            "level": level, "source_puzzle_id": puzzle_id,
            "content_generation": int(info.get("generation") or 1),
            "points": 0 if historical_reward else int(points),
            "earned_at": datetime.now(TZ).isoformat(),
        })
        return (0, True) if historical_reward else (int(points), False)
    except HTTPException as exc:
        if exc.status_code == 409:
            return 0, True
        logger.warning("free_slot_rewards unavailable; using result-history fallback: %s", exc.detail)
        return (0, True) if historical_reward else (int(points), False)


def daily_rotation_index(daily_date: str, bank_size: int, base_date: str = "2026-01-01") -> int:
    try:
        return domain_content.daily_rotation_index(daily_date, bank_size, base_date)
    except ValueError as exc:
        status = 503 if "prázdná" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc


def legacy_daily_banks(data: Optional[dict] = None) -> list[dict]:
    return domain_content.legacy_daily_banks(data or load_puzzles())


def previous_daily_bank(data: Optional[dict] = None) -> Optional[dict]:
    return domain_content.previous_daily_bank(data or load_puzzles())


def legacy_daily_bank_by_generation(generation: int, data: Optional[dict] = None) -> Optional[dict]:
    return domain_content.legacy_daily_bank_by_generation(data or load_puzzles(), generation)


def daily_bank_puzzle_id(bank: dict, daily_date: str, fallback_base: str = "2026-01-01") -> str:
    try:
        return domain_content.daily_bank_puzzle_id(bank, daily_date, fallback_base)
    except ValueError as exc:
        status = 503 if "prázdná" in str(exc) else 400
        raise HTTPException(status, str(exc)) from exc


def expected_daily_puzzle_id(daily_date: str) -> str:
    """HTTP-compatible adapter for the pure Daily content contract."""
    data = load_puzzles()
    try:
        return domain_content.expected_daily_puzzle_id(
            data, daily_date, candidate_preview=GEN4_CANDIDATE_PREVIEW,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc


def valid_daily_puzzle_ids(daily_date: str) -> set[str]:
    """Accept the primary board plus archived generations for cached/offline clients."""
    data = load_puzzles()
    ids = {expected_daily_puzzle_id(daily_date)}

    if int(data.get("dailyGeneration") or 0) == 4:
        # A client may open Gen3 just before deployment and sync after cutover.
        # Only the immediately preceding generation receives this compatibility
        # exception; older generations remain valid solely inside their historic
        # date windows and therefore cannot be replayed as a current Daily.
        release = data.get("release") or {}
        switch4_raw = data.get("dailyGeneration4From") or release.get("dailyGeneration4From")
        try:
            requested_date = date.fromisoformat(daily_date)
            switch4 = date.fromisoformat(str(switch4_raw)) if switch4_raw else None
        except ValueError:
            raise HTTPException(400, "Neplatné datum")
        windows = list((data.get("archive") or {}).get("dailyWindows") or [])
        if switch4 and requested_date >= switch4 and windows:
            previous = max(windows, key=lambda item: int(item.get("generation") or 0))
            archived_id = daily_window_puzzle_id(previous, daily_date)
            if archived_id:
                ids.add(archived_id)
        # v4.00.0/4.00.1 clients selected the active Gen4 bank one day before the
        # approved Monday cutover because their local selector did not understand
        # dailyGeneration4From. Preserve only that exact, already-served board so
        # honest Sunday completions can leave the offline queue. It remains a
        # separate leaderboard cohort from the official Gen3 Sunday board.
        if switch4 and requested_date == switch4 - timedelta(days=1):
            active = data.get("daily") or []
            if active:
                base = str(data.get("dailyRotationBaseDate") or switch4.isoformat())
                ids.add(active[daily_rotation_index(daily_date, len(active), base)]["id"])
        return ids

    active = data.get("daily", [])
    switch3_raw = data.get("dailyGeneration3From")
    try:
        requested_date = date.fromisoformat(daily_date)
        switch3 = date.fromisoformat(str(switch3_raw)) if switch3_raw else None
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    if active and (switch3 is None or requested_date >= switch3):
        base = str(data.get("dailyRotationBaseDate") or data.get("dailyGeneration3From") or "2026-01-01")
        ids.add(active[daily_rotation_index(daily_date, len(active), base)]["id"])

    previous = previous_daily_bank(data)
    if previous:
        ids.add(daily_bank_puzzle_id(previous, daily_date))

    for legacy_bank in legacy_daily_banks(data):
        ids.add(daily_bank_puzzle_id(legacy_bank, daily_date))
    return ids


def daily_puzzle_matches_date(puzzle_id: str, daily_date: str) -> bool:
    return puzzle_id in valid_daily_puzzle_ids(daily_date)


def daily_leaderboard_puzzle_id(daily_date: str, player_id: Optional[str] = None) -> str:
    """Keep the emergency pre-cutover board separate from the official Daily."""
    primary = expected_daily_puzzle_id(daily_date)
    if not player_id:
        return primary
    valid_ids = valid_daily_puzzle_ids(daily_date)
    rows = db_select("results", player_id=player_id, mode="daily", daily_date=daily_date)
    own = next((row.get("puzzle_id") for row in rows if row.get("puzzle_id") in valid_ids), None)
    return str(own or primary)

def is_daily_generation_upgrade(old: dict, payload: ResultCreate) -> bool:
    """True only when an archived Daily result is replaced by that day's primary board."""
    return bool(
        payload.mode == "daily"
        and payload.daily_date
        and old.get("puzzle_id") != payload.puzzle_id
        and payload.puzzle_id == expected_daily_puzzle_id(payload.daily_date)
    )


def puzzle_exists(puzzle_id: str, mode: str, difficulty: str) -> bool:
    data = load_puzzles()
    if mode == "tajenka":
        current_week = tajenka_week_for(current_prague_date())
        return TAJENKA_RELEASE_ENABLED and current_week is not None and any(
            p.get("id") == puzzle_id and p.get("difficulty") == difficulty
            and int((p.get("meta") or {}).get("rewardXp") or 0) == TAJENKA_REWARD_XP
            and 1 <= int(p.get("week") or 0) <= current_week
            for p in load_tajenka_bank().get("puzzles", [])
        )
    if mode == "starter":
        starter = data.get("starter") or {}
        return starter.get("id") == puzzle_id and starter.get("difficulty") == difficulty
    if mode == "daily":
        active = any(p["id"] == puzzle_id and p["difficulty"] == difficulty for p in data.get("daily", []))
        archived = any(
            p.get("id") == puzzle_id and p.get("difficulty") == difficulty
            for bank in legacy_daily_banks(data) for p in bank["puzzles"]
        )
        return active or archived or bool(archived_puzzle_info(
            load_content_catalog(), puzzle_id, difficulty, "daily",
            int(data.get("dailyGeneration") or data.get("contentGeneration") or 1),
        ))
    info = free_puzzle_info(puzzle_id, difficulty)
    if info and info.get("legacy") is not True:
        # Never let a guessed future reserve ID enter telemetry/results before its real release.
        return is_puzzle_released(info.get("puzzle") or {}, current_prague_date())
    # Keep queued results from older Hard banks syncable after the v3.3 puzzle upgrade.
    return bool(info and info.get("legacy") is True)


def resolved_puzzle(puzzle_id: str, mode: str, difficulty: str) -> Optional[dict]:
    data = load_puzzles()
    if mode == "starter":
        p = data.get("starter") or {}
        return p if p.get("id") == puzzle_id and p.get("difficulty") == difficulty else None
    if mode == "daily":
        for p in data.get("daily", []):
            if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                return p
        previous = previous_daily_bank(data)
        if previous:
            for p in previous.get("puzzles", []):
                if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                    return p
        for bank in legacy_daily_banks(data):
            for p in bank.get("puzzles", []):
                if p.get("id") == puzzle_id and p.get("difficulty") == difficulty:
                    return p
        info = archived_puzzle_info(
            load_content_catalog(), puzzle_id, difficulty, "daily",
            int(data.get("dailyGeneration") or data.get("contentGeneration") or 1),
        )
        return info.get("puzzle") if info else None
    info = free_puzzle_info(puzzle_id, difficulty)
    return info.get("puzzle") if info else None


def validate_result_sanity(payload: ResultCreate) -> None:
    puzzle = resolved_puzzle(payload.puzzle_id, payload.mode, payload.difficulty)
    if not puzzle:
        raise HTTPException(400, "Neznámá úloha")
    answers = puzzle.get("answers") or []
    answer_count = len(answers)
    active_cells = len(puzzle.get("mask") or [])
    # Every counted move is either one newly found answer or one wrong attempt.
    # Older cached clients may count harmless short taps too, hence >= rather than equality.
    if payload.moves < answer_count + payload.wrong_attempts:
        raise HTTPException(400, "Výsledek má nekonzistentní počet tahů")
    if payload.hints_used == 0 and payload.max_hint_level > 0:
        raise HTTPException(400, "Výsledek má nekonzistentní nápovědy")
    # Blocks trivial 1-second forged leaderboard submissions without punishing legitimate fast humans.
    min_elapsed = max(2500, active_cells * 90)
    if payload.elapsed_ms < min_elapsed:
        raise HTTPException(400, "Výsledek je mimo bezpečný rozsah")


@app.get("/api/puzzle-database")
def puzzle_database_preview(request: Request):
    """Serve the candidate pack only on the read-only Gen4 branch preview."""
    if not GEN4_CANDIDATE_PREVIEW:
        raise HTTPException(404, "Preview databáze není v tomto prostředí dostupná")
    return JSONResponse(
        content=released_puzzle_payload(effective_content_date(request)),
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/tajenka")
def current_tajenka(week: Optional[int] = Query(default=None, ge=1, le=10)):
    """Serve one released board without exposing the remaining weekend bank."""
    today = current_prague_date()
    if VERCEL_ENV == "preview":
        selected_week = week or 1
    else:
        if not tajenka_is_live(today):
            raise HTTPException(404, "Tajenka zatím není vydaná")
        selected_week = tajenka_week_for(today)
    puzzle = tajenka_puzzle_for_week(int(selected_week or 0))
    if not puzzle:
        raise HTTPException(404, "Tajenka pro tento týden není připravená")
    return JSONResponse(content=puzzle, headers={"Cache-Control": "private, no-store"})


@app.get("/")
def home():
    return RedirectResponse(url="/index.html", status_code=307)


@app.get("/admin")
@app.get("/admin/")
def admin_home():
    # Vercel serves files from public/ through its static CDN; they are not
    # necessarily present inside the isolated Python function at /var/task.
    # Redirecting keeps /admin convenient without coupling it to that runtime.
    return RedirectResponse(url="/admin.html", status_code=307)




def _reserve_push_delivery(sub: dict, event_key: str, category: str) -> Optional[str]:
    delivery_id = str(uuid.uuid4())
    try:
        db_insert("push_delivery_log", {
            "id": delivery_id,
            "subscription_id": sub["id"],
            "player_id": sub["player_id"],
            "anonymous_id": sub.get("anonymous_id"),
            "event_key": event_key,
            "category": category,
            "status": "pending",
            "created_at": datetime.now(TZ).isoformat(),
        })
        return delivery_id
    except HTTPException as exc:
        if exc.status_code == 409:
            return None
        raise


@app.get("/api/cron/content-push")
def cron_content_push(request: Request, authorization: Optional[str] = Header(default=None)):
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(401, "Neplatné cron oprávnění")
    today = current_prague_date()
    released, _ = _released_batches(today)
    batch = released[-1] if released else None
    if not batch:
        return {"ok": True, "sent": 0, "message": "Zatím není žádný rolling content batch"}
    release_date = _parse_content_date(batch.get("availableFrom"))
    # A weekly cron may be retried later in the same release week, but must never announce
    # an older drop after the next Monday has begun.
    if not release_date or not (0 <= (today - release_date).days <= 6):
        return {"ok": True, "sent": 0, "message": "Tento týden není nový content drop"}
    if not push_ready():
        return {"ok": False, "sent": 0, "message": "VAPID není nakonfigurovaný"}
    if not push_preferences_schema_ready():
        return {"ok": False, "sent": 0, "message": "Notifications v2 migrace ještě není nasazená", "migrationReady": False}
    subscriptions = db_request("GET", "push_subscriptions", params={"select": "*", "content_enabled": "eq.true"})
    event_key = f"content:{batch.get('id')}"
    payload = {
        "title": "✨ 5 nových Propletů",
        "body": "Nová týdenní várka je venku. Jedna úroveň od každé obtížnosti a jedna navíc.",
        "url": f"https://hrajproplet.cz/?open=free&new={batch.get('id')}&via=push-content",
        "tag": f"proplet-{event_key}",
    }
    sent = failed = removed = duplicate = 0
    for sub in subscriptions:
        delivery_id = _reserve_push_delivery(sub, event_key, "content")
        if not delivery_id:
            duplicate += 1
            continue
        info = {"endpoint": sub.get("endpoint"), "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")}}
        try:
            webpush(subscription_info=info, data=json.dumps({**payload, "deliveryId": delivery_id}, ensure_ascii=False), vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400)
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            try:
                db_delete("push_delivery_log", id=delivery_id)  # send did not succeed; a later cron may retry
            except Exception:
                pass
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Content push failed for subscription %s: %s", sub.get("id"), exc)
            continue
        sent += 1
        try:
            db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": datetime.now(TZ).isoformat()})
        except Exception as exc:
            # Keep the unique pending reservation. It is safer to miss bookkeeping than to
            # duplicate a notification that the push provider already accepted.
            logger.warning("Content push sent but delivery ledger update failed for %s: %s", sub.get("id"), exc)
    return {
        "ok": failed == 0,
        "batch": batch.get("id"),
        "releaseDate": batch.get("availableFrom"),
        "sent": sent, "failed": failed, "removed": removed, "duplicate": duplicate,
        "migrationReady": True,
    }


@app.get("/api/health")
def health():
    puzzle_file = PUZZLES_PATH.exists()
    pdata = load_puzzles() if puzzle_file else {}
    base = {
        "date": current_prague_date().isoformat(),
        "puzzleFile": puzzle_file,
        "puzzleSource": str(PUZZLES_PATH.relative_to(ROOT)),
        "gen4CandidatePreview": GEN4_CANDIDATE_PREVIEW,
        "gen4CandidateReadOnly": GEN4_CANDIDATE_PREVIEW,
        "gen4ReleaseStatus": (pdata.get("release") or {}).get("status"),
        "version": APP_VERSION,
        "adminStatic": True,
        "adminEntry": "/admin.html",
        "adminDelivery": "vercel-public-static",
        "vocabularyVersion": pdata.get("lexiconVersion") or pdata.get("vocabularyVersion"),
        "vocabularyTierCounts": pdata.get("vocabularyTierCounts"),
        "freeGeneration": pdata.get("freeGeneration"),
        "freeLevelsPerDifficulty": pdata.get("freeLevelsPerDifficulty") or min((len(bank) for bank in pdata.get("free", {}).values()), default=0),
        "dailyGeneration": pdata.get("dailyGeneration"),
        "dailyGeneration2From": pdata.get("dailyGeneration2From"),
        "dailyGeneration3From": pdata.get("dailyGeneration3From"),
        "dailyRotationBaseDate": pdata.get("dailyRotationBaseDate"),
        "dailyCadence": pdata.get("dailyCadence"),
        "dailyMigration": pdata.get("dailyMigration"),
        "freeMigration": {
            **(pdata.get("freeMigration") or {}),
            "strategy": "fresh-generation-progress",
            "xpPolicy": "once-per-current-board",
            "activeGeneration": pdata.get("freeGeneration"),
            "returningPlayerBonusXp": GEN4_RETURNING_BONUS_XP,
            "retroactiveCurrentGenerationXp": True,
        },
        "tieredDailyFrom": pdata.get("tieredDailyFrom"),
        "freeTieredFromVersion": pdata.get("freeTieredFromVersion"),
        "freeFreezeCutoffs": pdata.get("freeFreezeCutoffs"),
        "uxSprint": "3.20",
        "gameFeelSprint": "3.21",
        "darkModeSprint": "3.22",
        "darkFoundTextHotfix": True,
        "darkFoundChipTextHotfix": True,
        "boardFit2DHotfix": True,
        "foldWebPwaLayoutUnified": True,
        "tabletGameLayoutBreakpointPx": TABLET_LANDSCAPE_BREAKPOINT_PX,
        "themeModes": ["auto", "light", "dark"],
        "themePreferenceScope": "device",
        "orientationBlocking": PHONE_LANDSCAPE_BLOCKING,
        "foldResponsiveReflow": True,
        "starterPuzzle": bool(pdata.get("starter")),
        "starterXp": STARTER_XP,
        "tajenkaWeeksPrepared": int(load_tajenka_bank().get("weeks") or 0),
        "tajenkaRewardXp": TAJENKA_REWARD_XP,
        "tajenkaReleaseEnabled": TAJENKA_RELEASE_ENABLED,
        "tajenkaFirstSaturday": TAJENKA_FIRST_SATURDAY.isoformat(),
        "tajenkaCurrentWeek": tajenka_week_for(current_prague_date()),
        "tajenkaLiveNow": tajenka_is_live(current_prague_date()),
        "starterHintOptional": True,
        "starterHintOfferIdleSeconds": 10,
        "accountWithoutTeam": True,
        "accountNudgeCompletions": [1, 4, 10],
        "launchReadinessSprint": "3.23",
        "publicErrorDetails": False,
        "apiDocsPublic": False,
        "requestBodyLimitKb": MAX_REQUEST_BYTES // 1024,
        "secondarySessionDays": SECONDARY_SESSION_DAYS,
        "securityHeaders": True,
        "accountExport": True,
        "accountDeletion": True,
        "supportChannel": True,
        "launchDashboard": True,
        "newPlayerFunnelVersion": 2,
        "singleMemberTeams": True,
        "xpEconomyVersion": 4,
        "wordDiscoveryXp": 1,
        "wordDiscoveryBoardXpLimit": 5,
        "wordDiscoveryDailyXpLimit": 50,
        "mozkomorXp": POINTS["mozkomor"],
        "rankingsVersion": 2,
        "rollingContentVersion": int(load_rolling_content().get("version") or 0),
        "rollingContentReleaseEnabled": rolling_content_release_enabled(),
        "rollingContentCadence": load_rolling_content().get("cadence"),
        "rollingContentFirstRelease": load_rolling_content().get("firstRelease"),
        "rollingContentReservedThrough": load_rolling_content().get("reservedThrough"),
        "rollingContentAvailableCounts": {d: len(released_free_bank(d, current_prague_date())) for d in ROLLING_DIFFICULTIES},
        "freeBaseLevelCounts": {d: len(load_puzzles().get("free", {}).get(d, [])) for d in FREE_DIFFICULTIES},
        "mozkomorUnlock": load_puzzles().get("mozkomorUnlock"),
        "notificationsV2Migration": push_preferences_schema_ready(),
        "pushOpenTrackingMigration": push_open_tracking_schema_ready(),
        "freeXp": {key: value for key, value in POINTS.items() if key != "daily"},
        "dailyXp": POINTS["daily"],
    }
    if not puzzle_file:
        return {**base, "ok": False, "database": False, "message": "Serverová databáze úloh není součástí deploymentu"}
    if not supabase_ready():
        return {**base, "ok": False, "database": False, "message": "Chybí SUPABASE_URL nebo SUPABASE_SECRET_KEY"}
    try:
        player_probe = db_request("GET", "players", params={"select": "id", "limit": "1"})
        account_migration = True
        try:
            db_request("GET", "player_sessions", params={"select": "id", "limit": "1"})
        except HTTPException:
            account_migration = False
        profiles_migration = True
        try:
            db_request("GET", "players", params={"select": "id,avatar", "limit": "1"})
        except HTTPException:
            profiles_migration = False
        features_migration = True
        try:
            db_request("GET", "results", params={"select": "id,hints_used,clean_solve", "limit": "1"})
            db_request("GET", "streak_rescues", params={"select": "id", "limit": "1"})
        except HTTPException:
            features_migration = False
        quality_migration = True
        try:
            db_request("GET", "results", params={"select": "id,wrong_attempts,max_hint_level", "limit": "1"})
            db_request("GET", "puzzle_attempts", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id", "limit": "1"})
        except HTTPException:
            quality_migration = False
        playtest_migration = True
        try:
            db_request("GET", "leagues", params={"select": "code,name", "limit": "1"})
            db_request("GET", "puzzle_runs", params={"select": "id", "limit": "1"})
            db_request("GET", "push_subscriptions", params={"select": "id", "limit": "1"})
        except HTTPException:
            playtest_migration = False
        global_league_migration = True
        try:
            db_request("GET", "leagues", params={"select": "code,public_opt_in,public_name,public_enabled_at", "limit": "1"})
        except HTTPException:
            global_league_migration = False
        ux_migration = True
        try:
            db_request("GET", "players", params={"select": "id,team_joined_at", "limit": "1"})
        except HTTPException:
            ux_migration = False
        analytics_v2_migration = True
        try:
            db_request("GET", "players", params={"select": "id,support_mode", "limit": "1"})
            db_request("GET", "helper_events", params={"select": "id", "limit": "1"})
            db_request("GET", "hint_events", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_attempts", params={"select": "id,first_correct_ms,first_hint_ms,reset_count,resume_count,last_found_words,last_activity_at", "limit": "1"})
            db_request("GET", "quality_snapshots", params={"select": "id,week_start", "limit": "1"})
        except HTTPException:
            analytics_v2_migration = False
        anonymous_analytics_migration = True
        try:
            db_request("GET", "puzzle_attempts", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "helper_events", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "hint_events", params={"select": "id,anonymous_id", "limit": "1"})
            db_request("GET", "product_events", params={"select": "id,anonymous_id,event_type", "limit": "1"})
        except HTTPException:
            anonymous_analytics_migration = False
        free_generation2_migration = True
        try:
            db_request("GET", "free_slot_rewards", params={"select": "id,level,content_generation", "limit": "1"})
        except HTTPException:
            free_generation2_migration = False
        # v3.21 changes the results mode constraint and backfills one starter reward per
        # pre-existing player. A successful backfill gives us a cheap deployment marker.
        starter_migration = True
        try:
            starter_probe = db_request("GET", "results", params={"select": "id", "mode": "eq.starter", "limit": "1"})
            starter_migration = (not bool(player_probe)) or bool(starter_probe)
        except HTTPException:
            starter_migration = False
        admin_migration = True
        try:
            db_request("GET", "admin_accounts", params={"select": "player_id,role,active", "limit": "1"})
            db_request("GET", "admin_audit_log", params={"select": "id", "limit": "1"})
            db_request("GET", "puzzle_feedback", params={"select": "id,status,resolution_note,reviewed_at,reviewed_by", "limit": "1"})
        except HTTPException:
            admin_migration = False
        security_migration = True
        try:
            db_request("GET", "player_sessions", params={"select": "id,expires_at,last_used_at", "limit": "1"})
            db_request("GET", "security_rate_limits", params={"select": "scope,actor_hash,window_start,hits", "limit": "1"})
            db_request("GET", "operational_events", params={"select": "id,event_type,severity", "limit": "1"})
            db_request("GET", "support_reports", params={"select": "id,category,status", "limit": "1"})
            db_rpc("proplet_rate_limit", {"p_scope": "health_probe", "p_actor_hash": hashlib.sha256(b"health-probe").hexdigest(), "p_window_seconds": 60, "p_limit": 10000})
        except HTTPException:
            security_migration = False
        xp_migration = False
        try:
            xp_migration = xp_economy_migrated()
        except HTTPException:
            xp_migration = False
        return {**base, "ok": bool(security_migration and xp_migration), "database": True, "accountMigration": account_migration, "featuresMigration": features_migration, "qualityMigration": quality_migration, "playtestMigration": playtest_migration, "globalLeagueMigration": global_league_migration, "uxMigration": ux_migration, "profilesMigration": profiles_migration, "analyticsV2Migration": analytics_v2_migration, "anonymousAnalyticsMigration": anonymous_analytics_migration, "anonymousAnalytics": anonymous_analytics_migration, "freeGeneration2Migration": free_generation2_migration, "freeProgressionMigration": free_generation2_migration, "stableFreeLevelSlots": True, "starterMigration": starter_migration, "adminMigration": admin_migration, "securityMigration": security_migration, "xpMigration": xp_migration, "rankingsV2Migration": rankings_v2_schema_ready(), "helperSystem": analytics_v2_migration, "pushConfigured": push_ready(), "cronConfigured": bool(CRON_SECRET)}
    except HTTPException:
        return {**base, "ok": False, "database": False, "accountMigration": False, "featuresMigration": False, "qualityMigration": False, "playtestMigration": False, "globalLeagueMigration": False, "uxMigration": False, "profilesMigration": False, "analyticsV2Migration": False, "anonymousAnalyticsMigration": False, "anonymousAnalytics": False, "freeGeneration2Migration": False, "freeProgressionMigration": False, "stableFreeLevelSlots": True, "starterMigration": False, "adminMigration": False, "securityMigration": False, "xpMigration": False, "pushConfigured": push_ready(), "pushOpenTrackingMigration": False, "message": "Databázový health check selhal"}


@app.get("/api/config")
def config():
    p = load_puzzles()
    return {
        "badges": BADGES,
        "points": {**POINTS, "starter": STARTER_XP},
        "dictionarySize": p["dictionarySize"],
        "dailyRotationSize": p["dailyRotationSize"],
        "dailyGeneration": p.get("dailyGeneration"),
        "dailyGeneration3From": p.get("dailyGeneration3From"),
        "dailyCadence": p.get("dailyCadence"),
        "rescueBankSize": len(p.get("rescue", [])),
        "pushAvailable": push_ready(),
        "environment": VERCEL_ENV or "local",
        "version": APP_VERSION,
    }


@app.get("/api/teams")
@app.get("/api/leagues")
def list_leagues(request: Request):
    """Public team discovery: minimal join metadata only; never player rows or PIN hashes."""
    enforce_rate_limit(request, "team_discovery", limit=120, window_seconds=3600)
    try:
        rows = db_select("leagues")
    except HTTPException:
        rows = []
    out = [
        {
            "code": r.get("code"),
            "name": r.get("name") or r.get("code"),
            "protected": bool(r.get("pin_hash")),
        }
        for r in rows
    ]
    out.sort(key=lambda x: str(x["name"]).casefold())
    return {"leagues": out}


@app.post("/api/player")
def create_player(payload: PlayerCreate, request: Request):
    enforce_rate_limit(request, "account_create_ip", limit=8, window_seconds=3600)
    name = " ".join(payload.name.strip().split())
    requested_family = norm_family(payload.family_code or "")
    solo = len(requested_family) < 2
    family = requested_family if not solo else f"{SOLO_FAMILY_PREFIX}{secrets.token_hex(6).upper()}"
    if not name:
        raise HTTPException(400, "Vyplň jméno")
    if solo and not payload.password:
        raise HTTPException(400, "Nový účet potřebuje heslo")

    if not solo:
        league_rows = db_select("leagues", code=family)
        if payload.create_league:
            display_name = " ".join((payload.league_name or payload.family_code or "").strip().split())[:40]
            if league_rows:
                raise HTTPException(409, "Tým s tímto názvem už existuje. Přidej se k němu místo zakládání nového.")
            if not payload.league_pin or len(payload.league_pin.strip()) < 4:
                raise HTTPException(400, "Nový tým potřebuje PIN alespoň 4 znaky")
            db_insert("leagues", {"code": family, "name": display_name or family, "pin_hash": hash_password(payload.league_pin.strip()), "created_at": datetime.now(TZ).isoformat()})
            league_rows = db_select("leagues", code=family)
        elif not league_rows:
            # Backward compatibility for cached pre-v3.20 clients.
            db_insert("leagues", {"code": family, "name": family, "created_at": datetime.now(TZ).isoformat()})
            league_rows = db_select("leagues", code=family)
        else:
            if not league_rows[0].get("pin_hash"):
                raise HTTPException(409, "Tento tým ještě nemá nastavený vstupní PIN. Některý přihlášený člen ho může nastavit v profilu.")
            if not payload.league_pin or not verify_password(payload.league_pin.strip(), league_rows[0].get("pin_hash")):
                raise HTTPException(401, "PIN týmu nesedí")

        family_players = db_select("players", family_code=family)
        if any(p["name"].casefold() == name.casefold() for p in family_players):
            raise HTTPException(409, "V tomto týmu už hráč s tímto jménem existuje")

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    player_id = str(uuid.uuid4())
    now = datetime.now(TZ).isoformat()
    row = {
        "id": player_id,
        "name": name,
        "family_code": family,
        "avatar": "🙂",
        "support_mode": "none",
        "token_hash": token_hash,
        "created_at": now,
    }
    if not solo:
        row["team_joined_at"] = now
    if payload.password:
        row["password_hash"] = hash_password(payload.password)

    try:
        db_insert("players", row)
    except HTTPException as exc:
        if exc.status_code == 409:
            raise HTTPException(409, "Takový hráč už existuje")
        raise

    if not solo and row.get("team_joined_at"):
        try:
            db_insert("team_memberships", {
                "id": str(uuid.uuid4()), "player_id": player_id, "team_code": family,
                "joined_at": row["team_joined_at"], "created_at": row["team_joined_at"],
            })
        except HTTPException:
            logger.warning("Could not create initial team_membership for player %s", player_id)
    stats = player_stats(player_id)
    public_family = public_family_code(family, row.get("team_joined_at"))
    return {
        "id": player_id, "name": name, "familyCode": public_family,
        "leagueName": league_name_for(family) if public_family else None, "token": token,
        "hasPassword": bool(payload.password), "avatar": row.get("avatar") or "🙂", "googleLinked": False, "googleAvatarUrl": None, "useGoogleAvatar": False,
        "supportMode": row.get("support_mode") or "none", "publicRankings": row.get("public_rankings"), "stats": stats,
    }


@app.post("/api/login")
def login(payload: PlayerLogin, request: Request):
    enforce_rate_limit(request, "login_ip", limit=30, window_seconds=300)
    enforce_rate_limit(request, "login_account", limit=8, window_seconds=300, discriminator=payload.name)
    family = norm_family(payload.family_code or "")
    identifier = " ".join(payload.name.strip().split())
    if "@" in identifier:
        # Recovery email becomes a login identifier only after ownership was verified.
        email = identifier.casefold()
        candidates = [p for p in db_select("players") if p.get("email_verified_at") and str(p.get("email") or "").casefold() == email]
    elif family:
        candidates = [p for p in db_select("players", family_code=family) if p.get("name", "").casefold() == identifier.casefold()]
    else:
        # Teamless login is intentionally simple for the player. We only use
        # team when an old duplicate name needs disambiguation.
        candidates = [p for p in db_select("players") if p.get("name", "").casefold() == identifier.casefold()]

    if not candidates:
        raise HTTPException(401, "Jméno nebo heslo nesedí")
    password_matches = [p for p in candidates if p.get("password_hash") and verify_password(payload.password, p.get("password_hash"))]
    if not password_matches:
        if len(candidates) == 1 and not candidates[0].get("password_hash"):
            raise HTTPException(409, "Tento hráč ještě nemá heslo. Nastav ho na zařízení, kde už je přihlášený.")
        raise HTTPException(401, "Jméno nebo heslo nesedí")
    if len(password_matches) > 1 and not family:
        raise HTTPException(409, "Našli jsme více účtů se stejným jménem. Otevři volbu pro starší týmový účet a vyber svůj tým.")
    player = password_matches[0]

    token = new_session(player["id"])
    public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"], "name": player["name"], "familyCode": public_family,
        "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
        "token": token, "hasPassword": True, "avatar": player.get("avatar") or "🙂",
        "googleLinked": bool(player.get("auth_user_id")), "googleAvatarUrl": player.get("google_avatar_url"), "useGoogleAvatar": bool(player.get("use_google_avatar")),
        "supportMode": player.get("support_mode") or "none", "publicRankings": player.get("public_rankings"), "stats": player_stats(player["id"]),
    }


@app.post("/api/anonymous/claim")
def claim_anonymous(payload: AnonymousClaim, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "anonymous_claim", limit=12, window_seconds=3600)
    """Attach anonymous telemetry from this installation to the newly authenticated player.

    This prevents one person from being counted twice after creating/logging into an account.
    Official results, XP and leaderboards are never created here; only QA telemetry is reassigned.
    """
    player = auth_player(authorization)
    anon = anonymous_hash(payload.anonymous_id)
    if not anon:
        raise HTTPException(400, "Chybí anonymní ID")
    claimed = {"attempts": 0, "helperEvents": 0, "hintEvents": 0, "productEvents": 0, "feedback": 0, "pushSubscriptions": 0}
    for table, key in (("puzzle_attempts", "attempts"), ("helper_events", "helperEvents"), ("hint_events", "hintEvents"), ("product_events", "productEvents")):
        rows = db_select(table, anonymous_id=anon)
        if rows:
            db_update(table, {"anonymous_id": anon}, {"player_id": player["id"], "anonymous_id": None})
            claimed[key] = len(rows)
    # Feedback has a unique player/puzzle/kind constraint. Merge row-by-row so an existing
    # authenticated vote wins over a duplicate anonymous vote rather than making claim fail.
    for row in db_select("puzzle_feedback", anonymous_id=anon):
        candidates = db_select("puzzle_feedback", player_id=player["id"], puzzle_id=row.get("puzzle_id"), kind=row.get("kind"))
        if row.get("kind") == "word":
            report_word = str(row.get("word") or "").strip().casefold()
            existing = [candidate for candidate in candidates if str(candidate.get("word") or "").strip().casefold() == report_word]
        else:
            existing = candidates
        if existing:
            db_delete("puzzle_feedback", id=row["id"])
        else:
            db_update("puzzle_feedback", {"id": row["id"]}, {"player_id": player["id"], "anonymous_id": None})
        claimed["feedback"] += 1
    push_rows = db_select("push_subscriptions", anonymous_id=anon)
    if push_rows:
        delivery_rows = db_select("push_delivery_log", anonymous_id=anon)
        if delivery_rows:
            db_update("push_delivery_log", {"anonymous_id": anon}, {"player_id": player["id"], "anonymous_id": None})
        db_update("push_subscriptions", {"anonymous_id": anon}, {"player_id": player["id"], "anonymous_id": None})
        claimed["pushSubscriptions"] = len(push_rows)
    return {"ok": True, "claimed": claimed}


@app.post("/api/password")
def set_password(payload: PasswordSet, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "password_set", limit=12, window_seconds=3600)
    player = auth_player(authorization)
    if player.get("password_hash"):
        raise HTTPException(409, "Heslo už je nastavené. Změnu hesla zatím řeš přes podporu.")
    db_update("players", {"id": player["id"]}, {"password_hash": hash_password(payload.password)})
    return {"ok": True, "hasPassword": True}


@app.post("/api/avatar")
def set_avatar(payload: AvatarSet, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "avatar_update", limit=60, window_seconds=3600)
    player = auth_player(authorization)
    if payload.use_google_avatar:
        if not player.get("google_avatar_url"):
            raise HTTPException(400, "Google fotka zatím není dostupná. Přihlas se znovu přes Google.")
        db_update("players", {"id": player["id"]}, {"use_google_avatar": True})
        return {"ok": True, "avatar": player.get("avatar") or "🙂", "useGoogleAvatar": True, "googleAvatarUrl": player["google_avatar_url"]}
    avatar = (payload.avatar or "").strip()[:16]
    if not avatar:
        raise HTTPException(400, "Vyber avatar")
    db_update("players", {"id": player["id"]}, {"avatar": avatar, "use_google_avatar": False})
    return {"ok": True, "avatar": avatar, "useGoogleAvatar": False, "googleAvatarUrl": player.get("google_avatar_url")}


@app.post("/api/support-mode")
def set_support_mode(payload: SupportModeSet, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "support_mode_update", limit=60, window_seconds=3600)
    player = auth_player(authorization)
    allowed = {"none", "beginner", "younger", "older"}
    mode = (payload.support_mode or "none").strip().lower()
    if mode not in allowed:
        raise HTTPException(400, "Neplatná úroveň podpory")
    db_update("players", {"id": player["id"]}, {"support_mode": mode})
    return {"ok": True, "supportMode": mode}


def _telemetry_attempt(actor: dict, attempt_id: str, puzzle_id: str, challenge_key: str) -> Optional[dict]:
    filters = {"id": attempt_id, **actor_filters(actor)}
    rows = db_select("puzzle_attempts", **filters)
    if not rows:
        return None
    row = rows[0]
    if row.get("puzzle_id") != puzzle_id or row.get("challenge_key") != challenge_key:
        raise HTTPException(400, "Telemetry neodpovídá pokusu")
    return row


@app.post("/api/helper-event")
def helper_event(
    payload: HelperEventCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "helper_event", limit=120, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed_events = {"offered", "accepted", "dismissed"}
    if payload.event_type not in allowed_events:
        raise HTTPException(400, "Neplatný helper event")
    if not _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    player = actor.get("player")
    support_mode = (player or {}).get("support_mode") or "none"
    db_insert("helper_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "attempt_id": payload.attempt_id, "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "event_type": payload.event_type, "support_mode": support_mode,
        "elapsed_ms": payload.elapsed_ms, "idle_ms": payload.idle_ms,
        "found_words": payload.found_words, "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/hint-event")
def hint_event(
    payload: HintEventCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "hint_event", limit=120, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if payload.source not in {"manual", "helper"}:
        raise HTTPException(400, "Neplatný zdroj nápovědy")
    if not _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key):
        return {"ok": True, "ignored": True}
    player = actor.get("player")
    support_mode = (player or {}).get("support_mode") or "none"
    af = actor_filters(actor)
    previous_hints = db_select("hint_events", attempt_id=payload.attempt_id, **af)
    sibling_attempts = db_select("puzzle_attempts", challenge_key=payload.challenge_key, **af)
    first_attempt_id = None
    if sibling_attempts:
        first_attempt_id = min(sibling_attempts, key=lambda a: (str(a.get("started_at") or ""), str(a.get("id") or ""))).get("id")
    complimentary = (
        actor.get("player_id") is not None
        and payload.hint_level == 1
        and support_mode in {"beginner", "younger"}
        and payload.attempt_id == first_attempt_id
        and not previous_hints
    )
    db_insert("hint_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "attempt_id": payload.attempt_id, "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "hint_level": payload.hint_level, "source": payload.source, "support_mode": support_mode,
        "complimentary": complimentary, "elapsed_ms": payload.elapsed_ms,
        "found_words": payload.found_words, "total_words": payload.total_words,
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True, "complimentary": complimentary}


@app.post("/api/product-event")
def product_event(
    payload: ProductEventCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "product_event", limit=300, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed = {
        "app_open", "app_session_started",
        "screen_daily_viewed", "screen_free_viewed", "screen_leaderboard_viewed", "screen_profile_viewed",
        "onboarding_started", "onboarding_tutorial_completed", "onboarding_support_selected",
        "onboarding_support_selected_none", "onboarding_support_selected_beginner",
        "onboarding_support_selected_younger", "onboarding_support_selected_older", "onboarding_completed",
        "helper_onboarding_started", "helper_default_applied", "onboarding_principle_shown", "onboarding_principle_completed",
        "onboarding_login_clicked", "onboarding_login_authenticated", "onboarding_skipped_known_player",
        "onboarding_returning_state_detected", "onboarding_skipped_returning_state",
        "account_nudge_shown", "account_nudge_create", "account_nudge_login", "account_nudge_dismissed",
        "account_authenticated", "account_created", "account_logged_in",
        "starter_started", "starter_hint_offer_shown", "starter_hint_used", "starter_reset",
        "starter_word_1_completed", "starter_word_2_completed", "starter_word_3_completed", "starter_completed",
        "starter_hard_choice_shown", "starter_hard_direct_selected", "starter_easy_warmup_selected", "starter_easy_warmup_completed",
        "win_account_cta_shown", "win_account_cta_create", "win_account_cta_authenticated",
        "pwa_install_nudge_shown", "pwa_install_profile_closed", "pwa_install_nudge_dismissed",
        "pwa_install_ios_hint_ack", "pwa_install_native_accepted", "pwa_install_native_dismissed",
        "pwa_install_profile_opened", "pwa_installed",
        "push_nudge_shown", "push_nudge_accepted", "push_nudge_dismissed", "push_permission_denied",
        "first_win_return_nudge_shown", "first_win_return_nudge_accepted", "first_win_return_nudge_dismissed",
        "push_daily_enabled", "push_daily_disabled", "push_content_enabled", "push_content_disabled",
        "push_notifications_enabled", "push_notifications_disabled", "push_notifications_auto_repaired",
        "push_daily_opened", "push_weekly_opened", "push_content_opened", "push_return_opened", "push_tajenka_opened",
        "pwa_update_detected", "pwa_update_applied", "legacy_origin_update_shown", "legacy_origin_update_opened",
        "content_drop_cta_clicked",
        "tajenka_viewed", "tajenka_started", "tajenka_word_found", "tajenka_completed", "tajenka_abandoned",
        "progress_guard_desktop_shown", "progress_guard_mobile_shown", "progress_guard_dismissed",
        "progress_guard_google_selected", "progress_guard_other_account_selected",
        "calm_preference_enabled", "calm_preference_disabled", "calm_run_enabled",
        "difficulty_nudge_shown", "difficulty_nudge_accepted", "difficulty_nudge_declined",
        "valid_nonsolution_failsafe_shown", "valid_nonsolution_detected",
        "word_discovery_claim_rejected",
        *{f"account_nudge_{stage}_{action}" for stage in (1, 2, 3) for action in ("shown", "create", "login", "dismissed", "authenticated")},
        *{f"difficulty_nudge_{action}_{source}_{target}" for action in ("shown", "accepted", "declined") for source, target in (("easy", "medium"), ("medium", "hard"), ("hard", "hardcore"))},
        *{f"difficulty_nudge_followup_{step}" for step in (1, 2, 3)},
        *{f"difficulty_nudge_followup_{step}_{target}" for step in (1, 2, 3) for target in ("medium", "hard", "hardcore")},
    }
    if payload.event_type not in allowed:
        raise HTTPException(400, "Neplatný product event")
    db_insert("product_events", {
        "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "event_type": payload.event_type, "app_version": client_app_version(request), "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True}


@app.post("/api/team-pin")
def set_team_pin(payload: TeamPinSet, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_pin_set", limit=12, window_seconds=3600)
    player = auth_player(authorization)
    team = norm_family(str(player.get("family_code") or ""))
    if is_solo_player(player):
        raise HTTPException(400, "Nejdřív se připoj k týmu nebo ho založ")
    rows = db_select("leagues", code=team)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    db_update("leagues", {"code": team}, {"pin_hash": hash_password(payload.pin.strip())})
    return {"ok": True, "hasPin": True}


@app.post("/api/team-membership")
def set_team_membership(payload: TeamMembershipSet, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_membership", limit=15, window_seconds=600, discriminator=payload.family_code or payload.league_name or payload.mode)
    player = auth_player(authorization)
    if VERCEL_ENV == "preview":
        raise HTTPException(409, "V preview se týmová data z bezpečnostních důvodů nemění")
    current_family = norm_family(str(player.get("family_code") or ""))
    if not is_solo_player(player):
        raise HTTPException(409, "Tento hráč už je v týmu")

    if payload.mode == "new":
        display_name = " ".join((payload.league_name or "").strip().split())[:40]
        family = norm_family(display_name)
        if len(family) < 2:
            raise HTTPException(400, "Pojmenuj nový tým")
        if db_select("leagues", code=family):
            raise HTTPException(409, "Tým s tímto názvem už existuje. Přidej se k němu.")
        db_insert("leagues", {
            "code": family, "name": display_name, "pin_hash": hash_password(payload.league_pin.strip()),
            "created_at": datetime.now(TZ).isoformat(),
        })
    else:
        family = norm_family(payload.family_code or "")
        if len(family) < 2:
            raise HTTPException(400, "Vyber tým")
        rows = db_select("leagues", code=family)
        if not rows:
            raise HTTPException(404, "Tým neexistuje")
        if not rows[0].get("pin_hash"):
            raise HTTPException(409, "Tento tým ještě nemá nastavený vstupní PIN")
        if not verify_password(payload.league_pin.strip(), rows[0].get("pin_hash")):
            raise HTTPException(401, "PIN týmu nesedí")

    target_players = db_select("players", family_code=family)
    if any(p.get("id") != player.get("id") and p.get("name", "").casefold() == player.get("name", "").casefold() for p in target_players):
        raise HTTPException(409, "V tomto týmu už je hráč se stejným jménem")
    joined_at = datetime.now(TZ).isoformat()
    db_update("players", {"id": player["id"]}, {"family_code": family, "team_joined_at": joined_at})
    try:
        db_insert("team_memberships", {
            "id": str(uuid.uuid4()), "player_id": player["id"], "team_code": family,
            "joined_at": joined_at, "created_at": joined_at,
        })
    except HTTPException as exc:
        # Avoid a half-switched player if the new history layer is unavailable.
        db_update("players", {"id": player["id"]}, {"family_code": current_family, "team_joined_at": player.get("team_joined_at")})
        raise HTTPException(503, "Týmová aktualizace se nepodařila dokončit") from exc
    return {"ok": True, "familyCode": family, "leagueName": league_name_for(family)}


@app.post("/api/logout")
def logout(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "logout", limit=60, window_seconds=3600)
    if not authorization or not authorization.lower().startswith("bearer "):
        return {"ok": True}
    token = authorization.split(" ", 1)[1].strip()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    sessions = db_select("player_sessions", token_hash=token_hash)
    if sessions:
        db_delete("player_sessions", id=sessions[0]["id"])
        return {"ok": True}
    # The original device token lives on players. Rotate it so this particular token stops working;
    # independent sessions on other devices remain valid.
    players = db_select("players", token_hash=token_hash)
    if players:
        db_update("players", {"id": players[0]["id"]}, {"token_hash": hashlib.sha256(secrets.token_urlsafe(32).encode()).hexdigest()})
    return {"ok": True}


@app.get("/api/me")
def me(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "me_read", limit=600, window_seconds=3600)
    player = auth_player(authorization)
    stats = player_stats(player["id"])
    public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"], "name": player["name"], "familyCode": public_family,
        "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
        "hasPassword": bool(player.get("password_hash")), "avatar": player.get("avatar") or "🙂",
        "googleLinked": bool(player.get("auth_user_id")), "googleAvatarUrl": player.get("google_avatar_url"), "useGoogleAvatar": bool(player.get("use_google_avatar")),
        "supportMode": player.get("support_mode") or "none", "publicRankings": player.get("public_rankings"), "stats": stats,
    }


@app.get("/api/progress")
def progress(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "progress_read", limit=240, window_seconds=3600)
    player = auth_player(authorization)
    rows = db_select("results", player_id=player["id"])
    def completion_payload(r: dict) -> dict:
        info = free_puzzle_info(str(r.get("puzzle_id") or ""), str(r.get("difficulty") or "")) if r.get("mode") == "free" else None
        return {
            "puzzleId": r.get("puzzle_id"),
            "challengeKey": r.get("challenge_key"),
            "mode": r.get("mode"),
            "difficulty": r.get("difficulty"),
            "dailyDate": str(r.get("daily_date"))[:10] if r.get("daily_date") else None,
            "elapsedMs": int(r.get("best_elapsed_ms") or 1000),
            "moves": int(r.get("best_moves") or 1),
            "points": int(r.get("points") or 0),
            "hintsUsed": int(r.get("hints_used") or 0),
            "wrongAttempts": int(r.get("wrong_attempts") or 0),
            "maxHintLevel": int(r.get("max_hint_level") or 0),
            "cleanSolve": r.get("clean_solve") is True,
            "completedAt": r.get("completed_at"),
            "level": info.get("level") if info else None,
            "contentGeneration": info.get("generation") if info else None,
            "legacy": info.get("legacy") if info else False,
        }
    return {
        "completed": [completion_payload(r) for r in rows]
    }


@app.get("/api/account/export")
def account_export(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "account_export", limit=12, window_seconds=3600)
    player = auth_player(authorization)
    player_id = player["id"]
    public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    sessions = db_select("player_sessions", player_id=player_id)
    pushes = db_select("push_subscriptions", player_id=player_id)
    return {
        "exportedAt": datetime.now(TZ).isoformat(),
        "appVersion": APP_VERSION,
        "profile": {
            "id": player_id,
            "name": player.get("name"),
            "avatar": player.get("avatar") or "🙂",
            "familyCode": public_family,
            "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
            "supportMode": player.get("support_mode") or "none",
            "createdAt": player.get("created_at"),
            "teamJoinedAt": player.get("team_joined_at"),
            "publicRankings": player.get("public_rankings"),
            "hasPassword": bool(player.get("password_hash")),
        },
        "results": db_select("results", player_id=player_id),
        "attempts": db_select("puzzle_attempts", player_id=player_id),
        "runs": db_select("puzzle_runs", player_id=player_id),
        "feedback": db_select("puzzle_feedback", player_id=player_id),
        "helperEvents": db_select("helper_events", player_id=player_id),
        "hintEvents": db_select("hint_events", player_id=player_id),
        "productEvents": db_select("product_events", player_id=player_id),
        "rescues": db_select("streak_rescues", player_id=player_id),
        "supportReports": db_select("support_reports", player_id=player_id),
        "sessions": [{"createdAt": row.get("created_at"), "lastUsedAt": row.get("last_used_at"), "expiresAt": row.get("expires_at")} for row in sessions],
        "pushSubscriptions": [{"endpoint": row.get("endpoint"), "userAgent": row.get("user_agent"), "createdAt": row.get("created_at"), "updatedAt": row.get("updated_at")} for row in pushes],
    }


@app.delete("/api/account")
def delete_account(payload: AccountDeleteConfirm, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "account_delete", limit=5, window_seconds=3600)
    player = auth_player(authorization)
    if payload.confirmation.strip().upper() != "SMAZAT":
        raise HTTPException(400, "Pro smazání napiš přesně SMAZAT")
    if player.get("password_hash"):
        if not payload.password or not verify_password(payload.password, player.get("password_hash")):
            raise HTTPException(401, "Heslo nesedí")
    active_admin = [row for row in db_select("admin_accounts", player_id=player["id"]) if row.get("active") is True]
    if active_admin:
        raise HTTPException(409, "Aktivní administrátorský účet nejde smazat. Nejdřív zruš admin oprávnění.")
    db_delete("players", id=player["id"])
    return {"ok": True, "deleted": True}


@app.post("/api/support-report")
def support_report(
    payload: SupportReportCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "support_report", limit=8, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    message = "\n".join(line.strip() for line in str(payload.message).strip().splitlines() if line.strip())[:1200]
    if len(message) < 3:
        raise HTTPException(400, "Popiš prosím problém trochu podrobněji")
    reply_to = " ".join(str(payload.reply_to or "").strip().split())[:160] or None
    row = db_insert("support_reports", {
        "id": str(uuid.uuid4()),
        "player_id": actor.get("player_id"),
        "anonymous_id": actor.get("anonymous_id"),
        "category": payload.category,
        "message": message,
        "reply_to": reply_to,
        "page": str(payload.page or "")[:120] or None,
        "app_version": client_app_version(request),
        "status": "new",
        "created_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True, "reportId": row.get("id")}


@app.post("/api/client-error")
def client_error(
    payload: ClientErrorCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "client_error", limit=20, window_seconds=3600)
    actor_kind = "network"
    try:
        actor = telemetry_actor(authorization, x_proplet_anon_id)
        actor_kind = "player" if actor.get("player_id") else "anonymous"
    except HTTPException:
        pass
    # Message is intentionally truncated; never accept client-supplied stack traces or tokens.
    message_code = re.sub(r"[^a-zA-Z0-9_.:-]+", "_", str(payload.code or "client_error"))[:80]
    record_operational_event(
        "client_error",
        severity="error",
        request_id=getattr(request.state, "request_id", None),
        route=(payload.route or request.url.path)[:120],
        actor_kind=actor_kind,
        code=message_code,
        metadata={"message": str(payload.message or "")[:200]},
    )
    return {"ok": True}


def merged_hint_count(old_value, new_value: int) -> int:
    try:
        old = int(old_value) if old_value is not None else int(new_value)
    except (TypeError, ValueError):
        old = int(new_value)
    return min(old, int(new_value))


@app.post("/api/attempt/start")
def attempt_start(
    payload: AttemptStart,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "attempt_start", limit=180, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if payload.mode not in ("daily", "free") or payload.difficulty not in POINTS:
        raise HTTPException(400, "Neplatný pokus")
    if not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
        raise HTTPException(400, "Neznámá úloha")
    if payload.mode == "free" and payload.challenge_key != f"free:{payload.puzzle_id}":
        raise HTTPException(400, "Neplatný klíč pokusu")
    if payload.mode == "daily":
        if not payload.challenge_key.startswith("daily:"):
            raise HTTPException(400, "Neplatný Daily klíč pokusu")
        daily_date = payload.challenge_key[6:]
        try:
            date.fromisoformat(daily_date)
        except ValueError:
            raise HTTPException(400, "Neplatné datum Daily pokusu")
        if not daily_puzzle_matches_date(payload.puzzle_id, daily_date):
            raise HTTPException(400, "Tato úloha nepatří k Daily datu")
    filters = {"id": payload.attempt_id, **actor_filters(actor)}
    existing = db_select("puzzle_attempts", **filters)
    if existing:
        row = existing[0]
        if any((
            row.get("puzzle_id") != payload.puzzle_id,
            row.get("challenge_key") != payload.challenge_key,
            row.get("mode") != payload.mode,
            row.get("difficulty") != payload.difficulty,
        )):
            raise HTTPException(400, "ID pokusu už patří jiné úloze")
        return {"ok": True, "attemptId": payload.attempt_id}
    db_insert("puzzle_attempts", {
        "id": payload.attempt_id, "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "mode": payload.mode, "difficulty": payload.difficulty,
        "started_at": datetime.now(TZ).isoformat(), "app_version": client_app_version(request),
        "calm_mode": bool(payload.calm_mode),
    })
    return {"ok": True, "attemptId": payload.attempt_id, "anonymous": actor.get("player_id") is None}


@app.post("/api/attempt/checkpoint")
def attempt_checkpoint(
    payload: AttemptCheckpoint,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "attempt_checkpoint", limit=600, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    allowed = {"correct", "hint", "reset", "resume", "leave"}
    if payload.event_type not in allowed:
        raise HTTPException(400, "Neplatný checkpoint")
    rows = db_select("puzzle_attempts", id=payload.attempt_id, **actor_filters(actor))
    if not rows:
        return {"ok": True, "ignored": True}
    row = rows[0]
    values = {
        "last_found_words": max(int(row.get("last_found_words") or 0), int(payload.found_words)),
        "last_activity_at": datetime.now(TZ).isoformat(),
    }
    if payload.calm_mode is not None:
        # A run may switch into calm mode mid-game; it never switches back within that run.
        values["calm_mode"] = bool(row.get("calm_mode") is True or payload.calm_mode)
    if payload.event_type == "correct" and row.get("first_correct_ms") is None:
        values["first_correct_ms"] = int(payload.elapsed_ms)
    elif payload.event_type == "hint" and row.get("first_hint_ms") is None:
        values["first_hint_ms"] = int(payload.elapsed_ms)
    elif payload.event_type == "reset":
        values["reset_count"] = int(row.get("reset_count") or 0) + 1
    elif payload.event_type == "resume":
        values["resume_count"] = int(row.get("resume_count") or 0) + 1
    db_update("puzzle_attempts", {"id": payload.attempt_id}, values)
    return {"ok": True}


@app.post("/api/attempt/finish")
def attempt_finish(
    payload: AttemptFinishTelemetry,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "attempt_finish", limit=180, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    row = _telemetry_attempt(actor, payload.attempt_id, payload.puzzle_id, payload.challenge_key)
    if row and (row.get("mode") != payload.mode or row.get("difficulty") != payload.difficulty):
        raise HTTPException(400, "Telemetry neodpovídá režimu pokusu")
    if not row:
        if payload.mode not in ("daily", "free") or payload.difficulty not in POINTS or not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
            raise HTTPException(400, "Neplatný dokončený pokus")
        if payload.mode == "free" and payload.challenge_key != f"free:{payload.puzzle_id}":
            raise HTTPException(400, "Neplatný klíč dokončeného pokusu")
        if payload.mode == "daily":
            if not payload.challenge_key.startswith("daily:"):
                raise HTTPException(400, "Neplatný klíč dokončeného Daily")
            daily_date = payload.challenge_key[6:]
            try:
                date.fromisoformat(daily_date)
            except ValueError:
                raise HTTPException(400, "Neplatné datum Daily")
            if not daily_puzzle_matches_date(payload.puzzle_id, daily_date):
                raise HTTPException(400, "Tato úloha nepatří k Daily datu")
        db_insert("puzzle_attempts", {
            "id": payload.attempt_id, "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
            "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key, "mode": payload.mode,
            "difficulty": payload.difficulty, "started_at": datetime.now(TZ).isoformat(), "app_version": client_app_version(request),
            "calm_mode": bool(payload.calm_mode),
        })
    completed_at = payload.completed_at or datetime.now(TZ).isoformat()
    try:
        completed_at = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00")).isoformat()
    except Exception:
        completed_at = datetime.now(TZ).isoformat()
    db_update("puzzle_attempts", {"id": payload.attempt_id}, {
        "completed_at": completed_at, "elapsed_ms": payload.elapsed_ms, "moves": payload.moves,
        "wrong_attempts": payload.wrong_attempts, "hints_used": payload.hints_used,
        "max_hint_level": payload.max_hint_level, "clean_solve": payload.clean_solve,
        "calm_mode": bool(payload.calm_mode),
        "last_activity_at": datetime.now(TZ).isoformat(),
    })
    return {"ok": True, "anonymous": actor.get("player_id") is None}


@app.post("/api/feedback")
def puzzle_feedback(
    payload: FeedbackCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "puzzle_feedback", limit=30, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if payload.kind not in ("difficulty", "word"):
        raise HTTPException(400, "Neplatný typ zpětné vazby")
    info = puzzle_info(payload.puzzle_id)
    if not info:
        raise HTTPException(400, "Neznámá úloha")
    if payload.kind == "difficulty" and payload.rating is None:
        raise HTTPException(400, "Chybí hodnocení obtížnosti")
    clean_word = " ".join(str(payload.word or "").strip().upper().split()) or None
    if payload.kind == "word":
        if not clean_word:
            raise HTTPException(400, "Vyber slovo, které chceš nahlásit")
        answers = {str(answer.get("word") or "").strip().upper() for answer in info["puzzle"].get("answers", [])}
        if clean_word not in answers:
            raise HTTPException(400, "Toto slovo do úlohy nepatří")
    af = actor_filters(actor)
    candidates = db_select("puzzle_feedback", puzzle_id=payload.puzzle_id, kind=payload.kind, **af)
    existing = candidates if payload.kind == "difficulty" else [
        item for item in candidates if str(item.get("word") or "").strip().casefold() == str(clean_word or "").casefold()
    ]
    row = {
        "rating": payload.rating if payload.kind == "difficulty" else None,
        "word": clean_word if payload.kind == "word" else None,
        "note": " ".join(str(payload.note or "").strip().split()) or None,
        "created_at": datetime.now(TZ).isoformat(),
    }
    if payload.kind == "word":
        row.update({"status": "new", "resolution_note": None, "reviewed_at": None, "reviewed_by": None})
    if existing:
        db_update("puzzle_feedback", {"id": existing[0]["id"]}, row)
    else:
        db_insert("puzzle_feedback", {
            "id": str(uuid.uuid4()), "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
            "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key, "kind": payload.kind, **row,
        })
    return {"ok": True, "anonymous": actor.get("player_id") is None}


def _median(vals: list[int]) -> Optional[int]:
    if not vals:
        return None
    vals = sorted(vals)
    n = len(vals)
    return vals[n // 2] if n % 2 else round((vals[n // 2 - 1] + vals[n // 2]) / 2)


def build_quality_report():
    """Quality Analytics v2.

    Main calibration metrics use each player's FIRST started attempt on a puzzle.
    Replays remain available as secondary telemetry, but cannot make a puzzle look easier.
    """
    attempts = db_select_all("puzzle_attempts")
    feedback = db_select_all("puzzle_feedback", kind="difficulty")
    word_feedback = db_select_all("puzzle_feedback", kind="word")
    hint_events = db_select_all("hint_events")
    helper_events = db_select_all("helper_events")
    product_events = db_select_all("product_events")

    def ts(row):
        raw = row.get("started_at") or ""
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except Exception:
            return datetime.max.replace(tzinfo=TZ)

    def telemetry_identity(row: dict) -> Optional[str]:
        if row.get("player_id"):
            return f"p:{row['player_id']}"
        if row.get("anonymous_id"):
            return f"a:{row['anonymous_id']}"
        return None

    first_by_actor_puzzle: dict[tuple[str, str], dict] = {}
    for a in sorted(attempts, key=ts):
        identity = telemetry_identity(a)
        if not identity:
            continue
        key = (identity, str(a.get("puzzle_id")))
        first_by_actor_puzzle.setdefault(key, a)

    first_attempts = list(first_by_actor_puzzle.values())
    groups: dict[str, list[dict]] = {}
    for a in first_attempts:
        groups.setdefault(a["puzzle_id"], []).append(a)

    word_reports: dict[str, int] = {}
    for f in word_feedback:
        word_reports[f["puzzle_id"]] = word_reports.get(f["puzzle_id"], 0) + 1

    fb: dict[str, list[int]] = {}
    for f in feedback:
        if f.get("rating") is not None:
            fb.setdefault(f["puzzle_id"], []).append(int(f["rating"]))

    pdata = load_puzzles()
    puzzle_index = {}
    for p in pdata.get("daily", []):
        puzzle_index[p["id"]] = p
    for bank in pdata.get("free", {}).values():
        for p in bank:
            puzzle_index[p["id"]] = p

    # Retired IDs remain syncable for historical data. Calm runs stay in their own cohort so
    # interruptions and intentionally unhurried play never distort the difficulty calibration.
    active_first_attempts = [a for a in first_attempts if a.get("puzzle_id") in puzzle_index]

    def calm_cohort(rows: list[dict]) -> dict:
        completed = [row for row in rows if row.get("completed_at")]
        times = [int(row.get("elapsed_ms")) for row in completed if row.get("elapsed_ms") is not None]
        hints = [int(row.get("hints_used") or 0) for row in completed]
        clean = [1 if row.get("clean_solve") is True else 0 for row in completed]
        return {
            "starts": len(rows),
            "completed": len(completed),
            "completionRate": round(len(completed) / len(rows), 3) if rows else None,
            "medianMs": _median(times),
            "avgHints": round(sum(hints) / len(hints), 2) if hints else None,
            "cleanRate": round(sum(clean) / len(clean), 3) if clean else None,
        }

    calm_mode_summary = {
        "standard": calm_cohort([a for a in active_first_attempts if a.get("calm_mode") is not True]),
        "calm": calm_cohort([a for a in active_first_attempts if a.get("calm_mode") is True]),
    }
    first_attempts = [a for a in active_first_attempts if a.get("calm_mode") is not True]
    groups = {}
    for a in first_attempts:
        groups.setdefault(a["puzzle_id"], []).append(a)

    rows = []
    for puzzle_id, vals in groups.items():
        completed = [x for x in vals if x.get("completed_at")]
        times = [int(x["elapsed_ms"]) for x in completed if x.get("elapsed_ms") is not None]
        wrong = [int(x.get("wrong_attempts") or 0) for x in completed]
        hints = [int(x.get("hints_used") or 0) for x in completed]
        clean = [1 if x.get("clean_solve") is True else 0 for x in completed]
        first_correct = [int(x.get("first_correct_ms")) for x in vals if x.get("first_correct_ms") is not None]
        resets = [int(x.get("reset_count") or 0) for x in vals]
        resumes = [int(x.get("resume_count") or 0) for x in vals]
        ratings = fb.get(puzzle_id, [])
        puzzle = puzzle_index.get(puzzle_id, {})
        meta = puzzle.get("meta") or {}
        starts = len(vals)
        sample = "none" if starts < 5 else "early" if starts < 10 else "usable" if starts < 20 else "reliable" if starts < 50 else "strong"
        rows.append({
            "puzzleId": puzzle_id,
            "difficulty": vals[0].get("difficulty"),
            "starts": starts,
            "completions": len(completed),
            "completionRate": round(len(completed) / starts, 3) if starts else 0,
            "medianMs": _median(times),
            "avgWrong": round(sum(wrong) / len(wrong), 2) if wrong else None,
            "avgHints": round(sum(hints) / len(hints), 2) if hints else None,
            "cleanRate": round(sum(clean) / len(clean), 3) if clean else None,
            "medianFirstCorrectMs": _median(first_correct),
            "avgResets": round(sum(resets) / len(resets), 2) if resets else 0,
            "avgResumes": round(sum(resumes) / len(resumes), 2) if resumes else 0,
            "difficultyRating": round(sum(ratings) / len(ratings), 2) if ratings else None,
            "ratings": len(ratings),
            "ratingVotes": {
                "lighter": sum(1 for rating in ratings if rating == -1),
                "justRight": sum(1 for rating in ratings if rating == 0),
                "harder": sum(1 for rating in ratings if rating == 1),
            },
            "wordReports": word_reports.get(puzzle_id, 0),
            "generatedScore": meta.get("difficultyScore"),
            "cells": meta.get("cells"),
            "words": len(puzzle.get("answers") or []),
            "sample": sample,
        })

    def med(values):
        xs = [float(v) for v in values if v is not None]
        if not xs:
            return None
        xs.sort()
        n = len(xs)
        return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

    def robust_z(value, values):
        if value is None:
            return 0.0
        xs = [float(v) for v in values if v is not None]
        if len(xs) < 5:
            return 0.0
        center = med(xs)
        deviations = [abs(x - center) for x in xs]
        mad = med(deviations) or 0.0
        if mad < 1e-9:
            mean = sum(xs) / len(xs)
            variance = sum((x - mean) ** 2 for x in xs) / max(1, len(xs) - 1)
            sd = variance ** 0.5
            return 0.0 if sd < 1e-9 else (float(value) - mean) / sd
        return 0.6745 * (float(value) - center) / mad

    by_diff: dict[str, list[dict]] = {}
    for r in rows:
        if r["starts"] >= 5:
            by_diff.setdefault(r["difficulty"], []).append(r)

    for diff, peers in by_diff.items():
        metrics = {
            "logTime": [math.log(max(1, r["medianMs"])) if r["medianMs"] else None for r in peers],
            "completion": [r["completionRate"] for r in peers],
            "hints": [r["avgHints"] for r in peers],
            "wrong": [r["avgWrong"] for r in peers],
            "clean": [r["cleanRate"] for r in peers],
            "rating": [r["difficultyRating"] for r in peers],
        }
        for r in peers:
            z_time = robust_z(math.log(max(1, r["medianMs"])) if r["medianMs"] else None, metrics["logTime"])
            z_completion = -robust_z(r["completionRate"], metrics["completion"])
            z_hints = robust_z(r["avgHints"], metrics["hints"])
            z_wrong = robust_z(r["avgWrong"], metrics["wrong"])
            z_clean = -robust_z(r["cleanRate"], metrics["clean"])
            z_rating = robust_z(r["difficultyRating"], metrics["rating"]) if r["ratings"] >= 3 else 0.0
            raw = (0.35*z_time + 0.20*z_completion + 0.15*z_hints + 0.10*z_wrong + 0.10*z_clean + 0.10*z_rating)
            # Do not overstate tiny samples. Reliability reaches 1.0 at 20 first attempts.
            confidence = min(1.0, r["starts"] / 20.0)
            rating_conf = min(1.0, r["ratings"] / 10.0)
            r["difficultyIndex"] = round(raw * (0.6 + 0.4 * confidence), 2)
            r["confidence"] = round(confidence, 2)
            r["ratingConfidence"] = round(rating_conf, 2)
            idx = r["difficultyIndex"]
            if r["starts"] >= 20 and idx >= 1.25:
                r["flag"] = "too_hard"
                r["recommendation"] = "Zkontrolovat geometrii, slovní mix a případnou potřebu přesunu výš."
            elif r["starts"] >= 20 and idx <= -1.25:
                r["flag"] = "too_easy"
                r["recommendation"] = "Kandidát na jednodušší kategorii nebo pozdější pořadí v bance."
            elif r["starts"] >= 10 and abs(idx) >= 1.60:
                r["flag"] = "watch"
                r["recommendation"] = "Sbírat další data; zatím neměnit automaticky."
            else:
                r["flag"] = "ok"
                r["recommendation"] = "Bez zásahu."

    for r in rows:
        r.setdefault("difficultyIndex", None)
        r.setdefault("confidence", min(1.0, r["starts"] / 20.0))
        r.setdefault("ratingConfidence", min(1.0, r["ratings"] / 10.0))
        r.setdefault("flag", "insufficient_data" if r["starts"] < 5 else "ok")
        r.setdefault("recommendation", "Čekat na větší vzorek." if r["starts"] < 5 else "Bez zásahu.")

    rows.sort(key=lambda r: (0 if r["flag"] in {"too_hard","too_easy","watch"} else 1, -(abs(r["difficultyIndex"] or 0)), -(r["starts"] or 0)))
    priorities = [r for r in rows if r["flag"] in {"too_hard", "too_easy", "watch"}]

    band_ranges = ((1, 50), (51, 100), (101, 150), (151, 200))
    active_free = pdata.get("free") or {}
    active_level: dict[str, tuple[str, int, dict]] = {}
    for difficulty, bank in active_free.items():
        for index, puzzle in enumerate(bank, start=1):
            level = int((puzzle.get("meta") or {}).get("level") or index)
            active_level[str(puzzle.get("id"))] = (difficulty, level, puzzle)

    def ladder_average(values):
        values = [float(value) for value in values if value is not None]
        return round(sum(values) / len(values), 3) if values else None

    def ladder_band(difficulty: str, start_level: int, end_level: int) -> dict:
        puzzles = [
            puzzle for _, level, puzzle in active_level.values()
            if puzzle.get("difficulty") == difficulty and start_level <= level <= end_level
        ]
        puzzle_ids = {str(puzzle.get("id")) for puzzle in puzzles}
        attempts_band = [a for a in first_attempts if str(a.get("puzzle_id")) in puzzle_ids and a.get("mode") == "free"]
        completed_band = [a for a in attempts_band if a.get("completed_at")]
        times = [int(a.get("elapsed_ms")) for a in completed_band if a.get("elapsed_ms") is not None]
        hints_band = [int(a.get("hints_used") or 0) for a in completed_band]
        wrong_band = [int(a.get("wrong_attempts") or 0) for a in completed_band]
        clean_band = [1 if a.get("clean_solve") is True else 0 for a in completed_band]
        turns = [int(answer.get("turns") or 0) for puzzle in puzzles for answer in (puzzle.get("answers") or [])]
        scores = [(puzzle.get("meta") or {}).get("difficultyScore") for puzzle in puzzles]
        cells = [len(puzzle.get("mask") or []) for puzzle in puzzles]
        words = [len(puzzle.get("answers") or []) for puzzle in puzzles]
        return {
            "key": f"{start_level}-{end_level}", "from": start_level, "to": end_level, "puzzles": len(puzzles),
            "structure": {
                "meanCells": ladder_average(cells), "meanWords": ladder_average(words),
                "meanDifficultyScore": ladder_average(scores), "meanTurnsPerWord": ladder_average(turns),
                "lowTurnShare": round(sum(1 for turn in turns if turn <= 1) / len(turns), 3) if turns else None,
            },
            "behavior": {
                "starts": len(attempts_band), "completed": len(completed_band),
                "completionRate": round(len(completed_band) / len(attempts_band), 3) if attempts_band else None,
                "medianMs": _median(times), "avgHints": ladder_average(hints_band),
                "avgWrong": ladder_average(wrong_band), "cleanRate": ladder_average(clean_band),
            },
        }

    difficulty_ladder = {"bands": {}}
    for difficulty in ("easy", "medium", "hard", "hardcore"):
        difficulty_ladder["bands"][difficulty] = [ladder_band(difficulty, start, end) for start, end in band_ranges]
    late_medium = difficulty_ladder["bands"]["medium"][-1]
    early_hard = difficulty_ladder["bands"]["hard"][0]
    medium_ms = late_medium["behavior"].get("medianMs")
    hard_ms = early_hard["behavior"].get("medianMs")
    time_ratio = round(hard_ms / medium_ms, 2) if medium_ms and hard_ms else None
    medium_completion = late_medium["behavior"].get("completionRate")
    hard_completion = early_hard["behavior"].get("completionRate")
    completion_drop = round(medium_completion - hard_completion, 3) if medium_completion is not None and hard_completion is not None else None
    if time_ratio is None:
        bridge_status = "awaiting_data"
    elif time_ratio > 3.0 or (completion_drop is not None and completion_drop > 0.20):
        bridge_status = "cliff"
    elif time_ratio > 2.0 or (completion_drop is not None and completion_drop > 0.12):
        bridge_status = "watch"
    else:
        bridge_status = "healthy"
    difficulty_ladder["bridge"] = {
        "status": bridge_status, "timeRatio": time_ratio, "completionDrop": completion_drop,
        "lateMedium": late_medium, "earlyHard": early_hard,
    }

    helper_summary = {}
    first_attempt_map = {str(a.get("id")): a for a in first_attempts}
    first_attempt_ids = set(first_attempt_map)
    helper_events_first = [e for e in helper_events if str(e.get("attempt_id")) in first_attempt_ids]
    helper_summary["rawEvents"] = len(helper_events)
    helper_summary["firstAttemptEvents"] = len(helper_events_first)
    helper_summary["offers"] = sum(1 for e in helper_events_first if e.get("event_type") == "offered")
    helper_summary["accepted"] = sum(1 for e in helper_events_first if e.get("event_type") == "accepted")
    helper_summary["dismissed"] = sum(1 for e in helper_events_first if e.get("event_type") == "dismissed")
    helper_summary["acceptRate"] = round(helper_summary["accepted"] / helper_summary["offers"], 3) if helper_summary["offers"] else None
    offer_idle = [int(e.get("idle_ms") or 0) for e in helper_events_first if e.get("event_type") == "offered"]
    helper_summary["medianOfferIdleMs"] = _median(offer_idle)
    accepted_ids = {str(e.get("attempt_id")) for e in helper_events_first if e.get("event_type") == "accepted"}
    dismissed_ids = {str(e.get("attempt_id")) for e in helper_events_first if e.get("event_type") == "dismissed"}
    accepted_attempts = [first_attempt_map[i] for i in accepted_ids if i in first_attempt_map]
    dismissed_attempts = [first_attempt_map[i] for i in dismissed_ids if i in first_attempt_map]
    helper_summary["acceptedCompletionRate"] = round(sum(1 for a in accepted_attempts if a.get("completed_at")) / len(accepted_attempts), 3) if accepted_attempts else None
    helper_summary["dismissedCompletionRate"] = round(sum(1 for a in dismissed_attempts if a.get("completed_at")) / len(dismissed_attempts), 3) if dismissed_attempts else None
    helper_summary["bySupportMode"] = {}
    for mode in ("beginner", "younger", "older", "none"):
        evs = [e for e in helper_events_first if (e.get("support_mode") or "none") == mode]
        offers = sum(1 for e in evs if e.get("event_type") == "offered")
        accepted = sum(1 for e in evs if e.get("event_type") == "accepted")
        helper_summary["bySupportMode"][mode] = {
            "offers": offers, "accepted": accepted,
            "dismissed": sum(1 for e in evs if e.get("event_type") == "dismissed"),
            "acceptRate": round(accepted / offers, 3) if offers else None,
        }

    completed_first = [a for a in first_attempts if a.get("completed_at")]
    hint_hist = {"0": 0, "1": 0, "2": 0, "3plus": 0}
    for a in completed_first:
        n = int(a.get("hints_used") or 0)
        hint_hist["0" if n == 0 else "1" if n == 1 else "2" if n == 2 else "3plus"] += 1
    first_hint_times = [int(a.get("first_hint_ms")) for a in first_attempts if a.get("first_hint_ms") is not None]
    hint_events_first = [e for e in hint_events if str(e.get("attempt_id")) in first_attempt_ids]
    hinted_first_ids = {str(e.get("attempt_id")) for e in hint_events_first}
    def event_identity(row: dict) -> Optional[str]:
        if row.get("player_id"):
            return f"p:{row['player_id']}"
        if row.get("anonymous_id"):
            return f"a:{row['anonymous_id']}"
        return None

    funnel = {}
    quality_funnel_events = (
        "app_open", "onboarding_started", "onboarding_tutorial_completed", "onboarding_support_selected", "onboarding_completed",
        "account_nudge_shown", "account_nudge_create", "account_nudge_login", "account_nudge_dismissed", "account_authenticated",
        "starter_started", "starter_hint_offer_shown", "starter_hint_used", "starter_reset",
        "starter_word_1_completed", "starter_word_2_completed", "starter_word_3_completed", "starter_completed",
        "starter_hard_choice_shown", "starter_hard_direct_selected", "starter_easy_warmup_selected", "starter_easy_warmup_completed",
        *[f"onboarding_support_selected_{mode}" for mode in ("none", "beginner", "younger", "older")],
        *[f"account_nudge_{stage}_{action}" for stage in (1, 2, 3) for action in ("shown", "create", "login", "dismissed", "authenticated")],
    )
    for event_type in quality_funnel_events:
        identities = {event_identity(e) for e in product_events if e.get("event_type") == event_type}
        identities.discard(None)
        funnel[event_type] = len(identities)

    hint_summary = {
        "events": len(hint_events),
        "firstAttemptEvents": len(hint_events_first),
        "manual": sum(1 for e in hint_events_first if e.get("source") == "manual"),
        "helper": sum(1 for e in hint_events_first if e.get("source") == "helper"),
        "complimentary": sum(1 for e in hint_events_first if e.get("complimentary") is True),
        "byLevel": {str(level): sum(1 for e in hint_events_first if int(e.get("hint_level") or 0) == level) for level in (1,2,3)},
        "firstAttemptDistribution": hint_hist,
        "medianFirstHintMs": _median(first_hint_times),
        "firstAttemptHintRate": round(len(hinted_first_ids) / len(first_attempts), 3) if first_attempts else None,
    }
    return {
        "analyticsVersion": 2,
        "attemptsRaw": len(attempts),
        "firstAttempts": len(first_attempts),
        "registeredFirstAttempts": sum(1 for a in first_attempts if a.get("player_id")),
        "anonymousFirstAttempts": sum(1 for a in first_attempts if a.get("anonymous_id")),
        "puzzlesMeasured": len(rows),
        "summary": {
            "tooHard": sum(1 for r in rows if r["flag"] == "too_hard"),
            "tooEasy": sum(1 for r in rows if r["flag"] == "too_easy"),
            "watch": sum(1 for r in rows if r["flag"] == "watch"),
            "reliable": sum(1 for r in rows if r["starts"] >= 20),
        },
        "helper": helper_summary,
        "hints": hint_summary,
        "calmMode": calm_mode_summary,
        "funnel": funnel,
        "priorities": priorities[:30],
        "difficultyLadder": difficulty_ladder,
        "rows": rows,
    }


def parse_timestamp(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=TZ)
        return parsed.astimezone(TZ)
    except (TypeError, ValueError):
        return None


def public_admin_identity(admin: dict) -> dict:
    player = admin["player"]
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    return {
        "id": player["id"],
        "name": player.get("name"),
        "familyCode": family,
        "team": public_team_name(player.get("family_code"), player.get("team_joined_at")) or "Bez týmu",
        "avatar": player.get("avatar") or "🙂",
        "role": admin["role"],
    }


@app.get("/api/admin/me")
def admin_me(authorization: Optional[str] = Header(default=None)):
    return public_admin_identity(require_admin(authorization))


def _telemetry_actor_key(row: dict) -> Optional[str]:
    if row.get("player_id"):
        return f"p:{row['player_id']}"
    if row.get("anonymous_id"):
        return f"a:{row['anonymous_id']}"
    return None


def _event_stamp(row: dict) -> Optional[datetime]:
    return parse_timestamp(row.get("created_at") or row.get("last_activity_at") or row.get("completed_at") or row.get("started_at"))


def _app_version_tuple(value: object) -> tuple[int, int, int]:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", str(value or ""))
    return tuple(int(part) for part in match.groups()) if match else (0, 0, 0)


def _app_version_at_least(value: object, minimum: str) -> bool:
    return _app_version_tuple(value) >= _app_version_tuple(minimum)


@app.get("/api/admin/launch")
def admin_launch(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    now = datetime.now(TZ)
    cutoff24 = now - timedelta(hours=24)
    cutoff7 = now - timedelta(days=7)
    cutoff30 = now - timedelta(days=30)
    today = current_prague_date()
    product = db_select_all("product_events")
    attempts = db_select_all("puzzle_attempts")
    players = db_select_all("players")
    try:
        ops = db_select_all("operational_events")
    except HTTPException:
        ops = []
    try:
        support = db_select_all("support_reports")
    except HTTPException:
        support = []

    def recent(rows, cutoff):
        return [row for row in rows if (_event_stamp(row) or datetime.min.replace(tzinfo=TZ)) >= cutoff]

    def actors(rows):
        return {key for row in rows if (key := _telemetry_actor_key(row))}

    def event_actors(rows, event):
        return actors([row for row in rows if row.get("event_type") == event])

    def attempt_actors(rows, mode=None, completed=False):
        filtered = rows
        if mode:
            filtered = [row for row in filtered if row.get("mode") == mode]
        if completed:
            filtered = [row for row in filtered if row.get("completed_at")]
        return actors(filtered)

    product_sorted = sorted(product, key=lambda row: _event_stamp(row) or datetime.max.replace(tzinfo=TZ))
    attempts_sorted = sorted(attempts, key=lambda row: parse_timestamp(row.get("started_at")) or datetime.max.replace(tzinfo=TZ))
    events_by_actor: dict[str, list[dict]] = {}
    attempts_by_actor: dict[str, list[dict]] = {}
    for row in product_sorted:
        key = _telemetry_actor_key(row)
        if key:
            events_by_actor.setdefault(key, []).append(row)
    for row in attempts_sorted:
        key = _telemetry_actor_key(row)
        if key:
            attempts_by_actor.setdefault(key, []).append(row)

    first_onboarding: dict[str, dict] = {}
    for row in product_sorted:
        if row.get("event_type") != "onboarding_started":
            continue
        key = _telemetry_actor_key(row)
        if key and key not in first_onboarding:
            first_onboarding[key] = row

    def event_time(actor_key: str, event_type: str, started_at: datetime):
        floor = started_at - timedelta(seconds=5)
        for row in events_by_actor.get(actor_key, []):
            stamp = _event_stamp(row)
            if row.get("event_type") == event_type and stamp and stamp >= floor:
                return stamp
        return None

    def actor_event_types(actor_key: str, started_at: datetime) -> set[str]:
        floor = started_at - timedelta(seconds=5)
        return {
            str(row.get("event_type")) for row in events_by_actor.get(actor_key, [])
            if (_event_stamp(row) or datetime.min.replace(tzinfo=TZ)) >= floor
        }

    activity_dates: dict[str, set[date]] = {}
    for row in product + attempts:
        key = _telemetry_actor_key(row)
        stamp = _event_stamp(row)
        if key and stamp:
            activity_dates.setdefault(key, set()).add(stamp.astimezone(TZ).date())

    p24, p7, p30 = recent(product, cutoff24), recent(product, cutoff7), recent(product, cutoff30)
    a24, a7, a30 = recent(attempts, cutoff24), recent(attempts, cutoff7), recent(attempts, cutoff30)
    op24, op7 = recent(ops, cutoff24), recent(ops, cutoff7)
    active24 = actors(p24) | actors(a24)
    active7 = actors(p7) | actors(a7)

    def legacy_funnel(rows_p, rows_a):
        app_open = event_actors(rows_p, "app_open")
        onboard = event_actors(rows_p, "onboarding_completed")
        starter = event_actors(rows_p, "starter_completed")
        daily_start = attempt_actors(rows_a, "daily", False)
        daily_done = attempt_actors(rows_a, "daily", True)
        free_done = attempt_actors(rows_a, "free", True)
        auth = event_actors(rows_p, "account_authenticated")
        return {
            "appOpen": len(app_open), "onboardingCompleted": len(onboard), "starterCompleted": len(starter),
            "dailyStarted": len(daily_start), "dailyCompleted": len(daily_done), "freeCompleted": len(free_done),
            "accountAuthenticated": len(auth),
        }

    def newcomer_window(cutoff, rows_p, rows_a):
        cohort: dict[str, datetime] = {}
        for key, row in first_onboarding.items():
            stamp = _event_stamp(row)
            if stamp and stamp >= cutoff and _app_version_at_least(row.get("app_version"), "3.31.5"):
                cohort[key] = stamp

        event_types = {key: actor_event_types(key, start) for key, start in cohort.items()}
        current = set(cohort)
        funnel_rows = []

        def add_step(key, label, matched):
            nonlocal current
            previous = len(current)
            current &= matched
            count = len(current)
            funnel_rows.append({
                "key": key, "label": label, "count": count, "previousCount": previous if funnel_rows else None,
                "conversionFromPrevious": round(count / previous, 3) if funnel_rows and previous else (None if not funnel_rows else 0.0),
                "dropOffCount": previous - count if funnel_rows else None,
                "dropOff": round((previous - count) / previous, 3) if funnel_rows and previous else (None if not funnel_rows else 0.0),
            })

        add_step("onboardingStarted", "Začalo onboarding", set(cohort))
        for event_type, key, label in (
            ("onboarding_tutorial_completed", "tutorialCompleted", "Našlo PES"),
            ("onboarding_support_selected", "supportSelected", "Vybralo Pomocníka"),
            ("onboarding_completed", "onboardingCompleted", "Dokončilo onboarding"),
            ("starter_started", "starterStarted", "Spustilo první Proplet"),
            ("starter_word_1_completed", "starterWord1", "Našlo MRAK"),
            ("starter_word_2_completed", "starterWord2", "Našlo JABLKO"),
            ("starter_word_3_completed", "starterWord3", "Našlo ČOKOLÁDU"),
            ("starter_completed", "starterCompleted", "Dokončilo první Proplet"),
        ):
            add_step(key, label, {actor for actor in cohort if event_type in event_types[actor]})

        real_started = set()
        real_completed = set()
        for actor in current:
            start = cohort[actor]
            eligible_attempts = [
                row for row in attempts_by_actor.get(actor, [])
                if row.get("mode") in ("daily", "free")
                and (parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ)) >= start - timedelta(seconds=5)
            ]
            if eligible_attempts:
                real_started.add(actor)
            if any(row.get("completed_at") for row in eligible_attempts):
                real_completed.add(actor)
        add_step("firstRealGameStarted", "Spustilo první skutečnou hru", real_started)
        add_step("firstRealGameCompleted", "Dokončilo první skutečnou hru", real_completed)
        add_step("accountAuthenticated", "Přihlásilo / vytvořilo účet", {actor for actor in cohort if "account_authenticated" in event_types[actor]})

        choice = {actor for actor in cohort if "starter_hard_choice_shown" in event_types[actor]}
        easy = choice & {actor for actor in cohort if "starter_easy_warmup_selected" in event_types[actor]}
        direct = choice & {actor for actor in cohort if "starter_hard_direct_selected" in event_types[actor]}
        warmup_done = easy & {actor for actor in cohort if "starter_easy_warmup_completed" in event_types[actor]}
        warmup_to_daily = set()
        hard_started = set()
        hard_completed = set()
        for actor in choice:
            start = cohort[actor]
            daily_attempts = [
                row for row in attempts_by_actor.get(actor, [])
                if row.get("mode") == "daily" and row.get("difficulty") == "hard"
                and (parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ)) >= start - timedelta(seconds=5)
            ]
            if daily_attempts:
                hard_started.add(actor)
                if actor in warmup_done:
                    warmup_to_daily.add(actor)
            if any(row.get("completed_at") for row in daily_attempts):
                hard_completed.add(actor)

        starter_started = {actor for actor in cohort if "starter_started" in event_types[actor]}
        starter_done = starter_started & {actor for actor in cohort if "starter_completed" in event_types[actor]}
        hint_offer = starter_started & {actor for actor in cohort if "starter_hint_offer_shown" in event_types[actor]}
        hint_used = starter_started & {actor for actor in cohort if "starter_hint_used" in event_types[actor]}
        reset = starter_started & {actor for actor in cohort if "starter_reset" in event_types[actor]}
        abandon_cutoff = now - timedelta(minutes=30)
        abandoned = {
            actor for actor in starter_started - starter_done
            if (event_time(actor, "starter_started", cohort[actor]) or now) <= abandon_cutoff
        }
        starter_times = []
        for actor in starter_done:
            start_time = event_time(actor, "starter_started", cohort[actor])
            done_time = event_time(actor, "starter_completed", cohort[actor])
            if start_time and done_time and done_time >= start_time:
                elapsed = int((done_time - start_time).total_seconds() * 1000)
                if elapsed <= 3_600_000:
                    starter_times.append(elapsed)
        support_distribution = {}
        for mode in ("none", "beginner", "younger", "older"):
            mode_set = {actor for actor in cohort if f"onboarding_support_selected_{mode}" in event_types[actor]}
            support_distribution[mode] = {"count": len(mode_set), "share": round(len(mode_set) / len(cohort), 3) if cohort else None}

        eligible = retained = 0
        for actor, start in cohort.items():
            first_day = start.astimezone(TZ).date()
            if first_day <= today - timedelta(days=1):
                eligible += 1
                if first_day + timedelta(days=1) in activity_dates.get(actor, set()):
                    retained += 1

        visitor_actors = event_actors(rows_p, "app_open")
        first_real_completed = next((row["count"] for row in funnel_rows if row["key"] == "firstRealGameCompleted"), 0)
        return {
            "visitors": len(visitor_actors), "newcomers": len(cohort),
            "returningVisitors": max(0, len(visitor_actors) - len(cohort)),
            "firstRealGameCompleted": first_real_completed, "funnel": funnel_rows,
            "retentionD1": {"eligible": eligible, "retained": retained, "rate": round(retained / eligible, 3) if eligible else None},
            "starter": {
                "started": len(starter_started), "completed": len(starter_done),
                "completionRate": round(len(starter_done) / len(starter_started), 3) if starter_started else None,
                "medianCompletionMs": _median(starter_times), "hintOfferShown": len(hint_offer), "hintUsed": len(hint_used),
                "hintUseRate": round(len(hint_used) / len(starter_started), 3) if starter_started else None,
                "resetActors": len(reset), "abandoned": len(abandoned), "supportDistribution": support_distribution,
            },
            "hardDaily": {
                "choiceShown": len(choice), "easySelected": len(easy), "directSelected": len(direct),
                "easySelectionRate": round(len(easy) / len(choice), 3) if choice else None,
                "directSelectionRate": round(len(direct) / len(choice), 3) if choice else None,
                "warmupCompleted": len(warmup_done),
                "warmupCompletionRate": round(len(warmup_done) / len(easy), 3) if easy else None,
                "warmupToDailyStarted": len(warmup_to_daily),
                "warmupToDailyRate": round(len(warmup_to_daily) / len(warmup_done), 3) if warmup_done else None,
                "hardDailyStarted": len(hard_started), "hardDailyCompleted": len(hard_completed),
                "hardDailyCompletionRate": round(len(hard_completed) / len(hard_started), 3) if hard_started else None,
            },
        }

    windows = {
        "24h": newcomer_window(cutoff24, p24, a24),
        "7d": newcomer_window(cutoff7, p7, a7),
        "30d": newcomer_window(cutoff30, p30, a30),
    }

    starter7 = event_actors(p7, "starter_completed")
    auth7 = event_actors(p7, "account_authenticated")
    starter_to_account = len(starter7 & auth7)

    eligible = retained = 0
    cohort_floor = today - timedelta(days=14)
    for dates in activity_dates.values():
        first = min(dates)
        if cohort_floor <= first <= today - timedelta(days=1):
            eligible += 1
            if first + timedelta(days=1) in dates:
                retained += 1

    version_counts = {}
    for row in a7:
        version = str(row.get("app_version") or "neznámá")
        version_counts[version] = version_counts.get(version, 0) + 1
    versions = [{"version": v, "attempts": c} for v, c in sorted(version_counts.items(), key=lambda item: (-item[1], item[0]))][:8]

    open_support = [row for row in support if str(row.get("status") or "new") in ("new", "reviewing")]
    errors24 = [row for row in op24 if row.get("event_type") in ("server_error", "client_error")]
    rate24 = [row for row in op24 if row.get("event_type") == "rate_limit"]
    return {
        "generatedAt": now.isoformat(), "analyticsVersion": 3, "newcomerInstrumentationFrom": "3.31.5",
        "active": {"last24h": len(active24), "last7d": len(active7)},
        "newAccounts24h": sum(1 for row in players if (parse_timestamp(row.get("created_at")) or datetime.min.replace(tzinfo=TZ)) >= cutoff24),
        "funnel24h": legacy_funnel(p24, a24), "funnel7d": legacy_funnel(p7, a7), "windows": windows,
        "starterToAccount7d": {"converted": starter_to_account, "starterCompleted": len(starter7), "rate": round(starter_to_account / len(starter7), 3) if starter7 else None},
        "retentionD1": {"eligible": eligible, "retained": retained, "rate": round(retained / eligible, 3) if eligible else None},
        "reliability": {
            "errors24h": len(errors24),
            "errors7d": sum(1 for row in op7 if row.get("event_type") in ("server_error", "client_error")),
            "rateLimits24h": len(rate24), "openSupportReports": len(open_support),
        },
        "appVersions7d": versions,
    }


@app.get("/api/admin/support")
def admin_support(
    status: str = Query(default="open", max_length=20),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    rows = db_select_all("support_reports")
    if status == "open":
        rows = [row for row in rows if str(row.get("status") or "new") in ("new", "reviewing")]
    elif status != "all":
        rows = [row for row in rows if str(row.get("status") or "new") == status]
    players = {row["id"]: row for row in db_select_all("players") if row.get("id")}
    out = []
    for row in sorted(rows, key=lambda r: str(r.get("created_at") or ""), reverse=True)[:200]:
        player = players.get(row.get("player_id"))
        out.append({
            "id": row.get("id"), "category": row.get("category"), "message": row.get("message"),
            "replyTo": row.get("reply_to"), "page": row.get("page"), "appVersion": row.get("app_version"),
            "status": row.get("status") or "new", "resolutionNote": row.get("resolution_note"),
            "createdAt": row.get("created_at"),
            "reportedBy": {"name": player.get("name"), "avatar": player.get("avatar") or "🙂"} if player else None,
        })
    return {"reports": out, "total": len(out)}


@app.patch("/api/admin/support/{report_id}")
def admin_support_update(
    report_id: str,
    payload: SupportReportUpdate,
    authorization: Optional[str] = Header(default=None),
):
    admin = require_admin(authorization, write=True)
    rows = db_select("support_reports", id=report_id)
    if not rows:
        raise HTTPException(404, "Hlášení neexistuje")
    old = rows[0]
    values = {"status": payload.status, "resolution_note": " ".join(str(payload.resolution_note or "").strip().split()) or None}
    if payload.status in ("resolved", "dismissed"):
        values.update({"reviewed_at": datetime.now(TZ).isoformat(), "reviewed_by": admin["player"]["id"]})
    else:
        values.update({"reviewed_at": None, "reviewed_by": None})
    db_update("support_reports", {"id": report_id}, values)
    record_admin_audit(admin, "support_report_status", "support_reports", report_id, {"from": old.get("status"), "to": payload.status, "category": old.get("category")})
    return {"ok": True}


@app.get("/api/admin/overview")
def admin_overview(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    now = datetime.now(TZ)
    today = current_prague_date()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    players = db_select_all("players")
    results = db_select_all("results")
    attempts = db_select_all("puzzle_attempts")
    reports = db_select_all("puzzle_feedback", kind="word")
    ratings = db_select_all("puzzle_feedback", kind="difficulty")
    leagues = db_select_all("leagues")
    try:
        runs = db_select_all("puzzle_runs")
    except HTTPException:
        runs = results

    last_activity: dict[str, datetime] = {}
    for row in attempts:
        player_id = row.get("player_id")
        stamp = parse_timestamp(row.get("last_activity_at") or row.get("completed_at") or row.get("started_at"))
        if player_id and stamp and (player_id not in last_activity or stamp > last_activity[player_id]):
            last_activity[player_id] = stamp
    for row in results:
        player_id = row.get("player_id")
        stamp = parse_timestamp(row.get("completed_at"))
        if player_id and stamp and (player_id not in last_activity or stamp > last_activity[player_id]):
            last_activity[player_id] = stamp

    run_times = [(row, parse_timestamp(row.get("completed_at"))) for row in runs]
    today_runs = [row for row, stamp in run_times if stamp and stamp.date() == today]
    week_runs = [row for row, stamp in run_times if stamp and stamp >= seven_days_ago]
    primary_daily = expected_daily_puzzle_id(today.isoformat())
    daily_today = {
        row.get("player_id") for row in results
        if row.get("mode") == "daily"
        and str(row.get("daily_date") or "")[:10] == today.isoformat()
        and row.get("puzzle_id") == primary_daily
    }
    daily_today.discard(None)

    version_counts: dict[str, int] = {}
    for row in attempts:
        stamp = parse_timestamp(row.get("started_at"))
        version = str(row.get("app_version") or "neznámá")
        if stamp and stamp >= thirty_days_ago:
            version_counts[version] = version_counts.get(version, 0) + 1
    versions = [
        {"version": version, "attempts": count}
        for version, count in sorted(version_counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    open_reports = [row for row in reports if str(row.get("status") or "new") in ("new", "reviewing")]
    vote_counts = {str(value): sum(1 for row in ratings if row.get("rating") == value) for value in (-1, 0, 1)}
    return {
        "generatedAt": now.isoformat(),
        "today": today.isoformat(),
        "players": {
            "total": len(players),
            "active7": sum(1 for stamp in last_activity.values() if stamp >= seven_days_ago),
            "active30": sum(1 for stamp in last_activity.values() if stamp >= thirty_days_ago),
        },
        "games": {"today": len(today_runs), "last7Days": len(week_runs)},
        "daily": {"todayPlayers": len(daily_today), "puzzleId": primary_daily},
        "feedback": {"openWordReports": len(open_reports), "wordReportsTotal": len(reports), "ratingsTotal": len(ratings), "votes": vote_counts},
        "teams": len(leagues),
        "appVersions": versions[:8],
    }


def admin_user_summaries() -> list[dict]:
    players = db_select_all("players")
    results = db_select_all("results")
    attempts = db_select_all("puzzle_attempts")
    reports = db_select_all("puzzle_feedback", kind="word")
    try:
        leagues = {str(row.get("code")): row.get("name") or row.get("code") for row in db_select_all("leagues")}
    except HTTPException:
        leagues = {}
    results_by_player: dict[str, list[dict]] = {}
    attempts_by_player: dict[str, list[dict]] = {}
    reports_by_player: dict[str, list[dict]] = {}
    for row in results:
        if row.get("player_id"):
            results_by_player.setdefault(row["player_id"], []).append(row)
    for row in attempts:
        if row.get("player_id"):
            attempts_by_player.setdefault(row["player_id"], []).append(row)
    for row in reports:
        if row.get("player_id"):
            reports_by_player.setdefault(row["player_id"], []).append(row)

    summaries = []
    for player in players:
        player_results = results_by_player.get(player["id"], [])
        player_attempts = attempts_by_player.get(player["id"], [])
        activity_candidates = [
            parse_timestamp(row.get("last_activity_at") or row.get("completed_at") or row.get("started_at"))
            for row in player_attempts
        ] + [parse_timestamp(row.get("completed_at")) for row in player_results]
        activity = max((stamp for stamp in activity_candidates if stamp), default=None)
        latest_attempt = max(
            player_attempts,
            key=lambda row: parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ),
            default=None,
        )
        raw_family = str(player.get("family_code") or "")
        family = public_family_code(raw_family, player.get("team_joined_at"))
        player_reports = reports_by_player.get(player["id"], [])
        summaries.append({
            "id": player["id"],
            "name": player.get("name"),
            "avatar": player.get("avatar") or "🙂",
            "familyCode": family,
            "team": (leagues.get(family) or family) if family else "Bez týmu",
            "createdAt": player.get("created_at"),
            "lastActiveAt": activity.isoformat() if activity else None,
            "appVersion": latest_attempt.get("app_version") if latest_attempt else None,
            "supportMode": player.get("support_mode") or "none",
            "hasPassword": bool(player.get("password_hash")),
            "points": sum(int(row.get("points") or 0) for row in player_results),
            "completed": len(player_results),
            "dailyCompleted": len({str(row.get("daily_date"))[:10] for row in player_results if row.get("mode") == "daily" and row.get("daily_date")}),
            "openWordReports": sum(1 for row in player_reports if str(row.get("status") or "new") in ("new", "reviewing")),
        })
    summaries.sort(key=lambda row: row.get("lastActiveAt") or "", reverse=True)
    return summaries


@app.get("/api/admin/users")
def admin_users(
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=60, ge=1, le=200),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    needle = " ".join(q.strip().casefold().split())
    rows = admin_user_summaries()
    if needle:
        rows = [row for row in rows if needle in " ".join((str(row.get("name") or ""), str(row.get("team") or ""), str(row.get("familyCode") or ""))).casefold()]
    return {"total": len(rows), "users": rows[:limit]}


@app.get("/api/admin/users/{player_id}")
def admin_user_detail(player_id: str, authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    players = db_select("players", id=player_id)
    if not players:
        raise HTTPException(404, "Hráč neexistuje")
    player = players[0]
    results = db_select("results", player_id=player_id)
    results.sort(key=lambda row: parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    attempts = db_select("puzzle_attempts", player_id=player_id)
    attempts.sort(key=lambda row: parse_timestamp(row.get("started_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    reports = db_select("puzzle_feedback", player_id=player_id, kind="word")
    try:
        session_count = len(db_select("player_sessions", player_id=player_id))
    except HTTPException:
        session_count = 0
    try:
        push_count = len(db_select("push_subscriptions", player_id=player_id))
    except HTTPException:
        push_count = 0
    return {
        "user": {
            "id": player["id"], "name": player.get("name"), "avatar": player.get("avatar") or "🙂",
            "familyCode": public_family_code(player.get("family_code"), player.get("team_joined_at")),
            "team": public_team_name(player.get("family_code"), player.get("team_joined_at")) or "Bez týmu",
            "createdAt": player.get("created_at"), "supportMode": player.get("support_mode") or "none",
            "hasPassword": bool(player.get("password_hash")), "additionalSessions": session_count, "pushSubscriptions": push_count,
        },
        "stats": player_stats(player_id),
        "latestAppVersion": attempts[0].get("app_version") if attempts else None,
        "wordReports": {"total": len(reports), "open": sum(1 for row in reports if str(row.get("status") or "new") in ("new", "reviewing"))},
        "recentResults": [{
            "puzzleId": row.get("puzzle_id"), "mode": row.get("mode"), "difficulty": row.get("difficulty"),
            "dailyDate": str(row.get("daily_date"))[:10] if row.get("daily_date") else None,
            "elapsedMs": row.get("best_elapsed_ms"), "moves": row.get("best_moves"), "points": row.get("points"),
            "hintsUsed": row.get("hints_used"), "cleanSolve": row.get("clean_solve") is True, "completedAt": row.get("completed_at"),
        } for row in results[:30]],
    }


@app.get("/api/admin/reports")
def admin_reports(
    status: str = Query(default="open", max_length=20),
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=100, ge=1, le=300),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    if status not in ("open", "all", "new", "reviewing", "resolved", "dismissed"):
        raise HTTPException(400, "Neplatný filtr stavu")
    reports = db_select_all("puzzle_feedback", kind="word")
    players = {row["id"]: row for row in db_select_all("players")}
    needle = " ".join(q.strip().casefold().split())
    output = []
    for report in reports:
        report_status = str(report.get("status") or "new")
        if status == "open" and report_status not in ("new", "reviewing"):
            continue
        if status not in ("open", "all") and report_status != status:
            continue
        player = players.get(report.get("player_id"))
        info = puzzle_info(str(report.get("puzzle_id") or ""))
        puzzle = (info or {}).get("puzzle") or {}
        puzzle_meta = puzzle.get("meta") or {}
        haystack = " ".join((
            str(report.get("word") or ""), str(report.get("note") or ""), str(report.get("puzzle_id") or ""),
            str(player.get("name") if player else "anonym"), str(player.get("family_code") if player else ""),
        )).casefold()
        if needle and needle not in haystack:
            continue
        output.append({
            "id": report.get("id"), "status": report_status, "word": report.get("word"), "note": report.get("note"),
            "puzzleId": report.get("puzzle_id"), "challengeKey": report.get("challenge_key"),
            "mode": (info or {}).get("mode"), "difficulty": (info or {}).get("difficulty"),
            "level": (info or {}).get("level") or puzzle_meta.get("level"), "legacy": bool((info or {}).get("legacy")),
            "reportedBy": {
                "id": player.get("id"), "name": player.get("name"),
                "team": public_team_name(player.get("family_code"), player.get("team_joined_at")),
            } if player else {"id": None, "name": "Anonymní hráč", "team": None},
            "createdAt": report.get("created_at"), "resolutionNote": report.get("resolution_note"),
            "reviewedAt": report.get("reviewed_at"), "reviewedBy": report.get("reviewed_by"),
        })
    status_order = {"new": 0, "reviewing": 1, "resolved": 2, "dismissed": 3}
    output.sort(key=lambda row: row.get("createdAt") or "", reverse=True)
    output.sort(key=lambda row: status_order.get(row["status"], 9))
    return {"total": len(output), "reports": output[:limit]}


@app.patch("/api/admin/reports/{report_id}")
def admin_report_update(report_id: str, payload: AdminReportUpdate, authorization: Optional[str] = Header(default=None)):
    admin = require_admin(authorization, write=True)
    if payload.status not in ("new", "reviewing", "resolved", "dismissed"):
        raise HTTPException(400, "Neplatný stav hlášení")
    reports = db_select("puzzle_feedback", id=report_id)
    if not reports or reports[0].get("kind") != "word":
        raise HTTPException(404, "Hlášení neexistuje")
    report = reports[0]
    note = " ".join(str(payload.resolution_note or "").strip().split()) or None
    values = {"status": payload.status, "resolution_note": note}
    if payload.status == "new":
        values.update({"reviewed_at": None, "reviewed_by": None})
    else:
        values.update({"reviewed_at": datetime.now(TZ).isoformat(), "reviewed_by": admin["player"]["id"]})
    db_update("puzzle_feedback", {"id": report_id}, values)
    record_admin_audit(admin, "word_report_status", "puzzle_feedback", report_id, {
        "word": report.get("word"), "puzzleId": report.get("puzzle_id"),
        "from": str(report.get("status") or "new"), "to": payload.status, "resolutionNote": note,
    })
    return {"ok": True, "id": report_id, **values}


@app.get("/api/admin/audit")
def admin_audit(
    limit: int = Query(default=80, ge=1, le=200),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(authorization)
    rows = db_select_all("admin_audit_log")
    players = {row["id"]: row for row in db_select_all("players")}
    rows.sort(key=lambda row: parse_timestamp(row.get("created_at")) or datetime.min.replace(tzinfo=TZ), reverse=True)
    return {"entries": [{
        "id": row.get("id"), "action": row.get("action"), "targetType": row.get("target_type"),
        "targetId": row.get("target_id"), "details": row.get("details") or {}, "createdAt": row.get("created_at"),
        "admin": (players.get(row.get("admin_player_id")) or {}).get("name") or "Administrátor",
    } for row in rows[:limit]]}


@app.get("/api/admin/quality")
@app.get("/api/quality-report")
def quality_report(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    return build_quality_report()


@app.get("/api/admin/quality-history")
@app.get("/api/quality-history")
def quality_history(authorization: Optional[str] = Header(default=None)):
    require_admin(authorization)
    rows = db_request("GET", "quality_snapshots", params={"select": "week_start,payload,created_at", "order": "week_start.desc", "limit": "12"})
    return {"snapshots": rows}


def save_quality_snapshot_if_monday() -> dict:
    today = current_prague_date()
    if today.weekday() != 0:
        return {"saved": False, "reason": "not_monday"}
    week_start = today.isoformat()
    if db_select("quality_snapshots", week_start=week_start):
        return {"saved": False, "reason": "exists"}
    report = build_quality_report()
    compact = {
        "analyticsVersion": report.get("analyticsVersion"),
        "firstAttempts": report.get("firstAttempts"),
        "puzzlesMeasured": report.get("puzzlesMeasured"),
        "summary": report.get("summary"),
        "helper": report.get("helper"),
        "hints": report.get("hints"),
        "priorities": report.get("priorities", [])[:30],
    }
    db_insert("quality_snapshots", {
        "id": str(uuid.uuid4()), "week_start": week_start, "analytics_version": 2,
        "payload": compact, "created_at": datetime.now(TZ).isoformat(),
    })
    return {"saved": True, "weekStart": week_start}


def payload_completed_at(value: Optional[str]) -> str:
    """Return a sane ISO timestamp from the client, falling back to server time."""
    if value:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=TZ)
            # Reject absurd timestamps; device clocks can occasionally be wrong.
            now = datetime.now(TZ)
            if datetime(2025, 1, 1, tzinfo=TZ) <= dt.astimezone(TZ) <= now + timedelta(days=1):
                return dt.astimezone(TZ).isoformat()
        except (TypeError, ValueError):
            pass
    return datetime.now(TZ).isoformat()

def completion_time(r: dict) -> datetime:
    raw = r.get("completed_at")
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    except (TypeError, ValueError):
        return datetime.max.replace(tzinfo=TZ)

def first_run_key(r: dict) -> tuple:
    return (completion_time(r), str(r.get("id") or r.get("attempt_id") or ""))

def competitive_row(row: dict) -> bool:
    """Klidny rezim counts for personal progression, never for competitive standings."""
    return row.get("calm_mode") is not True

def daily_run_date(row: dict) -> Optional[str]:
    key = str(row.get("challenge_key") or "")
    if not key.startswith("daily:"):
        return None
    value = key[6:16]
    try:
        date.fromisoformat(value)
        return value
    except ValueError:
        return None

def ranking_elapsed_ms(r: dict) -> int:
    return int(r.get("elapsed_ms") or r.get("best_elapsed_ms") or 10**12)


def displayed_elapsed_seconds(r: dict) -> int:
    """Use exactly the whole-second precision players see in the leaderboard UI."""
    return ranking_elapsed_ms(r) // 1000


def run_rank_tuple(r: dict) -> tuple:
    return domain_content.run_rank_tuple(r)


def competition_ranks(rows: list[dict]) -> list[int]:
    """Equal player-visible results share a rank (1, 1, 3 competition ranking)."""
    return domain_content.competition_ranks(rows)

def puzzle_info(puzzle_id: str) -> Optional[dict]:
    free_info = free_puzzle_info(puzzle_id)
    if free_info:
        return free_info
    data = load_puzzles()
    for p in data.get("daily", []):
        if p.get("id") == puzzle_id:
            return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": False, "generation": int(data.get("dailyGeneration") or 1)}
    previous = previous_daily_bank(data)
    if previous:
        for p in previous.get("puzzles", []):
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(previous.get("generation") or 2)}
    for bank in reversed(legacy_daily_banks(data)):
        for p in bank["puzzles"]:
            if p.get("id") == puzzle_id:
                return {"puzzle": p, "difficulty": p.get("difficulty"), "mode": "daily", "level": None, "legacy": True, "generation": int(bank.get("generation") or 1)}
    return archived_puzzle_info(
        load_content_catalog(), puzzle_id, None, "daily",
        int(data.get("dailyGeneration") or data.get("contentGeneration") or 1),
    )

def record_puzzle_run(player_id: str, payload: ResultCreate, effective_clean: bool):
    attempt_id = payload.attempt_id or f"run:{player_id}:{payload.challenge_key}:{uuid.uuid4()}"
    if db_select("puzzle_runs", attempt_id=attempt_id):
        return
    completed_at = payload_completed_at(payload.completed_at)
    db_insert("puzzle_runs", {
        "id": str(uuid.uuid4()), "attempt_id": attempt_id, "player_id": player_id,
        "puzzle_id": payload.puzzle_id, "challenge_key": payload.challenge_key,
        "mode": payload.mode, "difficulty": payload.difficulty, "elapsed_ms": payload.elapsed_ms,
        "moves": payload.moves, "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
        "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
        "calm_mode": bool(payload.calm_mode), "completed_at": completed_at,
    })


@app.post("/api/result")
def result(payload: ResultCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "result_submit", limit=120, window_seconds=3600)
    player = auth_player(authorization)
    effective_clean = bool(payload.clean_solve and payload.hints_used == 0)
    if payload.mode not in ("daily", "free", "starter", "tajenka"):
        raise HTTPException(400, "Neplatný režim")
    if payload.difficulty not in FREE_DIFFICULTIES:
        raise HTTPException(400, "Neplatná obtížnost")
    if not puzzle_exists(payload.puzzle_id, payload.mode, payload.difficulty):
        raise HTTPException(400, "Neznámá úloha")
    validate_result_sanity(payload)
    if payload.attempt_id:
        bound_attempts = db_select("puzzle_attempts", id=payload.attempt_id, player_id=player["id"])
        if bound_attempts:
            bound = bound_attempts[0]
            if any((
                bound.get("puzzle_id") != payload.puzzle_id,
                bound.get("challenge_key") != payload.challenge_key,
                bound.get("mode") != payload.mode,
                bound.get("difficulty") != payload.difficulty,
            )):
                raise HTTPException(400, "Výsledek neodpovídá zahájenému pokusu")

    transferred_reward = False
    if payload.mode == "tajenka":
        if not TAJENKA_RELEASE_ENABLED:
            raise HTTPException(404, "Tajenka zatím není vydaná")
        if payload.challenge_key != domain_content.challenge_key("tajenka", payload.puzzle_id):
            raise HTTPException(400, "Neplatný klíč Tajenky")
        if payload.daily_date:
            raise HTTPException(400, "Tajenka nemá daily datum")
        points = domain_content.xp_for(
            "tajenka", payload.difficulty, POINTS, reward_xp=TAJENKA_REWARD_XP,
        )
    elif payload.mode == "starter":
        if payload.challenge_key != domain_content.challenge_key("starter", payload.puzzle_id):
            raise HTTPException(400, "Neplatný klíč první úlohy")
        if payload.daily_date:
            raise HTTPException(400, "První úloha nemá datum")
        points = domain_content.xp_for("starter", payload.difficulty, POINTS, starter_xp=STARTER_XP)
    elif payload.mode == "daily":
        if not payload.daily_date:
            raise HTTPException(400, "Daily výsledek musí mít datum")
        try:
            date.fromisoformat(payload.daily_date)
        except ValueError:
            raise HTTPException(400, "Neplatné datum")
        if payload.challenge_key != domain_content.challenge_key("daily", payload.puzzle_id, payload.daily_date):
            raise HTTPException(400, "Neplatný daily klíč")
        if not daily_puzzle_matches_date(payload.puzzle_id, payload.daily_date):
            raise HTTPException(400, "Tato úloha nepatří k uvedenému dni")
        points = domain_content.xp_for("daily", payload.difficulty, POINTS)
    else:
        if payload.challenge_key != domain_content.challenge_key("free", payload.puzzle_id):
            raise HTTPException(400, "Neplatný klíč volné úlohy")
        info = free_puzzle_info(payload.puzzle_id, payload.difficulty)
        if not info or not is_puzzle_released(info.get("puzzle") or {}, effective_content_date(request)):
            raise HTTPException(400, "Neznámá nebo zatím nevydaná úroveň volné hry")
        if payload.difficulty == "mozkomor":
            unlock_rows = db_select("results", player_id=player["id"])
            enforce_mozkomor_unlock(unlock_rows)
        points, transferred_reward = claim_free_slot_points(
            player["id"], info,
            domain_content.xp_for("free", payload.difficulty, POINTS),
            payload.puzzle_id,
        )

    # Each actual completion is stored as one coherent run. Leaderboards never mix a fast hinted
    # attempt with a slower clean attempt into an impossible synthetic record.
    try:
        record_puzzle_run(player["id"], payload, effective_clean)
    except HTTPException:
        logger.warning("Could not store puzzle run for %s", payload.attempt_id)

    official_completed_at = payload_completed_at(payload.completed_at)
    daily_generation_upgrade = False
    existing = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)
    if existing:
        old = existing[0]
        # Daily i volná úloha mají stejnou soutěžní zásadu: oficiální je PRVNÍ dokončení.
        # Replay se ukládá do puzzle_runs pro telemetry, ale nesmí zlepšit čas/Clean/hinty.
        # Jediná výjimka je opožděná offline synchronizace skutečně staršího dokončení.
        try:
            incoming_is_earlier = completion_time({"completed_at": official_completed_at}) < completion_time(old)
        except Exception:
            incoming_is_earlier = False
        daily_generation_upgrade = is_daily_generation_upgrade(old, payload)
        if daily_generation_upgrade:
            # The date already paid its 100 XP. Replace only the official board/result so
            # current Daily and weekly leaderboards can count the new generation.
            db_update("results", {"id": old["id"]}, {
                "puzzle_id": payload.puzzle_id, "difficulty": payload.difficulty,
                "daily_date": payload.daily_date, "best_elapsed_ms": payload.elapsed_ms,
                "best_moves": payload.moves, "hints_used": payload.hints_used,
                "wrong_attempts": payload.wrong_attempts, "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean, "calm_mode": bool(payload.calm_mode), "completed_at": official_completed_at,
            })
        elif incoming_is_earlier and old.get("puzzle_id") == payload.puzzle_id:
            db_update("results", {"id": old["id"]}, {
                **({"team_code_at_completion": team_code_for_player_at(player, official_completed_at)} if rankings_v2_schema_ready() else {}),
                "best_elapsed_ms": payload.elapsed_ms, "best_moves": payload.moves,
                "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
                "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
                "completed_at": official_completed_at,
            })
        first = False
    else:
        try:
            db_insert("results", {
                **({"team_code_at_completion": team_code_for_player_at(player, official_completed_at)} if rankings_v2_schema_ready() else {}),
                "id": str(uuid.uuid4()),
                "player_id": player["id"],
                "puzzle_id": payload.puzzle_id,
                "challenge_key": payload.challenge_key,
                "mode": payload.mode,
                "difficulty": payload.difficulty,
                "daily_date": payload.daily_date,
                "best_elapsed_ms": payload.elapsed_ms,
                "best_moves": payload.moves,
                "points": points,
                "hints_used": payload.hints_used,
                "wrong_attempts": payload.wrong_attempts,
                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
                "completed_at": official_completed_at,
            })
            first = True
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            # Současné odeslání ze dvou zařízení: zachovej chronologicky první dokončení.
            old = db_select("results", player_id=player["id"], challenge_key=payload.challenge_key)[0]
            daily_generation_upgrade = is_daily_generation_upgrade(old, payload)
            if daily_generation_upgrade:
                db_update("results", {"id": old["id"]}, {
                    "puzzle_id": payload.puzzle_id, "difficulty": payload.difficulty,
                    "daily_date": payload.daily_date, "best_elapsed_ms": payload.elapsed_ms,
                    "best_moves": payload.moves, "hints_used": payload.hints_used,
                    "wrong_attempts": payload.wrong_attempts, "max_hint_level": payload.max_hint_level,
                    "clean_solve": effective_clean, "calm_mode": bool(payload.calm_mode), "completed_at": official_completed_at,
                })
            elif old.get("puzzle_id") == payload.puzzle_id and completion_time({"completed_at": official_completed_at}) < completion_time(old):
                db_update("results", {"id": old["id"]}, {
                    "best_elapsed_ms": payload.elapsed_ms, "best_moves": payload.moves,
                    "hints_used": payload.hints_used, "wrong_attempts": payload.wrong_attempts,
                    "max_hint_level": payload.max_hint_level, "clean_solve": effective_clean,
                    "calm_mode": bool(payload.calm_mode),
                    "completed_at": official_completed_at,
                })
            first = False

    if payload.attempt_id:
        try:
            attempts = db_select("puzzle_attempts", id=payload.attempt_id, player_id=player["id"])
            telemetry_values = {
                "completed_at": datetime.now(TZ).isoformat(),
                "elapsed_ms": payload.elapsed_ms,
                "moves": payload.moves,
                "wrong_attempts": payload.wrong_attempts,
                "hints_used": payload.hints_used,
                "max_hint_level": payload.max_hint_level,
                "clean_solve": effective_clean,
                "calm_mode": bool(payload.calm_mode),
            }
            if attempts:
                db_update("puzzle_attempts", {"id": payload.attempt_id}, telemetry_values)
            else:
                # Offline start mohl minout server. Při synchronizaci výsledku vytvoř dokončený
                # pokus dodatečně, aby telemetry nepodhodnocovala completion rate.
                db_insert("puzzle_attempts", {
                    "id": payload.attempt_id, "player_id": player["id"], "puzzle_id": payload.puzzle_id,
                    "challenge_key": payload.challenge_key, "mode": payload.mode, "difficulty": payload.difficulty,
                    "started_at": datetime.now(TZ).isoformat(), "app_version": "3.7-offline", **telemetry_values,
                })
        except HTTPException:
            logger.warning("Could not finalize telemetry attempt %s", payload.attempt_id)

    # Zápis výsledku je primární operace. Selhání dopočtu statistik nesmí
    # způsobit 500 po již úspěšném uložení a nechat telefon ve falešné frontě.
    try:
        stats = player_stats(player["id"])
        stats_warning = None
    except Exception as exc:
        logger.exception("Result saved, but stats refresh failed for player %s", player.get("id"))
        stats = None
        stats_warning = "Statistiky se nepodařilo obnovit. Výsledek je ale bezpečně uložený."

    return {
        "ok": True,
        "firstCompletion": first,
        "awardedPoints": points if first else 0,
        "dailyGenerationUpgrade": daily_generation_upgrade,
        "transferredSlot": bool(payload.mode == "free" and transferred_reward),
        "stats": stats,
        "statsWarning": stats_warning,
    }

@app.get("/api/result-status")
def result_status(
    request: Request,
    challenge_key: str = Query(min_length=3, max_length=80),
    authorization: Optional[str] = Header(default=None),
):
    """Lehký diagnostický endpoint pro ověření, zda je konkrétní výsledek v cloudu."""
    enforce_rate_limit(request, "result_status_read", limit=180, window_seconds=3600)
    player = auth_player(authorization)
    rows = db_select("results", player_id=player["id"], challenge_key=challenge_key)
    if not rows:
        return {"synced": False, "challengeKey": challenge_key}
    r = rows[0]
    return {
        "synced": True,
        "challengeKey": challenge_key,
        "elapsedMs": r["best_elapsed_ms"],
        "moves": r["best_moves"],
        "completedAt": r["completed_at"],
    }


@app.get("/api/rescue-status")
def rescue_status(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "rescue_status_read", limit=180, window_seconds=3600)
    player = auth_player(authorization)
    return rescue_status_for(player["id"])


@app.post("/api/rescue/start")
def rescue_start(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "rescue_start", limit=20, window_seconds=3600)
    player = auth_player(authorization)
    status = rescue_status_for(player["id"])
    if status.get("state") == "started":
        return status
    if not status.get("eligible") or status.get("state") != "available":
        raise HTTPException(409, "Záchrana streaku teď není dostupná")
    bank = load_puzzles().get("rescue", [])
    if not bank:
        raise HTTPException(503, "Rescue úlohy nejsou na serveru")
    missed = status["missedDate"]
    digest = hashlib.sha256(f"{player['id']}:{missed}".encode()).digest()
    puzzle = bank[int.from_bytes(digest[:4], "big") % len(bank)]
    now = datetime.now(TZ)
    db_insert("streak_rescues", {
        "id": str(uuid.uuid4()), "player_id": player["id"], "missed_date": missed,
        "puzzle_id": puzzle["id"], "status": "started", "started_at": now.isoformat(),
    })
    return {
        "eligible": True, "state": "started", "missedDate": missed,
        "priorStreak": status.get("priorStreak", 0), "puzzleId": puzzle["id"],
        "timeLimitMs": 30000, "secondsRemaining": 30,
    }


@app.post("/api/rescue/finish")
def rescue_finish(payload: RescueFinish, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "rescue_finish", limit=30, window_seconds=3600)
    player = auth_player(authorization)
    rows = db_select("streak_rescues", player_id=player["id"], puzzle_id=payload.puzzle_id)
    if not rows:
        raise HTTPException(404, "Záchranný pokus nebyl nalezen")
    row = sorted(rows, key=lambda r: str(r.get("started_at") or ""), reverse=True)[0]
    if row.get("status") != "started":
        return {"ok": row.get("status") == "passed", "state": row.get("status"), "stats": player_stats(player["id"])}
    # The client clock excludes periods while the page is hidden or unfocused.
    # Rescue results are not part of a speed leaderboard, so wall-clock time is
    # neither a useful fairness signal nor worth penalising a phone interruption.
    passed = bool(payload.completed and payload.elapsed_ms <= 30000)
    final_elapsed = payload.elapsed_ms
    db_update("streak_rescues", {"id": row["id"]}, {
        "status": "passed" if passed else "failed",
        "completed_at": datetime.now(TZ).isoformat(),
        "elapsed_ms": final_elapsed,
    })
    return {"ok": passed, "state": "passed" if passed else "failed", "stats": player_stats(player["id"])}



def _daily_individual_score(row: dict, day_rows: list[dict]) -> float:
    """0–100. Completion 55, clean 15, hints up to 10, relative speed up to 20."""
    elapsed = int(row.get("best_elapsed_ms") or row.get("elapsed_ms") or 86_400_000)
    hints = int(row.get("hints_used") or 0)
    clean = row.get("clean_solve") is True
    completion = 55.0
    clean_bonus = 15.0 if clean else 0.0
    hint_bonus = max(0.0, 10.0 - 3.0 * hints)
    # `puzzle_runs` stores the first competitive run in `elapsed_ms`. Older
    # aggregate result rows may expose `best_elapsed_ms`, so keep that as a
    # compatibility preference but never discard the real run time. Without
    # this fallback every puzzle_run looked like 24 h and every clean solve
    # incorrectly received the full 100 points.
    times = sorted(int(r.get("best_elapsed_ms") or r.get("elapsed_ms") or 86_400_000) for r in day_rows)
    if len(times) <= 1:
        speed_bonus = 10.0
    else:
        # Equal times receive the same best-position percentile.
        rank0 = next((i for i, value in enumerate(times) if value >= elapsed), len(times) - 1)
        percentile = 1.0 - (rank0 / (len(times) - 1))
        speed_bonus = max(0.0, min(20.0, percentile * 20.0))
    return round(min(100.0, completion + clean_bonus + hint_bonus + speed_bonus), 1)


def _family_league_week(week_offset: int = 0) -> dict:
    today = current_prague_date()
    current_week = today - timedelta(days=today.weekday())
    week_start = current_week + timedelta(days=7 * week_offset)
    week_end = week_start + timedelta(days=7)
    dates = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]

    leagues = [r for r in db_select("leagues") if r.get("public_opt_in") is True]
    players = db_select("players")
    player_by_id = {p["id"]: p for p in players}
    members_by_family: dict[str, list[dict]] = {}
    for p in players:
        members_by_family.setdefault(norm_family(str(p.get("family_code") or "")), []).append(p)

    daily_results = [r for r in db_select_all("puzzle_runs", mode="daily") if competitive_row(r)]
    daily_results = [
        r for r in daily_results
        if daily_run_date(r) in dates
        and r.get("puzzle_id") == expected_daily_puzzle_id(daily_run_date(r))
    ]
    rows_by_day: dict[str, list[dict]] = {d: [] for d in dates}
    for r in daily_results:
        d = daily_run_date(r)
        if d in rows_by_day:
            rows_by_day[d].append(r)
    for d, day_rows in rows_by_day.items():
        first_by_player: dict[str, dict] = {}
        for row in day_rows:
            pid = str(row.get("player_id") or "")
            if not pid:
                continue
            previous = first_by_player.get(pid)
            if previous is None or first_run_key(row) < first_run_key(previous):
                first_by_player[pid] = row
        rows_by_day[d] = list(first_by_player.values())

    standings = []
    for league in leagues:
        family = norm_family(str(league.get("code") or ""))
        members = members_by_family.get(family, [])
        member_ids = {p["id"] for p in members}
        member_count = len(members)
        eligible = member_count >= 1
        try:
            enabled_date = datetime.fromisoformat(str(league.get("public_enabled_at") or "").replace("Z", "+00:00")).astimezone(TZ).date()
        except Exception:
            enabled_date = week_start
        # A team that joined later must not appear retroactively in older weeks.
        if enabled_date >= week_end:
            continue
        daily_scores = []
        participation_days = 0
        total_completions = 0
        for d in dates:
            world_rows = rows_by_day[d]
            day_date = date.fromisoformat(d)
            day_members = []
            for member in members:
                try:
                    created = datetime.fromisoformat(str(member.get("team_joined_at") or member.get("created_at") or "").replace("Z", "+00:00")).astimezone(TZ).date()
                except Exception:
                    created = date.min
                if created <= day_date:
                    day_members.append(member)
            day_ids = {m["id"] for m in day_members}
            denominator = min(3, len(day_members)) if day_members else 1
            day_eligible = len(day_members) >= 1 and day_date >= enabled_date
            own_rows = [r for r in world_rows if r.get("player_id") in day_ids and day_date >= enabled_date]
            scored = sorted((_daily_individual_score(r, world_rows) for r in own_rows), reverse=True)
            top = scored[:3]
            score = round(sum(top) / denominator, 1) if day_eligible else 0.0
            if own_rows:
                participation_days += 1
                total_completions += len(own_rows)
            daily_scores.append({"date": d, "score": score, "players": min(len(own_rows), 3)})
        weekly_score = round(sum(x["score"] for x in daily_scores), 1)
        if eligible:
            standings.append({
                "familyCode": family,
                "name": league.get("public_name") or league.get("name") or family,
                "score": weekly_score,
                "memberCount": member_count,
                "daysPlayed": participation_days,
                "daily": daily_scores,
                "completions": total_completions,
            })
    standings.sort(key=lambda x: (-x["score"], -x["daysPlayed"], -x["completions"], str(x["name"]).casefold()))
    for i, item in enumerate(standings, 1):
        item["rank"] = i
    return {
        "weekStart": week_start.isoformat(), "weekEnd": (week_end - timedelta(days=1)).isoformat(),
        "weekOffset": week_offset, "maxScore": 700, "standings": standings,
        "scoring": {"completion": 55, "clean": 15, "hints": 10, "speed": 20, "teamSlots": 3},
    }


@app.get("/api/family-league")
def family_league(
    request: Request,
    week_offset: int = Query(default=0, ge=-12, le=0),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "family_league_read", limit=120, window_seconds=3600)
    data = _family_league_week(week_offset)
    my_family = None
    if authorization:
        try:
            player = auth_player(authorization)
            family = norm_family(str(player.get("family_code") or ""))
            if is_solo_player(player):
                raise HTTPException(404, "Hráč zatím není v týmu")
            league_rows = db_select("leagues", code=family)
            members = db_select("players", family_code=family)
            league = league_rows[0] if league_rows else {}
            mine = next((r for r in data["standings"] if r["familyCode"] == family), None)
            my_family = {
                "familyCode": family,
                "leagueName": league.get("name") or family,
                "publicName": league.get("public_name") or league.get("name") or family,
                "enabled": league.get("public_opt_in") is True,
                "hasPin": bool(league.get("pin_hash")),
                "memberCount": len(members),
                "eligible": len(members) >= 1,
                "rank": mine.get("rank") if mine else None,
                "score": mine.get("score") if mine else 0,
            }
        except HTTPException:
            pass
    public_rows = []
    my_code = my_family.get("familyCode") if my_family else None
    for row in data["standings"]:
        clean = {k: v for k, v in row.items() if k != "familyCode"}
        clean["isMine"] = bool(my_code and row.get("familyCode") == my_code)
        public_rows.append(clean)
    if my_family:
        my_family = {k: v for k, v in my_family.items() if k != "familyCode"}
    return {**data, "standings": public_rows, "myFamily": my_family}


@app.post("/api/family-league/settings")
def family_league_settings(payload: FamilyLeagueSettings, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "family_league_settings", limit=20, window_seconds=3600)
    player = auth_player(authorization)
    if VERCEL_ENV == "preview":
        raise HTTPException(409, "V preview se týmová data z bezpečnostních důvodů nemění")
    family = norm_family(str(player.get("family_code") or ""))
    if is_solo_player(player):
        raise HTTPException(400, "Nejdřív se připoj k týmu nebo ho založ")
    rows = db_select("leagues", code=family)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    league = rows[0]
    # Každý přihlášený člen rodiny má stejná práva k veřejnému nastavení týmu.
    # PIN zůstává pouze jako sdílené pozvání při vytváření NOVÉHO hráče v existující lize.
    values = {"public_opt_in": bool(payload.enabled)}
    if payload.enabled:
        public_name = " ".join((payload.public_name or league.get("name") or family).strip().split())[:40]
        if len(public_name) < 2:
            raise HTTPException(400, "Zadej veřejný název týmu")
        values["public_name"] = public_name
        if league.get("public_opt_in") is not True:
            values["public_enabled_at"] = datetime.now(TZ).isoformat()
    db_update("leagues", {"code": family}, values)
    return {"ok": True, "enabled": bool(payload.enabled), "publicName": values.get("public_name") or league.get("public_name") or league.get("name") or family}


@app.get("/api/puzzle-leaderboard")
def puzzle_leaderboard(
    request: Request,
    puzzle_id: str = Query(min_length=2, max_length=80),
    family_code: str = Query(min_length=2, max_length=24),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "team_puzzle_leaderboard_read", limit=240, window_seconds=3600)
    viewer = auth_player(authorization)
    family = norm_family(family_code)
    viewer_family = norm_family(str(viewer.get("family_code") or ""))
    if is_solo_player(viewer) or viewer_family != family:
        raise HTTPException(403, "Týmové pořadí je dostupné jen členům tohoto týmu")
    players = db_select("players", family_code=family)
    pmap = {p["id"]: p for p in players}
    rows = [r for r in db_select("puzzle_runs", puzzle_id=puzzle_id) if r.get("player_id") in pmap and competitive_row(r)]
    first: dict[str, dict] = {}
    for r in rows:
        pid = r["player_id"]
        if pid not in first or first_run_key(r) < first_run_key(first[pid]):
            first[pid] = r
    # Pořadí srovnává první dokončení každého hráče; replay už výsledek nikdy nezlepší.
    ranked = sorted(first.values(), key=lambda r: (*run_rank_tuple(r), pmap[r["player_id"]]["name"].casefold()))
    ranks = competition_ranks(ranked)
    board = []
    for i, r in enumerate(ranked):
        board.append({
            "rank": ranks[i], "id": r["player_id"], "name": pmap[r["player_id"]]["name"], "avatar": pmap[r["player_id"]].get("avatar") or "🙂",
            "elapsedMs": int(r["elapsed_ms"]), "moves": int(r["moves"]),
            "hintsUsed": int(r.get("hints_used") or 0), "wrongAttempts": int(r.get("wrong_attempts") or 0),
            "cleanSolve": r.get("clean_solve") is True, "completedAt": r.get("completed_at"),
        })
    info = puzzle_info(puzzle_id)
    return {"familyCode": family, "puzzleId": puzzle_id, "difficulty": info.get("difficulty") if info else None, "level": info.get("level") if info else None, "rows": board}


@app.get("/api/free-global-leaderboard")
def free_global_leaderboard(
    request: Request,
    puzzle_id: str = Query(min_length=2, max_length=80),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "free_global_read", limit=300, window_seconds=3600)
    """Worldwide standings for one active Free puzzle.

    Every player is represented by their first completed attempt only. Identity is
    shown only after explicit opt-in; everyone else receives a per-puzzle alias.
    """
    info = free_puzzle_info(puzzle_id)
    if not info or info.get("legacy") is True:
        raise HTTPException(404, "Aktivní volná úroveň nebyla nalezena")

    runs = [row for row in db_select_all("puzzle_runs", puzzle_id=puzzle_id, mode="free") if competitive_row(row)]
    first_by_player: dict[str, dict] = {}
    for row in runs:
        player_id = str(row.get("player_id") or "")
        if not player_id:
            continue
        previous = first_by_player.get(player_id)
        if previous is None or first_run_key(row) < first_run_key(previous):
            first_by_player[player_id] = row

    ranked = sorted(first_by_player.values(), key=lambda row: (
        *run_rank_tuple(row),
        completion_time(row),
        str(row.get("player_id") or ""),
    ))
    ranks = competition_ranks(ranked)

    my_player_id = None
    if authorization:
        try:
            my_player_id = str(auth_player(authorization)["id"])
        except HTTPException:
            pass
    my_index = next(
        (index for index, row in enumerate(ranked) if str(row.get("player_id")) == my_player_id),
        None,
    )
    total = len(ranked)
    if my_index is None:
        visible_indices = list(range(min(3, total)))
    else:
        start = max(0, min(my_index - 1, total - 3))
        visible_indices = list(range(start, min(total, start + 3)))

    players_by_id = {str(p.get("id")): p for p in db_select_all("players") if p.get("id")}
    used_aliases: set[str] = set()
    board = []
    for index in visible_indices:
        row = ranked[index]
        pid = str(row.get("player_id") or "")
        identity = _ranking_display_identity(players_by_id.get(pid), my_player_id, f"free:{puzzle_id}", used_aliases)
        board.append({
            "rank": ranks[index],
            "isMine": index == my_index,
            "name": identity["name"],
            "avatar": identity["avatar"],
            "anonymous": identity["anonymous"],
            "elapsedMs": int(row.get("elapsed_ms") or 0),
            "moves": int(row.get("moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0),
            "cleanSolve": row.get("clean_solve") is True,
        })

    my_rank = ranks[my_index] if my_index is not None else None
    top_percent = max(1, math.ceil(my_rank / total * 100)) if my_rank and total else None
    return {
        "puzzleId": puzzle_id,
        "difficulty": info.get("difficulty"),
        "level": info.get("level"),
        "generation": info.get("generation"),
        "total": total,
        "myRank": my_rank,
        "topPercent": top_percent,
        "percentileMinimum": 10,
        "rows": board,
        "privacy": "opt-in-identity-otherwise-alias",
        "attemptPolicy": "first-completed-only",
    }


@app.get("/api/daily-global-leaderboard")
def daily_global_leaderboard(
    request: Request,
    daily_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Global Daily standings: opted-in identity, otherwise a privacy-safe playful alias."""
    enforce_rate_limit(request, "daily_global_read", limit=300, window_seconds=3600)
    selected_date = daily_date or current_prague_date().isoformat()
    try:
        date.fromisoformat(selected_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")

    my_player_id = None
    if authorization:
        try:
            my_player_id = str(auth_player(authorization)["id"])
        except HTTPException:
            pass
    primary_puzzle_id = daily_leaderboard_puzzle_id(selected_date, my_player_id)
    results = [
        row for row in db_select_all("puzzle_runs", mode="daily")
        if competitive_row(row)
        and daily_run_date(row) == selected_date
        and row.get("puzzle_id") == primary_puzzle_id
    ]
    # A calm first completion may be followed by a standard replay. Rank each player by
    # their first non-calm completion only; replays never improve an existing standard result.
    by_player: dict[str, dict] = {}
    for row in results:
        player_id = str(row.get("player_id") or "")
        if not player_id:
            continue
        previous = by_player.get(player_id)
        if previous is None or completion_time(row) < completion_time(previous):
            by_player[player_id] = row

    ranked = sorted(by_player.values(), key=lambda row: (
        *run_rank_tuple(row),
        completion_time(row),
        str(row.get("player_id") or ""),
    ))
    ranks = competition_ranks(ranked)

    my_index = next((index for index, row in enumerate(ranked) if str(row.get("player_id")) == my_player_id), None)
    total = len(ranked)
    if my_index is None:
        visible_indices = list(range(min(3, total)))
    else:
        start = max(0, min(my_index - 1, total - 3))
        visible_indices = list(range(start, min(total, start + 3)))

    players_by_id = {str(p.get("id")): p for p in db_select_all("players") if p.get("id")}
    used_aliases: set[str] = set()
    board = []
    for index in visible_indices:
        row = ranked[index]
        pid = str(row.get("player_id") or "")
        identity = _ranking_display_identity(players_by_id.get(pid), my_player_id, f"day:{selected_date}", used_aliases)
        board.append({
            "rank": ranks[index],
            "isMine": index == my_index,
            "name": identity["name"],
            "avatar": identity["avatar"],
            "anonymous": identity["anonymous"],
            "elapsedMs": int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 0),
            "moves": int(row.get("moves") or row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0),
            "cleanSolve": row.get("clean_solve") is True,
        })

    my_rank = ranks[my_index] if my_index is not None else None
    top_percent = max(1, math.ceil(my_rank / total * 100)) if my_rank and total else None
    return {
        "date": selected_date,
        "puzzleId": primary_puzzle_id,
        "boardCohort": "primary" if primary_puzzle_id == expected_daily_puzzle_id(selected_date) else "pre-cutover-compat",
        "total": total,
        "myRank": my_rank,
        "topPercent": top_percent,
        "rows": board,
        "privacy": "opt-in-identity-otherwise-alias",
    }




def _ranking_period_start(period: str) -> datetime | None:
    now = datetime.now(TZ)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "all":
        return None
    raise HTTPException(400, "Neplatné období pořadí")


def _ranking_viewer(authorization: Optional[str]) -> dict | None:
    if not authorization:
        return None
    try:
        return auth_player(authorization)
    except HTTPException:
        return None


def rankings_v2_schema_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        db_request("GET", "results", params={"select": "id,team_code_at_completion", "limit": "1"})
        db_request("GET", "team_memberships", params={"select": "id,player_id,team_code,joined_at,left_at", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_visibility_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_player_visible(player: dict, viewer_id: str | None) -> bool:
    if viewer_id and str(player.get("id")) == viewer_id:
        return True
    # NULL means the player has not answered the one-time visibility notice yet.
    return player.get("public_rankings") is True


_RANKING_ANON_ADJECTIVES = [
    "Tajemný", "Nenápadný", "Záhadný", "Skrytý", "Maskovaný", "Mlčenlivý",
    "Tichý", "Neznámý", "Utajený", "Noční", "Kosmický", "Divoký",
    "Chytrý", "Zvědavý", "Propletený", "Šifrovaný", "Nečekaný", "Potulný",
    "Rychlý", "Trpělivý",
]
_RANKING_ANON_ANIMALS = [
    ("jezevec", "🦡"), ("mýval", "🦝"), ("sysel", "🐿️"), ("krtek", "🐾"),
    ("tučňák", "🐧"), ("narval", "🐋"), ("tapír", "🐾"), ("papuchalk", "🐦"),
    ("albatros", "🕊️"), ("axolotl", "🦎"), ("bobr", "🦫"), ("los", "🫎"),
    ("lev", "🦁"), ("rys", "🐈"), ("vlk", "🐺"), ("kocour", "🐱"),
    ("králík", "🐰"), ("delfín", "🐬"), ("hroch", "🦛"), ("šakal", "🐺"),
    ("lemur", "🐒"), ("sokol", "🦅"), ("datel", "🐦"), ("gekon", "🦎"),
]

def _ranking_anonymous_identity(player_id: str, scope: str, used_names: set[str] | None = None) -> dict:
    used_names = used_names if used_names is not None else set()
    for nonce in range(512):
        digest = hashlib.sha256(f"proplet-anon-v1:{scope}:{player_id}:{nonce}".encode()).digest()
        adjective = _RANKING_ANON_ADJECTIVES[digest[0] % len(_RANKING_ANON_ADJECTIVES)]
        animal, avatar = _RANKING_ANON_ANIMALS[digest[1] % len(_RANKING_ANON_ANIMALS)]
        name = f"{adjective} {animal}"
        if name not in used_names:
            used_names.add(name)
            return {"name": name, "avatar": avatar, "anonymous": True}
    return {"name": "Anonymní propletač", "avatar": "🎭", "anonymous": True}

def _ranking_display_identity(player: dict | None, viewer_id: str | None, scope: str, used_names: set[str] | None = None) -> dict:
    player = player or {}
    if _ranking_player_visible(player, viewer_id):
        return {
            "name": player.get("name") or "Hráč",
            "avatar": player.get("avatar") or "🙂",
            "anonymous": False,
        }
    return _ranking_anonymous_identity(str(player.get("id") or "unknown"), scope, used_names)


def _ranking_result_team(row: dict, player: dict | None) -> str | None:
    # v3.31.7 migration stores the authoritative team at XP acquisition. Until the
    # additive migration is applied, preview falls back to the current one-team model.
    stored = norm_family(str(row.get("team_code_at_completion") or ""))
    if stored and not stored.startswith(SOLO_FAMILY_PREFIX):
        return stored
    if not player or is_solo_player(player):
        return None
    family = norm_family(str(player.get("family_code") or ""))
    if not family:
        return None
    joined = parse_timestamp(player.get("team_joined_at"))
    completed = parse_timestamp(row.get("completed_at"))
    if joined and completed and completed < joined:
        return None
    return family


def team_code_for_player_at(
    player: dict,
    completed_at: str | datetime | None,
    memberships_by_player: dict[str, list[dict]] | None = None,
) -> str | None:
    """Resolve the team a player belonged to at the actual completion timestamp.

    This is deliberately time-based so a delayed offline result cannot be credited to
    a team the player joined only later. After switching teams, old XP never moves.
    """
    completed = parse_timestamp(completed_at)
    player_id = str(player.get("id") or "")
    if not completed or not player_id:
        return None
    try:
        memberships = (
            memberships_by_player.get(player_id, [])
            if memberships_by_player is not None
            else db_select("team_memberships", player_id=player_id)
        )
        for membership in memberships:
            joined = parse_timestamp(membership.get("joined_at"))
            left = parse_timestamp(membership.get("left_at"))
            if joined and joined <= completed and (left is None or completed < left):
                family = norm_family(str(membership.get("team_code") or ""))
                if family and not family.startswith(SOLO_FAMILY_PREFIX):
                    return family
        return None
    except HTTPException:
        # Preview/backward-compatible fallback before the additive migration exists.
        return _ranking_result_team({"completed_at": completed.isoformat()}, player)


def _ranking_badge_counts(results: list[dict], rescues: list[dict]) -> dict[str, int]:
    dates: dict[str, set[str]] = {}
    for row in results:
        if row.get("mode") == "daily" and row.get("daily_date") and row.get("player_id"):
            dates.setdefault(str(row["player_id"]), set()).add(str(row["daily_date"])[:10])
    for row in rescues:
        if row.get("status") == "passed" and row.get("missed_date") and row.get("player_id"):
            dates.setdefault(str(row["player_id"]), set()).add(str(row["missed_date"])[:10])
    out = {}
    for player_id, values in dates.items():
        _, longest = streaks(list(values))
        out[player_id] = sum(1 for badge in BADGES if longest >= int(badge["days"]))
    return out


def _ranking_assign_tied_ranks(rows: list[dict], score_key: str) -> None:
    previous = object()
    rank = 0
    for index, row in enumerate(rows, 1):
        score = row.get(score_key)
        if score != previous:
            rank = index
            previous = score
        row["rank"] = rank


def _ranking_context(*, include_results: bool = True, include_rescues: bool = True):
    players = db_select_all("players")
    leagues = db_select_all("leagues")
    results = db_select_all("results") if include_results else []
    rescues = []
    if include_rescues:
        try:
            rescues = db_select_all("streak_rescues")
        except HTTPException:
            rescues = []
    player_by_id = {str(p.get("id")): p for p in players if p.get("id")}
    league_by_code = {norm_family(str(l.get("code") or "")): l for l in leagues if l.get("code")}
    public_team_names = {
        code: (league.get("public_name") or league.get("name") or code)
        for code, league in league_by_code.items() if league.get("public_opt_in") is True
    }
    return players, results, rescues, player_by_id, league_by_code, public_team_names


def _ranking_xp_aggregates(period_start: datetime | None):
    rows = db_rpc("proplet_rankings_xp_aggregate", {
        "p_period_start": period_start.isoformat() if period_start else None,
    })
    if not isinstance(rows, list):
        raise HTTPException(503, "Databázový souhrn pořadí není dostupný")
    period_points: dict[str, int] = {}
    lifetime_points: dict[str, int] = {}
    badge_counts: dict[str, int] = {}
    team_points: dict[str, int] = {}
    for row in rows:
        entity_id = str(row.get("entity_id") or "")
        if not entity_id:
            continue
        if row.get("row_kind") == "team":
            team_points[entity_id] = int(row.get("period_xp") or 0)
            continue
        if row.get("row_kind") == "player":
            period_points[entity_id] = int(row.get("period_xp") or 0)
            lifetime_points[entity_id] = int(row.get("lifetime_xp") or 0)
            badge_counts[entity_id] = int(row.get("badge_count") or 0)
    return period_points, lifetime_points, badge_counts, team_points


@app.post("/api/rankings/visibility")
def rankings_visibility(
    payload: PublicRankingsSet,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "rankings_visibility", limit=20, window_seconds=3600)
    player = auth_player(authorization)
    try:
        db_update("players", {"id": player["id"]}, {"public_rankings": bool(payload.enabled)})
    except HTTPException as exc:
        raise HTTPException(503, "Nové pořadí ještě čeká na databázovou aktualizaci") from exc
    return {"ok": True, "publicRankings": bool(payload.enabled)}


@app.get("/api/team-settings")
def team_settings(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_settings_read", limit=120, window_seconds=3600)
    player = auth_player(authorization)
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    if not family:
        return {"hasTeam": False}
    rows = db_select("leagues", code=family)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    league = rows[0]
    return {
        "hasTeam": True,
        "leagueName": league.get("name") or family,
        "publicEnabled": league.get("public_opt_in") is True,
        "publicName": league.get("public_name") or league.get("name") or family,
    }


@app.post("/api/team-membership/leave")
def leave_team(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_leave", limit=8, window_seconds=3600)
    player = auth_player(authorization)
    if VERCEL_ENV == "preview":
        raise HTTPException(409, "V preview se týmová data z bezpečnostních důvodů nemění")
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    if not family:
        return {"ok": True, "familyCode": None, "leagueName": None}
    now = datetime.now(TZ).isoformat()
    try:
        memberships = db_select("team_memberships", player_id=player["id"])
    except HTTPException as exc:
        raise HTTPException(503, "Změna týmu ještě čeká na databázovou aktualizaci") from exc
    active = [row for row in memberships if not row.get("left_at")]
    for membership in active:
        db_update("team_memberships", {"id": membership["id"]}, {"left_at": now})
    new_solo = make_solo_family_code()
    db_update("players", {"id": player["id"]}, {"family_code": new_solo, "team_joined_at": None})
    return {"ok": True, "familyCode": None, "leagueName": None}


@app.get("/api/rankings/xp")
def rankings_xp(
    request: Request,
    period: str = Query(default="today", pattern="^(today|week|all)$"),
    authorization: Optional[str] = Header(default=None),
):
    started = time.perf_counter()
    enforce_rate_limit(request, "rankings_xp_read", limit=300, window_seconds=3600)
    viewer = _ranking_viewer(authorization)
    viewer_id = str(viewer.get("id")) if viewer else None
    viewer_team = public_family_code(viewer.get("family_code"), viewer.get("team_joined_at")) if viewer else None
    period_start = _ranking_period_start(period)
    try:
        period_points, lifetime_points, badge_counts, team_points = _ranking_xp_aggregates(period_start)
        players, _, _, player_by_id, league_by_code, public_team_names = _ranking_context(
            include_results=False,
            include_rescues=False,
        )
        account_rewards_included = True
        aggregation_mode = "database-rpc-v1"
    except HTTPException as exc:
        # Rolling-deploy fallback: v4.01.10 can start safely before the additive
        # function reaches a database, and the established calculation remains valid.
        logger.warning("rankings_xp aggregate unavailable; using legacy path: %s", exc.detail)
        players, results, rescues, player_by_id, league_by_code, public_team_names = _ranking_context()
        try:
            account_rewards = db_select_all("account_rewards")
            account_rewards_included = True
        except HTTPException:
            account_rewards = []
            account_rewards_included = False
        period_results = [
            row for row in results
            if competitive_row(row)
            and (period_start is None or ((parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ)) >= period_start))
        ]
        lifetime_points = {}
        for row in results:
            pid = str(row.get("player_id") or "")
            if pid:
                lifetime_points[pid] = lifetime_points.get(pid, 0) + int(row.get("points") or 0)
        for reward in account_rewards:
            pid = str(reward.get("player_id") or "")
            if pid:
                lifetime_points[pid] = lifetime_points.get(pid, 0) + max(0, int(reward.get("points") or 0))
        period_points = {}
        for row in period_results:
            pid = str(row.get("player_id") or "")
            if pid:
                period_points[pid] = period_points.get(pid, 0) + int(row.get("points") or 0)
        for reward in account_rewards:
            pid = str(reward.get("player_id") or "")
            granted_at = parse_timestamp(reward.get("granted_at"))
            if pid and (period_start is None or (granted_at and granted_at >= period_start)):
                period_points[pid] = period_points.get(pid, 0) + max(0, int(reward.get("points") or 0))
        badge_counts = _ranking_badge_counts(results, rescues)
        team_points = {}
        for row in period_results:
            player = player_by_id.get(str(row.get("player_id") or ""))
            family = _ranking_result_team(row, player)
            if family:
                team_points[family] = team_points.get(family, 0) + int(row.get("points") or 0)
        aggregation_mode = "legacy-fallback"

    player_rows = []
    used_aliases: set[str] = set()
    alias_scope = f"day:{current_prague_date().isoformat()}" if period == "today" else (f"xp-week:{period_start.date().isoformat()}" if period_start else "xp-all")
    for player in players:
        pid = str(player.get("id") or "")
        score = int(period_points.get(pid, 0))
        if score <= 0 and pid != viewer_id:
            continue
        identity = _ranking_display_identity(player, viewer_id, alias_scope, used_aliases)
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        team_name = public_team_names.get(family or "") if not identity["anonymous"] else None
        if pid == viewer_id and family and not team_name:
            league = league_by_code.get(family)
            team_name = (league or {}).get("name") or family
        player_rows.append({
            "name": identity["name"], "avatar": identity["avatar"], "anonymous": identity["anonymous"],
            "xp": score, "lifetimePoints": int(lifetime_points.get(pid, 0)),
            "teamName": team_name, "badgeCount": int(badge_counts.get(pid, 0)),
            "isMine": pid == viewer_id, "isPrivate": player.get("public_rankings") is False,
        })
    player_rows.sort(key=lambda row: (-row["xp"], -row["lifetimePoints"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(player_rows, "xp")

    current_members: dict[str, int] = {}
    for player in players:
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        if family:
            current_members[family] = current_members.get(family, 0) + 1
    team_rows = []
    for family, score in team_points.items():
        if score <= 0:
            continue
        if family not in public_team_names and family != viewer_team:
            continue
        league = league_by_code.get(family) or {}
        name = public_team_names.get(family) or league.get("name") or family
        team_rows.append({
            "name": name, "xp": int(score), "memberCount": int(current_members.get(family, 0)),
            "isMine": bool(viewer_team and family == viewer_team),
        })
    team_rows.sort(key=lambda row: (-row["xp"], -row["memberCount"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(team_rows, "xp")
    visibility_ready = all("public_rankings" in player for player in players)
    response = {
        "kind": "xp", "period": period, "players": player_rows, "teams": team_rows,
        "visibilityReady": visibility_ready,
        "scoring": "all-awarded-player-xp",
        "accountRewardsIncluded": account_rewards_included,
        "teamScoring": "gameplay-xp",
        "teamAttribution": "result-team-at-completion" if visibility_ready else "joined-at-compatible-preview",
        "aggregation": aggregation_mode,
    }
    logger.info(
        "rankings_xp completed period=%s players=%s teams=%s ms=%s",
        period, len(player_rows), len(team_rows), round((time.perf_counter() - started) * 1000),
    )
    return response


@app.get("/api/rankings/daily")
def rankings_daily(
    request: Request,
    daily_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    started = time.perf_counter()
    enforce_rate_limit(request, "rankings_daily_read", limit=300, window_seconds=3600)
    selected_date = daily_date or current_prague_date().isoformat()
    try:
        date.fromisoformat(selected_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    viewer = _ranking_viewer(authorization)
    viewer_id = str(viewer.get("id")) if viewer else None
    viewer_team = public_family_code(viewer.get("family_code"), viewer.get("team_joined_at")) if viewer else None
    players, _, _, player_by_id, league_by_code, public_team_names = _ranking_context(
        include_results=False,
        include_rescues=False,
    )
    primary_puzzle_id = daily_leaderboard_puzzle_id(selected_date, viewer_id)
    day_rows = [
        row for row in db_select_all("puzzle_runs", mode="daily", puzzle_id=primary_puzzle_id)
        if competitive_row(row) and daily_run_date(row) == selected_date
    ]
    by_player: dict[str, dict] = {}
    for row in day_rows:
        pid = str(row.get("player_id") or "")
        if not pid:
            continue
        previous = by_player.get(pid)
        if previous is None or completion_time(row) < completion_time(previous):
            by_player[pid] = row
    ranked_all = sorted(by_player.values(), key=lambda row: (
        *run_rank_tuple(row),
        completion_time(row), str(row.get("player_id") or ""),
    ))
    ranks = competition_ranks(ranked_all)
    day_rows = list(by_player.values())
    player_rows = []
    used_aliases: set[str] = set()
    for row_index, row in enumerate(ranked_all):
        pid = str(row.get("player_id") or "")
        player = player_by_id.get(pid)
        if not player:
            continue
        identity = _ranking_display_identity(player, viewer_id, f"day:{selected_date}", used_aliases)
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        team_name = public_team_names.get(family or "") if not identity["anonymous"] else None
        if pid == viewer_id and family and not team_name:
            league = league_by_code.get(family) or {}
            team_name = league.get("name") or family
        player_rows.append({
            "name": identity["name"], "avatar": identity["avatar"], "anonymous": identity["anonymous"], "teamName": team_name,
            "elapsedMs": int(row.get("elapsed_ms") or row.get("best_elapsed_ms") or 0), "moves": int(row.get("moves") or row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0), "cleanSolve": row.get("clean_solve") is True,
            "isMine": pid == viewer_id, "rank": ranks[row_index],
        })

    try:
        memberships = db_select_all("team_memberships")
        memberships_by_player: dict[str, list[dict]] | None = {}
        for membership in memberships:
            if membership.get("player_id"):
                memberships_by_player.setdefault(str(membership["player_id"]), []).append(membership)
    except HTTPException:
        memberships_by_player = None
    by_team: dict[str, list[float]] = {}
    for row in day_rows:
        player = player_by_id.get(str(row.get("player_id") or ""))
        family = team_code_for_player_at(
            player or {}, row.get("completed_at"), memberships_by_player
        ) if player else None
        if family:
            by_team.setdefault(family, []).append(_daily_individual_score(row, day_rows))
    current_members: dict[str, int] = {}
    for player in players:
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        if family:
            current_members[family] = current_members.get(family, 0) + 1
    team_rows = []
    for family, scores in by_team.items():
        if family not in public_team_names and family != viewer_team:
            continue
        top = sorted(scores, reverse=True)[:3]
        if not top:
            continue
        league = league_by_code.get(family) or {}
        team_rows.append({
            "name": public_team_names.get(family) or league.get("name") or family,
            "score": round(sum(top) / len(top), 1), "players": len(top),
            "memberCount": int(current_members.get(family, 0)), "isMine": bool(viewer_team and family == viewer_team),
        })
    team_rows.sort(key=lambda row: (-row["score"], -row["players"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(team_rows, "score")
    response = {
        "kind": "daily", "date": selected_date, "puzzleId": primary_puzzle_id,
        "players": player_rows, "teams": team_rows,
        "playerScoring": "clean-hints-time-moves",
        "teamScoring": "average-best-up-to-3-normalized-0-100",
    }
    logger.info(
        "rankings_daily completed date=%s players=%s teams=%s ms=%s",
        selected_date, len(player_rows), len(team_rows), round((time.perf_counter() - started) * 1000),
    )
    return response


@app.get("/api/free-archive")
def free_archive(
    request: Request,
    puzzle_id: str = Query(min_length=2, max_length=80),
):
    """Return one historical Free board only when an existing client needs to resume it."""
    enforce_rate_limit(request, "free_archive_read", limit=60, window_seconds=3600)
    info = free_puzzle_info(puzzle_id)
    if not info or info.get("legacy") is not True:
        raise HTTPException(404, "Archivovaná úroveň nebyla nalezena")
    if not info.get("puzzle"):
        return JSONResponse(
            status_code=410,
            content={
                "detail": "Tato historická úroveň už není hratelná",
                "archived": True,
                "puzzleId": puzzle_id,
                "difficulty": info.get("difficulty"),
                "level": info.get("level"),
                "generation": info.get("generation"),
            },
        )
    return {"puzzle": info["puzzle"], "difficulty": info["difficulty"], "level": info["level"]}


@app.get("/api/played-levels")
def played_levels(
    request: Request,
    difficulty: str = Query(min_length=3, max_length=20),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "played_levels_read", limit=180, window_seconds=3600)
    player = auth_player(authorization)
    data = load_puzzles()
    bank = sorted(released_free_bank(difficulty, effective_content_date(request)), key=lambda p: int((p.get("meta") or {}).get("level") or 9999))
    active = {p["id"]: p for p in bank}
    results = [r for r in db_select("results", player_id=player["id"]) if r.get("mode") == "free" and r.get("difficulty") == difficulty]
    active_generation = int(data.get("freeGeneration") or 1)
    prior_slots: set[int] = set()
    prior_history: list[dict] = []
    current_result_by_puzzle: dict[str, dict] = {}
    for row in results:
        info = free_puzzle_info(str(row.get("puzzle_id") or ""), difficulty)
        if not info:
            continue
        if int(info["generation"]) == active_generation and info.get("legacy") is not True:
            current_result_by_puzzle[str(row.get("puzzle_id"))] = row
        else:
            prior_slots.add(int(info["level"]))
            prior_history.append({
                "puzzleId": row.get("puzzle_id"), "level": int(info["level"]),
                "contentGeneration": int(info["generation"]),
                "elapsedMs": int(row.get("best_elapsed_ms") or 1000),
                "moves": int(row.get("best_moves") or 1),
                "hintsUsed": int(row.get("hints_used") or 0),
                "wrongAttempts": int(row.get("wrong_attempts") or 0),
                "cleanSolve": row.get("clean_solve") is True, "calmMode": row.get("calm_mode") is True,
                "completedAt": row.get("completed_at"),
            })
    runs = [r for r in db_select("puzzle_runs", player_id=player["id"]) if r.get("mode") == "free" and r.get("difficulty") == difficulty and r.get("puzzle_id") in active]
    grouped: dict[str, list[dict]] = {}
    for r in runs:
        grouped.setdefault(r["puzzle_id"], []).append(r)
    items = []
    for p in bank:
        vals = grouped.get(p["id"], [])
        level = int((p.get("meta") or {}).get("level") or 0)
        result_row = current_result_by_puzzle.get(p["id"])
        if vals:
            first = min(vals, key=first_run_key)
            items.append({
                "puzzleId": p["id"], "level": level, "transferred": False,
                "elapsedMs": int(first["elapsed_ms"]), "moves": int(first["moves"]),
                "hintsUsed": int(first.get("hints_used") or 0), "wrongAttempts": int(first.get("wrong_attempts") or 0),
                "cleanSolve": first.get("clean_solve") is True, "calmMode": first.get("calm_mode") is True,
                "attempts": len(vals), "completedAt": first.get("completed_at"),
            })
        elif result_row:
            items.append({
                "puzzleId": p["id"], "level": level, "transferred": False,
                "elapsedMs": int(result_row.get("best_elapsed_ms") or 1000), "moves": int(result_row.get("best_moves") or 1),
                "hintsUsed": int(result_row.get("hints_used") or 0), "wrongAttempts": int(result_row.get("wrong_attempts") or 0),
                "cleanSolve": result_row.get("clean_solve") is True, "calmMode": result_row.get("calm_mode") is True,
                "attempts": 1, "completedAt": result_row.get("completed_at"),
            })
        elif level in prior_slots:
            items.append({"puzzleId": p["id"], "level": level, "transferred": True, "attempts": 0})
    actual = sum(not item.get("transferred") for item in items)
    transferred = sum(bool(item.get("transferred")) for item in items)
    prior_history.sort(key=lambda row: (row["level"], str(row.get("completedAt") or ""), str(row.get("puzzleId") or "")))
    return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": prior_history}



@app.get("/api/rolling-content")
def public_rolling_content(request: Request, preview_as_of: Optional[str] = Query(default=None, max_length=10)):
    """Small release-gated delta. Future reserve content stays server-side."""
    as_of = effective_content_date(request, preview_as_of)
    return released_rolling_payload(as_of)


@app.get("/api/push/config")
def push_config():
    return {"available": push_ready(), "publicKey": VAPID_PUBLIC_KEY if push_ready() else None, "preferencesVersion": 2, "preferencesReady": push_preferences_schema_ready()}




@app.get("/api/push/preferences")
def push_preferences(
    request: Request,
    endpoint: str = Query(min_length=20, max_length=2048),
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "push_preferences_read", limit=120, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    rows = db_select("push_subscriptions", endpoint=endpoint)
    row = next((r for r in rows if r.get("player_id") == actor.get("player_id") and r.get("anonymous_id") == actor.get("anonymous_id")), None)
    ready = bool(row and "daily_enabled" in row and "content_enabled" in row) or push_preferences_schema_ready()
    if not row:
        return {"migrationReady": ready, "subscribed": False, "dailyEnabled": False, "contentEnabled": False}
    return {
        "migrationReady": ready,
        "subscribed": True,
        # Missing fields means a legacy DB row: it represented Daily consent only.
        "dailyEnabled": bool(row.get("daily_enabled", True)),
        "contentEnabled": bool(row.get("content_enabled", False)),
    }


@app.get("/api/push/account-state")
def push_account_state(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "push_account_state", limit=120, window_seconds=3600)
    player = auth_player(authorization)
    rows = db_select("push_subscriptions", player_id=player["id"])
    return {
        "enabled": any(bool(row.get("daily_enabled", True) or row.get("content_enabled", False)) for row in rows),
        "devices": len(rows),
    }


@app.post("/api/push/subscribe")
def push_subscribe(
    payload: PushSubscriptionCreate,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "push_subscribe", limit=20, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    if not push_ready():
        raise HTTPException(503, "Push notifikace ještě nejsou na serveru nakonfigurované")
    # Od v4.01.7 má hráč jeden srozumitelný souhlas. Dvě DB pole zůstávají jen proto,
    # že Daily a pondělní drop mají odlišný plán doručení. Starý klient při zapnutí
    # rovněž aktivuje obě kategorie; vypnutí stále používá /unsubscribe.
    enabled = True if payload.daily_enabled is None and payload.content_enabled is None else bool(payload.daily_enabled or payload.content_enabled)
    daily_enabled = content_enabled = enabled
    row = {
        "endpoint": payload.endpoint,
        "player_id": actor.get("player_id"), "anonymous_id": actor.get("anonymous_id"),
        "p256dh": payload.p256dh, "auth": payload.auth,
        "user_agent": payload.user_agent, "updated_at": datetime.now(TZ).isoformat(),
        "daily_enabled": daily_enabled, "content_enabled": content_enabled,
    }
    try:
        db_upsert_push_subscription(row)
    except HTTPException as exc:
        raise HTTPException(503, "Registrace upozornění čeká na dokončení serverové aktualizace") from exc
    return {"ok": True, "dailyEnabled": daily_enabled, "contentEnabled": content_enabled}


@app.post("/api/push/unsubscribe")
def push_unsubscribe(
    payload: PushUnsubscribe,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
):
    enforce_rate_limit(request, "push_unsubscribe", limit=30, window_seconds=3600)
    actor = telemetry_actor(authorization, x_proplet_anon_id)
    rows = db_select("push_subscriptions", endpoint=payload.endpoint)
    for row in rows:
        if row.get("player_id") == actor.get("player_id") and row.get("anonymous_id") == actor.get("anonymous_id"):
            db_delete("push_subscriptions", id=row["id"])
    return {"ok": True}


@app.get("/api/cron/daily-push")
def cron_daily_push(request: Request, authorization: Optional[str] = Header(default=None)):
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(401, "Neplatné cron oprávnění")
    today = current_prague_date().isoformat()
    snapshot = save_quality_snapshot_if_monday()
    try:
        housekeeping = db_rpc("proplet_launch_housekeeping")
    except HTTPException:
        housekeeping = None
    if not push_ready():
        return {"ok": False, "sent": 0, "message": "VAPID není nakonfigurovaný", "qualitySnapshot": snapshot, "housekeeping": housekeeping}
    completed = {r.get("player_id") for r in db_select("results", mode="daily", daily_date=today)}
    subscriptions = db_select("push_subscriptions")
    sent = failed = removed = 0
    payload = json.dumps({
        "title": "☀️ Nový Proplet je tady",
        "body": "Dnešní výzva čeká. Propleteš ji čistě?",
        "url": "/?open=daily", "tag": f"proplet-daily-{today}"
    }, ensure_ascii=False)
    for sub in subscriptions:
        if sub.get("daily_enabled", True) is False:
            continue
        if sub.get("player_id") in completed:
            continue
        info = {"endpoint": sub.get("endpoint"), "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")}}
        try:
            webpush(subscription_info=info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=43200)
            sent += 1
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Push failed for subscription %s: %s", sub.get("id"), exc)
    return {"ok": True, "date": today, "sent": sent, "failed": failed, "removed": removed, "qualitySnapshot": snapshot, "housekeeping": housekeeping}


@app.get("/api/leaderboard")
def leaderboard(
    request: Request,
    family_code: str = Query(min_length=2, max_length=24),
    daily_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "team_leaderboard_read", limit=120, window_seconds=3600)
    viewer = auth_player(authorization)
    family = norm_family(family_code)
    viewer_family = norm_family(str(viewer.get("family_code") or ""))
    if is_solo_player(viewer) or viewer_family != family:
        raise HTTPException(403, "Týmové pořadí je dostupné jen členům tohoto týmu")
    daily_date = daily_date or current_prague_date().isoformat()
    players = db_select("players", family_code=family)

    overall = []
    for p in players:
        stats = player_stats(p["id"])
        overall.append({"id": p["id"], "name": p["name"], "avatar": p.get("avatar") or "🙂", **stats})
    overall.sort(key=lambda x: (-x["points"], -x["currentStreak"], x["name"].casefold()))
    for i, item in enumerate(overall, 1):
        item["rank"] = i

    player_map = {p["id"]: p for p in players}
    today = current_prague_date()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=7)
    weekly = []
    all_results = db_select("results")
    family_results = [r for r in all_results if r.get("player_id") in player_map]
    for p in players:
        rows = []
        for r in family_results:
            if r.get("player_id") != p["id"]:
                continue
            try:
                done = datetime.fromisoformat(str(r.get("completed_at")).replace("Z", "+00:00")).astimezone(TZ).date()
            except Exception:
                continue
            if week_start <= done < week_end:
                rows.append(r)
        weekly.append({
            "id": p["id"], "name": p["name"], "avatar": p.get("avatar") or "🙂", "points": sum(int(r.get("points") or 0) for r in rows),
            "completed": sum(1 for r in rows if r.get("mode") in ("daily", "free")), "daily": sum(1 for r in rows if r.get("mode") == "daily"),
            "clean": sum(1 for r in rows if r.get("mode") in ("daily", "free") and r.get("clean_solve") is True),
        })
    weekly.sort(key=lambda x: (-x["points"], -x["daily"], -x["clean"], x["name"].casefold()))
    for i, item in enumerate(weekly, 1):
        item["rank"] = i

    daily_rows = db_select("results", mode="daily", daily_date=daily_date)
    primary_daily_id = expected_daily_puzzle_id(daily_date)
    daily_rows = [r for r in daily_rows if r["player_id"] in player_map and r.get("puzzle_id") == primary_daily_id]
    daily_rows.sort(key=lambda r: (*run_rank_tuple(r), player_map[r["player_id"]]["name"].casefold()))
    daily_ranks = competition_ranks(daily_rows)
    daily = [
        {
            "rank": daily_ranks[index],
            "id": r["player_id"],
            "name": player_map[r["player_id"]]["name"],
            "avatar": player_map[r["player_id"]].get("avatar") or "🙂",
            "elapsedMs": r["best_elapsed_ms"],
            "moves": r["best_moves"],
            "hintsUsed": int(r.get("hints_used") or 0),
            "cleanSolve": r.get("clean_solve") is True,
        }
        for index, r in enumerate(daily_rows)
    ]
    return {"familyCode": family, "date": daily_date, "weekStart": week_start.isoformat(), "overall": overall, "weekly": weekly, "daily": daily}




# v3.31.8 — additive identity bridge. Existing Proplet sessions/passwords stay canonical.
from account_auth import AppServices, install_account_auth
install_account_auth(
    app,
    services=AppServices(
        supabase_url=SUPABASE_URL,
        supabase_key=SUPABASE_SECRET_KEY,
        tz=TZ,
        db_select=db_select,
        db_insert=db_insert,
        db_update=db_update,
        db_delete=db_delete,
        auth_player=auth_player,
        new_session=new_session,
        hash_password=hash_password,
        verify_password=verify_password,
        enforce_rate_limit=enforce_rate_limit,
        player_stats=player_stats,
        public_family_code=public_family_code,
        league_name_for=league_name_for,
        db_rpc=db_rpc,
        save_quality_snapshot_if_monday=save_quality_snapshot_if_monday,
        current_prague_date=current_prague_date,
        released_batches=_released_batches,
        logger=logger,
        norm_family=norm_family,
        resolved_puzzle=resolved_puzzle,
        puzzle_exists=puzzle_exists,
        daily_puzzle_matches_date=daily_puzzle_matches_date,
        telemetry_actor=telemetry_actor,
        app_version=APP_VERSION,
        vercel_env=VERCEL_ENV,
    ),
)

# Lokální spuštění přes uvicorn: Vercel obslouží public/ sám z CDN.
if not os.environ.get("VERCEL"):
    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="local-static")
