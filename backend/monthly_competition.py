"""Monthly competition read adapter; scoring lives in the atomic DB boundary.

Never infer scores from XP or browser analytics. The caller chooses the isolated
preview database, authenticates the viewer, and supplies the existing ranking
identity function so monthly standings respect the same privacy choices.
"""
from __future__ import annotations

from datetime import date
from collections import Counter
from typing import Callable

from fastapi import HTTPException


def month_start(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, "Neplatný měsíc soutěže") from exc
    if parsed.day != 1 or parsed.isoformat() != value:
        raise HTTPException(400, "Měsíc musí začínat prvním dnem")
    return parsed.isoformat()


def state(
    *, rpc: Callable, player_id: str | None, month: str | None,
    players: Callable[[list[str]], list[dict]], identity: Callable,
) -> dict:
    """Read actual server standings and apply the established identity policy."""
    value = rpc("proplet_monthly_state_v1", {
        "p_player_id": player_id, "p_month": month_start(month),
    })
    if not isinstance(value, dict) or not isinstance(value.get("enabled"), bool):
        raise HTTPException(503, "Měsíční soutěž je dočasně nedostupná")
    if not value["enabled"]:
        reason = value.get("reason") or "disabled"
        return {"enabled": False, "reason": "policy-pending" if reason=="rules-pending" else reason}
    standings = value.get("standings")
    previous = value.get("previousPodium")
    if not isinstance(standings, list) or not isinstance(previous, list):
        raise HTTPException(503, "Pořadí měsíční soutěže se nepodařilo načíst")
    mine = value.get("me")
    # All ranks are calculated in SQL before pagination, with score as the only
    # ordering key for placement. UUID order merely makes equal rows stable.
    selected = standings[:100]
    if isinstance(mine, dict) and mine.get("rank") is not None and not any(
        row.get("playerId") == player_id for row in selected
    ):
        selected = selected + [{key: val for key, val in mine.items() if key != "days"}]
    ids = sorted({str(row["playerId"]) for row in selected + previous if row.get("playerId")})
    profiles = {str(row["id"]): row for row in players(ids)} if ids else {}
    used_names: set[str] = set()
    display_cache: dict[str, dict] = {}
    rank_counts = Counter(row.get("rank") for row in standings)
    previous_rank_counts = Counter(row.get("rank") for row in previous)

    def public_row(row: dict, counts=rank_counts) -> dict:
        pid = str(row.get("playerId") or "")
        profile = profiles.get(pid, {"id": pid})
        if pid not in display_cache:
            display_cache[pid] = identity(profile, player_id, "monthly:" + value["month"], used_names)
        display = display_cache[pid]
        public = {key:val for key,val in row.items() if key!='playerId'}
        return {**public, **display, "isMine": pid == player_id,
                "sharedRank": counts[row.get("rank")] > 1}

    return {
        **value,
        "month": value["month"][:7],
        "standings": [public_row(row) for row in selected],
        "previousPodium": [public_row(row,previous_rank_counts) for row in previous],
        "me": {**{k:v for k,v in mine.items() if k!='playerId'},"sharedRank":rank_counts[mine.get('rank')]>1}
            if isinstance(mine,dict) else None,
        "badges": [{**badge,"month":badge["month"][:7]} for badge in value.get("badges",[])],
        "totalPlayers": len(standings),
        "limit":100,
        "truncated":len(standings)>100,
    }


def finalize(*, rpc: Callable) -> dict:
    result = rpc("proplet_finalize_monthly_competition_v1", {})
    if not isinstance(result, dict) or not isinstance(result.get("finalized"), int):
        raise HTTPException(503, "Uzávěrka měsíční soutěže nebyla potvrzena")
    return result
