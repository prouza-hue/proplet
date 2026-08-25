from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, Field


ALLOWED_CHALLENGE_EVENTS = {
    "daily_share_clicked",
    "daily_share_created",
    "daily_share_native_completed",
    "daily_share_clipboard_completed",
    "daily_share_cancelled",
    "daily_share_failed",
    "level_share_clicked",
    "level_share_created",
    "level_share_native_completed",
    "level_share_clipboard_completed",
    "level_share_cancelled",
    "level_share_failed",
    "shared_daily_opened",
    "shared_daily_started",
    "shared_daily_completed",
    "shared_level_opened",
    "shared_level_started",
    "shared_level_completed",
    "shared_level_beaten",
    "shared_level_returned_to_progress",
    "shared_level_invalid",
}


class ChallengeEventCreate(BaseModel):
    event_type: str = Field(min_length=2, max_length=40)


def install_competitive_sharing(
    app,
    *,
    db_insert,
    enforce_rate_limit,
    tz,
    telemetry_actor=None,
    app_version: str = "",
    vercel_env: str = "",
    **_kwargs,
):
    """Add narrow telemetry for v3.33.1 shared-level challenges.

    The existing /api/product-event allow-list remains untouched. Preview executions are
    intentionally ignored so physical QA cannot pollute launch analytics in the production DB.
    """

    @app.post("/api/challenge-event")
    def challenge_event(
        payload: ChallengeEventCreate,
        request: Request,
        authorization: Optional[str] = Header(default=None),
        x_proplet_anon_id: Optional[str] = Header(default=None, alias="X-Proplet-Anon-ID"),
    ):
        enforce_rate_limit(request, "challenge_event", limit=300, window_seconds=3600)
        if payload.event_type not in ALLOWED_CHALLENGE_EVENTS:
            raise HTTPException(400, "Neplatný challenge event")
        if str(vercel_env or "").strip().lower() == "preview":
            return {"ok": True, "ignored": True, "preview": True}

        if not callable(telemetry_actor):
            raise HTTPException(503, "Challenge analytika není připravená")
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
