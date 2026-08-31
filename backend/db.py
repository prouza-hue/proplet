"""Small, injectable PostgREST/RPC transport for the Proplet API.

No domain decisions live here.  The optional dependency injection hooks let
``server.py`` retain its historical monkeypatch/re-export contract while the
actual HTTP transport is isolated and directly characterizable.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

import httpx
from fastapi import HTTPException

from .config import settings


logger = logging.getLogger("proplet")
DEFAULT_HTTP_CLIENT = httpx.Client(
    timeout=12.0,
    limits=httpx.Limits(max_connections=40, max_keepalive_connections=20),
)


def _values(
    supabase_url: Optional[str],
    supabase_secret_key: Optional[str],
) -> tuple[str, str]:
    return (
        settings.supabase_url if supabase_url is None else supabase_url,
        settings.supabase_secret_key if supabase_secret_key is None else supabase_secret_key,
    )


def supabase_ready(supabase_url: Optional[str] = None, supabase_secret_key: Optional[str] = None) -> bool:
    url, key = _values(supabase_url, supabase_secret_key)
    return bool(url and key)


def supabase_headers(supabase_secret_key: Optional[str] = None) -> dict[str, str]:
    """Build server-only Supabase headers for current and legacy keys."""
    _, secret_key = _values(None, supabase_secret_key)
    headers = {
        "apikey": secret_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if secret_key.count(".") == 2 and secret_key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {secret_key}"
    return headers


def db_request(
    method: str,
    table: str,
    *,
    params=None,
    body=None,
    prefer=None,
    supabase_url: Optional[str] = None,
    supabase_secret_key: Optional[str] = None,
    http_client=None,
):
    url_base, secret_key = _values(supabase_url, supabase_secret_key)
    if not supabase_ready(url_base, secret_key):
        raise HTTPException(503, "Supabase ještě není připojený")
    headers = supabase_headers(secret_key)
    if prefer:
        headers["Prefer"] = prefer
    url = f"{url_base}/rest/v1/{table}"
    client = http_client or DEFAULT_HTTP_CLIENT
    try:
        response = client.request(method, url, params=params, json=body, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Databáze je momentálně nedostupná") from exc
    if response.status_code >= 400:
        internal_detail = "database error"
        try:
            payload = response.json()
            internal_detail = payload.get("message") or payload.get("hint") or internal_detail
        except Exception:
            pass
        logger.warning(
            "Supabase request failed method=%s table=%s status=%s detail=%s",
            method,
            table,
            response.status_code,
            str(internal_detail)[:300],
        )
        if response.status_code == 409:
            raise HTTPException(409, "Konflikt při ukládání dat")
        if response.status_code >= 500:
            raise HTTPException(503, "Databáze je momentálně nedostupná")
        raise HTTPException(400, "Data se nepodařilo zpracovat")
    if not response.content:
        return []
    return response.json()


def db_select(table: str, request_fn: Optional[Callable[..., Any]] = None, /, **filters):
    requester = request_fn or db_request
    params = {"select": "*"}
    for key, value in filters.items():
        if value is not None:
            params[key] = f"eq.{value}"
    return requester("GET", table, params=params)


def db_select_all(table: str, request_fn: Optional[Callable[..., Any]] = None, /, **filters):
    """Read complete analytics/admin datasets past PostgREST's 1,000-row page."""
    requester = request_fn or db_request
    rows: list[dict] = []
    page_size = 1000
    offset = 0
    while True:
        params = {"select": "*", "limit": str(page_size), "offset": str(offset)}
        for key, value in filters.items():
            if value is not None:
                params[key] = f"eq.{value}"
        page = requester("GET", table, params=params)
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def db_insert(table: str, row: dict, request_fn: Optional[Callable[..., Any]] = None, /):
    requester = request_fn or db_request
    rows = requester("POST", table, body=row, prefer="return=representation")
    return rows[0] if rows else row


def db_upsert_push_subscription(
    row: dict,
    rpc_fn: Optional[Callable[..., Any]] = None,
    /,
):
    """Atomically create or refresh one browser endpoint without changing its id."""
    rpc = rpc_fn or db_rpc
    result = rpc("proplet_upsert_push_subscription", {
        "p_endpoint": row["endpoint"],
        "p_player_id": row.get("player_id"),
        "p_anonymous_id": row.get("anonymous_id"),
        "p_p256dh": row["p256dh"],
        "p_auth": row["auth"],
        "p_user_agent": row.get("user_agent"),
        "p_daily_enabled": bool(row.get("daily_enabled", True)),
        "p_content_enabled": bool(row.get("content_enabled", True)),
    })
    if isinstance(result, list) and result:
        return result[0]
    if isinstance(result, dict):
        return result
    raise HTTPException(503, "Registraci upozornění se nepodařilo potvrdit")


def db_update(
    table: str,
    filters: dict,
    values: dict,
    request_fn: Optional[Callable[..., Any]] = None,
    /,
):
    requester = request_fn or db_request
    params = {key: f"eq.{value}" for key, value in filters.items()}
    return requester("PATCH", table, params=params, body=values, prefer="return=representation")


def db_delete(table: str, request_fn: Optional[Callable[..., Any]] = None, /, **filters):
    requester = request_fn or db_request
    params = {key: f"eq.{value}" for key, value in filters.items() if value is not None}
    return requester("DELETE", table, params=params, prefer="return=representation")


def xp_economy_migrated(
    targets: dict[str, int],
    returning_bonus_xp: int,
    request_fn: Optional[Callable[..., Any]] = None,
    /,
) -> bool:
    """Check that every positive Free reward uses the current XP economy."""
    requester = request_fn or db_request
    for table in ("results", "free_slot_rewards"):
        for difficulty, target in targets.items():
            params = {
                "select": "id,points",
                "difficulty": f"eq.{difficulty}",
                "points": (
                    f"not.in.({target},{target + returning_bonus_xp})"
                    if table == "results"
                    else f"neq.{target}"
                ),
                "order": "points.desc",
                "limit": "1",
            }
            if table == "results":
                params["mode"] = "eq.free"
            rows = requester("GET", table, params=params)
            if rows and int(rows[0].get("points") or 0) > 0:
                return False
    return True


def db_rpc(
    function: str,
    body: Optional[dict] = None,
    *,
    supabase_url: Optional[str] = None,
    supabase_secret_key: Optional[str] = None,
    http_client=None,
    httpx_client_factory: Callable[..., Any] = httpx.Client,
    error_mapper: Optional[Callable[[int, dict], Optional[HTTPException]]] = None,
):
    url_base, secret_key = _values(supabase_url, supabase_secret_key)
    if not supabase_ready(url_base, secret_key):
        raise HTTPException(503, "Supabase ještě není připojený")
    headers = supabase_headers(secret_key)
    url = f"{url_base}/rest/v1/rpc/{function}"
    client = http_client or DEFAULT_HTTP_CLIENT
    try:
        response = client.post(url, json=body or {}, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(503, "Databáze je momentálně nedostupná") from exc
    if response.status_code == 401:
        # Supabase can transiently reject a newly propagated/rotated secret on one
        # gateway node. A 401 is returned before PostgREST executes the function, so
        # one fresh-connection retry cannot duplicate the RPC side effect.
        logger.warning("Supabase RPC auth retry function=%s status=401", function)
        retry_headers = {**headers, "Connection": "close"}
        try:
            with httpx_client_factory(timeout=12.0) as retry_client:
                response = retry_client.post(url, json=body or {}, headers=retry_headers)
        except httpx.HTTPError as exc:
            raise HTTPException(503, "Databáze je momentálně nedostupná") from exc
    if response.status_code >= 400:
        try:
            error_payload = response.json()
        except Exception:
            error_payload = {}
        logger.warning("Supabase RPC failed function=%s status=%s", function, response.status_code)
        if error_mapper:
            mapped = error_mapper(response.status_code, error_payload if isinstance(error_payload, dict) else {})
            if mapped is not None:
                raise mapped
        raise HTTPException(503 if response.status_code >= 500 else 400, "Bezpečnostní služba databáze není připravená")
    if not response.content:
        return None
    return response.json()
