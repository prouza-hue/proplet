from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, Field


ACCOUNT_CREATION_BONUS_KEY = "account_creation_v1"
ACCOUNT_CREATION_BONUS_XP = 500
ALLOWED_ACCOUNT_BONUS_EVENTS = {
    "account_bonus_offer_seen",
    "account_bonus_create_clicked",
    "account_bonus_granted",
    "release_notes_shown",
    "release_notes_dismissed",
}


class AccountBonusEventCreate(BaseModel):
    event_type: str = Field(min_length=2, max_length=40)


def install_account_bonus(
    app,
    *,
    db_select,
    db_insert,
    auth_player,
    enforce_rate_limit,
    tz,
    telemetry_actor=None,
    app_version: str = "",
    vercel_env: str = "",
    **_kwargs,
):
    """Install the v3.33.1 account-creation reward.

    The reward lives outside `results`, so it can increase personal lifetime XP / rank without
    entering competitive XP scoring. A unique `(player_id, reward_key)` constraint is the
    server-side source of truth for exactly-once granting.
    """

    def rows_for(player_id: str) -> list[dict]:
        return db_select("account_rewards", player_id=player_id)

    def reward_summary(player_id: str) -> dict:
        rows = rows_for(player_id)
        creation = next((row for row in rows if row.get("reward_key") == ACCOUNT_CREATION_BONUS_KEY), None)
        total = sum(max(0, int(row.get("points") or 0)) for row in rows)
        return {
            "accountCreationBonusXp": ACCOUNT_CREATION_BONUS_XP,
            "accountCreationBonusGranted": creation is not None,
            "bonusXp": total,
            "rewardKey": ACCOUNT_CREATION_BONUS_KEY,
        }

    def ensure_creation_bonus(player_id: str) -> tuple[dict, bool]:
        summary = reward_summary(player_id)
        if summary["accountCreationBonusGranted"]:
            return summary, False

        # Preview shares the production database. Do not create reward rows for preview-only
        # test accounts; simulate the grant so the UI can still be physically QA'd end-to-end.
        if str(vercel_env or "").strip().lower() == "preview":
            return {
                **summary,
                "accountCreationBonusGranted": True,
                "bonusXp": max(summary["bonusXp"], ACCOUNT_CREATION_BONUS_XP),
                "simulated": True,
            }, True

        try:
            db_insert(
                "account_rewards",
                {
                    "id": str(uuid.uuid4()),
                    "player_id": player_id,
                    "reward_key": ACCOUNT_CREATION_BONUS_KEY,
                    "points": ACCOUNT_CREATION_BONUS_XP,
                    "granted_at": datetime.now(tz).isoformat(),
                },
            )
            return reward_summary(player_id), True
        except HTTPException as exc:
            # Concurrent tabs may race the same claim. The unique key makes the operation
            # idempotent; after a conflict, re-read and return the canonical state.
            canonical = reward_summary(player_id)
            if canonical["accountCreationBonusGranted"]:
                return canonical, False
            raise exc

    @app.get("/api/account-bonus/status")
    def account_bonus_status(
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        enforce_rate_limit(request, "account_bonus_status", limit=180, window_seconds=3600)
        player = auth_player(authorization)
        return {"ok": True, **reward_summary(player["id"])}

    @app.post("/api/account-bonus/claim")
    def account_bonus_claim(
        request: Request,
        authorization: Optional[str] = Header(default=None),
    ):
        enforce_rate_limit(request, "account_bonus_claim", limit=60, window_seconds=3600)
        player = auth_player(authorization)
        summary, newly_granted = ensure_creation_bonus(player["id"])
        return {"ok": True, "newlyGranted": newly_granted, **summary}

    @app.post("/api/account-bonus-event")
    def account_bonus_event(
        payload: AccountBonusEventCreate,
        request: Request,
        authorization: Optional[str] = Header(default=None),
        x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
    ):
        enforce_rate_limit(request, "account_bonus_event", limit=240, window_seconds=3600)
        if payload.event_type not in ALLOWED_ACCOUNT_BONUS_EVENTS:
            raise HTTPException(400, "Neplatný account bonus event")
        if str(vercel_env or "").strip().lower() == "preview":
            return {"ok": True, "ignored": True, "preview": True}
        if not callable(telemetry_actor):
            raise HTTPException(503, "Account bonus analytika není připravená")
        actor = telemetry_actor(authorization, x_proplet_anon_id)
        db_insert(
            "product_events",
            {
                "id": str(uuid.uuid4()),
                "player_id": actor.get("player_id"),
                "anonymous_id": actor.get("anonymous_id"),
                "event_type": payload.event_type,
                "app_version": app_version,
                "created_at": datetime.now(tz).isoformat(),
            },
        )
        return {"ok": True}
