from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException

RESCUE_LIMIT_MS = 60_000
RESCUE_LIMIT_SECONDS = 60
_LEGACY_RESCUE_LIMIT_MS = 30_000


def _find_route(app, path: str, method: str):
    wanted = method.upper()
    for route in getattr(app, "routes", []):
        methods = getattr(route, "methods", None) or set()
        if getattr(route, "path", None) == path and wanted in methods:
            return route
    return None


def _replace_route_call(route, replacement):
    if route is None:
        return False
    route.endpoint = replacement
    dependant = getattr(route, "dependant", None)
    if dependant is not None:
        dependant.call = replacement
    return True


def install_rescue_limit_v40115(
    app,
    *,
    db_select=None,
    db_update=None,
    auth_player=None,
    enforce_rate_limit=None,
    player_stats=None,
    tz=None,
    **_,
):
    """Extend streak rescue from 30 s to 60 s without touching historical rows.

    The core rescue routes predate Gen4 and still contain the old 30-second constant.
    This additive release hook keeps the change isolated and reversible while both
    old cached clients and the current Gen4 client remain compatible.
    """
    if getattr(app.state, "rescue_limit_v40115", False):
        return
    app.state.rescue_limit_v40115 = True

    status_route = _find_route(app, "/api/rescue-status", "GET")
    start_route = _find_route(app, "/api/rescue/start", "POST")
    finish_route = _find_route(app, "/api/rescue/finish", "POST")

    def normalize_status(result, authorization=None):
        if not isinstance(result, dict) or result.get("state") not in {"available", "started"}:
            return result
        out = dict(result)
        out["timeLimitMs"] = RESCUE_LIMIT_MS
        if out.get("state") == "available":
            out["secondsRemaining"] = RESCUE_LIMIT_SECONDS
            return out

        remaining = None
        if db_select is not None and auth_player is not None:
            try:
                player = auth_player(authorization)
                puzzle_id = out.get("puzzleId")
                rows = db_select("streak_rescues", player_id=player["id"], puzzle_id=puzzle_id) if puzzle_id else []
                if rows:
                    row = sorted(rows, key=lambda r: str(r.get("started_at") or ""), reverse=True)[0]
                    elapsed_ms = max(0, int(row.get("elapsed_ms") or 0))
                    remaining = max(0.0, round((RESCUE_LIMIT_MS - elapsed_ms) / 1000, 1))
            except Exception:
                remaining = None
        if remaining is None:
            # The old response reports remaining time against 30 s. Adding 30 s
            # preserves the already-consumed active-play time for normal resumes.
            try:
                remaining = max(0.0, min(float(RESCUE_LIMIT_SECONDS), float(out.get("secondsRemaining") or 0) + 30.0))
            except Exception:
                remaining = float(RESCUE_LIMIT_SECONDS)
        out["secondsRemaining"] = remaining
        return out

    if status_route is not None and getattr(status_route.dependant.call, "__rescue60_wrapped__", False) is False:
        base_status = status_route.dependant.call

        def status_60(*args, **kwargs):
            result = base_status(*args, **kwargs)
            authorization = kwargs.get("authorization")
            if authorization is None and len(args) >= 2:
                authorization = args[1]
            return normalize_status(result, authorization)

        status_60.__rescue60_wrapped__ = True
        _replace_route_call(status_route, status_60)

    if start_route is not None and getattr(start_route.dependant.call, "__rescue60_wrapped__", False) is False:
        base_start = start_route.dependant.call

        def start_60(*args, **kwargs):
            result = base_start(*args, **kwargs)
            authorization = kwargs.get("authorization")
            if authorization is None and len(args) >= 2:
                authorization = args[1]
            return normalize_status(result, authorization)

        start_60.__rescue60_wrapped__ = True
        _replace_route_call(start_route, start_60)

    if finish_route is not None and getattr(finish_route.dependant.call, "__rescue60_wrapped__", False) is False:
        base_finish = finish_route.dependant.call

        def finish_60(*args, **kwargs):
            payload = kwargs.get("payload") if "payload" in kwargs else (args[0] if args else None)
            request = kwargs.get("request") if "request" in kwargs else (args[1] if len(args) > 1 else None)
            authorization = kwargs.get("authorization") if "authorization" in kwargs else (args[2] if len(args) > 2 else None)

            # Preserve the canonical core path for everything it already handled.
            # We only own the newly valid 30–60 second success window.
            elapsed_ms = getattr(payload, "elapsed_ms", None)
            completed = bool(getattr(payload, "completed", False))
            if not completed or elapsed_ms is None or elapsed_ms <= _LEGACY_RESCUE_LIMIT_MS or elapsed_ms > RESCUE_LIMIT_MS:
                return base_finish(*args, **kwargs)

            if None in (db_select, db_update, auth_player, enforce_rate_limit, player_stats, tz):
                # Fail closed rather than silently accepting a rescue without the
                # same persistence/rate-limit guarantees as the core endpoint.
                return base_finish(*args, **kwargs)

            enforce_rate_limit(request, "rescue_finish", limit=30, window_seconds=3600)
            player = auth_player(authorization)
            rows = db_select("streak_rescues", player_id=player["id"], puzzle_id=payload.puzzle_id)
            if not rows:
                raise HTTPException(404, "Záchranný pokus nebyl nalezen")
            row = sorted(rows, key=lambda r: str(r.get("started_at") or ""), reverse=True)[0]
            if row.get("status") != "started":
                return {
                    "ok": row.get("status") == "passed",
                    "state": row.get("status"),
                    "stats": player_stats(player["id"]),
                }

            db_update("streak_rescues", {"id": row["id"]}, {
                "status": "passed",
                "completed_at": datetime.now(tz).isoformat(),
                "elapsed_ms": int(elapsed_ms),
            })
            return {"ok": True, "state": "passed", "stats": player_stats(player["id"])}

        finish_60.__rescue60_wrapped__ = True
        _replace_route_call(finish_route, finish_60)
