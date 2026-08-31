"""Bounded read adapters for rankings and admin summaries.

The public response rules remain in ``server.py``.  This module owns only the
database boundary: narrow RPC contracts, entity-scoped lookups and a measured
rolling-deploy fallback that cannot become an unlimited table scan.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Callable, Iterable, Optional

from fastapi import HTTPException


logger = logging.getLogger("proplet")
RUN_TRANSFER_LIMIT = 5000
ENTITY_TRANSFER_LIMIT = 5000


def _safe_values(values: Iterable[Any]) -> list[str]:
    clean = sorted({str(value) for value in values if value is not None and str(value)})
    if any(not re.fullmatch(r"[\w-]{1,80}", value, flags=re.UNICODE) for value in clean):
        raise HTTPException(400, "Neplatný identifikátor databázového filtru")
    return clean


def in_filter(values: Iterable[Any]) -> str:
    """Encode server-owned UUID/team identifiers for a PostgREST ``in`` filter."""
    clean = _safe_values(values)
    return f"in.({','.join(clean)})"


def rpc_rows(
    rpc: Callable[[str, Optional[dict]], Any],
    function: str,
    body: Optional[dict] = None,
) -> list[dict]:
    rows = rpc(function, body or {})
    if not isinstance(rows, list):
        raise HTTPException(503, "Databázový souhrn není dostupný")
    return rows


def entity_context(
    select_bounded: Callable[..., list[dict]],
    player_ids: Iterable[Any],
    team_codes: Iterable[Any] = (),
    *,
    include_team_members: bool = False,
) -> tuple[list[dict], list[dict]]:
    """Load only players and leagues referenced by an aggregate or scoped run."""
    ids = _safe_values(player_ids)
    codes = _safe_values(team_codes)
    players = [] if not ids else select_bounded(
        "players",
        columns="id,name,avatar,family_code,team_joined_at,public_rankings",
        filters={"id": in_filter(ids)},
        max_rows=min(ENTITY_TRANSFER_LIMIT, max(1, len(ids))),
    )
    discovered_codes = {
        str(player.get("family_code") or "").strip().upper()
        for player in players
        if player.get("family_code") and not str(player.get("family_code")).strip().upper().startswith("SOLO_")
    }
    codes = _safe_values([*codes, *discovered_codes])
    if include_team_members and codes:
        team_members = select_bounded(
            "players",
            columns="id,name,avatar,family_code,team_joined_at,public_rankings",
            filters={"family_code": in_filter(codes)},
            max_rows=ENTITY_TRANSFER_LIMIT,
        )
        players = list({str(row.get("id")): row for row in [*players, *team_members] if row.get("id")}.values())
    leagues = [] if not codes else select_bounded(
        "leagues",
        columns="code,name,public_opt_in,public_name,public_enabled_at",
        filters={"code": in_filter(codes)},
        max_rows=min(ENTITY_TRANSFER_LIMIT, max(1, len(codes))),
    )
    return players, leagues


def ranking_runs(
    rpc: Callable[[str, Optional[dict]], Any],
    select_bounded: Callable[..., list[dict]],
    *,
    mode: str,
    puzzle_id: str,
    daily_date: Optional[str] = None,
) -> tuple[list[dict], str]:
    """Return first competitive run per player, preferring the bounded DB RPC."""
    try:
        rows = rpc_rows(rpc, "proplet_ranking_runs_v1", {
            "p_mode": mode,
            "p_puzzle_id": puzzle_id,
            "p_daily_date": daily_date,
        })
        return rows, "database-rpc-v1"
    except HTTPException as exc:
        # Compatibility is intentionally narrow and measurable. It reads one
        # puzzle (and, for Daily, one challenge key), never the full table.
        logger.warning(
            "ranking runs RPC unavailable; bounded compatibility query mode=%s puzzle=%s detail=%s",
            mode,
            puzzle_id,
            exc.detail,
        )
        filters = {"mode": f"eq.{mode}", "puzzle_id": f"eq.{puzzle_id}", "calm_mode": "eq.false"}
        if daily_date:
            filters["challenge_key"] = f"eq.daily:{daily_date}"
        raw = select_bounded(
            "puzzle_runs",
            columns=(
                "id,player_id,puzzle_id,challenge_key,mode,elapsed_ms,moves,hints_used,wrong_attempts,"
                "clean_solve,calm_mode,completed_at"
            ),
            filters=filters,
            order="completed_at.asc,id.asc",
            max_rows=RUN_TRANSFER_LIMIT,
        )
        first: dict[str, dict] = {}
        for row in raw:
            player_id = str(row.get("player_id") or "")
            if player_id and player_id not in first:
                first[player_id] = row
        return list(first.values()), "bounded-compatibility-v1"


def admin_overview(
    rpc: Callable[[str, Optional[dict]], Any],
    *,
    now: datetime,
    today: str,
    primary_daily_id: str,
) -> dict:
    rows = rpc_rows(rpc, "proplet_admin_overview_v1", {
        "p_now": now.isoformat(),
        "p_today": today,
        "p_primary_daily_id": primary_daily_id,
    })
    if len(rows) != 1 or not isinstance(rows[0].get("payload"), dict):
        raise HTTPException(503, "Admin souhrn má neplatný formát")
    return rows[0]["payload"]


def admin_users(
    rpc: Callable[[str, Optional[dict]], Any],
    *,
    query: str,
    limit: int,
    offset: int = 0,
) -> tuple[int, list[dict]]:
    rows = rpc_rows(rpc, "proplet_admin_users_v1", {
        "p_query": query or None,
        "p_limit": limit,
        "p_offset": offset,
    })
    total = int(rows[0].get("total_count") or 0) if rows else 0
    return total, rows
