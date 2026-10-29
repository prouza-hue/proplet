"""Bounded, read-only owner workspace. Database failures are never zero metrics."""
from __future__ import annotations

from datetime import date, datetime, timedelta
import os
import re
from typing import Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Header, HTTPException, Query

TZ = ZoneInfo("Europe/Prague")
SORTS = {"active", "name", "xp", "created"}
STATUSES = {"open", "all", "new", "reviewing", "resolved", "dismissed"}


def metadata(source, *, status="ready", days=None, coverage="complete", now=None, **extra):
    now = now or datetime.now(TZ)
    return {"generatedAt": now.isoformat(), "period": {
        "from": (now - timedelta(days=days)).isoformat() if days else None,
        "to": now.isoformat(), "timeZone": "Europe/Prague"}, "source": source,
        "status": status, "coverage": coverage, "definitionVersion": "admin-workspace-v1", **extra}


def identifier(value, *, optional=False):
    if optional and not value:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(400, "Neplatné ID hráče nebo případu")


def page_args(offset, limit, maximum=200):
    if type(offset) is not int or type(limit) is not int or not 0 <= offset <= 100000 or not 1 <= limit <= maximum:
        raise HTTPException(400, "Neplatné stránkování")
    return offset, limit


def rpc_payload(ns, function, body):
    result = ns["db_rpc"](function, body)
    if not isinstance(result, dict):
        raise HTTPException(503, "Adminový datový zdroj není dostupný")
    return result


def mask_email(value):
    if not value or "@" not in str(value):
        return None
    local, domain = str(value).rsplit("@", 1)
    return f"{local[:1]}***@{domain}"


def safe_details(value):
    if isinstance(value, dict):
        return {k: safe_details(v) for k, v in value.items()
                if not any(word in str(k).lower() for word in ("token", "secret", "password", "authorization"))}
    if isinstance(value, list):
        return [safe_details(v) for v in value[:30]]
    if isinstance(value, str):
        return re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", lambda m: mask_email(m.group()), value[:2000])
    return value


def user_row(row):
    # The SQL RPC deliberately never selects password hashes or auth/session tokens.
    return {"id": row.get("id"), "name": row.get("name"), "avatar": row.get("avatar") or "🙂",
            "familyCode": None if not row.get("team_joined_at") and str(row.get("family_code") or "").upper().startswith("SOLO_") else row.get("family_code"), "team": row.get("team") or "Bez týmu",
            "createdAt": row.get("created_at"), "lastActiveAt": row.get("last_active_at"),
            "lastGameAt": row.get("last_game_at"), "appVersion": row.get("app_version"),
            "supportMode": row.get("support_mode") or "none", "hasPassword": row.get("has_password") is True,
            "points": row.get("points"), "resultXp": row.get("result_xp"),
            "accountBonusXp": row.get("account_bonus_xp"), "wordDiscoveryXp": row.get("word_discovery_xp"),
            "otherRewardXp": row.get("other_reward_xp"), "xpAuthoritative": True,
            "completed": row.get("completed"), "dailyCompleted": row.get("daily_completed"),
            "openWordReports": row.get("open_word_reports"), "identity": {
                "emailMasked": mask_email(row.get("email")), "emailVerified": row.get("email_verified") is True,
                "googleLinked": row.get("google_linked") is True}}


def users(ns, q="", offset=0, limit=60, sort="active", team=None):
    page_args(offset, limit)
    if sort not in SORTS:
        raise HTTPException(400, "Neplatné řazení hráčů")
    needle = " ".join(str(q).strip().split())[:80]
    result = rpc_payload(ns, "proplet_admin_users_page_v1", {
        "p_query": needle or None, "p_offset": offset, "p_limit": limit,
        "p_sort": sort, "p_team": team})
    rows = result.get("users")
    if not isinstance(rows, list) or type(result.get("total")) is not int:
        raise HTTPException(503, "Neúplný seznam hráčů")
    return {"users": [user_row(r) for r in rows], "total": result["total"], "offset": offset, "limit": limit,
            "meta": metadata("proplet_admin_users_page_v1", status="ready" if result["total"] else "empty",
                             unit="accounts", xpSource="proplet_account_xp_v1")}


def cases(ns, kind, *, status="open", q="", category="", player_id=None, case_id=None, offset=0, limit=100):
    page_args(offset, limit, maximum=300 if kind == "words" else 200)
    if status not in STATUSES:
        raise HTTPException(400, "Neplatný filtr stavu")
    result = rpc_payload(ns, "proplet_admin_cases_v1", {"p_kind": kind, "p_status": status,
        "p_query": q.strip()[:80] or None, "p_category": category.strip()[:40] or None,
        "p_player": identifier(player_id, optional=True), "p_id": identifier(case_id, optional=True),
        "p_offset": offset, "p_limit": limit})
    if not isinstance(result.get("rows"), list) or type(result.get("total")) is not int:
        raise HTTPException(503, "Neúplná fronta hlášení")
    rows = []
    for r in result["rows"]:
        player = r.get("player") or {}
        item = {"id": r.get("id"), "status": r.get("status") or "new", "createdAt": r.get("created_at"),
                "resolutionNote": r.get("resolution_note"), "reviewedAt": r.get("reviewed_at"),
                "reviewedBy": r.get("reviewed_by"), "reportedBy": {"id": player.get("id"),
                    "name": player.get("name") or "Anonymní hráč", "avatar": player.get("avatar") or "🙂",
                    "team": player.get("team")}, "puzzleId": r.get("puzzle_id")}
        if kind == "support":
            item.update(category=r.get("category"), message=r.get("message"), replyTo=r.get("reply_to"),
                        page=r.get("page"), appVersion=r.get("app_version"))
        else:
            info = ns["puzzle_info"](str(r.get("puzzle_id") or "")) or {}
            item.update(word=r.get("word"), note=r.get("note"), challengeKey=r.get("challenge_key"),
                        mode=info.get("mode"), difficulty=info.get("difficulty"), level=info.get("level"),
                        legacy=bool(info.get("legacy")))
        rows.append(item)
    return {"reports": rows, "total": result["total"], "offset": offset, "limit": limit,
            "meta": metadata("proplet_admin_cases_v1:" + kind, status="ready" if result["total"] else "empty", unit="cases")}


def player_detail(ns, player_id):
    pid = identifier(player_id)
    result = rpc_payload(ns, "proplet_admin_player_detail_v1", {"p_player": pid})
    if not result.get("user"):
        raise HTTPException(404, "Hráč neexistuje")
    result["user"] = {**user_row(result["user"]), **{
        "additionalSessions": result.get("sessionCount"), "pushSubscriptions": result.get("pushCount")}}
    result["identity"] = result["user"]["identity"]
    result["latestAppVersion"] = result["user"]["appVersion"]
    result["lastGameAt"] = result["user"]["lastGameAt"]
    result["relatedReports"] = {
        "support": cases(ns, "support", status="all", player_id=pid, limit=10)["reports"],
        "words": cases(ns, "words", status="all", player_id=pid, limit=10)["reports"]}
    result["meta"] = metadata("proplet_admin_player_detail_v1", unit="account")
    return result


def update_case(ns, admin, kind, case_id, status, note=None):
    if status not in {"new", "reviewing", "resolved", "dismissed"}:
        raise HTTPException(400, "Neplatný stav hlášení")
    result = rpc_payload(ns, "proplet_admin_case_update_v1", {"p_admin": admin["player"]["id"],
        "p_kind": kind, "p_id": identifier(case_id), "p_status": status, "p_note": note})
    if result.get("ok") is not True:
        code = result.get("code")
        status_code = {"forbidden": 403, "not_found": 404, "invalid": 400}.get(code, 503)
        raise HTTPException(status_code, {"forbidden": "Zápis je dostupný pouze vlastníkovi",
            "not_found": "Hlášení neexistuje", "invalid": "Neplatná změna hlášení"}.get(code, "Změnu hlášení se nepodařilo potvrdit"))
    return result


def audit(ns, *, action="", target_id="", from_date=None, to_date=None, offset=0, limit=80):
    page_args(offset, limit)
    try:
        start = date.fromisoformat(from_date) if from_date else None
        end = date.fromisoformat(to_date) if to_date else None
    except ValueError:
        raise HTTPException(400, "Neplatné období historie")
    if start and end and start > end:
        raise HTTPException(400, "Začátek období je po jeho konci")
    result = rpc_payload(ns, "proplet_admin_audit_page_v1", {"p_action": action.strip()[:80] or None,
        "p_target": target_id.strip()[:120] or None, "p_from": start.isoformat() if start else None,
        "p_until": (end + timedelta(days=1)).isoformat() if end else None,
        "p_offset": offset, "p_limit": limit})
    rows = [{"id": r.get("id"), "action": r.get("action"), "targetType": r.get("target_type"),
             "targetId": r.get("target_id"), "details": safe_details(r.get("details") or {}),
             "createdAt": r.get("created_at"), "admin": r.get("admin") or "Administrátor"}
            for r in result.get("rows", [])]
    return {"entries": rows, "total": result["total"], "offset": offset, "limit": limit,
            "meta": metadata("proplet_admin_audit_page_v1", status="ready" if result["total"] else "empty", unit="mutations")}


def source(ns, key, loader, *, days=None):
    try:
        data = loader()
        return {"key": key, "data": data, "meta": metadata(key, days=days)}
    except (HTTPException, ValueError, KeyError, TypeError, OSError):
        return {"key": key, "data": None, "meta": metadata(key, status="unavailable", days=days,
            coverage="unavailable", message="Zdroj se nepodařilo ověřit. Obnovit lze nezávisle.")}


def runtime_metadata(ns):
    raw_sha = os.environ.get("VERCEL_GIT_COMMIT_SHA", "")
    sha = raw_sha if re.fullmatch(r"[a-fA-F0-9]{40}", raw_sha) else None
    return {"version": ns["APP_VERSION"], "sha": sha,
               "branch": ns.get("VERCEL_GIT_COMMIT_REF") or None,
               "environment": ns.get("VERCEL_ENV") or "local",
               "databaseLabel": "Izolovaná testovací data" if ns.get("VERCEL_GIT_COMMIT_REF") == "codex/admin-modernization" and ns.get("VERCEL_ENV") == "preview" else "Produkční data" if ns.get("VERCEL_ENV") == "production" else "Neověřené prostředí"}


def operations(ns):
    errors = source(ns, "operational_events", lambda: rpc_payload(ns, "proplet_admin_operations_v1", {}), days=7)
    runtime = runtime_metadata(ns)
    cron = {"key": "scheduled_runs", "data": None, "meta": metadata("scheduled_runs", status="unavailable",
        coverage="unavailable", message="Není připojen autoritativní přehled posledních běhů plánovaných úloh.")}
    return {"data": {"runtime": runtime, "errors": (errors["data"] or {}).get("errors"),
            "recentErrors": (errors["data"] or {}).get("recent"), "sources": [errors, cron]},
            "meta": metadata("runtime+operational_events", days=7, status="partial", coverage="partial",
                unit="events", affectedPlayersAvailable=False)}


def workspace(ns):
    support = source(ns, "support_reports", lambda: cases(ns, "support", limit=8))
    words = source(ns, "word_reports", lambda: cases(ns, "words", limit=8))
    def load_activity():
        today = ns["current_prague_date"]().isoformat()
        return ns["ranking_queries"].admin_overview(ns["db_rpc"], now=datetime.now(TZ), today=today,
            primary_daily_id=ns["expected_daily_puzzle_id"](today))
    activity = source(ns, "account_activity", load_activity)
    errors = source(ns, "operational_events", lambda: rpc_payload(ns, "proplet_admin_operations_v1", {}), days=7)
    queue = []
    for item in (support, words):
        if item["data"]:
            for r in item["data"]["reports"]:
                queue.append({"kind": item["key"], "id": r["id"], "title": r.get("word") or r.get("category") or "Hlášení",
                    "count": 1, "unit": "cases", "section": "reports", "playerId": r["reportedBy"].get("id"),
                    "puzzleId": r.get("puzzleId"), "status": r["status"]})
    if errors["data"]:
        for r in errors["data"].get("errors", [])[:8]:
            if r.get("eventType") in {"client_error", "server_error", "analytics_snapshot_failed", "rate_limit"}:
                queue.append({"kind": "operational_event", "id": r["eventType"], "title": r["eventType"],
                    "count": r["count"], "unit": "events", "section": "operations", "appVersion": r.get("appVersion")})
    sources = [support, words, activity, errors]
    return {"data": {"queue": queue, "caseCounts": {s["key"]: s["data"].get("total") if s["data"] else None for s in (support, words)},
                     "activity": activity["data"], "sources": sources, "runtime": runtime_metadata(ns)},
            "meta": metadata("workspace-sources", status="partial" if any(s["data"] is None for s in sources) else "ready")}


def content(ns, days=7):
    if not 1 <= days <= 14:
        raise HTTPException(400, "Program lze zobrazit nejvýše na 14 dní")
    today = ns["current_prague_date"]()
    calendar = []
    specials = None
    specials_enabled = os.environ.get("PROPLET_DAILY_SPECIALS_ENABLED", "false").lower() == "true"
    if specials_enabled:
        from backend.daily_specials import DailySpecials
        try:
            specials = DailySpecials.load(ns["ROOT"] / "data" / "daily_specials_private.json")
        except (OSError, ValueError, KeyError, TypeError):
            pass
    for i in range(days):
        day = today + timedelta(days=i)
        try:
            pid = ns["expected_daily_puzzle_id"](day.isoformat())
            info = ns["puzzle_info"](pid) or {}
            # Future published identity is safe for an authorized owner; never send private geometry/answers.
            daily = {"puzzleId": pid, "difficulty": info.get("difficulty"), "status": "today" if i == 0 else "upcoming"}
        except (HTTPException, ValueError, KeyError):
            daily = {"puzzleId": None, "difficulty": None, "status": "unavailable"}
        extra = {"status": "disabled" if not specials_enabled else "unavailable"}
        if specials:
            # Reuse the finite approved runtime manifest, no independent rotation rule.
            binding = specials._bindings.get(day.isoformat())
            extra = {"status": "scheduled" if binding else "none", "puzzleId": binding.puzzle_id if binding else None,
                     "difficulty": binding.difficulty if binding else None}
        week = ns["tajenka_week_for"](day)
        puzzle = ns["tajenka_puzzle_for_week"](week) if week else None
        tajenka = {"status": ("available" if ns["tajenka_is_live"](day) else "disabled"),
                   "puzzleId": puzzle.get("id") if puzzle else None, "slot": week}
        calendar.append({"date": day.isoformat(), "daily": daily, "extra": extra, "tajenka": tajenka})
    # Count the same published banks the player runtime sees, including released
    # rolling additions; do not count an unpublished JSON bank as playable.
    banks = [{"mode": "free", "difficulty": k,
              "count": len(ns["released_free_bank"](k, today)), "status": "published"}
             for k in ns["FREE_DIFFICULTIES"]]
    banks.append({"mode": "tajenka", "count": len(ns["load_tajenka_bank"]().get("puzzles", [])),
                  "status": "prepared-bank", "coverage": "Prepared finite bank; count does not mean all slots are currently playable."})
    return {"data": {"calendar": calendar, "banks": banks, "capabilities": [
                {"key": "archive", "enabled": ns.get("ARCHIVE_ENABLED") is True},
                {"key": "daily_special", "enabled": specials_enabled},
                {"key": "monthly_competition", "status": "unavailable", "reason": "Aktuální runtime tuto schopnost neposkytuje."}]},
            "meta": metadata("published-runtime-manifests", coverage="calendar-metadata; quality covers daily/free only",
                             status="partial" if any(r["daily"]["status"] == "unavailable" for r in calendar) else "ready")}


def analytics(ns, days=30, history=False):
    if history:
        result = ns["build_launch_report"](ns["db_rpc"]("proplet_launch_dataset", {"p_until": datetime.now(TZ).isoformat()}), datetime.now(TZ))
        return {"data": result, "meta": metadata("historical-board-v2-launch", days=30, coverage="historical-board-v2-only", historical=True)}
    raw_source = source(ns, "board-v3-short", lambda: rpc_payload(ns, "proplet_admin_activation_dataset_v1", {"p_days": days}), days=days)
    raw = raw_source["data"] or {}
    now = datetime.now(TZ)
    events = raw.get("events") or []
    # Flow UUID is an existing explicit provenance link. Do not infer identity by names or emails.
    flows = {}
    for e in events:
        key = e.get("flow")
        if not key:
            continue
        try:
            occurred = datetime.fromisoformat(e["at"].replace("Z", "+00:00"))
            if occurred.tzinfo is None:
                continue
        except (ValueError, TypeError, KeyError):
            continue
        flow = flows.setdefault(key, {"events": {}, "actors": set(), "first": occurred})
        flow["events"].setdefault(e["event"], []).append(occurred)
        if e.get("actor"):
            flow["actors"].add(e["actor"])
        flow["first"] = min(flow["first"], occurred)
    flows = {key: flow for key, flow in flows.items() if "first_board_experiment_assigned" in flow["events"]}
    for flow in flows.values():
        flow["first"] = min(flow["events"]["first_board_experiment_assigned"])
    definition = [("first_board_experiment_assigned", "První skutečná hra přiřazena"),
                  ("first_board_experiment_started", "První skutečná hra spuštěna"),
                  ("first_board_experiment_completed", "První skutečná hra dokončena"),
                  ("first_steps_v1_offer", "Nabídka uložení postupu"),
                  ("first_steps_v1_saved", "Serverové uložení potvrzené klientem")]
    current = {key: f["first"] for key, f in flows.items() if "first_board_experiment_assigned" in f["events"]}
    steps = []
    for event, label in definition:
        previous = len(current)
        current = {k: min(ts) for k, floor in current.items()
                   if (ts := [t for t in flows[k]["events"].get(event, []) if floor <= t])}
        steps.append({"key": event, "label": label, "count": len(current) if events else None,
            "denominator": previous if events else None, "status": "ready" if events else "unavailable", "unit": "flows"})
    steps.insert(0, {"key": "training", "label": "Krátký trénink → první hra", "count": None, "denominator": None,
        "status": "unavailable", "unit": "flows", "reason": "Trénink nemá spolehlivou vazbu na později založené first_steps_run_id; jeho události nelze sečíst do stejného funnelu."})
    steps.insert(5, {"key": "authentication", "label": "Dokončená autentizace", "count": None, "denominator": None,
        "status": "unavailable", "unit": "flows", "reason": "Google/manual klik není úspěšná autentizace. Samostatný autoritativní signál této kohorty není ověřen."})
    active = raw.get("activity") or []
    activity_days = {}
    for row in active:
        activity_days.setdefault(row["actor"], set()).add(row["day"])
    retention = {}
    for distance in (1, 7):
        eligible = retained = pending = 0
        for flow in flows.values():
            first = flow["first"].astimezone(TZ).date()
            target = first + timedelta(days=distance)
            if target >= now.date():
                pending += 1
                continue
            eligible += 1
            retained += any(target.isoformat() in activity_days.get(actor, set()) for actor in flow["actors"])
        retention[f"d{distance}"] = {"eligible": eligible, "retained": retained, "pending": pending,
            "rate": round(retained / eligible, 4) if eligible else None,
            "status": "ready" if eligible else "pending" if pending else "unavailable",
            "unit": "flows", "definition": "Návrat doloženého stejného aktéra na Prague kalendářní den D+N; dnešní cílový den vyloučen."}
    return {"data": {"onboardingVersion": "board-v3-short", "steps": steps, "retention": retention,
        "populations": [{"key": "first-game-flows", "count": len(flows) if events else None, "unit": "flows"},
                        {"key": "anonymous-visitors", "count": None, "status": "unavailable", "unit": "visitors"},
                        {"key": "linked-account-flows", "count": sum(any(a.startswith('p:') for a in f['actors']) for f in flows.values()) if events else None, "unit": "flows", "definition": "Subset of first-game flows with explicit account actor provenance; not unique accounts."}],
        "branches": [{"key": "skipped-or-returning", "status": "unavailable", "count": None,
                      "reason": "Bez společného flow ID nejsou přeskočení považována za propad funnelu."}],
        "measurementStartedAt": raw.get("measurementStartedAt")},
        "meta": metadata("board-v3-short-provenance-events", days=days, status="partial" if events else "unavailable",
            coverage="linked first-game flows only; training/authentication unavailable; client confirmation is not a DB receipt",
            historicalDataLimited=True, unit="flows")}


def install(ns):
    app = ns["app"]
    def authorize(authorization):
        ns["require_admin"](authorization)

    @app.get("/api/admin/workspace")
    def workspace_route(authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        return workspace(ns)

    @app.get("/api/admin/operations")
    def operations_route(authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        return operations(ns)

    @app.get("/api/admin/content")
    def content_route(days: int = Query(default=7, ge=1, le=14), authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        return content(ns, days)

    @app.get("/api/admin/analytics")
    def analytics_route(days: int = Query(default=30, ge=1, le=90), history: bool = False,
                        authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        return analytics(ns, days, history)

    @app.get("/api/admin/teams")
    def teams_route(q: str = Query(default="", max_length=80), offset: int = Query(default=0, ge=0, le=100000),
                    limit: int = Query(default=30, ge=1, le=200), authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        data = rpc_payload(ns, "proplet_admin_teams_v1", {"p_query": q or None, "p_offset": offset, "p_limit": limit})
        return {**data, "offset": offset, "limit": limit,
            "meta": metadata("proplet_admin_teams_v1", unit="current-memberships", scoringAttribution="historical results unchanged")}

    @app.get("/api/admin/teams/{code}")
    def team_route(code: str, offset: int = Query(default=0, ge=0, le=100000),
                   limit: int = Query(default=30, ge=1, le=200), authorization: Optional[str] = Header(default=None)):
        authorize(authorization)
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", code):
            raise HTTPException(400, "Neplatný kód týmu")
        page = users(ns, offset=offset, limit=limit, team=code.upper())
        return {"team": {"code": code.upper(), "name": page["users"][0]["team"] if page["users"] else code.upper()},
                "members": page["users"], "total": page["total"], "offset": offset, "limit": limit, "meta": page["meta"]}
