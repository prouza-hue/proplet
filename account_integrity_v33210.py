from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


class IntegrityLogin(BaseModel):
    name: str = Field(min_length=1, max_length=254)
    family_code: Optional[str] = Field(default=None, max_length=24)
    password: str = Field(min_length=8, max_length=128)


def install_account_integrity(
    app,
    *,
    tz,
    db_select,
    auth_player,
    new_session,
    verify_password,
    enforce_rate_limit,
    player_stats,
    public_family_code,
    league_name_for,
    norm_family=None,
    **_kwargs,
):
    """v3.32.10 account-integrity guardrails.

    Two launch observations drove this patch:
    - a double submit could create two password accounts seconds apart;
    - those technical duplicates then polluted account counts and could make name+password login ambiguous.

    The existing endpoints remain untouched for cached clients. New clients use the dedupe-aware
    login endpoint, while a short server-side create guard also protects cached clients.
    """

    def parse_stamp(value):
        try:
            dt = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=tz)
            return dt.astimezone(tz)
        except Exception:
            return None

    def norm_name(value):
        return " ".join(str(value or "").strip().split()).casefold()

    def family(value):
        if callable(norm_family):
            return norm_family(str(value or ""))
        return str(value or "").strip().upper()[:24]

    def admin_allowed(player):
        try:
            rows = db_select("admin_accounts", player_id=player["id"])
            return any(row.get("active") is not False for row in rows)
        except HTTPException:
            return False

    def activity_score(player):
        pid = player["id"]
        sessions = len(db_select("player_sessions", player_id=pid))
        pushes = len(db_select("push_subscriptions", player_id=pid))
        results = len(db_select("results", player_id=pid))
        events = len(db_select("product_events", player_id=pid))
        return (
            (100000 if player.get("auth_user_id") else 0)
            + (50000 if player.get("email_verified_at") else 0)
            + sessions * 1000
            + pushes * 500
            + results * 10
            + events
        )

    def same_creation_burst(players):
        if len(players) < 2:
            return False
        names = {norm_name(p.get("name")) for p in players}
        stamps = [parse_stamp(p.get("created_at")) for p in players]
        if len(names) != 1 or any(stamp is None for stamp in stamps):
            return False
        return (max(stamps) - min(stamps)).total_seconds() <= 10

    @app.middleware("http")
    async def account_creation_race_guard(request: Request, call_next):
        # Database-backed rate limiting is shared by all Vercel instances, so even two
        # concurrent serverless requests cannot create two rows from one rapid double submit.
        if request.method == "POST" and request.url.path == "/api/player":
            try:
                enforce_rate_limit(
                    request,
                    "account_create_race",
                    limit=1,
                    window_seconds=8,
                    discriminator="create",
                )
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return await call_next(request)

    @app.post("/api/login-integrity")
    def login_integrity(payload: IntegrityLogin, request: Request):
        enforce_rate_limit(request, "login_ip", limit=30, window_seconds=300)
        enforce_rate_limit(request, "login_account", limit=8, window_seconds=300, discriminator=payload.name)
        identifier = " ".join(payload.name.strip().split())
        requested_family = family(payload.family_code or "")

        if "@" in identifier:
            email = identifier.casefold()
            candidates = [
                p for p in db_select("players")
                if p.get("email_verified_at") and str(p.get("email") or "").casefold() == email
            ]
        elif requested_family:
            candidates = [
                p for p in db_select("players", family_code=requested_family)
                if norm_name(p.get("name")) == norm_name(identifier)
            ]
        else:
            candidates = [p for p in db_select("players") if norm_name(p.get("name")) == norm_name(identifier)]

        if not candidates:
            raise HTTPException(401, "Jméno nebo heslo nesedí")
        matches = [p for p in candidates if p.get("password_hash") and verify_password(payload.password, p.get("password_hash"))]
        if not matches:
            if len(candidates) == 1 and not candidates[0].get("password_hash"):
                raise HTTPException(409, "Tento hráč ještě nemá heslo. Nastav ho na zařízení, kde už je přihlášený.")
            raise HTTPException(401, "Jméno nebo heslo nesedí")

        deduplicated = False
        if len(matches) > 1 and not requested_family:
            if not same_creation_burst(matches):
                raise HTTPException(409, "Našli jsme více účtů se stejným jménem. Otevři volbu pro starší týmový účet a vyber svůj tým.")
            matches = sorted(matches, key=lambda p: (activity_score(p), parse_stamp(p.get("created_at")) or datetime.min.replace(tzinfo=tz)), reverse=True)
            deduplicated = True

        player = matches[0]
        token = new_session(player["id"])
        public_family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        return {
            "id": player["id"],
            "name": player["name"],
            "familyCode": public_family,
            "leagueName": league_name_for(player.get("family_code") or "") if public_family else None,
            "token": token,
            "hasPassword": bool(player.get("password_hash")),
            "avatar": player.get("avatar") or "🙂",
            "supportMode": player.get("support_mode") or "none",
            "publicRankings": player.get("public_rankings"),
            "stats": player_stats(player["id"]),
            "email": player.get("email"),
            "emailVerified": bool(player.get("email_verified_at")),
            "googleLinked": bool(player.get("auth_user_id")),
            "integrityDeduplicated": deduplicated,
        }

    @app.get("/api/admin/account-integrity")
    def admin_account_integrity(request: Request, authorization: Optional[str] = Header(default=None)):
        enforce_rate_limit(request, "admin_account_integrity", limit=120, window_seconds=3600)
        viewer = auth_player(authorization)
        if not admin_allowed(viewer):
            raise HTTPException(403, "Administrátorský přístup je potřeba")

        players = list(db_select("players"))
        by_name = {}
        for player in players:
            by_name.setdefault(norm_name(player.get("name")), []).append(player)

        clusters = []
        for same_name in by_name.values():
            ordered = sorted(same_name, key=lambda p: parse_stamp(p.get("created_at")) or datetime.min.replace(tzinfo=tz))
            current = []
            for player in ordered:
                stamp = parse_stamp(player.get("created_at"))
                if not current:
                    current = [player]
                    continue
                previous_stamp = parse_stamp(current[-1].get("created_at"))
                if stamp and previous_stamp and (stamp - previous_stamp).total_seconds() <= 10:
                    current.append(player)
                else:
                    if len(current) > 1 and same_creation_burst(current):
                        clusters.append(current)
                    current = [player]
            if len(current) > 1 and same_creation_burst(current):
                clusters.append(current)

        result_counts = {}
        session_counts = {}
        push_counts = {}
        for row in db_select("results"):
            pid = str(row.get("player_id") or "")
            result_counts[pid] = result_counts.get(pid, 0) + 1
        for row in db_select("player_sessions"):
            pid = str(row.get("player_id") or "")
            session_counts[pid] = session_counts.get(pid, 0) + 1
        for row in db_select("push_subscriptions"):
            pid = str(row.get("player_id") or "")
            push_counts[pid] = push_counts.get(pid, 0) + 1

        duplicate_rows = 0
        rows = []
        for cluster in clusters:
            duplicate_rows += len(cluster) - 1
            ranked = sorted(
                cluster,
                key=lambda p: (
                    1 if p.get("auth_user_id") else 0,
                    1 if p.get("email_verified_at") else 0,
                    session_counts.get(str(p["id"]), 0),
                    push_counts.get(str(p["id"]), 0),
                    result_counts.get(str(p["id"]), 0),
                    parse_stamp(p.get("created_at")) or datetime.min.replace(tzinfo=tz),
                ),
                reverse=True,
            )
            canonical = ranked[0]
            first = min(parse_stamp(p.get("created_at")) for p in cluster if parse_stamp(p.get("created_at")))
            last = max(parse_stamp(p.get("created_at")) for p in cluster if parse_stamp(p.get("created_at")))
            rows.append({
                "name": canonical.get("name") or "Hráč",
                "rows": len(cluster),
                "seconds": round((last - first).total_seconds(), 2),
                "canonicalId": canonical.get("id"),
                "canonicalResults": result_counts.get(str(canonical.get("id")), 0),
                "googleLinked": bool(canonical.get("auth_user_id")),
                "emailVerified": bool(canonical.get("email_verified_at")),
            })

        rows.sort(key=lambda row: (-row["rows"], row["name"].casefold()))
        return {
            "rawPlayers": len(players),
            "likelyDuplicateRows": duplicate_rows,
            "canonicalPlayers": len(players) - duplicate_rows,
            "duplicateClusters": len(clusters),
            "rows": rows,
            "definition": "Stejné jméno a vytvoření ve stejné <=10s account-creation burst. Jde o analytickou canonicalizaci, ne automatické mazání hráčských dat.",
            "prevention": {
                "frontendSubmitLock": True,
                "serverCreateRaceWindowSeconds": 8,
                "dedupeAwareLogin": True,
            },
        }
